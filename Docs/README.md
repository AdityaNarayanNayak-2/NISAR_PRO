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
| 🗺️ [Platform Architecture & Ecosystem Blueprint](./Architecture/architecture-diagrams.md) | Mermaid topology, dual-path InSAR pipeline, math foundations, air-gapped security, multi-mission roadmap. | Topology, pipeline, security |
| 🛤️ [Project Journey](./Architecture/project_journey.md) | Timeline of design iterations, architectural shifts, and technical decisions. | Evolution, tech choices |
| 🎛️ [Gateway Internals](./Architecture/sar_gateway_internals.md) | Thread safety, tokio-spawn local supervisors, K8s CRD job interfaces. | Axum, SSE, jobs scheduler |
| 🎛️ [Gateway Orchestration Walkthrough](./Architecture/gateway_orchestration.md) | Line-by-line breakdown of Axum routes, job spawning, and SSE log streaming. | Axum, tokio, SSE |
| 🔬 [SAR Processor Internals](./Architecture/sar_processor_internals.md) | Pure-Rust math engine, HDF5 parsing, and GeoTIFF generation. | ndarray, rustyhdf5, deramping |
| 🦀 [Processor Code Walkthrough](./Architecture/sar_processor_walkthrough.md) | Exhaustive line-by-line guide of main.rs execution loops and module bindings. | Rust, Rayon, H5 |
| 📥 [Processor Ingestion & Subsetting](./Architecture/processor_ingestion.md) | CLI parsing, HDF5 reads, spatial cropping, invalid-pixel masking. | clap, rustyhdf5, read-then-slice (no hyperslabs) |
| 🧮 [Core SAR Mathematics](./Architecture/core_sar_mathematics.md) | Interferogram & coherence (SAT), quality-guided phase unwrapping, deramping, CA-CFAR ship detection. | Rust, Rayon, CFAR, SAT |
| 📤 [Data Export & Health Analysis](./Architecture/data_export_and_health.md) | PS-InSAR MAD thresholding, raw GeoTIFF construction, SSE emission. | IFD tags, JSON, stdout |
| 🌊 [Flood Detection Pipeline](./Architecture/flood_detection_pipeline.md) | End-to-end 7-stage flood/inundation engine, output exporters, gateway + dashboard integration. | flood_detect.rs, exporters |
| 🌊 [GUNW Data Flow](./Architecture/gunw_data_flow.md) | End-to-end trace of a GUNW file from upload to Leaflet and TiTiler rendering. | HDF5, Axum, udev, flow |
| 🖥️ [Dashboard Internals](./Architecture/sar_dashboard_internals.md) | Leaflet map layer structures, localStorage API bridges, TiTiler COG pipelines. | react-leaflet, sslip.io, state |

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

Note: `Docs/Archive/` and `Docs/Hireme/` are historical/out-of-band material and are not part of the active documentation index.