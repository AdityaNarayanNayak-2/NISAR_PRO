# NISAR Pro — Dashboard, Gateway & Processor Issue Register

**Status:** Living engineering document  
**Last reviewed:** 30 October 2026  
**Scope:** `sar-dashboard-v3`, `sar-gateway`, `sar_science_processor` and the documentation needed to operate them  
**Purpose:** Preserve context so future work can resume without rediscovering the architecture, assumptions, failure modes and scientific limits.

This is an issue register, not a claim that every item is currently broken. Each item is marked as one of:

- **Confirmed defect** — observed in code, a build, a workflow, or a reproducible failure.
- **Structural debt** — works today but makes future changes unsafe or expensive.
- **Verification required** — a scientific, deployment or production claim that still needs evidence.
- **Future capability** — valuable work that should not be mistaken for a launch blocker.

The most important rule is to preserve the validated Rust flood algorithm while improving the interfaces around it. A frontend improvement must not silently change the processor inputs, and a gateway fix must not alter scientific defaults without a regression test.

---

## 1. Current system boundary

```text
Browser / React dashboard
        |
        | HTTP + EventSource
        v
Rust Axum gateway :3000
        |
        | local process spawn, upload, ASF search/download, artifact serving
        v
sar_science_processor
        |
        | HDF5 GCOV hyperslabs -> calibrated arrays -> masks/reports/GeoTIFF/GeoJSON/PNG
        v
results/ and job metadata
```

### Supported user profiles

1. **Flood Monitoring** — NISAR L2 GCOV temporal change detection, map layers, replay, regions and report.
2. **Infrastructure Monitoring** — asset search, environmental context and InSAR structural analysis.

`insar` remains an internal processor pipeline identifier for Infrastructure Monitoring. It is not a third user-facing profile. SAR Science and standalone InSAR profile placeholders have been removed.

### Ownership rule

- `AppDashboard.jsx` currently coordinates URL state, gateway health, jobs, map viewport and profile selection.
- Flood components own flood configuration, flood views and flood report presentation.
- `InfrastructurePanel.jsx` owns infrastructure-specific panels and geometry.
- The gateway owns process lifecycle, uploads, catalog access, artifact paths and job persistence.
- The processor owns scientific computation, input interpretation and scientific output metadata.

The next architectural goal is to extract workflow orchestration from `AppDashboard.jsx` without merging the Flood and Infrastructure layouts again.

---

## 2. Priority model

| Priority | Meaning | Expected handling |
|---|---|---|
| P0 | Prevents reliable use, corrupts data, or makes a scientific claim unsafe | Fix before public demo or submission |
| P1 | Major workflow failure or repeated user confusion | Fix in the next implementation batch |
| P2 | Structural debt, accessibility, observability or operational weakness | Fix before production hardening |
| P3 | Polish or future capability | Schedule after the core workflow is stable |

---

## 3. Executive backlog

