//! Run registry.
//!
//! Every run lives in its own folder `results/jobs/<id>/`:
//!   job.json                 what was asked for, when, and the final status
//!   <id>_flood.json          processor report (areas, method, product, bounds)
//!   <id>_flood.png           class overlay (Web Mercator, transparent outside data)
//!   <id>_flood_active.png    radar preview of the later date
//!   <id>_flood_baseline.png  radar preview of the earlier date
//!   <id>_flood.geo.json      newly detected water polygons
//!   <id>_flood_class.tif     class raster on the native UTM grid
//!
//! On start-up every folder with a report is loaded. Runs with identical inputs
//! and settings (same "fingerprint") are duplicates: only the newest is kept and
//! the older folders are deleted. The same check runs when a new run finishes,
//! and a request identical to a finished run returns that run instead of
//! processing again (unless `force` is set).

use crate::models::ProcessRequest;
use log::{error, info, warn};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;
use tokio::sync::{broadcast, RwLock};
use uuid::Uuid;

const RUN_TIMEOUT_SECS: u64 = 1800;

#[derive(Serialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum JobStatus {
    Queued,
    Running,
    Completed,
    Failed(String),
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct GeoBbox {
    pub south: f64,
    pub north: f64,
    pub west: f64,
    pub east: f64,
}

/// URLs of the files a finished run produced. Only files that exist are listed.
#[derive(Serialize, Clone, Debug, Default)]
pub struct Artifacts {
    pub report: Option<String>,
    pub overlay: Option<String>,
    pub active_preview: Option<String>,
    pub baseline_preview: Option<String>,
    pub geojson: Option<String>,
    pub class_tif: Option<String>,
}

pub struct JobMetadata {
    pub id: String,
    pub status: JobStatus,
    pub logs: Vec<String>,
    pub tx: broadcast::Sender<String>,
    /// Unix seconds.
    pub created_at: u64,
    pub request: Option<ProcessRequest>,
    pub fingerprint: Option<String>,
    pub bbox: Option<GeoBbox>,
    pub summary: Option<Value>,
    pub artifacts: Artifacts,
    pub cancel_tx: Option<tokio::sync::mpsc::Sender<()>>,
}

#[derive(Serialize)]
pub struct JobResponse {
    pub id: String,
    pub status: JobStatus,
    pub created_at: u64,
    pub bbox: Option<GeoBbox>,
    /// Band, dates, crop and areas read from the report (km² and acres).
    pub summary: Option<Value>,
    pub artifacts: Artifacts,
    pub fingerprint: Option<String>,
    /// Settings the run was started with (absent for runs saved before job.json existed).
    pub request: Option<ProcessRequest>,
    // Older field names, kept so existing dashboards keep working.
    pub output_path: Option<String>,
    pub flood_report_path: Option<String>,
    pub flood_geojson_path: Option<String>,
    pub flood_baseline_path: Option<String>,
    pub flood_active_path: Option<String>,
}

impl JobMetadata {
    fn new(id: String, created_at: u64, request: Option<ProcessRequest>) -> Self {
        let (tx, _) = broadcast::channel(512);
        JobMetadata {
            id,
            status: JobStatus::Queued,
            logs: Vec::new(),
            tx,
            created_at,
            request,
            fingerprint: None,
            bbox: None,
            summary: None,
            artifacts: Artifacts::default(),
            cancel_tx: None,
        }
    }

    /// Keep a log line for late subscribers and send it to live ones.
    fn emit(&mut self, line: impl Into<String>) {
        let line = line.into();
        self.logs.push(line.clone());
        let _ = self.tx.send(line);
    }

    pub fn to_response(&self) -> JobResponse {
        let a = self.artifacts.clone();
        JobResponse {
            id: self.id.clone(),
            status: self.status.clone(),
            created_at: self.created_at,
            bbox: self.bbox.clone(),
            summary: self.summary.clone(),
            fingerprint: self.fingerprint.clone(),
            request: self.request.clone(),
            output_path: a.overlay.clone(),
            flood_report_path: a.report.clone(),
            flood_geojson_path: a.geojson.clone(),
            flood_baseline_path: a.baseline_preview.clone(),
            flood_active_path: a.active_preview.clone(),
            artifacts: a,
        }
    }
}

