//! Multi-looking for SAR SLC images.
//!
//! Reduces speckle noise and image dimensions by block-averaging complex pixels.
//! Standard SAR preprocessing step before InSAR coherence estimation.

use log::info;
use ndarray::Array2;
use num_complex::Complex32;
use rayon::prelude::*;

/// Block-average (multilook) a complex SLC image.
///
/// Reduces speckle and image dimensions by averaging non-overlapping blocks
/// of `azimuth_looks × range_looks` pixels. Remainder pixels at the edges
/// that don't fill a complete block are truncated.
///
/// # Arguments
/// * `slc` - Input complex SLC image (rows = azimuth, cols = range)
/// * `range_looks` - Number of looks in the range direction (columns)
/// * `azimuth_looks` - Number of looks in the azimuth direction (rows)
///
/// # Returns
/// Multilooked image of size `(rows/azimuth_looks, cols/range_looks)`
pub fn multilook(
    slc: &Array2<Complex32>,
    range_looks: usize,
    azimuth_looks: usize,
) -> Array2<Complex32> {
    let (az_in, rg_in) = slc.dim();
    let az_out = az_in / azimuth_looks;
    let rg_out = rg_in / range_looks;
    let block_size = (azimuth_looks * range_looks) as f32;

    info!(
        "Multilook: {}×{} → {}×{} ({}az × {}rg looks, {} pixels/block)",
        az_in, rg_in, az_out, rg_out, azimuth_looks, range_looks, block_size as usize
    );

    let mut output = Array2::<Complex32>::zeros((az_out, rg_out));

    output
        .axis_iter_mut(ndarray::Axis(0))
        .into_par_iter()
        .enumerate()
        .for_each(|(out_az, mut out_row)| {
            let az_start = out_az * azimuth_looks;

            for out_rg in 0..rg_out {
                let rg_start = out_rg * range_looks;
                let mut sum = Complex32::new(0.0, 0.0);

                for az in az_start..az_start + azimuth_looks {
                    for rg in rg_start..rg_start + range_looks {
                        sum += slc[[az, rg]];
                    }
                }

                out_row[out_rg] = sum / block_size;
            }
        });

    output
}

/// Suggest multilook factors to reduce native dimensions to approximately
/// the target dimensions.
///
/// # Arguments
/// * `native_rows` - Azimuth dimension of the input image
/// * `native_cols` - Range dimension of the input image
/// * `target_rows` - Desired azimuth dimension
/// * `target_cols` - Desired range dimension
///
/// # Returns
/// `(range_looks, azimuth_looks)` — matches the parameter order of [`multilook`].
pub fn suggest_multilook_factors(
    native_rows: usize,
    native_cols: usize,
    target_rows: usize,
    target_cols: usize,
) -> (usize, usize) {
    let az_looks = (native_rows / target_rows).max(1);
    let rg_looks = (native_cols / target_cols).max(1);
    (rg_looks, az_looks)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_multilook_5x2_block_mean() {
        // 100×100 input, azimuth_looks=5, range_looks=2 → 20×50 output.
        //
        // Analytically constructed data:
        //   slc[az, rg] = Complex32::new(az as f32, rg as f32)
        //
        // For output pixel (out_az, out_rg):
        //   Block rows: out_az*5 .. out_az*5+4  (5 values)
        //   Block cols: out_rg*2 .. out_rg*2+1  (2 values)
        //   10 pixels per block
        //
        //   Mean real = average of row indices = out_az*5 + 2.0
        //   Mean imag = average of col indices = out_rg*2 + 0.5
        let (rows, cols) = (100, 100);
        let az_looks = 5;
        let rg_looks = 2;

        let slc = Array2::from_shape_fn((rows, cols), |(az, rg)| {
            Complex32::new(az as f32, rg as f32)
        });

        let result = multilook(&slc, rg_looks, az_looks);

        assert_eq!(result.dim(), (20, 50));

        for out_az in 0..20 {
            for out_rg in 0..50 {
                let expected_re = (out_az * az_looks) as f32 + (az_looks - 1) as f32 / 2.0;
                let expected_im = (out_rg * rg_looks) as f32 + (rg_looks - 1) as f32 / 2.0;

                let pixel = result[[out_az, out_rg]];

                assert!(
                    (pixel.re - expected_re).abs() < 1e-5,
                    "Real at [{},{}]: got {}, expected {}",
                    out_az, out_rg, pixel.re, expected_re
                );
                assert!(
                    (pixel.im - expected_im).abs() < 1e-5,
                    "Imag at [{},{}]: got {}, expected {}",
                    out_az, out_rg, pixel.im, expected_im
                );
            }
        }
    }

    #[test]
    fn test_multilook_1x1_identity() {
        // 1×1 looks should return the original image.
        let slc = Array2::from_shape_fn((16, 16), |(r, c)| {
            Complex32::new((r * 16 + c) as f32, 0.0)
        });

        let result = multilook(&slc, 1, 1);
        assert_eq!(result.dim(), (16, 16));

        for r in 0..16 {
            for c in 0..16 {
                assert!(
                    (result[[r, c]] - slc[[r, c]]).norm() < 1e-6,
                    "1×1 multilook should be identity"
                );
            }
        }
    }

    #[test]
    fn test_multilook_truncates_remainder() {
        // 10×10 with 3×3 looks → 3×3 output (10/3 = 3, remainder 1 discarded)
        let slc = Array2::from_elem((10, 10), Complex32::new(1.0, 1.0));
        let result = multilook(&slc, 3, 3);
        assert_eq!(result.dim(), (3, 3));

        // All pixels constant → output should equal the constant
        for r in 0..3 {
            for c in 0..3 {
                assert!(
                    (result[[r, c]].re - 1.0).abs() < 1e-6,
                    "Constant input: re at [{},{}] = {}",
                    r, c, result[[r, c]].re
                );
            }
        }
    }

    #[test]
    fn test_suggest_factors() {
        // 16020×16560 → ~1500 rows
        let (rg_looks, az_looks) = suggest_multilook_factors(16020, 16560, 1500, 1500);
        assert_eq!(az_looks, 10); // 16020 / 1500 = 10
        assert_eq!(rg_looks, 11); // 16560 / 1500 = 11
    }

    #[test]
    fn test_suggest_factors_no_downscale() {
        // When native < target, factors should be 1
        let (rg_looks, az_looks) = suggest_multilook_factors(100, 200, 500, 500);
        assert_eq!(az_looks, 1);
        assert_eq!(rg_looks, 1);
    }
}
