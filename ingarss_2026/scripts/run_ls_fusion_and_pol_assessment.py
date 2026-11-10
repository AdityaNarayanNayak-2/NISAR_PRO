#!/usr/bin/env python3
"""L+S fusion, polarization assessment and fusion diagnostics (31 Aug -> 12 Sep 2026).

Inputs: the L-band and S-band class GeoTIFFs written by sar_science_processor,
plus the four GCOV granules. Outputs, all inside --out-dir:
  sar-bihar-ls-fused-aug31-sep12_flood.json   areas and Task H results
  sar-bihar-ls-fused-aug31-sep12_class.tif    fused class raster (EPSG:32645, 80 m)
  fusion_diagnostics.json                     gate on/off, sources, sensitivity
  valid_support.tif                           footprint used for validation scoring

Class codes: 0 stable non-water, 1 stable water, 2 gain (high), 3 gain (medium),
5 water loss. Gate names describe the rule's intent. They are not verified land
cover: no independent reference confirms a sandbar, wind or vegetation cause.
"""

import argparse
import json
import os
import time

import h5py
import numpy as np
import rasterio

# Set from the command line in main().
CACHE_FILE = L_CLASS_TIF = S_CLASS_TIF = OUT_JSON = OUT_TIF = OUT_DIAG = OUT_SUPPORT = None
F_L_BASE = F_L_ACT = F_S_BASE = F_S_ACT = JUL_CLASS_TIF = None

L_BASE_NAME = "NISAR_L2_PR_GCOV_029_098_A_014_4005_DHDH_A_20260831T233810_20260831T233845_P05023_N_F_J_001.h5"
L_ACT_NAME = "NISAR_L2_PR_GCOV_030_098_A_014_4005_DHDH_A_20260912T233810_20260912T233845_P05023_N_F_J_001.h5"
S_BASE_NAME = "NISAR_S2_UR_GCOV_029_098_A_014_3700_DHNA_A_20260831T233810_20260831T233846_P00500_M_F_I_001.h5"
S_ACT_NAME = "NISAR_S2_UR_GCOV_030_098_A_014_3700_DHNA_A_20260912T233809_20260912T233846_P00500_N_F_I_001.h5"

# Overlap geometry
OVERLAP_ROWS = 4140
OVERLAP_COLS = 4275
L_ROW_OFFSET = 36
L_COL_OFFSET = 9
PIXEL_KM2 = 0.0064
PIXEL_ACRES = 1.58147

# Official InGARSS 20x20km Reference Discovery Box
# 86.3946E, 25.4098N to 86.6054E, 25.5902N
REF_BOX_R0 = 917
REF_BOX_R1 = 1166
REF_BOX_C0 = 2419
REF_BOX_C1 = 2685


def stream_multilook_terms(file_path, instr, term_list, row_start, row_count, col_start, col_count, chunk_rows=2048, look_factor=8):
    """Memory-safe row-chunk block-multilooking from raw GCOV HDF5 datasets."""
    out_rows = row_count // look_factor
    out_cols = col_count // look_factor
    min_valid = (look_factor * look_factor + 1) // 2
    results = {term: np.zeros((out_rows, out_cols), dtype=np.float32) for term in term_list}

    print(f"  [STREAM] {os.path.basename(file_path)} ({instr})")
    with h5py.File(file_path, 'r') as h:
        ds_map = {term: h[f'science/{instr}/GCOV/grids/frequencyA/{term}'] for term in term_list}
        for r in range(0, row_count, chunk_rows):
            r_len = min(chunk_rows, row_count - r)
            r_blocks = r_len // look_factor
            if r_blocks == 0:
                break
            out_r_start = r // look_factor
            for term, ds in ds_map.items():
                raw = ds[row_start + r : row_start + r + r_blocks * look_factor, col_start : col_start + out_cols * look_factor]
                if np.iscomplexobj(raw):
                    raw = np.abs(raw)
                reshaped = raw.reshape(r_blocks, look_factor, out_cols, look_factor)
                valid = np.isfinite(reshaped) & (reshaped >= 1e-4)
                v_count = np.sum(valid, axis=(1, 3))
                sum_val = np.sum(np.where(valid, reshaped, 0.0), axis=(1, 3))
                out_chunk = np.where(v_count >= min_valid, sum_val / np.maximum(v_count, 1), 0.0).astype(np.float32)
                results[term][out_r_start : out_r_start + r_blocks, :] = out_chunk
    return results


