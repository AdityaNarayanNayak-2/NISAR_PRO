// Impact tab: what the flood extent touches and what the river and sky are doing, from free
// public data. Nothing here is NISAR Pro output; each section names its source.
//   Facilities near water   OpenStreetMap (Overpass), within 1 km of the flood areas
//   River flow              GloFAS model via Open-Meteo, around both passes
//   Rain between passes     ERA5 via Open-Meteo archive
//   Next days               Open-Meteo rain forecast and GloFAS river forecast
import { useEffect, useMemo, useState } from 'react'
import { useRunStore } from '../stores/useRunStore'
import { useMapStore } from '../stores/useMapStore'
import { facilitiesInFlood, riverFlow, rainPast, rainForecast, riverForecast, FACILITY_KINDS, NEAR_M, addDays, savedNote, demoTwinId } from '../lib/impact'
import { placeLabel } from '../lib/places'
import { formatNumber, formatShortDate, formatArea } from '../lib/units'
import { mapHandle, freePadding } from '../map/mapHandle'
import useRunAreas from './useRunAreas'
import Icon from '../ui/Icon'
import { site } from '../../../lib/site.js'

const KIND_COLOR = { health: '#f87171', school: '#fbbf24', emergency: '#c4b5fd', shelter: '#86efac' }

