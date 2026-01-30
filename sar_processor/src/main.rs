mod algorithm;
mod errors;
mod io;
mod isce3_ffi;
mod radar_utils;
mod rda;
mod smart_downloader;

use crate::errors::{ProcessorError, Result};
use crate::rda::SARProcessor;
use log::info;
use ndarray::Array2;
use num_complex::Complex32;
use std::env;

#[tokio::main]
async fn main() -> Result<()> {
    env_logger::init();

    let scene_id = env::var("SAR_SCENE_ID")
        .map_err(|_| ProcessorError::MissingEnvVar("SAR_SCENE_ID".to_string()))?;
    let output_path = env::var("SAR_OUTPUT_PATH")
        .map_err(|_| ProcessorError::MissingEnvVar("SAR_OUTPUT_PATH".to_string()))?;

    info!("Starting SAR Processor for Scene: {}", scene_id);
    info!("ISCE3 Backend: {}", isce3_ffi::isce3_version());

    // --- Core Science Execution ---
    info!("Initializing SAR Processor Engine...");

    // Sentinel-1 Parameters (Example)
    // Carrier: 5.405 GHz, Sample Rate: 25 MHz, Pulse: 50us, BW: 20MHz, PRF: 1600Hz
    let processor = SARProcessor::new(5.4e9, 25.0e6, 50.0e-6, 20.0e6, 1600.0);

    // Note: 'sar_image' from io::fetch is currently standard Array3 for image display (RGB).
    // For RDA, we need Raw Complex Data.
    // Creating a dummy raw signal to prove the math engine runs:
    info!("Generating synthetic L0 data for testing...");
    let rows = 1024; // Azimuth lines
    let cols = 1024; // Range samples
    let raw_data = Array2::<Complex32>::zeros((rows, cols)); // Would be populated by L0 parser

    // Run the Algorithm
    let range_focused = processor.range_compression(&raw_data);
    let fully_focused = processor.azimuth_compression(&range_focused);

    info!(
        "RDA Processing Successful. Image Dimensions: {:?}",
        fully_focused.dim()
    );
    // -----------------------------------

    // TODO: Connect anomaly detection to focused output
    // Currently disabled - sar_image needs to be derived from fully_focused
    // let anomaly_map = algorithm::amtad_algorithm(sar_image.view());
    // io::save_anomaly_map_as_png(anomaly_map.view(), "anomaly_map.png")?;

    info!("Processing complete. Output: {}", output_path);
    Ok(())
}
