// What the right panel shows for each nav tab. Each fact has one owner tab:
//   Live Map    top 5 areas and copy summary, sum in view / drawn area, confidence
//   Time Series flood extent per period and water on each date for the frame
//   Regions     flood extent by district, every area (sort, filter, page, CSV), areas by size
//   Reports     situation report and files, class table, thresholds, method, product
//   Evaluation  Sentinel-2 agreement (Validation.jsx)
// The flood extent number itself lives on the left run card.
import { useMemo, useState } from 'react'
import { useRunStore } from '../stores/useRunStore'
import { periodsFor, shareOf, hotspotsCsv } from '../lib/regions'
import { granuleTime, granuleTrackFrame, sensorName } from '../lib/report'
import { placeLabel } from '../lib/places'
import { useMapStore } from '../stores/useMapStore'
import { mapHandle, freePadding } from '../map/mapHandle'
import Icon from '../ui/Icon'
import { formatArea, formatDate, formatNumber, formatPercent, formatShortDate, KM2_PER_ACRE } from '../lib/units'
import { InView, Hotspots, Confidence, TakeAway } from './Brief'
import useRunAreas from './useRunAreas'
import useDistricts from './useDistricts'
import { Warnings, Classes, WaterByDate, Method, RegionStats, Product } from './Analysis'
import TrendChart from './TrendChart'

function useReport(run) {
  return useRunStore((s) => s.reports[run.id])
}

function Loading() {
  return <div className="sec">{[0, 1, 2, 3].map((i) => <div key={i} className="skel" style={{ width: `${90 - i * 14}%` }} />)}</div>
}

function withReport(rep, render) {
  if (!rep || rep.status === 'loading') return <Loading />
  if (rep.status !== 'ok') return <div className="sec"><div className="err-text">{rep.error || 'This run has no readable report.'}</div></div>
  return render(rep.data)
}

function summaryText(r, top, places) {
  const at = granuleTime(r.activeId)
  const a = formatArea(r.newWater.km2, r.newWater.acres)
  const names = top.slice(0, 3).map((x) => `${placeLabel(places[x.id]) || `${x.lat.toFixed(4)}, ${x.lon.toFixed(4)}`} (${formatArea(x.km2, x.acres).km2})`)
  return [
    `${sensorName(r.band)} ${r.band || ''}-band radar, ${formatDate(r.baselineDate)} to ${formatDate(r.activeDate)}${at ? ` (later pass ${at.toISOString().slice(11, 16)} UTC)` : ''}.`,
    `Flood extent ${a.km2} (${a.acres})${r.regions != null ? ` in ${formatNumber(r.regions)} areas` : ''}.`,
    names.length ? `Largest: ${names.join('; ')}.` : '',
    'Water detected by radar. Not confirmed on the ground. Source: NISAR Pro.',
  ].filter(Boolean).join(' ')
}

export function LiveMapView({ run }) {
  const rep = useReport(run)
  const toast = useRunStore((s) => s.toast)
  const { mode, geo, regions, top, split, places } = useRunAreas(run)
  const share = shareOf(top, regions)
  return withReport(rep, (r) => (
    <>
      {geo?.status === 'ok' && (
        <Hotspots list={top.slice(0, 5)} places={places} mode={mode} title="Send teams first"
          note={`Ranked by detected area only, not by people affected.${share != null ? ` The 10 largest hold ${formatNumber(100 * share)}% of the summed area (computed).` : ''} Full list in Regions.`}>
          <button type="button" className="btn btn-block" style={{ marginTop: 12 }} onClick={() => navigator.clipboard?.writeText(summaryText(r, top, places)).then(() => toast('Summary copied. Paste it into a message.', 'ok'))}>
            <Icon name="copy" size={14} />Copy summary
          </button>
        </Hotspots>
      )}
      {(!geo || geo.status === 'loading') && <Loading />}
      {geo?.status === 'error' && <div className="sec"><div className="err-text">Areas file could not be read.</div></div>}
      {geo?.status === 'ok' && <InView regions={regions} />}
      {geo?.status === 'ok' && <Confidence split={split} />}
      <Warnings warnings={r.warnings} />
    </>
  ))
}

const days = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000)

