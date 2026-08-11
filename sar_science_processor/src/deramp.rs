//! Phase deramping.
//!
//! Fits a 2D quadratic surface (a·r² + b·c² + d·rc + e·r + f·c + g)
//! to high-coherence pixels in the unwrapped phase map, then subtracts
//! it and applies median referencing to isolate local structural
//! deformation.  The quadratic model captures curved ionospheric and
//! atmospheric phase patterns that a linear plane cannot.
//!
//! Uses iterative robust estimation (3 rounds): fit, reject outliers
//! beyond 2.5× MAD, refit.  This prevents real deformation signals
//! from biasing the atmospheric/orbital ramp estimate.

use log::{info, warn};
use ndarray::Array2;

/// Number of iterative outlier-rejection rounds for robust quadratic fit.
const ROBUST_ITERATIONS: usize = 3;
/// Outlier rejection threshold in units of MAD (Median Absolute Deviation).
const MAD_THRESHOLD: f64 = 2.5;

/// Fits a 2D quadratic surface to high-coherence pixels, subtracts it,
/// and median-references the residuals so the stable background sits at
/// zero displacement.
///
/// Model:  φ_model(r,c) = a·r² + b·c² + d·r·c + e·r + f·c + g
///
/// Coordinates are normalized to [0, 1] to prevent numerical instability.
///
/// The fit is iteratively refined by rejecting outliers (|residual| > 2.5σ_MAD)
/// so that localized deformation does not bias the ramp estimate.
pub fn deramp_phase(
    unwrapped_phase: &Array2<f32>,
    coherence: &Array2<f32>,
    coherence_threshold: f32,
) -> Array2<f32> {
    let (rows, cols) = unwrapped_phase.dim();
    info!(
        "[DERAMP] Starting 2D quadratic deramp on {}×{} phase map (threshold={:.2})",
        rows, cols, coherence_threshold
    );

    // Collect high-coherence observations
    let mut obs: Vec<(f64, f64, f64)> = Vec::new(); // (rn, cn, phi)
    for r in 0..rows {
        for c in 0..cols {
            let phi = unwrapped_phase[[r, c]];
            let coh = coherence[[r, c]];
            if phi.is_finite() && coh >= coherence_threshold {
                let rn = r as f64 / rows.max(1) as f64;
                let cn = c as f64 / cols.max(1) as f64;
                obs.push((rn, cn, phi as f64));
            }
        }
    }

    let n = obs.len();
    if n < 10 {
        warn!("[DERAMP] Insufficient high-coherence points ({}) for surface fitting. Skipping.", n);
        return unwrapped_phase.clone();
    }

    // ── Iterative robust quadratic fitting ────────────────────────────
    // Each round: fit quadratic → compute residuals → reject outliers
    // beyond 2.5× MAD → refit on inliers only.
    let mut inlier_mask = vec![true; n];
    let mut coeffs = [0.0f64; 6];

    for iteration in 0..ROBUST_ITERATIONS {
        let inlier_count = inlier_mask.iter().filter(|&&m| m).count();
        if inlier_count < 10 {
            warn!("[DERAMP] Iteration {}: only {} inliers remain, stopping early.",
                iteration, inlier_count);
            break;
        }

        // Build normal equations from inliers only
        let p = 6;
        let mut ata = vec![0.0f64; p * p];
        let mut atb = vec![0.0f64; p];

        for (i, &(rn, cn, phi)) in obs.iter().enumerate() {
            if !inlier_mask[i] { continue; }
            let basis = [rn * rn, cn * cn, rn * cn, rn, cn, 1.0];
            for bi in 0..p {
                atb[bi] += basis[bi] * phi;
                for bj in 0..p {
                    ata[bi * p + bj] += basis[bi] * basis[bj];
                }
            }
        }

        match solve_6x6(&mut ata, &mut atb) {
            Some(c) => coeffs = [c[0], c[1], c[2], c[3], c[4], c[5]],
            None => {
                warn!("[DERAMP] Singular matrix at iteration {}. Using previous coefficients.", iteration);
                break;
            }
        }

        let [a, b, d, e, f, g] = coeffs;

        // Compute residuals for ALL observations (including current outliers)
        let residuals: Vec<f64> = obs.iter().map(|&(rn, cn, phi)| {
            let model = a * rn * rn + b * cn * cn + d * rn * cn + e * rn + f * cn + g;
            phi - model
        }).collect();

        // Compute MAD (Median Absolute Deviation) of inlier residuals
        let mut inlier_abs_residuals: Vec<f64> = residuals.iter().enumerate()
            .filter(|&(i, _)| inlier_mask[i])
            .map(|(_, &r)| r.abs())
            .collect();
        inlier_abs_residuals.sort_by(|x, y| x.partial_cmp(y).unwrap());
        let mad = inlier_abs_residuals[inlier_abs_residuals.len() / 2];
        // σ_MAD ≈ 1.4826 × MAD (consistent estimator for Gaussian σ)
        let sigma_mad = 1.4826 * mad;
        let threshold = MAD_THRESHOLD * sigma_mad;

        // Update inlier mask: reject observations with |residual| > threshold
        let mut rejected = 0usize;
        for (i, &res) in residuals.iter().enumerate() {
            if threshold > 1e-12 && res.abs() > threshold {
                if inlier_mask[i] {
                    inlier_mask[i] = false;
                    rejected += 1;
                }
            } else {
                // Readmit previously rejected points that now fall within threshold
                inlier_mask[i] = true;
            }
        }

        info!(
            "[DERAMP] Iteration {}: {}/{} inliers, MAD={:.4} rad, σ_MAD={:.4} rad, rejected {}",
            iteration, inlier_count, n, mad, sigma_mad, rejected
        );
    }

    let [a, b, d, e, f, g] = coeffs;
    let final_inliers = inlier_mask.iter().filter(|&&m| m).count();

    info!(
        "[DERAMP] Final quadratic: {:.4}r² + {:.4}c² + {:.4}rc + {:.4}r + {:.4}c + {:.4} ({}/{} inliers)",
        a, b, d, e, f, g, final_inliers, n
    );

    // Subtract quadratic surface from original phase
    let mut deramped = Array2::<f32>::zeros((rows, cols));
    for r in 0..rows {
        for c in 0..cols {
            let phi = unwrapped_phase[[r, c]];
            if !phi.is_finite() {
                deramped[[r, c]] = f32::NAN;
            } else {
                let rn = r as f64 / rows.max(1) as f64;
                let cn = c as f64 / cols.max(1) as f64;
                let model = a * rn * rn + b * cn * cn + d * rn * cn + e * rn + f * cn + g;
                deramped[[r, c]] = (phi as f64 - model) as f32;
            }
        }
    }

    // Median referencing: subtract the median of high-coherence residuals so
    // the stable background sits at zero displacement.  Standard PS-InSAR
    // practice to remove the arbitrary absolute-phase constant that survives
    // the polynomial fit.
    let mut finite_vals: Vec<f32> = Vec::new();
    for r in 0..rows {
        for c in 0..cols {
            let v = deramped[[r, c]];
            let coh = coherence[[r, c]];
            if v.is_finite() && coh >= coherence_threshold {
                finite_vals.push(v);
            }
        }
    }

    if finite_vals.len() >= 10 {
        finite_vals.sort_by(|a, b| a.partial_cmp(b).unwrap());
        let median = finite_vals[finite_vals.len() / 2];
        info!("[DERAMP] Median referencing: subtracting {:.4} rad from {} high-coh pixels",
            median, finite_vals.len());
        for r in 0..rows {
            for c in 0..cols {
                let v = deramped[[r, c]];
                if v.is_finite() {
                    deramped[[r, c]] = v - median;
                }
            }
        }
    }

    deramped
}

