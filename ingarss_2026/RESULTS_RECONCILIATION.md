# NISAR result reconciliation

This register keeps the existing NISAR runs separate until their provenance
and processing parameters are identical. Values are mapped transition areas,
not accuracy scores.

## Aug 31 → Sep 12 full-scene comparison

| Source | Band/method | Gain (km²) | Receded (km²) | Valid coverage | Regions | Status |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| `results/flood_expansion_aug31_sep12/...json` | L-only standalone | 1,166.2144 | 889.9648 | 49.6% | 1,725 | packaged artifact |
| `sar-bihar-ls-fused-aug31-sep12_flood.json` | L-only comparison branch | 1,137.14 | 888.84 | 59,083.56 km² support | — | comparison artifact |
| `sar-bihar-ls-fused-aug31-sep12_flood.json` | S-only | 1,174.89 | 214.98 | 59,083.56 km² support | — | comparison artifact |
| `sar-bihar-ls-fused-aug31-sep12_flood.json` | L+S fused | 1,337.15 | 723.37 | 59,083.56 km² support | — | comparison artifact |
| RHEL job `sar-8b6af0bc` | L-only live rerun | 1,173.5552 | 943.2512 | 52.8% | 1,745 | provenance captured |

Acres are obtained with the product's recorded conversion factor:
`1 pixel = 0.0064 km² = 1.58147 acres`.

## Why these are not yet one canonical table

The three L-band values cannot be treated as interchangeable. The records may
differ in output support, edge erosion, binary revision, result directory,
or comparison code path. The RHEL provenance currently proves the binary and
granule hashes, but not the exact gateway command line. Until the command and
all parameters are captured, the report must label the values by source rather
than silently selecting the largest or newest number.

## Required final reconciliation

1. Capture the exact command line for the RHEL job.
2. Confirm the same valid-support mask, edge erosion, threshold settings, and
   pixel area for L-only, S-only, and L+S.
3. Re-run or regenerate the comparison artifact from those exact outputs.
4. Select one canonical table and update the notebook, technical note, and
   presentation together.

The current RHEL job is the strongest provenance-backed L-band result. It is
not automatically the canonical comparison result until steps 1–3 are done.
