# 🛰️ NISAR Pro: InSAR Analyst User Manual

Welcome! This is the complete operational and technical guide for first-year InSAR analysts and structural engineers using **NISAR Pro** on Windows. 

Here, you will learn how to set up your environment, run the processing engine, monitor dam walls down to the millimeter, and understand the internal math that powers the pipeline.

---

## ⚡ What is NISAR Pro?

Optical satellites (like Sentinel-2 or Landsat) are great, but they have a fatal flaw: **clouds**. If it is cloudy, you see nothing. 

Radar satellites (SAR) solve this. By sending active microwave pulses and measuring the reflections, they see through clouds, storms, and darkness. 

But there is a catch: **radar data is massive**. A single product file is often **5 GB to 30 GB**. Uploading these monster files to a cloud server takes hours and violates data privacy.

**NISAR Pro solves this with a hybrid local architecture:**

```
               +──────────────────────────────────+
               │          Your Browser            │
               │   (React Leaflet Dashboard)      │
               +────────────────┬─────────────────+
                                │
             Real-time Log      │ Job Request (JSON)
             SSE Stream         │ HTTP POST /jobs
                                ▼
               +──────────────────────────────────+
               │         Local Axum Gateway       │
               │        (http://localhost:3000)   │
               +────────────────┬─────────────────+
                                │
                       Spawns   │ Writes JSON
                       Process  │ & GeoTIFFs
                                ▼
               +──────────────────────────────────+
               │        Compiled Rust Engine      │
               │         (sar_processor.exe)      │
               +──────────────────────────────────+
```

* Heavy HDF5 parsing, masking, and quadratic deramping run **locally** on your CPU using a high-performance compiled Rust engine.
* The local Axum gateway manages jobs and streams logs.
* The browser dashboard displays maps and telemetry.
* **Your data never leaves your computer.**

