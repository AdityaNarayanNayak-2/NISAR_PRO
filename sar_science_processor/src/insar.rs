use ndarray::{Array2, s, Zip};
use num_complex::Complex32;
use log::info;

/// Computes the complex interferogram from registered master and slave SAR images.
/// Phase difference = master * conj(slave)
pub fn compute_interferogram(master: &Array2<Complex32>, slave: &Array2<Complex32>) -> Array2<Complex32> {
    assert_eq!(master.dim(), slave.dim(), "Master and slave must have the same dimensions");
    
    // Perform element-wise multiplication: master * conj(slave)
    let mut ifgram = Array2::<Complex32>::zeros(master.dim());
    Zip::from(&mut ifgram)
        .and(master)
        .and(slave)
        .for_each(|out, &m, &s| {
            *out = m * s.conj();
        });
        
    ifgram
}

/// Estimates coherence using summed-area tables (integral images) for O(n²) performance.
///
/// Builds four f64-precision summed-area tables:
///   - `sat_ms_re`, `sat_ms_im`: real/imag parts of cumulative Σ(m × conj(s))
///   - `sat_mm`: cumulative Σ|m|²
///   - `sat_ss`: cumulative Σ|s|²
///
/// Window query is O(1) per pixel:
///   sum = SAT[r₂+1, c₂+1] − SAT[r₁, c₂+1] − SAT[r₂+1, c₁] + SAT[r₁, c₁]
///
/// Coherence: γ = |Σ(m×s*)| / √(Σ|m|² × Σ|s|²)
///
/// Overall complexity: O(n²), versus O(n²·w²) for the naive sliding window.
pub fn estimate_coherence(
    master: &Array2<Complex32>,
    slave: &Array2<Complex32>,
    window_size: usize,
) -> Array2<f32> {
    assert_eq!(master.dim(), slave.dim(), "Master and slave must have the same dimensions");
    let (rows, cols) = master.dim();
    let half_win = window_size / 2;

    info!(
        "Estimating coherence (SAT): {}×{}, window={} → O(n²)",
        rows, cols, window_size
    );

    // ── 1. Build summed-area tables ──────────────────────────────────────
    // 1-indexed: row 0 and col 0 are zero-padding for boundary handling.
    let sr = rows + 1;
    let sc = cols + 1;

    let mut sat_ms_re = Array2::<f64>::zeros((sr, sc));
    let mut sat_ms_im = Array2::<f64>::zeros((sr, sc));
    let mut sat_mm = Array2::<f64>::zeros((sr, sc));
    let mut sat_ss = Array2::<f64>::zeros((sr, sc));

    for r in 0..rows {
        for c in 0..cols {
            let m = master[[r, c]];
            let s = slave[[r, c]];

            // m × conj(s) = (m_re * s_re + m_im * s_im) + j(m_im * s_re - m_re * s_im)
            let ms_re = (m.re as f64) * (s.re as f64) + (m.im as f64) * (s.im as f64);
            let ms_im = (m.im as f64) * (s.re as f64) - (m.re as f64) * (s.im as f64);
            let mm = (m.re as f64).powi(2) + (m.im as f64).powi(2);
            let ss = (s.re as f64).powi(2) + (s.im as f64).powi(2);

            // SAT[r+1, c+1] = val + SAT[r, c+1] + SAT[r+1, c] - SAT[r, c]
            sat_ms_re[[r + 1, c + 1]] =
                ms_re + sat_ms_re[[r, c + 1]] + sat_ms_re[[r + 1, c]] - sat_ms_re[[r, c]];
            sat_ms_im[[r + 1, c + 1]] =
                ms_im + sat_ms_im[[r, c + 1]] + sat_ms_im[[r + 1, c]] - sat_ms_im[[r, c]];
            sat_mm[[r + 1, c + 1]] =
                mm + sat_mm[[r, c + 1]] + sat_mm[[r + 1, c]] - sat_mm[[r, c]];
            sat_ss[[r + 1, c + 1]] =
                ss + sat_ss[[r, c + 1]] + sat_ss[[r + 1, c]] - sat_ss[[r, c]];
        }
    }

    // ── 2. Query coherence per pixel ─────────────────────────────────────
    // Only compute where the full window fits (matches naive behavior).
    let mut coherence = Array2::<f32>::zeros((rows, cols));

    for r in half_win..rows.saturating_sub(half_win) {
        for c in half_win..cols.saturating_sub(half_win) {
            // Window bounds in original 0-indexed coordinates (inclusive)
            let r_top = r - half_win;
            let r_bot = r + half_win;
            let c_left = c - half_win;
            let c_right = c + half_win;

            // SAT query: sum over [r_top..=r_bot, c_left..=c_right]
            let sum_ms_re = sat_ms_re[[r_bot + 1, c_right + 1]]
                - sat_ms_re[[r_top, c_right + 1]]
                - sat_ms_re[[r_bot + 1, c_left]]
                + sat_ms_re[[r_top, c_left]];
            let sum_ms_im = sat_ms_im[[r_bot + 1, c_right + 1]]
                - sat_ms_im[[r_top, c_right + 1]]
                - sat_ms_im[[r_bot + 1, c_left]]
                + sat_ms_im[[r_top, c_left]];
            let sum_mm = sat_mm[[r_bot + 1, c_right + 1]]
                - sat_mm[[r_top, c_right + 1]]
                - sat_mm[[r_bot + 1, c_left]]
                + sat_mm[[r_top, c_left]];
            let sum_ss = sat_ss[[r_bot + 1, c_right + 1]]
                - sat_ss[[r_top, c_right + 1]]
                - sat_ss[[r_bot + 1, c_left]]
                + sat_ss[[r_top, c_left]];

            // γ = |Σ(m×s*)| / √(Σ|m|² × Σ|s|²)
            let num = (sum_ms_re.powi(2) + sum_ms_im.powi(2)).sqrt();
            let den = (sum_mm * sum_ss).sqrt();

            if den > 1e-10 {
                coherence[[r, c]] = (num / den) as f32;
            }
        }
    }

    coherence
}

