# SAR Dashboard Internals

> Source: `sar-dashboard-v3/` — React SPA with Leaflet maps, built with Vite.

## Overview
The dashboard is a static Single Page Application (SPA) deployed to GitLab Pages. It communicates with the user's local `sar-gateway` at `http://localhost:3000` via REST + Server-Sent Events. It never uploads raw data — the user's SAR files stay strictly on their machine.

## Key Files
```
src/
├── App.jsx                         → Router + ConnectionSetup gatekeeper
├── main.jsx                        → ReactDOM entry point
├── config/
│   └── api.js                      → Gateway URL config (localStorage-backed)
├── components/
│   ├── ConnectionSetup.jsx         → Health-check ping to localhost:3000
│   ├── DataVisualization.jsx       → Leaflet map + ImageOverlay
│   ├── Hero.jsx                    → Landing page hero section
│   ├── Features.jsx                → Feature cards grid
│   ├── Navbar.jsx                  → Top navigation bar
│   ├── Footer.jsx                  → Footer with links
│   ├── ProcessingPipeline.jsx      → Animated pipeline visualization
│   ├── NisarCatalogSearch.jsx      → NASA ASF search integration
│   ├── Comparison.jsx              → Before/after image comparison
│   └── LiveFeed.jsx                → Simulated data feed
└── pages/
    ├── app/
    │   └── AppDashboard.jsx        → THE MAIN OPERATIONAL DASHBOARD (~1000 lines)
    └── DocsPage.jsx                → In-app documentation viewer
```

## Application Flow
```
User visits website (GitLab Pages)
    │
    ├─ / (Landing page) → Hero + Features + ProcessingPipeline
    │
    └─ /app → <ConnectionSetup>
                │
                ├─ Pings GET localhost:3000/search → FAIL → shows "Start your backend" message
                │
                └─ Pings → SUCCESS → <AppDashboard>
                     │
                     ├─ Step 1: Select Data Source
                     │   ├─ "Local File" tab → text input for absolute path
                     │   └─ "NASA Catalog" tab → lat/lon search via /search/nisar
                     │
                     ├─ Step 2: Configure Pipeline
                     │   └─ Toggle switches for InSAR, CFAR, PolSAR
                     │
                     ├─ Step 3: Click "Initiate Orbital Scan"
                     │   └─ POST /jobs { input_file, pipeline }
                     │       → Receives { job_id: "sar-a1b2c3d4" }
                     │
                     ├─ Step 4: Live Terminal (SSE)
                     │   └─ new EventSource("/jobs/sar-a1b2c3d4/logs")
                     │       → Lines streamed into black terminal UI
                     │
                     └─ Step 5: Map Overlay
                         └─ GET /jobs/sar-a1b2c3d4 → { status: "completed", bbox, output_path }
                             → Leaflet ImageOverlay at bbox coordinates
```

## `config/api.js` — The API Bridge
```javascript
const api = (path) => {
    const base = localStorage.getItem('gateway_url') || 'http://localhost:3000';
    return `${base}${path}`;
};
```
All fetch calls use `api('/jobs')` instead of hardcoding localhost. This makes it trivial to switch between local and cloud backends.

## `DataVisualization.jsx` — The Map
Uses `react-leaflet` to render:
- **Base layers:** Satellite (Esri), Dark Mode (CartoDB), Street (OpenStreetMap).
- **SAR Overlay:** When processing completes, the gateway returns a `bbox` (south/north/west/east) and an `output_path`. The component uses Leaflet's `<ImageOverlay>` to drape the generated PNG precisely within those geographic bounds.

## `AppDashboard.jsx` — The God Component
This 1,000+ line file is the operational heart. Key state variables:
- `localFilePath` — User's selected HDF5 file path.
- `dataMode` — "local" or "catalog".
- `jobId` — Current processing job UUID.
- `jobStatus` — Idle / Running / Completed / Failed.
- `logs[]` — Array of terminal log lines from SSE.
- `metadata` — Satellite metadata extracted from filename parsing.

## Build & Deployment
```bash
# Local development
cd sar-dashboard-v3
npm install
npm run dev          # → http://localhost:5173

# Production (GitLab Pages)
GITLAB_PAGES=true npm run build   # Sets base path to /nisar_pro/
# Output: dist/ → deployed by GitLab CI pages job
```

The Vite config detects `GITLAB_PAGES=true` and sets the base path to `/nisar_pro/` for GitLab Pages hosting.
