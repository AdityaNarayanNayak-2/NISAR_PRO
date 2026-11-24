// /app: full-screen map with floating panels. Nav pill top left, command pill top right,
// bento stack on the left, one 380 px panel on the right. Layout: workspace.css.
import { useEffect, useState } from 'react'
import { useRunStore, VIEWS } from './stores/useRunStore'
import NavPill from './shell/NavPill'
import CommandBar from './shell/CommandBar'
import LeftStack from './shell/LeftStack'
import LogDrawer from './shell/LogDrawer'
import Toasts from './shell/Toasts'
import MapView from './map/MapView'
import Inspector from './inspector/Inspector'
import Icon from './ui/Icon'
import Dialog from './ui/Dialog'
import './workspace.css'

const SHORTCUTS = [
  ['1 … 8', 'Switch tab (Live Map … Evaluation Hub)'],
  ['N', 'New run (Processing)'],
  ['Esc', 'Close the open run'],
  ['[', 'Show or hide the left panel'],
  [']', 'Show or hide the right panel'],
  ['L', 'Show or hide the processing log'],
  ['?', 'This list'],
]

const isTyping = (e) => /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable
const narrow = () => window.matchMedia('(max-width: 1023px)').matches

export default function Workspace() {
  const init = useRunStore((s) => s.init)
  const stopFollowingAll = useRunStore((s) => s.stopFollowingAll)
  const logOpen = useRunStore((s) => s.logOpen)
  const mode = useRunStore((s) => s.mode)
  const [insp, setInsp] = useState(true)
  const [left, setLeft] = useState(() => !narrow())
  const [keys, setKeys] = useState(false)

  useEffect(() => {
    const show = () => setKeys(true)
    window.addEventListener('nisar:shortcuts', show)
    return () => window.removeEventListener('nisar:shortcuts', show)
  }, [])

  useEffect(() => {
    document.title = 'NISAR Pro · Flood'
    init()
    return () => stopFollowingAll()
  }, [init, stopFollowingAll])

  useEffect(() => {
    const onKey = (e) => {
      if (isTyping(e) || e.ctrlKey || e.metaKey || e.altKey) return
      const st = useRunStore.getState()
      if (e.key === '?') setKeys((v) => !v)
      else if (e.key === 'Escape' && st.openId && !document.querySelector('.dialog, .menu, .switcher-pop')) st.close()
      else if (e.key === ']') setInsp((v) => !v)
      else if (e.key === '[') setLeft((v) => !v)
      else if ((e.key === 'l' || e.key === 'L') && st.mode === 'local') st.toggleLog()
      else if (e.key === 'n' || e.key === 'N') { st.setView('processing'); setInsp(true) }
      else if (/^[1-8]$/.test(e.key)) { st.setView(VIEWS[Number(e.key) - 1]); setInsp(true) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const showLog = logOpen && mode === 'local'
  return (
    <div className="ws" data-insp={insp ? 'open' : 'collapsed'} data-left={left ? 'open' : 'collapsed'} data-log={showLog ? 'open' : 'closed'}>
      <MapView />
      <NavPill onPick={() => setInsp(true)} />
      <CommandBar />
      {left
        ? <LeftStack onHide={() => setLeft(false)} />
        : <button type="button" className="show-left glass-pill" onClick={() => setLeft(true)} title="Show panel  ["><Icon name="panel" size={14} />Status and runs</button>}
      {showLog && <LogDrawer onClose={() => useRunStore.getState().toggleLog(false)} />}
      {insp
        ? <Inspector onClose={() => setInsp(false)} />
        : <button type="button" className="show-right glass-pill" onClick={() => setInsp(true)} title="Show panel  ]"><Icon name="panel" size={14} />Show panel</button>}
      <Toasts />
      {keys && (
        <Dialog title="Keyboard shortcuts" onClose={() => setKeys(false)} actions={<button type="button" className="btn" onClick={() => setKeys(false)}>Close</button>}>
          <dl className="keys">
            {SHORTCUTS.map(([k, t]) => <div key={k}><dt>{k.split(' ').map((x) => <kbd key={x}>{x}</kbd>)}</dt><dd>{t}</dd></div>)}
          </dl>
        </Dialog>
      )}
    </div>
  )
}
