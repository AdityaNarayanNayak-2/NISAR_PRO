# NISAR Pro: InGARSS 2026 YP Hackathon, Phase 1

Water mapping and water change over the Ganga plain in Bihar, India, from NISAR L2 GCOV radar data.
We compare three methods on the same area and dates: L-band only, S-band only, and L-band and
S-band combined (L+S). The whole NISAR scene is analysed (track 98, frame 14: 59,083.56 km²,
14,599,867 acres), not only the 20 km × 20 km reference box.

Team: RunLayer Labs. Author: Aditya Narayan Nayak, NISAR Pro Systems & SAR Analytics, Kundura, Odisha, India.
Engine source code: https://gitlab.com/Aditya-Narayan-Nayak/nisar_pro (folder `sar_science_processor/`).

## Result

Checked against cloud-free Sentinel-2 optical images, L+S scored higher than L-band in all three
tests. It did not score higher than S-band: equal on 12 Sep, lower on 31 Aug and for new water.

| 31 Aug → 12 Sep, same area | New water | F1 against Sentinel-2, 12 Sep |
|---|---:|---:|
| L-band | 1,137.14 km² (280,993 acres) | 0.859 |
| S-band | 1,174.89 km² (290,322 acres) | 0.891 |
| L+S | 1,337.15 km² (330,417 acres) | 0.891 |

## Check the package (2 minutes, no downloads)

Needs Python 3 only. No granules, no internet, nothing to install.

```bash
cd ingarss_2026
python3 run_bihar_analysis.py
```

What it does and what you should see:

1. **File check.** Compares every file in this folder with its SHA-256 fingerprint in
   `provenance_manifest.json`. The two numbers in `N of N files match` should be equal. A file edited after the
   results were made is listed by name.
2. **Results for Tasks A to H** of the problem statement, in the same order. Every number is read
   from the JSON files in `results/`; none is typed into the script.
3. **Area check.** For each method, the classes must add up to the whole analysed area.
4. **Answer to the research question**, worked out from the Sentinel-2 scores.
5. Last line: `ALL CHECKS PASSED`, and exit code 0.

## What to read and look at

| File | What it is |
|---|---|
| `TECHNICAL_NOTE.pdf` | The technical note, 6 pages, IEEE two-column layout with 5 figures (source text: `TECHNICAL_NOTE.md`) |
| `presentation.pdf` | 8 slides |
| `explainer/NISAR_Pro_Visual_Walkthrough.pdf` | 13 pages: each processing stage with real pixels, before/after images for every date pair, and a time-lapse |
| `explainer/timelapse_L_band.gif` | The four L-band dates as an animation |
| `maps/fig0` to `fig5` | AOI map, change maps, water masks, new water, the season, Sentinel-2 scores. Each shows dates, legend, CRS, 80 m and data source |
| `POLARIZATION_ASSESSMENT.md` | Which polarization channels exist, what was tested, results |
| `VALIDATION.md` | Sentinel-2 method, scores, confusion matrices, limits, why some numbers differ |

## Where each requirement is answered

| Problem statement | Where |
|---|---|
| A. Data review, AOI map | `maps/fig0_aoi_and_footprint.png`; data list and catalogue search below |
| B. L-band and S-band water masks | `maps/fig2_water_masks_sep12.png`; `results/L_aug31_sep12/`, `results/S_aug31_sep12/` |
| C. L+S water mask and method | `results/LS_fused_aug31_sep12/`; technical note section 5 |
| D. Change maps and areas | `maps/fig1_change_maps_aug31_sep12.png`; checker output, Task D |
| E. New water | `maps/fig3_newly_detected_water_fused.png`, `maps/fig4_l_band_lifecycle.png`; technical note section 7 |
| F. Comparing the three methods | Technical note sections 7–8; `VALIDATION.md`; `maps/fig5_sentinel2_agreement.png` |
| G. Reproducibility | This README; `run_bihar_analysis.py`; `scripts/`; `bin/` |
| H. Polarization | `POLARIZATION_ASSESSMENT.md` |
| Validation and uncertainty | `VALIDATION.md` |