def load_or_generate_radiometry():
    """Loads cached 80m radiometry arrays or streams them from HDF5."""
    if os.path.exists(CACHE_FILE):
        print(f"[*] Loading cached 80m radiometry from: {CACHE_FILE}")
        cache = np.load(CACHE_FILE)
        return {k: cache[k] for k in cache.files}
    
    print("[*] Cache not found. Streaming 80m calibrated radiometry from NISAR GCOV HDF5...")
    row_count = 33120
    col_count = 34200
    l_base = stream_multilook_terms(F_L_BASE, 'LSAR', ['HHHH', 'HVHV'], L_ROW_OFFSET * 8, row_count, L_COL_OFFSET * 8, col_count)
    l_act  = stream_multilook_terms(F_L_ACT,  'LSAR', ['HHHH', 'HVHV'], L_ROW_OFFSET * 8, row_count, L_COL_OFFSET * 8, col_count)
    s_base = stream_multilook_terms(F_S_BASE, 'SSAR', ['HHHH', 'HVHV'], 0, row_count, 0, col_count)
    s_act  = stream_multilook_terms(F_S_ACT,  'SSAR', ['HHHH', 'HVHV', 'HHHV'], 0, row_count, 0, col_count)

    rad = {
        'l_hh_base': l_base['HHHH'],
        'l_hv_base': l_base['HVHV'],
        'l_hh_act':  l_act['HHHH'],
        'l_hv_act':  l_act['HVHV'],
        's_hh_base': s_base['HHHH'],
        's_hv_base': s_base['HVHV'],
        's_hh_act':  s_act['HHHH'],
        's_hv_act':  s_act['HVHV'],
        's_hhhv_act': s_act['HHHV'],
    }
    np.savez_compressed(CACHE_FILE, **rad)
    print(f"[*] Saved compressed radiometry cache ({os.path.getsize(CACHE_FILE)/(1024**2):.1f} MB)")
    return rad


