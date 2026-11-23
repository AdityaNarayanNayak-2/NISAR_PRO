//! Redis job queue for running many engine workers (Kubernetes, or several machines).
//!
//! Off unless `NISAR_QUEUE_URL=redis://host:6379` is set. Then the gateway does not run the
//! engine itself: `POST /jobs` puts the run in a Redis list and `sar-gateway worker` processes
//! (same image) take runs from it. Gateway and workers share the `results/` and data folders
//! (one machine, or a ReadWriteMany volume).
//!
//! Redis keys:
//!   nisar:queue          LIST    run ids waiting (LPUSH new, workers take from the right)
//!   nisar:running        LIST    run ids a worker has taken (moved atomically with BLMOVE)
//!   nisar:job:<id>       STRING  JSON {request, created_at, owner}
//!   nisar:lease:<id>     STRING  set by the worker, expires 60 s after its last renewal
//!   nisar:attempts:<id>  INT     times the run was put back after its worker disappeared
//!   nisar:events         PUBSUB  JSON events: queued, running, log, completed, failed, cancel, deleted
//!   nisar:lock:<name>    STRING  one gateway copy does the reaper and the Watch checks
//!
//! A run whose worker stops (pod killed, machine lost) loses its lease. The reaper puts it back
//! in the queue twice, then marks it failed. Every gateway copy subscribes to the events, so
//! the run list and live logs are the same on all of them.
use crate::jobs::{self, JobStatus};
use crate::models::ProcessRequest;
use log::{error, info, warn};
use redis::aio::ConnectionManager;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::sync::atomic::{AtomicU64, Ordering::Relaxed};
use std::sync::{Arc, OnceLock};
use std::time::{Duration, Instant};
use tokio::sync::Mutex;

const QUEUE: &str = "nisar:queue";
const RUNNING: &str = "nisar:running";
const EVENTS: &str = "nisar:events";
const LEASE_SECS: u64 = 60;
const MAX_ATTEMPTS: i64 = 3;

static CLIENT: OnceLock<redis::Client> = OnceLock::new();
static CONN: OnceLock<ConnectionManager> = OnceLock::new();
static WAITING: AtomicU64 = AtomicU64::new(0);
static TAKEN: AtomicU64 = AtomicU64::new(0);

#[derive(Serialize, Deserialize, Clone, Copy, PartialEq, Eq, Debug)]
#[serde(rename_all = "snake_case")]
pub enum Kind { Queued, Running, Log, Completed, Failed, Cancel, Deleted }

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Event {
    pub id: String,
    pub kind: Kind,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub text: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub request: Option<ProcessRequest>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub created_at: Option<u64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub owner: Option<String>,
    /// Engine time, on completed and failed.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub seconds: Option<f64>,
}

impl Event {
    fn new(id: &str, kind: Kind) -> Self {
        Event { id: id.into(), kind, text: None, request: None, created_at: None, owner: None, seconds: None }
    }
    fn text(mut self, t: impl Into<String>) -> Self { self.text = Some(t.into()); self }
}

#[derive(Serialize, Deserialize)]
struct JobInfo {
    request: ProcessRequest,
    created_at: u64,
    owner: Option<String>,
}

pub fn enabled() -> bool { CONN.get().is_some() }

/// Waiting and taken run counts (refreshed every 10 s by the gateway), for /metrics.
pub fn lengths() -> (u64, u64) { (WAITING.load(Relaxed), TAKEN.load(Relaxed)) }

fn conn() -> ConnectionManager { CONN.get().expect("queue not initialised").clone() }

fn holder() -> &'static str {
    static H: OnceLock<String> = OnceLock::new();
    H.get_or_init(|| {
        let host = std::env::var("HOSTNAME").unwrap_or_else(|_| "nisar".into());
        format!("{host}-{}", &uuid::Uuid::new_v4().simple().to_string()[..6])
    })
}

