# NISAR Pro: InGARSS 2026 YP Hackathon, Phase 1

Water mapping and water change over the Ganga plain in Bihar, India, from NISAR L2 GCOV radar data.
We compare three methods on the same area and dates: L-band only, S-band only, and L-band and
S-band combined (L+S). The whole NISAR scene is analysed (track 98, frame 14), not only the 20 km × 20 km
reference box. The three maps are compared on the common L/S grid, where both bands are valid on both
dates: 59,083.56 km² (14,599,867 acres).

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

## Step 1: check the package (2 minutes)

This step needs only Python 3.8 or newer. No granules, no internet and no extra packages: the
checker uses the Python standard library only. It works on Linux, macOS and Windows.

**1. Get the folder.** Either unzip `ingarss_2026.zip`, or clone the repository:

```bash
git clone https://gitlab.com/Aditya-Narayan-Nayak/nisar_pro.git
cd nisar_pro
```

**2. Check your Python version.** It must print 3.8 or higher.

| System | Command |
|---|---|
| Linux, macOS | `python3 --version` |
| Windows (PowerShell or Command Prompt) | `python --version` (or `py --version`) |

**3. Run the checker.** It can be started from any folder; these commands start it from the
folder that contains `ingarss_2026`.

| System | Command |
|---|---|
| Linux, macOS | `python3 ingarss_2026/run_bihar_analysis.py` |
| Windows | `python ingarss_2026\run_bihar_analysis.py` |

**4. Read the output.** In order:

1. **File check.** Every file in this folder is compared with its SHA-256 fingerprint in
   `provenance_manifest.json`. You should see `50 of 50 files match their SHA-256 hash.` A changed file is
   listed by name.
2. **Results for Tasks A to H** of the problem statement, in the same order. Every number is read
   from the JSON files in `results/`; none is typed into the script.
3. **Area check.** For each method, the classes must add up to the whole analysed area.
4. **Answer to the research question**, worked out from the Sentinel-2 scores.
5. Last line: `ALL CHECKS PASSED`, exit code 0. Other exit codes: 2 an input file is missing,
   3 a check failed, 4 the optional engine run failed.

The checker only reads files. It writes nothing unless you add `--run-engine`, which needs the granules.

### If the checker does not pass

| What you see | Cause | Fix |
|---|---|---|
| `python3: command not found` (Windows) | Windows names it `python` or `py` | Use `python` or `py` instead of `python3` |
| `SyntaxError` right at the start | Python 2 or Python 3.7 and older | Install Python 3.8 or newer |
| Some `.md`, `.py` or `.json` files do not match (Windows clone) | Git turned line endings into CRLF in a copy cloned before 10 Nov 2026 | In the repository: `git rm -r --cached -q ingarss_2026` then `git checkout HEAD -- ingarss_2026`, or clone again |
| A file does not match after you opened it | An editor saved it again (line endings or encoding) | Unzip or check out the folder again; do not save files inside it |
| `missing` for `.tif` files | An old clone, from before the GeoTIFFs were added | `git pull`, or use the zip |
| `No such file or directory` | Wrong path to the script | Run `ls ingarss_2026` (Windows: `dir ingarss_2026`) and check the folder is there |

## Step 2: look at the maps and data (optional)

- Open `TECHNICAL_NOTE.pdf`, `presentation.pdf` and the `maps/` PNGs in any viewer. `presentation.pptx`
  opens in PowerPoint, LibreOffice Impress or ONLYOFFICE.
- Open the GeoTIFFs in `results/*/` in QGIS: *Layer → Add Layer → Add Raster Layer*. They are
  EPSG:32645 with 80 m pixels. To colour them by class, use *Symbology → Paletted/Unique values*
  with the class codes listed further down.
- Open the GeoJSON files in QGIS (*Add Vector Layer*) or drag them onto https://geojson.io to see the
  new-water polygons on a basemap. The largest file is about 7 MB, so it takes a few seconds.
- Every number in the JSON reports is in km² and acres. The checker prints the main ones.

## What to read and look at

