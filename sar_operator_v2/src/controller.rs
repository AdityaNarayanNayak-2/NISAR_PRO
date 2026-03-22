use k8s_openapi::api::batch::v1::{Job, JobSpec};
use k8s_openapi::api::core::v1::{Container, PodSpec, PodTemplateSpec};
use k8s_openapi::apimachinery::pkg::api::resource::Quantity;
use k8s_openapi::apimachinery::pkg::apis::meta::v1::ObjectMeta;
use kube::{
    api::{Api, Patch, PatchParams, PostParams, ResourceExt},
    client::Client,
    Resource,
};
use kube_runtime::controller::Action;
use std::{collections::BTreeMap, sync::Arc};
use thiserror::Error;
use tokio::time::Duration;

use crate::crd::{SarJob, SarJobStatus};

static SARJOB_FINALIZER: &str = "sarjobs.sar.example.com/finalizer";
const SAR_PROCESSOR_IMAGE: &str = "localhost/sar-processor:latest";

#[derive(Debug, Error)]
pub enum Error {
    #[error("Kube Error: {0}")]
    KubeError(#[from] kube::Error),
    #[error("Serialization Error: {0}")]
    SerializationError(#[from] serde_json::Error),
}

pub type Result<T, E = Error> = std::result::Result<T, E>;

#[derive(Clone)]
pub struct Context {
    pub client: Client,
}

fn create_sar_job_manifest(sar_job: &SarJob) -> Job {
    let job_name = format!("sar-proc-{}", sar_job.name_any());
    let scene_id = sar_job.spec.scene_id.clone();
    let output_path = sar_job.spec.output_storage_path.clone();

    Job {
        metadata: ObjectMeta {
            name: Some(job_name.clone()),
            labels: Some(BTreeMap::from([
                ("app".to_string(), "sar-processor".to_string()),
                ("sarjob".to_string(), sar_job.name_any()),
            ])),
            owner_references: Some(vec![sar_job.controller_owner_ref(&()).unwrap()]),
            ..Default::default()
        },
        spec: Some(JobSpec {
            template: PodTemplateSpec {
                metadata: Some(ObjectMeta {
                    labels: Some(BTreeMap::from([
                        ("app".to_string(), "sar-processor".to_string()),
                        ("sarjob".to_string(), sar_job.name_any()),
                    ])),
                    ..Default::default()
                }),
                spec: Some(PodSpec {
                    containers: vec![Container {
                        name: "sar-processor".to_string(),
                        image: Some(SAR_PROCESSOR_IMAGE.to_string()),
                        image_pull_policy: Some("IfNotPresent".to_string()),
                        env: Some(vec![
                            k8s_openapi::api::core::v1::EnvVar {
                                name: "SAR_SCENE_ID".to_string(),
                                value: Some(scene_id),
                                ..Default::default()
                            },
                            k8s_openapi::api::core::v1::EnvVar {
                                name: "SAR_OUTPUT_PATH".to_string(),
                                value: Some(output_path),
                                ..Default::default()
                            },
                            k8s_openapi::api::core::v1::EnvVar {
                                name: "SAR_PIPELINE".to_string(),
                                value: sar_job.spec.processing_pipeline.clone(),
                                ..Default::default()
                            },
                            k8s_openapi::api::core::v1::EnvVar {
                                name: "SAR_PURPOSE".to_string(),
                                value: sar_job.spec.analysis_purpose.clone(),
                                ..Default::default()
                            },
                            k8s_openapi::api::core::v1::EnvVar {
                                name: "SAR_ML_MODELS".to_string(),
                                value: sar_job.spec.ml_models.as_ref().map(|v| v.join(",")),
                                ..Default::default()
                            },
                        ]),
                        resources: Some(k8s_openapi::api::core::v1::ResourceRequirements {
                            limits: Some(BTreeMap::from([
                                ("cpu".to_string(), Quantity("2".to_string())),
                                ("memory".to_string(), Quantity("4Gi".to_string())),
                            ])),
                            requests: Some(BTreeMap::from([
                                ("cpu".to_string(), Quantity("1".to_string())),
                                ("memory".to_string(), Quantity("2Gi".to_string())),
                            ])),
                            ..Default::default()
                        }),
                        ..Default::default()
                    }],
                    restart_policy: Some("OnFailure".to_string()),
                    ..Default::default()
                }),
            },
            backoff_limit: Some(4),
            ..Default::default()
        }),
        status: None,
    }
}

pub async fn reconcile(sar_job: Arc<SarJob>, ctx: Arc<Context>) -> Result<Action> {
    let client = &ctx.client;
    let api: Api<SarJob> = Api::namespaced(client.clone(), &sar_job.namespace().unwrap());
    let jobs_api: Api<Job> = Api::namespaced(client.clone(), &sar_job.namespace().unwrap());

    let sar_job_name = sar_job.name_any();
    let job_name = format!("sar-proc-{}", sar_job_name);

    // Handle Finalizer
    if sar_job.metadata.deletion_timestamp.is_some() {
        if sar_job
            .metadata
            .finalizers
            .as_ref()
            .map(|f| f.contains(&SARJOB_FINALIZER.to_string()))
            .unwrap_or(false)
        {
            // Cleanup logic
            log::info!("Cleaning up SarJob {}", sar_job_name);
            let _ = jobs_api.delete(&job_name, &Default::default()).await;

            // Remove finalizer
            let patch = Patch::Merge(serde_json::json!({
                "metadata": {
                    "finalizers": null
                }
            }));
            api.patch(&sar_job_name, &PatchParams::default(), &patch)
                .await?;
        }
        return Ok(Action::await_change());
    }

    // Add Finalizer if missing
    if !sar_job
        .metadata
        .finalizers
        .as_ref()
        .map(|f| f.contains(&SARJOB_FINALIZER.to_string()))
        .unwrap_or(false)
    {
        log::info!("Adding finalizer to SarJob {}", sar_job_name);
        let patch = Patch::Merge(serde_json::json!({
            "metadata": {
                "finalizers": [SARJOB_FINALIZER]
            }
        }));
        api.patch(&sar_job_name, &PatchParams::default(), &patch)
            .await?;
        return Ok(Action::requeue(Duration::from_secs(2)));
    }

    let current_status = sar_job.status.as_ref().cloned().unwrap_or_default();

    match current_status.phase.as_str() {
        "Pending" | "" => {
            let job_manifest = create_sar_job_manifest(&sar_job);
            match jobs_api.create(&PostParams::default(), &job_manifest).await {
                Ok(_) => {
                    log::info!("Created K8s Job {} for SarJob {}", job_name, sar_job_name);
                    let new_status = SarJobStatus {
                        phase: "Processing".to_string(),
                        job_name: Some(job_name.clone()),
                        message: format!("K8s Job {} created.", job_name),
                        ..Default::default()
                    };
                    api.patch_status(
                        &sar_job_name,
                        &PatchParams::apply("sar-operator-v2"),
                        &Patch::Merge(serde_json::json!({ "status": new_status })),
                    )
                    .await?;
                    Ok(Action::requeue(Duration::from_secs(10)))
                }
                Err(kube::Error::Api(ref err)) if err.code == 409 => {
                    log::warn!("Job {} already exists.", job_name);
                    let new_status = SarJobStatus {
                        phase: "Processing".to_string(),
                        job_name: Some(job_name.clone()),
                        message: format!("Monitoring progress."),
                        ..Default::default()
                    };
                    api.patch_status(
                        &sar_job_name,
                        &PatchParams::apply("sar-operator-v2"),
                        &Patch::Merge(serde_json::json!({ "status": new_status })),
                    )
                    .await?;
                    Ok(Action::requeue(Duration::from_secs(10)))
                }
                Err(e) => Err(Error::KubeError(e)),
            }
        }
        "Processing" => {
            let job = jobs_api.get(&job_name).await?;
            if let Some(status) = job.status {
                if status.succeeded.unwrap_or(0) > 0 {
                    let new_status = SarJobStatus {
                        phase: "Completed".to_string(),
                        job_name: Some(job_name.clone()),
                        message: "Processing completed.".to_string(),
                        ..Default::default()
                    };
                    api.patch_status(
                        &sar_job_name,
                        &PatchParams::apply("sar-operator-v2"),
                        &Patch::Merge(serde_json::json!({ "status": new_status })),
                    )
                    .await?;
                    Ok(Action::await_change())
                } else if status.failed.unwrap_or(0) > 0 {
                    let new_status = SarJobStatus {
                        phase: "Failed".to_string(),
                        job_name: Some(job_name.clone()),
                        message: "Job failed.".to_string(),
                        ..Default::default()
                    };
                    api.patch_status(
                        &sar_job_name,
                        &PatchParams::apply("sar-operator-v2"),
                        &Patch::Merge(serde_json::json!({ "status": new_status })),
                    )
                    .await?;
                    Ok(Action::await_change())
                } else {
                    Ok(Action::requeue(Duration::from_secs(30)))
                }
            } else {
                Ok(Action::requeue(Duration::from_secs(10)))
            }
        }
        "Completed" | "Failed" => Ok(Action::await_change()),
        _ => Ok(Action::await_change()),
    }
}

pub fn error_policy(_sar_job: Arc<SarJob>, error: &Error, _ctx: Arc<Context>) -> Action {
    log::error!("reconcile failed: {}", error);
    Action::requeue(Duration::from_secs(60))
}
