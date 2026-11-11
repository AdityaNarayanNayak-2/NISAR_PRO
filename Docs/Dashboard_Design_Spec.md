# NISAR Pro dashboard (`/app`): design spec

Date: 11 Nov 2026. Scope: `sar-dashboard-v3/src/pages/app/`. Companion to
`Docs/Website_Redesign_Plan.md` (sections 1 and 2.3). This spec replaces the layout sketch in 2.3.

Example numbers in this spec are copied from
`ingarss_2026/results/L_aug31_sep12/sar-bihar-aug31-sep12-full_flood.json`. They show format only.
The UI never hardcodes them.

## 0. Principles

1. **One workspace, no view tabs.** Runs on the left, map in the middle, one inspector on the right.
2. **Nothing floats over a panel.** Panels are CSS grid cells. Only map controls sit on the map,
   and they sit in fixed slots of the map's own grid.
3. **Report or nothing.** Every number comes from a file of the open run. A missing field prints
   "—". No fallbacks. Sums, differences and percentages are allowed only where this spec lists
   them, and carry the label "computed".
4. **Dual units by construction.** Areas go through `<Area>` only (km² first, then acres).
5. **Wording.** "Newly detected water", "water loss", "region". Never flood, breach, submerged,
   damage, calibrated, accuracy.
6. **Calm.** Near-black chrome, one accent, colour only on the map and its legend. Sans type.
   Mono only for coordinates, dB values, file names and the log.

## 1. Information architecture

The six tabs go. There is one screen with two map modes (single, compare).

| Thing | Where it lives | Why |
|---|---|---|
| Run history | Left rail | It is the navigation of the app; always one click away. |
| Run form | Inspector, "New run" mode | A run and its result are the same object; the form turns into the result. |
| Result summary | Inspector, top section | The headline number sits next to the map it describes. |
| Layers + legend | One card on the map, bottom-left | A legend row is the toggle; one place for "what it means" and "what is shown". |
| Replay | Map, bottom-centre | It changes the imagery, so it belongs to the map. |
| Regions (polygons) | Inspector section "Regions" | Replaces the Regions tab; list and map selection stay in sync. |
| Exports | Inspector, last section | Replaces Reports/Exports tabs and the report modal. |
| Processing log | Docked drawer under the map | Replaces the floating terminal and the Processing tab. |
| Method / thresholds | Inspector section "Method" | Real values from `report.method`; replaces the hardcoded Processing view. |
| Compare (L vs S) | Map mode + inspector "Compare" mode | Needs both maps and both tables at once. |
| Sentinel-2 agreement | Inspector section, only if a validation file exists | Replaces Evaluation Hub; shown only with real scores. |

Dropped: Time Series tab (no per-run data behind it; the season series belongs on the case-study
page), Settings view (controls did nothing), System status card ("Operational parity"), BottomStrip,
AnalysisReportModal, mode dropdown.

InSAR mode: removed from the top bar. It moves to `/app/insar`, reached only from the overflow menu
item "Experimental: InSAR (paused)". The page keeps `InfrastructurePanel` as is, under a banner
"Experimental. Processing is paused." It is never the default and never linked from a run.

URL state (read once on load, then written with `replaceState`):
`/app?run=<id>&compare=<id>&phase=baseline|active|detected&region=<region_id>`.

## 2. Layout

### 2.1 Desktop (≥1280 px)

```css
.app-shell {
  display: grid; height: 100dvh; overflow: hidden;
  grid-template-columns: var(--rail-w) minmax(0, 1fr) var(--insp-w);
  grid-template-rows: 48px minmax(0, 1fr) var(--log-h) 28px;
  grid-template-areas:
    "top  top    top"
    "rail map    insp"
    "rail log    insp"
    "rail status insp";
}
.app-shell { --rail-w: 304px; --insp-w: 384px; --log-h: 0px; }
.app-shell[data-rail="collapsed"] { --rail-w: 48px; }
.app-shell[data-insp="collapsed"] { --insp-w: 0px; }
.app-shell[data-log="open"]       { --log-h: 240px; }   /* user-resizable 160–480 px */
```

- **Top bar**: 48 px, full width, 1 px bottom border.
- **Left rail**: 304 px. Collapses to a 48 px icon rail: expand button, "New run" icon, run count.
  Its own scroll; header (44 px) is sticky inside it. Toggle: `[`.
- **Map**: fills the rest. Minimum 480 px wide; below that the inspector collapses automatically.
- **Inspector**: 384 px, own scroll, sticky 56 px header. Collapses to 0; toggle in the top bar, `]`.
- **Log drawer**: a grid row under the map only. Opening it makes the map shorter. It can't cover
  the rail or the inspector because it isn't in their columns. Drag handle on its top edge.
- **Status bar**: 28 px under the map. Left: cursor `25.5012°N 86.4987°E` (mono, "—" until the
  first mouse move), run CRS from `product.crs`. Right: job state text and a "Log" toggle (`L`).
  Replaces CoordinatesHud and BottomStrip.
- Panels have no radius, no shadow, no blur. They are separated by 1 px `--line` borders. This is
  what makes it read as one product instead of floating cards.

Map control slots (the only absolutely positioned elements, 12 px inset, inside `.map-view`):

```css
.map-slots { position: absolute; inset: 12px; pointer-events: none; display: grid;
  grid-template-columns: 240px minmax(0, 1fr) 40px; grid-template-rows: auto 1fr auto; gap: 12px; }
.map-slots > * { pointer-events: auto; }
/* row 1: compare labels (col 1–2) | zoom + basemap (col 3)
   row 3: legend (col 1, align end) | replay (col 2, justify center) | scale (col 3) */
```

If the map is under 720 px wide the legend collapses to a 36 px chip so legend and replay never meet.

### 2.2 z-index (tokens, no other values allowed)

| Token | Value | Use |
|---|---|---|
| `--z-map` | 0 | map canvas |
| `--z-map-ctl` | 10 | legend, replay, zoom, swipe handle |
| `--z-panel` | 20 | top bar, rail, inspector, log, status |
| `--z-scrim` | 29 | tablet/mobile scrim |
| `--z-drawer` | 30 | tablet overlay drawers, mobile sheet |
| `--z-popover` | 50 | menus, tooltips, comboboxes |
| `--z-dialog` | 60 | dialogs (connection, delete confirm) |
| `--z-toast` | 70 | toasts |

### 2.3 Tablet (768–1279 px)

- 1024–1279: rail is the 48 px icon rail. Expanding it opens a 304 px drawer over the map with a
  scrim (it may cover the map, never another panel). Inspector 344 px in the grid.
- 768–1023: same rail. Inspector is also a drawer (360 px, from the right, scrim), opened by the
  top bar toggle. Only one drawer open at a time. Log drawer max 200 px.

### 2.4 Mobile (<768 px)

