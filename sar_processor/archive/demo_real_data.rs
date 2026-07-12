//! Real Sentinel-1 Data Demo
//!
//! This binary demonstrates processing real Sentinel-1 SLC data
//! through our Rust SAR processor pipeline.
//!
//! Usage:
//!   cargo run --bin demo_real_data -- /path/to/S1A_*.SAFE

use log::{info, warn};
use sar_processor::rda::SARProcessor;
use sar_processor::safe_parser::{parse_safe_directory, read_slc_tiff};
use std::path::PathBuf;

fn main() -> anyhow::Result<()> {
    env_logger::init();

    let args: Vec<String> = std::env::args().collect();

    if args.len() < 2 {
        println!("SAR Processor - Real Data Demo");
        println!("===============================");
        println!();
        println!("Usage: {} <path_to_SAFE_directory>", args[0]);
        println!();
        println!("Example:");
        println!("  {} ./S1A_IW_SLC__1SDV_20240115T*.SAFE", args[0]);
        println!();
        println!("To download Sentinel-1 data:");
        println!("  1. Go to https://browser.dataspace.copernicus.eu/");
        println!("  2. Search for Sentinel-1 SLC products");
        println!("  3. Download a .SAFE.zip and extract it");
        return Ok(());
    }

    let safe_path = PathBuf::from(&args[1]);

    // Step 1: Parse SAFE directory
    info!("=== Step 1: Parsing SAFE Product ===");
    let product = parse_safe_directory(&safe_path)?;

    println!("\n📡 Sentinel-1 Product Loaded:");
    println!("   Mission:     {}", product.mission);
    println!("   Mode:        {}", product.mode);
    println!("   Type:        {}", product.product_type);
    println!("   Polarisation: {:?}", product.polarisation);
    println!("   Swaths:      {}", product.swaths.len());

    for swath in &product.swaths {
        println!(
            "     - {} ({}): {:?}",
            swath.swath_id,
            swath.polarisation,
            swath.measurement_path.file_name().unwrap_or_default()
        );
    }

    // Step 2: Select first VV swath
    info!("\n=== Step 2: Loading SLC Data ===");
    let vv_swath = product
        .swaths
        .iter()
        .find(|s| s.polarisation == "VV")
        .or_else(|| product.swaths.first());

    let Some(swath) = vv_swath else {
        warn!("No swaths found in product!");
        return Ok(());
    };

    println!("   Selected: {} {}", swath.swath_id, swath.polarisation);
    println!("   TIFF: {:?}", swath.measurement_path);

    // Step 3: Read TIFF and process with RDA
    info!("\n=== Step 3: Running RDA ===");

    // Try to read the actual TIFF data
    let raw_data = match read_slc_tiff(&swath.measurement_path) {
        Ok(slc_data) => {
            println!(
                "   ✅ Loaded real SLC data: {}x{}",
                slc_data.width, slc_data.height
            );
            slc_data.to_complex_array()
        }
        Err(e) => {
            warn!("Could not read TIFF ({}), using synthetic data", e);
            println!("   ⚠️  Using synthetic test data (TIFF read failed)");

            // Fallback to synthetic data
            use ndarray::Array2;
            use num_complex::Complex32;

            let rows = 256;
            let cols = 512;
            let mut data = Array2::<Complex32>::zeros((rows, cols));
            for i in 0..rows {
                for j in 0..cols {
                    let phase = (i as f32 * 0.1 + j as f32 * 0.05).sin();
                    data[[i, j]] = Complex32::from_polar(1.0, phase);
                }
            }
            data
        }
    };

    println!("   Input dimensions: {:?}", raw_data.dim());

    // Sentinel-1 typical parameters
    let processor = SARProcessor::new(
        5.405e9, // C-band center frequency
        64.35e6, // 64.35 MHz sample rate (Sentinel-1 IW)
        40.0e-6, // 40 µs pulse duration
        56.5e6,  // 56.5 MHz bandwidth
        1679.9,  // PRF ~1680 Hz
    );

    let range_focused = processor.range_compression(&raw_data);
    let fully_focused = processor.azimuth_compression(&range_focused);

    println!("   ✅ RDA Complete: {:?}", fully_focused.dim());

    // Step 4: Generate output
    info!("\n=== Step 4: Generating Output ===");

    // Calculate magnitude for visualization
    let magnitude: Vec<f32> = fully_focused.iter().map(|c| c.norm()).collect();

    let max_val = magnitude.iter().cloned().fold(0.0f32, f32::max);
    let min_val = magnitude.iter().cloned().fold(f32::MAX, f32::min);

    println!("   Magnitude range: {:.2} - {:.2}", min_val, max_val);

    // Save as grayscale PNG with dB scaling
    let output_path = "output_sar.png";
    let (out_rows, out_cols) = fully_focused.dim();

    let mut img = image::GrayImage::new(out_cols as u32, out_rows as u32);

    // Convert to dB scale for better visualization
    let db_values: Vec<f32> = magnitude
        .iter()
        .map(|m| if *m > 0.0 { 20.0 * m.log10() } else { -100.0 })
        .collect();

    let db_max = db_values.iter().cloned().fold(f32::NEG_INFINITY, f32::max);
    let db_min = db_values
        .iter()
        .cloned()
        .filter(|v| *v > -100.0)
        .fold(f32::INFINITY, f32::min);
    let db_range = db_max - db_min;

    println!("   dB range: {:.2} to {:.2} dB", db_min, db_max);

    for (i, db_val) in db_values.iter().enumerate() {
        let row = i / out_cols;
        let col = i % out_cols;
        let normalized = if db_range > 0.0 {
            ((*db_val - db_min) / db_range * 255.0).clamp(0.0, 255.0)
        } else {
            128.0
        };
        img.put_pixel(col as u32, row as u32, image::Luma([normalized as u8]));
    }

    img.save(output_path)?;
    println!("   ✅ Saved to: {}", output_path);

    println!("\n🎉 Processing Complete!");

    Ok(())
}
