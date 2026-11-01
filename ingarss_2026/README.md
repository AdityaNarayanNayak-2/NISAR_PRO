# NISAR Pro — InGARSS 2026 Phase 1 package

This directory contains the reproducible analysis package for dynamic
surface-water mapping over the Bihar Ganga alluvial plain using NISAR L2 GCOV.
The central comparison is L-band only, S-band only, and a documented L+S
overlap-lattice experiment. The 20 km × 20 km box is used for discovery and
orientation; the supplied NISAR products are analysed over the selected scene
footprint.

## Package contents

```text
notebooks/NISAR_Bihar_Flood_Lifecycle.ipynb  Colab-ready showcase notebook
notebook_cells/                               Notebook source cells
results/flood_expansion_aug31_sep12/          L-band Aug 31 → Sep 12 outputs
results/flood_recession_sep12_oct18/          L-band Sep 12 → Oct 18 outputs
results/sband_flood_aug31_sep12/              S-band comparison outputs
sar-bihar-ls-fused-aug31-sep12_flood.json     L/S/L+S comparison artifact
scripts/                                      Validation and provenance tools
TECHNICAL_NOTE.md                             Draft technical note
presentation.html                             Eight-slide technical presentation
```

## What is currently demonstrated

- Full-scene L-band processing on an 80 m grid from NISAR L2 GCOV.
- A date-to-date change map with stable land, persistent water, water gain,
  and water-loss classes.
- Separate L-band and S-band results plus an L+S comparison on a common
  overlap lattice.
- Streaming hyperslab ingestion and block averaging in the Rust processor.
- A four-epoch narrative: 26 Jul, 31 Aug, 12 Sep, and 18 Oct 2026.
- Explicit limitations for swath-edge nodata, temporal mismatch, vegetation,
  wind-roughened water, sandbars, and unavailable independent labels.

The packaged standalone L-band expansion artifact reports **1,166.21 km²** of
water gain and **889.96 km²** of receded water over **49.6% valid swath
coverage**. A live RHEL rerun currently reports a different total, so the
canonical value is intentionally marked pending until the exact processor,
granule, and parameter provenance is captured. Do not present internal L/S
agreement values as accuracy scores.

## Run the notebook

### Hosted Google Colab — judge-safe mode

Open `notebooks/NISAR_Bihar_Flood_Lifecycle.ipynb` in Colab and run all cells.
The bootstrap cell clones the repository and loads the packaged JSON/PNG
artifacts. It does not require multi-gigabyte HDF5 files.

See [COLAB_GUIDE.md](COLAB_GUIDE.md) for hosted and local-runtime modes.

### Full-scene local run

The full-scene Rust run requires the original NISAR `.h5` granules and the
RHEL build environment. Do not attempt it in a standard hosted Colab runtime
unless the granules are deliberately mounted and enough storage and memory
are available. Use the gateway/processor runbook in the parent repository and
record the exact command and output paths.

## Validation status

`VALIDATION_WORKFLOW.md` defines the independent-reference procedure and
`scripts/validate_water_mask.py` computes confusion-matrix metrics without
inventing scores. `scripts/build_sentinel2_reference.py` can generate a dated
Sentinel-2 NDWI reference aid for the 18 Oct recession epoch. The package is
not submission-complete until those metrics, or an explicit documented
unavailability statement, are included alongside the final provenance.

## Reproducibility

Before final packaging on RHEL, run
`scripts/capture_rhel_provenance.sh` to record the Git commit, processor hash,
input-granule hashes, output hashes, and runtime. Then copy the small text
manifest into `results/rhel_provenance_final.txt`. Source HDF5 granules are
intentionally excluded from the submission archive unless organisers request
them.
