# Validation status and limitation

**Status: QUALITATIVE_ONLY — no external accuracy score is claimed.**

The repository contains complete NISAR L-band, S-band, and L+S comparison
artifacts. It does not contain independent dated water labels covering the
same full-scene support for all three methods. The S-band and L+S results are
available as JSON/GeoJSON comparison products, but no corresponding
georeferenced classification GeoTIFFs were supplied for a common independent
scoring run.

## Evidence that was checked

- L-band, S-band, and L+S product IDs, dates, CRS, 80 m spacing, and method
  parameters are recorded in the result JSON files.
- L+S comparison uses one documented 4,140 × 4,275 common lattice and
  59,083.56 km² support for the three-way area table.
- The live RHEL L-band GeoTIFF is georeferenced and its SHA-256 is recorded in
  `results/rhel_provenance_final.txt`.
- Class-area totals, pixel-area conversion, valid-swath warnings, and source
  granules are traceable to the supplied JSON artifacts.

These are reproducibility and internal-consistency checks, not independent
classification accuracy measurements.

## Claims deliberately not made

The submission does not claim precision, recall, F1, IoU, overall accuracy,
or that L+S is more accurate than either single-frequency baseline. The
reported L/S/L+S values are mapped transition areas and physically motivated
decision-gate outputs.

## Quantitative validation path

If dated independent labels become available, create one georeferenced class
GeoTIFF for each method on comparable support and run
`scripts/validate_water_mask.py` with the same reference, nodata rule, and
sampling design. The output metrics must then replace this qualitative status
before making accuracy claims.