- Top bar 48 px: wordmark, status dot, overflow menu. No search field (it is in the menu).
- Map fills the screen. Zoom buttons hidden (pinch). Legend is a chip, top-left.
- Bottom sheet, three snap points: **peek 88 px** (run title + newly detected water),
  **half 50dvh**, **full 100dvh − 56 px**. Drag handle 36×4 px; flick velocity > 0.5 px/ms goes to
  the next snap. Map stays interactive at peek and half. Scroll inside the sheet only at full.
- Sheet has a segmented control: `Runs · Result · Regions · New run`. Layers are in the legend chip.
- Replay sits 12 px above the sheet top edge at peek, hidden at half and full.
- Log: no drawer. A running job shows stages in the sheet; "View log" opens a full-screen dialog.
- Compare is not offered under 768 px.

## 3. Top bar (48 px, left to right)

| # | Item | Size | Notes |
|---|---|---|---|
| 1 | Rail toggle | 32×32 icon button | `aria-expanded`, `[` |
| 2 | Wordmark "NISAR Pro" | Inter Tight 600, 15 px | links to `/` |
| 3 | Divider, then run title | 13 px, truncates | "L-band · 31 Aug → 12 Sep 2026"; in compare: "A vs B" |
| 4 | Flexible space | | |
| 5 | Place search | 32 px icon, expands to 280 px field | Lat/lon or place name; `/` focuses it. Lives here, not on the map. |
| 6 | Compare | 32 px ghost button | Only when a completed run is open; `C` |
| 7 | New run | 32 px primary button | Local mode only; `N`. In demo mode it is "Get the app" → `/download`. |
| 8 | Gateway status chip | 28 px | See below. Click opens the connection dialog. |
| 9 | Inspector toggle | 32×32 | `]` |
| 10 | Overflow menu | 32×32 | Docs, Keyboard shortcuts, Gateway connection, Experimental: InSAR (paused), About |

Removed: UTC clock, version label (moves to About, read from `package.json` at build time; fix the
`0.0.0` there), FLOOD/INFRASTRUCTURE dropdown, six tabs, "Report" pill, the "Online" pill beside
search, the metadata ribbon, the `Ctrl+Shift+F` hint.

Status chip. The store starts at `connecting`, never at online.

| State | Look | Rule |
|---|---|---|
| `connecting` | spinner, "Connecting" | first probe pending (max 2 s) |
| `local` | green dot, "Local gateway" | `GET /jobs/health-ping` → `res.ok` and JSON `status === "ok"` |
| `demo` | outline chip, "Demo · read-only" | host ends in `.pages.dev` or `VITE_DEMO=1`; no probe |
| `offline` | amber dot, "Gateway offline · Retry" | two failed probes in a row (poll every 10 s) |

## 4. Run history (left rail)

Header: "Runs" + count + filter icon (band: All / L / S / L+S).

**Grouping**: by scene footprint, then by date pair, newest active date first. Group key is track and
frame parsed from `product.active_id` (`…_098_A_014_…` → "Track 98 · Frame 14"). A place name
("Bihar, Ganga plain") is shown only when the preset or demo manifest gives one; never guessed from
coordinates. Groups are collapsible, 28 px header.

**Row** (64 px, a real `<button>`):

```
[L]  31 Aug → 12 Sep 2026                    ●
     1,166.21 km² · 288,178 ac new water     ⋯
     Full scene · 3 h ago · ×2
```

- Band badge 24 px: `L`, `S`, `L+S` (neutral outline, not coloured).
- Dates from `product.baseline_id` / `product.active_id` (`_(\d{8})T`).
- Area: `areas.total_flood_km2` and `areas.total_flood_acres`, with the words "new water".
- Third line: crop (`crop.preset`: "Full scene", "20 km × 20 km"), finished time, run count.
- Status dot: grey queued, accent ring spinning = running (line 2 becomes the stage name),
  green completed, red failed (line 2 becomes "Failed: <first line of error>").
- Selected row: `--surface-2` background + 2 px accent bar on the left edge.
- `⋯` menu: Re-run, Edit and run (opens the form prefilled), Compare with open run, Delete.

**Duplicates**: the backend gives each run an input fingerprint (files + crop + thresholds). The
list shows one row per fingerprint, using the latest completed execution. `×2` means two executions;
it opens a small popover listing them with times, each selectable. "Re-run" starts a new execution
of the same fingerprint and does not add a row.

**Empty states**: local, no runs → icon, "No runs yet", "Pick two GCOV scenes to make your first
water-change map.", button "New run". Filter with no match → "No S-band runs" + "Clear filter".
Offline → the cached list stays visible, dimmed, with "Gateway offline. Results can't be opened."

**Backend contract** (needed; today `JobResponse` has only id, status, paths, bbox):
`GET /jobs` → per job `fingerprint`, `run_count`, `created_at`, `finished_at` (ISO 8601),
`elapsed_s`, `stage`, `error`, and `summary { band, baseline_date, active_date, crop_preset,
new_water_km2, new_water_acres, track, frame }` copied from the report. Until it ships, the client
fetches each `_flood.json` lazily (max 4 at a time) and leaves time fields out. `localStorage`
job persistence is removed; the gateway is the only source.

## 5. Result inspector (right, 384 px)

One scroll column. Sticky header (56 px): band badge, date pair, status, `⋯` (Re-run, Edit and run,
Delete). Sections are separated by 1 px lines and 24 px padding; each has a 12 px uppercase-free
label ("Classes", not "SECTION 1 · FLOOD IMPACT"). No tabs, no accordions except Method details.

Order:

1. **Warnings** (only if `report.warnings.length`). One amber-bordered row per string, verbatim.
   Example: "Full-scene swath coverage: 49.6% valid pixels (rotated track within UTM bounding grid)".
2. **Headline**. Label "Newly detected water". Value `areas.total_flood_km2` at 28 px Inter Tight:
   **1,166.21 km²**, below it 14 px `288,178 ac`. Under that one line:
   "1,725 regions · 31 Aug → 12 Sep 2026 · HH" (`flood_regions`, dates, `product.polarization`).
3. **Classes** table (see 5.1).
4. **Water extent** (computed, labelled so). Two rows: "Water on baseline date" = class 1 + class 5;
   "Water on active date" = class 1 + classes 2–4. Each as `<Area>`. Footnote: "Computed from the
   class table."
5. **Regions** (see 6.5): count, class filter chips, sortable list, top 50 then "Show all 1,725".
6. **Method** card (see 5.2).
7. **Agreement with Sentinel-2** (only when the run has a `validation` entry; today only the Bihar
   study in demo data, from `sentinel2_validation.json`). Table rows L / S / L+S, columns precision,
   recall, F1, IoU at `ndwi_0.0`. Caption, always shown: "Agreement with Sentinel-2 NDWI on
   cloud-free pixels, not accuracy. NISAR 12 Sep vs Sentinel-2 13 Sep. Scored area 7,946.03 km²
   (1,963,507 ac)." (`tests.<key>.dates`, `scored_km2`). `overall_accuracy` is not displayed.
