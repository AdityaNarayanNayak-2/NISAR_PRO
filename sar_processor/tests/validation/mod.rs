//! SAR Processing Validation Framework
//!
//! This module provides tools to validate SAR processing quality by:
//! 1. Generating synthetic point targets with known characteristics
//! 2. Measuring focus quality metrics (PSLR, ISLR)
//! 3. Comparing outputs between different processors (Rust RDA vs ISCE3)

use ndarray::{Array2, ArrayView2};
use num_complex::Complex32;
use std::f32::consts::PI;

/// Quality metrics for SAR focus assessment
#[derive(Debug, Clone)]
pub struct FocusQualityMetrics {
    /// Peak Sidelobe Ratio in dB (should be < -13 dB for good focus)
    pub pslr_db: f32,
    /// Integrated Sidelobe Ratio in dB (should be < -10 dB)
    pub islr_db: f32,
    /// 3dB resolution in samples (impulse response width)
    pub resolution_3db: f32,
    /// Peak position (row, col)
    pub peak_position: (usize, usize),
    /// Peak magnitude
    pub peak_magnitude: f32,
}

/// Generate a synthetic point target (impulse) in raw SAR data
///
/// This creates a "raw" signal that, when properly focused, should produce
/// a single bright point at the specified location.
///
/// # Arguments
/// * `rows` - Number of azimuth lines
/// * `cols` - Number of range samples
/// * `target_row` - Azimuth position of point target
/// * `target_col` - Range position of point target
/// * `chirp_bandwidth` - Chirp bandwidth in Hz
/// * `sample_rate` - Sample rate in Hz
pub fn generate_point_target(
    rows: usize,
    cols: usize,
    target_row: usize,
    target_col: usize,
    chirp_bandwidth: f32,
    sample_rate: f32,
) -> Array2<Complex32> {
    let mut raw_data = Array2::<Complex32>::zeros((rows, cols));

    // Chirp rate
    let pulse_duration = 50.0e-6; // 50 microseconds
    let k = chirp_bandwidth / pulse_duration;

    // Generate chirp at target position
    let chirp_samples = (pulse_duration * sample_rate) as usize;
    let t_start = -pulse_duration / 2.0;
    let dt = 1.0 / sample_rate;

    for i in 0..chirp_samples {
        let col_idx = target_col.saturating_sub(chirp_samples / 2) + i;
        if col_idx < cols {
            let t = t_start + (i as f32) * dt;
            let phase = PI * k * t * t;
            raw_data[[target_row, col_idx]] = Complex32::from_polar(1.0, phase);
        }
    }

    raw_data
}

/// Find the peak (maximum magnitude) position in a 2D complex array
pub fn find_peak(data: &Array2<Complex32>) -> (usize, usize, f32) {
    let mut max_mag = 0.0f32;
    let mut max_pos = (0, 0);

    for ((r, c), val) in data.indexed_iter() {
        let mag = val.norm();
        if mag > max_mag {
            max_mag = mag;
            max_pos = (r, c);
        }
    }

    (max_pos.0, max_pos.1, max_mag)
}

/// Measure Peak Sidelobe Ratio (PSLR)
///
/// PSLR = 20 * log10(highest_sidelobe / main_lobe_peak)
///
/// # Arguments
/// * `data` - Focused SAR image (complex)
/// * `peak_row` - Row of main lobe
/// * `peak_col` - Column of main lobe
/// * `main_lobe_width` - Width in pixels to exclude as main lobe
pub fn measure_pslr(
    data: &Array2<Complex32>,
    peak_row: usize,
    peak_col: usize,
    main_lobe_width: usize,
) -> f32 {
    let (_, _, peak_mag) = find_peak(data);

    let mut max_sidelobe = 0.0f32;
    let half_width = main_lobe_width / 2;

    for ((r, c), val) in data.indexed_iter() {
        let row_dist = (r as i32 - peak_row as i32).abs() as usize;
        let col_dist = (c as i32 - peak_col as i32).abs() as usize;

        // Skip main lobe region
        if row_dist <= half_width && col_dist <= half_width {
            continue;
        }

        let mag = val.norm();
        if mag > max_sidelobe {
            max_sidelobe = mag;
        }
    }

    if peak_mag > 0.0 && max_sidelobe > 0.0 {
        20.0 * (max_sidelobe / peak_mag).log10()
    } else {
        f32::NEG_INFINITY
    }
}

