# InGARSS 2026 — 9-day execution plan

## Objective

Submit a defensible, reproducible comparison of NISAR L-band, S-band, and L+S surface-water change mapping over the Bihar Ganga plain. The target is not to claim the most complicated algorithm. The target is to make every important claim traceable to a granule, command, output, and validation sample.

## Freeze immediately

- Freeze dashboard redesign and new product features.
- Freeze the processor algorithm unless a reproducible correctness bug is found.
- Use `ingarss_2026/sar-bihar-ls-fused-aug31-sep12_flood.json` as the current comparison artifact, pending reconciliation.
- Do not claim improved accuracy, 100% false-alarm removal, or zero-OOM guarantees without independent evidence.

## Day 1 — Establish the canonical run

Owner: Aditya on RHEL, with Codex interpreting the output.

Capture for every L, S, and L+S run:

- git commit and binary SHA-256
- exact command line
- input granule filenames and SHA-256
- dates, relative track, frame/product identifiers, polarization, CRS, spacing
- runtime, peak RSS, valid pixels, output paths

Resolve the current L-band discrepancy (`1,166.21 km²` versus `1,137.14 km²`) before editing the final note.

## Day 2 — Make the notebook judge-proof

- Hosted Colab default: load only packaged JSON/PNG/GeoJSON artifacts.
- Local-runtime option: read HDF5 from the RHEL workstation.
- Remove repository-working-directory assumptions.
- Run every cell from a fresh Colab runtime and save a clean executed copy.
- Add one visible “data provenance and limitations” cell.

## Day 3 — Validation dataset

Create independent dated reference samples for open water, agriculture, vegetation, sandbar, and non-water. Use the same 80 m support and document source date, CRS, resolution, sampling rule, and label uncertainty. If a suitable reference cannot be obtained, report a transparent qualitative assessment rather than invented metrics.

## Day 4 — Metrics and ablations

Run the same samples through:

1. L-only
2. S-only
3. L+S without physical gates
4. L+S with sandbar gate
5. L+S with canopy/cross-pol gate
6. L+S with all gates

Produce confusion matrices, precision, recall, F1, IoU, area error, and bootstrap confidence intervals where labels support them. Make the comparison fair: same valid support, dates, masks, and samples.

## Day 5 — Technical note and figures

- Replace provisional numbers with canonical run numbers.
- Add one method diagram, one L/S/fused comparison figure, one lifecycle figure, one validation table, and one uncertainty paragraph.
- Ensure every map includes dates, legend, CRS, resolution, and source.

## Day 6 — Presentation

Build the eight-slide deck from `ingarss_2026/PRESENTATION_OUTLINE.md`. The narrative is:

`1.157B-pixel problem → streaming solution → physical signal → L/S comparison → fusion test → lifecycle → validation → restrained conclusion.`

## Day 7 — Reproducibility rehearsal

- Fresh Colab runtime.
- Fresh RHEL checkout.
- Run the documented commands without hidden files or cached state.
- Compare generated JSON schema and key totals against the canonical manifest.
- Confirm all downloads and links work.

## Day 8 — Scientific and communication review

Ask one technically literate reviewer to challenge:

- whether “full scene” is being confused with “valid swath”;
- whether L/S differences are caused by dates, geometry, resolution, or the algorithm;
- whether the fusion rule is explicitly defined;
- whether the validation is independent;
- whether any statement attributes cause rather than observed change.

## Day 9 — Submission lock

- Export final PDF technical note.
- Export final slide deck and PDF backup.
- Zip notebook, README, scripts, manifests, figures, and small result artifacts.
- Keep large HDF5 granules outside the submission archive unless the official form requires them.
- Run a final checksum and open every deliverable from a clean directory.

## Immediate command for the RHEL workstation

Run this first and send the complete output:

```bash
cd ~/Desktop/sar_analyzer
git rev-parse HEAD
sha256sum sar_science_processor/target/release/sar_science_processor
find ingarss_2026/results -type f -name '*.json' -print | sort
```

Then we will select one canonical binary and regenerate the comparison if the L-band totals do not match.

## Definition of done

The project is submission-ready only when a judge can open the notebook, reproduce the published tables from packaged artifacts, understand exactly what L/S/fusion means, see the limitation of the validation, and trace every headline number to a file and command.
