use crate::errors::Result;
use image::{ImageBuffer, Rgb};
use log::info;
use ndarray::{Array2, ArrayView2};
use rayon::prelude::*;
use std::fs;

pub async fn fetch_sentinel1_data(scene_id: &str) -> Result<Array2<f32>> {
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

/// Save a SAR focused image as PNG.
///
/// Applies industry-standard SAR display processing:
/// 1. Calculate intensity (magnitude squared)
/// 2. Spatial Multilooking (block averaging) to reduce dimensions and speckle
/// 3. Log10 scaling (dB-like, adds 1e-10 to avoid log(0))
/// 4. Percentile-based contrast stretch (2nd–98th percentile)
/// 5. Gamma correction (γ = 0.6) to brighten mid-tones
pub fn save_sar_image(
    complex_image: ArrayView2<num_complex::Complex32>,
    output_filename: &str,
) -> Result<()> {
    let rows = complex_image.nrows();
    let cols = complex_image.ncols();

    // ── 1. Determine Downsampling (Multilooking) Factor ──────────────────
    let max_dimension = 2048;
    let factor = (rows.max(cols) as f32 / max_dimension as f32)
        .ceil()
        .max(1.0) as usize;

    let out_rows = rows / factor;
    let out_cols = cols / factor;

    info!(
        "Rendering SAR image: {}×{} → downsampled {}x ({}×{}) → {}",
        rows, cols, factor, out_rows, out_cols, output_filename
    );

    // ── 2. Block Averaging of Intensity ───────────────────────────────────
    let mut num_finite = 0;
    let mut log_intensity = Vec::with_capacity(out_rows * out_cols);

    for out_r in 0..out_rows {
        for out_c in 0..out_cols {
            let mut sum_intensity = 0.0_f32;
            let mut count = 0;

            let r_start = out_r * factor;
            let c_start = out_c * factor;
            let r_end = (r_start + factor).min(rows);
            let c_end = (c_start + factor).min(cols);

            for r in r_start..r_end {
                for c in c_start..c_end {
                    let pixel = complex_image[[r, c]];
                    if pixel.re.is_finite() && pixel.im.is_finite() {
                        sum_intensity += pixel.re.powi(2) + pixel.im.powi(2);
                        count += 1;
                    }
                }
            }

            if count > 0 {
                let mean_intensity = sum_intensity / count as f32;
                log_intensity.push((mean_intensity + 1e-10).log10());
                num_finite += 1;
            } else {
                log_intensity.push(f32::NAN);
            }
        }
    }

    // ── 3. Percentile stretch (2nd–98th) ─────────────────────────────────
    let mut sorted: Vec<f32> = log_intensity.iter().copied().filter(|v| v.is_finite()).collect();
    sorted.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));

    let (p2, p98) = if sorted.is_empty() {
        info!("Warning: no finite values found, using default stretch");
        (0.0_f32, 1.0_f32)
    } else {
        let n = sorted.len();
        let lo = sorted[((n as f32 * 0.02) as usize).min(n.saturating_sub(1))];
        let hi = sorted[((n as f32 * 0.98) as usize).min(n - 1)];
        (lo, hi)
    };
    let stretch_range = (p98 - p2).max(1e-6);

    info!("Contrast stretch: [{:.2}, {:.2}] dB (based on {} valid blocks)", p2, p98, num_finite);

    // ── 4. Gamma + quantize to u8 ─────────────────────────────────────────
    let gamma = 0.6_f32;
    let pixels: Vec<u8> = log_intensity
        .iter()
        .map(|&v| {
            if !v.is_finite() {
                return 0u8; // NaN/Inf → black
            }
            let normalized = ((v - p2) / stretch_range).clamp(0.0, 1.0);
            let gamma_corrected = normalized.powf(gamma);
            (gamma_corrected * 255.0) as u8
        })
        .collect();

    // ── 5. Write PNG ──────────────────────────────────────────────────────
    let mut img: ImageBuffer<Rgb<u8>, Vec<u8>> = ImageBuffer::new(out_cols as u32, out_rows as u32);
    for (idx, pixel) in img.pixels_mut().enumerate() {
        let v = pixels[idx];
        *pixel = Rgb([v, v, v]); // Grayscale
    }

    img.save(output_filename)?;
    info!("SAR image saved: {}", output_filename);
    Ok(())
}

