# Part 1 - `main.rs`: the conductor

File: `sar_science_processor/src/main.rs` (1003 lines)

`main.rs` does four things:

1. Describes the command-line options.
2. Reads what the user typed.
3. Picks one of three modes: `gcov`, `insar`, or `flood`.
4. Calls the parser, the science engine, and the writers in the right order.

For flood monitoring, the important mode is `flood`, but `main.rs` also contains the other two modes, so we will walk past them too.

---

## 1. Imports (lines 1-8)

| Line | Code | Plain English |
| :---: | :--- | :--- |
| 1 | `use anyhow::Result;` | Use a friendly error type that can carry a message. `main` returns `Result<()>`, so `?` works everywhere. |
| 2 | `use clap::Parser;` | Bring in the library that turns a `struct` into command-line flags. |
| 3 | `use log::{info, warn};` | Two logging macros. `info!` is a normal message; `warn!` is a "something is odd but we can continue" message. |
| 4 | `use ndarray::Array2;` | A 2-D array type, like a spreadsheet of numbers. |
| 5 | `use sar_science_processor::crash_journal;` | The flight recorder that survives a crash. |
| 6 | `use ...::io::{save_geotiff_f32, save_sar_geotiff, save_sar_image};` | The output writers used by the `gcov` and `insar` modes. The flood mode calls its writers with the full `io::` path later. |
| 7 | `use ...::nisar_parser;` | The file reader / cropper. |
| 8 | `use std::path::{Path, PathBuf};` | Types for file-system paths. `Path` borrows, `PathBuf` owns. |

---

## 2. The `Cli` struct (lines 10-107)

### 2.1 The doc comment and `clap` attributes (lines 10-26)

| Line(s) | Code | Plain English |
| :---: | :--- | :--- |
| 10-20 | `/// SAR Science Processor ...` | Three slashes make a documentation comment. `clap` also uses it as the long help text. |
| 21 | `#[derive(Parser, Debug)]` | The `Parser` derive generates all the flag-parsing code. `Debug` lets us print the struct while debugging. |
| 22-26 | `#[command(name = ..., version = ..., about = ...)]` | The name shown in `--help`, the version, and the one-line description. |
| 27 | `struct Cli {` | One struct holding every possible command-line option. |

`Option<T>` means "the user may or may not supply this". A plain `String` or `usize` always has a value because of `default_value`.

### 2.2 Every field (lines 28-106)

| Line(s) | Field | Plain English |
| :---: | :--- | :--- |
| 28-30 | `input: Option<PathBuf>` | The NISAR `.h5` file to process. `-i` or `--input`. |
| 32-34 | `slave: Option<PathBuf>` | The **baseline** (before) file for change detection. In `flood` mode it is optional; without it the pipeline can only find permanent water, not new flood. |
| 36-38 | `output: String` | Base name for output files. Default `sar_science_out`; extensions are added automatically. |
| 40-42 | `polarization: String` | Which radar channel: `HH`, `VV`, `HV`, `VH`. Default `HH`. |
| 44-46 | `mode: String` | `gcov`, `insar`, or `flood`. Default `gcov`. |
| 48-51 | `crop_lat: Option<f64>` | Latitude of the centre of the AOI. Flood and InSAR require it. |
| 53-56 | `crop_lon: Option<f64>` | Longitude of the centre of the AOI. |
| 57-59 | `crop_preset: String` | Named window size, e.g. `10x10km`. Default `5x5km`. |
| 61-64 | `multilook_factor: usize` | Spatial averaging factor for InSAR. Default `4` means 4x4 pixels become one. |
| 66-68 | `coherence_threshold: f32` | Minimum coherence for persistent-scatterer points. Default `0.85`. |
| 70-72 | `skip_topo_removal: bool` | A flag with no value. If present, skip topographic phase removal in InSAR. |
| 74-76 | `baseline_perp: Option<f64>` | Perpendicular baseline in metres, needed for topo removal. |
| 78-80 | `water_mask: Option<PathBuf>` | Optional external SWBD `.wbd` water mask. |
| 82-85 | `radar_band: String` | `l`, `c`, or `x`. Sets sensible default thresholds. Default `l` (NISAR). |
| 87-90 | `gunw: Option<PathBuf>` | Optional GUNW file whose coherence can boost confidence. |
| 92-94 | `min_change_db: f32` | The least-negative change allowed as a flood candidate. Default `-3.0`. `allow_hyphen_values = true` is required because `-3.0` looks like a flag to a parser. |
| 96-98 | `seed_threshold_db: f32` | How dark a pixel must be to start a flood region. Default `-5.0`. |
| 100-102 | `growth_threshold_db: f32` | How dark a neighbouring pixel must be to join a region. Default `-2.5`. It is a weaker (less negative) test than the seed. |
| 104-106 | `min_area_pixels: usize` | Regions smaller than this many pixels are erased. Default `8`. |

