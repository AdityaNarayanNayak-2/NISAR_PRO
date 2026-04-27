use ndarray::{Array2, ArrayView2};
use log::info;
use rayon::prelude::*;

/// A detected ship target
#[derive(Debug, Clone, serde::Serialize)]
pub struct ShipTarget {
    /// Pixel col in the downsampled grid
    pub x: usize,
    /// Pixel row in the downsampled grid
    pub y: usize,
    /// Target intensity (linear power)
    pub intensity: f32,
    /// Local clutter threshold that was exceeded
    pub threshold: f32,
}

/// Downsample a native-resolution intensity image by block-averaging.
///
/// This is the critical step that prevents CPU/RAM blowup. A 16020×16560
/// image with factor=8 becomes 2002×2070 — small enough for CFAR.
pub fn downsample_intensity(
    image: ArrayView2<f32>,
    factor: usize,
) -> Array2<f32> {
    let rows = image.nrows();
    let cols = image.ncols();
    let out_rows = rows / factor;
    let out_cols = cols / factor;

    info!(
        "Downsampling intensity: {}×{} → {}×{} (factor {})",
        rows, cols, out_rows, out_cols, factor
    );

    let mut out = Array2::<f32>::zeros((out_rows, out_cols));

    out.axis_iter_mut(ndarray::Axis(0))
        .into_par_iter()
        .enumerate()
        .for_each(|(or, mut row_out)| {
            for oc in 0..out_cols {
                let mut sum = 0.0_f32;
                let mut count = 0u32;
                let r_start = or * factor;
                let c_start = oc * factor;
                let r_end = (r_start + factor).min(rows);
                let c_end = (c_start + factor).min(cols);

                for r in r_start..r_end {
                    for c in c_start..c_end {
                        let v = image[[r, c]];
                        if v.is_finite() && v > 0.0 {
                            sum += v;
                            count += 1;
                        }
                    }
                }

                if count > 0 {
                    row_out[oc] = sum / count as f32;
                }
            }
        });

    out
}

/// Build a summed-area table (integral image) for O(1) rectangle sums.
///
/// `sat[r][c]` = sum of all `image[0..r][0..c]`.
/// Uses f64 to avoid precision loss when summing millions of f32 values.
fn build_integral_image(image: &Array2<f32>) -> Array2<f64> {
    let rows = image.nrows();
    let cols = image.ncols();
    let mut sat = Array2::<f64>::zeros((rows + 1, cols + 1));

    for r in 0..rows {
        let mut row_sum = 0.0_f64;
        for c in 0..cols {
            let v = image[[r, c]];
            row_sum += if v.is_finite() { v as f64 } else { 0.0 };
            sat[[r + 1, c + 1]] = sat[[r, c + 1]] + row_sum;
        }
    }

    sat
}

/// Query the summed-area table for the sum inside a rectangle [r0..r1, c0..c1] (inclusive).
#[inline(always)]
fn rect_sum(sat: &Array2<f64>, r0: usize, c0: usize, r1: usize, c1: usize) -> f64 {
    sat[[r1 + 1, c1 + 1]] - sat[[r0, c1 + 1]] - sat[[r1 + 1, c0]] + sat[[r0, c0]]
}

