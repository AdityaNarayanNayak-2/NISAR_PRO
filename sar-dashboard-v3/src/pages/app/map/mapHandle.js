// The live MapLibre map, for controls outside MapView (zoom buttons, fly to region).
export const mapHandle = { current: null }

/** Camera padding that keeps fitted bounds inside the free map area (between the floating panels). */
export function freePadding(extra = 24) {
  const slots = document.querySelector('.map-slots')
  const map = slots?.parentElement
  if (!slots || !map) return extra
  const a = slots.getBoundingClientRect()
  const b = map.getBoundingClientRect()
  const pad = { top: a.top - b.top + extra, left: a.left - b.left + extra, right: b.right - a.right + extra, bottom: b.bottom - a.bottom + extra }
  // Tiny screens: never pad more than the map can hold.
  if (pad.left + pad.right > b.width - 80 || pad.top + pad.bottom > b.height - 80) return extra
  return pad
}

export function fitBbox(b, opts = {}) {
  if (!b || !mapHandle.current) return
  mapHandle.current.fitBounds([[b.west, b.south], [b.east, b.north]], { padding: freePadding(), duration: 700, ...opts })
}
