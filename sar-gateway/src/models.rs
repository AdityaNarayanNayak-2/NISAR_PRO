use serde::{Deserialize, Serialize};

#[derive(Deserialize, Debug)]
pub struct SearchQuery {
    pub lat: f64,
    pub lon: f64,
    pub start_date: Option<String>,
    pub end_date: Option<String>,
}

#[derive(Deserialize, Debug)]
pub struct ProcessRequest {
    pub input_file: Option<String>,
    pub slave_file: Option<String>,
    pub synthetic: Option<bool>,
    pub pipeline: Option<String>,
    pub crop_lat: Option<f64>,
    pub crop_lon: Option<f64>,
    pub crop_radius_km: Option<f64>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct AssetResult {
    pub id: String,
    pub name: String,
    pub asset_type: String,
    pub lat: f64,
    pub lon: f64,
    pub display_name: String,
    pub country: String,
    pub state: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ContextResponse {
    pub reservoir: Option<String>,
    pub rainfall: Option<String>,
    pub soil_moisture: Option<String>,
    pub seismic: Option<String>,
    pub season: Option<String>,
    pub assessment: Option<String>,
    pub confidence: Option<String>,
    pub source: Option<String>,
    // Live WRIS data
    pub current_level_m: Option<f64>,
    pub full_reservoir_level_m: Option<f64>,
    pub storage_pct: Option<f64>,
    pub inflow_cumecs: Option<f64>,
    pub outflow_cumecs: Option<f64>,
    pub river_basin: Option<String>,
}
#[derive(Deserialize, Debug)]
pub struct NisarSearchQuery {
    pub bbox: String, // format: "minLon,minLat,maxLon,maxLat"
    pub start_date: Option<String>,
    pub end_date: Option<String>,
    pub platform: Option<String>,
}

#[derive(Serialize, Debug)]
pub struct NisarScene {
    pub id: String,
    pub date: String,
    pub footprint: serde_json::Value,
    pub download_url: String,
    pub size_bytes: String,
    pub platform: String,
}

#[derive(Serialize, Debug, Clone)]
#[allow(dead_code)]
pub struct SarScene {
    pub id: String,
    pub platform: String,
    pub date: String,
    pub footprint: String,
    pub quicklook_url: Option<String>,
}

// ESA OData Response Models (Simplified)
#[derive(Serialize, Deserialize, Debug)]
#[allow(dead_code)]
pub struct EsaODataResponse {
    pub value: Vec<EsaProduct>,
}

#[derive(Serialize, Deserialize, Debug)]
#[allow(dead_code)]
pub struct EsaProduct {
    #[serde(rename = "Id")]
    pub id: String,
    #[serde(rename = "Name")]
    pub name: String,
    #[serde(rename = "ContentDate")]
    pub content_date: ContentDate,
    // Add other fields as needed
}

#[derive(Serialize, Deserialize, Debug)]
#[allow(dead_code)]
pub struct ContentDate {
    #[serde(rename = "Start")]
    pub start: String,
    #[serde(rename = "End")]
    pub end: String,
}