---

## 3. `parse_crop_preset` (lines 109-122)

| Line(s) | Code | Plain English |
| :---: | :--- | :--- |
| 109 | `fn parse_crop_preset(preset: &str) -> (f64, f64) {` | Input a preset name, output **half-widths** in kilometres: `(lat_half, lon_half)`. |
| 110-111 | `match preset { "1x1km" => (0.5, 0.5),` | A 1 km x 1 km box is +/-0.5 km from the centre. |
| 112-116 | other arms | `5x5km -> 2.5`, `1x2km -> (0.5, 1.0)`, `10x10km -> 5.0`, `20x20km -> 10.0`. |
| 117-120 | `_ => { warn!(...); (2.5, 2.5) }` | Any unknown text logs a warning and falls back to 5x5 km. |
| 121-122 | `}` | Return the tuple. |

Why half-widths? Because the crop is centred on the user's coordinate: `centre - half` to `centre + half`.

---

## 4. `main` startup (lines 124-166)

| Line(s) | Code | Plain English |
| :---: | :--- | :--- |
| 124 | `fn main() -> Result<()> {` | Program entry point. It may return an error, which Rust prints before exiting. |
| 125 | `env_logger::init();` | Turn on logging; the `RUST_LOG` environment variable controls how chatty it is. |
| 127-132 | `std::panic::set_hook(...)` | Install a custom panic handler. If Rust hits an unrecoverable bug, first write to the crash journal, then print `PANIC` to stderr. |
| 134 | `let cli = Cli::parse();` | Read `std::env::args()` and fill the `Cli` struct. This also handles `--help` and `--version`. |
| 137-144 | `let journal_dir = ...` | Choose where the crash diary lives: the output file's parent folder, or the current directory if there is no parent. `Path::new(&cli.output).parent()` returns `Option<&Path>`. |
| 145 | `crash_journal::init_journal(&journal_dir);` | Create/open the journal. |
| 147-150 | banner `info!` calls | Print the pretty startup box. The `╔` characters are just text. |
| 152-156 | `crash_journal::phase("STARTUP", ...)` | Record the mode and input filename in the journal. `map(|p| p.file_name().unwrap_or_default())` safely asks for the filename. |
| 158 | `let input = cli.input.as_ref().expect(...)` | Borrow the input path. If the user forgot `--input`, `expect` panics with a clear message. (A production CLI might return a nicer error instead.) |
| 160-164 | `let ext = input.extension()...` | Get the lowercase extension. Chain: extension -> `to_str` -> `unwrap_or("")` -> `to_lowercase`. |
| 166 | `match cli.mode.as_str() {` | String matching chooses the pipeline. |

`as_ref()` is important: `cli.input` is `Option<PathBuf>`. `as_ref()` turns it into `Option<&PathBuf>` so we can borrow it without moving it out of `cli`.

---

## 5. Mode `gcov` (lines 170-286)

This mode makes a quick visual preview of one GCOV image. It is not the flood detector, but it shares the parser and output writers.

