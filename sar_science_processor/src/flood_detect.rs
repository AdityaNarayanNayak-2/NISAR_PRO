//! 7-Stage SAR Flood & Inundation Detection Engine
//!
//! Implements multi-temporal log-ratio change detection, Otsu thresholding on
//! intensity change images, region growing, morphological filtering, and
//! multi-tier confidence scoring (with optional GUNW coherence fusion).

use log::{info, warn};
use ndarray::Array2;
use num_complex::Complex32;
use serde::{Deserialize, Serialize};

/// Radar band types with predetermined defaults
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum RadarBand {
    /// L-Band (e.g. NISAR LSAR, ALOS-2) - default
    LBand,
    /// S-Band (e.g. NISAR SSAR - ISRO payload)
    SBand,
    /// C-Band (e.g. Sentinel-1, RADARSAT-2)
    CBand,
    /// X-Band (e.g. ICEYE, TerraSAR-X)
    XBand,
}

impl std::str::FromStr for RadarBand {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "l" | "l-band" | "lband" | "lsar" => Ok(Self::LBand),
            "s" | "s-band" | "sband" | "ssar" => Ok(Self::SBand),
            "c" | "c-band" | "cband" => Ok(Self::CBand),
            "x" | "x-band" | "xband" => Ok(Self::XBand),
            _ => Err(format!("Unknown radar band '{}'. Supported: l, s, c, x", s)),
        }
    }
}

/// Detailed parameters for the 7-stage flood detection pipeline
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FloodDetectionOptions {
    /// Minimum dB change threshold required to be considered candidate water
    pub min_change_db: f32,
    /// Seed dB threshold for region growing
    pub seed_threshold_db: f32,
    /// Growth dB threshold for region growing
    pub growth_threshold_db: f32,
    /// Backscatter intensity threshold for permanent water baseline identification
    pub permanent_water_thresh_db: f32,
    /// Minimum connected component area in pixels to retain
    pub min_area_pixels: usize,
    /// Enable 3x3 median speckle filter before change calculation
    pub enable_median_filter: bool,
    /// Number of histogram bins for Otsu threshold computation
    pub otsu_bins: usize,
    /// Radar band preset to map default values
    pub radar_band: RadarBand,
}

impl FloodDetectionOptions {
    /// Create options tuned specifically for a radar band
    pub fn for_band(band: RadarBand) -> Self {
        match band {
            RadarBand::LBand => Self {
                min_change_db: -3.0,
                seed_threshold_db: -5.0,
                growth_threshold_db: -2.5,
                permanent_water_thresh_db: -13.0,
                min_area_pixels: 8,
                enable_median_filter: true,
                otsu_bins: 256,
                radar_band: RadarBand::LBand,
            },
            RadarBand::SBand => Self {
                min_change_db: -2.7,
                seed_threshold_db: -4.8,
                growth_threshold_db: -2.2,
                permanent_water_thresh_db: -12.5,
                min_area_pixels: 8,
                enable_median_filter: true,
                otsu_bins: 256,
                radar_band: RadarBand::SBand,
            },
            RadarBand::CBand => Self {
                min_change_db: -2.5,
                seed_threshold_db: -4.5,
                growth_threshold_db: -2.0,
                permanent_water_thresh_db: -12.0,
                min_area_pixels: 8,
                enable_median_filter: true,
                otsu_bins: 256,
                radar_band: RadarBand::CBand,
            },
            RadarBand::XBand => Self {
                min_change_db: -2.0,
                seed_threshold_db: -4.0,
                growth_threshold_db: -1.5,
                permanent_water_thresh_db: -10.0,
                min_area_pixels: 12,
                enable_median_filter: true,
                otsu_bins: 256,
                radar_band: RadarBand::XBand,
            },
        }
    }
}

impl Default for FloodDetectionOptions {
    fn default() -> Self {
        Self::for_band(RadarBand::LBand)
    }
}

/// Results summary containing detailed statistics for reporting
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FloodAnalysisResult {
    /// Effective threshold used for detection: min(otsu_computed, user_ceiling)
    pub otsu_threshold_db: f32,
    /// Raw Otsu threshold computed dynamically from the change histogram (uncapped)
    pub raw_otsu_threshold_db: f32,
    pub total_pixels: usize,
    pub valid_pixels: usize,
    pub permanent_water_pixels: usize,
    pub flooded_pixels_high_conf: usize,
    pub flooded_pixels_med_conf: usize,
    pub flooded_pixels_low_conf: usize,
    pub total_flooded_pixels: usize,
    pub receded_water_pixels: usize,
    pub stable_non_water_pixels: usize,
    pub flood_regions_count: usize,
    pub confidence_reasons: Vec<String>,
    pub warnings: Vec<String>,
}

/// Stage 1: Validate metadata pair compatibility
pub fn validate_gcov_pair_metadata(
    active_pol: &str,
    baseline_pol: &str,
    active_type: &str,
    baseline_type: &str,
) -> Vec<String> {
    let mut warnings = Vec::new();

    if active_pol.to_uppercase() != baseline_pol.to_uppercase() {
        warnings.push(format!(
            "Polarization mismatch: active={}, baseline={}",
            active_pol, baseline_pol
        ));
    }

    if active_type.to_uppercase() != baseline_type.to_uppercase() {
        warnings.push(format!(
            "Product type mismatch: active={}, baseline={}",
            active_type, baseline_type
        ));
    }

    warnings
}

