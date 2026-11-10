# NISAR Pro architecture

This page shows how the parts of NISAR Pro fit together. Everything here is taken from the
code in this repository (November 2026). Speeds and memory are the measured values from the
InGARSS 2026 runs.

---

## 1. The big picture

NISAR Pro has three programs and one hackathon package.

| Part | Folder | Language | Job |
|---|---|---|---|
| Science engine | `sar_science_processor/` | Rust | Reads NISAR `.h5` files and makes the water / change maps |
| Gateway | `sar-gateway/` | Rust (Axum, Tokio) | Web server on port 3000. Starts engine jobs, streams their logs, serves results and the dashboard |
| Dashboard | `sar-dashboard-v3/` | React + Vite + Leaflet | The web page: pick granules, run a job, look at the maps |
| Hackathon package | `ingarss_2026/` | Python (standard library for the checker) | Fusion, validation, maps and the reviewer checker for InGARSS 2026 |

```mermaid
graph LR
    User([User in a browser])
    subgraph Local computer
        Dash[Dashboard<br/>sar-dashboard-v3/dist]
        GW[Gateway<br/>sar-gateway :3000]
        Eng[Science engine<br/>sar_science_processor]
        Res[(sar-gateway/results/)]
        H5[(NISAR .h5 granules<br/>on local disk)]
    end
    ASF[(NASA ASF / Earthdata)]

    User --> Dash
    Dash -- REST + live logs --> GW
    GW -- starts as a child process --> Eng
    H5 --> Eng
    Eng -- PNG, GeoTIFF, GeoJSON, JSON --> Res
    Res -- /results/* --> GW
    GW -- search and download --> ASF
```

All heavy work runs on the local computer. The radar files never leave it unless the user
sends them somewhere.

---

## 2. Science engine (`sar_science_processor`)

A command-line program. The gateway and the hackathon scripts both call it the same way.

| Mode | Flag | What it does |
|---|---|---|
| Flood / water change | `--mode flood` | Two GCOV dates → water and change classes (the InGARSS method) |
| GCOV image | `--mode gcov` | One GCOV date → a radar image |
| InSAR | `--mode insar` | Two SLC dates → interferogram, coherence, phase, ground movement |

Main source files:

| File | Job |
|---|---|
| `main.rs` | Reads the command-line flags and runs the chosen mode |
| `nisar_parser.rs` | Opens NISAR HDF5 files (pure-Rust `rustyhdf5` crate) and reads the grid and coordinates |
| `windowed.rs` | Reads a part of a big dataset without loading all of it |
| `multilook.rs` | Averages blocks of pixels |
| `flood_detect.rs` | The 7-stage water change method and Otsu |
| `io.rs` | Writes PNG, GeoTIFF (EPSG:32645), GeoJSON and the result JSON |
| `insar.rs`, `coregister.rs`, `deramp.rs`, `phase_filter.rs`, `unwrap.rs`, `topo_phase.rs`, `infra_health.rs` | InSAR path |
| `crash_journal.rs`, `sha256.rs`, `errors.rs` | Crash log, file hashes, error types |
| `src/bin/gcov_*.rs` | Small test tools that compare our HDF5 reads with h5py byte for byte (`scripts/nisar_probe.py`) |

### 2.1 How a full scene fits in memory

One GCOV layer is about 33,696 × 34,344 pixels (1.16 billion values, 4.63 GB as `f32`).
Loading two dates at once would need far more memory than a normal laptop has. So the
engine never loads a full layer.

```mermaid
graph TD
    A[GCOV layer on disk<br/>~33,696 × 34,344 at 10 m] -->|read 1,024 rows at a time| B[One strip in memory]
    B -->|average each 8 × 8 block<br/>at least 32 of 64 pixels valid| C[One strip of the 80 m grid]
    C -->|append| D[80 m grid<br/>4,212 × 4,293 ≈ 72 MB]
    B -->|strip dropped| X((freed))
```

Measured on a 4-core workstation: each date pair takes 44–65 s with 1.87–2.32 GB peak memory.

### 2.2 The flood path, step by step

```mermaid
graph TD
    P[1 · Pair<br/>same band, same term HHHH, same grid] --> D[2 · dB<br/>10·log10 power, below −40 dB = no data, 40-pixel edge cut]
    D --> M[3 · Speckle<br/>3 × 3 median of valid neighbours]
    M --> C[4 · Change<br/>Δ = dB after − dB before]
    C --> S[5 · Stable water<br/>below −13.0 dB on both dates]
    C --> N[6 · New water<br/>seeds Δ < −5.0, grow into neighbours Δ < −2.5,<br/>opening, min 8 pixels]
    S --> K[7 · Classes<br/>0 land · 1 stable water · 2/3 new water · 5 water loss]
    N --> K
    K --> O[Outputs<br/>class GeoTIFF, valid-support GeoTIFF, GeoJSON, PNG, JSON with areas]
```

S-band uses slightly different numbers (−12.5 dB stable water, −4.8 / −2.2 dB seed and
growth). Otsu is computed and reported, but the seed stays at −5 dB because
`seed = min(−5, Otsu, −3)`. Full details are in `ingarss_2026/TECHNICAL_NOTE.md`.

