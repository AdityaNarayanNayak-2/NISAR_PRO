# NISAR Pro Documentation Hub

Welcome to the documentation index for **NISAR Pro** — a high-performance Synthetic Aperture Radar (SAR) processing platform. This directory acts as the central map for developers, operators, and DevOps engineers navigating the technical architecture, algorithms, and deployment workflows.

---

## 📚 Documentation Index

### 🏁 1. Operational & Setup Guides (`Docs/Guides/`)
Step-by-step instructions on setting up, operating, testing, and deploying the application.

| Document | Description | Target Audience |
| :--- | :--- | :--- |
| 🚀 [Getting Started](./Guides/getting-started.md) | Setup local environments, compile binary dependencies, run developer servers. | Developers |
| 📡 [InSAR Analyst Guide](./Guides/insar_analyst_guide.md) | Operations manual for monitoring reservoir dam displacement and land deformation. | Operators / Analysts |
| 🔌 [API Reference](./Guides/api-reference.md) | Detailed endpoints, SSE schemas, and payload specifications for the gateway. | Integrators / Devs |
| ☸️ [Deployment Guide](./Guides/deployment.md) | Infrastructure provision via Terraform, K3s, and Flux CD GitOps loops on AWS. | DevOps Engineers |
| 🧪 [Verification Guide](./Guides/verification-guide.md) | Automated and manual validation routines for core engine services. | QA / DevOps |
| 📝 [InSAR Verification Log](./Guides/insar-verification-log.md) | Real-world testing findings (e.g. Upper Kolab Dam run) and historical bug fixes. | QA / Developers |
| 🔬 [ISCE3 Integration](./Guides/isce3-integration.md) | Architecture notes on integration options with NASA-JPL's C++ ISCE3 library. | Radar Scientists |

---

### 🏗️ 2. Architectural Design (`Docs/Architecture/`)
Deeper dives into the structural layout and internals of individual system modules.

| Document | Description | Key Topics Covered |
| :--- | :--- | :--- |
| 🗺️ [Project Journey](./Architecture/project_journey.md) | Timeline of design iterations, architectural shifts, and technical decisions. | Evolution, Tech choices |
| 📐 [Architecture Diagrams](./Architecture/architecture-diagrams.md) | Mermaid visuals of data pathways, component relationships, and deployment trees. | Topology, UML |
| 🔬 [Processor Internals](./Architecture/sar_processor_internals.md) | Low-level design of the pure-Rust math engine, HDF5 parsing, and GeoTIFF generation. | ndarray, rustyhdf5, deramping |
| 📥 [Processor Ingestion Walkthrough](./Architecture/processor_ingestion.md) | Trace of CLI parsing, HDF5 reads, spatial cropping, and invalid pixel masking. | clap, rustyhdf5, hyperslabs |
| 🧮 [Core SAR Mathematics Walkthrough](./Architecture/core_sar_mathematics.md) | Deep dive into 2D deramping, phase unwrapping algorithms, SAT, and CFAR. | Rust, Rayon, CFAR, SAT |
| 📤 [Data Export & Health Walkthrough](./Architecture/data_export_and_health.md) | Breakdown of PS-InSAR MAD thresholding, raw GeoTIFF construction, and SSE emission. | IFD Tags, JSON, stdout |
| 🦀 [Processor Code Walkthrough](./Architecture/sar_processor_walkthrough.md) | Exhaustive line-by-line guide of main.rs execution loops and supportive module bindings. | Rust variables, Rayon, H5 |
| 🎛️ [Gateway Internals](./Architecture/sar_gateway_internals.md) | Thread safety design, tokio-spawn local supervisors, and K8s CRD job interfaces. | Axum, SSE, jobs scheduler |
| 🎛️ [Gateway Orchestration Walkthrough](./Architecture/gateway_orchestration.md) | Line-by-line breakdown of Axum routes, job spawning, and SSE logs. | Axum, tokio, SSE |
| 🖥️ [Dashboard Internals](./Architecture/sar_dashboard_internals.md) | Leaflet map layer structures, localStorage API bridges, and TiTiler COG pipelines. | react-leaflet, sslip.io, state |
| 🌊 [GUNW Data Flow](./Architecture/gunw_data_flow.md) | End-to-end trace of a GUNW file from upload to Leaflet and TiTiler rendering. | HDF5, Axum, udev, flow |
| 📊 [Feasibility Analysis](./Architecture/feasibility_analysis.md) | Hardware requirements, memory footprints, and compute profiles for SAR science. | CPU/RAM margins, storage |

---

### 🧮 3. Core Algorithms (`Docs/Algorithms/`)
Mathematical formulations, signal processing kernels, and classifier details.

| Document | Description | Core Math |
| :--- | :--- | :--- |
| ⛰️ [InSAR Processing](./Algorithms/insar_processing.md) | Coherence estimation, baseline subtraction, phase unwrapping, and millimeters-scaling. | Wavelength phase conversion |
| 🚢 [CFAR Ship Detection](./Algorithms/cfar_ship_detection.md) | O(1) constant-time CA-CFAR classifier accelerated by Summed Area Tables (Integral Images). | Thresholding, Pfa, SAT bounds |

---

### 🌾 4. Operational Use Cases (`Docs/UseCases/`)
Domain applications and profiles mapped to regional targets.

| Document | Description | Primary Targets |
| :--- | :--- | :--- |
| 🧱 [Dam & Infrastructure Monitoring](./UseCases/dam_monitoring.md) | Reservoir safety tracking, displacement severity levels, and structural alerts. | Earthen/masonry dams |
| ⚓ [Maritime Surveillance](./UseCases/maritime_surveillance.md) | Vessel tracking, dark ship detection, and coastal traffic monitoring. | EEZs, open sea lanes |

---

## 🏗️ Repository Codebase Map

For reference, the source code components are laid out as follows:

```
sar_analyzer/
├── sar_processor/      → High-performance pure-Rust compute engine (ndarray, rustyhdf5)
├── sar-gateway/        → Async Axum REST/SSE api gateway (tokio, udev, kube-rs)
├── sar-dashboard-v3/   → React client, Leaflet viewer, theme panels, connection checkers
├── infra/              → Terraform files for provisioning AWS EC2, VPC, and GP3 EBS volumes
├── k8s/                → Kubernetes deployment manifests and Flux CD GitOps sync policies
└── Docs/               → Comprehensive documentation (You are here!)
```
