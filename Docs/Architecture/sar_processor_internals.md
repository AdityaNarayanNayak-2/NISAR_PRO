# SAR Processor Internals

> Source: `sar_processor/src/` — Pure Rust SAR compute engine, zero Python dependencies.

## Overview
The `sar_processor` is a stateless CLI binary. It ingests a raw SAR file (NISAR HDF5 or Sentinel-1 SAFE), runs the appropriate signal processing pipeline, and outputs PNG images + GeoJSON sidecar files. It is spawned as a child process by the `sar-gateway`.

## Module Map (`lib.rs`)
```
lib.rs                  → Public module re-exports
├── io.rs               → Image encoding, GeoTIFF writer, XYZ tile generation, CLAHE + Lee filters
├── nisar_parser.rs     → NASA NISAR HDF5 reader (RSLC/GSLC/GCOV/GUNW)
├── safe_parser.rs      → ESA Sentinel-1 SAFE/GeoTIFF reader
├── rda.rs              → Range-Doppler Algorithm (Range + Azimuth compression)
├── rcmc.rs             → Range Cell Migration Correction (Sinc interpolation)
├── radar_utils.rs      → LFM chirp generation + FFTProcessor wrapper
├── insar.rs            → Interferogram + Coherence estimation
├── infra_health.rs     → Persistent Scatterer analysis + displacement classification
├── ship_detection.rs   → CA-CFAR with integral image acceleration
├── polsar.rs           → Pauli decomposition (HH/VV/HV → RGB)
├── algorithm.rs        → AMTAD multi-scale anomaly detection
├── smart_downloader.rs → HTTP Range-Request downloader for partial reads
├── isce3_ffi.rs        → Optional ISCE3 C++ FFI bridge (experimental)
└── errors.rs           → Custom error types
```

## Execution Flow (`main.rs`)

```
CLI Args (clap)
    │
    ├─ --synthetic → generate_synthetic_point_target(1024×1024)
    │
    └─ --input <FILE>
         │
         ├─ .h5/.hdf5 → nisar_parser::parse_nisar_auto()
         │    │
         │    └─ Detects product type (RSLC/GSLC/GCOV/GUNW)
         │       If already focused → skip RDA (unless --process)
         │       Extracts: Complex SLC array, GeoBoundingBox, radar params
         │
         └─ Returns (SARProcessor, Array2<Complex32>, skip_rda, bbox)

    ┌─ skip_rda=true → render directly (GCOV/GUNW pre-processed)
    └─ skip_rda=false → processor.process_rda(&raw_data)
         │
         ├─ Range Compression (FFT → matched filter × → IFFT)
         ├─ RCMC (Sinc interpolation, 8-point Hamming kernel)
         └─ Azimuth Compression (FFT → azimuth ref × → IFFT)

    Output Stage:
    ├─ --tiles-dir → generate_xyz_tiles() + geo.json sidecar
    ├─ --output *.tif → save_sar_geotiff() (Pure Rust, EPSG:4326)
    └─ default → save_sar_image() as PNG + .geo.json sidecar
         └─ Emits {"event":"georef","bbox":{...}} to stdout (Gateway captures via SSE)

    Optional Pipelines (run after main output):
    ├─ --insar-slave <FILE> → InSAR + infra_health analysis → _insar.json
    └─ --ship-detect → CA-CFAR with 8x downsampling → _ships.json
```

## Key File Details

### `nisar_parser.rs` (28 KB — largest file)
The most complex module. Traverses NASA's deeply nested HDF5 group hierarchy to extract:
- **RSLC:** `/science/LSAR/RSLC/swaths/frequency{A,B}/{HH,VV,HV,VH}` → Complex SLC arrays from compound `{r: f32, i: f32}` datatypes.
- **GCOV:** `/science/LSAR/GCOV/grids/frequency{A,B}/` → Real-valued covariance matrices.
- **GUNW:** `/science/LSAR/GUNW/grids/` → Pre-computed interferograms.
- **Geolocation:** Extracts bounding boxes from `/science/LSAR/*/metadata/processingInformation/parameters/` or coordinate arrays.

### `rda.rs` — The Core Algorithm
Implements the full Range-Doppler Algorithm using `rustfft`:
1. **Range Compression:** Row-wise FFT, multiply by conjugate of chirp reference, IFFT.
2. **RCMC:** Corrects curved migration paths using sinc interpolation.
3. **Azimuth Compression:** Column-wise FFT, multiply by azimuth matched filter, IFFT.

### `io.rs` — Output Pipeline
- **GeoTIFF Writer:** A pure-Rust implementation (`save_sar_geotiff`) that writes 256×256 tiled GeoTIFFs. It manually injects the `ModelTransformationTag` (34264) for explicit EPSG:4326 georeferencing, ensuring correct orientation (north-up) in GIS tools without external dependencies like GDAL.
- **Lee Sigma Filter:** Speckle noise reduction (adaptive, edge-preserving).
- **CLAHE:** Contrast Limited Adaptive Histogram Equalization for visual enhancement.
- **Spatial Multilook:** Averages N×N blocks to reduce speckle and control output resolution.
- **XYZ Tiling:** Chops the output into 256×256 web tiles (Google Maps compatible).

### `infra_health.rs` — Infrastructure Monitoring
Takes the InSAR interferogram + coherence matrix and:
1. Filters for Persistent Scatterers (coherence > 0.85).
2. Converts phase → Line-of-Sight displacement: `d = (φ × λ) / (4π)`.
3. Classifies severity: STABLE (<2mm), CAUTION (2-5mm), ALERT (5-10mm), CRITICAL (>10mm).
4. Exports top 2,000 scatterers as JSON with lat/lon coordinates.

### `ship_detection.rs` — Maritime CFAR
1. Builds a Summed Area Table (Integral Image) in O(N) time.
2. Sweeps a sliding window: guard_radius=4, bg_radius=10.
3. Threshold: `α = N × (Pfa^(-1/N) - 1)` where Pfa = 1e-6.
4. Outputs ship detections with geographic coordinates as JSON.

## Dependencies (Cargo.toml)
| Crate | Purpose |
|-------|---------|
| `ndarray` | N-dimensional arrays for matrix math |
| `num-complex` | Complex32 arithmetic |
| `rustfft` | Fast Fourier Transforms |
| `hdf5` | NASA HDF5 file reading (requires `libhdf5-dev`) |
| `image` | PNG encoding |
| `rayon` | Parallel iterators for multi-core processing |
| `clap` | CLI argument parsing |
| `serde` / `serde_json` | JSON serialization for GeoJSON output |
| `chrono` | Timestamps for reports |
