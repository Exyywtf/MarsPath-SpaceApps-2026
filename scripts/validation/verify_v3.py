"""Independently check the V3 assets, source axes and an exported route."""
import argparse
import hashlib
import json
import math
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
ASSET = ROOT / "public" / "processed"
MANIFEST = json.loads((ASSET / "radiation-v1.json").read_text(encoding="utf-8"))
CLIMATE = json.loads((ASSET / "mcd-v62.json").read_text(encoding="utf-8"))
R = 3396190


def xyz(point):
    lon, lat = np.deg2rad(point)
    return np.array([np.cos(lat)*np.cos(lon), np.cos(lat)*np.sin(lon), np.sin(lat)])


def segment(a, b):
    start, end = xyz(a), xyz(b)
    length = R*np.arctan2(np.linalg.norm(np.cross(start, end)), np.dot(start, end))
    center = start+end
    return float(length), [float(np.rad2deg(np.arctan2(center[1],center[0]))),
                           float(np.rad2deg(np.arctan2(center[2],np.linalg.norm(center[:2]))))]


def interpolate(x,y,xs,ys,data):
    row = np.array([np.interp(x, xs, a) for a in data])
    return float(np.interp(y,ys,row))


def inspect(point, grid):
    lon, lat = point
    lon = (lon+180) % 360 - 180
    if abs(lat)>89:
        return None
    p = interpolate(lon,lat,np.arange(-180,181),np.arange(-89,90),grid)
    if not 82 <= p <= 1200:
        return None
    return float(np.interp(p,MANIFEST["pressurePa"],MANIFEST["effectiveDoseMsvPerYear"]))


def verify_assets():
    for name,expected in MANIFEST["derivatives"].items():
        assert hashlib.sha256((ASSET/name).read_bytes()).hexdigest() == expected
    assert hashlib.sha256((ASSET/"PIA03480-original.jpg").read_bytes()).hexdigest() == MANIFEST["historical"]["originalSha256"]
    p = (ASSET/"radiation-atris-v1-pressure.f32").read_bytes()
    assert hashlib.sha256(p).hexdigest() == MANIFEST["pressureSha256"]
    grid = np.frombuffer(p,dtype="<f4").reshape(179,360)[::-1]
    grid = np.hstack([grid,grid[:,0,None]])
    assert abs(inspect((-180,0),grid) - 167.716353) < 1e-5
    assert inspect((-180,0),grid) == inspect((180,0),grid)
    assert inspect((70,-90),grid) is None and inspect((59,-48),grid) is None
    history = np.asarray(Image.open(ASSET/"radiation-pia03480-v1.webp").convert("RGBA"))
    radiation = np.asarray(Image.open(ASSET/"radiation-atris-v1.png").convert("RGBA"))
    height,width,_ = radiation.shape
    assert history.shape == radiation.shape == (720,1440,4)
    latitude = 90-(np.arange(height)+.5)*180/height
    weight = np.cos(np.deg2rad(latitude))[:,None]
    for image,expected in [(history,MANIFEST["historical"]["coverage"]),(radiation,MANIFEST["modelCoverage"])]:
        area = np.sum((image[:,:,3]>0)*weight)/(np.sum(weight)*width)
        assert abs(area-expected)<1e-12
    for x,y in [(4,180),(500,400),(1050,287),(1439,529),(0,0),(1360,719)]:
        point = [-180+(x+.5)*360/width,90-(y+.5)*180/height]
        rate = inspect(point,grid)
        color = radiation[y,x]
        assert (color[3] == 0) == (rate is None)
        if rate is not None:
            palette = [tuple(bytes.fromhex(c[1:])) for c in MANIFEST["modelPalette"]]
            colors = [round(np.interp(rate,np.linspace(161,173,5),channel)) for channel in zip(*palette)]
            assert np.max(np.abs(color[:3].astype(float)-colors)) <= 1
    print("Verified radiation checksums, transparent coverage, periodic interpolation and numeric-to-legend colour checks.")
    return grid


def check_route_grid(route_path, pressure):
    record = json.loads(route_path.read_text(encoding="utf-8"))
    feature = record["features"][0]
    props = feature["properties"]
    assert props["tier"] == "regional", "This independent check uses an interior regional route."
    analysis = props["analysis"]
    main = feature["geometry"]["coordinates"][0]
    pieces = [segment(a,b) for a,b in zip(main,main[1:])]
    connectors = props["unassessedConnectors"]
    for index,(a,b) in enumerate(connectors):
        metric = segment(a,b)
        if metric[0] > 1e-6:
            pieces.extend([metric]*(1 if index in (0,len(connectors)-1) else 2))
    distance = sum(d for d, _ in pieces)
    assert abs(analysis["distance"]-distance)<0.01
    assert abs(props["distanceM"]-distance)<0.01
    xs, ys = np.linspace(-180,180,64),np.linspace(-90,90,48)
    fields = {id:np.array(field["values"]).reshape(48,64)[::-1] for id,field in CLIMATE["fields"].items()}
    # The example stays within one export cell, so its independent spherical
    # edge midpoint quadrature is equivalent to the split-grid calculation.
    for id in [*fields,"radiation"]:
        values = [(d,inspect(p,pressure) if id=="radiation" else interpolate(*p,xs,ys,fields[id]))
                  for d,p in pieces]
        expected = float(sum(d*v for d,v in values)/distance)
        measured = analysis["factors"][id]
        assert abs(expected-measured["mean"])<1e-5, (id,expected,measured["mean"])
        assert math.isclose(min(v for _,v in values),measured["min"],abs_tol=1e-5)
        assert math.isclose(max(v for _,v in values),measured["max"],abs_tol=1e-5)
        assert measured["coverage"] == 1
        print(f"{id} independent mean {expected:.9f}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("route",type=Path,nargs="?",help="Completed Jezero GeoJSON export")
    args = parser.parse_args()
    grid = verify_assets()
    if args.route:
        check_route_grid(args.route,grid)