/// Stage 2: Convert complex/real GCOV power to decibels (dB)
///
/// Power P is stored in the real component: 10 * log10(P).
/// Non-finite power and power <= 0 are nodata and become NaN, so they are
/// excluded by the valid-pixel mask before any thresholding or growth.
/// Minimum physical backscatter power for NISAR L-band GCOV (linear scale).
/// Corresponds to -40.0 dB (10 * log10(1e-4) = -40 dB).
///
/// Pixels below this floor (such as out-of-swath fill or feather zones, which
/// hold tiny non-zero floats like 1e-13..1e-6 / -130..-60 dB) are below the
/// sensor Noise Equivalent Sigma Zero (NESZ, typically ~-30 dB to -35 dB).
/// Treating them as nodata (f32::NAN) prevents out-of-swath edges from falsely
/// classifying as permanent water (< -13 dB).
pub const GCOV_MIN_VALID_POWER: f32 = 1e-4; // -40.0 dB

pub fn gcov_to_db(slc: &Array2<Complex32>) -> Array2<f32> {
    slc.mapv(|c| {
        let power = c.re;
        if power.is_finite() && power >= GCOV_MIN_VALID_POWER {
            10.0 * power.log10()
        } else {
            f32::NAN
        }
    })
}

/// Stage 3: 3x3 median filter for speckle reduction
pub fn median_filter_3x3(data: &Array2<f32>, valid_mask: &Array2<bool>) -> Array2<f32> {
    let (rows, cols) = data.dim();
    let mut filtered = data.clone();

    for r in 1..(rows.saturating_sub(1)) {
        for c in 1..(cols.saturating_sub(1)) {
            if !valid_mask[[r, c]] {
                continue;
            }

            let mut window = Vec::with_capacity(9);
            for dr in -1..=1 {
                for dc in -1..=1 {
                    let nr = (r as isize + dr) as usize;
                    let nc = (c as isize + dc) as usize;
                    if valid_mask[[nr, nc]] {
                        window.push(data[[nr, nc]]);
                    }
                }
            }

            if !window.is_empty() {
                window.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
                filtered[[r, c]] = window[window.len() / 2];
            }
        }
    }

    filtered
}

/// Stage 4a: Calculate calibrated log-ratio change image
///
/// delta_db = active_db - baseline_db
pub fn compute_change_image(active_db: &Array2<f32>, baseline_db: &Array2<f32>) -> Array2<f32> {
    assert_eq!(
        active_db.dim(),
        baseline_db.dim(),
        "Dimension mismatch in compute_change_image"
    );
    active_db - baseline_db
}

/// Deepest physical L-band change considered by the Otsu histogram (dB).
///
/// Deltas below this (≈ −70..−100 dB) are sensor-noise-floor dropouts from
/// saturated/permanent water, not flood backscatter. Including them skews Otsu
/// toward absurdly deep splits (e.g. −40 dB) that seed zero real floods.
pub const OSTSU_MIN_PHYSICAL_DB: f32 = -25.0;

/// Stage 4b: Compute Otsu's threshold on the change image histogram
///
/// Deltas deeper than [`OSTSU_MIN_PHYSICAL_DB`] are instrument-noise-floor
/// dropouts (saturated/permanent water at −70..−100 dB), not physical flood
/// backscatter. They are excluded from the histogram so a deep water-noise
/// cluster cannot drag the split below where a real L-band flood (≈ −3..−15 dB)
/// sits. A real observed failure: noise-floor pixels at −93 dB split the
/// full-range histogram at −40 dB, requiring a >40 dB drop to seed any flood.
pub fn otsu_threshold(delta_db: &Array2<f32>, valid_mask: &Array2<bool>, n_bins: usize) -> f32 {
    let mut min_val = f32::MAX;
    let mut max_val = f32::MIN;
    let mut count = 0;

    let (rows, cols) = delta_db.dim();
    for r in 0..rows {
        for c in 0..cols {
            if valid_mask[[r, c]] {
                let v = delta_db[[r, c]];
                // Physically scope to negative/zero change (specular water backscatter
                // drop), bounded below by the noise floor (exclude dropouts).
                if v.is_finite() && v <= 0.0 && v >= OSTSU_MIN_PHYSICAL_DB {
                    min_val = min_val.min(v);
                    max_val = max_val.max(v);
                    count += 1;
                }
            }
        }
    }

    if count < 16 || (max_val - min_val).abs() < 1e-5 {
        return -3.0; // Default sensible fallback
    }

    let n_bins = n_bins.clamp(16, 1024);
    let bin_width = (max_val - min_val) / (n_bins as f32);
    let mut histogram = vec![0u64; n_bins];

    for r in 0..rows {
        for c in 0..cols {
            if valid_mask[[r, c]] {
                let v = delta_db[[r, c]];
                if v.is_finite() && v <= 0.0 && v >= OSTSU_MIN_PHYSICAL_DB {
                    let bin = (((v - min_val) / bin_width) as usize).min(n_bins - 1);
                    histogram[bin] += 1;
                }
            }
        }
    }

    let total = count as f64;
    let mut sum_b = 0.0f64;
    let mut weight_b = 0.0f64;
    let mut max_var = -1.0f64;
    let mut best_bin = 0;

    let mut sum1 = 0.0f64;
    for (i, &c) in histogram.iter().enumerate() {
        let center = min_val as f64 + (i as f64 + 0.5) * bin_width as f64;
        sum1 += (c as f64) * center;
    }

    for (i, &c) in histogram.iter().enumerate() {
        weight_b += c as f64;
        if weight_b == 0.0 {
            continue;
        }
        let weight_f = total - weight_b;
        if weight_f == 0.0 {
            break;
        }

        let center = min_val as f64 + (i as f64 + 0.5) * bin_width as f64;
        sum_b += (c as f64) * center;

        let mean_b = sum_b / weight_b;
        let mean_f = (sum1 - sum_b) / weight_f;

        let var_between = weight_b * weight_f * (mean_b - mean_f) * (mean_b - mean_f);
        if var_between > max_var {
            max_var = var_between;
            best_bin = i;
        }
    }

    min_val + (best_bin as f32 + 0.5) * bin_width
}