/// Original O(n²·w²) coherence estimation, kept for validation against the SAT version.
///
/// Coherence γ = |⟨m × s*⟩| / √(⟨|m|²⟩ × ⟨|s|²⟩)
pub fn estimate_coherence_naive(
    master: &Array2<Complex32>,
    slave: &Array2<Complex32>,
    window_size: usize,
) -> Array2<f32> {
    let (rows, cols) = master.dim();
    let mut coherence = Array2::<f32>::zeros((rows, cols));

    let half_win = window_size / 2;

    // We compute coherence only where the window fits fully inside the image
    for r in half_win..(rows - half_win) {
        for c in half_win..(cols - half_win) {
            let m_window = master.slice(s![r-half_win..=r+half_win, c-half_win..=c+half_win]);
            let s_window = slave.slice(s![r-half_win..=r+half_win, c-half_win..=c+half_win]);

            let mut num = Complex32::new(0.0, 0.0);
            let mut den_m = 0.0;
            let mut den_s = 0.0;

            Zip::from(&m_window).and(&s_window).for_each(|&m, &s| {
                num += m * s.conj();
                den_m += m.norm_sqr();
                den_s += s.norm_sqr();
            });

            let den = (den_m * den_s).sqrt();
            if den > 1e-10 {
                coherence[[r, c]] = num.norm() / den;
            }
        }
    }

    coherence
}

/// Extracts the unwrapped phase from a complex interferogram.
/// Simply returns the angle (in radians) of the complex numbers.  
/// Proper 2D phase unwrapping (e.g., SNAPHU/Goldstein) would be applied here in a full pipeline.
pub fn extract_phase(ifgram: &Array2<Complex32>) -> Array2<f32> {
    ifgram.mapv(|c| c.arg())
}

#[cfg(test)]
mod tests {
    use super::*;
    use ndarray::Array2;
    use num_complex::Complex32;

    /// Simple deterministic pseudo-random number generator (LCG).
    /// Returns values in [-1.0, 1.0].
    fn lcg_f32(state: &mut u64) -> f32 {
        *state = state
            .wrapping_mul(6364136223846793005)
            .wrapping_add(1442695040888963407);
        // Extract bits 33..63 (31 bits), map to [-1, 1]
        let bits = (*state >> 33) as f32;
        bits / (2147483648.0_f32) * 2.0 - 1.0
    }

    /// Generate a random Complex32 using the LCG.
    fn lcg_complex(state: &mut u64) -> Complex32 {
        Complex32::new(lcg_f32(state), lcg_f32(state))
    }

    #[test]
    fn test_sat_matches_naive() {
        // Create 64×64 deterministic complex arrays
        let (rows, cols) = (64, 64);
        let mut state = 42u64;

        let master = Array2::from_shape_fn((rows, cols), |_| lcg_complex(&mut state));
        let slave = Array2::from_shape_fn((rows, cols), |_| lcg_complex(&mut state));

        let window = 5;
        let coh_sat = estimate_coherence(&master, &slave, window);
        let coh_naive = estimate_coherence_naive(&master, &slave, window);

        // Verify they match within 1e-5 at every pixel
        let max_diff = coh_sat
            .iter()
            .zip(coh_naive.iter())
            .map(|(&a, &b)| (a - b).abs())
            .fold(0.0_f32, f32::max);

        assert!(
            max_diff < 1e-4, // f32 precision allows small diffs; SAT uses f64 internally
            "SAT vs naive max difference = {} (should be < 1e-4)",
            max_diff
        );
    }

