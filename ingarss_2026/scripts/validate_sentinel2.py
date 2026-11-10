#!/usr/bin/env python3
"""Score NISAR water masks against dated Sentinel-2 optical water labels.

Reference: Sentinel-2 L2A from Microsoft Planetary Computer, orbit R076, zone 45
tiles, on the 80 m common L/S lattice. Water is NDWI = (B03-B08)/(B03+B08) above
a threshold. The primary threshold is 0.0, fixed before scoring; the others are
reported as sensitivity. Pixels are scored only inside the NISAR footprint and
outside Sentinel-2 cloud, shadow and nodata, with cloud grown by 3 pixels.

Optical water labels are not ground truth. Water under vegetation is invisible
to them, and turbid water can have low NDWI.
"""

import argparse
import json
from pathlib import Path

import numpy as np
import rasterio
import requests
from rasterio.enums import Resampling
from rasterio.warp import reproject, transform_bounds

STAC = "https://planetarycomputer.microsoft.com/api/stac/v1/search"
TOKEN = "https://planetarycomputer.microsoft.com/api/sas/v1/token/sentinel-2-l2a"
BAD_SCL = (0, 1, 3, 8, 9, 10, 11)  # nodata, defective, shadow, cloud, cirrus, snow
PRIMARY = 0.0
THRESHOLDS = (0.0, 0.1, 0.2, 0.3)
WATER_NOW = (1, 2, 3)   # water on the later date of a class map
WATER_BEFORE = (1, 5)   # water on the earlier date of a class map
GAIN = (2, 3)


def grow(mask, radius):
    """Expand a mask by a square of the given radius, using running sums."""
    out = mask.astype(np.int32)
    for axis in (0, 1):
        pad = [(0, 0), (0, 0)]
        pad[axis] = (radius + 1, radius)
        c = np.cumsum(np.pad(out, pad), axis=axis)
        n = out.shape[axis]
        hi = np.take(c, range(2 * radius + 1, 2 * radius + 1 + n), axis=axis)
        lo = np.take(c, range(0, n), axis=axis)
        out = ((hi - lo) > 0).astype(np.int32)
    return out.astype(bool)


def read_on_grid(url, grid, resampling, decimate=1):
    """Read one band onto the lattice. Decimated reads use the file's overviews."""
    out = np.full(grid["shape"], np.nan, dtype=np.float32)
    with rasterio.open(url) as src:
        h, w = src.height // decimate, src.width // decimate
        data = src.read(1, out_shape=(h, w), resampling=Resampling.average).astype(np.float32)
        transform = src.transform * src.transform.scale(src.width / w, src.height / h)
        data[data == 0] = np.nan
        reproject(data, out, src_transform=transform, src_crs=src.crs, src_nodata=np.nan,
                  dst_transform=grid["transform"], dst_crs=grid["crs"], dst_nodata=np.nan,
                  resampling=resampling)
    return out


def read_scl(url, grid):
    """Return (clear, known): pixels with no bad 20 m sample, and pixels with data."""
    bad = np.zeros(grid["shape"], dtype=np.uint8)
    known = np.zeros(grid["shape"], dtype=np.uint8)
    with rasterio.open(url) as src:
        scl = src.read(1)
        for values, dest in ((np.isin(scl, BAD_SCL), bad), (scl != 0, known)):
            reproject(values.astype(np.uint8), dest, src_transform=src.transform, src_crs=src.crs,
                      dst_transform=grid["transform"], dst_crs=grid["crs"], resampling=Resampling.max)
    return bad.astype(bool), known.astype(bool)


def build_reference(date, grid, token, cache):
    """Mosaic zone 45 tiles of one pass. Returns ndwi, clear mask and tile metadata."""
    if cache.exists():
        z = np.load(cache, allow_pickle=True)
        return z["ndwi"], z["clear"], json.loads(str(z["tiles"]))
    bbox = transform_bounds(grid["crs"], "EPSG:4326", *grid["bounds"])
    r = requests.post(STAC, json={"collections": ["sentinel-2-l2a"], "bbox": list(bbox), "limit": 100,
                                  "datetime": f"{date}T00:00:00Z/{date}T23:59:59Z"}, timeout=120)
    r.raise_for_status()
    items = [i for i in r.json()["features"] if "_R076_T45" in i["id"]]
    if not items:
        raise SystemExit(f"No R076 zone 45 Sentinel-2 tiles for {date}")
    ndwi = np.full(grid["shape"], np.nan, dtype=np.float32)
    clear = np.zeros(grid["shape"], dtype=bool)
    tiles = []
    for item in sorted(items, key=lambda i: i["properties"]["eo:cloud_cover"]):
        url = lambda band: item["assets"][band]["href"] + "?" + token
        green = read_on_grid(url("B03"), grid, Resampling.bilinear, decimate=8)
        nir = read_on_grid(url("B08"), grid, Resampling.bilinear, decimate=8)
        bad, known = read_scl(url("SCL"), grid)
        tile_clear = known & ~grow(bad, 3) & np.isfinite(green) & np.isfinite(nir)
        new = tile_clear & ~clear
        ndwi[new] = ((green - nir) / np.maximum(green + nir, 1.0))[new]
        clear |= new
        tiles.append({"id": item["id"], "datetime": item["properties"]["datetime"],
                      "scene_cloud_percent": round(item["properties"]["eo:cloud_cover"], 1),
                      "pixels_used": int(new.sum())})
        print(f"  {item['id'][:58]} cloud {tiles[-1]['scene_cloud_percent']}% used {tiles[-1]['pixels_used']}")
    np.savez_compressed(cache, ndwi=ndwi, clear=clear, tiles=json.dumps(tiles))
    return ndwi, clear, tiles


