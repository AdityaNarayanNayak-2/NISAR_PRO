# Polarization assessment

Required by the problem statement (section 5.1 and Task H). Numbers come from
`results/LS_fused_aug31_sep12/` and `results/validation/polarization_feature_scores.json`.

## 1. Which channels we had

Read from each granule at `science/<LSAR or SSAR>/GCOV/grids/frequencyA`.

| Band | Mode | Dates (2026) | Channels | Layers in the file |
|---|---|---|---|---|
| L-band | DHDH | 26 Jul, 31 Aug, 12 Sep, 18 Oct | HH, HV | HHHH, HVHV |
| S-band | DHNA | 31 Aug, 12 Sep | HH, HV | HHHH, HVHV, HHHV |

- HHHH and HVHV are echo power for HH and HV. Only these two are used.
- HHHV is a cross term between HH and HV, not a power, so it is not used as one.
- L-band frequency B is in the files but was not used.

## 2. What we could not test

- **L-band full-pol (HH, HV, VH, VV).** ASF lists it on descending track 120, frame 76, for
  example on 2 and 14 Sep 2026. It was not downloaded or processed.
- **S-band compact-pol.** Bhoonidhi showed none for 31 Aug and 12 Sep, the only dates searched.
  This does not mean none exist on other dates.

The searches are listed in the README.

## 3. What we tested

**HH against HV.** How well each channel separates stable water from stable land on 12 Sep:
the distance between the two group averages divided by their spread. Higher is better.

| Channel | Water average | Land average | Separation |
|---|---:|---:|---:|
| L-band HH | −16.84 dB | −7.46 dB | 4.28 |
| L-band HV | −23.91 dB | −15.66 dB | 3.30 |
| L-band HV − HH | −7.07 dB | −8.20 dB | 0.59 |
| S-band HH | −16.22 dB | −7.82 dB | 4.94 |
| S-band HV | −18.88 dB | −14.18 dB | 3.40 |
| S-band HV − HH | −2.66 dB | −6.35 dB | 3.03 |

The water and land groups come from HH-based maps, which favours HH in this test.

**Three L-band water rules on 12 Sep, checked against Sentinel-2.** Each rule uses the
threshold already set in the fusion script; none was tuned to the reference. Scored on
7,946.03 km² (1,963,507 acres) of cloud-free pixels.

| Rule | Water found | Precision | Recall | F1 |
|---|---:|---:|---:|---:|
| HH < −14.0 dB (baseline) | 4,735.30 km² (1,170,118 ac) | 0.822 | 0.875 | 0.848 |
| HH < −13.0 dB and HV < −21.5 dB | 4,723.70 km² (1,167,252 ac) | 0.816 | 0.854 | 0.835 |
| HHHH + 2·HVHV < −13.5 dB (span) | 4,037.82 km² (997,767 ac) | 0.877 | 0.832 | 0.854 |

**HV in change detection.** Of the L-band new water, 766.82 km² (189,484 ac), or 67.4%, also
had an HV drop of at least 3 dB. For S-band it was 661.35 km² (163,423 ac), or 56.3%. In the
fusion, the HV-based wind rule adds 270.51 km² (66,844 ac) of stable water.

## 4. Results

- HH separated water from land better than HV in both bands.
- The HV − HH difference works badly for L-band and well for S-band.
- Adding an HV test to HH lowered F1 slightly (0.848 to 0.835). The span raised it slightly
  (0.854) by making fewer false alarms. Neither change is large.
- This covers one band, one date and only cloud-free pixels. It does not show that the result
  holds everywhere or on other dates.
- No land-cover type is claimed from any polarization ratio.
