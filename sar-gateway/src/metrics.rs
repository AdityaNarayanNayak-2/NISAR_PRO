//! Prometheus metrics, liveness and readiness for running the gateway under Kubernetes.
//!
//!   GET /metrics  Prometheus text format (no extra crates: counters are atomics)
//!   GET /healthz  liveness: the process answers
//!   GET /readyz   readiness: the engine binary exists and results/ is writable (503 otherwise)
use axum::{body::Body, extract::State, http::{Request, StatusCode}, middleware::Next, response::{IntoResponse, Response}};
use std::sync::atomic::{AtomicU64, Ordering::Relaxed};
use std::sync::OnceLock;
use std::time::{Instant, SystemTime, UNIX_EPOCH};

static RUNS_STARTED: AtomicU64 = AtomicU64::new(0);
static RUNS_COMPLETED: AtomicU64 = AtomicU64::new(0);
static RUNS_FAILED: AtomicU64 = AtomicU64::new(0);
static RUNS_REUSED: AtomicU64 = AtomicU64::new(0);

/// Engine run time buckets in seconds (a full scene pair takes 44–65 s on 4 cores).
const BUCKETS: [f64; 8] = [15.0, 30.0, 60.0, 90.0, 120.0, 300.0, 600.0, 1800.0];
static DURATION_BUCKETS: [AtomicU64; 8] = [const { AtomicU64::new(0) }; 8];
static DURATION_COUNT: AtomicU64 = AtomicU64::new(0);
static DURATION_SUM_MS: AtomicU64 = AtomicU64::new(0);

/// HTTP responses by status class: 1xx..5xx.
static HTTP: [AtomicU64; 5] = [const { AtomicU64::new(0) }; 5];

static STARTED_AT: OnceLock<f64> = OnceLock::new();
/// Unix seconds of the last request from a person (probes and scrapes do not count).
static LAST_ACTIVITY: AtomicU64 = AtomicU64::new(0);

fn now_secs() -> u64 { SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0) }

pub fn init() {
    LAST_ACTIVITY.store(now_secs(), Relaxed);
    let _ = STARTED_AT.set(SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_secs_f64()).unwrap_or(0.0));
}

pub fn run_started() { RUNS_STARTED.fetch_add(1, Relaxed); }
pub fn run_reused() { RUNS_REUSED.fetch_add(1, Relaxed); }

/// Record how a run ended and how long the engine took.
pub fn run_finished(ok: bool, started: Instant) {
    if ok { RUNS_COMPLETED.fetch_add(1, Relaxed); } else { RUNS_FAILED.fetch_add(1, Relaxed); }
    let secs = started.elapsed().as_secs_f64();
    for (i, b) in BUCKETS.iter().enumerate() {
        if secs <= *b { DURATION_BUCKETS[i].fetch_add(1, Relaxed); }
    }
    DURATION_COUNT.fetch_add(1, Relaxed);
    DURATION_SUM_MS.fetch_add((secs * 1000.0) as u64, Relaxed);
}

pub async fn http_counter(req: Request<Body>, next: Next) -> Response {
    if !matches!(req.uri().path(), "/metrics" | "/healthz" | "/readyz" | "/jobs/health-ping") {
        LAST_ACTIVITY.store(now_secs(), Relaxed);
    }
    let res = next.run(req).await;
    let class = (res.status().as_u16() / 100).clamp(1, 5) as usize - 1;
    HTTP[class].fetch_add(1, Relaxed);
    res
}