/// Stage 5: Permanent water identification
pub fn build_permanent_water_mask(
    active_db: &Array2<f32>,
    baseline_db: &Array2<f32>,
    water_thresh_db: f32,
    external_mask: Option<&Array2<u8>>,
) -> Array2<bool> {
    let (rows, cols) = active_db.dim();
    let mut perm_mask = Array2::<bool>::from_elem((rows, cols), false);

    if let Some(ext) = external_mask {
        let (e_rows, e_cols) = ext.dim();
        for r in 0..rows {
            for c in 0..cols {
                let er = (r * e_rows / rows).min(e_rows - 1);
                let ec = (c * e_cols / cols).min(e_cols - 1);
                if ext[[er, ec]] != 255 {
                    perm_mask[[r, c]] = true;
                }
            }
        }
    } else {
        for r in 0..rows {
            for c in 0..cols {
                let a = active_db[[r, c]];
                let b = baseline_db[[r, c]];
                if a.is_finite() && b.is_finite() && a < water_thresh_db && b < water_thresh_db {
                    perm_mask[[r, c]] = true;
                }
            }
        }
    }

    perm_mask
}

/// Stage 6a: Two-threshold region growing
pub fn region_grow(
    delta_db: &Array2<f32>,
    seed_thresh_db: f32,
    growth_thresh_db: f32,
    valid_mask: &Array2<bool>,
    perm_water_mask: &Array2<bool>,
) -> Array2<bool> {
    let (rows, cols) = delta_db.dim();
    let mut grown = Array2::<bool>::from_elem((rows, cols), false);
    let mut queue = std::collections::VecDeque::new();

    // 1. Find all seed pixels
    for r in 0..rows {
        for c in 0..cols {
            if valid_mask[[r, c]] && !perm_water_mask[[r, c]] && delta_db[[r, c]] < seed_thresh_db {
                grown[[r, c]] = true;
                queue.push_back((r, c));
            }
        }
    }

    // 2. 8-connected region growing
    let neighbors: [(isize, isize); 8] = [
        (-1, -1),
        (-1, 0),
        (-1, 1),
        (0, -1),
        (0, 1),
        (1, -1),
        (1, 0),
        (1, 1),
    ];

    while let Some((r, c)) = queue.pop_front() {
        for &(dr, dc) in &neighbors {
            let nr = r as isize + dr;
            let nc = c as isize + dc;

            if nr >= 0 && nr < rows as isize && nc >= 0 && nc < cols as isize {
                let nr = nr as usize;
                let nc = nc as usize;

                if valid_mask[[nr, nc]]
                    && !perm_water_mask[[nr, nc]]
                    && !grown[[nr, nc]]
                    && delta_db[[nr, nc]] < growth_thresh_db
                {
                    grown[[nr, nc]] = true;
                    queue.push_back((nr, nc));
                }
            }
        }
    }

    grown
}

