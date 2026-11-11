import { useEffect, useRef, useState } from 'react'
import { useRunStore } from '../stores/useRunStore'
import Icon from '../ui/Icon'

export default function LogDrawer({ onClose }) {
  const openId = useRunStore((s) => s.openId)
  const lines = useRunStore((s) => s.logs[s.openId]) || []
  const follow = useRunStore((s) => s.follow)
  const mode = useRunStore((s) => s.mode)
  const body = useRef(null)
  const [stick, setStick] = useState(true)
  // Saved runs: load their stored log once when the drawer opens.
  useEffect(() => { if (openId && mode === 'local' && !useRunStore.getState().logs[openId]) follow(openId) }, [openId, mode, follow])
  useEffect(() => { if (stick && body.current) body.current.scrollTop = body.current.scrollHeight }, [lines.length, stick])
  const copy = () => navigator.clipboard?.writeText(lines.join('\n'))
  return (
    <section className="ws-log" data-panel="log" aria-label="Processing log">
      <div className="log-head">
        <span className="t">Log{openId ? <> · <span className="mono">{openId}</span></> : ''} · {lines.length} lines</span>
        {!stick && <button type="button" className="btn btn-sm" onClick={() => setStick(true)}>Jump to latest</button>}
        <button type="button" className="btn btn-sm" onClick={copy} disabled={!lines.length}>Copy</button>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Close log"><Icon name="close" /></button>
      </div>
      <div className="log-body" ref={body} onScroll={(e) => { const el = e.currentTarget; setStick(el.scrollHeight - el.scrollTop - el.clientHeight < 24) }}>
        {lines.length === 0 ? <span className="muted">{openId ? 'No log lines for this run.' : 'Open a run to see its log.'}</span> : lines.map((l, i) => (
          <div key={i} className={/ERROR|FAILED|panicked/.test(l) ? 'e' : /COMPLETED|Complete ✓/.test(l) ? 'd' : ''}>{l}</div>
        ))}
      </div>
    </section>
  )
}
