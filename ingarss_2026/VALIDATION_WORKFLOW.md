# Independent validation workflow

The submission must not report accuracy numbers unless they are computed against an independent, dated reference. This workflow accepts any authoritative or manually labelled water raster that covers the selected NISAR scene.

## Reference requirements

Record the reference provider, acquisition date, product name, CRS, spatial resolution, water-label definition, nodata rule, and licence. The reference date should be as close as possible to the NISAR observation being evaluated. If the reference is manually labelled, preserve the original source image and label file.

## Run the scorer

Install the scientific dependencies in the validation environment:

```bash
python3 -m pip install numpy rasterio
```

Then score each mask on the prediction grid:

```bash
python3 ingarss_2026/scripts/validate_water_mask.py \
  --prediction ingarss_2026/results/flood_expansion_aug31_sep12/<mask>.tif \
  --reference /path/to/dated_reference_water.tif \
  --output ingarss_2026/results/validation/l_band_metrics.json
```

Repeat for S-only and L+S. Use the same reference, valid footprint, and sampling design. For current-water validation, classes 1–4 are positive by default; class 5 represents receded water and should be evaluated separately as a change class.

## Reproducible optical reference option

For the 18 Oct 2026 recession epoch, the package includes a generator for an independent Sentinel-2 L2A reference over the official 20 km × 20 km discovery box. The selected public STAC item is `S2C_MSIL2A_20261018T044811_R076_T45RVJ_20261018T074216` with 12.38% scene cloud cover. The generator uses B03/B08 NDWI and masks Sentinel scene-classification cloud/shadow classes; its output is still a reference aid, not ground truth.

```bash
python3 -m pip install requests rasterio numpy
python3 ingarss_2026/scripts/build_sentinel2_reference.py \
  --output ingarss_2026/results/validation/sentinel2_20261018_reference.tif

python3 ingarss_2026/scripts/validate_water_mask.py \
  --prediction /path/to/recession_classification.tif \
  --reference ingarss_2026/results/validation/sentinel2_20261018_reference.tif \
  --output ingarss_2026/results/validation/recession_metrics.json
```

Report the Sentinel acquisition date, cloud cover, NDWI threshold, excluded SCL classes, valid pixels, and limitations next to the metrics. The Planetary Computer STAC API is publicly searchable; the reference generator records the item metadata in a sidecar JSON.

## Required reporting table

| Method | Reference date | Evaluated pixels | Precision | Recall | F1 | IoU | Notes |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| L-only | to fill | to fill | to fill | to fill | to fill | to fill | same support |
| S-only | to fill | to fill | to fill | to fill | to fill | to fill | same support |
| L+S | to fill | to fill | to fill | to fill | to fill | to fill | gate configuration recorded |

Do not fill this table with the comparison JSON's internal agreement values. Those are algorithm-to-algorithm or overlap statistics, not independent validation metrics.