/// Stage 6b: Morphological opening/closing and connected component size filtering
pub fn morphological_cleanup(flood_mask: &mut Array2<bool>, min_area_pixels: usize) -> usize {
    let (rows, cols) = flood_mask.dim();
    let neighbors: [(isize, isize); 8] = [
        (-1, -1),
        (-1, 0),
        (-1, 1),
        (0, -1),
        (0, 1),
        (1, -1),
        (1, 0),
        (1, 1),
    ];

    // 1. Morphological Opening (Erosion then Dilation) - Removes isolated noise
    let mut eroded = Array2::<bool>::from_elem((rows, cols), false);
    for r in 1..(rows.saturating_sub(1)) {
        for c in 1..(cols.saturating_sub(1)) {
            if flood_mask[[r, c]] {
                let mut all_set = true;
                for &(dr, dc) in &neighbors {
                    let nr = (r as isize + dr) as usize;
                    let nc = (c as isize + dc) as usize;
                    if !flood_mask[[nr, nc]] {
                        all_set = false;
                        break;
                    }
                }
                eroded[[r, c]] = all_set;
            }
        }
    }

    let mut opened = Array2::<bool>::from_elem((rows, cols), false);
    for r in 1..(rows.saturating_sub(1)) {
        for c in 1..(cols.saturating_sub(1)) {
            if eroded[[r, c]] {
                opened[[r, c]] = true;
                for &(dr, dc) in &neighbors {
                    let nr = (r as isize + dr) as usize;
                    let nc = (c as isize + dc) as usize;
                    opened[[nr, nc]] = true;
                }
            }
        }
    }

    // 2. Connected Component Labeling & Size Filtering
    let mut visited = Array2::<bool>::from_elem((rows, cols), false);
    let mut component_count = 0;

    for r in 0..rows {
        for c in 0..cols {
            if opened[[r, c]] && !visited[[r, c]] {
                component_count += 1;
                let mut component_pixels = Vec::new();
                let mut q = std::collections::VecDeque::new();

                visited[[r, c]] = true;
                q.push_back((r, c));

                while let Some((curr_r, curr_c)) = q.pop_front() {
                    component_pixels.push((curr_r, curr_c));

                    for &(dr, dc) in &neighbors {
                        let nr = curr_r as isize + dr;
                        let nc = curr_c as isize + dc;
                        if nr >= 0 && nr < rows as isize && nc >= 0 && nc < cols as isize {
                            let nr = nr as usize;
                            let nc = nc as usize;
                            if opened[[nr, nc]] && !visited[[nr, nc]] {
                                visited[[nr, nc]] = true;
                                q.push_back((nr, nc));
                            }
                        }
                    }
                }

                if component_pixels.len() < min_area_pixels {
                    for (pr, pc) in component_pixels {
                        opened[[pr, pc]] = false;
                    }
                }
            }
        }
    }

    *flood_mask = opened;
    component_count
}

/// Stage 7: Confidence scoring per pixel
///
/// `strong_change_db` is the data-driven seed cutoff actually used by region
/// growing. Pixels at least this strong become High confidence (they seeded a
/// region); weaker pixels that were only grown into become Medium. Coupling to
/// this value keeps the High/Medium split consistent with the computed
/// threshold instead of a fixed constant.
///
/// Output grid values:
/// - 0: Land / No Flood (Stable Non-Water)
/// - 1: Permanent Water (Stable Water)
/// - 2: High Confidence Flood (Water Gain)
/// - 3: Medium Confidence Flood (Water Gain)
/// - 4: Low Confidence Flood (Water Gain)
/// - 5: Water Loss / Receded Water
pub fn compute_confidence(
    delta_db: &Array2<f32>,
    flood_mask: &Array2<bool>,
    perm_water_mask: &Array2<bool>,
    coherence: Option<&Array2<f32>>,
    strong_change_db: f32,
) -> (Array2<u8>, Vec<String>) {
    let (rows, cols) = delta_db.dim();
    let mut class_map = Array2::<u8>::zeros((rows, cols));
    let mut reasons = Vec::new();

    reasons.push("calibrated_log_ratio_change_detection".to_string());
    reasons.push("otsus_method_on_change_image".to_string());
    reasons.push("region_growing_and_morphology".to_string());

    let has_coh = coherence.is_some();
    if has_coh {
        reasons.push("gunw_coherence_fusion_applied".to_string());
    } else {
        reasons.push("coherence_unavailable_default_medium_confidence".to_string());
    }

    for r in 0..rows {
        for c in 0..cols {
            if perm_water_mask[[r, c]] {
                class_map[[r, c]] = 1; // Permanent Water
            } else if flood_mask[[r, c]] {
                let d = delta_db[[r, c]];
                let is_strong_change = d < strong_change_db;

                let coh_supports = if let Some(coh) = coherence {
                    coh[[r, c]] < 0.3
                } else {
                    false
                };

                if is_strong_change || (has_coh && coh_supports) {
                    class_map[[r, c]] = 2; // High Confidence
                } else if has_coh && !coh_supports {
                    class_map[[r, c]] = 4; // Low Confidence
                } else {
                    class_map[[r, c]] = 3; // Medium Confidence
                }
            }
        }
    }

    (class_map, reasons)
}

