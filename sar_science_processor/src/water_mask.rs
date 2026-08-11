//! Water body masking to suppress phase decorrelation over reservoirs, lakes, and rivers.
//!
//! Provides two methods:
//! 1. Adaptive Intensity Thresholding: Identifies water based on low SAR backscatter intensity (specular reflection).
//! 2. External SWBD Mask (.wbd): Reads raw SRTM Water Body Data binary files (1201x1201 or 3601x3601 bytes).

use anyhow::{Context, Result};
use log::{info, warn};
use ndarray::Array2;
use num_complex::Complex32;
use std::path::Path;

/// Applies a water mask to the coherence map by setting coherence to 0.0 for water pixels.
pub fn apply_intensity_water_mask(
    coherence: &mut Array2<f32>,
    ml_master: &Array2<Complex32>,
    threshold_factor: f32,
) {
    let (rows, cols) = coherence.dim();
    assert_eq!(ml_master.dim(), coherence.dim(), "Master and coherence dimensions must match");

    // 1. Compute pixel intensities and scene mean intensity
    let mut intensities = Array2::<f32>::zeros((rows, cols));
    let mut sum_intensity = 0.0f64;
    let mut count = 0.0f64;

    for r in 0..rows {
        for c in 0..cols {
            let p = ml_master[[r, c]];
            let intensity = p.re * p.re + p.im * p.im;
            intensities[[r, c]] = intensity;
            if intensity.is_finite() {
                sum_intensity += intensity as f64;
                count += 1.0;
            }
        }
    }

    if count == 0.0 {
        warn!("[WATER_MASK] Empty or invalid intensity values. Skipping intensity mask.");
        return;
    }

    let mean_intensity = (sum_intensity / count) as f32;
    let threshold = mean_intensity * threshold_factor;

    info!(
        "[WATER_MASK] Applying intensity mask. Mean={:.2e}, Threshold={:.2e} (factor={})",
        mean_intensity, threshold, threshold_factor
    );

    let mut masked_count = 0;
    for r in 0..rows {
        for c in 0..cols {
            if intensities[[r, c]] < threshold {
                coherence[[r, c]] = 0.0;
                masked_count += 1;
            }
        }
    }

    info!(
        "[WATER_MASK] Masked {}/{} pixels ({:.1}%) as water using adaptive thresholding",
        masked_count,
        rows * cols,
        100.0 * (masked_count as f32) / ((rows * cols) as f32)
    );
}

/// Reads an SRTM SWBD (.wbd) binary water mask file.
///
/// SWBD files are raw byte grids representing water coverage:
/// - 0: Ocean or deep water body
/// - 255: Land / dry terrain
/// Sizes are 1201×1201 (3 arc-sec) or 3601×3601 (1 arc-sec).
pub fn read_swbd_wbd(path: &Path) -> Result<Array2<u8>> {
    let data = std::fs::read(path)
        .with_context(|| format!("Failed to read SWBD file: {}", path.display()))?;

    let n_pixels = data.len();
    let side = (n_pixels as f64).sqrt() as usize;

    anyhow::ensure!(
        side * side == n_pixels && (side == 1201 || side == 3601),
        "Invalid SWBD file size: {} bytes (expected 1201² or 3601²)",
        n_pixels
    );

    info!(
        "[WATER_MASK] Read SWBD file {}: {}×{} grid",
        path.display(),
        side,
        side
    );

    let mut mask = Array2::<u8>::zeros((side, side));
    for r in 0..side {
        for c in 0..side {
            mask[[r, c]] = data[r * side + c];
        }
    }

    Ok(mask)
}

/// Applies an external SWBD water mask to the coherence map.
///
/// Resizes/maps the SWBD grid to match the coherence array dimensions.
pub fn apply_external_water_mask(
    coherence: &mut Array2<f32>,
    swbd_mask: &Array2<u8>,
) {
    let (coh_rows, coh_cols) = coherence.dim();
    let (mask_rows, mask_cols) = swbd_mask.dim();

    info!(
        "[WATER_MASK] Applying external SWBD mask (size {}×{} to target {}×{})",
        mask_rows, mask_cols, coh_rows, coh_cols
    );

    let mut masked_count = 0;
    for r in 0..coh_rows {
        for c in 0..coh_cols {
            // Map coherence coordinates to mask coordinates (nearest-neighbor)
            let mr = (r * mask_rows / coh_rows).min(mask_rows - 1);
            let mc = (c * mask_cols / coh_cols).min(mask_cols - 1);

            let val = swbd_mask[[mr, mc]];
            // 0 or 251/252 are standard water values, 255 is land. Let's treat anything != 255 as potential water.
            if val != 255 {
                coherence[[r, c]] = 0.0;
                masked_count += 1;
            }
        }
    }

    info!(
        "[WATER_MASK] Masked {}/{} pixels ({:.1}%) as water using external SWBD file",
        masked_count,
        coh_rows * coh_cols,
        100.0 * (masked_count as f32) / ((coh_rows * coh_cols) as f32)
    );
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_intensity_masking() {
        let (rows, cols) = (10, 10);
        let mut coherence = Array2::from_elem((rows, cols), 0.8f32);
        
        // Setup: master with high values, except center 4 pixels which are very low (water)
        let mut ml_master = Array2::from_elem((rows, cols), Complex32::new(10.0, 10.0));
        ml_master[[4, 4]] = Complex32::new(0.1, 0.1);
        ml_master[[4, 5]] = Complex32::new(0.1, 0.1);
        ml_master[[5, 4]] = Complex32::new(0.1, 0.1);
        ml_master[[5, 5]] = Complex32::new(0.1, 0.1);

        // Apply intensity water mask with 10% threshold factor
        apply_intensity_water_mask(&mut coherence, &ml_master, 0.1);

        // Center pixels should be masked to 0.0 coherence
        assert_eq!(coherence[[4, 4]], 0.0);
        assert_eq!(coherence[[5, 5]], 0.0);
        
        // Edge pixels should remain 0.8 coherence
        assert_eq!(coherence[[0, 0]], 0.8);
    }
}
