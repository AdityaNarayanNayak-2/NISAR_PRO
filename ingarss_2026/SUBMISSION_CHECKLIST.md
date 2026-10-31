# InGARSS 2026 submission checklist

## Required deliverables

- [ ] Technical presentation exported as PDF, 6–8 slides.
- [ ] `presentation.html` opened and visually checked before PDF export.
- [ ] Technical note exported as PDF, approximately 2–4 pages.
- [ ] Clean `.ipynb` notebook that runs from a fresh hosted Colab runtime.
- [ ] README with dependencies, commands, input/output structure, assumptions, limitations, and citations.
- [ ] L-only, S-only, and L+S result tables with dates, CRS, resolution, valid support, and source granules.
- [ ] Water masks, change map, newly detected water map, and area statistics in km² and acres.
- [ ] Polarization/channel inventory and comparison against a stated baseline.
- [ ] Provenance manifest containing commit, binary hash, granule hashes, output hashes, and runtime information.

## Scientific gates

- [ ] L-band totals reconciled between standalone and fusion artifacts.
- [ ] Runtime and memory claims use one documented benchmark protocol.
- [ ] Fusion rule is written as a pixel-level equation or pseudocode.
- [ ] L-only, S-only, L+S-without-gates, and L+S-with-gates comparisons are available.
- [ ] Independent dated reference labels are identified, or the absence is explicitly reported.
- [ ] Confusion matrix and metrics are generated only from independent reference labels.
- [ ] Valid-swath percentage is distinguished from the full bounding-grid area.
- [ ] Every map has date(s), legend, CRS, resolution, and data source.
- [ ] No claim attributes cause to rainfall/flooding without independent evidence.

## Reproducibility rehearsal

Run from a fresh checkout on RHEL:

```bash
git checkout dev
git pull --ff-only origin dev
python3 ingarss_2026/scripts/build_provenance_manifest.py \
  --repository . \
  --package ingarss_2026 \
  --output ingarss_2026/provenance_manifest.json
```

Then open the notebook in a fresh Colab runtime, run all cells, and verify that the headline values match the published tables. Keep the manifest with the final package. Do not include multi-gigabyte source granules unless the official submission form explicitly requests them.
