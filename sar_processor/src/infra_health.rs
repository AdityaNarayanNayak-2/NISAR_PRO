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

/// Identifies Persistent Scatterers (PS) and computes displacement from unwrapped phase
pub fn analyze_infrastructure_unwrapped(
    unwrapped_phase: &Array2<f32>,
    coherence: &Array2<f32>,
    options: &InfraHealthOptions,
) -> InfraHealthReport {
    assert_eq!(unwrapped_phase.dim(), coherence.dim());
    let (rows, cols) = unwrapped_phase.dim();
    
    let mut scatterers = Vec::new();
    let mut summary = InfraHealthSummary::default();
    
    let [south, west, north, east] = options.bbox.unwrap_or([0.0, 0.0, 1.0, 1.0]);
    let lat_step = (north - south) / rows as f64;
    let lon_step = (east - west) / cols as f64;

    for r in 0..rows {
        for c in 0..cols {
            let phase = unwrapped_phase[[r, c]];
            let coh = coherence[[r, c]];
            
            // Skip NaN phases (from unwrap/topo steps) and low coherence
            if phase.is_nan() || coh < options.coherence_threshold {
                continue;
            }
            
            // Displacement delta (LOS) = (phase * wavelength) / (4 * pi)
            let disp_m = (phase * options.wavelength_m) / (4.0 * std::f32::consts::PI);
            let disp_mm = disp_m * 1000.0;
            
            let abs_disp = disp_mm.abs();
            summary.total_ps_points += 1;
            
            let severity = if abs_disp < 2.0 {
                summary.stable_count += 1;
                "STABLE".to_string()
            } else if abs_disp <= 5.0 {
                summary.caution_count += 1;
                "CAUTION".to_string()
            } else if abs_disp < 10.0 {
                summary.alert_count += 1;
                "ALERT".to_string()
            } else {
                summary.critical_count += 1;
                "CRITICAL".to_string()
            };

            if abs_disp > summary.max_displacement_mm {
                summary.max_displacement_mm = abs_disp;
            }

            let lat = north - (r as f64 * lat_step);
            let lon = west + (c as f64 * lon_step);

            scatterers.push(Scatterer {
                x: c,
                y: r,
                lon,
                lat,
                coherence: coh,
                unwrapped_phase_rad: phase,
                displacement_mm: disp_mm,
                severity,
            });
        }
    }
    
    // Sort by absolute displacement to find median and for top N
    scatterers.sort_by(|a, b| a.displacement_mm.abs().partial_cmp(&b.displacement_mm.abs()).unwrap());
    
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
        assert_eq!(sum.total_ps_points, sum.stable_count + sum.caution_count + sum.alert_count + sum.critical_count);
        
        assert!(sum.stable_count > 3800 && sum.stable_count < 4200, "stable={}", sum.stable_count);
        assert!(sum.caution_count > 5800 && sum.caution_count < 6200, "caution={}", sum.caution_count);
        assert_eq!(sum.alert_count, 0);
        assert_eq!(sum.critical_count, 0);
        
        assert!((sum.max_displacement_mm - 5.0).abs() < 1e-4);
        
        // Test NaN skipping
        let mut nan_phase = unwrapped_phase.clone();
        nan_phase[[0, 0]] = f32::NAN;
        let report_nan = analyze_infrastructure_unwrapped(&nan_phase, &coherence, &options);
        assert_eq!(report_nan.summary.total_ps_points, 9999);
    }
}
