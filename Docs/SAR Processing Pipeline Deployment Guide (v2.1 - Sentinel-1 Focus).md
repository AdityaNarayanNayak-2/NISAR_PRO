# SAR Processing Pipeline Deployment Guide (v2.1 - Sentinel-1 Focus)

This guide provides step-by-step instructions for deploying the **End-to-End SAR Processing System** locally using **Podman** and **Kind**. This project demonstrates expertise in Rust, Kubernetes Operators, and modern DevOps practices, making it an excellent portfolio piece for SAR/satellite companies.

## Prerequisites

1.  **Operating System**: Red Hat 10 or any Linux distribution.
2.  **Tools**:
    *   **Rust**: Installed and configured (`rustup`).
    *   **Podman Desktop**: Installed and running (includes Podman and Kind).
    *   **kubectl**: Installed and configured to connect to the Kind cluster.
    *   **Terraform**: Installed (for Azure infrastructure, though simulated locally).
    *   **Node.js/npm**: Installed (for the React dashboard).

## Phase 1: Infrastructure Setup (Terraform Simulation)

The system is designed to use Azure Blob Storage. For local deployment, we simulate the credentials that the K8s Job will expect.

1.  **Simulate Azure Credentials**:
    The SAR Processor expects the following environment variables for Azure storage access. In a real deployment, Terraform would manage a Kubernetes Secret containing these. For local testing, we will use dummy values.

    | Variable | Description | Example Value |
    | :--- | :--- | :--- |
    | `AZURE_STORAGE_ACCOUNT` | The name of the Azure Storage Account. | `sarsystemstorage` |
    | `AZURE_STORAGE_KEY` | The primary access key for the storage account. | `dummykey1234567890...` |
    | `AZURE_CONTAINER_NAME` | The container where processed data is stored. | `sar-results-container` |

2.  **Sentinel-1 API Credentials**:
    The SAR Processor also needs credentials for the Sentinel-1 API (Copernicus Open Access Hub).

    | Variable | Description | Example Value |
    | :--- | :--- | :--- |
    | `S1_API_USER` | Your Copernicus Open Access Hub username. | `my-s1-user` |
    | `S1_API_PASS` | Your Copernicus Open Access Hub password. | `my-s1-pass` |

## Phase 2: Building and Loading Containers (Podman)

We will build the two core Rust components and load them into the local Kind cluster.

### 2.1. Build the SAR Processor Image

Navigate to the processor directory and build the image using Podman.

```bash
# 1. Navigate to the processor directory
cd sar_processor

# 2. Build the image using the provided Dockerfile
# We use the name 'sar-processor:latest' as referenced in the K8s operator
podman build -t sar-processor:latest .

# Expected Output: Successfully tagged sar-processor:latest
```

### 2.2. Build the Kubernetes Operator Image

Navigate to the operator directory and build the image.

```bash
# 1. Navigate to the operator directory
cd ../sar_operator_v2

# 2. Build the image
podman build -t sar-operator:latest .

# Expected Output: Successfully tagged sar-operator:latest
```

### 2.3. Load Images into Kind Cluster

The Kind cluster needs access to the images built by Podman.

```bash
# 1. Ensure your Kind cluster is running (e.g., via Podman Desktop)
# 2. Load the images into the Kind cluster
kind load docker-image sar-processor:latest
kind load docker-image sar-operator:latest

# Expected Output: Image: "sar-processor:latest" loaded...
# Expected Output: Image: "sar-operator:latest" loaded...
```

## Phase 3: Kubernetes Deployment

### 3.1. Apply Custom Resource Definition (CRD)

The operator needs the definition of the `SarJob` resource.

```bash
# 1. Navigate to the manifests directory
cd ../k8s_manifests

# 2. Apply the CRD
kubectl apply -f sarjob_crd.yaml
# Expected Output: customresourcedefinition.apiextensions.k8s.io/sarjobs.sar.example.com created
```

### 3.2. Create Credentials Secret

