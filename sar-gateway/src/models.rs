use serde::{Deserialize, Serialize};

#[derive(Deserialize, Debug)]
pub struct SearchQuery {
    pub lat: f64,
    pub lon: f64,
    pub start_date: Option<String>,
    pub end_date: Option<String>,
}

/// Body of `POST /jobs`. Unknown fields sent by older dashboards are ignored.
#[derive(Serialize, Deserialize, Debug, Clone, Default, PartialEq)]
pub struct ProcessRequest {
    /// Later ("active") GCOV granule path.
    pub input_file: Option<String>,
    /// Earlier ("baseline") GCOV granule path.
    pub slave_file: Option<String>,
    /// Only "flood" is supported by the science processor.
    pub pipeline: Option<String>,
    pub crop_lat: Option<f64>,
    pub crop_lon: Option<f64>,
    /// "full", "20x20km", "10x10km", "5x5km", "1x1km"
    pub crop_preset: Option<String>,
    pub gunw_file: Option<String>,
    /// Optional reference water mask (GeoTIFF) passed as --water-mask.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub water_mask: Option<String>,
    pub min_change_db: Option<f32>,
    pub seed_threshold_db: Option<f32>,
    pub growth_threshold_db: Option<f32>,
    pub min_area_pixels: Option<usize>,
    /// "l" or "s"
    pub radar_band: Option<String>,
    pub permanent_water_thresh_db: Option<f32>,
    pub swath_edge_erosion: Option<usize>,
    pub polarization: Option<String>,
    /// Detection method: "v2" (stable water must also be dark on the later date, L-band) or none for v1.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub method: Option<String>,
    /// Run again even if an identical finished run exists.
    #[serde(default)]
    pub force: bool,
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
    pub mddl_level_m: Option<f64>,
    pub storage_pct: Option<f64>,
    pub inflow_cumecs: Option<f64>,
    pub outflow_cumecs: Option<f64>,
    pub river_basin: Option<String>,
}
#[derive(Deserialize, Debug, Clone)]
pub struct NisarSearchQuery {
    pub bbox: String, // format: "minLon,minLat,maxLon,maxLat"
    pub start_date: Option<String>,
    pub end_date: Option<String>,
    pub platform: Option<String>,
    pub processing_level: Option<String>,
    /// ASF relative orbit / NISAR track, e.g. 98.
    pub relative_orbit: Option<String>,
    /// ASF frame filter. For the Bihar reference stack this is 14.
    #[serde(alias = "frame")]
    pub asfframe: Option<String>,
    /// NISAR simultaneous L/S observation filter.
    pub joint_observation: Option<bool>,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
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
