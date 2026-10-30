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

use crate::crash_journal;

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
        Some(Self {
            south,
            north,
            west,
            east,
        })
    }
}

/// Radar acquisition parameters extracted from NISAR metadata
#[derive(Debug, Clone, serde::Serialize)]
pub struct NisarRadarParams {
    /// Center frequency (Hz) — L-band ≈ 1.2575 GHz, S-band ≈ 3.2 GHz
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
    /// Detected instrument: "LSAR" or "SSAR"
    pub instrument: String,
    /// Human-readable radar band: "L-band" or "S-band"
    pub radar_band: String,
}

impl NisarRadarParams {
    /// Speed of light in vacuum (m/s)
    pub const SPEED_OF_LIGHT: f64 = 299_792_458.0;

    /// Compute exact radar wavelength in meters (c / center_frequency)
    pub fn wavelength(&self) -> f64 {
        Self::SPEED_OF_LIGHT / self.center_frequency
    }

    /// Whether this acquisition is S-band (ISRO payload)
    pub fn is_s_band(&self) -> bool {
        self.instrument == "SSAR" || self.center_frequency > 2.0e9
    }

    /// Whether this acquisition is L-band (NASA/JPL payload)
    pub fn is_l_band(&self) -> bool {
        self.instrument == "LSAR" || self.center_frequency <= 2.0e9
    }
}

/// Detect whether the HDF5 product is L-band (/science/LSAR) or S-band (/science/SSAR).
pub fn detect_instrument(file: &File) -> &'static str {
    let test_ssar_paths = [
        "/science/SSAR/identification/boundingPolygon",
        "/science/SSAR/GCOV/grids/frequencyA/xCoordinates",
        "/science/SSAR/GCOV/grids/frequencyA/HHHH",
        "/science/SSAR/GSLC/grids/frequencyA/xCoordinates",
        "/science/SSAR/GSLC/grids/frequencyA/HH",
        "/science/SSAR/RSLC/swaths/frequencyA/HH",
        "/science/SSAR/GUNW/grids/frequencyA/unwrappedPhase",
        "/science/SSAR/GCOV/metadata/sourceData/swaths/frequencyA/centerFrequency",
    ];
    for p in &test_ssar_paths {
        if file.dataset(p).is_ok() {
            return "SSAR";
        }
    }
    "LSAR"
}

/// Detect instrument from a filename string if available
pub fn detect_instrument_from_filename(filename: &str) -> Option<&'static str> {
    let upper = filename.to_uppercase();
    if upper.contains("SSAR") || upper.contains("NISAR_S2") || upper.contains("NISAR_S1") || upper.contains("_S_") {
        Some("SSAR")
    } else if upper.contains("LSAR") || upper.contains("NISAR_L2") || upper.contains("NISAR_L1") || upper.contains("_L_") {
        Some("LSAR")
    } else {
        None
    }
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
    /// Grid pixel spacing in X/horizontal direction (meters, if geocoded)
    pub pixel_spacing_x_m: Option<f64>,
    /// Grid pixel spacing in Y/vertical direction (meters, if geocoded)
    pub pixel_spacing_y_m: Option<f64>,
    /// Coordinate Reference System (CRS)
    pub crs: String,
    /// First included pixel of the cropped window (row), if a grid-covered product
    pub crop_start_row: Option<usize>,
    /// First included pixel of the cropped window (column), if a grid-covered product
    pub crop_start_col: Option<usize>,
    /// WGS84 latitude of the top-left pixel center of the crop, if available
    pub crop_origin_lat: Option<f64>,
    /// WGS84 longitude of the top-left pixel center of the crop, if available
    pub crop_origin_lon: Option<f64>,
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
            crop.center_lat,
            crop.center_lon,
            crop.radius_km,
            bbox.south,
            bbox.north,
            bbox.west,
            bbox.east
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
    let filename = path.file_name().and_then(|n| n.to_str()).unwrap_or("");

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
#[derive(Debug, Clone, Copy)]
pub struct IndexWindow {
    pub row_start: usize,
    pub row_end: usize,
    pub col_start: usize,
    pub col_end: usize,
}

/// Wrapper over [`parse_nisar_cropped_window`] with automatic windowing.
pub fn parse_nisar_cropped(
    path: &Path,
    polarization: &str,
    crop: &CropRegion,
) -> Result<NisarProduct> {
    parse_nisar_cropped_window(path, polarization, crop, None)
}

/// Parse and crop a NISAR product to a geographic region.
///
/// When `window_override` is supplied, the explicit pixel window is used
/// instead of the region search. This is required for cross-resolution
/// pre/post pairs where one grid must be phase-aligned to the other.
/// Normalize GCOV covariance term from 2-letter or 4-letter polarization.
/// Handles "HH" -> "HHHH", "HV" -> "HVHV", "VV" -> "VVVV", "VH" -> "VHVH",
/// and preserves already-expanded terms like "HHHH", "HVHV", "dual" -> "HHHH", etc.
pub fn normalize_gcov_cov_term(pol: &str) -> String {
    let clean = pol.trim().to_uppercase();
    match clean.as_str() {
        "HHHH" | "HVHV" | "VVVV" | "VHVH" | "HHHV" | "HVHH" | "VVVH" | "VHVV" => clean,
        "HH" => "HHHH".to_string(),
        "HV" => "HVHV".to_string(),
        "VV" => "VVVV".to_string(),
        "VH" => "VHVH".to_string(),
        "DUAL" | "SPAN" => "HHHH".to_string(),
        s if s.len() == 2 => format!("{}{}", s, s),
        _ => clean,
    }
}

/// Normalize GSLC polarization term.
/// Handles "HHHH" -> "HH", "HVHV" -> "HV", "HH" -> "HH", etc.
pub fn normalize_gslc_pol(pol: &str) -> String {
    let clean = pol.trim().to_uppercase();
    match clean.as_str() {
        "HHHH" => "HH".to_string(),
        "HVHV" => "HV".to_string(),
        "VVVV" => "VV".to_string(),
        "VHVH" => "VH".to_string(),
        "DUAL" | "SPAN" => "HH".to_string(),
        s if s.len() == 4 && &s[0..2] == &s[2..4] => s[0..2].to_string(),
        _ => clean,
    }
}

