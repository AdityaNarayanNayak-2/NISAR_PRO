use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::{broadcast, RwLock};
use tokio::time::Duration;
use uuid::Uuid;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;
use std::process::Stdio;
use log::info;

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

#[derive(Serialize, Clone, Debug)]
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
}

#[derive(Serialize)]
pub struct JobResponse {
    pub id: String,
    pub status: JobStatus,
    pub output_path: Option<String>,
    pub bbox: Option<GeoBbox>,
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
    _is_synthetic: bool,
    pipeline: Option<String>,
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
    }));

    {
        let mut jobs = state.jobs.write().await;
        jobs.insert(job_id.clone(), metadata.clone());
    }

    let job_id_clone = job_id.clone();

    if is_local_mode() {
        // ═══════════════════════════════════════════════════════════════
        // LOCAL SUBPROCESS MODE: spawn sar_processor as a child process
        // ═══════════════════════════════════════════════════════════════
        tokio::spawn(async move {
            spawn_local_job(job_id_clone, input_file, metadata, pipeline).await;
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

/// Local subprocess execution: spawn sar_processor binary, stream stdout/stderr via SSE
async fn spawn_local_job(
    job_id: String,
    input_file: Option<String>,
    metadata: Arc<RwLock<JobMetadata>>,
    pipeline: Option<String>,
) {
    let results_dir = std::path::Path::new("results");
    if !results_dir.exists() {
        tokio::fs::create_dir_all(results_dir).await.ok();
    }

    let output_path = format!("results/{}.png", job_id);
    let is_synthetic = input_file.is_none()
        || input_file.as_deref() == Some("internal://generate_test_pattern");

    // Locate the sar_processor binary (try release first, then debug)
    let binary = find_processor_binary();
    info!("Local Mode: Using binary at {:?}", binary);

    let mut cmd = Command::new(&binary);
    cmd.stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .env("RUST_LOG", "info");

    if is_synthetic {
        cmd.args(["--synthetic", "--output", &output_path]);
    } else {
        let input = input_file.unwrap_or_default();
        cmd.args(["--input", &input, "--output", &output_path]);
        
        if pipeline.as_deref() == Some("insar") {
            // For testing: we simulate a slave image by just passing the same input file 
            // OR a distinct file if it exists. Reusing input file serves as zero baseline.
            cmd.args(["--insar-slave", &input]);
        } else if pipeline.as_deref() == Some("cfar") {
            cmd.args(["--ship-detect"]);
        }
    }

    {
        let mut m = metadata.write().await;
        m.status = JobStatus::Running;
        let _ = m.tx.send(format!("[SYSTEM] LOCAL_MODE: Spawning sar_processor (job={})", job_id));
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
            if line.starts_with("{\"event\":\"georef\"") {
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

    // Wait for process to finish
    let exit = child.wait().await;
    stdout_handle.await.ok();
    stderr_handle.await.ok();

    let mut m = metadata.write().await;
    match exit {
        Ok(status) if status.success() => {
            m.status = JobStatus::Completed;
            m.output_path = Some(format!("/results/{}.png", job_id));
            let _ = m.tx.send("[SYSTEM] PROCESS_COMPLETED".to_string());
            info!("Job {} completed successfully", job_id);
        }
        Ok(status) => {
            let err = format!("Process exited with code: {:?}", status.code());
            m.status = JobStatus::Failed(err.clone());
            let _ = m.tx.send(format!("[SYSTEM] PROCESS_FAILED: {}", err));
        }
        Err(e) => {
            let err = format!("Process error: {}", e);
            m.status = JobStatus::Failed(err.clone());
            let _ = m.tx.send(format!("[SYSTEM] PROCESS_FAILED: {}", err));
        }
    }
}

/// Find the sar_processor binary, trying release then debug build
fn find_processor_binary() -> String {
    let possible_paths = [
        "../sar_processor/target/release/sar_processor",
        "../sar_processor/target/debug/sar_processor",
        "./sar_processor",
    ];

    for p in &possible_paths {
        if std::path::Path::new(p).exists() {
            return p.to_string();
        }
    }

    // Fallback: assume it's in PATH
    "sar_processor".to_string()
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
                    m.output_path = Some(format!("/results/{}.png", job_id));
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
                        let mut logp = LogParams::default();
                        logp.follow = true;

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
