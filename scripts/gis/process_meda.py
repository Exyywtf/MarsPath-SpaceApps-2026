"""Package directly matched MEDA samples from sols 30–32 and their PDS labels."""

import argparse
import csv
import hashlib
import json
import math
import xml.etree.ElementTree as ET
from datetime import datetime
from pathlib import Path

import spiceypy as spice

ROOT = Path(__file__).resolve().parents[2]
BASE = "https://atmos.nmsu.edu/PDS/data/PDS4/Mars2020/mars2020_meda/"
NS = {"p": "http://pds.nasa.gov/pds4/pds/v1"}


def sha(path):
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def label_and_rows(directory, sol, section, kind):
    files = list(directory.glob(f"WE__{sol:04}*_{kind}_*.xml"))
    assert len(files) == 1, (sol, kind, files)
    label = files[0]
    root = ET.parse(label).getroot()
    filename = root.find(".//p:file_name", NS).text
    original = directory / filename
    content = original.read_bytes()
    assert hashlib.md5(content).hexdigest() == root.find(".//p:md5_checksum", NS).text
    assert len(content) == int(root.find(".//p:file_size", NS).text)
    rows = list(csv.DictReader(content.decode("ascii").splitlines()))
    assert len(rows) == int(root.find(".//p:Table_Delimited/p:records", NS).text)
    fields = root.findall(".//p:Field_Delimited", NS)
    definitions = [{"name": field.find("p:name", NS).text,
                    "unit": field.findtext("p:unit", default=None, namespaces=NS),
                    "description": " ".join(field.findtext("p:description", default="", namespaces=NS).split())}
                   for field in fields]
    start_utc = root.find(".//p:start_date_time", NS).text
    stop_utc = root.find(".//p:stop_date_time", NS).text
    times = [utc(rows[0]["SCLK"]), utc(rows[-1]["SCLK"])]
    difference = max(abs((datetime.fromisoformat(a) - datetime.fromisoformat(b)).total_seconds())
                     for a, b in zip(times, [start_utc, stop_utc]))
    assert difference <= (0.002 if kind == "PS" else 0.501), (filename, difference)
    url = f"{BASE}data_{section}_env/sol_0000_0089/sol_{sol:04}/"
    product = {"id": root.find(".//p:logical_identifier", NS).text,
               "version": root.find(".//p:version_id", NS).text,
               "file": filename, "url": url + filename, "labelUrl": url + label.name,
               "sha256": sha(original), "labelSha256": sha(label), "records": len(rows),
               "utcStart": start_utc, "utcStop": stop_utc, "fields": definitions,
               "endpointClockDifferenceSeconds": difference}
    return product, rows


def utc(clock):
    return spice.et2utc(spice.scs2e(-168, "1/" + str(clock)), "ISOC", 3) + "Z"


def value(text):
    number = float(text) if text else None
    return number if number is not None and math.isfinite(number) else None


