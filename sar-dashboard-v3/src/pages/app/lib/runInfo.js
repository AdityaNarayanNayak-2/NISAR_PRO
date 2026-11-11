import { granuleDate } from './report'
import { formatShortDate } from './units'

/** Band and dates of a run: from its report summary, or from the request while it is still running. */
export function runInfo(run) {
  const s = run?.summary || {}
  const q = run?.request || {}
  const band = s.band || (q.radar_band ? q.radar_band.toUpperCase() : null)
  const baselineDate = s.baseline_date || granuleDate(q.slave_file)
  const activeDate = s.active_date || granuleDate(q.input_file)
  const dates = baselineDate && activeDate ? `${formatShortDate(baselineDate)} → ${formatShortDate(activeDate)} ${activeDate.slice(0, 4)}` : null
  return { band, baselineDate, activeDate, dates, title: dates ? `${band ? `${band}-band · ` : ''}${dates}` : run?.id || '' }
}
