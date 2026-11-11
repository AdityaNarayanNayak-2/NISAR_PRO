// Left bento stack: system status with the flood extent of the run in focus, and run cards.
// Every value comes from the gateway (or the demo manifest); nothing is made up.
import { useEffect, useMemo, useState } from 'react'
import { useRunStore } from '../stores/useRunStore'
import { gatewayBase, runStatus } from '../lib/gateway'
import { granuleTrackFrame } from '../lib/report'
import { periodsFor } from '../lib/regions'
import { runInfo } from '../lib/runInfo'
import { formatArea, formatNumber, formatShortDate } from '../lib/units'
import Icon from '../ui/Icon'
import RunSwitcher from './RunSwitcher'

function useAuth(mode) {
  const [auth, setAuth] = useState(null)
  useEffect(() => {
    if (mode !== 'local') return
    fetch(`${gatewayBase()}/asf/auth-status`).then((r) => r.json()).then(setAuth).catch(() => {})
  }, [mode])
  return auth
}

function Tile({ label, value, sub }) {
  return (
    <div className="tile">
      <span className="tile-l">{label}</span>
      <span className="tile-v">{value}</span>
      {sub && <span className="tile-s">{sub}</span>}
    </div>
  )
}

/** Flood extent per period on one frame and band, as a line. The run in focus is the white dot. */
function Spark({ periods, focusId }) {
  const pts = periods.filter((p) => p.gain)
  if (pts.length < 2) return null
  const W = 280, H = 56, P = 6
  const max = Math.max(...pts.map((p) => p.gain.km2)) || 1
  const x = (i) => P + (i / (pts.length - 1)) * (W - 2 * P)
  const y = (v) => H - P - (v / max) * (H - 2 * P - 10)
  const line = pts.map((p, i) => `${x(i)},${y(p.gain.km2)}`).join(' ')
  return (
    <svg className="spark" viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Flood extent per period on this frame">
      <line x1={P} x2={W - P} y1={H - P} y2={H - P} className="base" />
      <polyline points={line} className="ln" />
      {pts.map((p, i) => (
        <g key={p.id}>
          <circle cx={x(i)} cy={y(p.gain.km2)} r={p.id === focusId ? 4 : 2.5} className={p.id === focusId ? 'pt on' : 'pt'} />
          <title>{`${formatShortDate(p.from)} → ${formatShortDate(p.to)}: ${formatArea(p.gain.km2, p.gain.acres).km2}`}</title>
        </g>
      ))}
    </svg>
  )
}

function StatusCard() {
  const { mode, runs, scenes, openId, setView } = useRunStore()
  const auth = useAuth(mode)
  const done = runs.filter((r) => runStatus(r).kind === 'completed')
  const busy = runs.filter((r) => ['running', 'queued'].includes(runStatus(r).kind)).length
  const bands = [...new Set(done.map((r) => r.summary?.band).filter(Boolean))].sort()
  const focus = runs.find((r) => r.id === openId && runStatus(r).kind === 'completed') || done[0]
  const periods = focus ? periodsFor(runs, focus) : []
  const nw = focus?.summary?.new_water
  const a = nw ? formatArea(nw.km2, nw.acres) : null
  const info = runInfo(focus)
  return (
    <section className="bento" aria-label="System status">
      <div className="bento-head">
        <h2>System status</h2>
        <span className="muted">{{ local: 'This computer', demo: 'Demo data', offline: 'Gateway offline', connecting: 'Connecting' }[mode]}</span>
      </div>
      <div className="tiles">
        <Tile label="Sensor" value={bands.length ? `NISAR ${bands.join(' · ')}` : 'NISAR'} sub={bands.length ? 'bands with runs' : null} />
        <Tile label="Finished runs" value={formatNumber(done.length)} sub={busy ? `${busy} in progress` : null} />
        <Tile label="Scenes on disk" value={mode === 'local' ? (scenes ? formatNumber(scenes.length) : '—') : 'n/a'} sub={mode === 'local' ? 'GCOV .h5' : null} />
        <Tile label="Earthdata" value={mode !== 'local' ? 'n/a' : !auth ? '—' : auth.authenticated ? 'Signed in' : 'Search only'} sub={mode === 'local' && auth && !auth.authenticated ? 'login needed to download' : null} />
      </div>
      {a && (
        <div className="kpi">
          <div className="kpi-head">
            <span>Flood extent{focus.id === openId ? '' : ', latest run'}</span>
            <button type="button" className="arrow-btn" aria-label="Open time series" title="Time series" onClick={() => { if (focus.id !== openId) useRunStore.getState().open(focus.id); setView('timeseries') }}><Icon name="external" size={13} /></button>
          </div>
          <div className="kpi-v num">{a.km2.replace(' km²', '')}<span className="u"> km²</span></div>
          <div className="kpi-s num">{a.acres} · {info.band}-band {info.dates}</div>
          <Spark periods={periods} focusId={focus.id} />
        </div>
      )}
    </section>
  )
}

