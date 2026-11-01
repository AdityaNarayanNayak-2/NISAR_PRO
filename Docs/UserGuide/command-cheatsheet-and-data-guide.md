# 🛰️ NISAR Pro — Scientific Command Cheatsheet & Granule Identification Guide

This guide provides an exhaustive reference for:
1. **NISAR Standard Granule File Naming Convention & Identification** (NASA JPL L-band vs ISRO SAC S-band).
2. **The Bihar Multi-Temporal & Dual-Frequency Master Data Stack** (Granule inventory, spatial bounds, and lattice parameters).
3. **Command Cheatsheet for Pure-Rust Science Execution** (`sar_science_processor` full-swath and regional runs).
4. **Command Cheatsheet for Gateway, Multi-Device Dashboard, and REST API Execution**.
5. **Output Artifact Specification & Metrics Interpretation**.

---

## 1. NISAR File Naming Convention & Granule Deconstruction

NISAR (NASA-ISRO Synthetic Aperture Radar) data products follow a strict international nomenclature established by NASA JPL and ISRO SAC. Every character in the filename encodes sensor frequency, orbit geometry, acquisition timestamp, polarization, and processing pedigree.

### 1.1 Filename Template

```text
NISAR_{INST}_{LVL}_{TYPE}_{CYCLE}_{ORBIT}_{PASS}_{TRACK}_{FRAME}_{POL}_{FREQ}_{START}_{STOP}_{PCONFIG}_{STATUS}_{FIDELITY}_{FACILITY}_{VER}.h5
```

### 1.2 Breakdown of a Bihar Master Granule

Example L-band Granule:
`NISAR_L2_PR_GCOV_029_098_A_014_4005_DHDH_A_20260831T233810_20260831T233845_P05023_N_F_J_001.h5`

| Token | Value in Example | Parameter | Meaning & Scientific Significance |
| :--- | :--- | :--- | :--- |
| **`MISSION`** | `NISAR` | Mission Name | NASA-ISRO Synthetic Aperture Radar joint observatory |
| **`INST`** | `L2` | Sensor & Band | **`L2`**: NASA L-band ($1.25\text{ GHz}$, $\lambda = 24.0\text{ cm}$). Penetrates dense canopy.<br>**`S2`**: ISRO S-band ($3.2\text{ GHz}$, $\lambda = 9.3\text{ cm}$). Highly sensitive to surface roughness. |
| **`LVL`** | `PR` | Processing Level | **`PR`**: Precision Range-Doppler / Projected (geocoded).<br>**`UR`**: Unconstrained Range-Doppler format. |
| **`TYPE`** | `GCOV` | Product Type | **`GCOV`**: Geocoded Calibrated Covariance matrix ($\gamma^0$).<br>**`GSLC`**: Geocoded Single Look Complex.<br>**`GUNW`**: Geocoded Unwrapped Interferogram. |
| **`CYCLE`** | `029` | Repeat Cycle | Satellite orbital cycle index (NISAR repeats its exact ground orbit every 12 days). |
| **`ORBIT`** | `098` | Orbit Number | Specific revolution count within the 12-day cycle. |
| **`PASS`** | `A` | Pass Direction | **`A`**: Ascending (South $\to$ North evening pass, $\sim$23:38 UTC / 05:08 IST).<br>**`D`**: Descending (North $\to$ South morning pass). |
| **`TRACK`** | `014` | Relative Track | Ground track identifier covering eastern Uttar Pradesh, Bihar, and Jharkhand. |
| **`FRAME`** | `4005` | Along-track Frame | Sub-swath frame index covering Patna, Samastipur, and the lower Kosi river basin (`3700` in S-band). |
| **`POL`** | `DHDH` | Polarimetric Mode | **`DHDH`**: Dual-pol with H transmit ($\text{HH} + \text{HV}$).<br>**`DHNA`**: Dual-pol with Non-Active auxiliary channel (ISRO S-band mode). |
| **`FREQ`** | `A` | Frequency Channel | Primary wideband observation frequency ($5\text{ MHz} / 20\text{ MHz} / 40\text{ MHz}$ bandwidth). |
| **`START`** | `20260831T233810` | Acquisition Start | UTC timestamp: `YYYYMMDDTHHMMSS` (2026-08-31 at 23:38:10 UTC = 2026-09-01 05:08:10 IST). |
| **`STOP`** | `20260831T233845` | Acquisition Stop | UTC timestamp: `YYYYMMDDTHHMMSS` (duration: 35 seconds of continuous SAR imaging). |
| **`PCONFIG`** | `P05023` | Processing Table | Science data system processor parameter version (`P00500` for ISRO SAC processor). |
| **`STATUS`** | `N` | Operational Status | **`N`**: Normal planned science.<br>**`E`**: Urgent response / Emergency observation. |
| **`FIDELITY`** | `F` | Science Fidelity | **`F`**: Final calibrated science fidelity.<br>**`Q`**: Quicklook / near-real-time. |
| **`FACILITY`** | `J` | Processing Centre | **`J`**: NASA Jet Propulsion Laboratory (Pasadena, USA).<br>**`I`**: ISRO Space Applications Centre (Ahmedabad, India) / NRSC (Hyderabad). |
| **`VER`** | `001` | Product Release | Archive version number formatted in HDF5 (`.h5`). |

