# How We Built NISARPro — From Scratch to Production

> The complete engineering story of building a full-stack SAR processing platform in pure Rust, from a single FFT function to a deployed cloud application processing real NASA satellite data.

---

## Phase 1: The Range-Doppler Algorithm (The Foundation)

### The Problem
NASA and ISRO's NISAR satellite produces radar data, not photographs. A single RSLC file is 7-30 GB of raw complex frequency data. To turn it into a visible image, you must run the **Range-Doppler Algorithm (RDA)** — the fundamental algorithm of all SAR processing.

### What We Built
We started with pure mathematics in Rust:

1. **`radar_utils.rs`** — Generated LFM (Linear Frequency Modulated) chirp signals. This replicates the exact radar pulse the satellite transmits.
2. **`rda.rs`** — Implemented the two-stage compression:
   - *Range Compression:* FFT each row, multiply by conjugate of chirp reference, IFFT. This collapses the spread return signal into sharp range peaks.
   - *Azimuth Compression:* FFT each column, apply azimuth matched filter, IFFT. This uses the satellite's flight path to synthesize a massive virtual antenna.
3. **`rcmc.rs`** — Range Cell Migration Correction. As the satellite moves, a ground target's echo drifts across multiple range bins. We implemented an 8-point Hamming-windowed Sinc interpolator to correct this drift.
4. **Synthetic Test Mode** — Before we had any real data, we validated the algorithm by generating a synthetic 1024×1024 point target and confirming that RDA correctly focused it into a sharp impulse response.

### Files Created
```
sar_processor/src/main.rs          (CLI entry point with --synthetic flag)
sar_processor/src/rda.rs           (Range-Doppler Algorithm)
sar_processor/src/rcmc.rs          (Range Cell Migration Correction)
sar_processor/src/radar_utils.rs   (Chirp generation + FFT wrapper)
sar_processor/src/io.rs            (PNG output + CLAHE + Lee filter)
```

---

## Phase 2: Reading Real NASA Data

### The Problem
Synthetic data proved the algorithm works. But real NISAR files are HDF5 databases with deeply nested group hierarchies, compound datatypes (`{r: f32, i: f32}`), and four completely different product formats (RSLC, GSLC, GCOV, GUNW).

### What We Built
1. **`nisar_parser.rs`** — Our largest file (28 KB). It auto-detects which product type a file is by probing HDF5 group paths, then extracts:
   - The complex SLC array (potentially 31,920 × 26,338 samples).
   - Geographic bounding boxes for map overlay.
   - Radar parameters (PRF, wavelength, bandwidth) needed by the RDA.
2. **`safe_parser.rs`** — A parallel parser for ESA's Sentinel-1 SAFE format (GeoTIFF-based).
3. **Smart Skip Logic** — We discovered that NISAR's Level-1+ products (RSLC, GSLC, GCOV, GUNW) are *already focused* by NASA's ground segment. So we added logic to skip the expensive RDA pipeline for these products and render them directly, unless `--process` is explicitly passed.

### Files Created
```
sar_processor/src/nisar_parser.rs  (28 KB — NISAR HDF5 reader)
sar_processor/src/safe_parser.rs   (Sentinel-1 SAFE reader)
```

---

## Phase 3: Advanced Analysis Modules

### Ship Detection (CA-CFAR)
**Problem:** Find ships in ocean SAR imagery. A static brightness threshold fails because sea clutter intensity varies wildly with wave height, wind, and incidence angle.

**Solution:** We implemented Cell-Averaging CFAR with Integral Image acceleration:
- Pre-compute a Summed Area Table in O(N).
- For each pixel, calculate the local sea clutter mean in O(1) using 4 lookups.
- Flag pixels exceeding `α × μ_background` where α is derived from Pfa = 1e-6.
- Downsample 8× before CFAR to prevent RAM blowup on massive images.

**File:** `sar_processor/src/ship_detection.rs`

### InSAR & Infrastructure Health
**Problem:** Detect millimeter-level structural displacement on dams and bridges.

**Solution:**
1. `insar.rs` — Complex conjugate multiplication of Master × Slave* to produce interferograms. Spatial coherence estimation via sliding window.
2. `infra_health.rs` — Persistent Scatterer filter (coherence > 0.85), phase-to-displacement conversion (`d = φλ/4π`), severity classification (STABLE/CAUTION/ALERT/CRITICAL).

**Files:** `sar_processor/src/insar.rs`, `sar_processor/src/infra_health.rs`

