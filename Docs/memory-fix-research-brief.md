# MEMORY-OPTIMIZATION RESEARCH BRIEF — Processing Real NISAR GCOV Granules on a Notebook (Hackathon: InGARSS 2026, ~1 month)

> **Status note (current code):** the GCOV flood path no longer uses the full-band read-then-crop pattern described below. `sar_science_processor/src/windowed.rs` implements a memory-mapped, chunk-aware windowed reader, and `nisar_parser::parse_nisar_cropped_window` uses it for GCOV. The old path is kept only behind `NISAR_GCOV_LEGACY_FULL_READ`. This document is retained as the historical problem statement and design research; see [Blog 02](./Blog/02-byte-for-byte-or-it-didnt-happen.md) and [Blog 03](./Blog/03-engineering-diary-from-crash-to-0-12-seconds.md) for the implementation story.

**IMPORTANT — YOU ARE A TECHNICAL RESEARCH ASSISTANT.** Read this entire brief, then deeply research the Open Questions section. Validate my claims, correct anything wrong, and return: (1) a verdict on the best implementation path, (2) concrete crate/library choices with version + API names, (3) a step-by-step implementation plan with risk notes, (4) exact memory numbers to expect, (5) a test/verification matrix. Do NOT write code unless asked. Be skeptical of everything — the team has been burned by library assumptions before.

---

## 1. MOTIVATION (why we need this)

We are building a **local-first, browser-based SAR flood-detection platform** ("NISAR Pro") in Rust for the NASA-ISRO NISAR mission. A user picks a flood event on a map, we fetch the relevant two NISAR Level-2 GCOV granules (pre- and post-event), and a pure-Rust CLI runs a 7-stage flood/inundation pipeline locally (radiometric calibration, speckle suppression, multi-temporal log-ratio, adaptive thresholding, region growing, morphological cleanup, confidence scoring). Data must never leave the user's machine (a hard product requirement).

**The problem: the current code CANNOT process a real granule on a typical developer laptop (Windows/Mac, 16 GB RAM).** It was only ever tested on small synthetic crops. We have exactly ~1 month to make a real pre/post GCOV pair (each file ~8 GB) process to a flood map on a 16 GB notebook, live, at a hackathon demo. This is the critical-path engineering task.

Our architecture: React + Leaflet dashboard (already deployed free on Cloudflare Pages, static only) → local Axum gateway (HTTP/SSE, job supervisor) → spawns the Rust CLI worker → streams progress/logs back. Compute is out-of-scope for the cloud; it runs on the user's laptop. This brief is ONLY about the Rust engine's memory ceiling.

## 2. CONTEXT — system, language, dependencies (self-contained)

- Language: **Rust** (edition 2021). Workspace crates: `sar_science_processor` (the engine — the target of this work), `sar_processor` (an older processor + GUNW InSAR path), `sar-gateway` (Axum orchestrator).
- HDF5 binding in use: **`rustyhdf5`** (`HDF5Data` / `HDF5File`, `Dataset::read_f32()`, `Dataset::shape()`). This crate deliberately exposes **NO hyperslab / partial-read / dataset-selection API** — you can only read an entire dataset into a `Vec`.
- Numerics: `ndarray` (Array2, Array2<Complex32>).
- The GCOV product (NISAR L2 geocoded polarimetric covariance): the flood path reads **covariance diagonal (real-power) terms** at HDF5 paths of the form
  ` /science/LSAR/GCOV/grids/frequencyA/{HHHH | HVHV | ...} ` — real-valued `f32` 2-D datasets. Reference frame size from code comments: **16020 × 16560 px** (≈ 1.06 GB per f32 band; some frames larger, up to ~4.6 GB for a single full-band buffer). The on-disk granule is ~5.9 GB total across all bands/metadata.
- GCOV flood data flow (in `main.rs`, "flood mode"): (1) load **Active** granule → parse_gcov → read FULL band → copy crop window → drop full buffer; (2) load optional **Baseline** granule the same way; (3) pixel-wise ratio/detection. A 10-km-radius AOI crop might be only ~500×500 px, but we still materialize the whole 1–4.6 GB band first.
- Windows is the primary demo OS; Linux is secondary (CI).

## 3. THE PROBLEM — precise and quantified

Four distinct root causes, in order of severity:

1. **Full-band read-then-crop (root cause).** In `nisar_parser.rs` (~line 387–420) the GCOV branch calls `dataset.read_f32()` which allocates a `Vec<f32>` for the **entire** band (~1.06–4.6 GB), then copies just the AOI crop window into an owned `Array2<Complex32>` and drops the full `Vec`. Peak memory is therefore **proportional to the product size, not the AOI size**. The same read-then-slice pattern exists in the GUNW path (`gunw_parser.rs` `read_2d_f32_cropped`, line ~592, which carries the comment *"rustyhdf5 does not support hyperslab/partial reads, so the full dataset is loaded into memory first, then sliced"*). The flood run repeats this peak **twice** (Active + Baseline) and the window must also coexist with ndarray intermediate working arrays. On 16 GB RAM alongside a browser/IDE + the ~5.9 GB file's OS page cache, this OOMs (Windows kills the process or it hard-crashes).

