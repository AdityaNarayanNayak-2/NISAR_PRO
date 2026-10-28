# Part 4 - `flood_detect.rs`: the detective

File: `sar_science_processor/src/flood_detect.rs` (983 lines)

This is the science engine. It receives two radar images (active = after, baseline = before) and produces one class map plus a report.

The module calls itself a **7-stage** pipeline. The stage numbers in the comments are:

```
Stage 1  Validate that the two products are compatible
Stage 2  Convert power to decibels (dB)
Stage 3  3x3 median speckle filter
Stage 4  Log-ratio change image + Otsu threshold
Stage 5  Find permanent water
Stage 6  Two-threshold region growing + morphology/size cleanup
Stage 7  Score confidence for every flooded pixel
```

One small numbering quirk: `run_flood_detection_pipeline` logs "Stage 2" first because Stage 1 is a separate validation helper (`validate_gcov_pair_metadata`) that `main.rs` does not currently call for flood jobs.

---

## 1. Imports (lines 7-10)

| Line | Code | Plain English |
| :---: | :--- | :--- |
| 7 | `use log::{info, warn};` | Progress and warning messages. |
| 8 | `use ndarray::Array2;` | 2-D arrays. |
| 9 | `use num_complex::Complex32;` | Complex input pixels. |
| 10 | `use serde::{Deserialize, Serialize};` | Let options and reports be saved/loaded as JSON. |

---

## 2. `RadarBand` (lines 12-34)

| Line(s) | Code | Plain English |
| :---: | :--- | :--- |
| 12-21 | `pub enum RadarBand { LBand, CBand, XBand }` | The three common radar wavelengths. `Serialize`/`Deserialize` allow JSON; `PartialEq`/`Eq` allow `==`. |
| 23-25 | `impl FromStr for RadarBand` | Defines how `"...".parse::<RadarBand>()` works. |
| 26-32 | `match s.to_lowercase().as_str()` | `l`/`l-band`/`lband` -> L, and the same for C and X. Unknown text returns an error string. |
| 34 | `}` | End of implementation. |

Different wavelengths see water differently, so the default thresholds change per band.

---

## 3. `FloodDetectionOptions` (lines 36-99)

### 3.1 Fields (lines 37-55)

| Line(s) | Field | Plain English |
| :---: | :--- | :--- |
| 39-40 | `min_change_db` | The most positive change still allowed as a candidate. More negative = stricter. |
| 41-42 | `seed_threshold_db` | "Very dark" threshold used to start a region. |
| 43-44 | `growth_threshold_db` | "Somewhat dark" threshold used to expand a region. |
| 45-46 | `permanent_water_thresh_db` | If both dates are below this, the pixel is a permanent water body. |
| 47-48 | `min_area_pixels` | Delete connected regions smaller than this. |
| 49-50 | `enable_median_filter` | Turn the 3x3 speckle filter on/off. |
| 51-52 | `otsu_bins` | Number of histogram bins for Otsu's method. |
| 53-54 | `radar_band` | Record which band these defaults came from. |

### 3.2 `for_band` (lines 57-93)

| Line(s) | Code | Plain English |
| :---: | :--- | :--- |
| 59-70 | L-band defaults | `min_change_db: -3.0`, `seed: -5.0`, `growth: -2.5`, `permanent water: -13.0`, `min area: 8`, median on, 256 Otsu bins. NISAR is L-band. |
| 71-80 | C-band defaults | Slightly less negative thresholds (`-2.5`, `-4.5`, `-2.0`, `-12.0`). C-band penetrates less and has different water contrast. |
| 81-90 | X-band defaults | `-2.0`, `-4.0`, `-1.5`, `-10.0`, and a larger 12-pixel minimum area. |
| 91-92 | return | The filled struct. |

### 3.3 `Default` (lines 95-99)

| Line(s) | Code | Plain English |
| :---: | :--- | :--- |
| 96-98 | `Self::for_band(RadarBand::LBand)` | If no options are supplied, use L-band (NISAR). |

---

## 4. `FloodAnalysisResult` (lines 101-118)