We create a Kubernetes Secret to hold the Sentinel-1 and Azure credentials. **Replace the example values with your simulated/real credentials.**

```bash
# 1. Create the Secret (replace values with your own)
kubectl create secret generic sar-credentials \
    --from-literal=S1_API_USER="my-s1-user" \
    --from-literal=S1_API_PASS="my-s1-pass" \
    --from-literal=AZURE_STORAGE_ACCOUNT="sarsystemstorage" \
    --from-literal=AZURE_STORAGE_KEY="dummykey1234567890"
# Expected Output: secret/sar-credentials created
```

### 3.3. Deploy RBAC and Operator

Apply the Role-Based Access Control (RBAC) and the operator deployment.

```bash
# 1. Apply RBAC (ServiceAccount, Role, RoleBinding)
kubectl apply -f sar_rbac.yaml
# Expected Output: serviceaccount/sar-operator created...

# 2. Deploy the Rust Kubernetes Operator
kubectl apply -f sar_deployment.yaml
# Expected Output: deployment.apps/sar-operator-v2 created
```

### 3.4. Verify Operator Status

Check that the operator pod is running.

```bash
kubectl get pods
# Look for a pod named 'sar-operator-v2-...' with STATUS 'Running'
```

## Phase 4: Frontend Dashboard Setup

The dashboard is a modern React application for visualization.

```bash
# 1. Navigate to the dashboard directory
cd ../sar-dashboard-v2

# 2. Install dependencies
npm install

# 3. Start the development server
npm start
# The dashboard will open in your browser (usually http://localhost:3000)
```

## Phase 5: Testing the End-to-End Pipeline

Submit a test `SarJob` to trigger the entire pipeline.

### 5.1. Create a Test SarJob Manifest

Create a file named `test_sarjob.yaml` in the `k8s_manifests` directory.

```yaml
# k8s_manifests/test_sarjob.yaml
apiVersion: sar.example.com/v1
kind: SarJob
metadata:
  name: s1-anomaly-detection-001
spec:
  # Sentinel-1 Scene ID (simulated)
  scene_id: S1A_IW_GRDH_20251112T120000_000000_000000_0000
  # Azure Blob Storage path where the processed image will be "uploaded"
  output_storage_path: azure://sar-results-container/processed/s1-anomaly-detection-001.png
  processing_parameters: "AMTAD_V3_DEFAULT"
```

### 5.2. Apply the SarJob

```bash
# 1. Apply the test job
kubectl apply -f test_sarjob.yaml
# Expected Output: sarjob.sar.example.com/s1-anomaly-detection-001 created
```

### 5.3. Monitor the Pipeline

1.  **Monitor the SarJob Status**:
    ```bash
    kubectl get sarjob s1-anomaly-detection-001 -w
    # Status will change from Pending -> Processing -> Completed
    ```

2.  **Monitor the K8s Job**:
    The operator will create a K8s Job.
    ```bash
    kubectl get jobs
    # Look for a job named 'sar-proc-s1-anomaly-detection-001'
    ```

3.  **View Processor Logs**:
    Find the pod created by the K8s Job and view its logs.
    ```bash
    # Get the pod name (it will start with the job name)
    POD_NAME=$(kubectl get pods -l job-name=sar-proc-s1-anomaly-detection-001 -o jsonpath='{.items[0].metadata.name}')
    
    # View the logs
    kubectl logs $POD_NAME
    # You should see the Rust processor logs:
    # "Starting SAR Processor for Scene ID: S1A_IW_GRDH_..."
    # "Starting Adaptive Multi-Scale Texture Anomaly Detection (AMTAD)..."
    # "Successfully simulated upload of anomaly_map.png to Azure."
    # "SAR Processing Job Completed Successfully."
    ```

## Conclusion

This deployment successfully demonstrates a full-stack, event-driven SAR processing pipeline, orchestrated by a custom Rust Kubernetes Operator and utilizing the Sentinel-1 data source. This architecture is directly applicable to environments like NASA's MAAP or ISRO's NISAR data processing, showcasing your advanced DevSecOps capabilities.
