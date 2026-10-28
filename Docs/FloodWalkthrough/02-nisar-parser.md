# Part 2 - `nisar_parser.rs`: finding the right page in a giant book

File: `sar_science_processor/src/nisar_parser.rs` (1531 lines)

This file answers three questions:

1. **Which kind of NISAR product is this?** (RSLC, GSLC, GCOV, or GUNW)
2. **Where in the big array is the user's AOI?** (turn latitude/longitude into row/column numbers)
3. **How do I read just that part?** (GCOV uses `windowed.rs`; other products currently read the full array and then crop)

---

## 1. What a NISAR HDF5 file looks like (lines 1-22)

The module comment shows the RSLC layout:

```text
/science/LSAR/RSLC/swaths/frequencyA/HH
/science/LSAR/RSLC/metadata/processingInformation/parameters/centerFrequency
...
```

For flood detection the important paths are GCOV:

```text
/science/LSAR/GCOV/grids/frequencyA/HHHH          <- power values (2-D float32)
/science/LSAR/GCOV/grids/frequencyA/xCoordinates   <- longitude or UTM easting per column
/science/LSAR/GCOV/grids/frequencyA/yCoordinates   <- latitude  or UTM northing per row
/science/LSAR/GCOV/grids/frequencyA/xCoordinateSpacing
/science/LSAR/GCOV/grids/frequencyA/yCoordinateSpacing
/science/LSAR/GCOV/grids/frequencyA/projection
/science/LSAR/GCOV/metadata/processingInformation/parameters/...
```

`HHHH` means the co-polarised HH channel. For `HV` the diagonal term is `HVHV`, and so on. A GCOV value is already **power** (real number), not a complex SLC sample.

---

## 2. Imports (lines 24-31)

| Line | Code | Plain English |
| :---: | :--- | :--- |
| 24 | `use anyhow::{bail, Context, Result};` | `bail!` returns an error now; `.context(...)` adds a human message to an error; `Result` is the return type. |
| 25 | `use log::info;` | Logging. |
| 26 | `use ndarray::Array2;` | 2-D arrays. |
| 27 | `use num_complex::Complex32;` | Complex numbers with `f32` parts. |
| 28 | `use rustyhdf5::File;` | The high-level HDF5 reader. |
| 29 | `use std::path::Path;` | Borrowed file path. |
| 31 | `use crate::crash_journal;` | Memory/crash journal. |

---

## 3. Public data types (lines 37-143)

### 3.1 `GeoBoundingBox` (lines 37-74)

| Line(s) | Code | Plain English |
| :---: | :--- | :--- |
| 37-48 | `pub struct GeoBoundingBox { south, north, west, east }` | The rectangle's edges in degrees. `pub` means other modules can use it. `serde::Serialize` lets it be written to JSON. |
| 50-52 | `pub fn from_bounds(lats, lons) -> Option<Self>` | Build a box from lists of corner coordinates. `Option` because the lists may be empty or invalid. |
| 53-55 | `if lats.is_empty() ... return None` | No points means no box. |
| 56-59 | four `fold(...)` calls | Find the minimum/maximum latitude and longitude. `fold(f64::MAX, f64::min)` starts at the largest possible number and keeps the smaller one. |
| 62-64 | range check | Reject latitudes outside +/-90 and longitudes outside +/-360. |
| 66-68 | degenerate check | Reject a zero-width or zero-height box. |
| 69-71 | all-zero check | Reject the common "metadata is all zeros" placeholder. |
| 72 | `Some(Self { ... })` | Return the valid box. |

### 3.2 `NisarRadarParams` (lines 76-91)

| Line(s) | Field | Plain English |
| :---: | :--- | :--- |
| 78-91 | `center_frequency`, `range_bandwidth`, `pulse_duration`, `chirp_rate`, `prf`, `sample_rate` | Radar settings read from metadata. They are not needed by the flood detector, but InSAR and focusing use them. |

### 3.3 `NisarProduct` (lines 93-121)

