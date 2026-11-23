//! Continuous monitoring: watch areas for new NISAR passes and process them without anyone
//! pressing a button.
//!
//! Every `NISAR_WATCH_INTERVAL_MINUTES` (default 180; `NISAR_WATCH=off` disables it) each enabled
//! area is checked:
//!   1. ASF search for L2 GCOV granules over the area in the last `NISAR_WATCH_LOOKBACK_DAYS` (40).
//!   2. Granules are grouped by band, track and frame. The newest granule of each group is paired
//!      with the one before it (same band, track, frame: the engine's requirement).
//!   3. Missing files are downloaded into data/ (needs EARTHDATA_TOKEN), then a full-scene run starts
//!      with the same settings as the reference runs (swath-edge erosion 40). An identical finished
//!      run is reused, so a pair is never processed twice.
//!   4. Flood extent inside the area = regions of the run whose centre lies inside the area's box.
//!   5. At or above the area's alert level: message to its webhook and/or Telegram chat, an entry in
//!      the Atom feed and a CAP 1.2 alert.
//!
//! Stored in results/watch/areas.json and results/watch/events.json.
use axum::{extract::{Path as AxPath, State}, http::{header, HeaderMap, StatusCode}, response::{IntoResponse, Response}, Json};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::collections::{BTreeMap, HashMap};
use std::path::{Path, PathBuf};
use std::time::Duration;

const DIR: &str = "results/watch";
pub const ACRE_KM2: f64 = 0.004046856;
/// Same erosion as the reference full-scene runs, so their results are reused.
const EROSION: usize = 40;

/// One check at a time, and the files are only written under this lock.
static LOCK: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());

fn now() -> u64 { std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0) }
fn env_u64(k: &str, d: u64) -> u64 { std::env::var(k).ok().and_then(|v| v.parse().ok()).unwrap_or(d) }
fn yes() -> bool { true }
fn default_alert() -> f64 { 10.0 }

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Area {
    #[serde(default)]
    pub id: String,
    pub name: String,
    /// West, south, east, north in degrees.
    pub bbox: [f64; 4],
    /// "l", "s" or empty for both.
    #[serde(default)]
    pub band: Option<String>,
    #[serde(default)]
    pub track: Option<u32>,
    #[serde(default)]
    pub frame: Option<u32>,
    /// Alert when the flood extent inside the area reaches this many km².
    #[serde(default = "default_alert")]
    pub alert_km2: f64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub webhook_url: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub telegram_bot_token: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub telegram_chat_id: Option<String>,
    /// Only passes up to this date (YYYY-MM-DD): replay a past season. Empty: up to now.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub end_date: Option<String>,
    #[serde(default = "yes")]
    pub enabled: bool,
    #[serde(default)]
    pub created_at: u64,
    #[serde(default)]
    pub last_checked: Option<u64>,
    #[serde(default)]
    pub last_result: Option<String>,
}

impl Area {
    /// What the API shows: secrets replaced by flags.
    fn public(&self) -> serde_json::Value {
        let mut v = serde_json::to_value(self).unwrap_or_default();
        if let Some(o) = v.as_object_mut() {
            o.remove("webhook_url");
            o.remove("telegram_bot_token");
            o.insert("has_webhook".into(), json!(self.webhook_url.as_deref().is_some_and(|s| !s.is_empty())));
            o.insert("has_telegram".into(), json!(self.telegram_bot_token.as_deref().is_some_and(|s| !s.is_empty())
                && self.telegram_chat_id.as_deref().is_some_and(|s| !s.is_empty())));
        }
        v
    }
    fn contains(&self, lat: f64, lon: f64) -> bool {
        let [w, s, e, n] = self.bbox;
        lon >= w && lon <= e && lat >= s && lat <= n
    }
}

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct Event {
    pub id: String,
    pub area_id: String,
    pub area_name: String,
    pub created_at: u64,
    /// "done", "failed" or "waiting" (tried again on the next check).
    pub status: String,
    pub note: String,
    pub band: String,
    pub track: Option<u32>,
    pub frame: Option<u32>,
    pub baseline_id: String,
    pub active_id: String,
    pub baseline_date: String,
    pub active_date: String,
    pub run_id: Option<String>,
    pub flood_km2: Option<f64>,
    pub flood_acres: Option<f64>,
    pub regions_in_area: Option<usize>,
    pub previous_flood_km2: Option<f64>,
    pub alert: bool,
    #[serde(default)]
    pub notified: Vec<String>,
}

