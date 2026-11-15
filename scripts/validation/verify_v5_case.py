"""Independently check the V5 case against its source terrain and Dijkstra."""

import argparse
import hashlib
import heapq
import json
import math
import time
from pathlib import Path

import numpy as np
import rasterio
from pyproj import Geod, Transformer
from rasterio.windows import Window

ROOT = Path(__file__).resolve().parents[2]
STEPS = [(dx, dy) for dy in (-1, 0, 1) for dx in (-1, 0, 1) if dx or dy]


class ReferenceGrid:
    def __init__(self, meta, source, limit):
        self.width, self.height = meta["width"], meta["height"]
        self.limit = limit
        self.geod = Geod(a=meta["radius"], f=0)
        self.a, _, self.x0, _, self.b, self.y0 = meta["transform"]
        self.checksums = {}
        arrays = []
        for key, datatype in (("elevationUrl", "<f4"), ("slopeUrl", "<f4"), ("validUrl", "u1")):
            data = (ROOT / ("public" + meta[key])).read_bytes()
            self.checksums[key] = hashlib.sha256(data).hexdigest()
            arrays.append(np.frombuffer(data, datatype))
        self.elevation, self.slope, valid = arrays
        self.eligible = (valid == 1) & np.isfinite(self.slope) & (self.slope <= limit)
        assert hashlib.file_digest(source.open("rb"), "sha256").hexdigest() == meta["sha256"]
        with rasterio.open(source) as dataset:
            x_off, y_off = (~dataset.transform) * (self.x0, self.y0)
            assert abs(x_off - round(x_off)) < 1e-6 and abs(y_off - round(y_off)) < 1e-6
            original = dataset.read(1, window=Window(round(x_off), round(y_off), self.width, self.height), masked=True)
            assert dataset.transform.a == self.a and dataset.transform.e == self.b
            assert original.shape == (self.height, self.width)
            assert np.array_equal(~np.ma.getmaskarray(original).ravel(), valid == 1)
            assert np.array_equal(original.data.ravel()[valid == 1], self.elevation[valid == 1])
            if "sourceWindow" in meta:
                padded = dataset.read(1, window=Window(round(x_off) - 1, round(y_off) - 1, self.width + 2, self.height + 2), masked=True).filled(np.nan).astype(float)
                dy, dx = np.gradient(padded)
                dx, dy = dx[1:-1, 1:-1], dy[1:-1, 1:-1]
            else:
                numeric = original.filled(np.nan).astype(float)
                numeric[numeric < -3e38] = np.nan
                dy, dx = np.gradient(numeric)
            latitude = (self.y0 + (np.arange(self.height) + 0.5) * self.b) / meta["radius"]
            slope = np.degrees(np.arctan(np.hypot(dx / (abs(self.a) * np.cos(latitude)[:, None]), dy / abs(self.b)))).astype("<f4").ravel()
            self.slope_source_error = float(np.max(abs(slope[valid == 1] - self.slope[valid == 1])))
            assert self.slope_source_error < 1e-6
            crs = dataset.crs.to_wkt()
        from pyproj import CRS
        projected = CRS.from_wkt(crs)
        inverse = Transformer.from_crs(projected, projected.geodetic_crs, always_xy=True)
        self.forward = Transformer.from_crs(projected.geodetic_crs, projected, always_xy=True)
        columns = self.x0 + (np.arange(self.width) + 0.5) * self.a
        rows = self.y0 + (np.arange(self.height) + 0.5) * self.b
        self.lon, _ = inverse.transform(columns, np.full_like(columns, rows[0]))
        _, self.lat = inverse.transform(np.full_like(rows, columns[0]), rows)
        assert np.allclose(inverse.transform(columns[-1], rows[-1]), [self.lon[-1], self.lat[-1]], atol=1e-10)
        self.step_distance = {}
        for dx, dy in STEPS:
            self.step_distance[dx, dy] = self.geod.inv(
                np.full_like(rows, self.lon[0]), self.lat, np.full_like(rows, self.lon[abs(dx)]),
                np.roll(self.lat, -dy),
            )[2]

    def cell(self, point):
        x, y = self.forward.transform(*point)
        column, row = math.floor((x - self.x0) / self.a), math.floor((y - self.y0) / self.b)
        assert 0 <= column < self.width and 0 <= row < self.height
        return row * self.width + column

    def coordinate(self, cell):
        y, x = divmod(cell, self.width)
        return [self.lon[x], self.lat[y]]

    def edge(self, a, b, distance):
        dz = float(self.elevation[b]) - float(self.elevation[a])
        grade = math.degrees(math.atan2(abs(dz), distance))
        return dz, max(float(self.slope[a]), float(self.slope[b]), grade)

    def dijkstra(self, start, finish, penalty):
        width, height = self.width, self.height
        costs = np.full(width * height, math.inf)
        costs[start] = 0
        queue = [(0, start)]
        while queue:
            cost, i = heapq.heappop(queue)
            if cost > costs[i]:
                continue
            if i == finish:
                return cost
            y, x = divmod(i, width)
            for dx, dy in STEPS:
                if not (0 <= x + dx < width and 0 <= y + dy < height):
                    continue
                j = i + dx + width * dy
                if not self.eligible[j] or (dx and dy and not (self.eligible[i + dx] and self.eligible[i + dy * width])):
                    continue
                distance = self.step_distance[dx, dy][y]
                _, slope = self.edge(i, j, distance)
                trial = cost + distance * (1 + penalty * (slope / self.limit) ** 2)
                if slope <= self.limit and trial < costs[j]:
                    costs[j] = trial
                    heapq.heappush(queue, (trial, j))
        raise AssertionError("Independent solver found no path")


