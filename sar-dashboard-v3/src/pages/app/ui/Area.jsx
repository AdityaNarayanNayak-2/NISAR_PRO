import { formatArea } from '../lib/units'

/** Prints an area in km² and acres from the same value. `stacked` puts acres on a second line. */
export default function Area({ km2, acres, stacked = false, className = '' }) {
  const f = formatArea(km2, acres)
  if (stacked) {
    return (
      <span className={`area-cell num ${className}`} data-area>
        <span className="k">{f.km2}</span>
        <span className="a">{f.acres}</span>
      </span>
    )
  }
  return (
    <span className={`num ${className}`} data-area>
      {f.km2} <span className="muted">· {f.acres}</span>
    </span>
  )
}