fn read<T: for<'de> Deserialize<'de> + Default>(name: &str) -> T {
    std::fs::read(Path::new(DIR).join(name)).ok().and_then(|b| serde_json::from_slice(&b).ok()).unwrap_or_default()
}
fn write<T: Serialize>(name: &str, v: &T) -> Result<(), String> {
    std::fs::create_dir_all(DIR).map_err(|e| e.to_string())?;
    let tmp = Path::new(DIR).join(format!(".{name}.tmp"));
    std::fs::write(&tmp, serde_json::to_vec_pretty(v).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
    std::fs::rename(&tmp, Path::new(DIR).join(name)).map_err(|e| e.to_string())
}
fn areas() -> Vec<Area> { read("areas.json") }
fn events() -> Vec<Event> { read("events.json") }

fn save_event(ev: Event) -> Result<(), String> {
    let mut all = events();
    all.retain(|e| e.id != ev.id);
    all.insert(0, ev);
    all.truncate(1000);
    write("events.json", &all)
}

fn set_area_result(id: &str, result: String) {
    let mut all = areas();
    if let Some(a) = all.iter_mut().find(|a| a.id == id) {
        a.last_checked = Some(now());
        a.last_result = Some(result);
        let _ = write("areas.json", &all);
    }
}

// ── Background loop ─────────────────────────────────────────────────────────

pub fn spawn(state: crate::AppState) {
    if std::env::var("NISAR_WATCH").is_ok_and(|v| v == "off") {
        log::info!("Watch: off (NISAR_WATCH=off)");
        return;
    }
    let every = env_u64("NISAR_WATCH_INTERVAL_MINUTES", 180).max(5);
    log::info!("Watch: checking watched areas every {every} min");
    tokio::spawn(async move {
        tokio::time::sleep(Duration::from_secs(60)).await;
        loop {
            for a in areas().into_iter().filter(|a| a.enabled) {
                check_area(&state, &a.id).await;
            }
            tokio::time::sleep(Duration::from_secs(every * 60)).await;
        }
    });
}

#[derive(Clone)]
struct Granule { name: String, url: String, band: String, date: String, track: Option<u32>, frame: Option<u32> }

/// Check one area now. Returns a one-line result.
pub async fn check_area(state: &crate::AppState, area_id: &str) -> String {
    let _guard = LOCK.lock().await;
    let Some(area) = areas().into_iter().find(|a| a.id == area_id) else { return "no such area".into() };
    let result = match check_locked(state, &area).await {
        Ok(r) => r,
        Err(e) => format!("error: {e}"),
    };
    log::info!("Watch {}: {}", area.id, result);
    set_area_result(&area.id, result.clone());
    result
}

async fn check_locked(state: &crate::AppState, area: &Area) -> Result<String, String> {
    let [w, s, e, n] = area.bbox;
    let lookback = env_u64("NISAR_WATCH_LOOKBACK_DAYS", 40) as i64;
    let end = area.end_date.as_deref().and_then(|d| chrono::NaiveDate::parse_from_str(d, "%Y-%m-%d").ok());
    let until = end.unwrap_or_else(|| chrono::Utc::now().date_naive());
    let start = (until - chrono::Duration::days(lookback)).format("%Y-%m-%d").to_string();
    let q = crate::models::NisarSearchQuery {
        bbox: format!("{w},{s},{e},{n}"),
        start_date: Some(start),
        end_date: end.map(|d| format!("{d}T23:59:59Z")),
        platform: None,
        processing_level: None,
        relative_orbit: area.track.map(|t| t.to_string()),
        asfframe: area.frame.map(|f| f.to_string()),
        joint_observation: None,
    };
    let found = crate::nasa_client::NasaClient::new().search_nisar(q).await.map_err(|e| format!("ASF search failed: {e}"))?;

    // Group by band, track and frame; one granule per date (the last listed wins).
    let mut groups: BTreeMap<(String, Option<u32>, Option<u32>), BTreeMap<String, Granule>> = BTreeMap::new();
    for sc in found {
        let name = sc.download_url.rsplit('/').next().unwrap_or(&sc.id).to_string();
        let Some(info) = crate::jobs::granule_info(&name) else { continue };
        let (Some(band), Some(date)) = (info.band, info.date) else { continue };
        if area.band.as_deref().is_some_and(|b| !b.is_empty() && !b.eq_ignore_ascii_case(&band)) { continue }
        groups.entry((band.clone(), info.track, info.frame)).or_default()
            .insert(date.clone(), Granule { name, url: sc.download_url, band, date, track: info.track, frame: info.frame });
    }
    if groups.is_empty() {
        return Ok(format!("no NISAR GCOV pass over the area in the last {lookback} days"));
    }

    let mut out = Vec::new();
    for ((band, track, frame), by_date) in groups {
        let list: Vec<Granule> = by_date.into_values().collect();
        let label = format!("{}-band T{} F{}", band.to_uppercase(), track.map_or("?".into(), |t| t.to_string()), frame.map_or("?".into(), |f| f.to_string()));
        if list.len() < 2 {
            out.push(format!("{label}: one pass ({}), waiting for the next", list[0].date));
            continue;
        }
        let (base, act) = (&list[list.len() - 2], &list[list.len() - 1]);
        let ev_id = format!("{}-{}-{}-{}-{}", area.id, band, track.unwrap_or(0), frame.unwrap_or(0), act.date);
        if events().iter().any(|e| e.id == ev_id && e.status != "waiting") {
            out.push(format!("{label}: {} already done", act.date));
            continue;
        }
        let ev = process_pair(state, area, &ev_id, base, act).await;
        out.push(format!("{label}: {} {}", act.date, ev.note));
        save_event(ev)?;
    }
    Ok(out.join("; "))
}

async fn process_pair(state: &crate::AppState, area: &Area, ev_id: &str, base: &Granule, act: &Granule) -> Event {
    let mut ev = Event {
        id: ev_id.to_string(),
        area_id: area.id.clone(),
        area_name: area.name.clone(),
        created_at: now(),
        band: act.band.to_uppercase(),
        track: act.track,
        frame: act.frame,
        baseline_id: base.name.clone(),
        active_id: act.name.clone(),
        baseline_date: base.date.clone(),
        active_date: act.date.clone(),
        ..Default::default()
    };

    // 1. Files on this machine, downloading what is missing.
    let local: HashMap<String, String> = crate::jobs::list_scenes().into_iter().map(|s| (s.name, s.path)).collect();
    let mut paths = Vec::new();
    for g in [base, act] {
        if let Some(p) = local.get(&g.name) {
            paths.push(p.clone());
            continue;
        }
        let label = format!("the {} {}-band pass", g.date, g.band.to_uppercase());
        match download(&g.url, &g.name, &label).await {
            Ok(p) => paths.push(p),
            Err(e) => {
                ev.status = "waiting".into();
                ev.note = e;
                return ev;
            }
        }
    }

    // 2. Run (or reuse an identical finished run).
    let req = crate::models::ProcessRequest {
        input_file: Some(paths[1].clone()),
        slave_file: Some(paths[0].clone()),
        pipeline: Some("flood".into()),
        crop_preset: Some("full".into()),
        radar_band: Some(act.band.to_lowercase()),
        swath_edge_erosion: Some(EROSION),
        ..Default::default()
    };
    let run_id = match crate::jobs::start_job(state.clone(), req).await {
        Ok(r) => r.job_id,
        Err(e) => {
            ev.status = "failed".into();
            ev.note = format!("could not start the run: {e}");
            return ev;
        }
    };
    ev.run_id = Some(run_id.clone());
    if let Err(e) = wait_for(state, &run_id).await {
        ev.status = "failed".into();
        ev.note = e;
        return ev;
    }

    // 3. Flood extent inside the area.
    let (acres, count) = match extent_in_area(&run_id, area) {
        Ok(v) => v,
        Err(e) => {
            ev.status = "failed".into();
            ev.note = e;
            return ev;
        }
    };
    let km2 = acres * ACRE_KM2;
    ev.flood_km2 = Some(km2);
    ev.flood_acres = Some(acres);
    ev.regions_in_area = Some(count);
    ev.previous_flood_km2 = events().iter()
        .find(|e| e.area_id == area.id && e.status == "done" && e.band == ev.band && e.track == ev.track && e.frame == ev.frame && e.active_date < ev.active_date)
        .and_then(|e| e.flood_km2);
    ev.alert = km2 >= area.alert_km2;
    ev.status = "done".into();
    ev.note = format!("flood extent {:.2} km² ({:.0} acres) in {} regions{}", km2, acres, count, if ev.alert { ", alert sent" } else { "" });
    if ev.alert {
        ev.notified = notify(area, &ev).await;
        if ev.notified.is_empty() {
            ev.note = ev.note.replace(", alert sent", ", alert (no channel set)");
        }
    }
    ev
}

async fn wait_for(state: &crate::AppState, run_id: &str) -> Result<(), String> {
    let deadline = std::time::Instant::now() + Duration::from_secs(3 * 3600);
    loop {
        let job = state.jobs.read().await.get(run_id).cloned();
        let Some(job) = job else { return Err(format!("run {run_id} disappeared")) };
        match &job.read().await.status {
            crate::jobs::JobStatus::Completed => return Ok(()),
            crate::jobs::JobStatus::Failed(e) => return Err(format!("run {run_id} failed: {e}")),
            _ => {}
        }
        if std::time::Instant::now() > deadline {
            return Err(format!("run {run_id} took more than 3 hours"));
        }
        tokio::time::sleep(Duration::from_secs(5)).await;
    }
}

/// Sum of region areas (acres) whose centre lies inside the area, and how many regions.
pub fn extent_in_area(run_id: &str, area: &Area) -> Result<(f64, usize), String> {
    let p = PathBuf::from("results/jobs").join(run_id).join(format!("{run_id}_flood.geo.json"));
    let v: serde_json::Value = serde_json::from_slice(&std::fs::read(&p).map_err(|e| format!("{}: {e}", p.display()))?)
        .map_err(|e| format!("{}: {e}", p.display()))?;
    let mut acres = 0.0;
    let mut n = 0;
    for f in v["features"].as_array().into_iter().flatten() {
        let pr = &f["properties"];
        let (Some(lat), Some(lon), Some(a)) = (pr["centroid_lat"].as_f64(), pr["centroid_lon"].as_f64(), pr["area_acres"].as_f64()) else { continue };
        if area.contains(lat, lon) {
            acres += a;
            n += 1;
        }
    }
    Ok((acres, n))
}

fn http() -> reqwest::Client {
    reqwest::Client::builder().user_agent("NISAR-Pro").timeout(Duration::from_secs(20)).build().unwrap_or_default()
}

fn message(ev: &Event) -> String {
    let fmt_date = |d: &str| chrono::NaiveDate::parse_from_str(d, "%Y-%m-%d").map(|d| d.format("%-d %b %Y").to_string()).unwrap_or(d.to_string());
    let change = match ev.previous_flood_km2 {
        Some(p) => format!(" Previous pass: {p:.2} km²."),
        None => String::new(),
    };
    let link = std::env::var("NISAR_PUBLIC_URL").ok().filter(|u| !u.is_empty())
        .map(|u| format!("\nOpen: {}/app", u.trim_end_matches('/'))).unwrap_or_default();
    format!(
        "NISAR Pro: flood extent in {} is {:.2} km² ({:.0} acres), {} → {}, {}-band, {} regions.{}\nWater detected by radar that was not there on {}. Not confirmed on the ground.{}",
        ev.area_name, ev.flood_km2.unwrap_or(0.0), ev.flood_acres.unwrap_or(0.0), fmt_date(&ev.baseline_date), fmt_date(&ev.active_date),
        ev.band, ev.regions_in_area.unwrap_or(0), change, fmt_date(&ev.baseline_date), link
    )
}

/// HTTPS anywhere; plain HTTP only to this machine (a local n8n, Node-RED or test receiver).
fn webhook_ok(u: &str) -> bool {
    u.starts_with("https://") || u.starts_with("http://127.0.0.1:") || u.starts_with("http://localhost:")
}

/// Send the alert to every channel the area has. Returns the channels that accepted it.
async fn notify(area: &Area, ev: &Event) -> Vec<String> {
    let text = message(ev);
    let mut ok = Vec::new();
    if let Some(url) = area.webhook_url.as_deref().filter(|u| webhook_ok(u)) {
        // "text" for Slack, Mattermost and Google Chat; "content" for Discord; the event for anything else.
        let body = json!({ "text": text, "content": text, "event": ev });
        match http().post(url).json(&body).send().await {
            Ok(r) if r.status().is_success() => ok.push("webhook".to_string()),
            Ok(r) => log::warn!("Watch webhook: HTTP {}", r.status()),
            Err(e) => log::warn!("Watch webhook: {e}"),
        }
    }
    if let (Some(tok), Some(chat)) = (area.telegram_bot_token.as_deref().filter(|s| !s.is_empty()), area.telegram_chat_id.as_deref().filter(|s| !s.is_empty())) {
        let url = format!("https://api.telegram.org/bot{tok}/sendMessage");
        match http().post(&url).json(&json!({ "chat_id": chat, "text": text })).send().await {
            Ok(r) if r.status().is_success() => ok.push("telegram".to_string()),
            Ok(r) => log::warn!("Watch Telegram: HTTP {}", r.status()),
            Err(e) => log::warn!("Watch Telegram: {}", e.without_url()),
        }
    }
    ok
}

/// Download a granule from ASF into data/ (written to .part first, renamed when complete).
async fn download(url: &str, name: &str, label: &str) -> Result<String, String> {
    let token = std::env::var("EARTHDATA_TOKEN").or_else(|_| std::env::var("ASF_TOKEN")).ok().filter(|t| !t.trim().is_empty())
        .ok_or_else(|| format!("{label} is not on this computer; set EARTHDATA_TOKEN to download it"))?;
    let u = reqwest::Url::parse(url).map_err(|e| e.to_string())?;
    let host_ok = u.scheme() == "https" && u.host_str().is_some_and(|h| {
        h == "nisar.asf.earthdatacloud.nasa.gov" || h == "cumulus.asf.earthdatacloud.nasa.gov" || h == "datapool.asf.alaska.edu" || h.ends_with(".asf.alaska.edu")
    });
    if !host_ok || name.contains('/') || name.contains("..") {
        return Err(format!("refusing to download {url}"));
    }
    tokio::fs::create_dir_all("data").await.map_err(|e| e.to_string())?;
    let dest = format!("data/{name}");
    let part = format!("{dest}.part");
    let client = reqwest::Client::builder().user_agent("NISAR-Pro").cookie_store(true).build().map_err(|e| e.to_string())?;
    let res = client.get(url).bearer_auth(token).send().await.map_err(|e| format!("download of {label} failed: {e}"))?;
    if !res.status().is_success() {
        return Err(format!("download of {label} failed: HTTP {}", res.status()));
    }
    use futures_util::StreamExt;
    use tokio::io::AsyncWriteExt;
    let mut f = tokio::fs::File::create(&part).await.map_err(|e| e.to_string())?;
    let mut s = res.bytes_stream();
    while let Some(c) = s.next().await {
        f.write_all(&c.map_err(|e| format!("download of {label} failed: {e}"))?).await.map_err(|e| e.to_string())?;
    }
    f.flush().await.map_err(|e| e.to_string())?;
    tokio::fs::rename(&part, &dest).await.map_err(|e| e.to_string())?;
    log::info!("Watch: downloaded {dest}");
    Ok(std::fs::canonicalize(&dest).map(|p| p.to_string_lossy().to_string()).unwrap_or(dest))
}

// ── HTTP API ────────────────────────────────────────────────────────────────

pub async fn overview() -> Json<serde_json::Value> {
    let ev: Vec<Event> = events().into_iter().take(200).collect();
    Json(json!({
        "enabled": !std::env::var("NISAR_WATCH").is_ok_and(|v| v == "off"),
        "interval_minutes": env_u64("NISAR_WATCH_INTERVAL_MINUTES", 180).max(5),
        "lookback_days": env_u64("NISAR_WATCH_LOOKBACK_DAYS", 40),
        "can_download": std::env::var("EARTHDATA_TOKEN").or_else(|_| std::env::var("ASF_TOKEN")).is_ok_and(|t| !t.trim().is_empty()),
        "areas": areas().iter().map(Area::public).collect::<Vec<_>>(),
        "events": ev,
    }))
}

/// Create or update an area. Secret fields left empty keep their stored value.
pub async fn save_area(Json(mut a): Json<Area>) -> Response {
    let [w, s, e, n] = a.bbox;
    let valid = w.is_finite() && s.is_finite() && e.is_finite() && n.is_finite()
        && (-180.0..=180.0).contains(&w) && (-180.0..=180.0).contains(&e) && (-90.0..=90.0).contains(&s) && (-90.0..=90.0).contains(&n)
        && w < e && s < n && (e - w) <= 5.0 && (n - s) <= 5.0;
    if !valid {
        return (StatusCode::BAD_REQUEST, "bbox must be [west, south, east, north] in degrees, at most 5° on a side").into_response();
    }
    a.name = a.name.trim().chars().take(80).collect();
    if a.name.is_empty() {
        return (StatusCode::BAD_REQUEST, "name is required").into_response();
    }
    if a.webhook_url.as_deref().is_some_and(|u| !u.is_empty() && !webhook_ok(u)) {
        return (StatusCode::BAD_REQUEST, "webhook_url must start with https:// (http:// only for localhost)").into_response();
    }
    a.end_date = a.end_date.map(|d| d.trim().to_string()).filter(|d| !d.is_empty());
    if a.end_date.as_deref().is_some_and(|d| chrono::NaiveDate::parse_from_str(d, "%Y-%m-%d").is_err()) {
        return (StatusCode::BAD_REQUEST, "end_date must be YYYY-MM-DD").into_response();
    }
    if !(a.alert_km2.is_finite() && a.alert_km2 >= 0.0) {
        return (StatusCode::BAD_REQUEST, "alert_km2 must be 0 or more").into_response();
    }
    let _g = LOCK.lock().await;
    let mut all = areas();
    if a.id.is_empty() {
        a.id = format!("area-{}", &uuid::Uuid::new_v4().to_string()[..8]);
        a.created_at = now();
    } else if !crate::jobs::is_safe_id(&a.id) {
        return (StatusCode::BAD_REQUEST, "bad id").into_response();
    }
    if let Some(old) = all.iter().find(|x| x.id == a.id) {
        let keep = |new: &mut Option<String>, old: &Option<String>| if new.as_deref().is_none_or(str::is_empty) { *new = old.clone() };
        keep(&mut a.webhook_url, &old.webhook_url);
        keep(&mut a.telegram_bot_token, &old.telegram_bot_token);
        keep(&mut a.telegram_chat_id, &old.telegram_chat_id);
        a.created_at = old.created_at;
        a.last_checked = old.last_checked;
        a.last_result = old.last_result.clone();
    }
    let public = a.public();
    all.retain(|x| x.id != a.id);
    all.push(a);
    match write("areas.json", &all) {
        Ok(()) => (StatusCode::OK, Json(public)).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, e).into_response(),
    }
}

