# Evidence register and submission blockers

This register separates what is present in the repository from what still needs verification before submission.

## Verified in repository

- L2 GCOV L-band full-scene result for 31 Aug → 12 Sep.
- L2 GCOV S-band full-scene result for 31 Aug → 12 Sep.
- L-band recession result for 12 Sep → 18 Oct.
- GeoTIFF, PNG, GeoJSON, and JSON outputs for the showcase runs.
- EPSG:32645, 80 m output grid, native dimensions, selected product IDs, thresholds, and flood-region counts in JSON metadata.
- A documented Rust streaming implementation and a benchmark harness.
- A comparison JSON containing L-only, S-only, L+S, overlap-grid, physical-gate, and Task H fields.
- RHEL provenance for job `sar-8b6af0bc`, including processor, source-granule,
  and classification GeoTIFF SHA-256 values, stored at
  `results/rhel_provenance_final.txt`.

## Live RHEL gateway observation (read-only, 2026-10-31)

The Tailscale gateway at `100.124.16.11:3000` responded successfully to `/jobs/health-ping`. Its current completed job `sar-8b6af0bc` is an L-band Aug 31 → Sep 12 full-scene run and reports:

- `1,173.5552 km²` total water gain (`289,991.84 acres`)
- `943.2512 km²` receded water
- `1,745` connected regions
- Otsu threshold `−3.255119 dB`
- `52.8%` valid swath coverage
- Product IDs matching the LSAR Track 098 / Frame 014 pair in the package

This is evidence of the current RHEL output, not yet the canonical submission result. The gateway binary commit, command line, binary hash, and granule hashes still need to be captured on RHEL.

The binary and granule hashes are now captured. The exact gateway command line
and independent validation metrics remain open.

## Must reconcile

1. **Canonical L-band numbers:** the packaged standalone report records 1,166.21 km², the fusion comparison artifact records 1,137.14 km², and the current RHEL gateway job records 1,173.5552 km². Record the exact binary commit, flags, erosion setting, and source files for each before selecting the canonical table; then regenerate the comparison if necessary.
2. **Runtime claim:** the project materials mention 43 s, 42 s, and 63 s in different places. Publish one number per configuration with hardware, command, cold/warm status, and peak RSS.
3. **Track/frame wording:** use the identifiers from the actual granule metadata. The repository filenames indicate relative track 098, frame 014, with product/frame identifiers 4005 for L and 3700 for S.
4. **Fusion method:** document the exact pixel-level rule, alignment offsets, nodata intersection, and whether the reported gate areas are mutually exclusive.

## Submission blockers

- Independent dated reference labels and a reproducible confusion-matrix script.
- Controlled ablation: L-only, S-only, L+S without gates, and L+S with each gate enabled separately.
- A full-scene coverage map and a statement explaining valid-swath percentage versus the bounding grid.
- A clean Colab run of the notebook from a fresh runtime with no repository-local assumptions.
- A final README with exact dependencies, input paths, commands, output schema, and licence/data citations.

## Claims to avoid until resolved

- “Zero-OOM guarantee” — say “observed peak memory under the documented benchmark conditions.”
- “100% false alarms eliminated” — use the measured gate output and define the reference used to call a pixel a false positive.
- “Improved accuracy” — use “different/complementary result” until independent labels show improvement.
- “Flood caused by rainfall” — use “newly detected water” unless independent hydrometeorological evidence supports attribution.

## High-value bonus experiments

- Bootstrap confidence intervals for area and accuracy metrics.
- Threshold sensitivity curves for water threshold, Otsu cap, seed, growth, erosion, and minimum component size.
- Stratified validation by open water, agriculture, vegetation, sandbar, and urban/rough land.
- Cross-date and cross-band co-registration residual map, not only a single global offset.
- A compact provenance manifest containing git commit, binary hash, granule checksums, command line, and machine telemetry.
