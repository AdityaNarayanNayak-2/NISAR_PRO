// Nearest place name for a point, from OpenStreetMap through the local gateway
// (GET /geocode/reverse, cached on disk there). Demo mode uses names saved with the demo data.
import { gatewayBase } from './gateway'

const memo = new Map() // "lat,lon" -> Promise<place|null>

export function placeFor(lat, lon, mode, demoPlaces) {
  const key = `${lat.toFixed(3)},${lon.toFixed(3)}`
  if (mode === 'demo') return Promise.resolve(demoPlaces?.[key] || null)
  if (mode !== 'local') return Promise.resolve(null)
  if (!memo.has(key)) {
    const p = fetch(`${gatewayBase()}/geocode/reverse?lat=${lat}&lon=${lon}`)
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
    memo.set(key, p)
    p.then((v) => { if (!v) memo.delete(key) })
  }
  return memo.get(key)
}

export function placeLabel(p) {
  if (!p) return null
  return [p.name, p.area].filter(Boolean).join(', ') || p.country || null
}