| Line(s) | Code | Plain English |
| :---: | :--- | :--- |
| 170 | `"gcov" => {` | Enter the GCOV branch. |
| 175-177 | `if ext != "h5" ... { bail! }` | Refuse anything that is not an HDF5 file. `bail!` returns an error immediately. |
| 179-188 | `let crop = if let (Some(lat), Some(lon)) = ...` | If both crop coordinates were given, build a `CropRegion`. The radius uses the larger half-dimension so the circular crop covers the whole rectangle. |
| 190-200 | `let product = ...` | If cropping, validate the AOI against the scene, then `parse_nisar_cropped`; otherwise `parse_nisar_auto`. |
| 202-207 | `info!("Product: ...")` | Log the product type and array size. `slc.nrows()` / `ncols()` are rows / columns. |
| 209-222 | georef event | If the product has a bounding box, print one JSON line: `{"event":"georef","bbox":{...}}`. The gateway forwards this to the dashboard. |
| 224-229 | output name | If the user's output ends in `.tif`, swap to `.png`; if it has no `.png`, append one. |
| 231-232 | `save_sar_image(product.slc.view(), ...)` | Render the complex array to a grayscale PNG. `.view()` borrows the array without copying. |
| 234-240 | `output_tif`, `bbox_arr` | Build the `.tif` name and choose the bounding box (or the whole world as a fallback). |
| 242-257 | intensity loop | Allocate an `Array2<f32>` of zeroes. `axis_iter_mut(Axis(0))` walks rows, `into_par_iter()` uses Rayon to process rows on several CPU cores, and each pixel becomes `re^2 + im^2` if both parts are finite. |
| 259-260 | `save_sar_geotiff(...)` | Write a georeferenced TIFF of the intensity. |
| 262-278 | GeoJSON | Build a rectangle from the bounding box and write a `Feature` GeoJSON file. |
| 280-285 | events / banner | Print the output path event and the completion box. |

---

## 6. Mode `insar` (lines 292-570)

This is the deformation pipeline: master + slave -> interferogram -> coherence -> unwrap -> millimetres of displacement. It is documented here because the flood mode reuses several of its ideas (`multilook`, `drop` boundaries, bounding boxes).

| Line(s) | Phase | Plain English |
| :---: | :--- | :--- |
| 292-300 | start | Banner; require an HDF5 file. |
| 302-325 | Phase 0 | Require `--crop-lat` / `--crop-lon`. Convert the preset to half-widths and build a `CropRegion`. |
| 327-340 | Phase 1 | Validate and load the **master** (active) SLC crop. Keep its bbox and move its `slc` into `focused`. Log its size in MB. |
| 342-355 | georef | Emit the bounding-box event. |
| 357-369 | Phase 2 | Load the **slave** crop. If no `--slave`, use the input itself (self-interferometry). |
| 371-389 | Phase 3 | If master and slave are literally the same file and shape, skip coregistration. Otherwise align the slave, then `drop(slave_data)` to free the raw slave. |
| 391-416 | Phase 4 | `multilook` both images by `ml_factor`. Then `drop(focused)` and `drop(aligned_slave)` to free the huge full-resolution arrays. Log the new working-set size. |
| 418-425 | Phase 5 | Interferogram = `master * conj(slave)`. Coherence is estimated in a 5x5 window. Drop the multilooked slave. |
| 427-441 | Phase 6 | If `--water-mask` was supplied, read the SWBD file and force coherence low inside water. On failure, warn and continue. |
| 443-450 | Phases 7-8 | Goldstein phase filter, then extract the wrapped phase angle. |
| 452-455 | Phase 9 | Quality-guided phase unwrapping using coherence as the guide. |
| 457-482 | Phase 10 | Optionally remove topographic phase. If `--baseline-perp` is absent, skip. A zero DEM is used as a placeholder. |
| 484-490 | Phase 11 | Remove a 2-D linear orbital/atmospheric ramp (`deramp_phase`). |
| 492-515 | Phase 12 | Find persistent scatterers and score infrastructure health. `InfraHealthOptions` carries the bbox, wavelength, coherence threshold, and max points. |
| 517-529 | Phase 13a | Convert phase to displacement: `phi * wavelength * 1000 / (4*pi)` gives millimetres. `mapv` keeps `NaN` for invalid pixels. |
| 531-539 | outputs | Write displacement and coherence GeoTIFFs. |
| 541-549 | preview | Write a blue-to-red colormap PNG with range -25..+25 mm. |
| 551-554 | report | Write the infrastructure report as pretty JSON. |
| 556-569 | events | Emit `insar_report` and `insar_outputs` JSON events, then the completion banner. |

The important habit to notice: **`drop()` at phase boundaries**. Rust normally frees memory when a variable goes out of scope, but these arrays are hundreds of megabytes; dropping them early keeps peak memory low.

---

## 7. Mode `flood` (lines 572-992) - the main event

This is the part the flood product uses. Read it as a recipe with numbered steps.

### 7.1 Setup and crop (lines 572-600)

| Line(s) | Code | Plain English |
| :---: | :--- | :--- |
| 572 | `"flood" => {` | Enter flood mode. |
| 573 | `println!("{{\"event\":\"progress\",...\"SUBMITTED\"...}}");` | Tell the gateway/dashboard that the job has started. In a Rust format string, `{{` prints a literal `{`. |
| 574-576 | banner | Log the flood pipeline banner. |
| 578-584 | crop coordinates | Both `--crop-lat` and `--crop-lon` are mandatory. The error message includes an example. |
| 586-594 | preset | Get half-widths and log the crop window. |
| 596-600 | `crop_region` | Build the `CropRegion` used by every parser call. |

