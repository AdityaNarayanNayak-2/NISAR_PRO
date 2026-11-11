import { useEffect, useMemo, useState } from 'react'
import { useRunStore } from '../stores/useRunStore'
import { regionList, hotspots, confidenceSplit } from '../lib/regions'
import { placeFor } from '../lib/places'

/** Regions of a run, its ten largest areas with place names, and the confidence split. */
export default function useRunAreas(run) {
  const mode = useRunStore((s) => s.mode)
  const geo = useRunStore((s) => s.regions[run.id])
  const regions = useMemo(() => (geo?.status === 'ok' ? regionList(geo.data) : []), [geo])
  const top = useMemo(() => hotspots(regions, 10), [regions])
  const split = useMemo(() => confidenceSplit(regions), [regions])
  const [places, setPlaces] = useState({})

  useEffect(() => {
    let off = false
    ;(async () => {
      for (const r of top) {
        const p = await placeFor(r.lat, r.lon, mode, run.places)
        if (off) return
        if (p) setPlaces((s) => ({ ...s, [r.id]: p }))
      }
    })()
    return () => { off = true }
  }, [top, mode, run.places])

  return { mode, geo, regions, top, split, places }
}
