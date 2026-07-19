# 🦀 NISAR Pro: Complete Crate Walkthrough & Code Guide

This document is a deeply specific, granular walkthrough of the `sar_processor` Rust engine. It traces the exact execution path of a NASA GUNW (Geocoded Unwrapped Interferogram) file as it enters `main.rs`, gets parsed in `gunw_parser.rs`, mathematically deramped in `deramp.rs`, classified in `infra_health.rs`, and written to disk in `io.rs`.

---

## Step 1: CLI Parsing & Initialization (`main.rs`)

When the API Gateway spawns the processor, execution begins in `sar_processor/src/main.rs`.

**1. CLI Parsing (Lines 91-100)**
```rust
#[tokio::main]
async fn main() -> Result<()> {
    env_logger::init();
    let cli = Cli::parse();
    // ...
}
```
The program uses `clap` to parse arguments into a `Cli` struct. Key arguments include:
* `cli.input`: Path to the `.h5` file (e.g., `NISAR_L2_PR_GUNW_...h5`)
* `cli.output`: Output filename base (e.g., `results/sar-f83d2a1b.tif`)
* `cli.crop_lat` / `cli.crop_lon`: Target coordinate (e.g., 18.7889, 82.6049 for Upper Kolab Dam).

**2. Execution Routing (Lines 108-123)**
The code checks the extension. If it is `h5`, it checks if the filename contains `_GUNW_`. If it does, it skips the entire raw SLC focusing pipeline (which takes 12 steps) and enters the **GUNW Fast-Path**.

---

## Step 2: HDF5 Parsing & Memory Management (`gunw_parser.rs`)

`main.rs` calls `gunw_parser::parse_gunw(input, &cli.polarization, crop.as_ref())`. The execution jumps to `sar_processor/src/gunw_parser.rs`.

**1. Reading Spatial Coordinates (Lines 70-120)**
The parser opens the HDF5 file using `rustyhdf5::File::open`. It attempts to read the geographic coordinate grids:
* `/science/LSAR/GUNW/grids/frequencyA/unwrappedInterferogram/xCoordinates` (Longitudes)
* `/science/LSAR/GUNW/grids/frequencyA/unwrappedInterferogram/yCoordinates` (Latitudes)

**2. Calculating Crop Indices (Lines 154-227)**
To avoid loading a 30 GB dataset into memory, the system uses the 1D coordinate arrays to calculate matrix bounds. 
* It calculates `lat_radius` and `lon_radius` in degrees.
* Calls `find_index_range(ys, lat_min, lat_max)` to find `row_start` and `row_end`.
* Returns `crop_range = Some((row_start, row_end, col_start, col_end))`.

**3. Reading and Slicing Pixel Arrays (Lines 259-265)**
The parser reads the main unwrapped phase dataset (e.g., `/science/LSAR/GUNW/grids/frequencyA/unwrappedInterferogram/HH/unwrappedPhase`). 
* Because `rustyhdf5` doesn't natively support hyperslabs, `read_2d_f32_cropped()` loads the data into a raw 1D `Vec<f32>`, reshapes it into an `ndarray::Array2<f32>`, slices it using `full_arr.slice(ndarray::s![row_start..row_end, col_start..col_end]).to_owned()`, and immediately drops the full array to reclaim RAM.

**4. Dataset Masking & Cleaning (Lines 269-401)**
The parsed `unwrapped_phase` array contains noise. The parser cleans it by iterating over the array using `.iter_mut()`:
* **Connected Components:** Reads `connectedComponents`. If `cc == 0` (unwrapping failure), it mutates `*phase = f32::NAN`.
* **Ionosphere Phase Screen:** Reads `ionospherePhaseScreen`. If present, it subtracts it: `*phase -= iono_val`.
* **Low Coherence Mask:** Reads `coherenceMagnitude`. If `coh < 0.3`, it sets `*phase = f32::NAN`.

It returns a `GunwProduct` struct containing the cleaned `Array2` phase and coherence back to `main.rs`.

---

## Step 3: Removing Signal Artifacts (`deramp.rs`)

Back in `main.rs`, the engine calls `sar_processor::deramp::deramp_phase(&gunw.unwrapped_phase, &gunw.coherence, 0.85)`. This jumps to `sar_processor/src/deramp.rs`.

**1. Normalizing Coordinates (Lines 42-55)**
To prevent numerical explosion during quadratic fitting, row and column indices are normalized to a `[0.0, 1.0]` range (`rn` and `cn`). Valid points (`is_finite()` and `coh >= 0.85`) are pushed into a vector of observations `obs`.

**2. Robust Iterative Fitting (Lines 68-137)**
The engine executes 3 iterations (`ROBUST_ITERATIONS = 3`) to fit the surface model: 
$$\phi_{\text{model}} = a \cdot r^2 + b \cdot c^2 + d \cdot rc + e \cdot r + f \cdot c + g$$
* It builds a normal equation matrix (`ata`) and RHS vector (`atb`), passing them to `solve_6x6()`.
* `solve_6x6()` performs Gaussian elimination with partial pivoting to yield coefficients `[a, b, d, e, f, g]`.
* It calculates the residual (`phi - model`) for every point.
* It calculates the Median Absolute Deviation (MAD) of the residuals. 
* Any pixel with an absolute residual $> 2.5 \times 1.4826 \times \text{MAD}$ is marked as an outlier (`inlier_mask[i] = false`) and excluded from the next iteration. This ensures actual ground deformation doesn't trick the algorithm into thinking it's an atmospheric ramp.

