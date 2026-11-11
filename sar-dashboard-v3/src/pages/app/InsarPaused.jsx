import { Link } from 'react-router-dom'
import './workspace.css'

export default function InsarPaused() {
  return (
    <div className="ws" style={{ display: 'grid', placeItems: 'center', gridTemplateColumns: '1fr', gridTemplateRows: '1fr', gridTemplateAreas: 'none' }}>
      <div style={{ maxWidth: 520, padding: 24 }}>
        <div className="muted" style={{ marginBottom: 8 }}>Experimental</div>
        <h1 style={{ font: '600 28px/1.2 var(--font-display)', margin: '0 0 12px' }}>InSAR monitoring is paused</h1>
        <p style={{ color: 'var(--text-mid)', margin: '0 0 20px' }}>
          Bridge and dam monitoring with InSAR was the first goal of NISAR Pro. The results were not reliable enough, so it is paused
          until the method is ready. The processing code is still in the repository. Surface-water change mapping is the supported workflow.
        </p>
        <Link className="btn btn-primary" to="/app">Back to the water workspace</Link>
      </div>
    </div>
  )
}
