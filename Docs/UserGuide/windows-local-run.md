# Run NISAR Pro Locally on Windows

This is the recommended local workflow for PowerShell.

## What runs in each terminal?

| Terminal | Component | Stays running? |
|---|---|---:|
| 1 | Rust processor build | No — build once |
| 2 | Rust gateway | Yes — port 3000 |
| 3 | React dashboard | Yes — port 5173 |

The processor is a command-line worker. You normally do not keep a processor server running. The gateway starts the correct processor automatically when you submit a job.

## One-time requirements

Install:

- Rust from <https://rustup.rs>
- Node.js 20 or newer from <https://nodejs.org>

Verify PowerShell can find them:

```powershell
rustc --version
cargo --version
node --version
npm.cmd --version
```

## Terminal 1 — build the processor

Open PowerShell in the repository root:

```powershell
cd D:\nisar\nisar_pro\sar_science_processor
cargo build
```

For the standard SAR/InSAR processor too, build it once:

```powershell
cd D:\nisar\nisar_pro\sar_processor
cargo build
```

The flood pipeline uses `sar_science_processor`. The gateway looks for its debug binary automatically.

## Terminal 2 — run the gateway

Open a second PowerShell window:

```powershell
cd D:\nisar\nisar_pro\sar-gateway
$env:LOCAL_MODE = "true"
$env:RUST_LOG = "info"
cargo run
```

Keep this window open. Check that it is working:

```powershell
Invoke-WebRequest http://127.0.0.1:3000/jobs
```

The gateway serves the API and local result files at:

- API: <http://127.0.0.1:3000>
- Results: <http://127.0.0.1:3000/results>

## Terminal 3 — run the dashboard

Open a third PowerShell window:

```powershell
cd D:\nisar\nisar_pro\sar-dashboard-v3
npm.cmd install
npm.cmd run dev
```

Run `npm.cmd install` only the first time, or after `package.json` changes. Open:

<http://127.0.0.1:5173/>

## Correct startup order

Start Terminal 1 first if the processor has not been built. Then start Terminal 2, then Terminal 3. Refresh the browser after both the gateway and dashboard show that they are ready.

## Common Windows problems

### `npm` is not recognized

First check whether Node.js is visible:

```powershell
Get-Command node,npm,npm.cmd -ErrorAction SilentlyContinue
```

If Node.js is installed but the current terminal cannot find it, this temporary fix adds the Node.js folder to the current PowerShell session:

```powershell
$nodeHome = "$env:LOCALAPPDATA\Zed\node\node-v24.11.0-win-x64"
$env:Path = "$nodeHome;$env:Path"
node --version
npm.cmd --version
```

Then run:

```powershell
npm.cmd install
npm.cmd run dev
```

The temporary fix lasts only for that PowerShell window. For a permanent setup, install the current Node.js LTS version from <https://nodejs.org>, select **Add to PATH** during installation, then close and reopen PowerShell. If `npm.cmd` is still not recognized after that, restart Windows or add the Node.js installation directory to the user `PATH` environment variable.

### Dashboard says gateway offline

Make sure Terminal 2 is still running and test:

```powershell
Invoke-WebRequest http://127.0.0.1:3000/jobs
```

### Gateway cannot find the processor

Build the science processor from the repository root location:

```powershell
cd D:\nisar\nisar_pro\sar_science_processor
cargo build
```

Then restart the gateway.

### Port already in use

Find the process using a port:

```powershell
Get-NetTCPConnection -LocalPort 3000,5173 -ErrorAction SilentlyContinue
```

Close the old terminal running the application before starting it again.

## Stop the application

In each running terminal press `Ctrl+C`. Stop the dashboard and gateway when finished. The processor exits automatically after each submitted job.

## Notes from real-data verification

These facts were confirmed against the actual gateway, processor, and a NASA/ASF search on a real session:

- **Only the Flood (`science`) profile runs out of the box.** The standard `sar_processor` binary is not built on a fresh clone, so `Infrastructure`/`Standard RDA` jobs fail with `SPAWN_FAILED` until you build it (see Terminal 1 above). The flood pipeline uses `sar_science_processor` and works with just that one build.
- **Real product sizes vs. RAM.** GCOV files are **8–10 GB** and RSLC files are **25–30 GB**. The flood GCOV path now reads only the HDF5 chunks under the crop (`windowed.rs`), so RAM tracks the AOI size, not the granule size. The InSAR path still applies its crop *after* a full dataset read in several places, so that mode needs memory proportional to the product; an 8 GB laptop is fine for crop-sized flood runs but not full-scene InSAR.
- **NASA/ASF search needs no login.** `GET /search/nisar` searches anonymously; only the *download* step requires Earthdata credentials (`EARTHDATA_USERNAME`/`EARTHDATA_PASSWORD` or a token in `sar-gateway/.env`). `GET /asf/auth-status` reports whether auth is configured. ESA `GET /search` requires `ESA_USERNAME`/`ESA_PASSWORD` even to search.

The NISAR search defaults to L2 GCOV only, which prevents the flood workflow
from accidentally selecting a much larger RSLC product. For the Bihar
reference stack, ASF supports the exact Track 098 / Frame 014 filters:

```text
http://127.0.0.1:3000/search/nisar?bbox=86.3946,25.4098,86.6054,25.5902&processing_level=GCOV&relative_orbit=98&asfframe=14&start_date=2026-07-01T00:00:00Z&end_date=2026-10-30T23:59:59Z
```

Granules are typically several GB each. Downloads are written under
`sar-gateway/data/` through a temporary `.part` file and renamed only after a
complete transfer, so interrupted downloads can be retried safely. Never
commit Earthdata tokens.
- **Job status serialization:** a failed job comes back as `{"status": {"failed": "<reason>"}}` (an object, not a string). The dashboard normalizes this; any new API client must do the same.
- **Cancelling a job** via `POST /jobs/:id/cancel` kills the child process and emits `[SYSTEM] PROCESS_CANCELLED` in the SSE stream (timeouts emit `PROCESS_TIMEOUT`).
- **Flood artifacts** land in `results/` as `<id>_flood.png`, `<id>_flood.json`, `<id>_flood.geo.json`, `<id>_flood_baseline.png`, `<id>_flood_active.png`, and `<id>_flood_class.tif`, served at `/results/*`. The gateway advertises the four named paths in `GET /jobs/:id`; the `.tif` is written by the processor but not advertised in the job response.
