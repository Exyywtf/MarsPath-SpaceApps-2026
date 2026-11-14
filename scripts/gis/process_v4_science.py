"""Build V4 atlas derivatives from verified source snapshots kept outside Git."""

import argparse
import csv
import gzip
import hashlib
import json
import xml.etree.ElementTree as ET
from pathlib import Path

import numpy as np
from PIL import Image, ImageColor
from rasterio.features import rasterize
from rasterio.transform import from_bounds

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "public" / "processed" / "science-v1"
MANIFEST = ROOT / "data" / "exploration-science.json"
BOUNDS = [-180, -90, 180, 90]
REGISTRATION = "Planetocentric Mars, east-positive longitude, pixel edges at ±180° and ±90°; north row first"
GEO_ITEMS = "https://astrogeology.usgs.gov/pygeoapi/collections/mars/sim3292_global_geologic_map/units"
TESSITE = "https://pds-geosciences.wustl.edu/mgs/mgs-m-tes-5-timap-v1/mgst_9001/data/"
CRISM = "https://data.caltech.edu/records/yhd9q-q8g95"
CHLORIDE = "https://data.caltech.edu/records/kasms-vp209"


def checksum(file):
    with file.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def product(path, source):
    return {"name": path.name, "url": source, "sha256": checksum(path)}


def json_write(path, payload):
    path.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")


def package(path):
    return {"url": f"/processed/science-v1/{path.name}", "sha256": checksum(path), "bytes": path.stat().st_size}


def area_coverage(valid):
    height, width = valid.shape
    row_area = np.diff(-np.sin(np.deg2rad(np.linspace(90, -90, height + 1))))
    return round(float((np.count_nonzero(valid, axis=1) * row_area).sum() / (2 * width)), 6)


def grid_assets(name, grid, rgba):
    """Encode little-endian (run length, unsigned value) pairs; zero is nodata."""
    cells = grid.ravel()
    starts = np.flatnonzero(np.r_[True, cells[:-1] != cells[1:]])
    sizes = np.diff(np.r_[starts, cells.size])
    if sizes.max() > np.iinfo(np.uint16).max:
        # Insert cut positions in long runs without changing their values.
        extra = [start + offset for start, size in zip(starts, sizes) for offset in range(65535, size, 65535)]
        starts = np.sort(np.r_[starts, extra]).astype(int)
        sizes = np.diff(np.r_[starts, cells.size])
    pairs = np.column_stack([sizes, cells[starts]]).astype("<u2").tobytes()
    raw_cells = cells.astype("<u2").tobytes()
    encoding = "rle16" if len(pairs) < len(raw_cells) else "uint16"
    encoded = OUT / f"{name}.bin.gz"
    encoded.write_bytes(gzip.compress(pairs if encoding == "rle16" else raw_cells, mtime=0))
    image = OUT / f"{name}.png"
    Image.fromarray(rgba, "RGBA").save(image, optimize=True)
    height, width = grid.shape
    return {
        "image": package(image), "data": package(encoded), "width": width, "height": height,
        "bounds": BOUNDS, "registration": REGISTRATION, "coverage": area_coverage(grid > 0), "nodata": 0, "encoding": encoding,
    }


def global_geology(raw):
    path = raw / "geo.sld"
    styles = {}
    for rule in ET.parse(path).findall(".//{*}Rule"):
        code = rule.findtext(".//{*}Literal")
        color = rule.findtext(".//{*}Fill/{*}SvgParameter")
        if code and color:
            styles[code] = color
    width, height = 2880, 1440
    grid = np.zeros((height, width), dtype="uint16")
    units, features, inputs = {}, {}, []
    transform = from_bounds(*BOUNDS, width, height)
    paths = sorted(raw.glob("geo-[0-9][0-9][0-9][0-9].json"))
    offset = 0
    for index, page in enumerate(paths):
        assert int(page.stem[4:]) == offset
        data = json.loads(page.read_bytes())
        inputs.append(product(page, f"{GEO_ITEMS}/items?f=json&limit=100&offset={offset}"))
        assert any(link["rel"] == "next" for link in data["links"]) == (index < len(paths) - 1)
        shapes = []
        for feature in data["features"]:
            attrs = feature["properties"]
            fid, code = attrs["objectid"], attrs["unit"]
            assert feature["geometry"]["type"] in ("Polygon", "MultiPolygon")
            assert 0 < fid <= 65535 and fid not in features
            assert styles.get(code) and units.get(code, attrs["unitdesc"]) == attrs["unitdesc"]
            units[code] = attrs["unitdesc"]
            features[fid] = code
            shapes.append((feature["geometry"], fid))
        rasterize(shapes, out=grid, transform=transform)
        offset += len(shapes)
    assert len(features) == 1311 and len(units) == 44
    palette = np.zeros((max(features) + 1, 4), dtype=np.uint8)
    for fid, code in features.items():
        palette[fid] = (*ImageColor.getrgb(styles[code]), 255)
    catalog = OUT / "geology-catalog.json"
    json_write(catalog, {str(fid): code for fid, code in sorted(features.items())})
    return {
        **grid_assets("geology", grid, palette[grid]), "catalog": package(catalog),
        "units": [{"code": code, "name": name, "color": styles[code]} for code, name in sorted(units.items())],
        "sources": inputs + [product(path, "https://asc-docs.s3.us-west-2.amazonaws.com/pygeoapi/sld/Global_Geology.sld")],
    }


