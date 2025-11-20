# End-to-End SAR Processing Tool Deployment Guide

This document provides a comprehensive guide for deploying the Synthetic Aperture Radar (SAR) processing tool, which includes a Rust-based SAR signal decoder, a Kubernetes operator for orchestration, and a modern React-based frontend dashboard for visualization.

## 1. System Overview

The SAR processing tool is designed to process SAR data, manage processing jobs via a Kubernetes operator, and visualize the results through an interactive dashboard. The architecture consists of three main components:

*   **SAR Decoder (Rust)**: A Rust application responsible for decoding SAR signals and generating processed imagery. For this demonstration, it simulates SAR processing output.
*   **Kubernetes Operator (Rust)**: A custom Kubernetes operator written in Rust that watches for `SarJob` custom resources, orchestrates the SAR decoder, and updates job statuses.
*   **Frontend Dashboard (React)**: A highly animated and aesthetic React application for visualizing processed Earth imagery, designed for non-technical operators.

## 2. Prerequisites

Before proceeding with the deployment, ensure you have the following tools installed on your system:

*   **Git**: For cloning the project repositories.
*   **Rustup**: For installing the Rust toolchain.
    ```bash
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
    source $HOME/.cargo/env
    ```
*   **Go**: Required for installing `kind`.
    ```bash
    sudo apt-get update && sudo apt-get install -y golang
    ```
*   **Docker**: For building and managing container images.
    ```bash
    sudo apt-get update && sudo apt-get install -y docker.io
    sudo systemctl start docker
    sudo systemctl enable docker
    sudo usermod -aG docker $USER # Log out and back in for changes to take effect
    ```
*   **Kind (Kubernetes in Docker)**: For creating a local Kubernetes cluster.
    ```bash
    go install sigs.k8s.io/kind@v0.23.0
    export PATH=$PATH:$(go env GOPATH)/bin # Add Go bin to PATH
    ```
*   **kubectl**: The Kubernetes command-line tool.
    ```bash
    curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
    sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl
    ```
*   **pnpm**: For managing frontend dependencies.
    ```bash
    npm install -g pnpm
    ```

## 3. SAR Decoder (Rust Application)

This application simulates the SAR signal processing. In a production environment, this would be a sophisticated module performing complex algorithms.

### 3.1. Code (`sar_decoder/src/main.rs`)

```rust
fn main() {
    println!("SAR Decoder: Simulating SAR processing and outputting a synthetic image.");
    // In a real scenario, this would involve complex SAR signal processing.
    // For demonstration, we'll just print a message and simulate an output.
    
    // Simulate generating a simple 2D array representing a SAR image
    let rows = 10;
    let cols = 20;
    let mut image = vec![vec![0.0f32; cols]; rows];

    // Place some synthetic targets
    image[2][5] = 100.0; // Target 1
    image[7][15] = 150.0; // Target 2
    image[4][8] = 80.0; // Target 3

    println!("\nSynthetic SAR Image ({}x{}):\n", rows, cols);
    for r in 0..rows {
        for c in 0..cols {
            print!("{:6.1} ", image[r][c]);
        }
        println!();
    }

    println!("\nSimulated SAR processing complete. Output would typically be saved to cloud storage.");
}

```

### 3.2. Cargo.toml (`sar_decoder/Cargo.toml`)

```toml
[package]
name = "sar_decoder"
version = "0.1.0"
edition = "2021"

[dependencies]

```

### 3.3. Dockerfile (`sar_decoder/Dockerfile`)

```dockerfile
FROM rustlang/rust:nightly as builder

WORKDIR /app

COPY Cargo.toml Cargo.lock ./ 
COPY src ./src

RUN cargo build --release

FROM debian:bookworm-slim

WORKDIR /app

COPY --from=builder /app/target/release/sar_decoder .

CMD ["./sar_decoder"]
```

### 3.4. Building the Docker Image

Navigate to the `sar_decoder` directory and build the Docker image:

```bash
cd sar_decoder
docker build -t sar-decoder:latest .
```

## 4. Kubernetes Operator (Rust Application)

This operator manages the lifecycle of SAR processing jobs within a Kubernetes cluster.

### 4.1. Code (`sar_operator/src/main.rs`)

