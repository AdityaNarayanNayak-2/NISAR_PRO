# RHEL NISAR output inventory

Inventory supplied from the RHEL workstation after the final processing runs.
The source granules and processor hash are recorded in
`rhel_provenance_final.txt`.

## Available products

| Product | Path | Role |
| --- | --- | --- |
| L-band live rerun | `sar-gateway/results/jobs/sar-8b6af0bc/sar-8b6af0bc_flood.json` | L-only Aug 31 → Sep 12 |
| L-band live raster | `sar-gateway/results/jobs/sar-8b6af0bc/sar-8b6af0bc_flood_class.tif` | georeferenced class raster |
| L-band standalone | `results/flood_expansion_aug31_sep12/sar-bihar-aug31-sep12-full_flood.json` | packaged L-only run |
| S-band standalone | `results/sband_flood_aug31_sep12/sar-bihar-sband-aug31-sep12-full_flood.json` | packaged S-only run |
| L+S comparison | `sar-bihar-ls-fused-aug31-sep12_flood.json` | common-support fusion and Task H |
| L-band recession | `results/flood_recession_sep12_oct18/sar-bihar-sep12-oct18-recession_flood.json` | Sep 12 → Oct 18 |

The RHEL job contains the expected PNG previews, GeoJSON, JSON report,
classification GeoTIFF, and crash journal. No S-band or fused classification
GeoTIFF was reported in the gateway results directory; their packaged JSON
and GeoJSON artifacts are available for the comparison narrative.

## Product metadata

- L-band: LSAR, HH, EPSG:32645, 80 m grid, Track 098 / Frame 014 / product
  identifier 4005.
- S-band: SSAR, HH, EPSG:32645, 80 m grid, Track 098 / Frame 014 / product
  identifier 3700.
- L active: 12 Sep 2026; L/S baseline: 31 Aug 2026.
- Recession active: 18 Oct 2026; recession baseline: 12 Sep 2026.
- Full-scene outputs report rotated-swath valid coverage between 49.6% and
  52.8% of the bounding grid.