| Line(s) | Field | Plain English |
| :---: | :--- | :--- |
| 104-105 | `otsu_threshold_db` | The threshold actually used after applying the user's cap. |
| 106-107 | `raw_otsu_threshold_db` | The uncapped Otsu result, kept for transparency/debugging. |
| 108-109 | `total_pixels`, `valid_pixels` | Crop size and how many pixels had usable data. |
| 110 | `permanent_water_pixels` | Count of class 1. |
| 111-114 | `flooded_pixels_high_conf`, `med`, `low` | Counts of classes 2, 3, 4. |
| 114 | `total_flooded_pixels` | Sum of the three new-flood classes. |
| 115 | `flood_regions_count` | Number of connected components found by `morphological_cleanup`, including components later erased for being smaller than `min_area_pixels`. It is a "candidate regions" count, not a count of only the retained regions. |
| 116 | `confidence_reasons` | Text labels explaining which methods were used. |
| 117 | `warnings` | Reserved for future warnings; currently empty. |

---

## 5. Stage 1: pair validation (lines 120-144)

| Line(s) | Code | Plain English |
| :---: | :--- | :--- |
| 121-126 | signature | Inputs: both polarisations and both product types. Output: a list of warning strings. |
| 127 | `let mut warnings = Vec::new();` | Start empty. |
| 129-134 | polarisation check | If `HH` vs `VV` (case-insensitive), push a warning. Comparing different channels is scientifically wrong, but this function only warns. |
| 136-141 | product type check | Warn if e.g. GCOV is compared with GSLC. |
| 143 | return | The warnings. |

This function is available but not called by the current flood branch. It is a safety helper for future orchestration.

---

## 6. Stage 2: power to dB (lines 146-170)

| Line(s) | Code | Plain English |
| :---: | :--- | :--- |
| 146-159 | doc + constant | `GCOV_MIN_VALID_POWER = 1e-4`, i.e. `-40 dB`. Anything below this is sensor noise / out-of-swath feathering, not a real target. |
| 161 | `pub fn gcov_to_db(slc: &Array2<Complex32>) -> Array2<f32>` | Convert every complex pixel to dB. |
| 162 | `.mapv(|c| { ... })` | Apply the closure to every element. |
| 163 | `let power = c.re;` | GCOV power is in the real part. |
| 164 | `if power.is_finite() && power >= GCOV_MIN_VALID_POWER` | Valid only if the number is real (not NaN/Inf) and at least the noise floor. |
| 165 | `10.0 * power.log10()` | The dB conversion. |
| 166-168 | `else { f32::NAN }` | Invalid values become `NaN` ("not a number"), which later marks them as nodata. |
| 169-170 | close | Return the array. |

Why `-40 dB` instead of `0`? Real GCOV files contain tiny non-zero numbers outside the valid swath (for example `1e-13`). Without the floor, those pixels would look like extremely dark water and be classified as permanent water. The floor throws them away.

---

## 7. Stage 3: median filter (lines 172-202)

| Line(s) | Code | Plain English |
| :---: | :--- | :--- |
| 173 | signature | Input data and a validity mask; output filtered data. |
| 174-175 | `rows`, `cols`, `filtered = data.clone()` | Start as a copy; border pixels stay unchanged. |
| 177-178 | loops `1..rows-1`, `1..cols-1` | Skip the outer border because a 3x3 window would go out of bounds. `saturating_sub(1)` avoids underflow on tiny arrays. |
| 179-181 | invalid centre | Leave nodata pixels alone. |
| 183 | `Vec::with_capacity(9)` | At most 9 neighbours in a 3x3 window. |
| 184-192 | neighbour loops | Visit `dr, dc` from -1 to +1. Convert back to `usize` and include only valid neighbours. |
| 194-197 | median | Sort the values, take the middle one (`len / 2`). |
| 198-199 | write | Replace the centre with the median. |
| 201 | return | The filtered array. |

Median filtering removes single-pixel "salt and pepper" speckle without blurring edges as much as averaging would.

---

## 8. Stage 4a: change image (lines 204-210)

| Line(s) | Code | Plain English |
| :---: | :--- | :--- |
| 207 | `compute_change_image(active_db, baseline_db)` | Inputs are already in dB. |
| 208 | `assert_eq!(...)` | Panic if shapes differ. The caller must align them first. |
| 209 | `active_db - baseline_db` | Element-wise subtraction. A negative result means the after-image is darker. |

Example: active `-15 dB`, baseline `-5 dB` -> delta `-10 dB`. That is a strong candidate for water.

---

