"""Build MarsPath's two radiation products from their pinned public originals."""
import argparse
import hashlib
import io
import json
import tarfile
import urllib.request
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "public" / "processed"
NASA_BASE = "https://assets.science.nasa.gov/content/dam/science/psd/photojournal/pia/pia03/pia03480/"
ARCHIVE = "https://zenodo.org/api/records/5953666/files/FigureData.tar/content"
PUBLISHED = {
    ARCHIVE: "a17d9965089affc368bdf9188e33759010feefc1d632757bea0eabbec841333a",
    NASA_BASE + "PIA03480.tif": "e3b6557785c42368db5075d429ebe7a3cb8689d0ea65768843d1398ae98b3a4a",
    NASA_BASE + "PIA03480.jpg": "86ad1260d44d2a62c2c9880c01d2b5bd9978ecb9f5e3574b4c935f98f1fdbcf3",
}
SOURCE_FILES = {
    "figure2pressures": "38aea19bac96f9d161def1f54081f0cb3d5f7272e32f0c7764113831a252b409",
    "figure2locations": "38dbcbf9e8276517ddcedd15dd8ccf009977971a8e6fff8af4a66ca2220e4338",
    "figure11_eff_depth": "0da024d59e554f4a6f635271d251feb655715f92907cab3cf3230dbed633bc0f",
}
PRESSURE = np.array([82., 305., 529., 753., 975., 1200.])
PALETTE = ["#202a47", "#475688", "#83769b", "#c398a4", "#f7d5ba"]
HISTORICAL_PALETTE = ["#000073", "#1025ff", "#00a8ff", "#00fff0", "#65ff9c", "#edff00", "#ffb700", "#ff5100", "#d90000", "#780000"]
HISTORICAL_PAGE = "https://www.jpl.nasa.gov/images/pia03480-estimated-radiation-dosage-on-mars/"
PROJECTIONS = [
    (815.054, 1420.286, 661.945, 90., -30.),
    (2211.095, 1421.421, 662.133, 240., 37.5),
]
CUTOFF = .2
WIDTH, HEIGHT = 1440, 720
REF = "radiation-pia03480-v1"
MODEL = "radiation-atris-v1"
PROXY = "radiation-column-v1"


def sha(data):
    return hashlib.sha256(data).hexdigest()


def read_pinned(url):
    with urllib.request.urlopen(url, timeout=20) as response:
        payload = response.read()
    assert sha(payload) == PUBLISHED[url], f"Source checksum changed: {url}"
    return payload


def write_json(path, data):
    path.write_text(json.dumps(data, indent=2, allow_nan=False) + "\n", encoding="utf-8", newline="\n")


def source_model(archive):
    with tarfile.open(fileobj=io.BytesIO(archive)) as tar:
        def array(name):
            payload = tar.extractfile(f"PAPER1/{name}.txt").read()
            assert sha(payload) == SOURCE_FILES[name]
            return np.loadtxt(io.BytesIO(payload))
        raw = array("figure2pressures")
        sites = array("figure2locations")
        effective = array("figure11_eff_depth")
    assert raw.shape == (360, 180) and sites.shape == (6, 3)
    assert np.all(np.isfinite(raw) & (raw > 0))
    anchors = raw[(sites[:, 0] + 180).astype(int), (sites[:, 1] + 90).astype(int)]
    assert max(abs(anchors - sites[:, 2])) < 1
    surface = effective[effective[:, 0] == 0]
    assert surface.shape == (1, 19)
    rates = surface[0, 7:13]
    assert np.all(np.isfinite(rates) & (rates > 0))
    # Figure 2 prints 180 latitude rows at -90…+89. Longitude is undefined at
    # the South Pole and the published south row varies, so omit it too.
    values = np.ascontiguousarray(raw[:, :0:-1].T, dtype="<f4")
    return values, rates, (sites, anchors)


def coords(width=WIDTH, height=HEIGHT):
    return np.meshgrid(-180 + (np.arange(width) + .5) * 360 / width,
                       90 - (np.arange(height) + .5) * 180 / height)


def sample_pressure(values, lon, lat):
    x = (lon + 180) % 360
    y = np.clip(89 - lat, 0, 178)
    i, j = x.astype(int), y.astype(int)
    f, g = x - i, y - j
    return np.where(abs(lat) > 89, np.nan,
                    (values[j, i] * (1-f) + values[j, (i+1)%360] * f) * (1-g)
                    + (values[np.minimum(j+1, 178), i] * (1-f)
                       + values[np.minimum(j+1, 178), (i+1)%360] * f) * g)