| File | What it is |
|---|---|
| `TECHNICAL_NOTE.pdf` | The technical note, 4 pages, IEEE two-column layout with 3 figures (source text: `TECHNICAL_NOTE.md`) |
| `presentation.pdf` | 8 slides. `presentation.pptx` is the same deck as a PowerPoint file |
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
| C. L+S water mask and method | `results/LS_fused_aug31_sep12/`; technical note section V |
| D. Change maps and areas | `maps/fig1_change_maps_aug31_sep12.png`; checker output, Task D |
| E. New water | `maps/fig3_newly_detected_water_fused.png`, `maps/fig4_l_band_lifecycle.png`; technical note section VI |
| F. Comparing the three methods | Technical note sections IV, V and VII; `VALIDATION.md`; `maps/fig5_sentinel2_agreement.png` |
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
| `note_figures/` | `scripts/make_note_figures.py`. The 3 figures of the technical note: two compressed walkthrough figures (the 7 stages and the time-lapse) and the L-band vs S-band comparison |
| `provenance_manifest.json` | `scripts/build_provenance_manifest.py`. A SHA-256 fingerprint of every file, so anyone can check nothing changed |
| `benchmarks.json` | `run_bihar_analysis.py --run-engine`. Measured engine run times |
| `presentation.pptx`, `presentation.pdf` | `scripts/build_presentation_pptx.py` in the GitLab repository (python-pptx); the PDF is the PPTX exported with LibreOffice |
| `TECHNICAL_NOTE.pdf` | `scripts/build_note_pdf.sh` in the GitLab repository (printed with Chrome) |

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

## Step 3: run everything again from the granules (optional, about 1 hour)

This rebuilds every result from the six radar files. It is only needed to repeat the processing;
Step 1 already checks the packaged results.

**What you need**

- Linux x86_64 with glibc 2.35 or newer (Ubuntu 22.04+, Debian 12+, Fedora 36+, RHEL 10). Check with
  `ldd --version`. On Windows, use WSL2 with Ubuntu 22.04 or newer. The engine does not run on macOS.
- 8 GB of RAM or more, and about 60 GB of free disk: the granules take about 53 GB (L-band about 7 GB
  each, S-band about 12.6 GB each), the outputs a few GB.
- The six `.h5` files listed under "Data used", all in one folder. Check each one with
  `sha256sum <file>` against the table; a broken download is the most common cause of a failed run.
- Python 3.8+ with these packages: `pip install numpy h5py rasterio requests matplotlib pillow`
- Internet for the Sentinel-2 steps only.
- For the PDFs only: Google Chrome (or Chromium) and `pdfinfo` (poppler-utils).

**Set up once**

```bash
cd ingarss_2026
chmod +x bin/sar_science_processor          # unzip tools often drop the run permission
./bin/sar_science_processor --help | head -3  # must print the usage text
B=bin/sar_science_processor
D=/path/to/folder/with/the/six/granules
mkdir -p /tmp/nisar
```

**a. Engine, one run per pair** (about 1 minute each, at most 2.32 GB of memory). `--input` is the later
date and `--slave` the earlier one. Only `--radar-band` changes for S-band. Replace each `<...>` with
the file name from the table.

```bash
$B --mode flood --input $D/<12-Sep-LSAR>.h5 --slave $D/<31-Aug-LSAR>.h5 --crop-preset full --swath-edge-erosion 40 --radar-band l --output /tmp/nisar/L
$B --mode flood --input $D/<12-Sep-SSAR>.h5 --slave $D/<31-Aug-SSAR>.h5 --crop-preset full --swath-edge-erosion 40 --radar-band s --output /tmp/nisar/S
$B --mode flood --input $D/<31-Aug-LSAR>.h5 --slave $D/<26-Jul-LSAR>.h5 --crop-preset full --swath-edge-erosion 40 --radar-band l --output /tmp/nisar/jul
$B --mode flood --input $D/<18-Oct-LSAR>.h5 --slave $D/<12-Sep-LSAR>.h5 --crop-preset full --swath-edge-erosion 40 --radar-band l --output /tmp/nisar/oct
```

Each run writes `<output>_flood_class.tif`, `<output>_flood.geo.json`, `<output>_flood.json` and
PNG previews. Compare your areas with the packaged ones:

