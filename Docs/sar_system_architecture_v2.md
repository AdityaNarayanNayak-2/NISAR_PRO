# End-to-End SAR Processing System Architecture (v2)

This document outlines the architecture for the revised SAR processing system, incorporating Sentinel-1 data, a novel Rust algorithm, Azure storage managed by Terraform, and a strategy for MAAP integration.

## 1. High-Level Architecture Diagram

The system is structured around a decoupled, event-driven workflow orchestrated by Kubernetes.

| Component | Technology | Role |
| :--- | :--- | :--- |
| **Data Source** | Sentinel-1 API (CDSE/Sentinel Hub) | Provides raw SAR data (SLC/GRD) for processing. |
| **Storage (Input/Output)** | Azure Blob Storage | Managed by Terraform. Stores raw Sentinel-1 data and the final processed image/anomaly map. |
| **Orchestration** | Kubernetes (K8s) | Hosts the custom operator and the SAR processing jobs. |
| **Custom Resource** | `SarJob` (K8s CRD) | Defines a single SAR processing task, including input/output paths and parameters. |
| **Operator** | Rust (`sar_operator`) | Watches `SarJob` CRs, triggers the SAR processing job, and manages status updates. |
| **Processing Engine** | Rust (`sar_processor`) | Executes the novel **Adaptive Multi-Scale Texture Anomaly Detection (AMTAD)** algorithm. |
| **Infrastructure** | Terraform | Manages the Azure Blob Storage infrastructure and potentially the K8s cluster configuration. |
| **Visualization** | React/Next-Gen Dashboard | Provides a highly aesthetic, non-technical interface for viewing the processed anomaly maps. |

## 2. Data Flow and Processing Pipeline

The pipeline is initiated by a user submitting a `SarJob` and concludes with the processed data being available for the dashboard.

| Step | Component(s) Involved | Description |
| :--- | :--- | :--- |
| **1. Job Submission** | User / API Gateway | A user submits a `SarJob` manifest to the K8s cluster, specifying the Sentinel-1 scene ID and Azure output path. |
| **2. Job Detection** | `sar_operator` | The Rust operator detects the new `SarJob` in the `Pending` phase. |
| **3. Data Acquisition** | `sar_operator` / K8s Job | The operator creates a K8s Job running the `sar_processor` image. The processor's entry point first uses a Rust HTTP client to query the Sentinel-1 API, download the raw data, and temporarily store it in a local volume or directly in memory. |
| **4. Processing** | `sar_processor` (Rust) | The processor executes the **AMTAD** algorithm on the raw SAR data. The output is a single-band anomaly map (e.g., a GeoTIFF or PNG) where pixel intensity represents the anomaly score. |
| **5. Data Storage** | `sar_processor` (Rust) | The processor uploads the final anomaly map to the designated Azure Blob Storage path (e.g., `azure://sar-results-container/anomaly-maps/job-id.png`). |
| **6. Status Update** | `sar_operator` | The operator detects the completion of the K8s Job and updates the `SarJob` status to `Completed`, including the final Azure URL. |
| **7. Visualization** | Frontend Dashboard | The dashboard queries the K8s API (or an intermediary API) for completed `SarJob`s, fetches the anomaly map from the Azure URL, and displays it with a modern, aesthetic visualization layer. |

## 3. Deployment Stack and Infrastructure

### 3.1. Terraform for Azure Storage

Terraform will be used to provision the necessary cloud resources in Azure.

| Resource | Terraform Module | Purpose |
| :--- | :--- | :--- |
| **Resource Group** | `azurerm_resource_group` | Logical container for all Azure resources. |
| **Storage Account** | `azurerm_storage_account` | Provides a unique namespace for Azure Storage data. |
| **Blob Container** | `azurerm_storage_container` | Stores the raw Sentinel-1 data and the processed anomaly maps. |
| **Service Principal** | `azuread_application`, `azuread_service_principal` | Used by the K8s operator and processor to authenticate and write to Azure Storage. |

### 3.2. Rust Components and Dependencies

| Component | Key Rust Crates | Notes |
| :--- | :--- | :--- |
| **`sar_processor`** | `reqwest`, `tokio`, `ndarray`, `image`, `log` | `reqwest` for Sentinel-1 API calls. `ndarray` for high-performance array manipulation in the AMTAD algorithm. `image` for saving the final anomaly map (e.g., as PNG). |
| **`sar_operator`** | `kube`, `kube-runtime`, `tokio`, `serde`, `thiserror` | Standard `kube-rs` stack for building robust Kubernetes operators. |

## 4. MAAP Integration Strategy

The integration with the Multi-Mission Algorithm and Analysis Platform (MAAP) will be achieved through containerization and API interaction.

1.  **Containerization**: The `sar_processor` will be packaged as a Docker container, making it portable. This container can be deployed directly into the MAAP's computational environment, allowing it to run the AMTAD algorithm on MAAP-hosted data.
2.  **MAAP API Interaction**: The frontend dashboard can be extended to use MAAP's data discovery APIs. This allows the non-technical operator to not only view our processed anomaly maps but also overlay them with MAAP-provided data products (e.g., biomass maps, fire detections) for richer context and analysis. This is the "real deal" value-add for the satellite operator.

This architecture provides a robust, high-performance, and future-proof foundation for the end-to-end SAR processing tool. The next phase will focus on the aesthetic redesign of the dashboard.