## Which program made each file

| Files | Made by |
|---|---|
| `results/L_*/`, `results/S_*/`: `*_class.tif`, `*.geo.json`, `*.json` | The Rust engine `bin/sar_science_processor` (source on GitLab). It reads the `.h5` granules and writes the class map as a GeoTIFF, new-water shapes as GeoJSON and a JSON report |
| `results/LS_fused_aug31_sep12/` | `scripts/run_ls_fusion_and_pol_assessment.py`. It reads the L-band and S-band class maps and the granules, applies the four fusion rules and writes the fused GeoTIFF and reports |
| `results/validation/` | `scripts/validate_sentinel2.py`, `scripts/check_sand_rule.py`, `scripts/score_polarization_features.py`. They download Sentinel-2 images and compare them with our maps |
| `maps/` | `scripts/make_maps.py`. It draws the figures from the GeoTIFFs and JSONs above |
| `explainer/` | `scripts/make_walkthrough.py` reads the granules again at 80 m with Python (h5py) for the before/after images, and uses the engine's class maps for the results. `scripts/build_walkthrough_doc.py` writes the text, printed to PDF with a browser |
| `note_figures/` | `scripts/make_note_figures.py`. The 5 figures of the technical note: compressed walkthrough figures, the L-band vs S-band comparison and the fusion workflow diagram |
| `provenance_manifest.json` | `scripts/build_provenance_manifest.py`. A SHA-256 fingerprint of every file, so anyone can check nothing changed |
| `benchmarks.json` | `run_bihar_analysis.py --run-engine`. Measured engine run times |

All GeoTIFFs are EPSG:32645 (UTM zone 45N) with 80 m pixels. They open in QGIS or any GIS.
Class codes: 0 land or outside the scene, 1 stable water, 2 new water (high confidence),
3 new water (medium confidence), 5 water loss. Code 4 needs extra input and is not used.
Water on the later date is classes 1, 2 and 3; on the earlier date, classes 1 and 5.
The GeoJSON files (EPSG:4326) hold the new-water areas as polygons.

## Results folders

| Folder | Band and dates |
|---|---|
| `results/L_jul26_aug31/` | L-band, 26 Jul → 31 Aug |
| `results/L_aug31_sep12/` | L-band, 31 Aug → 12 Sep |
| `results/S_aug31_sep12/` | S-band, 31 Aug → 12 Sep |
| `results/LS_fused_aug31_sep12/` | L+S, 31 Aug → 12 Sep, on the area both bands cover |
| `results/L_sep12_oct18/` | L-band, 12 Sep → 18 Oct |
| `results/supplementary/` | 12 Sep → 18 Oct with a narrower 3-pixel edge cut, kept only for comparison |
| `results/validation/` | Sentinel-2 comparisons |

The L-band and S-band reports cover each band's own area. The three-way comparison uses the area
both bands cover, so its numbers come from `results/LS_fused_aug31_sep12/`. For example, L-band new
water is 1,166.21 km² (288,177 acres) on its own area and 1,137.14 km² (280,993 acres) on the shared
area. File names contain "flood" because that is how the engine names its outputs; no flood is claimed.

## Run everything again from the granules

Needs Linux x86_64, the six `.h5` files listed below (about 7 GB each), and Python 3 with `numpy`,
`h5py`, `rasterio`, `requests` and `matplotlib`. The Sentinel-2 steps need internet.

