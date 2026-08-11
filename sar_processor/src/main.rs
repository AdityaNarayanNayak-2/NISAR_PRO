use anyhow::Result;
use clap::Parser;
use log::{info, warn};
use ndarray::Array2;
use sar_processor::gunw_parser;
use sar_processor::io::{generate_xyz_tiles, save_geotiff_f32, save_sar_geotiff, save_sar_image};
use sar_processor::nisar_parser;
use std::path::PathBuf;

/// NISAR SAR Processor — InSAR displacement pipeline
#[derive(Parser, Debug)]
#[command(
    name = "sar_processor",
    version = "0.4.0",
    about = "Process NISAR Level-1+ products (RSLC/GSLC/GCOV/GUNW): InSAR, displacement mapping, ship detection"
)]
struct Cli {
    /// Input file: NISAR HDF5 (.h5) — RSLC, GSLC, GCOV, or GUNW
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

    /// Path to an external .wbd SWBD water mask file
    #[arg(long, value_name = "WATER_MASK_FILE")]
    water_mask: Option<PathBuf>,

    /// Adaptive intensity threshold factor for water masking (default: 0.15)
    #[arg(long, default_value = "0.15")]
    water_mask_threshold: f32,

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
    info!("║       NISAR SAR Processor  v0.4.0            ║");
    info!("║   InSAR Displacement Pipeline                ║");
    info!("╚══════════════════════════════════════════════╝");

    // ── Parse input file ───────────────────────────────────────────────────
    let input = cli.input.as_ref().expect("--input <FILE> is required");

