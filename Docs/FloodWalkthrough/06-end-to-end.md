# Part 6 - One complete run, end to end

This part connects all five files. Read this after Parts 1-5, or use it as a map while reading them.

---

## 1. A real command

From the repository root:

```bash
cd sar_science_processor
cargo build --release

./target/release/sar_science_processor \
  --input  active_GCOV.h5 \
  --slave  baseline_GCOV.h5 \
  --mode flood \
  --crop-lat 18.7883 \
  --crop-lon 82.6003 \
  --crop-preset 10x10km \
  --output results/upper_kolab
```

The dashboard and gateway build the same command for you.

---

## 2. The journey of one pixel

Imagine one pixel over a rice field that floods between the two dates.

| Step | Where | What happens to the pixel |
| :---: | :--- | :--- |
| 1 | `main.rs` | The user's latitude/longitude becomes a `CropRegion`. |
| 2 | `nisar_parser.rs` | The parser reads the coordinate axes and finds the rows/columns that contain the field. |
| 3 | `windowed.rs` | The reader finds the HDF5 chunks under those rows/columns, decodes them, and copies the pixel values. |
| 4 | `nisar_parser.rs` | The active and baseline crops become `Array2<Complex32>`. |
| 5 | `main.rs` | Shapes/spacing are checked, and the images are aligned if needed. |
| 6 | `flood_detect.rs` | Active power `0.7` -> `-1.5 dB`; baseline power `10.0` -> `+10 dB`; delta = `-11.5 dB`. |
| 7 | `flood_detect.rs` | Median filter removes a noisy neighbour, but this pixel stays very negative. |
| 8 | `flood_detect.rs` | Otsu sees two clusters (land near 0 dB, flood near -10 dB) and picks a cut around -4 dB. |
| 9 | `flood_detect.rs` | Because the pixel is below the seed threshold, it starts a region. Neighbours below the growth threshold join. |
| 10 | `flood_detect.rs` | Morphology removes a 2-pixel speck but keeps the field. |
| 11 | `flood_detect.rs` | Confidence: strong change -> class 2 (high). If coherence exists and is low, also class 2. |
| 12 | `io.rs` | The class map is written as `_flood_class.tif`; the connected region becomes a GeoJSON polygon. |
| 13 | `io.rs` | The report says "new inundation high acres" and the dashboard draws the polygon. |

If the pixel was already a lake on both dates, it becomes class 1 (permanent water), not new flood.

---

## 3. What each stage costs

Rough mental model for a 10 km x 10 km AOI (the exact numbers depend on pixel spacing):

| Stage | Memory | Why |
| :--- | :--- | :--- |
| Open HDF5 | tiny | The file is memory-mapped, not copied. |
| Windowed read | about the crop size | Only overlapping chunks are decoded. |
| Active + baseline complex arrays | 8 bytes per pixel each | `Complex32` = two `f32` values. |
| dB arrays/masks | 4 bytes per pixel each, plus 1-byte masks | Temporary working arrays. |
| Class map | 1 byte per pixel | Final `u8`. |
| Output buffers | one raster/PNG at a time | The writers allocate their own buffers. |

The big win is stage 2. The old full-read path needed RAM proportional to the **whole granule**; the windowed path needs RAM proportional to the **AOI**.

The InSAR/GSLC/GUNW paths still read whole datasets in several places, so they remain heavier than flood GCOV.

---

## 4. Output files

For `--output results/upper_kolab`:

| File | Written by | Purpose |
| :--- | :--- | :--- |
| `upper_kolab_flood_class.tif` | `save_geotiff_u8` | One byte per pixel: classes 0-4. |
| `upper_kolab_flood.png` | `save_flood_map_png` | Transparent overlay showing permanent water only. |
| `upper_kolab_flood_active.png` | `save_sar_image` | Grayscale after image. |
| `upper_kolab_flood_baseline.png` | `save_sar_image` | Grayscale before image (if a baseline was supplied). |
| `upper_kolab_flood.geo.json` | `save_flood_geojson` | New-flood polygons with confidence, area, centroid. |
| `upper_kolab_flood.json` | `main.rs` | Full report: products, method, thresholds, crop, bbox, areas, warnings. |

The gateway also receives JSON lines on stdout:

```json
{"event":"progress","stage":"PROCESSING","message":"[1/5] Loading active product metadata..."}
{"event":"georef","bbox":{"south":18.7,"north":18.9,"west":82.5,"east":82.7}}
{"event":"flood_report","path":"..._flood.json","summary":{"total_flood_acres":145.45}}
{"event":"output","path":"..._flood.png"}
{"event":"progress","stage":"COMPLETE","message":"Analysis completed successfully"}
```

---

## 5. Reading the report

The important numbers in `_flood.json`:

| JSON key | Meaning |
| :--- | :--- |
| `product.pixel_spacing_x_m`, `product.pixel_spacing_y_m` | Ground size of one pixel after any alignment averaging. |
| `product.crs` | Coordinate reference system (e.g. `EPSG:4326`). |
| `method.detector` | Always `log_ratio_change_detection`. |
| `method.threshold_method` | `otsu_on_change_image`. |
| `method.threshold_db` | Effective threshold after the user cap. |
| `method.raw_otsu_db` | Otsu's own result before the cap. |
| `method.seed_threshold_db`, `growth_threshold_db` | The region-growing thresholds actually used. |
| `method.coherence_used` | Whether a GUNW coherence file contributed. |
| `areas.total_area_acres` | Area of the whole crop. |
| `areas.permanent_water_acres` | Class 1. |
| `areas.new_inundation_high_acres` | Class 2. |
| `areas.new_inundation_medium_acres` | Class 3. |
| `areas.new_inundation_low_acres` | Class 4. |
| `areas.total_flood_acres` | Sum of new inundation. |
| `flood_regions` | Number of connected regions before size filtering. |
| `confidence_reasons` | Text labels explaining the method. |
| `warnings` | Currently empty; reserved. |

---

## 6. What can go wrong, and what the code does

| Symptom | Likely cause | Where it is handled |
| :--- | :--- | :--- |
| "mode flood requires --crop-lat and --crop-lon" | Missing AOI. | `main.rs` 578-584 |
| "Asset ... is outside scene coverage" | The AOI is not inside the downloaded granule. | `nisar_parser.rs` 195-203 and 381-399 |
| "AOI coverage too low ... < 30%" | The crop is mostly nodata/ocean edge/outside the swath. | `main.rs` 839-847 |
| "Pre/post window shape mismatch" | The two products have grids that are not integer multiples. | `main.rs` 663-675 |
| "Cannot phase-align ... non-integer offset" | The finer grid does not nest onto the coarser grid. | `main.rs` 729-734 |
| "Incompatible grid spacing" | After averaging, the pixel sizes still differ. | `main.rs` 748-760 |
| "missing xCoordinateSpacing metadata" | The file cannot support reliable acreage. | `main.rs` 644-661 |
| Crash with a panic | A bug or an unexpected file layout. | `crash_journal.rs` writes a diary first. |
| Flood looks empty | Thresholds too strict, baseline missing, or permanent water excluded the area. | Inspect `method` and `areas` in the report. |
| Flood covers everything | Threshold too loose, or the two dates are misaligned. | Inspect `delta_db`, raw Otsu, and alignment logs. |

The code prefers a clear failure over a believable-looking wrong answer. That is a deliberate scientific choice.

---

## 7. Glossary

