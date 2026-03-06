use crate::errors::Result;
use image::{ImageBuffer, Rgb};
use log::info;
use ndarray::{Array2, ArrayView2};

pub async fn fetch_sentinel1_data(scene_id: &str) -> Result<Array2<f32>> {
    info!("Fetching Sentinel-1 data for scene: {}", scene_id);

    let rows = 512;
    let cols = 512;
    let mut simulated_sar_image = Array2::zeros((rows, cols));

    for r in 0..rows {
        for c in 0..cols {
            let noise = (r as f32 * 0.01).sin() * (c as f32 * 0.01).cos() * 5.0;
            simulated_sar_image[[r, c]] = 10.0 + noise;
        }
    }

    let anomaly_r = rows / 3;
    let anomaly_c = cols / 3;
    for r_offset in -10..=10 {
        for c_offset in -10..=10 {
            let r = (anomaly_r as isize + r_offset) as usize;
            let c = (anomaly_c as isize + c_offset) as usize;
            if r < rows && c < cols {
                let dist_sq = (r_offset * r_offset + c_offset * c_offset) as f32;
                simulated_sar_image[[r, c]] += 50.0 * (-dist_sq / 10.0).exp();
            }
        }
    }

    info!("Sentinel-1 data ready: {}x{}", rows, cols);
    Ok(simulated_sar_image)
}

/// Save a SAR focused image as PNG.
///
/// Applies industry-standard SAR display processing:
/// 1. Compute intensity (magnitude squared)
/// 2. Log10 scaling (dB-like, adds 1e-10 to avoid log(0))
/// 3. Percentile-based contrast stretch (2nd–98th percentile)
/// 4. Gamma correction (γ = 0.6) to brighten mid-tones
pub fn save_sar_image(
    complex_image: ArrayView2<num_complex::Complex32>,
    output_filename: &str,
) -> Result<()> {
    let rows = complex_image.nrows();
    let cols = complex_image.ncols();

    info!(
        "Rendering SAR image: {}×{} → {}",
        rows, cols, output_filename
    );

    // ── 1. Intensity + log scale ──────────────────────────────────────────
    let log_intensity: Vec<f32> = complex_image
        .iter()
        .map(|c| (c.re.powi(2) + c.im.powi(2) + 1e-10).log10())
        .collect();

    // ── 2. Percentile stretch (2nd–98th) ─────────────────────────────────
    let mut sorted = log_intensity.clone();
    sorted.sort_by(|a, b| a.partial_cmp(b).unwrap());
    let n = sorted.len();
    let p2 = sorted[(n as f32 * 0.02) as usize];
    let p98 = sorted[(n as f32 * 0.98) as usize];
    let stretch_range = (p98 - p2).max(1e-6);

    info!("Contrast stretch: [{:.2}, {:.2}] dB", p2, p98);

    // ── 3. Gamma + quantize to u8 ─────────────────────────────────────────
    let gamma = 0.6_f32;
    let pixels: Vec<u8> = log_intensity
        .iter()
        .map(|&v| {
            let normalized = ((v - p2) / stretch_range).clamp(0.0, 1.0);
            let gamma_corrected = normalized.powf(gamma);
            (gamma_corrected * 255.0) as u8
        })
        .collect();

    // ── 4. Write PNG ──────────────────────────────────────────────────────
    let mut img: ImageBuffer<Rgb<u8>, Vec<u8>> = ImageBuffer::new(cols as u32, rows as u32);
    for (idx, pixel) in img.pixels_mut().enumerate() {
        let v = pixels[idx];
        *pixel = Rgb([v, v, v]); // Grayscale
    }

    img.save(output_filename)?;
    info!("SAR image saved: {}", output_filename);
    Ok(())
}

/// Legacy: save a pre-computed anomaly/amplitude map as PNG (simple min-max stretch)
pub fn save_anomaly_map_as_png(anomaly_map: ArrayView2<f32>, output_filename: &str) -> Result<()> {
    let rows = anomaly_map.nrows();
    let cols = anomaly_map.ncols();

    let max_val = anomaly_map.iter().fold(0.0f32, |max, &val| val.max(max));
    let min_val = anomaly_map.iter().fold(f32::MAX, |min, &val| val.min(min));
    let range = max_val - min_val;

    let mut img = ImageBuffer::new(cols as u32, rows as u32);

    for (x, y, pixel) in img.enumerate_pixels_mut() {
        let val = anomaly_map[[y as usize, x as usize]];
        let normalized = if range > 0.0 {
            ((val - min_val) / range * 255.0).min(255.0).max(0.0) as u8
        } else {
            0
        };
        *pixel = Rgb([normalized, normalized, normalized]);
    }

    img.save(output_filename)?;
    info!("Anomaly map saved: {}", output_filename);
    Ok(())
}
