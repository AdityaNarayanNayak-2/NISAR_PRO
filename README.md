# NISAR Pro - Distributed SAR Web Intelligence Platform

NISAR Pro is an enterprise-grade, distributed Synthetic Aperture Radar (SAR) processing platform designed explicitly for the upcoming NASA-ISRO (NISAR) mission. It provides a complete geospatial intelligence workflow: discovering raw NASA Earthdata, triggering on-demand Kubernetes cluster processing ("Hot Processing"), and generating deep-zoom XYZ optical slippy maps for the browser.

---

## 🚀 Step-by-Step Installation & Execution Tutorial

Follow these instructions to deploy the entire NISAR Pro stack locally on your machine.

### Step 1: System Prerequisites
Ensure you have the following installed on your Linux/macOS machine:
- **Rust (Cargo):** `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`
- **Node.js (v20+):** Required for the React frontend.
- **Docker / Podman:** Required to run the local Kubernetes nodes.
- **Kind (Kubernetes in Docker):** `go install sigs.k8s.io/kind@v0.20.0`
- **Kubectl:** The Kubernetes command-line tool.

---

### Step 2: Initialize the Kubernetes Cluster
NISAR Pro relies a distributed Kubernetes architecture to orchestrate massive 7GB image array matrices without crashing the main application thread.

1. **Create the local development cluster:**
   ```bash
   kind create cluster --name sar-cluster
   ```
2. **Define the custom `SarJob` operations pipeline:**
   ```bash
   kubectl apply -k k8s_manifests/
   ```

---

### Step 3: Boot the Backend Microservices
Open **three separate terminal window tabs**, as each component runs continuously.

#### Terminal 1: The Kubernetes Operator
This controller watches the cluster for new processing requests and spins up processor pods.
```bash
cd sar_operator_v2
RUST_LOG=info cargo run --release
```

#### Terminal 2: The API Gateway
This gateway proxies the dashboard's NASA searches and pipes the Kubernetes processing logs back to the browser via Server-Sent Events (SSE).
```bash
cd sar-gateway
# Optional: Provide NASA Earthdata credentials if pulling private Level-0 data
export ESA_USERNAME="your_username"
export ESA_PASSWORD="your_password"
RUST_LOG=info cargo run --release
```

#### Terminal 3: The React Frontend
This is the mission control dashboard.
```bash
cd sar-dashboard-v3
npm install
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
