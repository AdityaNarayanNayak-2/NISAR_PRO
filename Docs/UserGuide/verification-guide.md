# System Verification & Testing Guide

This guide walks you through verifying every component of the NISAR Pro platform, covering local service boot checks, InSAR (GUNW) infrastructure deformation mapping, standard SAR Science (GCOV) amplitude rendering, and Maritime CA-CFAR ship detection.

---

## 🛠️ Phase 0: Prerequisites & Startup Checks

Before beginning, ensure all three main components are running locally on your workstation.

### 1. Start Services
Open three separate terminal windows and run:

* **Terminal 1 (Tile Server)**:
  ```bash
  # Boots TiTiler on port 8000
  bash start_titiler.sh
  ```
* **Terminal 2 (API Gateway)**:
  ```bash
  # Boots the Axum supervisor on port 3000
  cd sar-gateway
  LOCAL_MODE=true RUST_LOG=info cargo run --release
  ```
* **Terminal 3 (Dashboard UI)**:
  ```bash
  # Boots the React development web server
  cd sar-dashboard-v3
  npm run dev
  ```

### 2. Verify Health Status
Verify that all services respond correctly to health-checks:

```bash
# 1. Verify TiTiler Tile Server
curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/healthz
# Expected: 200

# 2. Verify Axum Gateway Service
curl http://localhost:3000/jobs/health-ping
# Expected: {"status":"ok"}

# 3. Verify Dashboard Frontend Server
curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/
# Expected: 200
```

---

## 🛰️ Phase 1: Test A — InSAR Infrastructure Monitoring (GUNW)

This test verifies the unwrapped phase processing, deformation conversion (millimeters), spatial coherence masking, and persistent scatterers leaflet rendering.

### 1. Selection & Location Binding
1. Open your browser and navigate to `http://localhost:5173/app`.
2. On the mission select panel, click **INFRASTRUCTURE MONITORING** (activates the gold theme).
3. In the left-hand search box, type `Upper Kolab`.
4. Click on **Upper Kolab Dam** from the search results:
   * Verify that coordinates auto-populate to: **Latitude `18.7889`**, **Longitude `82.6049`**.
   * Verify that the Leaflet map automatically pans/flies to the Upper Kolab location.
5. Click **FETCH CONTEXT**:
   * Verify that environmental indicators populate (seismicity, rainfall, soil saturation, and season metrics).

### 2. File Ingest & Processing
1. Paste the target GUNW product path into the **Master File Path** input box:
   ```
   /home/aditya/Desktop/nisar_data/NISAR_L2_PR_GUNW_009_127_A_011_010_4000_SH_20260105T235314_20260105T235347_20260117T235314_20260117T235347_X05010_N_F_J_001.h5
   ```
2. Verify that the parsed metadata card displays:
   * **Product**: `GUNW — Pre-computed InSAR`
   * **Level**: `L2 (Geocoded)`
   * **Polarization**: `Single-pol (HH)`
3. Keep the **Slave File Path** blank (pre-computed GUNW files contain both passes).
4. Click **START PROCESSING**:
   * The live terminal log overlay will open.
   * Verify that logs output processing progress:
     * `[1/5] Reading GUNW unwrapped phase + coherence...`
     * `[2/5] Saving displacement GeoTIFF...`
     * `[3/5] Saving coherence GeoTIFF...`
     * `[4/5] Analyzing infrastructure health...`
     * `[5/5] Emitting structured events...`
     * `GUNW Pipeline Complete ✓`

### 3. Visual Layers Validation
Once processing completes (signaled by a green status indicator):
1. **Deformation Map**:
   * Verify that the Leaflet map renders the continuous displacement heatmap.
   * Verify that the active map layer request points to TiTiler:
     `url=...defo_phase.tif&colormap_name=rdylgn&rescale=-20,20` (Gold-red-green diverging colormap representing millimeter movement).
2. **Persistent Scatterers (PS)**:
   * Zoom into the dam structure and click one of the colored markers.
   * Verify that the popup contains:
     * `PS Point #ID`
     * `Severity: Stable | Caution | Alert | Critical`
     * `Displacement: [Value] mm` (Verify that values are in millimeters, not radians).
     * `Coherence: [Value]`