/// Solve a 6×6 linear system via Gaussian elimination with partial pivoting.
/// `a` is row-major 6×6 matrix, `b` is the 6-element RHS.
/// Returns `None` if the matrix is singular.
fn solve_6x6(a: &mut [f64], b: &mut [f64]) -> Option<[f64; 6]> {
    let n = 6;
    // Forward elimination with partial pivoting
    for col in 0..n {
        // Find pivot
        let mut max_row = col;
        let mut max_val = a[col * n + col].abs();
        for row in (col + 1)..n {
            let val = a[row * n + col].abs();
            if val > max_val {
                max_val = val;
                max_row = row;
            }
        }
        if max_val < 1e-14 {
            return None; // singular
        }
        // Swap rows
        if max_row != col {
            for j in 0..n {
                a.swap(col * n + j, max_row * n + j);
            }
            b.swap(col, max_row);
        }
        // Eliminate below
        let pivot = a[col * n + col];
        for row in (col + 1)..n {
            let factor = a[row * n + col] / pivot;
            for j in col..n {
                a[row * n + j] -= factor * a[col * n + j];
            }
            b[row] -= factor * b[col];
        }
    }
    // Back substitution
    let mut x = [0.0f64; 6];
    for col in (0..n).rev() {
        let mut sum = b[col];
        for j in (col + 1)..n {
            sum -= a[col * n + j] * x[j];
        }
        x[col] = sum / a[col * n + col];
    }
    Some(x)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_perfect_plane_deramping() {
        let (rows, cols) = (10, 10);
        let coherence = Array2::from_elem((rows, cols), 1.0f32);
        
        // Construct a linear ramp + constant value: phi = 3.0*r + 5.0*c + 2.0
        // (normalized coords: rn = r/10, cn = c/10)
        let a_true = 3.0f64;
        let b_true = 5.0f64;
        let c0_true = 2.0f64;
        
        let unwrapped = Array2::from_shape_fn((rows, cols), |(r, c)| {
            let rn = r as f64 / rows as f64;
            let cn = c as f64 / cols as f64;
            (a_true * rn + b_true * cn + c0_true) as f32
        });

        let deramped = deramp_phase(&unwrapped, &coherence, 0.5);

        // Deramped phase should be zero everywhere (since it fits perfectly)
        for &val in deramped.iter() {
            assert!(val.abs() < 1e-4, "Expected close to 0, got {}", val);
        }
    }

    #[test]
    fn test_quadratic_deramping() {
        let (rows, cols) = (50, 50);
        let coherence = Array2::from_elem((rows, cols), 1.0f32);
        
        // Construct a quadratic surface: phi = 2*r² + 3*c² + 1*rc + 0.5*r + 0.3*c + 1.0
        let unwrapped = Array2::from_shape_fn((rows, cols), |(r, c)| {
            let rn = r as f64 / rows as f64;
            let cn = c as f64 / cols as f64;
            (2.0 * rn * rn + 3.0 * cn * cn + 1.0 * rn * cn + 0.5 * rn + 0.3 * cn + 1.0) as f32
        });

        let deramped = deramp_phase(&unwrapped, &coherence, 0.5);

        // Deramped phase should be zero everywhere
        for &val in deramped.iter() {
            assert!(val.abs() < 1e-3, "Expected close to 0, got {}", val);
        }
    }
}