/// Connect when NISAR_QUEUE_URL is set (retries for a minute: Redis may start after us).
/// With a state (gateway), also start the event listener and the reaper.
pub async fn init(state: Option<crate::AppState>) -> Result<bool, String> {
    let Some(url) = std::env::var("NISAR_QUEUE_URL").ok().filter(|u| !u.trim().is_empty()) else { return Ok(false) };
    let client = redis::Client::open(url.trim()).map_err(|e| format!("NISAR_QUEUE_URL: {e}"))?;
    let mut last = String::new();
    for _ in 0..30 {
        match ConnectionManager::new(client.clone()).await {
            Ok(c) => {
                let _ = CLIENT.set(client);
                let _ = CONN.set(c);
                if let Some(state) = state {
                    tokio::spawn(listen(state.clone()));
                    tokio::spawn(reaper());
                }
                return Ok(true);
            }
            Err(e) => {
                last = e.to_string();
                warn!("Queue: cannot reach Redis yet ({last}), retrying");
                tokio::time::sleep(Duration::from_secs(2)).await;
            }
        }
    }
    Err(format!("Could not connect to Redis: {last}"))
}

async fn publish(ev: &Event) {
    let Ok(text) = serde_json::to_string(ev) else { return };
    let r: redis::RedisResult<i64> = redis::cmd("PUBLISH").arg(EVENTS).arg(text).query_async(&mut conn()).await;
    if let Err(e) = r { warn!("Queue: publish failed: {e}"); }
}

/// Put a new run in the queue and tell every gateway copy about it.
pub async fn enqueue(id: &str, req: &ProcessRequest, created_at: u64, owner: Option<String>) -> Result<(), String> {
    let info = JobInfo { request: req.clone(), created_at, owner: owner.clone() };
    let mut c = conn();
    redis::pipe()
        .atomic()
        .cmd("SET").arg(format!("nisar:job:{id}")).arg(serde_json::to_string(&info).unwrap_or_default()).ignore()
        .cmd("LPUSH").arg(QUEUE).arg(id).ignore()
        .query_async::<()>(&mut c)
        .await
        .map_err(|e| e.to_string())?;
    let mut ev = Event::new(id, Kind::Queued).text("[SYSTEM] Queued: waiting for a worker");
    ev.request = Some(req.clone());
    ev.created_at = Some(created_at);
    ev.owner = owner;
    publish(&ev).await;
    Ok(())
}

/// Place in the queue for each waiting run (1 = next).
pub async fn positions() -> HashMap<String, usize> {
    let ids: Vec<String> = redis::cmd("LRANGE").arg(QUEUE).arg(0).arg(-1).query_async(&mut conn()).await.unwrap_or_default();
    let n = ids.len();
    ids.into_iter().enumerate().map(|(i, id)| (id, n - i)).collect()
}

/// Cancel a run: drop it from the queue if it is still waiting, else ask its worker to stop.
pub async fn cancel(id: &str) -> Result<(), String> {
    let removed: i64 = redis::cmd("LREM").arg(QUEUE).arg(0).arg(id).query_async(&mut conn()).await.map_err(|e| e.to_string())?;
    if removed > 0 {
        fail_run(id, "Cancelled by user").await;
    } else {
        publish(&Event::new(id, Kind::Cancel)).await;
    }
    Ok(())
}

/// A run was deleted on one gateway copy: remove it from the queue and from the others.
pub async fn deleted(id: &str) {
    if !enabled() { return; }
    let _: redis::RedisResult<i64> = redis::cmd("LREM").arg(QUEUE).arg(0).arg(id).query_async(&mut conn()).await;
    publish(&Event::new(id, Kind::Deleted)).await;
}

/// Mark a run failed that no worker is processing (cancelled while waiting, or lost twice).
async fn fail_run(id: &str, msg: &str) {
    let mut c = conn();
    let info: Option<String> = redis::cmd("GET").arg(format!("nisar:job:{id}")).query_async(&mut c).await.unwrap_or(None);
    let info: Option<JobInfo> = info.and_then(|t| serde_json::from_str(&t).ok());
    if let Some(i) = &info {
        jobs::write_job_json(id, i.created_at, &JobStatus::Failed(msg.into()), Some(i.request.clone()), Some(&[format!("[SYSTEM] PROCESS_FAILED: {msg}")]));
    }
    let _: redis::RedisResult<()> = redis::cmd("DEL").arg(format!("nisar:job:{id}")).arg(format!("nisar:attempts:{id}")).query_async(&mut c).await;
    publish(&Event::new(id, Kind::Failed).text(msg)).await;
}