// ─── Paths ──────────────────────────────────────────────────────────────────

fn jobs_root() -> PathBuf {
    Path::new("results").join("jobs")
}

/// Job ids come from URLs, so only allow plain names before touching the disk.
pub fn is_safe_id(id: &str) -> bool {
    !id.is_empty() && id.len() <= 96 && id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
}

fn now_unix() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0)
}

fn url_if_exists(dir: &Path, id: &str, file: &str) -> Option<String> {
    dir.join(file).is_file().then(|| format!("/results/jobs/{}/{}", id, file))
}

fn find_report(dir: &Path) -> Option<PathBuf> {
    std::fs::read_dir(dir).ok()?.flatten().map(|e| e.path()).find(|p| {
        p.file_name().and_then(|f| f.to_str()).is_some_and(|n| n.ends_with("_flood.json"))
    })
}

// ─── Reading a finished run ─────────────────────────────────────────────────

/// `YYYY-MM-DD` from a NISAR granule name (first `YYYYMMDDTHHMMSS` token).
fn granule_date(name: &str) -> Option<String> {
    name.split('_').find_map(|t| {
        let b = t.as_bytes();
        (b.len() == 15 && b[8] == b'T' && b[..8].iter().all(u8::is_ascii_digit))
            .then(|| format!("{}-{}-{}", &t[0..4], &t[4..6], &t[6..8]))
    })
}

fn f(v: &Value, path: &[&str]) -> Option<f64> {
    path.iter().try_fold(v, |acc, k| acc.get(k))?.as_f64()
}

fn s(v: &Value, path: &[&str]) -> Option<String> {
    path.iter().try_fold(v, |acc, k| acc.get(k))?.as_str().map(str::to_string)
}

/// Small summary for run lists. Every number is copied from the report.
fn summarize(report: &Value) -> Value {
    let active = s(report, &["product", "active_id"]).unwrap_or_default();
    let baseline = s(report, &["product", "baseline_id"]).unwrap_or_default();
    let area = |k: &str| json!({ "km2": f(report, &["areas", &format!("{k}_km2")]), "acres": f(report, &["areas", &format!("{k}_acres")]) });
    json!({
        "band": s(report, &["product", "frequency"]),
        "active_id": active,
        "baseline_id": baseline,
        "active_date": granule_date(&active),
        "baseline_date": granule_date(&baseline),
        "crop_preset": s(report, &["crop", "preset"]),
        "new_water": area("total_flood"),
        "stable_water": area("permanent_water"),
        "water_loss": area("receded_water"),
        "valid_area": area("valid_area"),
        "regions": report.get("flood_regions"),
    })
}

/// Identity of a run's inputs and settings. Two runs with the same fingerprint
/// produce the same maps, so the older one is a duplicate.
fn fingerprint(report: &Value) -> String {
    let n = |p: &[&str]| f(report, p).map(|x| format!("{x:.4}")).unwrap_or_else(|| "-".into());
    let t = |p: &[&str]| s(report, p).unwrap_or_else(|| "-".into());
    [
        t(&["product", "frequency"]),
        t(&["product", "active_id"]),
        t(&["product", "baseline_id"]),
        t(&["product", "polarization"]),
        t(&["crop", "preset"]),
        n(&["crop", "center_lat"]),
        n(&["crop", "center_lon"]),
        n(&["method", "seed_threshold_db"]),
        n(&["method", "growth_threshold_db"]),
        n(&["method", "min_change_db"]),
        n(&["method", "permanent_water_thresh_db"]),
        n(&["method", "swath_edge_erosion_px"]),
        n(&["method", "min_area_pixels"]),
    ]
    .join("|")
}

fn bbox_from_report(report: &Value) -> Option<GeoBbox> {
    serde_json::from_value(report.get("georef_bbox")?.clone()).ok()
}