def process(directory):
    for kernel in ("naif0012.tls", "m2020.tsc"):
        spice.furnsh(str(directory / kernel))
    products, series, checks = [], [], []
    for sol in (30, 31, 32):
        pressure_product, pressure = label_and_rows(directory, sol, "derived", "PS")
        temperature_product, temperature = label_and_rows(directory, sol, "calibrated", "ATS")
        ancillary_product, ancillary = label_and_rows(directory, sol, "derived", "ANCILLARY")
        products.extend([pressure_product, temperature_product, ancillary_product])
        assert pressure_product["fields"][3]["unit"] == "pascal"
        assert all(field["unit"] == "kelvin" for field in temperature_product["fields"][3:])
        for field in temperature_product["fields"]:
            assert "flag" not in field["name"].lower()
        positions = {float(row["SCLK"]): row for row in ancillary}
        temperatures = {float(row["SCLK"]): row for row in temperature}
        previous = None
        gaps, observations = [], []
        used_bins = set()
        missing_positions = missing_temperatures = 0
        for source_row, row in enumerate(pressure, 2):
            clock = float(row["SCLK"])
            if previous is not None and clock - previous > 1.5:
                gaps.append({"startSclk": previous, "stopSclk": clock, "utcStart": utc(previous), "utcStop": utc(clock)})
            previous = clock
            mean_time = row["LMST"].split("M")[1]
            hour, minute, second = map(float, mean_time.split(":"))
            bin_id = int((hour * 3600 + minute * 60 + second) // 300)
            if bin_id in used_bins:
                continue
            used_bins.add(bin_id)
            assert row["PRESSURE_UNCERTAINTY"] == "", "An uncertainty requires independently verified units"
            position = positions.get(clock)
            temperature_at_time = temperatures.get(clock)
            missing_positions += position is None
            missing_temperatures += temperature_at_time is None
            observations.append({
                "sourceRow": source_row, "sclk": clock, "utc": utc(clock), "lmst": row["LMST"], "ltst": row["LTST"],
                "pressurePa": value(row["PRESSURE"]), "transducer": int(row["TRANSDUCER"]) if row["TRANSDUCER"] else None,
                "temperatureK": [value(temperature_at_time.get(f"ATS_LOCAL_TEMP{i}", "")) for i in range(1, 6)] if temperature_at_time else [None] * 5,
                "positionM": [value(position.get(f"ROVER_POSITION_{axis}", "")) for axis in "XYZ"] if position else None,
                "roverSpeedMps": value(position.get("ROVER_VELOCITY", "")) if position else None,
            })
        assert not missing_positions, "Published position samples must match the observed clock exactly"
        temperature_gaps = [{"startSclk": float(a["SCLK"]), "stopSclk": float(b["SCLK"])}
                            for a, b in zip(temperature, temperature[1:]) if float(b["SCLK"]) - float(a["SCLK"]) > 0.751]
        series.append({"sol": sol, "pressureProduct": pressure_product["id"], "temperatureProduct": temperature_product["id"],
                       "positionProduct": ancillary_product["id"], "samples": observations, "gaps": gaps, "temperatureGaps": temperature_gaps})
        checks.append({"sol": sol, "nativePressureRecords": len(pressure), "nativeTemperatureRecords": len(temperature),
                       "packagedSamples": len(observations), "gaps": len(gaps), "temperatureGaps": len(temperature_gaps),
                       "missingExactPositions": missing_positions, "missingExactTemperatures": missing_temperatures})
    report = {
        "version": "meda-sols-30-32-v1", "source": "https://doi.org/10.17189/1522849",
        "credit": "Mars 2020 MEDA team / NASA Planetary Data System Atmospheres Node",
        "terms": "PDS publicly released science data. Cite the MEDA bundle and individual product identifiers.",
        "sampling": "First pressure observation in each occupied five-minute LMST bin. Original measurements and timestamps retained.",
        "clock": {"model": "NAIF SPICE MARS2020 SCLK -168, partition 1", "kernels": [
            {"name": "m2020.tsc", "sha256": sha(directory / "m2020.tsc"), "url": "https://naif.jpl.nasa.gov/pub/naif/MARS2020/kernels/sclk/m2020.tsc"},
            {"name": "naif0012.tls", "sha256": sha(directory / "naif0012.tls"), "url": "https://naif.jpl.nasa.gov/pub/naif/generic_kernels/lsk/naif0012.tls"}]},
        "positionFrame": "M2020_TOPO relative to the landing site. X north, Y west, Z outward, in metres. Matched at the exact spacecraft clock.",
        "sensors": [{"channel": i, "name": name, "heightM": height} for i, name, height in
                    [(1, "RSM 50°", 1.45), (2, "RSM 155°", 1.45), (3, "RSM 290°", 1.45),
                     (4, "Rover frame port", 0.84), (5, "Rover frame starboard", 0.84)]],
        "sensorSource": "https://pmc.ncbi.nlm.nih.gov/articles/PMC8550605/",
        "limitations": ["These archived measurements have zero route-ranking weight.",
                        "Calibrated local sensor temperatures retain rover and solar-heating influences. The ATS product supplies no quality flag fields.",
                        "The pressure uncertainty column is empty in the packaged records. Its PDS label lists kelvin as the unit, so it is excluded.",
                        "Some temperature and position label endpoints differ by 0.5 seconds from the first or last CSV clock. Packaged UTC uses the recorded spacecraft clock and NAIF correlation.",
                        "Times, heights, season and position differ from the MCD 6.2 fixed climatology. A quantitative model-versus-observation residual is unavailable.",
                        "The sample interval is a display reduction. Gap intervals are taken from the complete pressure product before reduction."],
        "rankingWeight": 0, "products": products, "series": series,
    }
    destination = ROOT / "public/processed/meda-sols-30-32-v1.json"
    destination.write_text(json.dumps(report, separators=(",", ":"), ensure_ascii=False) + "\n", encoding="utf-8")
    manifest = {"id": report["version"], "url": "/processed/" + destination.name, "sha256": sha(destination),
                "bytes": destination.stat().st_size, "source": report["source"], "sensorSource": report["sensorSource"],
                "credit": report["credit"], "terms": report["terms"], "sampling": report["sampling"], "checks": checks,
                "utcStart": series[0]["samples"][0]["utc"], "utcStop": series[-1]["samples"][-1]["utc"]}
    (ROOT / "data/meda-observations.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("directory", type=Path)
    args = parser.parse_args()
    process(args.directory)
