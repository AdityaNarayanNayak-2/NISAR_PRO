// Floating nav pill, top left: wordmark, module menu and the six tabs.
import { Link } from 'react-router-dom'
import { useRunStore, VIEWS } from '../stores/useRunStore'
import Icon from '../ui/Icon'
import Menu from '../ui/Menu'

const LABELS = { map: 'Live Map', timeseries: 'Time Series', regions: 'Regions', reports: 'Reports', processing: 'Processing', evaluation: 'Evaluation Hub' }

export default function NavPill({ onPick }) {
  const view = useRunStore((s) => s.view)
  const setView = useRunStore((s) => s.setView)
  const pick = (v) => { setView(v); onPick?.(v) }
  return (
    <header className="ws-nav glass-pill" data-panel="nav">
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
      <nav className="tabs" aria-label="Workspace">
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
