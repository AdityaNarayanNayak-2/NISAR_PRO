# 🛰️ NISAR Pro: Friendly User Guide & Companion Manual

Hey there, friend! Welcome to the NISAR Pro guide! 🌟 

Whether you're a structural engineer, an environmental scientist, or just someone looking to track dam stability and vessel movements using satellite radar, you've come to the right place. Don't worry if you don't have a PhD in radar science — we're going to get this up and running on your machine together, step-by-step, with absolutely zero tears!

Let's turn you into a space-radar wizard! 🧙‍♂️

---

## ⚡ What is NISAR Pro? (And why is it cool?)

Optical satellites (like the ones that take standard satellite photos) are great, but they have one major weakness: **clouds**. The moment a storm rolls in, they're blind. 

Radar satellites (SAR) are different. They send down active microwave beams and listen to the reflections. They can see through clouds, rain, storms, and total darkness. It's like having night-vision goggles for the entire planet!

But there is a catch: **radar data files are absolutely massive** (usually **5 GB to 30 GB** each). Uploading these monster files to the cloud takes forever and can trigger data privacy concerns. 

**NISAR Pro solves this by doing the heavy lifting locally:**

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

* **Local Power**: Your computer's CPU runs a high-performance Rust engine that handles HDF5 parsing and coordinates quadratic deramping locally.
* **Gateway Coordinator**: A local Axum server runs in the background to handle requests and stream logs.
* **Friendly UI**: A React dashboard lets you interact with map layers and view telemetry.
* **Privacy First**: **Your data stays on your machine.**

---

## 💻 1. Windows Installation (Quick & Painless)

To keep things simple, our processing engine is written in pure Rust with no complex external C library dependencies (no need to fight with GDAL or HDF5 library configs!).

Follow these 4 simple steps to get your environment ready:

