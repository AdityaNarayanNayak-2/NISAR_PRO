# NISAR Pro — Geospatial Intelligence Platform

> **Zero-Upload · Deterministic · Local-First Processing · Azure Arc Ready**

A full-stack Synthetic Aperture Radar (SAR) processing platform built in **pure Rust**, designed for NASA-ISRO NISAR mission data. From raw HDF5 radar frequencies to georeferenced map overlays — no Python, no MATLAB, no data leaving your machine.

![End-to-End Architecture](Docs/assets/architecture_overview.png)

---

## ✨ Key Capabilities

| Module | What It Does |
|--------|-------------|
| **Range-Doppler Algorithm** | Full RDA pipeline: Range Compression → RCMC (Sinc interpolation) → Azimuth Compression |
| **NISAR HDF5 Parser** | Reads all four NASA product types (RSLC, GSLC, GCOV, GUNW) with compound complex datatypes |
| **CA-CFAR Ship Detection** | O(1) integral-image accelerated maritime target detection with GeoJSON export |
| **InSAR & PS-InSAR** | Interferogram generation, coherence estimation, millimeter-level displacement mapping |
| **PolSAR Decomposition** | Pauli basis RGB mapping (surface / volume / double-bounce scattering) |
| **Infrastructure Health** | Persistent Scatterer analysis with STABLE / CAUTION / ALERT / CRITICAL classification |
| **Real-Time Dashboard** | React + Leaflet map with live SSE terminal streaming processor logs |

---

## 🏗️ Architecture

NISAR Pro uses a **Cloud Frontend + Local Backend** design:

- **Frontend** → Static React SPA hosted on GitLab Pages (accessible globally).
- **Backend** → Rust gateway + processor running on `localhost:3000` (your machine).
- **Result** → Raw SAR data never leaves the user's machine. Zero upload. Full data sovereignty.

![User Workflow](Docs/assets/user_workflow.png)

---

## 🚀 Quick Start (Local Mode)

### Prerequisites
```bash
# Rust toolchain
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# HDF5 development library (required for NISAR data parsing)
sudo apt install libhdf5-dev    # Ubuntu/Debian
brew install hdf5               # macOS

# Node.js v20+ (for the dashboard)
```

### 1. Build the Processor
```bash
cd sar_processor
cargo build --release
```

### 2. Start the Gateway
```bash
cd sar-gateway
RUST_LOG=info cargo run
```

### 3. Launch the Dashboard
```bash
cd sar-dashboard-v3
npm install && npm run dev
# → Open http://localhost:5173
```

### 4. Process Your First Image
1. Open the dashboard → click **"Launch App"**.
2. The connection setup will verify your gateway is running.
3. Select **"Local File"** → paste the path to a NISAR `.h5` file.
4. Click **"Initiate Orbital Scan"** → watch the real-time terminal.
5. The focused SAR image will overlay on the map automatically.

> **No NISAR data yet?** Use `--synthetic` mode:  
> `cd sar_processor && cargo run --release -- --synthetic --output test.png`

---

## 📂 Repository Structure

```
sar_analyzer/
├── sar_processor/          → Pure Rust SAR compute engine (16 source files)
│   └── src/
│       ├── main.rs         → CLI entry point (clap)
│       ├── nisar_parser.rs → NASA HDF5 reader (RSLC/GSLC/GCOV/GUNW)
│       ├── rda.rs          → Range-Doppler Algorithm
│       ├── rcmc.rs         → Range Cell Migration Correction
│       ├── insar.rs        → Interferometry + Coherence
│       ├── ship_detection.rs → CA-CFAR with integral images
│       ├── infra_health.rs → PS-InSAR displacement analysis
│       ├── polsar.rs       → Polarimetric decomposition
│       └── io.rs           → GeoTIFF/PNG/XYZ tiles + Lee filter + CLAHE
│
├── sar-gateway/            → Axum HTTP server (REST + SSE)
│   └── src/
│       ├── handlers.rs     → Endpoints: /jobs, /search, /jobs/:id/logs
│       └── jobs.rs         → Local subprocess OR Kubernetes CRD execution
│
├── sar-dashboard-v3/       → React + Vite + Leaflet frontend
│   └── src/
│       ├── pages/app/AppDashboard.jsx → Main operational dashboard
│       ├── components/DataVisualization.jsx → Leaflet map overlay
│       └── config/api.js   → Gateway URL configuration
│
├── sar_operator_v2/        → Kubernetes CRD controller (kube-rs)
│
├── Docs/                   → Full technical documentation
│   ├── Architecture/       → Component internals + project journey
│   ├── Algorithms/         → CFAR, InSAR math deep dives
│   ├── UseCases/           → Dam monitoring, maritime surveillance
│   └── Guides/             → Getting started, API reference, deployment
│
└── .gitlab-ci.yml          → CI/CD: build, test, audit, deploy to Pages
```

---

## 🔬 Supported Use Cases

- 🚢 **Maritime Surveillance** — Dark vessel detection via CA-CFAR
- 🏗️ **Infrastructure Monitoring** — Dam & bridge displacement via PS-InSAR
- 🌊 **Disaster Response** — Flood mapping & oil spill detection
- 🌲 **Environmental Monitoring** — Biomass estimation via PolSAR
- 🛡️ **Defense & Surveillance** — Change detection and anomaly mapping

---

## 🔧 CLI Reference

```bash
# Standard processing
cargo run --release -- --input ~/data/NISAR_L2_PR_GCOV_*.h5 --output result.png

# Ship detection
cargo run --release -- --input ~/data/scene.h5 --ship-detect

# InSAR (two images)
cargo run --release -- --input master.h5 --insar-slave slave.h5 --output interferogram.png

# Synthetic test (no data needed)
cargo run --release -- --synthetic --output test.png

# XYZ web tiles
cargo run --release -- --input scene.h5 --tiles-dir ./tiles/

# GeoTIFF output (High Resolution)
cargo run --release -- --input scene.h5 --output scene.tif
```

---

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [Project Journey](Docs/Architecture/project_journey.md) | How we built this from scratch — Phase 1 to Phase 7 |
| [Processor Internals](Docs/Architecture/sar_processor_internals.md) | Every Rust source file explained |
| [Gateway Internals](Docs/Architecture/sar_gateway_internals.md) | REST API, SSE streaming, dual-mode execution |
| [Dashboard Internals](Docs/Architecture/sar_dashboard_internals.md) | React components, Leaflet map, state management |
| [CFAR Algorithm](Docs/Algorithms/cfar_ship_detection.md) | Integral image math + detection pipeline |
| [InSAR Processing](Docs/Algorithms/insar_processing.md) | Interferogram + coherence + PS selection |
| [Architecture Diagrams](Docs/Architecture/architecture-diagrams.md) | Mermaid.js diagrams (Azure Docs style) |

---

## 🛡️ Security Model

NISAR Pro follows a **Zero-Upload Architecture**:

```
┌─────────────────────────┐         ┌──────────────────────┐
│  GitLab Pages (Cloud)   │  HTTP   │  User's Local Machine│
│  ─────────────────────  │ ──────► │  ──────────────────── │
│  Static React SPA       │  :3000  │  sar-gateway (Axum)  │
│  (No data, no secrets)  │         │  sar_processor       │
│                         │         │  Raw HDF5 files      │
└─────────────────────────┘         └──────────────────────┘
                                     ↑ Data never leaves
```

- Raw SAR imagery stays on the user's disk.
- The cloud-hosted dashboard acts only as a control plane.
- No server-side storage. No authentication tokens for data access.

---

## 📄 License

This project is licensed under the terms specified in the [LICENSE](LICENSE) file.