| Word | Meaning |
| :--- | :--- |
| **Active** | The image after the event (what we are testing for flood). |
| **Baseline** | The image before the event (the reference). |
| **AOI** | Area of Interest: the user's crop rectangle. |
| **Backscatter** | Radar energy returned to the satellite. Bright = rough, dark = smooth/water. |
| **Chunk** | A compressed block of an HDF5 dataset. |
| **Coherence** | How stable the radar phase is between two dates. 0 = random, 1 = stable. Water usually decorrelates. |
| **Complex32** | A pair of `f32` values: real and imaginary. |
| **CRS** | Coordinate Reference System, e.g. EPSG:4326 (latitude/longitude) or UTM (metres). |
| **dB** | Decibel: `10 * log10(power)`. |
| **Delta dB** | Active dB minus baseline dB. Negative = darker after = possible water. |
| **DEM** | Digital Elevation Model: ground height. Used for topographic phase removal. |
| **GCOV** | Geocoded polarimetric covariance product. Power values on a map grid. |
| **GeoJSON** | A JSON format for points/lines/polygons in longitude/latitude. |
| **GeoTIFF** | A TIFF image with geographic tags. |
| **GUNW** | Geocoded unwrapped interferogram. Can provide coherence. |
| **HDF5** | A hierarchical file format for huge scientific arrays. |
| **IFD** | Image File Directory inside a TIFF: the table of contents. |
| **Median filter** | Replace a pixel with the median of its neighbours. Removes speckle. |
| **Morphology** | Erode/dilate operations on binary masks. Opening removes small specks. |
| **Nodata** | A pixel with no valid measurement, stored as `NaN` after conversion. |
| **Otsu** | An automatic threshold that maximises separation between two histogram groups. |
| **Permanent water** | Water present on both dates (lake, river). Class 1. |
| **Pixel spacing** | Ground distance covered by one pixel (metres). |
| **Region growing** | Start from strong pixels (seeds) and expand into weaker neighbours. |
| **RSLC** | Range-Doppler complex SLC in radar coordinates. |
| **SAR** | Synthetic Aperture Radar. |
| **SLC** | Single Look Complex: radar amplitude + phase. |
| **Speckle** | Grainy noise caused by radar interference. |
| **SWBD** | Shuttle Water Body Database: an external water mask. |
| **UTM** | A metric map projection that divides Earth into 6-degree zones. |
| **WKT** | Well-Known Text: a text way to write geometry, e.g. `POLYGON((...))`. |

---

## 8. Small exercises

1. **Trace the threshold cap.** Open `flood_detect.rs` lines 619-631. If Otsu returns `-6.0` and the user passes `--min-change-db -3.0`, what is the effective threshold? What is the seed threshold?
   <br>Answer: effective = `min(-6.0, -3.0) = -6.0` (stricter). seed = `min(-5.0, -6.0) = -6.0`.

2. **Trace a window.** A dataset has 1024x1024 chunks. The window is rows `1500..1700`, columns `300..400`. Which chunk rows and columns are touched?
   <br>Answer: chunk rows `1..=1` (row 1500-1700 overlaps chunk row 1), chunk columns `0..=0` (300-400 is inside chunk 0).

3. **Predict the class.** Active `0.1` (`-10 dB`), baseline `10.0` (`+10 dB`), permanent-water threshold `-13 dB`. Is this permanent water? Is it a flood candidate?
   <br>Answer: not permanent water (active is not below -13 dB). Delta is `-20 dB`, so yes, a strong flood candidate. Otsu ignores values below `-25 dB`, but `-20` is included.

4. **Predict the output.** Active and baseline are both `0.01` (`-20 dB`). What class?
   <br>Answer: both below `-13 dB` -> permanent water, class 1, assuming the pixel is valid.

5. **Why not compare directly across resolutions?** If active is 10 m and baseline is 20 m, a 1-to-1 pixel comparison sees four active pixels against one baseline pixel. The code averages the active 2x2 block first. This is the `resolution_factor` logic in `main.rs`.

---

## 9. Where to look when changing something

| Goal | Start here |
| :--- | :--- |
| Add a new command-line option | `main.rs`, `struct Cli`, then pass it into the pipeline. |
| Change thresholds for a band | `flood_detect.rs`, `FloodDetectionOptions::for_band`. |
| Change how flood candidates are seeded/grown | `flood_detect.rs`, `region_grow`. |
| Change the Otsu range | `flood_detect.rs`, `OSTSU_MIN_PHYSICAL_DB` and `otsu_threshold`. |
| Change output colours | `io.rs`, `save_flood_map_png`. |
| Change polygon properties | `io.rs`, `save_flood_geojson`. |
| Read a new HDF5 layout | `nisar_parser.rs` and `windowed.rs`. |
| Change report fields | `main.rs`, the `serde_json::json!` block. |

Always run the unit tests after touching the science:

```bash
cd sar_science_processor
cargo test
```

The tests in `flood_detect.rs` and `windowed.rs` encode real failures; if one breaks, understand why before changing the test.

---

## 10. Line-number caveat

The line numbers in this walkthrough match the files as of the writing of this document. Code changes shift line numbers. If a number is slightly off, search for the nearby code text (for example `seed_threshold_db` or `resolve_path_any`); the names are stable even when the lines move.

Return to the [walkthrough index](./README.md).
