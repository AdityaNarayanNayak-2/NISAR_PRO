use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::sync::{broadcast, RwLock};
use tokio::time::{timeout, Duration};
use uuid::Uuid;

use kube::{
    api::{Api, PostParams, LogParams, ListParams},
    Client, CustomResource,
};
use schemars::JsonSchema;
use k8s_openapi::api::core::v1::Pod;

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

pub struct JobMetadata {
    pub id: String,
    pub status: JobStatus,
    pub logs: Vec<String>,
    pub tx: broadcast::Sender<String>,
    pub output_path: Option<String>,
}

#[derive(Serialize)]
pub struct JobResponse {
    pub id: String,
    pub status: JobStatus,
    pub output_path: Option<String>,
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

pub async fn spawn_processing_job(
    state: crate::AppState,
    input_file: Option<String>,
    _is_synthetic: bool,
) -> String {
    let job_id = format!("sar-{}", Uuid::new_v4().to_string().chars().take(8).collect::<String>());
    let (tx, _rx) = broadcast::channel(100);

    let metadata = Arc::new(RwLock::new(JobMetadata {
        id: job_id.clone(),
        status: JobStatus::Queued,
        logs: Vec::new(),
        tx: tx.clone(),
        output_path: None,
    }));

    {
        let mut jobs = state.jobs.write().await;
        jobs.insert(job_id.clone(), metadata.clone());
    }

    let job_id_clone = job_id.clone();

    // Instead of spawning local process, we spawn a K8s task controller orchestrator loop
    tokio::spawn(async move {
        let results_dir = std::path::Path::new("results");
        if !results_dir.exists() {
            tokio::fs::create_dir_all(results_dir).await.ok();
        }
        
        let output_img = format!("/tmp/results/{}.png", job_id_clone); // Inside Pod
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
        let _ = metadata.tx.send("[SYSTEM] Submitting SarJob custom resource to Kubernetes cluster...".into());

        // Hardcoding standard parameters for demonstration of phase 4 implementation
        let sarjob = SarJob::new(&job_id_clone, SarJobSpec {
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
                let _ = m.tx.send(format!("[SYSTEM] K8s Operator accepted {}", job_id_clone));
            },
            Err(e) => {
                let mut m = metadata.write().await;
                let err = format!("Failed to create K8s CRD: {}", e);
                m.status = JobStatus::Failed(err.clone());
                let _ = m.tx.send(err);
                return;
            }
        }

        // Loop to watch the K8s Operator pod creation and log streaming!
        let pods_api: Api<Pod> = Api::default_namespaced(client.clone());
        let mut attached_to_logs = false;
        
        // Timeout set to 30 mins
        let timeout_duration = Duration::from_secs(1800);
        let mut start_time = tokio::time::Instant::now();

        loop {
            if start_time.elapsed() > timeout_duration {
                let mut m = metadata.write().await;
                m.status = JobStatus::Failed("Job timed out after 30 minutes".to_string());
                let _ = m.tx.send("[SYSTEM] PROCESS_TIMEOUT".to_string());
                break;
            }

            tokio::time::sleep(Duration::from_secs(2)).await;

            // 1. Check CRD Status
            if let Ok(current_sj) = sarjobs_api.get(&job_id_clone).await {
                if let Some(status) = current_sj.status {
                    let mut m = metadata.write().await;
                    m.status = phase_to_status(&status.phase);
                    
                    if status.phase == "Completed" {
                        m.output_path = Some(format!("/results/{}.png", job_id_clone));
                        let _ = m.tx.send("[SYSTEM] PROCESS_COMPLETED".to_string());
                        break;
                    } else if status.phase == "Failed" {
                        let _ = m.tx.send(format!("[SYSTEM] PROCESS_FAILED: {}", status.message));
                        break;
                    }
                }
            }

            // 2. Discover Pod & Stream Logs (if not attached yet)
            if !attached_to_logs {
                let label_selector = format!("sarjob={}", job_id_clone);
                let lp = ListParams::default().labels(&label_selector);
                
                if let Ok(pod_list) = pods_api.list(&lp).await {
                    if let Some(pod) = pod_list.items.first() {
                        let pod_name = pod.metadata.name.clone().unwrap_or_default();
                        
                        let _ = metadata.tx.send(format!("[SYSTEM] K8s Pod Assigned: {}. Establishing log stream...", pod_name));
                        attached_to_logs = true;

                        let meta_clone = metadata.clone();
                        let p_name = pod_name.clone();
                        let p_api = pods_api.clone();
                        
                        tokio::spawn(async move {
                            let mut logp = LogParams::default();
                            logp.follow = true;
                            
                            // Retry mechanism for getting log stream to let the container boot
                            for _ in 0..10 {
                                match p_api.log_stream(&p_name, &logp).await {
                                    Ok(mut logs) => {
                                        let mut reader = BufReader::new(tokio_util::io::StreamReader::new(logs)).lines();
                                        while let Ok(Some(line)) = reader.next_line().await {
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
    });

    job_id
}
