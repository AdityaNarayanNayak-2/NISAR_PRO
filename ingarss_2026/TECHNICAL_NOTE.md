# Dynamic and Seasonal Surface-Water Mapping over the Bihar Ganga Plain Using NISAR L2 GCOV

## Abstract

This technical note presents NISAR Pro, a reproducible workflow for dynamic surface-water mapping and change detection over the Ganga alluvial plain of Bihar. The workflow uses NISAR Level-2 Geocoded Polarimetric Covariance Matrix (L2 GCOV) observations and compares NASA LSAR L-band, ISRO SSAR S-band, and a documented L+S comparison on a common 80 m lattice. The central question is whether dual-frequency evidence improves water mapping relative to single-frequency baselines.

The processing engine is implemented in Rust. It reads full-scene GCOV products as row-bounded HDF5 hyperslabs, performs 8×8 block averaging while streaming, and processes the resulting 80 m grid without materialising the native 10 m scene in memory. For the Aug 31–Sep 12 comparison, the repository records 1,337.15 km² of fused water gain, compared with 1,137.14 km² for the L-band comparison and 1,174.89 km² for S-band. These numbers are descriptive outputs of the current pipeline, not accuracy claims. Independent reference labels and a confusion matrix remain required before the values can be interpreted as validated classification performance.

## 1. Introduction and research question

The Bihar Ganga alluvial plain contains perennial channels, sandbars, agricultural floodplain, wetlands, and vegetated lowlands. Their radar response changes with water extent, roughness, vegetation, viewing geometry, and acquisition date. A single-date intensity threshold can confuse calm water, smooth sediment, and low-signal swath edges. A temporal log-ratio provides a more useful observable because static backscatter components partly cancel between comparable observations.

The study uses the official 20 km × 20 km reference box centred at 25.5000° N, 86.5000° E only for scene discovery and verification. The outputs cover the selected scene footprint. The actual repository granules identify relative track 098 and frame 014, with L-band product code 4005 and S-band product code 3700; these identifiers should be copied from the selected granule metadata in the final submission.

The research question is:

> Does combining NISAR L- and S-band L2 GCOV observations improve surface-water mapping or change detection relative to single-frequency baselines, and under what conditions?

## 2. Data and preprocessing

The core input is NISAR L2 GCOV. The repository contains:

| Configuration | Product | Pair | Grid |
| --- | --- | --- | --- |
| L-only | LSAR, 1.239 GHz, λ≈0.242 m | 2026-08-31 → 2026-09-12 | EPSG:32645, 80 m |
| S-only | SSAR, 3.200 GHz, λ≈0.0937 m | 2026-08-31 → 2026-09-12 | EPSG:32645, 80 m |
| L+S comparison | LSAR + SSAR derived comparison artifact | same dates | common overlap grid |

The native full-scene dimensions are approximately 33,696 × 34,344 at 10 m, or about 1.157 billion native pixels per date. The Rust parser reads bounded row strips, converts the selected GCOV term to floating-point values, and block-averages to an 80 m grid. This is a memory-management strategy, not a change to the required scene extent.

Values below the configured valid-power floor (10⁻⁴ linear power, approximately −40 dB) are treated as nodata. A small swath-edge erosion is applied to reduce RTC roll-off artefacts. The selected covariance term and polarization must be reported with each result; the current showcase uses the HHHH/HH path and includes a Task H inventory in the fusion JSON.

## 3. Detection method

### 3.1 Physical observable

For each valid pixel:

\[
\gamma^0_{dB}(t)=10\log_{10}(\gamma^0_{linear}(t)),\qquad
\Delta\gamma^0_{dB}=\gamma^0_{dB}(t_2)-\gamma^0_{dB}(t_1).
\]

Calm open water tends to produce low backscatter because the smooth surface sends energy away from the side-looking sensor. Rough soil, vegetation, and built structures generally return more energy. L-band has a longer wavelength and can respond differently to vegetation and roughness than S-band; these differences motivate comparison rather than assuming that fusion is automatically superior.

### 3.2 Seven-stage operational workflow

1. Read metadata and verify instrument, frequency, polarization, dates, grid, and georeferencing.
2. Convert valid linear GCOV power to dB and apply the NESZ/nodata mask.
3. Apply the configured 3×3 median filter.
4. Compute the active-minus-baseline log-ratio and estimate a bounded Otsu split.
5. Exclude pixels identified as persistent water before histogram thresholding to reduce wet-baseline bias.
6. Grow regions from strong seeds (default −5.0 dB) to a weaker growth limit (default −2.5 dB), then apply morphology and minimum connected-component filtering.
7. Assign temporal classes, calculate area, and export GeoTIFF, PNG, GeoJSON, and JSON report products.

