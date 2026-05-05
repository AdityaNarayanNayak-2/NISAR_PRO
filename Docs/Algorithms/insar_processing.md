# InSAR & Coherence Processing

This document details the Interferometric Synthetic Aperture Radar (InSAR) pipeline implemented in the `sar_processor` engine.

## Overview
InSAR utilizes the phase difference between two complex SAR images (a "Master" and a "Slave") acquired over the same region at different times. Because SAR relies on microwave frequencies (e.g., L-band or S-band), the phase of the returning wave is highly sensitive to changes in the distance between the satellite and the ground.

## Interferogram Generation
To calculate the phase difference, the Slave image must first be sub-pixel coregistered to the Master image. Once aligned, we generate the interferogram by performing element-wise complex conjugate multiplication:

$$\phi_{ifgram} = Master \cdot Slave^*$$

In Rust using `ndarray`, this is highly parallelized:
```rust
Zip::from(&mut ifgram)
    .and(master)
    .and(slave)
    .par_for_each(|out, &m, &s| {
        *out = m * s.conj();
    });
```
The argument (angle) of the resulting complex number $\phi_{ifgram}$ represents the phase difference, which directly correlates to ground displacement (or topography).

## Spatial Coherence
Coherence ($\gamma$) measures the similarity (or phase stability) between the two images. It is a critical metric for determining the reliability of the interferometric phase.

$$\gamma = \frac{|\langle M \cdot S^* \rangle|}{\sqrt{\langle |M|^2 \rangle \langle |S|^2 \rangle}}$$

-   **High Coherence (0.8 - 1.0):** Concrete structures, bare rock, urban areas. Phase data is highly reliable.
-   **Low Coherence (0.0 - 0.3):** Forests, water, agriculture. Phase data is noisy and unusable (temporal decorrelation).

## Persistent Scatterer Interferometry (PS-InSAR)
For infrastructure monitoring, we don't care about the noisy phase over forests. We filter the coherence map for pixels where $\gamma > 0.85$. These highly stable pixels are called **Persistent Scatterers (PS)**.
By tracking the phase of these specific pixels across a time-series of images, we can calculate structural displacement with millimeter-level precision.