def scalar_image(values, palette, limits):
    t = np.nan_to_num(np.clip((values - limits[0]) / (limits[1] - limits[0]), 0, 1))
    colors = np.array([[int(c[i:i+2], 16) for i in (1, 3, 5)] for c in palette])
    channels = [np.interp(t, np.linspace(0, 1, len(colors)), c).round().astype(np.uint8)
                for c in colors.T]
    return Image.fromarray(np.dstack([*channels, np.isfinite(values).astype(np.uint8)*255]))


def area_fraction(mask, lat):
    weights = np.cos(np.deg2rad(lat))
    return float(np.sum(weights * mask) / weights.sum())


def orthographic(lon, lat, view):
    x, y, r, lon0, lat0 = view
    d, a, b = np.deg2rad(lon-lon0), np.deg2rad(lat), np.deg2rad(lat0)
    return (x + r*np.cos(a)*np.sin(d),
            y - r*(np.cos(b)*np.sin(a)-np.sin(b)*np.cos(a)*np.cos(d)),
            np.sin(a)*np.sin(b)+np.cos(a)*np.cos(b)*np.cos(d))


def historical_image(tif, lon, lat):
    rgb = np.array(Image.open(io.BytesIO(tif)).convert("RGB"))
    assert rgb.shape == (2400, 3000, 3)
    views = [orthographic(lon, lat, p) for p in PROJECTIONS]
    best = np.maximum(views[0][2], views[1][2])
    rgba = np.zeros((*lon.shape, 4), dtype=np.uint8)
    for index, (x, y, view) in enumerate(views):
        mask = (view >= CUTOFF) & ((view >= views[1-index][2]) if index == 0 else (view > views[1-index][2]))
        px, py = x[mask].astype(int), y[mask].astype(int)
        f, g = (x[mask]-px)[:, None], (y[mask]-py)[:, None]
        rgba[mask, :3] = np.rint((rgb[py, px]*(1-f)+rgb[py, px+1]*f)*(1-g)
                                +(rgb[py+1, px]*(1-f)+rgb[py+1, px+1]*f)*g).astype(np.uint8)
    rgba[:, :, 3] = (best >= CUTOFF)*255
    return Image.fromarray(rgba), best >= CUTOFF, rgb


def assert_registration(rgb):
    # Independent graticule intersections distributed through both views.
    metrics = []
    for proj in PROJECTIONS:
        lon, lat = np.meshgrid(np.arange(proj[3]-75, proj[3]+76, 15), np.arange(-82.5, 82.6, 7.5))
        x, y, d = orthographic(lon, lat, proj)
        points = []
        for px, py in zip(x[d>.6], y[d>.6]):
            u, v = round(px), round(py)
            ey, ex = np.nonzero(rgb[v-6:v+7, u-6:u+7].max(2) < 80)
            assert len(ex), (u, v)
            points.append(float(np.min(np.hypot(ex+(u-6)-px, ey+(v-6)-py))))
        metrics.append({"count": len(points), "medianPx": float(np.median(points)), "p95Px": float(np.percentile(points, 95))})
        assert metrics[-1]["p95Px"] <= 3
    # Hand-picked image centres of colour/relief landmarks excluded from the fit.
    landmarks = []
    for name, i, lon, lat, x, y in [
        ("Hellas basin", 0, 70., -42.66, 653., 1578.),
        ("Olympus Mons summit", 1, 226.8, 18.3, 2067., 1629.),
        ("Ascraeus Mons summit", 1, 255.6, 11.2, 2386., 1696.),
        ("Pavonis Mons summit", 1, 247.5, .8, 2295., 1816.),
        ("Arsia Mons summit", 1, 239.6, -9.2, 2208., 1906.),
    ]:
        u, v, _ = orthographic(lon, lat, PROJECTIONS[i])
        error = float(np.hypot(u-x, v-y))
        assert error <= 8
        landmarks.append(dict(name=name, pixel=[x, y], coordinates=[lon, lat], errorPx=error))
    return metrics, landmarks


