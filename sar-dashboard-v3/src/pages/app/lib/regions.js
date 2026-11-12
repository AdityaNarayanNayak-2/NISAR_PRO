// Numbers derived from the region polygons (<id>_flood.geo.json) and from saved runs.
// Everything here is a sum or a sort of values the engine wrote; nothing is estimated.
import { KM2_PER_ACRE } from './units'
import { granuleTrackFrame } from './report'
import { runStatus } from './gateway'

/** Flat list of regions with the fields the UI uses. */
export function regionList(geojson) {
  const feats = geojson?.features || []
  return feats.map((f) => {
    const p = f.properties || {}
    const acres = Number(p.area_acres)
    const high = Number(p.high_conf_pixels) || 0
    const med = Number(p.med_conf_pixels) || 0
    const low = Number(p.low_conf_pixels) || 0
    const px = Number(p.pixel_count) || high + med + low
    return {
      id: p.region_id,
      acres,
      km2: acres * KM2_PER_ACRE,
      lat: Number(p.centroid_lat),
      lon: Number(p.centroid_lon),
      pixels: px,
      high, med, low,
      confidence: String(p.confidence || '').toUpperCase(),
      classCode: Number(p.class_code),
    }
  }).filter((r) => Number.isFinite(r.acres))
}

/** Largest regions first. */
export function hotspots(regions, n = 10) {
  return [...regions].sort((a, b) => b.acres - a.acres).slice(0, n)
}

/** Sum of regions whose centre lies inside the box {west, south, east, north}. */
export function sumInBox(regions, b) {
  if (!b) return null
  let acres = 0
  let count = 0
  for (const r of regions) {
    if (r.lat >= b.south && r.lat <= b.north && r.lon >= b.west && r.lon <= b.east) { acres += r.acres; count++ }
  }
  return { acres, km2: acres * KM2_PER_ACRE, count }
}

/** Pixel split over all regions (how much of the flood extent is high vs medium vs low). */
export function confidenceSplit(regions) {
  let high = 0, med = 0, low = 0
  for (const r of regions) { high += r.high; med += r.med; low += r.low }
  const total = high + med + low
  return { high, med, low, total }
}

/** Region count per size class (in km²). Edges are fixed so runs compare. */
export const SIZE_BINS = [
  { label: '< 0.1', max: 0.1 },
  { label: '0.1–1', max: 1 },
  { label: '1–10', max: 10 },
  { label: '10–100', max: 100 },
  { label: '≥ 100', max: Infinity },
]
export function sizeHistogram(regions) {
  const counts = SIZE_BINS.map(() => ({ count: 0, km2: 0 }))
  for (const r of regions) {
    const i = SIZE_BINS.findIndex((b) => r.km2 < b.max)
    counts[i].count++
    counts[i].km2 += r.km2
  }
  return SIZE_BINS.map((b, i) => ({ ...b, ...counts[i] }))
}

/** Track·frame key of a run, e.g. "98/14". */
export function frameKey(run) {
  const tf = granuleTrackFrame(run?.summary?.active_id || run?.request?.input_file)
  return tf ? `${tf.track}/${tf.frame}` : null
}

/**
 * Finished full-scene runs of the same track·frame and band, one per period (oldest first).
 * Each period: flood extent (gain) and water loss in km² and acres, straight from the run summary.
 */
export function periodsFor(runs, run) {
  const key = frameKey(run)
  const band = run?.summary?.band
  if (!key || !band) return []
  const seen = new Set()
  return runs
    .filter((r) => runStatus(r).kind === 'completed' && frameKey(r) === key && r.summary?.band === band && r.summary?.crop_preset === run.summary?.crop_preset)
    .sort((a, b) => (a.summary.baseline_date || '').localeCompare(b.summary.baseline_date || '') || b.created_at - a.created_at)
    .filter((r) => { const k = `${r.summary.baseline_date}|${r.summary.active_date}`; if (seen.has(k)) return false; seen.add(k); return true })
    .map((r) => ({
      id: r.id,
      from: r.summary.baseline_date,
      to: r.summary.active_date,
      gain: r.summary.new_water || null,
      loss: r.summary.water_loss || null,
      stable: r.summary.stable_water || null,
    }))
}

/** Hotspots as CSV text (one row per region, areas in km² and acres). */
export function hotspotsCsv(list, places = {}) {
  const head = 'rank,region_id,place,area_km2,area_acres,high_conf_share,lat,lon'
  const rows = list.map((r, i) => {
    const p = places[r.id]
    const name = p ? [p.name, p.area, p.country].filter(Boolean).join(', ') : ''
    const share = r.pixels ? (r.high / r.pixels).toFixed(3) : ''
    return [i + 1, r.id, `"${name.replace(/"/g, "'")}"`, r.km2.toFixed(3), r.acres.toFixed(1), share, r.lat.toFixed(5), r.lon.toFixed(5)].join(',')
  })
  return [head, ...rows].join('\n')
}

const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const CAVEAT = 'Radar-detected flood area. Not confirmed on the ground. Point is the centre of the area, not its edge.'
const placeText = (p) => (p ? [p.name, p.area, p.country].filter(Boolean).join(', ') : '')
const waypointName = (r, i, places) => `${i + 1}. ${places[r.id]?.name || r.id} (${r.km2.toFixed(2)} km2)`
const waypointDesc = (r, places) => `${r.id}. ${r.km2.toFixed(2)} km2, ${Math.round(r.acres)} acres. ${placeText(places[r.id])}. ${CAVEAT}`

/** Ranked areas as KML placemarks (Google Earth, phones). */
export function hotspotsKml(list, places = {}, title = 'NISAR Pro flood areas') {
  const marks = list.map((r, i) => `  <Placemark><name>${esc(waypointName(r, i, places))}</name><description>${esc(waypointDesc(r, places))}</description><Point><coordinates>${r.lon.toFixed(6)},${r.lat.toFixed(6)},0</coordinates></Point></Placemark>`)
  return `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>${esc(title)}</name>\n${marks.join('\n')}\n</Document></kml>\n`
}

/** Ranked areas as GPX waypoints (handheld GPS units). */
export function hotspotsGpx(list, places = {}) {
  const wpts = list.map((r, i) => `  <wpt lat="${r.lat.toFixed(6)}" lon="${r.lon.toFixed(6)}"><name>${esc(waypointName(r, i, places))}</name><desc>${esc(waypointDesc(r, places))}</desc></wpt>`)
  return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="NISAR Pro" xmlns="http://www.topografix.com/GPX/1/1">\n${wpts.join('\n')}\n</gpx>\n`
}

/** Share of the summed region area held by the given list (e.g. the 10 largest). Computed. */
export function shareOf(list, regions) {
  const total = regions.reduce((s, r) => s + r.acres, 0)
  return total > 0 ? list.reduce((s, r) => s + r.acres, 0) / total : null
}
