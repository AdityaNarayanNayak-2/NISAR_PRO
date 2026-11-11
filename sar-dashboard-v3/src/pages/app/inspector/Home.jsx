// Live Map with no run open: what NISAR Pro does and how to start. No result numbers here;
// system state is on the left status card, runs are on the left run cards.
import { useRunStore } from '../stores/useRunStore'
import { runStatus } from '../lib/gateway'
import Icon from '../ui/Icon'

export default function Home() {
  const { mode, runs, showForm, retry, open } = useRunStore()
  const latest = runs.find((r) => runStatus(r).kind === 'completed')
  return (
    <>
      <div className="sec home-hero">
        <h2>Flood extent from NISAR radar</h2>
        <p>Radar sees through cloud, day and night. Compare two passes over the same place and NISAR Pro maps where water appeared, where it stayed and where it left, with every area in km² and acres.</p>
        <div className="home-acts">
          {mode === 'local' && <button type="button" className="btn btn-accent" onClick={showForm}><Icon name="plus" size={14} />New run</button>}
          {latest && <button type="button" className="btn" onClick={() => open(latest.id)}>Open latest run</button>}
          {mode === 'offline' && <button type="button" className="btn" onClick={retry}>Retry connection</button>}
          {mode === 'demo' && <a className="btn" href="https://github.com/AdityaNarayanNayak-2/NISAR_PRO#install-and-run" target="_blank" rel="noreferrer">Get the app</a>}
        </div>
      </div>
      <div className="sec">
        <h3>How a run works</h3>
        <ol className="steps">
          <li><b>Two passes.</b> An earlier and a later GCOV scene of the same track and frame, from this computer or the NASA catalog.</li>
          <li><b>Compare.</b> The Rust engine reads both in strips, averages a full scene to 80 m and classes the change in radar backscatter.</li>
          <li><b>Act.</b> Regions ranks the largest areas with place names. Reports gives a printable situation report and the files.</li>
        </ol>
      </div>
      <div className="sec">
        <h3>On the map</h3>
        <p className="note" style={{ marginTop: 0 }}>Dashed outlines are scene footprints that have runs. Click one to zoom in, or search a place or a lat, lon in the bar at the top.</p>
      </div>
    </>
  )
}
