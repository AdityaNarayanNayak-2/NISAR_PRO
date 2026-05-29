use anyhow::Result;
use clap::Parser;
use log::info;
use ndarray::Array2;
use num_complex::Complex32;
use sar_processor::io::{save_sar_geotiff, save_sar_image, generate_xyz_tiles, save_geotiff_f32};
use sar_processor::nisar_parser;
use sar_processor::nisar_parser::NisarProductType;
use sar_processor::rcmc::RcmcParams;
use sar_processor::rda::SARProcessor;
use std::path::PathBuf;

/// NISAR SAR Processor — Range-Doppler Algorithm + InSAR pipeline
#[derive(Parser, Debug)]
#[command(
    name = "sar_processor",
    version = "0.3.0",
    about = "Process NISAR (or Sentinel-1) SAR data: RDA focusing, InSAR, displacement mapping"
)]
struct Cli {
    /// Input file: NISAR RSLC `.h5` or Sentinel-1 SAFE `.tiff`
    #[arg(short, long, value_name = "FILE")]
    input: Option<PathBuf>,

    /// Secondary input file for InSAR (Slave image)
    #[arg(long, value_name = "SLAVE_FILE")]
    insar_slave: Option<PathBuf>,

    /// Output GeoTIFF/PNG image path
    #[arg(short, long, default_value = "focused_sar.tif")]
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

    /// Maximum number of detections for CFAR
    #[arg(long, default_value = "50")]
    cfar_max_detections: usize,

    // ── InSAR pipeline flags ──────────────────────────────────────────────

    /// Coherence threshold for PS selection (default: 0.85)
    #[arg(long, default_value = "0.85")]
    insar_coherence_threshold: f32,

    /// Skip coregistration (assume images are already aligned)
    #[arg(long)]
    skip_coregistration: bool,

    /// Skip topographic phase removal
    #[arg(long)]
    skip_topo_removal: bool,

    /// Directory containing SRTM .hgt DEM tiles
    #[arg(long, default_value = "./dem")]
    dem_dir: String,

    /// Perpendicular baseline in meters (required for topo removal)
    #[arg(long)]
    baseline_perp: Option<f64>,

    // ── Geographic crop flags (infrastructure monitoring) ─────────────────

    /// Center latitude for geographic crop (infrastructure monitoring)
    #[arg(long)]
    crop_lat: Option<f64>,

    /// Center longitude for geographic crop
    #[arg(long)]
    crop_lon: Option<f64>,

    /// Crop radius in km (default: 10.0)
    #[arg(long, default_value = "10.0")]
    crop_radius_km: f64,
}

