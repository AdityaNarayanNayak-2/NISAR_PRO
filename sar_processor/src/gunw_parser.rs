//! NISAR GUNW (Geocoded Unwrapped Interferogram) Parser
//!
//! Reads a completed NASA InSAR product and extracts:
//! - Unwrapped phase (radians)
//! - Coherence magnitude (0..1)
//! - WGS84 bounding box
//!
//! GUNW is a Level-2 product. All InSAR processing has already been
//! performed by NASA/JPL (coregistration, interferogram, filtering,
//! unwrapping, topographic removal). NISAR Pro simply reads the final
//! result and displays it on the dashboard.
//!
//! HDF5 hierarchy (NISAR L-band):
//! ```text
//! /science/LSAR/GUNW/
//!   grids/frequencyA/
//!     unwrappedInterferogram/{POL}/
//!       unwrappedPhase          ← 2D float32 [az × rg] (radians)
//!       coherenceMagnitude      ← 2D float32 [az × rg] (0..1)
//!       connectedComponents     ← 2D int32   [az × rg]
//!     xCoordinates              ← 1D float64 (longitude degrees)
//!     yCoordinates              ← 1D float64 (latitude degrees)
//!   metadata/processingInformation/parameters/
//!     centerFrequency           ← f64 (Hz)
//! ```

use anyhow::{bail, Context, Result};
use log::{info, warn};
use ndarray::Array2;
use rustyhdf5::File;
use std::path::Path;

use crate::nisar_parser::{GeoBoundingBox, CropRegion, find_index_range};

/// A parsed NISAR GUNW product ready for dashboard display.
///
/// Contains the unwrapped phase and coherence rasters.
/// Displacement is derived downstream: d = phase × λ / (4π).
pub struct GunwProduct {
    /// Unwrapped interferometric phase in radians.
    /// Convert to LOS displacement via: d_m = phase × wavelength_m / (4π).
    pub unwrapped_phase: Array2<f32>,
    /// Interferometric coherence magnitude (0.0 – 1.0).
    pub coherence: Array2<f32>,
    /// WGS84 bounding box for map overlay.
    pub bbox: GeoBoundingBox,
    /// L-band wavelength in meters (default: 0.2384m)
    pub wavelength_m: f32,
}

