// Command pill, top right: go to a place or a "lat, lon"; engine state on the right.
// Place search goes through the gateway (GET /geocode/search, OpenStreetMap Nominatim).
// The demo website has no gateway, so it takes coordinates only.
import { useEffect, useRef, useState } from 'react'
import { useRunStore } from '../stores/useRunStore'
import { gatewayBase, runStatus } from '../lib/gateway'
import { mapHandle, fitBbox, freePadding } from '../map/mapHandle'
import Icon from '../ui/Icon'

const LATLON = /^\s*(-?\d{1,2}(?:\.\d+)?)\s*[,\s]\s*(-?\d{1,3}(?:\.\d+)?)\s*$/

export default function CommandBar() {
  const { mode, runs, retry, stages } = useRunStore()
  const [q, setQ] = useState('')
  const [res, setRes] = useState(null) // null | {status, items, error}
  const input = useRef(null)
  const box = useRef(null)

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'F' || e.key === 'f')) { e.preventDefault(); input.current?.focus(); input.current?.select() }
    }
    const onDoc = (e) => { if (!box.current?.contains(e.target)) setRes(null) }
    window.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onDoc)
    return () => { window.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onDoc) }
  }, [])

  const go = (it) => {
    setRes(null)
    input.current?.blur()
    if (it.bbox) fitBbox({ west: it.bbox[0], south: it.bbox[1], east: it.bbox[2], north: it.bbox[3] }, { maxZoom: 12 })
    else mapHandle.current?.flyTo({ center: [it.lon, it.lat], zoom: 11, duration: 800, padding: freePadding(0) })
  }

  const submit = async (e) => {
    e.preventDefault()
    const m = LATLON.exec(q)
    if (m) {
      const lat = Number(m[1]), lon = Number(m[2])
      if (Math.abs(lat) <= 90 && Math.abs(lon) <= 180) return go({ lat, lon })
    }
    if (q.trim().length < 2) return
    if (mode !== 'local') return setRes({ status: 'error', items: [], error: 'Place search needs the app. Type a lat, lon here.' })
    setRes({ status: 'loading', items: [] })
    try {
      const r = await fetch(`${gatewayBase()}/geocode/search?q=${encodeURIComponent(q.trim())}`)
      if (!r.ok) throw new Error(await r.text())
      const items = await r.json()
      setRes({ status: 'ok', items })
    } catch (err) {
      setRes({ status: 'error', items: [], error: `Search failed. ${String(err.message || '').slice(0, 80)}` })
    }
  }

  const running = runs.find((r) => runStatus(r).kind === 'running')
  const st = running
    ? { dot: <span className="spin" />, text: 'Processing', title: stages[running.id]?.stage ? `Run ${running.id} · ${stages[running.id].stage.toLowerCase().replaceAll('_', ' ')}` : `Run ${running.id}` }
    : { connecting: { dot: <span className="spin" />, text: 'Connecting' }, local: { dot: <span className="dot ok" />, text: 'Online' }, demo: { dot: <span className="dot" />, text: 'Demo' }, offline: { dot: <span className="dot warn" />, text: 'Offline' } }[mode]

  return (
    <div className="ws-cmd glass-pill" ref={box} role="search">
      <form onSubmit={submit} className="cmd-form">
        <Icon name="search" size={15} />
        <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Place or lat, lon" aria-label="Search a place or lat, lon" onKeyDown={(e) => { if (e.key === 'Escape') { setRes(null); e.currentTarget.blur() } }} />
        <kbd className="hide-narrow">Ctrl Shift F</kbd>
      </form>
      <span className="cmd-sep" />
      <button type="button" className="cmd-status" onClick={mode === 'offline' ? retry : undefined} title={st.title || (mode === 'offline' ? 'Retry connection' : undefined)} aria-live="polite">
        {st.dot}<span>{st.text}</span>
      </button>
      {res && (
        <div className="cmd-pop glass" role="listbox">
          {res.status === 'loading' && <div className="cmd-msg"><span className="spin" />Searching…</div>}
          {res.status === 'error' && <div className="cmd-msg">{res.error}</div>}
          {res.status === 'ok' && !res.items.length && <div className="cmd-msg">No place found.</div>}
          {res.items.map((it, i) => (
            <button key={i} type="button" role="option" className="cmd-item" onClick={() => go(it)}>
              <span className="t1">{it.label.split(',')[0]}</span>
              <span className="t2">{it.label.split(',').slice(1).join(',').trim()}</span>
            </button>
          ))}
          {res.status === 'ok' && res.items.length > 0 && <div className="cmd-foot">© OpenStreetMap contributors</div>}
        </div>
      )}
    </div>
  )
}
