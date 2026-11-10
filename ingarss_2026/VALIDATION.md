# Validation, uncertainty and result reconciliation

Water masks were scored against dated Sentinel-2 L2A optical labels, on the cloud-free part of
the scene. The scores measure agreement with an optical reference, not accuracy against ground truth.

Reproduce with `scripts/validate_sentinel2.py`. All numbers below are in
`results/validation/sentinel2_validation.json`.

## Method

- **Reference:** Sentinel-2 L2A (Microsoft Planetary Computer), orbit R076, zone 45 tiles,
  acquired 29 Aug, 13 Sep and 18 Oct 2026. Native resolution 10 m (B03, B08) and 20 m (scene
  classification), averaged to the 80 m NISAR grid.
- **Water label:** NDWI = (B03 − B08) / (B03 + B08) ≥ 0.
  This threshold was fixed before scoring. Thresholds 0.1, 0.2 and 0.3 are reported as sensitivity.
- **Excluded:** nodata, defective, shadow, cloud, cirrus and snow scene classes, with
  a 3-pixel buffer around them.
- **Scored area:** only inside `results/LS_fused_aug31_sep12/valid_support.tif`, the footprint after
  40-pixel edge erosion: 55,208.86 km² (13,642,408 acres).
- **Masks:** later-date water is classes 1, 2, 3. Earlier-date water is classes 1, 5.
- **Change test:** reference gain is non-water on 29 Aug and water on 13 Sep.
- **Sampling:** no sampling. Every cloud-free pixel inside the footprint is scored.

## Results at NDWI ≥ 0

| Test | Time gap | Scored area | Method | Precision | Recall | F1 | IoU |
|---|---|---|---|---:|---:|---:|---:|
| Water, 12 Sep vs S2 13 Sep | about 5 hours | 7,946.03 km² (1,963,507 ac) | L-only | 0.826 | 0.895 | 0.859 | 0.753 |
| | | | S-only | 0.911 | 0.872 | 0.891 | 0.803 |
| | | | L+S | 0.900 | 0.881 | 0.891 | 0.803 |
| Water, 31 Aug vs S2 29 Aug | about 2.8 days | 3,580.03 km² (884,645 ac) | L-only | 0.730 | 0.902 | 0.807 | 0.677 |
| | | | S-only | 0.885 | 0.864 | 0.874 | 0.777 |
| | | | L+S | 0.801 | 0.869 | 0.834 | 0.715 |
| New water, 31 Aug to 12 Sep | S2 29 Aug and 13 Sep | 952.55 km² (235,380 ac) | L-only | 0.692 | 0.464 | 0.555 | 0.384 |
| | | | S-only | 0.714 | 0.600 | 0.652 | 0.484 |
| | | | L+S | 0.734 | 0.562 | 0.637 | 0.467 |
| Water, 18 Oct vs S2 18 Oct | about 19 hours | 21,681.57 km² (5,357,633 ac) | L-only | 0.636 | 0.894 | 0.744 | 0.592 |

## Confusion matrices at NDWI ≥ 0

Counts are 80 m pixels (1 pixel = 0.0064 km², 1.58 acres). Water is the positive class.
Overall accuracy is high everywhere because most scored pixels are dry land, so F1 and IoU
are the more useful scores.

| Test | Method | Water, both agree | NISAR water, S2 not | S2 water, NISAR not | Non-water, both agree | Overall accuracy |
|---|---|---:|---:|---:|---:|---:|
| Water, 12 Sep | L-only | 132,950 | 27,992 | 15,537 | 1,065,088 | 0.965 |
|  | S-only | 129,411 | 12,647 | 19,076 | 1,080,433 | 0.974 |
|  | L+S | 130,872 | 14,509 | 17,615 | 1,078,571 | 0.974 |
| Water, 31 Aug | L-only | 95,629 | 35,309 | 10,394 | 418,048 | 0.918 |
|  | S-only | 91,594 | 11,883 | 14,429 | 441,474 | 0.953 |
|  | L+S | 92,154 | 22,873 | 13,869 | 430,484 | 0.934 |
| New water | L-only | 9,307 | 4,150 | 10,761 | 124,618 | 0.900 |
|  | S-only | 12,040 | 4,815 | 8,028 | 123,953 | 0.914 |
|  | L+S | 11,286 | 4,088 | 8,782 | 124,680 | 0.913 |
| Water, 18 Oct | L-only | 119,836 | 68,510 | 14,150 | 3,185,249 | 0.976 |

## What this shows

- L+S improves on L-only in all three three-way tests.
- L+S does not beat S-only. It ties on 12 Sep and is lower on 31 Aug and on new water.
- L+S has the highest precision for new water (0.734), and S-only has the higher recall.
- L-band over-maps water relative to the optical labels (lower precision), which is
  consistent with radar-dark non-water surfaces. The labels cannot confirm the surface type.

## Limits of this validation

- Only about 14% of the footprint is scored on 12 Sep, 6% on 31 Aug and 2% for change,
  because of monsoon cloud. Clear pixels may not represent the cloudy ones.
- Optical labels cannot see water under vegetation. Any true sub-canopy water scores as a
  false positive, which works against L-band and the canopy rule.
- Scores depend strongly on the NDWI threshold because much of the water has low NDWI.
  At NDWI ≥ 0.3 almost no water remains and the test is uninformative.
- Cloud masks can miss thin cloud and haze. No field or expert-labelled data was used.
- Pixels are spatially correlated, so no confidence intervals are claimed.

## Rule behaviour

From `results/LS_fused_aug31_sep12/fusion_diagnostics.json`. These are pixel counts, not accuracy.

