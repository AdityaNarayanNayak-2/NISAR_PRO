use serde::{Deserialize, Serialize};

#[derive(Deserialize, Debug)]
pub struct SearchQuery {
    pub lat: f64,
    pub lon: f64,
    pub start_date: Option<String>,
    pub end_date: Option<String>,
}

#[derive(Serialize, Debug)]
pub struct SarScene {
    pub id: String,
    pub platform: String,
    pub date: String,
    pub footprint: String,
    pub quicklook_url: Option<String>,
}

// ESA OData Response Models (Simplified)
#[derive(Deserialize, Debug)]
pub struct EsaODataResponse {
    pub value: Vec<EsaProduct>,
}

#[derive(Deserialize, Debug)]
pub struct EsaProduct {
    #[serde(rename = "Id")]
    pub id: String,
    #[serde(rename = "Name")]
    pub name: String,
    #[serde(rename = "ContentDate")]
    pub content_date: ContentDate,
    // Add other fields as needed
}

#[derive(Deserialize, Debug)]
pub struct ContentDate {
    #[serde(rename = "Start")]
    pub start: String,
    #[serde(rename = "End")]
    pub end: String,
}