pub async fn metrics_handler(State(state): State<crate::AppState>) -> impl IntoResponse {
    let (mut queued, mut running, mut completed, mut failed) = (0u64, 0u64, 0u64, 0u64);
    for j in state.jobs.read().await.values() {
        match &j.read().await.status {
            crate::jobs::JobStatus::Queued => queued += 1,
            crate::jobs::JobStatus::Running => running += 1,
            crate::jobs::JobStatus::Completed => completed += 1,
            crate::jobs::JobStatus::Failed(_) => failed += 1,
        }
    }
    let slots = state.processor_semaphore.available_permits();
    let mut o = String::with_capacity(2048);
    let gauge = |o: &mut String, name: &str, help: &str, v: String| {
        o.push_str(&format!("# HELP {name} {help}\n# TYPE {name} gauge\n{name} {v}\n"));
    };
    o.push_str(&format!("# HELP nisar_build_info Gateway version.\n# TYPE nisar_build_info gauge\nnisar_build_info{{version=\"{}\"}} 1\n", env!("CARGO_PKG_VERSION")));
    gauge(&mut o, "nisar_process_start_time_seconds", "Unix time the gateway started.", format!("{:.0}", STARTED_AT.get().copied().unwrap_or(0.0)));
    gauge(&mut o, "nisar_last_activity_time_seconds", "Unix time of the last request that was not a probe or a scrape.", LAST_ACTIVITY.load(Relaxed).to_string());
    gauge(&mut o, "nisar_processor_free_slots", "Engine slots free right now (MAX_CONCURRENT_JOBS minus running).", slots.to_string());
    gauge(&mut o, "nisar_engine_ready", "1 if the science processor binary was found.", (crate::jobs::processor_found() as u8).to_string());
    o.push_str("# HELP nisar_jobs Runs known to the gateway, by status.\n# TYPE nisar_jobs gauge\n");
    for (s, v) in [("queued", queued), ("running", running), ("completed", completed), ("failed", failed)] {
        o.push_str(&format!("nisar_jobs{{status=\"{s}\"}} {v}\n"));
    }
    let counter = |o: &mut String, name: &str, help: &str, v: u64| {
        o.push_str(&format!("# HELP {name} {help}\n# TYPE {name} counter\n{name} {v}\n"));
    };
    counter(&mut o, "nisar_runs_started_total", "Engine runs started since the gateway started.", RUNS_STARTED.load(Relaxed));
    counter(&mut o, "nisar_runs_completed_total", "Engine runs that wrote a report.", RUNS_COMPLETED.load(Relaxed));
    counter(&mut o, "nisar_runs_failed_total", "Engine runs that failed, timed out or were cancelled.", RUNS_FAILED.load(Relaxed));
    counter(&mut o, "nisar_runs_reused_total", "Requests answered with an identical finished run.", RUNS_REUSED.load(Relaxed));
    o.push_str("# HELP nisar_run_duration_seconds Engine run time from start to exit.\n# TYPE nisar_run_duration_seconds histogram\n");
    for (i, b) in BUCKETS.iter().enumerate() {
        o.push_str(&format!("nisar_run_duration_seconds_bucket{{le=\"{b}\"}} {}\n", DURATION_BUCKETS[i].load(Relaxed)));
    }
    let n = DURATION_COUNT.load(Relaxed);
    o.push_str(&format!("nisar_run_duration_seconds_bucket{{le=\"+Inf\"}} {n}\n"));
    o.push_str(&format!("nisar_run_duration_seconds_sum {:.3}\nnisar_run_duration_seconds_count {n}\n", DURATION_SUM_MS.load(Relaxed) as f64 / 1000.0));
    o.push_str("# HELP nisar_http_responses_total HTTP responses by status class.\n# TYPE nisar_http_responses_total counter\n");
    for (i, c) in HTTP.iter().enumerate() {
        o.push_str(&format!("nisar_http_responses_total{{class=\"{}xx\"}} {}\n", i + 1, c.load(Relaxed)));
    }
    ([("content-type", "text/plain; version=0.0.4")], o)
}

pub async fn healthz() -> impl IntoResponse { (StatusCode::OK, "ok") }

pub async fn readyz() -> impl IntoResponse {
    let engine = crate::jobs::processor_found();
    let dir = std::path::Path::new("results").join("jobs");
    let writable = std::fs::create_dir_all(&dir).is_ok() && {
        let probe = dir.join(".ready-probe");
        let ok = std::fs::write(&probe, b"ok").is_ok();
        let _ = std::fs::remove_file(&probe);
        ok
    };
    let body = serde_json::json!({ "engine": engine, "results_writable": writable });
    let code = if engine && writable { StatusCode::OK } else { StatusCode::SERVICE_UNAVAILABLE };
    (code, axum::Json(body))
}