---

## 2. Bihar Master Data Stack (`/home/aditya/Desktop/nisar_data/`)

The local master directory contains 50 GB of validated, calibrated dual-frequency NISAR L2/S2 GCOV scenes acquired over the Ganga Alluvial Plain during the 2026 monsoon flood lifecycle.

### 2.1 Granule Inventory & Identification Table

| File Name | Band & Sensor | Date (UTC) | Local IST Time | Lifecycle Role | File Size |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `NISAR_L2_PR_GCOV_026_098_A_014_4005_DHDH_A_20260726T233812_20260726T233846_P05023_N_F_J_001.h5` | **L-band (NASA)** | 2026-07-26 | 27 Jul 05:08 | **Epoch 1: Early Monsoon Baseline** (Pre-flood reference) | 6.4 GB |
| `NISAR_L2_PR_GCOV_029_098_A_014_4005_DHDH_A_20260831T233810_20260831T233845_P05023_N_F_J_001.h5` | **L-band (NASA)** | 2026-08-31 | 01 Sep 05:08 | **Epoch 2: Immediate Pre-Flood Baseline** (Primary expansion baseline) | 6.6 GB |
| `NISAR_L2_PR_GCOV_030_098_A_014_4005_DHDH_A_20260912T233810_20260912T233845_P05023_N_F_J_001.h5` | **L-band (NASA)** | 2026-09-12 | 13 Sep 05:08 | **Epoch 3: Peak Flood Active** (Maximum Gangetic inundation) | 6.6 GB |
| `NISAR_L2_PR_GCOV_033_098_A_014_4005_DHDH_A_20261018T233811_20261018T233845_P05023_N_F_J_001.h5` | **L-band (NASA)** | 2026-10-18 | 19 Oct 05:08 | **Epoch 4: Post-Flood Recession** (Water drainage & soil recovery) | 6.4 GB |
| `NISAR_S2_UR_GCOV_029_098_A_014_3700_DHNA_A_20260831T233810_20260831T233846_P00500_M_F_I_001.h5` | **S-band (ISRO)** | 2026-08-31 | 01 Sep 05:08 | **ISRO S-band Baseline** (Pre-flood surface roughness baseline) | 12 GB |
| `NISAR_S2_UR_GCOV_030_098_A_014_3700_DHNA_A_20260912T233809_20260912T233846_P00500_N_F_I_001.h5` | **S-band (ISRO)** | 2026-09-12 | 13 Sep 05:08 | **ISRO S-band Active** (Peak flood roughness & dual-frequency fusion) | 12 GB |

### 2.2 Grid & Lattice Relationship (The 8×8 Multi-Look Discovery)

* **Coordinate System**: `EPSG:32645` (WGS 84 / UTM Zone 45N).
* **Native Resolution**: $10\text{ m} \times 10\text{ m}$ pixel spacing.
* **Multilooked Resolution ($8 \times 8$)**: $80\text{ m} \times 80\text{ m}$ ($0.0064\text{ km}^2 / \text{pixel} = 1.5815\text{ acres}/\text{pixel}$).
* **L-Band Full Array**: $33,696 \times 34,344$ native pixels $\longrightarrow 4,212 \times 4,293$ multilooked pixels ($18.08\text{M}$ pixels, $72.3\text{ MB}$).
* **S-Band Full Array**: $33,120 \times 34,200$ native pixels $\longrightarrow 4,140 \times 4,275$ multilooked pixels ($17.70\text{M}$ pixels, $70.8\text{ MB}$).
* **Exact Spatial Overlap**:
  $$\Delta X = 720\text{ m} = 72\text{ native px} = 9\text{ multilooked px}$$
  $$\Delta Y = 2,880\text{ m} = 288\text{ native px} = 36\text{ multilooked px}$$
  * Common Overlap Grid: Exactly **$4,140 \times 4,275$ pixels** on the common UTM Zone 45N lattice.

---

## 3. Command Cheatsheet: Pure-Rust Science Processor (`sar_science_processor`)

All commands below run using the compiled, optimized release binary located at:
`./sar_science_processor/target/release/sar_science_processor`

