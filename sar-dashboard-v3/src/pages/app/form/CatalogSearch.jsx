// NASA catalog (ASF) search and download through the local gateway:
// GET /search/nisar, GET /asf/download-stream (SSE), GET /asf/auth-status.
import { useEffect, useRef, useState } from 'react'
import { useRunStore } from '../stores/useRunStore'
import { useMapStore } from '../stores/useMapStore'
import { gatewayBase } from '../lib/gateway'
import { sceneInfo } from './validateRun'
import { formatDate, formatNumber } from '../lib/units'
import Icon from '../ui/Icon'

const fmtGB = (b) => (Number(b) > 0 ? `${(Number(b) / 1e9).toFixed(1)} GB` : '—')
const boxGeom = (b) => (b ? { type: 'Polygon', coordinates: [[[b.west, b.north], [b.east, b.north], [b.east, b.south], [b.west, b.south], [b.west, b.north]]] } : null)
const fmtBox = (b) => `${b.west.toFixed(2)}, ${b.south.toFixed(2)} → ${b.east.toFixed(2)}, ${b.north.toFixed(2)}`

function useAuth() {
  const [auth, setAuth] = useState(null)
  useEffect(() => {
    fetch(`${gatewayBase()}/asf/auth-status`).then((r) => r.json()).then(setAuth).catch(() => setAuth({ authenticated: false }))
  }, [])
  return auth
}

