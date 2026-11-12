// The only file that talks to MapLibre. It owns every image and vector layer of the open run.
import { useEffect, useMemo, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import { useRunStore } from '../stores/useRunStore'
import { useMapStore } from '../stores/useMapStore'
import { gatewayUrl } from '../lib/gateway'
import { paintClasses } from '../lib/classRaster'
import { formatArea, KM2_PER_ACRE } from '../lib/units'
import MapControls from './MapControls'
import AreaCard from './AreaCard'
import { regionList, hotspots } from '../lib/regions'
import { mapHandle, fitBbox, freePadding } from './mapHandle'
import { granuleTrackFrame } from '../lib/report'
import { runStatus } from '../lib/gateway'

// Dark satellite basemap: Esri World Imagery, desaturated and dimmed so the flood classes carry
// the colour, with Esri boundaries and place names on top. "Plain" hides the imagery.
// Offline, tiles simply don't load; the dark background and our layers still work.
const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services'
const STYLE = {
  version: 8,
  sources: {
    imagery: { type: 'raster', tiles: [`${ESRI}/World_Imagery/MapServer/tile/{z}/{y}/{x}`], tileSize: 256, maxzoom: 19, attribution: 'Imagery © Esri, Maxar, Earthstar Geographics, and the GIS User Community' },
    labels: { type: 'raster', tiles: [`${ESRI}/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}`], tileSize: 256, maxzoom: 19, attribution: 'Boundaries and places © Esri' },
  },
  layers: [
    { id: 'background', type: 'background', paint: { 'background-color': '#0b0c0e' } },
    { id: 'imagery', type: 'raster', source: 'imagery', paint: { 'raster-brightness-max': 0.55, 'raster-contrast': 0.22, 'raster-saturation': -0.72, 'raster-fade-duration': 150 } },
    { id: 'labels', type: 'raster', source: 'labels', paint: { 'raster-opacity': 0.5, 'raster-fade-duration': 150 } },
  ],
}
const BEFORE = 'labels' // run layers sit on the imagery, below boundaries and place names
// Zoomed in, image pixels are drawn as sharp 80 m squares; zoomed out they are smoothed.
const SHARP_FROM_ZOOM = 10
const resampling = (map) => (map.getZoom() >= SHARP_FROM_ZOOM ? 'nearest' : 'linear')

const CLASS_COLOR = ['match', ['get', 'class_code'], 2, '#3d8df0', 3, '#82b8f4', 4, '#c2dbf7', '#ffffff']

function corners(b) {
  return [[b.west, b.north], [b.east, b.north], [b.east, b.south], [b.west, b.south]]
}

function beforeId(map) {
  return map.getLayer(BEFORE) ? BEFORE : undefined
}

function setImage(map, id, url, bbox, opacity, visible) {
  const src = map.getSource(id)
  if (!url || !bbox) {
    if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'none')
    return
  }
  const coordinates = corners(bbox)
  if (!src) {
    map.addSource(id, { type: 'image', url, coordinates })
    map.addLayer({ id, type: 'raster', source: id, paint: { 'raster-opacity': opacity, 'raster-fade-duration': 250, 'raster-resampling': resampling(map) } }, beforeId(map))
  } else if (src._ws_url !== url) {
    src.updateImage({ url, coordinates })
  }
  if (map.getSource(id)) map.getSource(id)._ws_url = url
  map.setPaintProperty(id, 'raster-opacity', opacity)
  map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none')
}