/// Main entry point for the 7-stage flood detection pipeline
pub fn run_flood_detection_pipeline(
    active_slc: &Array2<Complex32>,
    baseline_slc: Option<&Array2<Complex32>>,
    coherence: Option<&Array2<f32>>,
    external_mask: Option<&Array2<u8>>,
    opts: &FloodDetectionOptions,
) -> (Array2<u8>, Array2<f32>, FloodAnalysisResult) {
    let (rows, cols) = active_slc.dim();
    let total_pixels = rows * cols;

    info!("[FLOOD_PIPELINE] Stage 2: Converting active image to dB...");
    let active_db = gcov_to_db(active_slc);
    let mut valid_mask = active_db.mapv(|v| v.is_finite());

    let baseline_db_conv = baseline_slc.map(|base_slc| {
        info!("[FLOOD_PIPELINE] Stage 2: Converting baseline image to dB...");
        gcov_to_db(base_slc)
    });
    if let Some(base_db) = &baseline_db_conv {
        valid_mask = &valid_mask & &base_db.mapv(|v| v.is_finite());
    }
    let valid_pixels = valid_mask.iter().filter(|&&v| v).count();
    info!(
        "[FLOOD_PIPELINE] Nodata mask: {} / {} pixels valid ({:.1}%)",
        valid_pixels,
        total_pixels,
        100.0 * valid_pixels as f64 / total_pixels as f64
    );

    let active_db_filtered = if opts.enable_median_filter {
        info!("[FLOOD_PIPELINE] Stage 3: Applying 3x3 median speckle filter...");
        median_filter_3x3(&active_db, &valid_mask)
    } else {
        active_db.clone()
    };

    let (delta_db, baseline_db) = if let Some(base_db) = baseline_db_conv {
        let base_db_filtered = if opts.enable_median_filter {
            median_filter_3x3(&base_db, &valid_mask)
        } else {
            base_db
        };
        info!("[FLOOD_PIPELINE] Stage 4a: Computing log-ratio change image (active_dB - baseline_dB)...");
        (
            compute_change_image(&active_db_filtered, &base_db_filtered),
            base_db_filtered,
        )
    } else {
        warn!(
            "[FLOOD_PIPELINE] Single-image mode: Using active dB directly as baseline reference."
        );
        (active_db_filtered.clone(), active_db_filtered.clone())
    };

    info!("[FLOOD_PIPELINE] Stage 5: Identifying permanent water...");
    let perm_water_mask = build_permanent_water_mask(
        &active_db_filtered,
        &baseline_db,
        opts.permanent_water_thresh_db,
        external_mask,
    );

    // Permanent water is a stable, seasonally-persistent radar target whose
    // delta clusters around 0 dB with roughness-driven variance. Leaving those
    // thousands of pixels in the Otsu histogram drags the split down the lower
    // tail of the background distribution, so genuine flood - a small, shallow
    // secondary mode - is never separated. Exclude them from the histogram.
    // (Region growing already refuses to grow into permanent water.)
    let otsu_valid = &valid_mask & &perm_water_mask.mapv(|is_water| !is_water);
    let otsu_excluded =
        valid_mask.iter().filter(|&&v| v).count() - otsu_valid.iter().filter(|&&v| v).count();

    info!("[FLOOD_PIPELINE] Stage 4b: Computing Otsu's threshold on change image...");
    let otsu_thresh = otsu_threshold(&delta_db, &otsu_valid, opts.otsu_bins);
    let effective_threshold = otsu_thresh.min(opts.min_change_db);
    info!(
        "[FLOOD_PIPELINE] Otsu threshold: {:.2} dB | Effective threshold (with cap {:.2} dB): {:.2} dB | {} permanent-water px excluded from histogram",
        otsu_thresh, opts.min_change_db, effective_threshold, otsu_excluded
    );

    info!("[FLOOD_PIPELINE] Stage 6a: Two-threshold region growing...");

    let seed_thresh = opts.seed_threshold_db.min(effective_threshold);
    let mut flood_mask = region_grow(
        &delta_db,
        seed_thresh,
        opts.growth_threshold_db,
        &valid_mask,
        &perm_water_mask,
    );

    info!("[FLOOD_PIPELINE] Stage 6b: Morphological cleanup & size filtering...");
    let regions_count = morphological_cleanup(&mut flood_mask, opts.min_area_pixels);
    for (mask, valid) in flood_mask.iter_mut().zip(valid_mask.iter()) {
        if !*valid {
            *mask = false;
        }
    }

    info!("[FLOOD_PIPELINE] Stage 7: Multi-tier confidence scoring & 4-class temporal mapping...");
    let (mut class_map, confidence_reasons) = compute_confidence(
        &delta_db,
        &flood_mask,
        &perm_water_mask,
        coherence,
        seed_thresh,
    );

    let mut perm_count = 0;
    let mut high_count = 0;
    let mut med_count = 0;
    let mut low_count = 0;
    let mut receded_count = 0;
    let mut stable_non_water_count = 0;

    for r in 0..rows {
        for c in 0..cols {
            // For any valid pixel where class_map == 0 (neither permanent water nor flood):
            // Check for Class 5: Water Loss / Receded Water
            // Baseline was water (< water_thresh_db) -> Active is non-water (>= water_thresh_db)
            // with significant backscatter increase (active_dB - baseline_dB >= 3.0 dB).
            if valid_mask[[r, c]] && class_map[[r, c]] == 0 {
                if baseline_db[[r, c]] < opts.permanent_water_thresh_db
                    && active_db_filtered[[r, c]] >= opts.permanent_water_thresh_db
                    && delta_db[[r, c]] >= 3.0
                {
                    class_map[[r, c]] = 5;
                }
            }

            match class_map[[r, c]] {
                1 => perm_count += 1,
                2 => high_count += 1,
                3 => med_count += 1,
                4 => low_count += 1,
                5 => receded_count += 1,
                0 => {
                    if valid_mask[[r, c]] {
                        stable_non_water_count += 1;
                    }
                }
                _ => {}
            }
        }
    }

    let summary = FloodAnalysisResult {
        otsu_threshold_db: effective_threshold,
        raw_otsu_threshold_db: otsu_thresh,
        total_pixels,
        valid_pixels,
        permanent_water_pixels: perm_count,
        flooded_pixels_high_conf: high_count,
        flooded_pixels_med_conf: med_count,
        flooded_pixels_low_conf: low_count,
        total_flooded_pixels: high_count + med_count + low_count,
        receded_water_pixels: receded_count,
        stable_non_water_pixels: stable_non_water_count,
        flood_regions_count: regions_count,
        confidence_reasons,
        warnings: Vec::new(),
    };

    (class_map, delta_db, summary)
}