def main():
    print("=" * 80)
    print("  NISAR L+S DUAL-FREQUENCY FUSION & POLARIZATION ASSESSMENT")
    print("  Track 098, Frame 014 (Ascending) · Bihar Ganga Plain Floodplain")
    print("  Baseline: 31 Aug 2026 | Active: 12 Sep 2026 · Common 80m Lattice")
    print("=" * 80)

    t0 = time.time()

    # 1. Load Radiometry
    rad = load_or_generate_radiometry()
    l_hh_base = rad['l_hh_base']
    l_hv_base = rad['l_hv_base']
    l_hh_act  = rad['l_hh_act']
    l_hv_act  = rad['l_hv_act']
    s_hh_base = rad['s_hh_base']
    s_hh_act  = rad['s_hh_act']
    s_hv_act  = rad['s_hv_act']

    # 2. Load Single-Frequency Classifications
    print("[*] Reading single-frequency 80m classification GeoTIFFs...")
    with rasterio.open(L_CLASS_TIF) as src_l:
        l_class_raw = src_l.read(1)
        l_class = l_class_raw[L_ROW_OFFSET : L_ROW_OFFSET + OVERLAP_ROWS, L_COL_OFFSET : L_COL_OFFSET + OVERLAP_COLS]
        l_profile = src_l.profile.copy()

    with rasterio.open(S_CLASS_TIF) as src_s:
        s_class = src_s.read(1)
        s_profile = src_s.profile.copy()

    # 3. Establish Swath Validity & 40-Pixel Swath-Edge Erosion
    print("[*] Computing joint valid mask and applying 40-pixel swath-edge erosion...")
    valid_joint = (l_hh_base > 1e-4) & (l_hh_act > 1e-4) & (s_hh_base > 1e-4) & (s_hh_act > 1e-4)
    valid_joint[:, :40] = False
    valid_joint[:, -40:] = False
    valid_joint[:40, :] = False
    valid_joint[-40:, :] = False

    # Log decibel backscatter conversions
    l_hh_base_db = 10.0 * np.log10(np.maximum(l_hh_base, 1e-6))
    l_hv_base_db = 10.0 * np.log10(np.maximum(l_hv_base, 1e-6))
    l_hh_act_db  = 10.0 * np.log10(np.maximum(l_hh_act, 1e-6))
    l_hv_act_db  = 10.0 * np.log10(np.maximum(l_hv_act, 1e-6))
    delta_l_hh   = l_hh_act_db - l_hh_base_db

    s_hh_base_db = 10.0 * np.log10(np.maximum(s_hh_base, 1e-6))
    s_hh_act_db  = 10.0 * np.log10(np.maximum(s_hh_act, 1e-6))
    s_hv_act_db  = 10.0 * np.log10(np.maximum(s_hv_act, 1e-6))
    delta_s_hh   = s_hh_act_db - s_hh_base_db

    # 4. TASK C: RULE-BASED L+S FUSION
    print("[*] Applying the L+S fusion rules...")

    # A) Sandbar rule: L dark (HH < -13.0 dB) but S bright (HH >= -10.5 dB) on either date.
    # Intent: a surface can look smooth to the 24.2 cm L wave and rough to the 9.4 cm S wave.
    # A Sentinel-2 check (scripts/check_sand_rule.py) found these pixels mostly non-water,
    # but not all sand.
    is_sandbar_base = (l_hh_base_db < -13.0) & (s_hh_base_db >= -10.5)
    is_sandbar_act  = (l_hh_act_db < -13.0)  & (s_hh_act_db >= -10.5)
    sandbar_rejected = (is_sandbar_base | is_sandbar_act) & valid_joint

    # B) Class 1, stable water: both bands say stable water, or the wind rule (L HH < -15.5 dB
    # and L HV < -22.0 dB on both dates). The sandbar rule removes pixels from either source.
    both_stable = (l_class == 1) & (s_class == 1)
    wind_ganga_water = (l_hh_base_db < -15.5) & (l_hv_base_db < -22.0) & \
                       (l_hh_act_db < -15.5)  & (l_hv_act_db < -22.0)
    class_1 = (both_stable | wind_ganga_water) & (~sandbar_rejected) & valid_joint

    # C) Classes 2-3, new water: candidates are L gain, S gain, or the canopy rule (L HH drop
    # >= 3.26 dB, later L HV < -20 dB, later L HH < -12 dB). The canopy rule is not verified.
    # Every candidate must pass the S-band gate: later S HH < -10.5 dB.
    l_flood = (l_class == 2) | (l_class == 3)
    s_flood = (s_class == 2) | (s_class == 3)
    consensus_flood = l_flood | s_flood
    canopy_flood = (delta_l_hh <= -3.26) & (l_hv_act_db < -20.0) & (l_hh_act_db < -12.0)

    fused_flood_cand = (consensus_flood | canopy_flood) & (s_hh_act_db < -10.5) & (~class_1) & valid_joint
    # High confidence: both bands found gain, or L HH dropped by at least 5 dB.
    class_2 = fused_flood_cand & (((l_flood & s_flood) | (delta_l_hh <= -5.0)))
    # Medium confidence: every other candidate that passed the S-band gate.
    class_3 = fused_flood_cand & (~class_2)
    class_4 = np.zeros_like(class_2, dtype=bool)

    # D) Class 5, water loss: either band says loss and L HH rose by at least 3 dB.
    class_5 = ((l_class == 5) | (s_class == 5)) & (delta_l_hh >= +3.0) & \
              (~class_1) & (~fused_flood_cand) & valid_joint

    # Assemble Fused 5-Class Map
    fused_map = np.zeros((OVERLAP_ROWS, OVERLAP_COLS), dtype=np.uint8)
    fused_map[class_1] = 1
    fused_map[class_2] = 2
    fused_map[class_3] = 3
    fused_map[class_5] = 5

    # 5. TASK H: POLARIZATION FEATURE SETS, L-BAND, 12 SEP
    print("[*] Comparing L-band polarization feature sets on 12 Sep...")

    # Feature set A, co-pol baseline: HH < -14.0 dB
    copol_water = (l_hh_act_db < -14.0) & valid_joint

    # Feature set B, co-pol and cross-pol: HH < -13.0 dB and HV < -21.5 dB
    dualpol_water = (l_hh_act_db < -13.0) & (l_hv_act_db < -21.5) & valid_joint

    # Feature set C, span: HHHH + 2 * HVHV < -13.5 dB
    span_linear = l_hh_act + 2.0 * l_hv_act
    span_db = 10.0 * np.log10(np.maximum(span_linear, 1e-6))
    span_water = (span_db < -13.5) & valid_joint

    # Diagnostic: fused stable water where L HH >= -15.0 dB, and the part of it with L HV < -21.5 dB.
    stable_hh_ge15 = (class_1) & (l_hh_act_db >= -15.0) & valid_joint
    stable_hh_ge15_hv_lt215 = stable_hh_ge15 & (l_hv_act_db < -21.5)

    # 6. COMPUTE COMPREHENSIVE AREA STATISTICS (FULL SCENE & 20x20 KM REF BOX)
    print("[*] Computing Area Metrics (Full Scene vs 20x20 km Reference Box)...")

    def calc_stats(m_c1, m_c2, m_c3, m_c5, v_mask):
        c1_px = int(np.sum(m_c1 & v_mask))
        c2_px = int(np.sum(m_c2 & v_mask))
        c3_px = int(np.sum(m_c3 & v_mask))
        c5_px = int(np.sum(m_c5 & v_mask))
        flood_px = c2_px + c3_px
        c0_px = int(np.sum(v_mask)) - (c1_px + flood_px + c5_px)
        tot_px = int(np.sum(v_mask))

        return {
            "stable_water_px": c1_px,
            "stable_water_km2": round(c1_px * PIXEL_KM2, 2),
            "stable_water_acres": round(c1_px * PIXEL_ACRES, 1),
            "new_inundation_high_px": c2_px,
            "new_inundation_high_km2": round(c2_px * PIXEL_KM2, 2),
            "new_inundation_high_acres": round(c2_px * PIXEL_ACRES, 1),
            "new_inundation_med_px": c3_px,
            "new_inundation_med_km2": round(c3_px * PIXEL_KM2, 2),
            "new_inundation_med_acres": round(c3_px * PIXEL_ACRES, 1),
            "total_flood_px": flood_px,
            "total_flood_km2": round(flood_px * PIXEL_KM2, 2),
            "total_flood_acres": round(flood_px * PIXEL_ACRES, 1),
            "receded_water_px": c5_px,
            "receded_water_km2": round(c5_px * PIXEL_KM2, 2),
            "receded_water_acres": round(c5_px * PIXEL_ACRES, 1),
            "stable_non_water_px": c0_px,
            "stable_non_water_km2": round(c0_px * PIXEL_KM2, 2),
            "stable_non_water_acres": round(c0_px * PIXEL_ACRES, 1),
            "total_valid_km2": round(tot_px * PIXEL_KM2, 2),
        }

    # Full Scene overlap
    l_full_stats = calc_stats(l_class == 1, l_class == 2, l_class == 3, l_class == 5, valid_joint)
    s_full_stats = calc_stats(s_class == 1, s_class == 2, s_class == 3, s_class == 5, valid_joint)
    fused_full_stats = calc_stats(class_1, class_2, class_3, class_5, valid_joint)

    # Reference Box mask
    ref_mask = np.zeros_like(valid_joint, dtype=bool)
    ref_mask[REF_BOX_R0:REF_BOX_R1, REF_BOX_C0:REF_BOX_C1] = True
    ref_valid = valid_joint & ref_mask

    l_ref_stats = calc_stats(l_class == 1, l_class == 2, l_class == 3, l_class == 5, ref_valid)
    s_ref_stats = calc_stats(s_class == 1, s_class == 2, s_class == 3, s_class == 5, ref_valid)
    fused_ref_stats = calc_stats(class_1, class_2, class_3, class_5, ref_valid)

    # Rule diagnostics (pixel counts before later filters; not contributions to the fused map)
    sandbar_rej_px = int(np.sum(sandbar_rejected))
    l_sandbar_px   = int(np.sum(sandbar_rejected & ((l_class == 1) | (l_class == 2) | (l_class == 3))))
    hh_hv_px = int(np.sum(stable_hh_ge15_hv_lt215))
    canopy_outside_s_px = int(np.sum(canopy_flood & (~((s_class == 2) | (s_class == 3))) & valid_joint))

    # 7. SAVE OUTPUT JSON
    print(f"[*] Writing result JSON to: {OUT_JSON}")
    km2 = lambda px: round(px * PIXEL_KM2, 2)
    acres = lambda px: round(px * PIXEL_ACRES, 1)
    output_json_data = {
        "title": "NISAR L-band, S-band and L+S surface-water change, Bihar, 31 Aug to 12 Sep 2026",
        "note": "Class names: stable water, new water (high/medium), water loss. Rule names describe "
                "intent, not verified surface types. Area = pixels x 0.0064 km2.",
        "dates": {
            "baseline": "2026-08-31",
            "active": "2026-09-12",
            "interval_days": 12
        },
        "spatial_grid": {
            "crs": "EPSG:32645",
            "pixel_spacing_m": [80.0, -80.0],
            "pixel_area_km2": PIXEL_KM2,
            "pixel_area_acres": PIXEL_ACRES,
            "common_lattice_overlap_shape": [OVERLAP_ROWS, OVERLAP_COLS],
            "row_offset_l_to_s": L_ROW_OFFSET,
            "col_offset_l_to_s": L_COL_OFFSET,
            "swath_edge_erosion_pixels": 40
        },
        "full_scene_comparison": {
            "l_band_only": l_full_stats,
            "s_band_only": s_full_stats,
            "ls_fused": fused_full_stats,
            "rule_diagnostics": {
                "sandbar_test_pixels": {
                    "description": "L HH < -13 dB and S HH >= -10.5 dB on either date, anywhere in the support",
                    "pixels": sandbar_rej_px, "km2": km2(sandbar_rej_px), "acres": acres(sandbar_rej_px),
                    "of_which_l_band_water_or_gain_km2": km2(l_sandbar_px)
                },
                "stable_water_hh_ge_minus15_hv_lt_minus21_5": {
                    "description": "Fused stable water with L HH >= -15 dB and L HV < -21.5 dB on 12 Sep",
                    "pixels": hh_hv_px, "km2": km2(hh_hv_px), "acres": acres(hh_hv_px)
                },
                "canopy_rule_outside_s_gain": {
                    "description": "Pixels meeting the canopy rule outside S-band gain, before the S-band gate",
                    "pixels": canopy_outside_s_px, "km2": km2(canopy_outside_s_px), "acres": acres(canopy_outside_s_px)
                }
            }
        },
        "reference_discovery_box_20x20km": {
            "bounds_lonlat": [86.3946, 25.4098, 86.6054, 25.5902],
            "grid_row_indices": [REF_BOX_R0, REF_BOX_R1],
            "grid_col_indices": [REF_BOX_C0, REF_BOX_C1],
            "l_band_only": l_ref_stats,
            "s_band_only": s_ref_stats,
            "ls_fused": fused_ref_stats
        },
        "task_h_polarization_assessment": {
            "gcov_covariance_terms_inventory": {
                "LSAR_DHDH": ["HHHH", "HVHV"],
                "SSAR_DHNA": ["HHHH", "HVHV", "HHHV"]
            },
            "feature_sets_water_detection": {
                "copol_baseline_hhhh": {
                    "rule": "HH < -14.0 dB",
                    "detected_water_km2": km2(int(np.sum(copol_water)))
                },
                "copol_and_crosspol": {
                    "rule": "HH < -13.0 dB and HV < -21.5 dB",
                    "detected_water_km2": km2(int(np.sum(dualpol_water)))
                },
                "span_hh_plus_2hv": {
                    "rule": "HHHH + 2 * HVHV < -13.5 dB",
                    "detected_water_km2": km2(int(np.sum(span_water)))
                }
            },
            "note": "L-band, 12 Sep. Each set uses its own threshold, so areas show the effect of the feature choice, not accuracy."
        }
    }

    with open(OUT_JSON, "w") as f:
        json.dump(output_json_data, f, indent=2)

    # 8. SAVE FUSED GEOTIFF
    print(f"[*] Writing Fused 5-Class GeoTIFF to: {OUT_TIF}")
    s_profile.update({
        "driver": "GTiff",
        "dtype": "uint8",
        "count": 1,
        "compress": "deflate"
    })
    with rasterio.open(OUT_TIF, "w", **s_profile) as dst:
        dst.write(fused_map, 1)

    # Pixels both engines kept after 40-pixel swath-edge erosion. Outside this
    # footprint class 0 means "not analysed", so scoring must exclude it.
    support = valid_joint & ~grow(~valid_joint, 40)
    s_profile.update({"nodata": None})
    with rasterio.open(OUT_SUPPORT, "w", **s_profile) as dst:
        dst.write(support.astype(np.uint8), 1)

    # 9. MEASURE WHAT EACH RULE ACTUALLY CONTRIBUTES
    write_diagnostics(rad, l_class, s_class, valid_joint, class_1, class_2, class_3, class_5)
    print(f"[*] Finished in {time.time() - t0:.1f} s")


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