```bash
cd ingarss_2026
B=bin/sar_science_processor
D=/path/to/folder/with/the/six/granules
# engine: one run per pair of dates (--slave is the earlier date); S-band only changes --radar-band
$B --mode flood --input $D/<12-Sep-LSAR>.h5 --slave $D/<31-Aug-LSAR>.h5 --crop-preset full --swath-edge-erosion 40 --radar-band l --output /tmp/nisar/L
$B --mode flood --input $D/<12-Sep-SSAR>.h5 --slave $D/<31-Aug-SSAR>.h5 --crop-preset full --swath-edge-erosion 40 --radar-band s --output /tmp/nisar/S
$B --mode flood --input $D/<31-Aug-LSAR>.h5 --slave $D/<26-Jul-LSAR>.h5 --crop-preset full --swath-edge-erosion 40 --radar-band l --output /tmp/nisar/jul
$B --mode flood --input $D/<18-Oct-LSAR>.h5 --slave $D/<12-Sep-LSAR>.h5 --crop-preset full --swath-edge-erosion 40 --radar-band l --output /tmp/nisar/oct
# fusion
python3 scripts/run_ls_fusion_and_pol_assessment.py --data-dir $D --l-class /tmp/nisar/L_flood_class.tif \
   --s-class /tmp/nisar/S_flood_class.tif --jul-class /tmp/nisar/jul_flood_class.tif --out-dir /tmp/nisar/fused
# checks against Sentinel-2
python3 scripts/validate_sentinel2.py --results results --work-dir /tmp/s2 --output /tmp/nisar/sentinel2_validation.json
python3 scripts/check_sand_rule.py --data-dir $D --results results --work-dir /tmp/s2 --output /tmp/nisar/sand_rule_check.json
python3 scripts/score_polarization_features.py --data-dir $D --results results --work-dir /tmp/s2 --output /tmp/nisar/pol_scores.json
# figures and walkthrough
python3 scripts/make_maps.py --results results --out /tmp/nisar/maps
python3 scripts/make_walkthrough.py --data-dir $D --results results --work-dir /tmp/walk --out explainer
python3 scripts/build_walkthrough_doc.py
python3 scripts/make_note_figures.py
../scripts/build_note_pdf.sh   # technical note PDF (Chrome)
```

Each engine run reads two full scenes (2.31 billion values) in 44 to 65 s with at most 2.32 GB of
memory, on a 4-core, 15 GB Linux workstation. The fusion takes about 4 minutes and 3.2 GB.
We reran all of this on 7–10 November 2026 and got the same areas; the fused and 12 Sep → 18 Oct
class maps were also compared byte for byte and matched.

## Data used

All NISAR L2 GCOV, ascending, track 98, frame 14, frequency A. L-band from ASF DAAC, S-band from
Bhoonidhi (NRSC/ISRO).

| Date | Band | Mode | File | SHA-256 |
|---|---|---|---|---|
| 2026-07-26 | L | DHDH | `NISAR_L2_PR_GCOV_026_098_A_014_4005_DHDH_A_20260726T233812_20260726T233846_P05023_N_F_J_001.h5` | `510957e97fc88d3c75908d26834b43e9f0d98eca31aad7bac726641a19385703` |
| 2026-08-31 | L | DHDH | `NISAR_L2_PR_GCOV_029_098_A_014_4005_DHDH_A_20260831T233810_20260831T233845_P05023_N_F_J_001.h5` | `d6504ca70720fea6338c242cffca22a90c6a3bcaacd50cbfa4e0c2938523ff99` |
| 2026-09-12 | L | DHDH | `NISAR_L2_PR_GCOV_030_098_A_014_4005_DHDH_A_20260912T233810_20260912T233845_P05023_N_F_J_001.h5` | `86832932ed1f16fbcbc2b0f20b07a64ab1472bc1afb178238e920e3e79f205d2` |
| 2026-10-18 | L | DHDH | `NISAR_L2_PR_GCOV_033_098_A_014_4005_DHDH_A_20261018T233811_20261018T233845_P05023_N_F_J_001.h5` | `44e519ef320320173a627a2dd345f51cdae70e2d34456bf8c88d518e0c0ecaba` |
| 2026-08-31 | S | DHNA | `NISAR_S2_UR_GCOV_029_098_A_014_3700_DHNA_A_20260831T233810_20260831T233846_P00500_M_F_I_001.h5` | `3e42a486786e0c6245937e38fc49b00cbabd9a331b7568501d79c0999c0ce0fc` |
| 2026-09-12 | S | DHNA | `NISAR_S2_UR_GCOV_030_098_A_014_3700_DHNA_A_20260912T233809_20260912T233846_P00500_N_F_I_001.h5` | `8122aa2011220f9385fa524ca96d22cf991611e6f452b96a5d5c8ec34962ad47` |