| ID | Area | Priority | Classification | Short description | Owner |
|---|---|---:|---|---|---|
| DASH-001 | Dashboard | P1 | Structural debt | `AppDashboard.jsx` is still the orchestration god component | Frontend |
| DASH-002 | Dashboard | P1 | Confirmed risk | Shared shell state can leak between Flood and Infrastructure | Frontend |
| DASH-003 | Dashboard | P1 | Workflow | Job history, selected result and demo entry need one explicit state model | Frontend + Gateway |
| DASH-004 | Dashboard | P1 | Workflow | Local file selection/upload needs a clear end-to-end status contract | Frontend + Gateway |
| DASH-005 | Dashboard | P2 | Structural debt | Inline style duplication makes profile-specific layout regressions likely | Frontend |
| DASH-006 | Dashboard | P2 | Performance | Large GeoJSON can freeze the browser | Frontend + Gateway |
| DASH-007 | Dashboard | P2 | Correctness | API errors are frequently reduced to generic toast/console output | Frontend + Gateway |
| DASH-008 | Dashboard | P2 | Accessibility | Floating panels, dialogs and map controls need a full keyboard/focus pass | Frontend |
| DASH-009 | Dashboard | P2 | Product | Scientific parameters need a typed schema instead of ad-hoc local state | Frontend + Gateway + Processor |
| DASH-010 | Dashboard | P3 | Performance | Bundle and route-level code splitting remain incomplete | Frontend |
| GW-001 | Gateway | P0 | Confirmed risk | Job state is file/process based and needs durable recovery semantics | Gateway |
| GW-002 | Gateway | P1 | Reliability | Child-process stdout/stderr and SSE lifecycle need bounded, explicit handling | Gateway |
| GW-003 | Gateway | P1 | Security | Local gateway upload, artifact serving and catalog proxy need a threat-model pass | Gateway |
| GW-004 | Gateway | P1 | Workflow | Job request validation must be centralized and profile-aware | Gateway |
| GW-005 | Gateway | P1 | Reliability | Cancellation needs verified process-tree termination and artifact cleanup | Gateway |
| GW-006 | Gateway | P2 | Observability | Structured job events and failure codes need a documented contract | Gateway |
| GW-007 | Gateway | P2 | Deployment | Binary discovery and Windows/Linux path handling need one configuration strategy | Gateway |
| GW-008 | Gateway | P2 | Data | Result manifests should replace frontend inference from filenames | Gateway + Processor |
| GW-009 | Gateway | P2 | External service | ASF/NRSC search and download need rate-limit, timeout and retry policy | Gateway |
| GW-010 | Gateway | P3 | Scale | In-memory job registry should be replaceable with a durable job store | Gateway |
| PROC-001 | Processor | P0 | Scientific | Full-scene and tactical-AOI modes need separate verified baselines | Processor |
| PROC-002 | Processor | P0 | Scientific | L, S and L+S output provenance must be explicit in every report | Processor |
| PROC-003 | Processor | P1 | Scientific | Processor CLI parameters and UI controls are not yet one typed contract | Processor + Gateway |
| PROC-004 | Processor | P1 | Scientific | Pixel area, CRS, resolution and nodata semantics must be emitted consistently | Processor |
| PROC-005 | Processor | P1 | Scientific | Polarization/channel availability must fail clearly, not be inferred | Processor |
| PROC-006 | Processor | P1 | Performance | Hyperslab/multilook memory and runtime need full-scene repeatable benchmarks | Processor |
| PROC-007 | Processor | P2 | Scientific | Validation/reference datasets and uncertainty outputs are incomplete | Processor |
| PROC-008 | Processor | P2 | Reliability | Long-running full-scene failures need checkpoint/resume or clean restart evidence | Processor |
| PROC-009 | Processor | P2 | Export | GeoJSON feature count and browser rendering strategy need a scale limit | Processor + Gateway |
| PROC-010 | Processor | P3 | Capability | L+S physical gates need an explicit machine-readable contribution report | Processor |
| DOC-001 | Documentation | P1 | Reproducibility | One canonical Windows local-run path is needed | Docs + Gateway |
| DOC-002 | Documentation | P1 | Reproducibility | Scientific parameter defaults and their rationale need one source of truth | Docs + Processor |
| DOC-003 | Documentation | P2 | Handoff | Every verified result needs input hashes, command, machine and output manifest | Docs + Processor |

---

## 4. Dashboard issues

### DASH-001 — AppDashboard remains the orchestration god component

**Priority:** P1 · **Classification:** Structural debt  
**Evidence:** `sar-dashboard-v3/src/pages/app/AppDashboard.jsx` contains profile initialization, URL synchronization, uploads, catalog search, job creation, SSE parsing, polling, report loading, map rendering, panel composition and many profile-specific states in one component.

**Why it matters:** A small Flood change can affect Infrastructure because the same component owns both state and layout. Future AIs must repeatedly read a very large file to make a safe change, increasing regression risk and token cost.

