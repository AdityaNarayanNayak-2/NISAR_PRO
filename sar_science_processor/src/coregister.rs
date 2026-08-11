//! SAR image coregistration via global FFT cross-correlation.
//!
//! Detects the 2D sub-pixel shift between master and slave SLC images
//! and resamples the slave to align with the master using sinc interpolation.

use anyhow::Result;
use log::{info, warn};
use ndarray::Array2;
use num_complex::Complex32;
use rustfft::FftPlanner;

use std::f32::consts::PI;

// ── Sinc interpolation (extracted from archived rcmc.rs) ──────────────────

/// Number of interpolation kernel points (typically 8-16 for SAR)
const SINC_KERNEL_SIZE: usize = 8;

/// Calculate sinc function: sin(πx)/(πx)
#[inline]
fn sinc(x: f32) -> f32 {
    if x.abs() < 1e-10 {
        1.0
    } else {
        let pi_x = PI * x;
        pi_x.sin() / pi_x
    }
}

/// Generate sinc interpolation kernel with Hamming window
fn generate_sinc_kernel(shift: f32, kernel_size: usize) -> Vec<f32> {
    let half = kernel_size as i32 / 2;
    let mut kernel = Vec::with_capacity(kernel_size);

    for i in 0..kernel_size as i32 {
        let x = (i - half) as f32 - shift;
        let sinc_val = sinc(x);
        let n = (i as f32) / (kernel_size as f32 - 1.0);
        let window = 0.54 - 0.46 * (2.0 * PI * n).cos();
        kernel.push(sinc_val * window);
    }

    let sum: f32 = kernel.iter().sum();
    if sum.abs() > 1e-10 {
        for k in &mut kernel {
            *k /= sum;
        }
    }

    kernel
}

/// Apply sinc interpolation to shift a signal by a fractional amount
fn sinc_interpolate_shift(signal: &[Complex32], shift: f32) -> Vec<Complex32> {
    let n = signal.len();
    let mut output = vec![Complex32::new(0.0, 0.0); n];

    let int_shift = shift.floor() as i32;
    let frac_shift = shift - shift.floor();

    let kernel = generate_sinc_kernel(frac_shift, SINC_KERNEL_SIZE);
    let half_kernel = SINC_KERNEL_SIZE as i32 / 2;

    for i in 0..n as i32 {
        let mut sum = Complex32::new(0.0, 0.0);
        for (k_idx, &k_val) in kernel.iter().enumerate() {
            let src_idx = i - int_shift - (k_idx as i32 - half_kernel);
            if src_idx >= 0 && src_idx < n as i32 {
                sum += signal[src_idx as usize] * k_val;
            }
        }
        output[i as usize] = sum;
    }

    output
}

