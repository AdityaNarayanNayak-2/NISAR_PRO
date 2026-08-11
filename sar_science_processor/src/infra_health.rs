use ndarray::Array2;
use serde::Serialize;

#[derive(Serialize, Clone)]
pub struct Scatterer {
    pub x: usize,
    pub y: usize,
    // Fractional geo-coordinates corresponding to x, y
    pub lon: f64,
    pub lat: f64,
    pub coherence: f32,
    pub unwrapped_phase_rad: f32,
    pub displacement_mm: f32,
    pub severity: String,
}

#[derive(Serialize, Default, Clone)]
pub struct InfraHealthSummary {
    pub total_ps_points: usize,
    pub stable_count: usize,
    pub caution_count: usize,
    pub alert_count: usize,
    pub critical_count: usize,
    pub max_displacement_mm: f32,
    pub median_displacement_mm: f32,
}

#[derive(Serialize, Clone)]
pub struct InfraHealthReport {
    pub target_id: String,
    pub summary: InfraHealthSummary,
    pub scatterers: Vec<Scatterer>,
    pub timestamp: String,
}

pub struct InfraHealthOptions {
    pub bbox: Option<[f64; 4]>, // [south, west, north, east]
    pub wavelength_m: f32,      // Default: L-Band (0.2384m)
    pub coherence_threshold: f32,
    pub max_points: usize,
}

impl Default for InfraHealthOptions {
    fn default() -> Self {
        Self {
            bbox: None,
            wavelength_m: 0.2384,
            coherence_threshold: 0.85,
            max_points: 2000,
        }
    }
}

