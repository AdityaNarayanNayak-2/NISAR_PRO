# React Dashboard Component Internals & Architecture

> Location: `sar-dashboard-v3/` — Static single-page control plane built with React, Vite, Leaflet, and standard CSS.

This document serves as a comprehensive developer reference for the React dashboard. It describes state flow, map integration pipelines, and sub-panels, providing developers with the context required to modify or extend the UI.

---

## 1. Directory Structure & File Map

```
sar-dashboard-v3/src/
├── main.jsx              → React DOM initialization & global CSS variables hook
├── App.jsx               → Route controller and gateway ConnectionSetup wrapper
├── config/
│   └── api.js            → Centralized API URL resolver (stores active port in localStorage)
├── components/
│   ├── ConnectionSetup.jsx   → Blocking gateway ping health screen (checks localhost:3000)
│   ├── DataVisualization.jsx → Hero page capability cards & static micro-visualizations
│   ├── ProcessingPipeline.jsx → Animated SSE real-time terminal log viewer
│   └── NisarCatalogSearch.jsx → In-app NASA ASF metadata crawler
└── pages/
    ├── app/
    │   ├── AppDashboard.jsx        → Root dashboard, global state controller, & Map viewer
    │   ├── InfrastructurePanel.jsx → Left telemetry panel & right scatterer detail sidebar (Gold Theme)
    │   ├── SarSciencePanel.jsx     → Level-1 standard focusing & Pauli RGB panel (Purple Theme)
    │   ├── MaritimePanel.jsx       → CA-CFAR ship detection analysis panel (Red Theme)
    │   ├── constants.js            → Universal styling constants (fonts, colors, hex tokens)
    │   └── helpers.js              → Common utilities (unit formatters, severity colors, filename parser)
```

---

## 2. Core Dashboard Architecture & State Flow

`AppDashboard.jsx` is the core state manager of the application. It orchestrates user inputs, gateway triggers, SSE logs, and map visualizations.

```
       ┌──────────────────────────────────────────────────────────┐
       │                   AppDashboard.jsx                       │
       │  (Manages global state: profile, activeJobId, jobs map)  │
       └──────────────────────────┬───────────────────────────────┘
                                  │
         ┌────────────────────────┼────────────────────────┐
         ▼                        ▼                        ▼
┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
│  Infrastructure  │    │   SAR Science    │    │  Maritime Panel  │
│    Panel.jsx     │    │    Panel.jsx     │    │    Panel.jsx     │
│ (Gold Profile)   │    │ (Purple Profile) │    │  (Red Profile)   │
└──────────────────┘    └──────────────────┘    └──────────────────┘
```

### 2.1. Shared Props Contract
The three profile panels receive their operational state and callbacks as React props from the parent `AppDashboard`:

1. **`dataMode` & `localFilePath`**: User selection of either catalog queries or local files.
2. **`runningJobs` & `elapsed`**: Active job tracking, streaming run durations.
3. **`viewingResult`**: Contains the results of a completed job, including GeoTIFF path, bounding box (`bbox`), and output reports.
4. **`startJob()`**: Triggered by buttons to submit a payload to `/jobs`.

---

## 3. Detailed Component Analysis

### 3.1. `AppDashboard.jsx` (Root Orchestrator)
* **Role**: Layout grid wrapper, active profile switcher, map renderer, and Server-Sent Events (SSE) connector.
* **Log Streamer**: Sets up a connection to `/jobs/:id/logs` using the native browser `EventSource`. It processes incoming lines in real-time:
  * Regular terminal output lines are appended directly to the terminal state.
  * Structural lines containing JSON event tokens (such as `georef` coordinates, `insar_report` paths, or `ships_detected` arrays) are parsed to update map layer bounding boxes and overlay points.
* **Theme Switching**: Manages styling through `PROFILES` constants:
  * `infrastructure`: Gold (`#C8A96E`)
  * `sar_science`: Purple (`#A78BFA`)
  * `maritime`: Red (`#EF4444`)

