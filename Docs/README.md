# NISAR Pro Documentation Hub

Welcome to the documentation index for **NISAR Pro** — a high-performance Synthetic Aperture Radar (SAR) processing platform. This directory acts as the central map for developers, operators, and DevOps engineers navigating the technical architecture, algorithms, and deployment workflows.

> TIP: The dashboard also renders these documents at the `/docs` route — the same markdown, live.

---

## 📚 Documentation Index

### 🏁 1. Operational & Setup Guides (`Docs/UserGuide/`)
Step-by-step instructions on setting up, running, and verifying the platform.

| Document | Description | Target Audience |
| :--- | :--- | :--- |
| 🪟 [Getting Started](./UserGuide/getting-started.md) | Prerequisites, clone, running the dashboard and gateway, and environment variables. | Developers |
| 💻 [Windows Local Run](./UserGuide/windows-local-run.md) | The recommended PowerShell workflow: build once, gateway on port 3000, dashboard on 5173. | Developers / Operators |
| 🛰️ [Friendly User Guide](./UserGuide/userguide.md) | Companion manual: install, GCOV vs GUNW cheat sheet, monitoring a dam, the math made simple, troubleshooting, keyboard shortcuts. | Everyone |
| 🧪 [Verification & Testing Guide](./UserGuide/verification-guide.md) | Phase-by-phase service startup checks and health verification routines. | QA / DevOps |
| 📝 [InSAR Verification Log](./UserGuide/insar-verification-log.md) | Real-world testing findings (e.g. Upper Kolab Dam run) and historical bug fixes. | QA / Developers |
| ☸️ [Deployment Guide](./UserGuide/DevOpsGuide.md) | Terraform AWS IaC, K3s cluster, Flux CD GitOps, ingress/TLS via sslip.io, GitLab CI, and a monthly cost breakdown. | DevOps Engineers |
| 🧱 [Dam & Infrastructure Monitoring](./UserGuide/dam_monitoring.md) | Reservoir safety, virtual sensor concept, processing workflow, and visualization. | Operators / Analysts |
| 🔌 [API Reference](./UserGuide/api-reference.md) | Gateway REST endpoints, SSE schemas, and payload specifications. | Integrators / Devs |

---

### 🏗️ 2. Architectural Design (`Docs/Architecture/`)
Deeper dives into the structural layout and internals of individual system modules. Algorithm math (coherence, phase unwrapping, deramping, and ship-detection CFAR) is covered in [Core SAR Mathematics](./Architecture/core_sar_mathematics.md); the 7-stage flood engine in [Flood Detection Pipeline](./Architecture/flood_detection_pipeline.md).

| Document | Description | Key Topics Covered |
| :--- | :--- | :--- |
| 🗺️ [Platform Architecture & Ecosystem Blueprint](./Architecture/architecture-diagrams.md) | Mermaid topology, dual-pipeline engine (Flood & InSAR), 1.157B pixel breakthrough, 4-class dynamics. | Topology, InGARSS 2026, dual pipeline |
| 🌊 [Flood Detection Pipeline](./Architecture/flood_detection_pipeline.md) | InGARSS 2026 4-class temporal dynamics, 1.157B pixel hyperslab streaming, RGBA PNG/GeoJSON/GeoTIFF. | flood_detect.rs, 4-class, 8x8 multilook |
| 🧮 [Core SAR Mathematics](./Architecture/core_sar_mathematics.md) | Coherence SAT, phase unwrapping, deramping, CFAR, calibrated log-ratio, Otsu change detection. | Math, SAT, Otsu, log-ratio |
| 🎛️ [Gateway Orchestration](./Architecture/gateway_orchestration.md) | Axum routes, thread safety, job spawning, SSE log streaming, preloaded historical runs. | Axum, Tokio, SSE, preloading |
| 📥 [Processor Ingestion, Windowing & Hyperslab Streaming](./Architecture/processor_ingestion.md) | CLI parsing, memory-mapped chunk indexing, spatial cropping, 1.157B pixel full-scene streaming. | clap, ChunkedF32Reader, hyperslabs |
| 🖥️ [Dashboard Internals](./Architecture/sar_dashboard_internals.md) | React 19 + Leaflet tactical operations deck, FloodInsightPanel, FloodEventReplay, presets, hotkeys. | react-leaflet, Zustand, replay |
| 🌊 [GUNW Data Flow](./Architecture/gunw_data_flow.md) | End-to-end trace of a GUNW file from upload to Leaflet displacement rendering. | HDF5, Axum, InSAR flow |
| 📤 [Data Export, Flood Artifacts & Health Analysis](./Architecture/data_export_and_health.md) | Multi-format GeoTIFF, flood PNG/GeoJSON overlays, dual-unit reports, and PS-InSAR health metrics. | GeoTIFF, GeoJSON, dual-unit reports |
| 🛤️ [Project Journey](./Architecture/project_journey.md) | Timeline of design iterations, architectural shifts, and technical decisions. | Evolution, tech choices |
| 📖 [Flood Monitoring Walkthrough](./FloodWalkthrough/README.md) | Comprehensive walkthrough of `main.rs`, `nisar_parser.rs`, `windowed.rs`, `flood_detect.rs`, and `io.rs`. | beginner guide, SAR, dB, HDF5, Otsu |

---

### 🖼️ 3. Diagrams & Assets (`Docs/assets/`)
Visuals referenced throughout the docs — architecture overview, the recommended user workflow, and real flood-run screenshots.

---

## 🗺️ Repository Codebase Map

For reference, the source code components are laid out as follows:

```
nisar_pro/
├── sar_science_processor/  → Pure-Rust SAR science engine (RDA / InSAR / flood detection)
├── sar_processor/          → SAR processing engine builds (CLI worker)
├── sar-gateway/            → Async Axum REST/SSE API gateway (tokio, kube-rs)
├── sar-dashboard-v3/       → React client, Leaflet viewer, /docs route
├── sar_operator_v2/        → Kubernetes operator (job CRDs)
├── Docs/                   → Comprehensive documentation (You are here!)
└── .github/                → Workflow automation
```