def db(x):
    return 10.0 * np.log10(np.maximum(x, 1e-6))


def fuse(d, l_class, s_class, valid, s_gate=-10.5, sand_l=-13.0,
         sandbar=True, wind=True, canopy=True, s_filter=True):
    """The fusion rules with each one switchable, for on/off measurements."""
    rejected = (((d["l_hh_base"] < sand_l) & (d["s_hh_base"] >= s_gate)) |
                ((d["l_hh_act"] < sand_l) & (d["s_hh_act"] >= s_gate))) & valid
    if not sandbar:
        rejected = np.zeros_like(rejected)
    stable = (l_class == 1) & (s_class == 1)
    if wind:
        stable = stable | ((d["l_hh_base"] < -15.5) & (d["l_hv_base"] < -22.0) &
                           (d["l_hh_act"] < -15.5) & (d["l_hv_act"] < -22.0))
    c1 = stable & ~rejected & valid
    l_gain = (l_class == 2) | (l_class == 3)
    s_gain = (s_class == 2) | (s_class == 3)
    delta_l = d["l_hh_act"] - d["l_hh_base"]
    cand = l_gain | s_gain
    if canopy:
        cand = cand | ((delta_l <= -3.26) & (d["l_hv_act"] < -20.0) & (d["l_hh_act"] < -12.0))
    if s_filter:
        cand = cand & (d["s_hh_act"] < s_gate)
    cand = cand & ~c1 & valid
    c2 = cand & ((l_gain & s_gain) | (delta_l <= -5.0))
    c3 = cand & ~c2
    c5 = ((l_class == 5) | (s_class == 5)) & (delta_l >= 3.0) & ~c1 & ~cand & valid
    return c1, c2, c3, c5