/// Fill summary, bounds, fingerprint and artifact URLs from the run folder.
/// Returns false if there is no readable report.
fn attach_results(m: &mut JobMetadata, dir: &Path) -> bool {
    let Some(report_path) = find_report(dir) else { return false };
    let Some(report) = std::fs::read_to_string(&report_path).ok().and_then(|t| serde_json::from_str::<Value>(&t).ok()) else {
        return false;
    };
    // Files share the prefix of the report name (older runs may differ from the folder name).
    let prefix = report_path.file_name().and_then(|f| f.to_str()).unwrap_or("").trim_end_matches("_flood.json").to_string();
    let id = m.id.clone();
    m.artifacts = Artifacts {
        report: url_if_exists(dir, &id, &format!("{prefix}_flood.json")),
        overlay: url_if_exists(dir, &id, &format!("{prefix}_flood.png")),
        active_preview: url_if_exists(dir, &id, &format!("{prefix}_flood_active.png")),
        baseline_preview: url_if_exists(dir, &id, &format!("{prefix}_flood_baseline.png")),
        geojson: url_if_exists(dir, &id, &format!("{prefix}_flood.geo.json")),
        class_tif: url_if_exists(dir, &id, &format!("{prefix}_flood_class.tif")),
    };
    m.bbox = bbox_from_report(&report).or(m.bbox.take());
    m.summary = Some(summarize(&report));
    m.fingerprint = Some(fingerprint(&report));
    true
}

#[derive(Serialize, Deserialize)]
struct JobFile {
    id: String,
    created_at: u64,
    status: String,
    request: Option<ProcessRequest>,
}

fn write_job_file(m: &JobMetadata) {
    let status = match &m.status {
        JobStatus::Queued => "queued".to_string(),
        JobStatus::Running => "running".to_string(),
        JobStatus::Completed => "completed".to_string(),
        JobStatus::Failed(e) => format!("failed: {e}"),
    };
    let file = JobFile { id: m.id.clone(), created_at: m.created_at, status, request: m.request.clone() };
    let dir = jobs_root().join(&m.id);
    // Keep the processor log next to the results once the run has ended.
    if matches!(m.status, JobStatus::Completed | JobStatus::Failed(_)) {
        let _ = std::fs::write(dir.join("run.log"), m.logs.join("\n"));
    }
    let path = dir.join("job.json");
    if let Ok(text) = serde_json::to_string_pretty(&file) {
        if let Err(e) = std::fs::write(&path, text) {
            warn!("Could not write {}: {}", path.display(), e);
        }
    }
}

fn load_run(dir: &Path) -> Option<JobMetadata> {
    let id = dir.file_name()?.to_str()?.to_string();
    if !is_safe_id(&id) {
        return None;
    }
    let job_file: Option<JobFile> =
        std::fs::read_to_string(dir.join("job.json")).ok().and_then(|t| serde_json::from_str(&t).ok());
    let created_at = job_file.as_ref().map(|j| j.created_at).unwrap_or_else(|| {
        find_report(dir)
            .and_then(|p| p.metadata().ok()?.modified().ok())
            .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
            .map(|d| d.as_secs())
            .unwrap_or(0)
    });
    let mut m = JobMetadata::new(id, created_at, job_file.as_ref().and_then(|j| j.request.clone()));
    // run.log is the gateway's copy of the processor output. Older run folders only have
    // the engine's own crash_journal.log, so show that instead.
    if let Ok(text) = std::fs::read_to_string(dir.join("run.log"))
        .or_else(|_| std::fs::read_to_string(dir.join("crash_journal.log")))
    {
        m.logs = text.lines().map(str::to_string).collect();
    }
    if attach_results(&mut m, dir) {
        m.status = JobStatus::Completed;
        m.logs.push("[SYSTEM] Loaded saved run from disk.".into());
        Some(m)
    } else if job_file.is_some() {
        // Started but never finished (gateway stopped mid-run).
        m.status = JobStatus::Failed("Interrupted: the gateway stopped before this run finished.".into());
        Some(m)
    } else {
        None
    }
}

fn delete_run_dir(id: &str) -> usize {
    if !is_safe_id(id) {
        return 0;
    }
    let dir = jobs_root().join(id);
    let n = std::fs::read_dir(&dir).map(|d| d.count()).unwrap_or(0);
    if dir.is_dir() {
        if let Err(e) = std::fs::remove_dir_all(&dir) {
            warn!("Could not delete {}: {}", dir.display(), e);
            return 0;
        }
    }
    n
}