3. **Coherence Toggle**:
   * Switch the map layer toggle from **Deformation** to **Coherence**.
   * Verify that the raster switches to a greyscale output:
     `url=...coherence.tif&colormap_name=greys&rescale=0,1`.
   * Verify that the legend adapts to coherence ranges (`0.0` to `1.0`).

### 4. Target Metrics Verification (Upper Kolab Dam)
Cross-reference the summary data in the bottom panel with the benchmark metrics:
* **Total Status**: `CRITICAL` (due to high displacement points)
* **Maximum Displacement**: `26.1 mm`
* **Stable Count**: `3,153` points
* **Caution Count**: `1,495` points
* **Alert Count**: `346` points
* **Critical Count**: `351` points

---

## 🔬 Phase 2: Test B — SAR Science Amplitude Ingest (GCOV)

This test verifies standard SAR focusing, amplitude backscatter scaling, and catalog search caching.

### 1. Profile Switch & Ingest
1. Click the top bar profile dropdown and select **SAR SCIENCE** (activates the purple theme).
2. Select the **Local File** tab.
3. Paste the target GCOV product path:
   ```
   /home/aditya/Desktop/nisar_data/NISAR_L2_PR_GCOV_010_165_D_100_2005_DHDH_M_20260120T155930_20260120T155950_X05010_N_P_J_001.h5
   ```
4. Verify that the parsed metadata card displays:
   * **Product**: `GCOV — Geocoded Covariance`
   * **Level**: `L2 (Geocoded)`
   * **Acquisition Date**: `2026-01-20`

### 2. Processing & Rendering
1. Select the **Standard SAR Focus** pipeline.
2. Click **START PROCESSING**.
3. Verify that the terminal executes the task:
   * Rejects phase difference inputs (since GCOV contains backscatter).
   * Spawns the processing command: `sar_processor --input <GCOV> --output results/[job_id].tif`.
4. Wait for `PROCESS_COMPLETED` and verify:
   * The Leaflet map displays the greyscale amplitude backscatter.
   * Verify that the active layer request points to:
     `url=...[job_id].tif&tilesize=512` (no colormap override).
   * Confirm that water surfaces (reservoir) render as dark black, and land/concrete features render as light grey.

---

## 🚢 Phase 3: Test C — Maritime CA-CFAR Ship Detection

This test verifies the Constant False Alarm Rate (CFAR) target classifier and vessel coordinates marker overlays.

### 1. Ingest & Target Run
1. Select the **MARITIME SURVEILLANCE** profile (activates the red theme).
2. Use the same GCOV product as input:
   ```
   /home/aditya/Desktop/nisar_data/NISAR_L2_PR_GCOV_010_165_D_100_2005_DHDH_M_20260120T155930_20260120T155950_X05010_N_P_J_001.h5
   ```
3. Click **START PROCESSING**.
4. Verify that the log streams:
   * Spawns `sar_processor` with the `--ship-detect` flag.
   * Prints detection logs listing coordinates and backscatter intensities of target signals.

### 2. Overlay Validation
1. Verify that the map displays red circular vessel markers over the detected positions.
2. Click on a vessel marker and verify that the popup contains:
   * `Vessel #ID`
   * `Backscatter Intensity` (dB)
   * `Coordinates` (Latitude/Longitude)
3. Check the left-hand panel for CA-CFAR summary stats:
   * Number of vessels detected.
   * Maximum, mean, and minimum backscatter levels (dB).

---

## 📋 Success Criteria Checklist

A verification run is **successful** only if all of the following checks pass:

- [ ] All three microservices start up and pass health-ping loops on ports `8000`, `3000`, and `5173`.
- [ ] Upper Kolab coordinate lookup pans the map and fetches environmental context data.
- [ ] GUNW displacement processing runs and matches the Upper Kolab metrics (Max deflection `26.1 mm`).
- [ ] TiTiler streams colorized displacement and greyscale coherence layers without errors.
- [ ] Persistent Scatterers render as clickable markers with displacement stats in millimeters.
- [ ] GCOV standard processing displays high-resolution greyscale backscatter amplitude maps.
- [ ] CFAR ship detection executes, overlays red vessel markers, and lists target backscatter stats (dB).