def area(mask):
    px = int(np.count_nonzero(mask))
    km2 = px * PIXEL_KM2
    return {"px": px, "km2": round(km2, 2), "acres": round(km2 / 0.004046856)}


def summary(c1, c2, c3, c5):
    gain = c2 | c3
    return {"stable": area(c1), "gain": area(gain), "loss": area(c5),
            "water_date1": area(c1 | c5), "water_date2": area(c1 | gain)}


def separability(values, water, land):
    """Distance between water and land means in pooled standard deviations."""
    a, b = values[water], values[land]
    pooled = float(np.sqrt((a.var() + b.var()) / 2.0))
    return {"water_mean_db": round(float(a.mean()), 2), "land_mean_db": round(float(b.mean()), 2),
            "separability": round(float(abs(a.mean() - b.mean()) / pooled), 3)}


def write_diagnostics(rad, l_class, s_class, valid, c1, c2, c3, c5):
    d = {k: db(v) for k, v in rad.items() if k != "s_hhhv_act"}
    check = fuse(d, l_class, s_class, valid)
    if not all(np.array_equal(a, b) for a, b in zip(check, (c1, c2, c3, c5))):
        raise SystemExit("fuse() does not reproduce the fused map; diagnostics would be invalid.")

    l_gain = ((l_class == 2) | (l_class == 3)) & valid
    s_gain = ((s_class == 2) | (s_class == 3)) & valid
    fused_gain = c2 | c3
    delta_l = d["l_hh_act"] - d["l_hh_base"]
    canopy = (delta_l <= -3.26) & (d["l_hv_act"] < -20.0) & (d["l_hh_act"] < -12.0) & valid
    stable_both = (l_class == 1) & (s_class == 1) & valid
    wind = (d["l_hh_base"] < -15.5) & (d["l_hv_base"] < -22.0) & (d["l_hh_act"] < -15.5) & (d["l_hv_act"] < -22.0)
    rejected = (((d["l_hh_base"] < -13.0) & (d["s_hh_base"] >= -10.5)) |
                ((d["l_hh_act"] < -13.0) & (d["s_hh_act"] >= -10.5))) & valid
    any_cand = (l_gain | s_gain | canopy) & ~c1 & valid

    def per_method(cls):
        return summary(cls == 1, cls == 2, cls == 3, cls == 5)

    l_masked = np.where(valid, l_class, 0)
    s_masked = np.where(valid, s_class, 0)
    variants = {
        "all_rules": {},
        "without_sandbar_gate": {"sandbar": False},
        "without_wind_gate": {"wind": False},
        "without_canopy_rule": {"canopy": False},
        "without_s_band_filter": {"s_filter": False},
        "union_only": {"sandbar": False, "wind": False, "canopy": False, "s_filter": False},
    }
    sensitivity = {
        "s_gate_-11.5": {"s_gate": -11.5}, "s_gate_-9.5": {"s_gate": -9.5},
        "sandbar_l_-14.0": {"sand_l": -14.0}, "sandbar_l_-12.0": {"sand_l": -12.0},
    }
    water_l = stable_both
    land = (l_class == 0) & (s_class == 0) & valid
    out = {
        "note": "Pixel counts of rule behaviour. These are not accuracy measurements.",
        "water_area_per_date": {"l_only": per_method(l_masked), "s_only": per_method(s_masked),
                                "fused": summary(c1, c2, c3, c5)},
        "l_s_gain_agreement": {
            "both": area(l_gain & s_gain), "l_only": area(l_gain & ~s_gain), "s_only": area(s_gain & ~l_gain),
            "jaccard": round(np.count_nonzero(l_gain & s_gain) / np.count_nonzero(l_gain | s_gain), 4)},
        "fused_gain_sources": {
            "both_bands": area(fused_gain & l_gain & s_gain),
            "l_band_only": area(fused_gain & l_gain & ~s_gain),
            "s_band_only": area(fused_gain & s_gain & ~l_gain),
            "canopy_rule_only": area(fused_gain & ~l_gain & ~s_gain)},
        "candidates_removed_by_s_filter": area(any_cand & (d["s_hh_act"] >= -10.5)),
        "wind_gate_pixels_added_to_stable_water": area(c1 & wind & ~stable_both),
        "sandbar_gate_stable_pixels_removed": area(stable_both & rejected),
        "gain_not_below_water_threshold_on_later_date": {
            "l_only": {**area(l_gain & (d["l_hh_act"] >= -13.0)), "of": area(l_gain)},
            "s_only": {**area(s_gain & (d["s_hh_act"] >= -12.5)), "of": area(s_gain)},
            "fused": {**area(fused_gain & (d["l_hh_act"] >= -13.0) & (d["s_hh_act"] >= -12.5)), "of": area(fused_gain)}},
        "rule_on_off": {k: summary(*fuse(d, l_class, s_class, valid, **v)) for k, v in variants.items()},
        "threshold_sensitivity": {k: summary(*fuse(d, l_class, s_class, valid, **v)) for k, v in sensitivity.items()},
        "channel_separability_12_sep": {
            "caution": "Water and land samples come from HH-based classes, which favours HH.",
            "l_hh": separability(d["l_hh_act"], water_l, land),
            "l_hv": separability(d["l_hv_act"], water_l, land),
            "l_hv_minus_hh": separability(d["l_hv_act"] - d["l_hh_act"], water_l, land),
            "s_hh": separability(d["s_hh_act"], water_l, land),
            "s_hv": separability(d["s_hv_act"], water_l, land),
            "s_hv_minus_hh": separability(d["s_hv_act"] - d["s_hh_act"], water_l, land)},
        "gain_with_hv_drop_of_3db": {
            "l_gain_with_l_hv_drop": {**area(l_gain & (d["l_hv_act"] - d["l_hv_base"] <= -3.0)), "of": area(l_gain)},
            "s_gain_with_s_hv_drop": {**area(s_gain & (d["s_hv_act"] - d["s_hv_base"] <= -3.0)), "of": area(s_gain)}},
    }
    if JUL_CLASS_TIF:
        with rasterio.open(JUL_CLASS_TIF) as src:
            jul = src.read(1)[L_ROW_OFFSET:L_ROW_OFFSET + OVERLAP_ROWS, L_COL_OFFSET:L_COL_OFFSET + OVERLAP_COLS]
        out["gain_outside_water_present_26jul_and_31aug"] = {
            "l_only": area(l_gain & (jul != 1)), "s_only": area(s_gain & (jul != 1)), "fused": area(fused_gain & (jul != 1))}
    with open(OUT_DIAG, "w") as f:
        json.dump(out, f, indent=2)
    print(f"[*] Wrote {OUT_DIAG}")


