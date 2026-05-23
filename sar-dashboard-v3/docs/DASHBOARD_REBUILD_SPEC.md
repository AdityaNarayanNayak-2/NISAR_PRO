You are rebuilding AppDashboard.jsx for NISAR Pro.
A professional SAR satellite processing platform for 
NASA/ISRO/ESA scientists, civil engineers, and defense analysts.

PRESERVE COMPLETELY — do not touch:
- All useState hooks and names
- parseNisarFilename()
- Gateway health check useEffect
- Elapsed timer useEffect
- handleSearch()
- startJob()
- SSE parsing (georef, insar_report, ships_detected events)
- Job status polling useEffect
- formatBytes() and formatElapsed()
- jobsRef and elapsedRef patterns
- MapContainer and all its children (tile layer, overlays, markers)
- Terminal drawer logic and scroll behavior

WHAT CHANGES:
Replace the floating left panel entirely.
Add a profile switcher in a fixed topbar.
The right side becomes a context panel that changes per profile.

═══════════════════════════════════════
TOPBAR (fixed, height 40px, z-index 200)
═══════════════════════════════════════
Background: #111111
Border-bottom: 1px solid #2A2A2A

Left:
  "NISAR PRO" — Inter 600, 13px, #F0F0F0

  Profile switcher dropdown (right of title, separated by 1px #2A2A2A divider):
    Current profile shown as: "[SAR SCIENCE ▾]" 
    IBM Plex Mono 11px, letter-spacing 0.08em
    Color = profile accent color (see profiles below)
    Click toggles dropdown. Click outside closes.
    
    Dropdown options (no icons, no descriptions):
      SAR SCIENCE        accent: #9B8EC4
      INFRASTRUCTURE     accent: #C8A96E  
      MARITIME INTEL     accent: #4A8FA8
    
    Active option: left border 3px solid accent, background #1A1A1A
    Inactive: #888888 text, #111111 background
    Hover: #1A1A1A background

Right:
  Status dot + "ONLINE"/"OFFLINE" IBM Plex Mono 11px #888888
  Separator
  UTC clock, updates every second: "2026-05-15 · 14:32:07 UTC"
    IBM Plex Mono 11px #555555
  Separator  
  "← HOME" href="/" IBM Plex Mono 11px #555555

═══════════════════════════════════════
LAYOUT (below topbar)
═══════════════════════════════════════
Map: position absolute, inset 0, top 40px. Full remaining height.
Right panel: position absolute, top 40px, right 0, bottom 0, 
  width 340px, z-index 100
  Background #111111, border-left 1px solid #2A2A2A
  Display flex, flex-direction column, overflow hidden

═══════════════════════════════════════
RIGHT PANEL — PROFILE 1: SAR SCIENCE
═══════════════════════════════════════
Shown when profile = 'sar_science'

Scrollable content area. Padding 16px.
No rounded corners above 2px. No gradients. No glow.

SECTION: DATA SOURCE
  Label: IBM Plex Mono 10px #555555 letter-spacing 0.1em uppercase "DATA SOURCE"
  Two toggle buttons side by side: "LOCAL FILE" / "NASA CATALOG"
  Active: border-bottom 2px solid #C8A96E, color #F0F0F0
  Inactive: color #555555, border-bottom 2px solid transparent
  
  Local mode:
    Input field full width
    Background #1A1A1A, border 1px solid #2A2A2A
    Color #F0F0F0, IBM Plex Mono 12px
    Placeholder "/path/to/NISAR_*.h5" color #555555
    On focus: border 1px solid #404040
    
    If filename parsed (metadata exists):
      Show metadata rows:
        Each row: label #555555 left, value #F0F0F0 right
        IBM Plex Mono 11px, padding 3px 0, border-bottom 1px #1A1A1A
        Fields: Mission / Product / Level / Band / Orbit / Acquired
        Band value: #4CAF50

  Catalog mode:
    Date range: two inputs side by side
    Same input styling as above
    "SEARCH CATALOG" button full width
      Background transparent, border 1px solid #2A2A2A
      Color #888888, IBM Plex Mono 11px
      Hover: border #404040, color #F0F0F0
      Loading: "SEARCHING..."
    
    Results list: each scene
      Padding 8px, border-bottom 1px #1A1A1A
      Selected: border-left 3px solid #C8A96E, padding-left 13px
      Scene ID: IBM Plex Mono 10px #888888
      Date + size: IBM Plex Mono 10px #555555

DIVIDER: 1px #2A2A2A full width, margin 16px 0

SECTION: PROCESSING PIPELINE
  Label: IBM Plex Mono 10px #555555 "PIPELINE"
  
  Each pipeline option:
    Padding 8px 12px, cursor pointer
    Selected: border-left 3px solid #C8A96E, background rgba(200,169,110,0.06)
    Hover: background #1A1A1A
    Name: IBM Plex Mono 12px #F0F0F0 when selected, #888888 when not
    Description: Inter 11px #555555, margin-top 2px
  
  Pipelines for SAR SCIENCE:
    standard_rda / "Standard SAR Focus" / "Range-Doppler + RCMC + speckle filter"
    polsar / "Polarimetric" / "Pauli decomposition RGB (HH, HV, VV)"
    insar / "InSAR Analysis" / "Interferometric phase + displacement"
    cfar / "Maritime CFAR" / "CA-CFAR vessel detection"

DIVIDER

SECTION: EXECUTE
  "START PROCESSING" button full width
  Background #C8A96E, color #0A0A0A, font-weight 600
  IBM Plex Mono 12px, padding 10px
  Disabled: opacity 0.3, cursor not-allowed
  Running: "PROCESSING..." disabled
  
  Progress indicator when running:
    2 rows IBM Plex Mono 10px #555555:
      "ELAPSED  {time}"
      "JOB ID   {id shortened to 8 chars}"

DIVIDER

SECTION: RESULTS (only when jobs exist)
  Label: IBM Plex Mono 10px #555555 "COMPLETED JOBS"
  
  Each job:
    Padding 8px, border-bottom 1px #1A1A1A
    Name: IBM Plex Mono 11px #888888 (filename)
    Status icon + elapsed right-aligned
    Completed: two small buttons side by side
      "VIEW" — border 1px #2A2A2A, color #4CAF50, IBM Plex Mono 10px
      "DL" — border 1px #2A2A2A, color #888888, IBM Plex Mono 10px

═══════════════════════════════════════
RIGHT PANEL — PROFILE 2: INFRASTRUCTURE
═══════════════════════════════════════
Shown when profile = 'infrastructure'

SECTION: ASSET SELECTION
  Label: IBM Plex Mono 10px #555555 "MONITORED ASSET"
  
  Dropdown to select asset type:
    DAM / BRIDGE / EMBANKMENT
    Background #1A1A1A, border 1px #2A2A2A
    IBM Plex Mono 12px #F0F0F0
  
  Asset name input:
    Placeholder "e.g. Hirakud Dam, Odisha"
    Same input styling

  Coordinates input (auto-filled if known asset):
    Two inputs side by side: LAT / LON
    IBM Plex Mono 11px

SECTION: ENVIRONMENTAL CONTEXT
  Label: IBM Plex Mono 10px #555555 "FIELD CONTEXT"
  
  This is the Hirakud Dam panel concept.
  Shows real data fetched from free APIs.
  
  Context rows — each is a data-row:
    RESERVOIR    "{level}m / {capacity}m ({pct}%)"
    RAINFALL 72H "{mm}mm"  
    SOIL MOIST.  "{anomaly}% anomaly"
    SEISMIC      "None ({days}d, {radius}km)" or magnitude
    SEASON       "{name} (typical {range}%)"
  
  Values: IBM Plex Mono 12px #F0F0F0
  Labels: IBM Plex Mono 10px #555555
  
  Below rows:
    ASSESSMENT: Inter 12px #F0F0F0 (e.g. "Hydrostatic loading")
    CONFIDENCE: IBM Plex Mono 11px #4CAF50/#E6A817/#C0392B
    SOURCE: IBM Plex Mono 10px #555555 "ERA5, GRanD, USGS, SMAP"
  
  "FETCH CONTEXT" button when coordinates entered
    Same ghost button style
  
  Loading state: "FETCHING FIELD DATA..."
  
  Store context in state: envContext object.
  Fetch from gateway: GET /context?lat={lat}&lon={lon}&asset_type={type}
  Gateway stub is fine — just wire the fetch call.
  Show "CONTEXT UNAVAILABLE" if fetch fails, not an error state.

DIVIDER

SECTION: DATA SOURCE
  Same as SAR Science but pipeline locked to "insar" only
  Show pipeline as static text, not selectable:
    "PIPELINE  InSAR Analysis" as a data row

DIVIDER

SECTION: EXECUTE
  Same button as SAR Science

DIVIDER

SECTION: INSAR RESULTS
  Only shown when viewingResult exists AND viewingResult.insarReport

  HEALTH MATRIX — 2x2 grid, no gap, 1px border between cells (#2A2A2A):
    STABLE    {stable_count}     color #4CAF50
    CAUTION   {caution_count}    color #E6A817
    ALERT     {alert_count}      color #D4822A
    CRITICAL  {critical_count}   color #C0392B
    
    Numbers: IBM Plex Mono 22px font-weight 600
    Labels: IBM Plex Mono 9px #555555 above each number
    If critical_count > 0: that cell gets border 1px solid #C0392B
  
  Below matrix:
    MAX DISPLACEMENT row:
      Value: "{max_displacement_mm} mm"
      If negative: append "(SUBSIDENCE)" color #E6A817
      Color by magnitude:
        < 5mm:  #4CAF50
        < 10mm: #E6A817
        < 20mm: #D4822A
        >= 20mm: #C0392B
    
    MEDIAN row: same style smaller
    TOTAL PS POINTS row
  
  Top 10 scatterers table:
    IBM Plex Mono 10px per row
    Columns: rank / displacement / coherence / severity
    Color displacement by severity

═══════════════════════════════════════
RIGHT PANEL — PROFILE 3: MARITIME INTEL
═══════════════════════════════════════
Shown when profile = 'maritime'

SECTION: AREA OF INTEREST
  Label: IBM Plex Mono 10px #555555 "SEARCH AREA"
  Same ASF catalog search as SAR Science
  Default dates: last 30 days
  Pipeline locked to cfar (show as static row)

DIVIDER

SECTION: EXECUTE
  Same button

DIVIDER

SECTION: DETECTION RESULTS
  Only when viewingResult exists AND viewingResult.ships

  Large number: IBM Plex Mono 32px #C0392B font-weight 600
    "{ships.length}"
  "VESSELS DETECTED" IBM Plex Mono 10px #888888

  Stats rows:
    MAX BACKSCATTER / mean / min
    IBM Plex Mono 11px, values in #7EB8D4
  
  Vessel list:
    Each row: "V{n}  {lat}°N  {lon}°E  {intensity}dB"
    IBM Plex Mono 10px #888888
    Hover: background #1A1A1A
    Selected: border-left 3px solid #4A8FA8

═══════════════════════════════════════
DESIGN RULES — NON-NEGOTIABLE
═══════════════════════════════════════
1. Colors used: #0A0A0A #111111 #1A1A1A #2A2A2A #404040
   #C8A96E #9B8EC4 #4A8FA8 #F0F0F0 #888888 #555555
   #4CAF50 #E6A817 #D4822A #C0392B #7EB8D4
   NOTHING ELSE. No other hex values. No rgba except accent-dim.

2. Fonts: Inter for UI labels, IBM Plex Mono for ALL data/values/mono.
   Import both from Google Fonts in the component or assume they're 
   in index.html already.

3. Border-radius: maximum 2px. Nowhere higher.

4. No gradients anywhere. No box-shadow except inset left-border effect.

5. No framer-motion animation except the terminal drawer height transition.
   Remove AnimatePresence and motion.div from the panel content.
   Keep them only if they were already on the terminal.

6. Topbar + right panel use inline styles for layout/position.
   Component-level styles for colors/typography.
   Keep existing map overlay styles exactly as they are.

7. The map tile layer stays: 
   ArcGIS World Dark Gray — do not change it.

8. Coordinate HUD stays at bottom left, above terminal.
   Style: IBM Plex Mono 11px #7EB8D4, background #111111, 
   border 1px #2A2A2A, padding 4px 10px.

9. Terminal drawer: same behavior as current, just restyled.
   Background #0A0A0A, text #555555 default.
   Error lines: #C0392B. Success: #4CAF50. System: #7EB8D4.

10. Profile state: useState at top of AppDashboard.
    const [profile, setProfile] = useState('sar_science')
    No external store needed for this session.
    
Provide the complete AppDashboard.jsx.
Do not truncate. Show the entire file.

═══════════════════════════════════════
ASF DOWNLOAD FLOW (replaces local path paste)
═══════════════════════════════════════
When user selects a scene from catalog results
and hits "ACQUIRE + PROCESS":

1. POST /asf/download { granule_id, download_url }
   Show download progress from SSE:
   { "status": "downloading", "progress": 45 }
   
   In right panel replace button with:
   "DOWNLOADING  45%" IBM Plex Mono 12px #E6A817
   Progress bar: thin 2px line, #1A1A1A background,
   #C8A96E fill, width = progress%
   No animation — just width update.

2. On { "status": "download_complete", "path": "..." }:
   Automatically POST /asf/process { file_path }
   Panel updates to "PROCESSING..." state
   Terminal drawer opens automatically

3. Local file mode still works exactly as before.
   User pastes path → hits START PROCESSING →
   POST /jobs directly (existing flow)

═══════════════════════════════════════
TILAYER INSTEAD OF IMAGEOVERLAY
═══════════════════════════════════════
When viewingResult arrives from completed job:

Replace:
  <ImageOverlay url={viewingResult.url} bounds={...} />

With:
  <TileLayer
    url={`http://localhost:8000/cog/tiles/WebMercatorQuad/{z}/{x}/{y}@2x?url=${encodeURIComponent(viewingResult.url)}`}
    attribution=""
    opacity={0.75}
  />

Import TileLayer from react-leaflet (already imported).
TileLayer only renders when viewingResult is not null.
Keep the GeoJSON footprint overlay — that stays.
Keep InSAR CircleMarkers — those stay.
Keep ship CircleMarkers — those stay.

If viewingResult.url does not start with "file://" 
or "http://localhost:8000":
  Fall back to ImageOverlay (backward compatibility
  for any old PNG results still in jobs state).

═══════════════════════════════════════
DOWNLOAD PROGRESS STATE
═══════════════════════════════════════
Add to useState:
  const [downloadProgress, setDownloadProgress] = useState(null)
  // null = not downloading, 0-100 = progress, 'complete' = done

Add handleAcquireAndProcess():
  async function handleAcquireAndProcess() {
    if (!selectedScene) return
    setDownloadProgress(0)
    setTerminalOpen(true)
    
    const downloadSse = new EventSource(
      api(`/asf/download-stream?granule_id=${selectedScene.id}&url=${encodeURIComponent(selectedScene.download_url)}`)
    )
    
    downloadSse.onmessage = (e) => {
      const data = JSON.parse(e.data)
      if (data.status === 'downloading') {
        setDownloadProgress(data.progress)
      }
      if (data.status === 'download_complete') {
        downloadSse.close()
        setDownloadProgress('complete')
        // trigger processing
        startJobFromPath(data.path)
      }
    }
    downloadSse.onerror = () => {
      downloadSse.close()
      setDownloadProgress(null)
      showError('Download failed')
    }
  }

Add startJobFromPath(filePath):
  Same as startJob() but takes path directly
  instead of reading from getInputFile()