def metrics(pred, ref):
    tp = int(np.count_nonzero(pred & ref)); fp = int(np.count_nonzero(pred & ~ref))
    fn = int(np.count_nonzero(~pred & ref)); tn = int(np.count_nonzero(~pred & ~ref))
    safe = lambda a, b: round(a / b, 4) if b else None
    p, r = safe(tp, tp + fp), safe(tp, tp + fn)
    return {"true_positive": tp, "false_positive": fp, "false_negative": fn, "true_negative": tn,
            "precision": p, "recall": r, "f1": safe(2 * tp, 2 * tp + fp + fn),
            "iou": safe(tp, tp + fp + fn), "overall_accuracy": safe(tp + tn, tp + tn + fp + fn)}


def score(maps, classes, ref_ndwi, mask):
    rows = {}
    for t in THRESHOLDS:
        ref = ref_ndwi >= t
        rows[f"ndwi_{t}"] = {name: metrics(np.isin(m, classes)[mask], ref[mask]) for name, m in maps.items()}
    return rows


def lattice_class(path, grid):
    """Read a class raster, cropping an L-band grid to the common lattice."""
    with rasterio.open(path) as src:
        window = rasterio.windows.from_bounds(*grid["bounds"], transform=src.transform).round_offsets().round_lengths()
        return src.read(1, window=window)


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--results", required=True, type=Path, help="The package results/ folder")
    p.add_argument("--work-dir", required=True, type=Path, help="Folder for downloaded reference caches")
    p.add_argument("--output", required=True, type=Path)
    a = p.parse_args()
    a.work_dir.mkdir(parents=True, exist_ok=True)
    R = a.results
    with rasterio.open(R / "LS_fused_aug31_sep12/valid_support.tif") as s:
        support = s.read(1).astype(bool)
        grid = {"shape": s.shape, "transform": s.transform, "crs": s.crs, "bounds": tuple(s.bounds)}
    token = requests.get(TOKEN, timeout=60).json()["token"]
    maps = {
        "l_only": lattice_class(R / "L_aug31_sep12/sar-bihar-aug31-sep12-full_flood_class.tif", grid),
        "s_only": lattice_class(R / "S_aug31_sep12/sar-bihar-sband-aug31-sep12-full_flood_class.tif", grid),
        "fused": lattice_class(R / "LS_fused_aug31_sep12/sar-bihar-ls-fused-aug31-sep12_class.tif", grid),
    }
    oct18 = {"l_only": lattice_class(R / "L_sep12_oct18/"
                                     "sar-bihar-sep12-oct18-recession-erosion40_flood_class.tif", grid)}
    refs = {}
    for date in ("2026-08-29", "2026-09-13", "2026-10-18"):
        print(date)
        refs[date] = build_reference(date, grid, token, a.work_dir / f"s2_{date}.npz")
    px_km2 = 0.0064
    out = {"reference": "Sentinel-2 L2A NDWI, orbit R076, zone 45 tiles, 80 m lattice",
           "primary_ndwi_threshold": PRIMARY,
           "support_km2": round(float(support.sum()) * px_km2, 2),
           "caution": "Agreement with optical labels, not ground truth.", "tests": {}}

    def add(name, date_text, gap, maps_used, classes, ndwi, mask):
        out["tests"][name] = {"dates": date_text, "time_gap": gap, "scored_pixels": int(mask.sum()),
                              "scored_km2": round(int(mask.sum()) * px_km2, 2),
                              "reference_water_km2_at_primary": round(int((ndwi >= PRIMARY)[mask].sum()) * px_km2, 2),
                              "results": score(maps_used, classes, ndwi, mask)}

    n13, c13, t13 = refs["2026-09-13"]
    n29, c29, t29 = refs["2026-08-29"]
    n18, c18, t18 = refs["2026-10-18"]
    add("water_12sep", "NISAR 12 Sep vs Sentinel-2 13 Sep", "about 5 hours", maps, WATER_NOW, n13, support & c13)
    add("water_31aug", "NISAR 31 Aug vs Sentinel-2 29 Aug", "about 2.8 days", maps, WATER_BEFORE, n29, support & c29)
    add("water_18oct", "NISAR 18 Oct vs Sentinel-2 18 Oct", "about 19 hours", oct18, WATER_NOW, n18, support & c18)
    both = support & c29 & c13
    change = {}
    for t in THRESHOLDS:
        ref_gain = (n29 < t) & (n13 >= t)
        change[f"ndwi_{t}"] = {name: metrics(np.isin(m, GAIN)[both], ref_gain[both]) for name, m in maps.items()}
    out["tests"]["gain_31aug_to_12sep"] = {
        "dates": "NISAR gain vs Sentinel-2 change 29 Aug to 13 Sep", "scored_pixels": int(both.sum()),
        "scored_km2": round(int(both.sum()) * px_km2, 2), "results": change}
    out["tiles"] = {"2026-08-29": t29, "2026-09-13": t13, "2026-10-18": t18}
    a.output.parent.mkdir(parents=True, exist_ok=True)
    a.output.write_text(json.dumps(out, indent=2) + "\n")
    print(f"Wrote {a.output}")


if __name__ == "__main__":
    main()
