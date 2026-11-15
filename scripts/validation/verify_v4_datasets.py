"""Independently check packed V4 grids against the downloaded scientific originals."""

import argparse
import csv
import gzip
import hashlib
import json
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageColor
from shapely.geometry import Point, shape
from shapely.strtree import STRtree

ROOT = Path(__file__).resolve().parents[2]
MANIFEST = json.loads((ROOT / "data" / "exploration-science.json").read_text(encoding="utf-8"))


def bytecheck(record, path):
    with path.open("rb") as stream:
        assert hashlib.file_digest(stream, "sha256").hexdigest() == record["sha256"], path
    if "bytes" in record:
        assert path.stat().st_size == record["bytes"]


def asset(record):
    path = ROOT / "public" / record["url"][1:]
    bytecheck(record, path)
    return path


def packed_grid(record):
    values = np.frombuffer(gzip.decompress(asset(record["data"]).read_bytes()), dtype="<u2")
    if record["encoding"] == "rle16":
        values = np.repeat(values[1::2], values[::2])
    return values.reshape(record["height"], record["width"])


def geology_checks(raw):
    metadata = MANIFEST["geology"]
    grid = packed_grid(metadata)
    catalog = json.loads(asset(metadata["catalog"]).read_bytes())
    colors = {item["code"]: ImageColor.getrgb(item["color"]) for item in metadata["units"]}
    image = np.asarray(Image.open(asset(metadata["image"])).convert("RGBA"))
    for fid in np.unique(grid):
        color = colors[catalog[str(fid)]] if fid else (0, 0, 0)
        assert (image[grid == fid] == (*color, 255 if fid else 0)).all()
    polygons, ids = [], []
    for record in metadata["sources"]:
        source = raw / record["name"]
        bytecheck(record, source)
        if source.suffix != ".json":
            continue
        for feature in json.loads(source.read_bytes())["features"]:
            geom = shape(feature["geometry"])
            assert geom.is_valid
            minx, miny, maxx, maxy = geom.bounds
            assert -180.00000001 <= minx <= maxx <= 180.00000001 and -90 <= miny <= maxy <= 90
            polygons.append(geom)
            fid = feature["properties"]["objectid"]
            ids.append(fid)
            assert catalog[str(fid)] == feature["properties"]["unit"]
    assert len(ids) == len(catalog)
    index = STRtree(polygons)
    anchors = [(77.44, 18.41), (137.81, -5.37), (-134, 18.4), (70, -42), (179.99, 45), (-179.99, 45), (20, 89.99), (30, -89.99)]
    rng = np.random.default_rng(3292)
    random = list(zip(rng.uniform(-180, 180, 600), rng.uniform(-90, 90, 600)))
    found = []
    for longitude, latitude in [*anchors, *random]:
        column, row = math.floor((longitude + 180) * 8), math.floor((90 - latitude) * 8)
        point = Point(-180 + (column + .5) / 8, 90 - (row + .5) / 8)
        source_ids = index.query(point, predicate="within")
        fid = int(grid[row, column])
        assert fid in [ids[i] for i in source_ids], (point.wkt, fid, source_ids)
        if len(found) < len(anchors):
            found.append({"lon": longitude, "lat": latitude, "featureId": fid, "unit": catalog[str(fid)]})
    return {"polygons": len(ids), "units": len(colors), "checkedCenters": len(anchors) + len(random), "anchors": found}


def thermal_checks(raw):
    metadata = MANIFEST["thermal"]
    for record in metadata["sources"]:
        bytecheck(record, raw / record["name"])
    grid = packed_grid(metadata)
    image = np.asarray(Image.open(asset(metadata["image"])).convert("RGBA"))
    values = np.memmap(raw / "tes-ti.img", dtype=">i2", shape=(3600, 7200), mode="r")
    mask = np.memmap(raw / "tes-mask.img", dtype=np.uint8, shape=values.shape, mode="r")
    assert np.array_equal(image[:, :, 3] > 0, grid > 0)
    candidates = [(0, 0), (719, 1439), (360, 0), (360, 1439), (286, 1029)]
    rng = np.random.default_rng(2007)
    candidates.extend(zip(rng.integers(0, 720, 600), rng.integers(0, 1440, 600)))
    counts = {"supported": 0, "missing": 0}
    colors = np.array([ImageColor.getrgb(value) for value in metadata["palette"]])
    domain = np.linspace(*metadata["displayRange"], len(colors))
    for row, column in candidates:
        r, c = 5 * row, 5 * column
        block = values[r:r + 5, c:c + 5]
        invalid = (mask[r:r + 5, c:c + 5] != 1).any() or (block < 5).any() or (block > 5000).any()
        if invalid:
            assert grid[row, column] == 0
            counts["missing"] += 1
        else:
            weights = [math.cos(math.radians(90 - (r + i + .5) / 20)) for i in range(5)]
            estimate = round(sum(weights[i] * block[i].mean() for i in range(5)) / sum(weights))
            assert grid[row, column] == estimate
            assert list(image[row, column, :3]) == [round(np.interp(estimate, domain, colors[:, i])) for i in range(3)]
            counts["supported"] += 1
    return counts