function RunCard({ run, on }) {
  const open = useRunStore((s) => s.open)
  const st = runStatus(run)
  const info = runInfo(run)
  const tf = granuleTrackFrame(run.summary?.active_id || run.request?.input_file)
  const nw = run.summary?.new_water
  const preset = run.summary?.crop_preset || run.request?.crop_preset
  const q = run.request || {}
  const pol = (q.polarization || '').toUpperCase()
  const custom = ['seed_threshold_db', 'growth_threshold_db', 'min_change_db', 'min_area_pixels', 'permanent_water_thresh_db'].some((k) => q[k] != null)
  return (
    <button type="button" className="run-card" aria-current={on || undefined} onClick={() => open(run.id)} title={run.id}>
      <span className="rc-top">
        <span className="badge sm">{info.band || '?'}</span>
        <span className="rc-arrow" aria-hidden="true"><Icon name="external" size={12} /></span>
      </span>
      <span className="rc-dates">{info.baselineDate && info.activeDate ? `${formatShortDate(info.baselineDate)} → ${formatShortDate(info.activeDate)}` : run.id}</span>
      <span className="rc-sub">{[tf && `T${tf.track} · F${tf.frame}`, preset && preset !== 'full' ? preset.replace('x', ' × ') : null, pol && pol !== 'HH' ? pol : null, custom ? 'custom thresholds' : null].filter(Boolean).join(' · ') || '—'}</span>
      <span className="rc-foot">
        {st.kind === 'completed' && nw ? <span className="num">{formatNumber(nw.km2, nw.km2 < 10 ? 2 : 0)} km²</span> : <span className="muted">{st.kind === 'failed' ? 'Failed' : st.kind === 'completed' ? '—' : 'Processing'}</span>}
        {st.kind === 'running' || st.kind === 'queued' ? <span className="spin" /> : <span className={`dot ${st.kind === 'completed' ? 'ok' : st.kind === 'failed' ? 'err' : ''}`} />}
      </span>
    </button>
  )
}

function RunsCard() {
  const { runs, openId, loaded, mode, showForm } = useRunStore()
  const list = useMemo(() => {
    const sorted = [...runs].sort((a, b) => (b.created_at || 0) - (a.created_at || 0))
    const shown = sorted.slice(0, 4)
    const open = runs.find((r) => r.id === openId)
    if (open && !shown.includes(open)) shown[3] = open
    return shown
  }, [runs, openId])
  return (
    <section className="bento" aria-label="Runs">
      <div className="bento-head">
        <h2>Runs</h2>
        {runs.length > 0 && <RunSwitcher />}
      </div>
      {!loaded && <div className="skel" />}
      {loaded && !runs.length && (
        <div className="bento-empty">
          <p>No runs yet.</p>
          {mode === 'local' && <button type="button" className="btn btn-accent btn-sm" onClick={showForm}><Icon name="plus" size={13} />New run</button>}
        </div>
      )}
      {list.length > 0 && <div className="run-grid">{list.map((r) => <RunCard key={r.id} run={r} on={r.id === openId} />)}</div>}
    </section>
  )
}

export default function LeftStack({ onHide }) {
  return (
    <div className="ws-left" data-panel="left">
      <StatusCard />
      <RunsCard />
      <button type="button" className="hide-left" onClick={onHide}><Icon name="back" size={13} />Hide panel</button>
    </div>
  )
}