/// Coregister slave SLC to master SLC.
///
/// Uses global FFT cross-correlation to detect the 2D offset, then resamples
/// the slave with sinc interpolation to align with the master.
///
/// # Arguments
/// * `master` - Reference SLC image
/// * `slave` - Image to be aligned to master
/// * `_patch_size` - Reserved for future patch-based mode
/// * `_overlap` - Reserved for future patch-based mode
/// * `_oversample_factor` - Reserved for future spectral oversampling
pub fn coregister(
    master: &Array2<Complex32>,
    slave: &Array2<Complex32>,
    _patch_size: usize,
    _overlap: usize,
    _oversample_factor: usize,
) -> Result<Array2<Complex32>> {
    anyhow::ensure!(
        master.dim() == slave.dim(),
        "Master ({:?}) and slave ({:?}) dimensions must match",
        master.dim(),
        slave.dim()
    );

    let (rows, cols) = master.dim();
    warn!("[COREG] Simplified global cross-correlation active (not patch-based)");
    info!("[COREG] Image dimensions: {}×{}", rows, cols);

    let fft_rows = rows.next_power_of_two();
    let fft_cols = cols.next_power_of_two();

    // Step 1: 2D FFT of both images
    let m_fft = fft2d(master, fft_rows, fft_cols);
    let s_fft = fft2d(slave, fft_rows, fft_cols);

    // Step 2: Cross-power spectrum C = conj(M) × S
    let mut cross = Array2::<Complex32>::zeros((fft_rows, fft_cols));
    for r in 0..fft_rows {
        for c in 0..fft_cols {
            cross[[r, c]] = m_fft[[r, c]].conj() * s_fft[[r, c]];
        }
    }

    // Step 3: IFFT2D → cross-correlation surface
    let cc = ifft2d(&cross, fft_rows, fft_cols);

    // Step 4: Find peak magnitude
    let mut peak_val = 0.0_f32;
    let mut peak_r = 0usize;
    let mut peak_c = 0usize;
    for r in 0..fft_rows {
        for c in 0..fft_cols {
            let mag = cc[[r, c]].norm();
            if mag > peak_val {
                peak_val = mag;
                peak_r = r;
                peak_c = c;
            }
        }
    }

    // Step 5: Sub-pixel refinement via parabolic interpolation
    let sub_az = refine_peak(
        cc[[wrap_idx(peak_r as isize - 1, fft_rows), peak_c]].norm(),
        cc[[peak_r, peak_c]].norm(),
        cc[[(peak_r + 1) % fft_rows, peak_c]].norm(),
    );
    let sub_rg = refine_peak(
        cc[[peak_r, wrap_idx(peak_c as isize - 1, fft_cols)]].norm(),
        cc[[peak_r, peak_c]].norm(),
        cc[[peak_r, (peak_c + 1) % fft_cols]].norm(),
    );

    // Convert FFT bin to signed shift (handle circular wrap for negative shifts)
    let az_offset = {
        let raw = peak_r as f64 + sub_az;
        if raw > fft_rows as f64 / 2.0 {
            raw - fft_rows as f64
        } else {
            raw
        }
    };
    let rg_offset = {
        let raw = peak_c as f64 + sub_rg;
        if raw > fft_cols as f64 / 2.0 {
            raw - fft_cols as f64
        } else {
            raw
        }
    };

    info!(
        "[COREG] Detected offset: az={:.4}px, rg={:.4}px",
        az_offset, rg_offset
    );
    info!(
        "[COREG] Polynomial coefficients: c0_az={:.6}, c0_rg={:.6} (global constant)",
        az_offset, rg_offset
    );
    info!("[COREG] Max residual offset: 0.0000 (global model)");

    // Step 6: Resample slave by the negative of detected offset
    let resampled = resample_2d(slave, -rg_offset as f32, -az_offset as f32);

    Ok(resampled)
}

// ── Helpers ────────────────────────────────────────────────────────────────

/// Circular index wrapping for negative indices.
fn wrap_idx(idx: isize, n: usize) -> usize {
    ((idx % n as isize) + n as isize) as usize % n
}

/// Parabolic sub-pixel peak refinement.
/// Returns fractional offset from center sample.
fn refine_peak(left: f32, center: f32, right: f32) -> f64 {
    let denom = (left - 2.0 * center + right) as f64;
    if denom.abs() < 1e-10 {
        0.0
    } else {
        0.5 * (left - right) as f64 / denom
    }
}

/// Resample a 2D complex image by a constant (range, azimuth) shift.
/// Applies sinc interpolation row-wise then column-wise.
fn resample_2d(
    image: &Array2<Complex32>,
    rg_shift: f32,
    az_shift: f32,
) -> Array2<Complex32> {
    let (rows, cols) = image.dim();

    // Pass 1: shift each row by rg_shift
    let mut pass1 = Array2::<Complex32>::zeros((rows, cols));
    for r in 0..rows {
        let row: Vec<Complex32> = (0..cols).map(|c| image[[r, c]]).collect();
        let shifted = sinc_interpolate_shift(&row, rg_shift);
        for c in 0..cols {
            pass1[[r, c]] = shifted[c];
        }
    }

    // Pass 2: shift each column by az_shift
    let mut result = Array2::<Complex32>::zeros((rows, cols));
    for c in 0..cols {
        let col: Vec<Complex32> = (0..rows).map(|r| pass1[[r, c]]).collect();
        let shifted = sinc_interpolate_shift(&col, az_shift);
        for r in 0..rows {
            result[[r, c]] = shifted[r];
        }
    }

    result
}

