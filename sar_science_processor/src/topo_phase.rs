//! DEM topographic phase simulation and removal.
//!
//! In InSAR, the measured interferometric phase contains contributions from
//! both surface deformation and topography. To isolate deformation, we must
//! simulate and subtract the topographic phase using a Digital Elevation Model.
//!
//! Formula: φ_topo = (4π · B_perp · h) / (λ · R · sin θ)
//!
//! Supports reading SRTM .hgt files (binary i16, big-endian, 1201×1201 or
//! 3601×3601 grids).

use anyhow::{Context, Result};
use log::info;
use ndarray::Array2;
use std::path::Path;

/// Simulate topographic phase from a DEM and radar geometry.
///
/// # Formula
/// ```text
/// φ_topo = (4π · B_perp · h) / (λ · R · sin θ)
/// ```
///
/// # Arguments
/// * `dem` - Height above ellipsoid in meters
/// * `baseline` - Perpendicular baseline in meters
/// * `wavelength` - Radar wavelength in meters (NISAR L-band ≈ 0.2384 m)
/// * `slant_range` - Slant range to scene center in meters
/// * `incidence_angle` - Incidence angle in radians
///
/// # Returns
/// Simulated topographic phase in radians (same dimensions as `dem`).
pub fn simulate_topo_phase(
    dem: &Array2<f32>,
    baseline: f64,
    wavelength: f64,
    slant_range: f64,
    incidence_angle: f64,
) -> Array2<f32> {
    let (rows, cols) = dem.dim();

    // Pre-compute the constant factor: 4π · B_perp / (λ · R · sin θ)
    let denominator = wavelength * slant_range * incidence_angle.sin();
    let scale = 4.0 * std::f64::consts::PI * baseline / denominator;

    info!(
        "[TOPO] Simulating topo phase: {}×{}, B_perp={:.1}m, λ={:.4}m, R={:.0}m, θ={:.2}°, scale={:.6} rad/m",
        rows, cols, baseline, wavelength, slant_range,
        incidence_angle.to_degrees(), scale
    );

    Array2::from_shape_fn((rows, cols), |(r, c)| {
        (scale * dem[[r, c]] as f64) as f32
    })
}

/// Remove topographic phase from an unwrapped interferogram.
///
/// Computes `defo_phase = unwrapped_phase − topo_phase`.
/// NAN pixels in the unwrapped phase (no-data from the unwrapper) propagate
/// as NAN in the output.
///
/// # Arguments
/// * `unwrapped_phase` - Unwrapped interferometric phase in radians
/// * `topo_phase` - Simulated topographic phase from [`simulate_topo_phase`]
///
/// # Returns
/// Differential phase (deformation only) in radians.
pub fn remove_topo_phase(
    unwrapped_phase: &Array2<f32>,
    topo_phase: &Array2<f32>,
) -> Array2<f32> {
    assert_eq!(
        unwrapped_phase.dim(),
        topo_phase.dim(),
        "Phase and topo dimensions must match"
    );

    let (rows, cols) = unwrapped_phase.dim();

    info!("[TOPO] Removing topo phase from {}×{} interferogram", rows, cols);

    Array2::from_shape_fn((rows, cols), |(r, c)| {
        let u = unwrapped_phase[[r, c]];
        if u.is_nan() {
            f32::NAN
        } else {
            u - topo_phase[[r, c]]
        }
    })
}

