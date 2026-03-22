use anyhow::Result;
use clap::Parser;
use log::info;
use ndarray::Array2;
use num_complex::Complex32;
use sar_processor::io::save_sar_image;
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
    let (processor, raw_data, skip_rda) = if cli.synthetic {
        info!("Mode: Synthetic test data (1024 × 1024 zeros + point target)");
        let proc = build_synthetic_processor(cli.no_rcmc);
        let data = generate_synthetic_point_target(1024, 1024, 512, 512);
        (proc, data, false)
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
                            _ => "Unknown",
                        });
                }

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

                let data = if cli.limit_lines > 0 && cli.limit_lines < product.slc.nrows() {
                    info!("Limiting to {} azimuth lines", cli.limit_lines);
                    product
                        .slc
                        .slice(ndarray::s![..cli.limit_lines, ..])
                        .to_owned()
                } else {
                    product.slc
                };

                (proc, data, should_skip_rda)
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
        raw_data
    } else {
        info!("Starting RDA pipeline on {}×{} image...", raw_data.nrows(), raw_data.ncols());
        processor.process_rda(&raw_data)
    };

    // ── Save Output ────────────────────────────────────────────────────────
    info!("Saving SAR image → {}", cli.output);
    save_sar_image(focused.view(), &cli.output)?;
    info!("✓ Done. Output written to: {}", cli.output);

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

            let envelope_r = (-((t * sample_rate).powi(2)) / (2.0 * 20.0_f32.powi(2))).exp();
            let envelope_az = (-((eta * prf).powi(2)) / (2.0 * 50.0_f32.powi(2))).exp();

            data[[az, rg]] = range_chirp * az_phase * envelope_r * envelope_az;
        }
    }

    info!(
        "Synthetic point target at [{}, {}] in {} × {} scene",
        target_az, target_rg, n_az, n_rg
    );
    data
}