export default function MapView() {
  const el = useRef(null)
  const [map, setMap] = useState(null)
  const [tip, setTip] = useState(null)
  const mode = useRunStore((s) => s.mode)
  const openId = useRunStore((s) => s.openId)
  const run = useRunStore((s) => s.runs.find((r) => r.id === s.openId))
  const regions = useRunStore((s) => (s.openId ? s.regions[s.openId] : null))
  const loadRegions = useRunStore((s) => s.loadRegions)
  const { phase, layers, opacity, selectedRegionId, selectRegion, setCursor, resetForRun, setViewBounds, picking, preview, aoi, basemap, labels } = useMapStore()
  const fitted = useRef(null)
  const classUrl = useRef(null)

  // Create the map once.
  useEffect(() => {
    const m = new maplibregl.Map({
      container: el.current,
      style: STYLE,
      center: [82, 23],
      zoom: 3.6,
      attributionControl: { compact: true },
      dragRotate: false,
      pitchWithRotate: false,
    })
    m.touchZoomRotate.disableRotation()
    m.on('error', () => {}) // missing basemap tiles (offline) are not an error for the user
    m.on('load', () => setMap(m))
    m.on('zoomend', () => {
      for (const id of ['run-radar', 'run-classes']) if (m.getLayer(id)) m.setPaintProperty(id, 'raster-resampling', resampling(m))
    })
    mapHandle.current = m
    let raf = 0
    m.on('mousemove', (e) => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => setCursor({ lat: e.lngLat.lat, lon: e.lngLat.lng }))
    })
    const ro = new ResizeObserver(() => m.resize())
    ro.observe(el.current)
    return () => { ro.disconnect(); m.remove(); mapHandle.current = null }
  }, [setCursor])

  // Basemap: dark satellite, or plain dark with boundaries and names only.
  useEffect(() => {
    if (map?.getLayer('imagery')) map.setLayoutProperty('imagery', 'visibility', basemap === 'plain' ? 'none' : 'visible')
  }, [map, basemap])
  useEffect(() => {
    if (map?.getLayer('labels')) map.setLayoutProperty('labels', 'visibility', labels ? 'visible' : 'none')
  }, [map, labels])

  // New run: reset view state, fetch regions, fit bounds once.
  useEffect(() => {
    resetForRun()
    if (openId) loadRegions(openId)
  }, [openId, loadRegions, resetForRun])

  useEffect(() => {
    if (!map || !run?.bbox || fitted.current === run.id) return
    fitted.current = run.id
    fitBbox(run.bbox)
  }, [map, run?.id, run?.bbox])

  // Home (no run open): only scene footprints are drawn, one per track and frame.
  const runs = useRunStore((s) => s.runs)
  const footprints = useMemo(() => {
    const byKey = new Map()
    for (const r of runs) {
      if (!r.bbox || runStatus(r).kind !== 'completed') continue
      const tf = granuleTrackFrame(r.summary?.active_id || r.request?.input_file)
      const key = tf ? `Track ${tf.track} · Frame ${tf.frame}` : `${r.bbox.west.toFixed(2)},${r.bbox.south.toFixed(2)}`
      const f = byKey.get(key) || { key, bbox: { ...r.bbox }, count: 0 }
      f.count += 1
      f.bbox.west = Math.min(f.bbox.west, r.bbox.west); f.bbox.east = Math.max(f.bbox.east, r.bbox.east)
      f.bbox.south = Math.min(f.bbox.south, r.bbox.south); f.bbox.north = Math.max(f.bbox.north, r.bbox.north)
      byKey.set(key, f)
    }
    return [...byKey.values()]
  }, [runs])

  const footprintsRef = useRef([])
  const homeFit = useRef(null)
  useEffect(() => { footprintsRef.current = footprints }, [footprints])

  useEffect(() => {
    if (!map) return
    const data = {
      type: 'FeatureCollection',
      features: footprints.map((f, i) => ({
        type: 'Feature', id: i,
        properties: { label: `${f.key} · ${f.count} run${f.count > 1 ? 's' : ''}`, i },
        geometry: { type: 'Polygon', coordinates: [[...corners(f.bbox), corners(f.bbox)[0]]] },
      })),
    }
    const src = map.getSource('footprints')
    if (src) { src.setData(data); return }
    map.addSource('footprints', { type: 'geojson', data })
    map.addLayer({ id: 'footprints-fill', type: 'fill', source: 'footprints', paint: { 'fill-color': '#ffffff', 'fill-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 0.1, 0.03] } })
    map.addLayer({ id: 'footprints-line', type: 'line', source: 'footprints', paint: { 'line-color': '#e2e4e9', 'line-opacity': 0.8, 'line-width': 1.2, 'line-dasharray': [3, 2] } })
    let hovered = null
    map.on('mousemove', 'footprints-fill', (e) => {
      const f = e.features?.[0]
      if (!f) return
      if (hovered != null) map.setFeatureState({ source: 'footprints', id: hovered }, { hover: false })
      hovered = f.id
      map.setFeatureState({ source: 'footprints', id: hovered }, { hover: true })
      map.getCanvas().style.cursor = 'pointer'
      setTip({ x: e.point.x, y: e.point.y, text: `${f.properties.label} · click to zoom` })
    })
    map.on('mouseleave', 'footprints-fill', () => {
      if (hovered != null) map.setFeatureState({ source: 'footprints', id: hovered }, { hover: false })
      hovered = null
      map.getCanvas().style.cursor = ''
      setTip(null)
    })
    map.on('click', 'footprints-fill', (e) => {
      if (useMapStore.getState().picking) return
      const f = e.features?.[0]
      const fp = footprintsRef.current[f?.properties?.i]
      if (fp) fitBbox(fp.bbox)
    })
  }, [map, footprints])

  useEffect(() => {
    if (!map?.getLayer('footprints-fill')) return
    for (const id of ['footprints-fill', 'footprints-line']) map.setLayoutProperty(id, 'visibility', openId ? 'none' : 'visible')
    if (openId) { homeFit.current = null; return }
    fitted.current = null
    // Fit once per visit to the home view (and again when the first footprint arrives).
    const key = `home:${footprints.length > 0}`
    if (homeFit.current === key) return
    homeFit.current = key
    // Show every footprint, or India when there are none.
    if (footprints.length) {
      const b = footprints.reduce((a, f) => ({ west: Math.min(a.west, f.bbox.west), east: Math.max(a.east, f.bbox.east), south: Math.min(a.south, f.bbox.south), north: Math.max(a.north, f.bbox.north) }), { ...footprints[0].bbox })
      const pad = 2.5 // degrees of context around the scenes
      fitBbox({ west: b.west - pad, east: b.east + pad, south: b.south - pad, north: b.north + pad })
    } else {
      map.easeTo({ center: [82, 23], zoom: 3.6, padding: freePadding(0), duration: 700 })
    }
  }, [map, openId, footprints])

  // Radar preview: baseline or active image depending on the replay phase.
  useEffect(() => {
    if (!map) return
    const a = run?.artifacts || {}
    const url = phase === 'baseline' ? a.baseline_preview : a.active_preview
    setImage(map, 'run-radar', gatewayUrl(url, mode), run?.bbox, phase === 'detected' ? 0.65 : 1, layers.radar !== false || phase !== 'detected')
  }, [map, run, phase, layers.radar, mode])

  // Class overlay, repainted when classes are switched.
  useEffect(() => {
    if (!map) return
    const url = gatewayUrl(run?.artifacts?.overlay, mode)
    if (!url || !run?.bbox) {
      setImage(map, 'run-classes', null)
      return
    }
    let cancelled = false
    const visible = { 1: layers[1], 2: layers[2], 3: layers[3], 4: layers[4], 5: layers[5] }
    paintClasses(url, visible)
      .then((blobUrl) => {
        if (cancelled) return URL.revokeObjectURL(blobUrl)
        setImage(map, 'run-classes', blobUrl, run.bbox, opacity, phase === 'detected')
        if (classUrl.current) setTimeout(((old) => () => URL.revokeObjectURL(old))(classUrl.current), 1000)
        classUrl.current = blobUrl
      })
      .catch(() => setImage(map, 'run-classes', url, run.bbox, opacity, phase === 'detected'))
    return () => { cancelled = true }
    // opacity and phase are applied by the effect below without repainting.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, run?.id, run?.artifacts?.overlay, layers[1], layers[2], layers[3], layers[4], layers[5], mode])

  useEffect(() => {
    if (!map?.getLayer('run-classes')) return
    map.setPaintProperty('run-classes', 'raster-opacity', opacity)
    map.setLayoutProperty('run-classes', 'visibility', phase === 'detected' ? 'visible' : 'none')
  }, [map, opacity, phase])

  // Region polygons: invisible fill for hover/click, outlines for hover and selection.
  useEffect(() => {
    if (!map) return
    const data = regions?.status === 'ok' ? regions.data : { type: 'FeatureCollection', features: [] }
    const src = map.getSource('regions')
    if (src) src.setData(data)
    else {
      map.addSource('regions', { type: 'geojson', data, promoteId: 'region_id' })
      map.addLayer({ id: 'regions-hit', type: 'fill', source: 'regions', paint: { 'fill-color': CLASS_COLOR, 'fill-opacity': 0 } }, beforeId(map))
      // Crisp class-coloured edges once zoomed in, like vector polygons, over the pixel layer.
      map.addLayer({ id: 'regions-edge', type: 'line', source: 'regions', minzoom: 9, paint: { 'line-color': CLASS_COLOR, 'line-width': 0.8, 'line-opacity': ['interpolate', ['linear'], ['zoom'], 9, 0, 11, 0.9] } }, beforeId(map))
      map.addLayer({ id: 'regions-hover', type: 'line', source: 'regions', paint: { 'line-color': '#ffffff', 'line-width': ['case', ['boolean', ['feature-state', 'hover'], false], 1.5, 0] } }, beforeId(map))
      map.addLayer({ id: 'regions-selected-halo', type: 'line', source: 'regions', filter: ['==', ['get', 'region_id'], ''], paint: { 'line-color': '#07090d', 'line-width': 5 } }, beforeId(map))
      map.addLayer({ id: 'regions-selected', type: 'line', source: 'regions', filter: ['==', ['get', 'region_id'], ''], paint: { 'line-color': '#ffffff', 'line-width': 2 } }, beforeId(map))
      let hovered = null
      map.on('mousemove', 'regions-hit', (e) => {
        const f = e.features?.[0]
        if (!f) return
        if (hovered != null) map.setFeatureState({ source: 'regions', id: hovered }, { hover: false })
        hovered = f.id
        map.setFeatureState({ source: 'regions', id: hovered }, { hover: true })
        map.getCanvas().style.cursor = 'pointer'
        const p = f.properties
        const a = formatArea(Number(p.area_acres) * KM2_PER_ACRE, Number(p.area_acres))
        setTip({ x: e.point.x, y: e.point.y, text: `${p.region_id} · ${String(p.confidence || '').toLowerCase()} confidence · ${a.km2} · ${a.acres}` })
      })
      map.on('mouseleave', 'regions-hit', () => {
        if (hovered != null) map.setFeatureState({ source: 'regions', id: hovered }, { hover: false })
        hovered = null
        map.getCanvas().style.cursor = ''
        setTip(null)
      })
      map.on('click', (e) => {
        if (useMapStore.getState().picking) return
        const f = map.queryRenderedFeatures(e.point, { layers: ['regions-hit'] })[0]
        useMapStore.getState().selectRegion(f ? f.properties.region_id : null)
      })
    }
  }, [map, regions])

  // Regions are only interactive where new water is shown.
  useEffect(() => {
    if (!map?.getLayer('regions-hit')) return
    const on = phase === 'detected'
    const visibleCodes = [2, 3, 4].filter((c) => layers[c])
    const filter = ['in', ['get', 'class_code'], ['literal', visibleCodes]]
    for (const id of ['regions-hit', 'regions-edge', 'regions-hover']) {
      map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none')
      map.setFilter(id, filter)
    }
  }, [map, phase, layers, regions])

  useEffect(() => {
    if (!map?.getLayer('regions-selected')) return
    const f = ['==', ['get', 'region_id'], selectedRegionId || '']
    map.setFilter('regions-selected', f)
    map.setFilter('regions-selected-halo', f)
  }, [map, selectedRegionId, regions])

  // Numbered pins at the centres of the 10 largest areas (same ranking as the panel lists).
  const regionRows = useMemo(() => (regions?.status === 'ok' ? regionList(regions.data) : []), [regions])
  const top = useMemo(() => hotspots(regionRows, 10), [regionRows])
  useEffect(() => {
    const floodOn = layers[2] || layers[3] || layers[4]
    if (!map || phase !== 'detected' || !top.length || !floodOn) return
    const markers = top.map((r, i) => {
      const el = document.createElement('button')
      el.type = 'button'
      el.className = 'pin'
      el.textContent = String(i + 1)
      el.setAttribute('aria-label', `Area ${i + 1}`)
      el.addEventListener('click', (e) => { e.stopPropagation(); useMapStore.getState().selectRegion(r.id) })
      return new maplibregl.Marker({ element: el }).setLngLat([r.lon, r.lat]).addTo(map)
    })
    return () => markers.forEach((m) => m.remove())
  }, [map, top, phase, layers])
  const selected = useMemo(() => regionRows.find((r) => r.id === selectedRegionId) || null, [regionRows, selectedRegionId])
  const selectedRank = selected ? top.findIndex((r) => r.id === selected.id) + 1 : 0

  // Visible part of the map between the panels, for "In this view" and catalog search.
  useEffect(() => {
    if (!map) return
    const upd = () => {
      const pad = freePadding(0)
      const c = map.getContainer()
      const p = typeof pad === 'number' ? { top: pad, left: pad, right: pad, bottom: pad } : pad
      const nw = map.unproject([p.left, p.top])
      const se = map.unproject([c.clientWidth - p.right, c.clientHeight - p.bottom])
      setViewBounds({ west: nw.lng, north: nw.lat, east: se.lng, south: se.lat })
    }
    let t = 0
    const later = () => { clearTimeout(t); t = setTimeout(upd, 150) }
    upd()
    map.on('moveend', later)
    window.addEventListener('resize', later)
    return () => { clearTimeout(t); map.off('moveend', later); window.removeEventListener('resize', later) }
  }, [map, setViewBounds])

  // Outlines: crop box / catalog footprint (preview), drawn area (aoi), box being drawn (draft).
  useEffect(() => {
    if (!map) return
    const empty = { type: 'FeatureCollection', features: [] }
    if (!map.getSource('shapes')) {
      map.addSource('shapes', { type: 'geojson', data: empty })
      map.addLayer({ id: 'shapes-fill', type: 'fill', source: 'shapes', filter: ['==', ['get', 'kind'], 'aoi'], paint: { 'fill-color': '#ffffff', 'fill-opacity': 0.05 } })
      map.addLayer({ id: 'shapes-line', type: 'line', source: 'shapes', paint: {
        'line-color': '#ffffff',
        'line-width': 1.5,
        'line-dasharray': [2, 2],
      } })
    }
    const box = (b) => ({ type: 'Polygon', coordinates: [[[b.west, b.north], [b.east, b.north], [b.east, b.south], [b.west, b.south], [b.west, b.north]]] })
    const feats = []
    if (preview) feats.push({ type: 'Feature', properties: { kind: 'preview' }, geometry: preview })
    if (aoi && openId) feats.push({ type: 'Feature', properties: { kind: 'aoi' }, geometry: box(aoi) })
    map.getSource('shapes').setData({ type: 'FeatureCollection', features: feats })
  }, [map, preview, aoi, openId])

  // Picking on the map: a centre point, or a box from two clicks.
  useEffect(() => {
    if (!map || !picking) return
    const canvas = map.getCanvas()
    canvas.style.cursor = 'crosshair'
    let first = null
    const bboxOf = (a, b) => ({ west: Math.min(a.lng, b.lng), east: Math.max(a.lng, b.lng), south: Math.min(a.lat, b.lat), north: Math.max(a.lat, b.lat) })
    const draft = (b) => {
      const src = map.getSource('shapes')
      if (!src) return
      const g = { type: 'Polygon', coordinates: [[[b.west, b.north], [b.east, b.north], [b.east, b.south], [b.west, b.south], [b.west, b.north]]] }
      src.setData({ type: 'FeatureCollection', features: [{ type: 'Feature', properties: { kind: 'draft' }, geometry: g }] })
    }
    const onClick = (e) => {
      const st = useMapStore.getState()
      if (picking === 'centre') return st.finishPicking({ kind: 'centre', lat: e.lngLat.lat, lon: e.lngLat.lng })
      if (!first) { first = e.lngLat; return }
      const b = bboxOf(first, e.lngLat)
      first = null
      st.finishPicking({ kind: 'box', bbox: b })
    }
    const onMove = (e) => { if (first) draft(bboxOf(first, e.lngLat)) }
    const onKey = (e) => { if (e.key === 'Escape') useMapStore.getState().startPicking(null) }
    map.on('click', onClick)
    map.on('mousemove', onMove)
    window.addEventListener('keydown', onKey)
    return () => {
      canvas.style.cursor = ''
      map.off('click', onClick)
      map.off('mousemove', onMove)
      window.removeEventListener('keydown', onKey)
    }
  }, [map, picking])

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') selectRegion(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectRegion])

  return (
    <div className="ws-map" data-panel="map">
      <div ref={el} className="map-canvas" aria-label="Map" />
      {tip && <div className="map-tip" style={{ left: tip.x, top: tip.y }}>{tip.text}</div>}
      {picking && <div className="pick-hint glass">{picking === 'centre' ? 'Click the map to set the centre' : 'Click two corners on the map'} · Esc to cancel</div>}
      {selected && phase === 'detected' && <AreaCard map={map} region={selected} rank={selectedRank} run={run} />}
      <MapControls />
    </div>
  )
}