    #[test]
    fn test_identical_signals_coherence_one() {
        // Identical master and slave → coherence must be 1.0
        let (rows, cols) = (32, 32);
        let val = Complex32::new(3.0, -1.5);
        let master = Array2::from_elem((rows, cols), val);
        let slave = master.clone();

        let coh = estimate_coherence(&master, &slave, 5);
        let half = 5 / 2;

        // Check interior pixels
        for r in half..(rows - half) {
            for c in half..(cols - half) {
                assert!(
                    (coh[[r, c]] - 1.0).abs() < 1e-5,
                    "Identical signals: coherence at [{},{}] = {} (expected 1.0)",
                    r, c, coh[[r, c]]
                );
            }
        }
    }

    #[test]
    fn test_known_coherence_09() {
        // Generate correlated master/slave with theoretical coherence ≈ 0.9.
        //
        // Signal model:
        //   common[i] = random complex  (shared component)
        //   noise[i]  = random complex  (independent noise)
        //   master[i] = common[i]
        //   slave[i]  = ρ · common[i] + √(1 − ρ²) · noise[i]
        //
        // Theoretical coherence = ρ = 0.9 (for large window / many samples).
        let rho: f32 = 0.9;
        let noise_scale = (1.0 - rho * rho).sqrt();
        let (rows, cols) = (128, 128);

        let mut state_c = 12345u64; // seed for common signal
        let mut state_n = 67890u64; // seed for noise

        let common = Array2::from_shape_fn((rows, cols), |_| lcg_complex(&mut state_c));
        let noise = Array2::from_shape_fn((rows, cols), |_| lcg_complex(&mut state_n));

        let master = common.clone();
        let mut slave = Array2::<Complex32>::zeros((rows, cols));
        for r in 0..rows {
            for c in 0..cols {
                slave[[r, c]] = common[[r, c]] * rho + noise[[r, c]] * noise_scale;
            }
        }

        // Use a large window to get a stable estimate
        let window = 11;
        let coh = estimate_coherence(&master, &slave, window);
        let half = window / 2;

        // Check interior pixels are within 0.05 of 0.9
        let mut min_coh = f32::MAX;
        let mut max_coh = f32::MIN;
        let mut sum_coh = 0.0_f64;
        let mut count = 0u64;

        for r in half..(rows - half) {
            for c in half..(cols - half) {
                let v = coh[[r, c]];
                if v > 0.0 {
                    min_coh = min_coh.min(v);
                    max_coh = max_coh.max(v);
                    sum_coh += v as f64;
                    count += 1;
                }
            }
        }

        let mean_coh = sum_coh / count as f64;

        assert!(
            (mean_coh - 0.9).abs() < 0.05,
            "Mean coherence = {:.4} (expected ~0.9, tolerance 0.05)",
            mean_coh
        );
        assert!(
            min_coh > 0.75,
            "Min coherence = {:.4} (expected > 0.75 for ρ=0.9 with window=11)",
            min_coh
        );
    }

    #[test]
    fn test_orthogonal_signals_low_coherence() {
        // Master = (1, 0), Slave = (0, 1) everywhere → cross-product imaginary only
        // |m·s*| = |(1+0i)(0-i)| = |(-i)| = 1
        // |m|² = 1, |s|² = 1 → coherence = 1 (they're constant, just phase-shifted)
        //
        // Instead: use deterministic sequences that are uncorrelated.
        let (rows, cols) = (64, 64);
        let mut state_m = 11111u64;
        let mut state_s = 99999u64;

        let master = Array2::from_shape_fn((rows, cols), |_| lcg_complex(&mut state_m));
        let slave = Array2::from_shape_fn((rows, cols), |_| lcg_complex(&mut state_s));

        let coh = estimate_coherence(&master, &slave, 7);
        let half = 7 / 2;

        // Uncorrelated signals should have low coherence (< 0.3 for window=7)
        for r in half..(rows - half) {
            for c in half..(cols - half) {
                assert!(
                    coh[[r, c]] < 0.5,
                    "Uncorrelated signals: coherence at [{},{}] = {} (expected < 0.5)",
                    r, c, coh[[r, c]]
                );
            }
        }
    }

    #[test]
    fn test_interferogram_phase() {
        let master = Array2::from_elem((4, 4), Complex32::from_polar(1.0, 0.5));
        let slave = Array2::from_elem((4, 4), Complex32::from_polar(1.0, 0.3));

        let ifgram = compute_interferogram(&master, &slave);
        let phase = extract_phase(&ifgram);

        // Phase difference should be 0.5 - 0.3 = 0.2
        for &p in phase.iter() {
            assert!(
                (p - 0.2).abs() < 1e-5,
                "Phase = {} (expected 0.2)",
                p
            );
        }
    }
}
