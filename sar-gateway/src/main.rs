pub mod models;
pub mod esa_client;
pub mod nasa_client;
pub mod handlers;
pub mod jobs;
pub mod rate_limit;
pub mod geocode;
pub mod metrics;
pub mod auth;
pub mod watch;
pub mod stac;

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
    pub processor_semaphore: Arc<tokio::sync::Semaphore>,
    pub rate_limiter: Arc<rate_limit::RateLimiter>,
}

#[tokio::main]
async fn main() {
    dotenv().ok();
    env_logger::init();
    metrics::init();
    if auth::init() { info!("Login required (NISAR_BASIC_AUTH is set)"); }

    let max_concurrent_jobs: usize = std::env::var("MAX_CONCURRENT_JOBS")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(1);

    info!("🛡️  Processor concurrency limiter: max {} heavy job(s) simultaneously", max_concurrent_jobs);

    let rate_limiter = Arc::new(rate_limit::RateLimiter::new());
    rate_limiter.clone().start_cleanup_task();

    let state = AppState {
        jobs: Arc::new(RwLock::new(HashMap::new())),
        processor_semaphore: Arc::new(tokio::sync::Semaphore::new(max_concurrent_jobs)),
        rate_limiter,
    };

    // Load saved runs from results/jobs and delete older duplicates.
    jobs::preload_runs(&state).await;
    watch::spawn(state.clone());

    let app = Router::new()
        .route("/search", get(handlers::search_handler))
        .route("/search/nisar", get(handlers::search_nisar_handler))
        .route("/assets/search", get(handlers::search_assets_handler))
        .route("/context", get(handlers::context_handler))
        .route("/jobs", get(handlers::list_jobs_handler).post(handlers::start_job_handler).delete(handlers::prune_jobs_handler))
        .route("/jobs/prune", post(handlers::prune_jobs_handler))
        .route("/scenes", get(handlers::list_scenes_handler))
        .route("/geocode/reverse", get(geocode::reverse_handler))
        .route("/geocode/search", get(geocode::search_handler))
        .route("/upload", post(handlers::upload_handler))
        .route("/watch", get(watch::overview))
        .route("/watch/areas", post(watch::save_area))
        .route("/watch/areas/:id", axum::routing::delete(watch::delete_area))
        .route("/watch/areas/:id/check", post(watch::check_now))
        .route("/watch/feed.xml", get(watch::feed))
        .route("/watch/cap/:file", get(watch::cap))
        .route("/stac", get(stac::catalog))
        .route("/stac/items/:id", get(stac::item))
        .route("/metrics", get(metrics::metrics_handler))
        .route("/healthz", get(metrics::healthz))
        .route("/readyz", get(metrics::readyz))
        .route("/jobs/health-ping", get(|| async { axum::Json(serde_json::json!({ "status": "ok" })) }))
        .route("/jobs/:id", get(handlers::get_job_handler).delete(handlers::delete_job_handler))
        .route("/jobs/:id/cancel", post(handlers::cancel_job_handler))
        .route("/jobs/:id/logs", get(handlers::stream_logs_handler))
        .route("/asf/download-stream", get(handlers::download_stream_handler))
        .route("/asf/auth-status", get(handlers::auth_status_handler))
        .nest_service("/results", ServeDir::new("results"))
        .layer(axum::middleware::from_fn_with_state(state.clone(), rate_limit::rate_limit_middleware))
        .layer(axum::middleware::from_fn(metrics::http_counter))
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
    // Outermost, so the login also covers the dashboard files served by the fallback.
    let app = app.layer(axum::middleware::from_fn(auth::basic_auth));

    // NISAR_BIND=127.0.0.1 keeps the server on this computer only (the desktop launchers set it).
    let host: std::net::IpAddr = std::env::var("NISAR_BIND")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or_else(|| std::net::IpAddr::from([0, 0, 0, 0]));
    let port: u16 = std::env::var("NISAR_PORT").ok().and_then(|v| v.parse().ok()).unwrap_or(3000);
    let addr = SocketAddr::new(host, port);
    info!("🚀 SAR Gateway listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).with_graceful_shutdown(shutdown_signal()).await.unwrap();
}

/// Ctrl+C, or SIGTERM from Kubernetes / Docker: stop taking requests and exit cleanly.
/// Running engine processes are killed with the gateway (kill_on_drop); their runs show as
/// interrupted on the next start.
async fn shutdown_signal() {
    let ctrl_c = async { let _ = tokio::signal::ctrl_c().await; };
    #[cfg(unix)]
    let term = async {
        if let Ok(mut s) = tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate()) { s.recv().await; }
    };
    #[cfg(not(unix))]
    let term = std::future::pending::<()>();
    tokio::select! { _ = ctrl_c => {}, _ = term => {} }
    info!("Shutting down");
}

fn resolve_dashboard_dir() -> Option<std::path::PathBuf> {
    if let Ok(d) = std::env::var("NISAR_DASHBOARD_DIR") {
        let p = std::path::PathBuf::from(d);
        if p.join("index.html").exists() { return Some(p); }
    }
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
