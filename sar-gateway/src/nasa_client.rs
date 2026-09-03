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

    pub fn build_search_url(query: &NisarSearchQuery) -> String {
        let platform_query = query.platform.as_deref().unwrap_or("NISAR");
        let wkt_bbox = Self::bbox_to_wkt(&query.bbox);
        let encoded_wkt = urlencoding::encode(&wkt_bbox);

        let mut url = if platform_query.to_uppercase() == "SENTINEL-1" || platform_query.to_uppercase() == "SENTINEL" {
            format!(
                "https://api.daac.asf.alaska.edu/services/search/param?dataset=ARIA%20S1%20GUNW&output=geojson&intersectsWith={}&maxResults=50",
                encoded_wkt
            )
        } else {
            let mut base = format!(
                "https://api.daac.asf.alaska.edu/services/search/param?platform=NISAR&output=geojson&intersectsWith={}&maxResults=50",
                encoded_wkt
            );
            let level = query.processing_level.as_deref().unwrap_or("GCOV,RSLC,GSLC,GUNW");
            if !level.trim().is_empty() {
                base.push_str(&format!("&processingLevel={}", urlencoding::encode(level)));
            }
            base
        };

        if let Some(start) = &query.start_date {
            if !start.trim().is_empty() {
                url.push_str(&format!("&start={}", urlencoding::encode(start.trim())));
            }
        }
        if let Some(end) = &query.end_date {
            if !end.trim().is_empty() {
                url.push_str(&format!("&end={}", urlencoding::encode(end.trim())));
            }
        }

        url
    }

    pub async fn search_nisar(&self, query: NisarSearchQuery) -> Result<Vec<NisarScene>, Box<dyn Error>> {
        let platform_query = query.platform.as_deref().unwrap_or("NISAR").to_string();
        let url = Self::build_search_url(&query);

        log::info!("Querying NASA ASF: {}", url);

        let res = self.client.get(&url).send().await?.json::<Value>().await?;
        let scenes = Self::parse_asf_geojson(&res, &platform_query);

        Ok(scenes)
    }

    /// Normalizes and extracts scenes from an ASF Search GeoJSON response
    pub fn parse_asf_geojson(val: &Value, platform_query: &str) -> Vec<NisarScene> {
        let mut scenes = Vec::new();
        let default_platform = if platform_query.to_uppercase() == "SENTINEL-1" || platform_query.to_uppercase() == "SENTINEL" {
            "Sentinel-1 (ARIA GUNW)".to_string()
        } else {
            "NISAR".to_string()
        };

        if let Some(features) = val.get("features").and_then(|f| f.as_array()) {
            for feature in features.iter().take(50) {
                // 1. Skip features with null or invalid geometry coordinates (e.g. ECMWF auxiliary files)
                let footprint = match feature.get("geometry") {
                    Some(g) if !g.is_null() => {
                        let coords = g.get("coordinates");
                        if coords.is_none() || coords.unwrap().is_null() {
                            continue;
                        }
                        g.clone()
                    }
                    _ => continue,
                };

                if let Some(props) = feature.get("properties") {
                    let id = props
                        .get("sceneName")
                        .or_else(|| props.get("fileID"))
                        .or_else(|| props.get("fileName"))
                        .and_then(|v| v.as_str())
                        .unwrap_or("UNKNOWN")
                        .to_string();

                    if id == "UNKNOWN" || id.is_empty() {
                        continue;
                    }

                    let date = props
                        .get("startTime")
                        .or_else(|| props.get("acquisitionDate"))
                        .or_else(|| props.get("processingDate"))
                        .and_then(|v| v.as_str())
                        .unwrap_or("")
                        .to_string();

                    if date.is_empty() {
                        continue;
                    }

                    let download_url = props
                        .get("url")
                        .and_then(|v| v.as_str())
                        .unwrap_or("")
                        .to_string();

                    // Skip empty or non-SAR archive downloads
                    if download_url.is_empty() || download_url.ends_with(".bz2") {
                        continue;
                    }

                    let size_bytes = Self::parse_scene_bytes(props).to_string();

                    let platform = props
                        .get("platform")
                        .and_then(|v| v.as_str())
                        .filter(|p| !p.trim().is_empty())
                        .unwrap_or(&default_platform)
                        .to_string();

                    scenes.push(NisarScene {
                        id,
                        date,
                        footprint,
                        download_url,
                        size_bytes,
                        platform,
                    });
                }
            }
        }

        scenes
    }

    /// Parses scene file size from ASF properties across varied formats (objects, numbers, strings, sizeMB)
    pub fn parse_scene_bytes(props: &Value) -> u64 {
        if let Some(bytes_val) = props.get("bytes") {
            if let Some(b) = bytes_val.as_u64() {
                return b;
            }
            if let Some(s) = bytes_val.as_str() {
                if let Ok(b) = s.parse::<u64>() {
                    return b;
                }
            }
            if let Some(obj) = bytes_val.as_object() {
                // If it's a map of files, find primary file size (.h5, .nc, .tif) or maximum
                let mut max_bytes = 0u64;
                for (filename, file_info) in obj {
                    let file_bytes = if let Some(b) = file_info.get("bytes").and_then(|b| b.as_u64()) {
                        b
                    } else if let Some(b_str) = file_info.get("bytes").and_then(|b| b.as_str()) {
                        b_str.parse::<u64>().unwrap_or(0)
                    } else if let Some(b) = file_info.as_u64() {
                        b
                    } else {
                        0
                    };

                    if (filename.ends_with(".h5") || filename.ends_with(".nc") || filename.ends_with(".tif")) && file_bytes > 0 {
                        return file_bytes;
                    }
                    if file_bytes > max_bytes {
                        max_bytes = file_bytes;
                    }
                }
                if max_bytes > 0 {
                    return max_bytes;
                }
            }
        }

        if let Some(size_mb) = props.get("sizeMB").and_then(|v| v.as_f64()) {
            return (size_mb * 1024.0 * 1024.0) as u64;
        }

        0
    }

    /// Converts a simple minLon,minLat,maxLon,maxLat bbox into a WKT Polygon
    pub fn bbox_to_wkt(bbox: &str) -> String {
        let parts: Vec<&str> = bbox.split(',').map(|s| s.trim()).collect();
        if parts.len() == 4 && parts.iter().all(|p| !p.is_empty()) {
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
            "POLYGON((0 0,0 0,0 0,0 0,0 0))".to_string()
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_bbox_to_wkt_valid() {
        let wkt = NasaClient::bbox_to_wkt("-76.5,5.3,-74.3,8.2");
        assert_eq!(
            wkt,
            "POLYGON((-76.5 5.3,-74.3 5.3,-74.3 8.2,-76.5 8.2,-76.5 5.3))"
        );
    }

    #[test]
    fn test_build_search_url_default_processing_level() {
        let query = NisarSearchQuery {
            bbox: "73.0,18.0,80.0,25.0".to_string(),
            start_date: None,
            end_date: None,
            platform: None,
            processing_level: None,
        };
        let url = NasaClient::build_search_url(&query);
        assert!(url.contains("platform=NISAR"));
        assert!(url.contains("processingLevel=GCOV%2CRSLC%2CGSLC%2CGUNW"));
        assert!(url.contains("maxResults=50"));
        assert!(url.contains("intersectsWith=POLYGON"));
    }

    #[test]
    fn test_bbox_to_wkt_with_whitespace() {
        let wkt = NasaClient::bbox_to_wkt(" -76.5 , 5.3 , -74.3 , 8.2 ");
        assert_eq!(
            wkt,
            "POLYGON((-76.5 5.3,-74.3 5.3,-74.3 8.2,-76.5 8.2,-76.5 5.3))"
        );
    }

    #[test]
    fn test_bbox_to_wkt_invalid_fallback() {
        let wkt = NasaClient::bbox_to_wkt("invalid");
        assert_eq!(wkt, "POLYGON((0 0,0 0,0 0,0 0,0 0))");
    }

    #[test]
    fn test_parse_scene_bytes_nisar_nested_object() {
        let props = json!({
            "bytes": {
                "NISAR_L2_UR_GCOV.h5": {
                    "bytes": 6123683840u64,
                    "format": "HDF5"
                },
                "NISAR_L2_UR_GCOV_LATLON.png": {
                    "bytes": 1989761u64,
                    "format": "PNG"
                }
            }
        });
        assert_eq!(NasaClient::parse_scene_bytes(&props), 6123683840);
    }

    #[test]
    fn test_parse_scene_bytes_sentinel_integer() {
        let props = json!({
            "bytes": 104025956u64
        });
        assert_eq!(NasaClient::parse_scene_bytes(&props), 104025956);
    }

    #[test]
    fn test_parse_scene_bytes_string_integer() {
        let props = json!({
            "bytes": "524288000"
        });
        assert_eq!(NasaClient::parse_scene_bytes(&props), 524288000);
    }

    #[test]
    fn test_parse_scene_bytes_size_mb_fallback() {
        let props = json!({
            "sizeMB": 100.0
        });
        assert_eq!(NasaClient::parse_scene_bytes(&props), 104857600);
    }

    #[test]
    fn test_parse_asf_geojson_skips_ecmwf_null_geometry() {
        let fixture = json!({
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "geometry": {
                        "coordinates": null,
                        "type": "Polygon"
                    },
                    "properties": {
                        "fileID": "ECMWF_SMST_202608301800",
                        "startTime": null,
                        "url": "https://cumulus.asf.earthdatacloud.nasa.gov/ECMWF.nc.bz2"
                    }
                },
                {
                    "type": "Feature",
                    "geometry": {
                        "type": "Polygon",
                        "coordinates": [[
                            [-76.56, 8.22],
                            [-77.10, 5.90],
                            [-74.86, 5.38],
                            [-74.31, 7.70],
                            [-76.56, 8.22]
                        ]]
                    },
                    "properties": {
                        "sceneName": "NISAR_L2_PR_GCOV_026_055_A_011_4005_DHDH_A_20260724T000130",
                        "startTime": "2026-07-24T00:01:30Z",
                        "url": "https://nisar.asf.earthdatacloud.nasa.gov/NISAR/GCOV/NISAR_L2_PR_GCOV.h5",
                        "platform": "NISAR",
                        "bytes": {
                            "NISAR_L2_PR_GCOV.h5": {
                                "bytes": 4500000000u64,
                                "format": "HDF5"
                            }
                        }
                    }
                }
            ]
        });

        let scenes = NasaClient::parse_asf_geojson(&fixture, "NISAR");
        assert_eq!(scenes.len(), 1);
        assert_eq!(scenes[0].id, "NISAR_L2_PR_GCOV_026_055_A_011_4005_DHDH_A_20260724T000130");
    }

    #[test]
    fn test_parse_asf_geojson_sentinel_fixture() {
        let fixture = json!({
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "geometry": {
                        "type": "Polygon",
                        "coordinates": [[
                            [-70.0, 10.0],
                            [-70.0, 12.0],
                            [-68.0, 12.0],
                            [-68.0, 10.0],
                            [-70.0, 10.0]
                        ]]
                    },
                    "properties": {
                        "sceneName": "S1-GUNW-D-R-098-tops-20260730",
                        "startTime": "2026-07-30T10:23:54Z",
                        "url": "https://cumulus.asf.earthdatacloud.nasa.gov/ARIA/S1-GUNW.nc",
                        "platform": "Sentinel-1C",
                        "bytes": 104025956u64
                    }
                }
            ]
        });

        let scenes = NasaClient::parse_asf_geojson(&fixture, "SENTINEL-1");
        assert_eq!(scenes.len(), 1);
        let s = &scenes[0];
        assert_eq!(s.id, "S1-GUNW-D-R-098-tops-20260730");
        assert_eq!(s.date, "2026-07-30T10:23:54Z");
        assert_eq!(s.download_url, "https://cumulus.asf.earthdatacloud.nasa.gov/ARIA/S1-GUNW.nc");
        assert_eq!(s.size_bytes, "104025956");
        assert_eq!(s.platform, "Sentinel-1C");
    }
}