| Line(s) | Field | Plain English |
| :---: | :--- | :--- |
| 98 | `slc: Array2<Complex32>` | The radar image. GCOV power is stored in the real part, imaginary `0.0`. Name is historical. |
| 100 | `params: NisarRadarParams` | The radar settings. |
| 102 | `polarization: String` | The channel actually read (`HH`, etc.). |
| 104 | `product_type: NisarProductType` | Which file family. |
| 106 | `bbox: Option<GeoBoundingBox>` | Where the image is on Earth. |
| 108-110 | `pixel_spacing_x_m`, `pixel_spacing_y_m` | Ground size of one pixel. Required for acreage. |
| 112 | `crs: String` | Coordinate reference system, e.g. `EPSG:4326`. |
| 114-120 | `crop_start_row`, `crop_start_col`, `crop_origin_lat`, `crop_origin_lon` | Where the crop began and the ground coordinate of its top-left pixel. Used for cross-resolution alignment. |

### 3.4 `NisarProductType` and `CropRegion` (lines 123-143)

| Line(s) | Code | Plain English |
| :---: | :--- | :--- |
| 124-130 | `enum NisarProductType { RSLC, GSLC, GCOV, GUNW }` | `RSLC` = radar coordinates, `GSLC` = geocoded complex, `GCOV` = geocoded power/covariance, `GUNW` = unwrapped interferogram. |
| 135-143 | `pub struct CropRegion { center_lat, center_lon, radius_km }` | A circular AOI around the user's coordinate. |

---

## 4. `validate_crop_intersection` (lines 151-208)

This is the cheap pre-flight check. It does **not** load the radar image.

| Line(s) | Code | Plain English |
| :---: | :--- | :--- |
| 151-153 | `pub fn validate_crop_intersection(path, crop) -> Result<()>` | Open the file or return a contextual error. |
| 155-165 | detect product type | Look for `_GSLC_`, `_GCOV_`, `_GUNW_` in the filename; otherwise assume `RSLC`. |
| 167-169 | `extract_bbox_from_grids(...).or_else(...)` | Try the coordinate grids first, then the identification metadata. `or_else` runs the second closure only if the first returned `None`. |
| 171-177 | no bbox | If the file has no bbox metadata, log and skip the check (return success). |
| 179-182 | degrees | Convert radius in km to degrees: 1 degree latitude is about 111 km; longitude shrinks by `cos(latitude)`. `max(0.01)` avoids dividing by zero near the poles. |
| 184-187 | crop bounds | South/north/west/east edges of the AOI. |
| 190-193 | AABB test | Two rectangles intersect if each one's edge reaches past the other's opposite edge. |
| 195-203 | fail | If they do not overlap, explain the asset location, the scene bounds, and what to do. |
| 205-207 | success | Log the passing check. |

---

## 5. `parse_nisar_auto` (lines 217-244)

| Line(s) | Code | Plain English |
| :---: | :--- | :--- |
| 217-221 | filename | Get the file's name as text. |
| 223-234 | `if filename.contains("_RSLC_") ...` | Inspect the name, not the contents, to guess the product type. Unknown names default to RSLC with a log message. |
| 236 | `info!` | Log the decision. |
| 238-243 | `match product_type` | Call the matching parser: `parse_nisar_rslc`, `parse_nisar_gslc`, `parse_nisar_gcov`, or `parse_nisar_gunw`. |

Why filename detection? NISAR naming is standardized, and reading the name is instant. If the name is wrong, the user gets a clear failure from the chosen parser.

---

## 6. `IndexWindow` and the cropped entry points (lines 255-282)

| Line(s) | Code | Plain English |
| :---: | :--- | :--- |
| 255-261 | `pub struct IndexWindow { row_start, row_end, col_start, col_end }` | Explicit pixel rectangle. Ranges are half-open: `row_end` is **not** included. |
| 264-270 | `parse_nisar_cropped` | Wrapper that calls `parse_nisar_cropped_window(..., None)`. |
| 277-282 | `parse_nisar_cropped_window` | The real function. `window_override` lets the flood alignment step ask for an exact window that differs from the geometric search. |

---

## 7. `parse_nisar_cropped_window` (lines 277-580) - the core reader

### 7.1 Open, detect, read metadata (lines 283-314)

