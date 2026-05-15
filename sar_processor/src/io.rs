use crate::errors::Result;
use image::{ImageBuffer, Rgb};
use log::info;
use ndarray::{Array2, ArrayView2};
use rayon::prelude::*;
use std::fs;

const GAMMA: f32 = 0.5;

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
    let pixels: Vec<u8> = log_intensity
        .iter()
        .map(|&v| {
            if !v.is_finite() {
                return 0u8; // NaN/Inf → black
            }
            let normalized = ((v - p2) / stretch_range).clamp(0.0, 1.0);
            let gamma_corrected = normalized.powf(GAMMA);
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

    // 2. Apply dual speckle filtering
    let smoothed_intensity = apply_speckle_filter_chain(&native_intensity);

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
                    let gamma_corrected = normalized.powf(GAMMA);
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

/// Applies the dual speckle filter chain: Lee Sigma (7x7) -> Frost (5x5, damp=2.0)
pub fn apply_speckle_filter_chain(intensity: &Array2<f32>) -> Array2<f32> {
    info!("Applying Lee Sigma Speckle Filter (7×7 window)...");
    let lee_filtered = lee_filter(intensity, 7);
    info!("Applying Frost Edge-Preserving Speckle Filter (5×5 window)...");
    frost_filter(&lee_filtered, 5, 2.0)
}

// ═══════════════════════════════════════════════════════════════════════════
// GeoTIFF Writer — Cloud Optimized GeoTIFF with EPSG:4326
// ═══════════════════════════════════════════════════════════════════════════

/// Save an f32 intensity array as a tiled GeoTIFF with geographic metadata.
///
/// Writes a 256×256 internally-tiled TIFF with three GeoTIFF tags injected
/// directly into the IFD (no GDAL, no Python, no new crate dependencies):
///
///   - **ModelTiepointTag (33922):** Maps pixel (0,0) → (west, north)
///   - **ModelPixelScaleTag (33550):** Pixel dimensions in degrees
///   - **GeoKeyDirectoryTag (34735):** Declares Geographic CRS = EPSG:4326
///
/// The f32 input is normalized to u8 using 2nd–98th percentile log-stretch
/// with gamma correction (γ = 0.6), matching the existing SAR display pipeline.
///
/// # Arguments
/// * `intensity` - 2D f32 array (rows × cols) of SAR intensity values
/// * `output_filename` - Path for the output `.tif` file
/// * `bbox` - Geographic bounding box as `[west, south, east, north]` in degrees
pub fn save_sar_geotiff(
    intensity: ArrayView2<f32>,
    output_filename: &str,
    bbox: [f64; 4], // [west, south, east, north]
) -> Result<()> {
    use std::io::Write;

    let rows = intensity.nrows() as u32;
    let cols = intensity.ncols() as u32;
    let [west, south, east, north] = bbox;

    info!(
        "Writing GeoTIFF: {}×{} → {} [EPSG:4326 bbox: {:.4},{:.4},{:.4},{:.4}]",
        cols, rows, output_filename, west, south, east, north
    );

    // ── 1. Normalize f32 → u8 (log + percentile stretch + gamma) ─────────
    let mut finite_vals: Vec<f32> = intensity
        .iter()
        .filter(|&&v| v.is_finite() && v > 0.0)
        .map(|&v| (v + 1e-10).log10())
        .collect();

    if finite_vals.is_empty() {
        info!("Warning: no finite values found, writing black GeoTIFF");
        finite_vals.push(0.0);
        finite_vals.push(1.0);
    }

    finite_vals.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
    let n = finite_vals.len();
    let p2 = finite_vals[((n as f64 * 0.02) as usize).min(n.saturating_sub(1))];
    let p98 = finite_vals[((n as f64 * 0.98) as usize).min(n.saturating_sub(1))];
    let stretch = (p98 - p2).max(1e-6);

    let pixels: Vec<u8> = intensity
        .iter()
        .map(|&v| {
            if !v.is_finite() || v <= 0.0 {
                return 0u8;
            }
            let log_v = (v + 1e-10).log10();
            let norm = ((log_v - p2) / stretch).clamp(0.0, 1.0);
            (norm.powf(GAMMA) * 255.0) as u8
        })
        .collect();

    // ── 2. Tile geometry ─────────────────────────────────────────────────
    let tile_size: u32 = 256;
    let tiles_x = cols.div_ceil(tile_size);
    let tiles_y = rows.div_ceil(tile_size);
    let n_tiles = (tiles_x * tiles_y) as usize;
    let tile_bytes = (tile_size * tile_size) as usize; // 65536 bytes per tile

    info!(
        "Tile grid: {}×{} ({} tiles, {} bytes each, uncompressed)",
        tiles_x, tiles_y, n_tiles, tile_bytes
    );

    // ── 3. Build tile data (zero-padded at edges) ────────────────────────
    let mut tile_data: Vec<u8> = vec![0u8; n_tiles * tile_bytes];

    for ty in 0..tiles_y {
        for tx in 0..tiles_x {
            let tile_idx = (ty * tiles_x + tx) as usize;
            let tile_start = tile_idx * tile_bytes;

            for py in 0..tile_size {
                let img_y = ty * tile_size + py;
                if img_y >= rows {
                    break;
                }
                for px in 0..tile_size {
                    let img_x = tx * tile_size + px;
                    if img_x >= cols {
                        continue;
                    }
                    let src = (img_y * cols + img_x) as usize;
                    let dst = (py * tile_size + px) as usize;
                    tile_data[tile_start + dst] = pixels[src];
                }
            }
        }
    }

    // ── 4. Compute TIFF layout offsets ───────────────────────────────────
    //
    // Layout: [Header 8B] [Tile data] [IFD] [Overflow values]
    //
    let header_size: u32 = 8;
    let tile_data_total = (n_tiles * tile_bytes) as u32;
    let ifd_offset = header_size + tile_data_total;

    let num_ifd_entries: u16 = 13;
    // IFD = 2 (count) + entries*12 + 4 (next IFD pointer)
    let ifd_size = 2 + (num_ifd_entries as u32 * 12) + 4;
    let overflow_base = ifd_offset + ifd_size;

    // Overflow area layout (sequential):
    let off_tile_offsets = overflow_base;
    let off_tile_bytecounts = off_tile_offsets + (n_tiles as u32 * 4);
    let off_transform = off_tile_bytecounts + (n_tiles as u32 * 4);
    let off_geokeys = off_transform + 128; // 16 × f64 = 128 bytes
    // geokeys: 16 × u16 = 32 bytes

    // Pre-compute per-tile offsets within the file
    let tile_offsets: Vec<u32> = (0..n_tiles)
        .map(|i| header_size + (i as u32 * tile_bytes as u32))
        .collect();

    // ── 5. Assemble the raw TIFF bytes ───────────────────────────────────
    let total_file_size = (off_geokeys + 32) as usize;
    let mut buf: Vec<u8> = Vec::with_capacity(total_file_size);

    // ─── TIFF Header ─────────────────────────────────────────────────────
    buf.extend_from_slice(b"II");                       // Byte order: little-endian
    buf.extend_from_slice(&42u16.to_le_bytes());        // TIFF magic number
    buf.extend_from_slice(&ifd_offset.to_le_bytes());   // Offset to first IFD

    // ─── Tile Data ───────────────────────────────────────────────────────
    buf.extend_from_slice(&tile_data);

    // ─── IFD (Image File Directory) ──────────────────────────────────────
    // TIFF spec requires entries sorted by tag number.
    buf.extend_from_slice(&num_ifd_entries.to_le_bytes());

    //  Tag   | Type   | Count | Value/Offset
    // -------|--------|-------|------------------
    geotiff_ifd_short(&mut buf, 256, 1, cols as u16);       // ImageWidth (as SHORT if ≤65535)
    geotiff_ifd_short(&mut buf, 257, 1, rows as u16);       // ImageLength
    geotiff_ifd_short(&mut buf, 258, 1, 8);                 // BitsPerSample = 8
    geotiff_ifd_short(&mut buf, 259, 1, 1);                 // Compression = None
    geotiff_ifd_short(&mut buf, 262, 1, 1);                 // PhotometricInterpretation = MinIsBlack
    geotiff_ifd_short(&mut buf, 277, 1, 1);                 // SamplesPerPixel = 1
    geotiff_ifd_short(&mut buf, 322, 1, tile_size as u16);  // TileWidth = 256
    geotiff_ifd_short(&mut buf, 323, 1, tile_size as u16);  // TileLength = 256
    geotiff_ifd_long_arr(&mut buf, 324, n_tiles as u32, off_tile_offsets);   // TileOffsets → overflow
    geotiff_ifd_long_arr(&mut buf, 325, n_tiles as u32, off_tile_bytecounts);// TileByteCounts → overflow
    geotiff_ifd_short(&mut buf, 339, 1, 1);                 // SampleFormat = UnsignedInteger

    // GeoTIFF tags (ascending tag order: 34264 < 34735)
    geotiff_ifd_double_arr(&mut buf, 34264, 16, off_transform); // ModelTransformationTag
    geotiff_ifd_short_arr(&mut buf, 34735, 16, off_geokeys);   // GeoKeyDirectoryTag

    buf.extend_from_slice(&0u32.to_le_bytes()); // Next IFD offset = 0 (single image)

    // ─── Overflow Data ───────────────────────────────────────────────────

    // TileOffsets array
    for &off in &tile_offsets {
        buf.extend_from_slice(&off.to_le_bytes());
    }

    // TileByteCounts array (all identical, uncompressed)
    for _ in 0..n_tiles {
        buf.extend_from_slice(&(tile_bytes as u32).to_le_bytes());
    }

    // ModelTransformationTag (34264): 4×4 affine matrix (row-major, 16 doubles)
    //
    // This replaces ModelPixelScaleTag + ModelTiepointTag with a single
    // explicit transform. The NEGATIVE scale_y is critical: TIFF row 0 is
    // the top of the image (= north), and each subsequent row moves south.
    //
    //   | scale_x    0       0    west  |
    //   | 0         -scale_y 0    north |
    //   | 0          0       0    0     |
    //   | 0          0       0    1     |
    //
    let scale_x = (east - west) / cols as f64;
    let scale_y = (north - south) / rows as f64;
    let transform: [f64; 16] = [
        scale_x,  0.0,      0.0,  west,   // row 0: X = west + col * scale_x
        0.0,     -scale_y,  0.0,  north,  // row 1: Y = north - row * scale_y  ← north-up
        0.0,      0.0,      0.0,  0.0,    // row 2: Z (unused)
        0.0,      0.0,      0.0,  1.0,    // row 3: homogeneous
    ];
    for &v in &transform {
        buf.extend_from_slice(&v.to_le_bytes());
    }

    // GeoKeyDirectoryTag (34735): EPSG:4326 declaration
    // Format: [version, revision, minor, numKeys, ...key entries...]
    let geokeys: [u16; 16] = [
        1, 1, 0, 3,       // Header: v1.1.0, 3 keys follow
        1024, 0, 1, 2,    // GTModelTypeGeoKey       = 2 (ModelTypeGeographic)
        1025, 0, 1, 1,    // GTRasterTypeGeoKey      = 1 (RasterPixelIsArea)
        2048, 0, 1, 4326, // GeographicTypeGeoKey    = 4326 (EPSG:4326 / WGS84)
    ];
    for &k in &geokeys {
        buf.extend_from_slice(&k.to_le_bytes());
    }

    // ── 6. Write to disk ─────────────────────────────────────────────────
    let mut file = std::io::BufWriter::new(fs::File::create(output_filename)?);
    file.write_all(&buf)?;
    file.flush()?;

    info!(
        "✓ GeoTIFF written: {} ({} bytes, {} tiles)",
        output_filename,
        buf.len(),
        n_tiles
    );
    Ok(())
}

// ── GeoTIFF IFD entry helpers ────────────────────────────────────────────
// Each IFD entry is exactly 12 bytes: tag(u16) + type(u16) + count(u32) + value/offset(u32)

/// Write an IFD entry for a single SHORT (type=3) value stored inline.
fn geotiff_ifd_short(buf: &mut Vec<u8>, tag: u16, count: u32, value: u16) {
    buf.extend_from_slice(&tag.to_le_bytes());
    buf.extend_from_slice(&3u16.to_le_bytes());     // type = SHORT
    buf.extend_from_slice(&count.to_le_bytes());
    buf.extend_from_slice(&value.to_le_bytes());
    buf.extend_from_slice(&0u16.to_le_bytes());     // pad to 4 bytes
}

/// Write an IFD entry for a SHORT array (type=3) stored at an overflow offset.
fn geotiff_ifd_short_arr(buf: &mut Vec<u8>, tag: u16, count: u32, offset: u32) {
    buf.extend_from_slice(&tag.to_le_bytes());
    buf.extend_from_slice(&3u16.to_le_bytes());     // type = SHORT
    buf.extend_from_slice(&count.to_le_bytes());
    buf.extend_from_slice(&offset.to_le_bytes());
}

/// Write an IFD entry for a LONG array (type=4) stored at an overflow offset.
fn geotiff_ifd_long_arr(buf: &mut Vec<u8>, tag: u16, count: u32, offset: u32) {
    buf.extend_from_slice(&tag.to_le_bytes());
    buf.extend_from_slice(&4u16.to_le_bytes());     // type = LONG
    buf.extend_from_slice(&count.to_le_bytes());
    buf.extend_from_slice(&offset.to_le_bytes());
}

/// Write an IFD entry for a DOUBLE array (type=12) stored at an overflow offset.
fn geotiff_ifd_double_arr(buf: &mut Vec<u8>, tag: u16, count: u32, offset: u32) {
    buf.extend_from_slice(&tag.to_le_bytes());
    buf.extend_from_slice(&12u16.to_le_bytes());    // type = DOUBLE
    buf.extend_from_slice(&count.to_le_bytes());
    buf.extend_from_slice(&offset.to_le_bytes());
}

/// Write an IFD entry for a SHORT array of length 2 (type=3) stored inline.
fn geotiff_ifd_short2(buf: &mut Vec<u8>, tag: u16, val1: u16, val2: u16) {
    buf.extend_from_slice(&tag.to_le_bytes());
    buf.extend_from_slice(&3u16.to_le_bytes());     // type = SHORT
    buf.extend_from_slice(&2u32.to_le_bytes());     // count = 2
    buf.extend_from_slice(&val1.to_le_bytes());
    buf.extend_from_slice(&val2.to_le_bytes());
}

/// Save an f32 array as a single-band GeoTIFF with optional georeference.
pub fn save_geotiff_f32(
    data: ArrayView2<f32>,
    output_filename: &str,
    bbox: Option<[f64; 4]>,
) -> Result<()> {
    use std::io::Write;

    let rows = data.nrows() as u32;
    let cols = data.ncols() as u32;

    let tile_size: u32 = 256;
    let tiles_x = cols.div_ceil(tile_size);
    let tiles_y = rows.div_ceil(tile_size);
    let n_tiles = (tiles_x * tiles_y) as usize;
    let tile_bytes = (tile_size * tile_size * 4) as usize; // 4 bytes per f32

    let mut tile_data: Vec<u8> = vec![0u8; n_tiles * tile_bytes];

    for ty in 0..tiles_y {
        for tx in 0..tiles_x {
            let tile_idx = (ty * tiles_x + tx) as usize;
            let tile_start = tile_idx * tile_bytes;

            for py in 0..tile_size {
                let img_y = ty * tile_size + py;
                if img_y >= rows {
                    break;
                }
                for px in 0..tile_size {
                    let img_x = tx * tile_size + px;
                    if img_x >= cols {
                        continue;
                    }
                    let val = data[[(img_y) as usize, (img_x) as usize]];
                    let dst = ((py * tile_size + px) * 4) as usize;
                    let bytes = val.to_le_bytes();
                    tile_data[tile_start + dst] = bytes[0];
                    tile_data[tile_start + dst + 1] = bytes[1];
                    tile_data[tile_start + dst + 2] = bytes[2];
                    tile_data[tile_start + dst + 3] = bytes[3];
                }
            }
        }
    }

    let header_size: u32 = 8;
    let tile_data_total = (n_tiles * tile_bytes) as u32;
    let ifd_offset = header_size + tile_data_total;

    let num_ifd_entries: u16 = if bbox.is_some() { 13 } else { 11 };
    let ifd_size = 2 + (num_ifd_entries as u32 * 12) + 4;
    let overflow_base = ifd_offset + ifd_size;

    let off_tile_offsets = overflow_base;
    let off_tile_bytecounts = off_tile_offsets + (n_tiles as u32 * 4);
    let mut off_transform = 0;
    let mut off_geokeys = 0;
    
    let mut total_file_size = (off_tile_bytecounts + (n_tiles as u32 * 4)) as usize;
    if bbox.is_some() {
        off_transform = total_file_size as u32;
        off_geokeys = off_transform + 128;
        total_file_size = (off_geokeys + 32) as usize;
    }

    let tile_offsets: Vec<u32> = (0..n_tiles)
        .map(|i| header_size + (i as u32 * tile_bytes as u32))
        .collect();

    let mut buf: Vec<u8> = Vec::with_capacity(total_file_size);
    buf.extend_from_slice(b"II");
    buf.extend_from_slice(&42u16.to_le_bytes());
    buf.extend_from_slice(&ifd_offset.to_le_bytes());
    buf.extend_from_slice(&tile_data);

    buf.extend_from_slice(&num_ifd_entries.to_le_bytes());
    geotiff_ifd_short(&mut buf, 256, 1, cols as u16);
    geotiff_ifd_short(&mut buf, 257, 1, rows as u16);
    geotiff_ifd_short(&mut buf, 258, 1, 32);                 // BitsPerSample = 32
    geotiff_ifd_short(&mut buf, 259, 1, 1);                  // Compression = None
    geotiff_ifd_short(&mut buf, 262, 1, 1);                  // PhotometricInterpretation = MinIsBlack
    geotiff_ifd_short(&mut buf, 277, 1, 1);                  // SamplesPerPixel = 1
    geotiff_ifd_short(&mut buf, 322, 1, tile_size as u16);
    geotiff_ifd_short(&mut buf, 323, 1, tile_size as u16);
    geotiff_ifd_long_arr(&mut buf, 324, n_tiles as u32, off_tile_offsets);
    geotiff_ifd_long_arr(&mut buf, 325, n_tiles as u32, off_tile_bytecounts);
    geotiff_ifd_short(&mut buf, 339, 1, 3);                  // SampleFormat = 3 (FLOAT)

    if bbox.is_some() {
        geotiff_ifd_double_arr(&mut buf, 34264, 16, off_transform);
        geotiff_ifd_short_arr(&mut buf, 34735, 16, off_geokeys);
    }

    buf.extend_from_slice(&0u32.to_le_bytes());

    for &off in &tile_offsets {
        buf.extend_from_slice(&off.to_le_bytes());
    }
    for _ in 0..n_tiles {
        buf.extend_from_slice(&(tile_bytes as u32).to_le_bytes());
    }

    if let Some([west, south, east, north]) = bbox {
        let scale_x = (east - west) / cols as f64;
        let scale_y = (north - south) / rows as f64;
        let transform: [f64; 16] = [
            scale_x,  0.0,      0.0,  west,
            0.0,     -scale_y,  0.0,  north,
            0.0,      0.0,      0.0,  0.0,
            0.0,      0.0,      0.0,  1.0,
        ];
        for &v in &transform {
            buf.extend_from_slice(&v.to_le_bytes());
        }

        let geokeys: [u16; 16] = [
            1, 1, 0, 3,
            1024, 0, 1, 2,
            1025, 0, 1, 1,
            2048, 0, 1, 4326,
        ];
        for &k in &geokeys {
            buf.extend_from_slice(&k.to_le_bytes());
        }
    }

    let mut file = std::io::BufWriter::new(fs::File::create(output_filename)?);
    file.write_all(&buf)?;
    file.flush()?;

    Ok(())
}

/// Save a Complex32 array as a two-band GeoTIFF with optional georeference.
pub fn save_geotiff_complex(
    data: ArrayView2<num_complex::Complex32>,
    output_filename: &str,
    bbox: Option<[f64; 4]>,
) -> Result<()> {
    use std::io::Write;

    let rows = data.nrows() as u32;
    let cols = data.ncols() as u32;

    let tile_size: u32 = 256;
    let tiles_x = cols.div_ceil(tile_size);
    let tiles_y = rows.div_ceil(tile_size);
    let n_tiles = (tiles_x * tiles_y) as usize;
    let tile_bytes = (tile_size * tile_size * 8) as usize; // 8 bytes per Complex32

    let mut tile_data: Vec<u8> = vec![0u8; n_tiles * tile_bytes];

    for ty in 0..tiles_y {
        for tx in 0..tiles_x {
            let tile_idx = (ty * tiles_x + tx) as usize;
            let tile_start = tile_idx * tile_bytes;

            for py in 0..tile_size {
                let img_y = ty * tile_size + py;
                if img_y >= rows {
                    break;
                }
                for px in 0..tile_size {
                    let img_x = tx * tile_size + px;
                    if img_x >= cols {
                        continue;
                    }
                    let val = data[[(img_y) as usize, (img_x) as usize]];
                    let dst = ((py * tile_size + px) * 8) as usize;
                    let bytes_re = val.re.to_le_bytes();
                    let bytes_im = val.im.to_le_bytes();
                    tile_data[tile_start + dst] = bytes_re[0];
                    tile_data[tile_start + dst + 1] = bytes_re[1];
                    tile_data[tile_start + dst + 2] = bytes_re[2];
                    tile_data[tile_start + dst + 3] = bytes_re[3];
                    tile_data[tile_start + dst + 4] = bytes_im[0];
                    tile_data[tile_start + dst + 5] = bytes_im[1];
                    tile_data[tile_start + dst + 6] = bytes_im[2];
                    tile_data[tile_start + dst + 7] = bytes_im[3];
                }
            }
        }
    }

    let header_size: u32 = 8;
    let tile_data_total = (n_tiles * tile_bytes) as u32;
    let ifd_offset = header_size + tile_data_total;

    let num_ifd_entries: u16 = if bbox.is_some() { 13 } else { 11 };
    let ifd_size = 2 + (num_ifd_entries as u32 * 12) + 4;
    let overflow_base = ifd_offset + ifd_size;

    let off_tile_offsets = overflow_base;
    let off_tile_bytecounts = off_tile_offsets + (n_tiles as u32 * 4);
    let mut off_transform = 0;
    let mut off_geokeys = 0;
    
    let mut total_file_size = (off_tile_bytecounts + (n_tiles as u32 * 4)) as usize;
    if bbox.is_some() {
        off_transform = total_file_size as u32;
        off_geokeys = off_transform + 128;
        total_file_size = (off_geokeys + 32) as usize;
    }

    let tile_offsets: Vec<u32> = (0..n_tiles)
        .map(|i| header_size + (i as u32 * tile_bytes as u32))
        .collect();

    let mut buf: Vec<u8> = Vec::with_capacity(total_file_size);
    buf.extend_from_slice(b"II");
    buf.extend_from_slice(&42u16.to_le_bytes());
    buf.extend_from_slice(&ifd_offset.to_le_bytes());
    buf.extend_from_slice(&tile_data);

    buf.extend_from_slice(&num_ifd_entries.to_le_bytes());
    geotiff_ifd_short(&mut buf, 256, 1, cols as u16);
    geotiff_ifd_short(&mut buf, 257, 1, rows as u16);
    geotiff_ifd_short2(&mut buf, 258, 32, 32);               // BitsPerSample = [32, 32]
    geotiff_ifd_short(&mut buf, 259, 1, 1);                  // Compression = None
    geotiff_ifd_short(&mut buf, 262, 1, 1);                  // PhotometricInterpretation = MinIsBlack
    geotiff_ifd_short(&mut buf, 277, 1, 2);                  // SamplesPerPixel = 2
    geotiff_ifd_short(&mut buf, 322, 1, tile_size as u16);
    geotiff_ifd_short(&mut buf, 323, 1, tile_size as u16);
    geotiff_ifd_long_arr(&mut buf, 324, n_tiles as u32, off_tile_offsets);
    geotiff_ifd_long_arr(&mut buf, 325, n_tiles as u32, off_tile_bytecounts);
    geotiff_ifd_short2(&mut buf, 339, 3, 3);                 // SampleFormat = [3, 3] (FLOAT, FLOAT)

    if bbox.is_some() {
        geotiff_ifd_double_arr(&mut buf, 34264, 16, off_transform);
        geotiff_ifd_short_arr(&mut buf, 34735, 16, off_geokeys);
    }

    buf.extend_from_slice(&0u32.to_le_bytes());

    for &off in &tile_offsets {
        buf.extend_from_slice(&off.to_le_bytes());
    }
    for _ in 0..n_tiles {
        buf.extend_from_slice(&(tile_bytes as u32).to_le_bytes());
    }

    if let Some([west, south, east, north]) = bbox {
        let scale_x = (east - west) / cols as f64;
        let scale_y = (north - south) / rows as f64;
        let transform: [f64; 16] = [
            scale_x,  0.0,      0.0,  west,
            0.0,     -scale_y,  0.0,  north,
            0.0,      0.0,      0.0,  0.0,
            0.0,      0.0,      0.0,  1.0,
        ];
        for &v in &transform {
            buf.extend_from_slice(&v.to_le_bytes());
        }

        let geokeys: [u16; 16] = [
            1, 1, 0, 3,
            1024, 0, 1, 2,
            1025, 0, 1, 1,
            2048, 0, 1, 4326,
        ];
        for &k in &geokeys {
            buf.extend_from_slice(&k.to_le_bytes());
        }
    }

    let mut file = std::io::BufWriter::new(fs::File::create(output_filename)?);
    file.write_all(&buf)?;
    file.flush()?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use ndarray::Array2;
    use num_complex::Complex32;

    #[test]
    fn test_save_geotiff_f32() {
        let rows = 16;
        let cols = 16;
        let data = Array2::from_elem((rows, cols), std::f32::consts::PI);
        let path = "/tmp/test_f32.tif";
        let res = save_geotiff_f32(data.view(), path, None);
        assert!(res.is_ok());
        
        // Verify TIFF magic bytes
        let bytes = fs::read(path).unwrap();
        assert_eq!(&bytes[0..4], b"II\x2A\x00");
    }

    #[test]
    fn test_save_geotiff_complex() {
        let rows = 16;
        let cols = 16;
        let data = Array2::from_elem((rows, cols), Complex32::new(1.0, 2.0));
        let path = "/tmp/test_complex.tif";
        let res = save_geotiff_complex(data.view(), path, Some([0.0, 0.0, 1.0, 1.0]));
        assert!(res.is_ok());
        
        let bytes = fs::read(path).unwrap();
        assert_eq!(&bytes[0..4], b"II\x2A\x00");
    }
}

