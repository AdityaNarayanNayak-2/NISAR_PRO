# Getting Started

This guide will help you set up your local development environment.

For the exact Windows PowerShell workflow, read the [Windows local run guide](./windows-local-run.md).

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

> On Windows PowerShell use `$env:LOCAL_MODE="true"` before `cargo run`. The processor is built once with `cargo build` and is then launched automatically by the gateway when a job is submitted.

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
# ESA Copernicus (Sentinel-1) catalog — required for GET /search
ESA_USERNAME=your_esa_email
ESA_PASSWORD=your_esa_password

# NASA/ASF Earthdata — NOT needed for searching, required to DOWNLOAD products
# (either credentials or a token). Check readiness via GET /asf/auth-status.
EARTHDATA_USERNAME=your_earthdata_login
EARTHDATA_PASSWORD=your_earthdata_password
# EARTHDATA_TOKEN=your_app_token   # alternative to username/password

RUST_LOG=info
```

> **Verified note (get data in this order):** `GET /search/nisar` queries the NASA ASF catalog with **no** credentials — you can search and browse NISAR GCOV/RSLC/GUNW scenes anonymously. Downloading the actual HDF5 file requires Earthdata authentication (credentials above, or `EARTHDATA_TOKEN`/`ASF_TOKEN`). A mismatch here shows up as an auth error at download time, not at search time.

### Memory & disk expectations
Real NISAR products are large: **GCOV ≈ 8–10 GB** each, **RSLC ≈ 25–30 GB** each. These are read fully into RAM before cropping (see the [processing guide](../Architecture/processor_ingestion.md)), so plan for machine RAM ≥ ~4× the on-disk size and disk space for several products. The small bundled test products are the only ones that run comfortably on an 8 GB laptop.

## Next Steps

- Read the [Architecture](./architecture.md) to understand the system
- Check [API Reference](./api-reference.md) for endpoint details
- See [Contributing](./contributing.md) to submit your first PR





## Run SAR Processor
cd sar-gateway
LOCAL_MODE=true RUST_LOG=info cargo run --release


## Run Dashboard
cd sar-dashboard-v3
npm run dev
