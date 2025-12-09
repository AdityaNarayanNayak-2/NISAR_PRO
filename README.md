# nisar_pro

# SAR Analyzer Documentation

Welcome to the SAR Analyzer documentation. This platform processes Synthetic Aperture Radar (SAR) data from multiple space agencies (ESA, ISRO, NASA) for Earth observation and analysis.

## 📚 Documentation Index

| Document | Description |
|----------|-------------|
| [Getting Started](./getting-started.md) | Setup your development environment |
| [Architecture](./architecture.md) | System design and component overview |
| [API Reference](./api-reference.md) | Gateway API endpoints |
| [Deployment Guide](./deployment.md) | Deploy to Kubernetes |
| [Contributing](./contributing.md) | How to contribute to this project |

## 🏗️ Project Structure

```
sar_analyzer/
├── sar-dashboard-v3/     # Frontend (React + Vite + Spline 3D)
├── sar-gateway/          # API Gateway (Rust + Axum)
├── sar_processor/        # SAR Data Processor (Rust)
├── sar_operator_v2/      # Kubernetes Operator (Rust + kube-rs)
├── k8s_manifests/        # Kubernetes YAML files
├── clusters/             # Flux CD GitOps config
└── Docs/                 # You are here
```

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React, Vite, Spline 3D, Framer Motion |
| Backend | Rust, Axum, Tokio |
| Container | Podman, Docker |
| Orchestration | Kubernetes (Kind for local) |
| GitOps | Flux CD |
| CI/CD | GitLab CI |
| Registry | GitLab Container Registry |

## 🔗 Quick Links

- **GitLab Repository**: [gitlab.com/Aditya-Narayan-Nayak/nisar_pro](https://gitlab.com/Aditya-Narayan-Nayak/nisar_pro)
- **ESA Copernicus**: [dataspace.copernicus.eu](https://dataspace.copernicus.eu)


# Getting Started

This guide will help you set up your local development environment.

## Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Rust | 1.70+ | Backend development |
| Node.js | 20+ | Frontend development |
| Podman/Docker | Latest | Container builds |
| Kind | Latest | Local Kubernetes |
| kubectl | Latest | Cluster management |

## 1. Clone the Repository

```bash
git clone https://gitlab.com/Aditya-Narayan-Nayak/nisar_pro.git
cd nisar_pro
```

## 2. Start the Frontend (Dashboard)

```bash
cd sar-dashboard-v3
npm install
npm run dev
```
Open [http://localhost:5173](http://localhost:5173)

## 3. Start the Backend (Gateway)

```bash
cd sar-gateway
cargo run
```
API available at [http://localhost:3000](http://localhost:3000)

## 4. Local Kubernetes Cluster

```bash
# Create cluster
./kind create cluster --name sar-cluster

# Load images
podman build -t localhost/sar-dashboard:latest sar-dashboard-v3/
podman save localhost/sar-dashboard:latest -o /tmp/dash.tar
./kind load image-archive /tmp/dash.tar --name sar-cluster

# Deploy
kubectl apply -k k8s_manifests/

# Access dashboard
kubectl port-forward svc/sar-dashboard-svc 8080:80
```

## 5. Environment Variables

Create `sar-gateway/.env`:
```env
ESA_USERNAME=your_esa_email
ESA_PASSWORD=your_esa_password
RUST_LOG=info
```

## Next Steps

- Read the [Architecture](./architecture.md) to understand the system
- Check [API Reference](./api-reference.md) for endpoint details
- See [Contributing](./contributing.md) to submit your first PR

# System Architecture

## High-Level Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Browser                            │
└─────────────────────────────┬───────────────────────────────────┘
                              │ HTTP :8080
┌─────────────────────────────▼───────────────────────────────────┐
│                    Kubernetes Cluster                           │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  sar-dashboard (Nginx + React)                          │    │
│  │  - Serves static frontend                               │    │
│  │  - Proxies /api/* to Gateway                            │    │
│  └─────────────────────────┬───────────────────────────────┘    │
│                            │ /api/*                              │
│  ┌─────────────────────────▼───────────────────────────────┐    │
│  │  sar-gateway (Rust + Axum)                              │    │
│  │  - OAuth2 authentication with ESA                       │    │
│  │  - Unified API for multiple data sources                │    │
│  └─────────────────────────┬───────────────────────────────┘    │
│                            │                                     │
│  ┌─────────────────────────▼───────────────────────────────┐    │
│  │  sar-operator (Kubernetes Operator)                     │    │
│  │  - Watches SARJob CRDs                                  │    │
│  │  - Spawns sar-processor pods                            │    │
│  └─────────────────────────┬───────────────────────────────┘    │
│                            │                                     │
│  ┌─────────────────────────▼───────────────────────────────┐    │
│  │  sar-processor (Job Pod)                                │    │
│  │  - Downloads SAR data (HTTP Range)                      │    │
│  │  - Processes GeoTIFF/HDF5                               │    │
│  │  - Outputs analysis results                             │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────────┐
│                    External APIs                                 │
│  - ESA Copernicus (Sentinel-1)                                  │
│  - ISRO Bhoonidhi (RISAT)                                       │
│  - NASA Earthdata (NISAR)                                       │
└─────────────────────────────────────────────────────────────────┘
```

## Component Details

### 1. sar-dashboard-v3
- **Tech**: React + Vite + Spline 3D
- **Purpose**: User interface for searching and viewing SAR data
- **Key Files**:
  - `src/components/Hero.jsx` - Search UI with 3D background
  - `src/components/LiveFeed.jsx` - Job status cards
  - `nginx.conf` - Reverse proxy config

### 2. sar-gateway
- **Tech**: Rust + Axum + Tokio
- **Purpose**: Secure API gateway with OAuth2
- **Key Files**:
  - `src/main.rs` - Server setup
  - `src/handlers.rs` - API endpoints
  - `src/esa_client.rs` - ESA API integration

### 3. sar-operator
- **Tech**: Rust + kube-rs
- **Purpose**: Kubernetes operator for job management
- **CRD**: `SARJob` custom resource

### 4. sar-processor
- **Tech**: Rust + GDAL bindings
- **Purpose**: Actual SAR data processing
- **Features**:
  - Smart Downloader (HTTP Range requests)
  - GeoTIFF/HDF5 parsing
  - Ship detection, flood mapping

## Data Flow

1. User searches for location in Dashboard
2. Dashboard calls `/api/search?lat=X&lon=Y`
3. Nginx proxies to Gateway
4. Gateway authenticates with ESA OAuth2
5. Gateway queries Copernicus OData API
6. Results returned to Dashboard
7. User clicks "Process"
8. Gateway creates SARJob CR
9. Operator detects CR, spawns Processor
10. Processor downloads and analyzes data
