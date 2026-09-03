//! Crash Journal — Pre-crash diagnostic log for OOM investigation.
//!
//! Writes a human-readable journal file to disk **before** dangerous operations
//! (large allocations, HDF5 reads). If the Linux OOM killer terminates the process,
//! the journal survives on disk with the last known state.
//!
//! Journal location: `<output_dir>/crash_journal.log` (or `./crash_journal.log` if no output).
//!
//! Each entry is timestamped and append-only. The journal is designed to be read
//! top-to-bottom after a crash — the last entry tells you exactly what was happening
//! when the process died.

use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::Instant;

use chrono::Local;
use log::{info, warn};

/// Global crash journal path, set once at startup.
static JOURNAL_PATH: Mutex<Option<PathBuf>> = Mutex::new(None);

/// Snapshot of system memory at a point in time.
#[derive(Debug, Clone)]
pub struct MemSnapshot {
    pub total_mb: u64,
    pub available_mb: u64,
    pub swap_total_mb: u64,
    pub swap_free_mb: u64,
}

impl std::fmt::Display for MemSnapshot {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(
            f,
            "RAM: {} MB avail / {} MB total | Swap: {} MB free / {} MB total",
            self.available_mb, self.total_mb, self.swap_free_mb, self.swap_total_mb
        )
    }
}

/// Read current system memory from /proc/meminfo (Linux only).
pub fn read_system_memory() -> Option<MemSnapshot> {
    let content = fs::read_to_string("/proc/meminfo").ok()?;
    let mut total = 0u64;
    let mut available = 0u64;
    let mut swap_total = 0u64;
    let mut swap_free = 0u64;

    for line in content.lines() {
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() >= 2 {
            let val_kb: u64 = parts[1].parse().unwrap_or(0);
            match parts[0] {
                "MemTotal:" => total = val_kb / 1024,
                "MemAvailable:" => available = val_kb / 1024,
                "SwapTotal:" => swap_total = val_kb / 1024,
                "SwapFree:" => swap_free = val_kb / 1024,
                _ => {}
            }
        }
    }

    Some(MemSnapshot {
        total_mb: total,
        available_mb: available,
        swap_total_mb: swap_total,
        swap_free_mb: swap_free,
    })
}

/// Initialize the crash journal at a given directory.
/// Call this once from main() before any processing begins.
pub fn init_journal(output_dir: &Path) {
    let journal_path = output_dir.join("crash_journal.log");

    // Ensure directory exists
    if let Some(parent) = journal_path.parent() {
        let _ = fs::create_dir_all(parent);
    }

    if let Ok(mut guard) = JOURNAL_PATH.lock() {
        *guard = Some(journal_path.clone());
    }

    // Write header
    write_entry(
        "SESSION_START",
        &format!(
            "SAR Science Processor v0.1.0 started\n  PID: {}\n  System: {}",
            std::process::id(),
            read_system_memory()
                .map(|m| m.to_string())
                .unwrap_or_else(|| "unknown (not Linux?)".to_string()),
        ),
    );

    info!("Crash journal initialized: {:?}", journal_path);
}

/// Write a timestamped entry to the crash journal.
/// This is designed to be fast and never panic — if the write fails, we log a warning and move on.
pub fn write_entry(tag: &str, message: &str) {
    let path = match JOURNAL_PATH.lock() {
        Ok(guard) => match guard.as_ref() {
            Some(p) => p.clone(),
            None => return, // Journal not initialized, silently skip
        },
        Err(_) => return,
    };

    let timestamp = Local::now().format("%Y-%m-%d %H:%M:%S%.3f");
    let entry = format!("[{}] [{}] {}\n", timestamp, tag, message);

    match OpenOptions::new().create(true).append(true).open(&path) {
        Ok(mut f) => {
            let _ = f.write_all(entry.as_bytes());
            let _ = f.flush(); // Force to disk immediately — critical for OOM survival
        }
        Err(e) => {
            warn!("Failed to write crash journal: {}", e);
        }
    }
}

/// Log a memory checkpoint with context about what's about to happen.
/// Call this BEFORE any large allocation.
pub fn checkpoint_before_alloc(operation: &str, estimated_bytes: u64) {
    let mem = read_system_memory();
    let estimated_mb = estimated_bytes / (1024 * 1024);

    let mem_status =
        match &mem {
            Some(m) => format!(
            "  System memory: {}\n  Estimated allocation: {} MB\n  Headroom after alloc: ~{} MB",
            m,
            estimated_mb,
            m.available_mb.saturating_sub(estimated_mb)
        ),
            None => format!(
                "  Estimated allocation: {} MB (system memory unknown)",
                estimated_mb
            ),
        };

    write_entry(
        "ALLOC_CHECKPOINT",
        &format!("About to: {}\n{}", operation, mem_status),
    );

    // Also log to standard logger
    if let Some(m) = &mem {
        info!(
            "[MEMORY] {} — need {} MB, have {} MB available",
            operation, estimated_mb, m.available_mb
        );
    }
}

/// Log that an allocation completed successfully and memory was reclaimed.
pub fn checkpoint_after_free(operation: &str) {
    let mem = read_system_memory();
    let mem_status = match &mem {
        Some(m) => format!("  System memory after: {}", m),
        None => "  (system memory unknown)".to_string(),
    };

    write_entry(
        "ALLOC_FREED",
        &format!("Completed: {}\n{}", operation, mem_status),
    );
}

