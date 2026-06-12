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

/// WGS84 bounding box for georeferenced map placement
#[derive(Debug, Clone, serde::Serialize)]
pub struct GeoBoundingBox {
    /// Southern latitude (degrees)
    pub south: f64,
    /// Northern latitude (degrees)
    pub north: f64,
    /// Western longitude (degrees)
    pub west: f64,
    /// Eastern longitude (degrees)
    pub east: f64,
}

impl GeoBoundingBox {
    /// Create a bbox from min/max lat/lon arrays
    pub fn from_bounds(lats: &[f64], lons: &[f64]) -> Option<Self> {
        if lats.is_empty() || lons.is_empty() {
            return None;
        }
        let south = lats.iter().copied().fold(f64::MAX, f64::min);
        let north = lats.iter().copied().fold(f64::MIN, f64::max);
        let west = lons.iter().copied().fold(f64::MAX, f64::min);
        let east = lons.iter().copied().fold(f64::MIN, f64::max);
        
        // Reject invalid coordinates
        if south.abs() > 90.0 || north.abs() > 90.0 || west.abs() > 360.0 || east.abs() > 360.0 {
            return None;
        }
        // Reject degenerate (zero-area) or all-zero bounding boxes
        if (south - north).abs() < 1e-6 || (west - east).abs() < 1e-6 {
            return None;
        }
        if south == 0.0 && north == 0.0 && west == 0.0 && east == 0.0 {
            return None;
        }
        Some(Self { south, north, west, east })
    }
}

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
    /// WGS84 bounding box (None if not available in metadata)
    pub bbox: Option<GeoBoundingBox>,
}

/// NISAR product type, auto-detected from filename
#[derive(Debug, Clone, PartialEq)]
pub enum NisarProductType {
    RSLC, // Level-1 Range-Doppler SLC (radar coords)
    GSLC, // Level-2 Geocoded SLC (map coords)
    GCOV, // Level-2 Geocoded Polarimetric Covariance
    GUNW, // Level-2 Geocoded Unwrapped Interferogram
}

/// Geographic crop region for infrastructure monitoring.
/// Defines a circular area around a target asset (dam, bridge, etc.)
/// to limit processing to only the relevant pixels.
#[derive(Debug, Clone)]
pub struct CropRegion {
    /// Center latitude (degrees, WGS84)
    pub center_lat: f64,
    /// Center longitude (degrees, WGS84)
    pub center_lon: f64,
    /// Radius around center in kilometers (default: 10.0)
    pub radius_km: f64,
}

