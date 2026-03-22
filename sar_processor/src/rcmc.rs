//! Range Cell Migration Correction (RCMC)
//!
//! RCMC compensates for the range migration that occurs during SAR data
//! acquisition. As the platform moves, the distance to a target changes,
//! causing the target response to "walk" across range cells.
//!
//! This module implements:
//! - Sinc interpolation for sub-pixel shifting
//! - Range migration trajectory calculation
//! - RCMC in range-Doppler domain

use log::info;
use ndarray::Array2;
use num_complex::Complex32;
use std::f32::consts::PI;

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
///
/// # Arguments
/// * `shift` - Fractional shift amount (e.g., 0.3 means shift by 0.3 pixels)
/// * `kernel_size` - Number of kernel points (even number)
fn generate_sinc_kernel(shift: f32, kernel_size: usize) -> Vec<f32> {
    let half = kernel_size as i32 / 2;
    let mut kernel = Vec::with_capacity(kernel_size);

    for i in 0..kernel_size as i32 {
        let x = (i - half) as f32 - shift;

        // Sinc function
        let sinc_val = sinc(x);

        // Hamming window for smoother response
        let n = (i as f32) / (kernel_size as f32 - 1.0);
        let window = 0.54 - 0.46 * (2.0 * PI * n).cos();

        kernel.push(sinc_val * window);
    }

    // Normalize kernel
    let sum: f32 = kernel.iter().sum();
    if sum.abs() > 1e-10 {
        for k in &mut kernel {
            *k /= sum;
        }
    }

    kernel
}

/// Apply sinc interpolation to shift a signal by a fractional amount
///
/// # Arguments
/// * `signal` - Input complex signal
/// * `shift` - Shift amount in pixels (can be fractional)
///
/// # Returns
/// Shifted signal of same length
pub fn sinc_interpolate_shift(signal: &[Complex32], shift: f32) -> Vec<Complex32> {
    let n = signal.len();
    let mut output = vec![Complex32::new(0.0, 0.0); n];

    // Integer and fractional parts
    let int_shift = shift.floor() as i32;
    let frac_shift = shift - shift.floor();

    // Generate kernel for fractional shift
    let kernel = generate_sinc_kernel(frac_shift, SINC_KERNEL_SIZE);
    let half_kernel = SINC_KERNEL_SIZE as i32 / 2;

    for i in 0..n as i32 {
        let mut sum = Complex32::new(0.0, 0.0);

        for (k_idx, &k_val) in kernel.iter().enumerate() {
            let src_idx = i - int_shift - (k_idx as i32 - half_kernel);

            // Handle boundaries with zero-padding
            if src_idx >= 0 && src_idx < n as i32 {
                sum += signal[src_idx as usize] * k_val;
            }
        }

        output[i as usize] = sum;
    }

    output
}

/// Calculate range migration trajectory for a given Doppler frequency
///
/// The range migration varies with Doppler frequency according to:
/// ΔR(f_η) = R₀ * (1/√(1-(λf_η/(2v))²) - 1)
///
/// For small angles, this simplifies to:
/// ΔR(f_η) ≈ R₀ * (λf_η)² / (8v²)
///
/// # Arguments
/// * `doppler_freq` - Doppler frequency in Hz
/// * `wavelength` - Radar wavelength in meters
/// * `velocity` - Platform velocity in m/s
/// * `range_to_target` - Slant range in meters
///
/// # Returns
/// Range shift in meters
pub fn range_migration(
    doppler_freq: f32,
    wavelength: f32,
    velocity: f32,
    range_to_target: f32,
) -> f32 {
    let term = wavelength * doppler_freq / (2.0 * velocity);

    if term.abs() >= 1.0 {
        // Beyond valid range
        0.0
    } else {
        range_to_target * (1.0 / (1.0 - term * term).sqrt() - 1.0)
    }
}

