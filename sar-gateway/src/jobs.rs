use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::{broadcast, RwLock};
use tokio::time::Duration;
use uuid::Uuid;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;
use std::process::Stdio;
use log::{info, error};

use kube::{
    api::{Api, PostParams, LogParams, ListParams},
    Client, CustomResource,
};
use schemars::JsonSchema;
use k8s_openapi::api::core::v1::Pod;
use futures_util::{StreamExt, AsyncBufReadExt as FuturesAsyncBufReadExt};

// Matches the CRD deployed in cluster
#[derive(CustomResource, Deserialize, Serialize, Clone, Debug, JsonSchema)]
#[kube(group = "sar.example.com", version = "v1", kind = "SarJob", namespaced)]
#[kube(status = "SarJobStatus")]
pub struct SarJobSpec {
    pub scene_id: String,
    pub output_storage_path: String,
    pub processing_pipeline: Option<String>,
    pub analysis_purpose: Option<String>,
    pub ml_models: Option<Vec<String>>,
}

#[derive(Deserialize, Serialize, Clone, Debug, Default, PartialEq, JsonSchema)]
pub struct SarJobStatus {
    pub phase: String,
    pub job_name: Option<String>,
    pub message: String,
}

#[derive(Serialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum JobStatus {
    Queued,
    Running,
    Completed,
    Failed(String),
}

/// Georeferencing bounding box from the processor
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct GeoBbox {
    pub south: f64,
    pub north: f64,
    pub west: f64,
    pub east: f64,
}

pub struct JobMetadata {
    pub id: String,
    pub status: JobStatus,
    pub logs: Vec<String>,
    pub tx: broadcast::Sender<String>,
    pub output_path: Option<String>,
    pub bbox: Option<GeoBbox>,
    pub flood_report_path: Option<String>,
    pub flood_geojson_path: Option<String>,
    pub flood_baseline_path: Option<String>,
    pub flood_active_path: Option<String>,
    pub created_at: std::time::Instant,
    pub cancel_tx: Option<tokio::sync::mpsc::Sender<()>>,
}

#[derive(Serialize)]
pub struct JobResponse {
    pub id: String,
    pub status: JobStatus,
    pub output_path: Option<String>,
    pub bbox: Option<GeoBbox>,
    pub flood_report_path: Option<String>,
    pub flood_geojson_path: Option<String>,
    pub flood_baseline_path: Option<String>,
    pub flood_active_path: Option<String>,
}

impl JobMetadata {
    pub fn get_bbox_with_fallback(&self) -> Option<GeoBbox> {
        if let Some(ref bb) = self.bbox {
            return Some(bb.clone());
        }
        if self.status == JobStatus::Completed {
            if let Some(ref report_path) = self.flood_report_path {
                let fs_path = report_path.trim_start_matches('/');
                let candidates = [
                    std::path::PathBuf::from(fs_path),
                    std::path::PathBuf::from("results").join(fs_path.trim_start_matches("results/")),
                ];
                for path in &candidates {
                    if let Ok(content) = std::fs::read_to_string(path) {
                        if let Ok(report_json) = serde_json::from_str::<serde_json::Value>(&content) {
                            if let Some(bbox_val) = report_json.get("georef_bbox") {
                                if let Ok(bbox) = serde_json::from_value::<GeoBbox>(bbox_val.clone()) {
                                    return Some(bbox);
                                }
                            }
                            if let Some(crop) = report_json.get("crop") {
                                if let (Some(center_lat), Some(center_lon)) = (
                                    crop.get("center_lat").and_then(|v| v.as_f64()),
                                    crop.get("center_lon").and_then(|v| v.as_f64()),
                                ) {
                                    let preset = crop.get("preset").and_then(|v| v.as_str()).unwrap_or("5x5km");
                                    let (lat_half_km, lon_half_km) = match preset {
                                        "1x1km" => (0.5, 0.5),
                                        "5x5km" => (2.5, 2.5),
                                        "1x2km" => (0.5, 1.0),
                                        "10x10km" => (5.0, 5.0),
                                        "20x20km" => (10.0, 10.0),
                                        _ => (2.5, 2.5),
                                    };
                                    let lat_radius = lat_half_km / 111.0;
                                    let cos_lat = center_lat.to_radians().cos().abs().max(0.01);
                                    let lon_radius = lon_half_km / (111.0 * cos_lat);
                                    return Some(GeoBbox {
                                        south: center_lat - lat_radius,
                                        north: center_lat + lat_radius,
                                        west: center_lon - lon_radius,
                                        east: center_lon + lon_radius,
                                    });
                                }
                            }
                        }
                    }
                }
            }
        }
        None
    }

