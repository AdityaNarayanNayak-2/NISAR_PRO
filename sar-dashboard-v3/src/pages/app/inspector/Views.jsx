// What the right panel shows for each nav tab. Each fact has one owner tab:
//   Live Map    run summary, sum in view / drawn area, confidence
//   Time Series flood extent per period and water on each date for the frame
//   Regions     largest areas with place names, areas by size
//   Reports     situation report and files, class table, thresholds, method, product
//   Evaluation  Sentinel-2 agreement (Validation.jsx)
// The flood extent number itself lives on the left run card.
import { useMemo, useState } from 'react'
import { useRunStore } from '../stores/useRunStore'
import { periodsFor } from '../lib/regions'
import { formatArea, formatDate, formatNumber, formatShortDate } from '../lib/units'
import { InView, Hotspots, Confidence, TakeAway } from './Brief'
import useRunAreas from './useRunAreas'
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

/** Acquisition start time from a NISAR file name, e.g. ..._20260912T233810_... → Date (UTC). */
function acquired(id) {
  const m = /_(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})_/.exec(id || '')
  return m ? new Date(Date.UTC(+m[1], m[2] - 1, +m[3], +m[4], +m[5], +m[6])) : null
}

function RunFacts({ r }) {
  const [now] = useState(() => Date.now())
  const at = acquired(r.activeId)
  const days = at ? Math.round((now - at.getTime()) / 86400000) : null
  return (
    <div className="sec">
      <p className="lead">Water detected by radar on {formatDate(r.activeDate)} that was not there on {formatDate(r.baselineDate)}. Not confirmed on the ground.</p>
      <div className="facts">
        <div><span>Radar</span><b>{r.band ? `${r.band}-band ${r.polarization || ''}` : '—'}</b></div>
        <div><span>Later pass</span><b>{at ? `${at.toISOString().slice(11, 16)} UTC` : '—'}</b><small>{days != null ? (days < 2 ? 'today' : `${formatNumber(days)} days ago`) : ''}</small></div>
        <div><span>Areas</span><b className="num">{r.regions != null ? formatNumber(r.regions) : '—'}</b></div>
      </div>
    </div>
  )
}

export function LiveMapView({ run }) {
  const rep = useReport(run)
  const { geo, regions, split } = useRunAreas(run)
  return withReport(rep, (r) => (
    <>
      <RunFacts r={r} />
      {geo?.status === 'ok' && <InView regions={regions} />}
      {geo?.status === 'loading' && <Loading />}
      {geo?.status === 'error' && <div className="sec"><div className="err-text">Areas file could not be read.</div></div>}
      {geo?.status === 'ok' && <Confidence split={split} />}
      <Warnings warnings={r.warnings} />
    </>
  ))
}

export function TimeSeriesView({ run }) {
  const rep = useReport(run)
  const runs = useRunStore((s) => s.runs)
  const open = useRunStore((s) => s.open)
  const periods = useMemo(() => periodsFor(runs, run), [runs, run])
  return withReport(rep, (r) => (
    <>
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

export function RegionsView({ run }) {
  const rep = useReport(run)
  const { mode, geo, top, places } = useRunAreas(run)
  return withReport(rep, (r) => (
    <>
      {geo?.status === 'ok' ? <Hotspots list={top} places={places} mode={mode} /> : geo?.status === 'error' ? <div className="sec"><div className="err-text">Areas file could not be read.</div></div> : <Loading />}
      <RegionStats runId={run.id} pixelM={r.pixelSpacingM} />
    </>
  ))
}

export function ReportsView({ run }) {
  const rep = useReport(run)
  const { mode, top, places } = useRunAreas(run)
  return withReport(rep, (r) => (
    <>
      <TakeAway run={run} mode={mode} list={top} places={places} />
      <Classes r={r} />
      <Method r={r} />
      <Product r={r} />
    </>
  ))
}
