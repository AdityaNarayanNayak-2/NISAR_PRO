use ndarray::Array2;
use num_complex::Complex32;
use serde::Serialize;

#[derive(Serialize)]
pub struct Scatterer {
    pub x: usize,
    pub y: usize,
    // Fractional geo-coordinates corresponding to x, y 
    pub lon: f64,
    pub lat: f64,
    pub coherence: f32,
    pub displacement_mm: f32,
    pub severity: String,
}

#[derive(Serialize)]
pub struct InfraHealthReport {
    pub target_id: String,
    pub scatterers: Vec<Scatterer>,
    pub timestamp: String,
}

/// Identifies Persistent Scatterers (PS) and computes displacement
pub fn analyze_infrastructure_health(
    master: &Array2<Complex32>,
    ifgram: &Array2<Complex32>,
    coherence: &Array2<f32>,
    bbox: Option<[f64; 4]>, // [south, west, north, east]
    wavelength_m: f32, // C-Band: 0.055m, L-Band: 0.24m
) -> InfraHealthReport {
    let (rows, cols) = master.dim();
    let mut scatterers = Vec::new();
    
    // Bounds for simple linear interpolation
    let [south, west, north, east] = bbox.unwrap_or([0.0, 0.0, 1.0, 1.0]);
    let lat_step = (north - south) / rows as f64;
    let lon_step = (east - west) / cols as f64;

    for r in 0..rows {
        for c in 0..cols {
            let coh = coherence[[r, c]];
            
            // PS Filter: high coherence -> reliable phase
            if coh > 0.85 {
                let phase = ifgram[[r, c]].arg(); // -pi to +pi
                
                // Displacement delta (LOS) = (phase * wavelength) / (4 * pi)
                let disp_m = (phase * wavelength_m) / (4.0 * std::f32::consts::PI);
                let disp_mm = disp_m * 1000.0;
                
                // Severity classification based on displacement magnitude
                let abs_disp = disp_mm.abs();
                let severity = if abs_disp < 2.0 {
                    "STABLE".to_string()
                } else if abs_disp < 5.0 {
                    "CAUTION".to_string()
                } else if abs_disp < 10.0 {
                    "ALERT".to_string()
                } else {
                    "CRITICAL".to_string()
                };

                let lat = north - (r as f64 * lat_step);
                let lon = west + (c as f64 * lon_step);

                scatterers.push(Scatterer {
                    x: c,
                    y: r,
                    lon,
                    lat,
                    coherence: coh,
                    displacement_mm: disp_mm,
                    severity,
                });
            }
        }
    }
    
    // To avoid bloating the GeoJSON, sort by severity (CRITICAL first) and keep top N
    scatterers.sort_by(|a, b| b.displacement_mm.abs().partial_cmp(&a.displacement_mm.abs()).unwrap());
    scatterers.truncate(2000); // Max 2000 points

    InfraHealthReport {
        target_id: "PS_INSAR_ANALYSIS".to_string(),
        scatterers,
        timestamp: chrono::Utc::now().to_rfc3339(),
    }
}