/// Frost Speckle Filter (Edge Preserving) applied to intensity arrays
fn frost_filter(intensity: &Array2<f32>, window_size: usize, damp_factor: f32) -> Array2<f32> {
    let rows = intensity.nrows();
    let cols = intensity.ncols();
    let pad = window_size / 2;
    let mut filtered = Array2::zeros((rows, cols));

    // Simple multi-threading iteration over rows
    filtered.axis_iter_mut(ndarray::Axis(0))
        .into_par_iter()
        .enumerate()
        .for_each(|(r, mut row_out)| {
            for c in 0..cols {
                let mut sum = 0.0;
                let mut sum_sq = 0.0;
                let mut count = 0.0;

                let r_start = r.saturating_sub(pad);
                let c_start = c.saturating_sub(pad);
                let r_end = (r + pad + 1).min(rows);
                let c_end = (c + pad + 1).min(cols);

                for wr in r_start..r_end {
                    for wc in c_start..c_end {
                        let val = intensity[[wr, wc]];
                        if val.is_finite() && val > 0.0 {
                            sum += val;
                            sum_sq += val * val;
                            count += 1.0;
                        }
                    }
                }

                if count > 3.0 && sum > 0.0 {
                    let mean = sum / count;
                    let variance = (sum_sq / count) - (mean * mean);
                    let std_dev = variance.sqrt().max(1e-6);
                    let cv = std_dev / mean;
                    let weight_center = (-damp_factor * cv).exp();

                    // Simplified local assignment
                    let center_val = intensity[[r, c]];
                    row_out[c] = (weight_center * center_val) + ((1.0 - weight_center) * mean);
                } else {
                    row_out[c] = intensity[[r, c]];
                }
            }
        });

    filtered
}

/// Lee Sigma Speckle Filter (Adaptive Statistical)
///
/// Uses local mean/variance statistics to adaptively blend each pixel
/// with its neighborhood. In homogeneous regions (low CV), the filter
/// strongly smooths. Near edges (high CV), it preserves the original value.
///
/// Reference: Lee, J.S. (1981) "Speckle Analysis and Smoothing of SAR Images"
fn lee_filter(intensity: &Array2<f32>, window_size: usize) -> Array2<f32> {
    let rows = intensity.nrows();
    let cols = intensity.ncols();
    let pad = window_size / 2;
    let mut filtered = Array2::zeros((rows, cols));

    // Estimate the number of looks from the global coefficient of variation
    let global_mean = intensity.iter().filter(|v| v.is_finite() && **v > 0.0).sum::<f32>()
        / intensity.iter().filter(|v| v.is_finite() && **v > 0.0).count().max(1) as f32;
    let global_var = intensity.iter()
        .filter(|v| v.is_finite() && **v > 0.0)
        .map(|v| (v - global_mean).powi(2))
        .sum::<f32>()
        / intensity.iter().filter(|v| v.is_finite() && **v > 0.0).count().max(1) as f32;
    // Noise variance for L-look data: sigma_n^2 = mean^2 / L
    // Approximate L from global stats: L ≈ mean^2 / var
    let noise_var = if global_mean > 0.0 { global_mean.powi(2) / (global_var / global_mean.powi(2)).max(1.0) } else { 1.0 };

    filtered.axis_iter_mut(ndarray::Axis(0))
        .into_par_iter()
        .enumerate()
        .for_each(|(r, mut row_out)| {
            for c in 0..cols {
                let center_val = intensity[[r, c]];
                if !center_val.is_finite() || center_val <= 0.0 {
                    row_out[c] = center_val;
                    continue;
                }

                let r_start = r.saturating_sub(pad);
                let c_start = c.saturating_sub(pad);
                let r_end = (r + pad + 1).min(rows);
                let c_end = (c + pad + 1).min(cols);

                let mut sum = 0.0_f32;
                let mut sum_sq = 0.0_f32;
                let mut count = 0.0_f32;

                for wr in r_start..r_end {
                    for wc in c_start..c_end {
                        let val = intensity[[wr, wc]];
                        if val.is_finite() && val > 0.0 {
                            sum += val;
                            sum_sq += val * val;
                            count += 1.0;
                        }
                    }
                }

                if count <= 1.0 {
                    row_out[c] = center_val;
                    continue;
                }

                let local_mean = sum / count;
                let local_var = ((sum_sq / count) - local_mean.powi(2)).max(0.0);

                // Lee weighting factor: W = 1 - (noise_var / local_var)
                // W ∈ [0, 1]. When local_var >> noise_var, W → 1 (preserve).
                // When local_var ≈ noise_var, W → 0 (smooth to mean).
                let w = if local_var > noise_var {
                    1.0 - (noise_var / local_var)
                } else {
                    0.0
                };

                row_out[c] = local_mean + w * (center_val - local_mean);
            }
        });

    filtered
}

