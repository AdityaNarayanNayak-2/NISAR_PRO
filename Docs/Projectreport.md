Cross-verified end to end (frontend → gateway → both Rust engines). Here's what I found and the plan.

## 1. Verified: the Flood chain is linked and works — with a caveat

`AppDashboard.jsx` → `POST /jobs {pipeline:'flood', processor:'science', crop_*}` → gateway `jobs.rs` → `../sar_science_processor/target/debug/sar_science_processor.exe --mode flood --input <GCOV> --slave <baseline> --crop-lat/lon --crop-preset --min-change-db -3 …` → `flood_detect.rs` (7 stages) → `{id}_flood.{png,json,geo.json,_class.tif,_active.png,_baseline.png}` → `/results/` server → UI panels.

Verified facts:
- **GCOV is fully supported** by the flood path (`nisar_parser.rs:287`, grid path `GCOV/grids/frequencyA/HHHH`). Real Kundra run confirmed in `crash_journal.log`.
- The schema the UI reads (`method.*`, `areas.*`, `flood_regions`, `replay.available`, `georef_bbox`) matches `{id}_flood.json` exactly (`sar_science_processor/src/main.rs:817-875`).
- **NASA search needs NO credentials** — I verified a live ASF query returns scenes without any auth. "Not configured properly" is not the search; it's **download** (needs Earthdata creds) + the gateway silently flattening errors to `[]`.

## 2. Disconnects that will bite (ranked)

**P0 — frontend ↔ gateway**
- Failed jobs never resolve: status serializes as `{"failed":"msg"}` object (`jobs.rs:44`) but UI checks `=== 'failed'` → jobs hang in `running` forever, polled every 3s. No cancel wired up either.
- Flood reload/refresh broken: poller builds `api('/' + flood_report_path)` → `//results/…` double slash → 404 (`AppDashboard.jsx:608`). Only inline playback works.
- **`sar_processor` (standard) binary isn't built** on this machine → `Infrastructure` and `Standard RDA` profiles die with `SPAWN_FAILED`. Only `processor:'science'` (flood) runs today.
- `DataExportsView` `_flood_class.tif` link 404s: processor writes the TIFF but the gateway never exposes it in `JobResponse`.
- `baseline_path`/`active_path` forced `Some(...)` unconditionally (`jobs.rs:478-479`) even when no `--slave` → 404 on baseline preview.
- Health check can't fail (`GET /` has no route; no `res.ok` checks) → red offline banner unreachable; `gatewayOnline` starts `true`.
- Fabricated demo job `sar-e4efe049` shown when gateway returns `[]` — hides real emptiness.
- GeoJSON `class_code` compared with `=== 1|2|3|4` but processor emits numbers (ok today) — but one string-typed value breaks all toggles.

**P1 — gateway ↔ processor**
- Gateway only parses `georef`; `output`, `flood_report`, `progress` are streamed through unparsed and it instead recomputes paths by filename convention (fragile; works only if names never change).
- `georef` excluded from SSE replay history → late subscribers never get real bbox; fallback rederives from `crop` (approximate, inherits `1x2km` bug).
- `L` band and `EPSG:4326` hardcoded in the report/TIFF regardless of real product (`EPSG:32644`).
- `--mode gcov` uncropped = **8.8 GB peak**; RSLC/GSLC cropped path is **broken** (`read_f32()` on compound SLC rejects) and unstabbed read is ~15.6 GB.
- "Cloud Optimized GeoTIFF" claim is false (no overviews), `rows/cols as u16` truncate >65k, GeoJSON materializes entire FeatureCollection in RAM.

**P2 — NASA/Earthdata**
- Download failures (401/403, login-page-HTML saved as `.h5`) are hidden; no auth preflight; `EARTHDATA_*`/`ASF_*` env unset; `.env.example` **commits literal ESA credentials** (rotate + placeholderize).

## 3. The 8 GB RAM problem (my specific worry) — verified numbers

- GCOV 1.1 GB → **4.4 GB** f32 read (≈4×), ~40–55 s per product. Dual-image is sequential (ok), but each needs 4.4 GB.
- RSLC 7.8 GB → **~15.6 GB** peak (raw bytes + Complex32 both alive).
- No hyperslabs anywhere (rustyhdf5 limitation) — the "crop-before-load" claims in comments are false; crop is post-load.
- `guard_allocation` reads `/proc/meminfo` → **silently passes on Windows** (no meminfo), so on 8 GB it proceeds and risks OOM.