### 3.2. `InfrastructurePanel.jsx` (Infrastructure Profile)
* **Role**: Displays weather details, reservoir telemetry, and Persistent Scatterers (PS) statistics.
* **Telemetry Sync**:
  * Calls `/assets/search?query=...` to resolve names (e.g., *Upper Kolab Dam*) to coordinates.
  * Calls `/context?lat=...&lon=...` to query weather, rainfall, soil saturation, and seismic indicators from environmental APIs.
* **Persistent Scatterers (PS) Summary**:
  * Shows count breakdowns for Stable, Caution, Alert, and Critical markers.
  * Lists the top 10 scatterer points sorted by displacement.
  * Displays displacement graphs and coherence metrics when a point is clicked.

### 3.3. `SarSciencePanel.jsx` (Science Profile)
* **Role**: Configures standard SAR processing, Pauli RGB decompositions, and catalog metadata.
* **Metadata Parser**: Parses standard NISAR/Sentinel filenames using `parseNisarFilename` to extract and show information like processing levels, flight orbits, and acquisition dates.

### 3.4. `MaritimePanel.jsx` (Maritime Profile)
* **Role**: Coordinates CA-CFAR target classification for ship tracking.
* **CFAR Statistics**:
  * Summarizes vessel count, maximum backscatter (dB), mean backscatter (dB), and minimum backscatter (dB).
  * Lists all detected vessels with coordinates and backscatter intensities.

---

## 4. Map Component & GIS Rendering

The map container uses Leaflet wrappers (`react-leaflet`). It supports three overlay types:

### 4.1. Base Maps
Three base layers are available:
* **World Dark Gray** (ArcGIS Online - Default for high-contrast visibility)
* **Satellite Imagery** (Esri World Imagery)
* **OpenStreetMap** (Standard reference layer)

### 4.2. TiTiler COG Overlays
Continuous GeoTIFFs (such as displacement heatmaps and coherence maps) are rendered using a `<TileLayer>` pointing to a local TiTiler service:
```javascript
const tifUrl = encodeURIComponent(api(`/results/${finalTifPath}`));
const tileUrl = `http://localhost:8000/cog/tiles/WebMercatorQuad/{z}/{x}/{y}?url=${tifUrl}&tilesize=512${extraParams}`;
```
* **Style Mapping**:
  * **Deformation**: `colormap_name=rdylgn&rescale=-20,20` (fits millimeter displacements).
  * **Coherence**: `colormap_name=greys&rescale=0,1` (fits phase stability metrics).

### 4.3. Interactive Vector Overlays
* **Persistent Scatterers**: Rendered as `<CircleMarker>` elements, with sizing and color mapped to risk level (e.g., Critical points have a larger radius and red coloring). Click popups display displacement and coherence values.
* **CFAR Vessel Detections**: Rendered as red markers with a pulse animation. Popups show backscatter intensity (dB) and coordinates.

---

## 5. Developer Guide: Adding a Custom Dashboard Component

To add a new telemetry panel, chart, or overlay component:

1. **Define Layout Props**: Add any required state hooks inside `AppDashboard.jsx`.
2. **Implement the UI Panel**: Create your sub-panel inside `src/pages/app/`. Use the predefined constants from `constants.js` to ensure styling consistency:
   ```javascript
   import { MONO, SANS, C } from './constants';
   // C.bg0, C.bg1, C.text, C.textDim are fully shared color tokens
   ```
3. **Register the Profile**: Add the new profile structure to the `PROFILES` object in `constants.js`.
4. **Mount in Dashboard**: Add your panel import to `AppDashboard.jsx` and render it conditionally:
   ```javascript
   {profile === 'new_profile' && (
       <NewCustomPanel {...sharedProps} />
   )}
   ```
5. **Add Map Elements**: If the panel outputs map overlays, add corresponding `<TileLayer>` or `<CircleMarker>` elements inside the `<MapContainer>` block in `AppDashboard.jsx`.