/// CLAHE: Contrast Limited Adaptive Histogram Equalization
///
/// Divides the image into `grid_x × grid_y` tiles. For each tile, computes
/// a local histogram, clips it at `clip_limit` to prevent over-amplification
/// of noise, redistributes clipped counts evenly, and builds a CDF mapping.
/// Final pixel values are bilinearly interpolated between the four nearest
/// tile mappings to eliminate block boundary artifacts.
///
/// Reference: Zuiderveld, K. (1994) "CLAHE" in Graphics Gems IV
fn clahe(image: &Array2<u8>, grid_x: usize, grid_y: usize, clip_limit: f32) -> Array2<u8> {
    let rows = image.nrows();
    let cols = image.ncols();
    let tile_h = rows / grid_y;
    let tile_w = cols / grid_x;

    if tile_h == 0 || tile_w == 0 {
        return image.clone();
    }

    // Build per-tile CDF lookup tables
    let mut mappings: Vec<Vec<[u8; 256]>> = Vec::with_capacity(grid_y);

    for ty in 0..grid_y {
        let mut row_maps = Vec::with_capacity(grid_x);
        for tx in 0..grid_x {
            let r_start = ty * tile_h;
            let c_start = tx * tile_w;
            let r_end = if ty == grid_y - 1 { rows } else { r_start + tile_h };
            let c_end = if tx == grid_x - 1 { cols } else { c_start + tile_w };

            // 1. Build histogram
            let mut hist = [0u32; 256];
            let mut pixel_count = 0u32;
            for r in r_start..r_end {
                for c in c_start..c_end {
                    hist[image[[r, c]] as usize] += 1;
                    pixel_count += 1;
                }
            }

            // 2. Clip histogram
            let actual_clip = (clip_limit * pixel_count as f32 / 256.0) as u32;
            let actual_clip = actual_clip.max(1);
            let mut excess = 0u32;
            for h in hist.iter_mut() {
                if *h > actual_clip {
                    excess += *h - actual_clip;
                    *h = actual_clip;
                }
            }
            // Redistribute excess evenly
            let per_bin = excess / 256;
            let remainder = (excess % 256) as usize;
            for (i, h) in hist.iter_mut().enumerate() {
                *h += per_bin;
                if i < remainder {
                    *h += 1;
                }
            }

            // 3. Build CDF → mapping
            let mut cdf = [0u32; 256];
            cdf[0] = hist[0];
            for i in 1..256 {
                cdf[i] = cdf[i - 1] + hist[i];
            }
            let cdf_min = *cdf.iter().find(|&&v| v > 0).unwrap_or(&0);
            let denom = (pixel_count - cdf_min).max(1) as f32;

            let mut mapping = [0u8; 256];
            for i in 0..256 {
                mapping[i] = (((cdf[i] - cdf_min) as f32 / denom) * 255.0).clamp(0.0, 255.0) as u8;
            }

            row_maps.push(mapping);
        }
        mappings.push(row_maps);
    }

    // Bilinear interpolation between tile mappings
    let mut output = Array2::zeros((rows, cols));
    output.axis_iter_mut(ndarray::Axis(0))
        .into_par_iter()
        .enumerate()
        .for_each(|(r, mut row_out)| {
            for c in 0..cols {
                // Find the four surrounding tile centers
                let ty_f = (r as f32 / tile_h as f32) - 0.5;
                let tx_f = (c as f32 / tile_w as f32) - 0.5;

                let ty0 = (ty_f.floor() as isize).max(0) as usize;
                let tx0 = (tx_f.floor() as isize).max(0) as usize;
                let ty1 = (ty0 + 1).min(grid_y - 1);
                let tx1 = (tx0 + 1).min(grid_x - 1);

                let fy = (ty_f - ty0 as f32).clamp(0.0, 1.0);
                let fx = (tx_f - tx0 as f32).clamp(0.0, 1.0);

                let val = image[[r, c]] as usize;

                let top_left = mappings[ty0][tx0][val] as f32;
                let top_right = mappings[ty0][tx1][val] as f32;
                let bot_left = mappings[ty1][tx0][val] as f32;
                let bot_right = mappings[ty1][tx1][val] as f32;

                let top = top_left * (1.0 - fx) + top_right * fx;
                let bot = bot_left * (1.0 - fx) + bot_right * fx;
                let result = top * (1.0 - fy) + bot * fy;

                row_out[c] = result.clamp(0.0, 255.0) as u8;
            }
        });

    output
}

