use kube::CustomResource;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

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
