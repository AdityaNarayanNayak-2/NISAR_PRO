// Every run, grouped by track·frame, with band filter, cancel and delete.
// Opened from "All runs" on the left run card.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useRunStore, STAGES } from '../stores/useRunStore'
import { runStatus } from '../lib/gateway'
import { granuleTrackFrame } from '../lib/report'
import { runInfo } from '../lib/runInfo'
import { formatRelativeTime } from '../lib/units'
import Icon from '../ui/Icon'
import Dialog from '../ui/Dialog'

const PRESET = { full: 'Full scene', '20x20km': '20 × 20 km', '10x10km': '10 × 10 km', '5x5km': '5 × 5 km', '1x1km': '1 × 1 km' }

function Mark({ kind }) {
  if (kind === 'running' || kind === 'queued') return <span className="spin" aria-label={kind} />
  return <span className={`dot ${kind === 'completed' ? 'ok' : kind === 'failed' ? 'err' : ''}`} aria-label={kind} />
}

export default function RunSwitcher({ label = 'All runs' }) {
  const { runs, openId, open, mode, remove, cancel, stages } = useRunStore()
  const canAdmin = useRunStore((s) => s.canAdmin())
  const [isOpen, setOpen] = useState(false)
  const [band, setBand] = useState('all')
  const [confirm, setConfirm] = useState(null)
  const ref = useRef(null)

  useEffect(() => {
    if (!isOpen) return
    const onDoc = (e) => { if (!ref.current?.contains(e.target) && !e.target.closest?.('.dialog')) setOpen(false) }
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey) }
  }, [isOpen])

  const groups = useMemo(() => {
    const map = new Map()
    for (const r of runs) {
      const b = (r.summary?.band || r.request?.radar_band || '').toUpperCase()
      if (band !== 'all' && b !== band) continue
      const tf = granuleTrackFrame(r.summary?.active_id || r.request?.input_file)
      const key = tf ? `Track ${tf.track} · Frame ${tf.frame}` : 'Other scenes'
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(r)
    }
    for (const list of map.values()) list.sort((a, b) => (b.summary?.active_date || '').localeCompare(a.summary?.active_date || '') || b.created_at - a.created_at)
    return [...map.entries()]
  }, [runs, band])

  return (
    <span className="switcher" ref={ref}>
      <button type="button" className="link-btn" aria-haspopup="dialog" aria-expanded={isOpen} onClick={() => setOpen((o) => !o)}>
        {label} <span className="muted num">{runs.length}</span>
      </button>
      {isOpen && (
        <div className="switcher-pop glass" role="dialog" aria-label="Runs">
          <div className="pop-head">
            <span>Runs</span>
            <div className="seg" role="group" aria-label="Filter by band">
              {['all', 'L', 'S'].map((b) => <button key={b} type="button" aria-pressed={band === b} onClick={() => setBand(b)}>{b === 'all' ? 'All' : b}</button>)}
            </div>
          </div>
          <div className="pop-scroll">
            {groups.length === 0 && <div className="muted" style={{ padding: 16 }}>{runs.length ? `No ${band}-band runs.` : 'No runs yet. Use Process to start one.'}</div>}
            {groups.map(([title, list]) => (
              <section key={title}>
                <div className="pop-group">{title}</div>
                {list.map((r) => {
                  const st = runStatus(r)
                  const ri = runInfo(r)
                  const stage = STAGES.find((x) => x.key === stages[r.id]?.stage)?.label
                  const sub = st.kind === 'running' ? stage || 'Running' : st.kind === 'queued' ? (r.queue_position ? `In queue · ${r.queue_position === 1 ? 'next' : `place ${r.queue_position}`}` : 'Waiting') : st.kind === 'failed' ? 'Failed' : PRESET[r.summary?.crop_preset || r.request?.crop_preset] || r.summary?.crop_preset
                  return (
                    <div key={r.id} className="pop-row" aria-current={r.id === openId}>
                      <button type="button" className="pop-main" onClick={() => { open(r.id); setOpen(false) }}>
                        <span className="badge">{ri.band || '?'}</span>
                        <span className="t"><span className="t1">{ri.dates || r.id}</span><span className="t2">{[sub, formatRelativeTime(r.created_at)].filter(Boolean).join(' · ')}</span></span>
                        <Mark kind={st.kind} />
                      </button>
                      {mode === 'local' && canAdmin && (
                        <span className="pop-acts">
                          {(st.kind === 'running' || st.kind === 'queued') && <button type="button" className="icon-btn" title="Cancel run" aria-label="Cancel run" onClick={() => cancel(r.id)}><Icon name="close" size={14} /></button>}
                          {st.kind !== 'running' && <button type="button" className="icon-btn" title="Delete run" aria-label="Delete run" onClick={() => setConfirm(r)}><Icon name="trash" size={14} /></button>}
                        </span>
                      )}
                    </div>
                  )
                })}
              </section>
            ))}
          </div>
        </div>
      )}
      {confirm && (
        <Dialog
          title="Delete this run?"
          onClose={() => setConfirm(null)}
          actions={<>
            <button type="button" className="btn" onClick={() => setConfirm(null)}>Keep</button>
            <button type="button" className="btn btn-primary" onClick={() => { remove(confirm.id); setConfirm(null) }}>Delete</button>
          </>}
        >
          <p>The run folder and its files (maps, report, GeoTIFF) are removed from this computer. The input scenes are not touched.</p>
        </Dialog>
      )}
    </span>
  )
}