pub fn parse_nisar_cropped_window(
    path: &Path,
    polarization: &str,
    crop: &CropRegion,
    window_override: Option<&IndexWindow>,
) -> Result<NisarProduct> {
    let pol = polarization.to_uppercase();
    let file = File::open(path).with_context(|| format!("Failed to open HDF5 file: {:?}", path))?;

    let filename = path.file_name().and_then(|f| f.to_str()).unwrap_or("");
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

    let product_type_str = match product_type {
        NisarProductType::RSLC => "RSLC",
        NisarProductType::GSLC => "GSLC",
        NisarProductType::GCOV => "GCOV",
        NisarProductType::GUNW => "GUNW",
    };

    let params = extract_radar_params(&file, product_type_str)?;
    let instr = &params.instrument;

    let x_path = format!(
        "/science/{}/{}/grids/frequencyA/xCoordinates",
        instr, product_type_str
    );
    let y_path = format!(
        "/science/{}/{}/grids/frequencyA/yCoordinates",
        instr, product_type_str
    );

    let x_coords = read_1d_f64(&file, &x_path);
    let y_coords = read_1d_f64(&file, &y_path);

    if let (Some(lons), Some(lats)) = (x_coords, y_coords) {
        let data_path = match product_type {
            NisarProductType::GCOV => {
                let cov_term = normalize_gcov_cov_term(&pol);
                format!("/science/{}/GCOV/grids/frequencyA/{}", instr, cov_term)
            }
            NisarProductType::GSLC => {
                let gslc_pol = normalize_gslc_pol(&pol);
                format!("/science/{}/GSLC/grids/frequencyA/{}", instr, gslc_pol)
            }
            NisarProductType::GUNW => {
                format!("/science/{}/GUNW/grids/frequencyA/unwrappedPhase", instr)
            }
            _ => bail!("Unsupported cropped product type"),
        };

        let dataset = file
            .dataset(&data_path)
            .with_context(|| format!("HDF5 dataset not found: {}", data_path))?;
        let shape = dataset.shape().context("Failed to read dataset shape")?;
        if shape.len() != 2 {
            bail!(
                "Expected 2D dataset at '{}', got {}D",
                data_path,
                shape.len()
            );
        }
        let full_rows = shape[0] as usize;
        let full_cols = shape[1] as usize;

        let looks_geographic =
            lats.iter().all(|&v| v.abs() <= 90.0) && lons.iter().all(|&v| v.abs() <= 360.0);

        let (row_start, row_end, col_start, col_end) = if let Some(w) = window_override {
            (w.row_start, w.row_end, w.col_start, w.col_end)
        } else if looks_geographic {
            // Convert radius_km to degree bounds
            let lat_radius = crop.radius_km / 111.0;
            let cos_lat = crop.center_lat.to_radians().cos().abs().max(0.01);
            let lon_radius = crop.radius_km / (111.0 * cos_lat);

            let lat_min = crop.center_lat - lat_radius;
            let lat_max = crop.center_lat + lat_radius;
            let lon_min = crop.center_lon - lon_radius;
            let lon_max = crop.center_lon + lon_radius;

            info!(
                "Crop target: ({:.4}°, {:.4}°) radius {:.1} km",
                crop.center_lat, crop.center_lon, crop.radius_km
            );
            info!(
                "Crop bounds: lat [{:.4}, {:.4}], lon [{:.4}, {:.4}]",
                lat_min, lat_max, lon_min, lon_max
            );

            // Find row indices (latitude) and col indices (longitude)
            let (r_start, r_end) = find_index_range(&lats, lat_min, lat_max);
            let (c_start, c_end) = find_index_range(&lons, lon_min, lon_max);
            (r_start, r_end, c_start, c_end)
        } else {
            // Compute UTM zone from center longitude
            let zone = ((crop.center_lon + 180.0) / 6.0).floor() as i32 + 1;
            let (easting, northing) = latlon_to_utm(crop.center_lat, crop.center_lon, zone);

            info!("Applying projected crop target (UTM Zone {}): easting={:.1}m, northing={:.1}m, radius={:.1}km",
                zone, easting, northing, crop.radius_km);

            let radius_m = crop.radius_km * 1000.0;
            let east_min = easting - radius_m;
            let east_max = easting + radius_m;
            let north_min = northing - radius_m;
            let north_max = northing + radius_m;

            let (r_start, r_end) = find_index_range(&lats, north_min, north_max);
            let (c_start, c_end) = find_index_range(&lons, east_min, east_max);
            (r_start, r_end, c_start, c_end)
        };

        // Clamp to valid range
        let row_start = row_start.min(full_rows);
        let row_end = row_end.min(full_rows);
        let col_start = col_start.min(full_cols);
        let col_end = col_end.min(full_cols);

        if row_end <= row_start || col_end <= col_start {
            let scene_south = lats.iter().copied().fold(f64::MAX, f64::min);
            let scene_north = lats.iter().copied().fold(f64::MIN, f64::max);
            let scene_west = lons.iter().copied().fold(f64::MAX, f64::min);
            let scene_east = lons.iter().copied().fold(f64::MIN, f64::max);
            if looks_geographic {
                bail!(
                    "Asset at lat={:.1} lon={:.1} (radius {:.0}km) is outside scene coverage [S:{:.2} N:{:.2} W:{:.2} E:{:.2}].",
                    crop.center_lat, crop.center_lon, crop.radius_km,
                    scene_south, scene_north, scene_west, scene_east
                );
            } else {
                bail!(
                    "Asset at lat={:.1} lon={:.1} (radius {:.0}km) is outside scene coverage [S:{:.0} N:{:.0} W:{:.0} E:{:.0}].",
                    crop.center_lat, crop.center_lon, crop.radius_km,
                    scene_south, scene_north, scene_west, scene_east
                );
            }
        }

        let crop_rows = row_end - row_start;
        let crop_cols = col_end - col_start;

        info!(
            "Cropping: {}×{} → {}×{} (rows {}..{}, cols {}..{})",
            full_rows, full_cols, crop_rows, crop_cols, row_start, row_end, col_start, col_end
        );

        let slc = if product_type == NisarProductType::GCOV {
            let _timer = crash_journal::timed_scope("GCOV windowed read");
            let window = crate::windowed::Window {
                row_start: row_start as u64,
                row_end: row_end as u64,
                col_start: col_start as u64,
                col_end: col_end as u64,
            };
            window
                .validate(full_rows as u64, full_cols as u64)
                .with_context(|| {
                    format!(
                        "Crop window rows {}..{} cols {}..{} invalid for dataset '{}' ({}x{})",
                        row_start, row_end, col_start, col_end, data_path, full_rows, full_cols
                    )
                })?;
            let window_bytes = window.elements() * crate::windowed::ELEMENT_SIZE;
            let alloc_desc = format!(
                "GCOV windowed read {}x{} ({:.1} MB) rows {}..{} cols {}..{} from '{}'",
                crop_rows,
                crop_cols,
                window_bytes as f64 / (1024.0 * 1024.0),
                row_start,
                row_end,
                col_start,
                col_end,
                data_path
            );
            crash_journal::guard_allocation(&alloc_desc, window_bytes)?;
            crash_journal::checkpoint_before_alloc(&alloc_desc, window_bytes);

            let raw: Vec<f32> = if std::env::var_os("NISAR_GCOV_LEGACY_FULL_READ").is_some() {
                let legacy_bytes = full_rows as u64 * full_cols as u64 * 4;
                let legacy_desc = format!(
                    "LEGACY read_f32 full dataset {}x{} ({:.1} MB) from '{}'",
                    full_rows,
                    full_cols,
                    legacy_bytes as f64 / (1024.0 * 1024.0),
                    data_path
                );
                crash_journal::guard_allocation(&legacy_desc, legacy_bytes)?;
                crash_journal::checkpoint_before_alloc(&legacy_desc, legacy_bytes);
                let full = dataset.read_f32().with_context(|| {
                    format!("Failed to read GCOV float32 data from '{}'", data_path)
                })?;
                let mut buf = Vec::with_capacity(crop_rows * crop_cols);
                for r in 0..crop_rows {
                    let base = (row_start + r) * full_cols + col_start;
                    buf.extend_from_slice(&full[base..base + crop_cols]);
                }
                drop(full);
                crash_journal::checkpoint_after_free("GCOV legacy full buffer dropped");
                buf
            } else {
                let mut reader = crate::windowed::ChunkedF32Reader::open(path)?;
                reader.read_window(&data_path, window).with_context(|| {
                    format!(
                        "Windowed GCOV read failed for '{}' rows {}..{} cols {}..{}",
                        data_path, row_start, row_end, col_start, col_end
                    )
                })?
            };
            anyhow::ensure!(
                raw.len() == crop_rows * crop_cols,
                "GCOV read returned {} elements, expected {} for crop window {}x{} (rows {}..{}, cols {}..{})",
                raw.len(),
                crop_rows * crop_cols,
                crop_rows,
                crop_cols,
                row_start,
                row_end,
                col_start,
                col_end
            );
            let mut cropped =
                Array2::<Complex32>::from_elem((crop_rows, crop_cols), Complex32::new(0.0, 0.0));
            for (i, &v) in raw.iter().enumerate() {
                cropped[[i / crop_cols, i % crop_cols]] = Complex32::new(v, 0.0);
            }
            crash_journal::checkpoint_after_free("GCOV window buffer dropped");
            cropped
        } else {
            let full_elements = full_rows as u64 * full_cols as u64;
            let estimated_bytes = full_elements * 8;
            let alloc_desc = format!(
                "read_f32 full dataset {}×{} ({:.1} MB) from '{}'",
                full_rows,
                full_cols,
                estimated_bytes as f64 / (1024.0 * 1024.0),
                data_path
            );
            crash_journal::guard_allocation(&alloc_desc, estimated_bytes)?;
            crash_journal::checkpoint_before_alloc(&alloc_desc, estimated_bytes);
            let _timer = crash_journal::timed_scope("Complex read_f32 + crop");
            let raw_f32 = dataset.read_f32().with_context(|| {
                format!("Failed to read complex float32 data from '{}'", data_path)
            })?;

            let mut cropped =
                Array2::<Complex32>::from_elem((crop_rows, crop_cols), Complex32::new(0.0, 0.0));
            for r in 0..crop_rows {
                let global_r = row_start + r;
                let src_offset = (global_r * full_cols + col_start) * 2;
                for c in 0..crop_cols {
                    let idx = src_offset + c * 2;
                    cropped[[r, c]] = Complex32::new(raw_f32[idx], raw_f32[idx + 1]);
                }
            }
            drop(raw_f32); // Explicitly free the large buffer
            crash_journal::checkpoint_after_free("Complex raw_f32 dropped");
            cropped
        };

        // Compute tight bounding box
        let crop_bbox = if looks_geographic {
            let crop_lat_min = lats[row_start].min(lats[row_end - 1]);
            let crop_lat_max = lats[row_start].max(lats[row_end - 1]);
            let crop_lon_min = lons[col_start];
            let crop_lon_max = lons[col_end - 1];

            GeoBoundingBox {
                south: crop_lat_min,
                north: crop_lat_max,
                west: crop_lon_min,
                east: crop_lon_max,
            }
        } else {
            // For projected coordinate grids, exact inverse-project the extracted corner coordinates
            let zone = ((crop.center_lon + 180.0) / 6.0).floor() as i32 + 1;
            let (lat_sw, lon_sw) = utm_to_latlon(lons[col_start], lats[row_end - 1], zone, true);
            let (lat_ne, lon_ne) = utm_to_latlon(lons[col_end - 1], lats[row_start], zone, true);

            GeoBoundingBox {
                south: lat_sw.min(lat_ne),
                north: lat_sw.max(lat_ne),
                west: lon_sw.min(lon_ne),
                east: lon_sw.max(lon_ne),
            }
        };

        let (dx, dy) = read_pixel_spacing_x_y(&file, product_type_str);

        Ok(NisarProduct {
            slc,
            params,
            polarization: pol,
            product_type,
            bbox: Some(crop_bbox),
            pixel_spacing_x_m: dx,
            pixel_spacing_y_m: dy,
            crs: extract_crs(&file, product_type_str),
            crop_start_row: Some(row_start),
            crop_start_col: Some(col_start),
            crop_origin_lat: Some(lats[row_start]),
            crop_origin_lon: Some(lons[col_start]),
        })
    } else {
        info!(
            "No coordinate grids found for product type '{}'. Using full image.",
            product_type_str
        );
        let slc_path = format!("/science/{}/RSLC/swaths/frequencyA/{}", instr, pol);
        let slc = read_complex_dataset(&file, &slc_path)?;
        let bbox = extract_bbox_from_identification(&file);
        Ok(NisarProduct {
            slc,
            params,
            polarization: pol,
            product_type,
            bbox,
            pixel_spacing_x_m: None,
            pixel_spacing_y_m: None,
            crs: "UNKNOWN".to_string(),
            crop_start_row: None,
            crop_start_col: None,
            crop_origin_lat: None,
            crop_origin_lon: None,
        })
    }
}