/// Check if a planned allocation is safe given current available memory.
/// Returns Ok(()) if safe, Err with a detailed message if it would likely OOM.
///
/// Safety margin: we require at least 512 MB headroom AFTER the allocation,
/// to leave room for the OS, desktop environment, and Antigravity IDE.
pub fn guard_allocation(operation: &str, estimated_bytes: u64) -> anyhow::Result<()> {
    const HEADROOM_MB: u64 = 512;

    let mem = match read_system_memory() {
        Some(m) => m,
        None => {
            // Can't read memory — log warning but proceed
            warn!(
                "[MEMORY_GUARD] Cannot read /proc/meminfo, skipping safety check for: {}",
                operation
            );
            return Ok(());
        }
    };

    let estimated_mb = estimated_bytes / (1024 * 1024);
    let needed_mb = estimated_mb + HEADROOM_MB;

    // Consider swap as emergency overflow, but only 50% of it
    let effective_available = mem.available_mb + (mem.swap_free_mb / 2);

    if needed_mb > effective_available {
        let msg = format!(
            "MEMORY GUARD BLOCKED: '{}'\n\
             \n\
             Estimated allocation:  {} MB\n\
             Safety headroom:       {} MB\n\
             Total needed:          {} MB\n\
             Available RAM:         {} MB\n\
             Available swap (50%%): {} MB\n\
             Effective available:   {} MB\n\
             \n\
             DEFICIT: {} MB\n\
             \n\
             This allocation would likely trigger the Linux OOM killer.\n\
             Try a smaller --crop-preset (e.g., 5x5km instead of 10x10km)\n\
             or close other applications to free RAM.",
            operation,
            estimated_mb,
            HEADROOM_MB,
            needed_mb,
            mem.available_mb,
            mem.swap_free_mb / 2,
            effective_available,
            needed_mb - effective_available,
        );

        write_entry("MEMORY_GUARD_BLOCK", &msg);

        anyhow::bail!(
            "\n╔══════════════════════════════════════════════════════╗\n\
             ║  ⛔ MEMORY SAFETY: Operation blocked to prevent OOM  ║\n\
             ╠══════════════════════════════════════════════════════╣\n\
             ║  Operation: {:<40} ║\n\
             ║  Needs:     {:<6} MB                                ║\n\
             ║  Available: {:<6} MB (RAM + 50% swap)               ║\n\
             ║  Deficit:   {:<6} MB                                ║\n\
             ╠══════════════════════════════════════════════════════╣\n\
             ║  💡 Fix: use --crop-preset 5x5km or close apps      ║\n\
             ╚══════════════════════════════════════════════════════╝",
            operation,
            needed_mb,
            effective_available,
            needed_mb.saturating_sub(effective_available)
        );
    }

    // Log that we passed the guard
    info!(
        "[MEMORY_GUARD] PASSED: '{}' needs ~{} MB, {} MB effective available ({} MB headroom)",
        operation,
        estimated_mb,
        effective_available,
        effective_available - needed_mb
    );

    Ok(())
}

/// Write a phase transition marker — useful for understanding pipeline progress after a crash.
pub fn phase(name: &str, detail: &str) {
    let mem = read_system_memory()
        .map(|m| format!(" [RAM: {} MB avail]", m.available_mb))
        .unwrap_or_default();

    write_entry("PHASE", &format!(">>> {} — {}{}", name, detail, mem));
}

/// Record a panic in the crash journal. Install this as a panic hook in main().
pub fn panic_hook(info: &std::panic::PanicHookInfo<'_>) {
    let mem = read_system_memory()
        .map(|m| format!("\n  System memory at panic: {}", m))
        .unwrap_or_default();

    let location = info
        .location()
        .map(|l| format!("{}:{}:{}", l.file(), l.line(), l.column()))
        .unwrap_or_else(|| "unknown".to_string());

    let payload = if let Some(s) = info.payload().downcast_ref::<&str>() {
        s.to_string()
    } else if let Some(s) = info.payload().downcast_ref::<String>() {
        s.clone()
    } else {
        "non-string panic payload".to_string()
    };

    write_entry(
        "PANIC",
        &format!(
            "Process panicked!\n  Location: {}\n  Message: {}{}",
            location, payload, mem
        ),
    );
}

/// A timed scope guard that logs how long an operation took.
/// Usage:
/// ```no_run
/// let _timer = sar_science_processor::crash_journal::timed_scope("Loading HDF5 dataset");
/// // ... do work ...
/// // timer auto-logs on drop
/// ```
pub struct TimedScope {
    name: String,
    start: Instant,
}

impl Drop for TimedScope {
    fn drop(&mut self) {
        let elapsed = self.start.elapsed();
        write_entry(
            "TIMER",
            &format!("'{}' completed in {:.2}s", self.name, elapsed.as_secs_f64()),
        );
    }
}

pub fn timed_scope(name: &str) -> TimedScope {
    write_entry("TIMER_START", &format!("'{}' started", name));
    TimedScope {
        name: name.to_string(),
        start: Instant::now(),
    }
}
