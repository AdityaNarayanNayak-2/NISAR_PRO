# 7-Stage SAR Flood & Inundation Detection Engine (`flood_detect.rs`)

The `flood_detect` module implements a scientifically rigorous, non-ML multi-temporal SAR flood extraction pipeline for NISAR L-band GCOV products.

## Algorithm Architecture

```
Stage 1: Metadata Pair Validation
   │
   ▼
Stage 2: Power-to-dB Conversion [10 * log10(P + ε)]
   │
   ▼
Stage 3: 3×3 Median Speckle Filtering
   │
   ▼
Stage 4: Log-Ratio Change Image (Δ_dB = active_dB - baseline_dB)
   │     + Otsu's Thresholding (with min_change_db floor)
   │
   ▼
Stage 5: Permanent Water Baseline Exclusion
   │
   ▼
Stage 6: Two-Threshold Region Growing (Seed + Growth)
   │     + 3×3 Morphological Open/Close & Connected Component Size Filter
   │
   ▼
Stage 7: Multi-Tier Confidence Scoring (0=Land, 1=Perm, 2=High, 3=Med, 4=Low)
```

## Unit Test Coverage
- `test_gcov_to_db`: Validates log transformation of real-valued covariance diagonal terms.
- `test_compute_change_image`: Verifies calibrated dB difference calculation.
- `test_otsu_threshold`: Verifies bimodal variance maximization for change separation.
- `test_region_grow_and_cleanup`: Verifies 8-connected region expansion and morphological size filtering.

## Output Exporters (`io.rs`)

### 1. Colormapped RGBA PNG (`save_flood_map_png`)
Generates a transparent overlay for web visualization:
- **Dry Land**: Completely transparent (`[0, 0, 0, 0]`)
- **Permanent Water**: Semi-transparent blue (`[0, 100, 255, 140]`)
- **High Confidence Flood**: Semi-opaque neon red (`[255, 40, 0, 220]`)
- **Medium Confidence Flood**: Semi-opaque orange (`[255, 160, 0, 180]`)
- **Low Confidence Flood**: Semi-opaque yellow (`[255, 230, 0, 120]`)

### 2. GeoJSON Feature Collection (`save_flood_geojson`)
Generates WGS84 coordinates polygon bounds for each flooded pixel cell to enable importing into standard GIS tools (QGIS, Google Earth) and displaying on maps. Includes `confidence` and `class_code` properties for each feature.

## CLI Parameters & Ingestion (`main.rs`)

The command line parser includes parameters to run the pipeline:
- `--mode flood`: Starts the 7-stage flood mapping pipeline.
- `--gunw <path>`: Optional geocoded unwrapped interferogram to merge coherence values into confidence scoring.
- `--min-change-db <f32>`: Minimum log-ratio backscatter decrease required to trigger a flood alert (default: `-3.0` dB).
- `--seed-threshold-db <f32>`: Initial seed selection limit (default: `-5.0` dB).
- `--growth-threshold-db <f32>`: Growth expansion threshold (default: `-2.5` dB).
- `--min-area-pixels <usize>`: Area floor to prune noise spikes (default: `8` pixels).

### Executable Invocation Examples
```bash
# GCOV dual-image change detection:
./target/release/sar_science_processor \
  --input active_gcov.h5 \
  --slave baseline_gcov.h5 \
  --mode flood \
  --crop-lat 18.7883 --crop-lon 82.6003 --crop-preset 10x10km \
  --output result_prefix

# With coherence mapping fusion:
./target/release/sar_science_processor \
  --input active_gcov.h5 \
  --slave baseline_gcov.h5 \
  --gunw coherence_gunw.h5 \
  --mode flood \
  --crop-lat 18.7883 --crop-lon 82.6003 --crop-preset 10x10km \
```

## Gateway Integration (`sar-gateway`)

The HTTP gateway integrates the flood mapping pipeline within `spawn_processing_job` in `jobs.rs`:
- **API Request Payload**: Expands `ProcessRequest` in `models.rs` to support the optional parameters `gunw_file`, `min_change_db`, `seed_threshold_db`, `growth_threshold_db`, and `min_area_pixels`.
- **Subprocess Dispatch**: Translates `pipeline: Some("flood")` and `processor: Some("science")` into the CLI execution call `./target/release/sar_science_processor --mode flood`, forwarding any custom threshold specifications.
- **Real-Time Log Ingestion**: Integrates with the event streaming pipeline to parse the science processor stdout (`{"event":"flood_report"}` and `{"event":"georef"}`) and broadcast them live to connected frontends.

## Frontend Dashboard Integration (`sar-dashboard-v3`)

The dashboard exposes the interactive controls and renders the flood mapping results:
- **Pipeline Selector**: Adds `Flood & Inundation` mode to the available processing pipelines list for `sar_science` profile.
- **Geographic Crops & Inputs**: Exposes coordinate inputs, crop presets (`1x1km` to `20x20km`), baseline GCOV path, and optional coherence (GUNW) HDF5 paths.
- **Advanced Threshold Controls**: Adds collapsible sliders for:
  - Minimum backscatter change (dB)
  - Region growth seeds (dB)
  - Growth limits (dB)
  - Connected component minimum pixel area
- **Emergency Advisory HUD**: Displays a dedicated pulsing **District Emergency Advisory Card** when a completed flood job is viewed. It contains a high-level summary of baseline vs. active dates, total acres inundated, permanent water coverage, and confidence levels.
- **Leaflet Image Overlay**: Intercepts the transparent overlay output (`_flood.png`) and renders it atop the Leaflet base layer at the computed georeferenced bounding box.