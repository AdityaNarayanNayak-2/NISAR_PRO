// Acquisition timeline for one track·frame: dots are acquisition dates, spans are runs.
// Runs that overlap in time get their own lane (L lanes next to the axis, S lanes above).
// Drawn at the real pixel width so the labels stay readable. Click a span to open it.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useRunStore } from '../stores/useRunStore'
import { runStatus } from '../lib/gateway'
import { runInfo } from '../lib/runInfo'
import { frameKey } from '../lib/regions'
import { formatShortDate } from '../lib/units'

const DAY = 86400000
const REPEAT_DAYS = 12
const t = (iso) => Date.parse(`${iso}T00:00:00Z`)

/** Width of an element in CSS pixels, kept up to date. */
function useWidth() {
  const ref = useRef(null)
  const [w, setW] = useState(640)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width) || 640))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, w]
}

/** Greedy interval packing: each span takes the first lane whose last span ended by its start. */
function packLanes(spans) {
  const ends = []
  return [...spans].sort((a, b) => a.from.localeCompare(b.from) || b.to.localeCompare(a.to)).map((s) => {
    let lane = ends.findIndex((end) => end <= s.from)
    if (lane < 0) { lane = ends.length; ends.push(s.to) } else ends[lane] = s.to
    return { ...s, lane }
  })
}