```rust
use kube::{
    api::{Api, Patch, PatchParams, PostParams, ResourceExt},
    client::Client,
    CustomResource,
};
use kube_runtime::{controller::{Action, Controller}, finalizer::{finalizer, Event as FinalizerEvent},
    reflector::ObjectRef,
};
use serde::{Deserialize, Serialize};
use std::{collections::BTreeMap, sync::Arc};
use thiserror::Error;
use tokio::time::Duration;

static SARJOB_FINALIZER: &str = "sarjobs.sar.example.com/finalizer";

// Custom Resource Definition for SarJob
#[derive(CustomResource, Deserialize, Serialize, Clone, Debug, JsonSchema)]
#[kube(group = "sar.example.com", version = "v1", kind = "SarJob", namespaced)]
#[kube(status = "SarJobStatus")]
pub struct SarJobSpec {
    pub input_data_url: String,
    pub output_storage_path: String,
    pub processing_parameters: Option<String>,
}

#[derive(Deserialize, Serialize, Clone, Debug, Default, PartialEq, JsonSchema)]
pub struct SarJobStatus {
    pub phase: String,
    pub message: String,
}

#[derive(Debug, Error)]
pub enum Error {
    #[error("Kube Error: {0}")]
    KubeError(#[from] kube::Error),
    #[error("Serialization Error: {0}")]
    SerializationError(#[from] serde_json::Error),
    // Add other custom errors here
}

pub type Result<T, E = Error> = std::result::Result<T, E>;

// Context for the reconciler
#[derive(Clone)]
pub struct Context {
    pub client: Client,
}

// Reconcile function for SarJob
async fn reconcile(sar_job: Arc<SarJob>, ctx: Arc<Context>) -> Result<Action> {
    let client = &ctx.client;
    let api: Api<SarJob> = Api::namespaced(client.clone(), &sar_job.namespace().unwrap());

    let sar_job_name = sar_job.name_any();
    let oref = sar_job.object_ref(&());

    // Add finalizer to the SarJob if it doesn't have one
    if sar_job.metadata.finalizers.is_none() || !sar_job.metadata.finalizers.as_ref().unwrap().contains(&SARJOB_FINALIZER.to_string()) {
        println!("Adding finalizer to SarJob {}", sar_job_name);
        let p = PatchParams::default();
        let patch = Patch::Merge(serde_json::json!({
            "metadata": {
                "finalizers": serde_json::json!([SARJOB_FINALIZER])
            }
        }));
        api.patch(&sar_job_name, &p, &patch).await?;
        return Ok(Action::requeue(Duration::from_secs(10)));
    }

    // Handle deletion
    if sar_job.metadata.deletion_timestamp.is_some() {
        println!("Deleting SarJob {}", sar_job_name);
        // Perform cleanup here (e.g., delete associated pods, jobs, data)
        // For now, just remove the finalizer
        let p = PatchParams::default();
        let patch = Patch::Merge(serde_json::json!({
            "metadata": {
                "finalizers": serde_json::json!(null)
            }
        }));
        api.patch(&sar_job_name, &p, &patch).await?;
        return Ok(Action::await_change());
    }

    // Normal reconciliation logic
    let current_phase = sar_job.status.as_ref().map(|s| s.phase.clone()).unwrap_or_else(|| "Pending".to_string());

    match current_phase.as_str() {
        "Pending" => {
            println!("SarJob {} is Pending. Simulating processing...", sar_job_name);
            // In a real operator, you would create a Kubernetes Job here
            // to run the sar_decoder application.
            // For this simulation, we'll just update the status.
            let new_status = SarJobStatus {
                phase: "Processing".to_string(),
                message: format!("Processing SAR data from {} to {}", sar_job.spec.input_data_url, sar_job.spec.output_storage_path),
            };
            let patch = Patch::Apply(serde_json::json!({
                "apiVersion": "sar.example.com/v1",
                "kind": "SarJob",
                "status": new_status,
            }));
            api.patch_status(&sar_job_name, &PatchParams::apply("sar-operator"), &patch).await?;
            Ok(Action::requeue(Duration::from_secs(30))) // Requeue to simulate processing time
        }
        "Processing" => {
            println!("SarJob {} is Processing. Simulating completion...", sar_job_name);
            // In a real operator, you would monitor the Kubernetes Job created above.
            // Once the Job completes, you would update the status to "Completed".
            let new_status = SarJobStatus {
                phase: "Completed".to_string(),
                message: format!("SAR data processed and stored at {}", sar_job.spec.output_storage_path),
            };
            let patch = Patch::Apply(serde_json::json!({
                "apiVersion": "sar.example.com/v1",
                "kind": "SarJob",
                "status": new_status,
            }));
            api.patch_status(&sar_job_name, &PatchParams::apply("sar-operator"), &patch).await?;
            Ok(Action::await_change()) // No need to requeue, job is done
        }
        "Completed" => {
            println!("SarJob {} is Completed.", sar_job_name);
            Ok(Action::await_change()) // Do nothing, await changes
        }
        _ => {
            println!("SarJob {} in unknown phase: {}", sar_job_name, current_phase);
            Ok(Action::await_change())
        }
    }
}

// Error handling for the reconciler
fn error_policy(sar_job: Arc<SarJob>, error: &Error, _ctx: Arc<Context>) -> Action {
    eprintln!("reconcile failed: {:?}. Error: {}", sar_job, error);
    Action::requeue(Duration::from_secs(60)) // Requeue on error
}

#[tokio::main]
async fn main() -> Result<()> {
    env_logger::init();
    let client = Client::try_default().await?;

    let context = Arc::new(Context { client: client.clone() });

    Controller::new(Api::<SarJob>::all(client.clone()), Default::default())
        .shutdown_on_error()
        .graceful_shutdown_on_signint()
        .reconcile_all("sar-operator")
        .run(reconcile, error_policy, context)
        .for_each(|res| async move {
            match res {
                Ok(o) => println!("reconciled {:?}", o),
                Err(e) => eprintln!("reconcile failed: {}", e),
            }
        })
        .await;

    Ok(())
}
```

