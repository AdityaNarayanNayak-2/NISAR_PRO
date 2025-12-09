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
