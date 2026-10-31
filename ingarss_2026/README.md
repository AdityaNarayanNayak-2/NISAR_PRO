# InGARSS 2026 — Phase 1 Hackathon Submission Package
## NISAR Flood Inundation & Damage Mapping Platform (`NISAR Pro`)

Welcome to the official InGARSS 2026 Phase-1 submission package for **NISAR Flood Inundation & Multi-Temporal Damage Mapping**.

---

##  Package Directory Layout

```
ingarss_2026/
├── README.md                      ← Executive briefing & evaluation guide (You are here)
├── bin/
│   └── sar_science_processor      ← Standalone precompiled high-performance Linux binary
├── notebooks/
│   └── NISAR_Bihar_Flood_Lifecycle.ipynb ← 1-click Jupyter Notebook for academic judges & evaluators
├── scripts/
│   └── run_flood_pipeline.py      ← Lightweight Python runner invoking the Rust engine
├── results/                       ← Showcase full-scene Bihar swath artifacts
│   ├── flood_expansion_aug31_sep12/  ← Phase 1: Flood Inundation / Water Gain (1,173 km²)
│   ├── flood_recession_sep12_oct18/  ← Phase 2: Flood Recession / Water Loss (2,652 km²)
│   └── dual_frequency_aug31/         ← Phase 3: L-Band vs S-Band Dual-Frequency Co-Registration
└── docs/                          ← Mathematical derivations, Otsu proofs, and benchmarks
```

---

##  Key Scientific & Engineering Highlights

### 1. InGARSS 2026 Section 6: Temporal Dynamics
Every pixel is classified into the strict Section 6 temporal classes:
* **Class 0**: Stable Non-Water Land (Slate `#64748b`)
* **Class 1**: Stable Water Body (Cyan `#00e5ff`)
* **Classes 2–4**: Water Gain / New Inundation (Crimson `#ef4444`, Coral `#f97316`, Orange `#fb923c`)
* **Class 5**: Water Loss / Receded Water (Warm Amber `#f59e0b`)

### 2. Multi-Temporal 4-Epoch Hydrological Lifecycle
Instead of a simple 2-date comparison, this submission demonstrates the complete lifecycle of the Bihar Ganga flood:
* **Expansion Phase (Aug 31 $\to$ Sep 12)**: Captures $1,173.61\text{ km}^2$ ($290,006\text{ acres}$) of new flood inundation across agricultural plains.
* **Recession Phase (Sep 12 $\to$ Oct 18)**: Captures $2,652.28\text{ km}^2$ ($655,391\text{ acres}$) of receded floodwaters retreating back to the riverbed.
* **Permanent Channel Consensus**: Identifies the true permanent Ganga river channel, eliminating wet-baseline bias.

### 3. The 1.157 Billion Pixel Breakthrough
* **Zero Out-of-Memory (OOM) Guarantee**: Ingests full $33,696 \times 34,344$ NISAR GCOV swaths in 1,024-row horizontal hyperslabs directly from HDF5 chunks (`ChunkedF32Reader`).
* **Performance Benchmark**: Streams and downsamples **2.31 billion raw observations in 63 seconds with 1.79 GB peak RAM** on standard hardware.

---

##  Quick Start for Evaluators

### Option A: Interactive Jupyter Notebook
```bash
jupyter notebook notebooks/NISAR_Bihar_Flood_Lifecycle.ipynb
```

### Option B: Standalone Python Runner
```bash
python scripts/run_flood_pipeline.py --mode evaluate
```

### Option C: Direct Engine Execution
```bash
./bin/sar_science_processor --mode flood --crop-preset full \
  --input /path/to/active.h5 \
  --slave /path/to/baseline.h5 \
  --output ./results/my_flood_run
```