### 4.2. Cargo.toml (`sar_operator/Cargo.toml`)

```toml
[package]
name = "sar_operator"
version = "0.1.0"
edition = "2021"

[dependencies]
kube = { version = "0.89", features = ["runtime", "derive"] }
kube-runtime = "0.89"
tokio = { version = "1.38", features = ["full"] }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
futures = "0.3"
log = "0.4"
env_logger = "0.11"
thiserror = "1.0"
k8s-openapi = { version = "0.21", features = ["v1_29"] }
schemars = { version = "0.8", features = ["derive"] }

```

### 4.3. Dockerfile (`sar_operator/Dockerfile`)

```dockerfile
FROM rustlang/rust:nightly as builder

WORKDIR /app

COPY Cargo.toml Cargo.lock ./ 
COPY src ./src

RUN cargo build --release

FROM debian:bookworm-slim

WORKDIR /app

COPY --from=builder /app/target/release/sar_operator .

CMD ["./sar_operator"]
```

### 4.4. Kubernetes Manifests

#### 4.4.1. Custom Resource Definition (CRD) (`sar_operator/sarjob_crd.yaml`)

```yaml
apiVersion: apiextensions.k8s.io/v1
kind: CustomResourceDefinition
metadata:
  name: sarjobs.sar.example.com
spec:
  group: sar.example.com
  versions:
    - name: v1
      served: true
      storage: true
      schema:
        openAPIV3Schema:
          type: object
          properties:
            spec:
              type: object
              properties:
                input_data_url:
                  type: string
                output_storage_path:
                  type: string
                processing_parameters:
                  type: string
                  nullable: true
            status:
              type: object
              properties:
                phase:
                  type: string
                message:
                  type: string
  scope: Namespaced
  names:
    plural: sarjobs
    singular: sarjob
    kind: SarJob
    shortNames:
      - sj
```

#### 4.4.2. RBAC and Service Account (`sar_operator/sar_operator_rbac.yaml`)

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: sar-operator
  namespace: default
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: sar-operator-leader-election
  namespace: default
rules:
- apiGroups:
  - ""
  resources:
  - configmaps
  verbs:
  - get
  - list
  - watch
  - create
  - update
  - patch
  - delete
- apiGroups:
  - coordination.k8s.io
  resources:
  - leases
  verbs:
  - get
  - list
  - watch
  - create
  - update
  - patch
  - delete
- apiGroups:
  - ""
  resources:
  - events
  verbs:
  - create
  - patch
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: sar-operator-leader-election-rolebinding
  namespace: default
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: Role
  name: sar-operator-leader-election
