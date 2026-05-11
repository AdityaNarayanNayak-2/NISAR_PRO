//! Goldstein adaptive phase filter for InSAR interferograms.
//!
//! Reduces phase noise in interferograms using spatially adaptive spectral
//! weighting. Low-coherence regions are filtered more aggressively.
//!
//! Reference: Goldstein, R.M. & Werner, C.L. (1998) "Radar interferogram
//! filtering for geophysical applications," Geophysical Research Letters.

use log::info;
use ndarray::Array2;
use num_complex::Complex32;
use rustfft::FftPlanner;

/// Goldstein adaptive phase filter.
///
/// Divides the interferogram into overlapping blocks, applies a 2D FFT,
/// weights the spectrum by `|S|^α` where `α = 1 − coherence²` (mean over
/// the block), then inverse-transforms and overlap-adds.
///
/// Higher coherence → lower α → less filtering (signal preserved).
/// Lower coherence → higher α → more filtering (noise suppressed).
///
/// # Arguments
/// * `ifgram` - Complex interferogram (master × conj(slave))
/// * `coherence` - Coherence map (same dimensions as ifgram), values in [0, 1]
/// * `block_size` - Side length of square processing blocks (typically 32)
/// * `overlap` - Overlap in pixels between adjacent blocks (typically block_size/2)
///
/// # Returns
/// Filtered interferogram with reduced phase noise.
pub fn goldstein_filter(
    ifgram: &Array2<Complex32>,
    coherence: &Array2<f32>,
    block_size: usize,
    overlap: usize,
) -> Array2<Complex32> {
    let (rows, cols) = ifgram.dim();
    let step = block_size.saturating_sub(overlap).max(1);

    info!(
        "[GOLDSTEIN] {}×{}, block={}, overlap={}, step={}",
        rows, cols, block_size, overlap, step
    );

    // Accumulators for overlap-add (f64 for numerical stability)
    let mut acc_re = Array2::<f64>::zeros((rows, cols));
    let mut acc_im = Array2::<f64>::zeros((rows, cols));
    let mut acc_wt = Array2::<f64>::zeros((rows, cols));

    let mut planner = FftPlanner::<f32>::new();
    let fft_fwd = planner.plan_fft_forward(block_size);
    let fft_inv = planner.plan_fft_inverse(block_size);
    let n2 = (block_size * block_size) as f32;

    // Reusable column buffer
    let mut col_buf = vec![Complex32::new(0.0, 0.0); block_size];

    let mut r_start = 0usize;
    while r_start < rows {
        let mut c_start = 0usize;
        while c_start < cols {
            // ── Extract block (zero-pad edges) ───────────────────────
            let mut block = vec![Complex32::new(0.0, 0.0); block_size * block_size];
            let mut coh_sum = 0.0_f64;
            let mut coh_count = 0u64;

            for br in 0..block_size {
                for bc in 0..block_size {
                    let gr = r_start + br;
                    let gc = c_start + bc;
                    if gr < rows && gc < cols {
                        block[br * block_size + bc] = ifgram[[gr, gc]];
                        coh_sum += coherence[[gr, gc]] as f64;
                        coh_count += 1;
                    }
                }
            }

            // ── Adaptive alpha from mean coherence ───────────────────
            let mean_coh = if coh_count > 0 {
                (coh_sum / coh_count as f64) as f32
            } else {
                0.0
            };
            let alpha = 1.0 - mean_coh * mean_coh;

            // ── 2D FFT (row-wise then column-wise) ───────────────────
            for br in 0..block_size {
                let start = br * block_size;
                let end = start + block_size;
                fft_fwd.process(&mut block[start..end]);
            }
            for bc in 0..block_size {
                for br in 0..block_size {
                    col_buf[br] = block[br * block_size + bc];
                }
                fft_fwd.process(&mut col_buf);
                for br in 0..block_size {
                    block[br * block_size + bc] = col_buf[br];
                }
            }

            // ── Spectral weighting: S × |S|^α ───────────────────────
            for val in block.iter_mut() {
                let mag = val.norm();
                if mag > 1e-20 {
                    *val *= mag.powf(alpha);
                }
            }

            // ── 2D IFFT (row-wise then column-wise) + normalize ──────
            for br in 0..block_size {
                let start = br * block_size;
                let end = start + block_size;
                fft_inv.process(&mut block[start..end]);
            }
            for bc in 0..block_size {
                for br in 0..block_size {
                    col_buf[br] = block[br * block_size + bc];
                }
                fft_inv.process(&mut col_buf);
                for br in 0..block_size {
                    block[br * block_size + bc] = col_buf[br] / n2;
                }
            }

            // ── Overlap-add ──────────────────────────────────────────
            for br in 0..block_size {
                for bc in 0..block_size {
                    let gr = r_start + br;
                    let gc = c_start + bc;
                    if gr < rows && gc < cols {
                        let v = block[br * block_size + bc];
                        acc_re[[gr, gc]] += v.re as f64;
                        acc_im[[gr, gc]] += v.im as f64;
                        acc_wt[[gr, gc]] += 1.0;
                    }
                }
            }

            c_start += step;
        }
        r_start += step;
    }

    // ── Normalize by overlap count ───────────────────────────────────────
    let mut result = Array2::<Complex32>::zeros((rows, cols));
    for r in 0..rows {
        for c in 0..cols {
            let w = acc_wt[[r, c]];
            if w > 0.0 {
                result[[r, c]] = Complex32::new(
                    (acc_re[[r, c]] / w) as f32,
                    (acc_im[[r, c]] / w) as f32,
                );
            }
        }
    }

    info!("[GOLDSTEIN] Filtering complete.");
    result
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::f32::consts::PI;

    /// Compute RMSE between wrapped phases of two complex arrays.
    fn phase_rmse(a: &Array2<Complex32>, b: &Array2<Complex32>) -> f64 {
        let (rows, cols) = a.dim();
        let mut sum_sq = 0.0_f64;
        let mut count = 0u64;

        for r in 0..rows {
            for c in 0..cols {
                let pa = a[[r, c]].arg() as f64;
                let pb = b[[r, c]].arg() as f64;
                // Wrap difference to [-π, π]
                let mut diff = pa - pb;
                while diff > std::f64::consts::PI {
                    diff -= 2.0 * std::f64::consts::PI;
                }
                while diff < -std::f64::consts::PI {
                    diff += 2.0 * std::f64::consts::PI;
                }
                sum_sq += diff * diff;
                count += 1;
            }
        }

        (sum_sq / count as f64).sqrt()
    }

    #[test]
    fn test_goldstein_reduces_noise() {
        // Analytically constructed test data — no RNG.
        //
        // Clean signal: linear phase ramp across the image.
        //   clean_phase[r,c] = 2π·r/rows + π·c/cols
        //
        // Deterministic noise: sum of high-frequency sinusoids.
        //   noise[r,c] = 0.5·sin(2.7r + 3.1c) + 0.3·sin(5.3r − 4.7c)
        //              + 0.2·cos(7.1r + 6.3c)
        //
        // Noisy interferogram: exp(j·(clean + noise))
        // Coherence: set to 0.3 everywhere (low → aggressive filtering → α ≈ 0.91)

        let n = 64;
        let clean = Array2::from_shape_fn((n, n), |(r, c)| {
            let phase = 2.0 * PI * (r as f32) / (n as f32)
                + PI * (c as f32) / (n as f32);
            Complex32::from_polar(1.0, phase)
        });

        let noisy = Array2::from_shape_fn((n, n), |(r, c)| {
            let clean_phase = 2.0 * PI * (r as f32) / (n as f32)
                + PI * (c as f32) / (n as f32);
            let noise = 0.5 * (2.7 * r as f32 + 3.1 * c as f32).sin()
                + 0.3 * (5.3 * r as f32 - 4.7 * c as f32).sin()
                + 0.2 * (7.1 * r as f32 + 6.3 * c as f32).cos();
            Complex32::from_polar(1.0, clean_phase + noise)
        });

        let coherence = Array2::from_elem((n, n), 0.3_f32);

        let filtered = goldstein_filter(&noisy, &coherence, 32, 16);

        let rmse_before = phase_rmse(&noisy, &clean);
        let rmse_after = phase_rmse(&filtered, &clean);

        assert!(
            rmse_after < rmse_before,
            "Goldstein filter should reduce phase RMSE: before={:.4}, after={:.4}",
            rmse_before,
            rmse_after
        );
    }

    #[test]
    fn test_goldstein_preserves_clean_signal() {
        // With coherence = 1.0, α = 0 → no filtering → output ≈ input.
        let n = 32;
        let clean = Array2::from_shape_fn((n, n), |(r, _c)| {
            let phase = PI * (r as f32) / (n as f32);
            Complex32::from_polar(1.0, phase)
        });

        let coherence = Array2::from_elem((n, n), 1.0_f32);
        let filtered = goldstein_filter(&clean, &coherence, 32, 16);

        let rmse = phase_rmse(&filtered, &clean);
        assert!(
            rmse < 0.01,
            "High-coherence filter should preserve signal: RMSE={:.6}",
            rmse
        );
    }

    #[test]
    fn test_goldstein_handles_non_power_of_two() {
        // Image dimensions that don't evenly divide into blocks
        let n = 50; // Not a multiple of 32
        let ifgram = Array2::from_elem((n, n), Complex32::from_polar(1.0, 0.5));
        let coherence = Array2::from_elem((n, n), 0.5_f32);

        let filtered = goldstein_filter(&ifgram, &coherence, 32, 16);
        assert_eq!(filtered.dim(), (n, n));

        // Constant input → output should be close to constant
        for r in 0..n {
            for c in 0..n {
                let diff = (filtered[[r, c]].arg() - 0.5).abs();
                assert!(
                    diff < 0.1,
                    "Non-power-of-two: phase drift at [{},{}] = {}",
                    r, c, diff
                );
            }
        }
    }
}
