#!/usr/bin/env python3
"""Landing-page images from the real Bihar L-band run (31 Aug -> 12 Sep 2026), from the demo data.

Writes sar-dashboard-v3/public/landing/hero/:
  base.webp     dark satellite basemap (Esri World Imagery, desaturated and dimmed like the dashboard)
  before.webp   radar, earlier pass (31 Aug)
  after.webp    radar, later pass (12 Sep)
  flood.webp    flood classes in the dashboard colours (transparent elsewhere)
and src/pages/marketing/heroMeta.json: crop bounds and pin positions (percent of the image) for the
3 largest areas, plus the run summary the page prints.

All four images share one Web Mercator crop, so they stack exactly. Run from anywhere:
  python3 sar-dashboard-v3/scripts/build_landing_assets.py
"""
import io
import json
import math
import urllib.request
from pathlib import Path

from PIL import Image, ImageEnhance

ROOT = Path(__file__).resolve().parents[1]
RUN = ROOT / "public/demo/runs/bihar-l-2026-08-31-2026-09-12"
OUT = ROOT / "public/landing/hero"
CROP = {"west": 85.55, "east": 87.45, "south": 24.95, "north": 25.75}  # Ganga reach, Patna to Bhagalpur
ZOOM = 11
WIDTH = 1800
ESRI = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
KEY = {1: (0, 229, 255), 2: (216, 27, 96), 3: (255, 138, 61), 4: (255, 224, 184), 5: (139, 108, 255)}
SHOW = {1: (0x2F, 0x5A, 0xA6), 2: (0x3D, 0x8D, 0xF0), 3: (0x82, 0xB8, 0xF4), 4: (0xC2, 0xDB, 0xF7), 5: (0xD4, 0x89, 0x2F)}


def merc_y(lat):
    return math.log(math.tan(math.pi / 4 + math.radians(lat) / 2))


def world_px(lat, lon, z):
    n = 256 * 2 ** z
    return (lon + 180) / 360 * n, (1 - merc_y(lat) / math.pi) / 2 * n


def basemap():
    x0, y0 = world_px(CROP["north"], CROP["west"], ZOOM)
    x1, y1 = world_px(CROP["south"], CROP["east"], ZOOM)
    tx0, ty0, tx1, ty1 = int(x0 // 256), int(y0 // 256), int(x1 // 256), int(y1 // 256)
    mosaic = Image.new("RGB", ((tx1 - tx0 + 1) * 256, (ty1 - ty0 + 1) * 256))
    for tx in range(tx0, tx1 + 1):
        for ty in range(ty0, ty1 + 1):
            req = urllib.request.Request(ESRI.format(z=ZOOM, y=ty, x=tx), headers={"User-Agent": "NISAR-Pro"})
            tile = Image.open(io.BytesIO(urllib.request.urlopen(req, timeout=20).read())).convert("RGB")
            mosaic.paste(tile, ((tx - tx0) * 256, (ty - ty0) * 256))
    img = mosaic.crop((round(x0 - tx0 * 256), round(y0 - ty0 * 256), round(x1 - tx0 * 256), round(y1 - ty0 * 256)))
    img = ImageEnhance.Color(img).enhance(0.28)
    img = ImageEnhance.Contrast(img).enhance(1.22)
    img = ImageEnhance.Brightness(img).enhance(0.55)
    return img


def crop_overlay(path, bbox):
    """Cut CROP out of an overlay that spans bbox linearly in Web Mercator."""
    im = Image.open(path).convert("RGBA")
    w, h = im.size
    fx = lambda lon: (lon - bbox["west"]) / (bbox["east"] - bbox["west"]) * w
    fy = lambda lat: (merc_y(bbox["north"]) - merc_y(lat)) / (merc_y(bbox["north"]) - merc_y(bbox["south"])) * h
    return im.crop((round(fx(CROP["west"])), round(fy(CROP["north"])), round(fx(CROP["east"])), round(fy(CROP["south"]))))


def recolor(im):
    px = im.load()
    out = Image.new("RGBA", im.size, (0, 0, 0, 0))
    po = out.load()
    lut = {KEY[k]: SHOW[k] for k in KEY}
    for y in range(im.size[1]):
        for x in range(im.size[0]):
            r, g, b, a = px[x, y]
            if a and (r, g, b) in lut:
                po[x, y] = (*lut[(r, g, b)], 255)
    return out


def main():
    runs = json.loads((ROOT / "public/demo/runs.json").read_text())
    run = next(r for r in runs if r["id"] == "bihar-l-2026-08-31-2026-09-12")
    bbox = run["bbox"]
    OUT.mkdir(parents=True, exist_ok=True)

    base = basemap()
    size = (WIDTH, round(WIDTH * base.size[1] / base.size[0]))
    base.resize(size, Image.LANCZOS).save(OUT / "base.webp", quality=80, method=6)
    for name, src in (("before", "baseline.webp"), ("after", "active.webp")):
        crop_overlay(RUN / src, bbox).resize(size, Image.LANCZOS).save(OUT / f"{name}.webp", quality=78, method=6)
    recolor(crop_overlay(RUN / "classes.webp", bbox)).resize(size, Image.NEAREST).save(OUT / "flood.webp", lossless=True, method=6)

    # Pins for the 3 largest areas inside the crop, with their stored place names.
    gj = json.loads((RUN / "regions.geojson").read_text())
    regions = sorted((f["properties"] for f in gj["features"]), key=lambda p: -p["area_acres"])
    places = run.get("places", {})
    pins = []
    for p in regions:
        lat, lon = p["centroid_lat"], p["centroid_lon"]
        if not (CROP["west"] < lon < CROP["east"] and CROP["south"] < lat < CROP["north"]):
            continue
        pl = places.get(f"{lat:.3f},{lon:.3f}", {})
        pins.append({
            "x": round(100 * (lon - CROP["west"]) / (CROP["east"] - CROP["west"]), 2),
            "y": round(100 * (merc_y(CROP["north"]) - merc_y(lat)) / (merc_y(CROP["north"]) - merc_y(CROP["south"])), 2),
            "name": ", ".join(v for v in (pl.get("name"), pl.get("area")) if v) or p["region_id"],
            "acres": p["area_acres"],
            "km2": round(p["area_acres"] * 0.004046856, 2),
        })
        if len(pins) == 3:
            break
    summary = run["summary"]
    meta = {"crop": CROP, "size": size, "pins": pins, "run": run["id"], "summary": {k: summary[k] for k in ("band", "baseline_date", "active_date", "new_water", "water_loss", "regions")}}
    (ROOT / "src/pages/marketing/heroMeta.json").write_text(json.dumps(meta, indent=1))
    for f in sorted(OUT.iterdir()):
        print(f.name, f.stat().st_size // 1024, "KB")


if __name__ == "__main__":
    main()