| Line(s) | Code | Plain English |
| :---: | :--- | :--- |
| 283 | `let pol = polarization.to_uppercase();` | Accept `hh` or `HH`. |
| 284-285 | `File::open(path).with_context(...)` | Open the HDF5 file, adding a message if it fails. |
| 287-299 | product detection | Same filename rules as `parse_nisar_auto`. |
| 301-306 | `product_type_str` | Convert the enum into the string used inside HDF5 paths. |
| 308 | `extract_radar_params(...)` | Read radar settings (with defaults). |
| 310-314 | `x_path`, `y_path`, `read_1d_f64` | Read the 1-D longitude/easting and latitude/northing axes. `read_1d_f64` returns `Option<Vec<f64>>`. |

### 7.2 Only run the crop branch if coordinate axes exist (lines 316-322)

| Line(s) | Code | Plain English |
| :---: | :--- | :--- |
| 316 | `if let (Some(lons), Some(lats)) = (x_coords, y_coords)` | Both axes are required; otherwise jump to the `else` at 560. |
| 317-322 | `data_path` | Choose the HDF5 dataset for the product: GCOV -> `HHHH`, GSLC -> `HH`, GUNW -> `unwrappedPhase`. RSLC has no geocoded grid here, so it errors. |

### 7.3 Read the full shape, decide whether axes are degrees or metres (lines 324-334)

| Line(s) | Code | Plain English |
| :---: | :--- | :--- |
| 324-326 | `file.dataset(...)`, `dataset.shape()` | Get the 2-D dimensions without reading the data. |
| 327-329 | `shape.len() != 2` | Reject non-2-D datasets. |
| 330-331 | `full_rows`, `full_cols` | The whole scene size. |
| 333-334 | `looks_geographic` | True if every latitude is within +/-90 and every longitude within +/-360. Otherwise the axes are projected metres (UTM). |

### 7.4 Choose the pixel window (lines 336-373)

| Line(s) | Code | Plain English |
| :---: | :--- | :--- |
| 336-337 | `if let Some(w) = window_override` | An explicit window (used for phase alignment) wins immediately. |
| 338-355 | geographic crop | Convert `radius_km` to latitude/longitude bounds, then use `find_index_range` on the axes. `r_start..r_end` are rows; `c_start..c_end` are columns. |
| 356-372 | projected crop | Compute the UTM zone from the centre longitude, convert the centre to easting/northing, build a metre box, and search the projected axes. |
| 358 | `((crop.center_lon + 180.0) / 6.0).floor() as i32 + 1` | Standard UTM zone formula: 6 degrees per zone, zone 1 starts at -180. |
| 359 | `latlon_to_utm(...)` | Convert WGS84 degrees to metric easting/northing. |

### 7.5 Clamp and reject empty windows (lines 375-399)

| Line(s) | Code | Plain English |
| :---: | :--- | :--- |
| 375-379 | `.min(full_rows)` | Never ask for rows/columns past the end of the dataset. |
| 381-399 | empty? | If the start is not before the end, the AOI is outside the scene. Compute the scene bounds only to print a helpful error. |

### 7.6 GCOV: the memory-safe windowed read (lines 401-486)

| Line(s) | Code | Plain English |
| :---: | :--- | :--- |
| 401-402 | `crop_rows`, `crop_cols` | Size of the AOI. |
| 404 | `info!` | Log the full -> crop sizes. |
| 406 | `if product_type == GCOV` | GCOV has its own windowed path. |
| 407 | `timed_scope(...)` | Start a timer that writes its duration when it drops. |
| 408-413 | `Window { ... }` | Build a `windowed::Window` from the crop. |
| 414-421 | `window.validate(...)` | Reject an empty, inverted, or out-of-bounds window before reading. |
| 422-434 | allocation journal | Compute the output size in bytes, ask the journal whether this allocation is safe, and write a "before allocation" checkpoint. |
| 437 | `if env NISAR_GCOV_LEGACY_FULL_READ` | Hidden escape hatch: force the old full-file read for debugging/comparison. |
| 438-458 | legacy branch | Read the whole dataset, copy just the crop rows, then `drop(full)`. This is the memory-hungry path. |
| 459-467 | normal branch | Open a `ChunkedF32Reader` and call `read_window`. Only intersecting chunks are decoded. |
| 468-479 | `ensure!` | Check that the returned length is exactly `crop_rows * crop_cols`. |
| 480-484 | convert | `raw` is a flat `Vec<f32>` row by row. Turn index `i` into `[[i / crop_cols, i % crop_cols]]` and store it as `Complex32::new(value, 0.0)` because the rest of the code expects a complex array. |
| 485-486 | journal + return | Note the temporary buffer is gone; return the cropped array. |

