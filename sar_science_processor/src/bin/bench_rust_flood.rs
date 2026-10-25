//! Microsecond benchmark harness for the 7-stage SAR Flood Processing Pipeline in Rust.
//! Measures per-stage latency with std::time::Instant, peak RSS, and outputs structured JSON.

use std::path::Path;
use std::time::Instant;
use ndarray::Array2;
use num_complex::Complex32;
use serde_json::json;

use sar_science_processor::flood_detect::{
    build_permanent_water_mask, compute_change_image, compute_confidence,
    gcov_to_db, median_filter_3x3, morphological_cleanup, otsu_threshold,
    region_grow, FloodDetectionOptions, RadarBand,
};
use sar_science_processor::io::{save_flood_geojson, save_flood_map_png, save_geotiff_u8};
use sar_science_processor::multilook::multilook;
use sar_science_processor::windowed::{ChunkedF32Reader, Window};

fn get_peak_rss_mb() -> f64 {
    #[cfg(target_os = "linux")]
    {
        if let Ok(status) = std::fs::read_to_string("/proc/self/status") {
            for line in status.lines() {
                if line.starts_with("VmHWM:") {
                    let parts: Vec<&str> = line.split_whitespace().collect();
                    if parts.len() >= 2 {
                        if let Ok(kb) = parts[1].parse::<f64>() {
                            return kb / 1024.0;
                        }
                    }
                }
            }
        }
    }
    0.0
}

fn median_std(mut vals: Vec<f64>) -> (f64, f64) {
    if vals.is_empty() {
        return (0.0, 0.0);
    }
    vals.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
    let n = vals.len();
    let median = if n % 2 == 1 {
        vals[n / 2]
    } else {
        (vals[n / 2 - 1] + vals[n / 2]) / 2.0
    };
    let mean = vals.iter().sum::<f64>() / n as f64;
    let var = vals.iter().map(|x| (x - mean).powi(2)).sum::<f64>() / n as f64;
    (median, var.sqrt())
}