/// Generate XYZ slippy map tiles for deep zooming
pub fn generate_xyz_tiles(
    complex_image: ArrayView2<num_complex::Complex32>,
    output_dir: &str,
    _max_native_zoom: u32,
) -> Result<()> {
    let raw_rows = complex_image.nrows();
    let raw_cols = complex_image.ncols();
    
    info!("Starting Phase 6 XYZ Tile Generation ({}x{} Native Array)", raw_rows, raw_cols);
    fs::create_dir_all(output_dir)?;

    // 1. Calculate base intensity array using Rayon for heavy math
    let mut native_intensity = Array2::zeros((raw_rows, raw_cols));
    native_intensity.axis_iter_mut(ndarray::Axis(0))
        .into_par_iter()
        .enumerate()
        .for_each(|(r, mut row_view)| {
            for c in 0..raw_cols {
                let pixel = complex_image[[r, c]];
                if pixel.re.is_finite() && pixel.im.is_finite() {
                    row_view[c] = pixel.re.powi(2) + pixel.im.powi(2);
                }
            }
        });

    // 2. Apply dual speckle filtering: Lee (statistical) → Frost (edge-preserving)
    info!("Applying Lee Sigma Speckle Filter (7×7 window)...");
    let lee_filtered = lee_filter(&native_intensity, 7);
    info!("Applying Frost Edge-Preserving Speckle Filter (5×5 window)...");
    let smoothed_intensity = frost_filter(&lee_filtered, 5, 2.0);

    // 3. Log stretch & convert entire native array to 8-bit
    info!("Mapping dynamic range into 8-bit visual bands...");
    let mut finite_vals: Vec<f32> = smoothed_intensity.iter().filter(|&&v| v > 0.0 && v.is_finite()).map(|&v| (v + 1e-10).log10()).collect();
    if finite_vals.is_empty() { return Ok(()); }
    
    finite_vals.par_sort_unstable_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
    let len = finite_vals.len();
    let p2 = finite_vals[((len as f32 * 0.02) as usize).min(len.saturating_sub(1))];
    let p98 = finite_vals[((len as f32 * 0.98) as usize).min(len.saturating_sub(1))];
    let stretch_range = (p98 - p2).max(1e-6);
    
    let mut native_pixels = Array2::<u8>::zeros((raw_rows, raw_cols));
    native_pixels.axis_iter_mut(ndarray::Axis(0))
        .into_par_iter()
        .enumerate()
        .for_each(|(r, mut row_view)| {
            for c in 0..raw_cols {
                let v = smoothed_intensity[[r, c]];
                if v > 0.0 && v.is_finite() {
                    let log_v = (v + 1e-10).log10();
                    let normalized = ((log_v - p2) / stretch_range).clamp(0.0, 1.0);
                    let gamma_corrected = normalized.powf(0.5);
                    row_view[c] = (gamma_corrected * 255.0) as u8;
                }
            }
        });

    // 4. Apply CLAHE for local contrast enhancement (8×8 tile grid, clip=3.0)
    info!("Applying CLAHE (8×8 grid, clip=3.0) for local contrast enhancement...");
    let native_pixels = clahe(&native_pixels, 8, 8, 3.0);

    // 5. XYZ Tile Pyramid Generation
    let tile_size = 256;
    let min_zoom = 0;
    
    // Z0 is the highest zoom where 1 tile = 1 array. Meaning the image length must match 256 * 2^z.
    let dimension = raw_rows.max(raw_cols);
    let mut optimal_z = 0;
    while (tile_size << optimal_z) < dimension {
        optimal_z += 1;
    }
    let system_max_z = optimal_z;
    
    info!("SAR dimensions require an XYZ local pyramid of depth Z={}", system_max_z);

    // Generate down sampled tiles iteratively
    for z in min_zoom..=system_max_z {
        let zoom_dim = tile_size << z;
        let scale = dimension as f32 / zoom_dim as f32;
        let tiles_1d = 1 << z;
        
        fs::create_dir_all(format!("{}/{}", output_dir, z))?;

        (0..tiles_1d).into_par_iter().for_each(|tx| {
            let z_x_dir = format!("{}/{}/{}", output_dir, z, tx);
            fs::create_dir_all(&z_x_dir).ok();

            for ty in 0..tiles_1d {
                let mut img: ImageBuffer<Rgb<u8>, Vec<u8>> = ImageBuffer::new(tile_size as u32, tile_size as u32);
                let mut has_data = false;

                for py in 0..tile_size {
                    for px in 0..tile_size {
                        let global_x = (tx * tile_size + px) as f32 * scale;
                        let global_y = (ty * tile_size + py) as f32 * scale;

                        if global_x < raw_cols as f32 && global_y < raw_rows as f32 {
                            let val = native_pixels[[global_y as usize, global_x as usize]];
                            if val > 0 {
                                has_data = true;
                            }
                            img.put_pixel(px as u32, py as u32, Rgb([val, val, val]));
                        } else {
                            img.put_pixel(px as u32, py as u32, Rgb([0, 0, 0])); // Transparent/Black void
                        }
                    }
                }

                if has_data {
                    let tile_path = format!("{}/{}.png", z_x_dir, ty);
                    img.save(&tile_path).ok();
                }
            }
        });
        info!("Generated zoom tier Z={}", z);
    }
    
    info!("Successfully exported deep-zoom spatial pyramids at {}", output_dir);
    Ok(())
}

/// Legacy: save a pre-computed anomaly/amplitude map as PNG (simple min-max stretch)
pub fn save_anomaly_map_as_png(anomaly_map: ArrayView2<f32>, output_filename: &str) -> Result<()> {
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