pub async fn delete_area(AxPath(id): AxPath<String>) -> Response {
    let _g = LOCK.lock().await;
    let mut all = areas();
    let before = all.len();
    all.retain(|a| a.id != id);
    if all.len() == before {
        return (StatusCode::NOT_FOUND, "no such area").into_response();
    }
    match write("areas.json", &all) {
        Ok(()) => StatusCode::NO_CONTENT.into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, e).into_response(),
    }
}

/// Start a check in the background; the result appears in GET /watch.
pub async fn check_now(State(state): State<crate::AppState>, AxPath(id): AxPath<String>) -> Response {
    if !areas().iter().any(|a| a.id == id) {
        return (StatusCode::NOT_FOUND, "no such area").into_response();
    }
    tokio::spawn(async move { check_area(&state, &id).await; });
    (StatusCode::ACCEPTED, Json(json!({ "started": true }))).into_response()
}

// ── Feeds for other systems: Atom feed of alerts, CAP 1.2 per alert ────────

fn esc(s: &str) -> String {
    s.replace('&', "&amp;").replace('<', "&lt;").replace('>', "&gt;").replace('"', "&quot;").replace('\'', "&apos;")
}

/// scheme://host the request came in on (honours X-Forwarded-Proto behind a proxy or tunnel).
pub fn base_url(h: &HeaderMap) -> String {
    if let Ok(u) = std::env::var("NISAR_PUBLIC_URL") {
        if !u.is_empty() { return u.trim_end_matches('/').to_string(); }
    }
    let host = h.get(header::HOST).and_then(|v| v.to_str().ok()).unwrap_or("localhost:3000");
    let proto = h.get("x-forwarded-proto").and_then(|v| v.to_str().ok()).unwrap_or("http");
    format!("{proto}://{host}")
}