**Target design:**

```text
AppDashboard
  ├─ useDashboardWorkflow()       gateway/jobs/SSE/polling
  ├─ useDashboardUrlState()       profile/view/job/report URL contract
  ├─ SharedMapCanvas               Leaflet and viewport only
  ├─ FloodWorkspace                flood-only panels and views
  └─ InfrastructureWorkspace      infrastructure-only panels and geometry
```

**Acceptance criteria:**

- No component owns both Flood-only and Infrastructure-only visual markup.
- Gateway job transport can be unit-tested without rendering Leaflet.
- A Flood panel change does not require changing Infrastructure geometry.
- Existing `/app`, job deep links and report opening still work.

### DASH-002 — Profile state isolation

**Priority:** P1 · **Classification:** Confirmed risk  
**Evidence:** Shared state includes `viewingResult`, `visibleLayers`, `activeView`, `selectedRegion`, job polling and map state, while both profiles are rendered from the same shell.

**Failure modes to test:**

- Switching profile while a job is running changes the wrong inspector.
- An Infrastructure result leaves Flood overlays or report controls visible.
- A Flood result causes Infrastructure deformation/coherence layers to remain enabled.
- Browser refresh restores a profile that does not match the selected job.

**Fix:** Introduce a profile-scoped workspace model. Shared state should contain only gateway/job/map primitives; profile state should be namespaced under `flood` or `infrastructure`.

### DASH-003 — Job history, demo entry and selected result need one state model

**Current intent:** Completed flood history is loaded from `/jobs`; demo opening is explicit; no result should be automatically selected unless a deep-link job ID is present.

**Remaining work:**

- Define states: `idle`, `loading-history`, `ready`, `running`, `completed`, `failed`, `offline`.
- Distinguish `historyJobs`, `activeJob`, `selectedResult` and `demoWorkspace`.
- Never use a completed job merely because it is the first item returned by the gateway.
- Show an explicit empty state when no artifacts exist.

**Acceptance test:** Fresh browser + empty gateway shows a clean workspace; clicking “Open verified demo” is the only demo entry; a real completed job appears only after `/jobs` and its report/artifacts succeed.

### DASH-004 — Local file selection/upload contract

**Current weakness:** The UI supports browser file selection and gateway upload, but the user-facing state must clearly distinguish a browser `File`, a gateway-stored path and a processor input path.

**Required contract:**

```json
{
  "source": "browser-upload | local-path | catalog-download",
  "displayName": "NISAR_...h5",
  "gatewayPath": "/data/uploads/...h5",
  "sizeBytes": 123,
  "sha256": "optional-but-preferred",
  "status": "selected | uploading | ready | failed"
}
```

The browser must not pretend that a local path typed into a text field is accessible to the gateway. The user must see which machine owns the file.

### DASH-005 — Inline layout and style duplication

**Evidence:** `AppDashboard.jsx`, `InfrastructurePanel.jsx` and Flood components contain extensive inline style objects, overlapping panel geometry and profile-specific z-index values.

**Fix order:**

1. Keep visual values stable during extraction.
2. Move shared tokens to `constants.js` or CSS custom properties.
3. Give Flood and Infrastructure separate layout roots and CSS namespaces.
4. Remove duplicated z-index/offset calculations.
5. Add a desktop screenshot regression check for both profiles.

Do not perform a visual redesign and architecture extraction in the same patch unless the screenshot baseline is captured first.

### DASH-006 — Large GeoJSON browser cost

**Evidence:** `RegionsView.jsx` can render up to 250 features, while the processor exporter represents classified raster cells and can produce many features.

**Risks:** slow React rendering, Leaflet layer churn, browser memory spikes and an unresponsive report view.

**Fix options:**

- Prefer raster class map for the overview.
- Request server-side pagination or simplification for vector inspection.
- Load vector features on demand after the user opens Regions.
- Add a hard feature/coordinate budget and explain when data is summarized.
- Use canvas/vector tiling only after measuring the real output.