/// Load every saved run, then delete older duplicates.
pub async fn preload_runs(state: &crate::AppState) {
    let root = jobs_root();
    let _ = std::fs::create_dir_all(&root);
    let mut runs: Vec<JobMetadata> = std::fs::read_dir(&root)
        .map(|d| d.flatten().filter(|e| e.path().is_dir()).filter_map(|e| load_run(&e.path())).collect())
        .unwrap_or_default();

    // Newest first, so the first run seen for a fingerprint is the one kept.
    runs.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    let mut seen = std::collections::HashSet::new();
    let mut jobs = state.jobs.write().await;
    let mut removed = 0;
    for m in runs {
        if let Some(fp) = m.fingerprint.clone() {
            if !seen.insert(fp) {
                info!("Removing duplicate run {} (a newer identical run exists)", m.id);
                delete_run_dir(&m.id);
                removed += 1;
                continue;
            }
        }
        jobs.insert(m.id.clone(), Arc::new(RwLock::new(m)));
    }
    info!("📂 Loaded {} saved run(s), removed {} duplicate(s).", jobs.len(), removed);
}

/// After `keep_id` finished, delete other finished runs with the same fingerprint.
async fn remove_duplicates_of(state: &crate::AppState, keep_id: &str, fp: &str) -> Vec<String> {
    let mut dupes = Vec::new();
    {
        let jobs = state.jobs.read().await;
        for (id, lock) in jobs.iter() {
            if id == keep_id {
                continue;
            }
            let m = lock.read().await;
            if m.status == JobStatus::Completed && m.fingerprint.as_deref() == Some(fp) {
                dupes.push(id.clone());
            }
        }
    }
    let mut jobs = state.jobs.write().await;
    for id in &dupes {
        jobs.remove(id);
        delete_run_dir(id);
    }
    dupes
}

// ─── Starting a run ─────────────────────────────────────────────────────────

pub struct StartResult {
    pub job_id: String,
    /// True when an identical finished run was returned instead of a new run.
    pub reused: bool,
}

fn file_exists(p: &Option<String>) -> bool {
    p.as_deref().is_some_and(|p| Path::new(p.trim()).is_file())
}

pub async fn start_job(state: crate::AppState, mut req: ProcessRequest) -> Result<StartResult, String> {
    // Only the science processor's flood mode exists; reject anything else early.
    let pipeline = req.pipeline.clone().unwrap_or_else(|| "flood".into());
    if pipeline != "flood" {
        return Err(format!("Pipeline '{pipeline}' is not available. Only 'flood' (water change) runs are supported."));
    }
    req.pipeline = Some(pipeline);
    req.input_file = req.input_file.map(|p| p.trim().to_string());
    req.slave_file = req.slave_file.map(|p| p.trim().to_string()).filter(|p| !p.is_empty());
    if !file_exists(&req.input_file) {
        return Err(format!("Active (later) file not found: {}", req.input_file.as_deref().unwrap_or("(none)")));
    }
    if !file_exists(&req.slave_file) {
        return Err(format!("Baseline (earlier) file not found: {}", req.slave_file.as_deref().unwrap_or("(none)")));
    }
    for (label, f) in [("GUNW coherence file", &mut req.gunw_file), ("Water mask file", &mut req.water_mask)] {
        *f = f.take().map(|p| p.trim().to_string()).filter(|p| !p.is_empty());
        if f.is_some() && !file_exists(f) {
            return Err(format!("{label} not found: {}", f.as_deref().unwrap_or("")));
        }
    }
    if let Some(p) = &req.polarization {
        if !["HH", "HV", "VV", "VH"].contains(&p.to_uppercase().as_str()) {
            return Err(format!("Polarization must be HH, HV, VV or VH (got {p})."));
        }
    }
    if let (Some(seed), Some(growth)) = (req.seed_threshold_db, req.growth_threshold_db) {
        if seed > growth {
            return Err(format!("Seed threshold ({seed} dB) must be at or below the growth threshold ({growth} dB)."));
        }
    }

    // Same request as a finished run: return it instead of processing again.
    if !req.force {
        let mut probe = req.clone();
        probe.force = false;
        let jobs = state.jobs.read().await;
        for lock in jobs.values() {
            let m = lock.read().await;
            if m.status == JobStatus::Completed && m.request.as_ref() == Some(&probe) {
                return Ok(StartResult { job_id: m.id.clone(), reused: true });
            }
        }
    }
    req.force = false;

    let job_id = format!("run-{}", &Uuid::new_v4().simple().to_string()[..8]);
    let dir = jobs_root().join(&job_id);
    std::fs::create_dir_all(&dir).map_err(|e| format!("Could not create {}: {e}", dir.display()))?;

    let mut m = JobMetadata::new(job_id.clone(), now_unix(), Some(req.clone()));
    let (cancel_tx, cancel_rx) = tokio::sync::mpsc::channel(1);
    m.cancel_tx = Some(cancel_tx);
    write_job_file(&m);
    let meta = Arc::new(RwLock::new(m));
    state.jobs.write().await.insert(job_id.clone(), meta.clone());

    let st = state.clone();
    let id = job_id.clone();
    tokio::spawn(async move { run_processor(st, id, req, meta, cancel_rx).await });
    Ok(StartResult { job_id, reused: false })
}

