#!/usr/bin/env python3
"""Score the three L-band polarization feature sets against Sentinel-2 (12 Sep 2026).

Feature sets, with the thresholds already used in the fusion script (not tuned here):
  co-pol baseline     HH < -14.0 dB
  co-pol + cross-pol  HH < -13.0 dB and HV < -21.5 dB
  span                HHHH + 2 * HVHV < -13.5 dB
Reference: Sentinel-2 13 Sep NDWI >= 0 on cloud-free pixels inside the common footprint,
built by validate_sentinel2.py (same cache format).

Example: python3 scripts/score_polarization_features.py --data-dir <granules> \\
         --results results --work-dir /tmp/s2cache --output results/validation/polarization_feature_scores.json
"""
import argparse
import importlib.util
import json
import sys
from pathlib import Path

import numpy as np
import rasterio
import requests

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import validate_sentinel2 as v  # noqa: E402

spec = importlib.util.spec_from_file_location("fusion", HERE / "run_ls_fusion_and_pol_assessment.py")
fusion = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fusion)

L_12SEP = "NISAR_L2_PR_GCOV_030_098_A_014_4005_DHDH_A_20260912T233810_20260912T233845_P05023_N_F_J_001.h5"


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--data-dir", required=True, type=Path)
    p.add_argument("--results", required=True, type=Path)
    p.add_argument("--work-dir", required=True, type=Path)
    p.add_argument("--output", required=True, type=Path)
    a = p.parse_args()
    a.work_dir.mkdir(parents=True, exist_ok=True)

    with rasterio.open(a.results / "LS_fused_aug31_sep12/valid_support.tif") as s:
        support = s.read(1).astype(bool)
        grid = {"shape": s.shape, "transform": s.transform, "crs": s.crs, "bounds": tuple(s.bounds)}

    # L-band 12 Sep on the common 80 m grid (same offsets as the fusion script)
    rad = fusion.stream_multilook_terms(str(a.data_dir / L_12SEP), "LSAR", ["HHHH", "HVHV"],
                                        fusion.L_ROW_OFFSET * 8, 33120, fusion.L_COL_OFFSET * 8, 34200)
    hh, hv = rad["HHHH"], rad["HVHV"]
    db = lambda x: 10 * np.log10(np.maximum(x, 1e-6))
    sets = {
        "copol_baseline": ("HH < -14.0 dB", db(hh) < -14.0),
        "copol_and_crosspol": ("HH < -13.0 dB and HV < -21.5 dB", (db(hh) < -13.0) & (db(hv) < -21.5)),
        "span": ("HHHH + 2 * HVHV < -13.5 dB", db(hh + 2 * hv) < -13.5),
    }

    token = requests.get(v.TOKEN, timeout=60).json()["token"]
    ndwi, clear, _ = v.build_reference("2026-09-13", grid, token, a.work_dir / "s2_2026-09-13.npz")
    mask = support & clear & (hh > 1e-4) & (hv > 1e-4) & np.isfinite(ndwi)
    ref = ndwi >= v.PRIMARY
    out = {"reference": "Sentinel-2 13 Sep 2026, NDWI >= 0, cloud-free pixels in the common footprint",
           "nisar_date": "2026-09-12", "band": "L",
           "scored_km2": round(int(mask.sum()) * 0.0064, 2),
           "note": "Thresholds come from the fusion script and were not tuned against this reference.",
           "results": {k: {"rule": rule, **v.metrics(m[mask], ref[mask])} for k, (rule, m) in sets.items()}}
    a.output.write_text(json.dumps(out, indent=1) + "\n")
    for k, r in out["results"].items():
        print(f"{r['rule']:<34} precision {r['precision']}  recall {r['recall']}  F1 {r['f1']}")


if __name__ == "__main__":
    main()
