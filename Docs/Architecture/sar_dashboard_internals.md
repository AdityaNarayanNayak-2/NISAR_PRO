# Dashboard internals (`/app`)

Location: `sar-dashboard-v3/src/pages/app/`. React 19, Vite, MapLibre GL, zustand, plain CSS.
Design rules and the reasons behind them: `Docs/Dashboard_Design_Spec.md` §13 (look) and §12 (content).

## Layout

The map fills the screen. Everything else floats on it as obsidian glass with a 20 px gap
(`workspace.css`, `.ws`). `--L`, `--R`, `--B` mark the free map area between the panels; map
controls, the timeline and the log stay inside it, and camera fits use it too
(`freePadding()` in `map/mapHandle.js`).

```
┌ /// NISAR Pro · Flood ▾ · Live Map  Time Series  Regions  Reports  Processing  Evaluation Hub ┐  ┌ ⌕ place or lat, lon · ● Online ┐  ┌ right panel 380 px ┐
┌ System status ─────────┐  ┌ Layers ┐                                  zoom, basemap         │ tab content        │
│ Sensor · Runs          │                                                                    │                    │
│ Scenes · Earthdata     │                                                                    │                    │
│ Flood extent 1,166.21  │                                                                    │                    │
│ ╲__ sparkline          │                                                                    │                    │
├ Runs ─────── All runs ─┤                    replay pill                                     │                    │
│ [L 31 Aug→12 Sep ↗] …  │        ┌ timeline: ●26 Jul ──L── ●31 Aug ═L/S═ ●12 Sep ──L── ●18 Oct ┐                    │
```

- Keys: `1`–`6` tabs, `[` left stack, `]` right panel, `L` log, `N` processing, `Ctrl+Shift+F`
  search, `Esc` cancels map picking or selection.
- Below 1480 px the command pill moves to the top right of the free map. Below 1024 px the tabs
  become a select, the left stack starts hidden and the panel floats over the map. Below 768 px the
  panel is a bottom sheet.

## Who owns what (no fact twice)

| Place | Shows |
|---|---|
| Left: Flood extent | flood extent of the open run (or the latest) in km² and acres, change from the previous period on the frame (computed), the caveat line, water loss, area count, sparkline of the frame's periods |
| Left: System status | sensor bands with runs, finished runs, scenes on disk, Earthdata login (compact list) |
| Left: Runs | latest four runs as rows; "All runs" opens every run grouped by track·frame (delete, cancel) |
| Command pill | place search (`/geocode/search`) or lat, lon; engine state |
| Live Map | no run: what NISAR Pro does, how a run works. Run: "Send teams first" (top 5 areas, share held by the 10 largest), copy summary, "in this view" / drawn-area sum (whole scene in view: no repeat of the total), confidence split, notes and warnings |
| Time Series | since the last period (flood extent, water loss, stable water: before, now, change, period lengths), flood extent per period (chart), periods as rows, water on each date |
| Regions | flood extent by district (largest areas named until 95% of the summed area or 250 areas, by centre, OSM districts, share named shown), 10 largest areas, areas by size |
| Reports | situation report (page 2: A4 map with lat/lon grid, scale bar, pins, district table), CSV, KML and GPX waypoints, files, quality checks (7 checks from report fields, no single score), class table, threshold ruler and method, product facts |
| Processing | scenes (this computer or NASA catalog), area, polarization, all detection settings with a live dB ruler, optional GUNW and water mask, exact command; progress of a running run |
| Evaluation Hub | Sentinel-2 agreement (InGARSS study) when track/frame/dates match; else an empty state |
| Timeline (map) | acquisitions of the frame; runs as spans, L lane and S lane; click to open; expected next pass (last date + 12 days, labelled expected, not a NASA schedule) |
| Map | numbered pins on the 10 largest areas; click a pin or area for the area card (place, km² and acres, confidence, centre in decimal, DMS and UTM); pass chip (date, UTC, age, amber after 7 days); legend presets All / Flood only / Water loss only; buttons for satellite and place names |

## Files