2. **The memory guard is Linux-only (why it crashes silently on Windows).** `crash_journal.rs` has a `guard_allocation()` safety mechanism — it estimates an allocation's bytes and blocks if RAM + 50% swap is insufficient — but it obtains memory stats from `/proc/meminfo` (`read_system_memory()`, Linux only). On Windows/Mac that call returns `None`, and `guard_allocation()` then **silently returns Ok() and proceeds** to allocate (line ~184–194). So the safety net we wrote is effectively disabled on the exact OS we demo on.

3. **Wasteful type materialization.** The GCOV band is real `f32` power, but the crop path wraps every sample into `Complex32::new(v, 0.0)` (2× the bytes) and the downstream `gcov_to_db` treats it as intensity. For the flood use-case we only need real power → every intermediate array is 2× bigger than necessary, and there is an extra full copy of the band.

4. **No streaming/backpressure.** The pipeline materializes (crop, mask, ratio, seed, grown) arrays as whole buffers. After cropping they're small, but there is no mechanism to process a large AOI incrementally (tile/window streaming) if we ever want full-frame or wide-area detection.

**Numeric target:** a 10-km AOI crop on the 16020×16560 product should process the Active+Baseline pair with **peak process RSS under ~3 GB on 16 GB RAM**, robust on Windows and Linux, and ideally degrade gracefully (guard) rather than crash if a bigger AOI is chosen.

## 4. WHAT WE ALREADY HAVE (assets, not debts)

- Code understands the crop geometry properly: it reads 1-D coordinate grids (lats/lons), uses `find_index_range` to compute `(row_start,row_end,col_start,col_end)` from the AOI rectangle, then crops. So we ALREADY know the exact box before the big read — we just throw it away by doing a full read anyway.
- A working end-to-end flood pipeline (7 stages) proved on a real small run (Upper Kolab Reservoir example, 145 acres detected), so the algorithm itself is not the risk.
- A `crash_journal` mechanism (pre-crash journal file + `guard_allocation` + timed scopes) exists and works on Linux — it just needs a cross-platform memory source.
- A fresh pair of real granules is already selected (Track 149, frame 79: 2026-09-16 pre + 2026-09-28 post, Indravati/Mahanadi flood) for testing.

## 5. THE FIX — design space (rank by risk/effort)

**Route A — True hyperslab/selection reads via a capable HDF5 binding (LOW RISK, HIGH VALUE). This is the primary recommendation to validate.**
Replace the data-read layer with an HDF5 crate that supports **dataset selection / hyperslab reads** (e.g. `hdf5` / `hdf5-rs`, its maintained forks like `hdf5-metno`, or `hdf5-sys` FFI wrapping `H5Sselect_hyperslab` + `H5Dread` with a memspace). Then the crop is read **directly from disk** into a small owned array; memory = O(crop), only the intersecting chunks of a chunked/compressed dataset are decompressed. Research/validate:
- Which crate exposes a selection API (`read_2d(&selection)`, `Dataset::read` with `Select::Selection`) and supports chunked + gzip/fletcher32-filtered NISAR datasets?
- Can `hdf5-rs` open and read the same file that `rustyhdf5` opened in the same process (two HDF5 file handles, locking/close-degree behavior), or should we migrate the whole read path to the new crate? Worth benchmarking selection-read time vs full-read time.
- Is there any partial-read support in newer `rustyhdf5` releases we missed?

**Route A′ (network-side complement, possibly the simplest end-to-end win): AOI-subset the DOWNLOAD itself.** NASA ASF supports cloud-side cropping of NISAR GCOV (HDF5 subsetting — dataset-level extraction is available; spatial subsetting roadmap is being rolled out), and GDAL's `vsicurl` can read HDF5 over HTTP with range requests via `/vsisubfile`. If we can fetch *only* the AOI sub-volume into a small local file, the existing parser works with no changes. Trade-off: adds a network dependency + EDL auth, and spatial subsetting may still be limited; but memory disappears as an issue entirely. Validate current ASF/Harmony subsetting capabilities before betting the demo on it.

