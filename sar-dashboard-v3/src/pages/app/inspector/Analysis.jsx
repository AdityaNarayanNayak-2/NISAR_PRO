// What a NISAR engineer checks: class areas, water per date, thresholds, method,
// region statistics and product facts. Every number is from the run's files.
import { useMemo } from 'react'
import { useRunStore } from '../stores/useRunStore'
import { regionList, sizeHistogram } from '../lib/regions'
import { formatDate, formatDb, formatNumber, formatPercent } from '../lib/units'
import Area from '../ui/Area'
import Icon from '../ui/Icon'
import DbRuler from '../ui/DbRuler'

// Swath coverage is scene geometry (a rotated track inside a square grid), not a fault:
// it is shown as a neutral note. Other engine warnings keep the warning style.
const isNote = (w) => /swath coverage/i.test(w)

export function Warnings({ warnings }) {
  if (!warnings.length) return null
  return (
    <div className="sec">
      {warnings.map((w, i) => isNote(w)
        ? <div key={i} className="note-row"><span style={{ color: 'var(--text-lo)', flex: 'none' }}><Icon name="globe" size={14} /></span>{w}</div>
        : <div key={i} className="warn-row"><span style={{ color: 'var(--warn)', flex: 'none' }}><Icon name="warn" size={14} /></span>{w}</div>)}
    </div>
  )
}

export function Classes({ r }) {
  const validKm2 = r.classes.reduce((s, c) => s + (c.km2 ?? 0), 0)
  const validAcres = r.classes.reduce((s, c) => s + (c.acres ?? 0), 0)
  return (
    <div className="sec">
      <h3>Classes <span className="muted">share of valid area</span></h3>
      <table className="ctable">
        <tbody>
          {r.classes.map((x) => (
            <tr key={x.code} className={x.km2 === 0 ? 'dim' : ''}>
              <td><span className="sw" style={{ background: x.color }} />{x.label}</td>
              <td><Area km2={x.km2} acres={x.acres} stacked /></td>
              <td className="muted">{formatPercent(x.km2, validKm2)}</td>
            </tr>
          ))}
          <tr className="total">
            <td>Valid area <span className="muted" style={{ fontWeight: 400 }}>computed</span></td>
            <td><Area km2={validKm2} acres={validAcres} stacked /></td>
            <td />
          </tr>
        </tbody>
      </table>
    </div>
  )
}

/** Water on the earlier and the later date of one run, from its classes. */
export function WaterByDate({ r }) {
  const c = Object.fromEntries(r.classes.map((x) => [x.code, x]))
  const sum = (codes, k) => codes.reduce((s, code) => s + (c[code]?.[k] ?? 0), 0)
  return (
    <div className="sec">
      <h3>Water on each date <span className="muted">this run, computed</span></h3>
      <dl className="dl">
        <dt>{formatDate(r.baselineDate)}</dt>
        <dd><Area km2={sum([1, 5], 'km2')} acres={sum([1, 5], 'acres')} /></dd>
        <dt>{formatDate(r.activeDate)}</dt>
        <dd><Area km2={sum([1, 2, 3, 4], 'km2')} acres={sum([1, 2, 3, 4], 'acres')} /></dd>
      </dl>
      <div className="foot">
        Earlier date = stable water + water loss. Later date = stable water + flood extent.
        {r.footprint.km2 != null && <> The scene grid (<Area km2={r.footprint.km2} acres={r.footprint.acres} />) also holds no-data outside the swath.</>}
      </div>
    </div>
  )
}