fn cap_time(t: u64) -> String {
    chrono::DateTime::from_timestamp(t as i64, 0).unwrap_or_default().format("%Y-%m-%dT%H:%M:%S+00:00").to_string()
}

fn cap_xml(ev: &Event, area: Option<&Area>, base: &str) -> String {
    let sender = std::env::var("NISAR_CAP_SENDER").unwrap_or_else(|_| "nisar-pro".into());
    let polygon = area.map(|a| {
        let [w, s, e, n] = a.bbox;
        format!("<polygon>{s},{w} {n},{w} {n},{e} {s},{e} {s},{w}</polygon>")
    }).unwrap_or_default();
    format!(r#"<?xml version="1.0" encoding="UTF-8"?>
<alert xmlns="urn:oasis:names:tc:emergency:cap:1.2">
  <identifier>{id}</identifier>
  <sender>{sender}</sender>
  <sent>{sent}</sent>
  <status>Actual</status>
  <msgType>Alert</msgType>
  <scope>Public</scope>
  <info>
    <language>en</language>
    <category>Met</category>
    <event>Flood extent detected by satellite radar</event>
    <urgency>Unknown</urgency>
    <severity>Unknown</severity>
    <certainty>Possible</certainty>
    <senderName>NISAR Pro</senderName>
    <headline>{headline}</headline>
    <description>{desc}</description>
    <instruction>Check on the ground before acting. Radar shows where water appeared between two satellite passes; it does not show depth or damage.</instruction>
    <web>{base}/app</web>
    <parameter><valueName>flood_extent_km2</valueName><value>{km2:.2}</value></parameter>
    <parameter><valueName>flood_extent_acres</valueName><value>{ac:.0}</value></parameter>
    <parameter><valueName>baseline_date</valueName><value>{b}</value></parameter>
    <parameter><valueName>active_date</valueName><value>{a}</value></parameter>
    <parameter><valueName>band</valueName><value>{band}</value></parameter>
    <area>
      <areaDesc>{area_name}</areaDesc>
      {polygon}
    </area>
  </info>
</alert>
"#,
        id = esc(&format!("nisar-pro-{}", ev.id)), sender = esc(&sender), sent = cap_time(ev.created_at),
        headline = esc(&format!("Flood extent {:.2} km² in {}", ev.flood_km2.unwrap_or(0.0), ev.area_name)),
        desc = esc(&message(ev)), base = esc(base), km2 = ev.flood_km2.unwrap_or(0.0), ac = ev.flood_acres.unwrap_or(0.0),
        b = esc(&ev.baseline_date), a = esc(&ev.active_date), band = esc(&ev.band), area_name = esc(&ev.area_name))
}

