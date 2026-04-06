# NISAR Pro - Distributed SAR Web Intelligence Platform

NISAR Pro is an enterprise-grade, distributed Synthetic Aperture Radar (SAR) processing platform designed explicitly for the upcoming NASA-ISRO (NISAR) mission. It provides a complete geospatial intelligence workflow: discovering raw NASA Earthdata, triggering on-demand Kubernetes cluster processing ("Hot Processing"), and generating deep-zoom XYZ optical slippy maps for the browser.

---

## 🚀 Getting Started

NISAR Pro supports two execution modes: **Local Subprocess Mode** (easiest for testing, no Kubernetes required) and **Kubernetes Orchestration Mode** (for scalable distributed processing).

### Prerequisites
Ensure you have the following installed:
- **Rust (Cargo):** `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`
- **Node.js (v20+):** Required for the React frontend.
- **Docker / Podman & Kind:** (Only required for Kubernetes mode).

---

## 🛠️ Option A: Local Mode (No Kubernetes Required)

This mode runs the SAR processor as a direct system process, bypassing Kubernetes entirely. Perfect for testing and rapid development.

**1. Compile the Processor**
```bash
cd sar_processor
cargo build --release
```

**2. Run the API Gateway in Local Mode**
Provide the `LOCAL_MODE=true` environment variable to instruct the gateway to spawn the binary directly.
```bash
cd sar-gateway
LOCAL_MODE=true RUST_LOG=info cargo run
```

**3. Start the Mission Control Dashboard**
```bash
cd sar-dashboard-v3
npm install
npm run dev
```

---

## ☸️ Option B: Kubernetes Cluster Deployment

For authentic distributed orchestration of massive 7GB image matrices using the custom `kube-rs` operator.

### 1. Initialize the Cluster
```bash
kind create cluster --name sar-cluster
kubectl apply -k k8s_manifests/
```

### 2. Boot the Backend Microservices
Open three separate terminals:

**Terminal 1: The Kubernetes Operator**
```bash
cd sar_operator_v2
RUST_LOG=info cargo run --release
```

**Terminal 2: The API Gateway**
```bash
cd sar-gateway
export NASA_USERNAME="your_username"
export NASA_PASSWORD="your_password"
RUST_LOG=info cargo run --release
```

**Terminal 3: The React Frontend**
```bash
cd sar-dashboard-v3
npm run dev
```

---

### Step 4: How to Use the Application

Once all three terminals are running, open your browser to **`http://localhost:5173`**.

1. **Global Search (Left Panel):**
   - Use the Leaflet map to pan over your target country (e.g., Japan, Algeria).
   - Enter a date range and click **"QUERY NASA ASF"**.
   - The Gateway will fetch genuine NISAR acquisitions from the NASA Alaska Satellite Facility DAAC.

2. **Scene Selection:**
   - Scroll through the resulting dataset cards. 
   - Hovering over a card will draw a glowing footprint on the map.
   - Click a card to **Lock** it into your Mission Control panel.

3. **Hot Processing (Right Panel):**
   - With a scene locked, the **Active Scene ID** will illuminate.
   - Select your ML Mapping Models (e.g., Ship Detection).
   - Click **"Initiate Orbital Scan"**.

4. **Live Telemetry & Render:**
   - The bottom **Terminal** will slide up and stream raw compilation logs (Range-Doppler Algorithm focusing, Rayon XYZ Web Tiling, Frost Speckle Filtering).
   - Once the K8s pod finishes, the dashboard will seamlessly overlay the newly generated Deep-Zoom XYZ tiles onto the geographic map!

---

## 📂 Core Repository Architecture

- **`sar_processor/`**: The core mathematical Rust engine. Handles HDF5 ingest, RCMC, Azimuth Compression, and Frost Speckle XYZ Web Tiling (`io.rs`).
- **`sar_operator_v2/`**: The custom `kube-rs` controller managing the distributed processing fleet.
- **`sar-gateway/`**: The Axum HTTP bridge handling REST interfaces and live SSE multiplexing.
- **`sar-dashboard-v3/`**: The EOS Landviewer-inspired React/Leaflet mission control UI.
- **`k8s_manifests/`**: The CRDs defining the `SarJob` specification.

## 📚 Documentation Reference
- `Docs/concept.md` - Start Here: High-level overview of why this system exists and how it works.
- `Docs/architecture.md` - Technical specifics on the Kubernetes SSE telemetry and Gateway proxy.
- `Docs/deployment.md` - Remote cluster node specifications.
