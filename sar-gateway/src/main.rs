mod models;
mod esa_client;
mod handlers;

use axum::{
    routing::get,
    Router,
};
use std::net::SocketAddr;
use dotenv::dotenv;
use log::info;

#[tokio::main]
async fn main() {
    dotenv().ok();
    env_logger::init();

    let app = Router::new()
        .route("/search", get(handlers::search_handler));

    let addr = SocketAddr::from(([0, 0, 0, 0], 3000));
    info!("SAR Gateway listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