/// Hold a named lock for `secs` (taken or renewed). Only one gateway copy gets true.
pub async fn try_lock(name: &str, secs: u64) -> bool {
    if !enabled() { return true; }
    let key = format!("nisar:lock:{name}");
    let mut c = conn();
    let got: Option<String> = redis::cmd("SET").arg(&key).arg(holder()).arg("NX").arg("EX").arg(secs).query_async(&mut c).await.unwrap_or(None);
    if got.is_some() { return true; }
    let owner: Option<String> = redis::cmd("GET").arg(&key).query_async(&mut c).await.unwrap_or(None);
    if owner.as_deref() == Some(holder()) {
        let _: redis::RedisResult<i64> = redis::cmd("EXPIRE").arg(&key).arg(secs).query_async(&mut c).await;
        return true;
    }
    false
}

/// Apply every worker event to this gateway's run list. Reconnects if Redis goes away.
async fn listen(state: crate::AppState) {
    use futures_util::StreamExt;
    loop {
        let client = CLIENT.get().expect("queue client").clone();
        match client.get_async_pubsub().await {
            Ok(mut ps) => {
                if let Err(e) = ps.subscribe(EVENTS).await {
                    warn!("Queue: subscribe failed: {e}");
                } else {
                    info!("Queue: listening for worker events");
                    let mut s = ps.on_message();
                    while let Some(msg) = s.next().await {
                        let Ok(text) = msg.get_payload::<String>() else { continue };
                        match serde_json::from_str::<Event>(&text) {
                            Ok(ev) => jobs::apply_event(&state, ev).await,
                            Err(e) => warn!("Queue: bad event ({e})"),
                        }
                    }
                }
            }
            Err(e) => warn!("Queue: cannot subscribe ({e})"),
        }
        tokio::time::sleep(Duration::from_secs(2)).await;
    }
}

/// Every 10 s: refresh the queue gauges. One gateway copy also puts back runs whose worker
/// disappeared (no lease on two checks in a row).
async fn reaper() {
    let mut suspects: HashSet<String> = HashSet::new();
    loop {
        tokio::time::sleep(Duration::from_secs(10)).await;
        let mut c = conn();
        let waiting: u64 = redis::cmd("LLEN").arg(QUEUE).query_async(&mut c).await.unwrap_or(0);
        let taken: Vec<String> = redis::cmd("LRANGE").arg(RUNNING).arg(0).arg(-1).query_async(&mut c).await.unwrap_or_default();
        WAITING.store(waiting, Relaxed);
        TAKEN.store(taken.len() as u64, Relaxed);
        if !try_lock("reaper", 30).await { suspects.clear(); continue; }
        let mut still = HashSet::new();
        for id in taken {
            let alive: bool = redis::cmd("EXISTS").arg(format!("nisar:lease:{id}")).query_async(&mut c).await.unwrap_or(true);
            if alive { continue; }
            if !suspects.contains(&id) { still.insert(id); continue; }
            let _: redis::RedisResult<i64> = redis::cmd("LREM").arg(RUNNING).arg(0).arg(&id).query_async(&mut c).await;
            let n: i64 = redis::cmd("INCR").arg(format!("nisar:attempts:{id}")).query_async(&mut c).await.unwrap_or(MAX_ATTEMPTS);
            if n < MAX_ATTEMPTS {
                let _: redis::RedisResult<i64> = redis::cmd("RPUSH").arg(QUEUE).arg(&id).query_async(&mut c).await;
                warn!("Queue: worker for {id} stopped; put back in the queue");
                publish(&Event::new(&id, Kind::Queued).text("[SYSTEM] The worker stopped; the run is back in the queue")).await;
            } else {
                error!("Queue: {id} lost its worker {n} times; marking it failed");
                fail_run(&id, "The worker stopped several times while running this").await;
            }
        }
        suspects = still;
    }
}

// ─── Worker ─────────────────────────────────────────────────────────────────

/// SIGTERM (Kubernetes, podman stop) or Ctrl+C.
struct Stop {
    #[cfg(unix)]
    term: tokio::signal::unix::Signal,
}

impl Stop {
    fn new() -> Self {
        Stop {
            #[cfg(unix)]
            term: tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate()).expect("SIGTERM handler"),
        }
    }
    async fn wait(&mut self) {
        #[cfg(unix)]
        tokio::select! { _ = self.term.recv() => {}, _ = tokio::signal::ctrl_c() => {} }
        #[cfg(not(unix))]
        let _ = tokio::signal::ctrl_c().await;
    }
}

