# 🧮 Part 3: Core SAR Mathematics (`sar_processor`)

This is Part 3 of the comprehensive codebase deep dive. Once the massive HDF5 arrays are safely cropped, cleaned, and loaded into RAM (as detailed in Part 2), the engine begins the heavy mathematical operations. 

Because radar matrices easily exceed millions of pixels, naive mathematical loops would take hours to run. This section details how `sar_processor` uses algorithm optimizations (like Summed-Area Tables) and parallel processing to execute in seconds.

---

## 1. Interferogram & Coherence (`insar.rs`)

For raw SLC paths, the engine must compute the phase difference between two radar acquisitions (Master and Slave).

### Phase Difference
Phase difference is calculated by multiplying the complex Master array by the complex conjugate of the Slave array: `master * s.conj()`. The engine does this using `ndarray::Zip` to apply the multiplication element-wise across the arrays.

### Coherence Estimation via Summed-Area Tables (SAT)
Coherence ($\gamma$) measures how stable the pixels are between acquisitions. Naively calculating coherence for an $N \times M$ matrix with a $W \times W$ sliding window takes $O(N \cdot M \cdot W^2)$ operations. For a $5000 \times 5000$ image with an $11 \times 11$ window, that's billions of iterations.

Instead, `insar.rs` uses **Summed-Area Tables (Integral Images)**:
1. It builds four `f64` matrices (`sat_ms_re`, `sat_ms_im`, `sat_mm`, `sat_ss`) where each cell stores the cumulative sum of everything above and to the left of it.
2. The sliding window sum is then computed in exactly **4 matrix lookups** (O(1) time), regardless of the window size:
   ```rust
   let sum_ms_re = sat_ms_re[[r_bot + 1, c_right + 1]] 
                 - sat_ms_re[[r_top, c_right + 1]] 
                 - sat_ms_re[[r_bot + 1, c_left]] 
                 + sat_ms_re[[r_top, c_left]];
   ```
This reduces the time complexity to $O(N \cdot M)$, making coherence estimation nearly instantaneous.

---

## 2. Quality-Guided Phase Unwrapping (`unwrap.rs`)

Radar phase is "wrapped" between $-\pi$ and $\pi$. If actual ground displacement exceeds $\lambda / 2$ (half a wavelength), the phase wraps around, looking like a discontinuous fringe. 

To turn this into a continuous measurement, `unwrap.rs` implements a **Quality-Guided Flood Fill**:
1. **Max-Heap Initialization**: It uses Rust's `BinaryHeap` to act as a priority queue. It finds the pixel with the highest absolute coherence and seeds the queue.
2. **Quality-First Propagation**: The algorithm pops pixels from the heap. It unwraps the pixel by finding the $k$ integer that minimizes the difference between it and its unwrapped neighbor:
   ```rust
   let diff = w - ref_phase;
   let k = (diff / TWO_PI).round();
   unwrapped[[entry.row, entry.col]] = w - k * TWO_PI;
   ```
3. **Queueing Neighbors**: It pushes the pixel's unvisited neighbors onto the heap, sorted by *their* coherence.
Because the heap always pops the highest coherence pixels first, clean areas unwrap immediately, while noisy, low-coherence areas are forced to wait. This mathematically guarantees that noise doesn't propagate and corrupt good pixels.

---

## 3. Signal Deramping (`deramp.rs`)

Unwrapped phase often contains massive, scene-wide gradients (ramps) caused by orbital inaccuracies or the ionosphere. These ramps obscure tiny, localized ground settlements (like a dam sinking).

`deramp.rs` fits a 2D quadratic plane over the unwrapped pixels to estimate and subtract this ramp:
$$\phi_{\text{model}} = a \cdot r^2 + b \cdot c^2 + d \cdot rc + e \cdot r + f \cdot c + g$$

### Robust Iterative Fitting
If a dam is sinking severely, its deformation might trick the algorithm into thinking it's part of the atmospheric ramp. To prevent this, `deramp.rs` uses an iterative outlier rejection scheme:
1. It solves the 6x6 linear system (`solve_6x6`) using Gaussian elimination to find the coefficients $[a, b, d, e, f, g]$.
2. It subtracts the model from the phase to get the **residuals**.
3. It calculates the **Median Absolute Deviation (MAD)** of those residuals.
4. Any pixel whose residual is $> 2.5 \times 1.4826 \times \text{MAD}$ is temporarily rejected as an outlier.
5. It refits the model on the remaining "inliers" and repeats 3 times.

Finally, it applies **Median Referencing** by subtracting the median value of all stable pixels, guaranteeing the "background" of the image sits at exactly 0.0 radians of displacement.

---

## 4. Ship Detection CFAR (`ship_detection.rs`)

If the user selects the Maritime pipeline, `main.rs` routes the intensity matrices to `ship_detection.rs`.

### CA-CFAR (Cell-Averaging Constant False Alarm Rate)
Radar reflections from the ocean are extremely noisy. You cannot use a hard-coded brightness threshold to find ships. CFAR dynamically calculates the background clutter around *every single pixel*.

1. **Parallel Downsampling**: Using `rayon::prelude::*`, it downsamples the massive $16,000 \times 16,000$ matrix into a $\sim 2,000 \times 2,000$ matrix by averaging blocks. Rayon distributes the row processing across all CPU cores instantly.
2. **Integral Image Accel**: Like the coherence algorithm, it builds a Summed-Area Table (`sat`) to calculate the background mean in $O(1)$ time.
3. **Thresholding**: It calculates the background mean by subtracting a "Guard Rectangle" from an "Outer Rectangle". The threshold is calculated dynamically based on a target Probability of False Alarm (`pfa`):
   ```rust
   let threshold = alpha * bg_mean;
   if (cut_val) > threshold { // Ship detected! }
   ```
4. **Non-Maximum Suppression (NMS)**: Because a large ship will trigger detections on multiple adjacent pixels, `cluster_targets()` runs a greedy NMS algorithm to merge clustered pixels into a single target, keeping only the brightest peak.

---

**Next up: Part 4 (Data Export & Health Analysis)** will detail how these processed arrays are converted into GeoTIFFs and how the system analyzes infrastructure risk limits.
