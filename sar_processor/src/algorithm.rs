use log::info;
use ndarray::{Array2, ArrayView2};

fn local_variance(data: ArrayView2<f32>, r: usize, c: usize, window_size: usize) -> f32 {
    let half_size = window_size / 2;
    let mut sum = 0.0;
    let mut sum_sq = 0.0;
    let mut count = 0;

    for i in r.saturating_sub(half_size)..=(r + half_size).min(data.nrows() - 1) {
        for j in c.saturating_sub(half_size)..=(c + half_size).min(data.ncols() - 1) {
            let val = data[[i, j]];
            sum += val;
            sum_sq += val * val;
            count += 1;
        }
    }

    if count > 1 {
        let mean = sum / count as f32;
        (sum_sq / count as f32) - (mean * mean)
    } else {
        0.0
    }
}

pub fn amtad_algorithm(sar_image: ArrayView2<f32>) -> Array2<f32> {
    info!("Starting AMTAD Algorithm...");
    let rows = sar_image.nrows();
    let cols = sar_image.ncols();
    let mut anomaly_map = Array2::zeros((rows, cols));

    let scales = [3, 7, 15];
    let weights = [0.5, 0.3, 0.2];

    for r in 0..rows {
        for c in 0..cols {
            let mut fused_score = 0.0;
            let mut total_weight = 0.0;

            for (i, &window_size) in scales.iter().enumerate() {
                let variance = local_variance(sar_image, r, c, window_size);
                let adaptive_weight = weights[i] * (1.0 + (variance / 100.0).tanh());
                fused_score += variance * adaptive_weight;
                total_weight += adaptive_weight;
            }

            if total_weight > 0.0 {
                anomaly_map[[r, c]] = fused_score / total_weight;
            }
        }
    }
    info!("AMTAD complete.");
    anomaly_map
}