- Grids: L-band 33,696 × 34,344 pixels, S-band 33,120 × 34,200 pixels, both 10 m, EPSG:32645.
  Both are averaged to 80 m and line up exactly (S-band starts 36 rows and 9 columns into the L grid).
- The files hold echo power. HHHH is used to find water; HVHV is used in the fusion rules.
- S-band was available to us for 31 Aug and 12 Sep, so the three-way comparison uses that pair.
- Sentinel-2 L2A images from 29 Aug, 13 Sep and 18 Oct 2026 (Microsoft Planetary Computer) are used
  only to check the results.

### Catalogue searches

**ASF, 7 Nov 2026**, NISAR GCOV over the reference box (86.3946–86.6054° E, 25.4098–25.5902° N):
https://search.asf.alaska.edu/#/?dataset=NISAR&sciProducts=GCOV&polygon=POLYGON((86.3946%2025.4098,86.6054%2025.4098,86.6054%2025.5902,86.3946%2025.5902,86.3946%2025.4098))
76 results, all L-band.

| Track / frame | Pass | Records | Main-band polarizations | Status |
|---|---|---:|---|---|
| 98 / 14 | Ascending | 19 | HH, HV | Four dates analysed |
| 120 / 76 | Descending | 9 | HH, HV, VH, VV (full-pol) | Not analysed |
| 120 / 76 | Descending | 5 | HH, HV | Not analysed |
| 48 / 75 and 48 / 76 | Descending | 43 | Dual-pol and full-pol | Not analysed |


Track 120 has L-band full-pol on 21 Aug, 2 Sep, 14 Sep and 26 Sep 2026. It was not processed.

**Bhoonidhi**, S-band, searched for 31 Aug and 12 Sep at 25.5° N, 86.5° E (Open Data, 5 m, Microwave,
NISAR, SSAR, L2 GCOV). Two results: the two S-band files above. No compact-pol was found for those
dates; other dates were not searched.

## How it works

The full method with formulas is in the technical note (sections 3–5) and the walkthrough (Part 1).

1. Read each scene in strips of 1,024 rows and average every 8 × 8 block of power into one 80 m pixel.
2. Convert to dB. Power below 0.0001 is no data. Cut 40 pixels next to every no-data edge.
3. Smooth speckle with a 3 × 3 median, then change = dB(later) − dB(earlier).
4. Stable water: below −13.0 dB (L) or −12.5 dB (S) on both dates.
5. New water: start from pixels whose change is below −5.0 dB (L) or −4.8 dB (S), add touching pixels
   below −2.5 dB (L) or −2.2 dB (S), remove thin lines and groups under 8 pixels. Otsu's threshold
   is calculated and reported, but does not change these numbers here.
6. Water loss: water before, not water after, and at least 3 dB brighter.
7. L+S: four if/then rules on the shared 80 m grid (sandbar, wind, canopy, S-band gate).

Area = number of pixels × 0.0064 km². 1 acre = 0.004046856 km².

## Limits

- Thresholds are set by hand for each band.
- New water means the echo dropped, not a fixed water level on the later date.
- New water narrower than about 240 m (3 pixels) is removed by the cleanup step.
- "Stable water" means water on both dates, not permanent water.
- Sentinel-2 can only check cloud-free pixels (about 14% of the area on 12 Sep) and cannot see
  water under crops.
- The rule names (sandbar, wind, canopy) describe what each rule aims at; the surface types were
  not confirmed.
- Radar shows where water appeared or left, not why. No flood or rainfall cause is claimed.
- L-band full-pol data exist on track 120 but were not processed.