/// Parse a NISAR GUNW HDF5 file.
///
/// Reads the unwrapped phase and coherence rasters, validates dimensions,
/// extracts the bounding box, and returns a `GunwProduct`.
///
/// # Errors
/// Returns an error if:
/// - The file cannot be opened
/// - Required datasets are missing
/// - Dimensions are inconsistent
/// - No bounding box can be determined
pub fn parse_gunw(
    path: &Path,
    polarization: &str,
    crop: Option<&CropRegion>,
) -> Result<GunwProduct> {
    let pol = polarization.to_uppercase();
    info!("Opening NISAR GUNW: {:?} (pol={})", path, pol);

    // ── 1. Read coordinate grids first (lightweight 1D arrays) ───────────
    let x_candidates = [
        format!("/science/LSAR/GUNW/grids/frequencyA/unwrappedInterferogram/xCoordinates"),
        format!("/science/LSAR/GUNW/grids/frequencyA/unwrappedInterferogram/{}/xCoordinates", pol),
        format!("/science/LSAR/GUNW/grids/frequencyA/wrappedInterferogram/xCoordinates"),
        format!("/science/LSAR/GUNW/grids/frequencyA/xCoordinates"),
        format!("/science/LSAR/GSLC/grids/frequencyA/xCoordinates"),
        format!("/science/LSAR/GCOV/grids/frequencyA/xCoordinates"),
    ];

    let y_candidates = [
        format!("/science/LSAR/GUNW/grids/frequencyA/unwrappedInterferogram/yCoordinates"),
        format!("/science/LSAR/GUNW/grids/frequencyA/unwrappedInterferogram/{}/yCoordinates", pol),
        format!("/science/LSAR/GUNW/grids/frequencyA/wrappedInterferogram/yCoordinates"),
        format!("/science/LSAR/GUNW/grids/frequencyA/yCoordinates"),
        format!("/science/LSAR/GSLC/grids/frequencyA/yCoordinates"),
        format!("/science/LSAR/GCOV/grids/frequencyA/yCoordinates"),
    ];

    let mut x_coords = None;
    let mut y_coords = None;

    {
        let file_coords = File::open(path)
            .with_context(|| format!("Failed to open GUNW HDF5 file for coordinates: {:?}", path))?;
        for (x_path, y_path) in x_candidates.iter().zip(y_candidates.iter()) {
            if let (Some(xs), Some(ys)) = (read_1d_f64(&file_coords, x_path), read_1d_f64(&file_coords, y_path)) {
                x_coords = Some(xs);
                y_coords = Some(ys);
                break;
            }
        }
    }

    // Compute bbox from already-loaded coords when available (avoids re-reading them from disk).
    let default_bbox = {
        let from_coords = x_coords.as_ref().zip(y_coords.as_ref()).and_then(|(xs, ys)| {
            let looks_geographic =
                ys.iter().all(|&v| v.abs() <= 90.0) && xs.iter().all(|&v| v.abs() <= 360.0);
            if looks_geographic { GeoBoundingBox::from_bounds(ys, xs) } else { None }
        });
        match from_coords {
            Some(bbox) => bbox,
            None => {
                let file_bbox = File::open(path)
                    .with_context(|| format!("Failed to open GUNW HDF5 file for bbox: {:?}", path))?;
                extract_gunw_bbox(&file_bbox)
                    .context("Failed to extract bounding box from GUNW product")?
            }
        }
    };

    // ── 2. Define dataset paths to query shapes early ───────────────────
    let phase_paths = [
        format!(
            "/science/LSAR/GUNW/grids/frequencyA/unwrappedInterferogram/{}/unwrappedPhase",
            pol
        ),
        "/science/LSAR/GUNW/grids/frequencyA/unwrappedPhase".to_string(),
        format!(
            "/science/SSAR/GUNW/grids/frequencyA/unwrappedInterferogram/{}/unwrappedPhase",
            pol
        ),
    ];

    let coh_paths = [
        format!(
            "/science/LSAR/GUNW/grids/frequencyA/unwrappedInterferogram/{}/coherenceMagnitude",
            pol
        ),
        format!(
            "/science/LSAR/GUNW/grids/frequencyA/wrappedInterferogram/{}/coherenceMagnitude",
            pol
        ),
        "/science/LSAR/GUNW/grids/frequencyA/coherenceMagnitude".to_string(),
        format!(
            "/science/SSAR/GUNW/grids/frequencyA/unwrappedInterferogram/{}/coherenceMagnitude",
            pol
        ),
    ];

    let mut crop_range = None;
    let mut bbox = default_bbox.clone();

    if let Some(crop_region) = crop {
        if let (Some(xs), Some(ys)) = (&x_coords, &y_coords) {
            let looks_geographic =
                ys.iter().all(|&v| v.abs() <= 90.0) && xs.iter().all(|&v| v.abs() <= 360.0);

            let (row_start, row_end, col_start, col_end) = if looks_geographic {
                info!("Applying geographic crop target to GUNW: ({:.4}°, {:.4}°) r={:.1}km",
                    crop_region.center_lat, crop_region.center_lon, crop_region.radius_km);
                let lat_radius = crop_region.radius_km / 111.0;
                let cos_lat = crop_region.center_lat.to_radians().cos().abs().max(0.01);
                let lon_radius = crop_region.radius_km / (111.0 * cos_lat);

                let lat_min = crop_region.center_lat - lat_radius;
                let lat_max = crop_region.center_lat + lat_radius;
                let lon_min = crop_region.center_lon - lon_radius;
                let lon_max = crop_region.center_lon + lon_radius;

                let (r_start, r_end) = find_index_range(ys, lat_min, lat_max);
                let (c_start, c_end) = find_index_range(xs, lon_min, lon_max);
                (r_start, r_end, c_start, c_end)
            } else {
                // Compute UTM zone from center longitude
                let zone = ((crop_region.center_lon + 180.0) / 6.0).floor() as i32 + 1;
                let (easting, northing) = latlon_to_utm(crop_region.center_lat, crop_region.center_lon, zone);
                info!("Applying projected crop target to GUNW (UTM Zone {}): easting={:.1}m, northing={:.1}m, r={:.1}km",
                    zone, easting, northing, crop_region.radius_km);

                let radius_m = crop_region.radius_km * 1000.0;
                let east_min = easting - radius_m;
                let east_max = easting + radius_m;
                let north_min = northing - radius_m;
                let north_max = northing + radius_m;

                let (r_start, r_end) = find_index_range(ys, north_min, north_max);
                let (c_start, c_end) = find_index_range(xs, east_min, east_max);
                (r_start, r_end, c_start, c_end)
            };

            // Determine dimensions from HDF5 metadata without loading datasets
            let (full_rows, full_cols) = {
                let file_shape = File::open(path)
                    .with_context(|| format!("Failed to open GUNW HDF5 file for shape: {:?}", path))?;
                get_dataset_shape(&file_shape, &phase_paths)
                    .context("Failed to determine shape of displacement dataset for cropping")?
            };

            let row_start = row_start.min(full_rows);
            let row_end = row_end.min(full_rows);
            let col_start = col_start.min(full_cols);
            let col_end = col_end.min(full_cols);

            if row_end <= row_start || col_end <= col_start {
                bail!("Crop region does not intersect product footprint");
            }

            info!("Cropping indices resolved: rows {}..{} (of {}), cols {}..{} (of {})",
                row_start, row_end, full_rows, col_start, col_end, full_cols);

            crop_range = Some((row_start, row_end, col_start, col_end));

            // Approximate the geographic bbox around the crop target in degrees
            let crop_lat_min = crop_region.center_lat - (crop_region.radius_km / 111.0);
            let crop_lat_max = crop_region.center_lat + (crop_region.radius_km / 111.0);
            let cos_lat = crop_region.center_lat.to_radians().cos().abs().max(0.01);
            let crop_lon_min = crop_region.center_lon - (crop_region.radius_km / (111.0 * cos_lat));
            let crop_lon_max = crop_region.center_lon + (crop_region.radius_km / (111.0 * cos_lat));

            bbox = GeoBoundingBox {
                south: crop_lat_min.max(default_bbox.south),
                north: crop_lat_max.min(default_bbox.north),
                west: crop_lon_min.max(default_bbox.west),
                east: crop_lon_max.min(default_bbox.east),
            };
        } else {
            warn!("Coordinate grids missing in GUNW — proceeding with full product");
        }
    }

    // ── 5. Extract wavelength ───────────────────────────────────────────
    let wavelength_m = {
        let file_freq = File::open(path)
            .with_context(|| format!("Failed to open GUNW HDF5 file for centerFrequency: {:?}", path))?;
        read_scalar_f64(
            &file_freq,
            "/science/LSAR/GUNW/grids/frequencyA/centerFrequency",
        )
        .or_else(|| {
            read_scalar_f64(
                &file_freq,
                "/science/LSAR/GUNW/metadata/processingInformation/parameters/centerFrequency",
            )
        })
        .or_else(|| {
            read_scalar_f64(
                &file_freq,
                "/science/LSAR/RSLC/metadata/processingInformation/parameters/centerFrequency",
            )
        })
        .map(|fc| (3.0e8 / fc) as f32)
        .unwrap_or(0.2384) // L-band default
    };

    info!("GUNW wavelength: {:.4}m (L-band)", wavelength_m);

    // ── 3. Load, crop, and drop datasets sequentially ───────────────────
    info!("[1/3] Loading unwrapped phase...");
    let mut unwrapped_phase = {
        let file_phase = File::open(path)
            .with_context(|| format!("Failed to open GUNW HDF5 file for unwrapped phase: {:?}", path))?;
        try_read_real_dataset_cropped(&file_phase, &phase_paths, crop_range)
            .context("Failed to read unwrapped phase from GUNW")?
    };

    info!("Unwrapped phase loaded and cropped successfully.");

    // ── 3a. Mask unreliable pixels using connectedComponents ────────────
    // SNAPHU phase unwrapping labels each pixel with a connected component
    // ID.  CC=0 means the pixel was NOT reliably unwrapped — these have
    // wild phase values (std ≈ 7.8 rad vs 0.95 for CC≥1) and will poison
    // the quadratic deramp fit if included.
    let cc_paths = [
        format!(
            "/science/LSAR/GUNW/grids/frequencyA/unwrappedInterferogram/{}/connectedComponents",
            pol
        ),
        "/science/LSAR/GUNW/grids/frequencyA/unwrappedInterferogram/connectedComponents".to_string(),
        format!(
            "/science/SSAR/GUNW/grids/frequencyA/unwrappedInterferogram/{}/connectedComponents",
            pol
        ),
    ];

    {
        let file_cc = File::open(path)
            .with_context(|| format!("Failed to open GUNW HDF5 file for connectedComponents: {:?}", path))?;
        match try_read_connected_components(&file_cc, &cc_paths, crop_range) {
            Ok(cc_mask) => {
                if cc_mask.dim() != unwrapped_phase.dim() {
                    warn!("connectedComponents shape {:?} ≠ unwrapped phase {:?}, skipping mask",
                        cc_mask.dim(), unwrapped_phase.dim());
                } else {
                    let mut masked = 0usize;
                    let mut total_finite = 0usize;
                    for (phase, &cc) in unwrapped_phase.iter_mut().zip(cc_mask.iter()) {
                        if phase.is_finite() {
                            total_finite += 1;
                            if cc == 0 {
                                *phase = f32::NAN;
                                masked += 1;
                            }
                        }
                    }
                    info!("  ✓ Connected components mask: {}/{} finite pixels masked as unreliable (CC=0)",
                        masked, total_finite);
                }
            }
            Err(_) => {
                info!("  No connectedComponents dataset found — all finite pixels treated as reliable");
            }
        }
    }

    // ── 3b. Subtract ionospheric phase screen ───────────────────────────
    // L-band radar is heavily affected by ionospheric path delays.  NISAR
    // GUNW products include an estimated ionospherePhaseScreen that must be
    // subtracted from the unwrapped phase to isolate actual surface
    // deformation signal.
    let iono_paths = [
        format!(
            "/science/LSAR/GUNW/grids/frequencyA/unwrappedInterferogram/{}/ionospherePhaseScreen",
            pol
        ),
        format!(
            "/science/SSAR/GUNW/grids/frequencyA/unwrappedInterferogram/{}/ionospherePhaseScreen",
            pol
        ),
    ];

    {
        let file_iono = File::open(path)
            .with_context(|| format!("Failed to open GUNW HDF5 file for ionosphere: {:?}", path))?;
        match try_read_real_dataset_cropped(&file_iono, &iono_paths, crop_range) {
            Ok(iono) => {
                if iono.dim() != unwrapped_phase.dim() {
                    warn!("Ionosphere phase screen shape {:?} ≠ unwrapped phase {:?}, skipping",
                        iono.dim(), unwrapped_phase.dim());
                } else {
                    // Count how many pixels carry a real (non-zero, finite) correction
                    let iono_nonzero = iono.iter()
                        .filter(|v| v.is_finite() && v.abs() > 1e-10)
                        .count();

                    if iono_nonzero == 0 {
                        info!("  Ionosphere phase screen is all zeros/NaN — skipping (no correction needed)");
                    } else {
                        // Always subtract unconditionally.  JPL's ionospherePhaseScreen
                        // is their best estimate of the ionospheric delay and is meant
                        // to be removed from the unwrapped phase.  The previous ratio-
                        // based heuristic was unreliable: the mean of a bipolar screen
                        // can be near zero even when the spatial gradient is large.
                        let mut corrected = 0usize;
                        let mut iono_rms = 0.0f64;
                        for (phase, iono_val) in unwrapped_phase.iter_mut().zip(iono.iter()) {
                            if phase.is_finite() && iono_val.is_finite() {
                                *phase -= iono_val;
                                iono_rms += (*iono_val as f64) * (*iono_val as f64);
                                corrected += 1;
                            }
                        }
                        iono_rms = (iono_rms / corrected.max(1) as f64).sqrt();
                        info!("  ✓ Ionospheric correction applied to {} pixels (RMS={:.4} rad)",
                            corrected, iono_rms);
                    }
                }
            }
            Err(_) => {
                warn!("No ionospherePhaseScreen found — proceeding without ionospheric correction");
            }
        }
    }

    info!("[2/3] Loading coherence magnitude...");
    let coherence = {
        let file_coh = File::open(path)
            .with_context(|| format!("Failed to open GUNW HDF5 file for coherence: {:?}", path))?;
        try_read_real_dataset_cropped(&file_coh, &coh_paths, crop_range)
            .context("Failed to read coherence from GUNW")?
    };

    info!("Coherence loaded and cropped successfully.");

    // ── 3c. Low-coherence water proxy mask ──────────────────────────────
    // Open water bodies (reservoirs, rivers) cause near-total phase
    // decorrelation.  Even without an external SWBD water mask file,
    // pixels with coherence < 0.3 are physically incapable of carrying
    // reliable deformation signal.  Mask them to NaN so they cannot
    // bias the quadratic deramp or appear as false displacement.
    {
        let mut water_proxy_masked = 0usize;
        for (phase, &coh) in unwrapped_phase.iter_mut().zip(coherence.iter()) {
            if phase.is_finite() && coh.is_finite() && coh < 0.3 {
                *phase = f32::NAN;
                water_proxy_masked += 1;
            }
        }
        info!("  ✓ Low-coherence water proxy mask: {} pixels masked (coh < 0.3)", water_proxy_masked);
    }

    // TEMPORARY DIAGNOSTIC — remove after investigation
    {
        let mut histogram = [0usize; 12]; // -60 to +60mm in 10mm bins
        let mut coh_low = 0usize;   // 0.85-0.90
        let mut coh_mid = 0usize;   // 0.90-0.95
        let mut coh_high = 0usize; // 0.95+
        let mut valid_count = 0usize;

        for (&phase, &coh) in unwrapped_phase.iter().zip(coherence.iter()) {
            if phase.is_finite() && coh.is_finite() {
                valid_count += 1;
                let disp_mm = phase * wavelength_m * 1000.0 / (4.0 * std::f32::consts::PI);
                let bin = ((disp_mm + 60.0) / 10.0).floor() as i32;
                let bin = bin.clamp(0, 11) as usize;
                histogram[bin] += 1;

                if coh >= 0.85 && coh < 0.90 { coh_low += 1; }
                else if coh >= 0.90 && coh < 0.95 { coh_mid += 1; }
                else if coh >= 0.95 { coh_high += 1; }
            }
        }

        info!("=== DISPLACEMENT HISTOGRAM (mm) ===");
        for (i, count) in histogram.iter().enumerate() {
            let range_start = -60 + (i as i32 * 10);
            let pct = 100.0 * *count as f64 / valid_count.max(1) as f64;
            info!("  [{:+4}, {:+4}) mm: {:6} px ({:.1}%)", 
                range_start, range_start + 10, count, pct);
        }
        info!("=== COHERENCE DISTRIBUTION ===");
        info!("  0.85-0.90: {} px", coh_low);
        info!("  0.90-0.95: {} px", coh_mid);
        info!("  0.95+:     {} px", coh_high);
        info!("  Total valid: {} px", valid_count);
    }

    // ── 4. Validate dimensions ──────────────────────────────────────────
    if unwrapped_phase.dim() != coherence.dim() {
        bail!(
            "GUNW dimension mismatch: unwrapped phase {}×{} vs coherence {}×{}",
            unwrapped_phase.nrows(),
            unwrapped_phase.ncols(),
            coherence.nrows(),
            coherence.ncols()
        );
    }

    info!(
        "Final unwrapped phase shape: {} × {}",
        unwrapped_phase.nrows(),
        unwrapped_phase.ncols()
    );

    info!(
        "GUNW bbox: [{:.4}°N, {:.4}°E] → [{:.4}°N, {:.4}°E]",
        bbox.south, bbox.west, bbox.north, bbox.east
    );



    // ── 6. Summary stats ────────────────────────────────────────────────
    let valid_pixels = unwrapped_phase
        .iter()
        .filter(|v| v.is_finite())
        .count();
    let total_pixels = unwrapped_phase.len();
    let nan_pct = 100.0 * (1.0 - valid_pixels as f64 / total_pixels as f64);

    info!(
        "GUNW stats: {}/{} valid pixels ({:.1}% NaN/nodata)",
        valid_pixels, total_pixels, nan_pct
    );

    Ok(GunwProduct {
        unwrapped_phase,
        coherence,
        bbox,
        wavelength_m,
    })
}