/// 2D Cell-Averaging CFAR with Integral-Image Acceleration
///
/// Instead of looping over every background cell for every pixel (O(W²) per pixel),
/// we precompute a summed-area table and then compute background sums in O(1).
///
/// The background mean is computed as:
///   bg_sum = outer_rect_sum - guard_rect_sum
///   bg_count = outer_rect_area - guard_rect_area
///   threshold = alpha * (bg_sum / bg_count)
///
/// Parameters:
/// * `image`: **Already downsampled** intensity image (e.g. ~2000×2000).
/// * `guard_size`: Radius of guard window (typically 3–5).
/// * `bg_size`: Radius of background window (typically 8–12).
/// * `pfa`: Desired probability of false alarm (e.g. 1e-6).
/// * `max_detections`: Hard cap on returned targets to prevent browser crash.
pub fn detect_ships_cfar(
    image: ArrayView2<f32>,
    guard_size: usize,
    bg_size: usize,
    pfa: f32,
    max_detections: usize,
) -> Vec<ShipTarget> {
    let rows = image.nrows();
    let cols = image.ncols();

    info!(
        "Integral-Image CA-CFAR on {}×{} (guard={}, bg={}, pfa={:.1e}, max={})",
        rows, cols, guard_size, bg_size, pfa, max_detections
    );

    // Sanity: need at least 2*bg_size margin on each side
    if rows <= bg_size * 2 || cols <= bg_size * 2 {
        info!("Image too small for CFAR windows, returning empty");
        return Vec::new();
    }

    // ── 1. Build integral image (single-threaded, one pass) ──────────────
    info!("Building summed-area table...");
    let owned = image.to_owned();
    let sat = build_integral_image(&owned);

    // ── 2. Compute alpha threshold factor ────────────────────────────────
    let outer_side = 2 * bg_size + 1;
    let guard_side = 2 * guard_size + 1;
    let n_bg = (outer_side * outer_side - guard_side * guard_side) as f32;
    let alpha = n_bg * (pfa.powf(-1.0 / n_bg) - 1.0);
    info!("CFAR alpha={:.4}, background cells per pixel={}", alpha, n_bg as usize);

    // ── 3. Parallel CFAR scan with O(1) per pixel ────────────────────────
    info!("Scanning for targets...");
    let all_targets: Vec<ShipTarget> = (bg_size..(rows - bg_size))
        .into_par_iter()
        .flat_map(|r| {
            let mut local = Vec::new();
            for c in bg_size..(cols - bg_size) {
                let cut_val = owned[[r, c]];

                // Skip dark/invalid pixels
                if cut_val <= 1e-8 || !cut_val.is_finite() {
                    continue;
                }

                // Outer rectangle sum
                let outer_sum = rect_sum(
                    &sat,
                    r - bg_size, c - bg_size,
                    r + bg_size, c + bg_size,
                );

                // Guard rectangle sum (to subtract)
                let guard_sum = rect_sum(
                    &sat,
                    r.saturating_sub(guard_size), c.saturating_sub(guard_size),
                    (r + guard_size).min(rows - 1), (c + guard_size).min(cols - 1),
                );

                let bg_sum = outer_sum - guard_sum;
                let bg_mean = bg_sum / n_bg as f64;
                let threshold = alpha as f64 * bg_mean;

                if (cut_val as f64) > threshold && threshold > 0.0 {
                    local.push(ShipTarget {
                        x: c,
                        y: r,
                        intensity: cut_val,
                        threshold: threshold as f32,
                    });
                }
            }
            local
        })
        .collect();

    info!("CFAR raw detections: {}", all_targets.len());

    // ── 4. NMS clustering ────────────────────────────────────────────────
    let mut clustered = cluster_targets(all_targets, guard_size * 2);
    info!("CFAR clustered ships: {}", clustered.len());

    // ── 5. Hard cap to prevent browser DOM explosion ─────────────────────
    clustered.truncate(max_detections);
    info!("Returning top {} targets", clustered.len());

    clustered
}

/// Simple greedy NMS: keep brightest, suppress neighbours within `radius`.
fn cluster_targets(mut targets: Vec<ShipTarget>, radius: usize) -> Vec<ShipTarget> {
    if targets.is_empty() {
        return Vec::new();
    }

    // Sort by intensity descending
    targets.sort_by(|a, b| {
        b.intensity
            .partial_cmp(&a.intensity)
            .unwrap_or(std::cmp::Ordering::Equal)
    });

    let mut kept: Vec<ShipTarget> = Vec::new();

    for t in targets {
        let dominated = kept.iter().any(|existing| {
            existing.x.abs_diff(t.x) <= radius && existing.y.abs_diff(t.y) <= radius
        });
        if !dominated {
            kept.push(t);
        }
    }

    kept
}
