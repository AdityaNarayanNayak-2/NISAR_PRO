#!/usr/bin/env python3
"""Check the NISAR Pro InGARSS 2026 package and print every reported result.

Run from anywhere:   python3 run_bihar_analysis.py
Needs only Python 3 (standard library). No granules, no internet.

What it does, in order:
  1. Checks every packaged file against its SHA-256 hash in provenance_manifest.json.
  2. Prints the results for Tasks A-H of the problem statement, reading every number
     from the JSON files in results/. Nothing is typed in by hand.
  3. Checks that class areas add up, and prints the answer to the research question,
     computed from the Sentinel-2 scores.

Exit code: 0 all checks passed | 2 missing input | 3 a check failed | 4 engine run failed.

Optional: --run-engine --engine-args "<args>" runs bin/sar_science_processor and
appends its run time to benchmarks.json.
"""

import argparse
import hashlib
import json
import shlex
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent
KM2_PER_ACRE = 0.004046856

# Problem-statement facts (inputs, not results)
REFERENCE_BOX = {"west": 86.3946, "south": 25.4098, "east": 86.6054, "north": 25.5902}
DATES = [("2026-07-26", "L"), ("2026-08-31", "L + S"), ("2026-09-12", "L + S"), ("2026-10-18", "L")]

FILES = {
    "fused": "results/LS_fused_aug31_sep12/sar-bihar-ls-fused-aug31-sep12_flood.json",
    "diag": "results/LS_fused_aug31_sep12/fusion_diagnostics.json",
    "l": "results/L_aug31_sep12/sar-bihar-aug31-sep12-full_flood.json",
    "s": "results/S_aug31_sep12/sar-bihar-sband-aug31-sep12-full_flood.json",
    "jul": "results/L_jul26_aug31/sar-bihar-jul26-aug31-progression_flood.json",
    "oct": "results/L_sep12_oct18/sar-bihar-sep12-oct18-recession-erosion40_flood.json",
    "oct_edge3": "results/supplementary/L_sep12_oct18_edge3px/sar-bihar-sep12-oct18-recession_flood.json",
    "validation": "results/validation/sentinel2_validation.json",
    "sand": "results/validation/sand_rule_check.json",
    "pol": "results/validation/polarization_feature_scores.json",
}
METHODS = (("l_only", "L-band"), ("s_only", "S-band"), ("fused", "L+S"))


def area(km2):
    """Format an area in km2 and acres."""
    return f"{km2:,.2f} km2 ({km2 / KM2_PER_ACRE:,.0f} acres)"


def heading(text):
    print(f"\n{text}\n{'-' * len(text)}")


def load(name):
    path = ROOT / FILES[name]
    if not path.is_file():
        print(f"ERROR: missing {FILES[name]}", file=sys.stderr)
        sys.exit(2)
    return json.loads(path.read_text(encoding="utf-8"))


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for block in iter(lambda: f.read(1 << 20), b""):
            h.update(block)
    return h.hexdigest()


def check_integrity():
    manifest = json.loads((ROOT / "provenance_manifest.json").read_text(encoding="utf-8"))
    bad, ok = [], 0
    for entry in manifest["files"]:
        rel = entry["path"].split("ingarss_2026/", 1)[-1]
        path = ROOT / rel
        if not path.is_file():
            bad.append(f"missing  {rel}")
        elif sha256(path) != entry["sha256"]:
            bad.append(f"changed  {rel}")
        else:
            ok += 1
    print(f"{ok} of {len(manifest['files'])} files match their SHA-256 hash.")
    for line in bad:
        print(f"  {line}")
    return not bad


