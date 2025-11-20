# End-to-End SAR Processing System Architecture (v3.0 - Sentinel-1 Focus)

This architecture design focuses on the strategic integration of the **Sentinel-1 API** for data access, the custom **Rust AMTAD** algorithm, and a robust **DevSecOps** deployment stack.

## 1. Data Flow Diagram

The system operates as a fully automated, event-driven pipeline:

1.  **Trigger**: User/Scheduler creates a `SarJob` CR in Kubernetes with Sentinel-1 specific parameters (e.g., `scene_id`, `collection: S1A_IW_GRDH`).
2.  **Orchestration**: The **Rust K8s Operator** detects the new `SarJob` and creates a K8s Job to run the processor.
3.  **Data Acquisition**: The **Rust Processor** authenticates with the **Sentinel-1 API** (e.g., Copernicus Open Access Hub or a commercial provider) and downloads the raw SAR data.
4.  **Processing**: The **Rust Processor** executes the high-performance **AMTAD** algorithm on the raw data.
5.  **Storage**: The processed anomaly map is uploaded to the **Azure Blob Storage** container (provisioned by **Terraform**).
6.  **Notification**: The Operator updates the `SarJob` status with the final Azure URL.
7.  **Visualization**: The **React Dashboard** displays the job status and fetches the final image from Azure for the operator.

## 2. Component Specifications

### 2.1. Rust SAR Processor (`sar_processor`)

| Feature | Specification |
| :--- | :--- |
| **Language** | Rust (Async with `tokio`) |
| **Core Logic** | **Adaptive Multi-Scale Texture Anomaly Detection (AMTAD)** algorithm. |
| **Data Access** | Custom **Sentinel-1 API Client** using `reqwest` for authentication and data download from the Copernicus Open Access Hub or similar service. |
| **Cloud Storage** | Azure Blob Storage client using `azure_storage` crate for secure upload of final anomaly maps. |
| **Input** | Environment variables injected by the K8s Job: `JOB_ID`, `S1_API_USER`, `S1_API_PASS`, `SCENE_ID`, `OUTPUT_PATH`. |

### 2.2. Rust K8s Operator (`sar_operator_v2`)

| Feature | Specification |
| :--- | :--- |
| **Language** | Rust (Async with `kube-rs` and `tokio`) |
| **CRD** | `SarJob` (Custom Resource Definition) with Sentinel-1 ready fields (e.g., `collection`, `scene_id`, `processing_mode`). |
| **Reconciliation** | Watches for `SarJob` events. Creates a K8s Job resource on creation. Monitors the Job status and updates the `SarJob` status accordingly. |
| **Security** | Injects Sentinel-1 API credentials from a K8s Secret into the processor Job Pod's environment variables. |

### 2.3. Deployment and Infrastructure

| Component | Technology | Purpose |
| :--- | :--- | :--- |
| **Infrastructure** | **Terraform** | Manages the Azure Resource Group, Storage Account, and Blob Container. Ensures secure, repeatable infrastructure provisioning. |
| **Containerization** | **Podman/Docker** | Used to build and manage the `sar_processor` and `sar_operator_v2` images on the Red Hat 10 host. |
| **Orchestration** | **Kubernetes (via Podman Desktop)** | Provides the runtime environment for the operator and the ephemeral processing jobs. |

## 3. MAAP Integration Strategy (The Real Deal)

The entire system is designed for seamless integration with the **MAAP (Multi-Mission Algorithm and Analysis Platform)** environment.

*   **MAAP Principle**: "Bring the Algorithm to the Data."
*   **Strategy**: The `sar_processor` is packaged as a **Docker container**. MAAP is designed to run user-provided containers directly on its cloud infrastructure, which is co-located with the massive SAR data archive.
*   **Implementation**: Instead of the processor downloading data from the Sentinel-1 API, the K8s Job would be deployed *inside* the MAAP cluster. The processor would then access the data directly via a local file path or a high-speed internal API provided by MAAP, drastically reducing latency and egress costs. The K8s Operator model is fully compatible with MAAP's underlying infrastructure.

This architecture is a **production-ready blueprint** for a modern SAR processing pipeline.