### DASH-007 — Error model is too generic

Errors currently travel through fetch failures, SSE messages, console warnings and generic toasts. Create a shared error shape:

```json
{
  "code": "INPUT_NOT_FOUND | UNSUPPORTED_PRODUCT | PROCESSOR_FAILED | ARTIFACT_MISSING | GATEWAY_OFFLINE",
  "message": "Human-readable explanation",
  "retryable": false,
  "jobId": "optional",
  "details": {}
}
```

The UI should show the next action: choose a file, rebuild the processor, retry download, or inspect logs.

### DASH-008 — Accessibility and interaction verification

Required checks:

- Every floating panel can be reached by keyboard.
- Escape closes dialogs and transient drawers.
- Focus is trapped inside modal dialogs.
- Slider labels expose current value and unit.
- Map-only information is duplicated in accessible text.
- Reduced motion disables replay animation and nonessential transitions.
- No state is communicated by color alone.

### DASH-009 — Parameter schema mismatch

The UI has local values for radar band, polarization, thresholds, erosion, speckle filter and multilook factor. These must map exactly to gateway request fields and processor CLI flags. A parameter shown in the UI but ignored by the processor is a scientific integrity bug.

Create one schema with:

- field name;
- type/range/unit;
- band applicability;
- processor flag;
- report field;
- default rationale;
- validation message.

### DASH-010 — Bundle and loading performance

The app has a large dashboard chunk and heavy map/report dependencies. Measure before optimizing. Then lazy-load:

- Infrastructure panel;
- Flood report/replay/regions views;
- documentation page;
- optional charts and export views.

Do not hide a real regression by only raising Vite’s chunk warning limit.

---

## 5. Gateway issues

### GW-001 — Durable job state and restart recovery

**Priority:** P0 · **Classification:** Confirmed risk  
The gateway can preload completed jobs from its results area, but a robust production contract needs explicit job metadata and state transitions. A process restart must not turn a running job into an ambiguous ghost.

**Required:**

- Persist `queued`, `running`, `completed`, `failed`, `cancelled` with timestamps.
- Store command version, input paths, output manifest and error code.
- On startup mark orphaned running jobs as `interrupted`.
- Never infer completion only from the existence of a PNG.
- Make the results directory configurable and documented.

### GW-002 — Child process and SSE lifecycle

`jobs.rs` spawns processors and reads stdout/stderr. Verify:

- stdout and stderr cannot deadlock under large output;
- every SSE connection closes when the process ends;
- clients reconnect without duplicating events;
- event ordering is stable;
- a malformed processor line does not kill the job supervisor;
- child exit code and signal are preserved in the final job record.

### GW-003 — Local security boundary

The gateway is intentionally local, but it still handles large files and serves artifacts. Review:

- upload path traversal and filename sanitization;
- symlink handling;
- maximum upload size and free-space checks;
- artifact path confinement to approved roots;
- CORS policy;
- ASF token exposure in logs or browser responses;
- SSRF risk in any endpoint that accepts remote paths/URLs;
- whether binding to `0.0.0.0` is ever enabled accidentally.

### GW-004 — Central request validation

`POST /jobs` must reject invalid combinations before spawning a process:

- Flood requires supported GCOV input and a valid baseline/active relationship.
- Infrastructure requires the expected input type and metadata.
- Numerical parameters must be finite and inside processor-supported ranges.
- Input paths must exist and be readable by the gateway process.
- Fusion mode must require both compatible L/S inputs.

Return structured 4xx errors rather than allowing a child process to fail later.

### GW-005 — Cancellation and cleanup

Verify cancellation against:

- a queued job;
- a running Rust process;
- a process with children;
- a job during artifact export;
- a job after the browser disconnects.

Define whether partial HDF5-derived artifacts are retained for debugging or deleted. The answer must be visible in the job manifest.