## 9. Stage 4b: Otsu threshold (lines 212-304)

### 9.1 The idea

Imagine a histogram of all change values. Land clusters near `0 dB`; floods cluster around `-8 dB`. Otsu's method tries every possible cut point and picks the one that makes the two groups as different as possible (maximises **between-class variance**). You do not have to guess a threshold.

### 9.2 Physical range constant (lines 212-217)

| Line(s) | Code | Plain English |
| :---: | :--- | :--- |
| 217 | `pub const OSTSU_MIN_PHYSICAL_DB: f32 = -25.0;` | Ignore changes deeper than `-25 dB` when building the histogram. Values like `-93 dB` are sensor noise-floor dropouts, not flood physics. The name contains a historical typo (`OSTSU` instead of `OTSU`); the value is what matters. |

### 9.3 Find the histogram range (lines 227-250)

| Line(s) | Code | Plain English |
| :---: | :--- | :--- |
| 227 | signature | Input delta image, valid mask, number of bins. |
| 228-230 | min/max/count | Start with the most extreme possible values. |
| 232-246 | scan | For valid pixels only, consider `v <= 0.0` and `v >= -25.0`. Update min, max, and count. |
| 248-250 | fallback | Fewer than 16 samples, or an almost-flat range -> return `-3.0`. There is not enough information to compute a real threshold. |

Why only `v <= 0`? Floods are darkening events. Positive changes (brightening) are not flood candidates and would confuse the split.

### 9.4 Build the histogram (lines 252-266)

| Line(s) | Code | Plain English |
| :---: | :--- | :--- |
| 252 | `n_bins = n_bins.clamp(16, 1024)` | Keep the bin count sane. |
| 253 | `bin_width = (max - min) / n_bins` | Width of each bin in dB. |
| 254 | `vec![0u64; n_bins]` | One counter per bin. |
| 256-266 | fill | For each valid pixel in range, compute the bin index and increment it. `.min(n_bins - 1)` protects the last bin from rounding to `n_bins`. |

### 9.5 Compute the best split (lines 268-303)

| Line(s) | Code | Plain English |
| :---: | :--- | :--- |
| 268-272 | accumulators | `total` pixels, `sum_b`/`weight_b` for the background (left) group, `max_var` for the best score, `best_bin`. |
| 274-278 | total sum | `sum1` is the sum of `count * bin_center` over the whole histogram. |
| 280-301 | sweep | Move the cut from left to right. Add the current bin to the background group. `weight_f` is the foreground (right) count. Skip empty sides. Compute each side's mean, then `var_between = w_b * w_f * (mean_b - mean_f)^2`. Keep the cut with the largest value. |
| 303 | return | Convert the best bin back to dB: `min + (bin + 0.5) * bin_width`. |

The factor `weight_b * weight_f` makes a split valuable when both sides contain many pixels; the squared mean difference makes it valuable when the two groups are far apart.

---

## 10. Stage 5: permanent water (lines 306-340)

| Line(s) | Code | Plain English |
| :---: | :--- | :--- |
| 307-312 | signature/allocate | Build a `bool` mask the same shape as the data. |
| 316-326 | external mask | If an external `.wbd` mask exists, map each output pixel to the mask using nearest-neighbour scaling. `ext != 255` means water. SWBD uses `255` for land. |
| 327-337 | no external mask | A pixel is permanent water when **both** dates are finite and **both** are below `water_thresh_db` (default `-13 dB`). Water is dark on both dates; a flood is dark only on the after date. |
| 339 | return | The mask. |

Why `both dates`? A pixel that is dark only after the event is new flood, not permanent water. This distinction is the whole point of using two images.

---

## 11. Stage 6a: region growing (lines 342-396)

| Line(s) | Code | Plain English |
| :---: | :--- | :--- |
| 343-349 | signature/setup | Input delta, seed threshold, growth threshold, valid mask, permanent-water mask. Output a flood mask and a queue. |
| 350-352 | allocate | All `false`, plus an empty `VecDeque` (a first-in-first-out queue). |
| 354-364 | find seeds | If a pixel is valid, not permanent water, and `delta < seed_thresh_db`, mark it and push it into the queue. Strict `<` means exactly `-5.0` is not a seed when the threshold is `-5.0`. |
| 368-372 | neighbours | The eight surrounding pixels (including diagonals). |
| 374 | `while let Some((r, c)) = queue.pop_front()` | Process seeds, then their neighbours, then their neighbours, like a spreading stain. |
| 375-377 | compute neighbour | Convert to `isize` so `-1` is safe, then check bounds. |
| 379-381 | back to `usize` | Only after the bounds check. |
| 383-390 | grow test | Neighbour must be valid, not permanent water, not already grown, and `delta < growth_thresh_db`. If so, mark and enqueue. |
| 395 | return | The grown mask. |

