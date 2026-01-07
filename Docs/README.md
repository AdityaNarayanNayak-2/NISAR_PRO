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
| SAR Science | rustfft, ndarray, num-complex (Pure Rust math)|
| Container | Podman, Docker |
| Orchestration | Kubernetes (Kind for local) |
| GitOps | Flux CD |
| CI/CD | GitLab CI |
| Registry | GitLab Container Registry |

## 🔗 Quick Links

- **GitLab Repository**: [gitlab.com/Aditya-Narayan-Nayak/nisar_pro](https://gitlab.com/Aditya-Narayan-Nayak/nisar_pro)
- **ESA Copernicus**: [dataspace.copernicus.eu](https://dataspace.copernicus.eu)
