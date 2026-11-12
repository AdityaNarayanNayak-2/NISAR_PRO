// Coordinate formats for field teams: decimal degrees, degrees-minutes-seconds and UTM (WGS84).

export function dd(lat, lon) {
  return `${lat.toFixed(5)}, ${lon.toFixed(5)}`
}

function dmsPart(v, pos, neg) {
  const a = Math.abs(v)
  let d = Math.floor(a)
  let m = Math.floor((a - d) * 60)
  let s = Math.round(((a - d) * 60 - m) * 60 * 10) / 10
  if (s >= 60) { s = 0; m += 1 }
  if (m >= 60) { m = 0; d += 1 }
  return `${d}°${String(m).padStart(2, '0')}′${s.toFixed(1).padStart(4, '0')}″${v >= 0 ? pos : neg}`
}

export function dms(lat, lon) {
  return `${dmsPart(lat, 'N', 'S')} ${dmsPart(lon, 'E', 'W')}`
}

/** UTM zone and easting/northing (metres) on WGS84. Zone from the longitude. */
export function utm(lat, lon) {
  const zone = Math.floor((lon + 180) / 6) + 1
  const a = 6378137, f = 1 / 298.257223563, k0 = 0.9996
  const e2 = f * (2 - f), ep2 = e2 / (1 - e2)
  const phi = (lat * Math.PI) / 180
  const lam0 = (((zone - 1) * 6 - 180 + 3) * Math.PI) / 180
  const lam = (lon * Math.PI) / 180
  const N = a / Math.sqrt(1 - e2 * Math.sin(phi) ** 2)
  const T = Math.tan(phi) ** 2
  const C = ep2 * Math.cos(phi) ** 2
  const A = Math.cos(phi) * (lam - lam0)
  const M = a * ((1 - e2 / 4 - (3 * e2 ** 2) / 64 - (5 * e2 ** 3) / 256) * phi
    - ((3 * e2) / 8 + (3 * e2 ** 2) / 32 + (45 * e2 ** 3) / 1024) * Math.sin(2 * phi)
    + ((15 * e2 ** 2) / 256 + (45 * e2 ** 3) / 1024) * Math.sin(4 * phi)
    - ((35 * e2 ** 3) / 3072) * Math.sin(6 * phi))
  const x = k0 * N * (A + ((1 - T + C) * A ** 3) / 6 + ((5 - 18 * T + T ** 2 + 72 * C - 58 * ep2) * A ** 5) / 120) + 500000
  let y = k0 * (M + N * Math.tan(phi) * (A ** 2 / 2 + ((5 - T + 9 * C + 4 * C ** 2) * A ** 4) / 24 + ((61 - 58 * T + T ** 2 + 600 * C - 330 * ep2) * A ** 6) / 720))
  if (lat < 0) y += 10000000
  return { zone, hemi: lat >= 0 ? 'N' : 'S', easting: x, northing: y }
}

export function utmText(lat, lon) {
  const u = utm(lat, lon)
  return `${u.zone}${u.hemi} ${Math.round(u.easting)} E ${Math.round(u.northing)} N`
}
