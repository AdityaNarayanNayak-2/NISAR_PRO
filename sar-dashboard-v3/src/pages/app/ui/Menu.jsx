import { useEffect, useRef, useState } from 'react'

/** Button that opens a small menu. Closes on Esc, outside click or selection. */
export default function Menu({ label, trigger, items, align = 'right', className = 'icon-btn' }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const onDoc = (e) => { if (!ref.current?.contains(e.target)) setOpen(false) }
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey) }
  }, [open])
  return (
    <span ref={ref} style={{ position: 'relative', display: 'inline-flex' }}>
      <button type="button" className={className} aria-label={label} aria-haspopup="menu" aria-expanded={open} onClick={(e) => { e.stopPropagation(); setOpen((o) => !o) }}>
        {trigger}
      </button>
      {open && (
        <div className="menu" role="menu" style={{ top: 40, [align]: 0 }}>
          {items.filter(Boolean).map((it, i) =>
            it === '-' ? <hr key={i} /> : it.href ? (
              <a key={i} role="menuitem" href={it.href} target={it.external ? '_blank' : undefined} rel="noreferrer" onClick={() => setOpen(false)}>{it.label}</a>
            ) : (
              <button key={i} type="button" role="menuitem" disabled={it.disabled} className={it.danger ? 'btn-danger' : ''} onClick={(e) => { e.stopPropagation(); setOpen(false); it.onClick?.() }}>{it.label}</button>
            ),
          )}
        </div>
      )}
    </span>
  )
}