type Current = Arc<Mutex<Option<(String, tokio::sync::mpsc::Sender<()>)>>>;

/// `sar-gateway worker [--once]`: take runs from the queue and run the engine.
/// `--once` processes one run and exits (Kubernetes Jobs started by KEDA); it also exits when
/// the queue stays empty for NISAR_WORKER_IDLE_EXIT_SECONDS (default 30).
pub async fn run_worker(once: bool) -> i32 {
    match init(None).await {
        Ok(true) => {}
        Ok(false) => { error!("Worker: set NISAR_QUEUE_URL=redis://host:6379"); return 2; }
        Err(e) => { error!("Worker: {e}"); return 1; }
    }
    if !jobs::processor_found() {
        error!("Worker: science processor not found (set NISAR_PROCESSOR)");
        return 1;
    }
    let client = CLIENT.get().unwrap().clone();
    let mut blocking = match client.get_multiplexed_async_connection().await {
        Ok(c) => c,
        Err(e) => { error!("Worker: {e}"); return 1; }
    };
    let current: Current = Arc::new(Mutex::new(None));
    tokio::spawn(listen_cancel(current.clone()));
    let idle_exit = std::env::var("NISAR_WORKER_IDLE_EXIT_SECONDS").ok().and_then(|v| v.parse().ok()).unwrap_or(30u64);
    let mut stop = Stop::new();
    let mut idle_since = Instant::now();
    info!("Worker {} waiting for runs{}", holder(), if once { " (one run, then exit)" } else { "" });

    loop {
        let mut blmove = redis::cmd("BLMOVE");
        blmove.arg(QUEUE).arg(RUNNING).arg("RIGHT").arg("LEFT").arg(5);
        let taken: redis::RedisResult<Option<String>> = tokio::select! {
            r = blmove.query_async(&mut blocking) => r,
            _ = stop.wait() => { info!("Worker: stopping"); return 0; }
        };
        let id = match taken {
            Ok(Some(id)) => id,
            Ok(None) => {
                if once && idle_since.elapsed().as_secs() >= idle_exit { info!("Worker: queue empty, exiting"); return 0; }
                continue;
            }
            Err(e) => {
                warn!("Worker: queue read failed ({e}), retrying");
                tokio::time::sleep(Duration::from_secs(2)).await;
                continue;
            }
        };
        let stopped = process(&id, &current, &mut stop).await;
        idle_since = Instant::now();
        if stopped || once { return 0; }
    }
}

/// Stop the engine when a gateway publishes "cancel" for the run this worker is on.
async fn listen_cancel(current: Current) {
    use futures_util::StreamExt;
    loop {
        if let Ok(mut ps) = CLIENT.get().unwrap().get_async_pubsub().await {
            if ps.subscribe(EVENTS).await.is_ok() {
                let mut s = ps.on_message();
                while let Some(msg) = s.next().await {
                    let Some(ev) = msg.get_payload::<String>().ok().and_then(|t| serde_json::from_str::<Event>(&t).ok()) else { continue };
                    if matches!(ev.kind, Kind::Cancel | Kind::Deleted) {
                        if let Some((id, tx)) = current.lock().await.as_ref() {
                            if *id == ev.id { let _ = tx.try_send(()); }
                        }
                    }
                }
            }
        }
        tokio::time::sleep(Duration::from_secs(2)).await;
    }
}

