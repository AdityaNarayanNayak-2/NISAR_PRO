// One dB axis with every detection threshold on it (Design Spec §12.6).
// Used read-only in Analysis and live in the Process form. Missing values drop their marker.
const W = 352
const H = 76
const AX = 40

export default function DbRuler({ applied, otsu, seed, growth, minChange, floor }) {
  const vals = [applied, otsu, seed, growth, minChange].filter(Number.isFinite)
  if (!vals.length) return null
  const lo = Math.floor(Math.min(...vals)) - 1
  const hi = Math.ceil(Math.max(...vals)) + 1
  const x = (v) => 12 + ((v - lo) / (hi - lo)) * (W - 24)
  const ticks = []
  for (let v = lo; v <= hi; v++) ticks.push(v)
  // Labels closer than 0.3 dB merge.
  const near = (a, b) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) < 0.3
  const below = [['Seed', seed], ['Growth', growth], ['Min change', minChange]].filter(([, v]) => Number.isFinite(v))
  return (
    <svg className="dbruler" viewBox={`0 0 ${W} ${H}`} width="100%" role="img"
      aria-label={`Thresholds: seed used ${applied ?? '—'} dB, Otsu ${otsu ?? '—'} dB, seed ${seed ?? '—'} dB, growth ${growth ?? '—'} dB, minimum change ${minChange ?? '—'} dB`}>
      {Number.isFinite(seed) && <rect x={12} y={AX - 8} width={Math.max(x(seed) - 12, 0)} height={16} className="band-high" />}
      {Number.isFinite(seed) && Number.isFinite(growth) && <rect x={x(seed)} y={AX - 8} width={Math.max(x(growth) - x(seed), 0)} height={16} className="band-med" />}
      <line x1={12} x2={W - 12} y1={AX} y2={AX} className="axis" />
      {ticks.map((v) => (
        <g key={v}>
          <line x1={x(v)} x2={x(v)} y1={AX - 3} y2={AX + 3} className="axis" />
          {(v - lo) % 2 === 0 && <text x={x(v)} y={H - 2} textAnchor="middle" className="lab">{v}</text>}
        </g>
      ))}
      {below.map(([k, v], i) => (
        <g key={k}>
          <line x1={x(v)} x2={x(v)} y1={AX - 8} y2={AX + 8} className={k === 'Min change' ? 'tick dash' : 'tick'} />
          {!(i > 0 && near(v, below[i - 1][1])) && (
            <text x={x(v)} y={AX + 20} textAnchor="middle" className="lab">{near(v, applied) ? `${k} = used` : k}</text>
          )}
        </g>
      ))}
      {Number.isFinite(otsu) && <path d={`M${x(otsu)},${AX - 5} l4,4 l-4,4 l-4,-4 z`} className="otsu"><title>Otsu {otsu.toFixed(2)} dB</title></path>}
      {Number.isFinite(applied) && (
        <g>
          <line x1={x(applied)} x2={x(applied)} y1={AX - 18} y2={AX + 14} className="applied" />
          <text x={x(applied)} y={AX - 22} textAnchor="middle" className="lab hi">seed used {applied.toFixed(2)} dB</text>
        </g>
      )}
      {Number.isFinite(floor) && <text x={W - 12} y={10} textAnchor="end" className="lab">stable-water floor {floor.toFixed(1)} dB</text>}
    </svg>
  )
}