def convert(out):
    lon, lat = coords()
    archive = read_pinned(ARCHIVE)
    values, rates, (sites, original_anchors) = source_model(archive)
    p = sample_pressure(values, lon, lat)
    m = np.interp(p, PRESSURE, rates, left=np.nan, right=np.nan)
    errors = [float(np.interp(PRESSURE[i], np.delete(PRESSURE, i), np.delete(rates, i))-rates[i]) for i in range(1, 5)]
    assert max(map(abs, errors)) < 3
    assert np.isfinite(m).any()
    bounds = [-180, -90, 180, 90]
    (out / f"{MODEL}-pressure.f32").write_bytes(values.tobytes())
    scalar_image(m, PALETTE, [161, 173]).save(out / f"{MODEL}.png")
    scalar_image(p / 3.72, PALETTE, [20, 330]).save(out / f"{PROXY}.png")
    hist, valid, rgb = historical_image(read_pinned(NASA_BASE+"PIA03480.tif"), lon, lat)
    grid_checks, landmarks = assert_registration(rgb)
    assert .79 < area_fraction(valid, lat) < .81
    hist.save(out / f"{REF}.webp", lossless=True)
    Image.fromarray(rgb[429:532, 337:2707]).save(out / f"{REF}-legend.webp", lossless=True)
    (out / "PIA03480-original.jpg").write_bytes(read_pinned(NASA_BASE+"PIA03480.jpg"))
    manifests = {
        "id": MODEL, "version": 1, "archive": ARCHIVE, "archiveSha256": sha(archive), "files": SOURCE_FILES,
        "pressureSha256": sha(values.tobytes()),
        "pressureShape": [360, 179],
        "pressureAxis": "Rows +89° to −89° N; columns −180° to +179° E. Planetocentric grid, 1° pressure nodes, periodic longitude.",
        "pressureUrl": f"/processed/{MODEL}-pressure.f32",
        "pressurePa": PRESSURE.tolist(), "effectiveDoseMsvPerYear": rates.tolist(),
        "bounds": bounds, "imageSize": [WIDTH, HEIGHT], "modelRange": [161, 173],
        "modelPalette": PALETTE, "modelCoverage": area_fraction(np.isfinite(m), lat),
        "proxyRange": [20, 330], "proxyGravity": 3.72, "proxyCoverage": area_fraction(np.isfinite(p), lat),
        "source": "https://doi.org/10.1029/2021JE007157", "data": "https://doi.org/10.5281/zenodo.5953666",
        "terms": "https://creativecommons.org/licenses/by/4.0/", "credit": "Jian Zhang and Jingnan Guo (2022); derived by MarsPath",
        "scenario": "Surface at 0 km · GCR and secondaries · 700 MV solar modulation · Ls 0° at local midnight · uniform dry regolith · no additional shielding",
        "withheldPressureErrors": errors,
        "historical": {
            "id": REF, "source": HISTORICAL_PAGE, "sourceSha256": PUBLISHED[NASA_BASE+"PIA03480.tif"],
            "terms": "https://www.jpl.nasa.gov/jpl-image-use-policy/", "credit": "NASA/Jet Propulsion Laboratory/JSC",
            "views": PROJECTIONS, "viewCosineCutoff": CUTOFF, "coverage": area_fraction(valid, lat),
            "controls": grid_checks, "landmarks": landmarks, "palette": HISTORICAL_PALETTE,
            "originalUrl": "/processed/PIA03480-original.jpg",
            "originalSha256": PUBLISHED[NASA_BASE+"PIA03480.jpg"],
        },
        "derivatives": {name: sha((out / name).read_bytes()) for name in
                        [f"{MODEL}.png", f"{PROXY}.png", f"{REF}.webp", f"{REF}-legend.webp"]},
    }
    write_json(out / "radiation-v1.json", manifests)
    report = {"pressureAnchors": [dict(lon=float(lon), lat=float(lat), simulatedPa=float(p1), gridPa=float(p2))
                                 for (lon, lat, p1), p2 in zip(sites, original_anchors)],
              "withheldPressureErrorMsvYear": errors,
              "historicalControlPixels": grid_checks,
              "historicalLandmarkPixels": landmarks,
              "historicalAreaPercent": 100*manifests["historical"]["coverage"],
              "modelAreaPercent": 100*manifests["modelCoverage"]}
    print(json.dumps(report, indent=2))
    return report


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--write", action="store_true", required=True, help="Regenerate versioned static derivatives.")
    parser.parse_args()
    write_json(ROOT / "data" / "validation" / "v3-radiation.json", convert(OUT))