pub async fn cap(headers: HeaderMap, AxPath(file): AxPath<String>) -> Response {
    let id = file.trim_end_matches(".xml");
    let Some(ev) = events().into_iter().find(|e| e.id == id && e.alert) else {
        return (StatusCode::NOT_FOUND, "no such alert").into_response();
    };
    let area = areas().into_iter().find(|a| a.id == ev.area_id);
    ([(header::CONTENT_TYPE, "application/cap+xml; charset=utf-8")], cap_xml(&ev, area.as_ref(), &base_url(&headers))).into_response()
}

pub async fn feed(headers: HeaderMap) -> Response {
    let base = base_url(&headers);
    let alerts: Vec<Event> = events().into_iter().filter(|e| e.alert).take(100).collect();
    let updated = cap_time(alerts.first().map_or(now(), |e| e.created_at));
    let mut x = format!(r#"<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <id>{b}/watch/feed.xml</id>
  <title>NISAR Pro flood alerts</title>
  <updated>{updated}</updated>
  <link rel="self" href="{b}/watch/feed.xml"/>
  <author><name>NISAR Pro</name></author>
"#, b = esc(&base));
    for e in &alerts {
        x.push_str(&format!(r#"  <entry>
    <id>{b}/watch/cap/{id}.xml</id>
    <title>{t}</title>
    <updated>{u}</updated>
    <link rel="alternate" type="application/cap+xml" href="{b}/watch/cap/{id}.xml"/>
    <summary>{s}</summary>
  </entry>
"#, b = esc(&base), id = esc(&e.id), t = esc(&format!("Flood extent {:.2} km² in {}", e.flood_km2.unwrap_or(0.0), e.area_name)),
            u = cap_time(e.created_at), s = esc(&message(e))));
    }
    x.push_str("</feed>\n");
    ([(header::CONTENT_TYPE, "application/atom+xml; charset=utf-8")], x).into_response()
}

#[cfg(test)]
mod tests {
    use super::*;
    fn area() -> Area {
        serde_json::from_value(json!({ "name": "Test <&>", "bbox": [85.0, 25.0, 86.0, 26.0] })).unwrap()
    }
    #[test]
    fn defaults_and_contains() {
        let a = area();
        assert!(a.enabled);
        assert_eq!(a.alert_km2, 10.0);
        assert!(a.contains(25.5, 85.5));
        assert!(!a.contains(26.5, 85.5));
        assert!(!a.contains(25.5, 86.1));
    }
    #[test]
    fn public_hides_secrets() {
        let mut a = area();
        a.telegram_bot_token = Some("123:abc".into());
        a.telegram_chat_id = Some("42".into());
        let v = a.public();
        assert!(v.get("telegram_bot_token").is_none());
        assert_eq!(v["has_telegram"], true);
        assert_eq!(v["has_webhook"], false);
    }
    #[test]
    fn cap_is_escaped_and_has_polygon() {
        let a = area();
        let ev = Event { id: "x".into(), area_name: a.name.clone(), flood_km2: Some(12.345), flood_acres: Some(3050.0), alert: true,
            baseline_date: "2026-08-31".into(), active_date: "2026-09-12".into(), band: "L".into(), ..Default::default() };
        let x = cap_xml(&ev, Some(&a), "http://h");
        assert!(x.contains("Test &lt;&amp;&gt;"));
        assert!(x.contains("<polygon>25,85 26,85 26,86 25,86 25,85</polygon>"));
        assert!(x.contains("<value>12.35</value>"));
        assert!(x.contains("Not confirmed on the ground."));
    }
}
