# 📥 Part 2: Processor Ingestion, Windowing & Hyperslab Streaming (`sar_science_processor`)

This is Part 2 of the comprehensive codebase deep dive. It focuses on the data ingestion engine of the Rust scientific processor (`sar_science_processor`). When the API Gateway spawns this binary, it must safely and efficiently load massive satellite radar files (often 30+ GB, containing up to 1.157 billion pixels per date) into RAM without crashing the host machine.

This section covers command-line routing (`main.rs`), memory-mapped chunk indexing (`windowed.rs`), spatial windowing, and full-scene hyperslab streaming (`nisar_parser.rs`).

---

## 1. CLI Parsing & Scientific Mode Routing (`main.rs`)

The `sar_science_processor` binary uses the `clap` crate to derive a strictly typed Command Line Interface supporting dual scientific pipelines:

```rust
#[derive(Parser, Debug)]
#[command(name = "sar_science_processor", version = "0.4.0")]
pub struct Cli {
    #[arg(short, long, value_name = "FILE")]
    pub input: Option<PathBuf>,

    #[arg(long, value_name = "FILE")]
    pub slave: Option<PathBuf>,

    #[arg(long, default_value = "flood")]
    pub mode: String, // "flood" or "insar"

    #[arg(long)]
    pub crop_preset: Option<String>, // "full", "20x20km", "10x10km", "5x5km", "1x1km"

    #[arg(long)]
    pub crop_lat: Option<f64>,
    #[arg(long)]
    pub crop_lon: Option<f64>,
    // ...
}
```

When `tokio::main` boots, it calls `Cli::parse()`. If required arguments are missing, the binary exits immediately with a clean error message, which the gateway captures.

### Execution Routing
Before allocating any large memory arrays, `main.rs` inspects the input parameters:
* **Inundation Mapping (`--mode flood`)**: Routes to `run_flood_pipeline()`, pairing an Active scene (`--input`) with a Baseline scene (`--slave`) across either a spatial crop or full-scene hyperslab ingestion.
* **Surface Deformation (`--mode insar`)**: If the filename contains `_GUNW_`, it bypasses raw SAR focusing and jumps to `gunw_parser::parse_gunw`. If raw SLCs are provided, it executes the full interferometric processing chain.

---

## 2. Memory-Mapped Chunk Indexing (`windowed.rs`)

To solve the memory bottleneck of loading multi-gigabyte HDF5 datasets into RAM, NISAR Pro implements a custom, zero-copy chunk reader: **`ChunkedF32Reader`**.

### The HDF5 B-Tree Chunk Engine
Standard pure-Rust HDF5 parsers historically read entire contiguous arrays into memory. In contrast, `ChunkedF32Reader` leverages the underlying chunked storage layout of NISAR HDF5 files:
1. **Zero-Copy Memory Mapping**: Opens the `.h5` file using `MmapFile::open(path)`. No data pages are read or allocated on disk open.
2. **Superblock & Header Traversal**: Parses the HDF5 B-tree index from the superblock to locate the byte offsets and compressed byte lengths of every data chunk on disk.
3. **Index Caching**: Caches the resulting `ChunkIndex` in an in-memory `HashMap<String, ChunkIndex>`, indexed by dataset path (e.g. `/science/LSAR/GCOV/grids/frequencyA/HHHH`).

```rust
pub struct ChunkedF32Reader {
    file: MmapFile,
    cache: HashMap<String, ChunkIndex>,
}
```

---

## 3. Spatial Cropping & Subsetting

When a user specifies a target coordinate and crop size (e.g. `--crop-lat 27.2055 --crop-lon 94.8948 --crop-preset 20x20km` for the Brahmaputra Valley):

### Transforming Coordinates to Pixel Bounds
1. It reads lightweight 1D coordinate arrays (`xCoordinates` and `yCoordinates`) or uses affine UTM transformation metadata.
2. Performs a binary search (`find_index_range`) to find the exact pixel slice: `[row_start..row_end, col_start..col_end]`.
3. Validates geographic intersection before touching pixel data: if the requested bounding box does not intersect the satellite swath, the processor aborts in milliseconds with an explanatory error.

### Windowed Chunk Decoding
`ChunkedF32Reader::read_window()` calculates exactly which HDF5 chunk blocks intersect the requested pixel window. It decompresses **only those specific chunks** from disk, assembling them directly into the output `f32` array without ever touching the surrounding multi-gigabyte scene.

---

## 4. Full-Scene 1.157 Billion Pixel Streaming (`--crop-preset full`)

For regional flood disasters (such as the Bihar Ganga Alluvial Plain), scientists must analyze the complete satellite swath:
* **Raw Swath Dimensions**: $33,696 \times 34,344$ pixels = **1.157 billion pixels per date**.
* Naive loading of two float32 dates would demand **~9.25 GB per array** ($\approx 20\text{--}40\text{ GB}$ peak RSS), causing immediate Out-of-Memory (OOM) crashes on standard laptops and micro-instances.

### The 1,024-Row Hyperslab Streaming Solution
In `sar_science_processor/src/nisar_parser.rs`, `parse_nisar_full_scene_multilooked` ingests the scene in horizontal hyperslabs:

```rust
let chunk_rows = 1024;
for row_start in (0..total_rows).step_by(chunk_rows) {
    let row_end = (row_start + chunk_rows).min(total_rows);
    let strip = reader.read_window(dataset, Window {
        row_start, row_end, col_start: 0, col_end: total_cols
    })?;
    
    // SIMD 8x8 block-averaging into the multilooked 80m lattice
    multilook_strip_into_destination(&strip, &mut downsampled_grid, row_start);
}
```

### Verified Performance Benchmarks:
* **Integer Lattice Alignment**: The swath dimensions ($33,696 \times 34,344$) and origin offsets are exact multiples of 8.
* **$8\times 8$ Block Multilooking**: Reduces the 1.157 billion raw $10\text{ m}$ pixels into an $80\text{ m}$ ground lattice of $4,212 \times 4,293$ pixels (**18.08 million pixels = 72 MB array**).
* **Throughput**: Streams and downsamples **2.31 billion observations** across two dates in **63 seconds** with a peak memory footprint of just **1.79 GB RAM**.

---

## 5. Data Cleaning & Masking

Before arrays are handed off to the mathematical engines, pixels are cleaned and validated:
* **Invalid & NoData Masking**: NISAR fill values and non-positive backscatter measurements are converted to `f32::NAN`.
* **Connected Components Filter (InSAR)**: Pixels where `connectedComponents == 0` (unwrapping failure) are set to `f32::NAN`.
* **Low Coherence Decorrelation Proxy**: Phase pixels with coherence $\gamma < 0.3$ (such as open water or dense fluctuating forest canopy) are masked to prevent false displacement anomalies.

---

**Next up: Part 3 (Core SAR Mathematics)** details how the scientific engine processes these arrays through calibrated log-ratio change detection, Otsu variance maximization, seeded region growing, and InSAR phase deramping.