### PolSAR Decomposition
**Problem:** Visualize what physical scattering mechanisms are present (urban vs forest vs water).

**Solution:** Pauli basis decomposition mapping HH, VV, HV polarizations to RGB channels.

**File:** `sar_processor/src/polsar.rs`

---

## Phase 4: The API Gateway

### The Problem
We now had a powerful CLI binary. But scientists don't want to use a terminal. We needed to bridge the processor to a web browser.

### What We Built
`sar-gateway` — An Axum + Tokio HTTP server that:
1. Accepts REST requests from the browser.
2. Spawns `sar_processor` as a child process.
3. Captures its stdout/stderr in real-time.
4. Broadcasts log lines to the browser via Server-Sent Events (SSE).
5. Serves the generated PNG files statically.
6. Parses structured JSON events from the processor's stdout (like `{"event":"georef","bbox":{...}}`) to extract geolocation data.

### Dual-Mode Architecture
The gateway supports two modes:
- **Local Mode (`LOCAL_MODE=true`, default):** Spawns `sar_processor` as a subprocess. Perfect for data sovereignty — raw SAR files never leave the user's machine.
- **K8s Mode (`LOCAL_MODE=false`):** Creates a `SarJob` Custom Resource via `kube-rs`. The Kubernetes Operator handles pod scheduling and execution.

### Files Created
```
sar-gateway/src/main.rs       (Router + AppState)
sar-gateway/src/handlers.rs   (REST endpoints + SSE streaming)
sar-gateway/src/jobs.rs       (Local subprocess + K8s CRD execution)
sar-gateway/src/models.rs     (Request/Response structs)
sar-gateway/src/esa_client.rs (ESA Copernicus API)
sar-gateway/src/nasa_client.rs(NASA ASF STAC API)
```

---

## Phase 5: The React Dashboard

### The Problem
Scientists need a visual interface: a map to see results, a terminal to watch processing, and buttons to configure pipelines.

### What We Built
`sar-dashboard-v3` — A React + Vite SPA featuring:
1. **Connection Setup:** Health-check ping to verify the local gateway is running.
2. **Data Source Selection:** Choose between a local file path or searching NASA's ASF catalog.
3. **Pipeline Configuration:** Toggle switches for InSAR, CFAR, PolSAR.
4. **Real-Time Terminal:** SSE-powered black terminal that streams processor logs live.
5. **Leaflet Map:** Drapes the generated PNG over the correct geographic coordinates using `<ImageOverlay>`.
6. **In-App Documentation:** A full technical docs viewer (DocsPage.jsx) with KaTeX math rendering.

### Architecture Decision: Cloud Frontend + Local Backend
We made a deliberate security decision: the React app is hosted globally on GitLab Pages, but it sends API calls to `localhost:3000`. This means:
- **Zero data upload.** Raw SAR imagery (potentially classified/sensitive) never leaves the user's machine.
- **Global accessibility.** Any scientist can access the dashboard from any browser.
- **Data sovereignty.** Processing happens entirely on the user's hardware.

---

## Phase 6: Kubernetes Operator (Enterprise Mode)

### The Problem
For large-scale deployments (processing hundreds of scenes), a single laptop isn't enough.

### What We Built
`sar_operator_v2` — A custom Kubernetes controller written in Rust using `kube-rs`:
1. Watches for `SarJob` Custom Resources.
2. Creates Kubernetes `batch/v1::Job` pods with the processor binary.
3. Injects scene parameters as environment variables.
4. Updates CRD status as pods progress (Pending → Processing → Completed/Failed).

> **Note:** The K8s infrastructure files (manifests, Terraform, Kind, Flux) have been archived in `Docs/Archive/` since the current focus is local-mode deployment.

---

## Phase 7: CI/CD & Deployment

### GitLab Pipeline (`.gitlab-ci.yml`)
The pipeline runs automatically on every `git push`:
1. **`build_rust`** — Compiles the processor with `cargo build --release`.
2. **`test_rust`** — Runs `cargo test`.
3. **`audit_rust`** — Runs `cargo audit` for dependency security vulnerabilities.
4. **`pages`** — Builds the React dashboard with `GITLAB_PAGES=true` and deploys to GitLab Pages.
5. **`build_docs`** — Generates and deploys this technical documentation.

---

## Phase 8: Milestone 2 — Tiled GeoTIFFs & Tile Streaming

