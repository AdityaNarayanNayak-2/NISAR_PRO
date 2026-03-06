//! NISAR HDF5 Product Parser
//!
//! Parses NISAR Beta RSLC (and GSLC) HDF5 files into complex arrays
//! suitable for the RDA processing pipeline.
//!
//! NISAR L-band RSLC data hierarchy:
//! ```text
//! /science/LSAR/RSLC/
//!   swaths/
//!     frequencyA/
//!       HH        ← complex SLC stored as interleaved float32 [az × rg × 2]
//!       HV
//!       VH
//!       VV
//!   metadata/
//!     processingInformation/parameters/
//!       centerFrequency        (Hz, f64)
//!       rangeBandwidth         (Hz, f64)
//!       chirpDuration          (s,  f64)
//!       rangeChirpRate         (Hz/s, f64)
//!       nominalAcquisitionPRF  (Hz, f64)
//! ```

use anyhow::{bail, Context, Result};
use log::info;
use ndarray::Array2;
use num_complex::Complex32;
use rustyhdf5::File;
use std::path::Path;

// ───────────────────────────────────────────────────────────────────────────
// Public types
// ───────────────────────────────────────────────────────────────────────────

/// Radar acquisition parameters extracted from NISAR metadata
#[derive(Debug, Clone)]
pub struct NisarRadarParams {
    /// Center frequency (Hz) — L-band ≈ 1.2575 GHz
    pub center_frequency: f64,
    /// Range bandwidth (Hz)
    pub range_bandwidth: f64,
    /// Chirp duration (s)
    pub pulse_duration: f64,
    /// Range chirp rate (Hz/s)
    pub chirp_rate: f64,
    /// Nominal PRF (Hz)
    pub prf: f64,
    /// Sample rate: typically 1.2× bandwidth (Hz)
    pub sample_rate: f64,
}

/// A parsed NISAR product ready for the RDA pipeline
pub struct NisarProduct {
    /// Complex SLC array [azimuth × range]
    pub slc: Array2<Complex32>,
    /// Radar parameters from file metadata
    pub params: NisarRadarParams,
    /// Polarization channel actually read
    pub polarization: String,
}

// ───────────────────────────────────────────────────────────────────────────
// Main Entry Point
// ───────────────────────────────────────────────────────────────────────────

/// Parse a NISAR RSLC HDF5 file and return a product ready for the RDA pipeline.
///
/// # Arguments
/// * `path`         — path to the `.h5` RSLC file
/// * `polarization` — e.g. `"HH"`, `"VV"`, `"HV"` (case-insensitive)
pub fn parse_nisar_rslc(path: &Path, polarization: &str) -> Result<NisarProduct> {
    let pol = polarization.to_uppercase();
    info!("Opening NISAR HDF5: {:?} (pol={})", path, pol);

    let file = File::open(path).with_context(|| format!("Failed to open HDF5 file: {:?}", path))?;

    // ── 1. Read metadata ──────────────────────────────────────────────────
    let params = extract_radar_params(&file)
        .context("Failed to extract NISAR radar parameters from metadata")?;

    info!(
        "NISAR params: fc={:.3} GHz  BW={:.1} MHz  PRF={:.1} Hz  pulse={:.2} µs",
        params.center_frequency / 1e9,
        params.range_bandwidth / 1e6,
        params.prf,
        params.pulse_duration * 1e6,
    );

    // ── 2. Read SLC complex data ──────────────────────────────────────────
    let slc_path = format!("/science/LSAR/RSLC/swaths/frequencyA/{}", pol);
    info!("Reading SLC from HDF5 path: {}", slc_path);

    let slc = read_complex_dataset(&file, &slc_path)
        .with_context(|| format!("Failed to read SLC dataset '{}'. Check polarization.", pol))?;

    info!(
        "SLC loaded: {} azimuth lines × {} range samples",
        slc.nrows(),
        slc.ncols()
    );

    Ok(NisarProduct {
        slc,
        params,
        polarization: pol,
    })
}

// ───────────────────────────────────────────────────────────────────────────
// Internal helpers
// ───────────────────────────────────────────────────────────────────────────