8. **Product** (definition list, 13 px): Sensor `product.instrument` + `radar_band`; Frequency
   `center_frequency_hz` as GHz; Polarization; Grid `pixel_spacing_x_m` × |`pixel_spacing_y_m`| m;
   CRS `product.crs`; Crop `crop.preset`, `crop.center_lat/lon`; Bounds `georef_bbox` (mono, 4 dp);
   Baseline file and Active file (mono, middle-truncated, copy button).
9. **Exports**: one row per file: name, size (from a `HEAD` `Content-Length`), download icon.
   Class raster `<id>_flood_class.tif` ("GeoTIFF, EPSG:32645" from `product.crs`), Regions
   `<id>_flood.geo.json`, Report `<id>_flood.json`, Overlay `<id>_flood.png`, Radar previews (2 PNG).
   A file whose `HEAD` fails is listed greyed with "Not in this run folder", no link.

### 5.1 Class table

Columns: swatch · class name · km² · acres · share. Right-aligned tabular numbers, 36 px rows.
Share = class km² ÷ sum of all six class km² ("Share of valid area, computed"), never ÷
`total_area_km2` (that is the bounding grid, 115,725.54 km² here, about half of it outside the swath).

| Row | Report fields | Example |
|---|---|---|
| New water, high confidence | `new_inundation_high_*` | 713.74 km² · 176,369 ac |
| New water, medium confidence | `new_inundation_medium_*` | 452.47 km² · 111,809 ac |
| New water, low confidence | `new_inundation_low_*` | 0.00 km² · 0 ac (row dimmed when 0) |
| Stable water | `permanent_water_*` | 3,355.07 km² · 829,055 ac |
| Water loss | `receded_water_*` | 889.96 km² · 219,915 ac |
| Land | `stable_non_water_*` | 52,046.07 km² · 12,860,866 ac |
| **Valid area** (computed sum) | sum of rows | 57,457.32 km² |

Under the table, 12 px: "Bounding grid 115,725.54 km² (28,596,407 ac) includes no-data outside the
swath." A 6 px stacked bar above the table shows the five water classes only (land excluded, or it
is a grey bar). Hovering a row highlights that class on the map (others drop to 25 % opacity).

### 5.2 Method card

Plain definition list, values in mono:

| Label | Field | Example |
|---|---|---|
| Detector | `method.detector` | Log-ratio change detection |
| Speckle filter | `method.speckle_filter` | median 3×3 |
| Seed threshold | `method.seed_threshold_db` | −5.0 dB |
| Growth threshold | `method.growth_threshold_db` | −2.5 dB |
| Minimum change | `method.min_change_db` | −3.0 dB |
| Otsu (reported only) | `method.raw_otsu_db` | −3.26 dB |
| Region growing | `method.region_growing` | On |
| Clean-up | `method.morphology` | open 3×3 + close 3×3 + cc filter 8 px |
| Coherence helper | `method.coherence_used` | Not used |

"Otsu (reported only)" has an info tooltip: "Reported for reference. It does not set the classes
unless it is below the seed threshold." A small threshold ruler (dB axis, three ticks: seed, Otsu,
growth) sits under the list. `confidence_reasons` render as plain chips. Fused (L+S) runs add a
"Rule diagnostics" list from `full_scene_comparison.rule_diagnostics` (`sandbar_test_pixels`,
`canopy_rule_outside_s_gain`, …) with this note: "Rule names describe intent, not verified
surface types."

## 6. Map

Engine: **MapLibre GL** (`maplibre-gl`), dark vector basemap with no API key (OpenFreeMap dark).
`MapView` is the only file that imports the engine.

### 6.1 Layer stack (bottom to top)

| # | Layer | Source | Default |
|---|---|---|---|
| 1 | Basemap land, water, roads (labels removed) | vector style | on, 100 % |
| 2 | Radar preview | image source, `_flood_baseline.png` or `_flood_active.png`, corners from `georef_bbox` | per replay phase |
| 3 | Class raster: stable water (1), water loss (5) | `_flood.png`, recoloured on the client (6.2) | on, 85 % |
| 4 | New-water regions (2, 3, 4) fill | `_flood.geo.json`, colour by `class_code` | on, 85 % |
| 5 | Region hover outline | same source, feature-state | — |
| 6 | Region selection outline | same source | — |
| 7 | Crop box / drawn area (run form only) | local | — |
| 8 | Basemap place labels | vector style | on (labels stay readable over imagery) |
| 9 | Swipe handle, map controls | DOM | — |

Class 0 (land) is never painted; the radar preview shows through. `fitBounds(georef_bbox)` runs
once per run id, with padding 48 px. No bbox → no fly, and a toast "This run has no bounds."

### 6.2 Class raster recolour

The engine's PNG (`io.rs`, `save_flood_map_png`) paints only class 1 as `rgba(33,102,193,180)` and
class 5 as `rgba(245,158,11,200)`; everything else is transparent. `useClassRaster(url, visible,
palette)` decodes it once in a worker (`OffscreenCanvas`), builds a class index (alpha 0 → none,
red < 128 → class 1, else class 5), and repaints from the tokens and the two toggles. This gives
separate toggles for stable water and water loss and fixes the "toggle hides the whole PNG" bug,
with no engine change. If decode fails, show the PNG as is and disable the two toggles.

### 6.3 Legend + layers card (bottom-left, 240 px)

Title "Layers". Rows of 28 px: eye toggle · 12 px swatch · label · (nothing else). Rows: New water
high, medium, low, Stable water, Water loss, then a divider, then "Radar image" and "Region
outlines". One slider "Overlay opacity" (0–100 %, default 85) for layers 3–4. Rows whose class has
0 km² in the report are dimmed and marked "none in this run". Collapse button turns the card into a
36 px chip showing the five swatches. Rows are `<button role="switch">`.

### 6.4 Replay control (bottom-centre)

One pill, 40 px high, max 440 px: `[▶]  Baseline 31 Aug │ Active 12 Sep │ Detected`.

- Three segments, the active one filled `--surface-3`. Click a segment to jump.
- `baseline`: baseline preview at 100 %, no classes. `active`: active preview at 100 %, no classes.
  `detected`: active preview at 65 % with layers 3–4 on top.
- Play steps every 1.8 s with a 250 ms crossfade and stops on `detected`. Play pressed on
  `detected` rewinds to `baseline` and plays; the icon shows ↺ there.
- Keys: `←` `→` change phase, `Space` play/pause (when the map has focus).
- Shown only if `report.replay.available` and both previews load. Otherwise the control is not
  rendered and the map shows `detected` with the basemap under it.
- Label is "Replay", never "Flood event replay". Rendering stays in one component (`ReplayLayers`);
  nothing else adds image layers for the run.

### 6.5 Regions: hover, click, list

- Hover: 1.5 px white outline, pointer cursor, tooltip after 80 ms:
  "FL-REG-001 · Medium confidence · 0.13 km² · 33.21 ac". The file has `area_acres` only; km² is
  acres × 0.004046856 through `<Area acres>`.
