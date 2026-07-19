# 📤 Part 4: Data Export & Health Analysis (`sar_processor`)

This is the final part of the comprehensive codebase deep dive. After the mathematical operations (Part 3) are complete, the engine must serialize the arrays back to the disk so the React dashboard and mapping engines (TiTiler / Leaflet) can read them. Finally, it must notify the API Gateway that the job is complete.

---

## 1. Persistent Scatterer Analysis (`infra_health.rs`)

If the user is running the infrastructure monitoring pipeline, `main.rs` passes the final `defo_phase` array and the `coherence` array to `infra_health::analyze_infrastructure_unwrapped()`.

### Point Collection
A typical SAR image has millions of pixels, but most of them are dirt, grass, or water, which decorrelate over time. The engine filters for **Persistent Scatterers (PS)**—pixels that represent hard, reflective objects like steel bridges or concrete dams.
It iterates over the matrix and extracts any pixel where `coherence >= 0.85`.

### Adaptive Severity Thresholding
Hard-coding a damage threshold (e.g., "Alert if displacement > 5mm") causes false alarms in noisy images and misses subtle damage in quiet images.
Instead, the engine dynamically calculates the **Median Absolute Deviation (MAD)** of the absolute displacements for the specific scene:
* **STABLE**: $|d| < 1 \times \text{MAD}$
* **CAUTION**: $|d| < 2 \times \text{MAD}$
* **ALERT**: $|d| < 3 \times \text{MAD}$
* **CRITICAL**: $|d| \geq 3 \times \text{MAD}$

To prevent a perfectly stable scene from triggering false alerts over tiny $0.1$ mm vibrations, the MAD is floored at a minimum of `2.0` mm.

### Report Generation
The extracted points are mapped back to WGS84 coordinates using `lat_step` and `lon_step` linear interpolation. The array is sorted by absolute displacement in descending order, truncated to the top 2,000 points (`options.max_points`) to prevent crashing the browser DOM, and returned as an `InfraHealthReport`.

---

## 2. Low-Level GeoTIFF Construction (`io.rs`)

The system relies on cloud-optimized mapping tools like TiTiler to render satellite data. These tools require precise GeoTIFFs. Because adding the C-based GDAL library would bloat the Kubernetes containers, `io.rs` writes the raw TIFF bytes manually using `std::io::BufWriter`.

### Memory Layout
The engine creates a 256x256 tiled grid layout (`tile_bytes = 256 * 256 * 4`). It loops through the `f32` displacement array and copies the numbers into a massive `Vec<u8>` byte array in Little Endian format (`val.to_le_bytes()`).

### Image File Directory (IFD) Tag Injection
To make the TIFF "Geo"-aware, it injects custom IFD tags directly into the binary header:
* **Tag 34264 (ModelTransformationTag)**: It writes a 16-element float array representing a 4x4 affine transform matrix. This maps the pixel coordinates `(cols, rows)` to real-world coordinates `(west, north)`.
* **Tag 34735 (GeoKeyDirectoryTag)**: It writes the array `[1, 1, 0, 3, 1024, 0, 1, 2, ... 4326]`, which is the TIFF standard way of telling GIS software that the coordinate system is EPSG:4326.
* **Tag 42113 (GDAL_NODATA)**: It injects the ASCII string `b"nan\0"`. When TiTiler reads the file, it sees this tag and renders any `NaN` (masked) pixels as 100% transparent PNG pixels on the dashboard map.

---

## 3. Gateway Handoff & Event Emission (`main.rs`)

With the mathematical arrays saved to `.tif` and the health report struct generated, `main.rs` must communicate the results back to the `sar-gateway` (which spawned it in Part 1).

### Struct Serialization
```rust
let report_path = format!("{}_insar.json", base);
std::fs::write(&report_path, serde_json::to_string_pretty(&report)?)?;
```
The Rust struct is serialized to a JSON string using `serde_json` and written to the `./results/` directory.

### Event Emission
```rust
println!("{{\"event\":\"insar_report\",\"path\":\"{}\",\"summary\":{}}}",
    report_path, serde_json::to_string(&report.summary)?);
```
The processor prints a specifically formatted JSON string to `stdout`. 

### The Full Circle
If you recall from **Part 1**, the `sar-gateway` has a background asynchronous loop reading the processor's `stdout` line-by-line. The gateway catches this `println!`, forwards it through the Server-Sent Events (SSE) stream, and the React Dashboard receives it. 
React parses the `path`, makes a standard `GET` request to download the JSON and TIFF files, and instantly renders the colored dots and radar overlay on the map.

The `sar_processor` binary then reaches the end of `main()`, terminates, and Rust's memory allocator automatically destroys all variables, freeing the system RAM for the next job.
