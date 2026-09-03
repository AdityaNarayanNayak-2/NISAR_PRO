use anyhow::Result;
use clap::Parser;
use log::{info, warn};
use ndarray::Array2;
use sar_science_processor::crash_journal;
use sar_science_processor::io::{save_geotiff_f32, save_sar_geotiff, save_sar_image};
use sar_science_processor::nisar_parser;
use std::path::{Path, PathBuf};

/// SAR Science Processor — Memory-Efficient InSAR & GCOV Engine
///
/// Processes NISAR L-band products with aggressive memory management:
/// - HDF5 hyperslab crop-before-load (< 200 MB per SLC)
/// - Early multilooking to reduce working arrays to < 12 MB
/// - Explicit drop() boundaries at each phase transition
///
/// Reference implementations:
/// - SNAPHU tiled unwrapping: https://github.com/isce-framework/snaphu-py
/// - PyGMTSAR lazy chunked processing: https://github.com/AlexeyPechnikov/pygmtsar
/// - ISCE InSAR pipeline: https://insar.dev/
#[derive(Parser, Debug)]
#[command(
    name = "sar_science_processor",
    version = "0.1.0",
    about = "SAR Science: Memory-efficient InSAR & GCOV processing for NISAR products"
)]
struct Cli {
    /// Input file: NISAR HDF5 (.h5) — RSLC, GSLC, or GCOV
    #[arg(short, long, value_name = "FILE")]
    input: Option<PathBuf>,

    /// Secondary input file for InSAR (Slave SLC image)
    #[arg(long, value_name = "SLAVE_FILE")]
    slave: Option<PathBuf>,

    /// Output base path (extensions added automatically)
    #[arg(short, long, default_value = "sar_science_out")]
    output: String,

    /// Polarisation channel to process (HH, VV, HV, VH)
    #[arg(short, long, default_value = "HH")]
    polarization: String,

    /// Processing mode: insar | gcov
    #[arg(long, default_value = "gcov")]
    mode: String,

    // ── Geographic Crop (Required for InSAR) ─────────────────────────────
    /// Center latitude for geographic crop (user-provided text)
    #[arg(long)]
    crop_lat: Option<f64>,

    /// Center longitude for geographic crop (user-provided text)
    #[arg(long)]
    crop_lon: Option<f64>,

    /// Crop preset: 1x1km, 5x5km, 1x2km (rectangular window)
    #[arg(long, default_value = "5x5km")]
    crop_preset: String,

    // ── InSAR Pipeline Parameters ────────────────────────────────────────
    /// Spatial multilook factor (default: 4 for 4×4 averaging)
    #[arg(long, default_value = "4")]
    multilook_factor: usize,

    /// Coherence threshold for PS point selection (default: 0.85)
    #[arg(long, default_value = "0.85")]
    coherence_threshold: f32,

    /// Skip topographic phase removal
    #[arg(long)]
    skip_topo_removal: bool,

    /// Perpendicular baseline in meters (for topo phase removal)
    #[arg(long)]
    baseline_perp: Option<f64>,

    /// Path to external SWBD water body mask (.wbd file)
    #[arg(long, value_name = "WATER_MASK_FILE")]
    water_mask: Option<PathBuf>,

    // ── Radar Band Preset ─────────────────────────────────────────
    /// Radar band: l | c | x (sets default thresholds for L-band, C-band, or X-band)
    #[arg(long, default_value = "l")]
    radar_band: String,

    // ── Flood Mapping Parameters ─────────────────────────────────────────
    /// Path to optional helper GUNW file for coherence fusion
    #[arg(long, value_name = "GUNW_FILE")]
    gunw: Option<PathBuf>,

    /// Minimum dB change threshold required for flood candidates (default: -3.0 dB)
    #[arg(long, default_value = "-3.0", allow_hyphen_values = true)]
    min_change_db: f32,

    /// Seed dB threshold for region growing (default: -5.0 dB)
    #[arg(long, default_value = "-5.0", allow_hyphen_values = true)]
    seed_threshold_db: f32,

    /// Growth dB threshold for region growing (default: -2.5 dB)
    #[arg(long, default_value = "-2.5", allow_hyphen_values = true)]
    growth_threshold_db: f32,

    /// Minimum connected component area in pixels (default: 8)
    #[arg(long, default_value = "8")]
    min_area_pixels: usize,
}