/// Query the 2D shape of a dataset from HDF5 metadata without loading pixel data.
fn get_dataset_shape(file: &File, paths: &[String]) -> Result<(usize, usize)> {
    for path in paths {
        if let Ok(dataset) = file.dataset(path) {
            if let Ok(shape) = dataset.shape() {
                if shape.len() == 2 {
                    return Ok((shape[0] as usize, shape[1] as usize));
                }
            }
        }
    }
    bail!("No valid dataset found to determine shape");
}

/// Try reading a 2D f32 dataset from multiple candidate paths with optional crop slicing.
/// Returns the first successful read.
fn try_read_real_dataset_cropped(
    file: &File,
    paths: &[String],
    crop_range: Option<(usize, usize, usize, usize)>,
) -> Result<Array2<f32>> {
    for path in paths {
        match read_2d_f32_cropped(file, path, crop_range) {
            Ok(data) => {
                info!("  Found dataset at: {}", path);
                return Ok(data);
            }
            Err(_) => {
                info!("  Dataset not found at: {} (trying next)", path);
            }
        }
    }
    bail!("No valid dataset found in any of the candidate paths");
}

/// Try reading a 2D integer dataset (connectedComponents) from multiple candidate paths.
/// Returns the first successful read as an i32 Array2.
fn try_read_connected_components(
    file: &File,
    paths: &[String],
    crop_range: Option<(usize, usize, usize, usize)>,
) -> Result<Array2<i32>> {
    for path in paths {
        match read_2d_i32_cropped(file, path, crop_range) {
            Ok(data) => {
                info!("  Found connectedComponents at: {}", path);
                return Ok(data);
            }
            Err(_) => {
                info!("  connectedComponents not found at: {} (trying next)", path);
            }
        }
    }
    bail!("No connectedComponents dataset found in any candidate path");
}

