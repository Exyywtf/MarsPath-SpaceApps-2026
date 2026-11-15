"""Check exported science summaries with an independent geodesic sampler."""

import argparse
import json
import math
from pathlib import Path

import numpy as np
from pyproj import Geod
from verify_v4_datasets import ROOT, MANIFEST, asset, packed_grid

RADIUS = 3396190
SPHERE = Geod(a=RADIUS, f=0)


def segments(geometry):
    """Rejoin the date-line splits inserted only for the display and GeoJSON."""
    points = [tuple(point) for point in geometry[0]]
    for linestring in geometry[1:]:
        continuation = [tuple(point) for point in linestring]
        if abs(points[-1][0]) == 180 and abs(continuation[0][0]) == 180 and points[-1][1] == continuation[0][1]:
            points.pop()
            continuation = continuation[1:]
        points.extend(continuation)
    return zip(points, points[1:])


def vectors(lonlat):
    longitude, latitude = np.deg2rad(lonlat).T
    return np.stack((np.cos(latitude) * np.cos(longitude), np.cos(latitude) * np.sin(longitude), np.sin(latitude)), axis=-1)


def angles(u, v):
    return np.arctan2(np.linalg.norm(np.cross(u, v), axis=-1), np.sum(u * v, axis=-1))


def distance_to_arc(observations, start, end):
    normal = np.cross(start, end)
    normal /= np.linalg.norm(normal)
    feet = observations - (observations @ normal)[:, None] * normal
    norms = np.linalg.norm(feet, axis=1)
    feet /= np.maximum(norms[:, None], 1e-15)
    internal = (np.cross(start, feet) @ normal >= -1e-12) & (np.cross(feet, end) @ normal >= -1e-12) & (norms > 1e-12)
    angle = np.minimum(angles(observations, start), angles(observations, end))
    return RADIUS * np.where(internal, angles(observations, feet), angle)


def cell_values(grid, x, y):
    h, w = grid.shape
    ix = np.floor(((x + 180) % 360) * (w / 360)).astype(int)
    iy = np.floor((90 - y) * (h / 180)).astype(int).clip(0, h - 1)
    return grid[iy, ix]


def verify(payload, geology, catalog, thermal, observations):
    item, *connectors = payload["features"]
    props = item["properties"]
    evidence = props["explorationEvidence"]
    assert evidence["status"] == "ready"
    assert evidence["provenance"]["rankingWeight"] == 0
    roles = {("geographic" if props["tier"] == "geographic" else "terrain"): [(item, 1)]}
    nonzero = [(part, part["properties"]["traversals"]) for part in connectors if part["properties"]["offsetM"] > 1e-6]
    if nonzero:
        roles["connector"] = nonzero
    paths = vectors([entry["point"] for entry in observations])
    packed = {}
    for role, parts in roles.items():
        observed = evidence["roles"][role]
        total, thermal_l, thermal_sum = 0.0, 0.0, 0.0
        units = {}
        nearest = np.full(len(observations), np.inf)
        step = 2 if observed["lengthM"] < 100_000 else 15
        for part, times in parts:
            for a, b in segments(part["geometry"]["coordinates"]):
                az, _, length = SPHERE.inv(*a, *b)
                if length < 1e-6:
                    continue
                total += length * times
                n = math.ceil(length / step)
                d = (np.arange(n) + .5) * (length / n)
                lon, lat, _ = SPHERE.fwd(np.full(n, a[0]), np.full(n, a[1]), np.full(n, az), d)
                by_cell, counts = np.unique(cell_values(geology, lon, lat), return_counts=True)
                for fid, count in zip(by_cell, counts):
                    code = catalog.get(str(fid))
                    if code is not None:
                        units[code] = units.get(code, 0) + count * length / n * times
                measured = cell_values(thermal, lon, lat)
                thermal_l += np.count_nonzero(measured) * length / n * times
                thermal_sum += measured.sum() * length / n * times
                nearest = np.minimum(nearest, distance_to_arc(paths, *vectors([a, b])))
        actual = observed["geology"]["unitLengthM"]
        unit_error = max(abs(units.get(code, 0) - actual.get(code, 0)) for code in set(actual) | set(units))
        thermal_error = abs(thermal_l - observed["thermal"]["validLengthM"])
        length_error = abs(total - observed["lengthM"])
        assert length_error < 0.01
        assert unit_error < max(15, total * 0.002)
        assert thermal_error < max(15, total * 0.002)
        if thermal_l and observed["thermal"]["mean"] is not None:
            assert abs(thermal_sum / thermal_l - observed["thermal"]["mean"]) < 1
        approach_error = 0
        assert set(observed["minerals"]) == {entry["kind"] for entry in observations}
        for kind, actual_distance in observed["minerals"].items():
            rows = [i for i, entry in enumerate(observations) if entry["kind"] == kind]
            idx = min(rows, key=lambda i: nearest[i])
            approach_error = max(approach_error, abs(nearest[idx] - actual_distance["distanceM"]))
            assert actual_distance["observation"]["id"] == observations[idx]["id"]
            assert approach_error < .01
        packed[role] = {
            "lengthM": total, "lengthErrorM": length_error, "independentStepM": step,
            "maximumUnitLengthDifferenceM": unit_error, "thermalValidLengthDifferenceM": thermal_error,
            "maximumCatalogueApproachErrorM": approach_error, "cataloguesChecked": sorted(observed["minerals"]),
        }
    return {"tier": props["tier"], "roles": packed}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("exports", nargs="+", type=Path)
    parser.add_argument("--write", action="store_true", help="Update the committed validation record")
    args = parser.parse_args()
    geometry = packed_grid(MANIFEST["geology"])
    temperature = packed_grid(MANIFEST["thermal"])
    unit_catalog = json.loads(asset(MANIFEST["geology"]["catalog"]).read_bytes())
    catalogues = json.loads(asset(MANIFEST["minerals"]["data"]).read_bytes())
    hydrated = json.loads((ROOT / "data/hydrated-sites.json").read_bytes())
    sites = json.loads(asset(hydrated["data"]).read_bytes())
    record = {}
    for source in args.exports:
        payload = json.loads(source.read_bytes())
        provenance = payload["features"][0]["properties"]["explorationEvidence"]["provenance"]
        observations = catalogues
        if provenance["datasetVersion"] == "science-v2":
            assert provenance["minerals"]["hydrated"]["checksum"] == hydrated["data"]["sha256"]
            observations = catalogues + sites
        else:
            assert provenance["datasetVersion"] == "science-v1"
        record[source.stem] = verify(payload, geometry, unit_catalog, temperature, observations)
    content = json.dumps(record, indent=2) + "\n"
    if args.write:
        (ROOT / "data" / "validation" / "v4-route-evidence.json").write_text(content, encoding="utf-8")
    print(content)
