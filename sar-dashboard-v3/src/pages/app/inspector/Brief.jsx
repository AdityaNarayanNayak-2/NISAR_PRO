// Parts of a run that a disaster authority acts on: flood extent, in-view sum, hotspots,
// confidence split and take-away files. The tabs in views/ put them together.
import { useMemo } from 'react'
import { useRunStore } from '../stores/useRunStore'
import { useMapStore } from '../stores/useMapStore'
import { gatewayUrl } from '../lib/gateway'
import { sumInBox, hotspotsCsv, hotspotsKml, hotspotsGpx } from '../lib/regions'
import { placeLabel } from '../lib/places'
import { formatArea, formatNumber } from '../lib/units'
import { mapHandle, freePadding } from '../map/mapHandle'
import Icon from '../ui/Icon'
import { site } from '../../../lib/site.js'

export function InView({ regions }) {
  const { viewBounds, aoi, picking, startPicking, setAoi } = useMapStore()
  const v = useMemo(() => sumInBox(regions, viewBounds), [regions, viewBounds])
  const d = useMemo(() => (aoi ? sumInBox(regions, aoi) : null), [regions, aoi])
  const row = (label, s, extra) => {
    const a = s ? formatArea(s.km2, s.acres) : null
    return (
      <div className="inview-row">
        <span className="k">{label}</span>
        <span className="v num">{a ? <>{a.km2} <span className="muted">· {a.acres} · {formatNumber(s.count)} areas</span></> : '—'}</span>
        {extra}
      </div>
    )
  }
  const whole = v && v.count === regions.length
  return (
    <div className="sec">
      {whole ? <div className="inview-row"><span className="k">In this view</span><span className="v muted" style={{ fontWeight: 400 }}>All {formatNumber(regions.length)} areas. Zoom in to sum a part.</span></div> : row('In this view', v)}
      {aoi
        ? row('In drawn area', d, <button type="button" className="link" onClick={() => setAoi(null)}>Clear</button>)
        : (
          <button type="button" className="btn btn-sm" style={{ marginTop: 8 }} aria-pressed={picking === 'aoi'} onClick={() => startPicking(picking === 'aoi' ? null : 'aoi')}>
            <Icon name="box" size={14} />{picking === 'aoi' ? 'Click two corners on the map…' : 'Draw an area'}
          </button>
        )}
      <div className="foot">Each area is counted where its centre lies. Areas are stored rounded, so sums can differ from the total by an acre.</div>
    </div>
  )
}

function hoverOnMap(id, on) {
  const m = mapHandle.current
  if (m?.getSource('regions')) m.setFeatureState({ source: 'regions', id }, { hover: on })
}

function HotspotRow({ r, rank, place, onCopy }) {
  const { selectedRegionId, selectRegion } = useMapStore()
  const a = formatArea(r.km2, r.acres)
  const total = r.high + r.med + r.low || 1
  const coords = `${r.lat.toFixed(5)}, ${r.lon.toFixed(5)}`
  const zoom = () => {
    selectRegion(r.id)
    mapHandle.current?.flyTo({ center: [r.lon, r.lat], zoom: Math.max(mapHandle.current.getZoom(), 11), duration: 700, padding: freePadding(0) })
  }
  return (
    <div className="hot" aria-current={selectedRegionId === r.id} onMouseEnter={() => hoverOnMap(r.id, true)} onMouseLeave={() => hoverOnMap(r.id, false)}>
      <span className="rank mono">{rank}</span>
      <div className="body">
        <div className="l1">
          <button type="button" className="name" onClick={zoom} title="Zoom to this area">{placeLabel(place) || coords}</button>
          <span className="area num"><b>{a.km2}</b><small>{a.acres}</small></span>
        </div>
        <div className="confbar" title={`High ${formatNumber((100 * r.high) / total)}% · medium ${formatNumber((100 * r.med) / total)}% of pixels`}>
          {r.high > 0 && <i style={{ flexGrow: r.high, background: '#3d8df0' }} />}
          {r.med > 0 && <i style={{ flexGrow: r.med, background: '#82b8f4' }} />}
          {r.low > 0 && <i style={{ flexGrow: r.low, background: '#c2dbf7' }} />}
        </div>
        <div className="l3">
          <span className="mono">{coords}</span>
          <button type="button" className="icon-btn xs" onClick={() => onCopy(coords)} aria-label="Copy coordinates" title="Copy coordinates"><Icon name="copy" size={12} /></button>
          <span className="grow" />
          <button type="button" className="link" onClick={zoom}>Zoom</button>
          <a className="link" href={`https://www.openstreetmap.org/?mlat=${r.lat}&mlon=${r.lon}#map=14/${r.lat}/${r.lon}`} target="_blank" rel="noreferrer">Open in OSM</a>
        </div>
      </div>
    </div>
  )
}

