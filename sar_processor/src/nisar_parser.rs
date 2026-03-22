//! NISAR HDF5 Product Parser
//!
//! Parses NISAR Beta products (RSLC, GSLC, GCOV, GUNW) into arrays
//! suitable for the processing and visualization pipeline.
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
    /// For GCOV products, the diagonal term (e.g. HHHH) is stored as
    /// magnitude in the real part with zero imaginary.
    pub slc: Array2<Complex32>,
    /// Radar parameters from file metadata
    pub params: NisarRadarParams,
    /// Polarization channel actually read
    pub polarization: String,
    /// Product type detected from filename
    pub product_type: NisarProductType,
}

/// NISAR product type, auto-detected from filename
#[derive(Debug, Clone, PartialEq)]
pub enum NisarProductType {
    RSLC, // Level-1 Range-Doppler SLC (radar coords)
    GSLC, // Level-2 Geocoded SLC (map coords)
    GCOV, // Level-2 Geocoded Polarimetric Covariance
    GUNW, // Level-2 Geocoded Unwrapped Interferogram
}

// ───────────────────────────────────────────────────────────────────────────
// Main Entry Point
// ───────────────────────────────────────────────────────────────────────────

/// Auto-detect product type from filename and parse accordingly.
///
/// Supports: RSLC, GSLC, GCOV, GUNW
pub fn parse_nisar_auto(path: &Path, polarization: &str) -> Result<NisarProduct> {
    let filename = path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("");

    let product_type = if filename.contains("_RSLC_") {
        NisarProductType::RSLC
    } else if filename.contains("_GSLC_") {
        NisarProductType::GSLC
    } else if filename.contains("_GCOV_") {
        NisarProductType::GCOV
    } else if filename.contains("_GUNW_") {
        NisarProductType::GUNW
    } else {
        info!("Cannot detect product type from filename, assuming RSLC");
        NisarProductType::RSLC
    };

    info!("Detected NISAR product type: {:?}", product_type);

    match product_type {
        NisarProductType::RSLC => parse_nisar_rslc(path, polarization),
        NisarProductType::GSLC => parse_nisar_gslc(path, polarization),
        NisarProductType::GCOV => parse_nisar_gcov(path, polarization),
        NisarProductType::GUNW => parse_nisar_gunw(path, polarization),
    }
}

/// Parse a NISAR RSLC HDF5 file (Level-1, radar coordinates)
pub fn parse_nisar_rslc(path: &Path, polarization: &str) -> Result<NisarProduct> {
    let pol = polarization.to_uppercase();
    info!("Opening NISAR RSLC: {:?} (pol={})", path, pol);

    let file = File::open(path).with_context(|| format!("Failed to open HDF5 file: {:?}", path))?;
    let params = extract_radar_params(&file, "RSLC")?;

    let slc_path = format!("/science/LSAR/RSLC/swaths/frequencyA/{}", pol);
    let slc = read_complex_dataset(&file, &slc_path)?;

    info!("RSLC loaded: {} × {}", slc.nrows(), slc.ncols());
    Ok(NisarProduct { slc, params, polarization: pol, product_type: NisarProductType::RSLC })
}

/// Parse a NISAR GSLC HDF5 file (Level-2, geocoded SLC)
fn parse_nisar_gslc(path: &Path, polarization: &str) -> Result<NisarProduct> {
    let pol = polarization.to_uppercase();
    info!("Opening NISAR GSLC: {:?} (pol={})", path, pol);

    let file = File::open(path).with_context(|| format!("Failed to open HDF5 file: {:?}", path))?;
    let params = extract_radar_params(&file, "GSLC")?;

    let slc_path = format!("/science/LSAR/GSLC/grids/frequencyA/{}", pol);
    let slc = read_complex_dataset(&file, &slc_path)?;

    info!("GSLC loaded: {} × {}", slc.nrows(), slc.ncols());
    Ok(NisarProduct { slc, params, polarization: pol, product_type: NisarProductType::GSLC })
}