| Fused gain source | Area |
|---|---:|
| Both bands | 743.45 km² (183,710 ac) |
| L-band only | 132.21 km² (32,670 ac) |
| S-band only | 237.95 km² (58,799 ac) |
| Canopy rule only | 223.53 km² (55,236 ac) |

| Run | Stable water | New water |
|---|---:|---:|
| All rules | 2,652.29 km² (655,395 ac) | 1,337.15 km² (330,417 ac) |
| Without sandbar rule | 2,684.26 km² (663,296 ac) | 1,322.69 km² (326,845 ac) |
| Without wind rule | 2,381.78 km² (588,551 ac) | 1,386.80 km² (342,685 ac) |
| Without canopy rule | 2,652.29 km² (655,395 ac) | 1,113.61 km² (275,180 ac) |
| Without S-band filter | 2,652.29 km² (655,395 ac) | 1,675.85 km² (414,111 ac) |
| Plain union of L and S | 2,390.63 km² (590,738 ac) | 1,453.47 km² (359,159 ac) |

- Moving the S-band gate by ±1 dB changes fused new water from 1,208.44 km² (298,611 ac)
  to 1,449.29 km² (358,128 ac). This hand-set threshold is the main fusion sensitivity.
- Moving the L-band sandbar threshold by ±1 dB changes new water by under 2 km² (about 400 ac).

### What the recorded rule diagnostics mean

| Recorded value | Meaning |
|---|---|
| 347.76 km² (85,933 ac) | L-band water or gain pixels that meet the sandbar test. Removing the rule changes stable water by only 31.97 km² (7,900 ac). |
| 625.95 km² (154,676 ac) | Pixels meeting the canopy rule outside S-band gain, before later filters. Its real fused contribution is 223.53 km² (55,236 ac). |
| 132.42 km² (32,722 ac) | Stable-water pixels with HH ≥ −15 dB and HV < −21.5 dB. A diagnostic: these pixels are not added by the wind rule, which adds 270.51 km² (66,844 ac). |

"Sandbar", "canopy" and "wind" name each rule's intent. The canopy rule needs HH to fall, which
is not the brightening expected from double-bounce, and no independent data tests it.

### Polarization feature sets against Sentinel-2

`scripts/score_polarization_features.py`, results in `results/validation/polarization_feature_scores.json`.
L-band, 12 Sep, the same 7,946.03 km² (1,963,507 acres) scored as above. Thresholds come from
the fusion script and were not tuned against this reference.

| Feature set | Precision | Recall | F1 |
|---|---:|---:|---:|
| HH < −14.0 dB (co-pol baseline) | 0.822 | 0.875 | 0.848 |
| HH < −13.0 dB and HV < −21.5 dB | 0.816 | 0.854 | 0.835 |
| HHHH + 2·HVHV < −13.5 dB (span) | 0.877 | 0.832 | 0.854 |

Adding an HV test did not help here. The span was slightly better than HH alone, through
higher precision.

### Sentinel-2 check of the sandbar rule

`scripts/check_sand_rule.py` compares cloud-free pixels on each date, using the same thresholds
as the rule. Results are in `results/validation/sand_rule_check.json`.

| Group | Date (Sentinel-2) | Scored area | NDWI water | SCL water | SCL bare | SCL vegetation |
|---|---|---:|---:|---:|---:|---:|
| L dark, S bright (rule) | 31 Aug (29 Aug) | 74.38 km² (18,380 ac) | 9.2% | 25.0% | 56.8% | 16.5% |
| L dark, S dark (control) | 31 Aug (29 Aug) | 858.74 km² (212,199 ac) | 70.3% | 63.6% | 28.3% | 3.9% |
| L dark, S bright (rule) | 12 Sep (13 Sep) | 107.60 km² (26,589 ac) | 8.7% | 9.9% | 18.7% | 63.2% |
| L dark, S dark (control) | 12 Sep (13 Sep) | 1,063.51 km² (262,798 ac) | 80.3% | 79.1% | 6.7% | 8.6% |

Where L is dark, S-band brightness separates mostly non-water pixels from mostly water pixels. The
rule therefore rejects mainly non-water pixels. "Sand" is only partly right: bare ground leads on
31 Aug, but vegetation leads on 12 Sep. SCL is a coarse automatic label and these are small,
cloud-free samples, so the surface type remains unconfirmed.

## Area reconciliation

| Result | New water | Water loss | Why it differs |
|---|---:|---:|---|
| L standalone, 31 Aug to 12 Sep | 1,166.21 km² (288,177 ac) | 889.96 km² (219,914 ac) | Full L-band footprint, erosion 40 |
| L on common support | 1,137.14 km² (280,993 ac) | 888.84 km² (219,637 ac) | L/S common support. Use this for three-way comparison |
| L, erosion 3 | 1,173.56 km² (289,993 ac) | 943.25 km² (233,082 ac) | Default edge erosion |

The packaged Sep 12 to Oct 18 result (2,650.27 km², 654,895 acres lost) used 3-pixel erosion,
while the Aug 31 to Sep 12 results used 40. At 40 pixels, loss is 2,551.94 km² (630,597 acres)
and gain 239.60 km² (59,207 acres), both in `results/L_sep12_oct18/`.
Compare across periods with the 40-pixel values.

The 59,083.56 km² (14,599,867 acres) "valid" area counts pixels valid in all four observations
with a rectangular 40-pixel border removed. It includes 3,874.70 km² (957,459 acres) of swath-edge
ring, which is outside the eroded footprint and mostly class 0, so the stable non-water area and
class percentages are affected by that ring. New-water and stable-water totals include 90.04 km²
(22,249 acres) of classified fused pixels outside the footprint used for validation.
