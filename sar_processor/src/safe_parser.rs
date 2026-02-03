//! Sentinel-1 SAFE Format Parser
//!
//! Parses ESA's SAFE format for Sentinel-1 SLC products.
//! SAFE (Standard Archive Format for Europe) contains:
//! - manifest.safe (XML metadata)
//! - measurement/*.tiff (complex SLC data)
//! - annotation/*.xml (calibration, noise, orbit)

use anyhow::{bail, Context, Result};
use log::info;
use std::fs::{self, File};
use std::io::{BufReader, Read};
use std::path::{Path, PathBuf};

/// Sentinel-1 product metadata extracted from SAFE
#[derive(Debug, Clone)]
pub struct S1Product {
    pub product_id: String,
    pub mission: String,           // S1A or S1B
    pub mode: String,              // IW, EW, SM
    pub product_type: String,      // SLC, GRD
    pub polarisation: Vec<String>, // VV, VH, HH, HV
    pub start_time: String,
    pub stop_time: String,
    pub swaths: Vec<SwathInfo>,
}

/// Information about a single swath/burst
#[derive(Debug, Clone)]
pub struct SwathInfo {
    pub swath_id: String, // IW1, IW2, IW3
    pub polarisation: String,
    pub measurement_path: PathBuf, // Path to TIFF file
    pub annotation_path: PathBuf,  // Path to annotation XML
    pub num_lines: usize,
    pub num_samples: usize,
}

/// Parse a Sentinel-1 SAFE directory
pub fn parse_safe_directory(safe_path: &Path) -> Result<S1Product> {
    info!("Parsing SAFE directory: {:?}", safe_path);

    // Validate it's a .SAFE directory
    let dir_name = safe_path
        .file_name()
        .and_then(|n| n.to_str())
        .context("Invalid SAFE path")?;

    if !dir_name.ends_with(".SAFE") {
        bail!("Path must end with .SAFE: {}", dir_name);
    }

    // Parse product ID from directory name
    // Format: S1A_IW_SLC__1SDV_20240115T...
    let parts: Vec<&str> = dir_name.split('_').collect();
    if parts.len() < 4 {
        bail!("Invalid SAFE directory name format");
    }

    let mission = parts[0].to_string(); // S1A or S1B
    let mode = parts[1].to_string(); // IW, EW, SM
    let product_type = parts[2].to_string(); // SLC, GRD

    // Find measurement files (the actual data)
    let measurement_dir = safe_path.join("measurement");
    let annotation_dir = safe_path.join("annotation");

    let mut swaths = Vec::new();
    let mut polarisations = Vec::new();

    if measurement_dir.exists() {
        for entry in fs::read_dir(&measurement_dir)? {
            let entry = entry?;
            let path = entry.path();
            if path.extension().map(|e| e == "tiff").unwrap_or(false) {
                // Parse filename to get swath info
                // Format: s1a-iw1-slc-vv-....tiff
                if let Some(name) = path.file_stem().and_then(|n| n.to_str()) {
                    let file_parts: Vec<&str> = name.split('-').collect();
                    if file_parts.len() >= 4 {
                        let swath_id = file_parts[1].to_uppercase();
                        let pol = file_parts[3].to_uppercase();

                        if !polarisations.contains(&pol) {
                            polarisations.push(pol.clone());
                        }

                        // Find matching annotation file
                        let annotation_name = format!("{}.xml", name);
                        let annotation_path = annotation_dir.join(&annotation_name);

                        swaths.push(SwathInfo {
                            swath_id,
                            polarisation: pol,
                            measurement_path: path.clone(),
                            annotation_path,
                            num_lines: 0, // Would be read from annotation
                            num_samples: 0,
                        });
                    }
                }
            }
        }
    }

    Ok(S1Product {
        product_id: dir_name.to_string(),
        mission,
        mode,
        product_type,
        polarisation: polarisations,
        start_time: String::new(), // Would parse from manifest
        stop_time: String::new(),
        swaths,
    })
}