    let ext = input
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    let (slc_data, bbox) = match ext.as_str() {
        "h5" | "hdf5" | "he5" => {
            info!("Mode: NISAR HDF5  →  {:?}", input);

            // ══════════════════════════════════════════════════
            //  GUNW Fast-Path: Skip entire RDA + InSAR pipeline
            //  GUNW is a completed NASA product — just read and display
            // ══════════════════════════════════════════════════
            let filename = input.file_name().and_then(|n| n.to_str()).unwrap_or("");
            if filename.contains("_GUNW_") {
                info!("╔══════════════════════════════════════════════╗");
                info!("║     GUNW Direct Pipeline (NASA product)      ║");
                info!("╚══════════════════════════════════════════════╝");

                let crop = if let (Some(lat), Some(lon)) = (cli.crop_lat, cli.crop_lon) {
                    Some(nisar_parser::CropRegion {
                        center_lat: lat,
                        center_lon: lon,
                        radius_km: cli.crop_radius_km,
                    })
                } else {
                    None
                };

                info!("[1/5] Parsing GUNW product...");
                let mut gunw = gunw_parser::parse_gunw(input, &cli.polarization, crop.as_ref())?;

                let base = cli.output.replace(".tif", "").replace(".png", "");
                let bbox_opt = Some([
                    gunw.bbox.west,
                    gunw.bbox.south,
                    gunw.bbox.east,
                    gunw.bbox.north,
                ]);

                // Emit georef event for gateway
                println!("{{\"event\":\"georef\",\"bbox\":{{\"south\":{},\"north\":{},\"west\":{},\"east\":{}}}}}",
                        gunw.bbox.south, gunw.bbox.north, gunw.bbox.west, gunw.bbox.east);

                // ── Water body masking (GUNW path) ────────────────────────
                // GUNW products don't carry raw SLC amplitude, so intensity-
                // based masking is impossible.  Only the external SWBD mask
                // can be applied here (the low-coherence proxy is already
                // handled inside gunw_parser.rs at coh < 0.3).
                if let Some(ref wbd_path) = cli.water_mask {
                    info!(
                        "[GUNW] Applying external SWBD water body mask from {:?}",
                        wbd_path
                    );
                    match sar_processor::water_mask::read_swbd_wbd(wbd_path) {
                        Ok(mask) => {
                            sar_processor::water_mask::apply_external_water_mask(
                                &mut gunw.coherence,
                                &mask,
                            );
                        }
                        Err(e) => {
                            warn!(
                                "[GUNW] Failed to read external water mask: {:?}. Skipping.",
                                e
                            );
                        }
                    }
                }

                // Deramp the phase to remove orbital/atmospheric ramps and reference it
                info!("  Removing spatial orbital/atmospheric phase ramp via 2D linear deramp...");
                let defo_phase = sar_processor::deramp::deramp_phase(
                    &gunw.unwrapped_phase,
                    &gunw.coherence,
                    cli.insar_coherence_threshold,
                );

                let displacement_mm_array = defo_phase.mapv(|phi| {
                    if phi.is_finite() {
                        phi * gunw.wavelength_m * 1000.0 / (4.0 * std::f32::consts::PI)
                    } else {
                        f32::NAN
                    }
                });

                // [2/5] Save displacement GeoTIFF (same filename the dashboard expects)
                info!("[2/5] Saving displacement GeoTIFF...");
                let defo_path = format!("{}_defo_phase.tif", base);
                save_geotiff_f32(displacement_mm_array.view(), &defo_path, bbox_opt)?;
                info!("  ✓ Displacement: {}", defo_path);

                // [3/5] Save coherence GeoTIFF
                info!("[3/5] Saving coherence GeoTIFF...");
                let coh_path = format!("{}_coherence.tif", base);
                save_geotiff_f32(gunw.coherence.view(), &coh_path, bbox_opt)?;
                info!("  ✓ Coherence: {}", coh_path);

                // [4/5] Infrastructure health analysis (uses real displacement values)
                info!("[4/5] Analyzing infrastructure health (PS-InSAR on GUNW)...");
                let bbox_arr = [
                    gunw.bbox.south,
                    gunw.bbox.west,
                    gunw.bbox.north,
                    gunw.bbox.east,
                ];
                let options = sar_processor::infra_health::InfraHealthOptions {
                    bbox: Some(bbox_arr),
                    wavelength_m: gunw.wavelength_m,
                    coherence_threshold: cli.insar_coherence_threshold,
                    max_points: 2000,
                };
                let report = sar_processor::infra_health::analyze_infrastructure_unwrapped(
                    &defo_phase,
                    &gunw.coherence,
                    &options,
                );

                info!(
                    "  PS summary: {} points, {}S/{}C/{}A/{}CR, max_disp={:.2}mm",
                    report.summary.total_ps_points,
                    report.summary.stable_count,
                    report.summary.caution_count,
                    report.summary.alert_count,
                    report.summary.critical_count,
                    report.summary.max_displacement_mm,
                );

                let report_path = format!("{}_insar.json", base);
                std::fs::write(&report_path, serde_json::to_string_pretty(&report)?)?;
                info!("  ✓ InSAR report: {}", report_path);

                // [5/5] Emit gateway events
                info!("[5/5] Emitting structured events for gateway...");
                println!(
                    "{{\"event\":\"insar_report\",\"path\":\"{}\",\"summary\":{}}}",
                    report_path,
                    serde_json::to_string(&report.summary)?
                );
                println!("{{\"event\":\"insar_outputs\",\"defo_phase\":\"{}\",\"coherence\":\"{}\",\"report\":\"{}\"}}",
                        defo_path, coh_path, report_path);

                info!("╔══════════════════════════════════════════════╗");
                info!("║       GUNW Pipeline Complete ✓               ║");
                info!("╚══════════════════════════════════════════════╝");
                return Ok(());
            }

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
                info!(
                    "Geographic crop enabled: ({:.4}°, {:.4}°) r={:.1}km",
                    crop_region.center_lat, crop_region.center_lon, crop_region.radius_km
                );
                nisar_parser::validate_crop_intersection(input, crop_region)?;
                nisar_parser::parse_nisar_cropped(input, &cli.polarization, crop_region)?
            } else {
                nisar_parser::parse_nisar_auto(input, &cli.polarization)?
            };

            info!(
                "Product type: {:?} ({}×{})",
                product.product_type,
                product.slc.nrows(),
                product.slc.ncols()
            );
            info!("Product is pre-focused Level-1+ data — no RDA required.");

            (product.slc, product.bbox)
        }
        _ => {
            anyhow::bail!(
                "Unsupported file format '{}'. Use .h5 for NISAR products.",
                ext
            );
        }
    };

    let focused = slc_data;

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
        intensity
            .axis_iter_mut(ndarray::Axis(0))
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
        if cli.output.ends_with(".png") {
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

        let slave_data = {
            let ext = slave_path
                .extension()
                .and_then(|e| e.to_str())
                .unwrap_or("")
                .to_lowercase();
            match ext.as_str() {
                "h5" | "hdf5" | "he5" => {
                    let product = if let (Some(lat), Some(lon)) = (cli.crop_lat, cli.crop_lon) {
                        let crop_region = nisar_parser::CropRegion {
                            center_lat: lat,
                            center_lon: lon,
                            radius_km: cli.crop_radius_km,
                        };
                        info!(
                            "[1/12] Cropping slave to ({:.4}°, {:.4}°) r={:.1}km",
                            lat, lon, cli.crop_radius_km
                        );
                        // Pre-load validation: check bbox intersection WITHOUT loading the full dataset
                        nisar_parser::validate_crop_intersection(&slave_path, &crop_region)?;
                        nisar_parser::parse_nisar_cropped(
                            &slave_path,
                            &cli.polarization,
                            &crop_region,
                        )?
                    } else {
                        nisar_parser::parse_nisar_auto(&slave_path, &cli.polarization)?
                    };
                    product.slc
                }
                _ => anyhow::bail!("Unsupported slave format. Use .h5 for NISAR."),
            }
        };
        info!(
            "[1/12] Slave loaded: {}×{}",
            slave_data.nrows(),
            slave_data.ncols()
        );

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
                    64, // patch_size (reserved)
                    32, // overlap (reserved)
                    2,  // oversample_factor (reserved)
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
        info!(
            "[3/12] Multilooked: {}×{} → {}×{} ({}rg × {}az)",
            focused.nrows(),
            focused.ncols(),
            ml_master.nrows(),
            ml_master.ncols(),
            rg_looks,
            az_looks
        );

        // Free full-resolution arrays — only multilooked versions needed from here
        drop(aligned_slave); // ← free ~2 GB
        info!("[MEM] Released full-resolution arrays to reclaim memory");

        // ── Step 4: Interferogram ─────────────────────────────────────────
        info!("[4/12] Computing interferogram...");
        let ifgram = sar_processor::insar::compute_interferogram(&ml_master, &ml_slave);

        // ── Step 5: Coherence estimation ──────────────────────────────────
        info!("[5/12] Estimating coherence (SAT-based)...");
        let mut coherence = sar_processor::insar::estimate_coherence(&ml_master, &ml_slave, 5);

        // ── Step 5b: Water Body Masking (ISCE learned lesson) ──────────────
        if let Some(ref wbd_path) = cli.water_mask {
            info!(
                "[5b/12] Applying external SWBD water body mask from {:?}",
                wbd_path
            );
            match sar_processor::water_mask::read_swbd_wbd(wbd_path) {
                Ok(mask) => {
                    sar_processor::water_mask::apply_external_water_mask(&mut coherence, &mask);
                }
                Err(e) => {
                    warn!("[5b/12] Failed to read external water mask: {:?}. Falling back to adaptive intensity mask.", e);
                    sar_processor::water_mask::apply_intensity_water_mask(
                        &mut coherence,
                        &ml_master,
                        cli.water_mask_threshold,
                    );
                }
            }
        } else {
            info!("[5b/12] Applying adaptive radar-intensity water body mask...");
            sar_processor::water_mask::apply_intensity_water_mask(
                &mut coherence,
                &ml_master,
                cli.water_mask_threshold,
            );
        }

        // ── Step 6: Goldstein phase filter ────────────────────────────────
        info!("[6/12] Applying Goldstein adaptive phase filter...");
        let filtered_ifgram = sar_processor::phase_filter::goldstein_filter(
            &ifgram, &coherence, 32, // block_size
            16, // overlap
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
            info!(
                "[9/12] Simulating and removing topographic phase (B_perp={:.1}m)...",
                baseline_perp
            );

            // Create a flat DEM if no real DEM is available
            let dem =
                Array2::from_elem((unwrapped_phase.nrows(), unwrapped_phase.ncols()), 0.0_f32);

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

        // ── Step 9b: Phase Deramping (ISCE learned lesson) ────────────────
        info!("[9b/12] Removing spatial orbital/atmospheric phase ramp...");
        let defo_phase = sar_processor::deramp::deramp_phase(
            &defo_phase,
            &coherence,
            cli.insar_coherence_threshold,
        );

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
        let displacement_mm_array = defo_phase.mapv(|phi| {
            if phi.is_finite() {
                phi * options.wavelength_m * 1000.0 / (4.0 * std::f32::consts::PI)
            } else {
                f32::NAN
            }
        });
        save_geotiff_f32(displacement_mm_array.view(), &defo_path, bbox_opt)?;
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

        println!(
            "{{\"event\":\"insar_report\",\"path\":\"{}\",\"summary\":{}}}",
            report_path,
            serde_json::to_string(&report.summary)?
        );
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
        info!(
            "Computing native intensity array ({}×{})...",
            native_rows, native_cols
        );
        let mut native_intensity = ndarray::Array2::<f32>::zeros((native_rows, native_cols));

        use rayon::prelude::*;
        native_intensity
            .axis_iter_mut(ndarray::Axis(0))
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
        let ds_image =
            sar_processor::ship_detection::downsample_intensity(native_intensity.view(), ds_factor);
        let ds_rows = ds_image.nrows();
        let ds_cols = ds_image.ncols();

        // Step 3: Run integral-image accelerated CA-CFAR
        let targets = sar_processor::ship_detection::detect_ships_cfar(
            ds_image.view(),
            4,                       // guard radius
            10,                      // background radius
            1e-6,                    // probability of false alarm
            cli.cfar_max_detections, // max detections (hard cap)
        );

        // Step 4: Convert downsampled pixel coords → geographic lat/lon
        #[derive(serde::Serialize)]
        struct OutputShip {
            lat: f64,
            lon: f64,
            intensity: f32,
        }

        let mut final_ships = Vec::new();
        for t in targets {
            if let Some(ref bb) = bbox {
                let lat = bb.north - ((t.y as f64 / ds_rows as f64) * (bb.north - bb.south));
                let lon = bb.west + ((t.x as f64 / ds_cols as f64) * (bb.east - bb.west));
                final_ships.push(OutputShip {
                    lat,
                    lon,
                    intensity: t.intensity,
                });
            }
        }

        let ships_path = output_path
            .replace(".tif", "_ships.json")
            .replace(".png", "_ships.json");
        std::fs::write(&ships_path, serde_json::to_string_pretty(&final_ships)?)?;
        info!(
            "✓ CFAR: {} ship targets written to {}",
            final_ships.len(),
            ships_path
        );
        println!(
            "{{\"event\":\"ships_detected\",\"path\":\"{}\"}}",
            ships_path
        );
    }

    Ok(())
}
