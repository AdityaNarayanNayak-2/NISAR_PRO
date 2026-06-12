use crate::esa_client::EsaClient;
use crate::nasa_client::NasaClient;
use crate::models::{SarScene, SearchQuery, ProcessRequest, NisarSearchQuery, NisarScene, AssetResult, ContextResponse};
use chrono::Datelike;
use axum::{
    extract::{Path, Query, State},
    response::{sse::{Event, Sse}, IntoResponse},
    Json,
    http::StatusCode,
};
use tokio_stream::wrappers::BroadcastStream;
use tokio_stream::StreamExt;
use std::convert::Infallible;
use std::collections::HashMap;
use futures_util::stream::Stream;
use serde_json::json;

pub async fn search_handler(Query(params): Query<SearchQuery>) -> Json<Vec<SarScene>> {
    let client = EsaClient::new();
    let result = client.search_scenes(params.lat, params.lon, params.start_date, params.end_date).await;
    match result {
        Ok(scenes) => Json(scenes),
        Err(e) => {
            log::error!("Search failed: {}", e);
            Json(vec![])
        }
    }
}

pub async fn search_nisar_handler(Query(params): Query<NisarSearchQuery>) -> Json<Vec<NisarScene>> {
    let client = NasaClient::new();
    match client.search_nisar(params).await {
        Ok(scenes) => Json(scenes),
        Err(e) => {
            log::error!("NASA ASF Search failed: {}", e);
            Json(vec![])
        }
    }
}

pub async fn start_job_handler(
    State(state): State<crate::AppState>,
    Json(payload): Json<ProcessRequest>,
) -> Json<serde_json::Value> {
    let is_synthetic = payload.synthetic.unwrap_or(false);
    let job_id = crate::jobs::spawn_processing_job(
        state.clone(), 
        payload.input_file, 
        payload.slave_file,
        is_synthetic,
        payload.pipeline,
        payload.crop_lat,
        payload.crop_lon,
        payload.crop_radius_km,
    ).await;
    
    Json(json!({
        "job_id": job_id,
        "status": "queued"
    }))
}

