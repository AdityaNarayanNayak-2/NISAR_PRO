import { useEffect, useMemo, useState } from 'react'
import { placeFor } from '../lib/places'
import { KM2_PER_ACRE } from '../lib/units'

const COVER = 0.95 // name the largest areas until they hold 95% of the summed area
const MAX = 250 // and never more than this many (OpenStreetMap allows 1 request per second)

/**
 * Flood extent per district (the OpenStreetMap "area" above each area's nearest place).
 * Each area counts where its centre lies. Names come one by one through the gateway, which caches
 * them on disk, so a second look is instant. Returns rows, progress and the share of area named.
 */
export default function useDistricts(regions, mode, demoPlaces) {
  const todo = useMemo(() => {
    const sorted = [...regions].sort((a, b) => b.acres - a.acres)
    const total = sorted.reduce((s, r) => s + r.acres, 0)
    const out = []
    let acc = 0
    for (const r of sorted) {
      if (out.length >= MAX || (total > 0 && acc / total >= COVER)) break
      out.push(r)
      acc += r.acres
    }
    return { list: out, total }
  }, [regions])
  const [named, setNamed] = useState({ key: null, places: {} })
  const key = `${todo.list.length}:${todo.list[0]?.id || ''}`

  useEffect(() => {
    let off = false
    ;(async () => {
      for (const r of todo.list) {
        const p = await placeFor(r.lat, r.lon, mode, demoPlaces)
        if (off) return
        setNamed((s) => (s.key === key ? { key, places: { ...s.places, [r.id]: p || null } } : { key, places: { [r.id]: p || null } }))
      }
    })()
    return () => { off = true }
  }, [todo, mode, demoPlaces, key])

  return useMemo(() => {
    const places = named.key === key ? named.places : {}
    const by = new Map()
    let namedAcres = 0
    let asked = 0
    for (const r of todo.list) {
      if (!(r.id in places)) continue
      asked++
      const p = places[r.id]
      const d = p?.area || p?.name
      if (!d) continue
      namedAcres += r.acres
      const row = by.get(d) || { district: d, country: p.country || '', acres: 0, count: 0 }
      row.acres += r.acres
      row.count++
      by.set(d, row)
    }
    const rows = [...by.values()].map((x) => ({ ...x, km2: x.acres * KM2_PER_ACRE, share: todo.total ? x.acres / todo.total : null })).sort((a, b) => b.acres - a.acres)
    return { rows, places, asked, toAsk: todo.list.length, namedShare: todo.total ? namedAcres / todo.total : 0, done: asked >= todo.list.length }
  }, [named, key, todo])
}
