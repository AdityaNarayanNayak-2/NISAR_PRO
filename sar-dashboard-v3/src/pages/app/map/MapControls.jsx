// Controls that sit on the map, in fixed slots (zoom and basemap, layers legend, replay, timeline).
import { useEffect, useRef, useState } from 'react'
import { useRunStore } from '../stores/useRunStore'
import { useMapStore } from '../stores/useMapStore'
import { CLASSES } from '../lib/report'
import { formatShortDate } from '../lib/units'
import { mapHandle, fitBbox } from './mapHandle'
import Icon from '../ui/Icon'
import Timeline from './Timeline'

function Legend({ report, narrow }) {
  const { layers, toggleLayer, opacity, setOpacity, phase } = useMapStore()
  // null = follow the map width; a click pins the user's choice.
  const [pinned, setOpen] = useState(null)
  const open = pinned ?? !narrow
  const rows = CLASSES.filter((c) => c.code !== 0)
  if (!open) {
    return (
      <button type="button" className="mctl legend-chip" onClick={() => setOpen(true)} aria-label="Show layers">
        {rows.map((c) => <span key={c.code} className="sw" style={{ background: c.color, margin: 0 }} />)}
        <span style={{ marginLeft: 6 }}>Layers</span>
      </button>
    )
  }
  return (
    <div className="mctl legend" data-map-ctl>
      <h4>
        Layers
        <button type="button" className="icon-btn" style={{ width: 24, height: 24 }} onClick={() => setOpen(false)} aria-label="Collapse layers"><Icon name="down" size={14} /></button>
      </h4>
      {rows.map((c) => {
        const none = report && report.classes.find((x) => x.code === c.code)?.km2 === 0
        return (
          <button key={c.code} type="button" role="switch" aria-checked={!!layers[c.code]} className={`lg-row ${none ? 'none' : ''}`} onClick={() => toggleLayer(c.code)} disabled={phase !== 'detected'}>
            <span className="sw" style={{ background: c.color }} />
            {c.legend || c.label}
            <span className="eye">{none ? 'none' : layers[c.code] ? 'On' : 'Off'}</span>
          </button>
        )
      })}
      <button type="button" role="switch" aria-checked={layers.radar !== false} className="lg-row" onClick={() => toggleLayer('radar')} disabled={phase !== 'detected'}>
        <span className="sw" style={{ background: 'linear-gradient(135deg,#333,#ccc)' }} />
        Radar image
        <span className="eye">{layers.radar !== false ? 'On' : 'Off'}</span>
      </button>
      <label>
        Overlay opacity {Math.round(opacity * 100)}%
        <input type="range" min="0" max="1" step="0.05" value={opacity} onChange={(e) => setOpacity(Number(e.target.value))} style={{ '--fill': `${opacity * 100}%` }} />
      </label>
    </div>
  )
}

const PHASES = ['baseline', 'active', 'detected']

function Replay({ report }) {
  const { phase, setPhase, playing, setPlaying } = useMapStore()
  useEffect(() => {
    if (!playing) return
    const t = setInterval(() => {
      const i = PHASES.indexOf(useMapStore.getState().phase)
      if (i >= PHASES.length - 1) { setPlaying(false); return }
      setPhase(PHASES[i + 1])
    }, 1800)
    return () => clearInterval(t)
  }, [playing, setPhase, setPlaying])
  const atEnd = phase === 'detected'
  const onPlay = () => {
    if (playing) return setPlaying(false)
    if (atEnd) setPhase('baseline') // rewind, then play
    setPlaying(true)
  }
  return (
    <div className="mctl replay" data-map-ctl role="group" aria-label="Replay">
      <button type="button" className="play" onClick={onPlay} aria-label={playing ? 'Pause' : atEnd ? 'Replay from baseline' : 'Play'}>
        <Icon name={playing ? 'pause' : atEnd ? 'replay' : 'play'} />
      </button>
      <div className="segs">
        <button type="button" aria-pressed={phase === 'baseline'} onClick={() => { setPlaying(false); setPhase('baseline') }}>Baseline {formatShortDate(report?.baselineDate)}</button>
        <button type="button" aria-pressed={phase === 'active'} onClick={() => { setPlaying(false); setPhase('active') }}>Active {formatShortDate(report?.activeDate)}</button>
        <button type="button" aria-pressed={phase === 'detected'} onClick={() => { setPlaying(false); setPhase('detected') }}>Detected</button>
      </div>
    </div>
  )
}

export default function MapControls() {
  const run = useRunStore((s) => s.runs.find((r) => r.id === s.openId))
  const report = useRunStore((s) => (s.openId ? s.reports[s.openId]?.data : null))
  const basemap = useMapStore((s) => s.basemap)
  const setBasemap = useMapStore((s) => s.setBasemap)
  const hasReplay = !!(run?.artifacts?.active_preview && run?.artifacts?.baseline_preview && run?.bbox)
  // Narrow map: legend starts as a chip and replay moves to the top, so they never meet.
  const [narrow, setNarrow] = useState(false)
  const slots = useRef(null)
  useEffect(() => {
    const el = slots.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setNarrow(e.contentRect.width < 640))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return (
    <div className="map-slots" ref={slots}>
      <div className="mctl zoom" data-map-ctl>
        <button type="button" aria-label="Zoom in" onClick={() => mapHandle.current?.zoomIn()}>+</button>
        <button type="button" aria-label="Zoom out" onClick={() => mapHandle.current?.zoomOut()}>−</button>
        {run?.bbox && <button type="button" aria-label="Fit to run" title="Fit to run" onClick={() => fitBbox(run.bbox)}>⤢</button>}
        <button type="button" aria-label={basemap === 'plain' ? 'Show satellite imagery' : 'Hide satellite imagery'} title={basemap === 'plain' ? 'Satellite basemap' : 'Plain basemap'} aria-pressed={basemap !== 'plain'} onClick={() => setBasemap(basemap === 'plain' ? 'satellite' : 'plain')}><Icon name="globe" size={15} /></button>
      </div>
      {run?.artifacts?.overlay && <Legend report={report} narrow={narrow} />}
      <div className="bottom-stack">
        {hasReplay && <Replay report={report} />}
        <Timeline />
      </div>
    </div>
  )
}
