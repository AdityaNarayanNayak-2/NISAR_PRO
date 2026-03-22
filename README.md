# NISAR Pro - Distributed Synthetic Aperture Radar Processor

NISAR Pro is a specialized, distributed software system designed for the ingestion, processing, and visualization of Synthetic Aperture Radar (SAR) datasets (specifically Sentinel-1/Copernicus data). The pipeline is written primarily in Rust for memory safety and concurrency, while relying on Kubernetes for workload orchestration.

## Core Components

The repository is structured into four separate deployment units:

### 1. Processing Engine (`sar_processor/`)
A high-performance Rust binary that directly handles raw SAR signal data. 
- Utilizes GDAL bindings for GeoTIFF manipulation.
- Implements sinc-interpolated Range Cell Migration Correction (RCMC) with an 8-point Hamming window.
- Handles range-dependent azimuth compression.
- Provides spatial multilooking (block averaging of intensity squared) to reduce speckle noise and cap dimensionality.

### 2. Kubernetes Operator (`sar_operator_v2/`)
A custom Kubernetes controller written using the `kube-rs` crate.
- Reconciles `SarJob` Custom Resource Definitions (CRDs).
- Extracts requested ML mapping models and pipeline parameters (e.g., InSAR, PolSAR) from the CRD.
- Schedules ephemeral `batch/v1::Job` pods injected with the required `SAR_PIPELINE` environment configurations.

### 3. API Gateway (`sar-gateway/`)
An asymmetric API gateway written in Rust utilizing the `axum` and `tokio` asynchronous runtimes.
- Proxies OData queries upstream to the ESA Copernicus API.
- Replaces local processing queues by acting as a native Kubernetes API client. 
- Translates client HTTP requests into `SarJob` deployments.
- Implements a unique asynchronous polling mechanism that attaches `LogParams` streams to deployed Kubernetes Pods, piping standard output over the network back to clients using Server-Sent Events (SSE).

### 4. Client Dashboard (`sar-dashboard-v3/`)
A Single Page Application built with React and Vite.
- Discards multi-page wizard navigation in favor of a centralized Inspector UI.
- Displays processed GeoTIFF SAR overlays directly on a `react-leaflet` map.
- Consumes the Gateway's SSE stream via a persistent `<Terminal />` component, providing users with raw compilation output.

## Local Execution Environment

The application is designed to be deployed to a distributed Kubernetes cluster. For local development, `kind` (Kubernetes in Docker) is the targeted substrate.

### Dependencies
- `rustc` 1.70+
- `node` 20+
- `kubectl`
- `kind`
- Container Runtime (`podman` or `docker`)

### Deployment Procedure

1. **Establish Cluster:** Mount a local control plane.
   ```bash
   kind create cluster --name sar-cluster
   ```

2. **Register Custom Resources:** Apply the Operator definitions.
   ```bash
   kubectl apply -k k8s_manifests/
   ```

3. **Initialize Operator:** Start the job reconciler.
   ```bash
   cd sar_operator_v2
   cargo run --release
   ```

4. **Initialize Gateway:** Provide ESA credentials and bind the HTTP interface.
   ```bash
   cd sar-gateway
   export ESA_USERNAME="user"
   export ESA_PASSWORD="password"
   cargo run --release
   ```

5. **Start Client:**
   ```bash
   cd sar-dashboard-v3
   npm install && npm run dev
   ```

## Documentation Reference
See the `/Docs` directory for deep-dives into specific subsystems:
- `Docs/architecture.md` - Detailed overview of the kube-rs API bindings and SSE pipeline.
- `Docs/deployment.md` - Remote VM cluster topology instructions.
