//! Full-read-vs-crop differential on the small 80 m `frequencyB/HHHH` grid.
//!
//! Decodes the whole dataset once through the windowed path, then decodes many
//! arbitrary windows and compares each against the corresponding crop of that
//! full array. Same decoder, so a mismatch can only come from window
//! enumeration, clipping, or the row-copy assembly.

use std::path::Path;
use std::process;

use sar_science_processor::sha256::sha256_hex;
use sar_science_processor::windowed::{ChunkedF32Reader, Window};

fn sha16(bytes: &[u8]) -> String {
    let d = sha256_hex(bytes);
    d[..16].to_string()
}

fn crop(full: &[f32], full_cols: u64, w: &Window) -> Vec<f32> {
    let mut out = Vec::with_capacity(w.elements() as usize);
    for r in w.row_start..w.row_end {
        let base = (r * full_cols + w.col_start) as usize;
        let len = (w.col_end - w.col_start) as usize;
        out.extend_from_slice(&full[base..base + len]);
    }
    out
}

fn bits(v: &[f32]) -> Vec<u8> {
    let mut out = Vec::with_capacity(v.len() * 4);
    for x in v {
        out.extend_from_slice(&x.to_le_bytes());
    }
    out
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    if args.len() < 3 {
        eprintln!("usage: gcov_diff <file.h5> <dataset>");
        process::exit(2);
    }
    let file = Path::new(&args[1]);
    let dataset = &args[2];

    let mut reader = ChunkedF32Reader::open(file).expect("open");
    reader.ensure_index(dataset).expect("index");
    let (rows, cols) = {
        let i = reader.index_of(dataset).expect("index");
        (i.rows, i.cols)
    };
    println!("dataset {dataset}  shape {rows}x{cols}");

    let full_window = Window { row_start: 0, row_end: rows, col_start: 0, col_end: cols };
    let full = reader.read_window(dataset, full_window).expect("full read");
    let full_bits = bits(&full);
    println!(
        "full decoded via chunk pipeline: {} elements ({:.1} MB) sha {}",
        full.len(),
        full_bits.len() as f64 / 1048576.0,
        sha16(&full_bits)
    );
    println!();

    // Deterministic windows: block origins, boundaries, edges, and an LCG sweep.
    let mut windows: Vec<(String, Window)> = vec![
        ("topleft_256".into(), Window { row_start: 0, row_end: 256, col_start: 0, col_end: 256 }),
        ("topleft_1x1".into(), Window { row_start: 0, row_end: 1, col_start: 0, col_end: 1 }),
        ("straddle_r".into(), Window { row_start: 511, row_end: 513, col_start: 100, col_end: 200 }),
        ("straddle_c".into(), Window { row_start: 100, row_end: 200, col_start: 511, col_end: 513 }),
        (
            "bottomright".into(),
            Window { row_start: rows - 137, row_end: rows, col_start: cols - 91, col_end: cols },
        ),
        ("last_row".into(), Window { row_start: rows - 1, row_end: rows, col_start: 0, col_end: cols }),
        ("last_col".into(), Window { row_start: 0, row_end: rows, col_start: cols - 1, col_end: cols }),
        ("full_grid".into(), full_window),
    ];

    let mut state = 0x9E3779B97F4A7C15u64;
    for i in 0..24 {
        state = state.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407);
        let a = state >> 33;
        let b = state.rotate_left(17) >> 33;
        let r0 = a % rows.saturating_sub(1).max(1);
        let c0 = b % cols.saturating_sub(1).max(1);
        let rh = 1 + (a >> 7) % 700;
        let cw = 1 + (b >> 9) % 700;
        let w = Window {
            row_start: r0,
            row_end: (r0 + rh).min(rows),
            col_start: c0,
            col_end: (c0 + cw).min(cols),
        };
        windows.push((format!("random_{i:02}"), w));
    }

    let mut failed = 0;
    for (name, w) in &windows {
        if w.row_start >= w.row_end || w.col_start >= w.col_end {
            continue;
        }
        let ours = reader.read_window(dataset, *w).expect("window read");
        let want = crop(&full, cols, w);
        let ob = bits(&ours);
        let wb = bits(&want);
        if ob == wb {
            println!(
                "  {name:<16} PASS  {}x{}  sha {}",
                w.rows(),
                w.cols(),
                sha16(&ob)
            );
        } else {
            let mut shown = 0;
            for (i, (a, b)) in ours.iter().zip(want.iter()).enumerate() {
                if a.to_bits() != b.to_bits() {
                    if shown < 4 {
                        println!(
                            "      ({}, {}) ours {} (0x{:08x}) crop {} (0x{:08x})",
                            w.row_start + i as u64 / w.cols(),
                            w.col_start + i as u64 % w.cols(),
                            a,
                            a.to_bits(),
                            b,
                            b.to_bits()
                        );
                    }
                    shown += 1;
                }
            }
            println!(
                "  {name:<16} FAIL  {}x{}  ours {} crop {}  ({} mismatching elements)",
                w.rows(),
                w.cols(),
                sha16(&ob),
                sha16(&wb),
                shown
            );
            failed += 1;
        }
    }

    println!();
    println!("windows compared: {}  failed: {}", windows.len(), failed);
    if failed > 0 {
        process::exit(1);
    }
}