def mineral_observations(raw):
    def rows(file):
        with file.open(encoding="utf-8-sig", newline="") as stream:
            yield from csv.DictReader(stream)

    def coords(row, longitude, latitude):
        lon, lat = float(row[longitude]), float(row[latitude])
        assert 0 <= lon <= 360 and -90 <= lat <= 90
        return [round((lon + 180) % 360 - 180, 6), lat]

    crism_file, chloride_file = raw / "mineral-crism.csv", raw / "mineral-chloride.csv"
    crism = [
        {"id": row["CRISM targeted image ID"], "kind": "crism", "point": coords(row, "CenterLon", "CenterLat"),
         "interpretation": row["Secondary minerals detected"].strip()}
        for row in rows(crism_file)
        if row["Secondary minerals detected"].strip().lower() not in ("", "nothing", "ice")
    ]
    chlorides = [
        {"id": row["FID_OsterlooEtAl2010Set"], "kind": "chloride", "point": coords(row, "Lon2", "Lat2"),
         "label": row["Label"]}
        for row in rows(chloride_file)
    ]
    records = [*crism, *chlorides]
    assert len({(record["kind"], record["id"]) for record in records}) == len(records)
    file = OUT / "mineral-observations.json"
    json_write(file, records)
    return {
        "data": package(file), "crismCount": len(crism), "chlorideCount": len(chlorides),
        "crismBoundsEast360": [min(x["point"][0] % 360 for x in crism), min(x["point"][1] for x in crism),
                               max(x["point"][0] % 360 for x in crism), max(x["point"][1] for x in crism)],
        "sources": [
            product(crism_file, CRISM + "/files/Leask_etal_Table_of_TerraSirenum_targeted_crism_mineral_detections.csv"),
            product(chloride_file, CHLORIDE + "/files/Leask_and_Ehlmann_2021_2010_osterloo_chl_pts_w_tanaka_2014_age.csv"),
        ],
    }


def thermal_inertia(raw):
    data, mask = raw / "tes-ti.img", raw / "tes-mask.img"
    data_label, mask_label = raw / "tes-ti.lbl", raw / "tes-mask.lbl"
    for path in [data_label, mask_label]:
        assert all(text in path.read_text() for text in ("7200", "3600", "20.0 <pix/deg>", '"PLANETOCENTRIC"', '"EAST"', "1800.5", "3600.5"))
    values = np.fromfile(data, dtype=">i2").reshape(3600, 7200)
    observed = np.fromfile(mask, dtype="u1").reshape(values.shape)
    assert set(np.unique(observed)) == {0, 1}
    good = (observed == 1) & (values >= 5) & (values <= 5000)
    width, height, block = 1440, 720, 5
    lat_edges = np.linspace(90, -90, 3601)
    row_area = np.diff(-np.sin(np.deg2rad(lat_edges))).reshape(height, block)
    row_area /= row_area.sum(axis=1, keepdims=True)
    means = (values.reshape(height, block, width, block).mean(axis=3) * row_area[:, :, None]).sum(axis=1)
    valid = good.reshape(height, block, width, block).all(axis=(1, 3))
    grid = np.where(valid, means.round(), 0).astype("uint16")
    palette = ["#301744", "#55408c", "#127e9c", "#59bd88", "#f9dc7d"]
    domain = [5, 1800]
    rgb = np.array([ImageColor.getrgb(value) for value in palette])
    interpolated = np.stack([np.interp(grid, np.linspace(*domain, len(palette)), rgb[:, i]) for i in range(3)], axis=-1)
    rgba = np.dstack([interpolated.round().astype(np.uint8), valid.astype(np.uint8) * 255])
    return {
        **grid_assets("thermal-inertia", grid, rgba), "palette": palette, "displayRange": domain,
        "sampleRange": [int(grid[valid].min()), int(grid.max())], "nativeCoverage": area_coverage(good),
        "sources": [
            product(data_label, TESSITE + "global_ti_night_2007.lbl"),
            product(data, TESSITE + "global_ti_night_2007.img"),
            product(mask_label, TESSITE + "global_ti_msk_night_2007.lbl"),
            product(mask, TESSITE + "global_ti_msk_night_2007.img"),
        ],
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("snapshot", type=Path, help="Directory with verified GeoJSON pages, TES labels and arrays, and mineral CSV files")
    args = parser.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    result = {
        "version": "science-v1", "geology": global_geology(args.snapshot),
        "minerals": mineral_observations(args.snapshot), "thermal": thermal_inertia(args.snapshot),
    }
    MANIFEST.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print({name: record.get("coverage", record.get("crismCount")) for name, record in result.items() if isinstance(record, dict)})


if __name__ == "__main__":
    main()
