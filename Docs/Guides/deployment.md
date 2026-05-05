# Deployment Guide

## Deployment Options

| Option | Use Case |
|--------|----------|
| Local Kind | Development & testing |
| Minikube | Alternative local cluster |
| EKS/GKE/AKS | Production cloud deployment |

---

## Local Deployment (Kind + Podman)

### 1. Create Cluster

```bash
./kind create cluster --name sar-cluster
```

### 2. Build Images

```bash
# Dashboard
cd sar-dashboard-v3
podman build -t localhost/sar-dashboard:latest .

# Gateway
cd ../sar-gateway
podman build -t localhost/sar-gateway:latest .
```

### 3. Load into Kind

```bash
podman save localhost/sar-dashboard:latest -o /tmp/dash.tar
podman save localhost/sar-gateway:latest -o /tmp/gw.tar

./kind load image-archive /tmp/dash.tar --name sar-cluster
./kind load image-archive /tmp/gw.tar --name sar-cluster
```

### 4. Create Secrets

```bash
# ESA credentials
kubectl apply -f k8s_manifests/esa_secret.yaml

# GitLab registry (for CI-built images)
./setup_secrets.sh
```

### 5. Deploy

```bash
kubectl apply -k k8s_manifests/
```

### 6. Access

```bash
kubectl port-forward svc/sar-dashboard-svc 8080:80
# Open http://localhost:8080
```

---

## GitOps with Flux CD

Flux is pre-configured. Once bootstrap is complete:

1. Any change to `k8s_manifests/` triggers automatic deployment
2. Image updates are detected and applied
3. Check status: `./flux get kustomizations`

### Bootstrap (First Time)

```bash
export GITLAB_TOKEN=your_token
./flux bootstrap gitlab \
  --owner=Aditya-Narayan-Nayak \
  --repository=nisar_pro \
  --branch=main \
  --path=clusters/my-cluster \
  --deploy-token-auth
```

---

## CI/CD Pipeline

GitLab CI automatically:

1. Builds Rust components
2. Runs tests
3. Builds Docker images
4. Pushes to GitLab Container Registry

Pipeline triggers on push to `main` branch.

### Required CI Variables

| Variable | Description |
|----------|-------------|
| ESA_USERNAME | ESA Copernicus email |
| ESA_PASSWORD | ESA Copernicus password |

Set in GitLab → Settings → CI/CD → Variables.