def run_engine(engine_args):
    engine = ROOT / "bin" / "sar_science_processor"
    cmd = [str(engine)] + shlex.split(engine_args)
    print("Running:", " ".join(shlex.quote(c) for c in cmd))
    t0 = time.perf_counter()
    res = subprocess.run(cmd, capture_output=True, text=True, check=False)  # exit code handled below
    secs = round(time.perf_counter() - t0, 3)
    bench_path = ROOT / "benchmarks.json"
    bench = json.loads(bench_path.read_text(encoding="utf-8")) if bench_path.exists() else {"runs": []}
    label = " ".join(Path(t).name if "/" in t else t for t in cmd[1:])  # file names only, no local folders
    bench["runs"].append({"label": label, "seconds": secs, "returncode": res.returncode})
    bench_path.write_text(json.dumps(bench, indent=2) + "\n", encoding="utf-8")
    print(f"exit {res.returncode}, {secs} s")
    if res.returncode != 0:
        print(res.stderr[-1000:], file=sys.stderr)
        sys.exit(4)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--run-engine", action="store_true")
    ap.add_argument("--engine-args", default="--help")
    args = ap.parse_args()
    if args.run_engine:
        run_engine(args.engine_args)

    print("NISAR Pro | InGARSS 2026 YP Hackathon Phase 1 | Bihar, track 98, frame 14")
    print("All areas: pixel count x 0.0064 km2 (80 m pixels). 1 acre = 0.004046856 km2.")

    heading("Step 1. File integrity")
    integrity_ok = check_integrity()

    d = {name: load(name) for name in FILES}
    full = d["fused"]["full_scene_comparison"]
    diag = d["diag"]
    val = d["validation"]["tests"]

    heading("Task A. Data review")
    b = REFERENCE_BOX
    print(f"Reference box (scene search only): W {b['west']}, S {b['south']}, E {b['east']}, N {b['north']}.")
    print(f"Analysed footprint (L and S common support, not clipped to the box): {area(full['ls_fused']['total_valid_km2'])}")
    print("Dates: " + ", ".join(f"{date} ({band})" for date, band in DATES))
    print("Granules, modes and catalogue search: README.md. AOI map: maps/fig0_aoi_and_footprint.png")

    heading("Tasks B and C. Water masks: L-band, S-band and L+S (31 Aug -> 12 Sep)")
    print(f"{'':10}{'water 31 Aug':>18}{'water 12 Sep':>18}")
    for key, label in METHODS:
        w = diag["water_area_per_date"][key]
        print(f"{label:10}{w['water_date1']['km2']:>14,.2f} km2{w['water_date2']['km2']:>14,.2f} km2")
    print("Fusion rules: TECHNICAL_NOTE section V. Code: scripts/run_ls_fusion_and_pol_assessment.py")

    heading("Task D. Change classes on the common footprint (31 Aug -> 12 Sep)")
    print(f"{'':10}{'stable water':>16}{'new water':>14}{'water loss':>14}{'stable land':>15}")
    sums_ok = True
    for key, label in (("l_band_only", "L-band"), ("s_band_only", "S-band"), ("ls_fused", "L+S")):
        c = full[key]
        print(f"{label:10}{c['stable_water_km2']:>12,.2f} km2{c['total_flood_km2']:>10,.2f} km2"
              f"{c['receded_water_km2']:>10,.2f} km2{c['stable_non_water_km2']:>11,.2f} km2")
        total = c["stable_water_km2"] + c["total_flood_km2"] + c["receded_water_km2"] + c["stable_non_water_km2"]
        gain = c["new_inundation_high_km2"] + c["new_inundation_med_km2"]
        sums_ok &= abs(total - c["total_valid_km2"]) <= 0.05 and abs(gain - c["total_flood_km2"]) <= 0.05
    f = full["ls_fused"]
    print(f"L+S new water: high confidence {area(f['new_inundation_high_km2'])}, "
          f"medium {area(f['new_inundation_med_km2'])}")
    print(f"Class areas add up to the footprint for all three methods: {'yes' if sums_ok else 'NO'}")

    heading("Task E. New water and the season (L-band, 40-pixel edge cut)")
    outside = diag["gain_outside_water_present_26jul_and_31aug"]["fused"]["km2"]
    print(f"L+S new water outside water seen on 26 Jul and 31 Aug: {area(outside)}")
    print("  (potential temporary surface inundation; no cause is claimed)")
    for name, label in (("jul", "26 Jul -> 31 Aug"), ("oct", "12 Sep -> 18 Oct")):
        a = d[name]["areas"]
        print(f"{label}: gained {area(a['total_flood_km2'])}, lost {area(a['receded_water_km2'])}")
    a = d["oct_edge3"]["areas"]
    print(f"Supplementary, 12 Sep -> 18 Oct with a 3-pixel edge cut: lost {area(a['receded_water_km2'])}")

    heading("Task F. Agreement with Sentinel-2 (NDWI >= 0, cloud-free pixels only)")
    print("This is agreement with optical water labels, not ground truth.")
    wins = {"vs L-band": [], "vs S-band": []}
    for test in val.values():
        res = test["results"]["ndwi_0.0"]
        gap = f", {test['time_gap']}" if "time_gap" in test else ""
        print(f"{test['dates']}{gap}, scored {area(test['scored_km2'])}")
        for key, label in METHODS:
            if key in res:
                m = res[key]
                print(f"  {label:7} precision {m['precision']:.3f}  recall {m['recall']:.3f}  "
                      f"F1 {m['f1']:.3f}  IoU {m['iou']:.3f}  overall accuracy {m['overall_accuracy']:.3f}")
        if "fused" in res:
            wins["vs L-band"].append(res["fused"]["f1"] - res["l_only"]["f1"])
            wins["vs S-band"].append(res["fused"]["f1"] - res["s_only"]["f1"])
    overlap = diag["l_s_gain_agreement"]
    print(f"L and S new water overlap: {area(overlap['both']['km2'])}, Jaccard {overlap['jaccard']:.2f}")
    sand = d["sand"]["12Sep_vs_S2_13Sep"]
    print(f"Sandbar rule check, 12 Sep: {sand['sand_rule_L_dark_S_bright']['ndwi_water_pct']}% of "
          f"L-dark/S-bright pixels were water, against {sand['control_both_dark']['ndwi_water_pct']}% "
          f"where both bands were dark.")

    heading("Task G. Reproducibility")
    print("Engine: bin/sar_science_processor (Linux x86_64). Commands for every run: README.md.")
    bench = json.loads((ROOT / "benchmarks.json").read_text(encoding="utf-8"))
    for run in bench.get("runs", []):
        band = "S-band" if "--radar-band s" in run["label"] else "L-band"
        print(f"Measured engine run, {band} pair: {run['seconds']:.1f} s, exit code {run['returncode']}")

    heading("Task H. Polarization (12 Sep)")
    pol = d["fused"]["task_h_polarization_assessment"]
    for mode, terms in pol["gcov_covariance_terms_inventory"].items():
        print(f"{mode}: {', '.join(terms)}")
    print("L-band feature sets, each with its own threshold:")
    for name, feat in pol["feature_sets_water_detection"].items():
        print(f"  {feat['rule']:<32} detected water {area(feat['detected_water_km2'])}")
    for name, s in diag["channel_separability_12_sep"].items():
        if isinstance(s, dict):
            print(f"  separability, stable water vs land, {name}: {s['separability']:.3f}")
    ps = d["pol"]
    print(f"Same feature sets scored against Sentinel-2 13 Sep ({area(ps['scored_km2'])}):")
    for r in ps["results"].values():
        print(f"  {r['rule']:<32} precision {r['precision']:.3f}  recall {r['recall']:.3f}  F1 {r['f1']:.3f}")
    print("Details and the full-pol / compact-pol search: POLARIZATION_ASSESSMENT.md")

    heading("Answer to the research question (computed from the Sentinel-2 scores above)")
    n = len(wins["vs L-band"])
    for label, diffs in wins.items():
        better = sum(x > 0.0005 for x in diffs)
        worse = sum(x < -0.0005 for x in diffs)
        print(f"L+S {label}: higher F1 in {better} of {n} tests, lower in {worse}, "
              f"equal in {n - better - worse}")

    heading("Result")
    ok = integrity_ok and sums_ok
    print("ALL CHECKS PASSED" if ok else "A CHECK FAILED (see above)")
    sys.exit(0 if ok else 3)


if __name__ == "__main__":
    main()
