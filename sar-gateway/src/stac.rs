//! STAC 1.0 catalog of finished runs, so QGIS, ArcGIS, pystac or a state GIS can find every
//! result without the dashboard.
//!
//!   GET /stac                 catalog with one item link per finished run
//!   GET /stac/items/<run id>  item: footprint, dates, flood extent, links to GeoTIFF/GeoJSON/report
use axum::{extract::{Path, State}, http::{header, HeaderMap, StatusCode}, response::{IntoResponse, Response}, Json};
use serde_json::{json, Value};

const MEDIA: &str = "application/json";

pub async fn catalog(State(state): State<crate::AppState>, headers: HeaderMap) -> Response {
    let base = crate::watch::base_url(&headers);
    let mut links = vec![
        json!({ "rel": "self", "href": format!("{base}/stac"), "type": MEDIA }),
        json!({ "rel": "root", "href": format!("{base}/stac"), "type": MEDIA }),
    ];
    let mut ids = Vec::new();
    for (id, j) in state.jobs.read().await.iter() {
        let j = j.read().await;
        if matches!(j.status, crate::jobs::JobStatus::Completed) && j.bbox.is_some() {
            ids.push((j.created_at, id.clone()));
        }
    }
    ids.sort();
    for (_, id) in ids.iter().rev() {
        links.push(json!({ "rel": "item", "href": format!("{base}/stac/items/{id}"), "type": "application/geo+json" }));
    }
    ([(header::CONTENT_TYPE, MEDIA)], Json(json!({
        "type": "Catalog",
        "stac_version": "1.0.0",
        "id": "nisar-pro",
        "title": "NISAR Pro flood runs",
        "description": "Flood extent from NISAR L- and S-band radar (L2 GCOV), one item per run. Water detected by radar; not confirmed on the ground.",
        "links": links,
    }))).into_response()
}

pub async fn item(State(state): State<crate::AppState>, headers: HeaderMap, Path(id): Path<String>) -> Response {
    let id = id.trim_end_matches(".json").to_string();
    let job = state.jobs.read().await.get(&id).cloned();
    let Some(job) = job else { return (StatusCode::NOT_FOUND, "no such run").into_response() };
    let j = job.read().await;
    let (Some(b), true) = (&j.bbox, matches!(j.status, crate::jobs::JobStatus::Completed)) else {
        return (StatusCode::NOT_FOUND, "run not finished").into_response();
    };
    let base = crate::watch::base_url(&headers);
    let sm = j.summary.clone().unwrap_or(Value::Null);
    let date = |k: &str| sm[k].as_str().map(str::to_string);
    let (start, end) = (date("baseline_date"), date("active_date"));
    let mut assets = serde_json::Map::new();
    let mut add = |key: &str, href: &Option<String>, typ: &str, role: &str, title: &str| {
        if let Some(h) = href {
            assets.insert(key.into(), json!({ "href": format!("{base}{h}"), "type": typ, "roles": [role], "title": title }));
        }
    };
    let a = &j.artifacts;
    add("classes", &a.class_tif, "image/tiff; application=geotiff", "data", "Water classes (0 land, 1 stable water, 2-4 new water by confidence, 5 water loss), UTM");
    add("regions", &a.geojson, "application/geo+json", "data", "Flood regions with area and confidence");
    add("report", &a.report, "application/json", "metadata", "Run report: areas, thresholds, product details");
    add("overlay", &a.overlay, "image/png", "overlay", "Class overlay, Web Mercator");
    add("active_preview", &a.active_preview, "image/png", "visual", "Radar, later pass");
    add("baseline_preview", &a.baseline_preview, "image/png", "visual", "Radar, earlier pass");
    let props = json!({
        "datetime": Value::Null,
        "start_datetime": start.as_ref().map(|d| format!("{d}T00:00:00Z")),
        "end_datetime": end.as_ref().map(|d| format!("{d}T23:59:59Z")),
        "created": chrono::DateTime::from_timestamp(j.created_at as i64, 0).map(|t| t.to_rfc3339()),
        "platform": "nisar",
        "constellation": "nisar",
        "nisar_pro:band": sm["band"],
        "nisar_pro:baseline_granule": sm["baseline_id"],
        "nisar_pro:active_granule": sm["active_id"],
        "nisar_pro:flood_extent_km2": sm["new_water"]["km2"],
        "nisar_pro:flood_extent_acres": sm["new_water"]["acres"],
        "nisar_pro:water_loss_km2": sm["water_loss"]["km2"],
        "nisar_pro:stable_water_km2": sm["stable_water"]["km2"],
        "nisar_pro:valid_area_km2": sm["valid_area"]["km2"],
        "nisar_pro:regions": sm["regions"],
        "nisar_pro:note": "Water detected by radar between the two passes. Not confirmed on the ground.",
    });
    let (w, s, e, n) = (b.west, b.south, b.east, b.north);
    ([(header::CONTENT_TYPE, "application/geo+json")], Json(json!({
        "type": "Feature",
        "stac_version": "1.0.0",
        "id": id,
        "bbox": [w, s, e, n],
        "geometry": { "type": "Polygon", "coordinates": [[[w, s], [e, s], [e, n], [w, n], [w, s]]] },
        "properties": props,
        "assets": assets,
        "links": [
            { "rel": "self", "href": format!("{base}/stac/items/{id}"), "type": "application/geo+json" },
            { "rel": "root", "href": format!("{base}/stac"), "type": MEDIA },
            { "rel": "parent", "href": format!("{base}/stac"), "type": MEDIA },
        ],
    }))).into_response()
}
