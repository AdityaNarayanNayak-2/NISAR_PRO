# InGARSS 2026 Phase 1 — 8-slide technical presentation outline

## Slide 1 — The question

**Title:** Dynamic and Seasonal Surface-Water Mapping over the Bihar Ganga Plain using NISAR L2 GCOV

Show the Bihar reference box, the full selected scene footprint, and one sentence: “Does L+S improve water-change mapping over L-only and S-only?” Mention that the 20 km × 20 km box is for discovery, not processing extent.

## Slide 2 — Why the scene is hard

Show native dimensions (33,696 × 34,344, approximately 1.157B pixels/date), mixed floodplain surfaces, and the four observation dates. Explain why a small-AOI demo is insufficient for the challenge.

## Slide 3 — Streaming engine and physical signal

Show HDF5 row-strip ingestion → 8×8 multilook → dB conversion → water masking → log-ratio → Otsu → hysteresis growth → exports. Explain specular water darkening, wavelength differences, and the −40 dB valid-power floor. Use a benchmark only with its hardware and measurement method.

## Slide 4 — Single-frequency baselines

Side-by-side L and S maps for Aug 31 → Sep 12. Table: L gain 1,137.14 km²; S gain 1,174.89 km²; include permanent water, receded water, dates, CRS, and coverage. State that different sensor responses and footprints are controlled as far as available data permit.

## Slide 5 — L+S comparison and physical gates

Show the 3-panel comparison and the common-overlap lattice. Report fused gain 1,337.15 km² and the recorded gates: sandbar rejection, canopy recovery, and wind-riffle recovery. Label these as outputs of the current decision rule, not accuracy improvements until validation is complete.

## Slide 6 — Four-epoch lifecycle

Show 26 Jul → 31 Aug → 12 Sep → 18 Oct. Split the story into expansion and recession. Identify persistent channel water separately from seasonal water. Include the L-band recession output of 2,650.27 km² as a clearly labelled transition result.

## Slide 7 — Validation and uncertainty

Show the planned sampling design and a blank/placeholder confusion-matrix layout labelled “to be populated from independent dated reference labels.” List temporal mismatch, vegetation, sandbars, wind, mixed pixels, and swath edges. Never show invented accuracy numbers.

## Slide 8 — Conclusions and next experiment

Three conclusions: streaming makes full-scene processing practical; L and S produce complementary transition maps; fusion is promising but must be judged with independent labels and gate ablations. End with the exact next experiment: same samples, same support, L-only vs S-only vs L+S, with confidence intervals.

