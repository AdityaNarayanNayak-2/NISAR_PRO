//! Pauli Decomposition for Polarimetric SAR (PolSAR)
//!
//! Synthesizes multi-polarization HDF5 channels into RGB color composites
//! using the Pauli basis decomposition:
//!   - Red   = |HH - VV| (double-bounce: buildings, man-made structures)
//!   - Green = |HV|      (volume scattering: vegetation, forests)
//!   - Blue  = |HH + VV| (surface scattering: water, flat terrain)
//!
//! Reference: Cloude, S.R. & Pottier, E. (1996) "A Review of Target
//! Decomposition Theorems in Radar Polarimetry"

use image::{ImageBuffer, Rgb};
use log::info;
use ndarray::{Array2, ArrayView2};
use num_complex::Complex32;
use rayon::prelude::*;

/// Pauli decomposition result containing the three scattering mechanism channels
pub struct PauliDecomposition {
    /// |HH - VV|: Double-bounce scattering (urban structures, dihedrals)
    pub double_bounce: Array2<f32>,
    /// |HV|: Volume scattering (vegetation canopy, rough surfaces)
    pub volume: Array2<f32>,
    /// |HH + VV|: Single/surface scattering (water, smooth surfaces)
    pub surface: Array2<f32>,
}

/// Compute the Pauli Decomposition from dual-pol or quad-pol channels.
///
/// For quad-pol data (HH, HV, VH, VV):
///   Red   = |HH - VV| / sqrt(2)
///   Green = |HV + VH| / sqrt(2)  (or 2|HV| if VH ≈ HV by reciprocity)
///   Blue  = |HH + VV| / sqrt(2)
///
/// For dual-pol data (HH, HV only):
///   Red   = |HH| (approximation — no VV available)
///   Green = |HV|
///   Blue  = |HH| (repeated — limited decomposition)
pub fn pauli_decompose(
    hh: &ArrayView2<Complex32>,
    hv: &ArrayView2<Complex32>,
    vv: Option<&ArrayView2<Complex32>>,
) -> PauliDecomposition {
    let (rows, cols) = hh.dim();
    info!("Pauli Decomposition: {}×{} ({})", rows, cols,
        if vv.is_some() { "Quad-pol" } else { "Dual-pol" });

    let mut double_bounce = Array2::<f32>::zeros((rows, cols));
    let mut volume = Array2::<f32>::zeros((rows, cols));
    let mut surface = Array2::<f32>::zeros((rows, cols));

    let sqrt2_inv = 1.0_f32 / 2.0_f32.sqrt();

    match vv {
        Some(vv_data) => {
            // Full quad-pol Pauli decomposition
            double_bounce.axis_iter_mut(ndarray::Axis(0))
                .into_par_iter()
                .zip(volume.axis_iter_mut(ndarray::Axis(0)).into_par_iter())
                .zip(surface.axis_iter_mut(ndarray::Axis(0)).into_par_iter())
                .enumerate()
                .for_each(|(r, ((mut db_row, mut vol_row), mut surf_row))| {
                    for c in 0..cols {
                        let hh_val = hh[[r, c]];
                        let hv_val = hv[[r, c]];
                        let vv_val = vv_data[[r, c]];

                        // |HH - VV| / sqrt(2) → double bounce
                        db_row[c] = (hh_val - vv_val).norm() * sqrt2_inv;

                        // |2 * HV| / sqrt(2) = |HV| * sqrt(2)
                        // (using reciprocity: VH ≈ HV, so HV + VH ≈ 2*HV)
                        vol_row[c] = hv_val.norm() * 2.0_f32.sqrt();

                        // |HH + VV| / sqrt(2) → surface scattering
                        surf_row[c] = (hh_val + vv_val).norm() * sqrt2_inv;
                    }
                });
        }
        None => {
            // Dual-pol fallback: HH as proxy for both double-bounce and surface
            double_bounce.axis_iter_mut(ndarray::Axis(0))
                .into_par_iter()
                .zip(volume.axis_iter_mut(ndarray::Axis(0)).into_par_iter())
                .zip(surface.axis_iter_mut(ndarray::Axis(0)).into_par_iter())
                .enumerate()
                .for_each(|(r, ((mut db_row, mut vol_row), mut surf_row))| {
                    for c in 0..cols {
                        let hh_val = hh[[r, c]];
                        let hv_val = hv[[r, c]];

                        db_row[c] = hh_val.norm();
                        vol_row[c] = hv_val.norm();
                        surf_row[c] = hh_val.norm();
                    }
                });
        }
    }

    info!("Pauli Decomposition complete.");
    PauliDecomposition {
        double_bounce,
        volume,
        surface,
    }
}

/// Render a Pauli RGB composite image to PNG.
///
/// Each channel is independently stretched using a 2nd–98th percentile
/// contrast stretch followed by gamma correction, then mapped to
/// R (double-bounce), G (volume), B (surface).
pub fn save_pauli_rgb(
    decomposition: &PauliDecomposition,
    output_filename: &str,
    gamma: f32,
) -> Result<(), Box<dyn std::error::Error>> {
    let (rows, cols) = decomposition.double_bounce.dim();
    info!("Rendering Pauli RGB composite: {}×{} → {}", rows, cols, output_filename);

    // Stretch each channel independently
    let r_pixels = stretch_channel(&decomposition.double_bounce, gamma);
    let g_pixels = stretch_channel(&decomposition.volume, gamma);
    let b_pixels = stretch_channel(&decomposition.surface, gamma);

    let mut img: ImageBuffer<Rgb<u8>, Vec<u8>> = ImageBuffer::new(cols as u32, rows as u32);
    for (idx, pixel) in img.pixels_mut().enumerate() {
        *pixel = Rgb([r_pixels[idx], g_pixels[idx], b_pixels[idx]]);
    }

    img.save(output_filename)?;
    info!("Pauli RGB composite saved: {}", output_filename);
    Ok(())
}

/// Independent percentile-based contrast stretch for a single channel.
fn stretch_channel(channel: &Array2<f32>, gamma: f32) -> Vec<u8> {
    let (rows, cols) = channel.dim();

    // Log-scale the intensity values
    let log_vals: Vec<f32> = channel.iter()
        .map(|&v| if v > 0.0 && v.is_finite() { (v + 1e-10).log10() } else { f32::NAN })
        .collect();

    // Compute percentile stretch bounds
    let mut sorted: Vec<f32> = log_vals.iter().copied().filter(|v| v.is_finite()).collect();
    sorted.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));

    if sorted.is_empty() {
        return vec![0u8; rows * cols];
    }

    let n = sorted.len();
    let p2 = sorted[((n as f32 * 0.02) as usize).min(n.saturating_sub(1))];
    let p98 = sorted[((n as f32 * 0.98) as usize).min(n.saturating_sub(1))];
    let range = (p98 - p2).max(1e-6);

    log_vals.iter()
        .map(|&v| {
            if !v.is_finite() {
                return 0u8;
            }
            let normalized = ((v - p2) / range).clamp(0.0, 1.0);
            let corrected = normalized.powf(gamma);
            (corrected * 255.0) as u8
        })
        .collect()
}
