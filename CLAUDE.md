# NISAR Pro — Official Engineering Brain & System Contract
> **Auto-loaded by Claude Code / AI Agents on every session.**
> **Mission**: InGARSS 2026 Phase-1 Hackathon (NASA-ISRO SAR Flood Inundation & Damage Mapping).
> **Status**: Verified pipeline on consumer hardware (2 × 1.157 billion samples per pair in 44–65 s @ 1.87–2.32 GB peak RAM).

---

## 1. System Architecture & Directory Layout

NISAR Pro is split into three high-performance tiers:

```
sar_analyzer/
├── sar_science_processor/   # [Tier 1] Pure Rust SAR scientific engine (Rayon, chunked HDF5, Otsu, 4-class flood detection)
├── sar-gateway/             # [Tier 2] Axum + Tokio backend (0.0.0.0:3000), SSE log streaming, persistent job preloading
├── sar-dashboard-v3/        # [Tier 3] React 19 + Vite + MapLibre GL web dashboard
├── Docs/                    # Full technical documentation, research briefs, and blog drafts
└── sar-gateway/results/     # Canonical storage for preloaded showcase runs
```

### Port & Process Contract
- `sar-gateway` listens on `0.0.0.0:3000`.
- The gateway serves both the REST/SSE API (`/jobs`, `/results/*`, `/search/nisar`) AND the production frontend build from `sar-dashboard-v3/dist/` via SPA fallback.
- In dev mode, the frontend can also run on `http://localhost:5173` via `npm run dev`.

---

## 2. Mathematical Discoveries & Core Breakthroughs

### The 1.157 Billion Pixel Problem (Solved)
- Raw NISAR GCOV scenes over the Ganga Alluvial Plain in Bihar are **33,696 × 34,344 pixels** at 10m spacing.
- Two dates = **2.31 billion raw `f32` observations**.
- **Naive loading in Python/GDAL will instantly OOM** (exploding past 25 GB RAM).
- **The Breakthrough**:
  1. **Exact 8×8 Lattice Multiples**:
     - L-band shape: `33,696 × 34,344` (both divisible by 8)
     - S-band shape: `33,120 × 34,200` (both divisible by 8)
     - L-to-S origin offset: $\Delta X = 720\text{ m} = 72\text{ px}$, $\Delta Y = 2880\text{ m} = 288\text{ px}$ (both divisible by 8)
  2. **Streaming Chunked Hyperslabs**:
     - In `sar_science_processor/src/nisar_parser.rs`, `parse_nisar_full_scene_multilooked` uses `ChunkedF32Reader` to read **1,024-row strips** directly from HDF5.
     - Block-averages on the fly into an $80\text{ m} \times 80\text{ m}$ ground lattice ($4,212 \times 4,293$ pixels = 18.08M pixels = **72 MB** array).
     - **Performance (measured 2026-11-07, 4 cores)**: Each pair (2 × 1.157B samples) takes **44–65 s** with **1.87–2.32 GB peak RAM**.
  3. **DO NOT revert to monolithic full-array reads** or claim full tiles cannot run on 8 GB RAM.

---

## 3. InGARSS 2026 Section 6: 4-Class Temporal Flood Partition

The flood engine (`sar_science_processor/src/flood_detect.rs`) does NOT just do binary water classification. It maps full temporal dynamics between Date 1 (Baseline) and Date 2 (Active/Flood):

| Class | Category | Condition | UI Color & Hex |
|---|---|---|---|
| **0** | **Stable Non-Water Land** | Non-water at both dates | Slate `#64748b` (not painted on the map) |
| **1** | **Stable Water Body** | Water at both dates | Deep blue `#2f5aa6` |
| **2** | **Newly Inundated (High Conf)** | Region-grown pixel with change below the seed threshold (Otsu is reported; it does not bind unless below the seed) | Blue `#3d8df0` |
| **3** | **Newly Inundated (Med Conf)** | Region-grown pixel between the growth and seed thresholds | Light blue `#82b8f4` |
| **4** | **Newly Inundated (Low Conf)** | Secondary water classification | Pale blue `#c2dbf7` |
| **5** | **Water Loss / Receded Water** | Baseline $< -15\text{dB}$, Active $\ge -15\text{dB}$, $\Delta\text{dB} \ge +3.0\text{dB}$ | Amber `#d4892f` |

