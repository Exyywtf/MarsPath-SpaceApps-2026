"""Preserve a native-aligned Oxia CTX window and record its original registration."""

import argparse
import hashlib
import json
from pathlib import Path
from zipfile import ZipFile

import numpy as np
import rasterio
from pyproj import CRS, Transformer
from rasterio.windows import Window, from_bounds

ROOT = Path(__file__).resolve().parents[2]
RADIUS = 3396190
SOURCE = "https://doi.org/10.21954/ou.rd.16451220.v1"
ENTRY = "03_CTX/03_d_CTX_DEM/CTX_OXIA_DEM_20m.tif"
ARCHIVE_MD5 = "9d01c587dd2287d7c4de6ac272cbf03d"


def digest(path, algorithm="sha256"):
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, algorithm).hexdigest()


def registration(source, reference):
    """Check independently supplied MOLA heights under both latitude interpretations."""
    with rasterio.open(source) as dataset:
        samples = dataset.read(1)[::24, ::24]
        rows, columns = np.nonzero(dataset.read_masks(1)[::24, ::24])
        x, y = dataset.transform * (columns * 24 + 0.5, rows * 24 + 0.5)
        crs = CRS.from_wkt(dataset.crs.to_wkt())
        inverse = Transformer.from_crs(crs, crs.geodetic_crs, always_xy=True)
        longitude, latitude = inverse.transform(x, y)
        elevation = samples[rows, columns]
    with rasterio.open(reference) as mola:
        assert mola.crs.to_dict()["R"] == RADIUS
        bounds = np.radians([longitude.min() - 0.1, latitude.min() - 0.3,
                             longitude.max() + 0.1, latitude.max() + 0.3]) * RADIUS
        window = from_bounds(*bounds, transform=mola.transform).round_offsets().round_lengths()
        values = mola.read(1, window=window)
        affine = mola.window_transform(window)
        checks = {}
        alternatives = {
            "nativeEqcLatitude": latitude,
            "ifPlanetographicToCentric": np.degrees(np.arctan(np.tan(np.radians(latitude)) * (3376200 / RADIUS) ** 2)),
        }
        for key, latitudes in alternatives.items():
            columns, rows = ~affine * (np.radians(longitude) * RADIUS, np.radians(latitudes) * RADIUS)
            sampled = values[rows.astype(int), columns.astype(int)]
            valid = sampled != mola.nodata
            difference = sampled[valid] - elevation[valid]
            median = float(np.median(difference))
            checks[key] = {
                "samples": int(valid.sum()), "medianDifferenceM": median,
                "medianAbsoluteDifferenceM": float(np.median(abs(difference))),
                "centredRmsDifferenceM": float(np.sqrt(np.mean((difference - median) ** 2))),
            }
    assert checks["nativeEqcLatitude"]["centredRmsDifferenceM"] < checks["ifPlanetographicToCentric"]["centredRmsDifferenceM"]
    return {
        "referenceSha256": digest(reference), "reference": "Preserved USGS MGS MOLA 463 m numerical DEM",
        "sampling": "Every 24th source row and column, valid cells only. Nearest MOLA sample.",
        "interpretations": checks,
        "conclusion": "Retain native equirectangular angular coordinates. Agreement with coarse MOLA does not establish absolute alignment accuracy.",
    }


