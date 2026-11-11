# NISAR Pro website and dashboard: audit and redesign plan

Date: 11 Nov 2026. Scope: `sar-dashboard-v3/` (marketing site, docs, `/app` dashboard) and its
deployment on Cloudflare Pages (`main.nisar-pro.pages.dev`).

Goal: a production site that looks and reads at the level of ICEYE or Vantor, and a dashboard
that shows only true numbers.

---

## 1. What is wrong today

### 1.1 Seen on the live site (headless Chrome, 1440×900 and 390×844)

| # | Problem | Where |
|---|---|---|
| L1 | The first screen of the home page is empty. A 700vh scroll story sits above the hero, so the headline only appears after about 4 screens of scrolling on desktop. Below the hero there are more screens of empty dark space. | `/`, `StoryScroll.jsx`, `story-scroll.css` |
| L2 | The live site proxies `/jobs`, `/results`, `/search`, `/asf` to an ephemeral `trycloudflare.com` tunnel that is dead. API calls return HTML and the console shows `Unexpected token '<'`. | `public/_redirects`, `src/config/api.js:6` |
| L3 | The dashboard says "Online" and "Gateway ready" while no gateway exists. | `useGatewayStore.js:23`, `WorkspaceSidebar.jsx:31` |
| L4 | The public demo has no data: "No runs recorded", Regions and Reports are empty. A visitor never sees a real result. | `/app` |
| L5 | `/app` opens in INFRASTRUCTURE mode, which is paused. Its START PROCESSING can never succeed (gateway rejects it). | `AppDashboard.jsx`, `InfrastructurePanel.jsx:484` |
| L6 | Header pieces overlap: the logo sits on a second "NI..." label, the search pill sits on the Configure panel, "Hide" sits on the "Analysis Report" tab. | TopBar, FloodConfigPanel |
| L7 | Mobile dashboard is unusable: panels are cut off, the bottom bar overlaps. | `/app` at 390 px |
| L8 | HUD shows `LAT 0.0000° LON 0.0000°` while the map is on Bihar. Version label says v0.4.0, the release is 1.0.0. | CoordinatesHud, TopBar |
| L9 | Time Series header says "Track 014, Frame 4005". The data is Track 98, Frame 14. | `TimeSeriesView.jsx:166` |

### 1.2 Numbers that are wrong or invented (must be fixed before anything else)

These break the project rule "never show a number that is not in a result file".

- **ProcessingView** is almost entirely hardcoded: 43.2 s, "~50× faster", 1,157,414,400 pixels
  (true: 1,157,255,424), "< 1.79 GB" (true: 1.87–2.32 GB), 512×512 chunks (true: 1,024-row strips),
  "100% operational parity", ENL 14.8, incidence 37.2–44.8°, "descending" (data is ascending),
  4×4 from 20 m (true: 8×8 from 10 m), Refined Lee 7×7 (true: median 3×3).
- **TimeSeriesView**: hydrograph 2,740 / 3,979 / 5,152 / 2,502 km² mixes S-band into an L-band
  series; persistence matrix (718.6, 454.9 km²) is invented; acre values don't match km²;
  claims "100% loss of Kharif paddy".
- **ReportsEvaluationView**: "1,238.3 km² (305,994 acres)", "Parity 100.0%", fixed
  Track/Frame/band/erosion regardless of run.
- **RunHistorySidebar / AppDashboard**: labels "+1,192.4 km²" (S) and "+1,173.6 km²" (L)
  contradict the canonical 1,174.89 and 1,137.14 km²; runs are recognised by id substrings.
- **AnalysisReportModal**: "Geom Accuracy < 5 m RMS", "ISRO / NASA JPL" as organisation,
  "STATUS: CALIBRATED".
- **WorkspaceSidebar**: every value is static ("4 scenes", "Operational parity 100.0%").
- **InfrastructurePanel**: "λ = 23.8 cm", "289 rejected", invented "% stability" score.
- **Fallbacks** that invent values: Otsu −3.0, elapsed 42 s, `~0.10 ac`, "(20 m)" pixels,
  Bihar bounds for any result without a bbox.
