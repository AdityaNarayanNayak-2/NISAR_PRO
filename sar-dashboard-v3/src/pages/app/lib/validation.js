// Sentinel-2 agreement from the InGARSS study (public/reference/sentinel2_validation.json).
// It describes the study runs of NISAR track 98 / frame 14. A run gets it only when its
// track, frame and dates match a test. Labels: agreement with optical labels, not accuracy.
import { granuleTrackFrame } from './report'
import { site } from '../../../lib/site.js'

let cache = null
export function loadReference() {
  if (!cache) cache = fetch(site('/reference/sentinel2_validation.json')).then((r) => (r.ok ? r.json() : null)).catch(() => null)
  return cache
}

const TESTS = [
  { key: 'water_31aug', kind: 'water', date: '2026-08-31', label: 'Water on 31 Aug' },
  { key: 'water_12sep', kind: 'water', date: '2026-09-12', label: 'Water on 12 Sep' },
  { key: 'water_18oct', kind: 'water', date: '2026-10-18', label: 'Water on 18 Oct' },
  { key: 'gain_31aug_to_12sep', kind: 'gain', from: '2026-08-31', to: '2026-09-12', label: 'Flood extent 31 Aug → 12 Sep' },
]
const STUDY_FRAME = { track: 98, frame: 14 }

/** Tests that apply to this run's dates, or [] when none do. */
export function testsForRun(ref, report) {
  if (!ref?.tests || !report) return []
  const tf = report.trackFrame || granuleTrackFrame(report.activeId)
  if (!tf || tf.track !== STUDY_FRAME.track || tf.frame !== STUDY_FRAME.frame) return []
  const { baselineDate: b, activeDate: a } = report
  return TESTS.filter((t) => (t.kind === 'water' ? t.date === a || t.date === b : t.from === b && t.to === a))
    .map((t) => ({ ...t, data: ref.tests[t.key] }))
    .filter((t) => t.data)
}

export const SERIES = [
  { key: 'l_only', label: 'L-band' },
  { key: 's_only', label: 'S-band' },
  { key: 'fused', label: 'L + S' },
]

// NASA OPERA DSWx-S1 agreement for water on 12 Sep 2026 (public/reference/dswx_s1_agreement.json),
// computed with the same pixels for NISAR L, NISAR S and our Sentinel-1 run. Agreement, not accuracy.
let dswxCache = null
export function loadDswx() {
  if (!dswxCache) dswxCache = fetch(site('/reference/dswx_s1_agreement.json')).then((r) => (r.ok ? r.json() : null)).catch(() => null)
  return dswxCache
}

/** The DSWx comparison when this run is the study frame and its later date is the DSWx date, else null. */
export function dswxForRun(ref, report) {
  if (!ref?.rows || !report) return null
  const tf = report.trackFrame || granuleTrackFrame(report.activeId)
  if (!tf || tf.track !== ref.track || tf.frame !== ref.frame || report.activeDate !== ref.date) return null
  return ref
}
