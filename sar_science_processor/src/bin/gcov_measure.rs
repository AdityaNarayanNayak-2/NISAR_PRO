//! Measures the real cost of a windowed read on the actual granule.
//!
//! Reports peak memory at three points so the memory claim is backed by
//! numbers rather than inference:
//!   1. immediately after `open`, before any chunk index is built
//!   2. after the index is built (metadata only, no data pages touched)
//!   3. the peak sampled during the windowed read itself
//!
//! Pass bars: peak memory under 300 MB and a cold windowed read under 2 s.
//!
//! The metric is platform specific and printed with the results so the
//! numbers are never compared across OSes by accident:
//!   * Windows — commit size (PrivateUsage)
//!   * Linux   — peak RSS (VmHWM), which also counts touched mmap'd file
//!               pages that Windows excludes, so it reads slightly higher

use std::path::Path;
use std::process;
use std::time::Instant;

use sar_science_processor::windowed::{ChunkedF32Reader, Window};

const PEAK_BAR_BYTES: u64 = 300 * 1024 * 1024;
const COLD_BAR_SECS: f64 = 2.0;

/// Peak "Commit Size" from the Windows memory counters for this process.
#[cfg(target_os = "windows")]
fn commit_bytes() -> Option<u64> {
    use std::ffi::c_void;

    #[repr(C)]
    struct ProcessMemoryCountersEx {
        cb: u32,
        page_fault_count: u32,
        peak_working_set_size: usize,
        working_set_size: usize,
        quota_peak_paged_pool_usage: usize,
        quota_paged_pool_usage: usize,
        quota_peak_non_paged_pool_usage: usize,
        quota_non_paged_pool_usage: usize,
        pagefile_usage: usize,
        peak_pagefile_usage: usize,
        private_usage: usize,
    }

    #[link(name = "kernel32")]
    extern "system" {
        fn GetCurrentProcess() -> *mut c_void;
    }
    #[link(name = "psapi")]
    extern "system" {
        fn GetProcessMemoryInfo(
            process: *mut c_void,
            counters: *mut ProcessMemoryCountersEx,
            cb: u32,
        ) -> i32;
    }

    unsafe {
        let mut counters: ProcessMemoryCountersEx = std::mem::zeroed();
        counters.cb = std::mem::size_of::<ProcessMemoryCountersEx>() as u32;
        let ok = GetProcessMemoryInfo(
            GetCurrentProcess(),
            &mut counters,
            std::mem::size_of::<ProcessMemoryCountersEx>() as u32,
        );
        if ok == 0 {
            None
        } else {
            Some(counters.private_usage as u64)
        }
    }
}

/// Peak resident set size from `/proc/self/status` (VmHWM).
///
/// Linux has no per-process commit charge — that is a Windows concept — so
/// VmHWM is the honest analogue: every page the process has ever touched,
/// including mmap'd file pages that Windows PrivateUsage excludes. Linux
/// numbers therefore read slightly higher than Windows, never lower.
#[cfg(target_os = "linux")]
fn commit_bytes() -> Option<u64> {
    let status = std::fs::read_to_string("/proc/self/status").ok()?;
    for line in status.lines() {
        if let Some(rest) = line.strip_prefix("VmHWM:") {
            let kb: u64 = rest.trim().trim_end_matches(" kB").trim().parse().ok()?;
            return Some(kb * 1024);
        }
    }
    None
}

#[cfg(not(any(target_os = "windows", target_os = "linux")))]
fn commit_bytes() -> Option<u64> {
    None
}

#[cfg(target_os = "windows")]
const METRIC_LABEL: &str = "commit size (Windows PrivateUsage)";
#[cfg(target_os = "linux")]
const METRIC_LABEL: &str = "peak RSS (Linux VmHWM, includes mmap'd file pages)";
#[cfg(not(any(target_os = "windows", target_os = "linux")))]
const METRIC_LABEL: &str = "unavailable on this platform";