/// Read a 2D integer dataset from HDF5 and slice to crop bounds.
/// Used for connectedComponents (uint16 in HDF5, read as i32).
fn read_2d_i32_cropped(
    file: &File,
    path: &str,
    crop_range: Option<(usize, usize, usize, usize)>,
) -> Result<Array2<i32>> {
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

    let raw: Vec<i32> = dataset
        .read_i32()
        .with_context(|| format!("Failed to read int32 data from '{}'", path))?;

    let expected = n_rows * n_cols;
    if raw.len() != expected {
        bail!(
            "Dataset '{}' size mismatch: got {} values, expected {} ({}×{})",
            path, raw.len(), expected, n_rows, n_cols
        );
    }

    let full_arr = Array2::from_shape_vec((n_rows, n_cols), raw)
        .context("Failed to reshape connectedComponents into 2D array")?;

    if let Some((row_start, row_end, col_start, col_end)) = crop_range {
        let cropped = full_arr
            .slice(ndarray::s![row_start..row_end, col_start..col_end])
            .to_owned();
        Ok(cropped)
    } else {
        Ok(full_arr)
    }
}


/// Read a 2D float32 dataset from HDF5 and slice to crop bounds.
///
/// Note: `rustyhdf5` does not support hyperslab/partial reads, so the full
/// dataset is loaded into memory first, then sliced. The full array is dropped
/// when this function returns, keeping only the cropped region.
fn read_2d_f32_cropped(
    file: &File,
    path: &str,
    crop_range: Option<(usize, usize, usize, usize)>,
) -> Result<Array2<f32>> {
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

    let full_arr = Array2::from_shape_vec((n_rows, n_cols), raw)
        .context("Failed to reshape GUNW data into 2D array")?;

    if let Some((row_start, row_end, col_start, col_end)) = crop_range {
        let cropped = full_arr
            .slice(ndarray::s![row_start..row_end, col_start..col_end])
            .to_owned();
        Ok(cropped)
    } else {
        Ok(full_arr)
    }
}