![Architecture Overview](file:///home/aditya/Desktop/sar_analyzer/Docs/assets/architecture_overview.png)

---

## 💻 1. Windows Installation (Zero to Running)

Because the processing engine is written in pure Rust with no external C dependencies (like GDAL or HDF5 C libraries), compilation is incredibly simple on Windows. You just need a standard compiler toolchain.

Follow these 4 steps in order:

### Step 1.1: Install Git
Used to clone and pull updates.
1. Download from [git-scm.com/download/win](https://git-scm.com/download/win).
2. Run the installer. Keep all default settings.
3. Open your terminal (`cmd`) and verify:
   ```cmd
   git --version
   ```

### Step 1.2: Install Node.js
Runs the interactive map dashboard.
1. Download the **v20 LTS (Long-Term Support)** installer from [nodejs.org](https://nodejs.org/).
2. Run the MSI installer and follow the instructions.
3. Verify in your terminal:
   ```cmd
   node --version
   npm --version
   ```

### Step 1.3: Install C++ Build Tools
Rust compiles to machine code, which requires the Microsoft C++ Linker and Windows SDK.
1. Download the Visual Studio Installer from [visualstudio.microsoft.com/downloads](https://visualstudio.microsoft.com/downloads/).
2. In the Workloads tab, check **Desktop development with C++**.
3. Verify the following are checked on the right-hand panel:
   * **MSVC v143 - VS 2022 C++ x64/x86 build tools**
   * **Windows 10 SDK** (or Windows 11 SDK)
4. Click **Install**.

### Step 1.4: Install Rust (Rustup)
Compiles the high-speed backend.
1. Download `rustup-init.exe` from [rustup.rs](https://rustup.rs/).
2. Run it. When the terminal prompts you, type `1` and press **Enter** to install the defaults.
3. Close the terminal, open a new one, and verify:
   ```cmd
   cargo --version
   ```

---

## 🚀 2. Getting the Code & Starting the Servers

Let's boot up the three components of the application.

![User Workflow](file:///home/aditya/Desktop/sar_analyzer/Docs/assets/user_workflow.png)

### Step 2.1: Clone the Repo
Open your Command Prompt and run:
```cmd
git clone https://gitlab.com/Aditya-Narayan-Nayak/nisar_pro.git
cd nisar_pro
```

### Step 2.2: Compile the Engine (`sar_processor`)
This compiles the backend code into an optimized Windows binary:
```cmd
cd sar_processor
cargo build --release
```
> [!NOTE]
> Compilation will take 2–5 minutes on the first run. The compiled executable is saved to: `sar_processor\target\release\sar_processor.exe`. Go back to the root: `cd ..`.

### Step 2.3: Configure & Start the Gateway (`sar-gateway`)
The gateway receives browser requests and coordinates backend tasks.
1. Navigate to the gateway folder:
   ```cmd
   cd sar-gateway
   ```
2. Create a `.env` file using Notepad:
   ```env
   LOCAL_MODE=true
   RUST_LOG=info
   ESA_USERNAME=your_copernicus_username
   ESA_PASSWORD=your_copernicus_password
   ASF_USERNAME=your_nasa_earthdata_username
   ASF_PASSWORD=your_nasa_earthdata_password
   ```

   > [!NOTE]
   > **Is the `.env` file required?**
   > * **If you are only processing local files:** You can skip setting up the API usernames/passwords. The gateway runs in local mode by default.
   > * **If you want to search/download satellite scenes:** You must provide your Copernicus/ESA credentials (`ESA_USERNAME`/`ESA_PASSWORD`) and NASA Earthdata/ASF credentials (`ASF_USERNAME`/`ASF_PASSWORD`) so the gateway can authenticate and fetch the products for you.

3. Run the gateway server:
   ```cmd
   cargo run --release
   ```
   *Keep this Command Prompt window open!* The server runs on `http://localhost:3000`.

### Step 2.4: Launch the Dashboard (`sar-dashboard-v3`)
1. Open a **new, separate Command Prompt window**.
2. Navigate to the dashboard directory:
   ```cmd
   cd path\to\nisar_pro\sar-dashboard-v3
   ```
3. Install dependencies and start the dev server:
   ```cmd
   npm install
   npm run dev
   ```
4. Open your browser and navigate to: **[http://localhost:5173](http://localhost:5173)**.

---

## 📊 3. GCOV vs. GUNW: Which is Which?

You will work with two primary types of NASA/JPL NISAR files (packaged as `.h5` files). 

| File Suffix | Scientific Name | What it Measures | Primary Dam Analysis Use Case |
|---|---|---|---|
| **GCOV** | Geocoded Covariance | Radar Backscatter Intensity (Amplitude) | Outlining reservoir boundaries, flood lines, and land/water transitions. |
| **GUNW** | Geocoded Unwrapped Interferogram | Phase Difference & Coherence | Millimeter-level movement of the concrete dam wall, spillways, and abutments. |

### When to use GCOV (Backscatter Amplitude)
Water acts like a flat mirror to radar. The microwave pulses hit the water and bounce away from the satellite, appearing **pitch black**. Concrete structures and rocks bounce the signal straight back, appearing **bright white**. 
* **Use GCOV** to map reservoir size, calculate water storage, and track changes in surface water lines.

### When to use GUNW (Interferograms)
Phase difference measures the shift in the returning wave between two repeat passes (e.g., 12 days apart). If the ground or dam wall moved, the distance to the satellite changed, shifting the phase.
* **Use GUNW** to compute precise deformation maps and detect structural settling.

---

## 🌊 4. Operational Dam Monitoring Methodology

Your mission: evaluate the safety of dams like the concrete **Hirakud Dam** or the earth-fill **Indravati Dam** using four key telemetry panels:

### 4.1 Line-of-Sight (LOS) Displacement (in mm)
This tracks how much the dam wall is moving toward or away from the satellite.
* **Positive values (Uplift/Upstream movement)**: The concrete wall is tilting upstream or rebound-expanding.
* **Negative values (Subsidence/Downstream movement)**: The wall is tilting downstream under water pressure.
* **Seasonal breathing:** Dams naturally "breathe." When the reservoir is full, the wall tilts downstream (negative). When the reservoir empties, it rebounds upstream (positive).
* **Alert Scenario:** If displacement trends continuously downward (negative) without returning to zero when the reservoir empties, it indicates potential foundation sliding or structural deformation.

### 4.2 Spatial Coherence ($\gamma$)
Coherence is a quality score from `0.0` (noise) to `1.0` (perfectly clean).
* **$\gamma \geq 0.85$ (Persistent Scatterer)**: Solid concrete surfaces, dams, buildings. Millimeter-level displacement accuracy.
* **$\gamma < 0.5$ (Decorrelated)**: Foliage, water, crops. The radar phase is too noisy to trust.
* **Alert Scenario:** A sudden drop in coherence over a concrete spillway indicates surface damage, cracking, or water accumulation.

### 4.3 Reservoir Usable Storage
NISAR Pro automatically scrapes reservoir water levels from the Odisha Hydro Power Corporation (OHPC) portal and calculates storage:
$$\text{Usable Storage \%} = \frac{\text{Current Level} - \text{MDDL}}{\text{FRL} - \text{MDDL}} \times 100$$
* **FRL**: Full Reservoir Level (max capacity).
* **MDDL**: Minimum Drawdown Level (empty capacity).
* **Why it matters:** Peak hydrostatic pressure occurs at 100% Usable Storage. Correlate maximum displacement values against storage levels to verify that wall deflection remains within safe tolerances.

### 4.4 Geotechnical Context (Rainfall, Soil Moisture, Seismic)
* **Rainfall & Soil Moisture:** High rainfall saturates the earth-fill abutments, increasing pore water pressure and risk of slope failure.
* **Seismic activity:** Shows if any recent earthquakes have triggered settling or joint sliding.

---

## 🛠️ 5. The Under-the-Hood Math (GUNW Processing)

When you run the **InSAR Pipeline** on a GUNW file, `sar_processor` executes the following sequence:

```
[HDF5 File] ──> [AOI Index Crop] ──> [CC Masking] ──> [Coherence Masking] ──> [Deramping] ──> [Displacement mm]
```

### Step 5.1: Bounded AOI Cropping
To keep RAM usage low, the parser checks the bounding box coordinates (`xCoordinates`/`yCoordinates`) and loads only the cropped section of the 30 GB file into memory using sliced HDF5 hyper-slab reads.

### Step 5.2: Connected Components Masking (Trusted-Mask)
Phase unwrapping resolves the phase ambiguities. If unwrapping fails (usually over water or trees), the algorithm flags these pixels with **Connected Component ID 0**.
* **Action:** The parser sets all pixels where `connectedComponents == 0` to `NaN` (Not a Number).
* **Why:** Unwrapping errors cause sharp $2\pi$ cycle phase jumps. If left unmasked, they will poison the least-squares solver in the next step, distorting displacement calculations across the entire image.

### Step 5.3: Coherence Masking (Water-Proxy)
* **Action:** The parser sets all pixels with coherence $< 0.3$ to `NaN`.
* **Why:** Open water decorrelates instantly. This step filters out reservoir water noise, preventing random 50mm phase spikes over water bodies.

### Step 5.4: Iterative Robust Quadratic Deramping
Sub-satellite orbit drift and regional atmospheric delay create a large-scale phase ramp across the scene. The processor fits and subtracts a 6-parameter quadratic surface:
$$\phi_{\text{ramp}}(r, c) = a_0 r^2 + a_1 c^2 + a_2 rc + a_3 r + a_4 c + a_5$$
To prevent real dam movements from biasing the ramp calculations, the processor runs a **3-iteration outlier rejection loop**:
1. Fits the quadratic model via Gaussian elimination on inliers.
2. Computes the residual: $\epsilon = \phi_{\text{actual}} - \phi_{\text{ramp}}$.
3. Computes the Median Absolute Deviation (MAD) of residuals and estimates standard deviation:
   $$\sigma_{\text{MAD}} = 1.4826 \times \text{median}(|\epsilon - \text{median}(\epsilon)|)$$
4. Rejects pixels where $|\epsilon| > 2.5 \sigma_{\text{MAD}}$ (flags them as outliers).
5. Refits the coefficients on the remaining inliers.

$$\phi_{\text{clean}} = \phi_{\text{actual}} - \phi_{\text{ramp}} - \text{median}(\phi_{\text{clean}})$$
*(Subtracting the median references the stable background to exactly 0 radians).*

### Step 5.5: Displacement & Adaptive Classification
Cleaned phase in radians is converted directly to Line-of-Sight displacement:
$$\text{Displacement (mm)} = \frac{\phi_{\text{clean}} \times \lambda}{4\pi} \times 1000$$
*(where $\lambda$ is the satellite wavelength, e.g., 0.2384 meters for L-band).*

To classify point severity without manual tuning, NISAR Pro calculates the Median Absolute Deviation (MAD) of the absolute displacement distribution.
* **STABLE**: $|d_{\text{mm}}| < \text{MAD}$
* **CAUTION**: $|d_{\text{mm}}| < 2 \times \text{MAD}$
* **ALERT**: $|d_{\text{mm}}| < 3 \times \text{MAD}$
* **CRITICAL**: $|d_{\text{mm}}| \geq 3 \times \text{MAD}$

> [!NOTE]
> To prevent noise from triggering alerts in perfectly stable locations, the classification MAD value is floored at a minimum of **2.0 mm**.

---

## 📡 6. Real-Time Log Streaming & Event Loop

Here is how data flows from the satellite file to your web browser:

1. **Dashboard Click:** React dashboard sends a POST request to `/jobs` on `sar-gateway` containing the JSON payload:
   ```json
   {
     "input_file": "D:/Data/NISAR_L2_PR_GUNW_001.h5",
     "pipeline": "insar",
     "crop_lat": 20.1234,
     "crop_lon": 83.5678,
     "crop_radius_km": 10.0
   }
   ```
2. **Process Spawn:** The gateway spawns the compiled Rust binary:
   ```cmd
   sar_processor.exe --input D:/Data/NISAR_L2_PR_GUNW_001.h5 --output results/[job_id].tif --crop-lat 20.1234 --crop-lon 83.5678 --crop-radius-km 10.0
   ```
3. **SSE Stream:** The gateway captures stdout/stderr of the running process, sending logs to the browser via **Server-Sent Events (SSE)** at `/jobs/[job_id]/logs`.
4. **Completion Trigger:** Once processing is complete, `sar_processor` writes `results/[job_id]_insar.json` and prints the final event trigger to stdout:
   ```json
   {"event":"insar_report","path":"results/[job_id]_insar.json","summary":{...}}
   ```
5. **JSON Fetch:** The dashboard catches the completion event, fetches the JSON file directly from the gateway, and renders the displacement scatterers as interactive map markers.

---

## 💻 7. CLI Reference (Manual Processing)

If you need to run the processing engine manually from the command line (e.g., for batch processing or debugging), use the following syntax:

```cmd
# Run InSAR displacement processing with custom coherence threshold
sar_processor.exe --input D:/Data/GUNW.h5 --output output_dam.tif --crop-lat 20.67 --crop-lon 83.91 --crop-radius-km 5.0 --insar-coherence-threshold 0.80
```

### Useful CLI Flags:
* `--input <FILE>`: Path to the input `.h5` file (GUNW or GCOV).
* `--output <FILE>`: Destination for the output GeoTIFF.
* `--crop-lat <DEG>`: Center latitude for AOI crop.
* `--crop-lon <DEG>`: Center longitude for AOI crop.
* `--crop-radius-km <KM>`: Crop radius (default is 10.0).
* `--insar-coherence-threshold <VAL>`: Minimum coherence for persistent scatterers (default: 0.85).
* `--ship-detect`: Run the ship detection pipeline (requires GCOV).

---

## 🚨 8. Troubleshooting Guide

### ❌ Rust compiler fails with `linker link.exe not found`
* **Why:** The Microsoft C++ Linker is missing.
* **Fix:** Re-run the Visual Studio Installer, select **Desktop development with C++**, and ensure the **MSVC v143** and **Windows 10/11 SDK** options are checked.

### ❌ Logs print: `No valid grid intersection found`
* **Why:** The coordinates selected on the dashboard map do not overlap with the radar data coverage in the HDF5 file.
* **Fix:** Check the geographical bounds of your loaded file and adjust your map crop box to fit within it.

### ❌ Processor exits abruptly / Out of Memory (OOM)
* **Why:** Your crop area (AOI) is too large. Attempting to parse arrays over a huge region exceeded your system's RAM.
* **Fix:** Crop a smaller bounding box around the dam.

### ❌ Indicator shows `GATEWAY: DISCONNECTED`
* **Why:** The Node dashboard cannot communicate with the Axum backend.
* **Fix:** Make sure the Command Prompt window running the `sar-gateway` (Step 2.3) is active and running on port 3000.