/// Read an SRTM .hgt file (binary i16, big-endian).
///
/// SRTM tiles are square grids of signed 16-bit integers in big-endian byte order.
/// Heights are in meters above the WGS84 geoid.
///
/// Standard sizes:
/// - SRTM1 (1 arc-second): 3601 × 3601
/// - SRTM3 (3 arc-second): 1201 × 1201
///
/// Voids are encoded as -32768.
pub fn read_srtm_hgt(path: &Path) -> Result<Array2<f32>> {
    let data = std::fs::read(path)
        .with_context(|| format!("Failed to read SRTM file: {}", path.display()))?;

    let n_pixels = data.len() / 2;
    let side = (n_pixels as f64).sqrt() as usize;

    anyhow::ensure!(
        side * side == n_pixels && (side == 1201 || side == 3601),
        "Invalid SRTM file size: {} bytes → {} pixels (expected 1201² or 3601²)",
        data.len(),
        n_pixels
    );

    info!(
        "[TOPO] Read SRTM {}: {}×{} ({} arc-second)",
        path.display(),
        side,
        side,
        if side == 3601 { 1 } else { 3 }
    );

    let mut dem = Array2::<f32>::zeros((side, side));
    for r in 0..side {
        for c in 0..side {
            let idx = (r * side + c) * 2;
            let height = i16::from_be_bytes([data[idx], data[idx + 1]]);
            // SRTM void = -32768 → map to 0.0
            dem[[r, c]] = if height == -32768 { 0.0 } else { height as f32 };
        }
    }

    Ok(dem)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::f64::consts::PI as PI64;

    // NISAR L-band parameters for tests
    const WAVELENGTH: f64 = 0.2384;       // meters
    const SLANT_RANGE: f64 = 900_000.0;   // meters
    const INCIDENCE_ANGLE: f64 = 0.6109;  // ~35° in radians
    const BASELINE: f64 = 200.0;          // meters

    #[test]
    fn test_flat_dem_zero_phase() {
        // A flat DEM (h=0 everywhere) should produce zero topographic phase.
        let dem = Array2::from_elem((64, 64), 0.0_f32);
        let topo = simulate_topo_phase(&dem, BASELINE, WAVELENGTH, SLANT_RANGE, INCIDENCE_ANGLE);

        for r in 0..64 {
            for c in 0..64 {
                assert!(
                    topo[[r, c]].abs() < 1e-10,
                    "Flat DEM: topo phase at [{},{}] = {} (expected 0)",
                    r, c, topo[[r, c]]
                );
            }
        }
    }

    #[test]
    fn test_known_height_100m() {
        // DEM with uniform h=100m.
        // Expected phase: φ = (4π · 200 · 100) / (0.2384 · 900000 · sin(35°))
        //
        // Analytically:
        //   numerator   = 4π · 200 · 100  = 80000π
        //   denominator = 0.2384 · 900000 · sin(0.6109)
        //               = 0.2384 · 900000 · 0.57358
        //               = 123,037.6
        //   φ = 80000π / 123037.6 ≈ 2.0420 rad
        let dem = Array2::from_elem((32, 32), 100.0_f32);
        let topo = simulate_topo_phase(&dem, BASELINE, WAVELENGTH, SLANT_RANGE, INCIDENCE_ANGLE);

        let expected = (4.0 * PI64 * BASELINE * 100.0)
            / (WAVELENGTH * SLANT_RANGE * INCIDENCE_ANGLE.sin());

        for r in 0..32 {
            for c in 0..32 {
                let diff = (topo[[r, c]] as f64 - expected).abs();
                assert!(
                    diff < 1e-5,
                    "h=100m: topo[{},{}] = {}, expected {} (diff={})",
                    r, c, topo[[r, c]], expected, diff
                );
            }
        }
    }

    #[test]
    fn test_remove_topo_isolates_deformation() {
        // Analytically constructed scenario:
        //   - True deformation phase: 0.5 rad everywhere
        //   - Topographic height: ramp from 0 to 500m across columns
        //   - Unwrapped phase = defo_phase + topo_phase
        //   - After removal: result should equal 0.5 rad within 1e-5
        let (rows, cols) = (32, 64);
        let defo_phase = 0.5_f32; // constant deformation

        let dem = Array2::from_shape_fn((rows, cols), |(_r, c)| {
            500.0 * (c as f32) / (cols as f32 - 1.0)
        });

        let topo = simulate_topo_phase(&dem, BASELINE, WAVELENGTH, SLANT_RANGE, INCIDENCE_ANGLE);

        // Simulate measured unwrapped phase = deformation + topography
        let unwrapped = Array2::from_shape_fn((rows, cols), |(r, c)| {
            defo_phase + topo[[r, c]]
        });

        let result = remove_topo_phase(&unwrapped, &topo);

        for r in 0..rows {
            for c in 0..cols {
                let diff = (result[[r, c]] - defo_phase).abs();
                assert!(
                    diff < 1e-5,
                    "Defo isolation at [{},{}]: got {}, expected {} (diff={})",
                    r, c, result[[r, c]], defo_phase, diff
                );
            }
        }
    }

    #[test]
    fn test_remove_topo_propagates_nan() {
        // NAN pixels from the unwrapper should stay NAN after topo removal.
        let (rows, cols) = (16, 16);
        let mut unwrapped = Array2::from_elem((rows, cols), 1.0_f32);
        unwrapped[[5, 5]] = f32::NAN;
        unwrapped[[10, 10]] = f32::NAN;

        let topo = Array2::from_elem((rows, cols), 0.5_f32);

        let result = remove_topo_phase(&unwrapped, &topo);

        assert!(result[[5, 5]].is_nan(), "NAN should propagate at [5,5]");
        assert!(result[[10, 10]].is_nan(), "NAN should propagate at [10,10]");
        assert!(
            (result[[0, 0]] - 0.5).abs() < 1e-6,
            "Valid pixel: expected 0.5, got {}",
            result[[0, 0]]
        );
    }

    #[test]
    fn test_phase_proportional_to_height() {
        // φ is linear in h, so doubling height should double the phase.
        let dem_100 = Array2::from_elem((8, 8), 100.0_f32);
        let dem_200 = Array2::from_elem((8, 8), 200.0_f32);

        let topo_100 = simulate_topo_phase(&dem_100, BASELINE, WAVELENGTH, SLANT_RANGE, INCIDENCE_ANGLE);
        let topo_200 = simulate_topo_phase(&dem_200, BASELINE, WAVELENGTH, SLANT_RANGE, INCIDENCE_ANGLE);

        let ratio = topo_200[[0, 0]] / topo_100[[0, 0]];
        assert!(
            (ratio - 2.0).abs() < 1e-5,
            "Phase ratio should be 2.0 for 2× height, got {}",
            ratio
        );
    }
}