/// Parse a NISAR GCOV HDF5 file (Level-2, polarimetric covariance)
///
/// GCOV stores real-valued covariance terms like HHHH, HVHV at:
///   /science/LSAR/GCOV/grids/frequencyA/HHHH
/// We read the diagonal term (real-valued intensity) and wrap it
/// as Complex32 (magnitude in real, zero imaginary) for pipeline compat.
fn parse_nisar_gcov(path: &Path, polarization: &str) -> Result<NisarProduct> {
    let pol = polarization.to_uppercase();
    // For GCOV, "HH" maps to diagonal term "HHHH", "HV" → "HVHV", etc.
    let cov_term = format!("{}{}", pol, pol);
    info!("Opening NISAR GCOV: {:?} (term={})", path, cov_term);

    let file = File::open(path).with_context(|| format!("Failed to open HDF5 file: {:?}", path))?;
    let params = extract_radar_params(&file, "GCOV")?;

    let data_path = format!("/science/LSAR/GCOV/grids/frequencyA/{}", cov_term);
    info!("Reading GCOV covariance from: {}", data_path);

    let data = read_real_dataset(&file, &data_path)
        .with_context(|| format!("Failed to read GCOV term '{}'", cov_term))?;

    info!("GCOV loaded: {} × {} (real-valued covariance)", data.nrows(), data.ncols());

    // Wrap as Complex32 for pipeline compatibility
    let slc = data.mapv(|v| Complex32::new(v, 0.0));

    Ok(NisarProduct { slc, params, polarization: pol, product_type: NisarProductType::GCOV })
}

/// Parse a NISAR GUNW HDF5 file (Level-2, unwrapped interferogram)
fn parse_nisar_gunw(path: &Path, polarization: &str) -> Result<NisarProduct> {
    let pol = polarization.to_uppercase();
    info!("Opening NISAR GUNW: {:?} (pol={})", path, pol);

    let file = File::open(path).with_context(|| format!("Failed to open HDF5 file: {:?}", path))?;
    let params = extract_radar_params(&file, "GUNW")?;

    // GUNW unwrapped phase at /science/LSAR/GUNW/grids/frequencyA/unwrappedPhase
    let phase_path = "/science/LSAR/GUNW/grids/frequencyA/unwrappedPhase";
    info!("Reading GUNW unwrapped phase from: {}", phase_path);

    let phase = read_real_dataset(&file, phase_path)
        .with_context(|| "Failed to read GUNW unwrapped phase")?;

    info!("GUNW loaded: {} × {} (unwrapped phase)", phase.nrows(), phase.ncols());

    // Convert phase to complex (unit magnitude, phase angle)
    let slc = phase.mapv(|phi| Complex32::from_polar(1.0, phi));

    Ok(NisarProduct { slc, params, polarization: pol, product_type: NisarProductType::GUNW })
}

// ───────────────────────────────────────────────────────────────────────────
// Internal helpers
// ───────────────────────────────────────────────────────────────────────────

