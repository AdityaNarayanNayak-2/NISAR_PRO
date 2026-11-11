// Area formatting. Every area in the app goes through here so km² and acres
// always come from the same value. 1 acre = 0.004046856 km².
export const KM2_PER_ACRE = 0.004046856

const nf = (digits) => new Intl.NumberFormat('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })

/** { km2: '1,166.21 km²', acres: '288,178 acres' } or dashes when the value is missing. */
export function formatArea(km2, acres) {
  const k = Number.isFinite(km2) ? km2 : Number.isFinite(acres) ? acres * KM2_PER_ACRE : null
  const a = Number.isFinite(acres) ? acres : Number.isFinite(km2) ? km2 / KM2_PER_ACRE : null
  return {
    km2: k == null ? '—' : `${nf(2).format(k)} km²`,
    acres: a == null ? '—' : `${nf(0).format(a)} acres`,
  }
}

export function formatPercent(part, whole) {
  if (!Number.isFinite(part) || !Number.isFinite(whole) || whole <= 0) return '—'
  return `${nf(2).format((100 * part) / whole)}%`
}

export function formatNumber(v, digits = 0) {
  return Number.isFinite(v) ? nf(digits).format(v) : '—'
}

export function formatDb(v) {
  return Number.isFinite(v) ? `${v.toFixed(2)} dB` : '—'
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
/** '2026-09-12' -> '12 Sep 2026' */
export function formatDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '')
  return m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}` : '—'
}
/** '2026-09-12' -> '12 Sep' */
export function formatShortDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '')
  return m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]}` : '—'
}

export function formatRelativeTime(unixSeconds) {
  if (!unixSeconds) return ''
  const d = new Date(unixSeconds * 1000)
  return d.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}
