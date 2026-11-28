# Check against NASA OPERA DSWx-S1 (water on 12 Sep 2026)

Compares NISAR Pro water maps for 12 Sep 2026 (Bihar, NISAR track 98 / frame 14) with NASA's own
Sentinel-1 water product, OPERA DSWx-S1, from the Sentinel-1D pass of 12 Sep 2026 00:11 UTC.
Then splits the result by terrain and land cover, and uses Sentinel-2 as a third opinion where the two disagree.

These are **agreement** scores against another model product, not accuracy. Nothing here is checked on the ground.

## Run it

Data goes to `$DSWX_DIR` (default `~/Desktop/nisar_data/dswx_s1`), not into git.

```bash
# 1. NASA DSWx-S1 tiles (asks for your Earthdata login, hidden, not saved)
bash scripts/dswx_check/get_dswx.sh

# 2. Our Sentinel-1 run on the same pass (inputs from scripts/fetch_sentinel1.py)
D=~/Desktop/nisar_data/sentinel1
sar_science_processor/target/release/sar_science_processor --mode flood --crop-preset full --radar-band c --polarization VV \
  --swath-edge-erosion 40 --output ~/Desktop/nisar_data/dswx_s1/s1run/s1 \
  --input  $D/S1D_IW_GRDH_1SDV_20260912T001128_20260912T001153_004537_008704_rtc_VV.tif \
  --slave  $D/S1D_IW_GRDH_1SDV_20260831T001127_20260831T001152_004362_0080EC_rtc_VV.tif

# 3. Scores (NISAR maps come from the gateway reference runs run-8fc6be56 (L) and run-cbdd2efd (S))
python3 scripts/dswx_check/compare_dswx.py    # -> dswx_s1_agreement.json
python3 scripts/dswx_check/context_split.py   # -> context_split.json / .md (HAND, slope, land cover, distance to water)
python3 scripts/dswx_check/tiebreak_s2.py     # -> tiebreak_s2.json (Sentinel-2 13 Sep, package method)
```

Needs `numpy`, `scipy`, `rasterio`, `requests`. Context layers are public, no login: ASF GLO-30 HAND,
Copernicus GLO-30 DEM, ESA WorldCover 2021 (read at reduced resolution and cached).

## Result (run on 2026-11-26)

All three maps scored on the same 35,326.32 km² (8,729,324 acres): valid in DSWx-S1, inside the
Sentinel-1 footprint and inside the common NISAR L/S support. Open water only.

| Map | F1 | IoU | Precision | Recall |
|---|---|---|---|---|
| Sentinel-1 VV (same engine) | 0.815 | 0.687 | 0.731 | 0.921 |
| NISAR S-band HH | 0.809 | 0.679 | 0.731 | 0.905 |
| NISAR L-band HH | 0.739 | 0.586 | 0.623 | 0.908 |

- We find almost all of DSWx's water (recall 0.91–0.92) and map more water than it
  (L-band 3,926.31 km² / 970,213 acres against DSWx 2,692.47 km² / 665,325 acres).
- 87–91% of that extra water lies 0–2 m above the nearest drainage (HAND) and 80% is cropland.
  Dropping our water where HAND ≥ 5 m changes F1 very little (L-band 0.739 → 0.744).
- **Sentinel-2 tie-break** (13 Sep 04:47 UTC, NDWI > 0, cloud-free pixels only, 6,393.68 km² / 1,579,912 acres):
  Sentinel-2 also sees water in 63% (Sentinel-1), 64% (S-band) and 47% (L-band) of the water only our map found.
  F1 against Sentinel-2 on those pixels: ours 0.904 (Sentinel-1), 0.894 (S-band), 0.866 (L-band); DSWx-S1 0.876–0.878.

Reading: S-band and Sentinel-1 extra water is mostly real open water that DSWx-S1 leaves out; L-band
over-detects in low-lying cropland and grassland. The next method change should target that L-band case,
not a HAND mask.

Times matter: DSWx-S1 and our Sentinel-1 map use the same pass (00:11 UTC), NISAR passed about 23.5 h later
(23:38 UTC), Sentinel-2 about 28.6 h after Sentinel-1. Optical NDWI cannot see water under crops or trees.

## What we changed because of it: method v2 (L-band, opt-in)

The L-band extra water that Sentinel-2 calls dry is brighter on the later date than real water
(12 Sep HH median −14.1 dB, against −16.9 dB where we and DSWx-S1 agree). Capping it:

| L-band, 31 Aug → 12 Sep | Water 12 Sep vs Sentinel-2 | Water 12 Sep vs DSWx-S1 | Flood extent vs Sentinel-2 change |
|---|---|---|---|
| v1 (published method) | 0.859 | 0.739 | 0.555 |
| Cap on all later-date water, −14 dB (rejected) | 0.864 | 0.790 | 0.466 |
| **v2: cap on stable water only, −14 dB** | **0.872** | **0.761** | **0.555** (extent unchanged, 1,166.21 km² / 288,178 acres) |

Out of sample (rule found on 12 Sep), L-band 12 Sep → 18 Oct, water on 18 Oct vs Sentinel-2 18 Oct
(22,164.35 km² scored): v1 0.749 → v2 0.782. Capping new water too lowered flood-extent agreement, so v2
leaves the flood mask exactly as v1. v1 stays the default and its class GeoTIFF is byte-identical.
Engine: `--method v2` (`flood_detect.rs`, test `test_method_v2_drops_bright_stable_water_only`).