### 7.2 Step 1: load the active (after) product (lines 602-627)

| Line(s) | Code | Plain English |
| :---: | :--- | :--- |
| 602 | progress event | "[1/5] Loading active product metadata..." |
| 604 | `info!` | Log the active filename. |
| 605 | `crash_journal::phase(...)` | Write "FLOOD_STEP_1" to the crash diary. |
| 606 | `validate_crop_intersection(...)` | Cheap check: does the AOI overlap the satellite scene? It reads only the coordinate arrays. |
| 607-608 | `let mut active_product = parse_nisar_cropped(...)` | Open the HDF5, find the AOI rows/columns, and read only that window. `mut` because the resolution-alignment step may replace it later. |
| 609 | `checkpoint_after_free(...)` | Journal that the temporary read buffer has been freed. |
| 610 | `let mut bbox = active_product.bbox.clone();` | Keep the active bounding box. `clone()` makes an owned copy. |
| 611 | `let mut active_slc = active_product.slc;` | **Move** the array out of the product. The product can no longer be used as a whole, but its other fields can still be read. |
| 613-626 | georef event | Send the bbox to the dashboard so the map knows where to draw the result. |

### 7.3 Step 2: load the baseline (before) product (lines 629-641)

| Line(s) | Code | Plain English |
| :---: | :--- | :--- |
| 629 | progress event | "[2/5] Loading baseline reference product..." |
| 630-640 | `if let Some(ref slave_path) = cli.slave` | If a baseline path was supplied, validate and parse it, journaling each step. Otherwise `baseline_product = None`. |
| 641 | `let baseline_slc = baseline_product.as_ref().map(\|p\| &p.slc);` | Borrow the baseline array if it exists. `Option<&Array2<...>>` is exactly what `run_flood_detection_pipeline` expects. |

### 7.4 Pixel spacing and resolution alignment (lines 643-761)

This block makes sure the before and after images describe the **same physical ground area with the same pixel size**. If they do not, comparing pixel by pixel would be nonsense.

| Line(s) | Code | Plain English |
| :---: | :--- | :--- |
| 643-649 | `active_dx`, `active_dy` | Require the active GCOV `xCoordinateSpacing` / `yCoordinateSpacing` metadata. Without it we cannot convert pixels to acres, so the job fails loudly. |
| 651 | `let mut resolution_factor: usize = 1;` | Start assuming the grids already match. |
| 652-654 | `if let Some(ref bp) = baseline_product` | Only do alignment work if there is a baseline. |
| 656-661 | baseline spacing | Require baseline spacing metadata too. |
| 663-675 | shape mismatch | If shapes differ, accept only an integer multiple: the finer grid must have exactly `N` times more rows and columns than the coarser one. If so, `resolution_factor = N`. Otherwise explain why the comparison is impossible and stop. |
| 677-685 | match metadata | Pull the fine crop start row/column and both crop origins. All must exist; otherwise the `_ => bail!` at 736-739 fires. |
| 686 | `let zone = ...` | Compute the UTM zone from the centre longitude. UTM is a metric map projection that lets us measure metres. |
| 687-696 | project to metres | If the coordinate origins look geographic (lat in -90..90, lon in -180..180), convert both to UTM easting/northing. Otherwise they are already projected metres. |
| 697-698 | `phase_alignment_shift` | Compute how many fine-grid pixels the active window must shift so its pixels nest exactly under the baseline pixels. |
| 699-728 | shift found | Add the shift to the fine crop start. Reject a negative start. Build an `IndexWindow` of the right size, re-crop the active product with `parse_nisar_cropped_window`, and refresh `bbox` and `active_slc`. |
| 729-734 | shift not found | The two pixel lattices cannot line up; stop rather than silently compare the wrong places. |
| 741-745 | `multilook` | Average the active image by `resolution_factor` so it has the same pixel count as the baseline. |
| 748-760 | spacing check | Compute the active spacing after averaging and compare it to the baseline spacing. If they differ by more than 1 mm, stop. |