/// Read SLC data from a measurement TIFF file
/// Returns complex data as (I, Q) pairs
///
/// Sentinel-1 SLC TIFFs store complex data as 2-band int16:
/// - Band 1: Real (I) component
/// - Band 2: Imaginary (Q) component
pub fn read_slc_tiff(tiff_path: &Path) -> Result<SlcData> {
    use std::io::BufReader;
    use tiff::decoder::{Decoder, DecodingResult};

    info!("Reading SLC TIFF: {:?}", tiff_path);

    if !tiff_path.exists() {
        bail!("TIFF file not found: {:?}", tiff_path);
    }

    let file = File::open(tiff_path)?;
    let file_size = file.metadata()?.len();
    info!("TIFF file size: {} MB", file_size / 1024 / 1024);

    let reader = BufReader::new(file);
    let mut decoder = Decoder::new(reader).context("Failed to create TIFF decoder")?;

    // Get image dimensions
    let (width, height) = decoder.dimensions()?;
    info!("TIFF dimensions: {}x{} pixels", width, height);

    // Read the image data
    let decode_result = decoder.read_image()?;

    // Process based on data type
    let iq_pairs: Vec<(i16, i16)> = match decode_result {
        DecodingResult::I16(data) => {
            // Sentinel-1 SLC: interleaved I/Q as consecutive i16 values
            // or 2-band: first half is I, second half is Q
            info!("Read {} i16 values", data.len());

            let num_pixels = (width * height) as usize;

            if data.len() == num_pixels * 2 {
                // Interleaved I/Q
                data.chunks(2)
                    .map(|chunk| (chunk[0], chunk.get(1).copied().unwrap_or(0)))
                    .collect()
            } else if data.len() == num_pixels {
                // Single band - treat as magnitude only
                data.into_iter().map(|v| (v, 0i16)).collect()
            } else {
                bail!(
                    "Unexpected data length: {} (expected {} or {})",
                    data.len(),
                    num_pixels,
                    num_pixels * 2
                );
            }
        }
        DecodingResult::U16(data) => {
            // Sometimes stored as u16, convert to i16
            info!("Read {} u16 values, converting to i16", data.len());
            let num_pixels = (width * height) as usize;

            if data.len() == num_pixels * 2 {
                data.chunks(2)
                    .map(|chunk| {
                        (
                            chunk[0] as i16,
                            chunk.get(1).map(|&v| v as i16).unwrap_or(0),
                        )
                    })
                    .collect()
            } else {
                data.into_iter().map(|v| (v as i16, 0i16)).collect()
            }
        }
        _ => {
            bail!("Unsupported TIFF data type. Expected i16 or u16 for Sentinel-1 SLC.");
        }
    };

    info!("Extracted {} complex pixels", iq_pairs.len());

    Ok(SlcData {
        width: width as usize,
        height: height as usize,
        iq_data: iq_pairs,
    })
}

/// SLC data container with dimensions
#[derive(Debug, Clone)]
pub struct SlcData {
    pub width: usize,
    pub height: usize,
    pub iq_data: Vec<(i16, i16)>,
}

impl SlcData {
    /// Convert to ndarray of Complex32
    pub fn to_complex_array(&self) -> ndarray::Array2<num_complex::Complex32> {
        let complex_vec: Vec<num_complex::Complex32> = self
            .iq_data
            .iter()
            .map(|(i, q)| num_complex::Complex32::new(*i as f32, *q as f32))
            .collect();

        ndarray::Array2::from_shape_vec((self.height, self.width), complex_vec)
            .expect("Shape mismatch in SLC data conversion")
    }

    /// Get magnitude image for display
    pub fn magnitude_image(&self) -> Vec<f32> {
        self.iq_data
            .iter()
            .map(|(i, q)| ((*i as f32).powi(2) + (*q as f32).powi(2)).sqrt())
            .collect()
    }
}

/// Convert I/Q int16 pairs to Complex32
pub fn iq_to_complex(iq_data: &[(i16, i16)]) -> Vec<num_complex::Complex32> {
    iq_data
        .iter()
        .map(|(i, q)| num_complex::Complex32::new(*i as f32, *q as f32))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_product_id() {
        // Test parsing a mock SAFE directory name
        let name = "S1A_IW_SLC__1SDV_20240115T120000_20240115T120030_051234_067890_ABCD.SAFE";
        let parts: Vec<&str> = name.split('_').collect();

        assert_eq!(parts[0], "S1A");
        assert_eq!(parts[1], "IW");
        assert_eq!(parts[2], "SLC");
    }
}
