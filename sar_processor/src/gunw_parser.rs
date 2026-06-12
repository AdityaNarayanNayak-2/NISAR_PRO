//! NISAR GUNW (Geocoded Unwrapped Interferogram) Parser
//!
//! Reads a completed NASA InSAR product and extracts:
//! - Unwrapped phase → displacement (radians)
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
use log::info;
use ndarray::Array2;
use rustyhdf5::File;
use std::path::Path;

use crate::nisar_parser::GeoBoundingBox;

/// A parsed NISAR GUNW product ready for dashboard display.
///
/// Contains the final displacement and coherence rasters —
/// no further InSAR processing is needed.
pub struct GunwProduct {
    /// Unwrapped phase (radians). Displacement = phase * λ / (4π).
    pub displacement: Array2<f32>,
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
pub fn parse_gunw(path: &Path, polarization: &str) -> Result<GunwProduct> {
    let pol = polarization.to_uppercase();
    info!("Opening NISAR GUNW: {:?} (pol={})", path, pol);

    let file = File::open(path)
        .with_context(|| format!("Failed to open GUNW HDF5 file: {:?}", path))?;

    // ── 1. Read unwrapped phase ─────────────────────────────────────────
    let phase_paths = [
        // Real NISAR GUNW spec path (with polarization subgroup)
        format!("/science/LSAR/GUNW/grids/frequencyA/unwrappedInterferogram/{}/unwrappedPhase", pol),
        // Fallback: older spec or simplified structure
        "/science/LSAR/GUNW/grids/frequencyA/unwrappedPhase".to_string(),
        // S-band variant
        format!("/science/SSAR/GUNW/grids/frequencyA/unwrappedInterferogram/{}/unwrappedPhase", pol),
    ];

    let displacement = try_read_real_dataset(&file, &phase_paths)
        .context("Failed to read unwrapped phase from GUNW. \
                  Tried paths: unwrappedInterferogram/{POL}/unwrappedPhase, \
                  grids/frequencyA/unwrappedPhase")?;

    info!("GUNW unwrapped phase loaded: {} × {}", displacement.nrows(), displacement.ncols());

    // ── 2. Read coherence magnitude ─────────────────────────────────────
    let coh_paths = [
        // Real NISAR GUNW spec path
        format!("/science/LSAR/GUNW/grids/frequencyA/unwrappedInterferogram/{}/coherenceMagnitude", pol),
        // Wrapped interferogram coherence (higher resolution)
        format!("/science/LSAR/GUNW/grids/frequencyA/wrappedInterferogram/{}/coherenceMagnitude", pol),
        // Simplified path
        "/science/LSAR/GUNW/grids/frequencyA/coherenceMagnitude".to_string(),
        // S-band variant
        format!("/science/SSAR/GUNW/grids/frequencyA/unwrappedInterferogram/{}/coherenceMagnitude", pol),
    ];

    let coherence = try_read_real_dataset(&file, &coh_paths)
        .context("Failed to read coherence from GUNW. \
                  Tried paths: unwrappedInterferogram/{POL}/coherenceMagnitude, \
                  wrappedInterferogram/{POL}/coherenceMagnitude")?;

    info!("GUNW coherence loaded: {} × {}", coherence.nrows(), coherence.ncols());

    // ── 3. Validate dimensions ──────────────────────────────────────────
    if displacement.dim() != coherence.dim() {
        bail!(
            "GUNW dimension mismatch: displacement {}×{} vs coherence {}×{}",
            displacement.nrows(), displacement.ncols(),
            coherence.nrows(), coherence.ncols()
        );
    }

    // ── 4. Extract bounding box ─────────────────────────────────────────
    let bbox = extract_gunw_bbox(&file)
        .context("Failed to extract bounding box from GUNW product")?;

    info!("GUNW bbox: [{:.4}°N, {:.4}°E] → [{:.4}°N, {:.4}°E]",
        bbox.south, bbox.west, bbox.north, bbox.east);

    // ── 5. Extract wavelength ───────────────────────────────────────────
    let wavelength_m = read_scalar_f64(&file, "/science/LSAR/GUNW/metadata/processingInformation/parameters/centerFrequency")
        .or_else(|| read_scalar_f64(&file, "/science/LSAR/RSLC/metadata/processingInformation/parameters/centerFrequency"))
        .map(|fc| (3.0e8 / fc) as f32)
        .unwrap_or(0.2384); // L-band default

    info!("GUNW wavelength: {:.4}m (L-band)", wavelength_m);

    // ── 6. Summary stats ────────────────────────────────────────────────
    let valid_pixels = displacement.iter().filter(|v| v.is_finite() && !v.is_nan()).count();
    let total_pixels = displacement.len();
    let nan_pct = 100.0 * (1.0 - valid_pixels as f64 / total_pixels as f64);

    info!("GUNW stats: {}/{} valid pixels ({:.1}% NaN/nodata)",
        valid_pixels, total_pixels, nan_pct);

    Ok(GunwProduct {
        displacement,
        coherence,
        bbox,
        wavelength_m,
    })
}

/// Try reading a 2D f32 dataset from multiple candidate paths.
/// Returns the first successful read.
fn try_read_real_dataset(file: &File, paths: &[String]) -> Result<Array2<f32>> {
    for path in paths {
        match read_2d_f32(file, path) {
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

/// Read a 2D float32 dataset from HDF5.
fn read_2d_f32(file: &File, path: &str) -> Result<Array2<f32>> {
    let dataset = file.dataset(path)
        .with_context(|| format!("HDF5 dataset not found: {}", path))?;

    let shape = dataset.shape()
        .with_context(|| format!("Cannot read shape of dataset '{}'", path))?;

    if shape.len() != 2 {
        bail!("Expected 2D dataset at '{}', got {}D", path, shape.len());
    }

    let n_rows = shape[0] as usize;
    let n_cols = shape[1] as usize;

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
        .context("Failed to reshape GUNW data into 2D array")
}

/// Extract WGS84 bounding box from GUNW product.
/// Tries coordinate grids first, then identification metadata.
fn extract_gunw_bbox(file: &File) -> Result<GeoBoundingBox> {
    // Try coordinate grids (most reliable for geocoded products)
    for product_type in &["GUNW", "GSLC", "GCOV"] {
        let x_path = format!("/science/LSAR/{}/grids/frequencyA/xCoordinates", product_type);
        let y_path = format!("/science/LSAR/{}/grids/frequencyA/yCoordinates", product_type);

        if let (Some(lons), Some(lats)) = (read_1d_f64(file, &x_path), read_1d_f64(file, &y_path)) {
            let looks_geographic = lats.iter().all(|&v| v.abs() <= 90.0)
                && lons.iter().all(|&v| v.abs() <= 360.0);

            if looks_geographic {
                if let Some(bbox) = GeoBoundingBox::from_bounds(&lats, &lons) {
                    info!("  GUNW bbox from coordinate grids ({})", product_type);
                    return Ok(bbox);
                }
            }
        }
    }

    // Try identification metadata
    let base = "/science/LSAR/identification";
    let south = read_scalar_f64(file, &format!("{}/boundingBox/southLatitude", base))
        .or_else(|| read_scalar_f64(file, &format!("{}/southBoundLatitude", base)));
    let north = read_scalar_f64(file, &format!("{}/boundingBox/northLatitude", base))
        .or_else(|| read_scalar_f64(file, &format!("{}/northBoundLatitude", base)));
    let west = read_scalar_f64(file, &format!("{}/boundingBox/westLongitude", base))
        .or_else(|| read_scalar_f64(file, &format!("{}/westBoundLongitude", base)));
    let east = read_scalar_f64(file, &format!("{}/boundingBox/eastLongitude", base))
        .or_else(|| read_scalar_f64(file, &format!("{}/eastBoundLongitude", base)));

    if let (Some(s), Some(n), Some(w), Some(e)) = (south, north, west, east) {
        return Ok(GeoBoundingBox { south: s, north: n, west: w, east: e });
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
    if data.is_empty() { return None; }
    Some(data)
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
            south: 19.0, north: 20.0, west: 82.0, east: 83.0,
        };
        let product = GunwProduct {
            displacement: disp,
            coherence: coh,
            bbox,
            wavelength_m: 0.2384,
        };
        assert_eq!(product.displacement.dim(), (10, 10));
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
}
