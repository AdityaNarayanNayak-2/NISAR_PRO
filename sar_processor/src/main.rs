use anyhow::Result;
use clap::Parser;
use log::info;
use ndarray::Array2;
use num_complex::Complex32;
use sar_processor::io::{save_sar_image, generate_xyz_tiles};
use sar_processor::nisar_parser;
use sar_processor::nisar_parser::NisarProductType;
use sar_processor::rcmc::RcmcParams;
use sar_processor::rda::SARProcessor;
use std::path::PathBuf;

/// NISAR SAR Processor — Range-Doppler Algorithm pipeline
#[derive(Parser, Debug)]
#[command(
    name = "sar_processor",
    version = "0.2.0",
    about = "Process NISAR (or Sentinel-1) SAR data using the Range-Doppler Algorithm"
)]
struct Cli {
    /// Input file: NISAR RSLC `.h5` or Sentinel-1 SAFE `.tiff`
    #[arg(short, long, value_name = "FILE")]
    input: Option<PathBuf>,

    /// Secondary input file for InSAR (Slave image)
    #[arg(long, value_name = "SLAVE_FILE")]
    insar_slave: Option<PathBuf>,

    /// Output PNG image path
    #[arg(short, long, default_value = "focused_sar.png")]
    output: String,

    /// Polarisation channel to process (HH, VV, HV, VH)
    #[arg(short, long, default_value = "HH")]
    polarization: String,

    /// Run with synthetic test data (no input file needed)
    #[arg(long)]
    synthetic: bool,

    /// Disable Range Cell Migration Correction
    #[arg(long)]
    no_rcmc: bool,

    /// Number of azimuth lines to process (0 = all)
    #[arg(long, default_value = "0")]
    limit_lines: usize,

    /// Force full RDA processing even on already-focused products (RSLC/GSLC/GCOV/GUNW)
    #[arg(long)]
    process: bool,
    
    /// Target directory to output Deep Zoom XYZ Web Tiles
    #[arg(long)]
    tiles_dir: Option<String>,

    /// Run the CA-CFAR Ship Detection module and emit GeoJSON outputs
    #[arg(long)]
    ship_detect: bool,
}