/// Process one run. Returns true when the worker was asked to stop (the run went back in the queue).
async fn process(id: &str, current: &Current, stop: &mut Stop) -> bool {
    let mut c = conn();
    let lease = format!("nisar:lease:{id}");
    let _: redis::RedisResult<()> = redis::cmd("SET").arg(&lease).arg(holder()).arg("EX").arg(LEASE_SECS).query_async(&mut c).await;
    let renew = {
        let (lease, mut c) = (lease.clone(), c.clone());
        tokio::spawn(async move {
            loop {
                tokio::time::sleep(Duration::from_secs(LEASE_SECS / 3)).await;
                let _: redis::RedisResult<i64> = redis::cmd("EXPIRE").arg(&lease).arg(LEASE_SECS).query_async(&mut c).await;
            }
        })
    };
    let done = |c: ConnectionManager| {
        let id = id.to_string();
        let lease = lease.clone();
        async move {
            let mut c = c;
            let _: redis::RedisResult<()> = redis::pipe()
                .cmd("LREM").arg(RUNNING).arg(0).arg(&id).ignore()
                .cmd("DEL").arg(&lease).arg(format!("nisar:job:{id}")).arg(format!("nisar:attempts:{id}")).ignore()
                .query_async(&mut c).await;
        }
    };

    let info: Option<String> = redis::cmd("GET").arg(format!("nisar:job:{id}")).query_async(&mut c).await.unwrap_or(None);
    let Some(info) = info.and_then(|t| serde_json::from_str::<JobInfo>(&t).ok()) else {
        warn!("Worker: run {id} has no settings (deleted?); skipping");
        renew.abort();
        done(c).await;
        return false;
    };
    let req = info.request;
    info!("Worker: running {id}");
    jobs::write_job_json(id, info.created_at, &JobStatus::Running, Some(req.clone()), None);
    publish(&Event::new(id, Kind::Running).text(format!("[SYSTEM] Worker {} took the run", holder()))).await;

    let (cancel_tx, cancel_rx) = tokio::sync::mpsc::channel(1);
    *current.lock().await = Some((id.to_string(), cancel_tx));
    let (tx, mut rx) = tokio::sync::mpsc::channel::<String>(256);
    let sink = {
        let id = id.to_string();
        tokio::spawn(async move {
            let mut kept = Vec::new();
            while let Some(line) = rx.recv().await {
                publish(&Event::new(&id, Kind::Log).text(line.clone())).await;
                kept.push(line);
            }
            kept
        })
    };
    let started = Instant::now();
    let result = tokio::select! {
        r = jobs::run_engine(id, &req, tx, cancel_rx) => Some(r),
        _ = stop.wait() => None,
    };
    let mut logs = sink.await.unwrap_or_default();
    *current.lock().await = None;
    renew.abort();
    let secs = started.elapsed().as_secs_f64();

    let Some(result) = result else {
        // Asked to stop mid-run (node drained, pod evicted): give the run to another worker.
        let _: redis::RedisResult<()> = redis::pipe()
            .cmd("LREM").arg(RUNNING).arg(0).arg(id).ignore()
            .cmd("RPUSH").arg(QUEUE).arg(id).ignore()
            .cmd("DEL").arg(&lease).ignore()
            .query_async(&mut c).await;
        jobs::write_job_json(id, info.created_at, &JobStatus::Queued, Some(req), None);
        publish(&Event::new(id, Kind::Queued).text("[SYSTEM] The worker stopped; the run is back in the queue")).await;
        return true;
    };
    let result = result.and_then(|_| if jobs::has_report(id) { Ok(()) } else { Err("Processor finished but wrote no report".into()) });
    match result {
        Ok(()) => {
            logs.push("[SYSTEM] PROCESS_COMPLETED".into());
            jobs::write_job_json(id, info.created_at, &JobStatus::Completed, Some(req), Some(&logs));
            let mut ev = Event::new(id, Kind::Completed);
            ev.seconds = Some(secs);
            publish(&ev).await;
            info!("Worker: {id} completed in {secs:.0} s");
        }
        Err(msg) => {
            logs.push(format!("[SYSTEM] PROCESS_FAILED: {msg}"));
            jobs::write_job_json(id, info.created_at, &JobStatus::Failed(msg.clone()), Some(req), Some(&logs));
            let mut ev = Event::new(id, Kind::Failed).text(msg.clone());
            ev.seconds = Some(secs);
            publish(&ev).await;
            warn!("Worker: {id} failed: {msg}");
        }
    }
    done(c).await;
    false
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn event_round_trip() {
        let mut ev = Event::new("run-1", Kind::Completed);
        ev.seconds = Some(52.5);
        let t = serde_json::to_string(&ev).unwrap();
        assert_eq!(t, r#"{"id":"run-1","kind":"completed","seconds":52.5}"#);
        let back: Event = serde_json::from_str(&t).unwrap();
        assert_eq!(back.kind, Kind::Completed);
        assert_eq!(back.seconds, Some(52.5));
    }
}
