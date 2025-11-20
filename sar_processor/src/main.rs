mod algorithm;
mod errors;
mod io;

use crate::errors::{ProcessorError, Result};
use log::info;
use std::env;

#[tokio::main]
async fn main() -> Result<()> {
    env_logger::init();

    let scene_id = env::var("SAR_SCENE_ID")
        .map_err(|_| ProcessorError::MissingEnvVar("SAR_SCENE_ID".to_string()))?;
    let output_path = env::var("SAR_OUTPUT_PATH")
        .map_err(|_| ProcessorError::MissingEnvVar("SAR_OUTPUT_PATH".to_string()))?;

    info!("Starting SAR Processor for Scene: {}", scene_id);

    let sar_image = io::fetch_sentinel1_data(&scene_id).await?;
    let anomaly_map = algorithm::amtad_algorithm(sar_image.view());
    io::save_anomaly_map_as_png(anomaly_map.view(), "anomaly_map.png")?;

    info!("Processing complete. Output: {}", output_path);
    Ok(())
}