- Click: 2 px white outline + 4 px dark halo, URL gets `region=`, the inspector scrolls to Regions
  and expands that row: class, area, `pixel_count`, pixels by confidence (`high_conf_pixels`,
  `med_conf_pixels`, `low_conf_pixels`), centroid (mono), "Zoom to region". The map does not move
  on a map click. `Esc` or clicking empty map clears it.
- List row click: selects and flies to the centroid (zoom 13, 600 ms).
- List: 40 px rows, virtualised, sorted by area by default; sort by area / confidence; filter chips
  High / Medium / Low. GeoJSON is fetched with an `AbortController` keyed by run id.

### 6.6 Compare (swipe)

- Entry: top bar "Compare" or run row menu. A picker lists runs with the same track and frame;
  others are disabled with "Different footprint".
- Map: two synced MapLibre maps, clipped by a vertical swipe handle (2 px line, 32 px round grip,
  draggable, arrow keys move 2 %). Left = A (open run), right = B. Labels in row 1 of the map
  slots: "A · L-band · 31 Aug → 12 Sep" left, "B · S-band · 31 Aug → 12 Sep" right. Both sides show
  `detected`; replay is hidden.
- Inspector switches to Compare mode: one table, rows = the six classes + newly detected water,
  columns A, B, B − A, all through `<Area>`. "B − A" is labelled "computed".
- If the two valid areas differ, an info row on top: "Each run is measured over its own valid area
  (A 57,457.32 km², B …). This is not a common grid."
- Exit: "Close compare" in the inspector header, or `Esc`.

## 7. Run form (inspector, "New run" mode; local gateway only)

Header "New run" + close (returns to the last result). Three numbered sections on one scroll page
(no wizard pages), then a sticky footer with the Run button.

1. **Scenes**
   - Preset select (from `GET /presets` on the gateway; no hardcoded paths; hidden if empty).
   - Source: `Local file` | `ASF catalog` (segmented; catalog uses the existing `/search/nisar`).
   - "Baseline (earlier) scene" and "Active (later) scene": file field + "Choose file".
     After choosing, a read-only line under each: band, date, track/frame parsed from the name.
   - Validation: both required; `.h5` GCOV; same band; same track and frame; baseline date before
     active date (offer "Swap" if reversed).
2. **Area**
   - Segmented: `Full scene` | `20 km × 20 km` | `10 km × 10 km`.
   - For a crop: centre lat / lon fields (mono) + "Pick on map" (click sets the centre; the box
     shows as layer 7). Validation: lat −90…90, lon −180…180, centre inside the scene bounds if known.
3. **Thresholds**
   - Read-only summary of the band default, set automatically from the detected band:
     L-band seed −5.0, growth −2.5, minimum change −3.0, water floor −13.0 dB;
     S-band seed −4.8, growth −2.2, minimum change −2.7, water floor −12.5 dB.
   - **Advanced** (collapsed): Seed threshold (−10.0…0.0 dB), Growth threshold (−8.0…2.0 dB),
     Minimum change (−10.0…−1.0 dB), Permanent water floor (−18.0…−9.0 dB), Minimum region size
     (px, integer ≥ 1, default 8), Swath-edge erosion (0–60 px, shown also as km at 80 m),
     Coherence helper file (optional GUNW `.h5`). All dB steps are 0.1. Each has a number field
     next to its slider. "Reset to band defaults" link.
   - **Seed ≤ growth**: one dual-thumb slider carries both. Thumbs can't cross; typing a seed above
     growth shows "Seed must be at or below growth (for example −5.0 ≤ −2.5)" and disables Run.
   - Removed because the processor ignores them: multilook select, polarization dual/span, speckle
     filter, recession threshold, the second pair of seed/growth sliders, "live histogram" text.

Footer: primary "Run analysis" (disabled with the reason under it), secondary "Cancel". On submit:
check `res.ok` and that the response has an id; switch the inspector to the running state; add the
row to the rail. A fingerprint match with a completed run returns that run with a toast "Same
inputs as an earlier run. Opened it." and an action "Run again".

## 8. Visual system

### 8.1 Data colours

The current set fails where it matters: medium `#f97316`, low `#fb923c` and loss `#f59e0b` are
three oranges. Measured smallest pairwise distance (CIE76 ΔE, Machado 2009 simulation):

| Palette | Normal | Deuteranopia | Protanopia | Tritanopia |
|---|---|---|---|---|
| Current | 17 (medium/low) | 9 (medium/loss) | 10 (medium/low) | 6 (low/loss) |
| Proposed | 54 | 40 | 41 | 31 |

Proposed: stable water stays `#00e5ff`, land stays `#64748b`. New water becomes one ordered ramp
that gets lighter as confidence drops (`#d81b60` → `#ff8a3d` → `#ffe0b8`), and water loss moves to
its own hue, violet `#8b6cff`. Loss is no longer mistaken for low-confidence new water. If adopted,
update CLAUDE.md §3, the note figures are unaffected (dashboard only). The engine PNG needs no
change (6.2).

### 8.2 Tokens (paste into `src/design/tokens.css`)

```css
:root {
  /* surfaces */
  --ink-950: #07090d;  --surface-0: #0a0d12;  --surface-1: #0d1117;
  --surface-2: #141a22;  --surface-3: #1c2430;
  --line: #1f2733;  --line-strong: #2c3644;
  /* text */
  --text-hi: #f5f7fa;  --text-mid: #b6c0cc;  --text-lo: #8b97a7;  --text-off: #5d6878;
  /* accent and status (chrome only, never on the map) */
  --accent: #38bdf8;  --accent-ink: #04121b;  --focus: 0 0 0 2px #07090d, 0 0 0 4px #38bdf8;
  --ok: #34d399;  --warn: #fbbf24;  --err: #f87171;
  /* data classes (map, legend, class table only) */
  --c-land: #64748b;        --c-water-stable: #00e5ff;
  --c-new-high: #d81b60;    --c-new-med: #ff8a3d;    --c-new-low: #ffe0b8;
  --c-loss: #8b6cff;        --c-select: #ffffff;
  /* type */
  --font-sans: "Inter", system-ui, sans-serif;
  --font-display: "Inter Tight", "Inter", system-ui, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, monospace;
  --fs-11: 0.6875rem; --fs-12: 0.75rem; --fs-13: 0.8125rem; --fs-14: 0.875rem;
  --fs-16: 1rem; --fs-20: 1.25rem; --fs-28: 1.75rem;
  /* space (4 px base) */
  --s-1: 4px; --s-2: 8px; --s-3: 12px; --s-4: 16px; --s-5: 20px; --s-6: 24px; --s-8: 32px;
  /* shape */
  --r-sm: 6px; --r-md: 10px; --r-pill: 999px;
  --shadow-pop: 0 8px 24px rgba(0, 0, 0, 0.5);
  /* motion */
  --t-fast: 120ms; --t-base: 200ms; --t-slow: 300ms; --ease: cubic-bezier(0.2, 0, 0, 1);
  /* layout */
  --top-h: 48px; --status-h: 28px; --rail-w: 304px; --insp-w: 384px;
  --z-map: 0; --z-map-ctl: 10; --z-panel: 20; --z-scrim: 29; --z-drawer: 30;
  --z-popover: 50; --z-dialog: 60; --z-toast: 70;
}
@media (prefers-reduced-motion: reduce) { :root { --t-fast: 0ms; --t-base: 0ms; --t-slow: 0ms; } }
```

