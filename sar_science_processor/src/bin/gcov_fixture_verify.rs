//! Verifies [`windowed`] against the synthetic fixture, where the
//! missing-chunk path is genuinely exercised: 5 of 15 grid cells were never
//! written and must come back as the header's fill value.

use sar_science_processor::sha256::sha256_hex;
use std::path::Path;
use std::process;

use sar_science_processor::windowed::{ChunkedF32Reader, Window};

/// Compare one window against a whole-dataset read, element by element. On a
/// 700-element fixture a full read is affordable, so this localises whether a
/// mismatch comes from chunk selection, clipping, or the copy loop.
fn dump_diff(path: &Path, window: Window, ours: &[f32]) {
    use rustyhdf5::File;
    let f = match File::open(path) {
        Ok(f) => f,
        Err(e) => {
            println!("      (cannot open with high-level reader: {e})");
            return;
        }
    };
    let ds = match f.dataset("/ragged") {
        Ok(d) => d,
        Err(e) => {
            println!("      (no dataset: {e})");
            return;
        }
    };
    let all = match ds.read_f32() {
        Ok(v) => v,
        Err(e) => {
            println!("      (full read failed: {e})");
            return;
        }
    };
    let cols = 35usize;
    let mut shown = 0;
    for r in window.row_start..window.row_end {
        for c in window.col_start..window.col_end {
            let idx = (r as usize) * cols + c as usize;
            if idx >= all.len() {
                println!("      high-level read too short: need {idx}, have {}", all.len());
                return;
            }
            let w = ((r - window.row_start) * window.cols() + (c - window.col_start)) as usize;
            let a = ours.get(w).copied();
            let b = all[idx];
            let same = match a {
                Some(x) => x.to_bits() == b.to_bits(),
                None => false,
            };
            if !same {
                if shown < 6 {
                    println!(
                        "      ({r},{c}) ours {:?} (0x{:08x}) high-level {:?} (0x{:08x})",
                        a.map(|v| v.to_bits()).unwrap_or(0),
                        a.map(|v| v.to_bits()).unwrap_or(0),
                        b.to_bits(),
                        b.to_bits()
                    );
                }
                shown += 1;
            }
        }
    }
    if shown == 0 {
        println!("      every element matches the high-level full read");
    } else {
        println!("      {shown} element(s) differ from the high-level full read");
    }
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    if args.len() < 3 {
        eprintln!("usage: gcov_fixture_verify <fixture.h5> <fixture.tsv>");
        process::exit(2);
    }
    let h5 = Path::new(&args[1]);
    let tsv = Path::new(&args[2]);
    let dir = tsv.parent().unwrap_or(Path::new("."));
    let dataset = "/ragged";

    let mut reader = ChunkedF32Reader::open(h5).expect("open fixture");
    reader.ensure_index(dataset).expect("index fixture");
    let index = reader.index_of(dataset).expect("index present");

    println!("fixture : {}", h5.display());
    println!("  shape          {} x {}", index.rows, index.cols);
    println!("  chunk          {} x {}", index.chunk_rows, index.chunk_cols);
    println!("  fill           {:?} ({})", index.fill, index.fill_source);
    println!("  chunks stored  {}", index.stored_chunks);
    println!("  grid cells     {}", index.grid_cells);
    let absent = index.grid_cells as i64 - index.stored_chunks as i64;
    println!("  absent cells   {absent}");
    if absent == 0 {
        println!("  ERROR: fixture has no absent cells, so this proves nothing");
        process::exit(1);
    }
    if !index.fill.is_nan() {
        println!("  ERROR: fill value is not NaN, header parsing is wrong");
        process::exit(1);
    }
    println!("  missing-chunk path IS exercised");
    println!();

    let text = std::fs::read_to_string(tsv).expect("read tsv");
    let mut passed = 0;
    let mut failed = 0;
    for (i, line) in text.lines().enumerate() {
        if i == 0 || line.trim().is_empty() {
            continue;
        }
        let f: Vec<&str> = line.split('\t').collect();
        if f.len() < 9 {
            eprintln!("skipping malformed line {}: {line}", i + 1);
            continue;
        }
        // name rows cols row_start row_end col_start col_end sha256 file
        let name = f[0];
        let num = |s: &str, what: &str| -> u64 {
            s.trim().parse().unwrap_or_else(|_| panic!("{name}: bad {what} {:?}", s))
        };
        let window = Window {
            row_start: num(f[3], "row_start"),
            row_end: num(f[4], "row_end"),
            col_start: num(f[5], "col_start"),
            col_end: num(f[6], "col_end"),
        };
        let want_sha = f[7].trim();

        let (ours, stats) = reader
            .read_window_with(dataset, window, |_| {})
            .expect("windowed read");
        let expected = std::fs::read(dir.join(f[8])).expect("read golden");
        // Length must come from the element count: size_of_val on a Vec<f32>
        // would report the Vec header (24 bytes), not the buffer.
        let our_bytes: &[u8] =
            unsafe { std::slice::from_raw_parts(ours.as_ptr() as *const u8, ours.len() * 4) };
        let our_sha = sha256_hex(our_bytes);

        if our_sha == want_sha && our_bytes == expected.as_slice() {
            println!(
                "  {:<16} PASS  {}x{}  missing={} decoded={} {}",
                name,
                window.rows(),
                window.cols(),
                stats.chunks_missing,
                stats.chunks_decoded,
                &our_sha[..12]
            );
            passed += 1;
        } else {
            println!(
                "  {:<16} FAIL  ours {} golden {}  ({} bytes vs {})",
                name,
                &our_sha[..12],
                &want_sha[..12],
                our_bytes.len(),
                expected.len()
            );
            println!(
                "      window rows {}..{} cols {}..{} = {}x{} = {} elements; manifest rows {} cols {}",
                window.row_start,
                window.row_end,
                window.col_start,
                window.col_end,
                window.rows(),
                window.cols(),
                window.elements(),
                f[1],
                f[2]
            );
            if our_bytes.len() == expected.len() {
                for (k, (a, b)) in our_bytes.iter().zip(expected.iter()).enumerate() {
                    if a != b {
                        let base = k & !3;
                        let ours_f = f32::from_le_bytes([
                            our_bytes[base],
                            our_bytes[base + 1],
                            our_bytes[base + 2],
                            our_bytes[base + 3],
                        ]);
                        let gold_f = f32::from_le_bytes([
                            expected[base],
                            expected[base + 1],
                            expected[base + 2],
                            expected[base + 3],
                        ]);
                        println!(
                            "      first diff at byte {k} (elem {}): ours {} (0x{:08x}) golden {} (0x{:08x})",
                            k / 4,
                            ours_f,
                            ours_f.to_bits(),
                            gold_f,
                            gold_f.to_bits()
                        );
                        break;
                    }
                }
            }
            dump_diff(h5, window, &ours);
            failed += 1;
        }
    }

    println!();
    println!("passed {passed}, failed {failed}");
    if failed > 0 {
        process::exit(1);
    }
}
