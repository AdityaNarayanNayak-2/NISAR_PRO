//! Sentinel-1 (C-band) backscatter from radiometrically terrain-corrected GeoTIFFs.
//!
//! Reads single-band float32 GeoTIFFs of linear backscatter power on a UTM grid: Sentinel-1 RTC
//! from Microsoft Planetary Computer (`sentinel-1-rtc`, gamma0, 10 m) or OPERA RTC-S1 from ASF
//! (30 m). Tiled or striped, Deflate/LZW, floating-point predictor (Cloud-Optimized GeoTIFFs).
//!
//! A pair is read on one common window: the overlap of both files (full scene) or a box around a
//! centre (crop), snapped to the shared pixel lattice, so the two arrays line up pixel for pixel.
//! Tiles are decoded one at a time and block-averaged on the fly (full scene: 8 × 8 looks,
//! 10 m -> 80 m like the NISAR full-scene path), so a 2.4 GB scene never sits in memory.
//! Pixels that are NaN, nodata or not positive are left out of the averages.
use crate::nisar_parser::{latlon_to_utm, utm_to_latlon, GeoBoundingBox, NisarProduct, NisarProductType, NisarRadarParams};
use anyhow::{bail, Context, Result};
use log::info;
use ndarray::Array2;
use num_complex::Complex32;
use std::fs::File;
use std::io::BufReader;
use std::path::Path;
use rayon::prelude::*;
use tiff::decoder::{ChunkType, Decoder, DecodingResult, Limits};
use tiff::tags::Tag;

/// Sentinel-1 C-band centre frequency (Hz), 5.405 GHz.
pub const S1_CENTER_FREQUENCY_HZ: f64 = 5.405e9;

/// True for files this module reads (GeoTIFF by extension).
pub fn is_geotiff(path: &Path) -> bool {
    path.extension().and_then(|e| e.to_str()).is_some_and(|e| e.eq_ignore_ascii_case("tif") || e.eq_ignore_ascii_case("tiff"))
}

/// Polarization from the file name (`..._VV.tif`, `...-vv.rtc.tiff`, OPERA `_VH.tif`).
pub fn polarization_from_name(path: &Path) -> Option<String> {
    let name = path.file_name()?.to_str()?.to_uppercase();
    ["VV", "VH", "HH", "HV"].iter().find(|p| {
        name.contains(&format!("_{p}.")) || name.contains(&format!("-{p}.")) || name.contains(&format!("_{p}_"))
    }).map(|p| p.to_string())
}

/// Grid of one GeoTIFF: size, UTM origin (upper-left corner) and pixel size.
#[derive(Debug, Clone, PartialEq)]
pub struct Grid {
    pub width: usize,
    pub height: usize,
    pub epsg: u16,
    pub x0: f64,
    pub y0: f64,
    pub dx: f64,
    pub dy: f64,
    pub nodata: Option<f32>,
}

impl Grid {
    fn zone(&self) -> Result<(i32, bool)> {
        match self.epsg {
            32601..=32660 => Ok(((self.epsg - 32600) as i32, true)),
            32701..=32760 => Ok(((self.epsg - 32700) as i32, false)),
            e => bail!("EPSG:{e} is not a UTM zone; only UTM GeoTIFFs are supported"),
        }
    }
}

fn open(path: &Path) -> Result<Decoder<BufReader<File>>> {
    let f = File::open(path).with_context(|| format!("Cannot open {}", path.display()))?;
    Ok(Decoder::new(BufReader::new(f))?.with_limits(Limits::unlimited()))
}