The two thresholds matter: seeds are very dark (`-5 dB`), but a slightly less dark neighbour (`-2.5 dB`) can join. This fills the inside of a flood while resisting a jump into unrelated noise.

---

## 12. Stage 6b: morphology and size filter (lines 398-485)

### 12.1 Erosion (lines 410-427)

| Line(s) | Code | Plain English |
| :---: | :--- | :--- |
| 410 | comment | Opening = erosion then dilation. |
| 411 | `eroded` | Start all `false`. |
| 412-427 | scan interior | A flooded pixel survives erosion only if **all eight** neighbours are also flooded (`all_set`). This shrinks regions and removes thin specks. |

### 12.2 Dilation (lines 429-441)

| Line(s) | Code | Plain English |
| :---: | :--- | :--- |
| 429-441 | scan | If an eroded pixel is set, set it and all eight neighbours in `opened`. This restores the surviving regions to roughly their original size. |

Together, erosion + dilation = **opening**: removes isolated noise while keeping big shapes.

### 12.3 Connected components (lines 443-481)

| Line(s) | Code | Plain English |
| :---: | :--- | :--- |
| 444-445 | `visited`, `component_count` | Track pixels already assigned to a region. |
| 447-449 | scan | Find an `opened` pixel not yet visited; that starts a new component. |
| 450-455 | BFS start | `component_pixels` collects the region; the queue starts with the seed. |
| 457-472 | flood fill | Pop a pixel, record it, and push any unvisited `opened` neighbour (8-connected). |
| 474-478 | size test | If the component has fewer than `min_area_pixels`, erase every pixel in it. |
| 483-484 | write back/count | Replace `flood_mask` with the cleaned mask and return the number of components found. |

This removes tiny false alarms (a few dark pixels from a metal roof, for example).

---

## 13. Stage 7: confidence (lines 487-549)

| Line(s) | Code | Plain English |
| :---: | :--- | :--- |
| 487-500 | doc | Output classes 0-4 and the meaning of `strong_change_db`. |
| 501-507 | signature | Inputs: delta, flood mask, permanent-water mask, optional coherence, and the actual seed threshold used. |
| 508-510 | allocate | `class_map` is all zeros (land), `reasons` starts empty. |
| 512-521 | reasons | Add text labels describing the method; note whether coherence was used. |
| 523-526 | permanent water first | Any permanent-water pixel becomes class `1`, even if it also looks flooded. |
| 527-529 | flood pixel | Read its delta and decide whether it is "strong". |
| 531-535 | coherence support | If coherence exists and is below `0.3`, it supports flooding (water decorrelates). If no coherence, `false`. |
| 537-543 | class decision | Strong change **or** coherence support -> class `2` (high). Otherwise, if coherence exists but does **not** support -> class `4` (low). Otherwise -> class `3` (medium). |
| 548 | return | `(class_map, reasons)`. |

What happens without coherence? A strong seed becomes high confidence; a weak grown pixel becomes medium. Class 4 only appears when a coherence file exists and disagrees. This matches the report's `confidence_reasons`.

---

## 14. The main pipeline (lines 551-688)

### 14.1 Setup and dB conversion (lines 552-579)

| Line(s) | Code | Plain English |
| :---: | :--- | :--- |
| 552-558 | signature | `active_slc`, optional `baseline_slc`, optional `coherence`, optional `external_mask`, options. Returns `(class_map, delta_db, report)`. |
| 559-560 | shape/size | `rows`, `cols`, `total_pixels`. |
| 562-564 | active dB | Convert active to dB, then build `valid_mask` = "is finite". |
| 566-569 | baseline dB | If a baseline exists, convert it too. `map` keeps `None` as `None`. |
| 570-572 | combine validity | A pixel is valid only if it is valid in **both** images. `&valid_mask & &other` is element-wise logical AND. |
| 573 | valid count | Count `true` values. |
| 574-579 | log | Report valid / total and percentage. |