### 7.7 Other products: full read then crop (lines 487-515)

| Line(s) | Code | Plain English |
| :---: | :--- | :--- |
| 488-498 | size estimate / journal | Estimate `rows * cols * 8` bytes (complex = 8 bytes per sample) and guard the allocation. |
| 499-501 | `dataset.read_f32()` | Read the entire dataset as floats. This is where GSLC/GUNW can use lots of RAM. |
| 502-511 | nested loops | For each crop row/column, read the interleaved `(re, im)` pair from the flat buffer and store a `Complex32`. `src_offset = (global_row * full_cols + col_start) * 2`. |
| 512-514 | `drop(raw_f32)` | Free the full buffer immediately. |

Important difference: the GCOV path (the flood path) never reads the full array. The still-full-read path is used by GSLC/GUNW/RSLC InSAR products.

### 7.8 Compute the crop bounding box (lines 517-542)

| Line(s) | Code | Plain English |
| :---: | :--- | :--- |
| 518-529 | geographic | Take the first and last latitude/longitude in the crop. `min`/`max` handle axes that run north-to-south. |
| 530-541 | projected | Convert the southwest and northeast corners back to latitude/longitude with `utm_to_latlon`. |

### 7.9 Return the product (lines 544-559)

| Line(s) | Code | Plain English |
| :---: | :--- | :--- |
| 544 | `read_pixel_spacing_x_y(...)` | Read `xCoordinateSpacing` and `yCoordinateSpacing`. |
| 546-559 | `Ok(NisarProduct { ... })` | Package the array, metadata, bbox, CRS, and crop origin. |

### 7.10 Fallback when there are no coordinate grids (lines 560-579)

| Line(s) | Code | Plain English |
| :---: | :--- | :--- |
| 560-561 | `else` | The file is probably an RSLC without geocoded axes. |
| 562-563 | read RSLC swath | Load the full complex radar image. |
| 564 | bbox from identification | Try scene-level metadata. |
| 565-578 | return | Pixel spacing and crop origin are unknown (`None`), CRS `UNKNOWN`. |

---

## 8. `find_index_range` (lines 584-633)

This turns "latitude between 18.7 and 18.9" into "rows 1200 to 1500".

| Line(s) | Code | Plain English |
| :---: | :--- | :--- |
| 584 | signature | Input a 1-D axis and a min/max value; output half-open `(start, end)`. |
| 585-588 | empty axis | Return `(0, 0)`. |
| 590 | `let ascending = coords[0] < coords[n - 1];` | Does the axis increase with index, or decrease? Latitude axes often decrease (north-to-south). |
| 592-593 | defaults | `start = n` means "no match yet"; `end = 0`. |
| 595-609 | ascending | First index with `v >= min`; last index with `v <= max`, then `+1` for half-open. |
| 610-626 | descending | Mirror image: first index with `v <= max`; last index with `v >= min`, then `+1`. |
| 628-630 | no overlap | If start is not before end, return `(0, 0)`. |
| 632 | return | The row/column range. |

This is a linear scan. For a 16,000-element axis that is still tiny compared with reading the image.

---

## 9. `phase_alignment_shift` (lines 645-661)

Used when the active grid is finer than the baseline grid. Example: active is 10 m, baseline is 20 m, so each baseline pixel covers a 2x2 block of active pixels. We want the active block's centre to line up with the baseline pixel's centre.

