// Process: every setting the engine reads, with a live threshold ruler and the exact command.
// Thresholds equal to the band default are not sent, so the engine uses its own default
// and identical requests still find the earlier run.
import { useEffect, useMemo, useState } from 'react'
import { useRunStore } from '../stores/useRunStore'
import { useMapStore } from '../stores/useMapStore'
import { DEFAULTS, isSentinel1, sceneInfo, validateRun } from './validateRun'
import { formatDate, formatNumber } from '../lib/units'
import CatalogSearch from './CatalogSearch'
import DbRuler from '../ui/DbRuler'
import Icon from '../ui/Icon'

const AREAS = [['full', 'Full', null], ['20x20km', '20 km', 20], ['10x10km', '10 km', 10], ['5x5km', '5 km', 5], ['1x1km', '1 km', 1]]
const POLS = ['HH', 'HV', 'VV', 'VH']
const THR = [
  { k: 'seed', label: 'Seed', hint: 'Change that starts a flood area (high confidence)', min: -10, max: 0, step: 0.1, flag: '--seed-threshold-db' },
  { k: 'growth', label: 'Growth', hint: 'Change that lets an area grow (medium confidence)', min: -10, max: 0, step: 0.1, flag: '--growth-threshold-db' },
  { k: 'minChange', label: 'Minimum change', hint: 'Smallest drop counted at all', min: -10, max: 0, step: 0.1, flag: '--min-change-db' },
  { k: 'floor', label: 'Stable-water floor', hint: 'Backscatter below this on both dates = stable water', min: -25, max: -5, step: 0.1, flag: '--permanent-water-thresh-db' },
]

/** Polarizations in the file, from the NISAR name (…_4005_DHDH_…: dual-pol, H transmit). */
function polsOf(name) {
  // Sentinel-1 GeoTIFFs hold one polarization each, named in the file (…_VV.tif).
  if (isSentinel1(name)) {
    const p = /[_-](VV|VH|HH|HV)[._]/i.exec(name)
    return p ? [p[1].toUpperCase()] : null
  }
  const m = /_\d{4}_([A-Z]{2})([A-Z]{2})_/.exec(name || '')
  if (!m) return null
  const c = m[1]
  if (c === 'DH') return ['HH', 'HV']
  if (c === 'DV') return ['VV', 'VH']
  if (c === 'SH') return ['HH']
  if (c === 'SV') return ['VV']
  if (c === 'QP' || c === 'QQ') return POLS
  return null
}

function Slider({ label, hint, value, onChange, min, max, step, unit = 'dB', error, dflt }) {
  const changed = Number.isFinite(dflt) && Number.isFinite(value) && Math.abs(value - dflt) > 1e-6
  return (
    <div className="slider">
      <div className="sl-head">
        <span>{label}{changed && <button type="button" className="link reset" onClick={() => onChange(dflt)} title="Back to band default">default {dflt}</button>}</span>
        <span className="sl-num"><input className="input mono" type="number" step={step} value={Number.isFinite(value) ? value : ''} onChange={(e) => onChange(e.target.value === '' ? NaN : Number(e.target.value))} aria-label={label} aria-invalid={!!error} /><span className="muted">{unit}</span></span>
      </div>
      <input type="range" min={min} max={max} step={step} value={Number.isFinite(value) ? value : min} onChange={(e) => onChange(Number(e.target.value))} aria-label={`${label} slider`}
        style={{ '--fill': `${Number.isFinite(value) ? Math.min(100, Math.max(0, (100 * (value - min)) / (max - min))) : 0}%` }} />
      {error ? <div className="err-text">{error}</div> : hint && <div className="hint">{hint}</div>}
    </div>
  )
}

function SceneSelect({ label, value, onChange, scenes, filter, error, allowPath = true }) {
  const info = sceneInfo(value)
  const options = (scenes || []).filter(filter)
  return (
    <div className="field">
      <span>{label}</span>
      <select className="input" value={options.some((s) => s.path === value) ? value : ''} onChange={(e) => onChange(e.target.value)} aria-invalid={!!error}>
        <option value="">{options.length ? 'Choose a scene…' : allowPath ? 'No matching scenes on this computer' : 'No matching scenes'}</option>
        {options.map((s) => <option key={s.path} value={s.path}>{s.band === 'c' ? `C · ${formatDate(s.date)} · Sentinel-1${polsOf(s.name) ? ` ${polsOf(s.name)[0]}` : ''}${s.track ? ` · orbit ${s.track}` : ''}` : `${(s.band || '?').toUpperCase()} · ${formatDate(s.date)} · track ${s.track ?? '?'} · frame ${s.frame ?? '?'}`}</option>)}
      </select>
      {allowPath && <input className="input mono tiny-input" placeholder="or paste a full path (NISAR GCOV .h5 or Sentinel-1 .tif)" value={value} onChange={(e) => onChange(e.target.value.trim())} spellCheck="false" />}
      {value && info.name && !error && <div className="hint">{info.name}</div>}
      {error && <div className="err-text">{error}</div>}
    </div>
  )
}