### GW-006 — Structured event contract

Document events emitted by the processor and forwarded by the gateway:

```json
{
  "event": "started | progress | georef | flood_report | artifact | completed | failed",
  "job_id": "...",
  "phase": "hyperslab-read",
  "progress": 0.42,
  "path": "results/...",
  "message": "...",
  "timestamp": "..."
}
```

The frontend should not parse human log strings to determine state.

### GW-007 — Binary discovery/configuration

The gateway currently searches release/debug-relative paths. Make this explicit through environment variables or a config file:

- `NISAR_SCIENCE_PROCESSOR`
- `NISAR_STANDARD_PROCESSOR` if Infrastructure requires it
- `NISAR_RESULTS_DIR`
- `NISAR_UPLOAD_DIR`
- `NISAR_BIND_ADDR`

Expose the resolved binary version in `/health` or `/capabilities`.

### GW-008 — Artifact manifest

The frontend currently infers available outputs from fields such as report, GeoJSON, baseline and active paths. The gateway should return a manifest:

```json
{
  "artifacts": [
    {"kind":"flood-report","path":"...","mime":"application/json","size":123},
    {"kind":"class-map","path":"...","mime":"image/tiff","size":123},
    {"kind":"geojson","path":"...","mime":"application/geo+json","size":123}
  ]
}
```

This avoids frontend filename assumptions and makes missing files explainable.

### GW-009 — External catalog/download resilience

ASF and NRSC access needs:

- timeout and cancellation;
- retry with bounded backoff;
- HTTP status mapping;
- token/auth status that does not expose secrets;
- partial-download resume or a clear restart policy;
- checksum/size validation;
- disk-space preflight;
- a visible distinction between “no granules” and “catalog unavailable”.

### GW-010 — Scale beyond the in-memory registry

For a local single-user demo, in-memory state may be acceptable. For deployment, use a small SQLite job index or an append-only manifest. Keep the processor outputs on disk, but do not make the UI depend on process memory surviving.

---

## 6. Processor issues

### PROC-001 — Separate tactical and full-scene verification

The project contains tactical benchmark tooling and full-scene claims. They must not be reported as one interchangeable performance number.

Every benchmark record must state:

- input granule IDs and SHA-256;
- full-scene or crop mode;
- rows/columns and resolution;
- band/polarization;
- baseline/active dates;
- CPU/RAM/OS/Rust version;
- wall time and peak RSS;
- output hash and acreage.

### PROC-002 — L/S/fusion provenance

Every report must make clear:

- which products were used;
- which date was baseline and active;
- which band and covariance term were used;
- whether the result is L-only, S-only or fused;
- whether dates/geometries/footprints were matched;
- which physical gates were enabled;
- which pixels were invalid/nodata.

Do not publish a fused claim if the result is only a visual juxtaposition of independent maps.

### PROC-003 — One parameter contract

The UI workbench, gateway JSON and Rust CLI currently evolve separately. Create a versioned `ProcessingConfig` contract. The gateway should serialize it into CLI arguments, and the processor should emit the accepted/effective configuration in the report.

Important fields include:

- `radar_band`;
- polarization/channel;
- `permanent_water_thresh_db`;
- `min_change_db`;
- `seed_threshold_db`;
- `growth_threshold_db`;
- `receded_water_thresh_db`;
- `swath_edge_erosion_pixels`;
- `min_area_pixels`;
- `look_factor`;
- speckle/morphology options;
- fusion gates.

### PROC-004 — Geospatial metadata and area semantics

For every raster/vector export, verify and report:

- CRS and EPSG;
- affine transform or exact bounds;
- pixel width/height;
- whether the grid is projected or geographic;
- pixel area used for km²/acres;
- nodata value;
- valid-pixel count;
- full-scene footprint versus reference discovery box.

Area statistics must be derived from valid geospatial pixels, not from display dimensions or a cropped preview.

