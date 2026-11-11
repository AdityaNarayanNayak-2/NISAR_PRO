// Acquisition timeline for one track·frame: dots are acquisition dates, spans are runs.
// L runs sit in the lane next to the axis, S runs in the lane above. Click a span to open it.
import { useMemo, useState } from 'react'
import { useRunStore } from '../stores/useRunStore'
import { runStatus } from '../lib/gateway'
import { runInfo } from '../lib/runInfo'
import { frameKey } from '../lib/regions'
import { formatShortDate } from '../lib/units'

const DAY = 86400000
const t = (iso) => Date.parse(`${iso}T00:00:00Z`)

export default function Timeline() {
  const { runs, openId, open, scenes } = useRunStore()
  const [tip, setTip] = useState(null)
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
    return { dates: list, spans: shown }
  }, [key, runs, scenes, openId])

  if (!data) return null
  const [track, frame] = key.split('/')
  const W = 640
  const PAD = 28
  const t0 = t(data.dates[0][0])
  const t1 = t(data.dates[data.dates.length - 1][0])
  const span = Math.max(t1 - t0, DAY)
  // Place by date, but keep dots at least 56 px apart.
  const xs = []
  data.dates.forEach(([iso], i) => {
    const x = data.dates.length === 1 ? W / 2 : PAD + ((t(iso) - t0) / span) * (W - 2 * PAD)
    xs.push(i === 0 ? x : Math.max(x, xs[i - 1] + 56))
  })
  const scale = xs[xs.length - 1] > W - PAD && xs.length > 1 ? (W - 2 * PAD) / (xs[xs.length - 1] - xs[0]) : 1
  const X = Object.fromEntries(data.dates.map(([iso], i) => [iso, PAD + (xs[i] - xs[0]) * scale + (data.dates.length === 1 ? W / 2 - PAD : 0)]))
  const AXIS = 40
  const LANE = { L: AXIS - 12, S: AXIS - 22 }
  const hasRun = (iso) => data.spans.some((s) => s.from === iso || s.to === iso)

  return (
    <div className="timeline mctl" data-map-ctl>
      <div className="tl-head">Track {track} · Frame {frame}<span className="muted">{data.dates.length} acquisitions</span></div>
      <svg viewBox={`0 0 ${W} 70`} width="100%" height="70" role="group" aria-label="Acquisitions and runs">
        <line x1={PAD - 12} x2={W - PAD + 12} y1={AXIS} y2={AXIS} className="tl-axis" />
        {data.spans.map((s) => {
          const x1 = X[s.from], x2 = X[s.to]
          const y = LANE[s.band] ?? LANE.L
          const sel = s.id === openId
          return (
            <g key={s.id} className={`tl-span ${sel ? 'sel' : ''} ${s.kind}`} onClick={() => open(s.id)}
              onMouseEnter={() => setTip({ x: (x1 + x2) / 2, text: s.title })} onMouseLeave={() => setTip(null)}
              role="button" tabIndex={0} aria-label={`Open ${s.title}`} aria-current={sel}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(s.id) } }}>
              <rect x={x1} y={y - 12} width={Math.max(x2 - x1, 4)} height={24} fill="transparent" />
              <rect x={x1 + 5} y={y - 3} width={Math.max(x2 - x1 - 10, 4)} height={6} rx={3} className="bar" />
            </g>
          )
        })}
        {data.dates.map(([iso, bands]) => (
          <g key={iso}>
            <circle cx={X[iso]} cy={AXIS} r={4} className={`tl-dot ${hasRun(iso) ? '' : 'hollow'} ${run && (runInfo(run).baselineDate === iso || runInfo(run).activeDate === iso) ? 'sel' : ''}`} />
            <text x={X[iso]} y={AXIS + 14} className="tl-date" textAnchor="middle">{formatShortDate(iso)}</text>
            <text x={X[iso]} y={AXIS + 24} className="tl-band" textAnchor="middle">{[...bands].sort().join(' ')}</text>
          </g>
        ))}
        {tip && <text x={tip.x} y={8} className="tl-tip" textAnchor="middle">{tip.text}</text>}
      </svg>
      {data.dates.length === 1 && <div className="muted tl-empty">A run needs two dates.</div>}
    </div>
  )
}
