//! Per-stage wall-clock timing, written to the log as `[timing] <stage>: <s> s`.
//! Lets us see where a run spends its time before optimising anything.
use std::sync::Mutex;
use std::time::Instant;

static LAST: Mutex<Option<Instant>> = Mutex::new(None);

/// Log the time since the previous `lap` (or since the first call) under `stage`.
pub fn lap(stage: &str) {
    let now = Instant::now();
    let mut last = LAST.lock().unwrap_or_else(|e| e.into_inner());
    if let Some(prev) = *last {
        log::info!("[timing] {stage}: {:.2} s", (now - prev).as_secs_f64());
    }
    *last = Some(now);
}