def configure():
    global CACHE_FILE, L_CLASS_TIF, S_CLASS_TIF, OUT_JSON, OUT_TIF, OUT_DIAG, OUT_SUPPORT
    global F_L_BASE, F_L_ACT, F_S_BASE, F_S_ACT, JUL_CLASS_TIF
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--data-dir", required=True, help="Folder holding the four GCOV .h5 granules")
    p.add_argument("--l-class", required=True, help="L-band class GeoTIFF, 31 Aug -> 12 Sep")
    p.add_argument("--s-class", required=True, help="S-band class GeoTIFF, 31 Aug -> 12 Sep")
    p.add_argument("--jul-class", help="Optional L-band class GeoTIFF, 26 Jul -> 31 Aug")
    p.add_argument("--out-dir", required=True)
    a = p.parse_args()
    os.makedirs(a.out_dir, exist_ok=True)
    CACHE_FILE = os.path.join(a.out_dir, "cache_80m_ls_radiometry.npz")
    OUT_JSON = os.path.join(a.out_dir, "sar-bihar-ls-fused-aug31-sep12_flood.json")
    OUT_TIF = os.path.join(a.out_dir, "sar-bihar-ls-fused-aug31-sep12_class.tif")
    OUT_DIAG = os.path.join(a.out_dir, "fusion_diagnostics.json")
    OUT_SUPPORT = os.path.join(a.out_dir, "valid_support.tif")
    L_CLASS_TIF, S_CLASS_TIF, JUL_CLASS_TIF = a.l_class, a.s_class, a.jul_class
    F_L_BASE, F_L_ACT = (os.path.join(a.data_dir, n) for n in (L_BASE_NAME, L_ACT_NAME))
    F_S_BASE, F_S_ACT = (os.path.join(a.data_dir, n) for n in (S_BASE_NAME, S_ACT_NAME))


if __name__ == "__main__":
    configure()
    main()
