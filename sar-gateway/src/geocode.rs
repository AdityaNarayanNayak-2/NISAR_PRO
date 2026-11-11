//! Geocoding: reverse ("nearest place" for hotspot labels) and place search (command bar).
//!
//! Uses OpenStreetMap Nominatim, which allows at most one request per second and asks
//! clients to cache. Answers are kept in `results/geocode_cache.json` (keyed by the
//! coordinate rounded to 3 decimals, about 100 m), so each place is asked once.
use axum::{extract::Query, http::StatusCode, Json};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::sync::OnceLock;
use std::time::{Duration, Instant};
use tokio::sync::Mutex;

const CACHE_FILE: &str = "results/geocode_cache.json";

#[derive(Deserialize)]
pub struct ReverseQuery {
    pub lat: f64,
    pub lon: f64,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct Place {
    /// Village, town or city nearest the point.
    pub name: Option<String>,
    /// District / county / state above it.
    pub area: Option<String>,
    pub country: Option<String>,
}

struct Geo {
    cache: HashMap<String, Place>,
    last: Option<Instant>,
}

fn geo() -> &'static Mutex<Geo> {
    static G: OnceLock<Mutex<Geo>> = OnceLock::new();
    G.get_or_init(|| {
        let cache = std::fs::read_to_string(CACHE_FILE)
            .ok()
            .and_then(|t| serde_json::from_str(&t).ok())
            .unwrap_or_default();
        Mutex::new(Geo { cache, last: None })
    })
}

fn pick(addr: &Value, keys: &[&str]) -> Option<String> {
    keys.iter().find_map(|k| addr.get(*k).and_then(Value::as_str).map(str::to_string))
}

pub async fn reverse_handler(Query(q): Query<ReverseQuery>) -> Result<Json<Place>, (StatusCode, String)> {
    if !(-90.0..=90.0).contains(&q.lat) || !(-180.0..=180.0).contains(&q.lon) {
        return Err((StatusCode::BAD_REQUEST, "lat/lon out of range".into()));
    }
    let key = format!("{:.3},{:.3}", q.lat, q.lon);
    // One request at a time, at most one per second, as Nominatim asks.
    let mut g = geo().lock().await;
    if let Some(p) = g.cache.get(&key) {
        return Ok(Json(p.clone()));
    }
    if let Some(t) = g.last {
        let wait = Duration::from_millis(1100).saturating_sub(t.elapsed());
        tokio::time::sleep(wait).await;
    }
    g.last = Some(Instant::now());
    let url = format!(
        "https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=14&addressdetails=1&lat={}&lon={}",
        q.lat, q.lon
    );
    let resp = reqwest::Client::new()
        .get(&url)
        .header("User-Agent", "NISAR-Pro")
        .header("Accept-Language", "en")
        .timeout(Duration::from_secs(8))
        .send()
        .await
        .map_err(|e| (StatusCode::BAD_GATEWAY, format!("Geocoder unreachable: {e}")))?;
    if !resp.status().is_success() {
        return Err((StatusCode::BAD_GATEWAY, format!("Geocoder answered {}", resp.status())));
    }
    let v: Value = resp.json().await.map_err(|e| (StatusCode::BAD_GATEWAY, e.to_string()))?;
    let addr = v.get("address").cloned().unwrap_or(Value::Null);
    let place = Place {
        name: pick(&addr, &["village", "town", "city", "hamlet", "suburb", "municipality", "neighbourhood"])
            .or_else(|| v.get("name").and_then(Value::as_str).filter(|s| !s.is_empty()).map(str::to_string)),
        area: pick(&addr, &["state_district", "county", "district", "state"]),
        country: pick(&addr, &["country"]),
    };
    g.cache.insert(key, place.clone());
    if let Ok(text) = serde_json::to_string(&g.cache) {
        let _ = std::fs::write(CACHE_FILE, text);
    }
    Ok(Json(place))
}

#[derive(Deserialize)]
pub struct SearchQuery {
    pub q: String,
}

#[derive(Serialize, Clone)]
pub struct Found {
    pub label: String,
    pub lat: f64,
    pub lon: f64,
    /// [west, south, east, north]
    pub bbox: Option<[f64; 4]>,
}

/// Place search for the dashboard's command bar: GET /geocode/search?q=...
/// Same rules as reverse: one request at a time, at most one per second, generic User-Agent.
/// Answers are cached in memory for this session only.
pub async fn search_handler(Query(q): Query<SearchQuery>) -> Result<Json<Vec<Found>>, (StatusCode, String)> {
    static CACHE: OnceLock<Mutex<HashMap<String, Vec<Found>>>> = OnceLock::new();
    let text = q.q.trim();
    if text.len() < 2 || text.len() > 120 {
        return Err((StatusCode::BAD_REQUEST, "query must be 2 to 120 characters".into()));
    }
    let key = text.to_lowercase();
    let cache = CACHE.get_or_init(|| Mutex::new(HashMap::new()));
    if let Some(hit) = cache.lock().await.get(&key) {
        return Ok(Json(hit.clone()));
    }
    let mut g = geo().lock().await;
    if let Some(t) = g.last {
        let wait = Duration::from_millis(1100).saturating_sub(t.elapsed());
        tokio::time::sleep(wait).await;
    }
    g.last = Some(Instant::now());
    let resp = reqwest::Client::new()
        .get("https://nominatim.openstreetmap.org/search")
        .query(&[("format", "jsonv2"), ("limit", "5"), ("q", text)])
        .header("User-Agent", "NISAR-Pro")
        .header("Accept-Language", "en")
        .timeout(Duration::from_secs(8))
        .send()
        .await
        .map_err(|e| (StatusCode::BAD_GATEWAY, format!("Geocoder unreachable: {e}")))?;
    drop(g);
    if !resp.status().is_success() {
        return Err((StatusCode::BAD_GATEWAY, format!("Geocoder answered {}", resp.status())));
    }
    let v: Vec<Value> = resp.json().await.map_err(|e| (StatusCode::BAD_GATEWAY, e.to_string()))?;
    let num = |x: Option<&Value>| x.and_then(Value::as_str).and_then(|s| s.parse::<f64>().ok());
    let out: Vec<Found> = v
        .iter()
        .filter_map(|r| {
            let lat = num(r.get("lat"))?;
            let lon = num(r.get("lon"))?;
            // Nominatim boundingbox is [south, north, west, east] as strings.
            let bb = r.get("boundingbox").and_then(Value::as_array).and_then(|b| {
                let f: Vec<f64> = b.iter().filter_map(|x| num(Some(x))).collect();
                (f.len() == 4).then(|| [f[2], f[0], f[3], f[1]])
            });
            Some(Found {
                label: r.get("display_name").and_then(Value::as_str).unwrap_or("").to_string(),
                lat,
                lon,
                bbox: bb,
            })
        })
        .collect();
    cache.lock().await.insert(key, out.clone());
    Ok(Json(out))
}