**3. Applying the Deramp & Referencing (Lines 147-191)**
It iterates over the full array, subtracting the quadratic model from every pixel. Finally, it calculates the median value of the remaining high-coherence pixels and subtracts it from the entire grid (Median Referencing), ensuring the "stable" background pixels sit exactly at $0.0$ radians.

---

## Step 4: Physical Calculations (`main.rs`)

Once `deramped_phase` is returned to `main.rs`, it scales the abstract phase angles (radians) into physical Line-of-Sight (LOS) displacement (millimeters).

**Lines 174-180:**
```rust
let displacement_mm_array = defo_phase.mapv(|phi| {
    if phi.is_finite() {
        phi * gunw.wavelength_m * 1000.0 / (4.0 * std::f32::consts::PI)
    } else {
        f32::NAN
    }
});
```
This applies the standard formula $d = \frac{\phi \cdot \lambda \cdot 1000}{4\pi}$ using `ndarray`'s inline `mapv` method. For L-band, $\lambda \approx 0.2384$m.

---

## Step 5: GeoTIFF Generation (`io.rs`)

`main.rs` calls `save_geotiff_f32(displacement_mm_array.view(), &defo_path, bbox_opt)?`. The execution moves to `sar_processor/src/io.rs`.

**1. Structuring the Raw TIFF Bytes (Lines 844-969)**
Rust does not natively write GeoTIFFs easily, and adding GDAL as a dependency causes massive deployment overhead. `io.rs` writes the raw TIFF specification bytes manually.
* It allocates a 256x256 tiled grid (`tile_bytes = 256 * 256 * 4`).
* It copies the `f32` data into these byte vectors in Little Endian format `val.to_le_bytes()`.
* It constructs the standard TIFF Image File Directory (IFD), pointing to the tiles.

**2. Injecting GeoTIFF Tags (Lines 947-962)**
To make it readable by Leaflet and QGIS, it manually writes specific IFD tags:
* **Tag 34264 (ModelTransformationTag):** Writes a 16-element float array (a 4x4 matrix) defining the geographic scale `(east - west) / cols` and origins.
* **Tag 34735 (GeoKeyDirectoryTag):** Writes `[1, 1, 0, 3, 1024, 0, 1, 2, ... 4326]`, telling mapping engines the data is EPSG:4326 (WGS84 Lat/Lon).
* **Tag 42113 (GDAL_NODATA):** Injects `b"nan\0"`. This tells mapping engines (like TiTiler) to render `NaN` values as 100% transparent pixels.

The bytes are flushed to disk using `std::io::BufWriter` for speed.

---

## Step 6: Persistent Scatterer Analysis (`infra_health.rs`)

Back in `main.rs`, the engine calls `analyze_infrastructure_unwrapped(&defo_phase, &gunw.coherence, &options)`. This jumps to `sar_processor/src/infra_health.rs`.

**1. Point Collection (Lines 76-102)**
Iterates over the displacement array. Any pixel where `coh >= 0.85` (highly reflective objects like dams, bridges, buildings) is extracted into a `RawPoint` struct containing `(r, c, phase, coh, disp_mm)`.

**2. Adaptive Severity Thresholds (Lines 113-128)**
Instead of using hard-coded damage thresholds (which fail because every scene has different noise levels), it calculates the MAD of the absolute displacements.
* `STABLE`: $|d| < 1 \times \text{MAD}$
* `CAUTION`: $|d| < 2 \times \text{MAD}$
* `ALERT`: $|d| < 3 \times \text{MAD}$
* `CRITICAL`: $|d| \geq 3 \times \text{MAD}$
* It floors the MAD at `2.0` mm, so an extremely quiet scene doesn't trigger false alarms on tiny $0.1$ mm vibrations.

**3. Struct Serialization (Lines 133-191)**
It loops through the points, assigns string severities, maps row/col coordinates to WGS84 coordinates using `lat_step` and `lon_step`, sorts the array by absolute displacement, truncates the list to the top 2,000 points (`options.max_points`), and returns the `InfraHealthReport`.

---

## Step 7: Gateway Handoff (`main.rs`)

**Lines 223-227:**
```rust
let report_path = format!("{}_insar.json", base);
std::fs::write(&report_path, serde_json::to_string_pretty(&report)?)?;

println!("{{\"event\":\"insar_report\",\"path\":\"{}\",\"summary\":{}}}",
    report_path, serde_json::to_string(&report.summary)?);
```
`main.rs` serializes the Rust struct into JSON using `serde`. It then prints a formatted JSON string to `stdout`.

Because the API Gateway (`sar-gateway`) spawned this process and is actively tailing its standard output, the gateway captures this string, parses it, and forwards it to the React Dashboard over an SSE (Server-Sent Events) stream. The Dashboard then fetches the `.json` and `.tif` files, rendering them on the map. The Rust engine terminates, automatically dropping all memory arrays.