/** Runs fn when key changes. Returns {status: loading|ok|error, data, error} for the current key. */
function useAsync(fn, key) {
  const [st, setSt] = useState({ key: null })
  useEffect(() => {
    let off = false
    fn().then((data) => !off && setSt({ key, status: 'ok', data }), (e) => !off && setSt({ key, status: 'error', error: String(e.message || e) }))
    return () => { off = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return st.key === key ? st : { status: 'loading' }
}

function Skel({ text }) {
  return <div>{text && <div className="muted" style={{ marginBottom: 8 }}>{text}</div>}{[0, 1, 2].map((i) => <div key={i} className="skel" style={{ width: `${88 - i * 16}%` }} />)}</div>
}

const fly = (lat, lon) => mapHandle.current?.flyTo({ center: [lon, lat], zoom: Math.max(mapHandle.current.getZoom(), 13), duration: 700, padding: freePadding(0) })

function csv(items) {
  const esc = (v) => `"${String(v ?? '').replaceAll('"', '""')}"`
  const rows = items.map((i) => [i.name, i.amenity, i.kind, i.distM, i.lat.toFixed(6), i.lon.toFixed(6), i.regionId].map(esc).join(','))
  return ['name,type,group,metres_to_flood_area,lat,lon,nearest_area', ...rows].join('\n')
}

function save(name, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv' }))
  const a = Object.assign(document.createElement('a'), { href: url, download: name })
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function Facilities({ run, mode, geo, rep }) {
  const setFacilities = useMapStore((s) => s.setFacilities)
  const [all, setAll] = useState(false)
  const st = useAsync(async () => {
    if (mode === 'demo') {
      const res = await fetch(site(`/demo/runs/${run.id}/facilities.json`))
      if (res.ok) return res.json()
    }
    try {
      return await facilitiesInFlood(run.id, geo.data)
    } catch (e) {
      // No internet: a Bihar reference run can use the copy shipped with the website demo.
      const twin = await demoTwinId(rep, site)
      const res = twin && await fetch(site(`/demo/runs/${twin}/facilities.json`))
      if (res?.ok) return { ...(await res.json()), saved: 'website copy' }
      throw e
    }
  }, `${run.id}:${mode}:${geo.status}:${rep ? 1 : 0}`)
  useEffect(() => {
    setFacilities(st.status === 'ok' ? st.data.items : null)
    return () => setFacilities(null)
  }, [st, setFacilities])

  return (
    <div className="sec">
      <h3>Facilities near the water <span className="muted">within {formatNumber(NEAR_M / 1000)} km</span></h3>
      {st.status === 'loading' && <Skel text="Asking OpenStreetMap for hospitals, schools, police and shelters over the scene. This can take a minute." />}
      {st.status === 'error' && <div className="err-text">OpenStreetMap did not answer ({st.error}). Try again later.</div>}
      {st.status === 'ok' && (() => {
        const d = st.data
        const list = all ? d.items : d.items.slice(0, 12)
        return (
          <>
            {d.saved && <p className="muted">No internet: copy shipped with the website demo (same run).</p>}
            <div className="fac-tiles">
              {FACILITY_KINDS.map((k) => (
                <div key={k.key} className="fac-tile">
                  <i style={{ background: KIND_COLOR[k.key] }} />
                  <b className="num">{formatNumber(d.counts[k.key] || 0)}</b>
                  <span>{k.label}</span>
                </div>
              ))}
            </div>
            {d.items.length === 0 && <div className="muted" style={{ marginTop: 10 }}>No mapped facilities within {formatNumber(NEAR_M)} m of the flood areas.</div>}
            {list.map((f) => (
              <div key={f.id} className="fac-row">
                <i style={{ background: KIND_COLOR[f.kind] }} />
                <div className="body">
                  <button type="button" className="name" onClick={() => fly(f.lat, f.lon)} title="Zoom to this place">{f.name || `Unnamed ${f.amenity.replace('_', ' ')}`}</button>
                  <div className="l3">
                    <span>{f.amenity.replace('_', ' ')}</span>
                    <span className="num">{f.distM === 0 ? 'inside flood area' : `${formatNumber(f.distM)} m from water`}</span>
                    <span className="grow" />
                    <a className="link" href={`https://www.openstreetmap.org/${f.id}`} target="_blank" rel="noreferrer">OSM</a>
                  </div>
                </div>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              {d.items.length > 12 && <button type="button" className="btn" onClick={() => setAll((v) => !v)}>{all ? 'Show fewer' : `Show all ${formatNumber(d.items.length)}`}</button>}
              {d.items.length > 0 && <button type="button" className="btn" onClick={() => save(`${run.id}_facilities_near_water.csv`, csv(d.items))}><Icon name="download" size={14} />CSV</button>}
            </div>
            <div className="foot">
              Closest first. Distance to the nearest flood area edge, computed from the run's areas file and OpenStreetMap positions.
              {` ${formatNumber(d.scanned)} mapped facilities checked over the scene.`} OpenStreetMap is incomplete in rural India: a facility missing here is not known to be dry.
              {' '}© OpenStreetMap contributors{d.fetched ? `, fetched ${d.fetched}` : ''}.
            </div>
          </>
        )
      })()}
    </div>
  )
}

/** Building footprints at the flood extent. Demo runs and the matching local Bihar reference runs (counted offline from Microsoft footprints). */
function Buildings({ run, mode, rep }) {
  const st = useAsync(async () => {
    const id = mode === 'demo' ? run.id : await demoTwinId(rep, site)
    if (!id) return null
    const res = await fetch(site(`/demo/runs/${id}/buildings.json`))
    return res.ok ? res.json() : null
  }, `${run.id}:${mode}:${rep ? 1 : 0}`)
  if (st.status !== 'ok' || !st.data) return null
  const b = st.data
  return (
    <div className="sec">
      <h3>Buildings at the water <span className="muted">Microsoft footprints</span></h3>
      <div className="kv-pair">
        <div><span>In flood extent</span><b className="num">{formatNumber(b.inside)}</b><small>{formatNumber(b.high)} high · {formatNumber(b.medium)} medium</small></div>
        <div><span>Within 80 m</span><b className="num">{formatNumber(b.within_80m)}</b><small>incl. inside</small></div>
        <div><span>Within 240 m</span><b className="num">{formatNumber(b.within_240m)}</b><small>incl. inside</small></div>
      </div>
      <div className="foot">Counted at each footprint's centre on the run's 80 m flood pixels, out of {formatNumber(b.scene)} footprints in the scene. Exposure, not damage: the water is radar-detected and not confirmed on the ground, and villages on raised land often sit just outside it. Footprints are machine-mapped from imagery and miss or add some buildings. {b.source}.</div>
    </div>
  )
}

/** Small line or bar chart with day ticks, optional vertical markers and a hover read-out. */
function DayChart({ days, kind = 'line', unit, markers = [], band }) {
  const [hover, setHover] = useState(null)
  const W = 352, H = 136, M = { top: 22, right: 8, bottom: 24, left: 46 }
  const vals = days.map((d) => d.v).filter((v) => v != null)
  if (!vals.length) return <div className="muted">No data for these dates.</div>
  const hi = Math.max(...vals, ...(band ? days.map((d) => d.max ?? 0) : []))
  const lo = kind === 'bar' ? 0 : Math.min(...vals) * 0.9
  const iw = W - M.left - M.right, ih = H - M.top - M.bottom
  const x = (i) => M.left + (days.length === 1 ? iw / 2 : (i / (days.length - 1)) * iw)
  const y = (v) => M.top + ih - ((v - lo) / (hi - lo || 1)) * ih
  const idx = (t) => days.findIndex((d) => d.t === t)
  const step = Math.ceil(days.length / 5)
  const bw = Math.max(2, iw / days.length - 2)
  return (
    <div className="trend">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`Daily values, ${unit}`}
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect()
          const px = ((e.clientX - r.left) / r.width) * W
          const i = Math.round(((px - M.left) / iw) * (days.length - 1))
          if (i >= 0 && i < days.length && days[i].v != null) setHover(i)
        }}>
        {[lo, (lo + hi) / 2, hi].map((v) => (
          <g key={v}>
            <line x1={M.left} x2={W - M.right} y1={y(v)} y2={y(v)} className="grid" />
            <text x={M.left - 6} y={y(v) + 3} textAnchor="end" className="axis">{formatNumber(v)}</text>
          </g>
        ))}
        <text x={4} y={10} className="axis">{unit}</text>
        {band && <path className="band" d={`M${days.map((d, i) => `${x(i)},${y(d.max ?? d.v)}`).join(' L')} L${days.map((d, i) => [i, d]).reverse().map(([i, d]) => `${x(i)},${y(d.v)}`).join(' L')} Z`} />}
        {kind === 'line'
          ? <polyline className="line" points={days.map((d, i) => (d.v == null ? null : `${x(i)},${y(d.v)}`)).filter(Boolean).join(' ')} />
          : days.map((d, i) => d.v > 0 && <rect key={d.t} className={d.hl ? 'col' : 'col dim'} x={x(i) - bw / 2} y={y(d.v)} width={bw} height={M.top + ih - y(d.v)} rx={1.5} />)}
        {markers.map((m) => {
          const i = idx(m.t)
          if (i < 0) return null
          return (
            <g key={m.t}>
              <line x1={x(i)} x2={x(i)} y1={M.top} y2={M.top + ih} className="marker" />
              <text x={x(i)} y={M.top - 6} textAnchor={i > days.length * 0.8 ? 'end' : 'start'} dx={i > days.length * 0.8 ? -3 : 3} className="axis mk">{m.label}</text>
            </g>
          )
        })}
        {hover != null && <circle cx={x(hover)} cy={y(days[hover].v)} r={4} className="pt" />}
        <line x1={M.left} x2={W - M.right} y1={M.top + ih} y2={M.top + ih} className="base" />
        {days.map((d, i) => (i % step === 0 ? <text key={d.t} x={x(i)} y={H - 8} textAnchor="middle" className="axis">{formatShortDate(d.t)}</text> : null))}
      </svg>
      {hover != null && (
        <div className="chart-tip" style={{ left: `${(100 * x(hover)) / W}%`, top: `${(100 * y(days[hover].v)) / H}%` }}>
          <b>{formatShortDate(days[hover].t)}</b><br />{formatNumber(days[hover].v, unit === 'mm' ? 1 : 0)} {unit}
          {band && days[hover].max != null && <><br />ensemble max {formatNumber(days[hover].max)}</>}
        </div>
      )}
    </div>
  )
}

function River({ spot, from, to }) {
  const st = useAsync(() => riverFlow(spot.lat, spot.lon, addDays(from, -30), addDays(to, 30)), `${spot.lat},${spot.lon},${from},${to}`)
  let read = null
  if (st.status === 'ok') {
    const at = (t) => st.data.days.find((d) => d.t === t)?.v
    const a = at(from), b = at(to)
    const peak = st.data.days.reduce((m, d) => (d.v != null && (!m || d.v > m.v) ? d : m), null)
    if (a != null && b != null) read = { a, b, peak }
  }
  // Did the later pass catch the peak? Satellites pass on fixed dates; the river peak rarely waits for them.
  let catchLine = null
  if (read && read.peak.v > 0) {
    const gap = Math.round((Date.parse(to) - Date.parse(read.peak.t)) / 86400000)
    const pct = Math.round((100 * read.b) / read.peak.v)
    catchLine = Math.abs(gap) <= 1 || pct >= 90
      ? `Pass 2 saw the river at ${pct}% of its highest flow in this window (peak ${formatShortDate(read.peak.t)}). The map is likely close to the largest extent.`
      : gap > 0
        ? `Pass 2 came ${gap} days after the river peak, at ${pct}% of peak flow. The flood was likely larger on ${formatShortDate(read.peak.t)} than this map shows.`
        : `Pass 2 came ${-gap} days before the river peak, at ${pct}% of peak flow. Water likely kept rising after this map.`
  }
  return (
    <div className="sec">
      <h3>River flow <span className="muted">GloFAS model</span></h3>
      {st.status === 'loading' && <Skel />}
      {st.status === 'error' && <div className="err-text">River data did not load ({st.error}).</div>}
      {st.status === 'ok' && (
        <>
          {read && (
            <div className="kv-pair">
              <div><span>{formatShortDate(from)}</span><b className="num">{formatNumber(read.a)}</b><small>m³/s</small></div>
              <div><span>{formatShortDate(to)}</span><b className="num">{formatNumber(read.b)}</b><small>m³/s · {read.b >= read.a ? '+' : ''}{formatNumber((100 * (read.b - read.a)) / read.a)}%</small></div>
              <div><span>Peak, {formatShortDate(read.peak.t)}</span><b className="num">{formatNumber(read.peak.v)}</b><small>m³/s</small></div>
            </div>
          )}
          {savedNote(st.data) && <p className="muted">{savedNote(st.data)}</p>}
          <DayChart days={st.data.days} unit="m³/s" markers={[{ t: from, label: 'pass 1' }, { t: to, label: 'pass 2' }]} />
          {catchLine && <p className="note">{catchLine} <span className="muted">From modelled river flow, ±30 days around the passes.</span></p>}
          <div className="foot">Daily river discharge simulated by GloFAS v4 (Copernicus) on the largest river cell within about 11 km of the area ({st.data.cellLat?.toFixed(3)}, {st.data.cellLon?.toFixed(3)}, {formatNumber(st.data.km, 1)} km away). A model, not a gauge reading; an independent view of how high the river was on the pass dates. Data: Open-Meteo, CC BY 4.0.</div>
        </>
      )}
    </div>
  )
}

function Rain({ spot, from, to }) {
  const start = addDays(from, -14)
  const st = useAsync(() => rainPast(spot.lat, spot.lon, start, to), `${spot.lat},${spot.lon},${from},${to}`)
  const days = useMemo(() => (st.status === 'ok' ? st.data.map((d) => ({ ...d, hl: d.t > from && d.t <= to })) : []), [st, from, to])
  const between = days.filter((d) => d.hl).reduce((s, d) => s + (d.v || 0), 0)
  const before = days.filter((d) => !d.hl && d.t <= from).reduce((s, d) => s + (d.v || 0), 0)
  return (
    <div className="sec">
      <h3>Rain around the passes <span className="muted">ERA5</span></h3>
      {st.status === 'loading' && <Skel />}
      {st.status === 'error' && <div className="err-text">Rain data did not load ({st.error}).</div>}
      {st.status === 'ok' && (
        <>
          <div className="kv-pair">
            <div><span>14 days before pass 1</span><b className="num">{formatNumber(before)}</b><small>mm</small></div>
            <div><span>Between the passes</span><b className="num">{formatNumber(between)}</b><small>mm</small></div>
          </div>
          {savedNote(st.data) && <p className="muted">{savedNote(st.data)}</p>}
          <DayChart days={days} kind="bar" unit="mm" markers={[{ t: from, label: 'pass 1' }, { t: to, label: 'pass 2' }]} />
          <div className="foot">Daily rain from the ERA5 reanalysis (about 25 km cells), summed in local days. Bright bars: between the passes. Rain upstream can flood a place without local rain. Data: Open-Meteo, CC BY 4.0.</div>
        </>
      )}
    </div>
  )
}

function Outlook({ spot }) {
  const rain = useAsync(() => rainForecast(spot.lat, spot.lon), `${spot.lat},${spot.lon}`)
  const river = useAsync(() => riverForecast(spot.lat, spot.lon), `${spot.lat},${spot.lon}`)
  const today = new Date().toISOString().slice(0, 10)
  // A saved forecast is old news: offline, say so instead of showing it.
  const stale = (rain.status === 'ok' && rain.data.saved) || (river.status === 'ok' && river.data.saved)
  if (stale) {
    return (
      <div className="sec">
        <h3>Next days <span className="muted">forecast from today</span></h3>
        <p className="muted">The forecast needs internet. Connect to see the next days.</p>
      </div>
    )
  }
  let trend = null
  if (river.status === 'ok') {
    const now = river.data.find((d) => d.t === today)?.v
    const fut = river.data.filter((d) => d.t > today && d.v != null)
    const peak = fut.reduce((m, d) => (!m || d.v > m.v ? d : m), null)
    if (now != null && peak) trend = { now, peak, rising: peak.v > now * 1.1 }
  }
  const total = rain.status === 'ok' ? rain.data.reduce((s, d) => s + (d.v || 0), 0) : null
  return (
    <div className="sec">
      <h3>Next days <span className="muted">forecast from today</span></h3>
      {(rain.status === 'loading' || river.status === 'loading') && <Skel />}
      {trend && (
        <div className={`outlook ${trend.rising ? 'up' : ''}`}>
          <Icon name={trend.rising ? 'up' : 'down'} size={14} />
          {trend.rising
            ? <span>River forecast to rise from {formatNumber(trend.now)} to {formatNumber(trend.peak.v)} m³/s by {formatShortDate(trend.peak.t)}.</span>
            : <span>No rise of more than 10% in the river forecast for 30 days (now {formatNumber(trend.now)} m³/s).</span>}
        </div>
      )}
      {river.status === 'ok' && <DayChart days={river.data} unit="m³/s" band markers={[{ t: today, label: 'today' }]} />}
      {rain.status === 'ok' && (
        <>
          <div className="kv-pair" style={{ marginTop: 10 }}>
            <div><span>Rain, next 7 days</span><b className="num">{formatNumber(total, 1)}</b><small>mm</small></div>
            <div><span>Wettest day</span><b className="num">{(() => { const m = rain.data.reduce((a, d) => (!a || d.v > a.v ? d : a), null); return m ? formatShortDate(m.t) : '—' })()}</b><small>{(() => { const m = rain.data.reduce((a, d) => (!a || d.v > a.v ? d : a), null); return m ? `${formatNumber(m.v, 1)} mm` : '' })()}</small></div>
          </div>
        </>
      )}
      {(rain.status === 'error' || river.status === 'error') && <div className="err-text">Forecast did not load.</div>}
      <div className="foot">River: GloFAS forecast on the same river cell (line) with the ensemble maximum (shaded). Rain: Open-Meteo forecast. Models, for planning; the official warning comes from IMD and CWC.</div>
    </div>
  )
}

/** Loads river and rain for all five places once, so this browser keeps a copy for use without internet. */
function SaveOffline({ spots, from, to }) {
  const [state, setState] = useState(null)
  const go = async () => {
    setState('saving')
    const jobs = spots.flatMap((s) => [riverFlow(s.lat, s.lon, addDays(from, -30), addDays(to, 30)), rainPast(s.lat, s.lon, addDays(from, -14), to)])
    const res = await Promise.allSettled(jobs)
    const live = res.filter((r) => r.status === 'fulfilled' && !r.value?.saved).length
    setState(live === jobs.length ? 'done' : `partial:${live}/${jobs.length}`)
  }
  return (
    <div className="save-offline" style={{ marginTop: 10 }}>
      <button type="button" className="chip sm" onClick={go} disabled={state === 'saving'}>
        {state === 'saving' ? 'Saving…' : 'Save river and rain for use without internet'}
      </button>
      {state === 'done' && <span className="muted"> Saved for all {spots.length} places in this browser.</span>}
      {state?.startsWith('partial') && <span className="muted"> Only {state.split(':')[1]} loaded live; try again with internet.</span>}
    </div>
  )
}

export default function ImpactView({ run }) {
  const { mode, geo, top, places } = useRunAreas(run)
  const rep = useRunStore((s) => s.reports[run.id])
  const [spotId, setSpotId] = useState(null)
  const spots = top.slice(0, 5)
  const spot = spots.find((s) => s.id === spotId) || spots[0]
  const from = rep?.data?.baselineDate, to = rep?.data?.activeDate

  if (!geo || geo.status === 'loading' || !rep || rep.status === 'loading') return <div className="sec"><Skel /></div>
  if (geo.status !== 'ok') return <div className="sec"><div className="err-text">Areas file could not be read.</div></div>
  return (
    <>
      <div className="sec intro">
        <p>Free public data around this run: what sits next to the water, how high the river was and how much rain fell. Not NISAR measurements; each section names its source.</p>
      </div>
      <Facilities run={run} mode={mode} geo={geo} rep={rep?.data} />
      <Buildings run={run} mode={mode} rep={rep?.data} />
      {spot && from && to && (
        <>
          <div className="sec">
            <h3>Place</h3>
            <div className="spot-pick">
              {spots.map((s, i) => {
                const a = formatArea(s.km2, s.acres)
                return (
                  <button key={s.id} type="button" className="chip sm" aria-pressed={s.id === spot.id} onClick={() => { setSpotId(s.id); fly(s.lat, s.lon) }} title={`${a.km2} · ${a.acres}`}>
                    {i + 1}. {placeLabel(places[s.id])?.split(',')[0] || `${s.lat.toFixed(2)}, ${s.lon.toFixed(2)}`}
                  </button>
                )
              })}
            </div>
            <div className="foot">River and rain below are for the centre of the chosen area (the five largest).</div>
            <SaveOffline spots={spots} from={from} to={to} />
          </div>
          <River spot={spot} from={from} to={to} />
          <Rain spot={spot} from={from} to={to} />
          <Outlook spot={spot} />
        </>
      )}
    </>
  )
}