def process(archive, source, reference):
    assert digest(archive, "md5") == ARCHIVE_MD5, "Archive differs from the authors' release"
    with ZipFile(archive) as zipped:
        assert zipped.testzip() is None, "Archive CRC check failed"
        if not source.exists():
            source.parent.mkdir(parents=True, exist_ok=True)
            source.write_bytes(zipped.read(ENTRY))
        assert digest(source) == hashlib.sha256(zipped.read(ENTRY)).hexdigest()
    with rasterio.open(source) as dataset:
        crs = CRS.from_wkt(dataset.crs.to_wkt())
        projection = crs.to_dict()
        assert projection["proj"] == "eqc" and projection["lon_0"] == 335.45 and projection["lat_ts"] == 0
        assert crs.ellipsoid.semi_major_metre == RADIUS
        assert dataset.dtypes == ("float32",) and dataset.scales == (1.0,) and dataset.offsets == (0.0,)
        full = dataset.read(1, masked=True)
        rows, columns = np.nonzero(~np.ma.getmaskarray(full) & np.isfinite(full.data))
        cells = round(30000 / dataset.transform.a)
        col = round((columns.min() + columns.max() + 1 - cells) / 2)
        row = round((rows.min() + rows.max() + 1 - cells) / 2)
        window = Window(col, row, cells, cells)
        transform = dataset.window_transform(window)
        padded = dataset.read(1, window=Window(col - 1, row - 1, cells + 2, cells + 2), masked=True).filled(np.nan).astype(float)
        latitude = (transform.f + (np.arange(cells) + 0.5) * transform.e) / RADIUS
        dy, dx = np.gradient(padded)
        dx = dx[1:-1, 1:-1] / (abs(transform.a) * np.cos(latitude)[:, None])
        dy = dy[1:-1, 1:-1] / abs(transform.e)
        slope = np.degrees(np.arctan(np.hypot(dx, dy)))
        elevation = padded[1:-1, 1:-1]
        valid = np.isfinite(elevation) & np.isfinite(slope)
        inverse = Transformer.from_crs(crs, crs.geodetic_crs, always_xy=True)
        normalize = lambda longitude: (longitude + 180) % 360 - 180
        west, south = inverse.transform(*transform * (0, cells))
        east, north = inverse.transform(*transform * (cells, 0))
        examples = []
        for pair in [((0.45, 0.5), (0.53, 0.52)), ((0.50, 0.54), (0.515, 0.53))]:
            points = []
            for fx, fy in pair:
                x, y = int(cells * fx), int(cells * fy)
                assert valid[y, x] and slope[y, x] < 20
                lon, lat = inverse.transform(*transform * (x + 0.5, y + 0.5))
                points.append([normalize(lon), lat])
            examples.append(points)
        output = ROOT / "public/processed"
        arrays = {"elevation": np.where(valid, elevation, np.nan).astype("<f4"),
                  "slope": np.where(valid, slope, np.nan).astype("<f4"), "valid": valid.astype("u1")}
        checksums = {}
        for name, array in arrays.items():
            filename = f'oxia-{name}.{"u8" if name == "valid" else "f32"}'
            array.tofile(output / filename)
            checksums[name] = digest(output / filename)
        metadata = {
            "id": "oxia-ctx-native", "name": "Oxia CTX numerical terrain",
            "sourceUrl": "https://ndownloader.figshare.com/files/30475302", "sourcePage": SOURCE,
            "sha256": digest(source), "archiveMd5": ARCHIVE_MD5, "archiveSha256": digest(archive),
            "derivedSha256": hashlib.sha256("".join(checksums.values()).encode()).hexdigest(), "arrayChecksums": checksums,
            "width": cells, "height": cells, "pixelSize": transform.a, "radius": RADIUS,
            "transform": list(transform)[:6], "bounds": [normalize(west), south, normalize(east), north],
            "equirectangular": {"centralMeridian": 335.45}, "crs": dataset.crs.to_wkt(),
            "sourceWindow": {"column": col, "row": row, "width": cells, "height": cells},
            "sourceNodata": dataset.nodata, "units": "m elevation tied vertically to MOLA; degrees derived slope",
            "validCells": int(valid.sum()), "totalCells": int(valid.size),
            "elevationRange": [float(np.nanmin(elevation)), float(np.nanmax(elevation))],
            "elevationUrl": "/processed/oxia-elevation.f32", "slopeUrl": "/processed/oxia-slope.f32", "validUrl": "/processed/oxia-valid.u8",
            "examples": examples, "terms": "CC BY 4.0", "credit": "Fawdon et al. (2021), The geography of Oxia Planum. Derivatives by MarsPath.",
            "processing": "Native-aligned 1483-cell square about 30 km across, centred on the valid source footprint midpoint. No elevation resampling. Finite-difference slopes use a one-cell source halo and latitude-dependent east-west distances. Finite source nodata masked before arithmetic.",
            "limitations": ["Filename describes 20 m data. Affine grid spacing is 20.2341182386 m.",
                            "The authors report MOLA vertical control and manual spline registration to HRSC. Absolute alignment accuracy is unknown.",
                            "The source WKT contains an ellipsoid, while its equirectangular equations map directly to the angular grid. The MOLA registration check supports retaining these native angular coordinates.",
                            "Terrain grid cannot resolve rock-scale obstacles or establish traversability."],
        }
        (output / "oxia.json").write_text(json.dumps(metadata, indent=2) + "\n", encoding="utf-8")
    validation = registration(source, reference)
    validation.update({"dataset": metadata["id"], "sourceSha256": metadata["sha256"], "archiveMd5": ARCHIVE_MD5,
                       "archiveCrc": "all members passed", "nativeWindow": metadata["sourceWindow"],
                       "gridSpacingM": metadata["pixelSize"], "validCells": metadata["validCells"], "arrayChecksums": checksums})
    (ROOT / "data/validation/v5-oxia-registration.json").write_text(json.dumps(validation, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({key: metadata[key] for key in ("id", "bounds", "pixelSize", "validCells", "examples")}, indent=2))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archive", type=Path)
    parser.add_argument("source", type=Path)
    parser.add_argument("mola_reference", type=Path)
    args = parser.parse_args()
    process(args.archive, args.source, args.mola_reference)
