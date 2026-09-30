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

---

## 4. Verification Session: Real-Data Contract Checks (September 29, 2026)

Findings recorded against the actual gateway, processor binary, and a NASA/ASF search:

* **Real product sizes (authoritative):** GCOV ≈ 8–10 GB, RSLC ≈ 25–30 GB. Both are read fully into RAM before any crop (`rustyhdf5` has no partial reads), so peak RSS ≈ 4× on-disk for f32 GCOV grids (~30–40 GB) and far more for RSLC. An 8 GB laptop can only run the small bundled test products; a chunked/hyperslab-read fix is planned.
* **Frontend fixes applied this session:**
  * `src/config/api.js` collapses double slashes — fixed the `//results/` double-slash 404 on flood reload.
  * `normalizeJobStatus`/`jobErrorMessage` in `helpers.js` — the gateway serializes a failed job as `{"status": {"failed": "<reason>"}}` (object, not string); the UI now normalizes it everywhere (poller, SSE, details drawer, exports).
  * Removed the phantom demo job `sar-e4efe049` from the dashboard chained-run preload; no `results/` files existed for it.
  * Health check now requires `res.ok` against `/jobs/health-ping` (fallback `/jobs`) — no more false `GATEWAY: DISCONNECTED` against the root path.
  * SSE handlers finalize on `PROCESS_COMPLETED` / `PROCESS_CANCELLED` / `PROCESS_TIMEOUT` / `PROCESS_FAILED:<msg>`; cancel buttons wired through `POST /jobs/:id/cancel` in the progress bar, terminal drawer, run history, and flood config panel.
  * Data exports derive PNG/JSON/GeoJSON/GeoTIFF links from the advertised `floodReportPath` instead of string-mangling `flood.url` — `_flood_class.tif` is written by the processor but not advertised in `GET /jobs/:id`, and the GeoTIFF export was previously broken.
  * GeoJSON `class_code` coerced with `Number()`; `catch (e) {}` → `catch { void 0; }`; deferred setState-in-effect resets in `MapComponents.jsx`.
* **Gateway facts verified:** route map in `main.rs:37-52` includes `/jobs/health-ping`, `/jobs/:id/cancel`, `/asf/download-stream`, `/asf/auth-status`, and a static `/results/*` server (`ServeDir::new("results")`). `/search` (ESA) needs `ESA_USERNAME`/`ESA_PASSWORD` even to search; `/search/nisar` (ASF) searches anonymously and downloads need Earthdata creds. Both catalog handlers return `200 OK` with `[]` on error.
* **Flood artifacts verified:** `<id>_flood.{png,json,geo.json,_baseline.png,_active.png,_class.tif}` in `results/`; gateway advertises the four named paths, processor writes the `.tif` unadvertised.