```
pages/app/
├── Workspace.jsx          shell, keyboard shortcuts, starts the store
├── ReportPage.jsx         /app/report/:id — A4 situation report (print / PDF), report.css
├── InsarPaused.jsx        /app/insar
├── workspace.css          tokens + all workspace styles
├── shell/                 NavPill, CommandBar, LeftStack, RunSwitcher, LogDrawer, Toasts
├── inspector/             Inspector (tab switch), Views (one per tab), Home, Brief and Analysis
│                          (sections used by Views), useRunAreas, TrendChart, Validation
├── form/                  ProcessPanel, CatalogSearch, validateRun.js
├── map/                   MapView (only file that adds map layers and pins), AreaCard, MapControls, Timeline, mapHandle.js
├── ui/                    Area, DbRuler, Icon, Menu, Dialog
├── lib/
│   ├── gateway.js         data source (local / demo / offline), fetch helpers
│   ├── report.js          parses <id>_flood.json; class display colours and PNG key colours
│   ├── regions.js         region list, hotspots, sums in a box, size histogram, periods, CSV
│   ├── places.js          nearest place (gateway /geocode/reverse, or demo data)
│   ├── validation.js      matches a run to the Sentinel-2 study tests
│   ├── coords.js          decimal, DMS and UTM (WGS84) for field teams
│   └── runInfo.js, units.js, classRaster.js
└── stores/
    ├── useRunStore.js     runs, open run, view, reports, regions, scenes, logs (SSE), toasts
    └── useMapStore.js     replay, layers, selection, view bounds, drawn area, map picking, preview outline
```

## Data sources

| Mode | When | Data |
|---|---|---|
| `local` | `GET /jobs/health-ping` returns `{status: "ok"}` | live gateway |
| `demo` | public site, or no gateway and `/demo/runs.json` exists | `public/demo/`, read-only |
| `offline` | neither | nothing; Retry |

Demo data: `python3 sar-dashboard-v3/scripts/build_demo_data.py` with the gateway running. It takes
only full-scene runs without setting overrides, converts images to WebP, and stores OpenStreetMap
names for each run's ten largest areas.

## Gateway contract

- `GET /jobs` → runs, newest first: `id`, `status`, `created_at`, `bbox` (overlay bounds),
  `summary` (band, dates, crop, areas in km² and acres), `artifacts`, `fingerprint`, `request`.
- `POST /jobs` → `{job_id, reused}`; 400 `{error}` on a bad request. Accepts `polarization`,
  `gunw_file`, `water_mask` and every detection setting. Identical request → existing run unless
  `force: true`.
- `GET /jobs/:id/logs` → SSE. Saved runs replay `run.log` (or `crash_journal.log` for old folders).
- `GET /scenes` → GCOV files in `NISAR_DATA_DIRS`, or `sar-gateway/data`, `~/nisar_data`,
  `~/Desktop/nisar_data`, `~/Downloads`.
- `GET /search/nisar?bbox=&start_date=&end_date=&relative_orbit=&asfframe=` → ASF catalog results.
- `GET /asf/download-stream?granule_id=&url=` → SSE progress; file saved in `sar-gateway/data/`.
- `GET /asf/auth-status` → whether an Earthdata token or login is set.
- `GET /geocode/reverse?lat=&lon=` → `{name, area, country}` from Nominatim, cached on disk.
- `GET /geocode/search?q=` → up to 5 `{label, lat, lon, bbox}` from Nominatim, cached in memory.
- `DELETE /jobs/:id`, `POST /jobs/:id/cancel`.

## Map rendering

- Basemap: Esri World Imagery as a MapLibre raster with `raster-saturation -0.72`,
  `raster-brightness-max 0.55`, `raster-contrast 0.22`; Esri boundaries and places on top at 0.65.
  The globe button hides the imagery (plain dark). Run layers sit between the two.
- The engine writes the PNGs on Web Mercator and reports their bounds in `georef_bbox`.
  The GeoTIFF stays on UTM. Radar previews are full 80 m resolution (grey + alpha).
- Image layers use `nearest` resampling from zoom 10 (sharp pixels) and `linear` below.
- `classRaster.js` reads each class back from the engine's key colour (`FLOOD_PNG_COLORS`) and
  repaints only the switched-on classes in the display colours (`CLASSES`).
- Region polygons are invisible hit areas with hover and selection outlines, plus class-coloured
  edges from zoom 9 so flood areas read like crisp polygons. Hotspot rows set the same hover state.
- Shapes source: crop box, catalog footprint, drawn area and box being drawn, all white dashed.

## Rules

- Every area through `<Area>` or `formatArea` (km² and acres from one value).
- No number that is not in the run's files. Sums and shares are labelled "computed".
- `threshold_db` is Otsu capped at the minimum change; the seed used is `min(seed, threshold_db)`.
- Sentinel-2 numbers are "agreement", never "accuracy", and only for matching study dates.
