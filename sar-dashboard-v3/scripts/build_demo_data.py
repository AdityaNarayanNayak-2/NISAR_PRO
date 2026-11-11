"""Build the read-only demo data for the public website from real gateway runs.

    python3 sar-dashboard-v3/scripts/build_demo_data.py [--gateway http://localhost:3000]

Reads the runs listed by a running gateway, copies each run's report, overlay,
radar previews and regions into sar-dashboard-v3/public/demo/runs/<id>/ and writes
public/demo/runs.json in the same shape as GET /jobs. Nothing is recomputed:
numbers come from the processor reports as they are.

Size: radar previews -> lossy WebP with alpha; class overlay -> lossless WebP
(exact class colours kept); region coordinates rounded to 5 decimals (~1 m).
The GeoTIFF is not copied (download it from the app or the InGARSS package).
"""
import argparse
import json
import shutil
import urllib.request
from io import BytesIO
from pathlib import Path

from PIL import Image

OUT = Path(__file__).resolve().parents[1] / "public" / "demo"


def get(base, path):
    with urllib.request.urlopen(base + path) as r:
        return r.read()


def round_coords(x):
    if isinstance(x, float):
        return round(x, 5)
    if isinstance(x, list):
        return [round_coords(v) for v in x]
    return x


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--gateway", default="http://localhost:3000")
    args = ap.parse_args()
    runs = json.loads(get(args.gateway, "/jobs"))
    # Only the study runs: full scene, default thresholds and polarization (no overrides in the request).
    overrides = ("seed_threshold_db", "growth_threshold_db", "min_change_db", "permanent_water_thresh_db", "min_area_pixels", "polarization", "gunw_file", "water_mask")
    runs = [r for r in runs if r.get("status") == "completed" and r.get("summary")
            and r["summary"].get("crop_preset") == "full"
            and not any((r.get("request") or {}).get(k) is not None for k in overrides)]
    if OUT.exists():
        shutil.rmtree(OUT)
    out_runs = []
    for r in runs:
        s = r["summary"]
        rid = f"bihar-{s['band'].lower()}-{s['baseline_date']}-{s['active_date']}"
        d = OUT / "runs" / rid
        d.mkdir(parents=True)
        a = r["artifacts"]
        url = lambda name: f"/demo/runs/{rid}/{name}"
        places = {}
        art = {"report": None, "overlay": None, "active_preview": None, "baseline_preview": None, "geojson": None, "class_tif": None}

        report = json.loads(get(args.gateway, a["report"]))
        (d / "report.json").write_text(json.dumps(report, indent=1))
        art["report"] = url("report.json")

        if a.get("overlay"):
            Image.open(BytesIO(get(args.gateway, a["overlay"]))).save(d / "classes.webp", lossless=True, method=6)
            art["overlay"] = url("classes.webp")
        for key, name in (("active_preview", "active.webp"), ("baseline_preview", "baseline.webp")):
            if a.get(key):
                Image.open(BytesIO(get(args.gateway, a[key]))).save(d / name, quality=78, method=6)
                art[key] = url(name)
        if a.get("geojson"):
            gj = json.loads(get(args.gateway, a["geojson"]))
            for f in gj.get("features", []):
                f["geometry"]["coordinates"] = round_coords(f["geometry"]["coordinates"])
            (d / "regions.geojson").write_text(json.dumps(gj, separators=(",", ":")))
            art["geojson"] = url("regions.geojson")
            # Place names for the ten largest areas (the website has no gateway to ask).
            # Same source and key as the dashboard: OpenStreetMap via /geocode/reverse, "lat,lon" to 3 decimals.
            top = sorted(gj.get("features", []), key=lambda f: -float(f["properties"].get("area_acres") or 0))[:10]
            for f in top:
                lat, lon = f["properties"]["centroid_lat"], f["properties"]["centroid_lon"]
                try:
                    places[f"{lat:.3f},{lon:.3f}"] = json.loads(get(args.gateway, f"/geocode/reverse?lat={lat}&lon={lon}"))
                except Exception as e:  # keep going; the dashboard shows coordinates instead
                    print(f"  no place for {lat},{lon}: {e}")

        out_runs.append({
            "id": rid, "status": "completed", "created_at": r["created_at"], "bbox": r["bbox"],
            "summary": s, "artifacts": art, "fingerprint": r.get("fingerprint"), "places": places,
        })
        size = sum(p.stat().st_size for p in d.iterdir()) / 2**20
        print(f"{rid}: {size:.1f} MB")

    (OUT / "runs.json").write_text(json.dumps(out_runs, indent=1))
    total = sum(p.stat().st_size for p in OUT.rglob("*") if p.is_file()) / 2**20
    print(f"{len(out_runs)} runs, {total:.1f} MB in {OUT}")


if __name__ == "__main__":
    main()