export function Method({ r }) {
  const m = r.method
  const yes = (v) => (v == null ? '—' : v ? 'Yes' : 'No')
  // The engine seeds at min(seed, Otsu capped at the minimum change) (flood_detect.rs).
  const seedUsed = Number.isFinite(m.seedDb) && Number.isFinite(m.effectiveOtsuDb) ? Math.min(m.seedDb, m.effectiveOtsuDb) : m.seedDb
  return (
    <div className="sec">
      <h3>Thresholds</h3>
      <DbRuler applied={seedUsed} otsu={m.rawOtsuDb} seed={m.seedDb} growth={m.growthDb} minChange={m.minChangeDb} floor={m.permanentWaterDb} />
      <dl className="dl" style={{ marginTop: 12 }}>
        <dt>Seed used</dt><dd className="mono">{formatDb(seedUsed)} <span className="muted">computed</span></dd>
        <dt>Seed · growth set</dt><dd className="mono">{formatDb(m.seedDb)} · {formatDb(m.growthDb)}</dd>
        <dt>Otsu on change</dt><dd className="mono">{formatDb(m.rawOtsuDb)} <span className="muted">capped {formatDb(m.effectiveOtsuDb)}</span></dd>
        <dt>Minimum change</dt><dd className="mono">{formatDb(m.minChangeDb)}</dd>
        <dt>Stable-water floor</dt><dd className="mono">{formatDb(m.permanentWaterDb)}</dd>
      </dl>
      <h4 className="sub">Method</h4>
      <dl className="dl">
        <dt>Detector</dt><dd>{m.detector ? m.detector.replaceAll('_', ' ') : '—'}</dd>
        <dt>Region growing</dt><dd>{yes(m.regionGrowing)}</dd>
        <dt>Coherence (GUNW)</dt><dd>{m.coherenceUsed == null ? '—' : m.coherenceUsed ? 'Used' : 'Not used'}</dd>
        <dt>Speckle filter</dt><dd>{m.speckle || '—'}</dd>
        <dt>Clean-up</dt><dd>{m.morphology || '—'}</dd>
        <dt>Edge removed</dt><dd className="mono">{m.edgeErosionPx == null ? '—' : `${m.edgeErosionPx} px`}</dd>
        <dt>Smallest area</dt><dd className="mono">{m.minAreaPx == null ? '—' : `${m.minAreaPx} px`}</dd>
      </dl>
      <div className="foot">Otsu is reported. It changes the seed only when it is below the seed threshold.</div>
      {r.reasons.length > 0 && <div className="reasons">{r.reasons.map((x) => <span key={x}>{x.replaceAll('_', ' ')}</span>)}</div>}
    </div>
  )
}

export function RegionStats({ runId, pixelM }) {
  const geo = useRunStore((s) => s.regions[runId])
  const list = useMemo(() => (geo?.status === 'ok' ? regionList(geo.data) : []), [geo])
  const hist = useMemo(() => sizeHistogram(list), [list])
  if (!geo || geo.status !== 'ok') return null
  const max = Math.max(...hist.map((h) => h.count), 1)
  return (
    <div className="sec">
      <h3>Areas by size <span className="muted">{formatNumber(list.length)} areas</span></h3>
      <div className="hist">
        {hist.map((h) => (
          <div key={h.label} className="hrow">
            <span className="k">{h.label} km²</span>
            <span className="bar"><i style={{ width: `${(100 * h.count) / max}%` }} /></span>
            <span className="v num">{formatNumber(h.count)}</span>
          </div>
        ))}
      </div>
      <div className="foot">Count of connected areas per size class{pixelM ? `. One pixel = ${pixelM} × ${pixelM} m` : ''}.</div>
    </div>
  )
}

export function Product({ r }) {
  const tf = r.trackFrame
  return (
    <div className="sec">
      <h3>Product</h3>
      <dl className="dl">
        <dt>Sensor</dt><dd>{[r.instrument, r.radarBand].filter(Boolean).join(' · ') || '—'}</dd>
        <dt>Frequency</dt><dd className="mono">{r.frequencyGHz == null ? '—' : `${r.frequencyGHz.toFixed(3)} GHz`}{r.wavelengthM ? ` · λ ${(r.wavelengthM * 100).toFixed(1)} cm` : ''}</dd>
        <dt>Polarization</dt><dd className="mono">{r.polarization || '—'}</dd>
        <dt>Track · frame</dt><dd>{tf ? `${tf.track} · ${tf.frame} · ${tf.direction}` : '—'}</dd>
        <dt>Grid</dt><dd className="mono">{[r.pixelSpacingM && `${r.pixelSpacingM} m`, r.grid && `${formatNumber(r.grid.cols)} × ${formatNumber(r.grid.rows)} px`].filter(Boolean).join(' · ') || '—'}</dd>
        <dt>Valid pixels</dt><dd className="mono">{formatNumber(r.validPixels)}</dd>
        <dt>CRS</dt><dd className="mono">{r.crs || '—'} <span className="muted">map overlay {r.overlayCrs || '—'}</span></dd>
        <dt>Area</dt><dd>{r.cropPreset === 'full' ? 'Full scene' : r.cropPreset ? `${r.cropPreset}${r.cropCenter ? ` at ${r.cropCenter.lat.toFixed(4)}, ${r.cropCenter.lon.toFixed(4)}` : ''}` : '—'}</dd>
        <dt>Earlier file</dt><dd className="mono tiny">{r.baselineId || '—'}</dd>
        <dt>Later file</dt><dd className="mono tiny">{r.activeId || '—'}</dd>
      </dl>
    </div>
  )
}