### The Problem
Static PNGs worked for small scenes, but they break down at full resolution. A 30,000 × 20,000 pixel image cannot be displayed as a single `ImageOverlay` in Leaflet without crashing the browser or losing all detail.

### What We Built
We implemented a **Cloud Optimized GeoTIFF (COG) workflow** to enable deep-zoom tile streaming:

1. **`save_sar_geotiff` (Pure Rust)** — Instead of relying on heavy C++ libraries like GDAL, we built a custom GeoTIFF writer inside `io.rs`. It handles:
   - **Internal Tiling:** Chops the image into 256×256 tiles inside the TIFF file for fast random access.
   - **Geotag Injection:** Manually injects `ModelTransformationTag` (34264) and `GeoKeyDirectoryTag` (34735) into the TIFF IFD to define the EPSG:4326 geographic projection.
   - **Y-Axis Correction:** Uses a negative scale in the transformation matrix to ensure "north-up" orientation.
2. **TiTiler Integration (Planned/In Progress)** — Pointing the frontend to a TiTiler sidecar that reads these GeoTIFFs and serves Web Mercator tiles dynamically.
3. **Frontend Upgrade:** Transitioning from Leaflet's `ImageOverlay` to a high-performance `TileLayer` for smooth, cinematic zooming into SAR details.

---

## Phase 9: Milestone 3 — InSAR Pipeline Overhaul (Completed)