/// Apply Range Cell Migration Correction to range-Doppler domain data
///
/// Uses full sinc interpolation (8-point Hamming-windowed kernel) per Doppler
/// column — the SAR-standard approach. Shift is calculated at the center range
/// for each Doppler frequency (excellent approximation for NISAR/Sentinel-1
/// swaths where variation across range is small).
///
/// # Arguments
/// * `range_doppler_data` - Data in range-Doppler domain [Range x Doppler]
/// * `sample_rate` - Range sample rate in Hz
/// * `prf` - Pulse Repetition Frequency in Hz
/// * `wavelength` - Radar wavelength in meters
/// * `velocity` - Platform velocity in m/s (default ~7500 m/s for LEO)
/// * `near_range` - Slant range to first sample in meters
///
/// # Returns
/// RCMC-corrected data in range-Doppler domain
pub fn apply_rcmc(
    range_doppler_data: &Array2<Complex32>,
    sample_rate: f32,
    prf: f32,
    wavelength: f32,
    velocity: f32,
    near_range: f32,
) -> Array2<Complex32> {
    let (num_range, num_doppler) = range_doppler_data.dim();
    info!(
        "Applying RCMC with SINC interpolation: {}×{}, λ={:.3}m, v={:.0}m/s",
        num_range, num_doppler, wavelength, velocity
    );

    let mut corrected = Array2::zeros((num_range, num_doppler));

    // Range sample spacing in meters
    let c = 299792458.0_f32;
    let range_spacing = c / (2.0 * sample_rate);

    // Process column-by-column (fixed Doppler frequency per column)
    // This is the SAR-standard way and is much more cache-friendly
    for doppler_idx in 0..num_doppler {
        // Doppler frequency (centered)
        let doppler_freq =
            ((doppler_idx as f32) - (num_doppler as f32 / 2.0)) * prf / (num_doppler as f32);

        // Extract the full range column for this Doppler bin
        let range_column: Vec<Complex32> = (0..num_range)
            .map(|r| range_doppler_data[[r, doppler_idx]])
            .collect();

        // Calculate migration shift at center range (excellent approximation)
        let center_range_idx = num_range / 2;
        let slant_range = near_range + (center_range_idx as f32) * range_spacing;
        let migration_meters = range_migration(doppler_freq, wavelength, velocity, slant_range);
        let migration_samples = migration_meters / range_spacing;

        // Shift the entire range column with sinc kernel (opposite direction to correct)
        let shifted_column = sinc_interpolate_shift(&range_column, -migration_samples);

        // Write back to corrected matrix
        for r in 0..num_range {
            corrected[[r, doppler_idx]] = shifted_column[r];
        }
    }

    info!("RCMC with sinc interpolation complete.");
    corrected
}

/// RCMC parameters structure
#[derive(Debug, Clone)]
pub struct RcmcParams {
    pub wavelength: f32,
    pub velocity: f32,
    pub near_range: f32,
}

impl RcmcParams {
    /// Create default parameters for Sentinel-1 C-band
    pub fn sentinel1_default() -> Self {
        Self {
            wavelength: 0.0555,    // C-band: ~5.55 cm
            velocity: 7500.0,      // LEO orbital velocity
            near_range: 800_000.0, // ~800 km typical
        }
    }

    /// Create from carrier frequency
    pub fn from_frequency(carrier_freq: f32, velocity: f32, near_range: f32) -> Self {
        let c = 299792458.0_f32;
        Self {
            wavelength: c / carrier_freq,
            velocity,
            near_range,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sinc_at_zero() {
        assert!((sinc(0.0) - 1.0).abs() < 1e-6);
    }

    #[test]
    fn test_sinc_at_integer() {
        // sinc(n) = 0 for non-zero integers
        assert!(sinc(1.0).abs() < 1e-6);
        assert!(sinc(-2.0).abs() < 1e-6);
    }

    #[test]
    fn test_kernel_normalization() {
        let kernel = generate_sinc_kernel(0.0, 8);
        let sum: f32 = kernel.iter().sum();
        assert!(
            (sum - 1.0).abs() < 1e-5,
            "Kernel should sum to 1, got {}",
            sum
        );
    }

    #[test]
    fn test_zero_shift_identity() {
        let signal = vec![
            Complex32::new(1.0, 0.0),
            Complex32::new(2.0, 1.0),
            Complex32::new(3.0, -1.0),
            Complex32::new(0.0, 2.0),
        ];

        let shifted = sinc_interpolate_shift(&signal, 0.0);

        // With zero shift, output should approximately equal input
        for (orig, shifted) in signal.iter().zip(shifted.iter()) {
            assert!(
                (orig - shifted).norm() < 0.2,
                "Zero shift should preserve signal"
            );
        }
    }

    #[test]
    fn test_range_migration_zero_doppler() {
        // At zero Doppler, migration should be zero
        let migration = range_migration(0.0, 0.055, 7500.0, 800_000.0);
        assert!(migration.abs() < 1e-6);
    }
}