/// Read the grid of a GeoTIFF (ModelPixelScale, ModelTiepoint, GeoKeyDirectory, GDAL nodata).
pub fn read_grid(path: &Path) -> Result<Grid> {
    let mut d = open(path)?;
    let (w, h) = d.dimensions()?;
    let scale = d.get_tag_f64_vec(Tag::ModelPixelScaleTag).context("GeoTIFF has no ModelPixelScale tag")?;
    let tie = d.get_tag_f64_vec(Tag::ModelTiepointTag).context("GeoTIFF has no ModelTiepoint tag")?;
    let keys = d.get_tag_u16_vec(Tag::GeoKeyDirectoryTag).context("GeoTIFF has no GeoKeyDirectory")?;
    // GeoKeyDirectory: header of 4, then (key, location, count, value) entries.
    let epsg = keys.chunks(4).skip(1).find(|k| k.len() == 4 && k[0] == 3072).map(|k| k[3])
        .context("GeoTIFF has no ProjectedCSTypeGeoKey (3072)")?;
    let nodata = d.get_tag_ascii_string(Tag::GdalNodata).ok().and_then(|s| s.trim_matches(char::from(0)).trim().parse::<f32>().ok());
    if scale.len() < 2 || tie.len() < 6 {
        bail!("GeoTIFF georeferencing tags are incomplete");
    }
    // Tiepoint (i, j, k, x, y, z): raster (i, j) sits at map (x, y).
    let (dx, dy) = (scale[0], scale[1]);
    Ok(Grid { width: w as usize, height: h as usize, epsg, x0: tie[3] - tie[0] * dx, y0: tie[4] + tie[1] * dy, dx, dy, nodata })
}

/// Window of one file in its own pixels.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Window {
    pub row: usize,
    pub col: usize,
    pub rows: usize,
    pub cols: usize,
}

/// Read `win` of `path`, averaging `look × look` blocks of valid pixels (look 1 = copy).
/// Output is `(rows / look, cols / look)`; blocks with no valid pixel are NaN.
pub fn read_window(path: &Path, grid: &Grid, win: Window, look: usize) -> Result<Array2<f32>> {
    let look = look.max(1);
    let (out_r, out_c) = (win.rows / look, win.cols / look);
    let mut sum = Array2::<f64>::zeros((out_r, out_c));
    let mut cnt = Array2::<u32>::zeros((out_r, out_c));
    let d = open(path)?;
    let (cw, ch) = d.chunk_dimensions();
    let (cw, ch) = (cw as usize, ch as usize);
    let across = match d.get_chunk_type() {
        ChunkType::Tile => grid.width.div_ceil(cw),
        ChunkType::Strip => 1,
    };
    let (r_end, c_end) = (win.row + out_r * look, win.col + out_c * look);
    let nodata = grid.nodata;
    // Decoding (deflate + float predictor) is most of the time: decode one row of tiles in
    // parallel (one decoder per thread), then add the pixels in the same order as a serial
    // read, so the sums and the output are identical.
    for ty in win.row / ch..r_end.div_ceil(ch) {
        let tiles: Vec<usize> = (win.col / cw..c_end.div_ceil(cw).min(across)).collect();
        let decoded: Vec<Result<(usize, u32, u32, Vec<f32>)>> = tiles
            .par_iter()
            .map_init(
                || open(path),
                |dec, &tx| {
                    let d = dec.as_mut().map_err(|e| anyhow::anyhow!("{e:#}"))?;
                    let idx = (ty * across + tx) as u32;
                    let (tw, th) = d.chunk_data_dimensions(idx);
                    match d.read_chunk(idx)? {
                        DecodingResult::F32(v) => Ok((tx, tw, th, v)),
                        _ => bail!("{} is not float32 backscatter", path.display()),
                    }
                },
            )
            .collect();
        for tile in decoded {
            let (tx, tw, th, data) = tile?;
            // read_chunk returns only the real data of the chunk: rows are `tw` long.
            let stride = tw as usize;
            let (gr0, gc0) = (ty * ch, tx * cw);
            for lr in 0..th as usize {
                let gr = gr0 + lr;
                if gr < win.row || gr >= r_end { continue; }
                let orow = (gr - win.row) / look;
                let row = &data[lr * stride..lr * stride + tw as usize];
                for (lc, &v) in row.iter().enumerate() {
                    let gc = gc0 + lc;
                    if gc < win.col || gc >= c_end { continue; }
                    if !v.is_finite() || v <= 0.0 || nodata.is_some_and(|n| v == n) { continue; }
                    let oc = (gc - win.col) / look;
                    sum[[orow, oc]] += v as f64;
                    cnt[[orow, oc]] += 1;
                }
            }
        }
    }
    let mut out = Array2::<f32>::from_elem((out_r, out_c), f32::NAN);
    ndarray::Zip::from(&mut out).and(&sum).and(&cnt).for_each(|o, &s, &n| if n > 0 { *o = (s / n as f64) as f32 });
    Ok(out)
}

