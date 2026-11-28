// Free public data around a run, fetched by the browser (no keys, no personal data sent: only
// coordinates and dates). Everything is labelled with its source in the UI.
//   Facilities  OpenStreetMap via Overpass (ODbL). Point-in-polygon against the run's flood areas.
//   River flow  GloFAS v4 via Open-Meteo Flood API (CC BY 4.0). Model, 5 km grid, not a gauge.
//   Rain        ERA5 via Open-Meteo archive (past), Open-Meteo forecast (next days).
const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter']
const FLOOD = 'https://flood-api.open-meteo.com/v1/flood'
const ARCHIVE = 'https://archive-api.open-meteo.com/v1/archive'
const FORECAST = 'https://api.open-meteo.com/v1/forecast'

const cache = new Map() // key -> Promise

function once(key, fn) {
  if (!cache.has(key)) cache.set(key, fn().catch((e) => { cache.delete(key); throw e }))
  return cache.get(key)
}

// Offline copy: every answer that loaded is kept in this browser (localStorage). When the
// network fails (no Wi-Fi at a venue), the last saved answer is used and marked `_savedAt`.
const SAVE_PREFIX = 'nisar.impact.'
const saveKey = (url, init) => SAVE_PREFIX + url + (init?.body ? `|${String(init.body)}` : '')

async function getJson(url, init) {
  const key = saveKey(url, init)
  let data
  try {
    const res = await fetch(url, init)
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
    data = await res.json()
  } catch (e) {
    try {
      const saved = JSON.parse(localStorage.getItem(key) || 'null')
      if (saved?.data) return Object.assign(saved.data, { _savedAt: saved.at })
    } catch { /* no saved copy */ }
    throw e
  }
  // GET answers only (small); the large OpenStreetMap POST answers are not kept.
  if (!init?.body) try { localStorage.setItem(key, JSON.stringify({ at: new Date().toISOString(), data })) } catch { /* storage full: skip */ }
  return data
}

/** Saved-copy note for a result of getJson (null when it came live). */
export const savedNote = (d) => (d?.saved ? `No internet: saved copy from ${d.saved.slice(0, 10)}` : null)

/**
 * Local runs that are the Bihar reference runs reuse the website demo files (facilities,
 * buildings): same band, dates and flood extent as the demo run. Otherwise null.
 */
export async function demoTwinId(rep, site) {
  if (!rep?.band || !rep.baselineDate || !rep.activeDate || rep.newWater?.km2 == null) return null
  const id = `bihar-${rep.band.toLowerCase()}-${rep.baselineDate}-${rep.activeDate}`
  try {
    const res = await fetch(site(`/demo/runs/${id}/report.json`))
    if (!res.ok) return null
    const km2 = (await res.json())?.areas?.total_flood_km2
    return typeof km2 === 'number' && Math.abs(km2 - rep.newWater.km2) < 0.01 ? id : null
  } catch { return null }
}

export const FACILITY_KINDS = [
  { key: 'health', label: 'Health', match: /^(hospital|clinic|doctors|health_post|dentist|pharmacy)$/ },
  { key: 'school', label: 'Schools and colleges', match: /^(school|college|university|kindergarten)$/ },
  { key: 'emergency', label: 'Police and fire', match: /^(police|fire_station)$/ },
  { key: 'shelter', label: 'Shelters', match: /^(shelter|social_facility|community_centre)$/ },
]
const AMENITY_RE = 'hospital|clinic|doctors|health_post|dentist|pharmacy|school|college|university|kindergarten|police|fire_station|shelter|social_facility|community_centre'

function kindOf(amenity) {
  return FACILITY_KINDS.find((k) => k.match.test(amenity))?.key || null
}

/** Bounding box of a (Multi)Polygon geometry. */
function geomBox(g) {
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : []
  for (const p of polys) for (const [x, y] of p[0] || []) {
    if (x < w) w = x
    if (x > e) e = x
    if (y < s) s = y
    if (y > n) n = y
  }
  return { w, s, e, n, polys }
}

function inRing(x, y, ring) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j]
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

function inPolys(x, y, polys) {
  for (const p of polys) {
    if (!inRing(x, y, p[0])) continue
    let hole = false
    for (let h = 1; h < p.length; h++) if (inRing(x, y, p[h])) { hole = true; break }
    if (!hole) return true
  }
  return false
}

const CELL = 0.1 // degrees; index of flood areas for the distance test
export const NEAR_M = 1000 // facilities this close to the flood extent are listed