/// Memory-bounded ingestion of a full NISAR GCOV scene using block multilooking.
///
/// Rather than reading the entire uncompressed ~4.3 GB dataset into RAM (which
/// causes OOM on multi-scene pairs), this reads the dataset in row-strip hyperslabs
/// of `chunk_rows = look_factor * 128` (e.g. 1024 rows ≈ 140 MB transient memory),
/// downsamples each `look_factor × look_factor` block to mean linear power, and
/// writes directly into the downsampled output array `(rows / look_factor, cols / look_factor)`.
pub fn parse_nisar_full_scene_multilooked(
    path: &Path,
    polarization: &str,
    look_factor: usize,
) -> Result<NisarProduct> {
    let look_factor = if look_factor == 0 { 8 } else { look_factor };
    let pol = polarization.to_uppercase();
    let file = File::open(path).with_context(|| format!("Failed to open HDF5 file: {:?}", path))?;

    let filename = path.file_name().and_then(|f| f.to_str()).unwrap_or("");
    let product_type = if filename.contains("_RSLC_") {
        NisarProductType::RSLC
    } else if filename.contains("_GSLC_") {
        NisarProductType::GSLC
    } else if filename.contains("_GCOV_") {
        NisarProductType::GCOV
    } else if filename.contains("_GUNW_") {
        NisarProductType::GUNW
    } else {
        NisarProductType::GCOV
    };

    let product_type_str = match product_type {
        NisarProductType::RSLC => "RSLC",
        NisarProductType::GSLC => "GSLC",
        NisarProductType::GCOV => "GCOV",
        NisarProductType::GUNW => "GUNW",
    };

    let params = extract_radar_params(&file, product_type_str)?;
    let instr = &params.instrument;

    let x_path = format!(
        "/science/{}/{}/grids/frequencyA/xCoordinates",
        instr, product_type_str
    );
    let y_path = format!(
        "/science/{}/{}/grids/frequencyA/yCoordinates",
        instr, product_type_str
    );

    let x_coords = read_1d_f64(&file, &x_path)
        .with_context(|| format!("Failed to read xCoordinates from {}", x_path))?;
    let y_coords = read_1d_f64(&file, &y_path)
        .with_context(|| format!("Failed to read yCoordinates from {}", y_path))?;

    let full_rows = y_coords.len();
    let full_cols = x_coords.len();

    let data_path = match product_type {
        NisarProductType::GCOV => {
            let cov_term = normalize_gcov_cov_term(&pol);
            format!("/science/{}/GCOV/grids/frequencyA/{}", instr, cov_term)
        }
        NisarProductType::GSLC => {
            let gslc_pol = normalize_gslc_pol(&pol);
            format!("/science/{}/GSLC/grids/frequencyA/{}", instr, gslc_pol)
        }
        NisarProductType::GUNW => format!("/science/{}/GUNW/grids/frequencyA/unwrappedPhase", instr),
        _ => bail!("Unsupported full-scene product type: {:?}", product_type),
    };

    let dataset = file
        .dataset(&data_path)
        .with_context(|| format!("HDF5 dataset not found: {}", data_path))?;
    let shape = dataset.shape().context("Failed to read dataset shape")?;
    if shape.len() != 2 {
        bail!("Expected 2D dataset at '{}', got {}D", data_path, shape.len());
    }
    let ds_rows = shape[0] as usize;
    let ds_cols = shape[1] as usize;

    if ds_rows != full_rows || ds_cols != full_cols {
        bail!(
            "Dataset shape ({}x{}) does not match coordinate grid ({}x{})",
            ds_rows, ds_cols, full_rows, full_cols
        );
    }

    let out_rows = full_rows / look_factor;
    let out_cols = full_cols / look_factor;
    let mut out_slc = Array2::<Complex32>::zeros((out_rows, out_cols));

    let chunk_rows = look_factor * 128; // e.g. 8 * 128 = 1024
    let mut reader = crate::windowed::ChunkedF32Reader::open(path)
        .map_err(|e| anyhow::anyhow!("Failed to open windowed reader for full scene: {}", e))?;

    let total_strips = (full_rows + chunk_rows - 1) / chunk_rows;
    info!(
        "[NISAR_FULL_SCENE] Ingesting full scene: {}x{} -> {}x{} (multilook {}x{}, {} strips)",
        full_rows, full_cols, out_rows, out_cols, look_factor, look_factor, total_strips
    );

    let min_valid = (look_factor * look_factor + 1) / 2; // >= 50% valid pixels required
    let mut strip_start = 0;
    let mut strip_idx = 0;

    while strip_start < full_rows {
        let strip_end = (strip_start + chunk_rows).min(full_rows);
        let actual_strip_rows = strip_end - strip_start;
        let num_out_rows = actual_strip_rows / look_factor;
        let out_row_base = strip_start / look_factor;

        let window = crate::windowed::Window {
            row_start: strip_start as u64,
            row_end: strip_end as u64,
            col_start: 0,
            col_end: full_cols as u64,
        };

        let strip_data = reader
            .read_window(&data_path, window)
            .map_err(|e| anyhow::anyhow!("Failed to read strip rows {}..{} from '{}': {}", strip_start, strip_end, data_path, e))?;

        for out_r_local in 0..num_out_rows {
            let out_r = out_row_base + out_r_local;
            if out_r >= out_rows {
                break;
            }
            let r_top = out_r_local * look_factor;

            for out_c in 0..out_cols {
                let c_left = out_c * look_factor;
                let mut sum = 0.0f32;
                let mut valid_count = 0usize;

                for lr in 0..look_factor {
                    let row_offset = (r_top + lr) * full_cols;
                    for lc in 0..look_factor {
                        let val = strip_data[row_offset + c_left + lc];
                        if val.is_finite() && val >= 1e-4 {
                            sum += val;
                            valid_count += 1;
                        }
                    }
                }

                let final_val = if valid_count >= min_valid {
                    sum / valid_count as f32
                } else {
                    0.0f32
                };
                out_slc[[out_r, out_c]] = Complex32::new(final_val, 0.0);
            }
        }

        strip_idx += 1;
        if strip_idx % 8 == 0 || strip_idx == total_strips {
            info!(
                "[NISAR_FULL_SCENE] Multilooked strip {}/{} ({:.1}%)",
                strip_idx,
                total_strips,
                100.0 * strip_idx as f64 / total_strips as f64
            );
        }
        strip_start += chunk_rows;
    }

    let (dx, dy) = read_pixel_spacing_x_y(&file, product_type_str);
    let raw_dx = dx.unwrap_or(10.0);
    let raw_dy = dy.unwrap_or(-10.0);
    let pixel_spacing_x_m = Some(raw_dx * look_factor as f64);
    let pixel_spacing_y_m = Some(raw_dy * look_factor as f64);

    let crs = extract_crs(&file, product_type_str);
    let looks_geographic = y_coords.iter().all(|&v| v.abs() <= 90.0) && x_coords.iter().all(|&v| v.abs() <= 360.0);

    let bbox = if looks_geographic {
        let south = y_coords[0].min(y_coords[full_rows - 1]);
        let north = y_coords[0].max(y_coords[full_rows - 1]);
        let west = x_coords[0].min(x_coords[full_cols - 1]);
        let east = x_coords[0].max(x_coords[full_cols - 1]);
        GeoBoundingBox { south, north, west, east }
    } else {
        let zone = if let Some(stripped) = crs.strip_prefix("EPSG:326") {
            stripped.parse::<i32>().unwrap_or(45)
        } else if let Some(stripped) = crs.strip_prefix("EPSG:327") {
            stripped.parse::<i32>().unwrap_or(45)
        } else {
            45
        };
        let x_min = x_coords[0].min(x_coords[full_cols - 1]);
        let x_max = x_coords[0].max(x_coords[full_cols - 1]);
        let y_min = y_coords[0].min(y_coords[full_rows - 1]);
        let y_max = y_coords[0].max(y_coords[full_rows - 1]);

        let (lat_sw, lon_sw) = utm_to_latlon(x_min, y_min, zone, true);
        let (lat_ne, lon_ne) = utm_to_latlon(x_max, y_max, zone, true);
        let (lat_nw, lon_nw) = utm_to_latlon(x_min, y_max, zone, true);
        let (lat_se, lon_se) = utm_to_latlon(x_max, y_min, zone, true);

        GeoBoundingBox {
            south: lat_sw.min(lat_se).min(lat_nw).min(lat_ne),
            north: lat_sw.max(lat_se).max(lat_nw).max(lat_ne),
            west: lon_sw.min(lon_se).min(lon_nw).min(lon_ne),
            east: lon_sw.max(lon_se).max(lon_nw).max(lon_ne),
        }
    };

    Ok(NisarProduct {
        slc: out_slc,
        params,
        polarization: pol,
        product_type,
        bbox: Some(bbox),
        pixel_spacing_x_m,
        pixel_spacing_y_m,
        crs,
        crop_start_row: Some(0),
        crop_start_col: Some(0),
        crop_origin_lon: Some(x_coords[0]),
        crop_origin_lat: Some(y_coords[0]),
    })
}