export default function ProcessPanel() {
  const { scenes, startRun, toast, mode, loadScenes, config } = useRunStore()
  // Public demo visitor: only the scenes listed here, no file paths, no NASA downloads.
  const visitor = config.public_mode && !config.admin
  const { picking, startPicking, setPreview } = useMapStore()
  const [tab, setTab] = useState('local')
  const [busy, setBusy] = useState(false)
  const [touched, setTouched] = useState(false)
  const [v, setV] = useState({ baseline: '', active: '', area: 'full', lat: NaN, lon: NaN, erosion: 40, pol: 'HH', ...DEFAULTS.l, minArea: 8, band: 'l', edited: false, gunw: '', mask: '', advanced: true })
  const set = (k) => (val) => setV((o) => ({ ...o, [k]: val, edited: o.edited || ['seed', 'growth', 'minChange', 'floor'].includes(k) }))

  useEffect(() => { if (mode === 'local' && scenes == null) loadScenes() }, [mode, scenes, loadScenes])

  // Pick a scene: the band follows it, and thresholds follow the band until edited.
  const setScene = (role) => (path) => setV((o) => {
    const band = sceneInfo(path).band || o.band
    // Sentinel-1 files hold one polarization: use it.
    const only = polsOf(sceneInfo(path).name)
    const next = { ...o, [role]: path, band, pol: only?.length === 1 ? only[0] : o.pol }
    return band !== o.band && !o.edited ? { ...next, ...DEFAULTS[band] } : next
  })

  // Centre picked on the map.
  useEffect(() => useMapStore.subscribe((s, prev) => {
    if (s.picked !== prev.picked && s.picked?.kind === 'centre') setV((o) => ({ ...o, lat: Number(s.picked.lat.toFixed(5)), lon: Number(s.picked.lon.toFixed(5)), area: o.area === 'full' ? '10x10km' : o.area }))
  }), [])

  // Crop box outline on the map.
  const km = AREAS.find((a) => a[0] === v.area)?.[2]
  useEffect(() => {
    if (!km || !Number.isFinite(v.lat) || !Number.isFinite(v.lon)) { setPreview(null); return }
    const dLat = km / 2 / 111.32
    const dLon = km / 2 / (111.32 * Math.cos((v.lat * Math.PI) / 180))
    const [w, e, s, n] = [v.lon - dLon, v.lon + dLon, v.lat - dLat, v.lat + dLat]
    setPreview({ type: 'Polygon', coordinates: [[[w, n], [e, n], [e, s], [w, s], [w, n]]] })
  }, [km, v.lat, v.lon, setPreview])
  useEffect(() => () => setPreview(null), [setPreview])

  const errors = useMemo(() => validateRun(v), [v])
  const valid = Object.keys(errors).length === 0
  const base = sceneInfo(v.baseline)
  const d = DEFAULTS[v.band]
  const pols = polsOf(base.name || sceneInfo(v.active).name)

  const body = useMemo(() => {
    const b = { pipeline: 'flood', input_file: v.active, slave_file: v.baseline, radar_band: v.band, crop_preset: v.area, swath_edge_erosion: v.erosion }
    if (v.area !== 'full') Object.assign(b, { crop_lat: v.lat, crop_lon: v.lon })
    if (v.pol !== 'HH') b.polarization = v.pol
    const diff = (a, x) => Number.isFinite(a) && Math.abs(a - x) > 1e-6
    if (diff(v.seed, d.seed)) b.seed_threshold_db = v.seed
    if (diff(v.growth, d.growth)) b.growth_threshold_db = v.growth
    if (diff(v.minChange, d.minChange)) b.min_change_db = v.minChange
    if (diff(v.floor, d.floor)) b.permanent_water_thresh_db = v.floor
    if (v.minArea !== 8) b.min_area_pixels = v.minArea
    if (v.gunw) b.gunw_file = v.gunw
    if (v.mask) b.water_mask = v.mask
    return b
  }, [v, d])

  const command = useMemo(() => {
    const q = (s) => (/[\s'"]/.test(String(s)) ? `'${s}'` : s)
    const a = ['sar_science_processor', '--mode flood', '--output results/jobs/<new-run>/<new-run>', `--input ${q(body.input_file || '<later scene>')}`, `--slave ${q(body.slave_file || '<earlier scene>')}`]
    if (body.crop_lat != null) a.push(`--crop-lat ${body.crop_lat} --crop-lon ${body.crop_lon}`)
    a.push(`--crop-preset ${body.crop_preset}`)
    if (body.gunw_file) a.push(`--gunw ${q(body.gunw_file)}`)
    if (body.water_mask) a.push(`--water-mask ${q(body.water_mask)}`)
    for (const t of THR) { const key = { seed: 'seed_threshold_db', growth: 'growth_threshold_db', minChange: 'min_change_db', floor: 'permanent_water_thresh_db' }[t.k]; if (body[key] != null) a.push(`${t.flag} ${body[key]}`) }
    if (body.min_area_pixels != null) a.push(`--min-area-pixels ${body.min_area_pixels}`)
    a.push(`--radar-band ${body.radar_band}`)
    if (body.polarization) a.push(`--polarization ${body.polarization}`)
    a.push(`--swath-edge-erosion ${body.swath_edge_erosion}`)
    return a.join(' \\\n  ')
  }, [body])

  const submit = async () => {
    setTouched(true)
    if (!valid) return
    setBusy(true)
    try { await startRun(body) } catch (err) { toast(err.message, 'error') } finally { setBusy(false) }
  }

  const shown = (k) => (touched || ['seed', 'growth', 'minChange', 'floor', 'erosion', 'minArea'].includes(k) ? errors[k] : null)
  const firstError = Object.values(errors)[0]
  const use = (path, role) => { setScene(role)(path); setTab('local') }

  if (mode !== 'local') {
    return (
      <div className="empty-state">
        <Icon name="sliders" size={24} />
        <h3>Processing runs on your computer</h3>
        <p>This website is a read-only demo. Install NISAR Pro to search the NASA catalog, download scenes and run the Rust engine.</p>
        <a className="btn" href="https://github.com/AdityaNarayanNayak-2/NISAR_PRO#install-and-run" target="_blank" rel="noreferrer">Get the app</a>
      </div>
    )
  }

  return (
    <div className="process">
      <div className="insp-scroll">
        {visitor && (
          <div className="sec public-note">
            <h3>Public demo</h3>
            <p>Your run goes into a queue on the NISAR Pro machine and runs on real NISAR radar scenes. You can have {config.runs_per_visitor === 1 ? 'one run' : `${config.runs_per_visitor} runs`} waiting or running at a time{config.active_runs ? `; ${config.active_runs} ${config.active_runs === 1 ? 'run is' : 'runs are'} in the queue now` : ''}. Pick two scenes from the list, an area and the thresholds. A run with the same settings as a finished one opens straight away.</p>
          </div>
        )}
        <div className="sec">
          <div className="form-step"><span className="n">1</span>Scenes</div>
          {!visitor && <div className="seg wide" role="tablist" aria-label="Scene source" style={{ marginBottom: 12 }}>
            <button type="button" role="tab" aria-pressed={tab === 'local'} onClick={() => setTab('local')}>This computer <span className="muted">{scenes ? scenes.length : ''}</span></button>
            <button type="button" role="tab" aria-pressed={tab === 'catalog'} onClick={() => setTab('catalog')}><Icon name="globe" size={13} />NASA catalog</button>
          </div>}
          {tab === 'catalog' && !visitor ? <CatalogSearch onUse={use} /> : (
            <>
              <SceneSelect label="Earlier scene (baseline)" value={v.baseline} onChange={setScene('baseline')} scenes={scenes} filter={() => true} error={shown('baseline')} allowPath={!visitor} />
              <SceneSelect
                label="Later scene (active)"
                value={v.active}
                onChange={setScene('active')}
                scenes={scenes}
                allowPath={!visitor}
                error={v.active && v.baseline ? errors.active : shown('active')}
                filter={(s) => !v.baseline || (s.path !== v.baseline && (!base.band || s.band === base.band) && (!base.tf || (s.track === base.tf.track && s.frame === base.tf.frame)) && (!base.date || s.date > base.date))}
              />
              {scenes && scenes.length === 0 && <div className="hint">No GCOV files in <span className="mono">~/nisar_data</span>, <span className="mono">~/Downloads</span> or <span className="mono">NISAR_DATA_DIRS</span>. Use the NASA catalog tab.</div>}
            </>
          )}
        </div>

        <div className="sec">
          <div className="form-step"><span className="n">2</span>Area</div>
          <div className="seg wide" role="group" aria-label="Area" style={{ marginBottom: 12 }}>
            {AREAS.map(([k, l]) => <button key={k} type="button" aria-pressed={v.area === k} onClick={() => set('area')(k)}>{l}</button>)}
          </div>
          {v.area !== 'full' && (
            <>
              <div className="row2">
                <label className="field"><span>Centre latitude</span><input className="input mono" type="number" step="0.0001" value={Number.isFinite(v.lat) ? v.lat : ''} onChange={(e) => set('lat')(e.target.value === '' ? NaN : Number(e.target.value))} aria-invalid={!!shown('lat')} /></label>
                <label className="field"><span>Centre longitude</span><input className="input mono" type="number" step="0.0001" value={Number.isFinite(v.lon) ? v.lon : ''} onChange={(e) => set('lon')(e.target.value === '' ? NaN : Number(e.target.value))} aria-invalid={!!shown('lon')} /></label>
              </div>
              <button type="button" className="btn btn-sm" aria-pressed={picking === 'centre'} onClick={() => startPicking(picking === 'centre' ? null : 'centre')}><Icon name="target" size={14} />{picking === 'centre' ? 'Click the map…' : 'Pick centre on map'}</button>
              {(shown('lat') || shown('lon')) && <div className="err-text">{shown('lat') || shown('lon')}</div>}
            </>
          )}
          <Slider label="Scene edge to remove" hint={Number.isFinite(v.erosion) ? `${v.erosion} px = ${formatNumber(v.erosion * 0.08, 1)} km on the 80 m full-scene grid. The Bihar study uses 40.` : ''} value={v.erosion} onChange={set('erosion')} min={0} max={200} step={1} unit="px" error={shown('erosion')} />
        </div>

        <div className="sec">
          <div className="form-step"><span className="n">3</span>Radar</div>
          <div className="row-between">
            <span className="muted">Band</span>
            <span>{v.band === 's' ? 'S-band · 3.2 GHz' : v.band === 'c' ? 'C-band · 5.405 GHz · Sentinel-1' : 'L-band · 1.24 GHz'} <span className="muted">from the scene</span></span>
          </div>
          <div className="row-between" style={{ marginTop: 10 }}>
            <span className="muted">Polarization</span>
            <div className="seg" role="group" aria-label="Polarization">
              {POLS.map((p) => <button key={p} type="button" aria-pressed={v.pol === p} disabled={pols && !pols.includes(p)} onClick={() => set('pol')(p)}>{p}</button>)}
            </div>
          </div>
          {pols && <div className="hint">This scene has {pols.join(' and ')}.</div>}
        </div>

        <div className="sec">
          <div className="form-step"><span className="n">4</span>Detection <span className="muted" style={{ fontWeight: 400 }}>{v.band.toUpperCase()}-band defaults</span></div>
          <DbRuler seed={v.seed} growth={v.growth} minChange={v.minChange} floor={v.floor} />
          {THR.map((t) => <Slider key={t.k} {...t} value={v[t.k]} onChange={set(t.k)} error={shown(t.k)} dflt={d[t.k]} />)}
          <Slider label="Smallest area" hint="Areas with fewer pixels are dropped as noise." value={v.minArea} onChange={set('minArea')} min={1} max={200} step={1} unit="px" error={shown('minArea')} dflt={8} />
          <button type="button" className="link" onClick={() => setV((o) => ({ ...o, ...DEFAULTS[o.band], minArea: 8, edited: false }))}>Reset all to {v.band.toUpperCase()}-band defaults</button>
        </div>

        {!visitor && <div className="sec">
          <div className="form-step"><span className="n">5</span>Optional inputs</div>
          <label className="field"><span>GUNW coherence file</span><input className="input mono tiny-input" placeholder="path to NISAR GUNW .h5" value={v.gunw} onChange={(e) => set('gunw')(e.target.value.trim())} spellCheck="false" /></label>
          <label className="field"><span>Reference water mask</span><input className="input mono tiny-input" placeholder="path to a water-mask GeoTIFF" value={v.mask} onChange={(e) => set('mask')(e.target.value.trim())} spellCheck="false" /></label>
        </div>}

        <div className="sec">
          <div className="row-between"><span className="form-step" style={{ margin: 0 }}>Command</span><button type="button" className="icon-btn xs" title="Copy command" aria-label="Copy command" onClick={() => navigator.clipboard?.writeText(command).then(() => toast('Command copied.', 'ok'))}><Icon name="copy" size={13} /></button></div>
          <pre className="cmd">{command}</pre>
        </div>
      </div>
      <div className="form-foot">
        <div className="why">{touched && !valid ? firstError : visitor ? 'A full scene pair takes about 25 seconds once it starts.' : 'A full scene pair takes about 25 seconds on 4 cores.'}</div>
        <button type="button" className="btn btn-accent btn-run" onClick={submit} disabled={busy || (touched && !valid)}>{busy ? 'Starting…' : visitor ? 'Add to queue' : 'Run'}</button>
      </div>
    </div>
  )
}