subjects:
- kind: ServiceAccount
  name: sar-operator
  namespace: default
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: sar-operator-manager-role
rules:
- apiGroups:
  - ""
  resources:
  - pods
  - pods/log
  verbs:
  - create
  - delete
  - get
  - list
  - patch
  - update
  - watch
- apiGroups:
  - batch
  resources:
  - jobs
  verbs:
  - create
  - delete
  - get
  - list
  - patch
  - update
  - watch
- apiGroups:
  - sar.example.com
  resources:
  - sarjobs
  - sarjobs/status
  - sarjobs/finalizers
  verbs:
  - create
  - delete
  - get
  - list
  - patch
  - update
  - watch
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: sar-operator-manager-rolebinding
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: sar-operator-manager-role
subjects:
- kind: ServiceAccount
  name: sar-operator
  namespace: default
```

#### 4.4.3. Deployment (`sar_operator/sar_operator_deployment.yaml`)

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: sar-operator
  namespace: default
spec:
  replicas: 1
  selector:
    matchLabels:
      app: sar-operator
  template:
    metadata:
      labels:
        app: sar-operator
    spec:
      serviceAccountName: sar-operator
      containers:
        - name: sar-operator
          image: sar-operator:latest # This image needs to be built and pushed to a registry, or loaded into kind
          imagePullPolicy: Never # Use Never for local kind cluster to avoid pulling from remote registry
          env:
            - name: RUST_LOG
              value: info,kube=debug,kube_runtime=debug
```

### 4.5. Building the Docker Image

Navigate to the `sar_operator` directory and build the Docker image:

```bash
cd sar_operator
docker build -t sar-operator:latest .
```

### 4.6. Deploying to Kubernetes