**Route B — Tile-chunk streaming pipeline (THE "NEW TECHNIQUE" CANDIDATE, HIGH RISK).** Convert flood ingestion to a **blocking tile iterator**: pull AOI-covered tiles (e.g. 1024×1024) from each granule via hyperslab reads, process the 7 stages per-tile with edge overlap to keep the 3×3 median and region-growing consistent at seams, and maintain a rolling fixed-size buffer. This bounds memory regardless of AOI size and is the design that lets us demo *full-frame* wide-area detection on a notebook. This is genuinely valuable but is where "we might need to invent something" — recommend building it only after Route A lands, and keep it scoped behind a feature flag. Research: HDF5 chunk layout for NISAR GCOV (are bands chunked/compressed? chunk shapes?), so tile reads align with chunk boundaries for efficient decompression (avoid the classic tiled-read performance trap).

**Route C — Memory-governance hardening (cheap, do regardless).**
- Give `crash_journal` a **cross-platform memory source** (`sysinfo` crate or `GlobalMemoryStatusEx` on Windows) so `guard_allocation()` actually blocks/proceeds correctly on the demo OS. This alone stops silent OOMs; it does not fix Route A.
- Operate the flood path on **real `f32` power directly** — delete the `Complex32(re,0)` wrapper for GCOV (halve working-set per array).
- Explicit `drop()` of large buffers at every stage boundary (partly present already) + `run` scopes; NIT: reuse `Array2` buffers across stages instead of re-allocating.

## 6. RISKS / THINGS THAT COULD BITE US

- Chunked+compressed HDF5: a small hyperslab may still force decompression of some large chunks → measure I/O amplification; check NISAR chunk shapes first.
- Two HDF5 crates in one process: symbol conflicts / double `libhdf5` linkage (ensure features use the same system lib or static linking correctly).
- `hdf5-rs`'s selection API is C-API-coupled: subtle lifetime/selection-buffer bugs; require unit tests that compare selection-read vs full-read byte-for-byte.
- Reading via `vsicurl` is brittle for a live demo (network, auth, latency) — never make it the ONLY path.
- The region-growing confidence stage is order-dependent; if tile streaming changes seeding order, results shift — must prove tile path reproduces the non-streamed result on the same AOI.

## 7. VERIFICATION MATRIX (we must ship with these)

| Test | Assertion |
|---|---|
| Byte-identical | Hyperslab crop == full-read-then-slice crop (f32 exact or ULPs ≤ 1) |
| Peak memory | Full pair on 16 GB RAM: peak RSS < 3 GB (measure: Windows GetProcessMemoryInfo/WorkingSet, Linux /proc/self/status VmHWM) |
| Timing | Pair-to-flood-map < ~10 min on the real 16020×16560 track-149 pair |
| OS matrix | Windows 11 + Ubuntu 22.04 both pass with the guard *active* (guard must BLOCK an implausible huge AOI gracefully, then succeed on a 10-km AOI) |
| Result consistency | Tile-streamed output == non-streamed output on the same AOI (if Route B enabled) |
| Journal | Crash journal timestamps + MEMORY_GUARD entries appear correctly on Windows |

## 8. OPEN RESEARCH QUESTIONS for you to investigate (return concrete answers)

1. In 2026, which Rust + HDF5 option supports **selective (hyperslab/memspace) reads** of chunked, gzip-compressed f32 2-D datasets with good API ergonomics and active maintenance — `hdf5`(hdf5-rs), `hdf5-metno`, `hdf5-sys`, something else? Give exact crate + version + the API methods to use.
2. For NISAR L2 **GCOV grid covariance bands**: what is the actual HDF5 **storage layout** (contiguous vs chunked; chunk dims; filters gzip/fletcher32/shuffle)? Where can we confirm this authoritatively (PDS4 label, ASF docs, NISAR SDS doc)? What does that imply for selection-read I/O amplification?
3. Can `hdf5-rs` and `rustyhdf5` coexist in one process reading the same file (or must we unify)? Any link-symbol or lock concerns (file locking, H5F close-degree)?
4. Is a chunk-aligned tile iterator (Route B) worthwhile given the chunk layout in Q2, or do AOI crops already align well enough that a single selection read suffices?
5. Best minimal cross-platform Rust memory API to make `guard_allocation` work on Windows (sysinfo vs windows-rs GlobalMemoryStatusEx), and how to measure a process's own peak RSS portably (for the verification matrix).
6. **Server-side subsetting status (2026):** can ASF / Harmony serve a shape-restricted GCOV sub-volume directly (so the file on disk is already cropped)? Exact mechanism + current availability/limits + auth, since if solid this is the fastest route to a demo.
7. Any prior art on memory-bounded SAR change-detection pipelines (e.g., tile-based Sentinel-1 flood processing) we should steal patterns from?

Return: verdict on Route A vs A′ vs B (and order to do them in with 1 month left), crate picks with versions/APIs, a phased implementation plan with time estimates and risk notes, expected memory/timing numbers, and your recommended test matrix (can revise ours). Be specific and skeptical.