### Command 1: L-Band Full Swath Flood Expansion (Aug 31 vs Sep 12)
*Processes 1.157 billion raw observations in 63 seconds using 1.79 GB RAM.*

```bash
./sar_science_processor/target/release/sar_science_processor \
  --mode flood \
  --input /home/aditya/Desktop/nisar_data/NISAR_L2_PR_GCOV_030_098_A_014_4005_DHDH_A_20260912T233810_20260912T233845_P05023_N_F_J_001.h5 \
  --slave /home/aditya/Desktop/nisar_data/NISAR_L2_PR_GCOV_029_098_A_014_4005_DHDH_A_20260831T233810_20260831T233845_P05023_N_F_J_001.h5 \
  --crop-preset full \
  --swath-edge-erosion 40 \
  --radar-band l \
  --output ./results/sar-bihar-aug31-sep12-full
```

### Command 2: ISRO S-Band Full Swath Flood Detection (Aug 31 vs Sep 12)
*Calibrated S-band processing with automated frequency-specific Otsu thresholding.*

```bash
./sar_science_processor/target/release/sar_science_processor \
  --mode flood \
  --input /home/aditya/Desktop/nisar_data/NISAR_S2_UR_GCOV_030_098_A_014_3700_DHNA_A_20260912T233809_20260912T233846_P00500_N_F_I_001.h5 \
  --slave /home/aditya/Desktop/nisar_data/NISAR_S2_UR_GCOV_029_098_A_014_3700_DHNA_A_20260831T233810_20260831T233846_P00500_M_F_I_001.h5 \
  --crop-preset full \
  --swath-edge-erosion 40 \
  --radar-band s \
  --output ./results/sar-bihar-sband-aug31-sep12-full
```

### Command 3: L-Band Flood Recession & Water Loss (Sep 12 vs Oct 18)
*Quantifies water drainage and agricultural land recovery as floodwaters receded.*

```bash
./sar_science_processor/target/release/sar_science_processor \
  --mode flood \
  --input /home/aditya/Desktop/nisar_data/NISAR_L2_PR_GCOV_033_098_A_014_4005_DHDH_A_20261018T233811_20261018T233845_P05023_N_F_J_001.h5 \
  --slave /home/aditya/Desktop/nisar_data/NISAR_L2_PR_GCOV_030_098_A_014_4005_DHDH_A_20260912T233810_20260912T233845_P05023_N_F_J_001.h5 \
  --crop-preset full \
  --swath-edge-erosion 40 \
  --radar-band l \
  --output ./results/sar-bihar-sep12-oct18-recession
```

### Command 4: Early Monsoon Baseline Progression (Jul 26 vs Sep 12)
*Evaluates permanent pre-monsoon water channels vs severe seasonal inundation.*

```bash
./sar_science_processor/target/release/sar_science_processor \
  --mode flood \
  --input /home/aditya/Desktop/nisar_data/NISAR_L2_PR_GCOV_030_098_A_014_4005_DHDH_A_20260912T233810_20260912T233845_P05023_N_F_J_001.h5 \
  --slave /home/aditya/Desktop/nisar_data/NISAR_L2_PR_GCOV_026_098_A_014_4005_DHDH_A_20260726T233812_20260726T233846_P05023_N_F_J_001.h5 \
  --crop-preset full \
  --swath-edge-erosion 40 \
  --radar-band l \
  --output ./results/sar-bihar-jul26-sep12-monsoon-expansion
```

### Command 5: Rapid Targeted AOI Crop (Patna Ganga Confluence)
*Instant sub-second analysis over a specific coordinate box (e.g., $20\text{ km} \times 20\text{ km}$ window).*

```bash
./sar_science_processor/target/release/sar_science_processor \
  --mode flood \
  --input /home/aditya/Desktop/nisar_data/NISAR_L2_PR_GCOV_030_098_A_014_4005_DHDH_A_20260912T233810_20260912T233845_P05023_N_F_J_001.h5 \
  --slave /home/aditya/Desktop/nisar_data/NISAR_L2_PR_GCOV_029_098_A_014_4005_DHDH_A_20260831T233810_20260831T233845_P05023_N_F_J_001.h5 \
  --crop-lat 25.61 \
  --crop-lon 85.14 \
  --crop-preset 20x20km \
  --radar-band l \
  --output ./results/sar-bihar-patna-20km
```

### Command 6: Dual-Frequency L+S Fusion & Polarimetric Assessment
*Fuses 80m L-band and S-band lattices and generates the 3-panel publication comparison.*

```bash
python3 scripts/run_ls_fusion_and_pol_assessment.py
```

### Command 7: Microsecond Benchmark Suite
*Runs the native Rust Rayon and memory chunking verification tests.*

```bash
cd sar_science_processor
cargo run --release --bin bench_rust_flood
```