### 14.2 Median filtering (lines 581-599)

| Line(s) | Code | Plain English |
| :---: | :--- | :--- |
| 581-586 | active filter | If enabled, median-filter the active dB image; otherwise clone it. |
| 588-595 | baseline filter + delta | If a baseline exists, filter it too, then `compute_change_image`. Return both the delta and the filtered baseline for the permanent-water test. |
| 596-599 | single-image mode | With no baseline, use the active image as its own "baseline". Delta becomes zero everywhere, so no **new** flood can be found; only permanent water is classified. A warning says so. |

### 14.3 Permanent water and Otsu (lines 601-625)

| Line(s) | Code | Plain English |
| :---: | :--- | :--- |
| 601-607 | permanent water | Call `build_permanent_water_mask` with the configured threshold and optional external mask. |
| 609-615 | exclude from Otsu | Build `otsu_valid` = valid AND NOT permanent water. Permanent water has a stable delta near `0 dB`; leaving thousands of those pixels in the histogram can hide the small flood cluster. |
| 616-617 | excluded count | Count how many valid pixels were removed, for logging. |
| 619-620 | Otsu | Compute the threshold using only `otsu_valid`. |
| 621 | effective threshold | `otsu_thresh.min(opts.min_change_db)`. Since negative is stricter, `min` keeps the more negative value. This is the user's safety cap. |
| 622-625 | log | Report raw, effective, and excluded counts. |

### 14.4 Region growing (lines 627-644)

| Line(s) | Code | Plain English |
| :---: | :--- | :--- |
| 629 | `seed_thresh = opts.seed_threshold_db.min(effective_threshold)` | Use the more negative of the seed default and the computed threshold. This keeps seeds genuinely strong. |
| 630-636 | grow | Call `region_grow` with the seed, growth, validity, and permanent-water masks. |
| 638-639 | morphology | Clean the mask; get the component count. |
| 640-644 | clear invalid | Any pixel that was invalid in the input is forced to `false` again, in case filtering/morphology touched it. |

### 14.5 Confidence and summary (lines 646-687)

| Line(s) | Code | Plain English |
| :---: | :--- | :--- |
| 646-653 | confidence | Call `compute_confidence`, passing the actual seed threshold so the high/medium split matches the detector. |
| 655-670 | count classes | Walk the class map and count permanent, high, medium, low. `_ => {}` ignores class 0. |
| 672-685 | build report | Fill `FloodAnalysisResult`. Total flooded = high + medium + low. |
| 687 | return | `(class_map, delta_db, summary)`. `main.rs` ignores `delta_db` but it is useful for debugging/preview. |

---

## 15. Why the tests matter (lines 690-982)

These tests are not decoration; they encode real bugs that were fixed.

| Test(s) | Lesson |
| :--- | :--- |
| `test_gcov_to_db`, `test_gcov_to_db_nodata_becomes_nan` | Zero, negative, and noise-floor powers must become `NaN`, not fake dB values. |
| `test_pipeline_excludes_nodata_from_flood` | Nodata pixels must stay class 0 and must not count as valid. |
| `test_pipeline_accepts_multilooked_pair` | A 32x32 active image averaged to 16x16 can be compared with a 16x16 baseline. |
| `test_compute_change_image` | Subtraction is correct. |
| `test_otsu_threshold` | Otsu separates a negative-change cluster. |
| `test_otsu_threshold_ignores_noise_floor_dropouts` | A `-93 dB` dropout cluster must not drag the threshold below `-25 dB`. This was a real Assam failure. |
| `test_pipeline_detects_flood_with_noise_floor_dropouts` | The full pipeline still finds a real `-8 dB` flood next to a `-50 dB` dropout. |
| `test_pipeline_excludes_permanent_water_from_otsu` | A large permanent-water body must not suppress a genuine shallow flood. |
| `test_region_grow_and_cleanup` | Seeds grow and small components are removed. |
| `test_pipeline_raw_vs_effective_threshold_binding_cap` / `unbinding` | The user cap works in both directions: sometimes the cap wins, sometimes Otsu wins. |

When changing thresholds or Otsu logic, run these tests first. They are the memory of past mistakes.

Next: [05 - io.rs](./05-io.md), where the class map becomes files a human can open.
