pub mod models;
pub mod esa_client;
pub mod nasa_client;
pub mod handlers;
pub mod jobs;

use axum::{
    routing::{get, post},
    Router,
};
use axum::response::IntoResponse;
use std::net::SocketAddr;
use std::sync::OnceLock;
use dotenv::dotenv;
use log::info;
use tower_http::cors::{Any, CorsLayer};
use tower_http::services::ServeDir;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

#[derive(Clone)]
pub struct AppState {
    pub jobs: Arc<RwLock<HashMap<String, Arc<RwLock<jobs::JobMetadata>>>>>,
}

#[tokio::main]
async fn main() {
    dotenv().ok();
    env_logger::init();

    let state = AppState {
        jobs: Arc::new(RwLock::new(HashMap::new())),
    };

    crate::jobs::start_cleanup_task(state.clone());
    preload_completed_jobs(state.clone()).await;

    let app = Router::new()
        .route("/search", get(handlers::search_handler))
        .route("/search/nisar", get(handlers::search_nisar_handler))
        .route("/assets/search", get(handlers::search_assets_handler))
        .route("/context", get(handlers::context_handler))
        .route("/jobs", get(handlers::list_jobs_handler).post(handlers::start_job_handler))
        .route("/upload", post(handlers::upload_handler))
        .route("/jobs/health-ping", get(|| async { axum::Json(serde_json::json!({ "status": "ok" })) }))
        .route("/jobs/:id", get(handlers::get_job_handler))
        .route("/jobs/:id/cancel", post(handlers::cancel_job_handler))
        .route("/jobs/:id/logs", get(handlers::stream_logs_handler))
        .route("/asf/download-stream", get(handlers::download_stream_handler))
        .route("/asf/auth-status", get(handlers::auth_status_handler))
        .nest_service("/results", ServeDir::new("results"))
        .layer(CorsLayer::new().allow_origin(Any).allow_methods(Any).allow_headers(Any))
        .with_state(state);

    let app = match resolve_dashboard_dir() {
        Some(dir) => {
            let index = dir.join("index.html");
            let _ = INDEX_HTML.set(std::fs::read_to_string(&index).unwrap_or_default());
            let _ = DIST_DIR.set(dir.clone());
            info!("🖥️  Serving SAR dashboard from {} (SPA fallback -> index.html)", dir.display());
            app.fallback(spa_fallback)
        }
        None => {
            info!("⚠️  Dashboard dist not found - API only on :3000 (build frontend or use vite dev)");
            app
        }
    };

    let addr = SocketAddr::from(([0, 0, 0, 0], 3000));
    info!("🚀 SAR Gateway listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

fn resolve_dashboard_dir() -> Option<std::path::PathBuf> {
    let candidates = [
        "../sar-dashboard-v3/dist",
        "./sar-dashboard-v3/dist",
    ];
    for c in candidates {
        let p = std::path::Path::new(c);
        if p.join("index.html").exists() {
            return Some(p.to_path_buf());
        }
    }
    None
}

static INDEX_HTML: OnceLock<String> = OnceLock::new();
static DIST_DIR: OnceLock<std::path::PathBuf> = OnceLock::new();

fn mime_for(path: &std::path::Path) -> &'static str {
    match path.extension().and_then(|e| e.to_str()).unwrap_or("") {
        "html" => "text/html; charset=utf-8",
        "js" | "mjs" => "text/javascript; charset=utf-8",
        "css" => "text/css; charset=utf-8",
        "json" => "application/json",
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "webp" => "image/webp",
        "svg" => "image/svg+xml",
        "gif" => "image/gif",
        "ico" => "image/x-icon",
        "webm" => "video/webm",
        "mp4" => "video/mp4",
        "woff" => "font/woff",
        "woff2" => "font/woff2",
        "wasm" => "application/wasm",
        "tif" | "tiff" => "image/tiff",
        "pdf" => "application/pdf",
        _ => "application/octet-stream",
    }
}

fn read_index(dist: &std::path::Path) -> String {
    // Read fresh so a frontend rebuild is picked up without restarting the gateway.
    if let Ok(html) = std::fs::read_to_string(dist.join("index.html")) {
        return html;
    }
    INDEX_HTML.get().cloned().unwrap_or_default()
}

async fn spa_fallback(uri: axum::http::Uri) -> axum::response::Response {
    let Some(dist) = DIST_DIR.get() else {
        let index = INDEX_HTML.get().cloned().unwrap_or_default();
        return axum::response::Html(index).into_response();
    };
    let index = read_index(dist);

    let rel = uri.path().trim_start_matches('/');
    if rel.is_empty() {
        return axum::response::Html(index).into_response();
    }

    let mut cand = dist.clone();
    for comp in std::path::Path::new(rel).components() {
        match comp {
            std::path::Component::Normal(c) => cand.push(c),
            _ => return axum::response::Html(index).into_response(),
        }
    }

    if cand.is_file() {
        if let Ok(bytes) = std::fs::read(&cand) {
            return ([(axum::http::header::CONTENT_TYPE, mime_for(&cand))], bytes).into_response();
        }
    }

    // A missing hashed asset must fail loudly rather than silently serving HTML,
    // which shows up in the browser as a blank page with no clue.
    if rel.starts_with("assets/") {
        return (axum::http::StatusCode::NOT_FOUND, "asset not found").into_response();
    }

    axum::response::Html(index).into_response()
}

async fn preload_completed_jobs(state: AppState) {
    let results_dir = std::path::Path::new("results");
    if !results_dir.exists() {
        return;
    }
    if let Ok(entries) = std::fs::read_dir(results_dir) {
        let mut jobs_map = state.jobs.write().await;
        
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() {
                if let Some(filename) = path.file_name().and_then(|f| f.to_str()) {
                    if filename.ends_with("_flood.json") {
                        let job_id = filename.replace("_flood.json", "");
                        let png_name = format!("{}_flood.png", job_id);
                        let geojson_name = format!("{}_flood.geo.json", job_id);
                        
                        let png_path = results_dir.join(&png_name);
                        let geojson_path = results_dir.join(&geojson_name);
                        let baseline_name = format!("{}_flood_baseline.png", job_id);
                        let active_name = format!("{}_flood_active.png", job_id);
                        let baseline_path = results_dir.join(&baseline_name);
                        let active_path = results_dir.join(&active_name);
                        
                        if png_path.exists() && geojson_path.exists() {
                            if let Ok(content) = std::fs::read_to_string(&path) {
                                if let Ok(report) = serde_json::from_str::<serde_json::Value>(&content) {
                                    let (tx, _) = tokio::sync::broadcast::channel(256);
                                    
                                    // Calculate approximate bbox
                                    let mut bbox = None;
                                    if let Some(crop) = report.get("crop") {
                                        if let (Some(center_lat), Some(center_lon)) = (crop.get("center_lat").and_then(|v| v.as_f64()), crop.get("center_lon").and_then(|v| v.as_f64())) {
                                            let preset = crop.get("preset").and_then(|v| v.as_str()).unwrap_or("5x5km");
                                            let (lat_half_km, lon_half_km) = match preset {
                                                "1x1km" => (0.5, 0.5),
                                                "5x5km" => (2.5, 2.5),
                                                "1x2km" => (0.5, 1.0),
                                                "10x10km" => (5.0, 5.0),
                                                "20x20km" => (10.0, 10.0),
                                                _ => (2.5, 2.5),
                                            };
                                            let lat_radius = lat_half_km / 111.0;
                                            let cos_lat = center_lat.to_radians().cos().abs().max(0.01);
                                            let lon_radius = lon_half_km / (111.0 * cos_lat);
                                            bbox = Some(jobs::GeoBbox {
                                                south: center_lat - lat_radius,
                                                north: center_lat + lat_radius,
                                                west: center_lon - lon_radius,
                                                east: center_lon + lon_radius,
                                            });
                                        }
                                    }
                                    
                                    let metadata = Arc::new(tokio::sync::RwLock::new(jobs::JobMetadata {
                                        id: job_id.clone(),
                                        status: jobs::JobStatus::Completed,
                                        logs: vec!["[SYSTEM] Preloaded completed run from server storage.".to_string()],
                                        tx,
                                        output_path: Some(format!("/results/{}", png_name)),
                                        bbox,
                                        flood_report_path: Some(format!("/results/{}", filename)),
                                        flood_geojson_path: Some(format!("/results/{}", geojson_name)),
                                        flood_baseline_path: baseline_path.exists().then(|| format!("/results/{}", baseline_name)),
                                        flood_active_path: active_path.exists().then(|| format!("/results/{}", active_name)),
                                        created_at: std::time::Instant::now(),
                                        cancel_tx: None,
                                    }));
                                    
                                    jobs_map.insert(job_id, metadata);
                                }
                            }
                        }
                    }
                }
            }
        }
        info!("📂 Preloaded {} completed historical jobs from storage.", jobs_map.len());
    }
}
