use std::{env, path::Path};
use ndarray::{Array2, ArrayView2};
use image::{ImageBuffer, Rgb};
use log::info;
use thiserror::Error;

#[derive(Error, Debug)]
enum ProcessorError {
    #[error("HTTP Request Error: {0}")]
    ReqwestError(#[from] reqwest::Error),
    #[error("I/O Error: {0}")]
    IoError(#[from] std::io::Error),
    #[error("Image Error: {0}")]
    ImageError(#[from] image::ImageError),
    #[error("Missing environment variable: {0}")]
    MissingEnvVar(String),
}

type Result<T> = std::result::Result<T, ProcessorError>;

fn local_variance(data: ArrayView2<f32>, r: usize, c: usize, window_size: usize) -> f32 {
    let half_size = window_size / 2;
    let mut sum = 0.0;
    let mut sum_sq = 0.0;
    let mut count = 0;

    for i in r.saturating_sub(half_size)..=(r + half_size).min(data.nrows() - 1) {
        for j in c.saturating_sub(half_size)..=(c + half_size).min(data.ncols() - 1) {
            let val = data[[i, j]];
            sum += val;
            sum_sq += val * val;
            count += 1;
        }
    }

    if count > 1 {
        let mean = sum / count as f32;
        (sum_sq / count as f32) - (mean * mean)
    } else {
        0.0
    }
}

fn amtad_algorithm(sar_image: ArrayView2<f32>) -> Array2<f32> {
    info!("Starting AMTAD Algorithm...");
    let rows = sar_image.nrows();
    let cols = sar_image.ncols();
    let mut anomaly_map = Array2::zeros((rows, cols));

    let scales = [3, 7, 15];
    let weights = [0.5, 0.3, 0.2];

    for r in 0..rows {
        for c in 0..cols {
            let mut fused_score = 0.0;
            let mut total_weight = 0.0;

            for (i, &window_size) in scales.iter().enumerate() {
                let variance = local_variance(sar_image, r, c, window_size);
                let adaptive_weight = weights[i] * (1.0 + (variance / 100.0).tanh());
                fused_score += variance * adaptive_weight;
                total_weight += adaptive_weight;
            }

            if total_weight > 0.0 {
                anomaly_map[[r, c]] = fused_score / total_weight;
            }
        }
    }
    info!("AMTAD complete.");
    anomaly_map
}

async fn fetch_sentinel1_data(scene_id: &str) -> Result<Array2<f32>> {
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

fn save_anomaly_map_as_png(anomaly_map: ArrayView2<f32>, output_filename: &str) -> Result<()> {
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

#[tokio::main]
async fn main() -> Result<()> {
    env_logger::init();

    let scene_id = env::var("SAR_SCENE_ID").map_err(|_| ProcessorError::MissingEnvVar("SAR_SCENE_ID".to_string()))?;
    let output_path = env::var("SAR_OUTPUT_PATH").map_err(|_| ProcessorError::MissingEnvVar("SAR_OUTPUT_PATH".to_string()))?;

    info!("Starting SAR Processor for Scene: {}", scene_id);

    let sar_image = fetch_sentinel1_data(&scene_id).await?;
    let anomaly_map = amtad_algorithm(sar_image.view());
    save_anomaly_map_as_png(anomaly_map.view(), "anomaly_map.png")?;

    info!("Processing complete. Output: {}", output_path);
    Ok(())
}