#[cfg(test)]
mod tests {
    use super::*;
    use num_complex::Complex32;

    #[test]
    fn test_gcov_to_db() {
        let mut slc = Array2::<Complex32>::zeros((2, 2));
        slc[[0, 0]] = Complex32::new(1.0, 0.0); // 1.0 -> 0 dB
        slc[[0, 1]] = Complex32::new(10.0, 0.0); // 10.0 -> 10 dB
        slc[[1, 0]] = Complex32::new(0.1, 0.0); // 0.1 -> -10 dB
        slc[[1, 1]] = Complex32::new(0.01, 0.0); // 0.01 -> -20 dB

        let db = gcov_to_db(&slc);
        assert!((db[[0, 0]] - 0.0).abs() < 1e-4);
        assert!((db[[0, 1]] - 10.0).abs() < 1e-4);
        assert!((db[[1, 0]] - (-10.0)).abs() < 1e-4);
        assert!((db[[1, 1]] - (-20.0)).abs() < 1e-4);
    }

    #[test]
    fn test_gcov_to_db_nodata_becomes_nan() {
        let mut slc = Array2::<Complex32>::zeros((2, 2));
        slc[[0, 0]] = Complex32::new(0.0, 0.0);
        slc[[0, 1]] = Complex32::new(-3.5, 0.0);
        slc[[1, 0]] = Complex32::new(1e-7, 0.0); // Out-of-swath feather noise floor (-70 dB)
        slc[[1, 1]] = Complex32::new(1.0, 0.0);

        let db = gcov_to_db(&slc);
        assert!(
            db[[0, 0]].is_nan(),
            "zero power must be nodata, not -100 dB"
        );
        assert!(db[[0, 1]].is_nan(), "negative power must be nodata");
        assert!(
            db[[1, 0]].is_nan(),
            "noise floor dropout < -40 dB must become NaN"
        );
        assert!(
            (db[[1, 1]] - 0.0).abs() < 1e-4,
            "valid power must convert normally"
        );
    }

    #[test]
    fn test_pipeline_excludes_nodata_from_flood() {
        let (rows, cols) = (16, 16);
        let mut active = Array2::<Complex32>::from_elem((rows, cols), Complex32::new(0.708, 0.0));
        let baseline = Array2::<Complex32>::from_elem((rows, cols), Complex32::new(10.0, 0.0));
        active[[8, 8]] = Complex32::new(0.0, 0.0);
        active[[9, 9]] = Complex32::new(f32::NAN, 0.0);

        let opts = FloodDetectionOptions::for_band(RadarBand::LBand);
        let (class_map, _delta, summary) =
            run_flood_detection_pipeline(&active, Some(&baseline), None, None, &opts);

        assert_eq!(
            class_map[[8, 8]],
            0,
            "zero-power pixel must not be classified"
        );
        assert_eq!(class_map[[9, 9]], 0, "NaN pixel must not be classified");
        assert_ne!(class_map[[0, 0]], 0, "valid drop pixel must be classified");
        assert!(summary.total_flooded_pixels >= 1);
        assert_eq!(
            summary.valid_pixels,
            rows * cols - 2,
            "two nodata pixels excluded from valid count"
        );
        assert_eq!(summary.total_pixels, rows * cols);
    }

    #[test]
    fn test_pipeline_accepts_multilooked_pair() {
        let mut active = Array2::<Complex32>::from_elem((32, 32), Complex32::new(10.0, 0.0));
        for r in 8..24 {
            for c in 8..24 {
                active[[r, c]] = Complex32::new(0.708, 0.0);
            }
        }
        let baseline = Array2::<Complex32>::from_elem((16, 16), Complex32::new(10.0, 0.0));
        let aligned = crate::multilook::multilook(&active, 2, 2);

        assert_eq!(aligned.dim(), baseline.dim());
        let opts = FloodDetectionOptions::for_band(RadarBand::LBand);
        let (class_map, _delta, summary) =
            run_flood_detection_pipeline(&aligned, Some(&baseline), None, None, &opts);

        assert_ne!(
            class_map[[8, 8]],
            0,
            "interior of flood block must be classified"
        );
        assert!(summary.total_flooded_pixels >= 1);
        assert_eq!(summary.valid_pixels, 16 * 16);
    }

    #[test]
    fn test_compute_change_image() {
        let active = Array2::from_elem((2, 2), -15.0f32);
        let baseline = Array2::from_elem((2, 2), -5.0f32);
        let delta = compute_change_image(&active, &baseline);
        assert_eq!(delta[[0, 0]], -10.0);
    }

