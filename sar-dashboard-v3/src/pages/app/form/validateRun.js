import { granuleDate, granuleTrackFrame } from '../lib/report'

// Processor defaults per band (flood_detect.rs). Shown so people know what "default" means.
export const DEFAULTS = {
  l: { seed: -5.0, growth: -2.5, minChange: -3.0, floor: -13.0 },
  s: { seed: -4.8, growth: -2.2, minChange: -2.7, floor: -12.5 },
  c: { seed: -4.5, growth: -2.0, minChange: -2.5, floor: -12.0 },
}

/** Sentinel-1 backscatter GeoTIFF (Planetary Computer RTC or OPERA RTC-S1). */
export const isSentinel1 = (name) => /^S1[ABCD]_.*\.tiff?$|RTC-S1.*\.tiff?$/i.test(name || '')

export function sceneInfo(path) {
  const name = (path || '').split(/[\\/]/).pop()
  const band = /NISAR_L2_|_LSAR_/.test(name) ? 'l' : /NISAR_S2_|_SSAR_/.test(name) ? 's' : isSentinel1(name) ? 'c' : null
  return { name, band, date: granuleDate(name), tf: granuleTrackFrame(name) }
}

export function validateRun(v) {
  const e = {}
  const a = sceneInfo(v.baseline)
  const b = sceneInfo(v.active)
  if (!v.baseline) e.baseline = 'Choose the earlier scene.'
  if (!v.active) e.active = 'Choose the later scene.'
  if (v.baseline && v.active) {
    if (v.baseline === v.active) e.active = 'Pick two different scenes.'
    else if (a.band && b.band && a.band !== b.band) e.active = 'Both scenes must be the same band.'
    else if (a.tf && b.tf && (a.tf.track !== b.tf.track || a.tf.frame !== b.tf.frame)) e.active = 'Both scenes must be the same track and frame.'
    else if (a.date && b.date && a.date >= b.date) e.active = 'The active scene must be later than the baseline.'
  }
  if (v.area !== 'full') {
    if (!(v.lat >= -90 && v.lat <= 90)) e.lat = 'Latitude must be between −90 and 90.'
    if (!(v.lon >= -180 && v.lon <= 180)) e.lon = 'Longitude must be between −180 and 180.'
  }
  if (v.advanced) {
    for (const k of ['seed', 'growth', 'minChange', 'floor']) if (!Number.isFinite(v[k])) e[k] = 'Enter a number.'
    if (Number.isFinite(v.seed) && Number.isFinite(v.growth) && v.seed > v.growth) e.seed = `Seed must be at or below growth (for example −5.0 ≤ −2.5).`
    if (!(Number.isInteger(v.minArea) && v.minArea >= 1)) e.minArea = 'Whole number, 1 or more.'
  }
  if (!(Number.isInteger(v.erosion) && v.erosion >= 0 && v.erosion <= 200)) e.erosion = 'Whole number from 0 to 200.'
  return e
}