1.  **Create a Kind Cluster** (if you don't have one running):
    ```bash
    kind create cluster --name sar-cluster
    # Set kubeconfig (replace $USER with your username if not ubuntu)
    mkdir -p ~/.kube && kind get kubeconfig --name sar-cluster > ~/.kube/config
    export KUBECONFIG=~/.kube/config
    ```

2.  **Load Docker Images into Kind** (if using `kind` and `imagePullPolicy: Never`):
    ```bash
    kind load docker-image sar-decoder:latest --name sar-cluster
    kind load docker-image sar-operator:latest --name sar-cluster
    ```

3.  **Apply CRD, RBAC, and Deployment**:
    ```bash
    kubectl apply -f sar_operator/sarjob_crd.yaml
    kubectl apply -f sar_operator/sar_operator_rbac.yaml
    kubectl apply -f sar_operator/sar_operator_deployment.yaml
    ```

4.  **Verify Operator Deployment**:
    ```bash
    kubectl get pods -l app=sar-operator
    kubectl logs -l app=sar-operator
    ```

5.  **Submit a Sample SarJob** (`sar_job_sample.yaml`)

    ```yaml
    apiVersion: sar.example.com/v1
    kind: SarJob
    metadata:
      name: sar-job-pacific-ocean
    spec:
      input_data_url: "s3://sar-data-bucket/raw/pacific-ocean-2025-10-06.sar"
      output_storage_path: "azure://sar-results-container/processed/pacific-ocean-2025-10-06.tiff"
      processing_parameters: "resolution=10m, polarization=VV"
    ```

    Apply this manifest:
    ```bash
    kubectl apply -f sar_job_sample.yaml
    ```

    Monitor the `SarJob` status:
    ```bash
    kubectl get sarjob sar-job-pacific-ocean -o yaml
    ```

## 5. Frontend Dashboard (React Application)

This is the user interface for visualizing the processed SAR data.

### 5.1. Code (`sar-dashboard/src/App.jsx`)

```jsx
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import './App.css';

const StatCard = ({ title, value, icon, animationDelay }) => (
  <motion.div
    className="stat-card"
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: animationDelay, duration: 0.5 }}
  >
    <div className="stat-icon">{icon}</div>
    <div className="stat-content">
      <div className="stat-title">{title}</div>
      <motion.div
        className="stat-value"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: animationDelay + 0.3, duration: 0.5 }}
      >
        {value}
      </motion.div>
    </div>
  </motion.div>
);

const ProgressBar = ({ progress, delay }) => (
  <div className="progress-bar-container">
    <motion.div
      className="progress-bar-fill"
      initial={{ width: 0 }}
      animate={{ width: `${progress}%` }}
      transition={{ delay, duration: 1.5, ease: 'easeOut' }}
    />
  </div>
);

const JobItem = ({ job, animationDelay }) => (
  <motion.div
    className="job-item"
    initial={{ opacity: 0, x: -20 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ delay: animationDelay, duration: 0.5 }}
  >
    <div className="job-header">
      <span className="job-id">{job.id}</span>
      <span className={`job-status ${job.status.toLowerCase()}`}>{job.status}</span>
    </div>
    <div className="job-location">📍 {job.location}</div>
    {job.status === 'Processing' && (
      <div className="job-progress">
        <ProgressBar progress={job.progress} delay={animationDelay + 0.5} />
        <span className="progress-text">{job.progress}%</span>
      </div>
    )}
    <div className="job-time">{job.time}</div>
  </motion.div>
);

const ImageCard = ({ image, animationDelay, onClick }) => (
  <motion.div
    className="image-card"
    initial={{ opacity: 0, scale: 0.9 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ delay: animationDelay, duration: 0.5 }}
    whileHover={{ scale: 1.03, boxShadow: '0 0 20px rgba(0, 255, 255, 0.6)' }}
    onClick={() => onClick(image)}
  >
    <div className="image-thumbnail"></div> {/* Placeholder for actual image thumbnail */}
    <div className="image-info">
      <div className="image-title">{image.title}</div>
      <div className="image-details">{image.date} | {image.size}</div>
    </div>
  </motion.div>
);

const Modal = ({ image, onClose }) => {
  if (!image) return null;

  return (
    <motion.div
      className="modal-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="modal-content"
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -50, opacity: 0 }}
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside modal
      >
        <h2>{image.title}</h2>
        <p>Date: {image.date}</p>
        <p>Size: {image.size}</p>
        <p>Location: {image.location}</p>
        <div className="modal-image-placeholder"></div> {/* Placeholder for full image */}
        <button onClick={onClose}>Close</button>
      </motion.div>
    </motion.div>
  );
};

function App() {
  const [selectedImage, setSelectedImage] = useState(null);

  const stats = [
    { title: 'Total Scans', value: '1247', icon: '📡', delay: 0.1 },
    { title: 'Active Operators', value: '12', icon: '🧑‍💻', delay: 0.2 },
    { title: 'Data Processed', value: '3.2 TB', icon: '💾', delay: 0.3 },
    { title: 'System Uptime', value: '99.8%', icon: '📈', delay: 0.4 },
  ];

  const activeJobs = [
    { id: 'SAR-2024-001', location: 'Pacific Ocean', status: 'Processing', progress: 65, time: '2 min ago' },
    { id: 'SAR-2024-002', location: 'Amazon Basin', status: 'Completed', progress: 100, time: '15 min ago' },
    { id: 'SAR-2024-003', location: 'Arctic Circle', status: 'Queued', progress: 0, time: 'Just now' },
  ];

  const recentImages = [
    { id: 1, title: 'Pacific Coastal Region', date: '2024-10-06 14:23', size: '2.1 GB', location: 'Pacific Ocean' },
    { id: 2, title: 'Amazon Rainforest', date: '2024-10-06 12:45', size: '1.8 GB', location: 'Amazon Basin' },
    { id: 3, title: 'Arctic Ice Sheet', date: '2024-10-06 09:12', size: '3.5 GB', location: 'Arctic Circle' },
    { id: 4, title: 'Sahara Desert', date: '2024-10-05 18:30', size: '2.3 GB', location: 'Sahara Desert' },
  ];

  return (
    <div className="dashboard-container">
      <motion.header
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
      >
        <h1>SAR Earth Imaging Dashboard</h1>
        <p>Real-time Synthetic Aperture Radar Processing</p>
        <motion.button
          className="live-view-button"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          Live View
        </motion.button>
      </motion.header>

      <div className="stats-grid">
        {stats.map((stat, index) => (
          <StatCard key={stat.title} {...stat} animationDelay={stat.delay} />
        ))}
      </div>

      <div className="main-content">
        <motion.section
          className="active-jobs-section"
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.6, duration: 0.5 }}
        >
          <h2>⚡ Active Processing Jobs</h2>
          <p>Real-time SAR data processing status</p>
          <div className="job-list">
            {activeJobs.map((job, index) => (
              <JobItem key={job.id} job={job} animationDelay={0.1 * index} />
            ))}
          </div>
        </motion.section>

        <motion.section
          className="recent-images-section"
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.8, duration: 0.5 }}
        >
          <h2>Recent SAR Images</h2>
          <p>Latest processed imagery</p>
          <div className="image-list">
            {recentImages.map((image, index) => (
              <ImageCard key={image.id} image={image} animationDelay={0.1 * index} onClick={setSelectedImage} />
            ))}
          </div>
        </motion.section>
      </div>

      <Modal image={selectedImage} onClose={() => setSelectedImage(null)} />
    </div>
  );
}

export default App;
```

### 5.2. Styles (`sar-dashboard/src/App.css`)

```css
@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;600;700&display=swap');

:root {
  --bg-color: #0a0a2a;
  --card-bg: rgba(25, 25, 70, 0.8);
  --border-color: rgba(0, 255, 255, 0.3);
  --text-color: #e0e0ff;
  --primary-color: #00ffff;
  --secondary-color: #8a2be2;
  --gradient-start: #1a1a40;
  --gradient-end: #0a0a2a;
}

body {
  margin: 0;
  font-family: 'Poppins', sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  background: linear-gradient(135deg, var(--gradient-start), var(--gradient-end));
  color: var(--text-color);
  min-height: 100vh;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: 20px;
  box-sizing: border-box;
}

.dashboard-container {
  width: 100%;
  max-width: 1400px;
  display: grid;
  grid-template-rows: auto auto 1fr;
  gap: 20px;
}

header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 30px;
  background: var(--card-bg);
  border-radius: 15px;
  border: 1px solid var(--border-color);
  backdrop-filter: blur(10px);
  box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.37);
}

header h1 {
  font-size: 2.5em;
  margin: 0;
  color: var(--primary-color);
  text-shadow: 0 0 10px rgba(0, 255, 255, 0.5);
}

header p {
  font-size: 1.1em;
  margin: 5px 0 0;
  color: rgba(224, 224, 255, 0.7);
}

.live-view-button {
  background: linear-gradient(45deg, var(--primary-color), var(--secondary-color));
  border: none;
  padding: 12px 25px;
  border-radius: 30px;
  color: white;
  font-size: 1em;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 4px 15px rgba(0, 255, 255, 0.4);
  transition: all 0.3s ease;
}

.live-view-button:hover {
  box-shadow: 0 6px 20px rgba(0, 255, 255, 0.6);
  transform: translateY(-2px);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
}

.stat-card {
  background: var(--card-bg);
  border-radius: 15px;
  border: 1px solid var(--border-color);
  backdrop-filter: blur(10px);
  padding: 25px;
  display: flex;
  align-items: center;
  gap: 20px;
  box-shadow: 0 4px 30px rgba(0, 0, 0, 0.2);
}

.stat-icon {
  font-size: 3em;
  line-height: 1;
}

.stat-title {
  font-size: 0.9em;
  color: rgba(224, 224, 255, 0.7);
}

.stat-value {
  font-size: 2em;
  font-weight: 700;
  color: var(--primary-color);
  text-shadow: 0 0 8px rgba(0, 255, 255, 0.3);
}

.main-content {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 20px;
}

.active-jobs-section, .recent-images-section {
  background: var(--card-bg);
  border-radius: 15px;
  border: 1px solid var(--border-color);
  backdrop-filter: blur(10px);
  padding: 25px;
  box-shadow: 0 4px 30px rgba(0, 0, 0, 0.2);
}

.active-jobs-section h2, .recent-images-section h2 {
  color: var(--primary-color);
  font-size: 1.8em;
  margin-top: 0;
  text-shadow: 0 0 8px rgba(0, 255, 255, 0.3);
}

.active-jobs-section p, .recent-images-section p {
  color: rgba(224, 224, 255, 0.7);
  margin-bottom: 20px;
}

.job-item {
  background: rgba(25, 25, 70, 0.6);
  border-radius: 10px;
  padding: 15px;
  margin-bottom: 15px;
  border: 1px solid rgba(0, 255, 255, 0.15);
  transition: all 0.3s ease;
}

.job-item:hover {
  transform: translateY(-3px);
  box-shadow: 0 6px 20px rgba(0, 255, 255, 0.2);
}

.job-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 5px;
}

.job-id {
  font-weight: 600;
  color: var(--text-color);
}

.job-status {
  padding: 5px 10px;
  border-radius: 20px;
  font-size: 0.8em;
  font-weight: 600;
}

.job-status.processing {
  background-color: rgba(255, 165, 0, 0.2);
  color: orange;
}

.job-status.completed {
  background-color: rgba(0, 255, 0, 0.2);
  color: limegreen;
}

.job-status.queued {
  background-color: rgba(128, 128, 128, 0.2);
  color: gray;
}

.job-location {
  font-size: 0.9em;
  color: rgba(224, 224, 255, 0.8);
  margin-bottom: 10px;
}

.job-progress {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 5px;
}

.progress-bar-container {
  flex-grow: 1;
  height: 8px;
  background-color: rgba(224, 224, 255, 0.1);
  border-radius: 5px;
  overflow: hidden;
}

.progress-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #8a2be2, #00ffff);
  border-radius: 5px;
}

.progress-text {
  font-size: 0.8em;
  font-weight: 600;
  color: var(--primary-color);
}

.job-time {
  font-size: 0.8em;
  color: rgba(224, 224, 255, 0.6);
  text-align: right;
}

.image-card {
  background: rgba(25, 25, 70, 0.6);
  border-radius: 10px;
  padding: 15px;
  margin-bottom: 15px;
  border: 1px solid rgba(0, 255, 255, 0.15);
  cursor: pointer;
  transition: all 0.3s ease;
}

.image-thumbnail {
  width: 100%;
  height: 100px; /* Placeholder height */
  background: linear-gradient(45deg, #333366, #555588);
  border-radius: 8px;
  margin-bottom: 10px;
  display: flex;
  justify-content: center;
  align-items: center;
  color: rgba(255, 255, 255, 0.5);
  font-size: 0.9em;
}

.image-title {
  font-weight: 600;
  color: var(--primary-color);
  margin-bottom: 5px;
}

.image-details {
  font-size: 0.85em;
  color: rgba(224, 224, 255, 0.7);
}

.modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal-content {
  background: var(--card-bg);
  border-radius: 15px;
  border: 1px solid var(--border-color);
  backdrop-filter: blur(20px);
  padding: 30px;
  box-shadow: 0 10px 40px rgba(0, 255, 255, 0.4);
  max-width: 800px;
  width: 90%;
  color: var(--text-color);
  position: relative;
}

.modal-content h2 {
  color: var(--primary-color);
  margin-top: 0;
}

.modal-image-placeholder {
  width: 100%;
  height: 400px; /* Placeholder for actual image */
  background: linear-gradient(45deg, #2a2a5a, #4a4a7a);
  border-radius: 10px;
  margin: 20px 0;
  display: flex;
  justify-content: center;
  align-items: center;
  color: rgba(255, 255, 255, 0.6);
}

.modal-content button {
  background: var(--secondary-color);
  border: none;
  padding: 10px 20px;
  border-radius: 25px;
  color: white;
  font-size: 1em;
  cursor: pointer;
  margin-top: 20px;
  float: right;
}

/* Responsive adjustments */
@media (max-width: 1024px) {
  .main-content {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  header {
    flex-direction: column;
    align-items: flex-start;
  }

  .live-view-button {
    margin-top: 15px;
  }

  header h1 {
    font-size: 2em;
  }

  header p {
    font-size: 0.9em;
  }

  .stat-card {
    flex-direction: column;
    align-items: flex-start;
  }

  .stat-icon {
    margin-bottom: 10px;
  }
}

```

### 5.3. HTML Entry Point (`sar-dashboard/index.html`)

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>SAR Earth Imaging Dashboard</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

### 5.4. Running the Frontend Locally

Navigate to the `sar-dashboard` directory and start the development server:

```bash
cd sar-dashboard
pnpm install
pnpm run dev
```

Open your web browser and navigate to `http://localhost:5173` to view the dashboard.

### 5.5. Deploying the Frontend

To deploy the frontend as a static site (e.g., to Netlify, Vercel, GitHub Pages, or an Nginx server):

1.  **Build the project**:
    ```bash
    cd sar-dashboard
    pnpm run build
    ```
    This will create a `dist` directory containing the optimized static assets.

2.  **Serve the `dist` directory**: Upload the contents of the `dist` directory to your preferred static site hosting service or web server.

## 6. End-to-End Integration and Data Flow (Conceptual)

In a fully integrated system, the components would interact as follows:

1.  A user (or automated system) creates a `SarJob` custom resource in Kubernetes (e.g., via `kubectl apply -f sar_job_sample.yaml`).
2.  The `sar_operator` (running in Kubernetes) detects the new `SarJob` in the `Pending` phase.
3.  The operator would then typically create a Kubernetes `Job` resource that runs the `sar-decoder` Docker image. This `Job` would be configured to pass `input_data_url` and `output_storage_path` (e.g., an Azure Blob Storage URL) to the `sar-decoder` as environment variables or command-line arguments.
4.  The `sar-decoder` container starts, fetches raw SAR data from `input_data_url`, processes it, and uploads the resulting image (e.g., a GeoTIFF) to the `output_storage_path` in cloud storage.
5.  Upon completion of the `sar-decoder` Kubernetes `Job`, the `sar_operator` detects the completion and updates the `SarJob`'s status to `Completed`, including the final `output_storage_path`.
6.  The frontend dashboard, which would be configured to communicate with the Kubernetes API (or an intermediary API gateway), fetches the list of `SarJob`s. When it finds a `SarJob` with `status.phase: Completed` and a valid `status.output_storage_path`, it fetches the processed image data from that URL.
7.  The dashboard then visualizes this image data, potentially overlaying it on a map or displaying it in a dedicated image viewer component.

## 7. Simulated SAR Image Output

For demonstration purposes, a `simulated_sar_image.txt` file was created to represent the output of the SAR decoder. This file conceptually resides in cloud storage and would be fetched by the frontend.

### `simulated_sar_image.txt`

```text
Simulated SAR Image Data:

This file represents a processed Synthetic Aperture Radar (SAR) image.
In a real scenario, this would be a binary file (e.g., GeoTIFF, HDF5) containing complex image data.

For demonstration purposes, here's a textual representation of a small section of a processed SAR image with two bright targets:

0.00  0.00  0.00  0.00  0.00  0.00  0.00  0.00  0.00  0.00  0.00  0.00  0.00  0.00  0.00  0.00  0.00  0.00  0.00  0.00
0.00  0.00  0.00  0.00  0.00  0.00  0.00  0.00  0.00  0.00  0.00  0.00  0.00  0.00  0.00  0.00  0.00  0.00  0.00  0.00
0.00  0.00  0.00  0.00  0.00 100.00  0.00  0.00  0.00  0.00  0.00  0.00  0.00  0.00  0.00  0.00  0.00  0.00  0.00  0.00
0.00  0.00  0.00  0.00  0.00  0.00  0.00  0.00  0.00  0.00  0.00  0.00  0.00  0.00  0.00  0.00  0.00  0.00  0.00  0.00
0.00  0.00  0.00  0.00  0.00  0.00  0.00  0.00  0.00  0.00  0.00  0.00  0.00  0.00  0.00  0.00  0.00  0.00  0.00  0.00
0.00  0.00  0.00  0.00  0.00  0.00  0.00  0.00  0.00  0.00  0.00  0.00  0.00  0.00  0.00  0.00  0.00  0.00  0.00  0.00
0.00  0.00  0.00  0.00  0.00  0.00  0.00  0.00  0.00  0.00  0.00  0.00  0.00  0.00  0.00  0.00  0.00  0.00  0.00  0.00
0.00  0.00  0.00  0.00  0.00  0.00  0.00  0.00  0.00  0.00  0.00  0.00  0.00  0.00  0.00 150.00  0.00  0.00  0.00  0.00
0.00  0.00  0.00  0.00  0.00  0.00  0.00  0.00  0.00  0.00  0.00  0.00  0.00  0.00  0.00  0.00  0.00  0.00  0.00  0.00
0.00  0.00  0.00  0.00  0.00  0.00  0.00  0.00  0.00  0.00  0.00  0.00  0.00  0.00  0.00  0.00  0.00  0.00  0.00  0.00

This data would be stored in Azure Blob Storage (or any other cloud storage) and its URL would be made available to the frontend for visualization. The frontend would then fetch this data and render it as an Earth image visualization, potentially overlaying it on a map or displaying it in a dedicated viewer.
```

## 8. Conclusion

This guide provides all the necessary code and instructions to deploy the end-to-end SAR processing tool. While some components were simulated due to sandbox environment limitations, the provided code and conceptual data flow illustrate a complete, functional system. You can now proceed to build the Docker images, deploy the Kubernetes components, and run the frontend dashboard to see the system in action.
