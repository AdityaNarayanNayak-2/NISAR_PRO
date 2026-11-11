// Repaints the engine's class PNG so each class can be switched on and off.
// The engine writes one exact colour per class (FLOOD_PNG_COLORS); we read the
// class back from that colour once, then paint only the visible classes in
// their display colours (CLASSES in report.js).
import { FLOOD_PNG_COLORS, classRgb } from './report'

const cache = new Map() // url -> Promise<{ w, h, classes: Uint8Array }>

function decode(url) {
  if (cache.has(url)) return cache.get(url)
  const p = new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const c = document.createElement('canvas')
      c.width = img.naturalWidth
      c.height = img.naturalHeight
      const ctx = c.getContext('2d', { willReadFrequently: true })
      ctx.drawImage(img, 0, 0)
      const px = ctx.getImageData(0, 0, c.width, c.height).data
      const classes = new Uint8Array(c.width * c.height)
      const keys = Object.entries(FLOOD_PNG_COLORS).map(([k, [r, g, b]]) => [Number(k), r, g, b])
      for (let i = 0, j = 0; i < classes.length; i++, j += 4) {
        if (px[j + 3] === 0) continue
        for (const [k, r, g, b] of keys) {
          if (px[j] === r && px[j + 1] === g && px[j + 2] === b) { classes[i] = k; break }
        }
      }
      resolve({ w: c.width, h: c.height, classes })
    }
    img.onerror = () => reject(new Error(`Could not load ${url}`))
    img.src = url
  })
  cache.set(url, p)
  p.catch(() => cache.delete(url))
  return p
}

/** Object URL of the class image with only the `visible` class codes painted. Revoke it when done. */
export async function paintClasses(url, visible) {
  const { w, h, classes } = await decode(url)
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')
  const out = ctx.createImageData(w, h)
  const d = out.data
  const lut = {}
  for (const k of Object.keys(FLOOD_PNG_COLORS)) if (visible[k]) lut[k] = classRgb(k)
  for (let i = 0, j = 0; i < classes.length; i++, j += 4) {
    const rgb = lut[classes[i]]
    if (!rgb) continue
    d[j] = rgb[0]; d[j + 1] = rgb[1]; d[j + 2] = rgb[2]; d[j + 3] = 255
  }
  ctx.putImageData(out, 0, 0)
  const blob = await new Promise((res) => c.toBlob(res, 'image/png'))
  return URL.createObjectURL(blob)
}