- **Wording**: "Flood Breach Zones", "Water Gain (Flood)", "FLOOD EVENT REPLAY",
  "acres submerged" → "newly detected water".
- **Dual units missing** in FloodInsightPanel, TimeSeriesView, ReportsEvaluationView,
  AnalysisReportModal, HUD, polygon popup.

### 1.3 Logic bugs (from code review)

High:
1. `AppDashboard.jsx:201/453`: `job_id` is re-read from the URL every render, so the preload
   re-runs and you can't leave a result. Configure & Run can't stay open.
2. `AppDashboard.jsx:325`: a slow GeoJSON from result A lands on result B (no request guard).
3. `AppDashboard.jsx:545`: a new run inherits the old run's PNG, bounds and replay paths.
4. `ReportsEvaluationView.jsx:100`: reads `totalSceneKm2`, which doesn't exist → "NaN%",
   "Infinity%", negative dry land.
5. `ReportsEvaluationView`/`TimeSeriesView`: `clusterCount`, `highConfPixels` don't exist →
   always 0.
6. `FloodInsightPanel.jsx:55`: reads `physical_gates`, real key is `rule_diagnostics`, so the
   Evidence tab never renders.

Medium:
- Percentages use the whole footprint (115,725 km²) instead of the valid area (sum of classes).
- Baseline water = class 1 only; should be class 1 + class 5.
- Otsu (−3.26) shown as the "effective threshold"; the real seed (−5.0) is never shown.
- Two seed/growth sliders with different ranges; nothing keeps seed < growth; S-band defaults
  (−4.8, −2.2) can't be set with step 0.5.
- Preset paths hardcoded to `/home/aditya/Desktop/nisar_data/...`.
- EventSources never closed on unmount; `onerror` kills auto-reconnect.
- `POST /jobs` response not checked → `jobs["undefined"]`.
- Replay marked available even when files are missing → no raster at all.
- "Permanent water" toggle hides the whole PNG; hover-out restores a hidden polygon.
- Map never flies to a selected scene (passes `LatLngBounds` where an array is expected).
- `fitBounds` re-runs on every render (new array each time) → the map snaps back.
- Export links not checked; DELETE reloads even on failure.

Controls that do nothing: SettingsView (whole view, still has "Kundra Odisha", C-band,
EPSG:32644), multilook select, polarization "dual/span", speckle filter, recession threshold,
"live histogram" copy, Ctrl+Shift+F shortcut.

Accessibility: clickable `div`s everywhere (mission cards, layer toggles, run cards), modals
without `role="dialog"`, Escape or focus trap, hidden checkboxes, unlabelled icon buttons.

Code health: `AppDashboard.jsx` is 1,784 lines; ~20 unused imports; duplicated `startJob`
logic; two ConnectionModal instances; two health checks; dead "legacy" Upper Kolab/Kundra
content in the landing page.

---

## 2. Design direction

What ICEYE and Vantor do that we don't:

- **The imagery is the hero.** Full-bleed real radar/map pictures, little UI chrome, no fake
  terminals. We have strong real pictures (L/S/L+S maps, the 4-date time-lapse, the video).
- **One confident sentence per screen.** Large clean sans headline, a short line under it,
  one action. No paragraphs of method text on the home page.
- **Calm, restrained colour.** Near-black and off-white, one accent. Data colours live only on
  maps and charts.
- **Proof, not adjectives.** Numbers with sources, a case study, a clear "how it works".
- **Product looks like a product.** A clean map workspace, not a sci-fi HUD.

### 2.1 Design system (new `src/design/tokens.css`)

| Token | Value | Use |
|---|---|---|
| `--ink-950` | `#07090d` | page background (dark sections) |
| `--ink-900` | `#0d1117` | panels |
| `--ink-700` | `#1f2733` | borders, dividers |
| `--paper` | `#f4f2ee` | light sections (case study, docs) |
| `--text-hi` / `--text-lo` | `#f5f7fa` / `#8b97a7` | text on dark |
| `--accent` | `#38bdf8` | links, primary button, focus ring (one accent only) |
| Data: stable water / new high / new medium / loss / land | `#00e5ff` / `#ef4444` / `#f97316` / `#f59e0b` / `#64748b` | maps and charts only; matches CLAUDE.md §3 |