#[tokio::main]
async fn main() -> Result<()> {
    env_logger::init();

    let cli = Cli::parse();

    info!("╔══════════════════════════════════════════════╗");
    info!("║       NISAR SAR Processor  v0.3.0            ║");
    info!("║   RDA + InSAR Displacement Pipeline          ║");
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
                let crop = if let (Some(lat), Some(lon)) = (cli.crop_lat, cli.crop_lon) {
                    Some(nisar_parser::CropRegion {
                        center_lat: lat,
                        center_lon: lon,
                        radius_km: cli.crop_radius_km,
                    })
                } else {
                    None
                };
                let product = if let Some(ref crop_region) = crop {
                    info!("Geographic crop enabled: ({:.4}°, {:.4}°) r={:.1}km",
                        crop_region.center_lat, crop_region.center_lon, crop_region.radius_km);
                    nisar_parser::parse_nisar_cropped(input, &cli.polarization, crop_region)?
                } else {
                    nisar_parser::parse_nisar_auto(input, &cli.polarization)?
                };

                info!("Product type: {:?}", product.product_type);

                // All NISAR Level-1+ products are already focused — skip RDA
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
                        7_500.0, // NISAR LEO orbital velocity
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
    let output_path = if let Some(tile_dir) = cli.tiles_dir {
        info!("Generating deep-zoom XYZ tiles → {}", tile_dir);
        generate_xyz_tiles(focused.view(), &tile_dir, 0)?;
        info!("✓ Done. Web tiles written to: {}", tile_dir);

        // Write georeference sidecar alongside tiles
        if let Some(ref bb) = bbox {
            let geo_path = format!("{}/geo.json", tile_dir);
            let geo_json = serde_json::to_string_pretty(bb)?;
            std::fs::write(&geo_path, &geo_json)?;
            info!("✓ Georeference written: {}", geo_path);
            println!("{{\"event\":\"georef\",\"bbox\":{{\"south\":{},\"north\":{},\"west\":{},\"east\":{}}}}}", 
                bb.south, bb.north, bb.west, bb.east);
        }
        format!("{}/0/0/0.png", tile_dir) // mock
    } else {
        let output_tif = cli.output.replace(".png", ".tif");
        info!("Saving SAR GeoTIFF → {}", output_tif);
        
        let bbox_arr = if let Some(ref bb) = bbox {
            [bb.west, bb.south, bb.east, bb.north]
        } else {
            [0.0, 0.0, 0.0, 0.0]
        };
        
        info!("Computing intensity for GeoTIFF...");
        let mut intensity = ndarray::Array2::<f32>::zeros((focused.nrows(), focused.ncols()));
        use rayon::prelude::*;
        intensity.axis_iter_mut(ndarray::Axis(0))
            .into_par_iter()
            .enumerate()
            .for_each(|(r, mut row_view)| {
                for c in 0..focused.ncols() {
                    let p = focused[[r, c]];
                    if p.re.is_finite() && p.im.is_finite() {
                        row_view[c] = p.re.powi(2) + p.im.powi(2);
                    }
                }
            });

        save_sar_geotiff(intensity.view(), &output_tif, bbox_arr)?;
        drop(intensity); // ← free ~1 GB immediately
        info!("✓ Done. GeoTIFF written to: {}", output_tif);

        // Keep generating the PNG to ensure the legacy Dashboard is not broken
        if cli.output.ends_with(".png") && cli.process {
            info!("Saving SAR PNG (Dashboard fallback) → {}", cli.output);
            save_sar_image(focused.view(), &cli.output)?;
        }

        // Write georeference sidecar alongside TIF
        if let Some(ref bb) = bbox {
            let geo_path = output_tif.replace(".tif", ".geo.json");
            let geo_json = serde_json::to_string_pretty(bb)?;
            std::fs::write(&geo_path, &geo_json)?;
            info!("✓ Georeference written: {}", geo_path);
            println!("{{\"event\":\"georef\",\"bbox\":{{\"south\":{},\"north\":{},\"west\":{},\"east\":{}}}}}", 
                bb.south, bb.north, bb.west, bb.east);
        }
        output_tif
    };

    // ══════════════════════════════════════════════════════════════════════
    //  Full InSAR Pipeline (12 steps)
    // ══════════════════════════════════════════════════════════════════════
    if let Some(slave_path) = cli.insar_slave {
        info!("╔══════════════════════════════════════════════╗");
        info!("║          InSAR Pipeline — 12 Steps           ║");
        info!("╚══════════════════════════════════════════════╝");

        // ── Step 1: Load slave SLC ────────────────────────────────────────
        info!("[1/12] Loading slave SLC: {:?}", slave_path);

        let slave_data = if cli.synthetic || slave_path.to_str() == Some("synthetic") {
            // Synthetic mode: inject a Gaussian subsidence bowl into slave
            info!("[1/12] Synthetic mode: creating slave with Gaussian subsidence bowl");
            let (rows, cols) = focused.dim();
            let center_r = rows / 2;
            let center_c = cols / 2;
            // 10mm subsidence ≈ phase shift of 10e-3 * 4π / λ
            let wavelength = 0.2384_f32;
            let max_disp_m = 0.010; // 10mm
            let max_phase = max_disp_m * 4.0 * std::f32::consts::PI / wavelength;

            Array2::from_shape_fn((rows, cols), |(r, c)| {
                let dr = (r as f32 - center_r as f32) / (rows as f32 * 0.2);
                let dc = (c as f32 - center_c as f32) / (cols as f32 * 0.2);
                let gauss = (-0.5 * (dr * dr + dc * dc)).exp();
                let defo_phase = max_phase * gauss;
                focused[[r, c]] * Complex32::from_polar(1.0, defo_phase)
            })
        } else {
            let ext = slave_path.extension().and_then(|e| e.to_str()).unwrap_or("").to_lowercase();
            match ext.as_str() {
                "h5" | "hdf5" | "he5" => {
                    let product = if let (Some(lat), Some(lon)) = (cli.crop_lat, cli.crop_lon) {
                        let crop_region = nisar_parser::CropRegion {
                            center_lat: lat,
                            center_lon: lon,
                            radius_km: cli.crop_radius_km,
                        };
                        info!("[1/12] Cropping slave to ({:.4}°, {:.4}°) r={:.1}km",
                            lat, lon, cli.crop_radius_km);
                        nisar_parser::parse_nisar_cropped(&slave_path, &cli.polarization, &crop_region)?
                    } else {
                        nisar_parser::parse_nisar_auto(&slave_path, &cli.polarization)?
                    };
                    if cli.limit_lines > 0 {
                        let limit = cli.limit_lines.min(product.slc.nrows());
                        product.slc.slice(ndarray::s![..limit, ..]).to_owned()
                    } else {
                        product.slc
                    }
                }
                _ => anyhow::bail!("Unsupported slave format. Use .h5 for NISAR."),
            }
        };
        info!("[1/12] Slave loaded: {}×{}", slave_data.nrows(), slave_data.ncols());

        // ── Step 2: Coregistration ────────────────────────────────────────
        let aligned_slave = {
            let result = if cli.skip_coregistration {
                info!("[2/12] Coregistration SKIPPED (--skip-coregistration)");
                slave_data
            } else {
                info!("[2/12] Coregistering slave to master (FFT cross-correlation)...");
                let aligned = sar_processor::coregister::coregister(
                    &focused,
                    &slave_data,
                    64,   // patch_size (reserved)
                    32,   // overlap (reserved)
                    2,    // oversample_factor (reserved)
                )?;
                drop(slave_data); // ← free ~2 GB (raw slave no longer needed)
                aligned
            };
            result
        };

        // ── Step 3: Multilook ─────────────────────────────────────────────
        info!("[3/12] Computing multilook factors...");
        let (rg_looks, az_looks) = sar_processor::multilook::suggest_multilook_factors(
            focused.nrows(),
            focused.ncols(),
            2048,
            2048,
        );
        let rg_looks = rg_looks.max(1);
        let az_looks = az_looks.max(1);

        let ml_master = sar_processor::multilook::multilook(&focused, rg_looks, az_looks);
        let ml_slave = sar_processor::multilook::multilook(&aligned_slave, rg_looks, az_looks);
        info!("[3/12] Multilooked: {}×{} → {}×{} ({}rg × {}az)",
            focused.nrows(), focused.ncols(), ml_master.nrows(), ml_master.ncols(),
            rg_looks, az_looks);

        // Free full-resolution arrays — only multilooked versions needed from here
        drop(aligned_slave); // ← free ~2 GB
        info!("[MEM] Released full-resolution arrays to reclaim memory");

        // ── Step 4: Interferogram ─────────────────────────────────────────
        info!("[4/12] Computing interferogram...");
        let ifgram = sar_processor::insar::compute_interferogram(&ml_master, &ml_slave);

        // ── Step 5: Coherence estimation ──────────────────────────────────
        info!("[5/12] Estimating coherence (SAT-based)...");
        let coherence = sar_processor::insar::estimate_coherence(&ml_master, &ml_slave, 5);

        // ── Step 6: Goldstein phase filter ────────────────────────────────
        info!("[6/12] Applying Goldstein adaptive phase filter...");
        let filtered_ifgram = sar_processor::phase_filter::goldstein_filter(
            &ifgram,
            &coherence,
            32,  // block_size
            16,  // overlap
        );

        // ── Step 7: Extract wrapped phase ─────────────────────────────────
        info!("[7/12] Extracting wrapped phase...");
        let wrapped_phase = sar_processor::insar::extract_phase(&filtered_ifgram);

        // ── Step 8: Phase unwrapping ──────────────────────────────────────
        info!("[8/12] Unwrapping phase (quality-guided flood fill)...");
        let unwrapped_phase = sar_processor::unwrap::unwrap_phase(&wrapped_phase, &coherence);

        // ── Step 9: Topographic phase removal ─────────────────────────────
        let defo_phase = if cli.skip_topo_removal {
            info!("[9/12] Topographic phase removal SKIPPED (--skip-topo-removal)");
            unwrapped_phase
        } else if let Some(baseline_perp) = cli.baseline_perp {
            info!("[9/12] Simulating and removing topographic phase (B_perp={:.1}m)...", baseline_perp);

            // Create a flat DEM if no real DEM is available
            let dem = Array2::from_elem(
                (unwrapped_phase.nrows(), unwrapped_phase.ncols()),
                0.0_f32,
            );

            // NISAR L-band defaults
            let wavelength = 0.2384;
            let slant_range = 900_000.0;
            let incidence_angle = 0.6109; // ~35 degrees

            let topo = sar_processor::topo_phase::simulate_topo_phase(
                &dem,
                baseline_perp,
                wavelength,
                slant_range,
                incidence_angle,
            );

            sar_processor::topo_phase::remove_topo_phase(&unwrapped_phase, &topo)
        } else {
            info!("[9/12] Topographic phase removal SKIPPED (no --baseline-perp provided)");
            unwrapped_phase
        };

        // ── Step 10: Infrastructure health / PS analysis ──────────────────
        info!("[10/12] Analyzing persistent scatterers (PS-InSAR)...");
        let bbox_arr = bbox.as_ref().map(|b| [b.south, b.west, b.north, b.east]);
        let options = sar_processor::infra_health::InfraHealthOptions {
            bbox: bbox_arr,
            wavelength_m: 0.2384,
            coherence_threshold: cli.insar_coherence_threshold,
            max_points: 2000,
        };
        let report = sar_processor::infra_health::analyze_infrastructure_unwrapped(
            &defo_phase,
            &coherence,
            &options,
        );

        info!(
            "[10/12] PS-InSAR summary: {} PS points, {}S/{}C/{}A/{}CR, max_disp={:.2}mm, median={:.2}mm",
            report.summary.total_ps_points,
            report.summary.stable_count,
            report.summary.caution_count,
            report.summary.alert_count,
            report.summary.critical_count,
            report.summary.max_displacement_mm,
            report.summary.median_displacement_mm,
        );

        // ── Step 11: Save InSAR outputs ───────────────────────────────────
        info!("[11/12] Saving InSAR output products...");

        let base = output_path.replace(".tif", "").replace(".png", "");
        let bbox_opt = bbox.as_ref().map(|b| [b.west, b.south, b.east, b.north]);

        // Deformation phase GeoTIFF
        let defo_path = format!("{}_defo_phase.tif", base);
        save_geotiff_f32(defo_phase.view(), &defo_path, bbox_opt)?;
        info!("  ✓ Deformation phase: {}", defo_path);

        // Coherence GeoTIFF
        let coh_path = format!("{}_coherence.tif", base);
        save_geotiff_f32(coherence.view(), &coh_path, bbox_opt)?;
        info!("  ✓ Coherence map: {}", coh_path);

        // InSAR report JSON
        let report_path = format!("{}_insar.json", base);
        std::fs::write(&report_path, serde_json::to_string_pretty(&report)?)?;
        info!("  ✓ InSAR report: {}", report_path);

        // ── Step 12: Emit JSON events for gateway ─────────────────────────
        info!("[12/12] Emitting structured events for gateway...");

        println!("{{\"event\":\"insar_report\",\"path\":\"{}\",\"summary\":{}}}", 
            report_path, serde_json::to_string(&report.summary)?);
        println!("{{\"event\":\"insar_outputs\",\"defo_phase\":\"{}\",\"coherence\":\"{}\",\"report\":\"{}\"}}",
            defo_path, coh_path, report_path);

        info!("╔══════════════════════════════════════════════╗");
        info!("║          InSAR Pipeline Complete ✓           ║");
        info!("╚══════════════════════════════════════════════╝");
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
        let ds_factor = 8;
        let ds_image = sar_processor::ship_detection::downsample_intensity(
            native_intensity.view(),
            ds_factor,
        );
        let ds_rows = ds_image.nrows();
        let ds_cols = ds_image.ncols();

        // Step 3: Run integral-image accelerated CA-CFAR
        let targets = sar_processor::ship_detection::detect_ships_cfar(
            ds_image.view(),
            4,      // guard radius
            10,     // background radius
            1e-6,   // probability of false alarm
            cli.cfar_max_detections, // max detections (hard cap)
        );

        // Step 4: Convert downsampled pixel coords → geographic lat/lon
        #[derive(serde::Serialize)]
        struct OutputShip { lat: f64, lon: f64, intensity: f32 }

        let mut final_ships = Vec::new();
        for t in targets {
            if let Some(ref bb) = bbox {
                let lat = bb.north - ((t.y as f64 / ds_rows as f64) * (bb.north - bb.south));
                let lon = bb.west + ((t.x as f64 / ds_cols as f64) * (bb.east - bb.west));
                final_ships.push(OutputShip { lat, lon, intensity: t.intensity });
            }
        }

        let ships_path = output_path.replace(".tif", "_ships.json").replace(".png", "_ships.json");
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
