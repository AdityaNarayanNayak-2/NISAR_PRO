# InSAR Verification Log & Test Findings

This document records the execution results, findings, and code improvements identified during the **Phase 1 InSAR Infrastructure Monitoring** verification phase.

---

## 1. Test Run: Upper Kolab Dam Verification

* **Test Date**: July 18, 2026
* **Profile**: `INFRASTRUCTURE`
* **Target Asset**: Upper Kolab Dam, Odisha, India
* **Asset Location**: `18.7889°N, 82.6049°E`
* **Input Dataset (GUNW)**:
  `NISAR_L2_PR_GUNW_009_127_A_011_010_4000_SH_20260105T235314_20260105T235347_20260117T235314_20260117T235347_X05010_N_F_J_001.h5`

### Observed Metrics
The InSAR analysis successfully identified and filtered **5,345 Persistent Scatterers (PS)** within a 10 km radius of the dam footprint:

| Metric | Value | Severity Status |
| :--- | :---: | :---: |
| **Stable PS Points** | 3,153 | Green (`#4CAF50`) |
| **Caution PS Points** | 1,495 | Yellow (`#E6A817`) |
| **Alert PS Points** | 346 | Orange (`#D4822A`) |
| **Critical PS Points** | 351 | Red (`#C0392B`) |
| **Max Displacement** | **26.1 mm** | Critical threshold exceeded |

---

## 2. Issues Identified & Code Improvements

During testing, we discovered and fixed a critical bug in how the frontend loading pipeline interacts with the TiTiler service:

### 🔍 Bug: TiTiler Local File Access Failure
* **Symptom**: The React dashboard was failing to render the continuous deformation heatmap layer beneath the point markers.
* **Root Cause**: The React map component (`AppDashboard.jsx`) was constructing TiTiler URLs using a local `file://` scheme:
  ```javascript
  const tifUrl = encodeURIComponent(`file:///home/aditya/Desktop/sar_analyzer/sar-gateway/results/...`);
  ```
  While TiTiler was running on the host, passing local `file://` schemes via query parameters to `uvicorn` is brittle and fails if TiTiler runs in isolated environments (like Docker containers) or on different server hosts.
* **Fix Applied**: We changed the React map to request the GeoTIFF using the Axum gateway's `/results` static file service over HTTP instead:
  ```javascript
  const tifUrl = encodeURIComponent(api(`/results/${finalTifPath}`));
  ```
  Since the gateway (port `3000`) already exposes the `results/` directory statically, TiTiler (port `8000`) can now cleanly stream the GeoTIFF raster over local HTTP.

### 🔍 Validation: Radians vs. Millimeter Scaling
* **Finding**: We verified that `_defo_phase.tif` contains actual displacement in **millimeters**, not radians.
* **Code Proof**: In `sar_processor/src/main.rs`, the raw deramped phase is multiplied by the SAR wavelength scale factor before writing to disk:
  ```rust
  let displacement_mm_array = defo_phase.mapv(|phi| {
      if phi.is_finite() {
          phi * gunw.wavelength_m * 1000.0 / (4.0 * std::f32::consts::PI)
      } else {
          f32::NAN
      }
  });
  ```
  This confirms that the dashboard's `rescale=-20,20` (in millimeters) is mathematically aligned with the underlying GeoTIFF pixels.

---

## 3. Replication Steps

To re-run this exact verification test in the future:

1. **Start all backend services**:
   ```bash
   # Terminal 1: TiTiler Tile Server
   cd /home/aditya/Desktop/sar_analyzer && bash start_titiler.sh
   
   # Terminal 2: Rust Gateway API
   cd /home/aditya/Desktop/sar_analyzer/sar-gateway
   LOCAL_MODE=true RUST_LOG=info cargo run --release
   
   # Terminal 3: React Dashboard Dev Server
   cd /home/aditya/Desktop/sar_analyzer/sar-dashboard-v3
   npm run dev
   ```

2. **Run verification steps**:
   * Open `http://localhost:5173/app` in your browser.
   * Select the **INFRASTRUCTURE** mission profile.
   * Search for `Upper Kolab` in the search bar and select **Upper Kolab Dam**.
   * Click **FETCH CONTEXT** to query reservoir and weather telemetry.
   * Paste the GUNW file path and click **START PROCESSING**.
   * Verify that the terminal logs stream correctly, the green dots populate, and the deformation/coherence layers toggle as expected.