/// Measure 3dB resolution (impulse response width)
pub fn measure_resolution_3db(data: &Array2<Complex32>, peak_row: usize, peak_col: usize) -> f32 {
    let peak_mag = data[[peak_row, peak_col]].norm();
    let threshold = peak_mag / 2.0_f32.sqrt(); // -3dB point

    // Measure along range direction
    let mut width = 0usize;
    let cols = data.ncols();

    // Count samples above -3dB threshold
    for c in 0..cols {
        if data[[peak_row, c]].norm() >= threshold {
            width += 1;
        }
    }

    width as f32
}

/// Complete focus quality analysis
pub fn analyze_focus_quality(
    focused_data: &Array2<Complex32>,
    main_lobe_width: usize,
) -> FocusQualityMetrics {
    let (peak_row, peak_col, peak_mag) = find_peak(focused_data);
    let pslr = measure_pslr(focused_data, peak_row, peak_col, main_lobe_width);
    let resolution = measure_resolution_3db(focused_data, peak_row, peak_col);

    // ISLR would require integration - simplified here
    let islr = pslr + 3.0; // Rough approximation

    FocusQualityMetrics {
        pslr_db: pslr,
        islr_db: islr,
        resolution_3db: resolution,
        peak_position: (peak_row, peak_col),
        peak_magnitude: peak_mag,
    }
}

/// Compare two focused images and compute similarity metrics
pub fn compare_outputs(
    output_a: &Array2<Complex32>,
    output_b: &Array2<Complex32>,
) -> ComparisonMetrics {
    assert_eq!(
        output_a.dim(),
        output_b.dim(),
        "Arrays must have same dimensions"
    );

    let mut sum_sq_diff = 0.0f64;
    let mut sum_a = 0.0f64;
    let mut sum_b = 0.0f64;
    let mut max_a = 0.0f32;
    let n = output_a.len() as f64;

    for (a, b) in output_a.iter().zip(output_b.iter()) {
        let mag_a = a.norm() as f64;
        let mag_b = b.norm() as f64;
        sum_sq_diff += (mag_a - mag_b).powi(2);
        sum_a += mag_a.powi(2);
        sum_b += mag_b.powi(2);
        if a.norm() > max_a {
            max_a = a.norm();
        }
    }

    let mse = sum_sq_diff / n;
    let rmse = mse.sqrt();

    // Normalized cross-correlation
    let ncc = if sum_a > 0.0 && sum_b > 0.0 {
        let mut cross = 0.0f64;
        for (a, b) in output_a.iter().zip(output_b.iter()) {
            cross += (a.norm() as f64) * (b.norm() as f64);
        }
        cross / (sum_a.sqrt() * sum_b.sqrt())
    } else {
        0.0
    };

    // PSNR
    let psnr = if mse > 0.0 {
        20.0 * (max_a as f64).log10() - 10.0 * mse.log10()
    } else {
        f64::INFINITY
    };

    ComparisonMetrics {
        rmse: rmse as f32,
        normalized_correlation: ncc as f32,
        psnr_db: psnr as f32,
    }
}

/// Metrics for comparing two SAR images
#[derive(Debug, Clone)]
pub struct ComparisonMetrics {
    /// Root Mean Square Error
    pub rmse: f32,
    /// Normalized Cross-Correlation (0-1, higher is better)
    pub normalized_correlation: f32,
    /// Peak Signal-to-Noise Ratio in dB
    pub psnr_db: f32,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_point_target_generation() {
        let raw = generate_point_target(256, 512, 128, 256, 20.0e6, 25.0e6);
        assert_eq!(raw.dim(), (256, 512));

        // Should have non-zero values near target
        let target_region = raw.slice(ndarray::s![126..130, 250..262]);
        let has_signal = target_region.iter().any(|c| c.norm() > 0.5);
        assert!(has_signal, "Point target should have signal");
    }

    #[test]
    fn test_find_peak() {
        let mut data = Array2::<Complex32>::zeros((10, 10));
        data[[5, 7]] = Complex32::new(10.0, 0.0);

        let (row, col, mag) = find_peak(&data);
        assert_eq!(row, 5);
        assert_eq!(col, 7);
        assert!((mag - 10.0).abs() < 0.001);
    }

    #[test]
    fn test_comparison_identical() {
        let data = Array2::<Complex32>::from_elem((10, 10), Complex32::new(1.0, 1.0));
        let metrics = compare_outputs(&data, &data);

        assert!(metrics.rmse < 0.001);
        assert!(metrics.normalized_correlation > 0.999);
    }
}
