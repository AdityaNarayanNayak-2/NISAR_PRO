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

## Required reporting table

| Method | Reference date | Evaluated pixels | Precision | Recall | F1 | IoU | Notes |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| L-only | to fill | to fill | to fill | to fill | to fill | to fill | same support |
| S-only | to fill | to fill | to fill | to fill | to fill | to fill | same support |
| L+S | to fill | to fill | to fill | to fill | to fill | to fill | gate configuration recorded |

Do not fill this table with the comparison JSON's internal agreement values. Those are algorithm-to-algorithm or overlap statistics, not independent validation metrics.