---

## 4. Command Cheatsheet: Gateway, Multi-Device Dashboard & API

### 4.1 Launching the Unified Server (Gateway + Dashboard)

From the project root:

```bash
# Build the production dashboard bundle (if changes were made)
cd sar-dashboard-v3 && npm run build && cd ..

# Launch the Axum Gateway (binds to 0.0.0.0:3000)
cd sar-gateway
RUST_LOG=info ./target/release/sar-gateway
```

### 4.2 Multi-Device Access (Local Network / LAN)

* **Local Machine Access**: Open `http://localhost:3000`
* **Other PC / Tablet on LAN**: Open `http://192.168.1.20:3000`
  * *Note: The frontend automatically resolves API calls to the host IP without requiring any manual settings.*

### 4.3 Triggering Analysis via REST API (`curl`)

Submit a new flood analysis job to the gateway programmatically:

```bash
curl -X POST http://localhost:3000/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "pipeline": "flood",
    "processor": "science",
    "crop_preset": "full",
    "swath_edge_erosion": 40,
    "radar_band": "l",
    "input_file": "/home/aditya/Desktop/nisar_data/NISAR_L2_PR_GCOV_030_098_A_014_4005_DHDH_A_20260912T233810_20260912T233845_P05023_N_F_J_001.h5",
    "slave_file": "/home/aditya/Desktop/nisar_data/NISAR_L2_PR_GCOV_029_098_A_014_4005_DHDH_A_20260831T233810_20260831T233845_P05023_N_F_J_001.h5"
  }'
```

*Response returns a unique `job_id` (e.g. `job_1730273849102`).*

### 4.4 Stream Live Execution Logs (Server-Sent Events)

```bash
curl -N http://localhost:3000/jobs/{job_id}/logs
```

---

## 5. Output Artifact Specification & Metrics Interpretation

Every pipeline execution generates a matched suite of 5 standardized artifacts in `results/`:

```text
results/
├── <job_id>_flood.json          # Calibrated JSON report with dual-unit stats
├── <job_id>_flood.geo.json      # Merged GeoJSON polygons (Class 2, 3, 4)
├── <job_id>_flood.png           # RGBA classified flood map overlay for Leaflet
├── <job_id>_flood_baseline.png  # Grayscale temporal baseline backscatter
├── <job_id>_flood_active.png    # Grayscale active scene backscatter
└── <job_id>_flood_class.tif     # 32-bit floating point GeoTIFF classification map
```

### 5.1 JSON Report Schema Key Metrics

```json
{
  "active_date": "2026-09-12T23:38:10",
  "baseline_date": "2026-08-31T23:38:10",
  "radar_band": "L",
  "effective_otsu_db": -19.42,
  "metrics": {
    "stable_water_km2": 1845.21,
    "stable_water_acres": 455960.5,
    "water_gain_km2": 2501.63,
    "water_gain_acres": 618165.2,
    "water_loss_km2": 412.08,
    "water_loss_acres": 101827.1,
    "total_inundated_km2": 4346.84,
    "total_inundated_acres": 1074125.7
  },
  "georef_bbox": {
    "south": 23.216575,
    "north": 26.276759,
    "west": 84.444969,
    "east": 87.883724
  }
}
```

### 5.2 4-Class Temporal Dynamics Classification Table

| Class ID | Categorization | Definition & Mathematical Criterion | UI Overlay Color | Hex Code |
| :---: | :--- | :--- | :---: | :---: |
| **`0`** | **Stable Non-Water Land** | Non-water at both baseline and active observation dates | *Transparent* | `rgba(0,0,0,0)` |
| **`1`** | **Stable Water Body** | Baseline $< -15.5\text{ dB}$ AND Active $< -15.5\text{ dB}$ (Main river channel & lakes) | Cyan | `#00e5ff` |
| **`2`** | **Newly Inundated (High Conf)** | Active $< \text{Otsu}$ AND $\Delta\text{dB} \le -5.0\text{ dB}$ (Unambiguous open-water flood) | Crimson Red | `#ef4444` |
| **`3`** | **Newly Inundated (Med Conf)** | Connected component region-grown from Class 2 seeds ($\Delta\text{dB} \le -2.5\text{ dB}$) | Coral Orange | `#f97316` |
| **`4`** | **Newly Inundated (Low Conf)** | Secondary water classification near water margin boundary | Amber Orange | `#fb923c` |
| **`5`** | **Water Loss / Receded** | Baseline $< -15\text{ dB}$ AND Active $\ge -15\text{ dB}$ AND $\Delta\text{dB} \ge +3.0\text{ dB}$ | Warm Gold | `#f59e0b` |

---
*Maintained under the InGARSS 2026 Young Professionals Hackathon Engineering Protocol.*