    #[test]
    fn test_otsu_threshold() {
        let (rows, cols) = (10, 10);
        let mut delta = Array2::from_elem((rows, cols), 5.0f32);
        // Add a low change region
        for r in 3..7 {
            for c in 3..7 {
                delta[[r, c]] = -10.0f32;
            }
        }
        let valid_mask = Array2::from_elem((rows, cols), true);
        let thresh = otsu_threshold(&delta, &valid_mask, 256);
        assert!(
            thresh < 0.0,
            "Otsu threshold should separate negative change from positive"
        );
    }

    #[test]
    fn test_otsu_threshold_ignores_noise_floor_dropouts() {
        // Regression: real Assam pre/post pair had deep permanent-water dropouts
        // at -93 dB that dragged Otsu to -40.46 dB, so zero real floods (-3..-15 dB)
        // were ever seeded. The histogram must be bounded to the physical range.
        let (rows, cols) = (40, 40);
        let mut delta = Array2::from_elem((rows, cols), -0.5f32);
        // Large cluster of noise-floor permanent-water dropouts
        for r in 30..40 {
            for c in 30..40 {
                delta[[r, c]] = -93.0f32;
            }
        }
        // Genuine flood: moderate drop of -8 dB
        for r in 5..15 {
            for c in 5..15 {
                delta[[r, c]] = -8.0f32;
            }
        }
        let valid_mask = Array2::from_elem((rows, cols), true);
        let thresh = otsu_threshold(&delta, &valid_mask, 256);
        assert!(
            thresh >= -25.0,
            "Otsu threshold {thresh:.2} dB dragged below the physical floor by noise-floor dropouts"
        );
        assert!(
            thresh <= -3.0,
            "Otsu threshold {thresh:.2} dB should split off the -8 dB flood cluster"
        );
    }

    #[test]
    fn test_pipeline_detects_flood_with_noise_floor_dropouts() {
        // Full-pipeline regression for the real pair failure: a severe noise-floor
        // drop region (-50 dB) must not prevent Otsu from finding the genuine -8 dB
        // flood and producing non-zero inundation.
        let (rows, cols) = (24, 24);
        let baseline = Array2::<Complex32>::from_elem((rows, cols), Complex32::new(10.0, 0.0));
        let mut active = Array2::<Complex32>::from_elem((rows, cols), Complex32::new(10.0, 0.0));

        // Genuine flood: -8 dB drop (power 1.585 vs 10)
        for r in 4..12 {
            for c in 4..12 {
                active[[r, c]] = Complex32::new(1.585, 0.0);
            }
        }
        // Noise-floor dropout region: -50 dB drop (power 1e-4 vs 10)
        for r in 16..24 {
            for c in 16..24 {
                active[[r, c]] = Complex32::new(1.0e-4, 0.0);
            }
        }

        let opts = FloodDetectionOptions::for_band(RadarBand::LBand);
        let (_class_map, _delta_db, summary) =
            run_flood_detection_pipeline(&active, Some(&baseline), None, None, &opts);

        assert!(
            summary.raw_otsu_threshold_db >= OSTSU_MIN_PHYSICAL_DB,
            "Otsu {:.2} dB dragged below physical floor by dropout cluster",
            summary.raw_otsu_threshold_db
        );
        assert!(
            summary.total_flooded_pixels > 0,
            "expected non-zero flood area but got {:#?}",
            summary
        );
    }

    #[test]
    fn test_pipeline_excludes_permanent_water_from_otsu() {
        // Regression: a large permanent-water body (specularly dark on both
        // dates) adds a deep-delta cluster to the Otsu histogram. If it stays in
        // the histogram the split lands below the genuine shallow flood and
        // nothing is seeded. Excluding permanent water must recover the flood.
        let (rows, cols) = (40, 40);
        let land = Complex32::new(10.0, 0.0);
        let mut active = Array2::<Complex32>::from_elem((rows, cols), land);
        let mut baseline = Array2::<Complex32>::from_elem((rows, cols), land);

        // Permanent water: both dates < -13 dB -> active -33 dB, baseline -14 dB
        // (delta ~ -19 dB), a deep cluster that would dominate the histogram.
        for r in 24..40 {
            for c in 24..40 {
                active[[r, c]] = Complex32::new(5.0e-4, 0.0);
                baseline[[r, c]] = Complex32::new(0.04, 0.0);
            }
        }

        // Genuine flood: -8 dB drop (active +2 dB vs baseline +10 dB).
        for r in 4..12 {
            for c in 4..12 {
                active[[r, c]] = Complex32::new(1.585, 0.0);
            }
        }

        let opts = FloodDetectionOptions::for_band(RadarBand::LBand);
        let (class_map, _delta, summary) =
            run_flood_detection_pipeline(&active, Some(&baseline), None, None, &opts);

        assert_eq!(class_map[[30, 30]], 1, "permanent water must stay class 1");
        assert_ne!(class_map[[8, 8]], 0, "genuine flood must be detected");
        assert_eq!(
            class_map[[8, 8]],
            2,
            "seeded flood pixel must be High confidence"
        );
        assert!(
            summary.total_flooded_pixels > 0,
            "permanent-water cluster suppressed flood detection: {summary:#?}"
        );
    }

