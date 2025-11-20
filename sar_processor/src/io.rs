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