### Measurement Units Rule
- Every metric in UI panels, reports, and logs MUST provide **dual units**:
  - $\text{km}^2$ (Metric)
  - Acres (Imperial)
  - Conversion: $1\text{ acre} = 0.004046856\text{ km}^2$.

---

## 4. Visual & UI System Rules

The colours above are what the dashboard paints (`CLASSES` in
`sar-dashboard-v3/src/pages/app/lib/report.js`). The engine writes separate key colours per class
into `<id>_flood.png` (`io.rs` `save_flood_map_png`); the dashboard reads the class back from those
(`FLOOD_PNG_COLORS`) and repaints it. Change the keys in both files together.

### A. Dashboard (`/app`)
- Structure and data flow: `Docs/Architecture/sar_dashboard_internals.md`. Design: `Docs/Dashboard_Design_Spec.md` §13 (v3).
- Obsidian, achromatic chrome: no cyan, teal or neon in the UI. Colour only on data (map classes,
  charts, status dots). Panels `rgba(18,19,22,.84)` blur 28 px, radius 24; porcelain `#f3f4f6`
  primary button; Plus Jakarta Sans, sentence case.
- Full-screen dark satellite map (Esri World Imagery, desaturated in MapLibre paint, Esri places on
  top). Floating nav pill top left (Live Map, Time Series, Regions, Reports, Processing, Evaluation
  Hub), command pill top right (place or lat, lon search, engine state), left bento stack (system
  status with the flood extent of the run in focus, latest four run cards), one 380 px right panel
  for the tab. Each fact has one owner tab; never show it twice. Nothing is tied to one region.
- `/app` opens on Live Map with no run (no result numbers). A result shows only after a run is opened.
- Dashboard wording: "Flood extent" plus the note "Water detected by radar … Not confirmed on
  the ground." The InGARSS package keeps "newly detected water" (§10.4).
- Sentinel-2 scores appear only in Validation, only for runs whose track/frame/dates match the
  study (`public/reference/sentinel2_validation.json`, a copy), labelled as agreement.
- `method.threshold_db` is Otsu capped at the minimum change, not the applied threshold. The seed
  used is `min(seed, threshold_db)`; label it that way.
- Replay phases: `baseline`, `active`, `detected` (active at 0.65 + classes). Only `map/MapView.jsx`
  adds map layers. Every area through `<Area>`/`formatArea` (km² + acres). Missing value prints "—".
- Place names: gateway `GET /geocode/reverse` (OpenStreetMap Nominatim, 1 request/s, cached in
  `results/geocode_cache.json`). Demo data stores them per run. Place search for the command pill:
  `GET /geocode/search?q=` (same limits, cached in memory).

### B. Map rendering (`io.rs`)
- Full-scene PNGs (class overlay + both radar previews) are re-gridded to Web Mercator by
  `warp_png_to_web_mercator`; `georef_bbox` in the report is their bounds. GeoTIFFs stay on UTM.
- Radar previews are real linear power (do not square), percentile stretch on valid pixels only,
  transparent outside the swath. A full scene is drawn at full 80 m resolution (no downsampling
  below 4,800 px) and written as grey + alpha. The map draws image pixels sharp (nearest) from
  zoom 10 and smoothed below it.

## 5. Gateway runs (`sar-gateway/results/jobs/<id>/`)

- Each run folder holds `job.json`, `run.log`, the report, PNGs, GeoJSON and class GeoTIFF.
  Startup loads every folder; runs with the same fingerprint (files + crop + thresholds) are
  duplicates and only the newest is kept. A request identical to a finished run returns it
  (`reused: true`) unless `force: true`. Details at the top of `sar-gateway/src/jobs.rs`.