    #[test]
    fn test_region_grow_and_cleanup() {
        let (rows, cols) = (10, 10);
        let mut delta = Array2::from_elem((rows, cols), 0.0f32);
        let valid_mask = Array2::from_elem((rows, cols), true);
        let perm_water = Array2::from_elem((rows, cols), false);

        // Create a 4x4 seed block (< -5.0 dB)
        for r in 2..6 {
            for c in 2..6 {
                delta[[r, c]] = -6.0;
            }
        }

        let mut grown = region_grow(&delta, -5.0, -2.5, &valid_mask, &perm_water);
        assert!(grown[[3, 3]]);

        let regions = morphological_cleanup(&mut grown, 4);
        assert!(regions >= 1);
    }

    #[test]
    fn test_pipeline_raw_vs_effective_threshold_binding_cap() {
        let (rows, cols) = (16, 16);
        // Active: low backscatter in center (flood-like drop), baseline: high backscatter
        let mut active = Array2::<Complex32>::from_elem((rows, cols), Complex32::new(10.0, 0.0));
        let baseline = Array2::<Complex32>::from_elem((rows, cols), Complex32::new(10.0, 0.0));

        // Create a slight drop of ~ -1.5 dB in a sub-region
        // 10.0 * log10(0.708) ~= -1.5 dB -> active power = 7.08
        for r in 4..12 {
            for c in 4..12 {
                active[[r, c]] = Complex32::new(7.08, 0.0);
            }
        }

        let mut opts = FloodDetectionOptions::default();
        opts.min_change_db = -3.0; // User ceiling is -3.0 dB (more negative)

        let (_class_map, _delta_db, summary) =
            run_flood_detection_pipeline(&active, Some(&baseline), None, None, &opts);

        // Raw Otsu computed ~ -1.5 dB, while ceiling is -3.0 dB.
        // effective_threshold = otsu_thresh.min(opts.min_change_db) -> -3.0 dB.
        // Therefore cap is binding!
        assert!(summary.raw_otsu_threshold_db > opts.min_change_db);
        assert_eq!(summary.otsu_threshold_db, opts.min_change_db);
        assert_ne!(summary.raw_otsu_threshold_db, summary.otsu_threshold_db);
    }

    #[test]
    fn test_pipeline_raw_vs_effective_threshold_unbinding_cap() {
        let (rows, cols) = (16, 16);
        // Create a severe drop of -10 dB in a sub-region
        let mut active = Array2::<Complex32>::from_elem((rows, cols), Complex32::new(10.0, 0.0));
        let baseline = Array2::<Complex32>::from_elem((rows, cols), Complex32::new(10.0, 0.0));

        for r in 4..12 {
            for c in 4..12 {
                active[[r, c]] = Complex32::new(1.0, 0.0); // 10 dB drop
            }
        }

        let mut opts = FloodDetectionOptions::default();
        opts.min_change_db = -3.0; // Ceiling is -3.0 dB

        let (_class_map, _delta_db, summary) =
            run_flood_detection_pipeline(&active, Some(&baseline), None, None, &opts);

        // Severe drop makes Otsu threshold around -5 dB, which is < -3.0 dB ceiling.
        // Thus effective = min(-5, -3) = -5 = raw Otsu! Cap is not binding.
        assert!(summary.raw_otsu_threshold_db < opts.min_change_db);
        assert_eq!(summary.raw_otsu_threshold_db, summary.otsu_threshold_db);
    }

    #[test]
    fn test_radar_band_s_band() {
        let band: RadarBand = "s".parse().expect("Parse 's' as SBand");
        assert_eq!(band, RadarBand::SBand);
        let band_ssar: RadarBand = "ssar".parse().expect("Parse 'ssar' as SBand");
        assert_eq!(band_ssar, RadarBand::SBand);
        let opts = FloodDetectionOptions::for_band(band);
        assert_eq!(opts.radar_band, RadarBand::SBand);
        assert!((opts.min_change_db - -2.7).abs() < 1e-4);
        assert!((opts.permanent_water_thresh_db - -12.5).abs() < 1e-4);
    }

    #[test]
    fn test_pipeline_detects_receded_water() {
        let (rows, cols) = (16, 16);
        // Active: dry land everywhere (+10 dB)
        let active = Array2::<Complex32>::from_elem((rows, cols), Complex32::new(10.0, 0.0));
        // Baseline: dry land (+10 dB), except an 8x8 water body in the center (-20 dB)
        let mut baseline = Array2::<Complex32>::from_elem((rows, cols), Complex32::new(10.0, 0.0));
        for r in 4..12 {
            for c in 4..12 {
                baseline[[r, c]] = Complex32::new(0.01, 0.0); // 10 * log10(0.01) = -20 dB
            }
        }

        let mut opts = FloodDetectionOptions::for_band(RadarBand::LBand);
        opts.enable_median_filter = false;
        let (class_map, _delta, summary) =
            run_flood_detection_pipeline(&active, Some(&baseline), None, None, &opts);

        // Center 8x8 (64 pixels) was water at T1, dry land at T2 -> Class 5 (Water Loss / Receded)
        assert_eq!(summary.receded_water_pixels, 64);
        assert_eq!(class_map[[8, 8]], 5, "receded water pixel must be class 5");
        assert_eq!(summary.stable_non_water_pixels, (rows * cols) - 64);
        assert_eq!(class_map[[0, 0]], 0, "dry land at both dates must be class 0");
    }
}