/** Metres from (x, y) to the nearest edge of the polygons; 0 when inside. Equirectangular, fine at 1 km. */
function distM(x, y, polys) {
  if (inPolys(x, y, polys)) return 0
  const kx = 111320 * Math.cos((y * Math.PI) / 180), ky = 110540
  let best = Infinity
  for (const p of polys) for (const ring of p) {
    for (let i = 1; i < ring.length; i++) {
      const ax = (ring[i - 1][0] - x) * kx, ay = (ring[i - 1][1] - y) * ky
      const bx = (ring[i][0] - x) * kx, by = (ring[i][1] - y) * ky
      const dx = bx - ax, dy = by - ay
      const L = dx * dx + dy * dy
      const t = L ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / L)) : 0
      const d = Math.hypot(ax + t * dx, ay + t * dy)
      if (d < best) best = d
    }
  }
  return best
}

/**
 * Facilities inside or within NEAR_M of the flood areas of a run.
 * Returns { items: [{id, name, kind, amenity, lat, lon, regionId, regionAcres, distM}], counts, inside, cells, scanned }.
 */
export function facilitiesInFlood(runId, geojson) {
  return once(`fac:${runId}`, async () => {
    const feats = (geojson?.features || []).filter((f) => f.geometry)
      .map((f) => ({ id: f.properties?.region_id, acres: Number(f.properties?.area_acres) || 0, ...geomBox(f.geometry) }))
    const cells = new Map()
    for (const f of feats) {
      for (let cx = Math.floor(f.w / CELL); cx <= Math.floor(f.e / CELL); cx++) {
        for (let cy = Math.floor(f.s / CELL); cy <= Math.floor(f.n / CELL); cy++) {
          const k = `${cx},${cy}`
          if (!cells.has(k)) cells.set(k, [])
          cells.get(k).push(f)
        }
      }
    }
    let W = Infinity, S = Infinity, E = -Infinity, N = -Infinity
    for (const f of feats) { W = Math.min(W, f.w); S = Math.min(S, f.s); E = Math.max(E, f.e); N = Math.max(N, f.n) }
    if (!feats.length) return { items: [], counts: {}, inside: 0, cells: 0, scanned: 0 }
    const box = [S, W, N, E].map((v) => v.toFixed(3)).join(',')
    const q = `[out:json][timeout:170];nwr["amenity"~"^(${AMENITY_RE})$"](${box});out center tags;`
    let data, err
    for (const url of OVERPASS) {
      try { data = await getJson(url, { method: 'POST', body: new URLSearchParams({ data: q }) }); break } catch (e) { err = e }
    }
    if (!data) throw err
    const seen = new Set()
    const items = []
    for (const el of data.elements || []) {
      const lat = el.lat ?? el.center?.lat
      const lon = el.lon ?? el.center?.lon
      const amenity = el.tags?.amenity || ''
      const kind = kindOf(amenity)
      const key = `${el.type}/${el.id}`
      if (lat == null || !kind || seen.has(key)) continue
      seen.add(key)
      const pad = 0.012 // about 1.2 km in degrees
      const cand = new Set()
      for (const dx of [-1, 0, 1]) for (const dy of [-1, 0, 1]) {
        for (const f of cells.get(`${Math.floor(lon / CELL) + dx},${Math.floor(lat / CELL) + dy}`) || []) cand.add(f)
      }
      let hit = null, best = Infinity
      for (const f of cand) {
        if (lon < f.w - pad || lon > f.e + pad || lat < f.s - pad || lat > f.n + pad) continue
        const d = distM(lon, lat, f.polys)
        if (d < best) { best = d; hit = f }
      }
      if (!hit || best > NEAR_M) continue
      items.push({
        id: key, kind, amenity, lat, lon,
        name: el.tags?.name || el.tags?.['name:en'] || '',
        regionId: hit.id, regionAcres: hit.acres, distM: Math.round(best),
      })
    }
    items.sort((a, b) => a.distM - b.distM || b.regionAcres - a.regionAcres)
    const counts = Object.fromEntries(FACILITY_KINDS.map((k) => [k.key, items.filter((i) => i.kind === k.key).length]))
    return { items, counts, inside: items.filter((i) => i.distM === 0).length, cells: cells.size, scanned: seen.size }
  })
}

const ymd = (d) => new Date(d).toISOString().slice(0, 10)
const addDays = (d, n) => ymd(Date.parse(d) + n * 86400000)

