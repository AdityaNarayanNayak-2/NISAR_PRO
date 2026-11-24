// Where the data comes from.
//  local: a NISAR Pro gateway answers (installed app, or `vite dev` next to it)
//  demo:  the public website; read-only runs shipped in /demo
//  offline: neither answered
const STORAGE_KEY = 'nisarpro_gateway_url'

export function gatewayBase() {
  const custom = typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEY)
  if (custom) return custom.replace(/\/+$/, '')
  const env = import.meta.env?.VITE_GATEWAY_URL
  if (env) return env.replace(/\/+$/, '')
  if (typeof window === 'undefined') return 'http://localhost:3000'
  // Vite dev server: the gateway runs next to it on :3000.
  if (window.location.port === '5173') return `http://${window.location.hostname}:3000`
  // Served by the gateway itself.
  return window.location.origin
}

export function setGatewayBase(url) {
  if (url) localStorage.setItem(STORAGE_KEY, url.trim().replace(/\/+$/, ''))
  else localStorage.removeItem(STORAGE_KEY)
}

const isAbsolute = (p) => /^(https?:|blob:|data:)/.test(p)

/** URL for a gateway path. In demo mode, artifact URLs are already site-relative. */
export function gatewayUrl(path, mode = 'local') {
  if (!path) return null
  if (isAbsolute(path)) return path
  if (mode === 'demo') return path
  return `${gatewayBase()}${path.startsWith('/') ? '' : '/'}${path.replace(/\/{2,}/g, '/')}`
}

const wait = (ms, signal) => new Promise((resolve, reject) => {
  const t = setTimeout(resolve, ms)
  signal?.addEventListener('abort', () => { clearTimeout(t); reject(new DOMException('Aborted', 'AbortError')) }, { once: true })
})

async function getJson(url, signal) {
  let res
  // A busy gateway (429/503) says when to come back: wait and retry twice before giving up.
  for (let attempt = 0; ; attempt++) {
    res = await fetch(url, { signal, headers: { Accept: 'application/json' } })
    if ((res.status !== 429 && res.status !== 503) || attempt >= 2) break
    const after = Number(res.headers.get('retry-after'))
    await wait(Math.min(Number.isFinite(after) && after > 0 ? after * 1000 : 2000, 10000), signal)
  }
  if (res.status === 429) throw new Error('The server is busy. Wait a moment and try again.')
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`)
  const type = res.headers.get('content-type') || ''
  if (!type.includes('json')) throw new Error(`Expected JSON from ${url}, got ${type || 'unknown type'}`)
  return res.json()
}

export async function detectMode() {
  const isPublicSite = typeof window !== 'undefined' && /\.pages\.dev$|nisarpro|nisar-pro/.test(window.location.hostname) && !import.meta.env?.VITE_GATEWAY_URL
  if (!isPublicSite) {
    try {
      const ctrl = new AbortController()
      const t = setTimeout(() => ctrl.abort(), 2500)
      const body = await getJson(`${gatewayBase()}/jobs/health-ping`, ctrl.signal)
      clearTimeout(t)
      if (body?.status === 'ok') return 'local'
    } catch { /* fall through to demo */ }
  }
  try {
    await getJson('/demo/runs.json')
    return 'demo'
  } catch {
    return 'offline'
  }
}

export async function fetchRuns(mode, signal) {
  const list = mode === 'demo' ? await getJson('/demo/runs.json', signal) : await getJson(`${gatewayBase()}/jobs`, signal)
  return Array.isArray(list) ? list : []
}

export async function fetchJson(path, mode, signal) {
  return getJson(gatewayUrl(path, mode), signal)
}

/** What this gateway allows (public demo, admin, queue). Older gateways: full access. */
export async function fetchConfig() {
  try {
    return await getJson(`${gatewayBase()}/config`)
  } catch {
    return { public_mode: false, admin: true, queue: 'local' }
  }
}

export async function postRun(body) {
  const res = await fetch(`${gatewayBase()}/jobs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.job_id) throw new Error(data.error || `Gateway refused the run (${res.status})`)
  return data
}

export async function cancelRun(id) {
  const res = await fetch(`${gatewayBase()}/jobs/${encodeURIComponent(id)}/cancel`, { method: 'POST' })
  if (!res.ok) throw new Error('Could not cancel the run')
}

export async function deleteRun(id) {
  const res = await fetch(`${gatewayBase()}/jobs/${encodeURIComponent(id)}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Could not delete the run')
}

export function openLogStream(id) {
  return new EventSource(`${gatewayBase()}/jobs/${encodeURIComponent(id)}/logs`)
}

/** Status from the gateway: "queued" | "running" | "completed" | { failed: "msg" } */
export function runStatus(run) {
  const s = run?.status
  if (s && typeof s === 'object' && 'failed' in s) return { kind: 'failed', message: s.failed }
  return { kind: s || 'unknown', message: null }
}
