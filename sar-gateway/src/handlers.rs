use crate::esa_client::EsaClient;
use crate::models::{SarScene, SearchQuery, ProcessRequest};
use axum::{
    extract::{Path, Query, State},
    response::sse::{Event, Sse},
    Json,
    http::StatusCode,
};
use tokio_stream::wrappers::BroadcastStream;
use tokio_stream::StreamExt;
use std::convert::Infallible;
use futures_util::stream::Stream;
use serde_json::json;

pub async fn search_handler(Query(params): Query<SearchQuery>) -> Json<Vec<SarScene>> {
    let mut client = EsaClient::new();
    // In a real app, we would handle errors better than unwrap
    // Using user's current format
    let result = client.search_scenes(params.lat, params.lon, params.start_date, params.end_date).await;
    match result {
        Ok(scenes) => Json(scenes),
        Err(e) => {
            log::error!("Search failed: {}", e);
            Json(vec![]) // Return empty list on error for now
        }
    }
}

pub async fn start_job_handler(
    State(state): State<crate::AppState>,
    Json(payload): Json<ProcessRequest>,
) -> Json<serde_json::Value> {
    let is_synthetic = payload.synthetic.unwrap_or(false);
    let job_id = crate::jobs::spawn_processing_job(state.clone(), payload.input_file, is_synthetic).await;
    
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
        }))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

pub async fn stream_logs_handler(
    State(state): State<crate::AppState>,
    Path(id): Path<String>,
) -> Result<Sse<impl Stream<Item = Result<Event, Infallible>>>, StatusCode> {
    
    let (tx, historical_logs) = {
        let jobs = state.jobs.read().await;
        if let Some(metadata_lock) = jobs.get(&id) {
            let metadata = metadata_lock.read().await;
            (metadata.tx.clone(), metadata.logs.clone())
        } else {
            return Err(StatusCode::NOT_FOUND);
        }
    };

    let receiver = tx.subscribe();
    
    // First, emit all historical logs that we already have
    let history_stream = tokio_stream::iter(historical_logs.into_iter().map(|line| {
        Ok(Event::default().data(line))
    }));

    // Then, stream all new logs
    let live_stream = BroadcastStream::new(receiver)
        .filter_map(|msg| match msg {
            Ok(line) => Some(Ok(Event::default().data(line))),
            Err(_) => None, // Ignore lagged receiver warnings safely
        });

    let combined_stream = history_stream.chain(live_stream);

    Ok(Sse::new(combined_stream).keep_alive(axum::response::sse::KeepAlive::new()))
}
