# 📤 Part 4: Data Export, Flood Artifacts & Health Analysis (`sar_science_processor`)

This is Part 4 of the comprehensive codebase deep dive. After the mathematical operations (Part 3) are complete, the engine must serialize the arrays back to disk so the React dashboard and GIS mapping engines can read them. Finally, it notifies the API Gateway via structured events.

This section covers persistent scatterer health analysis (`infra_health.rs`), low-level GeoTIFF generation (`io.rs`), multi-temporal flood artifact creation, and gateway event handoff.

---

## 1. Persistent Scatterer Analysis (`infra_health.rs`)

If the user runs the infrastructure monitoring pipeline, `main.rs` passes the final `defo_phase` array and the `coherence` array to `infra_health::analyze_infrastructure_unwrapped()`.

### Point Collection
A typical SAR image has millions of pixels, but most of them represent dirt, grass, or water, which decorrelate over time. The engine filters for **Persistent Scatterers (PS)**—pixels that represent hard, stable reflective objects like steel bridges or concrete dams.
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

The system relies on cloud-optimized mapping tools like TiTiler to render satellite data. These tools require precise GeoTIFFs. Because adding the C-based GDAL library would bloat the binary and introduce dynamic runtime dependencies, `io.rs` writes the raw TIFF bytes manually using `std::io::BufWriter`.

### Memory Layout
The engine creates a 256x256 tiled grid layout (`tile_bytes = 256 * 256 * 4`). It loops through the `f32` displacement array and copies the numbers into a massive `Vec<u8>` byte array in Little Endian format (`val.to_le_bytes()`).

### Image File Directory (IFD) Tag Injection
To make the TIFF "Geo"-aware, it injects custom IFD tags directly into the binary header:
* **Tag 34264 (ModelTransformationTag)**: Writes a 16-element float array representing a 4x4 affine transform matrix. This maps pixel coordinates `(cols, rows)` to real-world coordinates `(west, north)`.
* **Tag 34735 (GeoKeyDirectoryTag)**: Writes the array `[1, 1, 0, 3, 1024, 0, 1, 2, ... 4326]`, which is the TIFF standard way of declaring EPSG:4326 WGS84 or UTM projection.
* **Tag 42113 (GDAL_NODATA)**: Injects the ASCII string `b"nan\0"`. When TiTiler or QGIS reads the file, it renders any `NaN` (masked) pixels as 100% transparent.

---

## 3. Multi-Temporal Flood Artifact Generation (`io.rs`)

When running the InGARSS 2026 Flood Inundation & Damage Mapping pipeline (`--mode flood`), `io.rs` produces six synchronized artifacts in the `./results/` directory:

### 1. Colormapped RGBA Image Overlay (`<id>_flood.png`)
* **Color Assignment**:
  - Class 0 (Dry Land): `[0, 0, 0, 0]` (Transparent)
  - Class 1 (Stable Water Body): `[0, 229, 255, 180]` (Cyan `#00e5ff`)
  - Class 2 (Water Gain - High Conf): `[239, 68, 68, 220]` (Crimson `#ef4444`)
  - Class 3 (Water Gain - Med Conf): `[249, 115, 22, 200]` (Coral `#f97316`)
  - Class 4 (Water Gain - Low Conf): `[251, 146, 60, 180]` (Orange `#fb923c`)
  - Class 5 (Water Loss / Receded): `[245, 158, 11, 200]` (Warm Amber `#f59e0b`)
* Formatted as a lightweight PNG draped directly atop Leaflet maps via `<ImageOverlay>`.

### 2. Normalized Grayscale SAR Overlays (`<id>_flood_baseline.png` & `<id>_flood_active.png`)
* Normalizes radar backscatter decibel values from $[-25.0, 0.0]\text{ dB}$ into 8-bit grayscale $[0, 255]$.
* Sets NoData and non-swath areas to transparent alpha.
* Used by the web dashboard's `FloodEventReplay` timeline to animate pre-flood vs peak-flood radar terrain.

### 3. Vector GeoJSON Inundation Clusters (`<id>_flood.geo.json`)
* Polygons representing contiguous flood extents derived from the 2-threshold region-grown mask.
* Each feature includes properties: `cluster_id`, `area_km2`, `area_acres`, `confidence_class`, and `centroid: [lat, lon]`.

### 4. Single-Band Integer GeoTIFF (`<id>_flood_class.tif`)
* Single 8-bit unsigned integer band (`u8`) storing discrete classification values `0..=5`.
* Includes full EPSG georeferencing and `NoData = 255` tags for spatial cross-validation in QGIS / ArcGIS.

### 5. Reproducible Scientific Report (`<id>_flood.json`)
* Complete JSON breakdown containing:
  - Dual-unit area statistics: Metric ($\text{km}^2$) and Imperial (Acres, $1\text{ ac} = 0.004046856\text{ km}^2$).
  - Detection methodology (Otsu threshold, seed threshold, growth threshold).
  - Exact `georef_bbox` (`south`, `north`, `west`, `east`).
  - `replay` block referencing baseline, active, and result overlay paths.

---

## 4. Gateway Handoff & Event Emission (`main.rs`)

With the mathematical arrays saved to disk and reports generated, `sar_science_processor` communicates the results back to `sar-gateway`:

### Struct Serialization
```rust
let report_path = format!("{}_flood.json", base);
std::fs::write(&report_path, serde_json::to_string_pretty(&report)?)?;
```

### Event Emission
```rust
println!("{{\"event\":\"flood_report\",\"path\":\"{}\",\"summary\":{}}}",
    report_path, serde_json::to_string(&report.areas)?);
```

### The Full Circle
1. The `sar-gateway` async reader intercepts the `flood_report` or `insar_report` event from `stdout`.
2. Forwards the event down the Server-Sent Events (SSE) stream (`/jobs/:id/logs`).
3. The React Dashboard receives the event, closes the progress bar, pans the Leaflet map to the `georef_bbox`, and renders the visual overlays and tabular flood statistics.
4. The compute process terminates cleanly, dropping all memory allocations.
