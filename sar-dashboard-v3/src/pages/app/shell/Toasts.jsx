import { useRunStore } from '../stores/useRunStore'
import Icon from '../ui/Icon'

export default function Toasts() {
  const { toasts, dismissToast } = useRunStore()
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`} role="status">
          <span className="grow">{t.text}</span>
          {t.action && <button type="button" className="btn btn-sm" onClick={() => { dismissToast(t.id); t.action.run() }}>{t.action.label}</button>}
          <button type="button" className="icon-btn" style={{ width: 24, height: 24 }} onClick={() => dismissToast(t.id)} aria-label="Dismiss"><Icon name="close" size={12} /></button>
        </div>
      ))}
    </div>
  )
}