pub async fn get_job_handler(
    State(state): State<crate::AppState>,
    Path(id): Path<String>,
) -> Result<Json<crate::jobs::JobResponse>, StatusCode> {
    let jobs = state.jobs.read().await;
    if let Some(metadata_lock) = jobs.get(&id) {
        let metadata = metadata_lock.read().await;
        Ok(Json(crate::jobs::JobResponse {
            id: metadata.id.clone(),
            status: metadata.status.clone(),
            output_path: metadata.output_path.clone(),
            bbox: metadata.bbox.clone(),
        }))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

pub async fn cancel_job_handler(
    State(state): State<crate::AppState>,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    match crate::jobs::cancel_job(state, id).await {
        Ok(_) => Ok(Json(json!({"status": "cancelled"}))),
        Err(e) => {
            log::error!("Cancel job error: {}", e);
            Err(StatusCode::BAD_REQUEST)
        }
    }
}

pub async fn stream_logs_handler(
    State(state): State<crate::AppState>,
    Path(id): Path<String>,
) -> Result<Sse<impl Stream<Item = Result<Event, Infallible>>>, StatusCode> {
    
    let (receiver, historical_logs) = {
        let jobs = state.jobs.read().await;
        if let Some(metadata_lock) = jobs.get(&id) {
            let metadata = metadata_lock.read().await;
            (metadata.tx.subscribe(), metadata.logs.clone())
        } else {
            return Err(StatusCode::NOT_FOUND);
        }
    };
    
    // First, emit all historical logs that we already have
    let history_stream = tokio_stream::iter(historical_logs.into_iter().map(|line| {
        Ok(Event::default().data(line))
    }));

    // Then, stream all new logs
    let live_stream = BroadcastStream::new(receiver)
        .filter_map(|msg| match msg {
            Ok(line) => Some(Ok(Event::default().data(line))),
            Err(_) => None,
        });

    let combined_stream = history_stream.chain(live_stream);

    Ok(Sse::new(combined_stream).keep_alive(axum::response::sse::KeepAlive::new()))
}

pub async fn search_assets_handler(
    Query(params): Query<HashMap<String, String>>,
) -> impl IntoResponse {

    let query = match params.get("q") {
        Some(q) if !q.is_empty() => q.clone(),
        _ => return Json(Vec::<AssetResult>::new()).into_response(),
    };

    let query_lower = query.to_lowercase();
    let mut assets = Vec::new();

    let local_registry = vec![
        AssetResult {
            id: "local-hirakud-dam".to_string(),
            name: "Hirakud Dam".to_string(),
            asset_type: "DAM".to_string(),
            lat: 21.5339,
            lon: 83.8751,
            display_name: "Hirakud Dam, Odisha, India".to_string(),
            country: "India".to_string(),
            state: Some("Odisha".to_string()),
        },
        AssetResult {
            id: "local-hirakud-res".to_string(),
            name: "Hirakud Reservoir".to_string(),
            asset_type: "DAM".to_string(),
            lat: 21.6,
            lon: 83.9,
            display_name: "Hirakud Reservoir, Odisha, India".to_string(),
            country: "India".to_string(),
            state: Some("Odisha".to_string()),
        },
        AssetResult {
            id: "local-kolab-dam".to_string(),
            name: "Upper Kolab Dam".to_string(),
            asset_type: "DAM".to_string(),
            lat: 18.7883,
            lon: 82.6003,
            display_name: "Upper Kolab Dam, Koraput, Odisha, India".to_string(),
            country: "India".to_string(),
            state: Some("Odisha".to_string()),
        },
        AssetResult {
            id: "local-kolab-res".to_string(),
            name: "Kolab Reservoir".to_string(),
            asset_type: "DAM".to_string(),
            lat: 18.82,
            lon: 82.64,
            display_name: "Kolab Reservoir, Koraput, Odisha, India".to_string(),
            country: "India".to_string(),
            state: Some("Odisha".to_string()),
        },
        AssetResult {
            id: "local-indravati-dam".to_string(),
            name: "Indravati Dam (Khatiguda)".to_string(),
            asset_type: "DAM".to_string(),
            lat: 19.2763,
            lon: 82.8284,
            display_name: "Indravati Dam (Khatiguda), Nabarangpur, Odisha, India".to_string(),
            country: "India".to_string(),
            state: Some("Odisha".to_string()),
        },
        AssetResult {
            id: "local-indravati-res".to_string(),
            name: "Indravati Reservoir".to_string(),
            asset_type: "DAM".to_string(),
            lat: 19.32,
            lon: 82.90,
            display_name: "Indravati Reservoir, Nabarangpur, Odisha, India".to_string(),
            country: "India".to_string(),
            state: Some("Odisha".to_string()),
        },
        AssetResult {
            id: "local-rengali-dam".to_string(),
            name: "Rengali Dam".to_string(),
            asset_type: "DAM".to_string(),
            lat: 21.5700,
            lon: 85.0300,
            display_name: "Rengali Dam, Angul, Odisha, India".to_string(),
            country: "India".to_string(),
            state: Some("Odisha".to_string()),
        },
        AssetResult {
            id: "local-balimela-dam".to_string(),
            name: "Balimela Dam".to_string(),
            asset_type: "DAM".to_string(),
            lat: 18.1500,
            lon: 82.1200,
            display_name: "Balimela Dam, Malkangiri, Odisha, India".to_string(),
            country: "India".to_string(),
            state: Some("Odisha".to_string()),
        },
        AssetResult {
            id: "local-salia-dam".to_string(),
            name: "Salia Dam".to_string(),
            asset_type: "DAM".to_string(),
            lat: 19.8242,
            lon: 85.0874,
            display_name: "Salia Dam, Khordha, Odisha, India".to_string(),
            country: "India".to_string(),
            state: Some("Odisha".to_string()),
        },
        AssetResult {
            id: "local-mahanadi-barrage".to_string(),
            name: "Mahanadi Barrage".to_string(),
            asset_type: "BRIDGE".to_string(),
            lat: 20.4851,
            lon: 85.9189,
            display_name: "Mahanadi Barrage, Cuttack, Odisha, India".to_string(),
            country: "India".to_string(),
            state: Some("Odisha".to_string()),
        },
    ];

    for asset in local_registry {
        let n_lower = asset.name.to_lowercase();
        let d_lower = asset.display_name.to_lowercase();
        if n_lower.contains(&query_lower) 
            || d_lower.contains(&query_lower) 
            || (query_lower.len() >= 3 && query_lower.contains(&n_lower)) 
        {
            assets.push(asset);
        }
    }

    // Build Nominatim URL
    // Search for waterway=dam OR man_made=bridge in India specifically for better results
    let url = format!(
        "https://nominatim.openstreetmap.org/search?\
         q={}&format=json&limit=5&\
         addressdetails=1",
        urlencoding::encode(&query)
    );

    let client = reqwest::Client::new();
    let response = client
        .get(&url)
        .header("User-Agent", "NISARPro/1.0 contact@nisarpro.in")
        .timeout(std::time::Duration::from_secs(5))
        .send()
        .await;

    let results = match response {
        Ok(r) => match r.json::<Vec<serde_json::Value>>().await {
            Ok(data) => data,
            Err(_) => return Json(assets).into_response(),
        },
        Err(_) => return Json(assets).into_response(),
    };

    let mut osm_assets: Vec<AssetResult> = results
        .iter()
        .filter_map(|item| {
            let lat = item["lat"].as_str()?.parse::<f64>().ok()?;
            let lon = item["lon"].as_str()?.parse::<f64>().ok()?;
            let display = item["display_name"].as_str()?.to_string();
            let osm_id = item["osm_id"].as_i64().unwrap_or(0).to_string();
            
            // Determine asset type from OSM tags
            let asset_type = if display.to_lowercase().contains("dam") 
                || display.to_lowercase().contains("reservoir") {
                "DAM"
            } else if display.to_lowercase().contains("bridge") {
                "BRIDGE"
            } else {
                "ASSET"
            }.to_string();

            // Extract state from address
            let state = item["address"]["state"]
                .as_str()
                .map(|s| s.to_string());
            
            let country = item["address"]["country"]
                .as_str()
                .unwrap_or("Unknown")
                .to_string();

            // Short name — first part before first comma
            let name = display
                .split(',')
                .next()
                .unwrap_or(&display)
                .trim()
                .to_string();

            // Avoid adding duplicates of Hirakud Dam/Reservoir
            if name.to_lowercase().contains("hirakud") && (name.to_lowercase().contains("dam") || name.to_lowercase().contains("reservoir")) {
                return None;
            }

            Some(AssetResult {
                id: osm_id,
                name,
                asset_type,
                lat,
                lon,
                display_name: display,
                country,
                state,
            })
        })
        .collect();

    assets.append(&mut osm_assets);

    Json(assets).into_response()
}

pub async fn context_handler(
    Query(params): Query<HashMap<String, String>>,
) -> impl IntoResponse {

    let lat = params.get("lat")
        .and_then(|v| v.parse::<f64>().ok());
    let lon = params.get("lon")
        .and_then(|v| v.parse::<f64>().ok());
    let _asset_type = params.get("asset_type")
        .cloned()
        .unwrap_or_else(|| "DAM".to_string());

    if lat.is_none() || lon.is_none() {
        return Json(serde_json::json!({
            "error": "lat and lon required"
        })).into_response();
    }

    let lat_v = lat.unwrap();
    let lon_v = lon.unwrap();

    // Determine season from current month (Indian subcontinent seasons)
    let month = chrono::Utc::now().month();
    let season = match month {
        6..=9 => "Monsoon (Jun-Sep)",
        10..=11 => "Post-Monsoon (Oct-Nov)",
        12 | 1 | 2 => "Winter (Dec-Feb)",
        _ => "Pre-Monsoon (Mar-May)",
    }.to_string();

    let client = reqwest::Client::new();
    let mut sources: Vec<&str> = Vec::new();

    // ── 1. Open-Meteo: live weather, rainfall, soil moisture ──────────
    let meteo_url = format!(
        "https://api.open-meteo.com/v1/forecast?\
         latitude={}&longitude={}&\
         current=temperature_2m,rain,soil_moisture_0_to_7cm&\
         daily=rain_sum&\
         timezone=auto&past_days=3&forecast_days=1",
        lat_v, lon_v
    );

    let meteo_result = client
        .get(&meteo_url)
        .header("User-Agent", "NISARPro/1.0")
        .timeout(std::time::Duration::from_secs(5))
        .send()
        .await;

    let mut rainfall_str: Option<String> = None;
    let mut soil_moisture_str: Option<String> = None;
    let mut _temperature: Option<f64> = None;

    if let Ok(resp) = meteo_result {
        if let Ok(data) = resp.json::<serde_json::Value>().await {
            // Daily cumulative rain over past 3 days + today
            if let Some(daily_arr) = data["daily"]["rain_sum"].as_array() {
                let sum: f64 = daily_arr.iter()
                    .filter_map(|v| v.as_f64())
                    .sum();
                rainfall_str = Some(format!("{:.1}mm", sum));
            }
            // Soil moisture (m³/m³)
            if let Some(sm) = data["current"]["soil_moisture_0_to_7cm"].as_f64() {
                let pct = sm * 100.0;
                let label = if pct > 40.0 { "Saturated" }
                    else if pct > 25.0 { "High anomaly" }
                    else if pct > 10.0 { "Elevated moisture" }
                    else { "Stable" };
                soil_moisture_str = Some(format!("{:.1}% ({})", pct, label));
            }
            // Temperature
            _temperature = data["current"]["temperature_2m"].as_f64();

            sources.push("Open-Meteo API");
        }
    }

    // ── 2. USGS Earthquake API: seismic activity within 200km / 30d ───
    let thirty_days_ago = (chrono::Utc::now() - chrono::Duration::days(30))
        .format("%Y-%m-%d")
        .to_string();

    let usgs_url = format!(
        "https://earthquake.usgs.gov/fdsnws/event/1/query?\
         format=geojson&\
         latitude={}&longitude={}&\
         maxradiuskm=200&\
         starttime={}&\
         minmagnitude=2",
        lat_v, lon_v, thirty_days_ago
    );

    let usgs_result = client
        .get(&usgs_url)
        .header("User-Agent", "NISARPro/1.0")
        .timeout(std::time::Duration::from_secs(5))
        .send()
        .await;

    let mut seismic_str: Option<String> = None;

    if let Ok(resp) = usgs_result {
        if let Ok(data) = resp.json::<serde_json::Value>().await {
            if let Some(features) = data["features"].as_array() {
                let count = features.len();
                if count == 0 {
                    seismic_str = Some("No activity (30d)".to_string());
                } else {
                    seismic_str = Some(format!("{} events (30d)", count));
                }
                sources.push("USGS Earthquake API");
            }
        }
    }

    if seismic_str.is_none() {
        seismic_str = Some("Seismic data unavailable".to_string());
    }

    // ── 3. Compute assessment from real data ──────────────────────────
    let mut risk_factors: Vec<String> = Vec::new();

    if let Some(ref rf) = rainfall_str {
        if let Some(val) = rf.split("mm").next().and_then(|s| s.parse::<f64>().ok()) {
            if val > 100.0 { risk_factors.push("heavy rainfall".to_string()); }
        }
    }
    if let Some(ref sm) = soil_moisture_str {
        if sm.contains("Saturated") || sm.contains("anomaly") {
            risk_factors.push("soil saturation".to_string());
        }
    }
    if let Some(ref seis) = seismic_str {
        if seis.contains("events") {
            risk_factors.push("recent seismic activity".to_string());
        }
    }

    let (assessment, confidence) = if risk_factors.is_empty() {
        ("No elevated risk factors detected — baseline stable".to_string(), "LOW".to_string())
    } else if risk_factors.len() == 1 {
        (format!("Elevated: {}", risk_factors[0]), "MODERATE".to_string())
    } else {
        (format!("Multiple risk factors: {}", risk_factors.join(", ")), "HIGH".to_string())
    };

    let source_str = if sources.is_empty() {
        "No live sources reached".to_string()
    } else {
        sources.join(", ")
    };

    let response = ContextResponse {
        reservoir: None,
        rainfall: rainfall_str,
        soil_moisture: soil_moisture_str,
        seismic: seismic_str,
        season: Some(season),
        assessment: Some(assessment),
        confidence: Some(confidence),
        source: Some(source_str),
        current_level_m: None,
        full_reservoir_level_m: None,
        storage_pct: None,
        inflow_cumecs: None,
        outflow_cumecs: None,
        river_basin: None,
    };

    Json(response).into_response()
}

pub async fn download_stream_handler(
    Query(params): Query<HashMap<String, String>>,
) -> impl IntoResponse {
    let url = match params.get("url").cloned() {
        Some(u) => u,
        None => return (StatusCode::BAD_REQUEST, "Missing url parameter").into_response(),
    };
    let id = match params.get("id").or_else(|| params.get("granule_id")).cloned() {
        Some(i) => i,
        None => return (StatusCode::BAD_REQUEST, "Missing id or granule_id parameter").into_response(),
    };

    // Ensure the data/ directory exists
    tokio::fs::create_dir_all("data").await.ok();

    // Determine filename ensuring _GUNW_ is present
    let extension = if url.ends_with(".nc") { "nc" } else { "h5" };
    let filename = if id.contains("_GUNW_") {
        format!("{}.{}", id, extension)
    } else if id.contains("-GUNW-") {
        let normalized = id.replace("-GUNW-", "_GUNW_");
        format!("{}.{}", normalized, extension)
    } else {
        format!("{}_GUNW_.{}", id, extension)
    };

    let filepath = format!("data/{}", filename);

    // Create a channel for SSE events
    let (tx, rx) = tokio::sync::mpsc::channel::<Result<Event, Infallible>>(100);

    // Spawn the download task
    tokio::spawn(async move {
        let username = std::env::var("EARTHDATA_USERNAME")
            .or_else(|_| std::env::var("ASF_USERNAME"))
            .unwrap_or_default();
        let password = std::env::var("EARTHDATA_PASSWORD")
            .or_else(|_| std::env::var("ASF_PASSWORD"))
            .unwrap_or_default();

        if username.is_empty() || password.is_empty() {
            log::warn!("Earthdata credentials not found in env. Attempting unauthenticated download.");
        }

        let client = match reqwest::Client::builder()
            .cookie_store(true)
            .build()
        {
            Ok(c) => c,
            Err(e) => {
                let _ = tx.send(Ok(Event::default().json_data(json!({
                    "status": "error",
                    "message": format!("Failed to build HTTP client: {}", e)
                })).unwrap())).await;
                return;
            }
        };

        log::info!("Starting download of {} to {}", url, filepath);

        // Perform request
        let mut req = client.get(&url);
        if !username.is_empty() {
            req = req.basic_auth(&username, Some(&password));
        }

        let response = match req.send().await {
            Ok(r) => r,
            Err(e) => {
                let _ = tx.send(Ok(Event::default().json_data(json!({
                    "status": "error",
                    "message": format!("Network request failed: {}", e)
                })).unwrap())).await;
                return;
            }
        };

        if !response.status().is_success() {
            let _ = tx.send(Ok(Event::default().json_data(json!({
                "status": "error",
                "message": format!("HTTP error status: {}", response.status())
            })).unwrap())).await;
            return;
        }

        let total_size = response.content_length();
        let mut file = match tokio::fs::File::create(&filepath).await {
            Ok(f) => f,
            Err(e) => {
                let _ = tx.send(Ok(Event::default().json_data(json!({
                    "status": "error",
                    "message": format!("Failed to create destination file: {}", e)
                })).unwrap())).await;
                return;
            }
        };

        let mut stream = response.bytes_stream();
        let mut downloaded: u64 = 0;
        let mut last_progress_report = 0.0;

        use tokio::io::AsyncWriteExt;

        while let Some(chunk_result) = stream.next().await {
            let chunk = match chunk_result {
                Ok(c) => c,
                Err(e) => {
                    let _ = tx.send(Ok(Event::default().json_data(json!({
                        "status": "error",
                        "message": format!("Stream read error: {}", e)
                    })).unwrap())).await;
                    return;
                }
            };

            if let Err(e) = file.write_all(&chunk).await {
                let _ = tx.send(Ok(Event::default().json_data(json!({
                    "status": "error",
                    "message": format!("Disk write error: {}", e)
                })).unwrap())).await;
                return;
            }

            downloaded += chunk.len() as u64;

            if let Some(total) = total_size {
                let pct = (downloaded as f64 / total as f64) * 100.0;
                if pct - last_progress_report >= 1.0 || pct >= 100.0 {
                    last_progress_report = pct;
                    let _ = tx.send(Ok(Event::default().json_data(json!({
                        "status": "downloading",
                        "progress": pct
                    })).unwrap())).await;
                }
            }
        }

        if let Err(e) = file.flush().await {
            let _ = tx.send(Ok(Event::default().json_data(json!({
                "status": "error",
                "message": format!("Failed to flush file: {}", e)
            })).unwrap())).await;
            return;
        }

        log::info!("Download completed successfully. File saved to: {}", filepath);

        let _ = tx.send(Ok(Event::default().json_data(json!({
            "status": "download_complete",
            "path": filepath
        })).unwrap())).await;
    });

    let sse_stream = tokio_stream::wrappers::ReceiverStream::new(rx);
    Sse::new(sse_stream)
        .keep_alive(axum::response::sse::KeepAlive::default())
        .into_response()
}

