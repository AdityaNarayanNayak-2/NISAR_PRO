// Right panel (380 px, full height). Shows the tab picked in the nav pill.
import { useEffect, useRef, useState } from 'react'
import { useRunStore, STAGES } from '../stores/useRunStore'
import { runStatus } from '../lib/gateway'
import { runInfo } from '../lib/runInfo'
import { LiveMapView, TimeSeriesView, RegionsView, ReportsView } from './Views'
import Validation from './Validation'
import ImpactView from './Impact'
import WatchView from './Watch'
import ProcessPanel from '../form/ProcessPanel'
import Home from './Home'
import Icon from '../ui/Icon'

function Elapsed({ since }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t) }, [])
  const s = Math.max(0, Math.round((now - since) / 1000))
  return <span className="num">{Math.floor(s / 60)}:{String(s % 60).padStart(2, '0')}</span>
}

function Running({ run, onShowLog }) {
  const st = useRunStore((s) => s.stages[run.id])
  const cancel = useRunStore((s) => s.cancel)
  const idx = STAGES.findIndex((x) => x.key === st?.stage)
  const queued = runStatus(run).kind === 'queued'
  return (
    <div className="sec">
      <h3>{queued ? 'Waiting for a free processor slot' : 'Processing'}</h3>
      <ol className="stages">
        {STAGES.map((s, i) => (
          <li key={s.key} className={i < idx ? 'done' : i === idx ? 'now' : ''}>
            {i === idx ? <span className="spin" /> : <span className="ck" />}
            {s.label}
          </li>
        ))}
      </ol>
      <div className="foot">Elapsed {st?.startedAt ? <Elapsed since={st.startedAt} /> : '—'}</div>
      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <button type="button" className="btn" onClick={onShowLog}>Show log</button>
        <button type="button" className="btn btn-danger" onClick={() => cancel(run.id)}>Cancel</button>
      </div>
    </div>
  )
}

function Failed({ run, onShowLog }) {
  const lines = useRunStore((s) => s.logs[run.id]) || []
  const st = runStatus(run)
  return (
    <div className="sec">
      <h3 style={{ color: 'var(--err)' }}>Run failed</h3>
      <div className="warn-row" style={{ borderColor: 'rgba(248,113,113,.4)' }}>{st.message || 'The processor stopped with an error.'}</div>
      {lines.length > 0 && <div className="log-tail">{lines.slice(-6).join('\n')}</div>}
      <div style={{ marginTop: 16 }}><button type="button" className="btn" onClick={onShowLog}>Show log</button></div>
    </div>
  )
}

const TITLES = { map: 'Live map', timeseries: 'Time series', regions: 'Regions', impact: 'Impact', reports: 'Reports', processing: 'Processing', watch: 'Watch', evaluation: 'Evaluation hub' }
const RUN_BODY = { map: LiveMapView, timeseries: TimeSeriesView, regions: RegionsView, impact: ImpactView, reports: ReportsView, evaluation: Validation }

function PickRun() {
  return (
    <div className="empty-state">
      <h3>Open a run first</h3>
      <p>Pick one of the runs on the left, or a span on the timeline.</p>
    </div>
  )
}

export default function Inspector({ onClose }) {
  const { view, openId, runs, toggleLog, logOpen, mode } = useRunStore()
  const run = runs.find((r) => r.id === openId)
  const scroll = useRef(null)
  useEffect(() => { scroll.current?.scrollTo(0, 0) }, [openId, view])
  const onShowLog = () => toggleLog(true)

  const info = runInfo(run)
  const kind = run ? runStatus(run).kind : null
  const Body = RUN_BODY[view]
  let body
  if (view === 'processing') {
    body = (
      <>
        {run && (kind === 'running' || kind === 'queued') && <Running run={run} onShowLog={onShowLog} />}
        <ProcessPanel />
      </>
    )
  } else if (view === 'watch') {
    body = <div className="insp-scroll" ref={scroll}><WatchView /></div>
  } else if (!run) {
    body = <div className="insp-scroll" ref={scroll}>{view === 'map' ? <Home /> : <PickRun />}</div>
  } else {
    body = (
      <div className="insp-scroll" ref={scroll}>
        {kind === 'completed' && <Body run={run} />}
        {(kind === 'running' || kind === 'queued') && <Running run={run} onShowLog={onShowLog} />}
        {kind === 'failed' && <Failed run={run} onShowLog={onShowLog} />}
      </div>
    )
  }
  return (
    <aside className="ws-insp" data-panel="inspector" aria-label={TITLES[view]}>
      <button type="button" className="sheet-grip" aria-label="Resize panel" onClick={() => {
        const el = document.querySelector('.ws')
        const cur = getComputedStyle(el).getPropertyValue('--sheet-h').trim()
        el.style.setProperty('--sheet-h', cur === '50dvh' ? 'calc(100dvh - 72px)' : cur === 'calc(100dvh - 72px)' ? '96px' : '50dvh')
      }} />
      <div className="insp-head">
        <div className="t">
          <div className="t1">{TITLES[view]}</div>
          {view === 'watch' && <div className="t2">New passes, processed on their own</div>}
          {run && view !== 'processing' && view !== 'watch' && <div className="t2">{info.band && <span className="badge sm">{info.band}</span>}{info.dates || run.id}</div>}
          {view === 'processing' && <div className="t2">Water change between two passes</div>}
        </div>
        {mode === 'local' && view === 'processing' && <button type="button" className="chip sm" aria-pressed={logOpen} onClick={() => toggleLog()}><Icon name="log" size={13} />Log</button>}
        {run && view !== 'processing' && view !== 'watch' && <button type="button" className="icon-btn" onClick={() => useRunStore.getState().close()} aria-label="Close run" title="Close run"><Icon name="back" /></button>}
        <button type="button" className="icon-btn hide-mobile" onClick={onClose} aria-label="Hide panel" title="Hide panel  ]"><Icon name="close" /></button>
      </div>
      {body}
    </aside>
  )
}