### Step 1.1: Install Git
This is the tool we use to download and update the code.
1. Download Git from [git-scm.com/download/win](https://git-scm.com/download/win).
2. Run the installer, click "Next" on the defaults, and finish.
3. Open your terminal (`Command Prompt`) and run:
   ```cmd
   git --version
   ```

### Step 1.2: Install Node.js
This runs the interactive frontend dashboard.
1. Grab the **v20 LTS (Long-Term Support)** installer from [nodejs.org](https://nodejs.org/).
2. Run the installer and click through the prompts.
3. Verify it's ready:
   ```cmd
   node --version
   npm --version
   ```

### Step 1.3: Install C++ Build Tools
Rust compiles code directly to your machine's language, which requires the standard Microsoft C++ compiler.
1. Download the Visual Studio Community installer from [visualstudio.microsoft.com/downloads](https://visualstudio.microsoft.com/downloads/).
2. When the installer opens, select **Desktop development with C++** under workloads.
3. Make sure these options are checked on the right:
   * **MSVC v143 - VS 2022 C++ x64/x86 build tools**
   * **Windows 10 SDK** (or Windows 11 SDK)
4. Click **Install** and let it download.

### Step 1.4: Install Rust
Let's install the Rust compiler!
1. Download `rustup-init.exe` from [rustup.rs](https://rustup.rs/).
2. Run it. When a black terminal terminal pops up, type `1` and press **Enter** to install the default settings.
3. Restart your terminal, then verify it works:
   ```cmd
   cargo --version
   ```

---

## 🚀 2. Clone, Build, and Run!

Now that our tools are installed, let's spin up the servers.

### Step 2.1: Clone the Code
Open your command prompt and run:
```cmd
git clone https://gitlab.com/Aditya-Narayan-Nayak/nisar_pro.git
cd nisar_pro
```

### Step 2.2: Compile the Processor (`sar_processor`)
Let's build the high-speed Rust engine:
```cmd
cd sar_processor
cargo build --release
```
> [!TIP]
> Go grab a cup of coffee! ☕ The first compilation will take about 2 to 5 minutes as it sets up dependencies. Once done, go back to the root folder: `cd ..`.

### Step 2.3: Set Up the Gateway (`sar-gateway`)
1. Navigate to the gateway folder:
   ```cmd
   cd sar-gateway
   ```
2. Start the gateway server:
   ```cmd
   cargo run --release
   ```
   *Keep this window open!* The API gateway is now running on `http://localhost:3000`.

### Step 2.4: Launch the Web Dashboard (`sar-dashboard-v3`)
1. Open a **brand new Command Prompt window**.
2. Go to the dashboard folder:
   ```cmd
   cd path\to\nisar_pro\sar-dashboard-v3
   ```
3. Install dependencies and start the dev server:
   ```cmd
   npm install
   npm run dev
   ```
4. Click the link in your terminal or open your browser to **[http://localhost:5173](http://localhost:5173)**. 🎉

---

## 📊 3. GCOV vs. GUNW: The Simple Cheat Sheet

You will work with two primary types of NASA/JPL NISAR files (which end in `.h5`). Here is how to tell them apart:

| Product Suffix | Friendly Name | What it Measures | Best Use Case |
|---|---|---|---|
| **GCOV** | Geocoded Covariance | Reflection Amplitude (Brightness) | Outlining shorelines, reservoir boundaries, and flood maps. |
| **GUNW** | Unwrapped Interferogram | Phase Difference & Quality | Tracking millimeter movements of dams, bridges, and hillsides. |

* **Amplitude (GCOV)**: Water acts like a flat mirror, reflecting radar beams away from the satellite, so it appears **pitch black**. Rocks and concrete bounce the radar straight back, appearing **bright white**.
* **Interferometry (GUNW)**: Measures the shift in the radar wave's phase between two satellite passes (typically 12 days apart). If the ground or dam moves, the distance changes, shifting the wave phase.

---

## 🌊 4. How to Monitor a Dam (Like a Pro)

Your main job is checking structure safety using the four telemetry tools on the dashboard:

### 4.1 Line-of-Sight (LOS) Displacement (in mm)
Tracks whether a structure is moving toward or away from the satellite.
* **Positive values (Uplift)**: The structure is expanding or tilting upstream.
* **Negative values (Subsidence)**: The structure is settling or tilting downstream.
* **Seasonal Breathing**: Earthen and concrete dams naturally flex. When a reservoir fills up, water pressure pushes the wall downstream (negative displacement). When the reservoir is emptied, the wall bounces back (positive displacement).

### 4.2 Spatial Coherence ($\gamma$)
A quality score from `0.0` (pure noise) to `1.0` (perfectly clean signal).
* **High Coherence ($\gamma \geq 0.85$)**: Solid concrete surfaces, dams, and bedrock. This is where displacement measurements are highly accurate.
* **Low Coherence ($\gamma < 0.5$)**: Forests, farm fields, and water. The radar waves scatter randomly here, so the phase data is too noisy to trust.

### 4.3 Reservoir Usable Storage
NISAR Pro automatically calculates storage capacity by comparing current reservoir levels against minimum and maximum water limits:
$$\text{Usable Storage \%} = \frac{\text{Current Level} - \text{MDDL}}{\text{FRL} - \text{MDDL}} \times 100$$
* High storage levels mean high water pressure. You can correlate peak displacement values against storage levels to ensure deflections remain within design tolerances.

### 4.4 Environmental Context
Keep an eye on regional rainfall, soil saturation, and local seismic events. Saturated soil along dam abutments increases pore pressure, making slope monitoring critical.

---

## 🧮 5. A Look Under the Hood (The Math Made Simple)

When you run an InSAR job, `sar_processor` goes through these processing steps:

```
[HDF5 File] ──> [AOI Crop] ──> [CC Masking] ──> [Coherence Filter] ──> [Deramping] ──> [Displacement mm]
```

1. **AOI Cropping**: Loads only the selected region of interest (AOI) into memory, keeping RAM usage low.
2. **Connected Components Masking**: Filters out areas where phase unwrapping failed (typically over forests or water), setting those pixels to `NaN` (Not a Number).
3. **Coherence Masking**: Filters out pixels with coherence $< 0.3$ to remove water noise and vegetation clutter.
4. **Iterative Robust Quadratic Deramping**: Satellite orbit drift can introduce a tilt (phase ramp) across the image. The processor fits a quadratic equation to estimate this tilt:
   $$\phi_{\text{ramp}}(r, c) = a_0 r^2 + a_1 c^2 + a_2 rc + a_3 r + a_4 c + a_5$$
   To ensure real ground movement doesn't skew this calculation, the processor runs a **3-iteration outlier rejection loop** based on the Median Absolute Deviation (MAD), filtering out pixels with high residuals.
5. **Displacement Conversion**: Converts the clean phase from radians to real displacement:
   $$\text{Displacement (mm)} = \frac{\phi_{\text{clean}} \times \lambda}{4\pi} \times 1000$$
   *(where $\lambda$ is the L-band radar wavelength of 0.2384 meters).*

---

## 🚨 6. Quick Troubleshooting (No Panic!)

### ❌ Rust fails with: `linker link.exe not found`
* **Fix**: The C++ compiler toolchain is missing. Open the Visual Studio Installer, select **Desktop development with C++**, check **MSVC v143** and the **Windows SDK**, and install.

### ❌ Logs show: `No valid grid intersection found`
* **Fix**: The coordinates selected on the map don't match the coverage area of the loaded satellite data. Zoom out on the map to find the correct data bounding box.

### ❌ Processor exits abruptly / Out of Memory (OOM)
* **Fix**: The crop area (AOI) selected on the map is too large. Reduce the crop radius (e.g., to 5km or 10km) to lower the memory footprint.

### ❌ Dashboard says: `GATEWAY: DISCONNECTED`
* **Fix**: The frontend can't reach the backend. Check the terminal window running `sar-gateway` (Step 2.3) and make sure the server is still running on port 3000.
