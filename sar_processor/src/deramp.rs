//! Phase deramping.
//!
//! Fits a 2D linear plane (a*row + b*col + c) to high-coherence pixels
//! in the unwrapped phase map, and subtracts it to isolate local structural deformation.
//! This resolves orbital/atmospheric phase ramps without external dependencies.

use log::{info, warn};
use ndarray::Array2;

/// Fits a 2D linear plane to high-coherence pixels and subtracts it from the unwrapped phase.
///
/// Coordinates are normalized to [0, 1] to prevent numerical instability with large matrices.
pub fn deramp_phase(
    unwrapped_phase: &Array2<f32>,
    coherence: &Array2<f32>,
    coherence_threshold: f32,
) -> Array2<f32> {
    let (rows, cols) = unwrapped_phase.dim();
    info!(
        "[DERAMP] Starting 2D linear deramp on {}×{} phase map (threshold={:.2})",
        rows, cols, coherence_threshold
    );

    // Sums for normal equations (A^T A) x = A^T y
    let mut sum_r2 = 0.0f64;
    let mut sum_rc = 0.0f64;
    let mut sum_r = 0.0f64;
    let mut sum_c2 = 0.0f64;
    let mut sum_c = 0.0f64;
    let mut num_pts = 0.0f64;

    let mut sum_r_phi = 0.0f64;
    let mut sum_c_phi = 0.0f64;
    let mut sum_phi = 0.0f64;

    for r in 0..rows {
        for c in 0..cols {
            let phi = unwrapped_phase[[r, c]];
            let coh = coherence[[r, c]];
            if !phi.is_nan() && coh >= coherence_threshold {
                // Normalize coordinates to [0, 1] for numeric stability
                let rn = r as f64 / rows as f64;
                let cn = c as f64 / cols as f64;
                let ph = phi as f64;

                sum_r2 += rn * rn;
                sum_rc += rn * cn;
                sum_r += rn;
                sum_c2 += cn * cn;
                sum_c += cn;
                num_pts += 1.0;

                sum_r_phi += rn * ph;
                sum_c_phi += cn * ph;
                sum_phi += ph;
            }
        }
    }

    if num_pts < 10.0 {
        warn!("[DERAMP] Insufficient high-coherence points ({:.0}) for plane fitting. Skipping deramp.", num_pts);
        return unwrapped_phase.clone();
    }

    // Solve the 3x3 linear system using Cramer's rule:
    // [ sum_r2  sum_rc  sum_r ] [ a ]   [ sum_r_phi ]
    // [ sum_rc  sum_c2  sum_c ] [ b ] = [ sum_c_phi ]
    // [ sum_r   sum_c   num   ] [ c0]   [ sum_phi   ]

    let m11 = sum_r2;  let m12 = sum_rc;  let m13 = sum_r;
    let m21 = sum_rc;  let m22 = sum_c2;  let m23 = sum_c;
    let m31 = sum_r;   let m32 = sum_c;   let m33 = num_pts;

    let b1 = sum_r_phi;
    let b2 = sum_c_phi;
    let b3 = sum_phi;

    // Helper: determinant of 3x3 matrix
    let det = |
        a11: f64, a12: f64, a13: f64,
        a21: f64, a22: f64, a23: f64,
        a31: f64, a32: f64, a33: f64,
    | -> f64 {
        a11 * (a22 * a33 - a23 * a32)
            - a12 * (a21 * a33 - a23 * a31)
            + a13 * (a21 * a32 - a22 * a31)
    };

    let main_det = det(m11, m12, m13, m21, m22, m23, m31, m32, m33);

    if main_det.abs() < 1e-12 {
        warn!("[DERAMP] Singular matrix in plane fitting (det={:.2e}). Skipping deramp.", main_det);
        return unwrapped_phase.clone();
    }

    let det_a = det(b1, m12, m13, b2, m22, m23, b3, m32, m33);
    let det_b = det(m11, b1, m13, m21, b2, m23, m31, b3, m33);
    let det_c = det(m11, m12, b1, m21, m22, b2, m31, m32, b3);

    let a = det_a / main_det;
    let b = det_b / main_det;
    let c0 = det_c / main_det;

    info!(
        "[DERAMP] Fitted plane: phi(r,c) = {:.4}*r + {:.4}*c + {:.4} (based on {:.0} points)",
        a, b, c0, num_pts
    );

    // Subtract plane from original phase
    let mut deramped = Array2::<f32>::zeros((rows, cols));
    for r in 0..rows {
        for c in 0..cols {
            let phi = unwrapped_phase[[r, c]];
            if phi.is_nan() {
                deramped[[r, c]] = f32::NAN;
            } else {
                let rn = r as f64 / rows as f64;
                let cn = c as f64 / cols as f64;
                let model = a * rn + b * cn + c0;
                deramped[[r, c]] = (phi as f64 - model) as f32;
            }
        }
    }

    deramped
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
            assert!(val.abs() < 1e-5, "Expected close to 0, got {}", val);
        }
    }
}