    pub fn to_response(&self) -> JobResponse {
        JobResponse {
            id: self.id.clone(),
            status: self.status.clone(),
            output_path: self.output_path.clone(),
            bbox: self.get_bbox_with_fallback(),
            flood_report_path: self.flood_report_path.clone(),
            flood_geojson_path: self.flood_geojson_path.clone(),
            flood_baseline_path: self.flood_baseline_path.clone(),
            flood_active_path: self.flood_active_path.clone(),
        }
    }
}

// Convert SarJobStatus phase to internal JobStatus
fn phase_to_status(phase: &str) -> JobStatus {
    match phase {
        "Pending" | "" => JobStatus::Queued,
        "Processing" => JobStatus::Running,
        "Completed" => JobStatus::Completed,
        "Failed" => JobStatus::Failed("K8s processing failed".into()),
        _ => JobStatus::Failed(format!("Unknown phase: {}", phase)),
    }
}

/// Determine whether to use local mode or K8s mode.
/// Local mode is used when LOCAL_MODE=true env var is set, or when K8s is unreachable.
fn is_local_mode() -> bool {
    std::env::var("LOCAL_MODE").map(|v| v == "true" || v == "1").unwrap_or(true)
}

pub async fn spawn_processing_job(
    state: crate::AppState,
    input_file: Option<String>,
    slave_file: Option<String>,
    _is_synthetic: bool,
    pipeline: Option<String>,
    crop_lat: Option<f64>,
    crop_lon: Option<f64>,
    crop_radius_km: Option<f64>,
    processor: Option<String>,
    crop_preset: Option<String>,
    gunw_file: Option<String>,
    min_change_db: Option<f32>,
    seed_threshold_db: Option<f32>,
    growth_threshold_db: Option<f32>,
    min_area_pixels: Option<usize>,
    radar_band: Option<String>,
    permanent_water_thresh_db: Option<f32>,
    swath_edge_erosion: Option<usize>,
    polarization: Option<String>,
    multilook_factor: Option<usize>,
) -> String {
    let job_id = format!("sar-{}", Uuid::new_v4().to_string().chars().take(8).collect::<String>());
    let (tx, _rx) = broadcast::channel(256);

    let metadata = Arc::new(RwLock::new(JobMetadata {
        id: job_id.clone(),
        status: JobStatus::Queued,
        logs: Vec::new(),
        tx: tx.clone(),
        output_path: None,
        bbox: None,
        flood_report_path: None,
        flood_geojson_path: None,
        flood_baseline_path: None,
        flood_active_path: None,
        created_at: std::time::Instant::now(),
        cancel_tx: None, // Will be set if local mode
    }));

    {
        let mut jobs = state.jobs.write().await;
        jobs.insert(job_id.clone(), metadata.clone());
    }

    let job_id_clone = job_id.clone();

    if is_local_mode() {
        let (cancel_tx, cancel_rx) = tokio::sync::mpsc::channel(1);
        metadata.write().await.cancel_tx = Some(cancel_tx);
        let semaphore = state.processor_semaphore.clone();

        // ─── LOCAL SUBPROCESS MODE: spawn processor as a child process ───
        tokio::spawn(async move {
            spawn_local_job(
                job_id_clone,
                input_file,
                slave_file,
                metadata,
                pipeline,
                crop_lat,
                crop_lon,
                crop_radius_km,
                processor,
                crop_preset,
                gunw_file,
                min_change_db,
                seed_threshold_db,
                growth_threshold_db,
                min_area_pixels,
                radar_band,
                permanent_water_thresh_db,
                swath_edge_erosion,
                polarization,
                multilook_factor,
                cancel_rx,
                semaphore,
            ).await;
        });
    } else {
        // ═══════════════════════════════════════════════════════════════
        // K8S MODE: create SarJob CRD (existing behavior)
        // ═══════════════════════════════════════════════════════════════
        tokio::spawn(async move {
            spawn_k8s_job(job_id_clone, input_file, metadata, pipeline).await;
        });
    }

    job_id
}

