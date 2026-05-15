//! Quality-guided phase unwrapping.
//!
//! Implements a flood-fill algorithm driven by a coherence-sorted priority queue.
//! High-coherence pixels are unwrapped first, preventing noise from propagating
//! into reliable regions.
//!
//! Complexity: O(n² log n) — each pixel is pushed/popped from the heap at most once.

use log::info;
use ndarray::Array2;
use std::cmp::Ordering;
use std::collections::BinaryHeap;
use std::f32::consts::PI;

const TWO_PI: f32 = 2.0 * PI;

/// Minimum coherence to include a pixel in the unwrapping.
/// Pixels below this threshold remain at `f32::NAN` (no-data).
const COHERENCE_THRESHOLD: f32 = 0.2;

/// Priority queue entry for quality-guided flood fill.
struct QueueEntry {
    /// Coherence of this pixel (determines pop order).
    coherence: f32,
    row: usize,
    col: usize,
}

// BinaryHeap is a max-heap → higher coherence pops first (correct behavior).
impl PartialEq for QueueEntry {
    fn eq(&self, other: &Self) -> bool {
        self.coherence == other.coherence
    }
}
impl Eq for QueueEntry {}

impl PartialOrd for QueueEntry {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

impl Ord for QueueEntry {
    fn cmp(&self, other: &Self) -> Ordering {
        self.coherence
            .partial_cmp(&other.coherence)
            .unwrap_or(Ordering::Equal)
    }
}

/// 4-connected neighbor offsets.
const NEIGHBORS: [(isize, isize); 4] = [(-1, 0), (1, 0), (0, -1), (0, 1)];

/// Quality-guided phase unwrapping.
///
/// # Algorithm
/// 1. Find the highest-coherence pixel → seed.
/// 2. Push its 4-connected neighbors into a max-heap sorted by coherence.
/// 3. Pop the best pixel. Find its already-unwrapped neighbor with the
///    highest coherence. Unwrap relative to that neighbor by adding
///    `k × 2π` to minimize the discontinuity.
/// 4. Push the popped pixel's unvisited neighbors. Repeat until empty.
///
/// Pixels with coherence < 0.2 are skipped (set to `f32::NAN`).
///
/// # Arguments
/// * `wrapped` - Wrapped phase in radians (typically [-π, π])
/// * `coherence` - Coherence map, same dimensions, values in [0, 1]
///
/// # Returns
/// Unwrapped phase in radians (continuous, may exceed [-π, π]).
/// Pixels that were not unwrapped (low coherence) are `f32::NAN`.
pub fn unwrap_phase(wrapped: &Array2<f32>, coherence: &Array2<f32>) -> Array2<f32> {
    assert_eq!(
        wrapped.dim(),
        coherence.dim(),
        "Phase and coherence dimensions must match"
    );
    let (rows, cols) = wrapped.dim();

    let mut unwrapped = Array2::from_elem((rows, cols), f32::NAN);
    let mut visited = Array2::<bool>::default((rows, cols));
    let mut heap = BinaryHeap::<QueueEntry>::new();

    // ── Find seed: highest-coherence pixel ───────────────────────────
    let mut best_coh = -1.0_f32;
    let mut seed_r = 0usize;
    let mut seed_c = 0usize;
    for r in 0..rows {
        for c in 0..cols {
            if coherence[[r, c]] > best_coh {
                best_coh = coherence[[r, c]];
                seed_r = r;
                seed_c = c;
            }
        }
    }

    if best_coh < COHERENCE_THRESHOLD {
        info!("[UNWRAP] All coherence below threshold — returning NAN array");
        return unwrapped;
    }

    info!(
        "[UNWRAP] {}×{}, seed=[{},{}] coh={:.4}, threshold={}",
        rows, cols, seed_r, seed_c, best_coh, COHERENCE_THRESHOLD
    );

    // ── Seed the flood fill ──────────────────────────────────────────
    unwrapped[[seed_r, seed_c]] = wrapped[[seed_r, seed_c]];
    visited[[seed_r, seed_c]] = true;

    push_neighbors(seed_r, seed_c, rows, cols, coherence, &visited, &mut heap);

    // ── Flood fill ───────────────────────────────────────────────────
    let mut unwrapped_count = 1u64;

    while let Some(entry) = heap.pop() {
        if visited[[entry.row, entry.col]] {
            continue;
        }
        visited[[entry.row, entry.col]] = true;

        // Find the best already-unwrapped neighbor (highest coherence)
        let mut ref_coh = -1.0_f32;
        let mut ref_phase = 0.0_f32;

        for &(dr, dc) in &NEIGHBORS {
            let nr = entry.row as isize + dr;
            let nc = entry.col as isize + dc;
            if nr >= 0 && nr < rows as isize && nc >= 0 && nc < cols as isize {
                let nr = nr as usize;
                let nc = nc as usize;
                if visited[[nr, nc]] && coherence[[nr, nc]] > ref_coh {
                    ref_coh = coherence[[nr, nc]];
                    ref_phase = unwrapped[[nr, nc]];
                }
            }
        }

        // Unwrap: find k that minimizes |wrapped[pixel] + k·2π − ref_phase|
        let w = wrapped[[entry.row, entry.col]];
        let diff = w - ref_phase;
        let k = (diff / TWO_PI).round();
        unwrapped[[entry.row, entry.col]] = w - k * TWO_PI;

        unwrapped_count += 1;

        // Push this pixel's unvisited neighbors
        push_neighbors(
            entry.row, entry.col, rows, cols, coherence, &visited, &mut heap,
        );
    }

    info!(
        "[UNWRAP] Complete: {}/{} pixels unwrapped ({:.1}%)",
        unwrapped_count,
        rows * cols,
        100.0 * unwrapped_count as f64 / (rows * cols) as f64
    );

    unwrapped
}

/// Push all valid, unvisited, above-threshold neighbors into the heap.
fn push_neighbors(
    r: usize,
    c: usize,
    rows: usize,
    cols: usize,
    coherence: &Array2<f32>,
    visited: &Array2<bool>,
    heap: &mut BinaryHeap<QueueEntry>,
) {
    for &(dr, dc) in &NEIGHBORS {
        let nr = r as isize + dr;
        let nc = c as isize + dc;
        if nr >= 0 && nr < rows as isize && nc >= 0 && nc < cols as isize {
            let nr = nr as usize;
            let nc = nc as usize;
            if !visited[[nr, nc]] && coherence[[nr, nc]] >= COHERENCE_THRESHOLD {
                heap.push(QueueEntry {
                    coherence: coherence[[nr, nc]],
                    row: nr,
                    col: nc,
                });
            }
        }
    }
}

/// Wrap a phase value to [-π, π]. Used only in tests.
#[cfg(test)]
fn wrap_to_pi(phase: f32) -> f32 {
    let mut p = phase % TWO_PI;
    if p > PI {
        p -= TWO_PI;
    }
    if p < -PI {
        p += TWO_PI;
    }
    p
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_unwrap_linear_ramp_6pi() {
        // Analytically constructed test data.
        //
        // Original: linear phase ramp from 0 to 6π across columns.
        //   original[r, c] = 6π · c / (cols − 1)
        //
        // Wrapped: each value folded to [-π, π].
        // Coherence: 1.0 everywhere.
        //
        // After unwrapping, the result should match the original
        // within 1e-5 (the spec tolerance).
        let (rows, cols) = (64, 64);
        let original = Array2::from_shape_fn((rows, cols), |(_r, c)| {
            6.0 * PI * (c as f32) / (cols as f32 - 1.0)
        });

        let wrapped = original.mapv(wrap_to_pi);
        let coherence = Array2::from_elem((rows, cols), 1.0_f32);

        let unwrapped = unwrap_phase(&wrapped, &coherence);

        let mut max_diff = 0.0_f32;
        for r in 0..rows {
            for c in 0..cols {
                let diff = (unwrapped[[r, c]] - original[[r, c]]).abs();
                if diff > max_diff {
                    max_diff = diff;
                }
            }
        }

        assert!(
            max_diff < 1e-5,
            "Linear ramp 6π: max |unwrapped − original| = {} (expected < 1e-5)",
            max_diff
        );
    }

    #[test]
    fn test_unwrap_2d_cone() {
        // 2D radial phase cone centered at (32, 32), peak = 4π.
        //   original[r, c] = 4π · distance / max_distance
        //
        // Tests diagonal propagation paths.
        //
        // Note: phase unwrapping recovers relative phase only — there is an
        // inherent global 2kπ offset determined by the seed pixel's wrapped value.
        // We subtract this constant offset before comparing.
        let n = 64;
        let center = (n / 2) as f32;
        let max_dist = ((center).powi(2) + (center).powi(2)).sqrt();

        let original = Array2::from_shape_fn((n, n), |(r, c)| {
            let dist = ((r as f32 - center).powi(2) + (c as f32 - center).powi(2)).sqrt();
            4.0 * PI * dist / max_dist
        });

        let wrapped = original.mapv(wrap_to_pi);
        let coherence = Array2::from_elem((n, n), 1.0_f32);

        let unwrapped = unwrap_phase(&wrapped, &coherence);

        // Global offset at seed pixel [0,0]
        let offset = unwrapped[[0, 0]] - original[[0, 0]];

        let mut max_diff = 0.0_f32;
        for r in 0..n {
            for c in 0..n {
                let diff = (unwrapped[[r, c]] - offset - original[[r, c]]).abs();
                if diff > max_diff {
                    max_diff = diff;
                }
            }
        }

        assert!(
            max_diff < 1e-5,
            "2D cone 4π: max |unwrapped − original| = {} (expected < 1e-5)",
            max_diff
        );
    }

    #[test]
    fn test_unwrap_skips_low_coherence() {
        // Left half: coherence = 1.0, right half: coherence = 0.1 (below threshold).
        // Phase ramp spans full width but only left half should be unwrapped.
        let (rows, cols) = (32, 64);
        let original = Array2::from_shape_fn((rows, cols), |(_r, c)| {
            4.0 * PI * (c as f32) / (cols as f32 - 1.0)
        });

        let wrapped = original.mapv(wrap_to_pi);
        let coherence = Array2::from_shape_fn((rows, cols), |(_r, c)| {
            if c < cols / 2 {
                1.0_f32
            } else {
                0.1_f32 // Below COHERENCE_THRESHOLD
            }
        });

        let unwrapped = unwrap_phase(&wrapped, &coherence);

        // Left half should be correctly unwrapped
        for r in 0..rows {
            for c in 0..cols / 2 {
                let diff = (unwrapped[[r, c]] - original[[r, c]]).abs();
                assert!(
                    diff < 1e-5,
                    "Left half at [{},{}]: diff = {} (expected < 1e-5)",
                    r, c, diff
                );
            }
        }

        // Right half should be NAN (skipped / no-data)
        for r in 0..rows {
            for c in cols / 2..cols {
                assert!(
                    unwrapped[[r, c]].is_nan(),
                    "Right half at [{},{}]: should be NAN, got {}",
                    r, c, unwrapped[[r, c]]
                );
            }
        }
    }
}