### 8.3 Rules

- **Surfaces**: page `--ink-950`; panels `--surface-1`; rows on hover and inputs `--surface-2`;
  selected `--surface-3`. Map controls are `--surface-1` at 92 % opacity, 1 px `--line-strong`,
  `--r-md`. No backdrop blur anywhere.
- **Type**: body 13 px / 20 px Inter 400. Labels 12 px Inter 500 `--text-lo`, sentence case, no
  letter-spacing, no all-caps. Section titles 13 px 600. Headline stat 28 px Inter Tight 600,
  tracking −0.01em. Inputs and buttons 14 px. Areas use Inter with
  `font-variant-numeric: tabular-nums`. Mono (12 px) only for coordinates, dB values, file names,
  ids, the log.
- **Buttons**: 32 px high (40 px on touch). Primary: `--text-hi` background, `--ink-950` text (one
  per panel). Ghost: transparent, `--line-strong` border. Accent is for focus rings, links and the
  selected-row bar only.
- **Radius**: 6 px inputs and buttons, 10 px map controls, menus, dialogs, pill for badges. Panels 0.
- **Elevation**: one shadow (`--shadow-pop`) for popovers, dialogs, toasts and map controls only.
- **Motion**: panel collapse 200 ms on `grid-template-columns`; log drawer 200 ms; replay
  crossfade 250 ms; sheet snap 300 ms; hover 120 ms. No pulses, glows or scan lines. The only
  looping animation is the running-job spinner.
- **Focus**: `box-shadow: var(--focus)` on every interactive element; never removed.
- **Targets**: 32 px minimum on desktop, 44 px under 768 px. All controls are real buttons, links
  or inputs. Dialogs use `role="dialog"`, a focus trap and `Esc`.

## 9. States

| State | Rail | Map | Inspector |
|---|---|---|---|
| App loading | 6 skeleton rows | basemap only | skeleton blocks |
| No run open, local | list or empty state | India extent | New run form, step 1 |
| Run loading | row selected | basemap; overlays fade in when decoded | skeleton; header already filled from the list |
| Completed | green dot | detected phase, fit to bounds | sections 1–9 |
| Queued | grey dot, "Queued" | unchanged | stage list, all pending; "Cancel" |
| Running | spinner, stage name | crop box of the job if any | stage list (below), elapsed time, "Cancel", "Show log" |
| Failed | red dot, first error line | unchanged | error card: message from the gateway, last 5 log lines (mono), "Show log", "Edit and run" |
| Report missing or invalid | amber dot | previews if they exist | "This run has no readable report." + Exports list of what exists |
| Offline | dimmed list + notice | last view stays | banner "Gateway offline. Retry." ; Run disabled |
| Demo | showcase runs, no `⋯` actions | opens the Bihar L+S run | sections 1–9; New run replaced by "This demo is read-only. Download NISAR Pro to run your own scenes." + link |

Running stages, driven only by SSE `progress` events from `/jobs/:id/logs`:
`Read active scene → Read baseline scene → Detect change → Write outputs → Done`. Each is a row
with a check (done), spinner (current) or hollow dot (pending). No percentage unless the event
carries one. Elapsed time is a client timer labelled "Elapsed", replaced by the gateway's
`elapsed_s` when the run ends; if that is absent, no duration is shown afterwards. The log drawer
opens by itself on the first run of a session only. On completion the inspector turns into the
result and the map loads it; the new run never reuses the previous run's images or bounds.

Log drawer: header 32 px ("Log · <run id> · 65 lines", Copy, Download .log, Close), body mono
12 px / 18 px, auto-scroll that pauses when the user scrolls up ("Jump to latest"). Three colours
only: default `--text-mid`, error `--err`, done `--ok`. The `EventSource` is closed on unmount and
on run change.

Toasts (bottom-right of the map column, max 3): run finished, run failed, copy done, export failed.

## 10. Components and files

All under `sar-dashboard-v3/src/pages/app/`. CSS modules next to each component. Target < 300
lines per file.

| File | Props / API | Job |
|---|---|---|
| `shell/AppShell.jsx` | — | Grid, `data-rail/insp/log` attributes, breakpoints, URL sync |
| `shell/TopBar.jsx` | `run, compareRun, mode, onNewRun, onCompare` | Section 3 |
| `shell/GatewayStatus.jsx` | `state, onOpenConnection` | Status chip |
| `shell/StatusBar.jsx` | `cursor, crs, jobState, logOpen, onToggleLog` | 28 px bar |
| `shell/LogDrawer.jsx` | `runId, lines, onClose, height, onResize` | Docked log |
| `shell/BottomSheet.jsx` | `snap, onSnap, tabs, children` | Mobile sheet |
| `shell/OverflowMenu.jsx` | `items` | Menu incl. Experimental: InSAR |
| `runs/RunList.jsx` | `groups, selectedId, onSelect, onAction, filter` | Rail list, empty states |
| `runs/RunGroup.jsx` | `title, runs, collapsed` | Footprint group |
| `runs/RunRow.jsx` | `run: RunSummary, selected, onSelect, onAction` | Section 4 row |
| `inspector/Inspector.jsx` | `mode: 'result'\|'form'\|'running'\|'failed'\|'compare'\|'empty'` | Mode switch + header |
| `inspector/ResultInspector.jsx` | `report, regions, validation, files` | Sections 1–9 |
| `inspector/HeadlineStat.jsx` | `km2, acres, regions, dates, pol` | Section 5 item 2 |
| `inspector/ClassTable.jsx` | `areas, onHoverClass` | 5.1 |
| `inspector/MethodCard.jsx` | `method, reasons, ruleDiagnostics` | 5.2 |
| `inspector/RegionList.jsx` | `features, selectedId, onSelect, sort, filter` | 6.5 list |
| `inspector/AgreementTable.jsx` | `test, ndwiKey` | Sentinel-2 section |
| `inspector/ExportsList.jsx` | `files: {label, url, note}[]` | Exports with HEAD check |
| `inspector/WarningsList.jsx` | `warnings: string[]` | Verbatim warnings |
| `inspector/CompareInspector.jsx` | `a, b` | 6.6 table |
| `inspector/RunProgress.jsx` | `stage, startedAt, onCancel, onShowLog` | Running state |
| `inspector/RunError.jsx` | `error, lastLines, onEdit` | Failed state |
| `form/RunForm.jsx` | `initial, presets, onSubmit, onCancel` | Section 7 |
| `form/SceneFields.jsx` | `value, onChange, errors` | Step 1 |
| `form/AreaFields.jsx` | `value, onChange, onPickOnMap` | Step 2 |
| `form/ThresholdFields.jsx` | `band, value, onChange, errors` | Step 3 + Advanced |
| `form/validateRun.js` | `(values) → errors` | All rules, incl. seed ≤ growth; unit tested |
| `map/MapView.jsx` | `run, phase, layers, opacity, selectedRegion, onSelectRegion, onCursor, compareRun, cropBox` | Only MapLibre importer |
| `map/ReplayLayers.jsx` | `map, run, phase` | Sole owner of run image layers |
| `map/RegionsLayer.jsx` | `map, geojson, visibleClasses, selectedId, hoverId` | Layers 4–6 |
| `map/ReplayControl.jsx` | `phase, dates, playing, onPhase, onPlay` | 6.4 |
| `map/LegendLayers.jsx` | `layers, onToggle, opacity, onOpacity, areas` | 6.3 |
| `map/SwipeCompare.jsx` | `a, b, position, onPosition` | 6.6 |
| `map/useClassRaster.js` | `(url, visible, palette) → blobUrl` | 6.2, worker |
| `ui/Area.jsx` | `km2?, acres?, digits?` | Prints both units; uses both report fields when present, converts with 0.004046856 when one is missing; "—" when both are |
| `ui/` Button, IconButton, Badge, Segmented, Slider, RangeSlider, Field, Menu, Dialog, Tooltip, Toast, Skeleton | standard | Primitives |
| `lib/report.js` | `parseFloodReport`, `parseStudyReport`, `parseSceneName` | No fallback values; tested against `ingarss_2026/results/*` |
| `lib/demo.js` | `loadDemoManifest()` | `public/demo/` manifest → same `RunSummary` shape |
| `stores/useGatewayStore.js` | `state: connecting\|local\|demo\|offline` | Rewritten |
| `stores/useRunStore.js` | `runs, openId, compareId, open(), remove(), rerun()` | Replaces `useJobStore` |
| `stores/useMapStore.js` | `phase, layers, opacity, selectedRegionId, cursor` | Slimmed |
| `hooks/useRunStream.js` | `(runId) → {stage, lines}` | One SSE owner, cleans up |
| `hooks/useShortcuts.js` | — | `[ ] L N C / Esc ← → Space` |
| `insar/InsarPage.jsx` | — | Wraps the moved `InfrastructurePanel.jsx` + paused banner |