/// Local subprocess execution: spawn processor binary, stream stdout/stderr via SSE
async fn spawn_local_job(
    job_id: String,
    input_file: Option<String>,
    slave_file: Option<String>,
    metadata: Arc<RwLock<JobMetadata>>,
    pipeline: Option<String>,
    crop_lat: Option<f64>,
    crop_lon: Option<f64>,
    crop_radius_km: Option<f64>,
    processor: Option<String>,
    crop_preset: Option<String>,
    gunw_file: Option<String>,
    min_change_db: Option<f32>,
    seed_threshold_db: Option<f32>,
    growth_threshold_db: Option<f32>,
    min_area_pixels: Option<usize>,
    radar_band: Option<String>,
    permanent_water_thresh_db: Option<f32>,
    swath_edge_erosion: Option<usize>,
    polarization: Option<String>,
    multilook_factor: Option<usize>,
    mut cancel_rx: tokio::sync::mpsc::Receiver<()>,
    semaphore: Arc<tokio::sync::Semaphore>,
) {
    let results_dir = std::path::Path::new("results");
    if !results_dir.exists() {
        tokio::fs::create_dir_all(results_dir).await.ok();
    }

    let output_path = if pipeline.as_deref() == Some("flood") {
        let dir = std::path::Path::new("results").join("jobs").join(&job_id);
        tokio::fs::create_dir_all(&dir).await.ok();
        format!("results/jobs/{}/{}", job_id, job_id)
    } else {
        format!("results/{}.tif", job_id)
    };

    // Input file is required — processor no longer supports synthetic mode
    let input = match input_file {
        Some(f) if !f.is_empty() && f != "internal://generate_test_pattern" => f,
        _ => {
            error!("No input file provided for job {}. Processor requires --input.", job_id);
            let mut m = metadata.write().await;
            m.status = JobStatus::Failed("No input file provided. Select a NISAR product to process.".to_string());
            let _ = m.tx.send("[ERROR] No input file provided.".to_string());
            return;
        }
    };

    fn normalize_path_str(raw: &str) -> String {
        let trimmed = raw.trim();
        if trimmed.is_empty() {
            return String::new();
        }
        if std::path::Path::new(trimmed).exists() {
            return trimmed.to_string();
        }
        let with_slash = format!("/{}", trimmed.trim_start_matches('/'));
        if std::path::Path::new(&with_slash).exists() {
            info!("Auto-correcting missing leading slash: {} -> {}", trimmed, with_slash);
            return with_slash;
        }
        trimmed.to_string()
    }

    let input = normalize_path_str(&input);
    let slave_file = slave_file.map(|s| normalize_path_str(&s));

    // ═══════════════════════════════════════════════════════════════════
    // BINARY DISPATCH: SAR Science Processor vs Standard Processor
    // ═══════════════════════════════════════════════════════════════════
    let use_science = processor.as_deref() == Some("science");
    if !use_science {
        // The old sar_processor (InSAR / infrastructure modes) was removed from the repo.
        let msg = "This mode needs the old sar_processor, which has been removed. Use the flood profile (sar_science_processor).";
        error!("Job {}: {}", job_id, msg);
        let mut m = metadata.write().await;
        m.status = JobStatus::Failed(msg.to_string());
        let _ = m.tx.send(format!("[ERROR] {}", msg));
        return;
    }
    let binary = find_science_processor_binary();
    info!("Local Mode: Using binary at {:?} (science={})", binary, use_science);

    let mut cmd = Command::new(&binary);
    cmd.stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .env("RUST_LOG", "info");

    // On Windows the gateway runs without a console, so stop each engine run
    // from opening its own black console window.
    #[cfg(windows)]
    {
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    if use_science {
        // ── SAR Science Processor args ────────────────────────────────
        cmd.args(["--input", &input, "--output", &output_path.replace(".tif", "")]);

        // Determine mode: insar, flood, or gcov
        let mode = match pipeline.as_deref() {
            Some("insar") => "insar",
            Some("flood") => "flood",
            _ => "gcov",
        };
        cmd.args(["--mode", mode]);

        if mode == "insar" || mode == "flood" {
            if let Some(ref slave) = slave_file {
                cmd.args(["--slave", slave]);
            } else if mode == "insar" {
                cmd.args(["--slave", &input]); // self-interferometry fallback for insar only
            }
        }

        if let (Some(lat), Some(lon)) = (crop_lat, crop_lon) {
            cmd.args([
                "--crop-lat", &lat.to_string(),
                "--crop-lon", &lon.to_string(),
            ]);
        }

        if let Some(ref preset) = crop_preset {
            cmd.args(["--crop-preset", preset]);
        }

        if let Some(ref gunw) = gunw_file {
            cmd.args(["--gunw", gunw]);
        }
        if let Some(min_ch) = min_change_db {
            cmd.args(["--min-change-db", &min_ch.to_string()]);
        }
        if let Some(seed_th) = seed_threshold_db {
            cmd.args(["--seed-threshold-db", &seed_th.to_string()]);
        }
        if let Some(growth_th) = growth_threshold_db {
            cmd.args(["--growth-threshold-db", &growth_th.to_string()]);
        }
        if let Some(min_area) = min_area_pixels {
            cmd.args(["--min-area-pixels", &min_area.to_string()]);
        }
        if let Some(ref band) = radar_band {
            cmd.args(["--radar-band", band]);
        }
        if let Some(ref channel) = polarization {
            cmd.args(["--polarization", channel]);
        }
        if let Some(looks) = multilook_factor {
            cmd.args(["--multilook-factor", &looks.to_string()]);
        }
        if let Some(threshold) = permanent_water_thresh_db {
            cmd.args(["--permanent-water-thresh-db", &threshold.to_string()]);
        }
        if let Some(erosion) = swath_edge_erosion {
            cmd.args(["--swath-edge-erosion", &erosion.to_string()]);
        }
    } else {
        // ── Standard sar_processor args (unchanged) ──────────────────
        cmd.args(["--input", &input, "--output", &output_path]);

        if pipeline.as_deref() == Some("insar") {
            let is_gunw = input.contains("_GUNW_") ||
                          input.ends_with("_gunw.h5");

            if !is_gunw {
                if let Some(ref slave) = slave_file {
                    cmd.args(["--insar-slave", slave]);
                } else {
                    cmd.args(["--insar-slave", &input]);
                }
            }

            if let (Some(lat), Some(lon)) = (crop_lat, crop_lon) {
                cmd.args([
                    "--crop-lat", &lat.to_string(),
                    "--crop-lon", &lon.to_string(),
                ]);
                if let Some(r) = crop_radius_km {
                    cmd.args(["--crop-radius-km", &r.to_string()]);
                }
            }
        } else if pipeline.as_deref() == Some("cfar") {
            cmd.args(["--ship-detect"]);
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // CONCURRENCY CONTROL: Wait for processor permit
    // ═══════════════════════════════════════════════════════════════════
    {
        let m = metadata.read().await;
        let _ = m.tx.send("[SYSTEM] Enqueued in concurrency scheduler. Waiting for processor permit...".to_string());
    }

    let _permit = match semaphore.acquire().await {
        Ok(permit) => permit,
        Err(_) => {
            let mut m = metadata.write().await;
            m.status = JobStatus::Failed("Server concurrency limiter was closed".to_string());
            let _ = m.tx.send("[ERROR] Server concurrency limiter closed.".to_string());
            return;
        }
    };

    let binary_label = if use_science { "sar_science_processor" } else { "sar_processor" };
    {
        let mut m = metadata.write().await;
        m.status = JobStatus::Running;
        let _ = m.tx.send(format!("[SYSTEM] Processor permit acquired. Spawning {} (job={})", binary_label, job_id));
    }

    let mut child = match cmd.spawn() {
        Ok(c) => c,
        Err(e) => {
            let mut m = metadata.write().await;
            let err_msg = format!("[SYSTEM] SPAWN_FAILED: {} (binary={:?})", e, binary);
            m.status = JobStatus::Failed(err_msg.clone());
            let _ = m.tx.send(err_msg);
            return;
        }
    };

    let stdout = child.stdout.take().unwrap();
    let stderr = child.stderr.take().unwrap();

    let meta_stdout = metadata.clone();
    let meta_stderr = metadata.clone();

    // Stream stdout
    let stdout_handle = tokio::spawn(async move {
        let reader = BufReader::new(stdout);
        let mut lines = reader.lines();
        while let Ok(Some(line)) = lines.next_line().await {
            // Check for georef JSON event
            if line.contains("\"event\":\"georef\"") || line.contains("\"event\": \"georef\"") {
                if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&line) {
                    if let Some(bbox_val) = parsed.get("bbox") {
                        if let Ok(bbox) = serde_json::from_value::<GeoBbox>(bbox_val.clone()) {
                            let mut m = meta_stdout.write().await;
                            m.bbox = Some(bbox.clone());
                            let _ = m.tx.send(line.clone());
                            continue;
                        }
                    }
                }
            }
            let mut m = meta_stdout.write().await;
            m.logs.push(line.clone());
            let _ = m.tx.send(line);
        }
    });

    // Stream stderr (env_logger writes to stderr)
    let stderr_handle = tokio::spawn(async move {
        let reader = BufReader::new(stderr);
        let mut lines = reader.lines();
        while let Ok(Some(line)) = lines.next_line().await {
            let mut m = meta_stderr.write().await;
            m.logs.push(line.clone());
            let _ = m.tx.send(line);
        }
    });

    // Wait for process to finish or be cancelled or timeout
    let timeout_duration = std::time::Duration::from_secs(1800); // 30 mins
    
    let exit_status = tokio::select! {
        res = tokio::time::timeout(timeout_duration, child.wait()) => {
            match res {
                Ok(Ok(status)) => Some(status),
                Ok(Err(e)) => {
                    let mut m = metadata.write().await;
                    let err = format!("Process wait error: {}", e);
                    m.status = JobStatus::Failed(err.clone());
                    let _ = m.tx.send(format!("[SYSTEM] PROCESS_FAILED: {}", err));
                    None
                },
                Err(_) => { // Timeout
                    let _ = child.kill().await;
                    let mut m = metadata.write().await;
                    m.status = JobStatus::Failed("Job timed out after 30 minutes".to_string());
                    let _ = m.tx.send("[SYSTEM] PROCESS_TIMEOUT".to_string());
                    None
                }
            }
        },
        _ = cancel_rx.recv() => {
            let _ = child.kill().await;
            let mut m = metadata.write().await;
            m.status = JobStatus::Failed("Job cancelled by user".to_string());
            let _ = m.tx.send("[SYSTEM] PROCESS_CANCELLED".to_string());
            None
        }
    };

    stdout_handle.await.ok();
    stderr_handle.await.ok();

    if let Some(status) = exit_status {
        let mut m = metadata.write().await;
        if status.success() {
            m.status = JobStatus::Completed;
            if pipeline.as_deref() == Some("flood") {
                let prefix = format!("/results/jobs/{}/{}", job_id, job_id);
                m.output_path = Some(format!("{}_flood.png", prefix));
                m.flood_report_path = Some(format!("{}_flood.json", prefix));
                m.flood_geojson_path = Some(format!("{}_flood.geo.json", prefix));
                m.flood_baseline_path = Some(format!("{}_flood_baseline.png", prefix));
                m.flood_active_path = Some(format!("{}_flood_active.png", prefix));
            } else if use_science && (pipeline.as_deref() == Some("gcov") || pipeline.is_none()) {
                m.output_path = Some(format!("/results/{}.png", job_id));
            } else if use_science && pipeline.as_deref() == Some("insar") {
                m.output_path = Some(format!("/results/{}_insar.png", job_id));
            } else {
                m.output_path = Some(format!("/results/{}.tif", job_id));
            }

            // Fallback: If bbox was not captured via SSE georef event, read from flood report JSON
            if m.bbox.is_none() {
                if let Some(fb_bbox) = m.get_bbox_with_fallback() {
                    m.bbox = Some(fb_bbox);
                }
            }

            let _ = m.tx.send("[SYSTEM] PROCESS_COMPLETED".to_string());
            info!("Job {} completed successfully", job_id);
        } else {
            let err = format!("Process exited with code: {:?}", status.code());
            m.status = JobStatus::Failed(err.clone());
            let _ = m.tx.send(format!("[SYSTEM] PROCESS_FAILED: {}", err));
        }
    }
}

/// Locate the sar_science_processor binary (SAR Science InSAR/GCOV engine)
fn find_science_processor_binary() -> String {
    let possible_paths = [
        "../sar_science_processor/target/release/sar_science_processor",
        "../sar_science_processor/target/debug/sar_science_processor",
        "./sar_science_processor",
    ];

    for p in &possible_paths {
        if std::path::Path::new(p).exists() {
            return p.to_string();
        }
        // Windows builds produce <name>.exe
        let exe = format!("{}.exe", p);
        if std::path::Path::new(&exe).exists() {
            return exe;
        }
    }

    "sar_science_processor".to_string()
}

/// K8s CRD-based job execution (original implementation)
async fn spawn_k8s_job(
    job_id: String,
    input_file: Option<String>,
    metadata: Arc<RwLock<JobMetadata>>,
    _pipeline: Option<String>,
) {
    let results_dir = std::path::Path::new("results");
    if !results_dir.exists() {
        tokio::fs::create_dir_all(results_dir).await.ok();
    }

    let output_img = format!("/tmp/results/{}.png", job_id);
    let scene_name = input_file.clone().unwrap_or_else(|| "synthetic_test".to_string());

    let client = match Client::try_default().await {
        Ok(c) => c,
        Err(e) => {
            let mut m = metadata.write().await;
            m.status = JobStatus::Failed("Failed to connect to K8s Cluster".to_string());
            let _ = m.tx.send(format!("[SYSTEM] KUBE_CONN_ERROR: {}", e));
            return;
        }
    };

    let sarjobs_api: Api<SarJob> = Api::default_namespaced(client.clone());
    let _ = metadata.read().await.tx.send("[SYSTEM] Submitting SarJob custom resource to Kubernetes cluster...".into());

    let sarjob = SarJob::new(&job_id, SarJobSpec {
        scene_id: scene_name.clone(),
        output_storage_path: output_img.clone(),
        processing_pipeline: Some("InSAR".into()),
        analysis_purpose: Some("Maritime Surveillance".into()),
        ml_models: Some(vec!["ShipDetection".into()]),
    });

    match sarjobs_api.create(&PostParams::default(), &sarjob).await {
        Ok(_) => {
            let mut m = metadata.write().await;
            m.status = JobStatus::Running;
            let _ = m.tx.send(format!("[SYSTEM] K8s Operator accepted {}", job_id));
        },
        Err(e) => {
            let mut m = metadata.write().await;
            let err = format!("Failed to create K8s CRD: {}", e);
            m.status = JobStatus::Failed(err.clone());
            let _ = m.tx.send(err);
            return;
        }
    }

    // Loop to watch the K8s Operator pod creation and log streaming
    let pods_api: Api<Pod> = Api::default_namespaced(client.clone());
    let mut attached_to_logs = false;

    let timeout_duration = Duration::from_secs(1800);
    let start_time = tokio::time::Instant::now();

    loop {
        if start_time.elapsed() > timeout_duration {
            let mut m = metadata.write().await;
            m.status = JobStatus::Failed("Job timed out after 30 minutes".to_string());
            let _ = m.tx.send("[SYSTEM] PROCESS_TIMEOUT".to_string());
            break;
        }

        tokio::time::sleep(Duration::from_secs(2)).await;

        if let Ok(current_sj) = sarjobs_api.get(&job_id).await {
            if let Some(status) = current_sj.status {
                let mut m = metadata.write().await;
                m.status = phase_to_status(&status.phase);

                if status.phase == "Completed" {
                    m.output_path = Some(format!("/results/{}.tif", job_id));
                    let _ = m.tx.send("[SYSTEM] PROCESS_COMPLETED".to_string());
                    break;
                } else if status.phase == "Failed" {
                    let _ = m.tx.send(format!("[SYSTEM] PROCESS_FAILED: {}", status.message));
                    break;
                }
            }
        }

        if !attached_to_logs {
            let label_selector = format!("sarjob={}", job_id);
            let lp = ListParams::default().labels(&label_selector);

            if let Ok(pod_list) = pods_api.list(&lp).await {
                if let Some(pod) = pod_list.items.first() {
                    let pod_name = pod.metadata.name.clone().unwrap_or_default();
                    let _ = metadata.read().await.tx.send(format!("[SYSTEM] K8s Pod Assigned: {}. Establishing log stream...", pod_name));
                    attached_to_logs = true;

                    let meta_clone = metadata.clone();
                    let p_name = pod_name.clone();
                    let p_api = pods_api.clone();

                    tokio::spawn(async move {
                        let logp = LogParams {
                            follow: true,
                            ..Default::default()
                        };

                        for _ in 0..10 {
                            match p_api.log_stream(&p_name, &logp).await {
                                Ok(logs) => {
                                    let mut reader = logs.lines();
                                    while let Some(Ok(line)) = reader.next().await {
                                        let mut m = meta_clone.write().await;
                                        m.logs.push(line.clone());
                                        let _ = m.tx.send(line);
                                    }
                                    break;
                                },
                                Err(_) => {
                                    tokio::time::sleep(Duration::from_secs(1)).await;
                                }
                            }
                        }
                    });
                }
            }
        }
    }
}

pub fn delete_job_files(job_id: &str) -> (usize, u64) {
    let mut files_deleted = 0;
    let mut freed_bytes = 0;
    let results_dir = std::path::Path::new("results");

    // 1. Check nested directory `results/jobs/{job_id}`
    let job_dir = results_dir.join("jobs").join(job_id);
    if job_dir.exists() && job_dir.is_dir() {
        if let Ok(entries) = std::fs::read_dir(&job_dir) {
            for entry in entries.flatten() {
                if let Ok(meta) = entry.metadata() {
                    freed_bytes += meta.len();
                    files_deleted += 1;
                }
            }
        }
        let _ = std::fs::remove_dir_all(&job_dir);
    }

    // 2. Check flat files starting with `{job_id}` in `results/`
    if let Ok(entries) = std::fs::read_dir(results_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() {
                if let Some(name) = path.file_name().and_then(|f| f.to_str()) {
                    if name.starts_with(job_id) {
                        if let Ok(meta) = path.metadata() {
                            freed_bytes += meta.len();
                            files_deleted += 1;
                        }
                        let _ = std::fs::remove_file(&path);
                    }
                }
            }
        }
    }

    (files_deleted, freed_bytes)
}

pub async fn cancel_job(state: crate::AppState, job_id: String) -> Result<(), String> {
    let jobs = state.jobs.read().await;
    if let Some(metadata_lock) = jobs.get(&job_id) {
        let mut metadata = metadata_lock.write().await;
        if let Some(tx) = metadata.cancel_tx.take() {
            let _ = tx.send(()).await;
            Ok(())
        } else {
            Err("Job already completed, failed, or cannot be cancelled".to_string())
        }
    } else {
        Err("Job not found".to_string())
    }
}

pub async fn delete_job(state: crate::AppState, job_id: &str) -> Result<usize, String> {
    // 1. Cancel if still executing
    let _ = cancel_job(state.clone(), job_id.to_string()).await;

    // 2. Remove physical artifacts on disk
    let (deleted_files, _freed_bytes) = delete_job_files(job_id);

    // 3. Remove in-memory job handle
    let mut jobs = state.jobs.write().await;
    if jobs.remove(job_id).is_some() || deleted_files > 0 {
        Ok(deleted_files)
    } else {
        Err(format!("Job {} not found", job_id))
    }
}

#[derive(Debug, Default, serde::Serialize)]
pub struct PruneSummary {
    pub jobs_deleted: usize,
    pub files_deleted: usize,
    pub freed_bytes: u64,
}

pub async fn prune_jobs(state: crate::AppState, keep_count: usize) -> Result<PruneSummary, String> {
    let mut summary = PruneSummary::default();

    // Collect job IDs sorted by creation time (newest first)
    let sorted_jobs = {
        let jobs = state.jobs.read().await;
        let mut list = Vec::new();
        for (id, meta_lock) in jobs.iter() {
            let meta = meta_lock.read().await;
            list.push((meta.created_at, id.clone()));
        }
        list.sort_by(|a, b| b.0.cmp(&a.0));
        list
    };

    let jobs_to_remove: Vec<(std::time::Instant, String)> = if keep_count == 0 {
        sorted_jobs
    } else if keep_count < sorted_jobs.len() {
        sorted_jobs[keep_count..].to_vec()
    } else {
        Vec::new()
    };

    let mut jobs_map = state.jobs.write().await;
    for (_, id) in jobs_to_remove {
        jobs_map.remove(&id);
        let (files, bytes) = delete_job_files(&id);
        summary.jobs_deleted += 1;
        summary.files_deleted += files;
        summary.freed_bytes += bytes;
    }

    // Sweep orphaned cache files and logs in results/
    let results_dir = std::path::Path::new("results");
    if let Ok(entries) = std::fs::read_dir(results_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() {
                if let Some(name) = path.file_name().and_then(|f| f.to_str()) {
                    if name == ".gitkeep" || name == "README.md" {
                        continue;
                    }
                    if name.ends_with(".npz") || name == "crash_journal.log" || keep_count == 0 {
                        if let Ok(meta) = path.metadata() {
                            summary.freed_bytes += meta.len();
                            summary.files_deleted += 1;
                        }
                        let _ = std::fs::remove_file(&path);
                    }
                }
            }
        }
    }

    Ok(summary)
}

pub fn start_cleanup_task(state: crate::AppState) {
    tokio::spawn(async move {
        loop {
            tokio::time::sleep(tokio::time::Duration::from_secs(600)).await;
            
            // Auto-retention: Keep at most 10 recent flood jobs, prune older runs
            let jobs_count = { state.jobs.read().await.len() };
            if jobs_count > 10 {
                let _ = prune_jobs(state.clone(), 10).await;
            }
        }
    });
}