/// Extract radar parameters from NISAR metadata.
/// The `product_type` arg determines which metadata path to try.
fn extract_radar_params(file: &File, product_type: &str) -> Result<NisarRadarParams> {
    // Try product-specific metadata path first, fall back to RSLC path
    let bases = [
        format!("/science/LSAR/{}/metadata/processingInformation/parameters", product_type),
        "/science/LSAR/RSLC/metadata/processingInformation/parameters".to_string(),
    ];

    let mut center_frequency = None;
    let mut range_bandwidth = None;
    let mut pulse_duration = None;
    let mut chirp_rate = None;
    let mut prf = None;
    let mut sample_rate = None;

    for base in &bases {
        if center_frequency.is_none() {
            center_frequency = read_scalar_f64(file, &format!("{}/centerFrequency", base));
        }
        if range_bandwidth.is_none() {
            range_bandwidth = read_scalar_f64(file, &format!("{}/rangeBandwidth", base));
        }
        if pulse_duration.is_none() {
            pulse_duration = read_scalar_f64(file, &format!("{}/chirpDuration", base));
        }
        if chirp_rate.is_none() {
            chirp_rate = read_scalar_f64(file, &format!("{}/rangeChirpRate", base));
        }
        if prf.is_none() {
            prf = read_scalar_f64(file, &format!("{}/nominalAcquisitionPRF", base));
        }
        if sample_rate.is_none() {
            sample_rate = read_scalar_f64(file, &format!("{}/rangeSamplingFrequency", base));
        }
    }

    let bw = range_bandwidth.unwrap_or(80_000_000.0);
    let tau = pulse_duration.unwrap_or(40.0e-6);

    let params = NisarRadarParams {
        center_frequency: center_frequency.unwrap_or(1_257_500_000.0),
        range_bandwidth: bw,
        pulse_duration: tau,
        chirp_rate: chirp_rate.unwrap_or(bw / tau),
        prf: prf.unwrap_or(1_600.0),
        sample_rate: sample_rate.unwrap_or(bw * 1.2),
    };

    info!(
        "NISAR params: fc={:.3} GHz  BW={:.1} MHz  PRF={:.1} Hz",
        params.center_frequency / 1e9,
        params.range_bandwidth / 1e6,
        params.prf,
    );

    Ok(params)
}

/// Read a scalar f64 from an HDF5 dataset.
/// Returns None if the dataset is missing or cannot be read.
fn read_scalar_f64(file: &File, path: &str) -> Option<f64> {
    let dataset = file.dataset(path).ok()?;
    dataset.read_f64().ok()?.into_iter().next()
}

