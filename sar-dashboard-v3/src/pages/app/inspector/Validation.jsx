// Validation: agreement with Sentinel-2 from the InGARSS study, only for the dates it covers.
// Labelled as agreement with optical labels on cloud-free pixels, never as accuracy.
import { useEffect, useState } from 'react'
import { useRunStore } from '../stores/useRunStore'
import { loadReference, testsForRun, SERIES } from '../lib/validation'
import { formatArea, formatNumber } from '../lib/units'
import Icon from '../ui/Icon'

const BAND_DEFAULTS = { L: { seed: -5, growth: -2.5, minChange: -3, floor: -13 }, S: { seed: -4.8, growth: -2.2, minChange: -2.7, floor: -12.5 } }

function sameAsStudy(r) {
  const d = BAND_DEFAULTS[r.band]
  const m = r.method
  if (!d) return false
  const eq = (a, b) => Number.isFinite(a) && Math.abs(a - b) < 1e-3
  return r.cropPreset === 'full' && m.edgeErosionPx === 40 && eq(m.seedDb, d.seed) && eq(m.growthDb, d.growth) && eq(m.minChangeDb, d.minChange) && eq(m.permanentWaterDb, d.floor) && (r.polarization || 'HH') === 'HH'
}

function Score({ v }) {
  return <td className="num">{Number.isFinite(v) ? v.toFixed(3) : '—'}</td>
}

function Test({ t, ndwi, band }) {
  const res = t.data.results?.[ndwi] || {}
  const scored = formatArea(t.data.scored_km2, null)
  const ref = Number.isFinite(t.data.reference_water_km2_at_primary) ? formatArea(t.data.reference_water_km2_at_primary, null) : null
  const mine = band === 'S' ? 's_only' : 'l_only'
  return (
    <div className="vtest">
      <div className="vt-head">
        <b>{t.label}</b>
        <span className="muted">{t.data.dates}{t.data.time_gap ? ` · gap ${t.data.time_gap}` : ''}</span>
      </div>
      <table className="ctable vt">
        <thead><tr><th>Product</th><th>F1</th><th>IoU</th><th>Precision</th><th>Recall</th></tr></thead>
        <tbody>
          {SERIES.filter((s) => res[s.key]).map((s) => (
            <tr key={s.key} className={s.key === mine ? 'mine' : ''}>
              <td>{s.label}{s.key === mine && <span className="muted"> · this band</span>}</td>
              <Score v={res[s.key].f1} /><Score v={res[s.key].iou} /><Score v={res[s.key].precision} /><Score v={res[s.key].recall} />
            </tr>
          ))}
        </tbody>
      </table>
      <div className="foot">
        Scored on {scored.km2} ({scored.acres}) of cloud-free pixels{ref ? `; Sentinel-2 marks ${ref.km2} (${ref.acres}) of it as water` : ''}.
      </div>
    </div>
  )
}

export default function Validation({ run }) {
  const rep = useRunStore((s) => s.reports[run.id])
  const [ref, setRef] = useState(null)
  const [ndwi, setNdwi] = useState('ndwi_0.0')
  useEffect(() => { let off = false; loadReference().then((d) => { if (!off) setRef(d || false) }); return () => { off = true } }, [])
  if (!rep || rep.status !== 'ok' || ref === null) return <div className="sec"><div className="skel" /><div className="skel" /></div>
  const r = rep.data
  const tests = testsForRun(ref, r)
  if (!tests.length) {
    return (
      <div className="empty-state">
        <Icon name="check" size={24} />
        <h3>No Sentinel-2 comparison for these dates.</h3>
        <p>Scores exist only for the study scenes (track 98, frame 14) on 31 Aug, 12 Sep and 18 Oct 2026.</p>
      </div>
    )
  }
  const thresholds = Object.keys(tests[0].data.results || {})
  return (
    <>
      <div className="sec">
        <h3>Agreement with Sentinel-2</h3>
        <p className="note" style={{ marginTop: 0 }}>{ref.caution} Reference: {ref.reference}. Scores are from the study run of these scenes (common L/S grid), not recomputed for this run.</p>
        {!sameAsStudy(r) && <div className="warn-row" style={{ marginTop: 8 }}><span style={{ color: 'var(--warn)' }}><Icon name="warn" size={14} /></span>This run's settings differ from the study (full scene, 40 px edge, band default thresholds, HH). The scores may not hold for it.</div>}
        <div className="row-between" style={{ marginTop: 12 }}>
          <span className="muted">Water when Sentinel-2 NDWI is above</span>
          <div className="seg" role="group" aria-label="NDWI threshold">
            {thresholds.map((k) => <button key={k} type="button" aria-pressed={ndwi === k} onClick={() => setNdwi(k)}>{k.replace('ndwi_', '')}</button>)}
          </div>
        </div>
      </div>
      <div className="sec">
        {tests.map((t) => <Test key={t.key} t={t} ndwi={ndwi} band={r.band} />)}
        <div className="foot">F1 and IoU: 1 = same water as Sentinel-2. {formatNumber(Number(ndwi.replace('ndwi_', '')), 1) === '0.0' ? 'NDWI 0.0 is the main threshold of the study.' : ''}</div>
      </div>
    </>
  )
}
