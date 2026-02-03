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
/// This function performs RCMC by:
/// 1. For each range bin, calculate expected migration at each Doppler frequency
/// 2. Apply sinc interpolation to shift each range cell back to its zero-Doppler position
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
    let (num_range, num_azimuth) = range_doppler_data.dim();
    info!(
        "Applying RCMC: {}x{}, λ={:.3}m, v={:.0}m/s",
        num_range, num_azimuth, wavelength, velocity
    );

    let mut corrected = Array2::zeros((num_range, num_azimuth));

    // Range sample spacing in meters
    let c = 299792458.0_f32; // Speed of light
    let range_spacing = c / (2.0 * sample_rate);

    // Process each range line (now in Doppler domain)
    for range_idx in 0..num_range {
        // Calculate slant range for this bin
        let slant_range = near_range + (range_idx as f32) * range_spacing;

        // Extract the range line (all Doppler bins for this range)
        let range_line: Vec<Complex32> = (0..num_azimuth)
            .map(|az| range_doppler_data[[range_idx, az]])
            .collect();

        // For each Doppler frequency, calculate migration and create shifted line
        for doppler_idx in 0..num_azimuth {
            // Doppler frequency (centered)
            let doppler_freq =
                ((doppler_idx as f32) - (num_azimuth as f32 / 2.0)) * prf / (num_azimuth as f32);

            // Calculate range migration in samples
            let migration_meters = range_migration(doppler_freq, wavelength, velocity, slant_range);
            let migration_samples = migration_meters / range_spacing;

            // Apply shift via sinc interpolation (shift the opposite direction to correct)
            // For efficiency, we just compute the shifted value at this position
            let shifted_range_idx = range_idx as f32 + migration_samples;

            if shifted_range_idx >= 0.0 && shifted_range_idx < (num_range - 1) as f32 {
                // Integer and fractional indices
                let idx0 = shifted_range_idx.floor() as usize;
                let frac = shifted_range_idx - idx0 as f32;

                // Linear interpolation (faster than full sinc for now)
                let idx1 = (idx0 + 1).min(num_range - 1);
                let val = range_doppler_data[[idx0, doppler_idx]] * (1.0 - frac)
                    + range_doppler_data[[idx1, doppler_idx]] * frac;

                corrected[[range_idx, doppler_idx]] = val;
            } else {
                // Outside valid range, use original
                corrected[[range_idx, doppler_idx]] = range_doppler_data[[range_idx, doppler_idx]];
            }
        }
    }

    info!("RCMC Complete.");
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