`parseStudyReport` exists because the fused file
(`LS_fused_aug31_sep12/sar-bihar-ls-fused-aug31-sep12_flood.json`) has a different shape
(`full_scene_comparison.{l_band_only,s_band_only,ls_fused,rule_diagnostics}`, `dates`,
`spatial_grid`; no `areas`, `product`, `method` or `georef_bbox`). It maps `ls_fused` into the same
class rows (valid area = `total_valid_km2`, no low-confidence class) and leaves Method and Product
rows it can't fill as "—". Unknown shape → the "report missing or invalid" state.

Delete after migration: `AppDashboard.jsx`, `MapComponents.jsx`, `constants.js`, `helpers.js`,
`layout/` (all seven files), `hooks/useKeyboardShortcuts.js`, `stores/useJobStore.js`,
`flood/WorkspaceSidebar.jsx`, `flood/TimeSeriesView.jsx`, `flood/RegionsView.jsx`,
`flood/ProcessingView.jsx`, `flood/ReportsEvaluationView.jsx`, `flood/DataExportsView.jsx`,
`flood/SettingsView.jsx`, `flood/AnalysisReportModal.jsx`, `flood/FloodInsightPanel.jsx`,
`flood/FloodConfigPanel.jsx`, `flood/FloodEventReplay.jsx`, `flood/floodReportHelpers.js`,
`styles/app-theme.css`, and the `.flood-*`, `.nisar-*`, `--chrome-*`, `--glass-*`,
`--flood-map-*` blocks in `index.css`. Move `InfrastructurePanel.jsx` to `insar/`. Remove
`leaflet`, `react-leaflet`, `react-leaflet-draw`. CLAUDE.md §4A names `FloodEventReplay.jsx` and
`AppDashboard.jsx`; update it to `map/ReplayLayers.jsx` when the files go.

## 11. Wireframes

### Desktop (1440 × 900)

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ ☰  NISAR Pro │ L-band · 31 Aug → 12 Sep 2026          ⌕   Compare  [New run]  ● Local gateway ▯ ⋯ │ 48
├──────────────────────┬──────────────────────────────────────────────┬────────────────────────┤
│ Runs  6           ⏷  │                                        [+]   │ [L] 31 Aug → 12 Sep  ⋯ │
│ ─ Track 98 · Frame 14│                                        [−]   │ ● Completed            │
│ ▌[L+S] 31 Aug→12 Sep │                                        [◱]   ├────────────────────────┤
│ ▌  … km² · … ac    ● │             radar preview                    │ ⚠ Full-scene swath     │
│  [S]  31 Aug→12 Sep  │           + class overlay                    │   coverage: 49.6% …    │
│    … km² · … ac    ● │           + region polygons                  ├────────────────────────┤
│  [L]  31 Aug→12 Sep  │                                              │ Newly detected water   │
│    1,166.21 km² ·    │                                              │ 1,166.21 km²           │
│    288,178 ac  ●  ⋯  │                                              │ 288,178 ac             │
│    Full scene · ×2   │                                              │ 1,725 regions · HH     │
│  [L]  12 Sep→18 Oct  │                                              ├────────────────────────┤
│    … km² · … ac    ● │                                              │ Classes   km²     ac  %│
│  [L]  26 Jul→31 Aug  │                                              │ ■ New high  713.74 … … │
│    … km² · … ac    ● │ ┌ Layers ─────────┐                          │ ■ New med   452.47 … … │
│ ─ Track 12 · Frame 7 │ │ ◉ ■ New, high   │                          │ ■ New low     0.00 … … │
│  [L]  …            ◌ │ │ ◉ ■ New, medium │                          │ ■ Stable  3,355.07 … … │
│                      │ │ ◉ ■ New, low    │                          │ ■ Loss      889.96 … … │
│                      │ │ ◉ ■ Stable water│                          │ ■ Land   52,046.07 … … │
│                      │ │ ◉ ■ Water loss  │ ┌──────────────────────┐ ├────────────────────────┤
│                      │ │ ◉ Radar image   │ │▶ Baseline│Active│Det.│ │ Regions  ·  Method  …  │
│                      │ │ Opacity ━━━━○─  │ └──────────────────────┘ │ (scrolls)              │
│                      │ └─────────────────┘                    ├─2km─┤ │                        │
│                      ├──────────────────────────────────────────────┤                        │
│                      │ Log · sar-32db293a · 65 lines     ⧉  ⤓  ✕    │                        │ 240
│                      │ [io] SAR image saved: …_flood_baseline.png   │                        │ (when
│                      │ Analysis completed successfully              │                        │ open)
│                      ├──────────────────────────────────────────────┤                        │
│                      │ 25.5012°N 86.4987°E · EPSG:32645     Idle · Log │                      │ 28
└──────────────────────┴──────────────────────────────────────────────┴────────────────────────┘
        304 px                          flexible                              384 px