| Line(s) | Code | Plain English |
| :---: | :--- | :--- |
| 645-650 | doc/signature | Inputs: fine top-left ground coordinate, reference top-left coordinate, fine spacing, and the integer ratio `looks`. |
| 651-653 | guard | If `looks` is zero or spacing is effectively zero, alignment is impossible. |
| 654-655 | shift formula | Convert the ground offset into fine pixels, then subtract half a block because the block's centre is not its top-left corner. |
| 656-659 | rounding | Require the shift to be within 0.001 pixel of an integer. If not, the grids cannot nest; return `None` instead of silently misregistering. |
| 660 | `Some(rounded as isize)` | A whole-number pixel shift (may be negative). |

---

## 10. The four product parsers (lines 663-831)

### 10.1 `parse_nisar_rslc` (lines 663-698)

| Line(s) | Code | Plain English |
| :---: | :--- | :--- |
| 664-669 | open/params | Open the file and read radar parameters. |
| 671-672 | `read_complex_dataset` | Load the complex SLC. |
| 674-681 | bbox | Try identification metadata; log if missing. |
| 683-698 | return | Build a `NisarProduct` with no geocoding information. |

### 10.2 `parse_nisar_gslc` (lines 700-735)

| Line(s) | Code | Plain English |
| :---: | :--- | :--- |
| 701-709 | open/read | Same pattern; dataset path is `/science/LSAR/GSLC/grids/frequencyA/HH`. |
| 711-713 | bbox | Coordinate grids first, then identification. |
| 719-734 | return | Include pixel spacing, CRS, and no crop origin (this is a full-scene read). |

### 10.3 `parse_nisar_gcov` (lines 737-786)

| Line(s) | Code | Plain English |
| :---: | :--- | :--- |
| 743-746 | `cov_term = format!("{}{}", pol, pol)` | `HH` becomes `HHHH`, the diagonal covariance term. |
| 749-753 | open/path | Build the HDF5 dataset path. |
| 755-756 | `read_real_dataset` | Read a real `f32` array. |
| 760-761 | wrap as complex | `data.mapv(|v| Complex32::new(v, 0.0))` so the rest of the pipeline can use one type. |
| 763-785 | bbox/spacing/CRS | Same metadata extraction as the other geocoded products. |

### 10.4 `parse_nisar_gunw` (lines 788-831)

| Line(s) | Code | Plain English |
| :---: | :--- | :--- |
| 789-798 | open/path | Unwrapped phase lives at `.../GUNW/grids/frequencyA/unwrappedPhase`. |
| 800-803 | read | Read the phase as real floats. |
| 805-806 | `Complex32::from_polar(1.0, phi)` | Turn phase `phi` into a unit-magnitude complex number. This preserves phase for downstream code. |
| 808-830 | metadata/return | bbox, spacing, CRS. |

---

## 11. `parse_gunw_coherence_cropped` (lines 833-947)

Coherence is a number from 0 (random/noisy) to 1 (stable). Flood water changes between dates, so low coherence supports a flood interpretation.

| Line(s) | Code | Plain English |
| :---: | :--- | :--- |
| 834-840 | open | Open the GUNW file and uppercase the polarisation. |
| 842-846 | candidate paths | NISAR versions store coherence in slightly different places. Try all three. |
| 848-854 | find first existing | `file.dataset(p).is_ok()` tests existence. |
| 856 | `ok_or_else(...)` | If none exist, return a clear error. |
| 858-863 | axes | Read the coordinate grids. |
| 865-873 | shape | Get the full 2-D dimensions. |
| 875-876 | geographic? | Same degrees-vs-metres test. |
| 878-908 | window | Same crop math as the main parser: either degree bounds or UTM bounds. |
| 910-913 | clamp | Keep the window inside the dataset. |
| 915-919 | valid window? | If yes, compute crop size. |
| 919-929 | memory guard | Journal the full read, then call `dataset.read_f32()`. |
| 932-939 | copy crop | Copy only the requested rows/columns into `cropped`. |
| 940-942 | drop/free/return | Free the full buffer and return the crop. |
| 946 | fallback | If there were no axes, read the whole coherence dataset without cropping. |

---

## 12. Metadata helpers (lines 953-1322)

### 12.1 `extract_radar_params` (lines 955-1010)

