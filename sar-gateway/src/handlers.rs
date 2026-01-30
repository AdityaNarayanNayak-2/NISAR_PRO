use crate::esa_client::EsaClient;
use crate::models::{SarScene, SearchQuery};
use axum::{extract::Query, Json};

pub async fn search_handler(Query(params): Query<SearchQuery>) -> Json<Vec<SarScene>> {
    let client = EsaClient::new();

    // In a real app, we would handle errors better than unwrap
    match client
        .search_scenes(params.lat, params.lon, params.start_date, params.end_date)
        .await
    {
        Ok(scenes) => Json(scenes),
        Err(e) => {
            log::error!("Search failed: {}", e);
            Json(vec![]) // Return empty list on error for now
        }
    }
}