/// Extract radar timing/frequency parameters from NISAR metadata group.
/// Falls back to L-band NISAR defaults for any missing fields
/// (common in Beta pre-calibration products).
fn extract_radar_params(file: &File) -> Result<NisarRadarParams> {
    let base = "/science/LSAR/RSLC/metadata/processingInformation/parameters";

    let center_frequency =
        read_scalar_f64(file, &format!("{}/centerFrequency", base)).unwrap_or(1_257_500_000.0); // 1.2575 GHz L-band

    let range_bandwidth =
        read_scalar_f64(file, &format!("{}/rangeBandwidth", base)).unwrap_or(80_000_000.0); // 80 MHz

    let pulse_duration =
        read_scalar_f64(file, &format!("{}/chirpDuration", base)).unwrap_or(40.0e-6); // 40 µs

    let chirp_rate = read_scalar_f64(file, &format!("{}/rangeChirpRate", base))
        .unwrap_or(range_bandwidth / pulse_duration);

    let prf = read_scalar_f64(file, &format!("{}/nominalAcquisitionPRF", base)).unwrap_or(1_600.0); // 1600 Hz

    let sample_rate = read_scalar_f64(file, &format!("{}/rangeSamplingFrequency", base))
        .unwrap_or(range_bandwidth * 1.2); // 20% oversampling

    Ok(NisarRadarParams {
        center_frequency,
        range_bandwidth,
        pulse_duration,
        chirp_rate,
        prf,
        sample_rate,
    })
}

/// Read a scalar f64 from an HDF5 dataset.
/// Returns None if the dataset is missing or cannot be read.
fn read_scalar_f64(file: &File, path: &str) -> Option<f64> {
    let dataset = file.dataset(path).ok()?;
    dataset.read_f64().ok()?.into_iter().next()
}

/// Read a complex float32 SLC dataset.
///
/// NISAR stores SLC data as flat interleaved float32 (re, im, re, im, …)
/// in row-major (azimuth-major) order. The HDF5 dataset shape is [n_az, n_rg]
/// but the actual data length is n_az × n_rg × 2 float32 values.
fn read_complex_dataset(file: &File, path: &str) -> Result<Array2<Complex32>> {
    let dataset = file
        .dataset(path)
        .with_context(|| format!("HDF5 dataset not found: {}", path))?;

    // Shape returns [n_az, n_rg] for a 2-D SLC
    let shape = dataset
        .shape()
        .with_context(|| format!("Cannot read shape of dataset '{}'", path))?;

    if shape.len() != 2 {
        bail!(
            "Expected 2D SLC dataset at '{}', got {}D",
            path,
            shape.len()
        );
    }
    let n_az = shape[0] as usize;
    let n_rg = shape[1] as usize;

    info!("  SLC shape: {} azimuth × {} range", n_az, n_rg);

    // Read as f32 — interleaved (re, im) pairs
    let raw: Vec<f32> = dataset
        .read_f32()
        .with_context(|| format!("Failed to read float32 data from '{}'", path))?;

    // Validate: each complex sample = 2 × f32 values
    let expected = n_az * n_rg * 2;
    if raw.len() != expected {
        bail!(
            "Dataset '{}' size mismatch: got {} f32 values, expected {} ({}×{}×2)",
            path,
            raw.len(),
            expected,
            n_az,
            n_rg
        );
    }

    let complex_vec: Vec<Complex32> = raw
        .chunks_exact(2)
        .map(|pair| Complex32::new(pair[0], pair[1]))
        .collect();

    Array2::from_shape_vec((n_az, n_rg), complex_vec)
        .context("Failed to reshape SLC data into 2D array")
}

// ───────────────────────────────────────────────────────────────────────────
// Unit Tests
// ───────────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    /// Verify L-band wavelength is physically correct (~23.8 cm)
    #[test]
    fn test_l_band_wavelength() {
        let fc = 1_257_500_000.0_f64; // 1.2575 GHz
        let wavelength = 3e8 / fc;
        assert!(
            wavelength > 0.237 && wavelength < 0.240,
            "L-band λ should be ≈23.8 cm, got {:.4} m",
            wavelength
        );
    }

    /// Verify that interleaved (re,im) → Complex32 conversion is correct
    #[test]
    fn test_complex_interleaving() {
        let raw: Vec<f32> = vec![
            1.0, 2.0, // [0,0]: 1+2i
            3.0, 4.0, // [0,1]: 3+4i
            5.0, 6.0, // [0,2]: 5+6i
            7.0, 8.0, // [1,0]: 7+8i
            9.0, 10.0, // [1,1]: 9+10i
            11.0, 12.0, // [1,2]: 11+12i
        ];
        let complex_vec: Vec<Complex32> = raw
            .chunks_exact(2)
            .map(|pair| Complex32::new(pair[0], pair[1]))
            .collect();
        let arr = Array2::from_shape_vec((2, 3), complex_vec).unwrap();
        assert_eq!(arr[[0, 0]], Complex32::new(1.0, 2.0));
        assert_eq!(arr[[1, 2]], Complex32::new(11.0, 12.0));
    }

    /// Default params should produce sensible physical values
    #[test]
    fn test_default_params_are_reasonable() {
        let bw = 80_000_000.0_f64;
        let tau = 40.0e-6_f64;
        let chirp_rate = bw / tau; // 2e12 Hz/s
        assert!(chirp_rate > 1e12 && chirp_rate < 1e13);

        let fs = bw * 1.2; // 96 MHz sample rate
        assert!(fs > bw, "Sample rate must exceed bandwidth (Nyquist)");
    }
}
