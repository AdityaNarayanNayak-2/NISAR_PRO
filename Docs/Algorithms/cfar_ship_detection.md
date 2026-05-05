# Ship Detection (CA-CFAR)

This document details the implementation of the Cell-Averaging Constant False Alarm Rate (CA-CFAR) algorithm within the `sar_processor` engine.

## Overview
CA-CFAR is a dynamic, adaptive thresholding algorithm used to detect anomalous metallic reflectors (ships) against a fluctuating background (sea clutter). Unlike a static threshold, CA-CFAR dynamically recalculates the threshold for every single pixel based on its immediate surroundings.

## The Sliding Window
For every pixel in the SAR image, a sliding window is applied consisting of:
1.  **Target Cell:** The central pixel being tested.
2.  **Guard Cells:** A buffer ring immediately surrounding the target. This prevents the energy of a large ship from "leaking" into the background estimate and artificially raising the threshold.
3.  **Background Cells:** The outer ring. The average intensity of these cells represents the local sea clutter.

## Mathematical Formulation
The threshold $T$ for a given pixel is calculated as:
$$T = \alpha \times \mu_{background}$$

Where $\mu_{background}$ is the mean of the background cells, and $\alpha$ is a scaling factor derived from the desired Probability of False Alarm ($P_{fa}$) and the number of background cells ($N$):
$$\alpha = N \cdot (P_{fa}^{-1/N} - 1)$$

In NISARPro, $P_{fa}$ is strictly set to `1e-6`.

## Integral Image Optimization (O(1) Complexity)
A naive sliding window approach requires $O(N^2)$ operations per pixel. For an 8GB NISAR image (e.g., 30,000 x 30,000 pixels), this would take hours to compute.

We solve this by generating a **Summed Area Table** (Integral Image) during a single $O(N)$ pass.
Once the table is built, the sum of any rectangular window (no matter how large) can be calculated in exactly **4 operations**:
```rust
fn rect_sum(sat: &Array2<f64>, r0: usize, c0: usize, r1: usize, c1: usize) -> f64 {
    sat[[r1 + 1, c1 + 1]] - sat[[r0, c1 + 1]] - sat[[r1 + 1, c0]] + sat[[r0, c0]]
}
```
This reduces the CA-CFAR complexity to **O(1)** per pixel.

## Output
Pixels exceeding the local threshold are flagged as detections. Adjacent flagged pixels are clustered using DBSCAN, and the resulting bounding boxes are exported as a GeoJSON FeatureCollection (`detections.geojson`) for rendering on the Leaflet dashboard map.
