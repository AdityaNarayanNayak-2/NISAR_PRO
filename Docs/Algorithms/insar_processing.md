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

## Phase Refinement and Correction in GUNW Parsing

When processing Geocoded Unwrapped Interferograms (GUNW), raw unwrapped phase maps contain systematic errors and anomalies (such as orbit/topographic ramps, unwrapping errors, and low-coherence noise). To obtain clean localized deformation maps, the processor applies three sequential correction steps.

### 1. Connected Components (Phase Unwrapping) Masking
Phase unwrapping converts the wrapped phase ($-\pi$ to $+\pi$) to continuous phase by resolving $2\pi$ cycle jumps. However, low-coherence areas disrupt this path integration. SNAPHU groups these failed areas into a **Connected Component index of 0**.
* **Correction**: Pixels where `connectedComponents == 0` are masked to `NaN`.
* **Reasoning**: Unwrapping errors introduce discrete $2\pi$ phase jumps (representing massive false displacements). Excluding these prevents the corruption of subsequent spatial filter and deramping estimations.

### 2. Low-Coherence Proxy Masking
Water bodies (lakes, reservoirs, rivers) and dense vegetation exhibit rapid temporal decorrelation:
$$\gamma < 0.3$$
* **Correction**: All pixels with coherence $< 0.3$ are masked to `NaN`.
* **Reasoning**: Since open water does not reflect radar signal coherently, its phase is pure noise. High noise in large bodies of water (like the Indravati Dam reservoir) creates spurious displacement spikes (often exceeding 50mm).

### 3. Iterative Robust Quadratic Deramping
Sub-satellite orbit differences and topography introduce a regional linear/quadratic phase ramp $\phi_{\text{ramp}}(x, y)$ across the interferogram scene:
$$\phi_{\text{ramp}}(x, y) = a_0 + a_1 x + a_2 y + a_3 x^2 + a_4 y^2 + a_5 x y$$

To isolate localized ground deformation, this regional ramp must be fitted and subtracted.
* **Algorithm**: We perform an **Iterative Robust Least-Squares Fit**:
  1. Fit a quadratic surface to the valid (non-`NaN`) phase pixels using linear regression.
  2. Compute the residual $\epsilon_i = \phi_i - \phi_{\text{ramp}}(x_i, y_i)$ for each pixel.
  3. Calculate the robust standard deviation of the residuals using the Median Absolute Deviation (MAD):
     $$\sigma_{\text{MAD}} = 1.4826 \times \text{median}(|\epsilon - \text{median}(\epsilon)|)$$
  4. Reject outliers where $|\epsilon_i| > 2.5\sigma_{\text{MAD}}$.
  5. Repeat the fit using only the inlier pixels. The loop runs for **3 iterations** to ensure convergence.
* **Reasoning**: Standard least-squares fitting is sensitive to localized deformation (e.g., active landslides) or atmospheric phase screen (APS). By iteratively rejecting outliers, we ensure the fitted ramp describes only the stable regional orbit/topography background, yielding clean localized displacement signals.