---

## 3. Gateway (`sar-gateway`)

An Axum web server on `0.0.0.0:3000`.

```mermaid
graph TD
    R[HTTP request] --> RL[Rate limit<br/>120 requests/min per IP<br/>6 new jobs/min per IP]
    RL --> API{Route}
    API -->|POST /jobs| J[jobs.rs<br/>starts sar_science_processor]
    API -->|GET /jobs/:id/logs| L[Live log stream SSE]
    API -->|/search/nisar, /asf/*| N[nasa_client.rs<br/>ASF search and download]
    API -->|/results/*| F[Files in sar-gateway/results/]
    API -->|anything else| SPA[Dashboard index.html]
    J --> Q[Job queue<br/>MAX_CONCURRENT_JOBS, default 1]
    Q --> E[Engine child process]
    E -->|stdout lines| L
    E -->|files| F
```

| File | Job |
|---|---|
| `main.rs` | Routes, CORS, serving the dashboard build, loading finished jobs on start |
| `handlers.rs` | One function per route |
| `jobs.rs` | Builds the engine command, runs it, keeps job status, cleans old jobs |
| `nasa_client.rs`, `esa_client.rs` | Catalogue search and downloads |
| `rate_limit.rs` | Per-IP request limits |
| `models.rs` | Request and response types |

Only the flood profile (`processor: "science"`) runs. The older `sar_processor` and the
Kubernetes operator `sar_operator_v2` were removed from the repository, so the gateway now
returns a clear error for the old InSAR and infrastructure profiles. The Kubernetes code path
in `jobs.rs` is only used when `LOCAL_MODE=false`, which no launcher sets.

---

## 4. Dashboard (`sar-dashboard-v3`)

React 19 + Vite. Built once with `npm run build`; the gateway then serves `dist/`, so Node is
not needed to use it.

| Folder | What is in it |
|---|---|
| `src/pages/marketing/` | Landing page |
| `src/pages/DocsPage.jsx` | Documentation pages |
| `src/pages/app/` | The working app: map, job form, flood replay, result panels |
| `src/config/` | Gateway address (`api.js`) |

Flood replay shows three steps: the before image, the after image, then the after image with
the class map on top.

---

## 5. InGARSS 2026 package (`ingarss_2026/`)

The package does not need the gateway or the dashboard. It calls the engine directly and
then runs Python scripts.

```mermaid
graph TD
    H5[(6 NISAR GCOV granules<br/>L: 26 Jul, 31 Aug, 12 Sep, 18 Oct<br/>S: 31 Aug, 12 Sep)] --> E[bin/sar_science_processor<br/>one run per date pair and band]
    E --> R1[results/L_*, results/S_*<br/>class GeoTIFF + JSON]
    H5 --> FU[scripts/run_ls_fusion_and_pol_assessment.py]
    R1 --> FU
    FU --> R2[results/LS_fused_aug31_sep12]
    S2[(Sentinel-2 L2A<br/>29 Aug, 13 Sep)] --> V[scripts/validate_sentinel2.py<br/>scripts/check_sand_rule.py<br/>scripts/score_polarization_features.py]
    R1 --> V
    R2 --> V
    V --> R3[results/validation/]
    R1 --> MP[scripts/make_maps.py → maps/]
    R2 --> MP
    R1 --> WK[scripts/make_walkthrough.py<br/>scripts/build_walkthrough_doc.py → explainer/]
    R1 & R2 & R3 --> MF[scripts/build_provenance_manifest.py<br/>SHA-256 of every file]
    MF --> CK[run_bihar_analysis.py<br/>checks hashes, prints Tasks A–H,<br/>ends with ALL CHECKS PASSED]
```

A reviewer only needs Python 3 and `python3 run_bihar_analysis.py`. No granules or downloads.

---

## 6. Release builds

```mermaid
graph LR
    GL[GitLab main] -->|.gitlab-ci.yml| LX[Linux build<br/>tar.gz + install.sh]
    GL -->|mirror| GH[GitHub main]
    GH -->|.github/workflows/deploy-dashboard.yml| WB[Windows build]
    GH --> PG[Dashboard on GitHub Pages]
    WB --> SETUP[NISAR-Pro-Setup-1.0.0.exe<br/>Inno Setup installer]
    WB --> ZIP[Portable ZIP]
```

The Windows app is installed per user (no admin needed) into
`%LOCALAPPDATA%\Programs\NISAR Pro`. It adds a Start Menu entry, an optional desktop icon and
an uninstaller. `NISAR Pro.exe` (from `installer/launcher.rs`) starts the gateway in the
background, waits for it, opens the dashboard, and shows a message box if something fails.
See `installer/README.md`.

---

## 7. Folder map

```
sar_analyzer/
├── sar_science_processor/   Rust science engine
├── sar-gateway/             Rust web server (port 3000)
├── sar-dashboard-v3/        React dashboard
├── ingarss_2026/            InGARSS 2026 submission package
├── installer/               Linux and Windows launchers, Windows installer script
├── scripts/                 Helper scripts (note PDF, tunnel, data download, h5py check)
├── Docs/                    Documentation
└── Download/                ASF bulk download script (no stored login)
```