```bash
python3 -c "import json,sys; [print(f, '%.2f km2, %.0f acres' % (a['new_inundation_high_km2'], a['new_inundation_high_acres'])) for f in sys.argv[1:] for a in [json.load(open(f))['areas']]]" \
  /tmp/nisar/L_flood.json results/L_aug31_sep12/sar-bihar-aug31-sep12-full_flood.json
```

Both lines should show the same value: L-band high-confidence new water, 31 Aug → 12 Sep,
713.74 km² (176,369 acres).

**b. L+S fusion** (about 4 minutes, 3.2 GB of memory):

```bash
python3 scripts/run_ls_fusion_and_pol_assessment.py --data-dir $D --l-class /tmp/nisar/L_flood_class.tif \
   --s-class /tmp/nisar/S_flood_class.tif --jul-class /tmp/nisar/jul_flood_class.tif --out-dir /tmp/nisar/fused
```

**c. Checks against Sentinel-2** (needs internet; the first run downloads the images into `/tmp/s2`):

```bash
python3 scripts/validate_sentinel2.py --results results --work-dir /tmp/s2 --output /tmp/nisar/sentinel2_validation.json
python3 scripts/check_sand_rule.py --data-dir $D --results results --work-dir /tmp/s2 --output /tmp/nisar/sand_rule_check.json
python3 scripts/score_polarization_features.py --data-dir $D --results results --work-dir /tmp/s2 --output /tmp/nisar/pol_scores.json
```

**d. Maps and figures.** These write into `/tmp`, so the package stays unchanged:

```bash
python3 scripts/make_maps.py --results results --out /tmp/nisar/maps
python3 scripts/make_walkthrough.py --data-dir $D --results results --work-dir /tmp/walk --out /tmp/nisar/walk
python3 scripts/make_note_figures.py --src /tmp/nisar/walk
```

Steps c and d read the packaged `results/` folder, so they check the packaged maps. To run them
on your own outputs from steps a and b, copy those files over the packaged ones first. After that,
Step 1 reports those files as changed, which is expected.

The walkthrough and the technical note are printed with Chrome. For the walkthrough, run `make_walkthrough.py` with `--out explainer`,
then `python3 scripts/build_walkthrough_doc.py`, print `explainer/walkthrough.html` with the Chrome
command at the top of that script, and delete the `walk_*.png` and `walkthrough.html` working files
from `explainer/`. The technical note is built by `scripts/build_note_pdf.sh` and the slides by
`scripts/build_presentation_pptx.py` (needs `pip install python-pptx`), both in the GitLab repository.
After any change inside this folder, run `python3 scripts/build_provenance_manifest.py` so Step 1
passes again.

We reran all of this on 7–10 November 2026 on a 4-core, 15 GB Linux workstation and got the same
areas; the fused and 12 Sep → 18 Oct class maps were also compared byte for byte and matched.

### If a step fails

| What you see | Cause | Fix |
|---|---|---|
| `Permission denied` on `bin/sar_science_processor` | The run permission was lost when unzipping | `chmod +x bin/sar_science_processor` |
| `GLIBC_2.35 not found` | Linux older than the list above | Use a newer Linux, a Docker `ubuntu:22.04` container, or build the engine from source (`cargo build --release` in `sar_science_processor/` on GitLab) |
| `ModuleNotFoundError: No module named ...` | A Python package is missing | `pip install numpy h5py rasterio requests matplotlib pillow` |
| HDF5 or read error from the engine | Incomplete granule download | Compare `sha256sum` with the table and download again |
| Sentinel-2 download errors | No internet or the Planetary Computer is busy | Run the step again; files already downloaded stay in `/tmp/s2` |
| `Missing ['walk_A_stages.png', ...]` | `make_note_figures.py` cannot find the walkthrough images | Run `make_walkthrough.py` first and pass its `--out` folder as `--src` |
| Step 1 fails after a rerun | Files in the package were overwritten | Expected if you copied in your own outputs; run `build_provenance_manifest.py`, or unzip again |

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

The full method with formulas is in the technical note (sections II–V) and the walkthrough (Part 1).

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