```

Rail collapsed: the first column is 48 px with `☰`, `+`, and the run count. Compare mode: the map
shows the swipe handle and A/B labels in the top row; the replay pill is hidden; the inspector
shows the A / B / B − A table.

### Mobile (390 × 844)

```
Peek (88 px)                     Half (50dvh)                    Full
┌───────────────────────┐        ┌───────────────────────┐       ┌───────────────────────┐
│ NISAR Pro        ● ⋯  │ 48     │ NISAR Pro        ● ⋯  │       │ NISAR Pro        ● ⋯  │
├───────────────────────┤        ├───────────────────────┤       ├───────────────────────┤
│ [■■■■■ Layers]        │        │ [■■■■■ Layers]        │       │         ▂▂▂           │
│                       │        │         map           │       │ Runs·Result·Regions·New│
│                       │        │                       │       ├───────────────────────┤
│         map           │        ├───────────────────────┤       │ ⚠ warning             │
│                       │        │         ▂▂▂           │       │ Newly detected water  │
│                       │        │ Runs·Result·Regions·New│      │ 1,166.21 km²          │
│                       │        ├───────────────────────┤       │ 288,178 ac            │
│                       │        │ Newly detected water  │       │ Classes               │
│ ┌───────────────────┐ │        │ 1,166.21 km²          │       │ ■ New high  713.74 km²│
│ │▶ Base │ Act │ Det │ │        │ 288,178 ac            │       │             176,369 ac│
│ └───────────────────┘ │        │ 1,725 regions · HH    │       │ ■ New med   452.47 km²│
├───────────────────────┤        │ Classes               │       │ …                     │
│         ▂▂▂           │        │ ■ New high  713.74 km²│       │ Method                │
│ [L] 31 Aug → 12 Sep   │ 88     │             176,369 ac│       │ Exports               │
│ 1,166.21 km² · 288,178 ac│     │ …                     │       │ (scrolls)             │
└───────────────────────┘        └───────────────────────┘       └───────────────────────┘
```

On mobile the class table stacks km² over acres in one right-aligned column and drops the share
column.

## 11b. Acceptance checks (v1, partly superseded by §12)

1. At 1440, 1280, 1024, 768 and 390 px no two UI elements overlap (Playwright screenshot + a
   bounding-box intersection test over every `[data-panel]` and `[data-map-ctl]`).
2. Every area on screen has both km² and acres (test: no text node matches `km²` without `ac` in
   the same `[data-area]`).
3. No number on screen is absent from the run's files, apart from the computed values named in
   5 (items 4), 5.1 (share, valid area), 6.5 (km² from acres) and 6.6 (B − A).
4. The strings flood, breach, submerged, accuracy, calibrated, parity, online do not appear in
   `/app` (the product name of files such as `_flood.json` excepted).
5. `/app` opens in the water workspace; InSAR is reachable only from the overflow menu.
6. Rail scrolls on its own; collapsing it or the inspector resizes the map (`map.resize()` on
   transition end); the log drawer never overlaps a panel.
7. Keyboard only: every control reachable, focus visible, dialogs trap focus and close on `Esc`.

## 13. v3 obsidian platform (what is built)

> v3 replaces the look and layout of §12 (dock, cyan accent, top bar). §12 still holds for the
> content of each section, wording, validation and process rules. The full list of what each
> panel owns is in `Docs/Architecture/sar_dashboard_internals.md`.

- **Chrome is achromatic.** No cyan, teal or neon green in UI chrome. Colour only for data:
  map classes, chart marks, status dots (green online, amber warning, red error).
- **Panels**: `rgba(18,19,22,.84)`, blur 28 px saturate 140 %, border `rgba(255,255,255,.08)`,
  radius 24 px, shadow `0 24px 60px rgba(0,0,0,.75)`. Tiles inside: `rgba(255,255,255,.035)`,
  border `.06`, radius 16 px.
- **Pills**: active white 13 % fill, white text, white 20 % border, full radius. Inactive
  transparent `#8e929b`; hover white 5 % with `#e2e4e9`. Segmented and preset pills: radius 10 px,
  active white 14 %.
- **Primary button**: porcelain `#f3f4f6`, text `#0b0c0e`, Plus Jakarta Sans 600 13 px, radius 12,
  height 42.
- **Type**: Plus Jakarta Sans, sentence case, no uppercase mono labels. Mono only for
  coordinates, dB, ids and commands. Big numbers are light (300), e.g. the flood extent KPI.
- **Sliders**: 3 px track `rgba(255,255,255,.14)`, 12 px white thumb with a `#121316` border,
  silver fill up to the value.
- **Rows**: notification style, radius 14 px, green dot, white title, `#71717a` subtitle.
- **Layout**: nav pill top 20 / left 20 (wordmark, module, six tabs); command pill top 20, right
  of the nav, left of the panel; bento stack top 76 / left 20, 320 px; right panel top 20 to
  bottom 20, 380 px; layers legend top left of the free map; replay and timeline bottom centre.
- **Map colours** (ICEYE-like blues, flood is the news, stable water is context): flood high
  `#3d8df0`, medium `#82b8f4`, low `#c2dbf7`, stable water `#2f5aa6`, water loss `#d4892f`.
  Trend chart: flood extent columns `#3d8df0`, water line neutral `#d6dae1`.
- **Truth**: no invented metrics on cards. Status tiles and run cards show only gateway values;
  the sparkline is flood extent per period of the frame in focus.

## 12. Platform redesign v2 (dock, brief, process)

> v2 look is replaced by §13 (v3). Content rules below still apply. Sections 0–11b describe v1; where they say no floating panels, no blur,
> runs rail, compare swipe or never "flood", §12 replaces them.

Where this section and sections 0–11 disagree, this section wins: full-screen map, floating glass
panels, no runs rail, headline "Flood extent" with the note in 12.4. Still in force: report or
nothing, `<Area>` for every area, "—" for a missing value.

### 12.1 Shared rules

- **Glass**: `rgba(11,15,20,.80)`, blur 16 px, 1 px `rgba(255,255,255,.13)`, radius 18 px, 12 px
  from screen edges and from each other. Popovers: radius 14 px.
- **Type**: body 13/20 Inter 400. Labels 12/500, sentence case, 60 % white. Panel title 15 Inter
  Tight 600. Mono 11 for coordinates, dB, ids, commands. Numbers `tabular-nums`.
- **States**: hover adds `rgba(255,255,255,.06)` in 120 ms. Focus: 2 px `#22c3d6` ring, 2 px
  offset. Disabled: 40 % opacity plus a tooltip with the reason. Loading: flat
  `rgba(255,255,255,.06)` block of the final size, no shimmer. Error: one 12 px `#f87171` line
  and "Retry", in place, never a toast.
- **One owner per fact**: flood extent, hotspots, trend → Brief. Class areas, thresholds, region
  stats → Analysis. Scores → Validation. Inputs → Process. Overview: frame, acquisitions, run
  count, no result numbers.

### 12.2 Top bar, dock, panel

