// Facilities near the flood extent of each demo run, so the public site shows them without
// asking OpenStreetMap on every visit. Writes public/demo/runs/<id>/facilities.json.
//   node scripts/build_impact_data.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const plain = globalThis.fetch
globalThis.fetch = (u, i = {}) => plain(u, { ...i, headers: { 'User-Agent': 'NISAR-Pro', ...(i.headers || {}) } })
const { facilitiesInFlood } = await import(path.join(ROOT, 'src/pages/app/lib/impact.js'))

const runs = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/demo/runs.json')))
for (const run of runs) {
  const dir = path.join(ROOT, 'public/demo/runs', run.id)
  const geo = JSON.parse(fs.readFileSync(path.join(dir, 'regions.geojson')))
  const res = await facilitiesInFlood(run.id, geo)
  const out = { source: 'OpenStreetMap contributors (ODbL), via Overpass API', fetched: new Date().toISOString().slice(0, 10), ...res }
  fs.writeFileSync(path.join(dir, 'facilities.json'), JSON.stringify(out))
  console.log(run.id, res.items.length, 'near', res.inside, 'inside', res.counts)
  await new Promise((r) => setTimeout(r, 5000))
}
