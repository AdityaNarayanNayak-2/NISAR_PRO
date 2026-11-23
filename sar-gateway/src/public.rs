//! Public demo mode: let anyone on the internet queue a run on this machine, safely.
//!
//! `NISAR_PUBLIC_MODE=on` (usually behind a Cloudflare Tunnel):
//!   - visitors can look at everything and start runs (`POST /jobs`) without a login;
//!   - a visitor's run may only use GCOV scenes already on this machine (no file paths of their
//!     own, no GUNW or water mask files) and cannot force a re-run of an identical finished run;
//!   - each visitor (client address; Cloudflare's `CF-Connecting-IP`) may have
//!     `NISAR_PUBLIC_RUNS_PER_VISITOR` runs waiting or running (default 1), and at most
//!     `NISAR_PUBLIC_QUEUE_MAX` runs wait or run in total (default 20);
//!   - everything else that changes the machine (delete, cancel, upload, NASA downloads, Watch
//!     areas) needs the admin login `NISAR_BASIC_AUTH`; without it nobody can do those.
//!
//! A request identical to a finished run is answered with that run at once and is not limited.
use crate::jobs::JobStatus;
use crate::models::ProcessRequest;
use axum::{extract::State, http::{HeaderMap, Method}, Json};
use serde_json::{json, Value};

/// Start of the error text for "try again later" answers (sent as HTTP 429).
pub const BUSY: &str = "Busy: ";

pub fn enabled() -> bool {
    std::env::var("NISAR_PUBLIC_MODE").map(|v| matches!(v.trim(), "on" | "1" | "true" | "yes")).unwrap_or(false)
}

fn env_usize(k: &str, d: usize) -> usize {
    std::env::var(k).ok().and_then(|v| v.trim().parse().ok()).unwrap_or(d)
}

pub fn runs_per_visitor() -> usize { env_usize("NISAR_PUBLIC_RUNS_PER_VISITOR", 1).max(1) }
pub fn queue_max() -> usize { env_usize("NISAR_PUBLIC_QUEUE_MAX", 20).max(1) }

/// Requests a visitor may send without the admin login.
pub fn open_to_visitors(method: &Method, path: &str) -> bool {
    match *method {
        Method::GET | Method::HEAD | Method::OPTIONS => !path.starts_with("/asf/download-stream"),
        Method::POST => path == "/jobs",
        _ => false,
    }
}

/// Check what a visitor asked for before anything is queued.
pub fn check_request(req: &mut ProcessRequest) -> Result<(), String> {
    if req.gunw_file.as_deref().is_some_and(|s| !s.trim().is_empty())
        || req.water_mask.as_deref().is_some_and(|s| !s.trim().is_empty())
    {
        return Err("In the public demo only the radar scenes on this machine can be used (no GUNW or water mask files).".into());
    }
    let scenes: Vec<String> = crate::jobs::list_scenes().into_iter().map(|s| s.path).collect();
    for (label, f) in [("Active", &req.input_file), ("Baseline", &req.slave_file)] {
        let p = f.as_deref().unwrap_or("").trim();
        if !scenes.iter().any(|s| s == p) {
            return Err(format!("{label} scene is not one of the scenes on this machine. Pick it from the list."));
        }
    }
    req.force = false;
    Ok(())
}

/// Room in the queue for one more run from `owner`?
pub async fn check_capacity(state: &crate::AppState, owner: &str) -> Result<(), String> {
    let (mut mine, mut all) = (0, 0);
    for lock in state.jobs.read().await.values() {
        let m = lock.read().await;
        if matches!(m.status, JobStatus::Queued | JobStatus::Running) {
            all += 1;
            if m.owner.as_deref() == Some(owner) { mine += 1; }
        }
    }
    if mine >= runs_per_visitor() {
        return Err(format!("{BUSY}You already have a run waiting or running. Start another when it ends."));
    }
    if all >= queue_max() {
        return Err(format!("{BUSY}The queue is full ({all} runs). Please try again in a few minutes."));
    }
    Ok(())
}

/// `GET /config`: what this gateway allows, so the dashboard can show the right controls.
pub async fn config(State(state): State<crate::AppState>, headers: HeaderMap) -> Json<Value> {
    let public = enabled();
    let admin = crate::auth::is_admin(&headers);
    let me = crate::rate_limit::extract_client_ip(&headers, None);
    let (mut mine, mut active) = (0, 0);
    for lock in state.jobs.read().await.values() {
        let m = lock.read().await;
        if matches!(m.status, JobStatus::Queued | JobStatus::Running) {
            active += 1;
            if m.owner.as_deref() == Some(me.as_str()) { mine += 1; }
        }
    }
    Json(json!({
        "public_mode": public,
        // Without public mode the login (if any) already let this request in.
        "admin": !public || admin,
        "queue": if crate::queue::enabled() { "redis" } else { "local" },
        "runs_per_visitor": public.then(runs_per_visitor),
        "queue_max": public.then(queue_max),
        "active_runs": active,
        "your_active_runs": public.then_some(mine),
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn visitors_cannot_change_the_machine() {
        assert!(open_to_visitors(&Method::GET, "/jobs"));
        assert!(open_to_visitors(&Method::POST, "/jobs"));
        assert!(!open_to_visitors(&Method::GET, "/asf/download-stream"));
        assert!(!open_to_visitors(&Method::DELETE, "/jobs/run-1"));
        assert!(!open_to_visitors(&Method::POST, "/jobs/run-1/cancel"));
        assert!(!open_to_visitors(&Method::POST, "/upload"));
        assert!(!open_to_visitors(&Method::POST, "/watch/areas"));
        assert!(!open_to_visitors(&Method::POST, "/jobs/prune"));
    }

    #[test]
    fn visitor_files_are_refused() {
        let mut r = ProcessRequest { input_file: Some("/etc/passwd".into()), slave_file: Some("/etc/hosts".into()), ..Default::default() };
        assert!(check_request(&mut r).is_err());
        let mut r = ProcessRequest { water_mask: Some("/x.tif".into()), ..Default::default() };
        assert!(check_request(&mut r).unwrap_err().contains("GUNW"));
    }
}