fn processor_args(req: &ProcessRequest, output: &str) -> Vec<String> {
    let mut a: Vec<String> = vec!["--mode".into(), "flood".into(), "--output".into(), output.into()];
    let mut push = |k: &str, v: String| {
        a.push(k.into());
        a.push(v);
    };
    push("--input", req.input_file.clone().unwrap_or_default());
    if let Some(v) = &req.slave_file { push("--slave", v.clone()); }
    if let (Some(lat), Some(lon)) = (req.crop_lat, req.crop_lon) {
        push("--crop-lat", lat.to_string());
        push("--crop-lon", lon.to_string());
    }
    if let Some(v) = &req.crop_preset { push("--crop-preset", v.clone()); }
    if let Some(v) = &req.gunw_file { if !v.trim().is_empty() { push("--gunw", v.clone()); } }
    if let Some(v) = &req.water_mask { if !v.trim().is_empty() { push("--water-mask", v.clone()); } }
    if let Some(v) = req.min_change_db { push("--min-change-db", v.to_string()); }
    if let Some(v) = req.seed_threshold_db { push("--seed-threshold-db", v.to_string()); }
    if let Some(v) = req.growth_threshold_db { push("--growth-threshold-db", v.to_string()); }
    if let Some(v) = req.min_area_pixels { push("--min-area-pixels", v.to_string()); }
    if let Some(v) = &req.radar_band { push("--radar-band", v.clone()); }
    if let Some(v) = &req.polarization { push("--polarization", v.clone()); }
    if let Some(v) = req.permanent_water_thresh_db { push("--permanent-water-thresh-db", v.to_string()); }
    if let Some(v) = req.swath_edge_erosion { push("--swath-edge-erosion", v.to_string()); }
    a
}

async fn fail(meta: &Arc<RwLock<JobMetadata>>, msg: String) {
    let mut m = meta.write().await;
    error!("Job {}: {}", m.id, msg);
    m.status = JobStatus::Failed(msg.clone());
    m.emit(format!("[SYSTEM] PROCESS_FAILED: {msg}"));
    write_job_file(&m);
}