- Type: **Inter Tight** for headlines (600–700, tight tracking), **Inter** for body,
  **JetBrains Mono** only for numbers, coordinates and code. Drop IBM Plex Mono from headings
  and labels.
- Scale: 72/56/40/28/20/16/14 px; 8 px spacing grid; 12-column layout, 1,240 px max.
- Radius 10 px for cards, 999 px for pills. One shadow level. Motion: 200–300 ms fades and
  slides only; respect `prefers-reduced-motion`.
- Components (one file each): Button, Pill, Card, Stat (value + unit + acres + source),
  Tabs, Dialog (accessible), Toast, Slider (with min/max guard), Legend, MapFrame.
- Area numbers always through one `<Area km2={…} />` component that prints km² and acres from
  the same value, so the dual-unit rule can't be broken by hand.

### 2.2 Site map

| Page | Content |
|---|---|
| `/` Home | Hero: full-bleed L+S map (or the intro video, muted loop) with one line: "Radar water mapping that runs on your own computer." Two buttons: "Open the live demo", "Download". Then 4 short sections: what it does (3 cards), the Bihar result (L / S / L+S with numbers and acres), how it works (strip → 80 m → 7 stages, one diagram), download strip. |
| `/case/bihar-2026` | The InGARSS study as an editorial page: data, method, 3 maps, the season time-lapse, Sentinel-2 check, limits, links to the note and package. Light background, like a report. |
| `/platform` | Engine, gateway, dashboard; benchmarks (44–65 s, 1.87–2.32 GB); local-first data; what is experimental (InSAR). |
| `/download` | Windows installer, portable zip, Linux one-liner, build from source, system requirements. |
| `/docs` | Keep the existing docs reader, restyled; fix the sidebar on mobile. |
| `/app` | The dashboard (below). |
| `/about` | The 2-year story, team, contact, licence. |

Remove: the 700vh StoryScroll, the globe textures (`earth*.jpg`, 1.4 MB), legacy Upper
Kolab/Kundra content, the hero video HEAD probe.

### 2.3 Dashboard layout

```
┌ TopBar: logo · mode (Water · InSAR [experimental]) · Map | Results | Compare | Run · status ┐
│ Left rail (collapsible, 320 px)       │ Map (MapLibre GL, full height)      │ Right panel     │
│  - Scenes / saved runs                │  - class raster + legend            │  (context:      │
│  - Layers (with real toggles)         │  - date scrubber for replay         │   result card,  │
│                                       │  - coordinate readout (real)        │   run form)     │
└───────────────────────────────────────┴─────────────────────────────────────┴─────────────────┘
```

- **Two data sources behind one interface**:
  - *Demo mode* (website, no gateway): static, read-only data from the InGARSS package,
    shipped in `public/demo/` (manifest JSON + map tiles + small GeoJSON). Clear "Demo, read-only"
    badge; Run tab explains how to download the app.
  - *Local mode* (installed app, gateway on 127.0.0.1:3000): everything live.
  - Mode is detected by a real `GET /jobs/health-ping` with `res.ok` and a JSON check.
- **Map engine: move from Leaflet to MapLibre GL.** Smooth zoom, vector dark basemap,
  raster tiles for the class maps, side-by-side swipe for L vs S vs L+S. This is the biggest
  single visual upgrade toward the ICEYE look.
- Demo rasters: convert the 5 class GeoTIFFs to web tiles (PMTiles, one file each,
  served by Cloudflare Pages with range requests). GeoJSON is 1.3–6.6 MB per run, so simplify
  it (tolerance ≈ 40 m) for the demo or show polygons only on click.
- Views:
  - **Map**: result raster, legend, replay scrubber (baseline → active → detected).
  - **Results**: class table (km² + acres, % of valid area), method card with the real
    thresholds (seed, growth, Otsu reported only), rule diagnostics for fused runs, exports.
  - **Compare**: L / S / L+S swipe, F1 agreement table with "agreement with Sentinel-2 on
    cloud-free pixels" label, rule on/off table.
  - **Time series**: real per-date water from the 4 L-band runs only.
  - **Run** (local mode): one form; only controls the processor really reads; seed ≤ growth
    enforced; presets from gateway config, not hardcoded paths.