### The Problem
The original InSAR processing implementation lacked the robustness needed for true production workloads. Coherence estimation was $O(n^2 \cdot w^2)$, coregistration was rudimentary, and raw unwrapped phase from external sources (such as NASA's GUNW products) was heavily distorted by phase unwrapping errors, low-coherence water noise, and regional orbital/topographic ramps.

### What We Built
We executed a complete overhaul of the InSAR and GUNW processing engine:
1. **O(n²) Coherence Estimation**: Rewrote coherence using Summed-Area Tables (integral images) for lightning-fast performance independent of window size.
2. **Rayon Multi-looking**: Implemented parallelized block-averaging to reduce dimensions and speckle.
3. **Sub-pixel Coregistration**: Implemented global FFT cross-correlation with parabolic peak refinement and sinc-interpolation resampling.
4. **Goldstein Phase Filter**: Added an adaptive spectral filter using overlap-add block processing to reduce phase noise in low-coherence regions.
5. **Connected Components Masking**: Automatically detects the `connectedComponents` dataset in GUNW HDF5 files and masks pixels where `CC == 0` to `NaN`, effectively eliminating discrete $2\pi$ phase unwrapping jumps.
6. **Low-Coherence Proxy Masking**: Masks out low-coherence regions ($\gamma < 0.3$), preventing decorrelation noise from open water bodies and dense vegetation from creating false displacement anomalies.
7. **Iterative Robust Quadratic Deramping**: Implemented an iterative least-squares quadratic phase ramp fit. By utilizing a 3-iteration robust outlier rejection loop with Median Absolute Deviation (MAD) dispersion calculations ($2.5\sigma$ threshold), we successfully isolate local deformations (like reservoirs and structural movements) from the regional orbital and topographic phase ramp background.

---

## Phase 10: InGARSS 2026 Flood Inundation & Damage Mapping Engine

### The Problem
Floods in South Asia (e.g. Bihar Ganga plain, Brahmaputra valley) occur during heavy monsoon cloud cover, rendering optical satellites (Sentinel-2, Landsat) useless. Radar penetrates clouds, but specular reflection off open water can be confused with flat tarmac, sand, or calm soil. Furthermore, Section 6 of the InGARSS 2026 Hackathon specification mandates a strict 4-class temporal dynamics model comparing pre-flood (Baseline) and monsoon (Active) acquisitions.

### What We Built
We implemented a scientifically verified, non-ML multi-temporal SAR flood engine (`sar_science_processor/src/flood_detect.rs`):
1. **Calibrated Log-Ratio Change**: Computes active-to-baseline backscatter drop: $\Delta\text{dB} = \text{active}_{\text{dB}} - \text{baseline}_{\text{dB}}$.
2. **Adaptive Otsu Variance Maximization**: Derives an unsupervised, scene-specific threshold $t^*$ from the bimodal change histogram, bounded by a $-3.0\text{ dB}$ safety floor.
3. **Two-Threshold Seeded Region Growing**: Seeds deep water cores at $T_{\text{seed}} = -5.0\text{ dB}$ and expands to $T_{\text{growth}} = -2.5\text{ dB}$, eliminating isolated speckle while preserving true flood contours.
4. **Section 6 Temporal Dynamics & Class 5 Receded Water**:
   - Class 0: Stable Land (Slate `#64748b`)
   - Class 1: Stable Water Body (Cyan `#00e5ff`)
   - Classes 2–4: Water Gain / New Inundation (Crimson `#ef4444`, Coral `#f97316`, Orange `#fb923c`)
   - Class 5: Water Loss / Receded Water (Warm Amber `#f59e0b` — identifying areas where pre-existing water dried up or receded).
5. **Dual Metric/Imperial Reporting**: Every statistic is reported in both $\text{km}^2$ and acres ($1\text{ ac} = 0.004046856\text{ km}^2$).

---

## Phase 11: The 1.157 Billion Pixel Breakthrough

### The Problem
Real NISAR swaths over the Ganga Alluvial Plain in Bihar cover $33,696 \times 34,344$ pixels (1.157 billion pixels per date). Ingesting two float32 scenes into RAM requires over 30 GB, causing instant out-of-memory crashes on developer workstations and edge micro-instances.

### What We Built
1. **The 8×8 Integer Lattice Alignment**:
   - Discovered that all dimensions of L-band ($33,696 \times 34,344$), S-band ($33,120 \times 34,200$), and origin offsets are exact integer multiples of 8.
   - At $8\times 8$ block multilooking ($80\text{ m}$ ground lattice), the L-band scene downsamples from 1.157B pixels to $4,212 \times 4,293$ ($18.08\text{M}$ pixels = **72 MB** per array).
2. **Zero-Copy Memory-Mapped Streaming (`ChunkedF32Reader`)**:
   - Reads 1,024-row horizontal hyperslabs directly from HDF5 chunks via `MmapFile` and B-tree index caching.
   - Multilooks each strip on the fly and immediately reclaims raw buffer memory.
   - Ingests **2.31 billion raw observations in 63 seconds** with a peak memory footprint of just **1.79 GB RAM**.

---

## Phase 12: Tactical Operations Deck & Interactive Flood Replay

### The Problem
A 1.157B pixel scientific engine is useless if disaster response teams cannot inspect the results interactively with sub-second responsiveness.

### What We Built
1. **Zustand Store Unification**: Decoupled `AppDashboard.jsx` into three dedicated stores (`useGatewayStore`, `useMapStore`, `useJobStore`), eliminating unnecessary re-renders.
2. **Interactive `FloodEventReplay`**: Created a 3-phase temporal animation controller (`baseline` $\to$ `active` $\to$ `detected`), enabling analysts to switch between pre-flood radar imagery, monsoon inundation, and the classified flood mask with zero black-screen flicker.
3. **Map Layer Toggles**: Added 5 custom sliding switches for Class 1 through Class 5 with instant cache-invalidated GeoJSON re-styling.
4. **Historical Job Preloading**: The Axum gateway automatically preloads completed runs from disk on boot, making showcase datasets immediately accessible.

---

## Current Repository Structure
```
sar_analyzer/
├── sar_science_processor/      → Pure-Rust SAR science & flood compute engine (RDA, InSAR, Flood)
│   └── src/                    → flood_detect.rs, windowed.rs, nisar_parser.rs, insar.rs, io.rs
│
├── sar-gateway/                → Axum HTTP server (REST + SSE, preloader, job supervisor)
│   └── src/                    → main.rs, jobs.rs, handlers.rs, models.rs
│
├── sar-dashboard-v3/           → React 19 + Leaflet tactical control deck
│   └── src/                    → AppDashboard.jsx, flood/, layout/, stores/
│
├── sar_processor/              → CLI worker builds
│
└── Docs/                       → Authoritative documentation
    ├── Architecture/           → System internals, diagrams, and mathematical specs
    ├── FloodWalkthrough/       → Beginner-friendly walkthrough of flood algorithms
    ├── UserGuide/              → Operational guides, setup, and verification logs
    └── Blog/                   → Engineering breakthroughs & benchmarks
```

---

## What's Next
- **Dual-Frequency L+S Band Fusion**: Co-registering L-band and S-band NISAR datasets to suppress false alarms from soil moisture and urban structures.
- **Interactive Cluster Click-to-Fly**: Clicking a flood cluster in the sidebar automatically flies the Leaflet camera to its centroid and highlights its boundary.
- **Cloud-Native WebAssembly (Wasm) Reader**: Compiling the `ChunkedF32Reader` to WebAssembly for browser-side partial HDF5 inspection.