- **Top bar**: 48 px, padding 0 16 px. Wordmark 14 Inter Tight 600. Pills 32 px high, fully
  rounded, 13/500, 8 px apart. Status chip: 6 px dot plus one word (Ready, Running 42 %, Offline).
- **Dock**: 56 px wide, height fits content, padding 8 px. Six 40 × 40 px buttons, radius 12 px,
  4 px apart, 20 px icons, 1.5 px stroke, 60 % white.

| Dock state | Look |
|---|---|
| Active | Icon `#22c3d6`, fill `rgba(34,195,214,.14)`, 3 × 20 px cyan bar on the dock's left edge |
| Hover | Fill per 12.1; label tooltip to the right after 300 ms |
| Unavailable | Icon 35 % white, `aria-disabled`, focusable. Tooltip: "Open a run to see this" |
| Busy | 6 px cyan dot on Process while a run is active; red dot on Log after an error |

  With no run open, Brief, Analysis and Validation are unavailable and Overview is active. Opening
  a run switches to Brief. Clicking the active icon hides the panel.
- **Panel**: 384 px. Header 48 px (title, 32 px close button). Body padding 16 px, own scroll.
  Sections 24 px apart with a 1 px `rgba(255,255,255,.08)` rule. Only Process has a footer.

### 12.3 Run switcher popover

360 px wide, 8 px under the pill, max height 480 px. A 36 px search field appears above eight
runs. Grouped by track and frame (28 px header, 11/500, 60 % white), newest active date first.
Row, 52 px: 20 px band badge (L or S, mono 11/600, 1 px border); dates at 13/500; under them
crop, polarization and finish time at 11, 60 % white; right side a tick (open), a percentage
(running) or "Failed" in red. No areas in rows. Last row, 44 px: "New run", opens Process. Empty:
"No runs yet."

### 12.4 Brief

- **Headline**: label "Flood extent"; km² at 40 Inter Tight 600; acres at 16/500; then at 12/18,
  60 % white: "Water detected by radar that was not there on \<date\>. Not confirmed on the ground."
- **In this view**: one 32 px row. Recomputed 150 ms after the map stops; "—" while computing.
- **Hotspot row** (72 px, 1 px divider, ten rows):
  - Left, 20 px: rank, mono 11.
  - Line 1: place name 13/600, ellipsis; at the right km² 13/600 with acres 11 under it.
  - Line 2: 4 px confidence bar, high `#00a6c7` and medium `#42c6d5`, 2 px gap, widths by area.
  - Line 3: lat, lon in mono 11, 24 px copy button, then "Zoom" and "Open in OSM" at 11/500,
    always visible.
  - Hover outlines the region on the map in white, 2 px. Click zooms.
  - While the name loads, or if the lookup fails, the coordinates are the name. Empty: "No
    regions above the minimum size."
- **Trend**: 352 × 120 px, one km² axis. Bars: flood extent per period, `#00a6c7`, the open
  period at full opacity, others 45 %. A 1.5 px `#2166c1` line with 6 px dots: water on each date.
  Tooltip in km² and acres. Under two periods: "Trend needs two periods on this frame."
- **Confidence split**: one 8 px bar, percentages only (computed). Areas live in Analysis.
- **Take-away**: 2 × 2 grid of 40 px buttons, 8 px gaps. "Situation report" filled cyan with
  `#04121b` text; the other three outlined. A missing file disables its button.

### 12.5 Timeline and replay

- **Card**: 12 px from the bottom, 76 px high, width `min(720px, free width − 24px)`, padding
  12 px 16 px.
- **Axis**: 1 px line, one 8 px dot per acquisition, placed by date, at least 56 px apart. Under
  each dot: date in mono 11 ("31 Aug"), then "L", "S" or "L S" at 10 px. No run: hollow dot.
- **Spans**: 6 px bars, radius 3 px, in two fixed lanes above the axis, 4 px apart: L next to the
  axis, S above. L and S runs on the same dates stack and never overlap. Both lanes are always
  reserved, so the height never changes.
- **States**: idle 28 % white; hover 50 % white with a band-and-dates tooltip; selected `#22c3d6`,
  end dots cyan with a 3 px `rgba(34,195,214,.3)` ring; running 1 px dashed cyan outline; failed
  `#f87171`. Hit area 24 px high. Click opens the run.
- **Empty**: one acquisition shows "A run needs two dates." No frame: card hidden.
- **Replay pill**: 36 px high, 12 px above the card. A 36 px round play button and three 88 px
  segments, 13/500. Active: `rgba(255,255,255,.12)` fill, weight 600. "Detected" is disabled
  without a run.

### 12.6 Analysis and Validation

- **Threshold ruler**: 352 × 72 px SVG, one dB axis from 1 dB below the lowest marker to 1 dB
  above the highest, ticks each 1 dB, mono 10 labels each 2 dB. Applied threshold: 2 px cyan line,
  32 px tall, label above in mono 11/600. Raw Otsu: 8 px hollow diamond. Seed, growth: 1 px white
  ticks, 16 px, labels below. Min change: dashed tick. Floor: everything past it filled
  `rgba(255,255,255,.08)`. Growth-to-seed band tinted medium, past seed tinted high, both 30 %.
  Labels within 0.3 dB merge ("seed = applied"). A missing value drops its marker and is listed
  below as "—".
- **Validation without matching dates**: 24 px icon, "No Sentinel-2 comparison for these dates."
  at 13/500, no button, no greyed-out scores.

### 12.7 Process

Sections 16 px apart. Sliders: 4 px track, 16 px thumb, 72 px mono number field; the ruler sits
above and follows within one frame. Command preview: mono 11/18, `rgba(0,0,0,.35)`, radius 10 px,
padding 12 px, six lines then scroll, copy button. Download: 4 px bar plus "done of total" in
mono. Earthdata: chip "Signed in" or "Sign in needed" with a button. Footer: sticky, 64 px, one
40 px full-width cyan "Run" button, 14/600. Disabled: reason at 11 px above it ("Pick two
dates"). Running: "Running 42 %" with "Cancel". Failed: red line and "Open log".

### 12.8 Situation report (print)

A4 portrait, 16 mm margins, one page, white paper, black Inter, colour only on map and legend.

1. Header: wordmark, "Situation report", place, period, band, time generated; run id mono 8 pt.
2. Headline: "Flood extent", km² 28 pt 600, acres 14 pt, the note 9 pt.
3. Map, 178 × 110 mm: light basemap, classes, numbered hotspots, scale bar, north arrow, legend.
4. Hotspot table, ten 6 mm rows, 9 pt: rank, place, km², acres, high share, lat/lon.
5. Method and limits, 8 pt: sensor and product, dates, applied threshold, Sentinel-2 status.
6. Footer, 8 pt: data source, "Not confirmed on the ground", page number.

### 12.9 What we cut

- Runs rail and status bar (switcher, timeline and status chip cover them).
- Compare swipe.
- Class table and method card in Brief.
- Areas in the switcher, timeline tooltips and dock.
- Donuts, gauges, row sparklines, success toasts.
- A second accent, gradients outside the Overview hero, all-caps labels.