/// Find the start and end indices in a coordinate array that encompass [min_val, max_val].
/// Handles both ascending and descending coordinate arrays.
pub fn find_index_range(coords: &[f64], min_val: f64, max_val: f64) -> (usize, usize) {
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

/// Compute the pixel-index shift (on the finer grid) that makes an
/// n-physical-pixel block of the finer grid nest exactly onto one cell of
/// the reference (coarser) grid.
///
/// `fine_center` and `ref_center` are the ground coordinates (same axis,
/// same UTM zone) of the top-left crop pixel of each grid; `fine_spacing`
/// is the finer grid spacing in that axis; `looks` is the integer spacing
/// ratio (reference_spacing / finer_spacing).
///
/// Returns `None` when the lattices cannot nest (non-integer shift).
pub fn phase_alignment_shift(
    fine_center: f64,
    ref_center: f64,
    fine_spacing_m: f64,
    looks: usize,
) -> Option<isize> {
    if looks == 0 || fine_spacing_m.abs() <= 1e-9 {
        return None;
    }
    let shift =
        (ref_center - fine_center - (looks as f64 - 1.0) / 2.0 * fine_spacing_m) / fine_spacing_m;
    let rounded = shift.round();
    if (shift - rounded).abs() > 1e-3 {
        return None;
    }
    Some(rounded as isize)
}

/// Parse a NISAR RSLC HDF5 file (Level-1, radar coordinates)
pub fn parse_nisar_rslc(path: &Path, polarization: &str) -> Result<NisarProduct> {
    let pol = polarization.to_uppercase();
    info!("Opening NISAR RSLC: {:?} (pol={})", path, pol);

    let file = File::open(path).with_context(|| format!("Failed to open HDF5 file: {:?}", path))?;
    let params = extract_radar_params(&file, "RSLC")?;
    let instr = &params.instrument;

    let slc_path = format!("/science/{}/RSLC/swaths/frequencyA/{}", instr, pol);
    let slc = read_complex_dataset(&file, &slc_path)?;

    // RSLC is in radar coordinates — try to extract bbox from identification metadata
    let bbox = extract_bbox_from_identification(&file);
    if let Some(ref bb) = bbox {
        info!(
            "RSLC geolocation: [{:.4}°N, {:.4}°E] → [{:.4}°N, {:.4}°E]",
            bb.south, bb.west, bb.north, bb.east
        );
    } else {
        info!("RSLC: No geographic bounding box found in metadata");
    }

    info!("RSLC loaded: {} × {}", slc.nrows(), slc.ncols());
    Ok(NisarProduct {
        slc,
        params,
        polarization: pol,
        product_type: NisarProductType::RSLC,
        bbox,
        pixel_spacing_x_m: None,
        pixel_spacing_y_m: None,
        crs: "UNKNOWN".to_string(),
        crop_start_row: None,
        crop_start_col: None,
        crop_origin_lat: None,
        crop_origin_lon: None,
    })
}

/// Parse a NISAR GSLC HDF5 file (Level-2, geocoded SLC)
fn parse_nisar_gslc(path: &Path, polarization: &str) -> Result<NisarProduct> {
    let gslc_pol = normalize_gslc_pol(polarization);
    info!("Opening NISAR GSLC: {:?} (pol={})", path, gslc_pol);

    let file = File::open(path).with_context(|| format!("Failed to open HDF5 file: {:?}", path))?;
    let params = extract_radar_params(&file, "GSLC")?;
    let instr = &params.instrument;

    let slc_path = format!("/science/{}/GSLC/grids/frequencyA/{}", instr, gslc_pol);
    let slc = read_complex_dataset(&file, &slc_path)?;

    // GSLC is geocoded — extract bbox from coordinate grids
    let bbox =
        extract_bbox_from_grids(&file, "GSLC").or_else(|| extract_bbox_from_identification(&file));
    if let Some(ref bb) = bbox {
        info!(
            "GSLC geolocation: [{:.4}°N, {:.4}°E] → [{:.4}°N, {:.4}°E]",
            bb.south, bb.west, bb.north, bb.east
        );
    }

    info!("GSLC loaded: {} × {}", slc.nrows(), slc.ncols());
    let (dx, dy) = read_pixel_spacing_x_y(&file, "GSLC");
    Ok(NisarProduct {
        slc,
        params,
        polarization: gslc_pol,
        product_type: NisarProductType::GSLC,
        bbox,
        pixel_spacing_x_m: dx,
        pixel_spacing_y_m: dy,
        crs: extract_crs(&file, "GSLC"),
        crop_start_row: None,
        crop_start_col: None,
        crop_origin_lat: None,
        crop_origin_lon: None,
    })
}

/// Parse a NISAR GCOV HDF5 file (Level-2, polarimetric covariance)
///
/// GCOV stores real-valued covariance terms like HHHH, HVHV at:
///   /science/{instrument}/GCOV/grids/frequencyA/HHHH
/// We read the diagonal term (real-valued intensity) and wrap it
/// as Complex32 (magnitude in real, zero imaginary) for pipeline compat.
fn parse_nisar_gcov(path: &Path, polarization: &str) -> Result<NisarProduct> {
    let cov_term = normalize_gcov_cov_term(polarization);
    info!("Opening NISAR GCOV: {:?} (term={})", path, cov_term);

    let file = File::open(path).with_context(|| format!("Failed to open HDF5 file: {:?}", path))?;
    let params = extract_radar_params(&file, "GCOV")?;
    let instr = &params.instrument;

    let data_path = format!("/science/{}/GCOV/grids/frequencyA/{}", instr, cov_term);
    info!("Reading GCOV covariance from: {}", data_path);

    let data = read_real_dataset(&file, &data_path)
        .with_context(|| format!("Failed to read GCOV term '{}'", cov_term))?;

    info!(
        "GCOV loaded: {} × {} (real-valued covariance)",
        data.nrows(),
        data.ncols()
    );

    // Wrap as Complex32 for pipeline compatibility
    let slc = data.mapv(|v| Complex32::new(v, 0.0));

    // GCOV is geocoded — extract bbox from coordinate grids
    let bbox =
        extract_bbox_from_grids(&file, "GCOV").or_else(|| extract_bbox_from_identification(&file));
    if let Some(ref bb) = bbox {
        info!(
            "GCOV geolocation: [{:.4}°N, {:.4}°E] → [{:.4}°N, {:.4}°E]",
            bb.south, bb.west, bb.north, bb.east
        );
    }

    let (dx, dy) = read_pixel_spacing_x_y(&file, "GCOV");
    Ok(NisarProduct {
        slc,
        params,
        polarization: cov_term,
        product_type: NisarProductType::GCOV,
        bbox,
        pixel_spacing_x_m: dx,
        pixel_spacing_y_m: dy,
        crs: extract_crs(&file, "GCOV"),
        crop_start_row: None,
        crop_start_col: None,
        crop_origin_lat: None,
        crop_origin_lon: None,
    })
}

/// Parse a NISAR GUNW HDF5 file (Level-2, unwrapped interferogram)
fn parse_nisar_gunw(path: &Path, polarization: &str) -> Result<NisarProduct> {
    let pol = polarization.to_uppercase();
    info!("Opening NISAR GUNW: {:?} (pol={})", path, pol);

    let file = File::open(path).with_context(|| format!("Failed to open HDF5 file: {:?}", path))?;
    let params = extract_radar_params(&file, "GUNW")?;
    let instr = &params.instrument;

    // GUNW unwrapped phase at /science/{instrument}/GUNW/grids/frequencyA/unwrappedPhase
    let phase_path = format!("/science/{}/GUNW/grids/frequencyA/unwrappedPhase", instr);
    info!("Reading GUNW unwrapped phase from: {}", phase_path);

    let phase = read_real_dataset(&file, &phase_path)
        .with_context(|| "Failed to read GUNW unwrapped phase")?;

    info!(
        "GUNW loaded: {} × {} (unwrapped phase)",
        phase.nrows(),
        phase.ncols()
    );

    // Convert phase to complex (unit magnitude, phase angle)
    let slc = phase.mapv(|phi| Complex32::from_polar(1.0, phi));

    // GUNW is geocoded — extract bbox from coordinate grids
    let bbox =
        extract_bbox_from_grids(&file, "GUNW").or_else(|| extract_bbox_from_identification(&file));
    if let Some(ref bb) = bbox {
        info!(
            "GUNW geolocation: [{:.4}°N, {:.4}°E] → [{:.4}°N, {:.4}°E]",
            bb.south, bb.west, bb.north, bb.east
        );
    }

    let (dx, dy) = read_pixel_spacing_x_y(&file, "GUNW");
    Ok(NisarProduct {
        slc,
        params,
        polarization: pol,
        product_type: NisarProductType::GUNW,
        bbox,
        pixel_spacing_x_m: dx,
        pixel_spacing_y_m: dy,
        crs: extract_crs(&file, "GUNW"),
        crop_start_row: None,
        crop_start_col: None,
        crop_origin_lat: None,
        crop_origin_lon: None,
    })
}

/// Parse and geocrop the coherence magnitude dataset from a NISAR GUNW product.
pub fn parse_gunw_coherence_cropped(
    path: &Path,
    polarization: &str,
    crop: &CropRegion,
) -> Result<Array2<f32>> {
    let file = File::open(path).with_context(|| format!("Failed to open GUNW file: {:?}", path))?;
    let pol = polarization.to_uppercase();
    let instr = detect_instrument(&file);

    let paths = [
        format!(
            "/science/{}/GUNW/grids/frequencyA/unwrappedInterferogram/{}/coherenceMagnitude",
            instr, pol
        ),
        format!(
            "/science/{}/GUNW/grids/frequencyA/wrappedInterferogram/{}/coherenceMagnitude",
            instr, pol
        ),
        format!("/science/{}/GUNW/grids/frequencyA/coherenceMagnitude", instr),
    ];

    let mut coh_path = None;
    for p in &paths {
        if file.dataset(p).is_ok() {
            coh_path = Some(p.clone());
            break;
        }
    }

    let p = coh_path
        .ok_or_else(|| anyhow::anyhow!("coherenceMagnitude dataset not found in GUNW file"))?;

    let product_type_str = "GUNW";
    let x_path = format!(
        "/science/{}/{}/grids/frequencyA/xCoordinates",
        instr, product_type_str
    );
    let y_path = format!(
        "/science/{}/{}/grids/frequencyA/yCoordinates",
        instr, product_type_str
    );

    let x_coords = read_1d_f64(&file, &x_path);
    let y_coords = read_1d_f64(&file, &y_path);

    if let (Some(lons), Some(lats)) = (x_coords, y_coords) {
        let dataset = file
            .dataset(&p)
            .with_context(|| format!("HDF5 dataset not found: {}", p))?;
        let shape = dataset.shape().context("Failed to read dataset shape")?;
        if shape.len() != 2 {
            bail!("Expected 2D dataset at '{}', got {}D", p, shape.len());
        }
        let full_rows = shape[0] as usize;
        let full_cols = shape[1] as usize;

        let looks_geographic =
            lats.iter().all(|&v| v.abs() <= 90.0) && lons.iter().all(|&v| v.abs() <= 360.0);

        let (row_start, row_end, col_start, col_end) = if looks_geographic {
            let lat_radius = crop.radius_km / 111.0;
            let cos_lat = crop.center_lat.to_radians().cos().abs().max(0.01);
            let lon_radius = crop.radius_km / (111.0 * cos_lat);

            let lat_min = crop.center_lat - lat_radius;
            let lat_max = crop.center_lat + lat_radius;
            let lon_min = crop.center_lon - lon_radius;
            let lon_max = crop.center_lon + lon_radius;

            let (r_start, r_end) = find_index_range(&lats, lat_min, lat_max);
            let (c_start, c_end) = find_index_range(&lons, lon_min, lon_max);
            (r_start, r_end, c_start, c_end)
        } else {
            // Compute UTM zone from center longitude
            let zone = ((crop.center_lon + 180.0) / 6.0).floor() as i32 + 1;
            let (easting, northing) = latlon_to_utm(crop.center_lat, crop.center_lon, zone);

            info!("Applying projected crop target to GUNW coherence (UTM Zone {}): easting={:.1}m, northing={:.1}m, radius={:.1}km",
                zone, easting, northing, crop.radius_km);

            let radius_m = crop.radius_km * 1000.0;
            let east_min = easting - radius_m;
            let east_max = easting + radius_m;
            let north_min = northing - radius_m;
            let north_max = northing + radius_m;

            let (r_start, r_end) = find_index_range(&lats, north_min, north_max);
            let (c_start, c_end) = find_index_range(&lons, east_min, east_max);
            (r_start, r_end, c_start, c_end)
        };

        let row_start = row_start.min(full_rows);
        let row_end = row_end.min(full_rows);
        let col_start = col_start.min(full_cols);
        let col_end = col_end.min(full_cols);

        if row_end > row_start && col_end > col_start {
            let crop_rows = row_end - row_start;
            let crop_cols = col_end - col_start;

            // === MEMORY SAFETY: Guard GUNW coherence read ===
            let gunw_bytes = full_rows as u64 * full_cols as u64 * 4;
            let gunw_desc = format!(
                "read_f32 GUNW coherence {}×{} ({:.1} MB)",
                full_rows,
                full_cols,
                gunw_bytes as f64 / (1024.0 * 1024.0)
            );
            crash_journal::guard_allocation(&gunw_desc, gunw_bytes)?;
            crash_journal::checkpoint_before_alloc(&gunw_desc, gunw_bytes);

            let _timer = crash_journal::timed_scope("GUNW coherence read_f32 + crop");
            let raw_f32 = dataset
                .read_f32()
                .with_context(|| format!("Failed to read coherence data from '{}'", p))?;

            let mut cropped = Array2::<f32>::from_elem((crop_rows, crop_cols), 0.0);
            for r in 0..crop_rows {
                let global_r = row_start + r;
                let src_offset = global_r * full_cols + col_start;
                for c in 0..crop_cols {
                    cropped[[r, c]] = raw_f32[src_offset + c];
                }
            }
            drop(raw_f32);
            crash_journal::checkpoint_after_free("GUNW coherence raw_f32 dropped");
            return Ok(cropped);
        }
    }

    read_real_dataset(&file, &p)
}

// ───────────────────────────────────────────────────────────────────────────
// Internal helpers
// ───────────────────────────────────────────────────────────────────────────

/// Extract radar parameters from NISAR metadata.
/// The `product_type` arg determines which metadata path to try.
fn extract_radar_params(file: &File, product_type: &str) -> Result<NisarRadarParams> {
    let instr = detect_instrument(file);

    // Try product-specific metadata path first, fall back to RSLC path
    let bases = [
        format!(
            "/science/{}/{}/metadata/sourceData/swaths/frequencyA",
            instr, product_type
        ),
        format!(
            "/science/{}/{}/metadata/processingInformation/parameters",
            instr, product_type
        ),
        format!("/science/{}/RSLC/metadata/sourceData/swaths/frequencyA", instr),
        format!(
            "/science/{}/RSLC/metadata/processingInformation/parameters",
            instr
        ),
        format!(
            "/science/LSAR/{}/metadata/sourceData/swaths/frequencyA",
            product_type
        ),
        format!(
            "/science/LSAR/{}/metadata/processingInformation/parameters",
            product_type
        ),
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

    let is_s = instr == "SSAR" || center_frequency.map_or(false, |fc| fc > 2.0e9);
    let default_fc = if is_s { 3_200_000_000.0 } else { 1_257_500_000.0 };
    let default_bw = if is_s { 37_500_000.0 } else { 80_000_000.0 };

    let fc = center_frequency.unwrap_or(default_fc);
    let bw = range_bandwidth.unwrap_or(default_bw);
    let tau = pulse_duration.unwrap_or(40.0e-6);

    let radar_band = if fc > 2.0e9 { "S-band".to_string() } else { "L-band".to_string() };

    let params = NisarRadarParams {
        center_frequency: fc,
        range_bandwidth: bw,
        pulse_duration: tau,
        chirp_rate: chirp_rate.unwrap_or(bw / tau),
        prf: prf.unwrap_or(1_600.0),
        sample_rate: sample_rate.unwrap_or(bw * 1.2),
        instrument: instr.to_string(),
        radar_band,
    };

    info!(
        "NISAR {} ({}) params: fc={:.3} GHz (λ={:.3} m)  BW={:.1} MHz  PRF={:.1} Hz",
        params.instrument,
        params.radar_band,
        params.center_frequency / 1e9,
        params.wavelength(),
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
///   /science/{instrument}/{type}/grids/frequencyA/xCoordinates  (longitude)
///   /science/{instrument}/{type}/grids/frequencyA/yCoordinates  (latitude)
fn extract_bbox_from_grids(file: &File, product_type: &str) -> Option<GeoBoundingBox> {
    let instr = detect_instrument(file);
    let x_path = format!(
        "/science/{}/{}/grids/frequencyA/xCoordinates",
        instr, product_type
    );
    let y_path = format!(
        "/science/{}/{}/grids/frequencyA/yCoordinates",
        instr, product_type
    );

    let x_coords = read_1d_f64(file, &x_path)?;
    let y_coords = read_1d_f64(file, &y_path)?;

    info!(
        "  Found coordinate grids: {} × {} points",
        y_coords.len(),
        x_coords.len()
    );

    // For projected coordinates (UTM), these could be meters not degrees.
    // Check if values look like geographic degrees (lat: -90..90, lon: -180..360)
    let looks_geographic =
        y_coords.iter().all(|&v| v.abs() <= 90.0) && x_coords.iter().all(|&v| v.abs() <= 360.0);

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
///   /science/{instrument}/identification/boundingPolygon
/// or individual corner attributes:
///   /science/{instrument}/identification/zeroDopplerStartTime etc.
/// Some products store explicit lat/lon bounding attributes.
pub(crate) fn extract_bbox_from_identification(file: &File) -> Option<GeoBoundingBox> {
    let instr = detect_instrument(file);
    let base = format!("/science/{}/identification", instr);

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
        info!(
            "  Found identification bbox: [{:.4}, {:.4}] → [{:.4}, {:.4}]",
            s, w, n, e
        );
        return Some(GeoBoundingBox {
            south: s,
            north: n,
            west: w,
            east: e,
        });
    }

    // Try WKT boundingPolygon parsing using raw bytes
    let poly_path = format!("{}/boundingPolygon", base);

    // We do a manual dataset parsing to grab raw byte strings
    if let Ok(_dataset) = file.dataset(&poly_path) {
        let file_data = file.as_bytes();
        let sb = file.superblock();
        if let Ok(addr) = rustyhdf5_format::group_v2::resolve_path_any(file_data, sb, &poly_path) {
            if let Ok(header) = rustyhdf5_format::object_header::ObjectHeader::parse(
                file_data,
                addr as usize,
                sb.offset_size,
                sb.length_size,
            ) {
                use rustyhdf5_format::message_type::MessageType;
                let dl_msg = header
                    .messages
                    .iter()
                    .find(|m| m.msg_type == MessageType::DataLayout);
                let ds_msg = header
                    .messages
                    .iter()
                    .find(|m| m.msg_type == MessageType::Dataspace);
                let dt_msg = header
                    .messages
                    .iter()
                    .find(|m| m.msg_type == MessageType::Datatype);

                if let (Some(dl_m), Some(ds_m), Some(dt_m)) = (dl_msg, ds_msg, dt_msg) {
                    if let (Ok(dl), Ok(ds), Ok((dt, _))) = (
                        rustyhdf5_format::data_layout::DataLayout::parse(
                            &dl_m.data,
                            sb.offset_size,
                            sb.length_size,
                        ),
                        rustyhdf5_format::dataspace::Dataspace::parse(&ds_m.data, sb.length_size),
                        rustyhdf5_format::datatype::Datatype::parse(&dt_m.data),
                    ) {
                        if let Ok(raw_bytes) = rustyhdf5_format::data_read::read_raw_data_full(
                            file_data,
                            &dl,
                            &ds,
                            &dt,
                            None,
                            sb.offset_size,
                            sb.length_size,
                        ) {
                            if let Ok(wkt_str) = std::str::from_utf8(&raw_bytes) {
                                let wkt_str = wkt_str.trim_end_matches(char::from(0)); // strip nulls
                                info!("  Found boundingPolygon WKT ({} bytes)", wkt_str.len());

                                let mut lats = Vec::new();
                                let mut lons = Vec::new();
                                let coords: Vec<&str> = wkt_str.split(['(', ')', ',']).collect();

                                for chunk in coords {
                                    let parts: Vec<&str> = chunk.split_whitespace().collect();
                                    if parts.len() >= 2 {
                                        if let (Ok(lon), Ok(lat)) =
                                            (parts[0].parse::<f64>(), parts[1].parse::<f64>())
                                        {
                                            lons.push(lon);
                                            lats.push(lat);
                                        }
                                    }
                                }
                                if let Some(bbox) = GeoBoundingBox::from_bounds(&lats, &lons) {
                                    info!(
                                        "  Extracted WKT bbox: [{:.4}, {:.4}] → [{:.4}, {:.4}]",
                                        bbox.south, bbox.west, bbox.north, bbox.east
                                    );
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
    if data.is_empty() {
        return None;
    }
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

    info!(
        "  SLC shape: {} azimuth × {} range ({} complex samples)",
        n_az, n_rg, n_pixels
    );

    // ── Try high-level read_f32 first (works for plain float32 datasets) ──
    if let Ok(raw_f32) = dataset.read_f32() {
        let expected = n_pixels * 2;
        if raw_f32.len() == expected {
            info!(
                "  Read via high-level float32 API ({} MB)",
                raw_f32.len() * 4 / (1024 * 1024)
            );
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

    let header =
        rustyhdf5_format::object_header::ObjectHeader::parse(file_data, addr as usize, os, ls)
            .with_context(|| format!("Cannot parse object header for: {}", path))?;

    // Extract DataLayout, Dataspace, Datatype, and FilterPipeline from the header
    use rustyhdf5_format::message_type::MessageType;

    let dl_msg = header
        .messages
        .iter()
        .find(|m| m.msg_type == MessageType::DataLayout)
        .ok_or_else(|| anyhow::anyhow!("No DataLayout message in '{}'", path))?;
    let dl = rustyhdf5_format::data_layout::DataLayout::parse(&dl_msg.data, os, ls)
        .with_context(|| format!("Cannot parse DataLayout for '{}'", path))?;

    let ds_msg = header
        .messages
        .iter()
        .find(|m| m.msg_type == MessageType::Dataspace)
        .ok_or_else(|| anyhow::anyhow!("No Dataspace message in '{}'", path))?;
    let ds = rustyhdf5_format::dataspace::Dataspace::parse(&ds_msg.data, ls)
        .with_context(|| format!("Cannot parse Dataspace for '{}'", path))?;

    let dt_msg = header
        .messages
        .iter()
        .find(|m| m.msg_type == MessageType::Datatype)
        .ok_or_else(|| anyhow::anyhow!("No Datatype message in '{}'", path))?;
    let (dt, _) = rustyhdf5_format::datatype::Datatype::parse(&dt_msg.data)
        .with_context(|| format!("Cannot parse Datatype for '{}'", path))?;

    let pipeline = header
        .messages
        .iter()
        .find(|m| m.msg_type == MessageType::FilterPipeline)
        .and_then(|msg| rustyhdf5_format::filter_pipeline::FilterPipeline::parse(&msg.data).ok());

    // Read raw bytes — works for contiguous, compact, AND chunked layouts
    let raw_bytes = rustyhdf5_format::data_read::read_raw_data_full(
        file_data,
        &dl,
        &ds,
        &dt,
        pipeline.as_ref(),
        os,
        ls,
    )
    .with_context(|| format!("Failed to read raw data from '{}'", path))?;

    let expected_bytes = n_pixels * 8; // compound {f32, f32} = 8 bytes per sample
    info!(
        "  Read {} MB raw bytes (expected {} MB)",
        raw_bytes.len() / (1024 * 1024),
        expected_bytes / (1024 * 1024)
    );

    if raw_bytes.len() != expected_bytes {
        bail!(
            "Dataset '{}' raw size mismatch: got {} bytes, expected {} ({}×8)",
            path,
            raw_bytes.len(),
            expected_bytes,
            n_pixels
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

    info!(
        "  Decoded {} complex samples from compound type",
        complex_vec.len()
    );

    Array2::from_shape_vec((n_az, n_rg), complex_vec)
        .context("Failed to reshape SLC data into 2D array")
}

/// Read a real-valued float32 dataset (used for GCOV diagonal terms, GUNW phase).
fn read_real_dataset(file: &File, path: &str) -> Result<Array2<f32>> {
    let dataset = file
        .dataset(path)
        .with_context(|| format!("HDF5 dataset not found: {}", path))?;

    let shape = dataset
        .shape()
        .with_context(|| format!("Cannot read shape of dataset '{}'", path))?;

    if shape.len() != 2 {
        bail!("Expected 2D dataset at '{}', got {}D", path, shape.len());
    }
    let n_rows = shape[0] as usize;
    let n_cols = shape[1] as usize;

    info!("  Dataset shape: {} × {}", n_rows, n_cols);

    let raw: Vec<f32> = dataset
        .read_f32()
        .with_context(|| format!("Failed to read float32 data from '{}'", path))?;

    let expected = n_rows * n_cols;
    if raw.len() != expected {
        bail!(
            "Dataset '{}' size mismatch: got {} values, expected {} ({}×{})",
            path,
            raw.len(),
            expected,
            n_rows,
            n_cols
        );
    }

    Array2::from_shape_vec((n_rows, n_cols), raw).context("Failed to reshape data into 2D array")
}

/// Read X and Y pixel spacing attributes or datasets from the HDF5 grids.
fn read_pixel_spacing_x_y(file: &File, product_type: &str) -> (Option<f64>, Option<f64>) {
    let instr = detect_instrument(file);
    let x_path = format!(
        "/science/{}/{}/grids/frequencyA/xCoordinateSpacing",
        instr, product_type
    );
    let y_path = format!(
        "/science/{}/{}/grids/frequencyA/yCoordinateSpacing",
        instr, product_type
    );

    let dx = read_scalar_f64(file, &x_path);
    let dy = read_scalar_f64(file, &y_path);

    (dx, dy)
}

/// Extract CRS from projection metadata or grid coordinates.
fn extract_crs(file: &File, product_type: &str) -> String {
    let instr = detect_instrument(file);
    let proj_path = format!("/science/{}/{}/grids/frequencyA/projection", instr, product_type);
    if let Ok(proj_ds) = file.dataset(&proj_path) {
        if let Ok(attrs) = proj_ds.attrs() {
            if let Some(val) = attrs.get("epsg_code") {
                match val {
                    rustyhdf5::AttrValue::I64(v) => return format!("EPSG:{}", v),
                    rustyhdf5::AttrValue::U64(v) => return format!("EPSG:{}", v),
                    _ => {}
                }
            }
        }
    }

    // Fallback: check coordinates
    let x_path = format!(
        "/science/{}/{}/grids/frequencyA/xCoordinates",
        instr, product_type
    );
    let y_path = format!(
        "/science/{}/{}/grids/frequencyA/yCoordinates",
        instr, product_type
    );
    if let (Some(x_coords), Some(y_coords)) =
        (read_1d_f64(file, &x_path), read_1d_f64(file, &y_path))
    {
        let looks_geographic =
            y_coords.iter().all(|&v| v.abs() <= 90.0) && x_coords.iter().all(|&v| v.abs() <= 360.0);
        if looks_geographic {
            return "EPSG:4326".to_string();
        }
    }

    "UNKNOWN".to_string()
}

/// Convert WGS84 Lat/Lon to UTM Easting/Northing coordinates.
pub fn latlon_to_utm(lat: f64, lon: f64, zone: i32) -> (f64, f64) {
    let a = 6378137.0;
    let ecc_squared = 0.00669437999013;
    let k0 = 0.9996;

    let lat_rad = lat.to_radians();
    let lon_rad = lon.to_radians();

    let lon_origin = ((zone - 1) * 6 - 180 + 3) as f64;
    let lon_origin_rad = lon_origin.to_radians();

    let ecc_prime_squared = ecc_squared / (1.0 - ecc_squared);

    let n = a / (1.0 - ecc_squared * lat_rad.sin() * lat_rad.sin()).sqrt();
    let t = lat_rad.tan() * lat_rad.tan();
    let c = ecc_prime_squared * lat_rad.cos() * lat_rad.cos();
    let a_val = lat_rad.cos() * (lon_rad - lon_origin_rad);

    let m = a
        * ((1.0
            - ecc_squared / 4.0
            - 3.0 * ecc_squared * ecc_squared / 64.0
            - 5.0 * ecc_squared * ecc_squared * ecc_squared / 256.0)
            * lat_rad
            - (3.0 * ecc_squared / 8.0
                + 3.0 * ecc_squared * ecc_squared / 32.0
                + 45.0 * ecc_squared * ecc_squared * ecc_squared / 1024.0)
                * (2.0 * lat_rad).sin()
            + (15.0 * ecc_squared * ecc_squared / 256.0
                + 45.0 * ecc_squared * ecc_squared * ecc_squared / 1024.0)
                * (4.0 * lat_rad).sin()
            - (35.0 * ecc_squared * ecc_squared * ecc_squared / 3072.0) * (6.0 * lat_rad).sin());

    let easting = k0
        * n
        * (a_val
            + (1.0 - t + c) * a_val * a_val * a_val / 6.0
            + (5.0 - 18.0 * t + t * t + 72.0 * c - 58.0 * ecc_prime_squared)
                * a_val
                * a_val
                * a_val
                * a_val
                * a_val
                / 120.0)
        + 500000.0;

    let northing = k0
        * (m + n
            * lat_rad.tan()
            * (a_val * a_val / 2.0
                + (5.0 - t + 9.0 * c + 4.0 * c * c) * a_val * a_val * a_val * a_val / 24.0
                + (61.0 - 58.0 * t + t * t + 600.0 * c - 330.0 * ecc_prime_squared)
                    * a_val
                    * a_val
                    * a_val
                    * a_val
                    * a_val
                    * a_val
                    * a_val
                    / 720.0));

    (easting, northing)
}

/// Convert UTM Easting/Northing coordinates back to WGS84 Lat/Lon (degrees).
pub fn utm_to_latlon(
    easting: f64,
    northing: f64,
    zone: i32,
    northern_hemisphere: bool,
) -> (f64, f64) {
    let a = 6378137.0;
    let ecc_squared = 0.00669437999013;
    let k0 = 0.9996;

    let ecc_prime_squared = ecc_squared / (1.0 - ecc_squared);
    let e1 = (1.0f64 - (1.0f64 - ecc_squared).sqrt()) / (1.0f64 + (1.0f64 - ecc_squared).sqrt());

    let x = easting - 500000.0;
    let y = if northern_hemisphere {
        northing
    } else {
        northing - 10000000.0
    };

    let lon_origin = ((zone - 1) * 6 - 180 + 3) as f64;
    let lon_origin_rad = lon_origin.to_radians();

    let m = y / k0;
    let mu = m
        / (a * (1.0
            - ecc_squared / 4.0
            - 3.0 * ecc_squared * ecc_squared / 64.0
            - 5.0 * ecc_squared * ecc_squared * ecc_squared / 256.0));

    let phi1_rad = mu
        + (3.0 * e1 / 2.0 - 27.0 * e1 * e1 * e1 / 32.0) * (2.0 * mu).sin()
        + (21.0 * e1 * e1 / 16.0 - 55.0 * e1 * e1 * e1 * e1 / 32.0) * (4.0 * mu).sin()
        + (151.0 * e1 * e1 * e1 / 96.0) * (6.0 * mu).sin()
        + (1097.0 * e1 * e1 * e1 * e1 / 512.0) * (8.0 * mu).sin();

    let n1 = a / (1.0 - ecc_squared * phi1_rad.sin() * phi1_rad.sin()).sqrt();
    let t1 = phi1_rad.tan() * phi1_rad.tan();
    let c1 = ecc_prime_squared * phi1_rad.cos() * phi1_rad.cos();
    let r1 =
        a * (1.0 - ecc_squared) / (1.0 - ecc_squared * phi1_rad.sin() * phi1_rad.sin()).powf(1.5);
    let d = x / (n1 * k0);

    let lat_rad = phi1_rad
        - (n1 * phi1_rad.tan() / r1)
            * (d * d / 2.0
                - (5.0 + 3.0 * t1 + 10.0 * c1 - 4.0 * c1 * c1 - 9.0 * ecc_prime_squared)
                    * d
                    * d
                    * d
                    * d
                    / 24.0
                + (61.0 + 90.0 * t1 + 298.0 * c1 + 45.0 * t1 * t1
                    - 252.0 * ecc_prime_squared
                    - 3.0 * c1 * c1)
                    * d
                    * d
                    * d
                    * d
                    * d
                    * d
                    / 720.0);

    let lon_rad = lon_origin_rad
        + (d - (1.0 + 2.0 * t1 + c1) * d * d * d / 6.0
            + (5.0 - 2.0 * c1 + 28.0 * t1 - 3.0 * c1 * c1
                + 8.0 * ecc_prime_squared
                + 24.0 * t1 * t1)
                * d
                * d
                * d
                * d
                * d
                / 120.0)
            / phi1_rad.cos();

    (lat_rad.to_degrees(), lon_rad.to_degrees())
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
        let wavelength = NisarRadarParams::SPEED_OF_LIGHT / fc;
        assert!(
            wavelength > 0.237 && wavelength < 0.240,
            "L-band λ should be ≈23.8 cm, got {:.4} m",
            wavelength
        );
    }

    /// Verify S-band wavelength is physically correct (~9.37 cm)
    #[test]
    fn test_s_band_wavelength() {
        let fc = 3_200_000_000.0_f64; // 3.20 GHz (ISRO payload)
        let wavelength = NisarRadarParams::SPEED_OF_LIGHT / fc;
        assert!(
            wavelength > 0.092 && wavelength < 0.095,
            "S-band λ should be ≈9.37 cm, got {:.4} m",
            wavelength
        );
    }

    #[test]
    fn test_detect_instrument_from_filename() {
        assert_eq!(
            detect_instrument_from_filename("NISAR_S2_UR_GCOV_029_098_A_014_3700_DHNA_A_20260831T233810.h5"),
            Some("SSAR")
        );
        assert_eq!(
            detect_instrument_from_filename("NISAR_L2_PR_GCOV_026_098_A_014_4005_DHDH_A_20260726T233812.h5"),
            Some("LSAR")
        );
    }

    /// Verify exact geodetic roundtrip between WGS84 and UTM
    #[test]
    fn test_utm_roundtrip() {
        let test_points = [
            (18.7883, 82.6003, 44), // Upper Kolab
            (18.9306, 82.3885, 44), // Kundra Block
            (21.5339, 83.8751, 44), // Hirakud
            (0.0, 81.0, 44),        // Equator
            (45.0, -122.0, 10),     // Mid-lat West
        ];

        for (lat, lon, zone) in test_points {
            let (easting, northing) = latlon_to_utm(lat, lon, zone);
            let (rev_lat, rev_lon) = utm_to_latlon(easting, northing, zone, true);
            let err_lat = (rev_lat - lat).abs();
            let err_lon = (rev_lon - lon).abs();
            assert!(
                err_lat < 1e-6,
                "Latitude error too large: {} vs {}",
                rev_lat,
                lat
            );
            assert!(
                err_lon < 1e-6,
                "Longitude error too large: {} vs {}",
                rev_lon,
                lon
            );
        }
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

    /// Phase alignment: 10 m fine grid offset +15 m east nests onto the
    /// 20 m reference via a +1 sample shift (real 028/025 case).
    #[test]
    fn test_phase_alignment_shift_nests_10m_onto_20m() {
        let fine_center = 677_675.0;
        let ref_center = 677_690.0;
        let shift = phase_alignment_shift(fine_center, ref_center, 10.0, 2);
        assert_eq!(shift, Some(1));
    }

    /// A half-cell residual that cannot nest yields None (no silent misregistration)
    #[test]
    fn test_phase_alignment_shift_rejects_non_nesting_grids() {
        assert_eq!(phase_alignment_shift(0.0, 17.0, 10.0, 2), None);
        assert_eq!(phase_alignment_shift(0.0, 10.0, 10.0, 1), Some(1));
    }

    /// Northing grid has negative spacing (north-to-south): 028/025 northing nests at shift 0.
    #[test]
    fn test_phase_alignment_shift_handles_negative_northing_spacing() {
        let fine_northing = 3_020_615.0;
        let ref_northing = 3_020_610.0;
        let shift = phase_alignment_shift(fine_northing, ref_northing, -10.0, 2);
        assert_eq!(shift, Some(0));
    }

    #[test]
    fn test_real_s_band_and_l_band_files_if_present() {
        let s_path = Path::new("/home/aditya/Desktop/nisar_data/NISAR_S2_UR_GCOV_029_098_A_014_3700_DHNA_A_20260831T233810_20260831T233846_P00500_M_F_I_001.h5");
        if s_path.exists() {
            let file = File::open(s_path).expect("Open real S-band file");
            let instr = detect_instrument(&file);
            assert_eq!(instr, "SSAR", "Instrument for S-band file must be SSAR");
            let params = extract_radar_params(&file, "GCOV").expect("Extract S-band params");
            assert_eq!(params.instrument, "SSAR");
            assert_eq!(params.radar_band, "S-band");
            assert!((params.center_frequency - 3.2e9).abs() < 1e7, "S-band fc should be ~3.2 GHz");
            assert!((params.wavelength() - 0.093685).abs() < 1e-3, "S-band λ should be ~9.37 cm");
        }

        let l_path = Path::new("/home/aditya/Desktop/nisar_data/NISAR_L2_PR_GCOV_026_098_A_014_4005_DHDH_A_20260726T233812_20260726T233846_P05023_N_F_J_001.h5");
        if l_path.exists() {
            let file = File::open(l_path).expect("Open real L-band file");
            let instr = detect_instrument(&file);
            assert_eq!(instr, "LSAR", "Instrument for L-band file must be LSAR");
            let params = extract_radar_params(&file, "GCOV").expect("Extract L-band params");
            assert_eq!(params.instrument, "LSAR");
            assert_eq!(params.radar_band, "L-band");
            assert!((params.center_frequency - 1.239e9).abs() < 1e7, "L-band fc should be ~1.239 GHz");
            assert!((params.wavelength() - 0.242).abs() < 1e-2, "L-band λ should be ~24.2 cm");
        }
    }

    #[test]
    fn test_normalize_polarization_terms() {
        assert_eq!(normalize_gcov_cov_term("HH"), "HHHH");
        assert_eq!(normalize_gcov_cov_term("HV"), "HVHV");
        assert_eq!(normalize_gcov_cov_term("VV"), "VVVV");
        assert_eq!(normalize_gcov_cov_term("VH"), "VHVH");
        assert_eq!(normalize_gcov_cov_term("HHHH"), "HHHH");
        assert_eq!(normalize_gcov_cov_term("HVHV"), "HVHV");
        assert_eq!(normalize_gcov_cov_term("dual"), "HHHH");
        assert_eq!(normalize_gcov_cov_term("span"), "HHHH");

        assert_eq!(normalize_gslc_pol("HH"), "HH");
        assert_eq!(normalize_gslc_pol("HV"), "HV");
        assert_eq!(normalize_gslc_pol("HHHH"), "HH");
        assert_eq!(normalize_gslc_pol("HVHV"), "HV");
    }
}
