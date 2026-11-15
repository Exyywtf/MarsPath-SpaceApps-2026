"""Package the NASA PDS HYDROUS_SITES_GEO_MAP table as inspectable points."""

import argparse
import csv
import hashlib
import json
import re
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ARCHIVE = "https://pds-geosciences.wustl.edu/mex/mex-m-omega-5-ddr-global-maps-v1/mexomg_2000/data/hydrous/"
DATASET = "MEX-M-OMEGA-5-DDR-GLOBAL-MAPS-V1.0"
PRODUCT = "HYDROUS_SITES_GEO_MAP"
ASSET_URL = "/processed/science-v2/hydrated-sites.json"
SOURCE_FILES = ("hydrous_sites_geo_map.csv", "hydrous_sites_geo_map.lbl")


def pack_sites(table, label):
    """Keep the published coordinates and instrument IDs, merging exact repeats."""
    fields = re.findall(r'^\s*NAME\s*=\s*"([^"]+)"', label, re.MULTILINE)
    if fields != ["LONGITUDE", "LATITUDE", "OMEGA_EDR_PRODUCT_ID", "CRISM_EDR_PRODUCT_ID"]:
        raise ValueError("Unexpected PDS column order")
    for key, value in {"DATA_SET_ID": f'"{DATASET}"', "PRODUCT_ID": PRODUCT,
                       "RELEASE_ID": "0001", "REVISION_ID": "0001"}.items():
        if not re.search(rf"^\s*{key}\s*=\s*{re.escape(value)}\s*$", label, re.MULTILINE):
            raise ValueError(f"Unexpected PDS {key}")

    sites = {}
    rows = list(csv.reader(table.splitlines()))
    if not re.search(rf"^\s*ROWS\s*=\s*{len(rows)}\s*$", label, re.MULTILINE):
        raise ValueError("Table length differs from the PDS label")
    for row, (x, y, omega, crism) in enumerate(rows, 1):
        lon, lat = float(x), float(y)
        if not (-180 <= lon < 180 and -90 <= lat <= 90 and (omega or crism)):
            raise ValueError(f"Invalid point at source row {row}")
        key = (lon, lat, omega, crism)
        if key in sites:
            sites[key]["sourceRows"].append(row)
            continue
        site = {"id": f"row-{row}", "kind": "hydrated", "point": [lon, lat], "sourceRows": [row]}
        if omega:
            site["omegaProduct"] = omega
        if crism:
            site["crismProduct"] = crism
        sites[key] = site
    return list(sites.values()), len(rows)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("table", type=Path)
    parser.add_argument("label", type=Path)
    args = parser.parse_args()
    original = (args.table.read_bytes(), args.label.read_bytes())
    sites, rows = pack_sites(*(raw.decode("ascii") for raw in original))
    asset = (json.dumps(sites, separators=(",", ":")) + "\n").encode()
    lon, lat = zip(*(site["point"] for site in sites))
    instruments = Counter(
        "both" if "crismProduct" in site and "omegaProduct" in site
        else "crism" if "crismProduct" in site else "omega"
        for site in sites
    )
    manifest = {
        "dataset": DATASET,
        "product": PRODUCT,
        "release": "0001",
        "revision": "0001",
        "url": ARCHIVE,
        "study": "https://doi.org/10.1029/2012JE004145",
        "termsUrl": "https://data.nasa.gov/dataset/omega-mars-global-maps",
        "terms": "NASA Open Data lists this archive as US public domain. Credit Carter et al., ESA Mars Express OMEGA and NASA MRO CRISM.",
        "credit": "Carter et al. (2013) · ESA Mars Express OMEGA · NASA MRO CRISM · NASA PDS",
        "coordinateSystem": "Planetocentric latitude and signed east longitude in degrees",
        "printedCoordinatePrecisionDegrees": 0.01,
        "pointBounds": [min(lon), min(lat), max(lon), max(lat)],
        "sourceRows": rows,
        "count": len(sites),
        "exactDuplicateRows": rows - len(sites),
        "instrumentCounts": dict(instruments),
        "processing": "Retain the published coordinates and product IDs. Merge exact repeats and retain their one-based source row numbers.",
        "limitation": "Targeted detections with uneven survey coverage. The table supplies no species, detection boundaries or absolute position accuracy.",
        "sources": [
            {"url": ARCHIVE + name, "sha256": hashlib.sha256(raw).hexdigest()}
            for name, raw in zip(SOURCE_FILES, original)
        ],
        "data": {"url": ASSET_URL, "bytes": len(asset), "sha256": hashlib.sha256(asset).hexdigest()},
    }
    output = ROOT / "public" / ASSET_URL.lstrip("/")
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_bytes(asset)
    (ROOT / "data" / "hydrated-sites.json").write_bytes((json.dumps(manifest, indent=2) + "\n").encode())
    print(f"Packed {len(sites)} detections from {rows} PDS rows")


if __name__ == "__main__":
    main()
