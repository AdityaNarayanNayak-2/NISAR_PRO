# SAR Analyzer Developer Guide 🚀

Welcome to the SAR Analyzer project! This guide is designed to help you understand the system, set up your development environment, and start contributing code—even if you are new to Rust or Kubernetes.

### 1. System Overview
The SAR Analyzer is a distributed system designed for processing Sentinel-1 and NISAR data.
It consists of four main components:

1.  **SAR Dashboard (`sar-dashboard-v2`)**: A React-based "Space Agency" style web interface. It uses Nginx as a reverse proxy to route API requests.
2.  **SAR Gateway (`sar-gateway`)**: A Rust microservice that acts as a unified search interface for ESA, Bhoonidhi, and NASA APIs. It handles authentication and OData queries.
3.  **SAR Operator (`sar_operator_v2`)**: A Kubernetes Operator (Rust) that watches for `SarJob` CRDs and orchestrates processing jobs.
4.  **SAR Processor (`sar_processor`)**: The worker unit (Rust) that performs the actual data analysis. It includes a **Smart Downloader** for fetching specific byte ranges (10km chunks) of large GeoTIFFs.

### 2. Architecture Diagram
```mermaid
graph TD
    User[User] -->|Browser| Dashboard[SAR Dashboard (Nginx)]
    Dashboard -->|/api| Gateway[SAR Gateway]
    Gateway -->|OData| ESA[ESA API]
    Dashboard -->|K8s API| Operator[SAR Operator]
    Operator -->|Spawns| Processor[SAR Processor Pod]
    Processor -->|Range Request| ESA_Data[ESA Data Archive]
```

---

## 2. Getting Started

### Prerequisites
Ensure you have the following installed:
-   **Rust**: `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`
-   **Docker** (or Podman): For building container images.
-   **Kind**: For running a local Kubernetes cluster.
-   **kubectl**: For interacting with the cluster.

### Quickstart
1.  **Clone the repo**:
    ```bash
    git clone <repo-url>
    cd sar_analyzer
    ```

2.  **Create a Local Cluster**:
    ```bash
    ./kind create cluster --name sar-cluster
    ```

3.  **Build and Deploy**:
    We use a manual build process for now (automation coming soon).
    ```bash
    # Build images
    podman build -t sar-processor:latest ./sar_processor
    podman build -t sar-operator:latest ./sar_operator_v2
    podman build -t sar-dashboard:latest ./sar-dashboard-v2

    # Load into Kind
    podman save -o sar-processor.tar sar-processor:latest
    ./kind load image-archive sar-processor.tar --name sar-cluster
    # ... repeat for operator and dashboard
    
    # Apply Manifests
    kubectl apply -k k8s_manifests/
    ```

---

## 3. Codebase Walkthrough

### SAR Processor (`sar_processor/src/`)
This is a pure Rust application. It takes environment variables as input and produces an image file.

*   **`main.rs`**: The entry point. It reads env vars (`SAR_SCENE_ID`, `SAR_OUTPUT_PATH`) and calls the other modules.
*   **`algorithm.rs`**: Contains the core math.
    *   `amtad_algorithm`: The main anomaly detection logic.
    *   `local_variance`: Helper function for statistical analysis.
*   **`io.rs`**: Handles data input/output.
    *   `fetch_sentinel1_data`: Simulates downloading satellite data (returns a 2D array).
    *   `save_anomaly_map_as_png`: Converts the result array into a PNG image.
*   **`errors.rs`**: Defines `ProcessorError` using `thiserror` to handle failures gracefully.

### SAR Operator (`sar_operator_v2/src/`)
This is a Kubernetes Controller built with `kube-rs`.

*   **`main.rs`**: Sets up the Kubernetes client and starts the controller loop.
*   **`crd.rs`**: Defines the Custom Resource Definition (CRD).
    *   `SarJobSpec`: What the user asks for (scene ID, output path).
    *   `SarJobStatus`: What the operator reports back (Pending, Processing, Completed).
*   **`controller.rs`**: The brain of the operator.
    *   `reconcile`: The function called every time a `SarJob` changes. It decides what to do (create a Job, update status, cleanup).
    *   `create_sar_job_manifest`: Generates the K8s Job definition for the processor.

---

## 4. Development Workflow

### Running Locally (Fast Debugging)
You don't need Kubernetes to test the logic!

**Testing the Processor:**
```bash
export SAR_SCENE_ID="test-scene-123"
export SAR_OUTPUT_PATH="./output.png"
cd sar_processor
cargo run
```

**Testing the Operator:**
(Requires a running K8s cluster, but runs the binary on your host)
```bash
cd sar_operator_v2
cargo run
```

### Adding a New Feature
1.  **Modify the Code**: Add your new algorithm to `algorithm.rs` or new field to `crd.rs`.
2.  **Verify**: Run `cargo build` and `cargo test`.
3.  **Deploy**: Rebuild the Docker image and load it into Kind.

---

## 5. Troubleshooting

### Common Issues

**1. `ImagePullBackOff`**
*   **Cause**: Kubernetes can't find your image.
*   **Fix**: Ensure you loaded the image into Kind (`kind load image-archive ...`) and that your deployment yaml uses `imagePullPolicy: IfNotPresent`. Note that for Kind with Podman, images are often prefixed with `localhost/`.

**2. Pod in `Error` State**
*   **Cause**: The application crashed.
*   **Fix**: Check logs: `kubectl logs <pod-name>`.
*   **Tip**: If it's a "glibc" error, your Docker base image is too old. We use `ubuntu:24.04`.

**3. Operator not doing anything**
*   **Cause**: It might be stuck or crashed.
*   **Fix**: Restart it: `kubectl delete pod -l app=sar-operator`.

---

## 6. Future Roadmap
*   Replace simulation with real Sentinel-1 API integration.
*   Add automated CI/CD pipelines.
*   Implement GPU acceleration for the processor.