def verify_route(grid, route, objectives, science_targets):
    start = time.monotonic()
    terrain, stops = route["terrain"], route["stops"]
    cells = terrain["cells"]
    mapped = [grid.cell(point) for point in stops]
    assert mapped == [cells[index] for index in route["stopIndices"]]
    assert grid.eligible[cells].all()
    assert np.allclose([grid.coordinate(cell) for cell in cells], route["coordinates"], rtol=0, atol=1e-9)
    distance = risk = ascent = descent = 0
    maximum = float(grid.slope[cells[0]])
    for a, b in zip(cells, cells[1:]):
        d = grid.geod.inv(*grid.coordinate(a), *grid.coordinate(b))[2]
        dz, slope = grid.edge(a, b, d)
        distance += d
        risk += d * (slope / grid.limit) ** 2
        ascent += max(0, dz)
        descent += max(0, -dz)
        maximum = max(maximum, slope)
    snapping = [grid.geod.inv(*point, *grid.coordinate(cell))[2] for point, cell in zip(stops, mapped)]
    total = distance + sum(n * (1 if i in (0, len(stops) - 1) else 2) for i, n in enumerate(snapping))
    optimal = sum(grid.dijkstra(a, b, terrain["lambda"]) for a, b in zip(mapped, mapped[1:]))
    cost_error = abs(optimal - terrain["cost"])
    assert cost_error < 1e-4
    assert abs(total - route["distance"]) < 1e-4 and abs(distance - route["assessedDistance"]) < 1e-4
    assert abs(risk - terrain["riskIntegral"]) < 1e-4 and np.allclose(snapping, route["snapping"], rtol=0, atol=1e-4)
    assert abs(ascent - terrain["ascent"]) < 1e-6 and abs(descent - terrain["descent"]) < 1e-6
    assert abs(maximum - terrain["maxSlope"]) < 1e-6
    reached = [target for target in science_targets if grid.cell(target["coordinates"]) in cells]
    assert {target["id"] for target in reached} == set(route.get("reachedTargets", []))
    assert {o for target in reached for o in target["objectives"] if o in objectives} == set(route["reached"])
    return {
        "id": route["id"], "name": route["name"], "distanceM": float(total), "assessedDistanceM": float(distance),
        "ascentM": ascent, "descentM": descent, "maximumSlopeDegrees": maximum, "riskIntegralM": risk,
        "costErrorM": float(cost_error), "distanceErrorM": float(abs(total - route["distance"])),
        "targetsReached": [target["id"] for target in reached], "seconds": round(time.monotonic() - start, 3),
    }


