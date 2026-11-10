use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::Arc;
use std::time::{Duration, Instant};
use axum::{
    body::Body,
    extract::{Request, State},
    http::{header, HeaderMap, StatusCode},
    middleware::Next,
    response::{IntoResponse, Response},
    Json,
};
use log::warn;
use serde_json::json;
use tokio::sync::RwLock;

/// Window duration for rate limiting (1 minute)
const WINDOW_DURATION: Duration = Duration::from_secs(60);

/// Maximum general API requests per IP per minute
const MAX_GENERAL_REQUESTS: usize = 120;

/// Maximum heavy job creation requests (`POST /jobs`) per IP per minute
const MAX_JOB_REQUESTS: usize = 6;

struct Bucket {
    count: usize,
    window_start: Instant,
}

impl Bucket {
    fn new() -> Self {
        Self {
            count: 1,
            window_start: Instant::now(),
        }
    }

    fn check_and_increment(&mut self, limit: usize) -> Result<(), u64> {
        let now = Instant::now();
        if now.duration_since(self.window_start) >= WINDOW_DURATION {
            self.count = 1;
            self.window_start = now;
            Ok(())
        } else if self.count < limit {
            self.count += 1;
            Ok(())
        } else {
            let elapsed = now.duration_since(self.window_start);
            let remaining = WINDOW_DURATION.saturating_sub(elapsed).as_secs();
            Err(remaining.max(1))
        }
    }
}

pub struct RateLimiter {
    general_buckets: RwLock<HashMap<String, Bucket>>,
    job_buckets: RwLock<HashMap<String, Bucket>>,
}

impl RateLimiter {
    pub fn new() -> Self {
        Self {
            general_buckets: RwLock::new(HashMap::new()),
            job_buckets: RwLock::new(HashMap::new()),
        }
    }

    pub async fn check(&self, ip: &str, is_job: bool) -> Result<(), u64> {
        if is_job {
            let mut buckets = self.job_buckets.write().await;
            if let Some(bucket) = buckets.get_mut(ip) {
                bucket.check_and_increment(MAX_JOB_REQUESTS)?;
            } else {
                buckets.insert(ip.to_string(), Bucket::new());
            }
        }

        let mut buckets = self.general_buckets.write().await;
        if let Some(bucket) = buckets.get_mut(ip) {
            bucket.check_and_increment(MAX_GENERAL_REQUESTS)
        } else {
            buckets.insert(ip.to_string(), Bucket::new());
            Ok(())
        }
    }

    /// Periodic cleanup task to remove stale buckets and prevent memory growth
    pub fn start_cleanup_task(self: Arc<Self>) {
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(Duration::from_secs(300));
            loop {
                interval.tick().await;
                let now = Instant::now();
                {
                    let mut b = self.general_buckets.write().await;
                    b.retain(|_, v| now.duration_since(v.window_start) < Duration::from_secs(180));
                }
                {
                    let mut b = self.job_buckets.write().await;
                    b.retain(|_, v| now.duration_since(v.window_start) < Duration::from_secs(180));
                }
            }
        });
    }
}

/// Extract the effective client IP, respecting Cloudflare and proxy headers
pub fn extract_client_ip(headers: &HeaderMap, peer_addr: Option<&SocketAddr>) -> String {
    // 1. Cloudflare provides the true client IP in `cf-connecting-ip`
    if let Some(cf_ip) = headers.get("cf-connecting-ip").and_then(|v| v.to_str().ok()) {
        let ip = cf_ip.trim();
        if !ip.is_empty() {
            return ip.to_string();
        }
    }

    // 2. Standard `x-real-ip`
    if let Some(real_ip) = headers.get("x-real-ip").and_then(|v| v.to_str().ok()) {
        let ip = real_ip.trim();
        if !ip.is_empty() {
            return ip.to_string();
        }
    }

    // 3. `x-forwarded-for` (first hop)
    if let Some(fwd) = headers.get("x-forwarded-for").and_then(|v| v.to_str().ok()) {
        if let Some(first) = fwd.split(',').next() {
            let ip = first.trim();
            if !ip.is_empty() {
                return ip.to_string();
            }
        }
    }

    // 4. Socket peer address fallback
    if let Some(addr) = peer_addr {
        return addr.ip().to_string();
    }

    "127.0.0.1".to_string()
}

/// Middleware that enforces per-IP rate limits across API endpoints
pub async fn rate_limit_middleware(
    State(state): State<crate::AppState>,
    req: Request<Body>,
    next: Next,
) -> Response {
    let path = req.uri().path();
    let method = req.method();

    // Skip static files, health pings, and log streams from rate limit enforcement
    if path == "/jobs/health-ping"
        || path.starts_with("/results/")
        || path.ends_with("/logs")
    {
        return next.run(req).await;
    }

    let is_job_creation = method == axum::http::Method::POST && path == "/jobs";
    let client_ip = extract_client_ip(req.headers(), None);

    match state.rate_limiter.check(&client_ip, is_job_creation).await {
        Ok(()) => next.run(req).await,
        Err(retry_after) => {
            warn!(
                "⚠️ Rate limit exceeded for IP {} on {} {} (retry in {}s)",
                client_ip, method, path, retry_after
            );
            let body = Json(json!({
                "error": "Too Many Requests",
                "message": if is_job_creation {
                    "Job creation rate limit reached (max 6 jobs/min). Please wait for active runs to finish."
                } else {
                    "API rate limit reached. Please wait a moment before sending more requests."
                },
                "retry_after_seconds": retry_after
            }));

            let mut resp = (StatusCode::TOO_MANY_REQUESTS, body).into_response();
            resp.headers_mut().insert(
                header::RETRY_AFTER,
                retry_after.to_string().parse().unwrap(),
            );
            resp
        }
    }
}