async fn run_processor(
    state: crate::AppState,
    job_id: String,
    req: ProcessRequest,
    meta: Arc<RwLock<JobMetadata>>,
    mut cancel_rx: tokio::sync::mpsc::Receiver<()>,
) {
    let dir = jobs_root().join(&job_id);
    let output = dir.join(&job_id).to_string_lossy().to_string();
    let binary = find_science_processor_binary();

    meta.write().await.emit("[SYSTEM] Waiting for a free processor slot...");
    let _permit = match state.processor_semaphore.clone().acquire_owned().await {
        Ok(p) => p,
        Err(_) => return fail(&meta, "Processor scheduler closed".into()).await,
    };

    let mut cmd = Command::new(&binary);
    cmd.args(processor_args(&req, &output))
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .env("RUST_LOG", "info")
        .kill_on_drop(true);
    #[cfg(windows)]
    {
        // The gateway runs without a console; don't open one per run.
        cmd.creation_flags(0x0800_0000);
    }

    let mut child = match cmd.spawn() {
        Ok(c) => c,
        Err(e) => return fail(&meta, format!("Could not start {binary}: {e}")).await,
    };
    {
        let mut m = meta.write().await;
        m.status = JobStatus::Running;
        m.emit(format!("[SYSTEM] Processor started ({binary})"));
        write_job_file(&m);
    }

    let pump = |stream: Box<dyn tokio::io::AsyncRead + Unpin + Send>, meta: Arc<RwLock<JobMetadata>>| {
        tokio::spawn(async move {
            let mut lines = BufReader::new(stream).lines();
            while let Ok(Some(line)) = lines.next_line().await {
                let mut m = meta.write().await;
                if line.contains("\"event\":\"georef\"") {
                    if let Some(bb) = serde_json::from_str::<Value>(&line)
                        .ok()
                        .and_then(|v| serde_json::from_value::<GeoBbox>(v.get("bbox")?.clone()).ok())
                    {
                        m.bbox = Some(bb);
                    }
                }
                m.emit(line);
            }
        })
    };
    let out_task = pump(Box::new(child.stdout.take().unwrap()), meta.clone());
    let err_task = pump(Box::new(child.stderr.take().unwrap()), meta.clone());

    let result = tokio::select! {
        r = tokio::time::timeout(std::time::Duration::from_secs(RUN_TIMEOUT_SECS), child.wait()) => match r {
            Ok(Ok(status)) if status.success() => Ok(()),
            Ok(Ok(status)) => Err(format!("Processor exited with code {:?}", status.code())),
            Ok(Err(e)) => Err(format!("Processor wait error: {e}")),
            Err(_) => { let _ = child.kill().await; Err(format!("Timed out after {} minutes", RUN_TIMEOUT_SECS / 60)) }
        },
        _ = cancel_rx.recv() => { let _ = child.kill().await; Err("Cancelled by user".into()) }
    };
    let _ = out_task.await;
    let _ = err_task.await;

    if let Err(msg) = result {
        return fail(&meta, msg).await;
    }

    let fp = {
        let mut m = meta.write().await;
        m.cancel_tx = None;
        if !attach_results(&mut m, &dir) {
            drop(m);
            return fail(&meta, "Processor finished but wrote no report".into()).await;
        }
        m.status = JobStatus::Completed;
        write_job_file(&m);
        m.fingerprint.clone()
    };
    if let Some(fp) = fp {
        for old in remove_duplicates_of(&state, &job_id, &fp).await {
            meta.write().await.emit(format!("[SYSTEM] Removed older identical run {old}"));
        }
    }
    let mut m = meta.write().await;
    m.emit("[SYSTEM] PROCESS_COMPLETED");
    write_job_file(&m);
    info!("Job {} completed", job_id);
}

/// The science processor binary next to the gateway (dev tree or packaged app).
fn find_science_processor_binary() -> String {
    let candidates = [
        "../sar_science_processor/target/release/sar_science_processor",
        "../sar_science_processor/target/debug/sar_science_processor",
        "./sar_science_processor",
    ];
    for p in candidates {
        if Path::new(p).exists() {
            return p.to_string();
        }
        let exe = format!("{p}.exe");
        if Path::new(&exe).exists() {
            return exe;
        }
    }
    "sar_science_processor".to_string()
}

// ─── Cancel / delete / prune ────────────────────────────────────────────────

pub async fn cancel_job(state: crate::AppState, job_id: String) -> Result<(), String> {
    let jobs = state.jobs.read().await;
    let lock = jobs.get(&job_id).ok_or("Job not found")?;
    let mut m = lock.write().await;
    match m.cancel_tx.take() {
        Some(tx) => {
            let _ = tx.send(()).await;
            Ok(())
        }
        None => Err("Job is not running".into()),
    }
}

pub async fn delete_job(state: crate::AppState, job_id: &str) -> Result<usize, String> {
    if !is_safe_id(job_id) {
        return Err("Invalid job id".into());
    }
    let _ = cancel_job(state.clone(), job_id.to_string()).await;
    let files = delete_run_dir(job_id);
    let removed = state.jobs.write().await.remove(job_id).is_some();
    if removed || files > 0 {
        Ok(files)
    } else {
        Err(format!("Job {job_id} not found"))
    }
}