/** This period against the previous one on the same frame and band. Run summaries only. */
function SinceLast({ periods, run }) {
  const i = periods.findIndex((p) => p.id === run.id)
  if (i < 1) return null
  const cur = periods[i], prev = periods[i - 1]
  const row = (label, a, b) => {
    if (!a || !b) return null
    const d = a.km2 - b.km2
    const f = formatArea(Math.abs(d), Math.abs(a.acres - b.acres))
    return (
      <tr key={label}>
        <td>{label}</td>
        <td className="num">{formatArea(b.km2, b.acres).km2}</td>
        <td className="num">{formatArea(a.km2, a.acres).km2}</td>
        <td className="num"><b>{d >= 0 ? '+' : '−'}{f.km2}</b><span className="area-cell"><span className="a">{d >= 0 ? '+' : '−'}{f.acres}</span></span></td>
      </tr>
    )
  }
  return (
    <div className="sec">
      <h3>Since the last period <span className="muted">computed</span></h3>
      <table className="ctable">
        <thead><tr><th /><th>{formatShortDate(prev.from)} → {formatShortDate(prev.to)}</th><th>{formatShortDate(cur.from)} → {formatShortDate(cur.to)}</th><th>Change</th></tr></thead>
        <tbody>
          {row('Flood extent', cur.gain, prev.gain)}
          {row('Water loss', cur.loss, prev.loss)}
          {row('Stable water', cur.stable, prev.stable)}
        </tbody>
      </table>
      <div className="foot">The periods are {days(prev.from, prev.to)} and {days(cur.from, cur.to)} days long, so totals are not per day. Flood extent falling while water loss rises means water is leaving.</div>
    </div>
  )
}

export function TimeSeriesView({ run }) {
  const rep = useReport(run)
  const runs = useRunStore((s) => s.runs)
  const open = useRunStore((s) => s.open)
  const periods = useMemo(() => periodsFor(runs, run), [runs, run])
  return withReport(rep, (r) => (
    <>
      <SinceLast periods={periods} run={run} />
      <div className="sec">
        <h3>Flood extent over time <span className="muted">{r.band}-band, this frame</span></h3>
        {periods.length >= 2 ? <TrendChart periods={periods} openId={run.id} /> : <div className="muted">A trend needs two periods on this frame. Process another pair of the same track and frame.</div>}
      </div>
      {periods.length > 0 && (
        <div className="sec">
          <h3>Periods <span className="muted">{periods.length} run{periods.length > 1 ? 's' : ''}</span></h3>
          {periods.map((p) => {
            const a = p.gain ? formatArea(p.gain.km2, p.gain.acres) : null
            return (
              <button key={p.id} type="button" className="job-row" aria-current={p.id === run.id} onClick={() => open(p.id)}>
                <span className="t"><span className="t1">{formatShortDate(p.from)} → {formatShortDate(p.to)}</span><span className="t2">Flood extent</span></span>
                <span className="v num"><b>{a ? a.km2 : '—'}</b><small>{a ? a.acres : ''}</small></span>
              </button>
            )
          })}
        </div>
      )}
      <WaterByDate r={r} />
    </>
  ))
}

