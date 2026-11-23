//! Optional login for a gateway that is reachable from the internet.
//!
//! Set `NISAR_BASIC_AUTH=user:password` and every request needs HTTP Basic auth (the browser
//! asks once and then sends it with every request, live logs included). `/healthz` and `/readyz`
//! stay open for load balancers and Kubernetes probes. Not set: no login (laptop, behind
//! Cloudflare Access, or inside a private network).
use axum::{body::Body, http::{header, Request, StatusCode}, middleware::Next, response::{IntoResponse, Response}};
use std::sync::OnceLock;

static EXPECTED: OnceLock<Option<String>> = OnceLock::new();

pub fn init() -> bool {
    let v = std::env::var("NISAR_BASIC_AUTH").ok().filter(|s| s.contains(':') && s.len() > 2);
    let on = v.is_some();
    let _ = EXPECTED.set(v.map(|s| format!("Basic {}", base64(s.as_bytes()))));
    on
}

fn base64(input: &[u8]) -> String {
    const T: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::with_capacity(input.len().div_ceil(3) * 4);
    for c in input.chunks(3) {
        let n = (c[0] as u32) << 16 | (*c.get(1).unwrap_or(&0) as u32) << 8 | *c.get(2).unwrap_or(&0) as u32;
        for i in 0..4 {
            if i <= c.len() { out.push(T[(n >> (18 - 6 * i) & 63) as usize] as char) } else { out.push('=') }
        }
    }
    out
}

/// Same time whatever the input, so the password cannot be guessed byte by byte from timing.
fn same(a: &[u8], b: &[u8]) -> bool {
    a.len() == b.len() && a.iter().zip(b).fold(0u8, |d, (x, y)| d | (x ^ y)) == 0
}

pub async fn basic_auth(req: Request<Body>, next: Next) -> Response {
    let Some(Some(expected)) = EXPECTED.get() else { return next.run(req).await };
    if matches!(req.uri().path(), "/healthz" | "/readyz") {
        return next.run(req).await;
    }
    let given = req.headers().get(header::AUTHORIZATION).map(|v| v.as_bytes()).unwrap_or(b"");
    if same(given, expected.as_bytes()) {
        return next.run(req).await;
    }
    (StatusCode::UNAUTHORIZED, [(header::WWW_AUTHENTICATE, "Basic realm=\"NISAR Pro\", charset=\"UTF-8\"")], "login required").into_response()
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn base64_matches_rfc4648() {
        assert_eq!(base64(b""), "");
        assert_eq!(base64(b"f"), "Zg==");
        assert_eq!(base64(b"fo"), "Zm8=");
        assert_eq!(base64(b"foo"), "Zm9v");
        assert_eq!(base64(b"admin:s3cret!"), "YWRtaW46czNjcmV0IQ==");
    }
    #[test]
    fn compare() {
        assert!(same(b"abc", b"abc"));
        assert!(!same(b"abc", b"abd"));
        assert!(!same(b"abc", b"abcd"));
    }
}
