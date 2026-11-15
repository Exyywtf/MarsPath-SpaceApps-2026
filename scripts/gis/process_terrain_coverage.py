"""Render map coverage directly from the planner's validity masks."""

import argparse
import hashlib
import json
from pathlib import Path

from PIL import Image, ImageColor

ROOT = Path(__file__).resolve().parents[2]
PUBLIC = ROOT / "public"
FOLDER = "/processed/coverage-v1"
COLORS = {"regional": "#62bca7", "coarse": "#58678d", "missing": "#aa8269"}


def render(meta, regional):
    mask = (PUBLIC / meta["validUrl"].lstrip("/")).read_bytes()
    size = (meta["width"], meta["height"])
    if len(mask) != size[0] * size[1] or set(mask) - {0, 1}:
        raise ValueError("Invalid terrain validity mask")
    if meta.get("validCells", mask.count(1)) != mask.count(1):
        raise ValueError("Validity count does not match the source manifest")
    image = Image.frombytes("P", size, mask)
    palette = [*ImageColor.getrgb(COLORS["missing"]), *ImageColor.getrgb(COLORS["regional" if regional else "coarse"])]
    image.putpalette(palette)
    url = f'{FOLDER}/{meta["id"]}.png'
    destination = PUBLIC / url.lstrip("/")
    destination.parent.mkdir(parents=True, exist_ok=True)
    image.save(destination, **({"transparency": 0} if regional else {}), optimize=True)
    return {
        "id": meta["id"], "imageUrl": url, "imageSize": size, "bounds": meta["bounds"],
        "maskSha256": hashlib.sha256(mask).hexdigest(),
        "imageSha256": hashlib.sha256(destination.read_bytes()).hexdigest(),
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--regional", nargs="*", default=["jezero"], help="Regional processed manifest names")
    args = parser.parse_args()
    entries = []
    for i, name in enumerate(["mola-quarter", *args.regional]):
        meta = json.loads((PUBLIC / "processed" / f"{name}.json").read_bytes())
        entries.append(render(meta, i > 0))
    manifest = {"version": "coverage-v1", "colors": COLORS, "global": entries[0], "regions": entries[1:]}
    (ROOT / "data" / "terrain-coverage.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