fn mb(bytes: u64) -> f64 {
    bytes as f64 / (1024.0 * 1024.0)
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    if args.len() < 6 {
        eprintln!("usage: gcov_measure <file.h5> <dataset> <row0> <row1> <col0> <col1>");
        process::exit(2);
    }
    let file = Path::new(&args[1]);
    let dataset = &args[2];
    let window = Window {
        row_start: args[3].parse().expect("row0"),
        row_end: args[4].parse().expect("row1"),
        col_start: args[5].parse().expect("col0"),
        col_end: args[6].parse().expect("col1"),
    };

    println!("file     : {}", file.display());
    println!(
        "file size: {:.2} GiB",
        std::fs::metadata(file).map(|m| m.len()).unwrap_or(0) as f64 / (1024.0 * 1024.0 * 1024.0)
    );
    println!("dataset  : {dataset}");
    println!(
        "window   : rows {}..{} cols {}..{} = {}x{}",
        window.row_start,
        window.row_end,
        window.col_start,
        window.col_end,
        window.rows(),
        window.cols()
    );
    println!("metric   : {METRIC_LABEL}");
    println!();

    let metric_available = commit_bytes().is_some();
    if !metric_available {
        eprintln!("WARNING: no memory counter on this platform — the memory bar will FAIL");
    }
    let baseline = commit_bytes().unwrap_or(0);
    let t_open = Instant::now();
    let mut reader = ChunkedF32Reader::open(file).expect("open");
    let open_ms = t_open.elapsed().as_secs_f64() * 1000.0;
    let after_open = commit_bytes().unwrap_or(0);
    println!("after open (before any read):");
    println!("  memory  {:>8.1} MB", mb(after_open));
    println!("  delta   {:>8.1} MB vs process start", mb(after_open.saturating_sub(baseline)));
    println!("  open    {open_ms:.1} ms");

    let t_index = Instant::now();
    reader.ensure_index(dataset).expect("index");
    let index_ms = t_index.elapsed().as_secs_f64() * 1000.0;
    let after_index = commit_bytes().unwrap_or(0);
    let idx = reader.index_of(dataset).expect("index");
    let full_read = idx.rows * idx.cols * 4;
    println!("after chunk index (metadata only):");
    println!("  memory  {:>8.1} MB", mb(after_index));
    println!("  delta   {:>8.1} MB vs after open", mb(after_index.saturating_sub(after_open)));
    println!("  index   {index_ms:.1} ms  ({} chunks)", idx.stored_chunks);
    println!();

    let mut peak = after_index;
    let t_cold = Instant::now();
    let (data, stats) = reader
        .read_window_with(dataset, window, |s| {
            let now = commit_bytes().unwrap_or(0);
            if now > peak {
                peak = now;
            }
            let _ = s;
        })
        .expect("windowed read");
    let cold_s = t_cold.elapsed().as_secs_f64();
    let after_cold = commit_bytes().unwrap_or(0);
    if after_cold > peak {
        peak = after_cold;
    }
    println!("cold windowed read:");
    println!("  wall      {cold_s:.3} s");
    println!("  cells     {} touched, {} decoded, {} missing", stats.cells_touched, stats.chunks_decoded, stats.chunks_missing);
    println!("  compressed {:.1} MB in", stats.compressed_bytes as f64 / 1048576.0);
    println!("  decoded   {:.1} MB", stats.decoded_bytes as f64 / 1048576.0);
    println!("  output    {:.1} MB ({} elements)", mb(data.len() as u64 * 4), data.len());
    println!("  memory    {:>8.1} MB  (peak so far)", mb(after_cold));
    println!();

    let t_warm = Instant::now();
    let (_warm, warm_stats) = reader
        .read_window_with(dataset, window, |_| {})
        .expect("warm windowed read");
    let warm_s = t_warm.elapsed().as_secs_f64();
    println!("warm windowed read:");
    println!("  wall      {warm_s:.3} s  ({:.2}x faster)", cold_s / warm_s.max(1e-9));
    println!("  chunks    {} decoded (index served from cache, {} indexes held)", warm_stats.chunks_decoded, reader.cached_indexes());
    println!();

    println!("what the old path would have needed for this window:");
    println!(
        "  full-band read {:>8.1} MB  vs  windowed output {:.1} MB  ({:.0}x less)",
        mb(full_read),
        mb(data.len() as u64 * 4),
        full_read as f64 / (data.len() as u64 * 4).max(1) as f64
    );
    println!();

    println!("pass bars:");
    let peak_ok = metric_available && peak < PEAK_BAR_BYTES;
    let cold_ok = cold_s < COLD_BAR_SECS;
    println!(
        "  peak memory {:.1} MB < {} MB   {}",
        mb(peak),
        mb(PEAK_BAR_BYTES),
        if peak_ok { "PASS" } else { "FAIL" }
    );
    println!(
        "  cold read  {cold_s:.3} s < {COLD_BAR_SECS:.1} s   {}",
        if cold_ok { "PASS" } else { "FAIL" }
    );

    if !(peak_ok && cold_ok) {
        process::exit(1);
    }
}