- The four Bihar full-scene runs (L 26 Jul→31 Aug, L 31 Aug→12 Sep, L 12 Sep→18 Oct,
  S 31 Aug→12 Sep, `--crop-preset full --swath-edge-erosion 40`) reproduce the package numbers
  on their own grids (e.g. L Aug→Sep new water 1,166.21 km², 288,178 ac).
- Website demo data: `python3 sar-dashboard-v3/scripts/build_demo_data.py` with the gateway running.
- Only the flood pipeline runs; the Kubernetes job path was removed.
- NASA catalog: `GET /search/nisar` (ASF search, no login) and `GET /asf/download-stream` (needs
  `EARTHDATA_TOKEN` in `sar-gateway/.env`); downloads land in `sar-gateway/data/`, which `/scenes` reads.
- Engine detection flags (`--seed-threshold-db`, `--growth-threshold-db`, `--min-change-db`,
  `--min-area-pixels`, `--swath-edge-erosion`) are optional: omitted means the band default
  (`FloodDetectionOptions::for_band`), given means applied on any band.

## 6. How to Build & Verify

### Running Unit Tests
```bash
cd sar_science_processor
cargo test
# All unit tests must pass (74 passed; 0 failed on 2026-11-11)
```

### Compiling & Running Backend
```bash
cd sar-gateway
cargo build --release
./target/release/sar-gateway
# Health check: curl -s http://localhost:3000/jobs/health-ping
```

### Compiling Frontend
```bash
cd sar-dashboard-v3
npm run build
# Dist builds cleanly to dist/ and is served automatically by the gateway on :3000
```

---

## 7. IEEE InGARSS 2026 Hackathon Package (`ingarss_2026/`)

### Key Context & Problem Statement
- **Theme**: Dynamic & Seasonal Surface-Water Mapping over India Using NISAR L- and S-Band SAR (NISAR L2 GCOV).
- **Target Deadline**: 10th November 2026, 11:59 PM IST via Google Form.
- **Lead Author**: Aditya Narayan Nayak (NISAR Pro Systems & SAR Analytics, Kundura, Odisha, India).
- **Study Scene**: Bihar Ganga Alluvial Plain (Track 98, Frame 14, Center: 25.5°N, 86.5°E, common L/S comparison grid 59,083.56 km²).
- **Epochs**:
  - 2026-07-26 (L-band), 2026-08-31 and 2026-09-12 (L-band + S-band, seconds apart), 2026-10-18 (L-band)

### Standalone Python Evaluator (`ingarss_2026/run_bihar_analysis.py`)
- Standard-library Python only. Checks every file against `provenance_manifest.json` (SHA-256), prints Tasks A-H from the result JSONs, checks class sums, prints the computed answer to the research question, and ends with `ALL CHECKS PASSED` (exit 0).
- Result folders: `results/L_aug31_sep12`, `S_aug31_sep12`, `LS_fused_aug31_sep12`, `L_jul26_aug31`, `L_sep12_oct18` (erosion 40), `supplementary/L_sep12_oct18_edge3px` (erosion 3, JSON only), `validation/`.
- Fused JSON uses neutral key names (`rule_diagnostics`, `sandbar_test_pixels`, `canopy_rule_outside_s_gain`). Do not reintroduce "false_positives_rejected", "recovered", "double_bounce" or similar claims.
- Rebuild the manifest after any package change: `python3 ingarss_2026/scripts/build_provenance_manifest.py` (works from any directory). For the note: `./scripts/build_note_pdf.sh`.

---

## 8. Canonical Numbers (Strict Ground Truth — Never Alter or Invent)