/// Identifies Persistent Scatterers (PS) and computes displacement from unwrapped phase.
///
/// Severity thresholds are adaptive: they are derived from the Median
/// Absolute Deviation (MAD) of the displacement distribution, making them
/// robust to the per-pair atmospheric/ionospheric noise level.
///   STABLE:  |d| < 1×MAD  (within noise)
///   CAUTION: |d| < 2×MAD  (slightly elevated)
///   ALERT:   |d| < 3×MAD  (significant outlier)
///   CRITICAL: |d| ≥ 3×MAD (extreme outlier)
pub fn analyze_infrastructure_unwrapped(
    unwrapped_phase: &Array2<f32>,
    coherence: &Array2<f32>,
    options: &InfraHealthOptions,
) -> InfraHealthReport {
    assert_eq!(unwrapped_phase.dim(), coherence.dim());
    let (rows, cols) = unwrapped_phase.dim();

    let [south, west, north, east] = options.bbox.unwrap_or([0.0, 0.0, 1.0, 1.0]);
    let lat_step = (north - south) / rows as f64;
    let lon_step = (east - west) / cols as f64;

    // ── First pass: collect all valid displacement values ────────────────
    struct RawPoint {
        r: usize,
        c: usize,
        coh: f32,
        phase: f32,
        disp_mm: f32,
    }

    let mut raw_points: Vec<RawPoint> = Vec::new();
    for r in 0..rows {
        for c in 0..cols {
            let phase = unwrapped_phase[[r, c]];
            let coh = coherence[[r, c]];
            if !phase.is_finite() || !coh.is_finite() || coh < options.coherence_threshold {
                continue;
            }
            let disp_m = (phase * options.wavelength_m) / (4.0 * std::f32::consts::PI);
            let disp_mm = disp_m * 1000.0;
            raw_points.push(RawPoint {
                r,
                c,
                coh,
                phase,
                disp_mm,
            });
        }
    }

    if raw_points.is_empty() {
        return InfraHealthReport {
            target_id: "PS_INSAR_ANALYSIS".to_string(),
            summary: InfraHealthSummary::default(),
            scatterers: Vec::new(),
            timestamp: chrono::Utc::now().to_rfc3339(),
        };
    }

    // ── Compute MAD (Median Absolute Deviation) ─────────────────────────
    let mut abs_disps: Vec<f32> = raw_points.iter().map(|p| p.disp_mm.abs()).collect();
    abs_disps.sort_by(|a, b| a.partial_cmp(b).unwrap());
    let median_disp = abs_disps[abs_disps.len() / 2];

    let mut abs_devs: Vec<f32> = abs_disps.iter().map(|d| (d - median_disp).abs()).collect();
    abs_devs.sort_by(|a, b| a.partial_cmp(b).unwrap());
    let mad = abs_devs[abs_devs.len() / 2];

    // Ensure minimum thresholds so we don't classify everything as CRITICAL
    // when MAD is tiny (near-zero noise = perfectly stable)
    let mad = mad.max(2.0); // floor at 2mm (minimum meaningful displacement)

    log::info!("[PS-InSAR] Adaptive thresholds: MAD={:.2}mm → STABLE<{:.1}, CAUTION<{:.1}, ALERT<{:.1}, CRITICAL≥{:.1} mm",
        mad, mad, 2.0 * mad, 3.0 * mad, 3.0 * mad);

    // ── Second pass: classify with adaptive thresholds ───────────────────
    let mut scatterers = Vec::new();
    let mut summary = InfraHealthSummary::default();

    for p in &raw_points {
        let abs_disp = p.disp_mm.abs();
        summary.total_ps_points += 1;

        let severity = if abs_disp < mad {
            summary.stable_count += 1;
            "STABLE".to_string()
        } else if abs_disp < 2.0 * mad {
            summary.caution_count += 1;
            "CAUTION".to_string()
        } else if abs_disp < 3.0 * mad {
            summary.alert_count += 1;
            "ALERT".to_string()
        } else {
            summary.critical_count += 1;
            "CRITICAL".to_string()
        };

        if abs_disp > summary.max_displacement_mm {
            summary.max_displacement_mm = abs_disp;
        }

        let lat = north - (p.r as f64 * lat_step);
        let lon = west + (p.c as f64 * lon_step);

        scatterers.push(Scatterer {
            x: p.c,
            y: p.r,
            lon,
            lat,
            coherence: p.coh,
            unwrapped_phase_rad: p.phase,
            displacement_mm: p.disp_mm,
            severity,
        });
    }

    // Sort by absolute displacement to find median and for top N
    scatterers.sort_by(|a, b| {
        a.displacement_mm
            .abs()
            .partial_cmp(&b.displacement_mm.abs())
            .unwrap()
    });

    if !scatterers.is_empty() {
        summary.median_displacement_mm = scatterers[scatterers.len() / 2].displacement_mm.abs();
    }

    // Reverse so max displacement is first
    scatterers.reverse();
    scatterers.truncate(options.max_points);

    InfraHealthReport {
        target_id: "PS_INSAR_ANALYSIS".to_string(),
        summary,
        scatterers,
        timestamp: chrono::Utc::now().to_rfc3339(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_analyze_infrastructure_unwrapped() {
        let (rows, cols) = (100, 100);

        // Coherence > 0.85 to be included
        let coherence = Array2::from_elem((rows, cols), 0.9_f32);

        let lambda = 0.2384_f32;
        let phase_min = -0.005 * 4.0 * std::f32::consts::PI / lambda;
        let phase_max = 0.005 * 4.0 * std::f32::consts::PI / lambda;

        let mut unwrapped_phase = Array2::from_elem((rows, cols), 0.0_f32);
        for c in 0..cols {
            let frac = c as f32 / (cols - 1) as f32;
            let phase = phase_min + frac * (phase_max - phase_min);
            for r in 0..rows {
                unwrapped_phase[[r, c]] = phase;
            }
        }

        let options = InfraHealthOptions::default();
        let report = analyze_infrastructure_unwrapped(&unwrapped_phase, &coherence, &options);

        assert_eq!(report.summary.total_ps_points, 10000);

        let sum = &report.summary;
        // All points should be classified
        assert_eq!(
            sum.total_ps_points,
            sum.stable_count + sum.caution_count + sum.alert_count + sum.critical_count
        );

        // With adaptive MAD thresholds, most points should be STABLE or CAUTION
        // (the linear ramp from -5mm to +5mm has MAD ≈ 2.5mm)
        assert!(
            sum.stable_count + sum.caution_count > sum.total_ps_points / 2,
            "Expected majority STABLE+CAUTION, got stable={}, caution={}",
            sum.stable_count,
            sum.caution_count
        );

        // Max displacement should still be ~5mm
        assert!(
            (sum.max_displacement_mm - 5.0).abs() < 0.1,
            "Expected max_disp ≈ 5.0, got {}",
            sum.max_displacement_mm
        );

        // Test NaN skipping
        let mut nan_phase = unwrapped_phase.clone();
        nan_phase[[0, 0]] = f32::NAN;
        let report_nan = analyze_infrastructure_unwrapped(&nan_phase, &coherence, &options);
        assert_eq!(report_nan.summary.total_ps_points, 9999);
    }
}
