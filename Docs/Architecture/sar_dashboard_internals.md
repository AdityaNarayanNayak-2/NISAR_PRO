# React Dashboard Component Internals & Architecture (Phase 1 & Phase 2)

> Location: `sar-dashboard-v3/` — High-performance tactical control plane built with React 19, Vite, Leaflet, Zustand, Framer Motion, and Vanilla CSS.

This document serves as the comprehensive architectural and developer reference for the NISAR Pro web application. Following the Phase 1 and Phase 2 refactoring, the dashboard transitioned from an unwieldy single-file state monolith into a decoupled, store-driven, multi-profile command center.

---

## 1. Directory Structure & File Map

```
sar-dashboard-v3/src/
├── main.jsx                       → React DOM bootstrap & global stylesheet mounting
├── App.jsx                        → Route orchestrator (Home, /app dashboard, /preview)
├── config/
│   └── api.js                     → Centralized API URL resolver (configurable backend host/port)
├── components/
│   ├── Navbar.jsx                 → Public landing page navigation bar
│   └── ProcessingPipeline.jsx     → Animated terminal log stream visualizer
└── pages/
    └── app/
        ├── AppDashboard.jsx       → Central orchestrator, Leaflet map view & layout grid
        ├── InfrastructurePanel.jsx→ Dam stability, PS-InSAR telemetry & sensor context (Gold Theme)
        ├── constants.js           → Typography (`MONO`, `SANS`), profile tokens, and tactical colors (`C`, `TM`)
        ├── helpers.js             → SAR filename parser, metric formatters, severity colors
        │
        ├── stores/                → Zustand Stores (Phase 1: State Unification)
        │   ├── useGatewayStore.js → Gateway online health checks & ping intervals
        │   ├── useMapStore.js     → Map coordinates, bounds, viewingResult, layer opacity & toggles
        │   └── useJobStore.js     → Job queue, live SSE logs, terminal visibility, pipeline stages
        │
        ├── layout/                → Modular Tactical UI Components (Phases 1 & 2)
        │   ├── TopBar.jsx         → Profile switcher, metadata ribbon, live UTC clock, report trigger
        │   ├── BottomStrip.jsx    → Processing summary strip (flood detection algorithm & metrics)
        │   ├── CoordinatesHud.jsx → Floating cursor latitude/longitude & radar metadata pill
        │   ├── TerminalDrawer.jsx → Slide-up terminal drawer with live pulse and log parsing
        │   ├── ProcessingProgressBar.jsx → Real-time 5-stage pipeline progress bar (Phase 2A)
        │   ├── MapLayerControls.jsx      → Floating opacity slider & 4-tier classification toggles (Phase 2B)
        │   └── RunHistorySidebar.jsx     → Collapsible recent runs sidebar with instant map loading (Phase 2C)
        │
        ├── hooks/                 → Custom React Hooks (Phase 2D)
        │   └── useKeyboardShortcuts.js   → Tactical hotkeys (T, Esc, N, R, 1-5) with input guards
        │
        └── flood/                 → Flood & Inundation Subsystem
            ├── FloodConfigPanel.jsx   → File inputs, geographic crop presets, threshold sliders
            ├── FloodInsightPanel.jsx  → Flood analytics, area breakdowns, and polygon inspection
            ├── AnalysisReportModal.jsx→ Full-screen multi-page mission report generator
            ├── WorkspaceSidebar.jsx   → 5-tab workspace navigation (Map, TimeSeries, Regions, etc.)
            ├── TimeSeriesView.jsx     → Inundation progression charts over time
            ├── RegionsView.jsx        → Tabular polygon explorer sorted by confidence and acreage
            ├── ProcessingView.jsx     → Algorithm parameter audit & pipeline telemetry
            ├── DataExportsView.jsx    → GeoJSON, GeoTIFF, and report download manager
            ├── SettingsView.jsx       → Algorithm tuning & baseline configuration
            └── floodReportHelpers.js  → Robust JSON report parsing and metric calculations
```

---

## 2. Store-Driven Architecture (Phase 1 Decomposition)

Prior to Phase 1, `AppDashboard.jsx` was a 1,620-line monolith containing over 50 individual `useState` declarations. State is now cleanly segregated across 3 specialized Zustand stores, decoupling state management from JSX rendering:

```
                          ┌───────────────────────┐
                          │   AppDashboard.jsx    │
                          │  (Layout Coordinator) │
                          └───────────┬───────────┘
                                      │
          ┌───────────────────────────┼───────────────────────────┐
          ▼                           ▼                           ▼
┌───────────────────┐       ┌───────────────────┐       ┌───────────────────┐
│  useGatewayStore  │       │    useMapStore    │       │    useJobStore    │
├───────────────────┤       ├───────────────────┤       ├───────────────────┤
│ • gatewayOnline   │       │ • mouseCoords     │       │ • jobs (map)      │
│ • checkHealth()   │       │ • mapBounds       │       │ • activeJobId     │
│                   │       │ • flyToCenter     │       │ • logs (by jobId) │
│                   │       │ • drawnAoi        │       │ • activeJobStage  │
│                   │       │ • viewingResult   │       │ • terminalOpen    │
│                   │       │ • layerOpacity    │       │ • elapsed timers  │
│                   │       │ • showPermWater   │       │ • appendLog()     │
│                   │       │ • showHighConf    │       │                   │
│                   │       │ • showMedConf     │       │                   │
│                   │       │ • showLowConf     │       │                   │
└───────────────────┘       └───────────────────┘       └───────────────────┘
```

### 2.1. Store Descriptions
* **`useGatewayStore`**: Continuously monitors backend API health (`/health` or `/status`), setting the operational status pill in the TopBar and HUD.
* **`useMapStore`**: Single source of truth for GIS operations. Tracks crosshair coordinates, bounding boxes, active raster overlay payloads (`viewingResult`), layer opacity, and individual confidence classification layer toggles.
* **`useJobStore`**: Manages the life cycle of analysis tasks. Receives real-time streaming output via Server-Sent Events (SSE), parses stage transitions, tracks execution timers, and controls the terminal drawer state.

---

## 3. Extracted Layout Components (Phase 1)

### 3.1. `TopBar.jsx`
* **Role**: Fixed 42px header providing global context.
* **Features**:
  * Profile dropdown switcher (Infrastructure vs. Flood Monitoring vs. SAR Science).
  * Dynamic metadata ribbon when viewing flood results (showing location, acquisition dates, flood acreage, UTM grid, EPSG code).
  * Real-time UTC digital clock updated each second.
  * Trigger for opening the deep-dive Analysis Report Modal.

### 3.2. `BottomStrip.jsx`
* **Role**: Tactical footer status strip docked between the left sidebar and right panel.
* **Features**: Displays detection methodology (e.g., Log-ratio + Otsu threshold in dB), detected polygon counts, and total elapsed runtime.

### 3.3. `CoordinatesHud.jsx`
* **Role**: Semi-transparent floating HUD positioned at the bottom left of the map viewport.
* **Features**: Displays dynamic cursor latitude and longitude to 4 decimal places, radar frequency band (L-Band), flight direction (Ascending/Descending), and gateway connection status.

### 3.4. `TerminalDrawer.jsx`
* **Role**: Slide-up execution terminal log viewer with event-stream parsing.
* **Features**:
  * Real-time SSE line consumption from `/jobs/:id/logs`.
  * JSON event parser identifying `[progress]`, `[georef]`, `[flood_report]`, and `[output]` packets.
  * Color-coded logs (Red for errors, Green for complete, Cyan for system events, Gold for CFAR, Purple for InSAR).
  * Docked `SHOW LOG` minimized button when the drawer is closed.

### 3.5. `FloodConfigPanel.jsx`
* **Role**: Right-hand configuration sidebar for flood analysis.
* **Features**:
  * Local file selection and NASA ASF catalog search integration.
  * Quick geographic crop presets (e.g., Upper Kolab Dam, Kundra Block) and custom lat/lon bounding.
  * Dual-threshold sliders for minimum backscatter drop, seed threshold, and region growing limits.

---

## 4. Tactical Command Center Enhancements (Phase 2)

Phase 2 transformed the dashboard into a professional, command-center-grade operations deck (similar to tactical aerospace and defense SAR interfaces like ICEYE):