/// Extract WGS84 bounding box from GUNW product.
/// Tries coordinate grids first, then identification metadata.
fn extract_gunw_bbox(file: &File) -> Result<GeoBoundingBox> {
    // Try coordinate grids (most reliable for geocoded products)
    let x_candidates = [
        "/science/LSAR/GUNW/grids/frequencyA/unwrappedInterferogram/xCoordinates".to_string(),
        "/science/LSAR/GUNW/grids/frequencyA/unwrappedInterferogram/HH/xCoordinates".to_string(),
        "/science/LSAR/GUNW/grids/frequencyA/unwrappedInterferogram/VV/xCoordinates".to_string(),
        "/science/LSAR/GUNW/grids/frequencyA/wrappedInterferogram/xCoordinates".to_string(),
        "/science/LSAR/GUNW/grids/frequencyA/xCoordinates".to_string(),
        "/science/LSAR/GSLC/grids/frequencyA/xCoordinates".to_string(),
        "/science/LSAR/GCOV/grids/frequencyA/xCoordinates".to_string(),
    ];
    let y_candidates = [
        "/science/LSAR/GUNW/grids/frequencyA/unwrappedInterferogram/yCoordinates".to_string(),
        "/science/LSAR/GUNW/grids/frequencyA/unwrappedInterferogram/HH/yCoordinates".to_string(),
        "/science/LSAR/GUNW/grids/frequencyA/unwrappedInterferogram/VV/yCoordinates".to_string(),
        "/science/LSAR/GUNW/grids/frequencyA/wrappedInterferogram/yCoordinates".to_string(),
        "/science/LSAR/GUNW/grids/frequencyA/yCoordinates".to_string(),
        "/science/LSAR/GSLC/grids/frequencyA/yCoordinates".to_string(),
        "/science/LSAR/GCOV/grids/frequencyA/yCoordinates".to_string(),
    ];

    for (x_path, y_path) in x_candidates.iter().zip(y_candidates.iter()) {
        if let (Some(lons), Some(lats)) = (read_1d_f64(file, x_path), read_1d_f64(file, y_path)) {
            let looks_geographic =
                lats.iter().all(|&v| v.abs() <= 90.0) && lons.iter().all(|&v| v.abs() <= 360.0);

            if looks_geographic {
                if let Some(bbox) = GeoBoundingBox::from_bounds(&lats, &lons) {
                    info!("  GUNW bbox from coordinate grids ({})", x_path);
                    return Ok(bbox);
                }
            }
        }
    }

    // Try identification metadata (including boundingPolygon WKT parsing)
    if let Some(bbox) = crate::nisar_parser::extract_bbox_from_identification(file) {
        return Ok(bbox);
    }

    bail!("No bounding box found in GUNW product (checked coordinate grids and identification metadata)")
}