def verify(payload, source):
    meta, request = payload["terrain"], payload["request"]
    settings, draft = request["settings"], request["draft"]
    targets = json.loads((ROOT / "data/science-targets.json").read_bytes()) if meta["id"] == "jezero-ctx-20m" else []
    grid = ReferenceGrid(meta, source, settings["maxSlope"])
    routes, inbound = payload["routes"], payload["inbound"]
    outbound = [verify_route(grid, route, settings["objectives"], targets) for route in routes]
    assert inbound["stops"] == [draft["end"], draft["start"]]
    reverse = verify_route(grid, inbound, [], targets)
    timing = payload["timing"]
    expected_distance = outbound[0]["distanceM"] + reverse["distanceM"]
    assert abs(expected_distance - timing["distanceM"]) < 2e-4
    assert timing["stopCount"] == len(routes[0]["stops"]) - 2
    dwell = timing["stopCount"] * payload["mission"]["dwellMinutes"] * 60
    expected_time = expected_distance * 3.6 / payload["mission"]["speedKmh"] + dwell
    assert abs(expected_time - timing["elapsedSeconds"]) < 1e-3
    rankings = []
    distance = np.array([route["distanceM"] for route in outbound])
    terrain = np.array([route["riskIntegralM"] for route in outbound])
    objectives = np.array([len(route["reached"]) for route in routes])
    for scenario in payload["scenarios"]:
        weights = np.array(scenario["weights"], dtype=float)
        if not objectives.any():
            weights[2] = 0
        if weights.sum() > 0:
            weights /= weights.sum()
        d = (distance - distance.min()) / np.ptp(distance) if np.ptp(distance) else np.zeros_like(distance)
        r = (terrain - terrain.min()) / np.ptp(terrain) if np.ptp(terrain) else np.zeros_like(terrain)
        scores = d * weights[0] + r * weights[1] + (1 - objectives / max(1, len(settings["objectives"]))) * weights[2]
        assert np.allclose(scores, scenario["scores"], rtol=0, atol=1e-8)
        rankings.append({"weights": scenario["weights"], "winner": routes[int(np.argmin(scores))]["id"], "scores": scores.tolist()})
    if targets:
        assert rankings[1]["winner"] != rankings[2]["winner"]
    return {
        "terrain": meta["id"], "sourceSha256": meta["sha256"], "arrayChecksums": grid.checksums,
        "slopeSourceMaxErrorDegrees": grid.slope_source_error,
        "width": meta["width"], "height": meta["height"], "pixelSizeM": meta["pixelSize"],
        "draft": draft, "settings": settings, "outbound": outbound, "return": reverse, "rankings": rankings,
        "timing": {"roundTripDistanceM": expected_distance, "elapsedEarthSeconds": expected_time, "dwellSeconds": dwell},
        "tolerances": {"distanceM": 1e-4, "terrainCostM": 1e-4, "ascentM": 1e-6, "slopeDegrees": 1e-6, "rankingScore": 1e-8},
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("fixture", type=Path)
    parser.add_argument("original", type=Path)
    parser.add_argument("--write", type=Path)
    args = parser.parse_args()
    result = verify(json.loads(args.fixture.read_text(encoding="utf-8-sig")), args.original)
    output = json.dumps(result, indent=2) + "\n"
    if args.write:
        args.write.write_text(output, encoding="utf-8")
    print(output)