### PROC-005 — Channel availability and product interpretation

`nisar_parser.rs` must expose product type, band, polarization, dimensions and available datasets as validated metadata. If a requested channel is absent, fail with a useful error naming the available channels. Never silently substitute HHHH for a requested cross-pol feature.

### PROC-006 — Full-scene performance evidence

Repeat full-scene L, S and L+S runs on the target Windows/Linux deployment hardware. Record:

- peak RSS;
- temporary disk usage;
- HDF5 read throughput;
- multilook time;
- classification time;
- export time;
- total wall time;
- concurrent-run behavior.

The tactical `0.77 s` benchmark and the full-scene result must be shown in separate report tiers.

### PROC-007 — Validation and uncertainty

The submission/problem statement requires comparison and uncertainty. Add support for:

- confusion matrix when reference labels exist;
- precision, recall, F1 and IoU;
- change-class sampling strategy;
- reference image date/source/resolution;
- uncertainty or confidence explanation;
- explicit “not validated” state when no suitable reference exists.

Never manufacture an accuracy score from agreement between two implementations of the same algorithm.

### PROC-008 — Long-run recovery

Test failure during each stage: input open, hyperslab read, multilook, thresholding, region growing, morphology, GeoTIFF export, GeoJSON export and report write. The CLI should return a stable non-zero code and leave a useful error report. A future checkpoint/resume design is desirable for multi-GB full-scene jobs.

### PROC-009 — Export scale policy

GeoJSON is useful for inspection but can become too large for the browser. Define:

- maximum feature count;
- maximum file size;
- simplification policy;
- whether class rasters are the authoritative output;
- whether export is complete or preview-only.

The report must say when a vector output is summarized.

### PROC-010 — Machine-readable physical gate contribution

For L+S fusion, export counts and area for each gate:

- candidate pixels before gate;
- rejected sandbar pixels;
- recovered canopy pixels;
- wind-riffle/cross-pol recovered pixels;
- final class counts;
- overlap between gates.

This is required before presenting exact contribution numbers as product-level evidence.

---

## 7. Documentation and reproducibility issues

### DOC-001 — Canonical Windows runbook

`Docs/UserGuide/windows-local-run.md` must be the one command path. It should include:

1. prerequisites and versions;
2. processor build;
3. gateway build/run;
4. dashboard install/run;
5. health checks;
6. catalog credentials;
7. local upload flow;
8. example Flood run;
9. example Infrastructure run;
10. stop/cleanup commands;
11. common errors and fixes.

The documentation must not imply that a user can type a path from another machine into the browser and have the gateway access it.

### DOC-002 — Parameter source of truth

`flood_detect.rs`, CLI help, gateway request schema, dashboard workbench and `Docs/Architecture/flood_detection_pipeline.md` must agree on defaults and units. If a default changes, update the code, report, docs and regression fixture together.

### DOC-003 — Evidence bundle

Each verified result should be accompanied by a small manifest containing command, input hashes, environment, configuration, output files, output hashes and known limitations. This is more valuable than a screenshot alone.

---

## 8. Hardcoded presets: what is intentional and what must change

The product can keep named presets such as Kundra/Kolab, Brahmaputra and Bihar. They are useful for demonstrations and onboarding. They are not automatically a defect.

They become a defect when:

- a preset result is presented as a live gateway result;
- the dashboard opens a result without explicit user action;
- a preset silently overrides a user-selected input;
- coordinates are used to infer a scientific location without metadata;
- a report does not label the preset, acquisition date or source.

Required UI language:

- “Preset configuration” for saved coordinates/windows;
- “Verified demo” for a deliberate demo action;
- “Gateway result” for an actual completed job;
- “No result loaded” when no artifact has been selected.

---

## 9. Verification matrix before public release

### Dashboard