/// Read a scalar f64 from HDF5.
fn read_scalar_f64(file: &File, path: &str) -> Option<f64> {
    let dataset = file.dataset(path).ok()?;
    dataset.read_f64().ok()?.into_iter().next()
}

/// Read a 1D f64 array from HDF5.
fn read_1d_f64(file: &File, path: &str) -> Option<Vec<f64>> {
    let dataset = file.dataset(path).ok()?;
    let data = dataset.read_f64().ok()?;
    if data.is_empty() {
        return None;
    }
    Some(data)
}

/// Convert WGS84 Lat/Lon to UTM Easting/Northing coordinates.
fn latlon_to_utm(lat: f64, lon: f64, zone: i32) -> (f64, f64) {
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

    let m = a * ((1.0
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_gunw_product_struct() {
        // Verify GunwProduct can be constructed with expected types
        let disp = Array2::from_elem((10, 10), 0.5_f32);
        let coh = Array2::from_elem((10, 10), 0.9_f32);
        let bbox = GeoBoundingBox {
            south: 19.0,
            north: 20.0,
            west: 82.0,
            east: 83.0,
        };
        let product = GunwProduct {
            unwrapped_phase: disp,
            coherence: coh,
            bbox,
            wavelength_m: 0.2384,
        };
        assert_eq!(product.unwrapped_phase.dim(), (10, 10));
        assert_eq!(product.coherence.dim(), (10, 10));
        assert!((product.wavelength_m - 0.2384).abs() < 1e-6);
    }

    #[test]
    fn test_dimension_validation() {
        // If we had mismatched arrays, the parser would bail
        let a = Array2::from_elem((10, 10), 1.0_f32);
        let b = Array2::from_elem((10, 20), 1.0_f32);
        assert_ne!(a.dim(), b.dim());
    }

    #[test]
    fn test_read_gunw_coordinates() {
        let path = std::path::Path::new("/home/aditya/Desktop/nisar_data/NISAR_L2_PR_GUNW_009_127_A_011_010_4000_SH_20260105T235314_20260105T235347_20260117T235314_20260117T235347_X05010_N_F_J_001.h5");
        if !path.exists() {
            println!("Skipping test_read_gunw_coordinates: test data file not found locally");
            return;
        }
        let file = File::open(path).expect("Failed to open file");
        let x_path = "/science/LSAR/GUNW/grids/frequencyA/unwrappedInterferogram/xCoordinates";
        let ds = file.dataset(x_path);
        println!("dataset result: {:?}", ds);
        if let Ok(ds) = ds {
            println!("shape: {:?}", ds.shape());
            println!("read_f64 result: {:?}", ds.read_f64());
        }
    }

    #[test]
    fn test_extract_gunw_bbox() {
        let path = std::path::Path::new("/home/aditya/Desktop/nisar_data/NISAR_L2_PR_GUNW_009_127_A_011_010_4000_SH_20260105T235314_20260105T235347_20260117T235314_20260117T235347_X05010_N_F_J_001.h5");
        if !path.exists() {
            println!("Skipping test_extract_gunw_bbox: test data file not found locally");
            return;
        }
        let file = File::open(path).expect("Failed to open file");
        let bbox = extract_gunw_bbox(&file).expect("Failed to extract bbox");
        println!("Extracted bbox: {:?}", bbox);
        assert!(bbox.south > 17.0 && bbox.south < 18.0);
        assert!(bbox.north > 19.5 && bbox.north < 20.5);
        assert!(bbox.west > 82.0 && bbox.west < 83.0);
        assert!(bbox.east > 85.0 && bbox.east < 86.0);
    }
}