/// Where to read: the whole overlap of the two files, or a box around a centre.
pub enum Area {
    Full { look: usize },
    Crop { lat: f64, lon: f64, half_ns_km: f64, half_ew_km: f64 },
}

fn date_from_name(path: &Path) -> Option<String> {
    let name = path.file_name()?.to_str()?;
    name.split(['_', '-']).find_map(|t| {
        let b = t.as_bytes();
        (b.len() >= 15 && b[8] == b'T' && b[..8].iter().all(u8::is_ascii_digit)).then(|| t[..8].to_string())
    })
}

/// Read the active and baseline scenes on one shared window. Both must be on the same UTM
/// zone and the same pixel lattice (true for repeat passes of one track on these products).
pub fn read_pair(active: &Path, baseline: &Path, area: Area) -> Result<(NisarProduct, NisarProduct)> {
    let ga = read_grid(active)?;
    let gb = read_grid(baseline)?;
    if ga.epsg != gb.epsg {
        bail!("The two scenes are on different UTM zones (EPSG:{} and EPSG:{}); pick passes of the same track", ga.epsg, gb.epsg);
    }
    if (ga.dx - gb.dx).abs() > 1e-6 || (ga.dy - gb.dy).abs() > 1e-6 {
        bail!("Pixel sizes differ ({} m and {} m); pick the same product type for both dates", ga.dx, gb.dx);
    }
    let (dx, dy) = (ga.dx, ga.dy);
    let off_x = (ga.x0 - gb.x0) / dx;
    let off_y = (gb.y0 - ga.y0) / dy;
    if (off_x - off_x.round()).abs() > 1e-6 || (off_y - off_y.round()).abs() > 1e-6 {
        bail!("The two scenes are not on the same pixel lattice (offset {off_x:.3} × {off_y:.3} px)");
    }
    // Overlap in map coordinates.
    let (ax1, ay1) = (ga.x0 + ga.width as f64 * dx, ga.y0 - ga.height as f64 * dy);
    let (bx1, by1) = (gb.x0 + gb.width as f64 * dx, gb.y0 - gb.height as f64 * dy);
    let (mut x0, mut x1) = (ga.x0.max(gb.x0), ax1.min(bx1));
    let (mut y1, mut y0) = (ga.y0.min(gb.y0), ay1.max(by1)); // y1 = top, y0 = bottom
    if x1 <= x0 || y1 <= y0 {
        bail!("The two scenes do not overlap");
    }
    let (zone, north) = ga.zone()?;
    let look = match area {
        Area::Full { look } => look.max(1),
        Area::Crop { lat, lon, half_ns_km, half_ew_km } => {
            let (cx, cy) = latlon_to_utm(lat, lon, zone);
            let (cx, cy) = if north { (cx, cy) } else { (cx, cy + 10_000_000.0) };
            x0 = x0.max(cx - half_ew_km * 1000.0);
            x1 = x1.min(cx + half_ew_km * 1000.0);
            y0 = y0.max(cy - half_ns_km * 1000.0);
            y1 = y1.min(cy + half_ns_km * 1000.0);
            if x1 <= x0 || y1 <= y0 {
                bail!("The area at {lat:.4}, {lon:.4} is outside the part both scenes cover");
            }
            1
        }
    };
    // Snap to the lattice of the active file, then to whole looks.
    let col = ((x0 - ga.x0) / dx).ceil() as usize;
    let row = ((ga.y0 - y1) / dy).ceil() as usize;
    let cols = (((x1 - ga.x0) / dx).floor() as usize).saturating_sub(col) / look * look;
    let rows = (((ga.y0 - y0) / dy).floor() as usize).saturating_sub(row) / look * look;
    if rows == 0 || cols == 0 {
        bail!("The common window is empty");
    }
    let wa = Window { row, col, rows, cols };
    let wb = Window { row: (row as f64 + off_y).round() as usize, col: (col as f64 + off_x).round() as usize, rows, cols };
    let ux = ga.x0 + col as f64 * dx; // upper-left corner of the window
    let uy = ga.y0 - row as f64 * dy;
    info!(
        "Sentinel-1 pair on EPSG:{}: window {}×{} px at {:.0} m ({}×{} after {}×{} looks), UL ({:.0}, {:.0})",
        ga.epsg, cols, rows, dx, cols / look, rows / look, look, look, ux, uy
    );

    // WGS84 bounds of the window from its four corners.
    let corners = [(ux, uy), (ux + cols as f64 * dx, uy), (ux, uy - rows as f64 * dy), (ux + cols as f64 * dx, uy - rows as f64 * dy)];
    let ll: Vec<(f64, f64)> = corners.iter().map(|&(x, y)| utm_to_latlon(x, y, zone, north)).collect();
    let lats: Vec<f64> = ll.iter().map(|p| p.0).collect();
    let lons: Vec<f64> = ll.iter().map(|p| p.1).collect();
    let bbox = GeoBoundingBox::from_bounds(&lats, &lons);

    let product = |path: &Path, grid: &Grid, win: Window| -> Result<NisarProduct> {
        let started = std::time::Instant::now();
        let power = read_window(path, grid, win, look)?;
        info!("  read {} in {:.1} s", path.file_name().and_then(|f| f.to_str()).unwrap_or(""), started.elapsed().as_secs_f64());
        let pol = polarization_from_name(path).unwrap_or_else(|| "VV".into());
        let (crop_origin_lat, crop_origin_lon) = match area {
            // Full scene: centre of the first native pixel in UTM metres (as the NISAR path).
            Area::Full { .. } => (Some(uy - dy / 2.0), Some(ux + dx / 2.0)),
            Area::Crop { .. } => {
                let (la, lo) = utm_to_latlon(ux + dx / 2.0, uy - dy / 2.0, zone, north);
                (Some(la), Some(lo))
            }
        };
        Ok(NisarProduct {
            slc: power.mapv(|p| Complex32::new(p, 0.0)),
            params: NisarRadarParams {
                center_frequency: S1_CENTER_FREQUENCY_HZ,
                range_bandwidth: 0.0,
                pulse_duration: 0.0,
                chirp_rate: 0.0,
                prf: 0.0,
                sample_rate: 0.0,
                instrument: "SENTINEL-1".into(),
                radar_band: "C-band".into(),
            },
            polarization: pol,
            product_type: NisarProductType::GCOV,
            bbox: bbox.clone(),
            pixel_spacing_x_m: Some(dx * look as f64),
            pixel_spacing_y_m: Some(dy * look as f64),
            crs: format!("EPSG:{}", grid.epsg),
            crop_start_row: Some(win.row),
            crop_start_col: Some(win.col),
            crop_origin_lat,
            crop_origin_lon,
        })
    };
    let a = product(active, &ga, wa)?;
    let b = product(baseline, &gb, wb)?;
    if let (Some(da), Some(db)) = (date_from_name(active), date_from_name(baseline)) {
        if da <= db {
            log::warn!("Active date {da} is not after baseline date {db}");
        }
    }
    Ok((a, b))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn polarization_and_type_from_names() {
        assert_eq!(polarization_from_name(Path::new("S1D_IW_GRDH_1SDV_20260831T001127_x_rtc_VV.tif")).as_deref(), Some("VV"));
        assert_eq!(polarization_from_name(Path::new("OPERA_L2_RTC-S1_T121-258660-IW2_20260831T001130Z_20260831T120000Z_S1D_30_v1.0_VH.tif")).as_deref(), Some("VH"));
        assert_eq!(polarization_from_name(Path::new("iw-vv.rtc.tiff")).as_deref(), Some("VV"));
        assert!(is_geotiff(Path::new("a.TIF")) && !is_geotiff(Path::new("a.h5")));
        assert_eq!(date_from_name(Path::new("S1D_IW_GRDH_1SDV_20260912T001128_20260912T001153_x_VV.tif")).as_deref(), Some("20260912"));
    }

    /// Write a small tiled float32 GeoTIFF on UTM 45N.
    fn write_tif(path: &Path, w: u32, h: u32, x0: f64, y0: f64, f: impl Fn(u32, u32) -> f32) {
        use tiff::encoder::{colortype, TiffEncoder};
        let mut enc = TiffEncoder::new(File::create(path).unwrap()).unwrap();
        let mut img = enc.new_image::<colortype::Gray32Float>(w, h).unwrap();
        img.encoder().write_tag(Tag::ModelPixelScaleTag, &[10.0f64, 10.0, 0.0][..]).unwrap();
        img.encoder().write_tag(Tag::ModelTiepointTag, &[0.0f64, 0.0, 0.0, x0, y0, 0.0][..]).unwrap();
        img.encoder().write_tag(Tag::GeoKeyDirectoryTag, &[1u16, 1, 0, 2, 1024, 0, 1, 1, 3072, 0, 1, 32645][..]).unwrap();
        let data: Vec<f32> = (0..h).flat_map(|r| (0..w).map(move |c| (r, c))).map(|(r, c)| f(r, c)).collect();
        img.write_data(&data).unwrap();
    }

    #[test]
    fn pair_shares_one_window_across_offset_grids() {
        let dir = std::env::temp_dir().join(format!("s1test-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let (a, b) = (dir.join("A_20260912T000000_VV.tif"), dir.join("B_20260831T000000_VV.tif"));
        // Same lattice, B starts 20 m east and 10 m south of A. Value = map column + 1000 × map row
        // (counted from A's corner), so any row or column misalignment shows up.
        write_tif(&a, 64, 48, 300_000.0, 2_800_000.0, |r, c| 1.0 + c as f32 + 1000.0 * r as f32);
        write_tif(&b, 64, 48, 300_020.0, 2_799_990.0, |r, c| 1.0 + (c + 2) as f32 + 1000.0 * (r + 1) as f32);
        let (pa, pb) = read_pair(&a, &b, Area::Full { look: 1 }).unwrap();
        // Overlap starts at A's column 2, row 1.
        assert_eq!(pa.slc[[0, 0]].re, 1.0 + 2.0 + 1000.0);
        let (pa4, _) = read_pair(&a, &b, Area::Full { look: 4 }).unwrap();
        assert_eq!(pa4.pixel_spacing_x_m, Some(40.0));
        assert_eq!(pa.slc.dim(), pb.slc.dim());
        // Same map position -> same value in both.
        for (x, y) in pa.slc.iter().zip(pb.slc.iter()) {
            assert!((x.re - y.re).abs() < 1e-3, "{} vs {}", x.re, y.re);
        }
        assert_eq!(pa.crs, "EPSG:32645");
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn nodata_is_left_out_of_averages() {
        let dir = std::env::temp_dir().join(format!("s1nd-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let p = dir.join("n.tif");
        write_tif(&p, 8, 8, 300_000.0, 2_800_000.0, |r, c| if r < 4 && c < 4 { if (r + c) % 2 == 0 { f32::NAN } else { 2.0 } } else if r >= 4 && c >= 4 { 0.0 } else { 1.0 });
        let g = read_grid(&p).unwrap();
        let out = read_window(&p, &g, Window { row: 0, col: 0, rows: 8, cols: 8 }, 4).unwrap();
        assert_eq!(out[[0, 0]], 2.0); // NaN pixels ignored
        assert_eq!(out[[0, 1]], 1.0);
        assert!(out[[1, 1]].is_nan()); // all zero -> no data
        std::fs::remove_dir_all(&dir).ok();
    }
}