- [ ] Fresh `/app` loads without selecting a result.
- [ ] Flood and Infrastructure can be switched repeatedly without layout/state leakage.
- [ ] Profile survives refresh and stale profile values normalize safely.
- [ ] Demo opens only after explicit action.
- [ ] Completed history comes from gateway artifacts, not static arrays.
- [ ] Local browser file upload shows upload progress and final gateway path.
- [ ] Catalog search distinguishes no-result, auth failure and service failure.
- [ ] Running job survives panel collapse and route/view changes.
- [ ] Cancelled/failed jobs explain the next action.
- [ ] Flood replay uses only actual acquisition dates and supports reduced motion.
- [ ] Infrastructure report renders without Flood controls or Flood layers.
- [ ] Report export links are generated from the selected job manifest.
- [ ] Keyboard and focus pass completed.
- [ ] Desktop screenshot baselines captured for both profiles.

### Gateway

- [ ] `/jobs/health-ping` and capability/version endpoint are documented.
- [ ] POST validation rejects missing, unreadable or incompatible inputs.
- [ ] Upload path and artifact path confinement tested.
- [ ] ASF auth/search/download tested with missing, expired and valid credentials.
- [ ] Download checksum/size and partial-file behavior tested.
- [ ] SSE reconnect/order/end-of-job behavior tested.
- [ ] Process cancellation tested on Windows and Linux.
- [ ] Gateway restart tested during queued, running and completed jobs.
- [ ] Orphaned jobs become `interrupted`, not silently `completed`.
- [ ] Logs do not contain access tokens.

### Processor

- [ ] `cargo test` passes.
- [ ] L-band fixture passes.
- [ ] S-band fixture passes.
- [ ] L+S/fusion fixture passes.
- [ ] Missing channel/product type fails clearly.
- [ ] Nodata and swath-edge tests pass.
- [ ] Area/CRS/resolution metadata matches the source grid.
- [ ] Full-scene benchmark repeated on target machine.
- [ ] Tactical and full-scene benchmark reports are separated.
- [ ] Output manifest and hashes generated.
- [ ] Validation metrics are either evidence-backed or explicitly unavailable.

---

## 10. Recommended implementation batches

### Batch A — Protect the current system

1. Add/maintain dashboard screenshot smoke checks.
2. Add API/job contract fixtures.
3. Add processor output-manifest fixture.
4. Freeze current Flood L/S/fusion scientific regression outputs.

### Batch B — Extract frontend workflow

1. Extract `useDashboardWorkflow`.
2. Extract URL/profile normalization.
3. Keep map and profile layouts unchanged.
4. Run lint/build and both profile smoke flows.

### Batch C — Gateway contract hardening

1. Central request validation.
2. Structured errors/events.
3. Artifact manifest.
4. Cancellation/restart semantics.

### Batch D — Processor provenance

1. Versioned effective configuration in report.
2. Full geospatial metadata in every artifact.
3. Channel availability inventory.
4. Gate contribution counts.

### Batch E — Production readiness

1. Security/path/disk-space checks.
2. Full-scene repeatable benchmarks.
3. Reproducibility manifests.
4. Canonical Windows and Linux runbooks.

### Batch F — Product polish and scale

1. GeoJSON pagination/simplification.
2. Bundle splitting.
3. Better scientific validation views.
4. Optional durable job index.

---

## 11. Handoff prompt for a future AI

> Read `Docs/Architecture/dashboard-gateway-processor-issue-register.md` first. Do not assume an issue is a defect unless its classification says confirmed. Inspect the referenced source files and update the register with evidence before editing code. Preserve the validated Rust flood algorithm and the separate Flood/Infrastructure layouts. For each fix, state whether the owner is dashboard, gateway or processor, update the acceptance checkbox, run the smallest relevant verification, and avoid deleting named presets unless the user explicitly requests it.

## 12. Change log

| Date | Change |
|---|---|
| 2026-10-30 | Created living issue register after removal of dead SAR/standalone InSAR frontend paths and workflow-store shell. |