const RIVER_STEP = 0.05 // degrees, the GloFAS grid
const RIVER_REACH = 2 // cells each way: a 5 x 5 search, about 11 km from the point

/** The GloFAS cell with the largest mean flow near a point (the main river, not a field drain). */
function mainRiverCell(lat, lon) {
  const la = lat.toFixed(2), lo = lon.toFixed(2)
  return once(`cell:${la},${lo}`, async () => {
    const lats = [], lons = []
    for (let i = -RIVER_REACH; i <= RIVER_REACH; i++) for (let j = -RIVER_REACH; j <= RIVER_REACH; j++) {
      lats.push((lat + i * RIVER_STEP).toFixed(3)); lons.push((lon + j * RIVER_STEP).toFixed(3))
    }
    const d = await getJson(`${FLOOD}?latitude=${lats.join(',')}&longitude=${lons.join(',')}&daily=river_discharge&past_days=30&forecast_days=1`)
    const list = Array.isArray(d) ? d : [d]
    let best = null
    for (const c of list) {
      const v = (c.daily?.river_discharge || []).filter((x) => x != null)
      const mean = v.reduce((s, x) => s + x, 0) / (v.length || 1)
      if (!best || mean > best.mean) best = { lat: c.latitude, lon: c.longitude, mean }
    }
    const km = best ? Math.hypot((best.lat - lat) * 110.54, (best.lon - lon) * 111.32 * Math.cos((lat * Math.PI) / 180)) : null
    return best ? { lat: best.lat, lon: best.lon, km } : { lat, lon, km: 0 }
  })
}

/** Daily GloFAS river discharge (m³/s) on the main river near a point, for a date window. */
export function riverFlow(lat, lon, start, end) {
  return once(`river:${lat.toFixed(3)},${lon.toFixed(3)}:${start}:${end}`, async () => {
    const c = await mainRiverCell(lat, lon)
    const d = await getJson(`${FLOOD}?latitude=${c.lat}&longitude=${c.lon}&daily=river_discharge&start_date=${start}&end_date=${end}`)
    return { saved: d._savedAt || null, cellLat: d.latitude, cellLon: d.longitude, km: c.km, days: (d.daily?.time || []).map((t, i) => ({ t, v: d.daily.river_discharge[i] })) }
  })
}

/** River discharge forecast on the main river near a point: past 7 days, then 30 days ahead with the ensemble maximum. */
export function riverForecast(lat, lon) {
  return once(`riverfc:${lat.toFixed(3)},${lon.toFixed(3)}`, async () => {
    const c = await mainRiverCell(lat, lon)
    const d = await getJson(`${FLOOD}?latitude=${c.lat}&longitude=${c.lon}&daily=river_discharge,river_discharge_median,river_discharge_max&past_days=7&forecast_days=30`)
    const t = d.daily?.time || []
    return Object.assign(t.map((x, i) => ({ t: x, v: d.daily.river_discharge[i], med: d.daily.river_discharge_median?.[i], max: d.daily.river_discharge_max?.[i] })), { saved: d._savedAt || null })
  })
}

/** Daily rain (mm, ERA5 reanalysis) for a past window. */
export function rainPast(lat, lon, start, end) {
  const la = lat.toFixed(3), lo = lon.toFixed(3)
  return once(`rain:${la},${lo}:${start}:${end}`, async () => {
    const d = await getJson(`${ARCHIVE}?latitude=${la}&longitude=${lo}&daily=precipitation_sum&start_date=${start}&end_date=${end}&timezone=Asia%2FKolkata`)
    return Object.assign((d.daily?.time || []).map((t, i) => ({ t, v: d.daily.precipitation_sum[i] })), { saved: d._savedAt || null })
  })
}

/** Rain forecast (mm per day) for the next 7 days. */
export function rainForecast(lat, lon) {
  const la = lat.toFixed(3), lo = lon.toFixed(3)
  return once(`rainfc:${la},${lo}`, async () => {
    const d = await getJson(`${FORECAST}?latitude=${la}&longitude=${lo}&daily=precipitation_sum,precipitation_probability_max&forecast_days=7&timezone=auto`)
    return Object.assign((d.daily?.time || []).map((t, i) => ({ t, v: d.daily.precipitation_sum[i], p: d.daily.precipitation_probability_max?.[i] })), { saved: d._savedAt || null })
  })
}

export { addDays, ymd }