| Category / Observable | Value (km²) | Value (Acres) | Notes |
|---|---|---|---|
| **Common L/S Comparison Grid** | **59,083.56 km²** | 14,599,867 ac | Valid in L and S on both dates; not the full L-band scene footprint |
| **L-band Inundation (Aug 31 → Sep 12)** | **1,137.14 km²** | 280,993 ac | Single-frequency L |
| **S-band Inundation (Aug 31 → Sep 12)** | **1,174.89 km²** | 290,322 ac | Single-frequency S |
| **Fused L+S Inundation** | **1,337.15 km²** | 330,417 ac | $+200.01\text{ km}^2$ vs L, $+162.26\text{ km}^2$ vs S |
| **Sandbar test: L water pixels flagged** | **347.76 km²** | 85,933 ac | Diagnostic. Removing the gate changes stable water by 31.97 km² |
| **Canopy rule outside S gain** | **625.95 km²** | 154,676 ac | Diagnostic. Actual fused contribution is 223.53 km² (55,236 ac). Not double-bounce: the rule needs HH to fall |
| **Stable water, HH ≥ −15 dB and HV < −21.5 dB** | **132.42 km²** | 32,722 ac | Diagnostic, not recovered by the wind gate. The gate adds 270.51 km² (66,844 ac) |
| **Task D Class 0 (Dry Land)** | **54,370.76 km²** | 13,435,308 ac | 92.02% of valid swath |
| **Task D Class 1 (Permanent Water)** | **2,652.29 km²** | 655,395 ac | 4.49% of valid swath |
| **Task D Class 2 (High Confidence Flood)** | **944.61 km²** | 233,418 ac | 1.60% of valid swath |
| **Task D Class 3 (Medium Confidence Flood)**| **392.54 km²** | 96,999 ac | 0.66% of valid swath |
| **Task D Class 5 (Receded Aug 31 → Sep 12)**| **723.37 km²** | 178,749 ac | 1.22% of valid swath |
| **Class Sum Consistency** | **59,083.57 km²** | Sums to $59,083.56 \pm 0.01\text{ km}^2$ | Task D PASS |
| **Post-Monsoon Recession (Sep 12 → Oct 18)**| **-2,650.27 km²** | 654,895 ac | Edge erosion 3 px. At erosion 40, which matches other periods: -2,551.94 km² (630,597 ac) |

---

## 9. Deliverables Status & Active Priorities

Package files, how each was made and how to check them are listed in `ingarss_2026/README.md`.

1. **Presentation**: `presentation.pptx` (8 slides, plain Office theme, native chart and tables) built by `python3 scripts/build_presentation_pptx.py` (python-pptx), and `presentation.pdf` exported from it with LibreOffice. Rebuild the manifest after changing either.
2. **Maps**: `maps/` and `results/`. Class GeoTIFFs are EPSG:32645.
3. **Code**: `run_bihar_analysis.py` plus `scripts/`. The notebook was removed by Aditya's decision; do not reintroduce it.
4. **README**: `README.md`.
5. **Technical Note**: `TECHNICAL_NOTE.md` and `TECHNICAL_NOTE.pdf` (4 pages, A4, IEEE two-column, 3 figures from `note_figures/`). Written in Aditya's plain voice. Figures: `scripts/make_note_figures.py`; PDF: `./scripts/build_note_pdf.sh` (also rebuilds the manifest).
6. **Polarization**: `POLARIZATION_ASSESSMENT.md`.

---

## 10. Strict Constraints & Rubric Defense (DO NOT VIOLATE)

1. **No invented accuracy numbers**:
   - Only report scores computed in `results/validation/sentinel2_validation.json`. Label them as agreement with Sentinel-2 on cloud-free pixels, with band, date and scored area.
   - Main result: L+S improves on L-only but does not beat S-only. Do not claim otherwise.
2. **Zero Hardcoded Result Fallbacks in Analysis Scripts**:
   - Every number reported must be read directly from the result JSONs.
3. **Dual Units Rule**:
   - Every area figure must report both km² and acres ($1\text{ acre} = 0.004046856\text{ km}^2$).
4. **Responsible wording**:
   - Say "newly detected water", not flood, unless independent evidence supports it. Rule names (sandbar, canopy, wind) describe intent, not verified surfaces. The sandbar rule has a Sentinel-2 check in `results/validation/sand_rule_check.json`: it rejects mostly non-water pixels, but they are not all sand.
