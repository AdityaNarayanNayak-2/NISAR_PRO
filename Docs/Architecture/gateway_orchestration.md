# 🎛️ Part 1: API Gateway & Orchestration (`sar-gateway`)

This is Part 1 of the comprehensive codebase deep dive. It focuses on the `sar-gateway` microservice, which acts as the traffic controller for the entire NISAR Pro application.

Written in Rust using the **Axum** web framework, the gateway listens on port `3000`. Its primary responsibilities are handling React API requests, managing thread-safe application state, spawning the heavy math processor, and streaming real-time logs back to the browser via Server-Sent Events (SSE).

---

## 1. Application State & Thread Safety (`main.rs`)

Because a web server processes multiple requests concurrently across many OS threads, state must be safely shared. In `sar-gateway/src/main.rs`, the state is defined as:

```rust
#[derive(Clone)]
pub struct AppState {
    pub jobs: Arc<RwLock<HashMap<String, Arc<RwLock<jobs::JobMetadata>>>>>,
}
```

* **`HashMap<String, ...>`**: Stores active and completed jobs, keyed by a generated Job ID (e.g., `sar-f83d2a1b`).
* **`RwLock` (Read-Write Lock)**: Allows multiple threads to read the hashmap simultaneously (like checking job status), but enforces exclusive access when a new job is inserted or updated.
* **`Arc` (Atomic Reference Count)**: Safely clones the pointer to this memory across Tokio asynchronous worker threads without duplicating the data itself.

When `main()` starts, it initializes this state, starts a background cleanup task (`crate::jobs::start_cleanup_task(state.clone())`), preloads completed historical runs from disk via `preload_completed_jobs(state.clone()).await`, and mounts the Axum routes.

### Historical Job Preloading (`preload_completed_jobs`)
To provide an instantaneous experience on startup without re-running heavy satellite jobs:
1. Scans the local `./results/` directory for existing job outputs.
2. Identifies matching artifact pairs (such as `*_flood.json`, `*_flood.png`, `*_insar.json`, `*_defo_phase.tif`).
3. Extracts `georef_bbox` directly from the serialized JSON reports.
4. Registers these historical runs into `state.jobs` as `Completed`.
5. When the user opens the React dashboard, historical showcase jobs (e.g. `sar-bihar-lband-full` and `assam_flood_pair`) appear immediately in the **Run History** sidebar, fully interactive with zero wait time.

---

## 2. Request Handling (`handlers.rs`)

When the user interacts with the React dashboard, requests hit the endpoints mapped in `handlers.rs`.

### File Uploads (`/upload`)
If a user drags and drops a local `.h5` file, `upload_handler` intercepts the `multipart/form-data`. It streams the file chunks to disk at `./results/uploads/temp.h5` and returns this absolute path to the React frontend.

### Starting a Job (`POST /jobs`)
When the user clicks "Start Processing", React sends a JSON payload:
```json
{
    "input_file": "/home/aditya/Desktop/nisar_data/NISAR_L2_PR_GCOV_...20260912.h5",
    "slave_file": "/home/aditya/Desktop/nisar_data/NISAR_L2_PR_GCOV_...20260726.h5",
    "pipeline": "flood",
    "crop_preset": "full"
}
```
The `start_job_handler` parses this payload into a `ProcessRequest` struct and calls the orchestrator:
```rust
let job_id = crate::jobs::spawn_processing_job(
    state.clone(), payload.input_file, ...
).await;
```
It immediately returns `{"job_id": "sar-...", "status": "queued"}` so the UI doesn't hang while the multi-gigabyte files process.

---

## 3. Process Orchestration (`jobs.rs`)

The heavy lifting happens in `sar-gateway/src/jobs.rs`. 

### Job Initialization
`spawn_processing_job()` generates a UUID. It creates a `tokio::sync::broadcast::channel` for streaming logs and registers a `JobMetadata` object into the global `state.jobs` map.

It checks the `LOCAL_MODE` environment variable. If true (the default for the desktop app), it spawns an asynchronous Tokio task to run `spawn_local_job`. (If false, it uses the Kubernetes API to deploy a CRD `SarJob` to a Flux-managed cluster).

### Binary Resolution & Subprocess Execution
Inside `spawn_local_job`, the gateway dynamically locates the compiled scientific compute binary. It prioritizes the modern SAR science engine:
1. `../sar_science_processor/target/release/sar_science_processor`
2. `../sar_science_processor/target/debug/sar_science_processor`
3. Fallback to `sar_processor` for legacy RDA / simple InSAR runs.

It uses `tokio::process::Command` to execute the binary:

```rust
let mut cmd = Command::new(&binary);
cmd.stdout(Stdio::piped())
   .stderr(Stdio::piped());

cmd.args(["--input", &input, "--output", &output_path]);
if let Some(ref slave) = slave_file {
    cmd.args(["--slave", slave]);
}
if pipeline == "flood" {
    cmd.args(["--mode", "flood"]);
}
// ... appends crop arguments (--crop-preset full, or lat/lon)
```

It calls `cmd.spawn()`, bypassing the system shell directly for security and speed. It captures the standard output (`stdout`) and standard error (`stderr`) pipes from the child process.

---

## 4. Real-Time Log Streaming & Event Interception (SSE)

The gateway needs to send processor logs (like `[1/5] Loading active scene...`) to the React UI in real-time. It uses Server-Sent Events (SSE).

### Log Interception & Structured Event Parsing
Two background tasks read the `stdout` and `stderr` pipes line-by-line using a `BufReader`:

```rust
let reader = BufReader::new(stdout);
let mut lines = reader.lines();
while let Ok(Some(line)) = lines.next_line().await {
    // 1. Intercept structured JSON events
    if line.starts_with("{\"event\":\"georef\"") {
        // Parse bounding box and update job state
        let mut m = meta_stdout.write().await;
        m.bbox = Some(bbox.clone());
        let _ = m.tx.send(line.clone());
        continue;
    } else if line.starts_with("{\"event\":\"flood_report\"") || line.starts_with("{\"event\":\"insar_report\"") {
        // Store report path in job metadata
        let mut m = meta_stdout.write().await;
        m.report = Some(parsed_report);
        let _ = m.tx.send(line.clone());
        continue;
    }
    
    // 2. Broadcast raw log line to SSE
    let mut m = meta_stdout.write().await;
    m.logs.push(line.clone());
    let _ = m.tx.send(line);
}
```
* **Event Interception**: The `sar_science_processor` communicates with the gateway by printing JSON strings to `stdout`. The gateway parses `georef` events to know exactly where on Earth the radar swath is located.
* **Broadcasting**: It sends the raw log line into the `m.tx` broadcast channel.

### The SSE Endpoint (`GET /jobs/:id/logs`)
When React connects to the logs endpoint, `stream_logs_handler` executes. 
Because the processor might have already printed logs before React connects, the handler performs a clever stream chain:
1. It reads `historical_logs` from the `JobMetadata` array.
2. It subscribes to the live `BroadcastStream`.
3. It chains them together: `history_stream.chain(live_stream)`.
This guarantees the frontend never misses a log line, even if it reloads the page mid-process.

---

## 5. Job Completion & Safety

The gateway uses `tokio::select!` to race multiple async futures against each other:
1. The child process finishing (`child.wait()`).
2. A hard timeout (`tokio::time::timeout` set to 30 minutes).
3. A user cancellation request (`cancel_rx.recv()`).

If the user clicks "Cancel" in the UI (hitting `POST /jobs/:id/cancel`), the gateway sends a signal down the `cancel_rx` channel. The `select!` block detects it, runs `child.kill().await`, and cleans up the memory, preventing zombie processes from eating RAM.

---

## 6. Verified Contract Details (real runs)

Facts confirmed against the running gateway and the Vite dashboard:

### Job status serialization quirk
`JobStatus` uses `#[serde(rename_all = "snake_case")]`, and the `Failed` variant carries a `String`. As a result a failed job is serialized as **`{"status": {"failed": "<reason>"}}`** — an object, not a plain string. Clients must normalize this shape (the dashboard does via `normalizeJobStatus`); open/closed unions like `"failed"` / `"completed"` don't apply here.

### Terminal/system events
The SSE stream for `GET /jobs/:id/logs` replays cached logs first, then broadcasts live lines. On termination the gateway emits one of:
- `[SYSTEM] PROCESS_COMPLETED`
- `[SYSTEM] PROCESS_CANCELLED` (user cancel via `POST /jobs/:id/cancel`)
- `[SYSTEM] PROCESS_TIMEOUT` (30-minute hard timeout)
- `[SYSTEM] PROCESS_FAILED:<reason>`

### Catalog failure → silent empty array
Both `GET /search` (ESA) and `GET /search/nisar` (ASF) log the error but return `200 OK` with `[]` on failure. Auth problems for ESA appear as empty results — configure `ESA_USERNAME`/`ESA_PASSWORD`. ASF search is anonymous; only downloads need Earthdata credentials (`/asf/auth-status` reports the configured state).

### Route map (incl. endpoints not in older docs)
`/search`, `/search/nisar`, `/assets/search`, `/context`, `GET|POST /jobs`, `/upload`, `/jobs/health-ping`, `/jobs/:id`, `/jobs/:id/cancel`, `/jobs/:id/logs`, `/asf/download-stream` (streams a remote product into `data/`), `/asf/auth-status`, and a static `/results/*` file server over the local `results/` directory.