/// Validate that crop coordinates intersect the scene bounding box
/// WITHOUT loading the full dataset. This is a lightweight check that
/// only reads bbox metadata from the HDF5 file.
///
/// Returns Ok(()) if the crop region intersects the scene,
/// or an error with a descriptive message if it does not.
pub fn validate_crop_intersection(path: &Path, crop: &CropRegion) -> Result<()> {
    let file = File::open(path)
        .with_context(|| format!("Failed to open HDF5 file for bbox check: {:?}", path))?;

    // Detect product type from filename
    let filename = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
    let product_type_str = if filename.contains("_GSLC_") {
        "GSLC"
    } else if filename.contains("_GCOV_") {
        "GCOV"
    } else if filename.contains("_GUNW_") {
        "GUNW"
    } else {
        "RSLC"
    };

    // Try coordinate grids first, then identification metadata
    let bbox = extract_bbox_from_grids(&file, product_type_str)
        .or_else(|| extract_bbox_from_identification(&file));

    let bbox = match bbox {
        Some(b) => b,
        None => {
            info!("No scene bbox available for pre-load validation, skipping check");
            return Ok(());
        }
    };

    // Convert crop radius to degree bounds
    let lat_radius = crop.radius_km / 111.0;
    let cos_lat = crop.center_lat.to_radians().cos().abs().max(0.01);
    let lon_radius = crop.radius_km / (111.0 * cos_lat);

    let crop_south = crop.center_lat - lat_radius;
    let crop_north = crop.center_lat + lat_radius;
    let crop_west = crop.center_lon - lon_radius;
    let crop_east = crop.center_lon + lon_radius;

    // Check AABB intersection
    let intersects = crop_south <= bbox.north
        && crop_north >= bbox.south
        && crop_west <= bbox.east
        && crop_east >= bbox.west;

    if !intersects {
        bail!(
            "Asset at lat={:.1} lon={:.1} (radius {:.0}km) is outside scene coverage \
             [S:{:.2} N:{:.2} W:{:.2} E:{:.2}]. \
             Download a NISAR scene covering this location.",
            crop.center_lat, crop.center_lon, crop.radius_km,
            bbox.south, bbox.north, bbox.west, bbox.east
        );
    }

    info!("Pre-load bbox check passed: asset ({:.4}, {:.4}) intersects scene [{:.2}..{:.2}, {:.2}..{:.2}]",
        crop.center_lat, crop.center_lon, bbox.south, bbox.north, bbox.west, bbox.east);
    Ok(())
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

/// Parse a NISAR product with geographic cropping (Option A approach).
///
/// This loads the full dataset into memory, then crops the SLC array
/// to only the geographic region around the specified coordinates.
/// The full array is dropped after cropping, reclaiming memory before
/// the next image is loaded.
///
/// For a 16020×16560 GCOV with a 10 km crop radius, this reduces the
/// array from ~2 GB to ~1 MB (typically ~500×500 pixels).
pub fn parse_nisar_cropped(
    path: &Path,
    polarization: &str,
    crop: &CropRegion,
) -> Result<NisarProduct> {
    // Step 1: Parse the full product (loads entire dataset into memory)
    info!("Loading full product for geographic crop...");
    let mut product = parse_nisar_auto(path, polarization)?;
    let full_rows = product.slc.nrows();
    let full_cols = product.slc.ncols();

    // Step 2: Determine the product type string for coordinate paths
    let product_type_str = match product.product_type {
        NisarProductType::RSLC => "RSLC",
        NisarProductType::GSLC => "GSLC",
        NisarProductType::GCOV => "GCOV",
        NisarProductType::GUNW => "GUNW",
    };

    // Step 3: Re-open file to read coordinate arrays (lightweight)
    let file = File::open(path)
        .with_context(|| format!("Failed to re-open HDF5 file for cropping: {:?}", path))?;

    let x_path = format!("/science/LSAR/{}/grids/frequencyA/xCoordinates", product_type_str);
    let y_path = format!("/science/LSAR/{}/grids/frequencyA/yCoordinates", product_type_str);

    let x_coords = read_1d_f64(&file, &x_path);
    let y_coords = read_1d_f64(&file, &y_path);

    match (x_coords, y_coords) {
        (Some(lons), Some(lats)) => {
            // Convert radius_km to approximate degree bounds
            let lat_radius = crop.radius_km / 111.0;
            let cos_lat = crop.center_lat.to_radians().cos().abs().max(0.01);
            let lon_radius = crop.radius_km / (111.0 * cos_lat);

            let lat_min = crop.center_lat - lat_radius;
            let lat_max = crop.center_lat + lat_radius;
            let lon_min = crop.center_lon - lon_radius;
            let lon_max = crop.center_lon + lon_radius;

            info!("Crop target: ({:.4}°, {:.4}°) radius {:.1} km",
                crop.center_lat, crop.center_lon, crop.radius_km);
            info!("Crop bounds: lat [{:.4}, {:.4}], lon [{:.4}, {:.4}]",
                lat_min, lat_max, lon_min, lon_max);

            // Find row indices (latitude) and col indices (longitude)
            let (row_start, row_end) = find_index_range(&lats, lat_min, lat_max);
            let (col_start, col_end) = find_index_range(&lons, lon_min, lon_max);

            // Clamp to valid range
            let row_start = row_start.min(full_rows);
            let row_end = row_end.min(full_rows);
            let col_start = col_start.min(full_cols);
            let col_end = col_end.min(full_cols);

            if row_end <= row_start || col_end <= col_start {
                // Compute scene bbox for the error message
                let scene_south = lats.iter().copied().fold(f64::MAX, f64::min);
                let scene_north = lats.iter().copied().fold(f64::MIN, f64::max);
                let scene_west = lons.iter().copied().fold(f64::MAX, f64::min);
                let scene_east = lons.iter().copied().fold(f64::MIN, f64::max);
                bail!(
                    "Asset at lat={:.1} lon={:.1} (radius {:.0}km) is outside scene coverage \
                     [S:{:.2} N:{:.2} W:{:.2} E:{:.2}]. \
                     Download a NISAR scene covering this location.",
                    crop.center_lat, crop.center_lon, crop.radius_km,
                    scene_south, scene_north, scene_west, scene_east
                );
            }

            let crop_rows = row_end - row_start;
            let crop_cols = col_end - col_start;

            info!("Cropping: {}×{} → {}×{} (rows {}..{}, cols {}..{})",
                full_rows, full_cols, crop_rows, crop_cols,
                row_start, row_end, col_start, col_end);

            // Step 4: Slice the SLC array (allocates only the crop)
            let cropped_slc = product.slc
                .slice(ndarray::s![row_start..row_end, col_start..col_end])
                .to_owned();

            // Compute tight bounding box from actual coordinate values
            let crop_lat_min = lats[row_start].min(lats[row_end - 1]);
            let crop_lat_max = lats[row_start].max(lats[row_end - 1]);
            let crop_lon_min = lons[col_start];
            let crop_lon_max = lons[col_end - 1];

            let crop_bbox = GeoBoundingBox {
                south: crop_lat_min,
                north: crop_lat_max,
                west: crop_lon_min,
                east: crop_lon_max,
            };

            info!("Cropped bbox: [{:.4}°N, {:.4}°E] → [{:.4}°N, {:.4}°E]",
                crop_bbox.south, crop_bbox.west, crop_bbox.north, crop_bbox.east);
            info!("Memory: crop = {} × {} = {:.2} MB (full {:.0} MB array will be dropped)",
                crop_rows, crop_cols,
                (crop_rows * crop_cols * 8) as f64 / (1024.0 * 1024.0),
                (full_rows * full_cols * 8) as f64 / (1024.0 * 1024.0));

            // Replace the full array with the crop (full array is dropped here)
            product.slc = cropped_slc;
            product.bbox = Some(crop_bbox);

            Ok(product)
        }
        _ => {
            info!("No coordinate grids found for product type '{}'. Using full image.", product_type_str);
            Ok(product)
        }
    }
}

/// Find the start and end indices in a coordinate array that encompass [min_val, max_val].
/// Handles both ascending and descending coordinate arrays.
fn find_index_range(coords: &[f64], min_val: f64, max_val: f64) -> (usize, usize) {
    let n = coords.len();
    if n == 0 {
        return (0, 0);
    }

    let ascending = coords[0] < coords[n - 1];

    let mut start = n; // default: no match
    let mut end = 0;

    if ascending {
        // Find first index >= min_val
        for (i, &v) in coords.iter().enumerate() {
            if v >= min_val {
                start = i;
                break;
            }
        }
        // Find last index <= max_val
        for (i, &v) in coords.iter().enumerate().rev() {
            if v <= max_val {
                end = i + 1;
                break;
            }
        }
    } else {
        // Descending: coords[0] is largest
        // Find first index <= max_val
        for (i, &v) in coords.iter().enumerate() {
            if v <= max_val {
                start = i;
                break;
            }
        }
        // Find last index >= min_val
        for (i, &v) in coords.iter().enumerate().rev() {
            if v >= min_val {
                end = i + 1;
                break;
            }
        }
    }

    if start >= end {
        return (0, 0); // No intersection
    }

    (start, end)
}

/// Parse a NISAR RSLC HDF5 file (Level-1, radar coordinates)
pub fn parse_nisar_rslc(path: &Path, polarization: &str) -> Result<NisarProduct> {
    let pol = polarization.to_uppercase();
    info!("Opening NISAR RSLC: {:?} (pol={})", path, pol);

    let file = File::open(path).with_context(|| format!("Failed to open HDF5 file: {:?}", path))?;
    let params = extract_radar_params(&file, "RSLC")?;

    let slc_path = format!("/science/LSAR/RSLC/swaths/frequencyA/{}", pol);
    let slc = read_complex_dataset(&file, &slc_path)?;

    // RSLC is in radar coordinates — try to extract bbox from identification metadata
    let bbox = extract_bbox_from_identification(&file);
    if let Some(ref bb) = bbox {
        info!("RSLC geolocation: [{:.4}°N, {:.4}°E] → [{:.4}°N, {:.4}°E]",
            bb.south, bb.west, bb.north, bb.east);
    } else {
        info!("RSLC: No geographic bounding box found in metadata");
    }

    info!("RSLC loaded: {} × {}", slc.nrows(), slc.ncols());
    Ok(NisarProduct { slc, params, polarization: pol, product_type: NisarProductType::RSLC, bbox })
}

/// Parse a NISAR GSLC HDF5 file (Level-2, geocoded SLC)
fn parse_nisar_gslc(path: &Path, polarization: &str) -> Result<NisarProduct> {
    let pol = polarization.to_uppercase();
    info!("Opening NISAR GSLC: {:?} (pol={})", path, pol);

    let file = File::open(path).with_context(|| format!("Failed to open HDF5 file: {:?}", path))?;
    let params = extract_radar_params(&file, "GSLC")?;

    let slc_path = format!("/science/LSAR/GSLC/grids/frequencyA/{}", pol);
    let slc = read_complex_dataset(&file, &slc_path)?;

    // GSLC is geocoded — extract bbox from coordinate grids
    let bbox = extract_bbox_from_grids(&file, "GSLC")
        .or_else(|| extract_bbox_from_identification(&file));
    if let Some(ref bb) = bbox {
        info!("GSLC geolocation: [{:.4}°N, {:.4}°E] → [{:.4}°N, {:.4}°E]",
            bb.south, bb.west, bb.north, bb.east);
    }

    info!("GSLC loaded: {} × {}", slc.nrows(), slc.ncols());
    Ok(NisarProduct { slc, params, polarization: pol, product_type: NisarProductType::GSLC, bbox })
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

    // GCOV is geocoded — extract bbox from coordinate grids
    let bbox = extract_bbox_from_grids(&file, "GCOV")
        .or_else(|| extract_bbox_from_identification(&file));
    if let Some(ref bb) = bbox {
        info!("GCOV geolocation: [{:.4}°N, {:.4}°E] → [{:.4}°N, {:.4}°E]",
            bb.south, bb.west, bb.north, bb.east);
    }

    Ok(NisarProduct { slc, params, polarization: pol, product_type: NisarProductType::GCOV, bbox })
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

    // GUNW is geocoded — extract bbox from coordinate grids
    let bbox = extract_bbox_from_grids(&file, "GUNW")
        .or_else(|| extract_bbox_from_identification(&file));
    if let Some(ref bb) = bbox {
        info!("GUNW geolocation: [{:.4}°N, {:.4}°E] → [{:.4}°N, {:.4}°E]",
            bb.south, bb.west, bb.north, bb.east);
    }

    Ok(NisarProduct { slc, params, polarization: pol, product_type: NisarProductType::GUNW, bbox })
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

/// Extract WGS84 bounding box from geocoded product coordinate grids.
///
/// NISAR geocoded products (GSLC/GCOV/GUNW) store 1D coordinate arrays:
///   /science/LSAR/{type}/grids/frequencyA/xCoordinates  (longitude)
///   /science/LSAR/{type}/grids/frequencyA/yCoordinates  (latitude)
fn extract_bbox_from_grids(file: &File, product_type: &str) -> Option<GeoBoundingBox> {
    let x_path = format!("/science/LSAR/{}/grids/frequencyA/xCoordinates", product_type);
    let y_path = format!("/science/LSAR/{}/grids/frequencyA/yCoordinates", product_type);

    let x_coords = read_1d_f64(file, &x_path)?;
    let y_coords = read_1d_f64(file, &y_path)?;

    info!("  Found coordinate grids: {} × {} points", y_coords.len(), x_coords.len());

    // For projected coordinates (UTM), these could be meters not degrees.
    // Check if values look like geographic degrees (lat: -90..90, lon: -180..360)
    let looks_geographic = y_coords.iter().all(|&v| v.abs() <= 90.0)
        && x_coords.iter().all(|&v| v.abs() <= 360.0);

    if looks_geographic {
        GeoBoundingBox::from_bounds(&y_coords, &x_coords)
    } else {
        info!("  Coordinate grids appear projected (not geographic), skipping");
        None
    }
}

/// Extract WGS84 bounding box from the /identification group.
///
/// NISAR products commonly store scene-level bounding coordinates:
///   /science/LSAR/identification/boundingPolygon
/// or individual corner attributes:
///   /science/LSAR/identification/zeroDopplerStartTime etc.
/// Some products store explicit lat/lon bounding attributes.
fn extract_bbox_from_identification(file: &File) -> Option<GeoBoundingBox> {
    let base = "/science/LSAR/identification";

    // Try explicit bounding box attributes first
    let south = read_scalar_f64(file, &format!("{}/boundingBox/southLatitude", base))
        .or_else(|| read_scalar_f64(file, &format!("{}/southBoundLatitude", base)));
    let north = read_scalar_f64(file, &format!("{}/boundingBox/northLatitude", base))
        .or_else(|| read_scalar_f64(file, &format!("{}/northBoundLatitude", base)));
    let west = read_scalar_f64(file, &format!("{}/boundingBox/westLongitude", base))
        .or_else(|| read_scalar_f64(file, &format!("{}/westBoundLongitude", base)));
    let east = read_scalar_f64(file, &format!("{}/boundingBox/eastLongitude", base))
        .or_else(|| read_scalar_f64(file, &format!("{}/eastBoundLongitude", base)));

    if let (Some(s), Some(n), Some(w), Some(e)) = (south, north, west, east) {
        info!("  Found identification bbox: [{:.4}, {:.4}] → [{:.4}, {:.4}]", s, w, n, e);
        return Some(GeoBoundingBox { south: s, north: n, west: w, east: e });
    }

    // Try WKT boundingPolygon parsing using raw bytes
    let poly_path = format!("{}/boundingPolygon", base);
    
    // We do a manual dataset parsing to grab raw byte strings
    if let Ok(_dataset) = file.dataset(&poly_path) {
        let file_data = file.as_bytes();
        let sb = file.superblock();
        if let Ok(addr) = rustyhdf5_format::group_v2::resolve_path_any(file_data, sb, &poly_path) {
            if let Ok(header) = rustyhdf5_format::object_header::ObjectHeader::parse(file_data, addr as usize, sb.offset_size, sb.length_size) {
                 use rustyhdf5_format::message_type::MessageType;
                 let dl_msg = header.messages.iter().find(|m| m.msg_type == MessageType::DataLayout);
                 let ds_msg = header.messages.iter().find(|m| m.msg_type == MessageType::Dataspace);
                 let dt_msg = header.messages.iter().find(|m| m.msg_type == MessageType::Datatype);

                 if let (Some(dl_m), Some(ds_m), Some(dt_m)) = (dl_msg, ds_msg, dt_msg) {
                     if let (Ok(dl), Ok(ds), Ok((dt, _))) = (
                         rustyhdf5_format::data_layout::DataLayout::parse(&dl_m.data, sb.offset_size, sb.length_size),
                         rustyhdf5_format::dataspace::Dataspace::parse(&ds_m.data, sb.length_size),
                         rustyhdf5_format::datatype::Datatype::parse(&dt_m.data)
                     ) {
                         if let Ok(raw_bytes) = rustyhdf5_format::data_read::read_raw_data_full(file_data, &dl, &ds, &dt, None, sb.offset_size, sb.length_size) {
                             if let Ok(wkt_str) = std::str::from_utf8(&raw_bytes) {
                                 let wkt_str = wkt_str.trim_end_matches(char::from(0)); // strip nulls
                                 info!("  Found boundingPolygon WKT ({} bytes)", wkt_str.len());
                                 
                                 let mut lats = Vec::new();
                                 let mut lons = Vec::new();
                                 let coords: Vec<&str> = wkt_str.split(['(', ')', ',']).collect();
                                 
                                 for chunk in coords {
                                     let parts: Vec<&str> = chunk.split_whitespace().collect();
                                     if parts.len() >= 2 {
                                         if let (Ok(lon), Ok(lat)) = (parts[0].parse::<f64>(), parts[1].parse::<f64>()) {
                                             lons.push(lon);
                                             lats.push(lat);
                                         }
                                     }
                                 }
                                 if let Some(bbox) = GeoBoundingBox::from_bounds(&lats, &lons) {
                                     info!("  Extracted WKT bbox: [{:.4}, {:.4}] → [{:.4}, {:.4}]", bbox.south, bbox.west, bbox.north, bbox.east);
                                     return Some(bbox);
                                 }
                             }
                         }
                     }
                 }
            }
        }
    }

    None
}

/// Read a 1D float64 coordinate array from HDF5.
fn read_1d_f64(file: &File, path: &str) -> Option<Vec<f64>> {
    let dataset = file.dataset(path).ok()?;
    let data = dataset.read_f64().ok()?;
    if data.is_empty() { return None; }
    Some(data)
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