/// 2D forward FFT with zero-padding.
fn fft2d(data: &Array2<Complex32>, fft_rows: usize, fft_cols: usize) -> Array2<Complex32> {
    let (rows, cols) = data.dim();
    let mut planner = FftPlanner::new();
    let fft_r = planner.plan_fft_forward(fft_cols);
    let fft_c = planner.plan_fft_forward(fft_rows);

    // Zero-pad input
    let mut buf = Array2::<Complex32>::zeros((fft_rows, fft_cols));
    for r in 0..rows.min(fft_rows) {
        for c in 0..cols.min(fft_cols) {
            buf[[r, c]] = data[[r, c]];
        }
    }

    // FFT each row
    for r in 0..fft_rows {
        let mut row: Vec<Complex32> = (0..fft_cols).map(|c| buf[[r, c]]).collect();
        fft_r.process(&mut row);
        for c in 0..fft_cols {
            buf[[r, c]] = row[c];
        }
    }

    // FFT each column
    for c in 0..fft_cols {
        let mut col: Vec<Complex32> = (0..fft_rows).map(|r| buf[[r, c]]).collect();
        fft_c.process(&mut col);
        for r in 0..fft_rows {
            buf[[r, c]] = col[r];
        }
    }

    buf
}

/// 2D inverse FFT with normalization.
fn ifft2d(data: &Array2<Complex32>, fft_rows: usize, fft_cols: usize) -> Array2<Complex32> {
    let mut planner = FftPlanner::new();
    let ifft_r = planner.plan_fft_inverse(fft_cols);
    let ifft_c = planner.plan_fft_inverse(fft_rows);
    let n = (fft_rows * fft_cols) as f32;

    let mut buf = data.clone();

    // IFFT each row
    for r in 0..fft_rows {
        let mut row: Vec<Complex32> = (0..fft_cols).map(|c| buf[[r, c]]).collect();
        ifft_r.process(&mut row);
        for c in 0..fft_cols {
            buf[[r, c]] = row[c];
        }
    }

    // IFFT each column + normalize
    for c in 0..fft_cols {
        let mut col: Vec<Complex32> = (0..fft_rows).map(|r| buf[[r, c]]).collect();
        ifft_c.process(&mut col);
        for r in 0..fft_rows {
            buf[[r, c]] = col[r] / n;
        }
    }

    buf
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Create a 256×256 scene with 5 Gaussian point targets.
    /// All values are analytically defined — no RNG.
    fn make_test_scene() -> Array2<Complex32> {
        let n = 256;
        let targets: [(usize, usize); 5] = [
            (64, 64),
            (64, 192),
            (128, 128),
            (192, 64),
            (192, 192),
        ];
        let sigma2 = 50.0_f32;

        Array2::from_shape_fn((n, n), |(r, c)| {
            let mut val = 0.0_f32;
            for &(tr, tc) in &targets {
                let d2 = (r as f32 - tr as f32).powi(2) + (c as f32 - tc as f32).powi(2);
                val += (-d2 / sigma2).exp();
            }
            Complex32::new(val, 0.0)
        })
    }

    #[test]
    fn test_coregister_integer_shift() {
        let master = make_test_scene();
        let (rows, cols) = master.dim();

        // Create slave by shifting master by az=+4, rg=-2
        let az_shift = 4.0_f32;
        let rg_shift = -2.0_f32;
        let slave = resample_2d(&master, rg_shift, az_shift);

        // Coregister should detect and remove this shift
        let result = coregister(&master, &slave, 64, 32, 16).expect("coregister failed");

        // Compare interior pixels (exclude 12-pixel border for sinc boundary effects)
        let margin = 12;
        let mut max_diff = 0.0_f32;
        for r in margin..(rows - margin) {
            for c in margin..(cols - margin) {
                let diff = (result[[r, c]] - master[[r, c]]).norm();
                if diff > max_diff {
                    max_diff = diff;
                }
            }
        }

        assert!(
            max_diff < 0.01,
            "Max absolute difference = {} (expected < 0.01)",
            max_diff
        );
    }

    #[test]
    fn test_coregister_zero_shift() {
        // Identical images → should return essentially the same image
        let master = make_test_scene();
        let result = coregister(&master, &master, 64, 32, 16).expect("coregister failed");

        let margin = 8;
        let (rows, cols) = master.dim();
        let mut max_diff = 0.0_f32;
        for r in margin..(rows - margin) {
            for c in margin..(cols - margin) {
                let diff = (result[[r, c]] - master[[r, c]]).norm();
                if diff > max_diff {
                    max_diff = diff;
                }
            }
        }

        assert!(
            max_diff < 1e-3,
            "Zero-shift max diff = {} (expected < 1e-3)",
            max_diff
        );
    }
}