export function Hotspots({ list, places, mode, title = 'Largest areas', note, children }) {
  const toast = useRunStore((s) => s.toast)
  const copy = (t) => navigator.clipboard?.writeText(t).then(() => toast('Coordinates copied.', 'ok'))
  return (
    <div className="sec">
      <h3>{title} <span className="muted">top {list.length}</span></h3>
      {list.length === 0 && <div className="muted">No areas above the minimum size.</div>}
      {list.length > 0 && <div className="conf-legend hot-key"><span>Bar:</span><span><i style={{ background: '#3d8df0' }} />high</span><span><i style={{ background: '#82b8f4' }} />medium confidence</span></div>}
      {list.map((r, i) => <HotspotRow key={r.id} r={r} rank={i + 1} place={places[r.id]} onCopy={copy} />)}
      {note && <div className="foot">{note}</div>}
      {children}
      {mode === 'local' && <div className="foot">Place names: © OpenStreetMap contributors (nearest named place to the area centre).</div>}
    </div>
  )
}

export function Confidence({ split }) {
  if (!split.total) return null
  const pct = (v) => `${formatNumber((100 * v) / split.total)}%`
  return (
    <div className="sec">
      <h3>Confidence</h3>
      <div className="confbar big">
        {split.high > 0 && <i style={{ flexGrow: split.high, background: '#3d8df0' }} />}
        {split.med > 0 && <i style={{ flexGrow: split.med, background: '#82b8f4' }} />}
        {split.low > 0 && <i style={{ flexGrow: split.low, background: '#c2dbf7' }} />}
      </div>
      <div className="conf-legend">
        <span><i style={{ background: '#3d8df0' }} />High {pct(split.high)}</span>
        <span><i style={{ background: '#82b8f4' }} />Medium {pct(split.med)}</span>
        {split.low > 0 && <span><i style={{ background: '#c2dbf7' }} />Low {pct(split.low)}</span>}
      </div>
      <div className="foot">High: the radar dropped by more than the seed threshold. Medium: it dropped less, next to high areas. Share of pixels, computed.</div>
    </div>
  )
}

function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function TakeAway({ run, mode, list, places }) {
  const a = run.artifacts || {}
  const file = (label, path) => (
    <a className={`btn ${path ? '' : 'disabled'}`} href={path ? gatewayUrl(path, mode) : undefined} download target="_blank" rel="noreferrer" aria-disabled={!path}>{label}</a>
  )
  return (
    <div className="sec">
      <h3>Report and files</h3>
      <div className="take">
        <a className="btn btn-accent" href={site(`/app/report/${run.id}`)} target="_blank" rel="noreferrer"><Icon name="report" size={14} />Situation report</a>
        <button type="button" className="btn" disabled={!list.length} onClick={() => download(`${run.id}_hotspots.csv`, hotspotsCsv(list, places), 'text/csv')}>Hotspots CSV</button>
        <button type="button" className="btn" disabled={!list.length} onClick={() => download(`${run.id}_hotspots.kml`, hotspotsKml(list, places, `NISAR Pro ${run.id}`), 'application/vnd.google-earth.kml+xml')}>Waypoints · KML</button>
        <button type="button" className="btn" disabled={!list.length} onClick={() => download(`${run.id}_hotspots.gpx`, hotspotsGpx(list, places), 'application/gpx+xml')}>Waypoints · GPX</button>
        {file('Areas · GeoJSON', a.geojson)}
        {file('Classes · GeoTIFF', a.class_tif)}
      </div>
      <div className="files-more">
        {[['Report JSON', a.report], ['Class overlay PNG', a.overlay], ['Radar, active PNG', a.active_preview], ['Radar, baseline PNG', a.baseline_preview]].map(([l, p]) => p && <a key={l} className="link" href={gatewayUrl(p, mode)} download target="_blank" rel="noreferrer">{l}</a>)}
      </div>
    </div>
  )
}
