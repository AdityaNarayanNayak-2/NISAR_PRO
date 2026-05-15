use crate::models::{NisarScene, NisarSearchQuery};
use reqwest::Client;
use std::error::Error;
use serde_json::Value;

pub struct NasaClient {
    client: Client,
}

impl Default for NasaClient {
    fn default() -> Self {
        Self::new()
    }
}

impl NasaClient {
    pub fn new() -> Self {
        Self {
            client: Client::new(),
        }
    }

    pub async fn search_nisar(&self, query: NisarSearchQuery) -> Result<Vec<NisarScene>, Box<dyn Error>> {
        let mut url = format!(
            "https://api.daac.asf.alaska.edu/services/search/param?platform=NISAR&output=geojson&intersectsWith={}",
            Self::bbox_to_wkt(&query.bbox)
        );

        if let Some(start) = query.start_date {
            url.push_str(&format!("&start={}", start));
        }
        if let Some(end) = query.end_date {
            url.push_str(&format!("&end={}", end));
        }

        log::info!("Querying NASA ASF: {}", url);

        let res = self.client.get(&url).send().await?.json::<Value>().await?;
        
        let mut scenes = Vec::new();

        if let Some(features) = res.get("features").and_then(|f| f.as_array()) {
            for feature in features.iter().take(20) {
                if let Some(props) = feature.get("properties") {
                    let id = props.get("sceneName").and_then(|v| v.as_str()).unwrap_or("UNKNOWN").to_string();
                    let date = props.get("startTime").and_then(|v| v.as_str()).unwrap_or("UNKNOWN").to_string();
                    let download_url = props.get("url").and_then(|v| v.as_str()).unwrap_or("").to_string();
                    let bytes = props.get("bytes").and_then(|v| v.as_str()).unwrap_or("0").to_string();
                    
                    let footprint = feature.get("geometry").cloned().unwrap_or(serde_json::json!({}));

                    scenes.push(NisarScene {
                        id,
                        date,
                        footprint,
                        download_url,
                        size_bytes: bytes,
                    });
                }
            }
        }

        Ok(scenes)
    }

    /// Converts a simple minLon,minLat,maxLon,maxLat bbox into a WKT Polygon
    fn bbox_to_wkt(bbox: &str) -> String {
        let parts: Vec<&str> = bbox.split(',').collect();
        if parts.len() == 4 {
            let min_lon = parts[0];
            let min_lat = parts[1];
            let max_lon = parts[2];
            let max_lat = parts[3];
            format!(
                "POLYGON(({} {},{} {},{} {},{} {},{} {}))",
                min_lon, min_lat,
                max_lon, min_lat,
                max_lon, max_lat,
                min_lon, max_lat,
                min_lon, min_lat
            )
        } else {
            // Fallback empty polygon or error handling in a real app
            "POLYGON((0 0,0 0,0 0,0 0,0 0))".to_string()
        }
    }
}