#[derive(Debug, Default, Serialize)]
pub struct PruneSummary {
    pub jobs_deleted: usize,
    pub files_deleted: usize,
}

/// Keep the `keep` newest finished runs and delete the rest. Only runs on request.
pub async fn prune_jobs(state: crate::AppState, keep: usize) -> Result<PruneSummary, String> {
    let mut finished = Vec::new();
    {
        let jobs = state.jobs.read().await;
        for (id, lock) in jobs.iter() {
            let m = lock.read().await;
            if !matches!(m.status, JobStatus::Queued | JobStatus::Running) {
                finished.push((m.created_at, id.clone()));
            }
        }
    }
    finished.sort_by(|a, b| b.0.cmp(&a.0));
    let mut summary = PruneSummary::default();
    let mut jobs = state.jobs.write().await;
    for (_, id) in finished.into_iter().skip(keep) {
        jobs.remove(&id);
        summary.files_deleted += delete_run_dir(&id);
        summary.jobs_deleted += 1;
    }
    Ok(summary)
}

// ─── Scene discovery ────────────────────────────────────────────────────────

#[derive(Serialize)]
pub struct SceneFile {
    pub path: String,
    pub name: String,
    pub band: Option<String>,
    pub date: Option<String>,
    pub track: Option<u32>,
    pub frame: Option<u32>,
    pub size_bytes: u64,
}

/// Folders searched for GCOV files: NISAR_DATA_DIRS (":" or ";" separated), else
/// ~/nisar_data, ~/Desktop/nisar_data, ~/Downloads and ./data.
fn data_dirs() -> Vec<PathBuf> {
    if let Ok(v) = std::env::var("NISAR_DATA_DIRS") {
        return v.split([':', ';']).filter(|s| !s.trim().is_empty()).map(PathBuf::from).collect();
    }
    let home = std::env::var("HOME").or_else(|_| std::env::var("USERPROFILE")).map(PathBuf::from).ok();
    let mut dirs = vec![PathBuf::from("data")];
    if let Some(h) = home {
        dirs.extend([h.join("nisar_data"), h.join("Desktop").join("nisar_data"), h.join("Downloads")]);
    }
    dirs
}

fn scene_from_path(p: &Path) -> Option<SceneFile> {
    let name = p.file_name()?.to_str()?.to_string();
    if !name.ends_with(".h5") || !name.contains("GCOV") {
        return None;
    }
    let band = if name.starts_with("NISAR_L2_") || name.contains("_LSAR_") {
        Some("l".to_string())
    } else if name.starts_with("NISAR_S2_") || name.contains("_SSAR_") {
        Some("s".to_string())
    } else {
        None
    };
    // ..._GCOV_<cycle>_<track>_<A|D>_<frame>_...
    let parts: Vec<&str> = name.split('_').collect();
    let g = parts.iter().position(|t| *t == "GCOV");
    let at = |i: usize| g.and_then(|g| parts.get(g + i)).and_then(|t| t.parse::<u32>().ok());
    Some(SceneFile {
        path: p.canonicalize().unwrap_or_else(|_| p.to_path_buf()).to_string_lossy().to_string(),
        date: granule_date(&name),
        band,
        track: at(2),
        frame: at(4),
        size_bytes: p.metadata().map(|m| m.len()).unwrap_or(0),
        name,
    })
}

/// GCOV files in the data folders (and one level of sub-folders), oldest first.
pub fn list_scenes() -> Vec<SceneFile> {
    let mut out = Vec::new();
    let mut seen = std::collections::HashSet::new();
    for dir in data_dirs() {
        let Ok(entries) = std::fs::read_dir(&dir) else { continue };
        for e in entries.flatten() {
            let p = e.path();
            let candidates: Vec<PathBuf> = if p.is_dir() {
                std::fs::read_dir(&p).map(|d| d.flatten().map(|e| e.path()).collect()).unwrap_or_default()
            } else {
                vec![p]
            };
            for c in candidates {
                if let Some(s) = scene_from_path(&c) {
                    if seen.insert(s.path.clone()) {
                        out.push(s);
                    }
                }
            }
        }
    }
    out.sort_by(|a, b| a.band.cmp(&b.band).then(a.date.cmp(&b.date)));
    out
}