### 4.1. Phase 2A — Real-Time 5-Stage Progress Bar (`ProcessingProgressBar.jsx`)
* **Location**: Docked below TopBar across the map area (`top: 42px`, `left: 196px`, `right: 340px`, height `40px`).
* **Conditional Visibility**: Automatically activates when `activeJob.status === 'running'`.
* **5 Monitored Stages**:
  ```
  [1: LOADING ACTIVE] → [2: LOADING BASELINE] → [3: DETECTING] → [4: OUTPUTS] → [5: COMPLETE]
  ```
* **Telemetry**: Synchronized with Rust engine SSE progress events. Current and completed stages light up in tactical cyan (`#0F969C`), with active pulsing indicators on the currently executing stage.

### 4.2. Phase 2B — Map Layer Toggle Controls (`MapLayerControls.jsx`)
* **Location**: Floating glassmorphism panel at `top: 90px`, `left: 216px`, `width: 200px`.
* **Custom Opacity Slider**:
  * Styled with a dark `#2A2A2A` track and an accent cyan thumb.
  * Dynamically controls `<ImageOverlay opacity={layerOpacity} />` between 0% and 100%.
* **Custom Tactical Toggles (No Default Checkboxes)**:
  * 4 custom 24×12mm smooth-pill sliding switches with colored status dots:
    * 🔵 **Permanent Water** (`#2563eb`) — Class 1
    * 🔴 **High Confidence Flood** (`#ff2800`) — Class 2
    * 🟠 **Moderate Confidence Flood** (`#ffa000`) — Class 3
    * 🟡 **Low Confidence Flood** (`#ffe600`) — Class 4
  * When a layer is toggled off, `<GeoJSON>` renders matching features with `fillOpacity: 0, opacity: 0, stroke: false`. Automatic key invalidation guarantees zero-latency visual updates.

### 4.3. Phase 2C — Run History Sidebar (`RunHistorySidebar.jsx`)
* **Location**: Floating collapsible panel below layer controls (`top: 254px`, `left: 216px`, `width: 200px`).
* **Features**:
  * Sorted chronologically with newest runs at the top.
  * Status indicator dots: 🟢 Completed (`C.stable`), 🟡 Running (`#E6A817` with glow pulse), 🔴 Failed (`C.critical`).
  * Hover highlights and active job borders in `C.accent.flood`.
  * **One-Click Viewing**: Clicking a finished run instantly loads its GeoTIFF overlay, GeoJSON polygons, and analysis report onto the map, auto-panning the camera to its geographic centroid. Clicking a running job opens the terminal.

### 4.4. Phase 2D — Tactical Keyboard Shortcuts (`useKeyboardShortcuts.js`)
* **Form-Control Safeguards**: Automatically disabled when user focus is inside any `<input>`, `<textarea>`, `<select>`, or `contentEditable` element. Ignores system hotkey combinations (`Ctrl`, `Alt`, `Meta`).
* **Hotkeys Reference**:
  | Key | Action | Description |
  |:---:|---|---|
  | <kbd>T</kbd> | Toggle Terminal | Opens or closes the real-time processing log drawer. |
  | <kbd>Escape</kbd> | Dismiss Overlays | Closes open modals and collapses the terminal drawer. |
  | <kbd>N</kbd> | New Run | Clears active viewing result and switches to the map configuration view. |
  | <kbd>R</kbd> | View Report | Opens the comprehensive flood analysis report modal. |
  | <kbd>1</kbd> | Map View | Switches flood workspace view to Map View. |
  | <kbd>2</kbd> | Time Series | Switches flood workspace view to Inundation Time Series. |
  | <kbd>3</kbd> | Regions View | Switches flood workspace view to Flood Regions table. |
  | <kbd>4</kbd> | Processing View | Switches flood workspace view to Processing Audit telemetry. |
  | <kbd>5</kbd> | Data Exports | Switches flood workspace view to GeoTIFF & GeoJSON downloads. |

---

## 5. Development Guidelines & Best Practices

1. **Strict Store Usage**: Never re-introduce local state in `AppDashboard.jsx` for features needed across multiple layout components. Add state properties and setters to the appropriate store in `src/pages/app/stores/`.
2. **Typography & Styling**: Always use `MONO` for telemetry, tabular numbers, and tactical labels. Use `SANS` for long-form descriptions and narrative reports. Never use system default fonts or default browser form inputs.
3. **Map Performance**: When rendering high-density GeoJSON features, ensure unique, cache-invalidating `key` strings are utilized so Leaflet updates layer styles without forcing an entire map remount.
