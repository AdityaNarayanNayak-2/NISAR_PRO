#!/usr/bin/env python3
"""Check what Sentinel-2 sees where the sandbar rule fires.

Rule pixels: L HH < -13 dB and S HH >= -10.5 dB on the NISAR date.
Control:     L HH < -13 dB and S HH <  -10.5 dB (both bands dark).
Control:     L HH >= -13 dB (L not dark).
Primary label: NDWI >= 0 is water. Secondary: Sentinel-2 SCL class shares.
Only cloud-free pixels inside the common L/S support are counted.

Example: python3 scripts/check_sand_rule.py --data-dir <granules> --results results \\
         --work-dir /tmp/s2cache --output results/validation/sand_rule_check.json
"""
import argparse, sys, json, importlib.util
from pathlib import Path
import numpy as np, rasterio, requests
from rasterio.enums import Resampling
from rasterio.warp import reproject, transform_bounds
S = Path(__file__).resolve().parent
sys.path.insert(0, str(S))
import validate_sentinel2 as v
spec = importlib.util.spec_from_file_location('fz', S/'run_ls_fusion_and_pol_assessment.py'); fz = importlib.util.module_from_spec(spec); spec.loader.exec_module(fz)
ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
ap.add_argument("--data-dir", required=True, type=Path, help="Folder holding the four 31 Aug and 12 Sep granules")
ap.add_argument("--results", required=True, type=Path, help="The package results/ folder")
ap.add_argument("--work-dir", required=True, type=Path, help="Folder for caches")
ap.add_argument("--output", required=True, type=Path)
args = ap.parse_args()
D, R, W = args.data_dir, args.results, args.work_dir
W.mkdir(parents=True, exist_ok=True)
with rasterio.open(R/'LS_fused_aug31_sep12/valid_support.tif') as s:
    support = s.read(1).astype(bool); grid = {"shape": s.shape, "transform": s.transform, "crs": s.crs, "bounds": tuple(s.bounds)}
rc, cc = 33120, 34200; ro, co = 36*8, 9*8
def stream(pat, instr, r0, c0):
    f = next(D.glob(pat)); print(f.name, flush=True)
    return fz.stream_multilook_terms(str(f), instr, ['HHHH'], r0, rc, c0, cc)['HHHH']
cache = W/'hh.npz'
if cache.exists():
    z = np.load(cache); hh = {k: z[k] for k in z.files}
else:
    hh = {'l12': stream('NISAR_L2_*20260912T*.h5','LSAR',ro,co), 's12': stream('NISAR_S2_*20260912T*.h5','SSAR',0,0),
          'l31': stream('NISAR_L2_*20260831T*.h5','LSAR',ro,co), 's31': stream('NISAR_S2_*20260831T*.h5','SSAR',0,0)}
    np.savez_compressed(cache, **hh)
print({k: a.shape for k, a in hh.items()}, support.shape, flush=True)
token = requests.get(v.TOKEN, timeout=60).json()["token"]
def scl_mosaic(date):
    bbox = transform_bounds(grid["crs"], "EPSG:4326", *grid["bounds"])
    r = requests.post(v.STAC, json={"collections":["sentinel-2-l2a"],"bbox":list(bbox),"limit":100,"datetime":f"{date}T00:00:00Z/{date}T23:59:59Z"}, timeout=120); r.raise_for_status()
    items = sorted([i for i in r.json()["features"] if "_R076_T45" in i["id"]], key=lambda i: i["properties"]["eo:cloud_cover"])
    out = np.zeros(grid["shape"], np.uint8)
    for it in items:
        with rasterio.open(it["assets"]["SCL"]["href"]+"?"+token) as src:
            d = np.zeros(grid["shape"], np.uint8)
            reproject(src.read(1), d, src_transform=src.transform, src_crs=src.crs, dst_transform=grid["transform"], dst_crs=grid["crs"], resampling=Resampling.nearest)
        new = (out == 0) & (d != 0); out[new] = d[new]
    return out
res = {}
for name, date, lk, sk in (("12Sep_vs_S2_13Sep","2026-09-13",'l12','s12'),("31Aug_vs_S2_29Aug","2026-08-29",'l31','s31')):
    ndwi, clear, _ = v.build_reference(date, grid, token, W/f"s2_{date}.npz")
    scl = scl_mosaic(date)
    l = 10*np.log10(np.maximum(hh[lk],1e-6)); s_ = 10*np.log10(np.maximum(hh[sk],1e-6))
    ok = support & clear & (hh[lk] > 1e-4) & (hh[sk] > 1e-4) & np.isfinite(ndwi)
    groups = {"sand_rule_L_dark_S_bright": ok&(l<-13)&(s_>=-10.5), "control_both_dark": ok&(l<-13)&(s_<-10.5), "control_L_not_dark": ok&(l>=-13)}
    res[name] = {}
    for g, m in groups.items():
        n = int(m.sum()); x = ndwi[m]; c = scl[m]
        res[name][g] = {"px": n, "km2": round(n*0.0064,2), "acres": round(n*0.0064/0.004046856),
            "ndwi_water_pct": round(100*float((x>=0).mean()),1) if n else None,
            "ndwi_median": round(float(np.median(x)),3) if n else None,
            "scl_vegetation_pct": round(100*float((c==4).mean()),1) if n else None,
            "scl_bare_pct": round(100*float((c==5).mean()),1) if n else None,
            "scl_water_pct": round(100*float((c==6).mean()),1) if n else None}
    print(name, json.dumps(res[name], indent=1), flush=True)
args.output.write_text(json.dumps(res, indent=1) + "\n")