export default function CatalogSearch({ onUse }) {
  const { scenes, loadScenes } = useRunStore()
  const { viewBounds, picking, startPicking, setPreview } = useMapStore()
  const auth = useAuth()
  const [box, setBox] = useState(null) // drawn box; null = current map view
  const [q, setQ] = useState({ start: '', end: '', track: '', frame: '' })
  const [state, setState] = useState({ status: 'idle', results: [], error: null })
  const [dl, setDl] = useState({}) // id -> {progress, done, total, speed, error, path}
  const streams = useRef({})

  useEffect(() => useMapStore.subscribe((s, prev) => {
    if (s.picked !== prev.picked && s.picked?.kind === 'box') { setBox(s.picked.bbox); s.setPreview(boxGeom(s.picked.bbox)) }
  }), [])
  useEffect(() => () => { Object.values(streams.current).forEach((es) => es.close()); setPreview(null) }, [setPreview])

  const area = box || viewBounds
  const local = (id) => (scenes || []).find((s) => s.name.replace(/\.h5$/, '') === id.replace(/\.h5$/, ''))

  const search = async () => {
    if (!area) return
    const p = new URLSearchParams({ bbox: [area.west, area.south, area.east, area.north].map((v) => v.toFixed(4)).join(',') })
    if (q.start) p.set('start_date', `${q.start}T00:00:00Z`)
    if (q.end) p.set('end_date', `${q.end}T23:59:59Z`)
    if (q.track) p.set('relative_orbit', q.track)
    if (q.frame) p.set('asfframe', q.frame)
    setState({ status: 'loading', results: [], error: null })
    try {
      const r = await fetch(`${gatewayBase()}/search/nisar?${p}`)
      const list = r.ok ? await r.json() : []
      setState({ status: 'ok', results: Array.isArray(list) ? list : [], error: null })
    } catch (e) {
      setState({ status: 'error', results: [], error: e.message })
    }
  }

  const download = (s) => {
    if (streams.current[s.id]) return
    const es = new EventSource(`${gatewayBase()}/asf/download-stream?granule_id=${encodeURIComponent(s.id)}&url=${encodeURIComponent(s.download_url)}`)
    streams.current[s.id] = es
    setDl((d) => ({ ...d, [s.id]: { progress: 0 } }))
    es.onmessage = (ev) => {
      let m
      try { m = JSON.parse(ev.data) } catch { return }
      if (m.status === 'downloading') setDl((d) => ({ ...d, [s.id]: { progress: m.progress, done: m.downloaded_bytes, total: m.total_bytes, speed: m.speed_mbps } }))
      if (m.status === 'download_complete' || m.status === 'error') {
        es.close()
        delete streams.current[s.id]
        setDl((d) => ({ ...d, [s.id]: m.status === 'error' ? { error: m.message || m.error || 'Download failed' } : { path: m.path, progress: 100 } }))
        if (m.status === 'download_complete') loadScenes()
      }
    }
    es.onerror = () => {
      es.close()
      delete streams.current[s.id]
      setDl((d) => ({ ...d, [s.id]: { ...d[s.id], error: d[s.id]?.path ? null : 'Connection to the gateway closed' } }))
    }
  }

  return (
    <div className="catalog">
      <div className="row-between">
        <span className="muted">NASA ASF catalog · NISAR GCOV</span>
        {auth && <span className={`chip sm ${auth.authenticated ? 'ok' : ''}`}><span className={`dot ${auth.authenticated ? 'ok' : 'warn'}`} />{auth.authenticated ? 'Earthdata signed in' : 'Earthdata sign-in needed'}</span>}
      </div>
      {auth && !auth.authenticated && <div className="hint">Search works without it. To download, put <span className="mono">EARTHDATA_TOKEN=…</span> in <span className="mono">sar-gateway/.env</span> and restart NISAR Pro.</div>}

      <div className="field" style={{ marginTop: 12 }}>
        <span>Search area</span>
        <div className="area-pick">
          <span className="mono tiny">{area ? fmtBox(area) : '—'}</span>
          <span className="muted">{box ? 'drawn box' : 'map view'}</span>
          <span className="grow" />
          {box && <button type="button" className="link" onClick={() => { setBox(null); setPreview(null) }}>Use map view</button>}
          <button type="button" className="btn btn-sm" aria-pressed={picking === 'box'} onClick={() => startPicking(picking === 'box' ? null : 'box')}><Icon name="box" size={14} />{picking === 'box' ? 'Click two corners…' : 'Draw box'}</button>
        </div>
      </div>
      <div className="row2">
        <label className="field"><span>From</span><input className="input" type="date" value={q.start} onChange={(e) => setQ({ ...q, start: e.target.value })} /></label>
        <label className="field"><span>To</span><input className="input" type="date" value={q.end} onChange={(e) => setQ({ ...q, end: e.target.value })} /></label>
      </div>
      <div className="row2">
        <label className="field"><span>Track</span><input className="input mono" inputMode="numeric" placeholder="any" value={q.track} onChange={(e) => setQ({ ...q, track: e.target.value.replace(/\D/g, '') })} /></label>
        <label className="field"><span>Frame</span><input className="input mono" inputMode="numeric" placeholder="any" value={q.frame} onChange={(e) => setQ({ ...q, frame: e.target.value.replace(/\D/g, '') })} /></label>
      </div>
      <button type="button" className="btn btn-block" onClick={search} disabled={!area || state.status === 'loading'}>
        <Icon name="search" size={14} />{state.status === 'loading' ? 'Searching…' : 'Search catalog'}
      </button>

      {state.status === 'error' && <div className="err-text">Search failed: {state.error}</div>}
      {state.status === 'ok' && (
        <div className="results">
          <div className="muted" style={{ margin: '12px 0 6px' }}>{state.results.length ? `${formatNumber(state.results.length)} scenes, newest first` : 'No scenes found here for these filters.'}</div>
          {state.results.map((s) => {
            const info = sceneInfo(`${s.id}.h5`)
            const have = local(s.id)
            const d = dl[s.id]
            return (
              <div key={s.id} className="res" onMouseEnter={() => setPreview(s.footprint || null)} onMouseLeave={() => setPreview(boxGeom(box))}>
                <span className="badge">{info.band ? info.band.toUpperCase() : '?'}</span>
                <div className="t">
                  <div className="t1">{formatDate(info.date || s.date?.slice(0, 10))}{info.tf && <span className="muted"> · track {info.tf.track} · frame {info.tf.frame} · {info.tf.direction.toLowerCase()}</span>}</div>
                  <div className="t2 mono tiny" title={s.id}>{s.id}</div>
                  {d && !d.path && !d.error && (
                    <div className="dlbar"><i style={{ width: `${d.progress || 0}%` }} /><span className="mono tiny">{d.total ? `${fmtGB(d.done)} of ${fmtGB(d.total)}` : 'Starting…'}{d.speed ? ` · ${d.speed.toFixed(1)} MB/s` : ''}</span></div>
                  )}
                  {d?.error && <div className="err-text">{d.error}</div>}
                </div>
                <div className="acts">
                  {have || d?.path ? (
                    <>
                      <button type="button" className="link" onClick={() => onUse(have?.path || d.path, 'baseline')}>Earlier</button>
                      <button type="button" className="link" onClick={() => onUse(have?.path || d.path, 'active')}>Later</button>
                    </>
                  ) : (
                    <button type="button" className="btn btn-sm" disabled={!auth?.authenticated || !!d} title={auth?.authenticated ? `Download ${fmtGB(s.size_bytes)}` : 'Earthdata sign-in needed'} onClick={() => download(s)}>
                      <Icon name="download" size={14} />{fmtGB(s.size_bytes)}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