| Line(s) | Code | Plain English |
| :---: | :--- | :--- |
| 957-960 | `bases` | Try the product-specific metadata folder, then the RSLC one. |
| 962-967 | option variables | One `Option<f64>` per parameter, starting as `None`. |
| 969-988 | loop over bases | For each base, try to fill any still-missing value with `read_scalar_f64`. |
| 990-991 | defaults | Bandwidth 80 MHz and pulse duration 40 microseconds if missing. |
| 993-1000 | build struct | Use real values where available; otherwise sensible L-band defaults. Chirp rate defaults to `bandwidth / duration`. |
| 1002-1007 | log | Print frequency in GHz, bandwidth in MHz, PRF in Hz. |

### 12.2 `read_scalar_f64` (lines 1014-1017)

| Line(s) | Code | Plain English |
| :---: | :--- | :--- |
| 1015 | `file.dataset(path).ok()?` | If the dataset is missing, return `None` immediately. |
| 1016 | `read_f64().ok()?.into_iter().next()` | Read the array (even a 1-element array) and take the first value. |

### 12.3 `extract_bbox_from_grids` (lines 1024-1044)

| Line(s) | Code | Plain English |
| :---: | :--- | :--- |
| 1025-1029 | read axes | Both must exist. |
| 1031 | log | Report the grid sizes. |
| 1033-1036 | geographic test | Are the axes degrees or metres? |
| 1038-1043 | result | Build a box from the axes, or `None` if the axes look projected (this function only handles geographic). |

### 12.4 `extract_bbox_from_identification` (lines 1053-1122)

| Line(s) | Code | Plain English |
| :---: | :--- | :--- |
| 1054-1064 | explicit attributes | Try `boundingBox/...` then older `...Bound...` names. |
| 1066-1069 | all four found | Return the box. |
| 1071-1073 | WKT path | Otherwise try `boundingPolygon`, which stores a text geometry. |
| 1075-1091 | low-level parse | Resolve the dataset, parse its object header, and read the raw bytes. This is needed because the polygon is a text dataset with an unusual layout. |
| 1092-1094 | decode text | UTF-8 decode and strip trailing NUL characters. |
| 1096-1108 | split coordinates | Split on `(`, `)`, and `,`; each piece like `82.6 18.7` is longitude then latitude. Parse the two floats. |
| 1109-1112 | build box | Use `from_bounds`; return it if valid. |
| 1121 | `None` | No usable bbox metadata. |

### 12.5 `read_1d_f64` (lines 1125-1130)

| Line(s) | Code | Plain English |
| :---: | :--- | :--- |
| 1126 | open dataset | Missing -> `None`. |
| 1127 | `read_f64` | Read all values. |
| 1128-1129 | empty check | An empty axis is useless; return `None`. |

### 12.6 `read_complex_dataset` (lines 1141-1250)

NISAR stores an SLC as a compound type `{float32 re, float32 im}`. The high-level reader sometimes cannot handle compound types, so there are two attempts.

| Line(s) | Code | Plain English |
| :---: | :--- | :--- |
| 1142-1144 | open | Get the dataset or a contextual error. |
| 1146-1157 | shape | Require 2-D; store row/column counts. |
| 1158-1162 | sizes | `n_pixels = rows * cols`; log the shape. |
| 1164-1176 | high-level attempt | Try `read_f32()`. If the returned length is `2 * n_pixels`, it is interleaved `(re, im)` floats. `chunks_exact(2)` pairs them into `Complex32`, and `from_shape_vec` rebuilds the 2-D shape. |
| 1178-1192 | low-level fallback | Get the raw file bytes and superblock, resolve the path, and parse the object header. |
| 1194-1213 | messages | Extract `DataLayout` (where the bytes are), `Dataspace` (shape), and `Datatype` (element format). |
| 1215-1217 | filter pipeline | Optional compression filters (shuffle/deflate). |
| 1219-1222 | `read_raw_data_full` | Decode the bytes. |
| 1224-1234 | size check | Each complex sample is 8 bytes; reject any mismatch. |
| 1236-1244 | reinterpret | Read four bytes for `re`, four for `im`, little-endian, into `Complex32`. |
| 1246-1250 | reshape | Build the final `Array2<Complex32>`. |

### 12.7 `read_real_dataset` (lines 1252-1282)

