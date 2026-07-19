# 📥 Part 2: Processor Ingestion & Subsetting (`sar_processor`)

This is Part 2 of the comprehensive codebase deep dive. It focuses on the entry point of the Rust mathematics engine (`sar_processor`). When the API Gateway spawns this binary, it must safely and efficiently load massive satellite radar files (often 30+ GB) into RAM without crashing the host machine.

This section covers command-line routing (`main.rs`) and HDF5 dataset ingestion (`gunw_parser.rs` and `nisar_parser.rs`).

---

## 1. CLI Parsing & Routing (`main.rs`)

The `sar_processor` binary uses the `clap` crate to derive a strictly typed Command Line Interface.

```rust
#[derive(Parser, Debug)]
#[command(name = "sar_processor", version = "0.4.0")]
struct Cli {
    #[arg(short, long, value_name = "FILE")]
    input: Option<PathBuf>,
    
    #[arg(long)]
    crop_lat: Option<f64>,
    // ...
}
```

When `tokio::main` boots, it calls `Cli::parse()`. If required arguments are missing, the binary exits immediately with a clean error message, which the gateway captures.

### Execution Routing
Before allocating any large memory arrays, `main.rs` inspects the filename string to determine the processing path:
* **GUNW Fast-Path**: If the filename contains `_GUNW_`, it bypasses the 12-step InSAR focusing pipeline entirely and jumps to `gunw_parser::parse_gunw`. (GUNW files are pre-computed Level-2 NASA interferograms).
* **Raw HDF5 Path**: If it's `_RSLC_`, `_GSLC_`, or `_GCOV_`, it routes to `nisar_parser::parse_nisar_auto`.

---

## 2. HDF5 File Inspection (`rustyhdf5`)

The engine uses the pure-Rust `rustyhdf5` library. This is a critical architectural decision: by avoiding C-bindings to `libhdf5-dev`, the Rust binary compiles statically and requires no system-level dependencies to run inside Kubernetes.

### Validating the Bounding Box Before Loading
In `nisar_parser.rs`, the engine performs a pre-load validation check: `validate_crop_intersection()`.
Instead of loading the multi-gigabyte pixel matrix, it only queries the lightweight 1D coordinate arrays (e.g., `xCoordinates` and `yCoordinates`).

```rust
let intersects = crop_south <= bbox.north
    && crop_north >= bbox.south
    && crop_west <= bbox.east
    && crop_east >= bbox.west;

if !intersects {
    bail!("Asset is outside scene coverage");
}
```
If the user requests coordinates for a dam in India, but uploads an image of California, the parser gracefully aborts in milliseconds.

---

## 3. Spatial Cropping (Matrix Indexing)

If the user specifies `--crop-lat 18.7` and `--crop-lon 82.6` with a 10 km radius, the engine must extract a tiny subset of the image.

### Transforming Degrees to Indices
In `gunw_parser.rs`, the engine uses `find_index_range()`:
1. It calculates degree bounds using the Haversine projection approximation (`lat_radius = crop.radius_km / 111.0`).
2. It binary-searches the 1D latitude and longitude arrays to find the closest pixel row/col indices.
3. It returns a bounding tuple: `(row_start, row_end, col_start, col_end)`.

### Memory Reclamation Strategy
Because `rustyhdf5` does not natively support HDF5 "hyperslabs" (partial reads from disk), the engine implements a strict memory management pattern inside `read_2d_f32_cropped`:
1. Load the *entire* 30 GB 1D vector into RAM.
2. Reshape it into an `ndarray::Array2`.
3. Slice the array: `let cropped = full_arr.slice(s![row_start..row_end, col_start..col_end]).to_owned();`
4. The function returns, and Rust's RAII (Resource Acquisition Is Initialization) immediately `drop()`s the massive `full_arr`, reclaiming all memory in seconds. The program proceeds holding only the ~1 MB cropped array.

---

## 4. Data Cleaning & Masking

Raw interferometric phase arrays are noisy. Before returning the arrays to `main.rs` for mathematical processing, `gunw_parser.rs` cleans the pixels in a single `.iter_mut()` loop.

### Connected Components Filter
SNAPHU (the algorithm JPL uses for phase unwrapping) assigns a "Connected Component ID" to every pixel. An ID of `0` means the algorithm failed to unwrap the pixel reliably. 
The parser reads the `connectedComponents` dataset and sets any corresponding phase pixel to `f32::NAN`.

### Ionospheric Phase Screen
L-band radar is heavily distorted by the Earth's ionosphere. JPL provides an `ionospherePhaseScreen` dataset.
The parser reads this screen and directly subtracts it from the phase:
```rust
*phase -= iono_val;
```

### Low Coherence Water Proxy
Open water (reservoirs, oceans) totally decorrelates radar signals. Without an external water mask, these pixels look like random noise.
The parser reads the `coherenceMagnitude` dataset. If the coherence is less than `0.3`, the phase pixel is set to `f32::NAN`. This ensures random noise isn't mistakenly classified as structural deformation later in the pipeline.

---

**Next up: Part 3 (Core SAR Mathematics)** will detail what `main.rs` does with these cleaned, cropped matrices (Deramping, Goldstein filtering, and Phase-to-Displacement conversion).