/// Parse crop preset string into rectangular half-dimensions (km)
fn parse_crop_preset(preset: &str) -> (f64, f64) {
    match preset {
        "1x1km" => (0.5, 0.5),     // 1 km × 1 km → ±0.5 km
        "5x5km" => (2.5, 2.5),     // 5 km × 5 km → ±2.5 km
        "1x2km" => (0.5, 1.0),     // 1 km × 2 km → ±0.5 lat, ±1.0 lon
        "10x10km" => (5.0, 5.0),   // 10 km × 10 km
        "20x20km" => (10.0, 10.0), // 20 km × 20 km
        _ => {
            warn!("Unknown crop preset '{}', defaulting to 5x5km", preset);
            (2.5, 2.5)
        }
    }
}

fn main() -> Result<()> {
    env_logger::init();

    // Install panic hook that writes to crash journal
    std::panic::set_hook(Box::new(|info| {
        crash_journal::panic_hook(info);
        // Also print to stderr for immediate visibility
        eprintln!("\n💀 PANIC: {}", info);
    }));

    let cli = Cli::parse();

    // Initialize crash journal in the output directory (or current dir)
    let journal_dir = if cli.output.is_empty() {
        PathBuf::from(".")
    } else {
        Path::new(&cli.output)
            .parent()
            .map(|p| p.to_path_buf())
            .unwrap_or_else(|| PathBuf::from("."))
    };
    crash_journal::init_journal(&journal_dir);

    info!("╔══════════════════════════════════════════════╗");
    info!("║    SAR Science Processor  v0.1.0             ║");
    info!("║    Memory-Efficient InSAR & GCOV Engine      ║");
    info!("╚══════════════════════════════════════════════╝");

    crash_journal::phase("STARTUP", &format!(
        "mode={} input={:?}",
        cli.mode,
        cli.input.as_ref().map(|p| p.file_name().unwrap_or_default())
    ));

    let input = cli.input.as_ref().expect("--input <FILE> is required");

    let ext = input
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    match cli.mode.as_str() {
        // ═══════════════════════════════════════════════════════════════════
        //  MODE: GCOV Visualization (8 GB → 3 MB PNG)
        // ═══════════════════════════════════════════════════════════════════
        "gcov" => {
            info!("╔══════════════════════════════════════════════╗");
            info!("║         GCOV Visualization Pipeline          ║");
            info!("╚══════════════════════════════════════════════╝");

            if ext != "h5" && ext != "hdf5" && ext != "he5" {
                anyhow::bail!("GCOV mode requires a NISAR HDF5 file (.h5), got .{}", ext);
            }

            let crop = if let (Some(lat), Some(lon)) = (cli.crop_lat, cli.crop_lon) {
                let (lat_half, lon_half) = parse_crop_preset(&cli.crop_preset);
                Some(nisar_parser::CropRegion {
                    center_lat: lat,
                    center_lon: lon,
                    radius_km: lat_half.max(lon_half), // Use larger dimension for circular approximation
                })
            } else {
                None
            };

            info!("[1/4] Parsing NISAR GCOV product...");
            let product = if let Some(ref crop_region) = crop {
                info!(
                    "  Geographic crop: ({:.4}°, {:.4}°) preset={}",
                    crop_region.center_lat, crop_region.center_lon, cli.crop_preset
                );
                nisar_parser::validate_crop_intersection(input, crop_region)?;
                nisar_parser::parse_nisar_cropped(input, &cli.polarization, crop_region)?
            } else {
                nisar_parser::parse_nisar_auto(input, &cli.polarization)?
            };

            info!(
                "  Product: {:?} ({}×{})",
                product.product_type,
                product.slc.nrows(),
                product.slc.ncols()
            );

            // Emit georef event for gateway
            if let Some(ref bb) = product.bbox {
                if let Ok(serialized) = serde_json::to_string(&serde_json::json!({
                    "event": "georef",
                    "bbox": {
                        "south": bb.south,
                        "north": bb.north,
                        "west": bb.west,
                        "east": bb.east
                    }
                })) {
                    println!("{}", serialized);
                }
            }

            let mut output_png = cli.output.clone();
            if output_png.ends_with(".tif") {
                output_png = output_png.replace(".tif", ".png");
            } else if !output_png.ends_with(".png") {
                output_png = format!("{}.png", output_png);
            }

            info!("[2/4] Rendering SAR image (multilook + log-scale + gamma)...");
            save_sar_image(product.slc.view(), &output_png)?;

            info!("[3/4] Saving GeoTIFF...");
            let output_tif = output_png.replace(".png", ".tif");
            let bbox_arr = if let Some(ref bb) = product.bbox {
                [bb.west, bb.south, bb.east, bb.north]
            } else {
                [-180.0, -90.0, 180.0, 90.0]
            };

            // Compute intensity for GeoTIFF
            let mut intensity =
                ndarray::Array2::<f32>::zeros((product.slc.nrows(), product.slc.ncols()));
            use rayon::prelude::*;
            intensity
                .axis_iter_mut(ndarray::Axis(0))
                .into_par_iter()
                .enumerate()
                .for_each(|(r, mut row_view)| {
                    for c in 0..product.slc.ncols() {
                        let p = product.slc[[r, c]];
                        if p.re.is_finite() && p.im.is_finite() {
                            row_view[c] = p.re.powi(2) + p.im.powi(2);
                        }
                    }
                });

            save_sar_geotiff(intensity.view(), &output_tif, bbox_arr)?;
            info!("  ✓ GeoTIFF: {}", output_tif);

            // Save GeoJSON bounding box
            let geojson_path = output_tif.replace(".tif", ".geo.json");
            let geojson = serde_json::json!({
                "type": "Feature",
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [[
                        [bbox_arr[0], bbox_arr[1]],
                        [bbox_arr[2], bbox_arr[1]],
                        [bbox_arr[2], bbox_arr[3]],
                        [bbox_arr[0], bbox_arr[3]],
                        [bbox_arr[0], bbox_arr[1]],
                    ]]
                },
                "properties": {}
            });
            std::fs::write(&geojson_path, serde_json::to_string(&geojson)?)?;

            info!("[4/4] Emitting gateway events...");
            println!("{{\"event\":\"output\",\"path\":\"{}\"}}", output_png);

            info!("╔══════════════════════════════════════════════╗");
            info!("║       GCOV Pipeline Complete ✓               ║");
            info!("╚══════════════════════════════════════════════╝");
        }

        // ═══════════════════════════════════════════════════════════════════
        //  MODE: InSAR (Master + Slave → Displacement)
        //  Memory-safe pipeline with explicit drop() boundaries
        // ═══════════════════════════════════════════════════════════════════
        "insar" => {
            info!("╔══════════════════════════════════════════════╗");
            info!("║       InSAR Displacement Pipeline            ║");
            info!("║   (Memory-Safe Crop + Early Multilook)       ║");
            info!("╚══════════════════════════════════════════════╝");

            if ext != "h5" && ext != "hdf5" && ext != "he5" {
                anyhow::bail!("InSAR mode requires NISAR HDF5 files (.h5), got .{}", ext);
            }

            // ── Phase 0: Validate crop coordinates ────────────────────────
            let (crop_lat, crop_lon) = match (cli.crop_lat, cli.crop_lon) {
                (Some(lat), Some(lon)) => (lat, lon),
                _ => anyhow::bail!(
                    "InSAR mode requires --crop-lat and --crop-lon to prevent RAM blowup.\n\
                     Example: --crop-lat 18.7692 --crop-lon 82.8334 --crop-preset 5x5km"
                ),
            };

            let (lat_half_km, lon_half_km) = parse_crop_preset(&cli.crop_preset);
            info!(
                "  Crop window: ({:.4}°, {:.4}°) ± {:.1}×{:.1} km [{}]",
                crop_lat,
                crop_lon,
                lat_half_km * 2.0,
                lon_half_km * 2.0,
                cli.crop_preset
            );

            let crop_region = nisar_parser::CropRegion {
                center_lat: crop_lat,
                center_lon: crop_lon,
                radius_km: lat_half_km.max(lon_half_km),
            };

            // ── Phase 1: Load Master SLC (cropped hyperslab) ──────────────
            info!("[1/13] Loading Master SLC (cropped): {:?}", input);
            nisar_parser::validate_crop_intersection(input, &crop_region)?;
            let master_product =
                nisar_parser::parse_nisar_cropped(input, &cli.polarization, &crop_region)?;
            let bbox = master_product.bbox.clone();
            let focused = master_product.slc;
            let _params = master_product.params;
            info!(
                "  Master loaded: {}×{} ({:.1} MB)",
                focused.nrows(),
                focused.ncols(),
                (focused.nrows() * focused.ncols() * 8) as f64 / 1_048_576.0
            );

            // Emit georef for gateway
            if let Some(ref bb) = bbox {
                if let Ok(serialized) = serde_json::to_string(&serde_json::json!({
                    "event": "georef",
                    "bbox": {
                        "south": bb.south,
                        "north": bb.north,
                        "west": bb.west,
                        "east": bb.east
                    }
                })) {
                    println!("{}", serialized);
                }
            }

            // ── Phase 2: Load Slave SLC (cropped hyperslab) ───────────────
            let slave_path = cli.slave.as_ref().unwrap_or(input);
            info!("[2/13] Loading Slave SLC (cropped): {:?}", slave_path);
            nisar_parser::validate_crop_intersection(slave_path, &crop_region)?;
            let slave_product =
                nisar_parser::parse_nisar_cropped(slave_path, &cli.polarization, &crop_region)?;
            let slave_data = slave_product.slc;
            info!(
                "  Slave loaded: {}×{} ({:.1} MB)",
                slave_data.nrows(),
                slave_data.ncols(),
                (slave_data.nrows() * slave_data.ncols() * 8) as f64 / 1_048_576.0
            );

            // ── Phase 3: Coregistration ───────────────────────────────────
            info!("[3/13] Coregistering slave to master...");
            let aligned_slave = {
                if focused.dim() == slave_data.dim() && std::ptr::eq(input, slave_path) {
                    info!("  Self-interferometry: skipping coregistration");
                    slave_data
                } else {
                    let aligned = sar_science_processor::coregister::coregister(
                        &focused,
                        &slave_data,
                        64, // patch_size
                        32, // overlap
                        2,  // oversample_factor
                    )?;
                    drop(slave_data); // ← FREE raw slave (~200 MB)
                    info!("  ✓ Slave coregistered and raw slave dropped");
                    aligned
                }
            };

            // ── Phase 4: Early Multilooking ───────────────────────────────
            let ml_factor = cli.multilook_factor;
            info!(
                "[4/13] Early multilooking ({}×{} spatial averaging)...",
                ml_factor, ml_factor
            );
            let ml_master =
                sar_science_processor::multilook::multilook(&focused, ml_factor, ml_factor);
            let ml_slave =
                sar_science_processor::multilook::multilook(&aligned_slave, ml_factor, ml_factor);
            info!(
                "  {}×{} → {}×{} (reduction: {}×)",
                focused.nrows(),
                focused.ncols(),
                ml_master.nrows(),
                ml_master.ncols(),
                ml_factor * ml_factor
            );

            // ── FREE full-resolution arrays ──
            drop(focused); // ← FREE ~200 MB
            drop(aligned_slave); // ← FREE ~200 MB
            info!(
                "  ✓ Full-resolution arrays dropped. Working set: {:.1} MB",
                (ml_master.nrows() * ml_master.ncols() * 8 * 2) as f64 / 1_048_576.0
            );

            // ── Phase 5: Interferogram + Coherence ────────────────────────
            info!("[5/13] Computing interferogram (master × conj(slave))...");
            let ifgram = sar_science_processor::insar::compute_interferogram(&ml_master, &ml_slave);

            info!("[5/13] Estimating coherence (SAT O(n²), window=5)...");
            let mut coherence =
                sar_science_processor::insar::estimate_coherence(&ml_master, &ml_slave, 5);
            drop(ml_slave); // ← FREE multilooked slave

            // ── Phase 6: Water Body Masking ───────────────────────────────
            if let Some(ref wbd_path) = cli.water_mask {
                info!("[6/13] Applying SWBD water body mask from {:?}", wbd_path);
                match sar_science_processor::water_mask::read_swbd_wbd(wbd_path) {
                    Ok(mask) => {
                        sar_science_processor::water_mask::apply_external_water_mask(
                            &mut coherence,
                            &mask,
                        );
                    }
                    Err(e) => warn!("  Water mask failed: {:?}. Skipping.", e),
                }
            } else {
                info!("[6/13] Water masking: skipped (no --water-mask)");
            }

            // ── Phase 7: Goldstein Adaptive Phase Filter ──────────────────
            info!("[7/13] Applying Goldstein adaptive phase filter...");
            let filtered_ifgram =
                sar_science_processor::phase_filter::goldstein_filter(&ifgram, &coherence, 32, 16);

            // ── Phase 8: Extract wrapped phase ────────────────────────────
            info!("[8/13] Extracting wrapped phase...");
            let wrapped_phase = sar_science_processor::insar::extract_phase(&filtered_ifgram);

            // ── Phase 9: Phase Unwrapping ─────────────────────────────────
            info!("[9/13] Unwrapping phase (quality-guided flood fill)...");
            let unwrapped_phase =
                sar_science_processor::unwrap::unwrap_phase(&wrapped_phase, &coherence);

            // ── Phase 10: Topographic phase removal ───────────────────────
            let defo_phase = if cli.skip_topo_removal {
                info!("[10/13] Topo phase removal: SKIPPED");
                unwrapped_phase
            } else if let Some(baseline_perp) = cli.baseline_perp {
                info!(
                    "[10/13] Removing topographic phase (B_perp={:.1}m)...",
                    baseline_perp
                );
                let dem =
                    Array2::from_elem((unwrapped_phase.nrows(), unwrapped_phase.ncols()), 0.0_f32);
                let wavelength = 0.2384; // NISAR L-band
                let slant_range = 900_000.0;
                let incidence_angle = 0.6109; // ~35°
                let topo = sar_science_processor::topo_phase::simulate_topo_phase(
                    &dem,
                    baseline_perp,
                    wavelength,
                    slant_range,
                    incidence_angle,
                );
                sar_science_processor::topo_phase::remove_topo_phase(&unwrapped_phase, &topo)
            } else {
                info!("[10/13] Topo phase removal: SKIPPED (no --baseline-perp)");
                unwrapped_phase
            };

            // ── Phase 11: Phase Deramping ─────────────────────────────────
            info!("[11/13] Removing orbital/atmospheric phase ramp (2D linear)...");
            let defo_phase = sar_science_processor::deramp::deramp_phase(
                &defo_phase,
                &coherence,
                cli.coherence_threshold,
            );

            // ── Phase 12: PS-InSAR Analysis ───────────────────────────────
            info!("[12/13] Analyzing persistent scatterers (PS-InSAR)...");
            let bbox_arr = bbox.as_ref().map(|b| [b.south, b.west, b.north, b.east]);
            let options = sar_science_processor::infra_health::InfraHealthOptions {
                bbox: bbox_arr,
                wavelength_m: 0.2384,
                coherence_threshold: cli.coherence_threshold,
                max_points: 2000,
            };
            let report = sar_science_processor::infra_health::analyze_infrastructure_unwrapped(
                &defo_phase,
                &coherence,
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

            // ── Phase 13: Save Outputs ────────────────────────────────────
            info!("[13/13] Saving InSAR output products...");
            let base = cli.output.replace(".tif", "").replace(".png", "");
            let bbox_opt = bbox.as_ref().map(|b| [b.west, b.south, b.east, b.north]);

            // Convert phase to displacement (mm)
            let displacement_mm = defo_phase.mapv(|phi| {
                if phi.is_finite() {
                    phi * 0.2384 * 1000.0 / (4.0 * std::f32::consts::PI)
                } else {
                    f32::NAN
                }
            });

            // Deformation GeoTIFF
            let defo_path = format!("{}_defo_phase.tif", base);
            save_geotiff_f32(displacement_mm.view(), &defo_path, bbox_opt)?;
            info!("  ✓ Displacement GeoTIFF: {}", defo_path);

            // Coherence GeoTIFF
            let coh_path = format!("{}_coherence.tif", base);
            save_geotiff_f32(coherence.view(), &coh_path, bbox_opt)?;
            info!("  ✓ Coherence GeoTIFF: {}", coh_path);

            // Colormapped PNG preview for Leaflet overlay
            let png_path = format!("{}_insar.png", base);
            sar_science_processor::io::save_colormap_png_f32(
                displacement_mm.view(),
                &png_path,
                -25.0,
                25.0,
            )?;
            info!("  ✓ InSAR PNG preview: {}", png_path);

            // InSAR report JSON
            let report_path = format!("{}_insar.json", base);
            std::fs::write(&report_path, serde_json::to_string_pretty(&report)?)?;
            info!("  ✓ InSAR report: {}", report_path);

            // Emit gateway events
            println!(
                "{{\"event\":\"insar_report\",\"path\":\"{}\",\"summary\":{}}}",
                report_path,
                serde_json::to_string(&report.summary)?
            );
            println!(
                "{{\"event\":\"insar_outputs\",\"defo_phase\":\"{}\",\"coherence\":\"{}\",\"report\":\"{}\"}}",
                defo_path, coh_path, report_path
            );

            info!("╔══════════════════════════════════════════════╗");
            info!("║     InSAR Pipeline Complete ✓                ║");
            info!("╚══════════════════════════════════════════════╝");
        }

        "flood" => {
            println!("{{\"event\":\"progress\",\"stage\":\"SUBMITTED\",\"message\":\"Job submitted to processor\"}}");
            info!("╔══════════════════════════════════════════════╗");
            info!("║       Flood & Inundation Mapping Pipeline    ║");
            info!("╚══════════════════════════════════════════════╝");

            let (crop_lat, crop_lon) = match (cli.crop_lat, cli.crop_lon) {
                (Some(lat), Some(lon)) => (lat, lon),
                _ => anyhow::bail!(
                    "Flood mode requires --crop-lat and --crop-lon to prevent RAM blowup.\n\
                     Example: --crop-lat 18.7883 --crop-lon 82.6003 --crop-preset 10x10km"
                ),
            };

            let (lat_half_km, lon_half_km) = parse_crop_preset(&cli.crop_preset);
            info!(
                "  Crop window: ({:.4}°, {:.4}°) ± {:.1}×{:.1} km [{}]",
                crop_lat,
                crop_lon,
                lat_half_km * 2.0,
                lon_half_km * 2.0,
                cli.crop_preset
            );

            let crop_region = nisar_parser::CropRegion {
                center_lat: crop_lat,
                center_lon: crop_lon,
                radius_km: lat_half_km.max(lon_half_km),
            };

            println!("{{\"event\":\"progress\",\"stage\":\"PROCESSING\",\"message\":\"[1/5] Loading active product metadata...\"}}");
            // 1. Load Active GCOV
            info!("[1/5] Loading Active GCOV: {:?}", input);
            crash_journal::phase("FLOOD_STEP_1", &format!("Loading Active GCOV: {:?}", input.file_name().unwrap_or_default()));
            nisar_parser::validate_crop_intersection(input, &crop_region)?;
            let active_product =
                nisar_parser::parse_nisar_cropped(input, &cli.polarization, &crop_region)?;
            crash_journal::checkpoint_after_free("Active GCOV parsed & cropped");
            let bbox = active_product.bbox.clone();
            let active_slc = active_product.slc;

            // Emit georef for gateway/frontend
            if let Some(ref bb) = bbox {
                if let Ok(serialized) = serde_json::to_string(&serde_json::json!({
                    "event": "georef",
                    "bbox": {
                        "south": bb.south,
                        "north": bb.north,
                        "west": bb.west,
                        "east": bb.east
                    }
                })) {
                    println!("{}", serialized);
                }
            }

            // 2. Load Optional Baseline GCOV
            println!("{{\"event\":\"progress\",\"stage\":\"PROCESSING\",\"message\":\"[2/5] Loading baseline reference product...\"}}");
            let baseline_product = if let Some(ref slave_path) = cli.slave {
                info!("[2/5] Loading Baseline GCOV: {:?}", slave_path);
                crash_journal::phase("FLOOD_STEP_2", &format!("Loading Baseline GCOV: {:?}", slave_path.file_name().unwrap_or_default()));
                nisar_parser::validate_crop_intersection(slave_path, &crop_region)?;
                let prod =
                    nisar_parser::parse_nisar_cropped(slave_path, &cli.polarization, &crop_region)?;
                crash_journal::checkpoint_after_free("Baseline GCOV parsed & cropped");
                Some(prod)
            } else {
                None
            };
            let baseline_slc = baseline_product.as_ref().map(|p| &p.slc);

            // Extract and validate pixel spacing from metadata (WGS-84 coordinate grids)
            let active_dx = active_product.pixel_spacing_x_m.ok_or_else(|| {
                anyhow::anyhow!("Active GCOV product is missing xCoordinateSpacing metadata. Cannot calculate flood acreage reliably.")
            })?;
            let active_dy = active_product.pixel_spacing_y_m.ok_or_else(|| {
                anyhow::anyhow!("Active GCOV product is missing yCoordinateSpacing metadata. Cannot calculate flood acreage reliably.")
            })?;

            if let Some(ref bp) = baseline_product {
                let baseline_dx = bp.pixel_spacing_x_m.ok_or_else(|| {
                    anyhow::anyhow!("Baseline GCOV product is missing xCoordinateSpacing metadata. Cannot perform pixel-wise flood comparison safely.")
                })?;
                let baseline_dy = bp.pixel_spacing_y_m.ok_or_else(|| {
                    anyhow::anyhow!("Baseline GCOV product is missing yCoordinateSpacing metadata. Cannot perform pixel-wise flood comparison safely.")
                })?;

                if (active_dx.abs() - baseline_dx.abs()).abs() > 1e-3
                    || (active_dy.abs() - baseline_dy.abs()).abs() > 1e-3
                {
                    anyhow::bail!(
                        "ERROR: Incompatible grid spacing. Active grid = {:.1}m × {:.1}m, Baseline grid = {:.1}m × {:.1}m. Cannot perform pixel-wise flood comparison safely.",
                        active_dx.abs(),
                        active_dy.abs(),
                        baseline_dx.abs(),
                        baseline_dy.abs()
                    );
                }
            }

            // 3. Load Optional Coherence from GUNW
            println!("{{\"event\":\"progress\",\"stage\":\"PROCESSING\",\"message\":\"[3/5] Loading InSAR coherence helper...\"}}");
            let coherence = if let Some(ref gunw_path) = cli.gunw {
                info!("[3/5] Loading GUNW coherence magnitude: {:?}", gunw_path);
                match nisar_parser::parse_gunw_coherence_cropped(
                    gunw_path,
                    &cli.polarization,
                    &crop_region,
                ) {
                    Ok(coh) => {
                        info!("  Coherence loaded: {}×{}", coh.nrows(), coh.ncols());
                        Some(coh)
                    }
                    Err(e) => {
                        warn!(
                            "  Failed to load coherence: {:?}. Continuing without coherence.",
                            e
                        );
                        None
                    }
                }
            } else {
                None
            };

            // 4. Load External Water Mask
            println!("{{\"event\":\"progress\",\"stage\":\"PROCESSING\",\"message\":\"[4/5] Loading SWBD water body mask...\"}}");
            let external_mask = if let Some(ref wbd_path) = cli.water_mask {
                info!(
                    "[4/5] Loading external SWBD water body mask from {:?}",
                    wbd_path
                );
                match sar_science_processor::water_mask::read_swbd_wbd(wbd_path) {
                    Ok(mask) => Some(mask),
                    Err(e) => {
                        warn!(
                            "  SWBD mask loading failed: {:?}. Continuing without external mask.",
                            e
                        );
                        None
                    }
                }
            } else {
                None
            };

            // 5. Run 7-Stage Flood Detection Pipeline
            println!("{{\"event\":\"progress\",\"stage\":\"PROCESSING\",\"message\":\"[5/5] Running 7-stage change detection...\"}}");
            crash_journal::phase("FLOOD_STEP_5", "Running 7-stage flood detection pipeline");
            info!("[5/5] Running 7-stage flood detection pipeline...");
            let band = cli.radar_band.parse::<sar_science_processor::flood_detect::RadarBand>()
                .unwrap_or(sar_science_processor::flood_detect::RadarBand::LBand);
            let mut pipeline_opts = sar_science_processor::flood_detect::FloodDetectionOptions::for_band(band);

            // Apply overrides only if explicitly specified by user via CLI
            if cli.min_change_db != -3.0 {
                pipeline_opts.min_change_db = cli.min_change_db;
            }
            if cli.seed_threshold_db != -5.0 {
                pipeline_opts.seed_threshold_db = cli.seed_threshold_db;
            }
            if cli.growth_threshold_db != -2.5 {
                pipeline_opts.growth_threshold_db = cli.growth_threshold_db;
            }
            if cli.min_area_pixels != 8 {
                pipeline_opts.min_area_pixels = cli.min_area_pixels;
            }

            let (class_map, _delta_db, report) =
                sar_science_processor::flood_detect::run_flood_detection_pipeline(
                    &active_slc,
                    baseline_slc,
                    coherence.as_ref(),
                    external_mask.as_ref(),
                    &pipeline_opts,
                );

            // Save output files
            println!("{{\"event\":\"progress\",\"stage\":\"GENERATING_OUTPUTS\",\"message\":\"Generating geospatial products...\"}}");
            let base = cli.output.replace(".tif", "").replace(".png", "");
            let bbox_opt = bbox.as_ref().map(|b| [b.west, b.south, b.east, b.north]);

            // Save GeoTIFF classification raster (using compact 8-bit unsigned integer layout)
            let tif_path = format!("{}_flood_class.tif", base);
            sar_science_processor::io::save_geotiff_u8(
                class_map.view(),
                &tif_path,
                bbox_opt,
            )?;

            // Save RGBA colormapped PNG
            let png_path = format!("{}_flood.png", base);
            sar_science_processor::io::save_flood_map_png(class_map.view(), &png_path)?;

            // Save GeoJSON flood polygons
            let geojson_path = format!("{}_flood.geo.json", base);
            if let Some(bbox_val) = bbox_opt {
                sar_science_processor::io::save_flood_geojson(
                    class_map.view(),
                    bbox_val,
                    &geojson_path,
                )?;
            }

            // Save Reproducible JSON Report
            let report_path = format!("{}_flood.json", base);
            let active_filename = input
                .file_name()
                .and_then(|f| f.to_str())
                .unwrap_or("")
                .to_string();
            let baseline_filename = cli
                .slave
                .as_ref()
                .and_then(|p| p.file_name())
                .and_then(|f| f.to_str())
                .unwrap_or("")
                .to_string();

            // Calculate physical areas in acres
            let pixel_area_m2 = active_dx.abs() * active_dy.abs();
            let pixel_area_acres = pixel_area_m2 / 4046.856; // 1 acre = 4046.856 sqm

            let total_area_acres = report.total_pixels as f64 * pixel_area_acres;
            let permanent_water_acres = report.permanent_water_pixels as f64 * pixel_area_acres;
            let flood_high_acres = report.flooded_pixels_high_conf as f64 * pixel_area_acres;
            let flood_med_acres = report.flooded_pixels_med_conf as f64 * pixel_area_acres;
            let flood_low_acres = report.flooded_pixels_low_conf as f64 * pixel_area_acres;
            let total_flood_acres = report.total_flooded_pixels as f64 * pixel_area_acres;

            // Generate full JSON report
            let full_report = serde_json::json!({
                "product": {
                    "active_id": active_filename,
                    "baseline_id": baseline_filename,
                    "frequency": "L",
                    "polarization": cli.polarization,
                    "pixel_spacing_x_m": active_dx,
                    "pixel_spacing_y_m": active_dy,
                    "crs": active_product.crs
                },
                "method": {
                    "detector": "log_ratio_change_detection",
                    "threshold_method": "otsu_on_change_image",
                    "threshold_db": report.otsu_threshold_db,
                    "raw_otsu_db": report.raw_otsu_threshold_db,
                    "min_change_db": cli.min_change_db,
                    "seed_threshold_db": cli.seed_threshold_db,
                    "growth_threshold_db": cli.growth_threshold_db,
                    "speckle_filter": "median_3x3",
                    "region_growing": true,
                    "morphology": format!("open_3x3 + close_3x3 + cc_filter_{}px", cli.min_area_pixels),
                    "coherence_used": coherence.is_some()
                },
                "crop": {
                    "center_lat": crop_lat,
                    "center_lon": crop_lon,
                    "preset": cli.crop_preset
                },
                "areas": {
                    "total_area_acres": total_area_acres,
                    "permanent_water_acres": permanent_water_acres,
                    "new_inundation_high_acres": flood_high_acres,
                    "new_inundation_medium_acres": flood_med_acres,
                    "new_inundation_low_acres": flood_low_acres,
                    "total_flood_acres": total_flood_acres
                },
                "flood_regions": report.flood_regions_count,
                "confidence_reasons": report.confidence_reasons,
                "warnings": report.warnings
            });

            std::fs::write(&report_path, serde_json::to_string_pretty(&full_report)?)?;
            info!("  ✓ Flood mapping report: {}", report_path);

            // Emit gateway event
            println!(
                "{{\"event\":\"flood_report\",\"path\":\"{}\",\"summary\":{}}}",
                report_path,
                serde_json::to_string(&full_report["areas"])?
            );
            println!("{{\"event\":\"output\",\"path\":\"{}\"}}", png_path);
            println!("{{\"event\":\"progress\",\"stage\":\"COMPLETE\",\"message\":\"Analysis completed successfully\"}}");

            info!("╔══════════════════════════════════════════════╗");
            info!("║     Flood Mapping Pipeline Complete ✓        ║");
            info!("╚══════════════════════════════════════════════╝");
        }

        other => {
            anyhow::bail!(
                "Unknown mode '{}'. Use --mode insar, --mode gcov, or --mode flood",
                other
            );
        }
    }

    Ok(())
}