fn main() -> anyhow::Result<()> {
    let args: Vec<String> = std::env::args().collect();
    let iterations: usize = args
        .iter()
        .position(|a| a == "--iterations")
        .and_then(|i| args.get(i + 1))
        .and_then(|s| s.parse().ok())
        .unwrap_or(5);

    let active_path = "/home/aditya/Desktop/sar_analyzer/Download/gcov/NISAR_L2_PR_GCOV_028_062_D_075_4005_DHDH_A_20260817T121708_20260817T121743_P05023_N_F_J_001.h5";
    let base_path = "/home/aditya/Desktop/sar_analyzer/Download/gcov/NISAR_L2_PR_GCOV_025_062_D_075_2005_QPDH_A_20260712T121710_20260712T121745_P05023_N_F_J_001.h5";
    let out_dir = args
        .iter()
        .position(|a| a == "--out-dir")
        .and_then(|i| args.get(i + 1).map(|s| s.as_str()))
        .unwrap_or("/home/aditya/Desktop/sar_analyzer/benchmarks/results");

    std::fs::create_dir_all(out_dir)?;

    let opts = FloodDetectionOptions::for_band(RadarBand::LBand);

    // Bounding box for Assam crop
    let west = 94.792486;
    let south = 27.116673;
    let east = 94.997276;
    let north = 27.294322;
    let bbox = [west, south, east, north];

    let mut times_io_ml = Vec::with_capacity(iterations);
    let mut times_db = Vec::with_capacity(iterations);
    let mut times_speckle = Vec::with_capacity(iterations);
    let mut times_water_otsu = Vec::with_capacity(iterations);
    let mut times_region_grow = Vec::with_capacity(iterations);
    let mut times_morphology = Vec::with_capacity(iterations);
    let mut times_export = Vec::with_capacity(iterations);
    let mut times_total = Vec::with_capacity(iterations);

    let mut final_otsu = 0.0f32;
    let mut final_valid_px = 0usize;
    let mut final_perm_px = 0usize;
    let mut final_flood_px = 0usize;
    let mut final_regions = 0usize;
    let mut final_flood_acres = 0.0f64;

    // Total loops = 1 warmup + iterations
    let total_runs = 1 + iterations;

    for run in 0..total_runs {
        let is_warmup = run == 0;
        let t_total_start = Instant::now();

        // ── Stage 1: Windowed HDF5 I/O + 2x2 Multilook ──
        let t0 = Instant::now();
        let mut active_reader = ChunkedF32Reader::open(Path::new(active_path))?;
        let active_win = Window {
            row_start: 10850,
            row_end: 12850,
            col_start: 4120,
            col_end: 6120,
        };
        let active_raw = active_reader.read_window("/science/LSAR/GCOV/grids/frequencyA/HHHH", active_win)?;
        let mut active_2k = Array2::<Complex32>::from_elem((2000, 2000), Complex32::new(0.0, 0.0));
        for (i, &v) in active_raw.iter().enumerate() {
            active_2k[[i / 2000, i % 2000]] = Complex32::new(v, 0.0);
        }
        let active_ml = multilook(&active_2k, 2, 2);

        let mut base_reader = ChunkedF32Reader::open(Path::new(base_path))?;
        let base_win = Window {
            row_start: 5425,
            row_end: 6425,
            col_start: 2060,
            col_end: 3060,
        };
        let base_raw = base_reader.read_window("/science/LSAR/GCOV/grids/frequencyA/HHHH", base_win)?;
        let mut base_slc = Array2::<Complex32>::from_elem((1000, 1000), Complex32::new(0.0, 0.0));
        for (i, &v) in base_raw.iter().enumerate() {
            base_slc[[i / 1000, i % 1000]] = Complex32::new(v, 0.0);
        }
        let dur_io_ml = t0.elapsed().as_secs_f64() * 1000.0;

        // ── Stage 2: Power to dB & Nodata Masking ──
        let t1 = Instant::now();
        let active_db = gcov_to_db(&active_ml);
        let base_db = gcov_to_db(&base_slc);
        let valid_mask = &active_db.mapv(|v| v.is_finite()) & &base_db.mapv(|v| v.is_finite());
        let dur_db = t1.elapsed().as_secs_f64() * 1000.0;

        // ── Stage 3: 3x3 Median Speckle Filter ──
        let t2 = Instant::now();
        let active_filtered = median_filter_3x3(&active_db, &valid_mask);
        let base_filtered = median_filter_3x3(&base_db, &valid_mask);
        let dur_speckle = t2.elapsed().as_secs_f64() * 1000.0;

        // ── Stage 4: Delta dB, Permanent Water Mask & 256-Bin Otsu Threshold ──
        let t3 = Instant::now();
        let delta_db = compute_change_image(&active_filtered, &base_filtered);
        let perm_water = build_permanent_water_mask(&active_filtered, &base_filtered, opts.permanent_water_thresh_db, None);
        let otsu_valid = &valid_mask & &perm_water.mapv(|w| !w);
        let otsu_thresh = otsu_threshold(&delta_db, &otsu_valid, opts.otsu_bins);
        let effective_thresh = otsu_thresh.min(opts.min_change_db);
        let dur_water_otsu = t3.elapsed().as_secs_f64() * 1000.0;

        // ── Stage 5: Dual-Threshold 8-Connected Region Growing ──
        let t4 = Instant::now();
        let seed_thresh = opts.seed_threshold_db.min(effective_thresh);
        let mut flood_mask = region_grow(&delta_db, seed_thresh, opts.growth_threshold_db, &valid_mask, &perm_water);
        let dur_region_grow = t4.elapsed().as_secs_f64() * 1000.0;

        // ── Stage 6: Morphological Cleanup & CC Filter ──
        let t5 = Instant::now();
        let n_regions = morphological_cleanup(&mut flood_mask, opts.min_area_pixels);
        for (m, &v) in flood_mask.iter_mut().zip(valid_mask.iter()) {
            if !v { *m = false; }
        }
        let dur_morphology = t5.elapsed().as_secs_f64() * 1000.0;

        // ── Stage 7: Confidence Classification & Product Export ──
        let t6 = Instant::now();
        let (class_map, _) = compute_confidence(&delta_db, &flood_mask, &perm_water, None, seed_thresh);

        let tif_out = format!("{}/rust_flood_class.tif", out_dir);
        let png_out = format!("{}/rust_flood.png", out_dir);
        let geo_out = format!("{}/rust_flood.geo.json", out_dir);

        save_geotiff_u8(class_map.view(), &tif_out, Some(bbox))?;
        save_flood_map_png(class_map.view(), &png_out)?;
        save_flood_geojson(class_map.view(), bbox, &geo_out)?;
        let dur_export = t6.elapsed().as_secs_f64() * 1000.0;

        let dur_total = t_total_start.elapsed().as_secs_f64() * 1000.0;

        if !is_warmup {
            times_io_ml.push(dur_io_ml);
            times_db.push(dur_db);
            times_speckle.push(dur_speckle);
            times_water_otsu.push(dur_water_otsu);
            times_region_grow.push(dur_region_grow);
            times_morphology.push(dur_morphology);
            times_export.push(dur_export);
            times_total.push(dur_total);

            final_otsu = otsu_thresh;
            final_valid_px = valid_mask.iter().filter(|&&v| v).count();
            final_perm_px = perm_water.iter().filter(|&&v| v).count();
            final_flood_px = flood_mask.iter().filter(|&&v| v).count();
            final_regions = n_regions;
            final_flood_acres = final_flood_px as f64 * (20.0 * 20.0) * 0.000247105;
        }
    }

    let (io_ml_med, io_ml_std) = median_std(times_io_ml);
    let (db_med, db_std) = median_std(times_db);
    let (speckle_med, speckle_std) = median_std(times_speckle);
    let (water_otsu_med, water_otsu_std) = median_std(times_water_otsu);
    let (region_grow_med, region_grow_std) = median_std(times_region_grow);
    let (morphology_med, morphology_std) = median_std(times_morphology);
    let (export_med, export_std) = median_std(times_export);
    let (total_med, total_std) = median_std(times_total);

    let peak_rss = get_peak_rss_mb();

    let output = json!({
        "engine": "Rust (sar_science_processor release)",
        "iterations": iterations,
        "stages": {
            "io_and_multilook": { "median_ms": io_ml_med, "std_ms": io_ml_std },
            "db_conversion": { "median_ms": db_med, "std_ms": db_std },
            "speckle_filter": { "median_ms": speckle_med, "std_ms": speckle_std, "mpixels_per_sec": 1000.0 / (speckle_med / 1.0) },
            "water_and_otsu": { "median_ms": water_otsu_med, "std_ms": water_otsu_std },
            "region_grow": { "median_ms": region_grow_med, "std_ms": region_grow_std },
            "morphology": { "median_ms": morphology_med, "std_ms": morphology_std },
            "geospatial_export": { "median_ms": export_med, "std_ms": export_std },
            "total_pipeline": { "median_ms": total_med, "std_ms": total_std }
        },
        "metrics": {
            "peak_rss_mb": peak_rss,
            "otsu_thresh_db": final_otsu,
            "valid_pixels": final_valid_px,
            "permanent_water_pixels": final_perm_px,
            "flood_pixels": final_flood_px,
            "flood_regions": final_regions,
            "total_flood_acres": final_flood_acres
        }
    });

    println!("{}", serde_json::to_string_pretty(&output)?);
    Ok(())
}
