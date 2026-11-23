// Floating nav pill, top left: wordmark, module menu and the six tabs.
import { useLayoutEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useRunStore, VIEWS } from '../stores/useRunStore'
import Icon from '../ui/Icon'
import Menu from '../ui/Menu'

const LABELS = { map: 'Live Map', timeseries: 'Time Series', regions: 'Regions', impact: 'Impact', reports: 'Reports', processing: 'Processing', watch: 'Watch', evaluation: 'Evaluation Hub' }

export default function NavPill({ onPick }) {
  const view = useRunStore((s) => s.view)
  const setView = useRunStore((s) => s.setView)
  const pick = (v) => { setView(v); onPick?.(v) }
  // When the tabs do not fit next to the right panel, show the dropdown instead of a row that
  // silently scrolls. The tabs stay measurable (hidden, not removed) so the check can switch back.
  const head = useRef(null)
  const tabs = useRef(null)
  const [compact, setCompact] = useState(false)
  useLayoutEffect(() => {
    const check = () => {
      const h = head.current
      const t = tabs.current
      if (!h || !t) return
      const need = [...t.children].reduce((s, b) => s + b.offsetWidth + 2, 0)
      const others = [...h.children].filter((c) => c !== t && c.tagName !== 'SELECT').reduce((s, c) => s + c.offsetWidth + 4, 0)
      const max = parseFloat(getComputedStyle(h).maxWidth) || window.innerWidth
      setCompact(need + others + 24 > max)
    }
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])
  return (
    <header ref={head} className={`ws-nav glass-pill${compact ? ' compact' : ''}`} data-panel="nav">
      <Link to="/" className="wordmark"><span className="slashes">///</span> NISAR <span className="pro">Pro</span></Link>
      <Menu
        label="Module"
        className="module-pill"
        align="left"
        trigger={<>Flood <Icon name="down" size={12} /></>}
        items={[
          { label: 'Flood · water change', onClick: () => {} },
          { label: 'InSAR · paused', href: '/app/insar' },
          '-',
          { label: 'Documentation', href: '/docs' },
          { label: 'Source code', href: 'https://github.com/AdityaNarayanNayak-2/NISAR_PRO', external: true },
        ]}
      />
      <nav ref={tabs} className="tabs" aria-label="Workspace" aria-hidden={compact || undefined}>
        {VIEWS.map((v, i) => (
          <button key={v} type="button" aria-current={view === v ? 'page' : undefined} onClick={() => pick(v)} title={`${LABELS[v]}  ${i + 1}`}>{LABELS[v]}</button>
        ))}
      </nav>
      <select className="tabs-select" aria-label="Workspace" value={view} onChange={(e) => pick(e.target.value)}>
        {VIEWS.map((v) => <option key={v} value={v}>{LABELS[v]}</option>)}
      </select>
    </header>
  )
}