#[tokio::main]
async fn main() -> Result<()> {
    env_logger::init();

    let cli = Cli::parse();

    info!("╔══════════════════════════════════════════════╗");
    info!("║       NISAR SAR Processor  v0.2.0            ║");
    info!("║   Range-Doppler Algorithm (RDA) Pipeline     ║");
    info!("╚══════════════════════════════════════════════╝");

    // ── Build processor + raw data ─────────────────────────────────────────
    let (processor, raw_data, skip_rda, bbox) = if cli.synthetic {
        info!("Mode: Synthetic test data (1024 × 1024 zeros + point target)");
        let proc = build_synthetic_processor(cli.no_rcmc);
        let data = generate_synthetic_point_target(1024, 1024, 512, 512);
        let fake_bbox = sar_processor::nisar_parser::GeoBoundingBox {
            south: 35.6895, north: 35.7000, west: 139.6917, east: 139.7000, // Tokyo
        };
        (proc, data, false, Some(fake_bbox))
    } else {
        let input = cli
            .input
            .as_ref()
            .expect("--input <FILE> is required unless --synthetic is set");

        let ext = input
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("")
            .to_lowercase();

        match ext.as_str() {
            "h5" | "hdf5" | "he5" => {
                info!("Mode: NISAR HDF5  →  {:?}", input);
                let product = nisar_parser::parse_nisar_auto(input, &cli.polarization)?;

                info!("Product type: {:?}", product.product_type);

                // All NISAR Level-1+ products are already focused — skip RDA
                // RSLC = focused SLC, GSLC = geocoded SLC, GCOV = covariance, GUNW = interferogram
                let should_skip_rda = !cli.process && matches!(
                    product.product_type,
                    NisarProductType::RSLC | NisarProductType::GSLC
                    | NisarProductType::GCOV | NisarProductType::GUNW
                );

                if should_skip_rda {
                    info!("Product is already focused ({}), skipping RDA pipeline (use --process to override)",
                        match product.product_type {
                            NisarProductType::RSLC => "Range-compressed SLC",
                            NisarProductType::GSLC => "Geocoded SLC",
                            NisarProductType::GCOV => "Geocoded Covariance",
                            NisarProductType::GUNW => "Unwrapped Interferogram",
                        });
                }

                // Extract bbox for georeferencing (will be written as sidecar)
                let bbox = product.bbox.clone();

                let p = &product.params;
                let mut proc = SARProcessor::new(
                    p.center_frequency as f32,
                    p.sample_rate as f32,
                    p.pulse_duration as f32,
                    p.range_bandwidth as f32,
                    p.prf as f32,
                );

                if cli.no_rcmc {
                    proc = proc.without_rcmc();
                } else {
                    let rcmc = RcmcParams::from_frequency(
                        p.center_frequency as f32,
                        7_200.0,
                        800_000.0,
                    );
                    proc = proc.with_rcmc_params(rcmc);
                }

                let data = if cli.limit_lines > 0 {
                    let limit = cli.limit_lines.min(product.slc.nrows());
                    info!("Limiting to {} azimuth lines", limit);
                    product
                        .slc
                        .slice(ndarray::s![..limit, ..])
                        .to_owned()
                } else {
                    product.slc
                };

                (proc, data, should_skip_rda, bbox)
            }
            _ => {
                anyhow::bail!(
                    "Unsupported file format '{}'. Use .h5 for NISAR or --synthetic for test data.",
                    ext
                );
            }
        }
    };

    // ── Run RDA Pipeline (or skip for pre-processed products) ──────────────
    let focused = if skip_rda {
        info!("Rendering pre-processed data directly ({}×{})", raw_data.nrows(), raw_data.ncols());
        raw_data.clone()
    } else {
        info!("Starting RDA pipeline on {}×{} image...", raw_data.nrows(), raw_data.ncols());
        processor.process_rda(&raw_data)
    };

    // ── Save Output ────────────────────────────────────────────────────────
    let output_png = if let Some(tile_dir) = cli.tiles_dir {
        info!("Generating deep-zoom XYZ tiles → {}", tile_dir);
        generate_xyz_tiles(focused.view(), &tile_dir, 0)?;
        info!("✓ Done. Web tiles written to: {}", tile_dir);

        // Write georeference sidecar alongside tiles
        if let Some(ref bb) = bbox {
            let geo_path = format!("{}/geo.json", tile_dir);
            let geo_json = serde_json::to_string_pretty(bb)?;
            std::fs::write(&geo_path, &geo_json)?;
            info!("✓ Georeference written: {}", geo_path);
            // Emit structured bbox to stdout for Gateway SSE capture
            println!("{{\"event\":\"georef\",\"bbox\":{{\"south\":{},\"north\":{},\"west\":{},\"east\":{}}}}}", 
                bb.south, bb.north, bb.west, bb.east);
        }
        format!("{}/0/0/0.png", tile_dir) // mock
    } else {
        info!("Saving SAR image → {}", cli.output);
        save_sar_image(focused.view(), &cli.output)?;
        info!("✓ Done. Output written to: {}", cli.output);

        // Write georeference sidecar alongside PNG
        if let Some(ref bb) = bbox {
            let geo_path = cli.output.replace(".png", ".geo.json");
            let geo_json = serde_json::to_string_pretty(bb)?;
            std::fs::write(&geo_path, &geo_json)?;
            info!("✓ Georeference written: {}", geo_path);
            // Emit structured bbox to stdout for Gateway SSE capture
            println!("{{\"event\":\"georef\",\"bbox\":{{\"south\":{},\"north\":{},\"west\":{},\"east\":{}}}}}", 
                bb.south, bb.north, bb.west, bb.east);
        }
        cli.output.clone()
    };

    // ── Run InSAR & Infrastructure Health Pipeline ──────────────────────────
    if let Some(slave_path) = cli.insar_slave {
        info!("Starting InSAR pipeline with slave image: {:?}", slave_path);
        let ext = slave_path.extension().and_then(|e| e.to_str()).unwrap_or("").to_lowercase();
        
        let slave_data = match ext.as_str() {
            "h5" | "hdf5" | "he5" => {
                let product = nisar_parser::parse_nisar_auto(&slave_path, &cli.polarization)?;
                
                if cli.limit_lines > 0 {
                    let limit = cli.limit_lines.min(product.slc.nrows());
                    product.slc.slice(ndarray::s![..limit, ..]).to_owned()
                } else {
                    product.slc
                }
            }
            _ => anyhow::bail!("Unsupported slave format. Use .h5 for NISAR."),
        };
        
        info!("Computing interferogram and coherence matrix...");
        let ifgram = sar_processor::insar::compute_interferogram(&raw_data, &slave_data);
        let coherence = sar_processor::insar::estimate_coherence(&raw_data, &slave_data, 5);
        
        info!("Analyzing persistent scatterers (PS) for infrastructure health...");
        // Assuming L-band NISAR (0.24m wavelength)
        let report = sar_processor::infra_health::analyze_infrastructure_health(
            &raw_data,
            &ifgram, 
            &coherence, 
            bbox.clone().map(|b| [b.south, b.west, b.north, b.east]),
            0.24
        );
        
        let report_path = output_png.clone().replace(".png", "_insar.json");
        std::fs::write(&report_path, serde_json::to_string_pretty(&report)?)?;
        info!("✓ Infrastructure health report written: {}", report_path);
        
        println!("{{\"event\":\"insar_report\",\"path\":\"{}\"}}", report_path);
    }

    // ── Run Ship Detection (CFAR) ──────────────────────────────────────────
    if cli.ship_detect {
        info!("Running CA-CFAR Ship Detection module...");
        let native_rows = focused.nrows();
        let native_cols = focused.ncols();

        // Step 1: Compute native intensity (|z|² = re² + im²)
        info!("Computing native intensity array ({}×{})...", native_rows, native_cols);
        let mut native_intensity = ndarray::Array2::<f32>::zeros((native_rows, native_cols));

        use rayon::prelude::*;
        native_intensity.axis_iter_mut(ndarray::Axis(0))
            .into_par_iter()
            .enumerate()
            .for_each(|(r, mut row_view)| {
                for c in 0..native_cols {
                    let p = focused[[r, c]];
                    if p.re.is_finite() && p.im.is_finite() {
                        row_view[c] = p.re.powi(2) + p.im.powi(2);
                    }
                }
            });

        // Step 2: Downsample 8x to prevent CPU/RAM blowup
        //   16020×16560 → ~2002×2070  (manageable for CFAR)
        let ds_factor = 8;
        let ds_image = sar_processor::ship_detection::downsample_intensity(
            native_intensity.view(),
            ds_factor,
        );
        let ds_rows = ds_image.nrows();
        let ds_cols = ds_image.ncols();

        // Step 3: Run integral-image accelerated CA-CFAR
        //   guard=4, bg=10 (per cfar.txt research: small windows for GCOV)
        //   pfa=1e-6, max 50 detections to prevent browser crash
        let targets = sar_processor::ship_detection::detect_ships_cfar(
            ds_image.view(),
            4,      // guard radius
            10,     // background radius
            1e-6,   // probability of false alarm
            50,     // max detections (hard cap)
        );

        // Step 4: Convert downsampled pixel coords → geographic lat/lon
        #[derive(serde::Serialize)]
        struct OutputShip { lat: f64, lon: f64, intensity: f32 }

        let mut final_ships = Vec::new();
        for t in targets {
            if let Some(ref bb) = bbox {
                // Map pixel position in the downsampled grid to [0, 1] then to geo
                let lat = bb.north - ((t.y as f64 / ds_rows as f64) * (bb.north - bb.south));
                let lon = bb.west + ((t.x as f64 / ds_cols as f64) * (bb.east - bb.west));
                final_ships.push(OutputShip { lat, lon, intensity: t.intensity });
            }
        }

        let ships_path = output_png.replace(".png", "_ships.json");
        std::fs::write(&ships_path, serde_json::to_string_pretty(&final_ships)?)?;
        info!("✓ CFAR: {} ship targets written to {}", final_ships.len(), ships_path);
        println!("{{\"event\":\"ships_detected\",\"path\":\"{}\"}}", ships_path);
    }

    Ok(())
}

