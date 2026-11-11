// Trend for one track·frame and band: flood extent per period (columns) and water on each
// date (line). One km² axis. Values come from the runs' own summaries.
import { useState } from 'react'
import { formatArea, formatShortDate, formatNumber } from '../lib/units'

const W = 352
const H = 132
const M = { top: 14, right: 8, bottom: 30, left: 44 }

function niceMax(v) {
  if (!(v > 0)) return 1
  const p = 10 ** Math.floor(Math.log10(v))
  return [1, 2, 2.5, 5, 10].map((m) => m * p).find((x) => x >= v)
}

export default function TrendChart({ periods, openId }) {
  const [hover, setHover] = useState(null)
  // Water on each date: the period where the date is the later one wins, else the earlier one.
  const water = new Map()
  for (const p of periods) {
    const add = (iso, a, b, from) => { if (a && b) water.set(iso, { km2: a.km2 + b.km2, acres: a.acres + b.acres, from }) }
    if (!water.has(p.from)) add(p.from, p.stable, p.loss, p.id)
  }
  for (const p of periods) {
    const a = p.stable, b = p.gain
    if (a && b) water.set(p.to, { km2: a.km2 + b.km2, acres: a.acres + b.acres, from: p.id })
  }
  const dates = [...new Set(periods.flatMap((p) => [p.from, p.to]))].sort()
  const maxV = niceMax(Math.max(...periods.map((p) => p.gain?.km2 || 0), ...[...water.values()].map((w) => w.km2)))
  const iw = W - M.left - M.right
  const ih = H - M.top - M.bottom
  const x = (iso) => M.left + (dates.length === 1 ? iw / 2 : (dates.indexOf(iso) / (dates.length - 1)) * iw)
  const y = (v) => M.top + ih - (v / maxV) * ih
  const ticks = [0, maxV / 2, maxV]
  const pts = dates.filter((d) => water.has(d)).map((d) => [x(d), y(water.get(d).km2), d])

  return (
    <div className="trend">
      <div className="legend-row">
        <span><i className="lg-col" />Flood extent per period</span>
        <span><i className="lg-line" />Water on each date</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Flood extent per period and water on each date, km²">
        {ticks.map((v) => (
          <g key={v}>
            <line x1={M.left} x2={W - M.right} y1={y(v)} y2={y(v)} className="grid" />
            <text x={M.left - 6} y={y(v) + 3} textAnchor="end" className="axis">{formatNumber(v)}</text>
          </g>
        ))}
        <text x={4} y={M.top - 4} className="axis">km²</text>
        {periods.map((p) => {
          if (!p.gain) return null
          const cx = (x(p.from) + x(p.to)) / 2
          const bw = Math.min(24, Math.max(8, (x(p.to) - x(p.from)) * 0.4))
          const sel = p.id === openId
          const top = y(p.gain.km2)
          return (
            <g key={p.id} onMouseEnter={() => setHover({ x: cx, y: top, title: `${formatShortDate(p.from)} → ${formatShortDate(p.to)}`, ...formatArea(p.gain.km2, p.gain.acres), what: 'flood extent' })} onMouseLeave={() => setHover(null)}>
              <rect x={cx - 20} y={M.top} width={40} height={ih} fill="transparent" />
              <path className="col" style={{ opacity: sel ? 1 : 0.45 }}
                d={`M${cx - bw / 2},${M.top + ih} V${top + 4} q0,-4 4,-4 H${cx + bw / 2 - 4} q4,0 4,4 V${M.top + ih} Z`} />
              {sel && <text x={cx} y={top - 5} textAnchor="middle" className="val">{formatNumber(p.gain.km2)}</text>}
            </g>
          )
        })}
        {pts.length > 1 && <polyline points={pts.map(([a, b]) => `${a},${b}`).join(' ')} className="line" />}
        {pts.map(([a, b, d]) => (
          <circle key={d} cx={a} cy={b} r={4} className="pt" onMouseEnter={() => setHover({ x: a, y: b, title: formatShortDate(d), ...formatArea(water.get(d).km2, water.get(d).acres), what: 'water' })} onMouseLeave={() => setHover(null)} />
        ))}
        <line x1={M.left} x2={W - M.right} y1={M.top + ih} y2={M.top + ih} className="base" />
        {dates.map((d) => <text key={d} x={x(d)} y={H - 12} textAnchor="middle" className="axis">{formatShortDate(d)}</text>)}
      </svg>
      {hover && (
        <div className="chart-tip" style={{ left: `${(100 * hover.x) / W}%`, top: `${(100 * hover.y) / H}%` }}>
          <b>{hover.title}</b> · {hover.what}<br />{hover.km2} · {hover.acres}
        </div>
      )}
    </div>
  )
}
