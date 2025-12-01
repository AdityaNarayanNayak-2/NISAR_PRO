use axum::{
    extract::Query,
    Json,
};
use crate::models::{SearchQuery, SarScene};
use crate::esa_client::EsaClient;

pub async fn search_handler(Query(params): Query<SearchQuery>) -> Json<Vec<SarScene>> {
    let client = EsaClient::new();
    
    // In a real app, we would handle errors better than unwrap
    match client.search_scenes(params.lat, params.lon).await {
        Ok(scenes) => Json(scenes),
        Err(e) => {
            log::error!("Search failed: {}", e);
            Json(vec![]) // Return empty list on error for now
        }
    }
}