Realistic mitigations (pick below):
- **Low-effort**: Windows RAM detection in the guard (Win32 `GlobalMemoryStatusEx`), strict-crop enforcement for flood (`--mode gcov` without crop = refuse), docs guidance (use GCOV + ≤5×5–10×10 km crop on 8 GB; never RSLC).
- **Medium**: reduce transient peaks in `sar_processor` compound path (D2/D3) so RSLC is workable; fix mismatch so infrastructure profile routes to science engine.
- **High-effort**: true chunked/hyperslab reads (needs a native hdf5 crate — Rust-side UTM + 4.4 GB zero-copy read replaced by chunk decoding). Worth a spike only if 8 GB must handle full tiles.

## 4. Output improvements (clear / actionable)

Available now in `{id}_flood.json` but **not surfaced well**: `otsu`/effective threshold, region counts, confidence *reasons* (string list), polarity, per-class acres. Missing/actionable:
- Per-region table (polygon → acres/pct/confidence/severity) in the report — currently only `flood_regions: N`.
- Policy-style recommendations in `warnings[]` (e.g. "46% inundation growth vs baseline 24 Jul → verify levees near 18.78N, 82.60E") — needs processor logic + real tribal/irrigation context.
- Stream GeoJSON per-saving: polygonize + simplify (Douglas-Peucker) instead of 1 feature/pixel (77 MB now) — also gives crisp actionable vector to export.
- Correct `frequency`, add real `crs`, add `recommended_crop_preset` + timing bake in report; add `area_sq_m`, `changed_pct`, `baseline_vs_active_dates`.
- Frontend: legend, affected-area callout in `BottomStrip`, per-region drilldown, export all artifacts (incl. `_flood_class.tif`), fix class toggle coercion.

## 5. Docs additions (my scope, no code needed)
- `getting-started.md` + `windows-local-run.md`: **build BOTH processors**, gateway env vars table (EARTHDATA/ASF + note NASA search needs no creds, download does), 8 GB hardware guidance (GCOV + crop presets, avoid RSLC), correct the false "hyperslab/crop-before-load" claim.
- `api-reference.md`: fix dict (param `q` not `query`; `POST /jobs` → 200 not 201; status object shape; crop presets incl `10x10km`/`20x20km`; add `/asf/auth-status`, `/results/*`, `/upload` no-size-cap note).
- New `Architecture/flood_pipeline_contract.md`: file-name convention, SSE events and who parses them, memo/fallback bbox flow — this is the load-bearing contract.

## 6. Proposed execution (gated on your approval)

Phase 1 — **frontend-only fixes** (no approval needed, safe):
1. Fix `//results/` double-slash + `=== 'failed'` (accept object/string); show failed/cancelled state; wire Cancel.
2. Expose `_flood_class.tif` export via repo; fix `class_code` coercion; drop fabricated demo run when list is empty; make health check real (`res.ok` + `GET /` route).

Phase 2 — **gateway fixes** (backend = need your OK) and **Phase 3 — processor fixes/schema** (need your OK), plus memory mitigations and report improvements.

Phase 4 — docs updates above.

---

Before I touch anything, decide:

1. **Standard processor**: keep `Infrastructure`/`Standard RDA` on `sar_processor` (I'd build it and fix its contract bugs), or route them to the science engine (flood/insar/gcov all exist there)?
2. **Memory scope**: just the low-effort guard+docs, or invest in the RSLC/compound-path fix (P1) too? (Full chunked-read spike is out of scope unless you insist.)
3. **NASA download**: fine to add env-var guidance + a small auth-status preflight in the UI, or do you want a token field in the catalog panel?
4. **Report schema additions** (per-region table, recommendations): confirmed you want these in the flood JSON even though it changes the processor output?
5. **`.env.example`** with literal ESA creds — OK to scrub to placeholders (and you rotate the real ones)?

## Objective
- Rebuilt `/docs` around the repo's live `Docs/` markdown (single source of truth) and fixed `Docs/README.md`.
- Current goal: cross-verify the full product pipeline (frontend `AppDashboard.jsx` → `InfrastructurePanel.jsx` → `sar-gateway` → `sar_science_processor` NISAR parser/flood pipeline), find linkage gaps/errors (esp. NASA catalogue), propose docs additions and output improvements (clear/actionable), and **ask before applying any backend/processor code changes**.

## Important Details
- Truthfulness remains a hard requirement — no invented metrics in UI/docs; docs now render only tracked repo content.
- User constraint: "If backend / SAR Processor needs modification, contact me first, then apply"; docs additions can be applied directly.
- User concern: only 8 GB RAM on this PC → downloading a GCOV (~1.1 GB) can crash the pipeline; wants memory/output guidance.
- User suspects NASA catalogue "not configured properly" — verify `/search/nisar` auth/contract.
- User wants pipeline output improved: "clear info / actionable info in output".
- Env (Windows, `D:\nisar\nisar_pro`): node PATH prefix `C:\Users\Robotics Lab Kundra\AppData\Local\Zed\node\node-v24.11.0-win-x64`; use `npm.cmd`; dev server is IPv6-only → `http://[::1]:5173`; dev log `C:\Users\ROBOTI~1\AppData\Local\Temp\opencode\dev-err.txt`; no browser/vision tooling for visual QA.
- Key verified pipeline facts (from explorer reports):
  - `src/config/api.js`: gateway URL from `localStorage` key `nisarpro_gateway_url`, default `http://localhost:3000`; `setGatewayUrl()`/`isGatewayConfigured()` have **no callers**; no UI to change gateway; nginx `/api/` proxy is dead code.
  - `AppDashboard.jsx:297-300`: health check `GET /jobs/health-ping` every 15 s; neither health call checks `res.ok`; `gatewayOnline` initial value `true`.
  - `sar-gateway/src/main.rs:37-52`: Axum router; binds `0.0.0.0:3000` (`main.rs:54`); CORS fully open. `GET /search` → `search_handler` (`handlers.rs:18`) returns `Vec<SarScene>` `{id, platform, date, footprint, quicklook_url}`, never errors (ESA failure → `200 []`). `GET /search/nisar` → `search_nisar_handler` (`handlers.rs:30`) requires `bbox` query, returns `Vec<NisarScene>` `{id, date, footprint, download_url, size_bytes: String, platform}`; `400` on missing/unparseable bbox, upstream failure → `200 []`. `GET /assets/search?q=` (`handlers.rs:140-144`), `GET /context` (`handlers.rs:422`, 16-field `ContextResponse`).
  - Only `sar_science_processor` (v0.1.0, 14 modules) has flood pipeline: `flood_detect.rs` (748 lines), `crash_journal.rs` (OOM guard). `sar_processor` (v0.4.0, 19 modules) has ship detection/`gunw_parser.rs` but **no flood**. CI builds `sar_processor` but **not** `sar_science_processor`.
  - `sar_science_processor` Cli (`src/main.rs:27-107`): `--input/-i` (required at runtime), `--slave` (dual role: InSAR slave `main.rs:358` AND flood baseline GCOV `main.rs:630`), `--output/-o` default `"sar_science_out"`.
- Decision: use `marked` (installed) + custom renderer; KaTeX via existing global CDN in `index.html`; `vite.config.js` `server.fs.allow: ['.', '..']` so dev reads `../../Docs`.

## Work State
### Completed
- Use Cases removal: deleted `src/pages/UseCasesPage.jsx`; cleaned `App.jsx` (lazy import, `/use-cases` Route, `isImmersive`); removed Navbar "Use cases" link; Footer "Use cases" → "Read the docs" → `/docs`. eslint clean, `npm run build` ✓.
- Docs rebuilt as markdown-driven: new `src/pages/docs-md.js` (manifest + `assetMap` + `shimMath`/`slugify`), `src/pages/docs-render.jsx` (marked + heading ids + KaTeX + code copy buttons + figures), `src/pages/docs.css`, replaced `src/pages/DocsPage.jsx` (search filter sidebar, 4 groups covering 20 live docs, right TOC, home overview with group cards). Added `marked` dep; `vite.config.js` `server.fs.allow`. eslint ✓, build ✓, dev probes 200 (`/docs`, `docs-md.js`, `docs-render.jsx`, raw md via `/@fs/`).
- `Docs/README.md` rewritten: remapped to real `Docs/UserGuide/` (8 files) + `Docs/Architecture/` (12 files); removed phantom `Guides/Algorithms/UseCases/isce3/insar_analyst/feasibility/maritime` links; added assets section + corrected repo codebase map; verified all relative links resolve.
- Explorer passes completed (read-only) for: frontend app panels, `sar-gateway`, both processors — detailed cross-verification reports produced (tail portions truncated in transcript).

### Active
- Synthesize the three explorer reports into a cross-verification matrix for the user: linkage gaps, NASA catalogue verdict, 8 GB RAM risks, proposed docs additions, output improvements; ask before backend/processor edits.

### Blocked
- No `.h5` input files locally → no true end-to-end run; downloading GCOV risks crashing the 8 GB machine.
- `nisa r-pro-process.mp4` still pending for `ProcessVideo.jsx` (shows pending card).
- Full explorer report tails truncated in transcript — re-read specific files if a detail is missing.
- No browser/vision tooling → visual QA is user-side.

## Next Move
1. Deliver a consolidated pipeline cross-verification to the user (endpoint/payload contract matrix frontend↔gateway, gateway↔processor CLI contract, flood-path findings, NASA catalogue issue, memory/OOM guidance for 8 GB, recommended output improvements), then ask which backend/processor changes to apply.
2. Apply approved `Docs/` additions only (auto-flows into `/docs` via `docs-md.js`); do not touch `sar-gateway`/`sar_science_processor`/`sar_processor` until user confirms.

## Relevant Files
- `src/pages/app/AppDashboard.jsx`: job submission/health polling (`:297-300`), SSE consumption; named by user as inspect point.
- `src/pages/app/InfrastructurePanel.jsx`: infra panel; named by user as inspect point.
- `src/config/api.js`: gateway URL (`nisarpro_gateway_url`), no-caller helpers.
- `sar-gateway/src/main.rs` (`:37-52` router, `:54` bind), `handlers.rs` (`search_nisar_handler :30`, `search_handler :18`, `search_assets_handler :140`, `context_handler :422`), `models.rs`, `jobs.rs` (SSE/processor spawn), `nasa_client.rs` (NASA auth – unresolved).
- `sar_science_processor/src/main.rs` (Cli `:27-107`, flood path `:630`), `flood_detect.rs`, `nisar_parser.rs`, `crash_journal.rs`, `io.rs` (exporters), `lib.rs`.
- `sar_processor/src`: legacy engine (ship detection, `gunw_parser.rs`, polsar/safe/downloader); no flood.
- `src/pages/DocsPage.jsx`, `src/pages/docs-md.js`, `src/pages/docs-render.jsx`, `src/pages/docs.css`, `vite.config.js`: new markdown-driven docs wiring.
- `Docs/README.md`, `Docs/UserGuide/`, `Docs/Architecture/`, `Docs/assets/`: live doc source of truth.

The plan is fully researched — three verified reports are in hand, so there's nothing left to investigate before execution. The only open items are your decisions, which gate Phase 2/3 (backend/processor = your approval required). Rather than block, here's the decision set with recommended defaults so you can answer in one line.

**1. Standard processor** (`Infrastructure` / `Standard RDA` profiles)
- (a) Build `sar_processor` + fix its contract bugs (keeps both engines)
- **(b) Recomment: route those profiles to the science engine** (flood/insar/gcov all exist there, already works)

**2. Memory scope for 8 GB**
- (a) Low-effort only: Windows RAM guard + strict-crop enforcement + docs guidance
- **(b) Recommended: (a) + fix the broken RSLC/compound-path reads** (P1) so full-precision work is possible near 8 GB
- (c) Full chunked/hyperslab read spike (native hdf5 crate) — only if you must handle full uncropped tiles

**3. NASA/Earthdata download**
- **(a) Recommended: env-var guidance + `/asf/auth-status` preflight shown in catalog panel** (no token stored)
- (b) Also add a token field in the catalog UI

**4. Flood report schema additions** (per-region acres/pct/confidence table, recommendations `warnings[]`, streamed simplified GeoJSON + correct CRS)
- **(a) Recommended: yes**, I'll bump it as a schema version so old reports stay readable
- (b) No, surfacing only what exists today

**5. `.env.example` literal ESA creds**
- **(a) Recommended: scrub to placeholders** (you rotate the real ones)

**Default path if you don't object:** Phase 1 (frontend fixes) + Phase 4 (docs) proceed now; Phases 2/3 wait on answers to 1–4. Just reply e.g. "defaults" or mix-and-match (e.g. "1b 2a 3a 4a 5a").
