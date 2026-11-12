// Card for the selected flood area, pinned to its centre on the map: place, area, confidence,
// and its centre in three coordinate formats for field teams. Values from the regions file.
import { useEffect, useState } from 'react'
import { useRunStore } from '../stores/useRunStore'
import { useMapStore } from '../stores/useMapStore'
import { placeFor, placeLabel } from '../lib/places'
import { dd, dms, utmText } from '../lib/coords'
import { formatArea, formatNumber } from '../lib/units'
import Icon from '../ui/Icon'

export default function AreaCard({ map, region, rank, run }) {
  const mode = useRunStore((s) => s.mode)
  const toast = useRunStore((s) => s.toast)
  const selectRegion = useMapStore((s) => s.selectRegion)
  const [pos, setPos] = useState(null)
  const [place, setPlace] = useState({ id: null, p: null })

  useEffect(() => {
    if (!map || !region) return
    const upd = () => setPos(map.project([region.lon, region.lat]))
    upd()
    map.on('move', upd)
    return () => map.off('move', upd)
  }, [map, region])

  useEffect(() => {
    if (!region) return
    let off = false
    placeFor(region.lat, region.lon, mode, run?.places).then((p) => { if (!off) setPlace({ id: region.id, p }) })
    return () => { off = true }
  }, [region, mode, run?.places])

  if (!region || !pos) return null
  const c = map.getContainer()
  if (pos.x < 0 || pos.y < 0 || pos.x > c.clientWidth || pos.y > c.clientHeight) return null
  const a = formatArea(region.km2, region.acres)
  const total = region.pixels || 1
  const pct = (v) => `${formatNumber((100 * v) / total)}%`
  const name = place.id === region.id ? placeLabel(place.p) : null
  const copy = (label, text) => navigator.clipboard?.writeText(text).then(() => toast(`${label} copied.`, 'ok'))
  const rows = [['Decimal', dd(region.lat, region.lon)], ['DMS', dms(region.lat, region.lon)], ['UTM', utmText(region.lat, region.lon)]]
  return (
    <div className="area-card glass" style={{ left: pos.x, top: pos.y }} role="dialog" aria-label="Flood area">
      <div className="ac-head">
        <span className="ac-name">{rank ? <span className="pin sm">{rank}</span> : null}{name || region.id}</span>
        <button type="button" className="icon-btn xs" onClick={() => selectRegion(null)} aria-label="Close"><Icon name="close" size={12} /></button>
      </div>
      <div className="ac-area num">{a.km2}<small>{a.acres} · {formatNumber(region.pixels)} pixels of 80 m</small></div>
      <div className="confbar" title="Share of pixels by confidence">
        {region.high > 0 && <i style={{ flexGrow: region.high, background: '#3d8df0' }} />}
        {region.med > 0 && <i style={{ flexGrow: region.med, background: '#82b8f4' }} />}
        {region.low > 0 && <i style={{ flexGrow: region.low, background: '#c2dbf7' }} />}
      </div>
      <div className="ac-conf">High {pct(region.high)} · medium {pct(region.med)}{region.low ? ` · low ${pct(region.low)}` : ''}</div>
      <div className="ac-coords">
        {rows.map(([k, v]) => (
          <div key={k} className="ac-coord"><span className="k">{k}</span><span className="mono">{v}</span>
            <button type="button" className="icon-btn xs" onClick={() => copy(`${k} coordinates`, v)} aria-label={`Copy ${k} coordinates`}><Icon name="copy" size={12} /></button>
          </div>
        ))}
      </div>
      <div className="ac-foot">
        <span>{region.id} · centre of the area, not its edge</span>
        <a className="link" href={`https://www.openstreetmap.org/?mlat=${region.lat}&mlon=${region.lon}#map=14/${region.lat}/${region.lon}`} target="_blank" rel="noreferrer">OSM</a>
      </div>
    </div>
  )
}
