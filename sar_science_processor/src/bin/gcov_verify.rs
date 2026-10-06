//! Bit-for-bit verifier for [`windowed`] against the h5py/libhdf5 goldens.
//!
//! Compares raw f32 bytes, so NaN payloads and sign bits must match exactly.
//! Any difference is reported with its exact byte offset and both bit patterns
//! rather than being averaged away.

use sar_science_processor::sha256::sha256_hex;
use std::path::Path;
use std::process;

use sar_science_processor::windowed::{ChunkedF32Reader, Window};

/// One golden window as recorded by `scripts/nisar_probe.py`.
struct Golden {
    name: String,
    dataset: String,
    rows: u64,
    cols: u64,
    row_start: u64,
    row_end: u64,
    col_start: u64,
    col_end: u64,
    sha256: String,
    file: String,
}

impl Golden {
    fn elements(&self) -> u64 {
        self.rows * self.cols
    }
}

/// Read the tab-separated golden list. Deliberately not JSON: a manifest this
/// small does not justify a JSON parser in a crate with no serde dependency.
fn parse_manifest(text: &str) -> Vec<Golden> {
    let mut out = Vec::new();
    for (lineno, line) in text.lines().enumerate() {
        if line.trim().is_empty() {
            continue;
        }
        let f: Vec<&str> = line.split('\t').collect();
        if lineno == 0 {
            continue;
        }
        if f.len() < 10 {
            eprintln!("skipping malformed manifest line {}: {line}", lineno + 1);
            continue;
        }
        out.push(Golden {
            name: f[0].to_string(),
            dataset: f[1].to_string(),
            rows: f[2].parse().unwrap_or(0),
            cols: f[3].parse().unwrap_or(0),
            row_start: f[4].parse().unwrap_or(0),
            row_end: f[5].parse().unwrap_or(0),
            col_start: f[6].parse().unwrap_or(0),
            col_end: f[7].parse().unwrap_or(0),
            sha256: f[8].to_string(),
            file: f[9].to_string(),
        });
    }
    out
}

fn compare(name: &str, ours: &[f32], golden: &[u8], expected_sha: &str) -> bool {
    // Length must come from the element count: size_of_val on a Vec<f32>
    // reports the Vec header, not the buffer.
    let our_bytes: &[u8] =
        unsafe { std::slice::from_raw_parts(ours.as_ptr() as *const u8, ours.len() * 4) };
    let our_sha = sha256_hex(our_bytes);
    if our_sha == expected_sha && golden == our_bytes {
        println!("  {:<18} PASS  {} bytes  sha {}", name, our_bytes.len(), &our_sha[..16]);
        return true;
    }

    println!("  {:<18} FAIL", name);
    println!("       ours sha   {}", our_sha);
    println!("       golden sha {}", expected_sha);
    if golden.len() != our_bytes.len() {
        println!("       length ours {} golden {}", our_bytes.len(), golden.len());
        return false;
    }
    let mut shown = 0;
    for (i, (a, b)) in our_bytes.iter().zip(golden.iter()).enumerate() {
        if a != b {
            let element = i / 4;
            let row = element / ours.len().max(1) as usize / 1;
            println!(
                "       byte {:>8} (elem {:>8}): ours 0x{:02x} golden 0x{:02x}  ours_f32={:e} golden_f32={:e}",
                i, element, a, b,
                f32::from_le_bytes([our_bytes[i & !3], our_bytes[(i & !3) + 1], our_bytes[(i & !3) + 2], our_bytes[(i & !3) + 3]]),
                f32::from_le_bytes([golden[i & !3], golden[(i & !3) + 1], golden[(i & !3) + 2], golden[(i & !3) + 3]]),
            );
            let _ = row;
            shown += 1;
            if shown >= 8 {
                println!("       ... more differences suppressed");
                break;
            }
        }
    }
    false
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    if args.len() < 3 {
        eprintln!("usage: gcov_verify <file.h5> <goldens dir>");
        process::exit(2);
    }
    let file = Path::new(&args[1]);
    let goldens_dir = Path::new(&args[2]);
    let manifest_path = goldens_dir.join("goldens.tsv");
    let text = match std::fs::read_to_string(&manifest_path) {
        Ok(t) => t,
        Err(e) => {
            eprintln!("cannot read {}: {e}", manifest_path.display());
            process::exit(1);
        }
    };

    let goldens = parse_manifest(&text);
    if goldens.is_empty() {
        eprintln!("no golden windows parsed from {}", manifest_path.display());
        process::exit(1);
    }

    let mut reader = ChunkedF32Reader::open(file).expect("open granule");
    let mut passed = 0;
    let mut failed = 0;

    let mut datasets: Vec<String> = goldens.iter().map(|g| g.dataset.clone()).collect();
    datasets.sort();
    datasets.dedup();

    for dataset in datasets {
        println!("dataset : {}", dataset);
        match reader.ensure_index(&dataset) {
            Ok(()) => {}
            Err(e) => {
                println!("  index FAILED: {e}");
                failed += goldens.iter().filter(|g| g.dataset == dataset).count();
                continue;
            }
        }
        let index = reader.index_of(&dataset).expect("index present");
        println!("  shape          {} x {}", index.rows, index.cols);
        println!("  chunk          {} x {}", index.chunk_rows, index.chunk_cols);
        println!("  fill           {:?} ({})", index.fill, index.fill_source);
        println!("  chunks stored  {}", index.stored_chunks);
        println!("  grid cells     {}", index.grid_cells);
        let missing = index.grid_cells as i64 - index.stored_chunks as i64;
        println!(
            "  absent cells   {}{}",
            missing,
            if missing == 0 {
                "  (missing-chunk path NOT exercised by this dataset)"
            } else {
                "  (missing-chunk path IS exercised)"
            }
        );
        println!(
            "  pipeline       {:?}",
            index.pipeline.filters.iter().map(|f| f.filter_id).collect::<Vec<_>>()
        );
        println!();

        for golden in goldens.iter().filter(|g| g.dataset == dataset) {
            let window = Window {
                row_start: golden.row_start,
                row_end: golden.row_end,
                col_start: golden.col_start,
                col_end: golden.col_end,
            };
            let ours = match reader.read_window(&dataset, window) {
                Ok(v) => v,
                Err(e) => {
                    println!("  {:<18} ERROR {e}", golden.name);
                    failed += 1;
                    continue;
                }
            };
            if ours.len() as u64 != golden.elements() {
                println!(
                    "  {:<18} FAIL element count {} != manifest {}",
                    golden.name,
                    ours.len(),
                    golden.elements()
                );
                failed += 1;
                continue;
            }
            let expected = match std::fs::read(goldens_dir.join(&golden.file)) {
                Ok(b) => b,
                Err(e) => {
                    println!("  {:<18} ERROR cannot read golden: {e}", golden.name);
                    failed += 1;
                    continue;
                }
            };
            if compare(&golden.name, &ours, &expected, &golden.sha256) {
                passed += 1;
            } else {
                failed += 1;
            }
        }
        println!();
    }

    println!("cached indexes after run: {}", reader.cached_indexes());
    println!("passed {passed}, failed {failed}");
    if failed > 0 {
        process::exit(1);
    }
}
