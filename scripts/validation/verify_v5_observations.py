"""Read-only independent checks of the packaged MEDA observations against PDS."""

import argparse
import csv
import hashlib
import json
import math
import xml.etree.ElementTree as ET
from pathlib import Path

import spiceypy as sp

ROOT = Path(__file__).resolve().parents[2]
NS = {"p": "http://pds.nasa.gov/pds4/pds/v1"}


def checksum(path):
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def verify(directory):
    manifest = json.loads((ROOT / "data/meda-observations.json").read_text())
    path = ROOT / ("public" + manifest["url"])
    assert checksum(path) == manifest["sha256"] and path.stat().st_size == manifest["bytes"]
    payload = json.loads(path.read_text(encoding="utf-8"))
    assert payload["rankingWeight"] == 0
    products = {}
    for product in payload["products"]:
        source = directory / product["file"]
        label = source.with_suffix(".xml")
        assert checksum(source) == product["sha256"] and checksum(label) == product["labelSha256"]
        xml = ET.parse(label).getroot()
        assert hashlib.md5(source.read_bytes()).hexdigest() == xml.find(".//p:md5_checksum", NS).text
        assert xml.find(".//p:logical_identifier", NS).text == product["id"]
        rows = list(csv.DictReader(source.open(newline="")))
        assert len(rows) == product["records"]
        products[product["id"]] = rows
    for kernel in payload["clock"]["kernels"]:
        assert checksum(directory / kernel["name"]) == kernel["sha256"]
        sp.furnsh(str(directory / kernel["name"]))
    results = []
    for series in payload["series"]:
        pressure = products[series["pressureProduct"]]
        temp = {float(row["SCLK"]): row for row in products[series["temperatureProduct"]]}
        position = {float(row["SCLK"]): row for row in products[series["positionProduct"]]}
        samples = series["samples"]
        bins = []
        for sample in samples:
            original = pressure[sample["sourceRow"] - 2]
            clock = float(original["SCLK"])
            assert clock == sample["sclk"] and original["LMST"] == sample["lmst"] and original["LTST"] == sample["ltst"]
            assert float(original["PRESSURE"]) == sample["pressurePa"]
            assert int(original["TRANSDUCER"]) == sample["transducer"]
            assert original["PRESSURE_UNCERTAINTY"] == ""
            assert sp.et2utc(sp.scs2e(-168, f"1/{clock}"), "ISOC", 3) + "Z" == sample["utc"]
            ancillary = position[clock]
            assert sample["positionM"] == [float(ancillary[f"ROVER_POSITION_{axis}"]) for axis in "XYZ"]
            record = temp.get(clock)
            for i, value in enumerate(sample["temperatureK"], 1):
                text = record.get(f"ATS_LOCAL_TEMP{i}", "") if record else ""
                assert value == (float(text) if text else None)
            hours, minutes, seconds = map(float, original["LMST"].split("M")[1].split(":"))
            bin_id = math.floor((hours * 3600 + minutes * 60 + seconds) / 300)
            bins.append(bin_id)
        assert len(set(bins)) == len(samples)
        expected_gaps = [[float(a["SCLK"]), float(b["SCLK"])] for a, b in zip(pressure, pressure[1:])
                         if float(b["SCLK"]) - float(a["SCLK"]) > 1.5]
        assert expected_gaps == [[g["startSclk"], g["stopSclk"]] for g in series["gaps"]]
        results.append({"sol": series["sol"], "samplesMatched": len(samples), "positionsMatched": len(samples),
                        "nativePressureRecords": len(pressure), "nativeGapsMatched": len(expected_gaps),
                        "missingTemperatureRecords": sum(all(v is None for v in sample["temperatureK"]) for sample in samples)})
    return {"dataset": payload["version"], "sha256": manifest["sha256"], "productCount": len(products),
            "checks": results, "measurementTolerance": "Exact equality to the original CSV values",
            "timestampToleranceSeconds": 0.001, "positionMatching": "Exact original spacecraft-clock key", "routeRankingWeight": 0}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("directory", type=Path)
    parser.add_argument("--write", type=Path)
    args = parser.parse_args()
    output = json.dumps(verify(args.directory), indent=2) + "\n"
    if args.write:
        args.write.write_text(output, encoding="utf-8")
    print(output)
