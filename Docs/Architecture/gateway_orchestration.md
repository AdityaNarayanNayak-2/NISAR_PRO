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

When `main()` starts, it initializes this state, starts a background cleanup task (`crate::jobs::start_cleanup_task(state.clone())`), and mounts the Axum routes.

---

## 2. Request Handling (`handlers.rs`)

When the user interacts with the React dashboard, requests hit the endpoints mapped in `handlers.rs`.

### File Uploads (`/upload`)
If a user drags and drops a local `.h5` file, `upload_handler` intercepts the `multipart/form-data`. It streams the file chunks to disk at `./results/uploads/temp.h5` and returns this absolute path to the React frontend.

### Starting a Job (`POST /jobs`)
When the user clicks "Start Processing", React sends a JSON payload:
```json
{
    "input_file": "/results/uploads/temp.h5",
    "pipeline": "insar",
    "crop_lat": 18.7889, ...
}
```
The `start_job_handler` parses this payload into a `ProcessRequest` struct and calls the orchestrator:
```rust
let job_id = crate::jobs::spawn_processing_job(
    state.clone(), payload.input_file, ...
).await;
```
It immediately returns `{"job_id": "sar-...", "status": "queued"}` so the UI doesn't hang while the 30 GB file processes.

---

## 3. Process Orchestration (`jobs.rs`)

The heavy lifting happens in `sar-gateway/src/jobs.rs`. 

### Job Initialization
`spawn_processing_job()` generates a UUID. It creates a `tokio::sync::broadcast::channel` for streaming logs and registers a `JobMetadata` object into the global `state.jobs` map.

It checks the `LOCAL_MODE` environment variable. If true (the default for the desktop app), it spawns an asynchronous Tokio task to run `spawn_local_job`. (If false, it uses the Kubernetes API to deploy a CRD `SarJob` to a Flux-managed cluster).

### Spawning the Processor
Inside `spawn_local_job`, the gateway locates the compiled `sar_processor` binary (checking `release` then `debug` folders). It uses `tokio::process::Command` to execute the binary:

```rust
let mut cmd = Command::new(&binary);
cmd.stdout(Stdio::piped())
   .stderr(Stdio::piped());

cmd.args(["--input", &input, "--output", &output_path]);
// ... appends crop arguments
```

It calls `cmd.spawn()`, bypassing the system shell directly for security and speed. It captures the standard output (`stdout`) and standard error (`stderr`) pipes from the child process.

---

## 4. Real-Time Log Streaming (SSE)

The gateway needs to send processor logs (like `[1/5] Loading unwrapped phase...`) to the React UI in real-time. It uses Server-Sent Events (SSE).

### Log Interception
Two background tasks are spawned to read the `stdout` and `stderr` pipes line-by-line using a `BufReader`:

```rust
let reader = BufReader::new(stdout);
let mut lines = reader.lines();
while let Ok(Some(line)) = lines.next_line().await {
    // 1. Check for special internal JSON events
    if line.starts_with("{\"event\":\"georef\"") {
        // Parse bounding box and update job state
        let mut m = meta_stdout.write().await;
        m.bbox = Some(bbox.clone());
        let _ = m.tx.send(line.clone());
        continue;
    }
    
    // 2. Otherwise, store the log and broadcast it
    let mut m = meta_stdout.write().await;
    m.logs.push(line.clone());
    let _ = m.tx.send(line);
}
```
* **Event Interception**: The `sar_processor` binary communicates with the gateway by printing JSON strings to `stdout`. The gateway parses `georef` events to know exactly where on Earth the image is located.
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