The Aug 31–Sep 12 L-band report records an Otsu threshold of approximately −3.26 dB; the S-band report records approximately −3.47 dB. Thresholds are computed from each sensor's distribution and should not be silently reused across frequencies.

## 4. Results: L-only, S-only, and L+S

The following values are copied from `sar-bihar-ls-fused-aug31-sep12_flood.json`, which is the canonical comparison artifact for this note.

| Configuration | Stable water | New water gain | Receded water | Valid comparison area |
| --- | ---: | ---: | ---: | ---: |
| L-only | 3,314.83 km² / 819,110 acres | 1,137.14 km² / 280,992 acres | 888.84 km² / 219,636 acres | 59,083.56 km² |
| S-only | 2,546.37 km² / 629,221 acres | 1,174.89 km² / 290,320 acres | 214.98 km² / 53,123 acres | 59,083.56 km² |
| L+S comparison | 2,652.29 km² / 655,393 acres | 1,337.15 km² / 330,415 acres | 723.37 km² / 178,747 acres | 59,083.56 km² |

The fused result reports a larger gain than either single-frequency result, but this is not by itself proof of better accuracy. A defensible conclusion requires spatial agreement, independent labels, comparable masks, and an uncertainty analysis. The current evidence supports the narrower claim that the fusion rule produces a different and physically interpretable classification, including the recorded sandbar, canopy, and wind-riffle gates.

## 5. Multi-temporal lifecycle

The repository includes four operational epochs: 26 Jul, 31 Aug, 12 Sep, and 18 Oct 2026. The two analysed transitions are:

- **Expansion:** 31 Aug → 12 Sep. The L-band full-scene report records 1,166.21 km² of net new water gain and 889.96 km² of receded water in the same pair; the canonical L+S comparison artifact records 1,337.15 km² fused gain and 723.37 km² fused recession.
- **Recession:** 12 Sep → 18 Oct. The L-band recession report records 243.40 km² gain and 2,650.27 km² receded water.

The four-epoch stack is scientifically useful because water present on both dates of a late-monsoon pair is not necessarily perennial. A July or post-monsoon reference helps separate persistent channel water from seasonal standing water. The final narrative must label “newly detected water” rather than automatically calling every change a flood caused by rainfall.

## 6. Polarization and physical interpretation

The fusion artifact inventories LSAR DHDH terms `HHHH`, `HVHV` and SSAR DHNA terms `HHHH`, `HVHV`, `HHHV`. It records three feature families: co-polarized HHHH, dual-polarized HHHH+HVHV gating, and the span `HHHH + 2×HVHV`. These are valid comparisons only when the selected terms, modes, dates, coverage, and spatial support are documented.

The recorded physical gates are useful hypotheses to test:

- S-band roughness gate rejecting L-band sandbar false positives.
- L-band cross-polar response identifying possible inundation beneath vegetation.
- HV-based recovery of water that a co-polarized threshold misses in wind-roughened channels.

They should be described as algorithmic decision gates supported by the current outputs, not universal physical laws. A sensitivity table showing results with each gate disabled is a high-value addition.

## 7. Validation and uncertainty

The current repository does not contain independent dated reference labels or a completed confusion matrix. Therefore this submission should not report precision, recall, F1, IoU, or overall accuracy as if they were externally validated. The correct validation plan is:

1. Select dated reference scenes or authoritative water/inundation products that overlap each NISAR observation window.
2. Reproject the reference to the same EPSG:32645 80 m support.
3. Sample water and non-water points across open water, agriculture, vegetation, sandbars, and swath edges.
4. Report a confusion matrix and confidence intervals separately for L, S, and L+S.
5. Repeat for change classes and disclose temporal mismatch, cloud/optical limitations, mixed pixels, geolocation differences, and label uncertainty.

Known uncertainty sources include acquisition-date mismatch between bands, different swath footprints, wind and capillary waves, vegetation volume scattering, exposed sediment, threshold sensitivity, and the fact that a SAR mask alone does not establish the cause of a change.

## 8. Conclusion and operational relevance

NISAR Pro demonstrates a practical full-scene processing architecture and a transparent L/S comparison for Bihar. Its principal engineering contribution is streaming native GCOV data into a manageable analysis lattice without loading the full native scene into memory. Its principal scientific contribution is an explicit comparison of single-frequency and dual-frequency evidence combined with a multi-epoch interpretation of expansion and recession.

The strongest final claim is conditional: L+S fusion is promising where the bands provide complementary information, but its value must be established with independent reference labels and controlled ablations. Completing that validation, reconciling the canonical L-band numbers, and documenting the exact fusion rule should be treated as submission blockers.