| Line(s) | Code | Plain English |
| :---: | :--- | :--- |
| 1253-1267 | open/shape | Require 2-D and log dimensions. |
| 1269-1270 | read | Read all `f32` values. |
| 1272-1278 | size check | Must equal `rows * cols`. |
| 1280-1282 | reshape | Turn the flat vector into `Array2<f32>`. |

### 12.8 `read_pixel_spacing_x_y` (lines 1284-1293)

| Line(s) | Code | Plain English |
| :---: | :--- | :--- |
| 1286-1287 | paths | `xCoordinateSpacing` and `yCoordinateSpacing`. |
| 1289-1292 | read/return | Each is optional; return `(dx, dy)`. |

### 12.9 `extract_crs` (lines 1295-1322)

| Line(s) | Code | Plain English |
| :---: | :--- | :--- |
| 1297-1307 | projection attribute | Look for an `epsg_code` attribute on the projection dataset and return `EPSG:<code>`. |
| 1310-1319 | fallback | If the axes look like degrees, return `EPSG:4326` (WGS84). |
| 1321 | unknown | Otherwise `"UNKNOWN"`. |

---

## 13. UTM conversion (lines 1324-1431)

These are standard geodesy formulas (Snyder / USGS). You do not need to memorise them, but here is what each group does.

### 13.1 `latlon_to_utm` (lines 1325-1386)

| Line(s) | Code | Plain English |
| :---: | :--- | :--- |
| 1325-1334 | constants | WGS84 semi-major axis `a = 6378137 m`, eccentricity squared, UTM scale `k0 = 0.9996`, and the central meridian of the zone. |
| 1336-1341 | intermediate values | `n` (radius of curvature), `t` (tan^2), `c` (cos^2 term), and `A` (longitude difference times cos). |
| 1343-1355 | `m` | Meridional arc length: a series expansion that measures how far north the point is along the ellipsoid. |
| 1357-1368 | easting | `k0 * n * (...)` plus the false easting of 500,000 m so the central meridian maps to x=500 km. |
| 1370-1383 | northing | `k0 * (m + n * tan(...) * (...))`. In the southern hemisphere a false northing is normally added elsewhere; this function is used with northern latitudes in this project. |
| 1385 | return | `(easting, northing)` in metres. |

### 13.2 `utm_to_latlon` (lines 1388-1431)

| Line(s) | Code | Plain English |
| :---: | :--- | :--- |
| 1389-1401 | constants | Same ellipsoid, plus `e1` and the removal of the false easting. `y` is adjusted by 10,000,000 m in the southern hemisphere. |
| 1403-1410 | `mu` -> `phi1` | Convert northing to an initial latitude using a trigonometric series. |
| 1412-1416 | intermediate values | `n1`, `t1`, `c1`, `r1`, and `d` (scaled easting). |
| 1418-1422 | latitude | Apply the inverse series to get the final latitude in radians. |
| 1424-1430 | longitude | Add the longitude offset series to the central meridian, dividing by `cos(phi1)`. |
| 1430 | return | Degrees. |

The tests at lines 1453-1471 check that converting to UTM and back lands within `1e-6` degrees for several real coordinates.

---

## 14. Tests (lines 1437-1531)

The tests are executable documentation. The important ones:

| Test | What it proves |
| :--- | :--- |
| `test_l_band_wavelength` | L-band at 1.2575 GHz gives about 23.8 cm. |
| `test_utm_roundtrip` | UTM conversion and its inverse agree to 0.000001 degrees. |
| `test_complex_interleaving` | `(re, im)` pairs become the correct complex pixels. |
| `test_default_params_are_reasonable` | Default sample rate is above the bandwidth (Nyquist). |
| `test_phase_alignment_shift_nests_10m_onto_20m` | The real 10 m -> 20 m case gives shift `+1`. |
| `test_phase_alignment_shift_rejects_non_nesting_grids` | A half-pixel offset is rejected instead of guessed. |
| `test_phase_alignment_shift_handles_negative_northing_spacing` | North-to-south northing axes work. |

Next: [03 - windowed.rs](./03-windowed.md) explains the chunk reader that makes real GCOV files fit in a small laptop's memory.
