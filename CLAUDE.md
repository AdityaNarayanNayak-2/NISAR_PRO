# NISAR Pro — Official Engineering Brain & System Contract
> **Auto-loaded by Claude Code / AI Agents on every session.**
> **Mission**: InGARSS 2026 Phase-1 Hackathon (NASA-ISRO SAR Flood Inundation & Damage Mapping).
> **Status**: Verified production pipeline running on consumer hardware (1.157 Billion pixels processed in 63s @ 1.79 GB peak RAM).

---

## 1. System Architecture & Directory Layout

NISAR Pro is split into three high-performance tiers:

```
sar_analyzer/
├── sar_science_processor/   # [Tier 1] Pure Rust SAR scientific engine (Rayon, chunked HDF5, Otsu, 4-class flood detection)
├── sar-gateway/             # [Tier 2] Axum + Tokio backend (0.0.0.0:3000), SSE log streaming, persistent job preloading
├── sar-dashboard-v3/        # [Tier 3] React 19 + Vite + Leaflet web dashboard, dark-mode geospatial UI
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
     - **Performance**: Ingests the entire 1.157B pixel Bihar scene in **63 seconds** with **1.79 GB peak RAM**.
  3. **DO NOT revert to monolithic full-array reads** or claim full tiles cannot run on 8 GB RAM.

---

## 3. InGARSS 2026 Section 6: 4-Class Temporal Flood Partition

The flood engine (`sar_science_processor/src/flood_detect.rs`) does NOT just do binary water classification. It maps full temporal dynamics between Date 1 (Baseline) and Date 2 (Active/Flood):

| Class | Category | Condition | UI Color & Hex |
|---|---|---|---|
| **0** | **Stable Non-Water Land** | Non-water at both dates | Slate `#64748b` |
| **1** | **Stable Water Body** | Water at both dates | Cyan `#00e5ff` |
| **2** | **Newly Inundated (High Conf)** | Change $\le \text{Otsu}$ & high backscatter drop | Crimson `#ef4444` |
| **3** | **Newly Inundated (Med Conf)** | Change $\le \text{Threshold}$ via region growing | Coral `#f97316` |
| **4** | **Newly Inundated (Low Conf)** | Secondary water classification | Orange `#fb923c` |
| **5** | **Water Loss / Receded Water** | Baseline $< -15\text{dB}$, Active $\ge -15\text{dB}$, $\Delta\text{dB} \ge +3.0\text{dB}$ | Warm Amber `#f59e0b` |

### Measurement Units Rule
- Every metric in UI panels, reports, and logs MUST provide **dual units**:
  - $\text{km}^2$ (Metric)
  - Acres (Imperial)
  - Conversion: $1\text{ acre} = 0.004046856\text{ km}^2$.

---

## 4. Visual & UI System Rules

### A. Flood Event Replay (`FloodEventReplay.jsx`)
- Supports 3 sequential timeline phases:
  1. `baseline`: Renders pre-flood radar observation (`*_flood_baseline.png`).
  2. `active`: Renders post-flood radar observation (`*_flood_active.png`).
  3. `detected`: Renders active SAR background at 0.65 opacity with the derived flood detection mask (`*_flood.png`) overlaid on top.
- **De-duplication**: When `viewingResult.floodReplayAvailable` is true, `AppDashboard.jsx` delegates image overlay rendering **exclusively** to `FloodEventReplay`. Do NOT render duplicate `ImageOverlay` elements in `AppDashboard.jsx`.
- **Playback**: Pressing `PLAY` at the end (`phaseIndex === 2`) rewinds to `baseline` and plays. `REPLAY` rewinds to index 0 and immediately triggers playback.

### B. SAR Radar Imagery & Transparency (`io.rs`)
- In `save_sar_image`:
  - NISAR GCOV pixel values are **real linear powers** ($\sigma^0$ or $\gamma^0$). Do NOT square them again.
  - Zero / no-data pixels outside the rotated satellite swath MUST be excluded from percentile contrast calculations ($p_2$ and $p_{98}$).
  - SAR preview images MUST be saved as **transparent RGBA PNGs**:
    - Valid swath: Crisp grayscale $0\text{–}255$, $\text{alpha} = 255$.
    - No-data / border: $\text{alpha} = 0$ (transparent).

### C. API Client (`api.js`)
- `api(path)` MUST check if `path` is already an absolute URL (`http://`, `https://`, `blob:`, `data:`). Never prepend gateway base if it is already absolute.

---

## 5. Showcase Datasets (Preserved & Organised)

The repository keeps two clean, canonical showcases in `sar-gateway/results/`:
1. **`sar-bihar-lband-full` (Primary Hackathon Showcase)**:
   - Location: Ganga Alluvial Plain (Begusarai–Khagaria), Bihar, India.
   - Products: `2026-09-12` (Active) vs `2026-07-26` (Baseline) LSAR GCOV.
   - Total Area: $115,725.5\text{ km}^2$ ($28.6\text{M}$ acres).
   - Inundated: $2,501.63\text{ km}^2$ ($618,165\text{ ac}$).
   - Receded: $2,184.10\text{ km}^2$ ($539,702\text{ ac}$).
2. **`assam_flood_pair` (Secondary Showcase)**:
   - Location: Brahmaputra Valley (Dibrugarh–Dhemaji Sector), Assam, India.
   - $20\text{ km} \times 20\text{ km}$ crop preset.

**Note**: Do NOT reintroduce Kundra test files or arbitrary multi-hundred MB scratch `.tif` dumps into `results/`.

---

## 6. How to Build & Verify

### Running Unit Tests
```bash
cd sar_science_processor
cargo test
# All 70 unit tests must pass: 70 passed; 0 failed
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
