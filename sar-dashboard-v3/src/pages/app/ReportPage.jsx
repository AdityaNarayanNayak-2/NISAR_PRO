// Situation report: one A4 page to print or save as PDF (Design Spec §12.8).
// Everything is read from the run's files; nothing is recomputed except labelled sums.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import '@fontsource-variable/inter'
import { detectMode, fetchRuns, fetchJson, gatewayUrl } from './lib/gateway'
import { parseReport, CLASSES, granuleTime, sensorName } from './lib/report'
import useDistricts from './inspector/useDistricts'
import { regionList, hotspots } from './lib/regions'
import { placeFor, placeLabel } from './lib/places'
import { loadReference, testsForRun } from './lib/validation'
import { formatArea, formatDate, formatDb, formatNumber } from './lib/units'
import { paintClasses } from './lib/classRaster'
import './report.css'
import { site } from '../../lib/site.js'

const LIGHT = 'https://tiles.openfreemap.org/styles/positron'

/** Lat/lon lines every `step` degrees inside the bounds, with edge labels. */
function graticule(b) {
  const span = Math.max(b.east - b.west, b.north - b.south)
  const step = [0.1, 0.25, 0.5, 1, 2, 5].find((s) => span / s <= 8) || 10
  const lines = [], labels = []
  for (let x = Math.ceil(b.west / step) * step; x <= b.east; x += step) {
    lines.push({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [[x, b.south - 1], [x, b.north + 1]] } })
    labels.push({ lon: x, lat: null, text: `${Math.abs(x).toFixed(step < 1 ? 2 : 0)}°${x >= 0 ? 'E' : 'W'}` })
  }
  for (let y = Math.ceil(b.south / step) * step; y <= b.north; y += step) {
    lines.push({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [[b.west - 1, y], [b.east + 1, y]] } })
    labels.push({ lon: null, lat: y, text: `${Math.abs(y).toFixed(step < 1 ? 2 : 0)}°${y >= 0 ? 'N' : 'S'}` })
  }
  return { fc: { type: 'FeatureCollection', features: lines }, labels }
}

function MapFigure({ run, mode, top, grid = false, className = 'rp-map' }) {
  const el = useRef(null)
  useEffect(() => {
    if (!run?.bbox || !el.current) return
    const b = run.bbox
    const m = new maplibregl.Map({ container: el.current, style: LIGHT, bounds: [[b.west, b.south], [b.east, b.north]], fitBoundsOptions: { padding: 10 }, interactive: false, attributionControl: false, preserveDrawingBuffer: true })
    m.on('load', async () => {
      const coords = [[b.west, b.north], [b.east, b.north], [b.east, b.south], [b.west, b.south]]
      const before = m.getLayer('boundary_state') ? 'boundary_state' : undefined
      if (run.artifacts?.overlay) {
        const url = await paintClasses(gatewayUrl(run.artifacts.overlay, mode), { 1: true, 2: true, 3: true, 4: true, 5: true }).catch(() => gatewayUrl(run.artifacts.overlay, mode))
        m.addSource('cls', { type: 'image', url, coordinates: coords })
        m.addLayer({ id: 'cls', type: 'raster', source: 'cls', paint: { 'raster-resampling': 'nearest' } }, before)
      }
      top.forEach((r, i) => {
        const d = document.createElement('div')
        d.className = 'pin'
        d.textContent = String(i + 1)
        new maplibregl.Marker({ element: d }).setLngLat([r.lon, r.lat]).addTo(m)
      })
      m.addControl(new maplibregl.ScaleControl({ unit: 'metric', maxWidth: 140 }), 'bottom-left')
      if (grid) {
        const g = graticule(m.getBounds().toArray().flat().reduce((a, v, i) => ({ ...a, [['west', 'south', 'east', 'north'][i]]: v }), {}))
        m.addSource('grid', { type: 'geojson', data: g.fc })
        m.addLayer({ id: 'grid', type: 'line', source: 'grid', paint: { 'line-color': '#1f2937', 'line-opacity': 0.35, 'line-width': 0.6, 'line-dasharray': [4, 3] } })
        const bb = m.getBounds()
        for (const l of g.labels) {
          const d = document.createElement('div')
          d.className = 'grid-lbl'
          d.textContent = l.text
          const at = l.lat == null ? [l.lon, bb.getNorth()] : [bb.getWest(), l.lat]
          new maplibregl.Marker({ element: d, anchor: l.lat == null ? 'top' : 'left' }).setLngLat(at).addTo(m)
        }
      }
    })
    return () => m.remove()
  }, [run, mode, top, grid])
  return <div ref={el} className={className} />
}