function Districts({ d, mode }) {
  return (
    <div className="sec">
      <h3>Flood extent by district <span className="muted">{d.done ? `${d.rows.length} districts` : `naming ${d.asked} of ${d.toAsk} areas…`}</span></h3>
      {d.rows.length > 0 && (
        <table className="ctable">
          <thead><tr><th>District</th><th>Flood extent</th><th>Areas</th><th>Share</th></tr></thead>
          <tbody>
            {d.rows.slice(0, 12).map((x) => (
              <tr key={x.district}>
                <td>{x.district}</td>
                <td><span className="area-cell"><span className="k">{formatArea(x.km2, x.acres).km2}</span><span className="a">{formatArea(x.km2, x.acres).acres}</span></span></td>
                <td className="num">{formatNumber(x.count)}</td>
                <td className="num muted">{x.share != null ? `${formatNumber(100 * x.share, 1)}%` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {!d.rows.length && d.done && <div className="muted">No place names available{mode === 'demo' ? ' in the demo beyond the 10 largest areas' : ''}.</div>}
      <div className="foot">
        Each area is assigned to the district of its centre; large areas can cross district lines. Named so far: {formatNumber(100 * d.namedShare)}% of the summed area{mode === 'demo' ? ' (the demo stores names for the 10 largest areas only)' : ''}. Districts from OpenStreetMap, not official boundaries.
      </div>
    </div>
  )
}

const SIZES = [['All', 0], ['≥ 1 km²', 1], ['≥ 10 km²', 10]]
const PAGE = 25

function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Every flood area of the run: sort, filter by size or by the map view, page through, export. */
function AllAreas({ regions, places, run }) {
  const { viewBounds, selectedRegionId, selectRegion } = useMapStore()
  const [sort, setSort] = useState('size')
  const [min, setMin] = useState(0)
  const [inView, setInView] = useState(false)
  const [shown, setShown] = useState(PAGE)
  const list = useMemo(() => {
    const b = inView ? viewBounds : null
    const out = regions.filter((r) => r.km2 >= min && (!b || (r.lon >= b.west && r.lon <= b.east && r.lat >= b.south && r.lat <= b.north)))
    const hi = (r) => (r.pixels ? r.high / r.pixels : 0)
    out.sort(sort === 'size' ? (a, b) => b.acres - a.acres : (a, b) => hi(b) - hi(a) || b.acres - a.acres)
    return out
  }, [regions, min, inView, viewBounds, sort])
  const sum = list.reduce((s, r) => s + r.acres, 0)
  const zoom = (r) => {
    selectRegion(r.id)
    mapHandle.current?.flyTo({ center: [r.lon, r.lat], zoom: Math.max(mapHandle.current.getZoom(), 11), duration: 700, padding: freePadding(0) })
  }
  const reset = (fn) => (v) => { fn(v); setShown(PAGE) }
  return (
    <div className="sec">
      <h3>All areas <span className="muted">{formatNumber(list.length)} of {formatNumber(regions.length)}</span></h3>
      <div className="aa-filters">
        <div className="seg sm" role="group" aria-label="Minimum size">
          {SIZES.map(([l, v]) => <button key={l} type="button" aria-pressed={min === v} onClick={() => reset(setMin)(v)}>{l}</button>)}
        </div>
        <button type="button" className="chip sm" aria-pressed={inView} onClick={() => reset(setInView)(!inView)}>In this view</button>
        <select className="aa-sort" aria-label="Sort" value={sort} onChange={(e) => reset(setSort)(e.target.value)}>
          <option value="size">Largest first</option>
          <option value="conf">Most high confidence</option>
        </select>
      </div>
      {list.length > 0 && (
        <>
          <div className="aa-sum num">{formatArea(sum * KM2_PER_ACRE, sum).km2} <span className="muted">· {formatArea(sum * KM2_PER_ACRE, sum).acres} in the list</span></div>
          <table className="ctable aa-table">
            <thead><tr><th>#</th><th>Place or centre</th><th>Area</th><th title="Share of pixels with high confidence">High</th></tr></thead>
            <tbody>
              {list.slice(0, shown).map((r, i) => {
                const a = formatArea(r.km2, r.acres)
                return (
                  <tr key={r.id} aria-current={selectedRegionId === r.id || undefined} onClick={() => zoom(r)} tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') zoom(r) }} title="Zoom to this area">
                    <td className="num muted">{i + 1}</td>
                    <td className="aa-name">{placeLabel(places[r.id]) || <span className="mono">{r.lat.toFixed(4)}, {r.lon.toFixed(4)}</span>}</td>
                    <td><span className="area-cell"><span className="k">{a.km2}</span><span className="a">{a.acres}</span></span></td>
                    <td className="num muted">{r.pixels ? `${formatNumber((100 * r.high) / r.pixels)}%` : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div className="aa-more">
            {shown < list.length && <button type="button" className="btn btn-sm" onClick={() => setShown(shown + PAGE)}>Show {Math.min(PAGE, list.length - shown)} more</button>}
            <button type="button" className="btn btn-sm" onClick={() => download(`${run.id}_areas.csv`, hotspotsCsv(list, places), 'text/csv')}><Icon name="download" size={13} />CSV of this list</button>
          </div>
        </>
      )}
      {list.length === 0 && <div className="muted">{inView ? 'No area has its centre in this view. Zoom out or switch off "In this view".' : 'No area of this size.'}</div>}
      <div className="foot">Click a row to zoom to it. Names come with the district lookup above; unnamed areas show their centre.{inView ? ' In this view counts areas whose centre is on screen.' : ''}</div>
    </div>
  )
}

export function RegionsView({ run }) {
  const rep = useReport(run)
  const { mode, geo, places, regions } = useRunAreas(run)
  const d = useDistricts(regions, mode, run.places)
  const names = useMemo(() => ({ ...d.places, ...places }), [d.places, places])
  return withReport(rep, (r) => (
    <>
      {geo?.status === 'ok' && <Districts d={d} mode={mode} />}
      {geo?.status === 'ok' ? <AllAreas regions={regions} places={names} run={run} /> : geo?.status === 'error' ? <div className="sec"><div className="err-text">Areas file could not be read.</div></div> : <Loading />}
      {mode === 'local' && geo?.status === 'ok' && <div className="sec"><div className="foot" style={{ marginTop: 0 }}>Place names: © OpenStreetMap contributors (nearest named place to the area centre).</div></div>}
      <RegionStats runId={run.id} pixelM={r.pixelSpacingM} />
    </>
  ))
}

const BAND_DEFAULTS = { L: { seed: -5, growth: -2.5, minChange: -3 }, S: { seed: -4.8, growth: -2.2, minChange: -2.7 } }

/** Checks built only from report fields. Each line passes or carries a note; no overall score. */
function Quality({ r }) {
  const m = r.method
  const tfA = granuleTrackFrame(r.activeId), tfB = granuleTrackFrame(r.baselineId)
  const same = tfA && tfB && tfA.track === tfB.track && tfA.frame === tfB.frame
  const gap = r.activeDate && r.baselineDate ? days(r.baselineDate, r.activeDate) : null
  const d = BAND_DEFAULTS[r.band]
  const eq = (a, b) => Number.isFinite(a) && Math.abs(a - b) < 1e-3
  const defaults = d && eq(m.seedDb, d.seed) && eq(m.growthDb, d.growth) && eq(m.minChangeDb, d.minChange)
  const realWarnings = r.warnings.filter((w) => !/swath coverage/i.test(w))
  const checks = [
    [same, 'Same track and frame on both dates', tfA ? `Track ${tfA.track}, frame ${tfA.frame}, ${tfA.direction.toLowerCase()}` : 'Not readable from the file names'],
    [gap != null && gap > 0, 'Later pass is after the earlier one', gap != null ? `${gap} days apart` : '—'],
    [realWarnings.length === 0, 'No engine warnings', realWarnings.length ? realWarnings.join(' ') : 'Only the swath-coverage note'],
    [m.edgeErosionPx > 0, 'Scene edge removed', m.edgeErosionPx != null ? `${m.edgeErosionPx} px (${formatNumber((m.edgeErosionPx * (r.pixelSpacingM || 0)) / 1000, 1)} km)` : '—'],
    [!!m.speckle && m.speckle !== 'none', 'Speckle filter applied', m.speckle || '—'],
    [defaults, 'Thresholds at band defaults', defaults ? `${r.band}-band defaults` : 'Custom thresholds: compare with care'],
    [m.coherenceUsed === true, 'Coherence (GUNW) used', m.coherenceUsed ? 'Used' : 'Not used: no interferometric check'],
  ]
  const ok = checks.filter((c) => c[0]).length
  return (
    <div className="sec">
      <h3>Quality checks <span className="muted">{ok} of {checks.length} pass</span></h3>
      <ul className="checks">
        {checks.map(([pass, label, note]) => (
          <li key={label} className={pass ? 'ok' : 'note'}>
            <span className="ck" aria-label={pass ? 'pass' : 'note'}>{pass ? '✓' : 'i'}</span>
            <span><b>{label}</b><small>{note}</small></span>
          </li>
        ))}
      </ul>
      <div className="foot">Valid radar pixels: {formatPercent(r.valid.km2, r.footprint.km2)} of the scene grid. The rest is outside the rotated swath, not missing data.</div>
    </div>
  )
}

export function ReportsView({ run }) {
  const rep = useReport(run)
  const { mode, top, places } = useRunAreas(run)
  return withReport(rep, (r) => (
    <>
      <TakeAway run={run} mode={mode} list={top} places={places} />
      <Quality r={r} />
      <Classes r={r} />
      <Method r={r} />
      <Product r={r} />
    </>
  ))
}
