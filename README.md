# NISAR Pro — Synthetic Aperture Radar (SAR) Analysis Suite

> **Zero-Upload · Local-First Edge Processing · Dual-Profile Visualization**

A high-performance Synthetic Aperture Radar (SAR) processing platform written in **pure Rust**, designed for the NASA-ISRO NISAR mission ecosystem. From raw HDF5 orbital data to millimeter-level georeferenced displacement maps — without leaving your local environment.

![End-to-End Architecture](Docs/assets/architecture_overview.png)

---

## ⚡ Core Capabilities

| Capability | Technical Realization |
|:---|:---|
| **High-Fidelity Parser** | Multi-channel HDF5 parser handling RSLC, GSLC, GCOV, and GUNW products with zero-copy operations. |
| **InSAR & PS-InSAR** | Phase unwrapping, coherence estimation, and persistent scatterer (PS) identification down to millimeter-scale accuracy. |
| **Millimeter Scaling** | Physical deformation extraction using wavelength-specific phase conversion: $\text{disp}_{mm} = \frac{\phi \cdot \lambda \cdot 1000}{4\pi}$. |
| **Interoperable GeoTIFFs** | Export of results with standard ASCII tags (including GDAL NoData `42113`) for seamless GIS integration. |
| **Integrals-CFAR Detection** | O(1) integral-image-accelerated CA-CFAR target classifier for real-time maritime tracking. |
| **Dynamic Web Dashboard** | Modern React + Leaflet control plane with real-time Server-Sent Events (SSE) streaming logs and TiTiler COG rendering. |

---

## 🏗️ Dual-Profile Architecture

NISAR Pro utilizes a **Cloud-Control / Local-Compute** architecture. The client-side dashboard acts as a control plane while the heavy computation takes place entirely on your local machine, ensuring absolute data sovereignty and security.

```
┌────────────────────────────────────────┐         ┌──────────────────────────────┐
│  Cloud Control Plane (Static SPA)      │  HTTP   │  Local Compute Engine        │
│  ───────────────────────────────────   │ ──────► │  ──────────────────────────  │
│  - GitHub Pages / GitLab Pages Hosting │  :3000  │  - Axum HTTP Gateway (:3000) │
│  - Leaflet Map (TiTiler COG Layer)     │         │  - Rust CLI Processor        │
│  - SSE Live Log Terminal & Legend      │         │  - Raw HDF5 Data Storage     │
└────────────────────────────────────────┘         └──────────────────────────────┘
                                                    ▲ Data never leaves your machine!
```

### 🛰️ 1. Infrastructure Monitoring Profile
* **Target Application**: Structural integrity, land subsidence, and reservoir dam tracking (e.g. Hirakud Dam).
* **Processing Pipeline**: GUNW InSAR fast-path or multi-baseline coherence processing.
* **Visualization**: Interactive colormapped deformation maps (`-20` to `+20` mm scaling) overlaying colored Persistent Scatterer (PS) dots classified by structural risk level (Stable, Caution, Alert, Critical).

### 🔬 2. SAR Science Profile
* **Target Application**: Environmental classification, biomass estimation, and polarimetric land-cover scans.
* **Processing Pipeline**: GCOV covariance processing, amplitude mapping, and polarimetric Pauli RGB decomposition.
* **Visualization**: Raw radar backscatter imagery served as Cloud-Optimized GeoTIFFs (COGs).

---

## 🚀 Quick Start (Local Run)

### System Dependencies
```bash
# Ubuntu / Debian
sudo apt update && sudo apt install -y libhdf5-dev

# macOS (Homebrew)
brew install hdf5
```

### 1. Compile the Compute Engine
```bash
cd sar_processor
cargo build --release
```

### 2. Run the Gateway
```bash
cd ../sar-gateway
LOCAL_MODE=true RUST_LOG=info cargo run --release
```

### 3. Launch the Frontend
The React Dashboard is built and served via Vite:
```bash
cd ../sar-dashboard-v3
npm install
npm run dev
# Open http://localhost:5173/app
```

---

## 📂 Codebase Directory Structure

```
sar_analyzer/
├── sar_processor/          → High-performance Rust compute engine
│   ├── src/
│   │   ├── main.rs         → CLI dispatcher & processor coordinator
│   │   ├── gunw_parser.rs  → NISAR GUNW unwrapped product parser
│   │   ├── nisar_parser.rs → NISAR HDF5 reader & coordinate transformer
│   │   ├── coregister.rs   → Sinc-interpolation sub-pixel image coregistrator
│   │   ├── insar.rs        → Coherence estimator & interferogram generator
│   │   ├── infra_health.rs → Persistent Scatterer classification (PS-InSAR)
│   │   ├── ship_detection.rs → O(1) Integral-image CA-CFAR detector
│   │   └── io.rs           → Cloud-Optimized GeoTIFF & PNG tiles output engine
│   └── archive/            → Legacy modules (RDA, RCMC) kept for reference
│
├── sar-gateway/            → Axum-based web gateway (REST + SSE)
│   └── src/
│       ├── handlers.rs     → HTTP request/response handlers & stream builders
│       └── jobs.rs         → Subprocess job supervisor
│
├── sar-dashboard-v3/       → Modern React + Vite control plane
│   └── src/
│       ├── pages/app/      → AppDashboard, Infrastructure, & SAR Science panels
│       └── config/api.js   → Multi-environment backend URL mapper
│
└── .gitlab-ci.yml          → Parallelized GitLab CI/CD workflow
```

---

## 🔧 CLI Syntax Examples

To run the SAR Processor directly from the terminal:

### 1. Process GUNW InSAR Product (Infrastructure Monitoring)
```bash
./target/release/sar_processor \
  --input /path/to/NISAR_L2_PR_GUNW_..._001.h5 \
  --output ./results/dam_displacement.tif \
  --crop-lat 21.5339 --crop-lon 83.8751 --crop-radius-km 10.0
```

### 2. Process GCOV Product (SAR Science)
```bash
./target/release/sar_processor \
  --input /path/to/NISAR_L2_PR_GCOV_..._001.h5 \
  --output ./results/gcov_science.tif
```

### 3. Run CA-CFAR Ship Detection
```bash
./target/release/sar_processor \
  --input /path/to/scene.h5 \
  --ship-detect \
  --cfar-max-detections 100
```

---

## 📚 Technical Documentation

For a deeper dive into the system implementation, review our technical docs:

* **Architecture**: [Project Journey](Docs/Architecture/project_journey.md) · [Processor Internals](Docs/Architecture/sar_processor_internals.md) · [Gateway Internals](Docs/Architecture/sar_gateway_internals.md)
* **Algorithms**: [CFAR Ship Detection](Docs/Algorithms/cfar_ship_detection.md) · [InSAR Processing](Docs/Algorithms/insar_processing.md)
* **Diagrams**: [System Architecture Diagrams](Docs/Architecture/architecture-diagrams.md)

---

## 🛡️ License

See [LICENSE](LICENSE) for details.