Example: active is 10 m per pixel, baseline is 20 m per pixel. `resolution_factor = 2`, so we average 2x2 active pixels into one. The active grid is now 20 m and has the baseline's shape.

### 7.5 Step 3: optional coherence (lines 763-786)

| Line(s) | Code | Plain English |
| :---: | :--- | :--- |
| 764 | progress event | "[3/5] Loading InSAR coherence helper..." |
| 765-786 | `if let Some(ref gunw_path) = cli.gunw` | If a GUNW file was given, parse its coherence cropped to the AOI. On success `Some(coh)`; on failure log a warning and continue with `None`. Coherence is a bonus, not a requirement. |

### 7.6 Step 4: optional external water mask (lines 788-807)

| Line(s) | Code | Plain English |
| :---: | :--- | :--- |
| 789 | progress event | "[4/5] Loading SWBD water body mask..." |
| 790-807 | `if let Some(ref wbd_path) = cli.water_mask` | Read the `.wbd` mask. If it works, keep `Some(mask)`; if not, warn and continue. The flood engine treats non-`255` values as permanent water. |

### 7.7 Step 5: the science engine (lines 809-847)

| Line(s) | Code | Plain English |
| :---: | :--- | :--- |
| 810 | progress event | "[5/5] Running 7-stage change detection..." |
| 811 | journal phase | Record that detection is starting. |
| 813-814 | `let band = cli.radar_band.parse::<RadarBand>()...` | Parse `l`/`c`/`x`; if the text is invalid, fall back to L-band. |
| 815 | `FloodDetectionOptions::for_band(band)` | Start from the thresholds tuned for that radar band. |
| 817-829 | overrides | If the user typed a value different from the built-in default, replace the option. (Passing the default explicitly therefore has no effect, which is harmless.) |
| 831-838 | `run_flood_detection_pipeline(...)` | Run all seven stages. It returns `(class_map, delta_db, report)`; `_delta_db` is intentionally unused here. |
| 839-847 | coverage check | Compute valid pixels / total pixels. If fewer than 30% are valid, the AOI is mostly outside the satellite footprint or nodata, so stop with a helpful message instead of reporting a fake tiny flood. |

### 7.8 Outputs (lines 849-987)

| Line(s) | Code | Plain English |
| :---: | :--- | :--- |
| 850 | progress event | Moving to output generation. |
| 851-852 | `base`, `bbox_opt` | Strip a supplied `.tif` / `.png` from the output name; build `[west, south, east, north]` if known. |
| 855-860 | `_flood_class.tif` | Write the `u8` class map as a GeoTIFF. |
| 862-864 | `_flood.png` | Write the permanent-water RGBA overlay. New flood is delivered as vectors instead, so it is transparent here. |
| 866-878 | previews | Render the actual active and baseline GCOV images to PNG for the dashboard's before/after view. |
| 880-888 | `_flood.geo.json` | If a bbox exists, convert connected new-flood regions to GeoJSON polygons. |
| 890-903 | report names | Build the report path and extract the input filenames for the report. |
| 905-916 | areas | Convert pixels to physical area. `pixel_area_m2 = dx * dy`; `acres = m2 / 4046.856`. Multiply each pixel count by that. |
| 918-975 | `full_report` | A `serde_json::json!` object containing product metadata, method/thresholds, crop, bbox, replay paths, areas, region count, confidence reasons, and warnings. |
| 977-978 | write report | Write pretty JSON to `_flood.json`. |
| 980-987 | events | Emit `flood_report`, `output`, and `progress COMPLETE` lines for the gateway. |
| 989-991 | banner | Log completion. |

### 7.9 Unknown mode (lines 994-1002)

| Line(s) | Code | Plain English |
| :---: | :--- | :--- |
| 994-999 | `other => bail!(...)` | Any other `--mode` is rejected with the list of valid modes. |
| 1000 | `}` | Close the `match`. |
| 1002 | `Ok(())` | Everything succeeded. |

---

## 8. Mini summary

The flood branch is literally this:

```
read crop arguments
  -> parse active GCOV (only the AOI)
  -> parse baseline GCOV (only the AOI)
  -> if pixel grids differ, align and average
  -> optionally read coherence and water mask
  -> run 7-stage detector
  -> reject if <30% of the crop is valid
  -> write TIFF + PNG + GeoJSON + JSON
  -> print events for the dashboard
```

Next: [02 - nisar_parser.rs](./02-nisar-parser.md) explains how the "parse active GCOV (only the AOI)" step actually works.