export default function Timeline() {
  const { runs, openId, open, scenes } = useRunStore()
  const [box, boxW] = useWidth()
  const [tip, setTip] = useState(null)
  const [now] = useState(() => Date.now())
  const run = runs.find((r) => r.id === openId)

  // The frame shown: the open run's, else the frame with the most runs.
  const key = useMemo(() => {
    if (run) return frameKey(run)
    const n = new Map()
    for (const r of runs) { const k = frameKey(r); if (k) n.set(k, (n.get(k) || 0) + 1) }
    return [...n.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null
  }, [run, runs])

  const data = useMemo(() => {
    if (!key) return null
    const dates = new Map() // iso -> Set of bands
    const add = (iso, band) => { if (!iso) return; if (!dates.has(iso)) dates.set(iso, new Set()); if (band) dates.get(iso).add(band) }
    const spans = []
    for (const r of runs) {
      if (frameKey(r) !== key) continue
      const i = runInfo(r)
      if (!i.baselineDate || !i.activeDate) continue
      const band = (i.band || '').toUpperCase()
      add(i.baselineDate, band); add(i.activeDate, band)
      spans.push({ id: r.id, band, from: i.baselineDate, to: i.activeDate, kind: runStatus(r).kind, title: i.title, preset: r.summary?.crop_preset || r.request?.crop_preset })
    }
    for (const s of scenes || []) {
      if (s.track == null || `${s.track}/${s.frame}` !== key || !s.date) continue
      add(s.date, (s.band || '').toUpperCase())
    }
    const list = [...dates.entries()].sort((a, b) => a[0].localeCompare(b[0]))
    if (!list.length) return null
    // Same dates and band: keep the newest full-scene run as the span (others stay in the switcher).
    const seen = new Set()
    const shown = spans
      .sort((a, b) => (a.id === openId ? -1 : b.id === openId ? 1 : (b.preset === 'full') - (a.preset === 'full')))
      .filter((s) => { const k = `${s.band}|${s.from}|${s.to}`; if (seen.has(k)) return false; seen.add(k); return true })
    // Expected next pass on this frame: NISAR repeats each track every 12 days. Not a NASA schedule.
    const last = list[list.length - 1][0]
    const next = new Date(t(last) + REPEAT_DAYS * DAY).toISOString().slice(0, 10)
    return { dates: [...list, [next, null]], spans: shown, next }
  }, [key, runs, scenes, openId])

  if (!data) return <div ref={box} hidden />
  const [track, frame] = key.split('/')
  const W = Math.max(boxW, 240)
  const PAD = 28
  const t0 = t(data.dates[0][0])
  const t1 = t(data.dates[data.dates.length - 1][0])
  const span = Math.max(t1 - t0, DAY)
  // Place by date, but keep dots at least 48 px apart.
  const xs = []
  data.dates.forEach(([iso], i) => {
    const x = data.dates.length === 1 ? W / 2 : PAD + ((t(iso) - t0) / span) * (W - 2 * PAD)
    xs.push(i === 0 ? x : Math.max(x, xs[i - 1] + 48))
  })
  const scale = xs[xs.length - 1] > W - PAD && xs.length > 1 ? (W - 2 * PAD) / (xs[xs.length - 1] - xs[0]) : 1
  const X = Object.fromEntries(data.dates.map(([iso], i) => [iso, PAD + (xs[i] - xs[0]) * scale + (data.dates.length === 1 ? W / 2 - PAD : 0)]))
  // Lanes: L runs packed next to the axis, S runs above them.
  const L = packLanes(data.spans.filter((s) => s.band !== 'S'))
  const nL = L.reduce((m, s) => Math.max(m, s.lane + 1), 0)
  const S = packLanes(data.spans.filter((s) => s.band === 'S')).map((s) => ({ ...s, lane: s.lane + nL }))
  const lanes = [...L, ...S]
  const nLanes = lanes.reduce((m, s) => Math.max(m, s.lane + 1), 1)
  const STEP = 9
  const AXIS = 22 + nLanes * STEP
  const H = AXIS + 28
  const hasRun = (iso) => data.spans.some((s) => s.from === iso || s.to === iso)

  return (
    <div className="timeline mctl" data-map-ctl ref={box}>
      <div className="tl-head"><span className="tl-name">Track {track} · Frame {frame}</span><span className="muted">{data.dates.length - 1} acquisitions</span><span className="tl-next" title="From the 12-day repeat of the last acquisition. Not a NASA schedule; check the NASA catalog in Processing.">next pass expected {formatShortDate(data.next)}{Date.parse(data.next) < now ? ', check catalog' : ''}</span></div>
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="group" aria-label="Acquisitions and runs">
        <line x1={PAD - 12} x2={X[data.dates[data.dates.length - 2][0]] + 6} y1={AXIS} y2={AXIS} className="tl-axis" />
        {lanes.map((s) => {
          const x1 = X[s.from], x2 = X[s.to]
          const y = AXIS - 11 - s.lane * STEP
          const sel = s.id === openId
          return (
            <g key={s.id} className={`tl-span ${sel ? 'sel' : ''} ${s.kind}`} onClick={() => open(s.id)}
              onMouseEnter={() => setTip({ x: (x1 + x2) / 2, text: s.title })} onMouseLeave={() => setTip(null)}
              role="button" tabIndex={0} aria-label={`Open ${s.title}`} aria-current={sel}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(s.id) } }}>
              <rect x={x1} y={y - STEP / 2} width={Math.max(x2 - x1, 4)} height={STEP} fill="transparent" />
              <rect x={x1 + 5} y={y - 2.5} width={Math.max(x2 - x1 - 10, 4)} height={5} rx={2.5} className="bar" />
            </g>
          )
        })}
        {data.dates.map(([iso, bands]) => bands === null ? (
          <g key={iso} className="tl-next-g">
            <line x1={X[data.dates[data.dates.length - 2][0]] + 6} x2={X[iso] - 6} y1={AXIS} y2={AXIS} className="tl-next-line" />
            <circle cx={X[iso]} cy={AXIS} r={4} className="tl-dot next" />
            <text x={X[iso]} y={AXIS + 14} className="tl-date" textAnchor="middle">{formatShortDate(iso)}</text>
            <text x={X[iso]} y={AXIS + 24} className="tl-band" textAnchor="middle">expected</text>
          </g>
        ) : (
          <g key={iso}>
            <circle cx={X[iso]} cy={AXIS} r={4} className={`tl-dot ${hasRun(iso) ? '' : 'hollow'} ${run && (runInfo(run).baselineDate === iso || runInfo(run).activeDate === iso) ? 'sel' : ''}`} />
            <text x={X[iso]} y={AXIS + 14} className="tl-date" textAnchor="middle">{formatShortDate(iso)}</text>
            <text x={X[iso]} y={AXIS + 24} className="tl-band" textAnchor="middle">{[...bands].sort().join(' ')}</text>
          </g>
        ))}
        {tip && <text x={Math.min(Math.max(tip.x, 90), W - 90)} y={9} className="tl-tip" textAnchor="middle">{tip.text}</text>}
      </svg>
      {data.dates.length === 2 && <div className="muted tl-empty">A run needs two dates.</div>}
    </div>
  )
}
