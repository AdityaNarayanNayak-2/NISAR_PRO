from pathlib import Path
import json
import numpy as np
import pandas as pd
from IPython.display import display, Markdown

# 1. Load the full-scene NISAR Bihar analysis JSON
json_candidates = [
    Path("sar-bihar-aug31-sep12-full_flood.json"),
    Path("./results/sar-bihar-aug31-sep12-full_flood.json"),
    Path("../results/sar-bihar-aug31-sep12-full_flood.json"),
    Path("../../results/sar-bihar-aug31-sep12-full_flood.json"),
    Path("../results/flood_expansion_aug31_sep12/sar-bihar-aug31-sep12-full_flood.json"),
    Path("../../ingarss_2026/results/flood_expansion_aug31_sep12/sar-bihar-aug31-sep12-full_flood.json"),
]
json_path = next((p for p in json_candidates if p.exists()), json_candidates[0])

with open(json_path, "r") as f:
    report = json.load(f)

areas = report["areas"]
prod = report["product"]
method = report["method"]
bbox = report["georef_bbox"]
replay = report["replay"]

# 2. Compute Valid Swath Footprint vs. Total UTM Bounding Box
valid_swath_km2 = (
    areas["stable_non_water_km2"]
    + areas["permanent_water_km2"]
    + areas["total_flood_km2"]
    + areas["receded_water_km2"]
)
valid_swath_acres = (
    areas["stable_non_water_acres"]
    + areas["permanent_water_acres"]
    + areas["total_flood_acres"]
    + areas["receded_water_acres"]
)

# 3. Construct the InGARSS Section 6 Surface-Water & Change Classification Table
table_rows = [
    {
        "Class ID": "Class 0",
        "InGARSS Section 6 Category": "Stable Non-Water (Dry Land)",
        "Physical Transition (Aug 31 → Sep 12)": (
            "Non-water at both passes (γ⁰ ≥ -13 dB)"
        ),
        "Area (km²)": areas["stable_non_water_km2"],
        "Area (Acres)": areas["stable_non_water_acres"],
        "% of Valid Swath": (
            (areas["stable_non_water_km2"] / valid_swath_km2) * 100.0
        ),
    },
    {
        "Class ID": "Class 1",
        "InGARSS Section 6 Category": "Stable Water (Persistent River/Water)",
        "Physical Transition (Aug 31 → Sep 12)": (
            "Specular water at both passes (γ⁰ < -13 dB)"
        ),
        "Area (km²)": areas["permanent_water_km2"],
        "Area (Acres)": areas["permanent_water_acres"],
        "% of Valid Swath": (
            (areas["permanent_water_km2"] / valid_swath_km2) * 100.0
        ),
    },
    {
        "Class ID": "Classes 2–4 (Net)",
        "InGARSS Section 6 Category": "Water Gain (Newly Detected Inundation)",
        "Physical Transition (Aug 31 → Sep 12)": (
            f"Non-water → Water (Δγ⁰ ≤ {method['threshold_db']:.2f} dB + region grow)"
        ),
        "Area (km²)": areas["total_flood_km2"],
        "Area (Acres)": areas["total_flood_acres"],
        "% of Valid Swath": (
            (areas["total_flood_km2"] / valid_swath_km2) * 100.0
        ),
    },
    {
        "Class ID": "  ├─ Class 2",
        "InGARSS Section 6 Category": "  ├─ High-Confidence Water Gain (Seeds)",
        "Physical Transition (Aug 31 → Sep 12)": (
            f"Strong specular drop (Δγ⁰ < {method['seed_threshold_db']:.1f} dB)"
        ),
        "Area (km²)": areas["new_inundation_high_km2"],
        "Area (Acres)": areas["new_inundation_high_acres"],
        "% of Valid Swath": (
            (areas["new_inundation_high_km2"] / valid_swath_km2) * 100.0
        ),
    },
    {
        "Class ID": "  └─ Class 3",
        "InGARSS Section 6 Category": (
            "  └─ Medium-Confidence Water Gain (Grown)"
        ),
        "Physical Transition (Aug 31 → Sep 12)": (
            f"8-connected hysteresis growth (Δγ⁰ < {method['growth_threshold_db']:.1f} dB)"
        ),
        "Area (km²)": areas["new_inundation_medium_km2"],
        "Area (Acres)": areas["new_inundation_medium_acres"],
        "% of Valid Swath": (
            (areas["new_inundation_medium_km2"] / valid_swath_km2) * 100.0
        ),
    },
    {
        "Class ID": "Class 5",
        "InGARSS Section 6 Category": "Water Loss (Receded Water)",
        "Physical Transition (Aug 31 → Sep 12)": (
            "Water → Non-water (Δγ⁰ ≥ +3.0 dB)"
        ),
        "Area (km²)": areas["receded_water_km2"],
        "Area (Acres)": areas["receded_water_acres"],
        "% of Valid Swath": (
            (areas["receded_water_km2"] / valid_swath_km2) * 100.0
        ),
    },
    {
        "Class ID": "Valid Swath Total",
        "InGARSS Section 6 Category": "Total Valid NISAR Swath Footprint",
        "Physical Transition (Aug 31 → Sep 12)": (
            "Clean Swath Boundary (3-px edge erosion, Track 098, Frame 014)"
        ),
        "Area (km²)": valid_swath_km2,
        "Area (Acres)": valid_swath_acres,
        "% of Valid Swath": 100.0,
    },
    {
        "Class ID": "UTM Grid Box",
        "InGARSS Section 6 Category": (
            f"Full Bounding Grid ({replay['rows']} × {replay['columns']} @ 80m)"
        ),
        "Physical Transition (Aug 31 → Sep 12)": (
            "Includes out-of-swath corners (1.157B native 10m px)"
        ),
        "Area (km²)": areas["total_area_km2"],
        "Area (Acres)": areas["total_area_acres"],
        "% of Valid Swath": np.nan,
    },
]

df_areas = pd.DataFrame(table_rows)

# Display metadata banner + formatted table
display(
    Markdown(f"""
### NISAR Full-Scene Processing Telemetry (`{prod['crs']}`)
* **Baseline Scene (Date 1):** `{prod['baseline_id']}` (2026-08-31)
* **Active Scene (Date 2):** `{prod['active_id']}` (2026-09-12)
* **Sensor / Mode:** `{prod['instrument']}` ({prod['radar_band']}, $f_c = {prod['center_frequency_hz']/1e9:.3f}\\text{{ GHz}}$, $\\lambda = {prod['wavelength_m']*100:.2f}\\text{{ cm}}$, Polarization: `{prod['polarization']}`)
* **Full-Scene Multilooked Grid:** `{replay['rows']} × {replay['columns']}` pixels at `{abs(prod['pixel_spacing_x_m']):.0f} m × {abs(prod['pixel_spacing_y_m']):.0f} m` (8×8 block-averaged from `33,696 × 34,344` / **1.157 billion** 10 m pixels)
* **Computed Otsu Threshold ($T_{{\\text{{Otsu}}}}$):** `{method['raw_otsu_db']:.2f} dB` | **Seed:** `{method['seed_threshold_db']:.1f} dB` | **Growth:** `{method['growth_threshold_db']:.1f} dB` | **Detected Flood Clusters:** `{report['flood_regions']:,}`
""")
)

styled_df = df_areas.style.format({
    "Area (km²)": "{:,.2f}",
    "Area (Acres)": "{:,.2f}",
    "% of Valid Swath": lambda v: "—" if pd.isna(v) else f"{v:.2f}%",
}).hide(axis="index")

display(styled_df)