// ─── Helpers ───────────────────────────────────────────────────────────────

fn build_synthetic_processor(no_rcmc: bool) -> SARProcessor {
    // Sentinel-1 C-band parameters as default test case
    let mut proc = SARProcessor::new(
        5.405e9, // 5.405 GHz C-band carrier
        25.0e6,  // 25 MHz sample rate
        50.0e-6, // 50 µs pulse duration
        20.0e6,  // 20 MHz bandwidth
        1600.0,  // 1600 Hz PRF
    );

    if no_rcmc {
        proc = proc.without_rcmc();
    }

    proc
}

/// Generate a synthetic raw SAR signal with a bright point target
/// at (target_az, target_rg) to validate the focusing algorithm.
fn generate_synthetic_point_target(
    n_az: usize,
    n_rg: usize,
    target_az: usize,
    target_rg: usize,
) -> Array2<Complex32> {
    use num_complex::Complex32;
    use std::f32::consts::PI;

    let mut data = Array2::<Complex32>::zeros((n_az, n_rg));

    // A simple point target: a chirp in range × a slow-time modulation in azimuth
    let bandwidth = 20.0e6_f32;
    let sample_rate = 25.0e6_f32;
    let prf = 1600.0_f32;
    let chirp_rate = bandwidth / 50.0e-6_f32;

    for az in 0..n_az {
        for rg in 0..n_rg {
            // Range offset from target
            let t = (rg as f32 - target_rg as f32) / sample_rate;
            // Azimuth offset from target
            let eta = (az as f32 - target_az as f32) / prf;

            // Point scatterer signal: chirp in range × Doppler in azimuth
            let range_chirp = Complex32::from_polar(1.0, PI * chirp_rate * t * t);
            let az_phase = Complex32::from_polar(1.0, -PI * 1000.0 * eta * eta);

            let envelope_r  = (-(t.powi(2)) / (2.0 * (10.0 / sample_rate).powi(2))).exp();
            let envelope_az = (-(eta.powi(2)) / (2.0 * (30.0 / prf).powi(2))).exp();

            data[[az, rg]] = range_chirp * az_phase * envelope_r * envelope_az;
        }
    }

    info!(
        "Synthetic point target at [{}, {}] in {} × {} scene",
        target_az, target_rg, n_az, n_rg
    );
    data
}