export default function ReportPage() {
  const { id } = useParams()
  const [state, setState] = useState({ status: 'loading' })
  const [places, setPlaces] = useState({})
  const [now] = useState(() => new Date())

  useEffect(() => {
    (async () => {
      try {
        const mode = await detectMode()
        if (mode === 'offline') throw new Error('No gateway or demo data.')
        const runs = await fetchRuns(mode)
        const run = runs.find((r) => r.id === id)
        if (!run) throw new Error(`Run ${id} not found.`)
        const report = parseReport(await fetchJson(run.artifacts.report, mode))
        const geo = run.artifacts.geojson ? await fetchJson(run.artifacts.geojson, mode) : null
        const ref = await loadReference()
        setState({ status: 'ok', mode, run, report, regions: regionList(geo), ref })
        document.title = `Situation report · ${report.activeDate} · NISAR Pro`
      } catch (e) {
        setState({ status: 'error', error: e.message })
      }
    })()
  }, [id])

  const top = useMemo(() => (state.status === 'ok' ? hotspots(state.regions, 10) : []), [state])
  useEffect(() => {
    if (state.status !== 'ok') return
    let off = false
    ;(async () => {
      for (const r of top) {
        const p = await placeFor(r.lat, r.lon, state.mode, state.run.places)
        if (off) return
        if (p) setPlaces((s) => ({ ...s, [r.id]: p }))
      }
    })()
    return () => { off = true }
  }, [top, state])

  if (state.status === 'loading') return <div className="rp-wait">Preparing the report…</div>
  if (state.status === 'error') {
    return (
      <div className="rp-wait">
        <p><b>The report could not be prepared.</b></p>
        <p>{state.error}</p>
        <p><button type="button" onClick={() => window.location.reload()}>Try again</button> · <a href={site('/app')}>Back to the map</a></p>
      </div>
    )
  }
  const { run, report: r, mode, ref } = state
  const fx = formatArea(r.newWater.km2, r.newWater.acres)
  const pass = granuleTime(r.activeId)
  const tests = testsForRun(ref, r)
  const areas = [...new Set(top.map((h) => places[h.id]?.area).filter(Boolean))].slice(0, 3)
  const where = areas.length ? `${areas.join(', ')}${places[top[0]?.id]?.country ? `, ${places[top[0].id].country}` : ''}` : r.trackFrame ? `Track ${r.trackFrame.track} · Frame ${r.trackFrame.frame}` : ''
  const mineKey = r.band === 'S' ? 's_only' : 'l_only'
  const gain = tests.find((t) => t.kind === 'gain')
  const g = gain?.data?.results?.['ndwi_0.0']?.[mineKey]

  return (
    <div className="rp-wrap">
      <div className="rp-bar noprint">
        <button type="button" onClick={() => window.print()}>Print or save as PDF</button>
        <span>A4 portrait. Choose “Save as PDF” in the print dialog.</span>
      </div>
      <article className="rp">
        <header className="rp-head">
          <div>
            <div className="rp-brand">/// NISAR PRO</div>
            <h1>Situation report · Flood extent</h1>
            <div className="rp-sub">{[where, `${formatDate(r.baselineDate)} → ${formatDate(r.activeDate)}`, `${sensorName(r.band)} ${r.band}-band ${r.polarization || ''}`].filter(Boolean).join(' · ')}</div>
          </div>
          <div className="rp-meta">Radar pass {pass ? `${formatDate(pass.toISOString().slice(0, 10))} ${pass.toISOString().slice(11, 16)} UTC` : '—'}<br />Generated {now.toISOString().slice(0, 16).replace('T', ' ')} UTC<br /><span className="mono">{run.id}</span></div>
        </header>

        <section className="rp-headline">
          <div className="lbl">Flood extent</div>
          <div className="big">{fx.km2}</div>
          <div className="sub">{fx.acres} · {formatNumber(r.regions)} separate areas</div>
          <p>Water detected by radar on {formatDate(r.activeDate)} that was not there on {formatDate(r.baselineDate)}. Not confirmed on the ground.</p>
        </section>

        <figure className="rp-fig">
          <MapFigure run={run} mode={mode} top={top} />
          <figcaption>
            {CLASSES.filter((c) => c.code !== 0 && c.code !== 4).map((c) => <span key={c.code}><i style={{ background: c.color }} />{c.label}</span>)}
            <span><b className="pin sm">1</b>Largest areas</span>
            <span className="muted">North up. Basemap © OpenStreetMap contributors, OpenFreeMap.</span>
          </figcaption>
        </figure>

        <section>
          <h2>Largest flooded areas</h2>
          <table className="rp-table">
            <thead><tr><th>#</th><th>Nearest place</th><th>km²</th><th>acres</th><th>High conf.</th><th>Lat, lon</th></tr></thead>
            <tbody>
              {top.map((h, i) => (
                <tr key={h.id}>
                  <td>{i + 1}</td>
                  <td>{placeLabel(places[h.id]) || '—'}</td>
                  <td className="n">{formatNumber(h.km2, 2)}</td>
                  <td className="n">{formatNumber(h.acres)}</td>
                  <td className="n">{h.pixels ? `${formatNumber((100 * h.high) / h.pixels)}%` : '—'}</td>
                  <td className="mono">{h.lat.toFixed(4)}, {h.lon.toFixed(4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="rp-cols">
          <div>
            <h2>Method</h2>
            <p>NISAR L2 GCOV, {r.radarBand || `${r.band}-band`} {r.polarization}, track {r.trackFrame?.track} frame {r.trackFrame?.frame}, {r.pixelSpacingM} m grid ({r.crs}). Drop in backscatter between the two dates: seed {formatDb(Math.min(r.method.seedDb, r.method.effectiveOtsuDb ?? r.method.seedDb))}, growth {formatDb(r.method.growthDb)} (Otsu {formatDb(r.method.rawOtsuDb)} reported); region growing and clean-up; areas under {r.method.minAreaPx} pixels dropped.</p>
          </div>
          <div>
            <h2>Limits</h2>
            <p>
              Radar sees water as a drop in backscatter; wet soil, shadows and some crops can look the same. Not confirmed on the ground.
              {g ? ` In the study, the flood extent of this period agreed with Sentinel-2 at F1 ${g.f1.toFixed(3)} (cloud-free pixels, ${formatArea(gain.data.scored_km2, null).km2} scored).` : ' No Sentinel-2 comparison for these dates.'}
            </p>
          </div>
        </section>

        <footer className="rp-foot">
          <span>Data: NASA-ISRO NISAR (ASF DAAC). Processing: NISAR Pro engine.</span>
          <span>Not confirmed on the ground.</span>
          <span>Page 1 of 2</span>
        </footer>
      </article>
      <MapPage run={run} mode={mode} top={top} regions={state.regions} r={r} pass={pass} />
    </div>
  )
}

function MapPage({ run, mode, top, regions, r, pass }) {
  const d = useDistricts(regions || [], mode, run.places)
  return (
    <article className="rp rp-page2">
      <header className="rp-head">
        <div>
          <div className="rp-brand">/// NISAR PRO</div>
          <h1>Map · Flood extent {formatDate(r.baselineDate)} → {formatDate(r.activeDate)}</h1>
          <div className="rp-sub">Radar pass {pass ? `${formatDate(pass.toISOString().slice(0, 10))} ${pass.toISOString().slice(11, 16)} UTC` : '—'} · NISAR {r.band}-band {r.polarization || ''} · grid in degrees, WGS84</div>
        </div>
      </header>
      <figure className="rp-fig">
        <MapFigure run={run} mode={mode} top={top} grid className="rp-map tall" />
        <figcaption>
          {CLASSES.filter((c) => c.code !== 0 && c.code !== 4).map((c) => <span key={c.code}><i style={{ background: c.color }} />{c.label}</span>)}
          <span><b className="pin sm">1</b>Largest areas, as on page 1</span>
        </figcaption>
      </figure>
      <section>
        <h2>Flood extent by district</h2>
        {d.rows.length ? (
          <table className="rp-table">
            <thead><tr><th>District</th><th>km²</th><th>acres</th><th>Areas</th><th>Share</th></tr></thead>
            <tbody>
              {d.rows.slice(0, 8).map((x) => (
                <tr key={x.district}><td>{x.district}</td><td className="n">{formatNumber(x.km2, 2)}</td><td className="n">{formatNumber(x.acres)}</td><td className="n">{formatNumber(x.count)}</td><td className="n">{formatNumber(100 * x.share, 1)}%</td></tr>
              ))}
            </tbody>
          </table>
        ) : <p>{d.done ? 'No place names available.' : `Naming areas… ${d.asked} of ${d.toAsk}`}</p>}
        <p className="rp-note">Each area assigned to the district of its centre; districts from OpenStreetMap, not official boundaries. Named: {formatNumber(100 * d.namedShare)}% of the summed area.</p>
      </section>
      <footer className="rp-foot">
        <span>Data: NASA-ISRO NISAR (ASF DAAC). Processing: NISAR Pro engine. Basemap © OpenStreetMap contributors.</span>
        <span>Not confirmed on the ground.</span>
        <span>Page 2 of 2</span>
      </footer>
    </article>
  )
}