/// Read a complex float32 SLC dataset.
///
/// NISAR stores SLC data as an HDF5 compound type `{float32 re, float32 im}`.
/// The high-level `read_f32()` API rejects compound types, so we use the
/// low-level `rustyhdf5_format` crate to read raw bytes directly (works for
/// both contiguous and chunked layouts), then reinterpret as Complex32.
///
/// The compound type has the exact same binary layout as interleaved
/// `(re, im, re, im, …)` float32 pairs.
fn read_complex_dataset(file: &File, path: &str) -> Result<Array2<Complex32>> {
    let dataset = file
        .dataset(path)
        .with_context(|| format!("HDF5 dataset not found: {}", path))?;

    // Shape via high-level API
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
    let n_pixels = n_az * n_rg;

    info!("  SLC shape: {} azimuth × {} range ({} complex samples)", n_az, n_rg, n_pixels);

    // ── Try high-level read_f32 first (works for plain float32 datasets) ──
    if let Ok(raw_f32) = dataset.read_f32() {
        let expected = n_pixels * 2;
        if raw_f32.len() == expected {
            info!("  Read via high-level float32 API ({} MB)", raw_f32.len() * 4 / (1024 * 1024));
            let complex_vec: Vec<Complex32> = raw_f32
                .chunks_exact(2)
                .map(|pair| Complex32::new(pair[0], pair[1]))
                .collect();
            return Array2::from_shape_vec((n_az, n_rg), complex_vec)
                .context("Failed to reshape SLC data into 2D array");
        }
    }

    // ── High-level API failed (compound type) — use low-level raw bytes ───
    info!("  High-level read failed (compound type), using low-level raw bytes reader");

    // Get the raw file buffer and superblock info from the File
    let file_data = file.as_bytes();
    let sb = file.superblock();
    let os = sb.offset_size;
    let ls = sb.length_size;

    // Re-resolve the dataset path at the format level to get ObjectHeader
    let addr = rustyhdf5_format::group_v2::resolve_path_any(file_data, sb, path)
        .with_context(|| format!("Cannot resolve HDF5 path: {}", path))?;

    let header = rustyhdf5_format::object_header::ObjectHeader::parse(file_data, addr as usize, os, ls)
        .with_context(|| format!("Cannot parse object header for: {}", path))?;

    // Extract DataLayout, Dataspace, Datatype, and FilterPipeline from the header
    use rustyhdf5_format::message_type::MessageType;

    let dl_msg = header.messages.iter()
        .find(|m| m.msg_type == MessageType::DataLayout)
        .ok_or_else(|| anyhow::anyhow!("No DataLayout message in '{}'", path))?;
    let dl = rustyhdf5_format::data_layout::DataLayout::parse(&dl_msg.data, os, ls)
        .with_context(|| format!("Cannot parse DataLayout for '{}'", path))?;

    let ds_msg = header.messages.iter()
        .find(|m| m.msg_type == MessageType::Dataspace)
        .ok_or_else(|| anyhow::anyhow!("No Dataspace message in '{}'", path))?;
    let ds = rustyhdf5_format::dataspace::Dataspace::parse(&ds_msg.data, ls)
        .with_context(|| format!("Cannot parse Dataspace for '{}'", path))?;

    let dt_msg = header.messages.iter()
        .find(|m| m.msg_type == MessageType::Datatype)
        .ok_or_else(|| anyhow::anyhow!("No Datatype message in '{}'", path))?;
    let (dt, _) = rustyhdf5_format::datatype::Datatype::parse(&dt_msg.data)
        .with_context(|| format!("Cannot parse Datatype for '{}'", path))?;

    let pipeline = header.messages.iter()
        .find(|m| m.msg_type == MessageType::FilterPipeline)
        .and_then(|msg| rustyhdf5_format::filter_pipeline::FilterPipeline::parse(&msg.data).ok());

    // Read raw bytes — works for contiguous, compact, AND chunked layouts
    let raw_bytes = rustyhdf5_format::data_read::read_raw_data_full(
        file_data, &dl, &ds, &dt, pipeline.as_ref(), os, ls,
    ).with_context(|| format!("Failed to read raw data from '{}'", path))?;

    let expected_bytes = n_pixels * 8; // compound {f32, f32} = 8 bytes per sample
    info!("  Read {} MB raw bytes (expected {} MB)",
        raw_bytes.len() / (1024 * 1024),
        expected_bytes / (1024 * 1024));

    if raw_bytes.len() != expected_bytes {
        bail!(
            "Dataset '{}' raw size mismatch: got {} bytes, expected {} ({}×8)",
            path, raw_bytes.len(), expected_bytes, n_pixels
        );
    }

    // Reinterpret raw bytes as (re, im) float32 pairs → Complex32
    let complex_vec: Vec<Complex32> = raw_bytes
        .chunks_exact(8)
        .map(|chunk| {
            let re = f32::from_le_bytes([chunk[0], chunk[1], chunk[2], chunk[3]]);
            let im = f32::from_le_bytes([chunk[4], chunk[5], chunk[6], chunk[7]]);
            Complex32::new(re, im)
        })
        .collect();

    info!("  Decoded {} complex samples from compound type", complex_vec.len());

    Array2::from_shape_vec((n_az, n_rg), complex_vec)
        .context("Failed to reshape SLC data into 2D array")
}

/// Read a real-valued float32 dataset (used for GCOV diagonal terms, GUNW phase).
fn read_real_dataset(file: &File, path: &str) -> Result<Array2<f32>> {
    let dataset = file
        .dataset(path)
        .with_context(|| format!("HDF5 dataset not found: {}", path))?;

    let shape = dataset.shape()
        .with_context(|| format!("Cannot read shape of dataset '{}'", path))?;

    if shape.len() != 2 {
        bail!("Expected 2D dataset at '{}', got {}D", path, shape.len());
    }
    let n_rows = shape[0] as usize;
    let n_cols = shape[1] as usize;

    info!("  Dataset shape: {} × {}", n_rows, n_cols);

    let raw: Vec<f32> = dataset.read_f32()
        .with_context(|| format!("Failed to read float32 data from '{}'", path))?;

    let expected = n_rows * n_cols;
    if raw.len() != expected {
        bail!(
            "Dataset '{}' size mismatch: got {} values, expected {} ({}×{})",
            path, raw.len(), expected, n_rows, n_cols
        );
    }

    Array2::from_shape_vec((n_rows, n_cols), raw)
        .context("Failed to reshape data into 2D array")
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