- InSAR mode: behind an "Experimental" toggle, off by default, with a note that it is paused.
- Mobile: map full screen with a bottom sheet for panels; no fixed bottom strip.

---

## 3. Technical changes

| Area | Change |
|---|---|
| Language | Move `src/pages/app/**` to TypeScript, with types for the flood report JSON. Type errors would have caught the wrong-field bugs (1.3 #4–6). |
| Structure | Split `AppDashboard.jsx` into `useResults`, `useJobRunner` (one `startJob`, SSE with ref cleanup), `MapView`, `ResultPanel`, `RunPanel`. Target < 300 lines per file. |
| Data | One `parseFloodReport()` with tests against the real JSONs in `ingarss_2026/results`. No fallback numbers: missing value → "—". |
| State | Keep zustand. `job_id` read once from the URL. Every fetch has an AbortController and checks `res.ok`. |
| Styling | Keep plain CSS with tokens (CSS modules per component). Remove `App.css`, `index.css`, `design-system.css`, `app-theme.css` duplicates after migration. |
| Map | `maplibre-gl` + `pmtiles`. Basemap: free Protomaps or OpenFreeMap dark style (no API key). |
| Deploy | Remove the tunnel lines from `_redirects` and `api.js`. Website = demo mode only. Gateway URL only via `VITE_GATEWAY_URL` for self-hosting. |
| Quality gates (CI) | `eslint` (0 errors), `tsc`, Vitest unit tests for report parsing and unit conversion, Playwright smoke tests + screenshots at 1440 and 390 px, Lighthouse ≥ 90 (performance, accessibility, SEO). |
| Production | Custom domain, security headers (`_headers`: CSP, HSTS, X-Content-Type-Options, Referrer-Policy), cache headers for tiles, Open Graph image and meta tags per page, `sitemap.xml`, `robots.txt`, 404 page, privacy-friendly analytics (Cloudflare Web Analytics, no cookies). |
| Performance | LandingPage chunk is 330 kB (233 kB gzip): drop the canvas story and globe textures; lazy-load the map; WebP/AVIF images; target < 150 kB JS on the home page. |

---

## 4. Phases

| Phase | Work | Size |
|---|---|---|
| **0. Truth fixes** (do first, ship on the current design) | Remove the tunnel from `_redirects`/`api.js`; real health check; remove or replace every number in 1.2; fix the wrong field names (1.3 #4–6); dual units; wording; default mode = Water; hide InSAR START PROCESSING. | 1–2 days |
| **1. Foundation** | Design tokens, fonts, components, `<Area>`; TypeScript for the app; report types and parser tests; CI gates. | 2–3 days |
| **2. Marketing site** | New Home, Case study, Platform, Download, About; restyle Docs; remove StoryScroll and legacy content; OG images, sitemap. | 3–4 days |
| **3. Demo data** | Script that builds `public/demo/` from `ingarss_2026/results` (PMTiles, simplified GeoJSON, manifest JSON with numbers read from the result JSONs). | 1–2 days |
| **4. Dashboard** | MapLibre map; new layout; Map / Results / Compare / Time series / Run views; split AppDashboard; fix all 1.3 bugs; mobile bottom sheet; accessible dialogs. | 5–7 days |
| **5. Production** | Custom domain, headers, analytics, Lighthouse, Playwright screenshots, cross-browser check (Chrome, Firefox, Safari, Edge), launch. | 1–2 days |

Each phase ends with a build, screenshots at 1440 and 390 px, and a check that every number
on screen is in a result file.

## 5. Decisions needed

1. Domain: keep `nisar-pro.pages.dev` or buy one (e.g. `nisarpro.dev`)?
2. MapLibre instead of Leaflet: recommended, about 1 extra day.
3. TypeScript for the dashboard: recommended.
4. Keep the InSAR/infrastructure mode visible as "Experimental", or hide it completely until
   it works?
5. Light sections (case study, docs) or dark everywhere? Recommended: dark home and app,
   light case study and docs, like ICEYE.
