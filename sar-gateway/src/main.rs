pub mod models;
pub mod esa_client;
pub mod handlers;
pub mod jobs;

use axum::{
    routing::{get, post},
    Router,
};
use std::net::SocketAddr;
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

    let app = Router::new()
        .route("/search", get(handlers::search_handler))
        .route("/jobs", post(handlers::start_job_handler))
        .route("/jobs/:id", get(handlers::get_job_handler))
        .route("/jobs/:id/logs", get(handlers::stream_logs_handler))
        .nest_service("/results", ServeDir::new("results"))
        .layer(CorsLayer::new().allow_origin(Any).allow_methods(Any).allow_headers(Any))
        .with_state(state);

    let addr = SocketAddr::from(([0, 0, 0, 0], 3000));
    info!("🚀 SAR Gateway listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
