# SAR Gateway Internals

> Source: `sar-gateway/src/` — Axum HTTP server bridging the React dashboard to the Rust processor.

## Overview
The gateway is a lightweight Rust HTTP server built with Axum + Tokio. It has **two execution modes**:
1. **Local Mode (default):** Spawns `sar_processor` as a child process on the user's machine.
2. **K8s Mode:** Submits a `SarJob` Custom Resource to a Kubernetes cluster (enterprise deployment).

The mode is selected via the `LOCAL_MODE` environment variable (defaults to `true`).

## Module Map
```
main.rs       → Router setup, AppState, CORS, static file serving
handlers.rs   → HTTP endpoint handlers (search, jobs, SSE streaming)
jobs.rs       → Job orchestration: local subprocess OR Kubernetes CRD
models.rs     → Request/Response data structures
esa_client.rs → ESA Copernicus OData API client
nasa_client.rs→ NASA ASF (Alaska Satellite Facility) search client
```

## REST API Endpoints

| Method | Path | Handler | Description |
|--------|------|---------|-------------|
| `GET` | `/search` | `search_handler` | Query ESA Copernicus for Sentinel-1 scenes |
| `GET` | `/search/nisar` | `search_nisar_handler` | Query NASA ASF for NISAR scenes |
| `POST` | `/jobs` | `start_job_handler` | Submit a processing job |
| `GET` | `/jobs/:id` | `get_job_handler` | Poll job status + output path + bbox |
| `GET` | `/jobs/:id/logs` | `stream_logs_handler` | SSE stream of real-time processor logs |
| `GET` | `/results/*` | `ServeDir` | Static file server for output PNGs |

## State Management (`AppState`)
```rust
pub struct AppState {
    pub jobs: Arc<RwLock<HashMap<String, Arc<RwLock<JobMetadata>>>>>,
}
```
A thread-safe in-memory map of all active/historical jobs, keyed by UUID. Each `JobMetadata` contains:
- `status`: Queued → Running → Completed/Failed
- `logs`: Vec of all log lines (for replay to late-connecting SSE clients)
- `tx`: `broadcast::Sender` for live log streaming
- `output_path`: Path to the generated PNG
- `bbox`: Geographic bounding box for map overlay

## Local Mode Execution (`jobs.rs :: spawn_local_job`)
```
POST /jobs { input_file: "/path/to/NISAR.h5", pipeline: "cfar" }
    │
    ├─ Generate UUID: "sar-a1b2c3d4"
    ├─ Insert JobMetadata into AppState
    │
    └─ tokio::spawn(async {
         1. Create results/ directory
         2. find_processor_binary()
            → ../sar_processor/target/release/sar_processor
            → ../sar_processor/target/debug/sar_processor
            → ./sar_processor (fallback)
         3. Build Command with args:
            --input /path/to/file --output results/sar-a1b2c3d4.png
            + --ship-detect (if pipeline == "cfar")
            + --insar-slave (if pipeline == "insar")
         4. Spawn child process with piped stdout/stderr
         5. Stream stdout line-by-line:
            → Parse {"event":"georef","bbox":{...}} → store bbox
            → All other lines → push to logs + broadcast via tx
         6. Stream stderr (env_logger output) → same broadcast
         7. Wait for exit → update status to Completed/Failed
       })
```

## SSE Streaming (`handlers.rs :: stream_logs_handler`)
When the dashboard connects to `/jobs/:id/logs`:
1. **Replay:** All historical log lines are sent first (so a late-connecting browser gets full context).
2. **Live:** A `BroadcastStream` subscriber pipes new lines in real-time.
3. **Keep-Alive:** Automatic SSE keep-alive prevents connection timeout.

## K8s Mode (`jobs.rs :: spawn_k8s_job`)
When `LOCAL_MODE=false`:
1. Connects to the Kubernetes API via `kube-rs` service account.
2. Creates a `SarJob` CRD in the default namespace.
3. Polls the CRD status every 2 seconds.
4. Once the Operator creates a Pod, attaches to its log stream via `kube::Api::log_stream()`.
5. Pipes the Pod's stdout into the same broadcast channel used by SSE.

## Dependencies (Cargo.toml)
| Crate | Purpose |
|-------|---------|
| `axum` | HTTP framework |
| `tokio` | Async runtime (full features) |
| `tower-http` | CORS middleware + static file serving |
| `reqwest` | HTTP client for ESA/NASA API calls |
| `tokio-stream` | SSE broadcast stream adapter |
| `kube` / `k8s-openapi` | Kubernetes API client (K8s mode only) |
| `uuid` | Job ID generation |
| `serde` / `serde_json` | JSON serialization |
