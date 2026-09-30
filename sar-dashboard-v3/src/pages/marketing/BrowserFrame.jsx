import { ArrowUpRight } from 'lucide-react'

export default function BrowserFrame({ id, label, url, badge, inspectLabel, onInspect, children, chips, onKeyDown }) {
    return (
        <figure className="landing-bf" id={id} role="tabpanel" aria-label={label && `${label} · ${url}`} onKeyDown={onKeyDown}>
            <div className="landing-bf-bar">
                <span className="landing-bf-dots" aria-hidden="true"><i /><i /><i /></span>
                <span className="landing-bf-url"><span aria-hidden="true">{label} · </span>{url}</span>
                {badge && <span className="landing-bf-badge"><i aria-hidden="true" />{badge}</span>}
            </div>
            <div className="landing-bf-screen">
                {children}
                {onInspect && <button type="button" className="landing-bf-inspect" onClick={onInspect} aria-haspopup="dialog"><ArrowUpRight size={14} aria-hidden="true" /><span>{inspectLabel || 'INSPECT'}</span></button>}
            </div>
            {chips && chips.length > 0 && (
                <figcaption className="landing-bf-chips">{chips.map((chip, i) => <span key={i}>{chip}</span>)}</figcaption>
            )}
        </figure>
    )
}