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
pub fn read_slc_tiff(tiff_path: &Path) -> Result<Vec<(i16, i16)>> {
    info!("Reading SLC TIFF: {:?}", tiff_path);

    // Sentinel-1 SLC TIFFs are complex int16 (I/Q interleaved)
    // For now, return placeholder - actual implementation would use tiff crate

    // Check file exists
    if !tiff_path.exists() {
        bail!("TIFF file not found: {:?}", tiff_path);
    }

    let file = File::open(tiff_path)?;
    let file_size = file.metadata()?.len();

    info!("TIFF file size: {} MB", file_size / 1024 / 1024);

    // Placeholder: return empty for now
    // Real implementation would parse TIFF structure and extract I/Q data
    Ok(Vec::new())
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
