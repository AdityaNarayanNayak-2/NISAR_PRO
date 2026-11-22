// Numbers for the website's "Beyond the flood line" section, from free public data around the
// Bihar L-band run (31 Aug -> 12 Sep 2026). Writes src/pages/marketing/impactMeta.json.
// Needs public/demo/runs/<id>/facilities.json (scripts/build_impact_data.mjs) first.
//   node scripts/build_impact_meta.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const plain = globalThis.fetch
globalThis.fetch = (u, i = {}) => plain(u, { ...i, headers: { 'User-Agent': 'NISAR-Pro', ...(i.headers || {}) } })
const { riverFlow, rainPast, addDays } = await import(path.join(ROOT, 'src/pages/app/lib/impact.js'))

const ID = 'bihar-l-2026-08-31-2026-09-12'
const run = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/demo/runs.json'))).find((r) => r.id === ID)
const dir = path.join(ROOT, 'public/demo/runs', ID)
const fac = JSON.parse(fs.readFileSync(path.join(dir, 'facilities.json')))
const geo = JSON.parse(fs.readFileSync(path.join(dir, 'regions.geojson')))
const top = geo.features.map((f) => f.properties).sort((a, b) => b.area_acres - a.area_acres)[0]
const lat = top.centroid_lat, lon = top.centroid_lon
const place = run.places?.[`${lat.toFixed(3)},${lon.toFixed(3)}`]
const from = run.summary.baseline_date, to = run.summary.active_date

const river = await riverFlow(lat, lon, addDays(from, -30), addDays(to, 30))
const at = (t) => river.days.find((d) => d.t === t)?.v
const rain = await rainPast(lat, lon, addDays(from, -14), to)
const between = rain.filter((d) => d.t > from && d.t <= to).reduce((s, d) => s + (d.v || 0), 0)

const out = {
  run: ID, from, to,
  place: place ? `${place.name}, ${place.area}` : `${lat.toFixed(3)}, ${lon.toFixed(3)}`,
  facilities: { total: fac.items.length, counts: fac.counts, near_m: 1000, fetched: fac.fetched, closest: fac.items.slice(0, 3).map((i) => ({ name: i.name, amenity: i.amenity, distM: i.distM })) },
  river: { from: Math.round(at(from)), to: Math.round(at(to)), pct: Math.round((100 * (at(to) - at(from))) / at(from)), cellKm: Math.round(river.km * 10) / 10 },
  rain: { between: Math.round(between) },
}
fs.writeFileSync(path.join(ROOT, 'src/pages/marketing/impactMeta.json'), JSON.stringify(out, null, 1))
console.log(out)
