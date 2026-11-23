// Watch: areas the gateway checks on its own for new NISAR passes (sar-gateway/src/watch.rs).
// Each new pass over an area is processed against the pass before it; the flood extent inside
// the area is the sum of regions whose centre lies in the area's box. Alerts go to a webhook or
// Telegram, and to the Atom/CAP feed.
import { useCallback, useEffect, useState } from 'react'
import { useRunStore } from '../stores/useRunStore'
import { useMapStore } from '../stores/useMapStore'
import { gatewayBase } from '../lib/gateway'
import { formatDate, formatNumber } from '../lib/units'
import { fitBbox } from '../map/mapHandle'
import Area from '../ui/Area'
import Icon from '../ui/Icon'

const api = (p, init) => fetch(`${gatewayBase()}${p}`, init).then(async (r) => {
  if (!r.ok) throw new Error((await r.text()) || `${r.status}`)
  return r.status === 204 ? null : r.json()
})
const toBox = (b) => ({ west: b[0], south: b[1], east: b[2], north: b[3] })
const boxGeom = (b) => ({ type: 'Polygon', coordinates: [[[b.west, b.north], [b.east, b.north], [b.east, b.south], [b.west, b.south], [b.west, b.north]]] })
const fmtBox = (b) => `${b.west.toFixed(2)}, ${b.south.toFixed(2)} → ${b.east.toFixed(2)}, ${b.north.toFixed(2)}`
const ago = (t) => {
  if (!t) return 'never'
  const m = Math.round((Date.now() / 1000 - t) / 60)
  return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`
}
const EMPTY = { id: '', name: '', box: null, band: '', track: '', frame: '', alert_km2: 10, end_date: '', webhook_url: '', telegram_bot_token: '', telegram_chat_id: '' }

function AreaForm({ initial, onDone }) {
  const { viewBounds, picking, startPicking, setPreview } = useMapStore()
  const [v, setV] = useState(initial)
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setV((o) => ({ ...o, [k]: e.target.value }))
  useEffect(() => useMapStore.subscribe((s, prev) => {
    if (s.picked !== prev.picked && s.picked?.kind === 'box') setV((o) => ({ ...o, box: s.picked.bbox }))
  }), [])
  useEffect(() => { setPreview(v.box ? boxGeom(v.box) : null) }, [v.box, setPreview])
  useEffect(() => () => setPreview(null), [setPreview])

  const box = v.box
  const size = box ? Math.max(box.east - box.west, box.north - box.south) : 0
  const save = async () => {
    setErr(null)
    if (!v.name.trim()) return setErr('Give the area a name.')
    if (!box) return setErr('Set the area: use the map view or draw a box.')
    if (size > 5) return setErr('The area can be at most 5° on a side. Zoom in or draw a smaller box.')
    const body = {
      id: v.id || undefined, name: v.name.trim(), bbox: [box.west, box.south, box.east, box.north].map((x) => Number(x.toFixed(4))),
      band: v.band || null, track: v.track ? Number(v.track) : null, frame: v.frame ? Number(v.frame) : null,
      alert_km2: Number(v.alert_km2) || 0, end_date: v.end_date || null,
      webhook_url: v.webhook_url.trim() || null, telegram_bot_token: v.telegram_bot_token.trim() || null, telegram_chat_id: v.telegram_chat_id.trim() || null,
    }
    setBusy(true)
    try { await api('/watch/areas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); onDone(true) } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }
  const editing = !!v.id
  return (
    <div className="sec watch-form">
      <h3>{editing ? 'Edit area' : 'New area'}</h3>
      <label className="field"><span>Name</span><input className="input" value={v.name} onChange={set('name')} placeholder="e.g. Kosi embankment, Saharsa" maxLength={80} /></label>
      <div className="field">
        <span>Area</span>
        <div className="watch-box">
          <span className="mono">{box ? fmtBox(box) : 'Not set'}</span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button type="button" className="btn btn-sm" disabled={!viewBounds} onClick={() => setV((o) => ({ ...o, box: viewBounds }))}>Use map view</button>
            <button type="button" className="btn btn-sm" aria-pressed={picking === 'box'} onClick={() => startPicking(picking === 'box' ? null : 'box')}><Icon name="box" size={14} />{picking === 'box' ? 'Click two corners…' : 'Draw box'}</button>
          </div>
        </div>
        {size > 5 && <p className="note" style={{ color: 'var(--err)' }}>{size.toFixed(1)}° wide; at most 5°.</p>}
      </div>
      <div className="watch-grid">
        <label className="field"><span>Band</span><select className="input" value={v.band} onChange={set('band')}><option value="">L and S</option><option value="l">L only</option><option value="s">S only</option></select></label>
        <label className="field"><span>Track</span><input className="input mono" inputMode="numeric" value={v.track} onChange={set('track')} placeholder="any" /></label>
        <label className="field"><span>Frame</span><input className="input mono" inputMode="numeric" value={v.frame} onChange={set('frame')} placeholder="any" /></label>
      </div>
      <div className="watch-grid two">
        <label className="field"><span>Alert at (km²)</span><input className="input mono" type="number" min="0" step="1" value={v.alert_km2} onChange={set('alert_km2')} /></label>
        <label className="field"><span>Passes up to</span><input className="input mono" type="date" value={v.end_date} onChange={set('end_date')} /></label>
      </div>
      <p className="note" style={{ marginTop: -4 }}>Leave "Passes up to" empty to follow new passes. A date replays a past season.</p>
      <details className="watch-notify">
        <summary>Where to send alerts</summary>
        <label className="field"><span>Webhook (Slack, Discord, Google Chat, n8n …)</span><input className="input mono tiny-input" value={v.webhook_url} onChange={set('webhook_url')} placeholder={editing ? 'leave empty to keep' : 'https://…'} spellCheck="false" /></label>
        <div className="watch-grid two">
          <label className="field"><span>Telegram bot token</span><input className="input mono tiny-input" type="password" autoComplete="off" value={v.telegram_bot_token} onChange={set('telegram_bot_token')} placeholder={editing ? 'leave empty to keep' : '123456:ABC…'} /></label>
          <label className="field"><span>Telegram chat id</span><input className="input mono tiny-input" value={v.telegram_chat_id} onChange={set('telegram_chat_id')} placeholder={editing ? 'leave empty to keep' : '-100…'} /></label>
        </div>
      </details>
      {err && <div className="warn-row" style={{ borderColor: 'rgba(248,113,113,.4)', marginTop: 8 }}>{err}</div>}
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button type="button" className="btn btn-accent" disabled={busy} onClick={save}>{editing ? 'Save' : 'Start watching'}</button>
        <button type="button" className="btn" onClick={() => onDone(false)}>Cancel</button>
      </div>
    </div>
  )
}

function Event({ e, onOpen }) {
  const delta = Number.isFinite(e.flood_km2) && Number.isFinite(e.previous_flood_km2) ? e.flood_km2 - e.previous_flood_km2 : null
  return (
    <li className={`watch-ev ${e.status}`}>
      <div className="h">
        <span className="d">{formatDate(e.baseline_date)} → {formatDate(e.active_date)}</span>
        <span className="badge sm">{e.band}</span>
        {e.alert && <span className="watch-alert" title="At or above the alert level"><Icon name="warn" size={12} />Alert</span>}
        {e.status !== 'done' && <span className={`watch-st ${e.status}`}>{e.status === 'waiting' ? 'Waiting' : 'Failed'}</span>}
      </div>
      <div className="a">{e.area_name}</div>
      {e.status === 'done' ? (
        <>
          <div className="v"><Area km2={e.flood_km2} acres={e.flood_acres} /></div>
          <div className="m">
            {formatNumber(e.regions_in_area)} regions
            {delta != null && <> · {delta >= 0 ? '+' : '−'}{formatNumber(Math.abs(delta), 2)} km² vs previous pass</>}
            {e.notified?.length > 0 && <> · sent to {e.notified.join(', ')}</>}
          </div>
          <div className="acts">
            {e.run_id && <button type="button" className="btn btn-sm" onClick={() => onOpen(e.run_id)}>Open run</button>}
            {e.alert && <a className="btn btn-sm" href={`${gatewayBase()}/watch/cap/${e.id}.xml`} target="_blank" rel="noreferrer">CAP alert <Icon name="external" size={12} /></a>}
          </div>
        </>
      ) : <div className="m">{e.note}</div>}
    </li>
  )
}

export default function WatchView() {
  const mode = useRunStore((s) => s.mode)
  const open = useRunStore((s) => s.open)
  const refreshRuns = useRunStore((s) => s.refresh)
  const canAdmin = useRunStore((s) => s.canAdmin())
  const [data, setData] = useState(null)
  const [err, setErr] = useState(null)
  const [form, setForm] = useState(null)
  const [checking, setChecking] = useState({})

  const load = useCallback(() => api('/watch').then((d) => { setData(d); setErr(null) }).catch((e) => setErr(e.message)), [])
  useEffect(() => {
    if (mode !== 'local') return undefined
    let alive = true
    const tick = () => alive && load()
    tick()
    const t = setInterval(tick, 10000)
    return () => { alive = false; clearInterval(t) }
  }, [mode, load])

  if (mode !== 'local') {
    return (
      <div className="sec home-hero">
        <h2>Watch an area</h2>
        <p>The installed app checks your areas for every new NISAR pass, runs the comparison on its own and sends an alert when the flood extent passes your level. This needs the app running on a computer or server, so it is not part of the online demo.</p>
        <div className="home-acts"><a className="btn" href="https://github.com/AdityaNarayanNayak-2/NISAR_PRO/blob/main/deploy/README.md" target="_blank" rel="noreferrer">How to install it</a></div>
      </div>
    )
  }

  const check = async (id) => {
    setChecking((c) => ({ ...c, [id]: true }))
    try {
      await api(`/watch/areas/${id}/check`, { method: 'POST' })
      const start = Date.now()
      const before = data?.areas.find((a) => a.id === id)?.last_checked
      while (Date.now() - start < 10 * 60 * 1000) {
        await new Promise((r) => setTimeout(r, 3000))
        const d = await api('/watch')
        setData(d)
        if (d.areas.find((a) => a.id === id)?.last_checked !== before) break
      }
      refreshRuns?.()
    } catch (e) { setErr(e.message) } finally { setChecking((c) => ({ ...c, [id]: false })) }
  }
  const remove = async (a) => {
    if (!window.confirm(`Stop watching "${a.name}"? Past results stay in the list.`)) return
    try { await api(`/watch/areas/${a.id}`, { method: 'DELETE' }); load() } catch (e) { setErr(e.message) }
  }
  const edit = (a) => setForm({ ...EMPTY, id: a.id, name: a.name, box: toBox(a.bbox), band: a.band || '', track: a.track ?? '', frame: a.frame ?? '', alert_km2: a.alert_km2, end_date: a.end_date || '' })
  const openRun = (id) => { open(id) }

  const areas = data?.areas || []
  const events = data?.events || []
  return (
    <>
      <div className="sec">
        <p className="note" style={{ marginTop: 0 }}>
          New passes over each area are compared with the pass before (same band, track and frame) without anyone pressing a button.
          {data && <> Checks every {formatNumber(data.interval_minutes)} min{data.enabled ? '' : ' (turned off on this server)'}.</>}
        </p>
        {data && !data.can_download && <div className="warn-row" style={{ marginTop: 10 }}>No Earthdata token on this server: only passes already on this computer can be processed. Set EARTHDATA_TOKEN to download new ones.</div>}
        {err && <div className="warn-row" style={{ borderColor: 'rgba(248,113,113,.4)', marginTop: 10 }}>{err}</div>}
      </div>

      {form ? <AreaForm initial={form} onDone={(saved) => { setForm(null); if (saved) load() }} /> : (
        <div className="sec">
          <h3>Areas <span className="muted">{areas.length || ''}</span></h3>
          {areas.length === 0 && <p className="note" style={{ marginTop: 0 }}>{canAdmin ? 'No area yet. Move the map to a district or river reach and add it.' : 'No area is watched on this machine yet.'}</p>}
          <ul className="watch-areas">
            {areas.map((a) => (
              <li key={a.id}>
                <div className="h">
                  <button type="button" className="link n" onClick={() => fitBbox(toBox(a.bbox))} title="Show on the map">{a.name}</button>
                  {a.band && <span className="badge sm">{a.band.toUpperCase()}</span>}
                </div>
                <div className="m">
                  Alert at {formatNumber(a.alert_km2, 0)} km²
                  {a.track ? ` · track ${a.track}` : ''}{a.frame ? ` · frame ${a.frame}` : ''}
                  {a.end_date ? ` · passes up to ${formatDate(a.end_date)}` : ''}
                  {(a.has_webhook || a.has_telegram) ? ` · ${[a.has_webhook && 'webhook', a.has_telegram && 'Telegram'].filter(Boolean).join(', ')}` : ' · no alert channel'}
                </div>
                <div className="m">Checked {ago(a.last_checked)}{a.last_result ? `: ${a.last_result}` : ''}</div>
                {canAdmin && <div className="acts">
                  <button type="button" className="btn btn-sm" disabled={checking[a.id]} onClick={() => check(a.id)}>{checking[a.id] ? <><span className="spin" />Checking…</> : 'Check now'}</button>
                  <button type="button" className="btn btn-sm" onClick={() => edit(a)}>Edit</button>
                  <button type="button" className="icon-btn" onClick={() => remove(a)} aria-label={`Stop watching ${a.name}`} title="Stop watching"><Icon name="trash" size={14} /></button>
                </div>}
              </li>
            ))}
          </ul>
          {canAdmin && <button type="button" className="btn" style={{ marginTop: 12 }} onClick={() => setForm({ ...EMPTY })}><Icon name="plus" size={14} />Add area</button>}
        </div>
      )}

      <div className="sec">
        <h3>Results <span className="muted">{events.length || ''}</span></h3>
        {events.length === 0 ? <p className="note" style={{ marginTop: 0 }}>Each checked pass appears here.</p> : (
          <ul className="watch-evs">{events.slice(0, 30).map((e) => <Event key={e.id} e={e} onOpen={openRun} />)}</ul>
        )}
        <p className="note">Flood extent inside an area counts the regions whose centre is inside it. Water detected by radar; not confirmed on the ground.</p>
      </div>

      <div className="sec">
        <h3>For other systems</h3>
        <div className="watch-links">
          <a className="btn btn-sm" href={`${gatewayBase()}/watch/feed.xml`} target="_blank" rel="noreferrer">Alert feed (Atom + CAP 1.2) <Icon name="external" size={12} /></a>
          <a className="btn btn-sm" href={`${gatewayBase()}/stac`} target="_blank" rel="noreferrer">STAC catalog of all runs <Icon name="external" size={12} /></a>
        </div>
        <p className="note">CAP is the alert format used by disaster agencies, India's SACHET included. STAC lets QGIS, ArcGIS or any GIS find every run's GeoTIFF and GeoJSON.</p>
      </div>
    </>
  )
}