def minerals_checks(raw):
    metadata = MANIFEST["minerals"]
    records = json.loads(asset(metadata["data"]).read_bytes())
    indexed = {(item["kind"], item["id"]): item for item in records}
    assert len(indexed) == len(records)
    for kind, key, lat, lon, source in [
        ("crism", "CRISM targeted image ID", "CenterLat", "CenterLon", metadata["sources"][0]),
        ("chloride", "FID_OsterlooEtAl2010Set", "Lat2", "Lon2", metadata["sources"][1]),
    ]:
        path = raw / source["name"]
        bytecheck(source, path)
        with path.open(encoding="utf-8-sig", newline="") as stream:
            for row in csv.DictReader(stream):
                original = row.get("Secondary minerals detected", "").strip()
                if kind == "crism" and original.lower() in ("", "nothing", "ice"):
                    assert (kind, row[key]) not in indexed
                    continue
                item = indexed[kind, row[key]]
                x, y = item["point"]
                assert -180 <= x < 180 and y == float(row[lat])
                assert abs(x % 360 - float(row[lon])) < 1e-5
                assert (item["interpretation"] == original) if kind == "crism" else (item["label"] == row["Label"])
    return {"records": len(records), "crism": metadata["crismCount"], "chloride": metadata["chlorideCount"]}


def hydrated_checks(raw):
    metadata = json.loads((ROOT / "data" / "hydrated-sites.json").read_bytes())
    table = raw / "hydrous-sites.csv"
    bytecheck(metadata["sources"][0], table)
    bytecheck(metadata["sources"][1], raw / "hydrous-sites.lbl")
    with table.open(encoding="ascii", newline="") as stream:
        rows = [(float(lon), float(lat), omega, crism) for lon, lat, omega, crism in csv.reader(stream)]
    sites = json.loads(asset(metadata["data"]).read_bytes())
    seen = {}
    for site in sites:
        x, y = site["point"]
        identity = (x, y, site.get("omegaProduct", ""), site.get("crismProduct", ""))
        assert identity not in seen
        assert site["id"] == f'row-{site["sourceRows"][0]}'
        seen[identity] = site["sourceRows"]
    assert set(seen) == set(rows)
    assert sorted(i for indices in seen.values() for i in indices) == list(range(1, len(rows) + 1))
    for record, indices in seen.items():
        assert all(rows[index - 1] == record for index in indices)
    assert len(sites) == metadata["count"]
    assert len(rows) == metadata["sourceRows"]
    assert len(rows) - len(sites) == metadata["exactDuplicateRows"]
    lon, lat, _, _ = zip(*seen)
    assert metadata["pointBounds"] == [min(lon), min(lat), max(lon), max(lat)]
    assert seen[(-18.2, 22.48, "", "FRT00003BFB")] == [635]
    return {
        "pdsRows": len(rows), "distinctRecords": len(sites), "exactRepeats": len(rows) - len(sites),
        "pointBounds": metadata["pointBounds"], "sha256": metadata["data"]["sha256"],
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("snapshot", type=Path)
    parser.add_argument("--hydrated", type=Path, help="Include the archived hydrated sites CSV and label in this directory")
    parser.add_argument("--write", action="store_true", help="Update the committed validation record")
    args = parser.parse_args()
    checks = {"geology": geology_checks(args.snapshot), "thermal": thermal_checks(args.snapshot), "minerals": minerals_checks(args.snapshot)}
    if args.hydrated:
        checks["hydrated"] = hydrated_checks(args.hydrated)
    output = json.dumps(checks, indent=2) + "\n"
    if args.write:
        (ROOT / "data" / "validation" / "v4-datasets.json").write_text(output)
    print(output)
