// Runs, the open run, its report and regions, and live logs of running jobs.
// The gateway (or the demo manifest) is the only source; nothing is cached in localStorage.
import { create } from 'zustand'
import { gatewayBase, detectMode, fetchRuns, fetchJson, postRun, cancelRun, deleteRun, openLogStream, runStatus } from '../lib/gateway'
import { parseReport } from '../lib/report'

const streams = new Map() // runId -> EventSource
const inflight = new Map() // key -> AbortController

const STAGES = [
  { key: 'LOADING_ACTIVE', label: 'Read active scene' },
  { key: 'LOADING_BASELINE', label: 'Read baseline scene' },
  { key: 'DETECTING', label: 'Detect change' },
  { key: 'GENERATING_OUTPUTS', label: 'Write outputs' },
  { key: 'COMPLETE', label: 'Done' },
]
export { STAGES }
// Tabs in the nav pill. Run tabs show an empty state until a run is open.
export const VIEWS = ['map', 'timeseries', 'regions', 'reports', 'processing', 'evaluation']
export const RUN_VIEWS = ['timeseries', 'regions', 'reports', 'evaluation']

function stageFromLine(line) {
  if (!line.includes('"event":"progress"')) return null
  try {
    const ev = JSON.parse(line)
    const key = String(ev.stage || '').toUpperCase()
    const msg = String(ev.message || '')
    if (key === 'COMPLETE') return 'COMPLETE'
    if (key === 'GENERATING_OUTPUTS') return 'GENERATING_OUTPUTS'
    if (msg.includes('[1/5]')) return 'LOADING_ACTIVE'
    if (msg.includes('[2/5]')) return 'LOADING_BASELINE'
    if (msg.includes('[5/5]')) return 'DETECTING'
  } catch { /* not JSON */ }
  return null
}

function abortable(key) {
  inflight.get(key)?.abort()
  const ctrl = new AbortController()
  inflight.set(key, ctrl)
  return ctrl
}

export const useRunStore = create((set, get) => ({
  mode: 'connecting', // connecting | local | demo | offline
  runs: [],
  loaded: false,
  openId: null,
  compareId: null,
  // Tab picked in the nav pill; decides what the right panel shows.
  view: 'map', // map | timeseries | regions | reports | processing | evaluation
  logOpen: false,
  reports: {}, // id -> { status: 'loading'|'ok'|'error', data, error }
  regions: {}, // id -> { status, data }
  logs: {}, // id -> string[]
  stages: {}, // id -> { stage, startedAt }
  toasts: [],
  scenes: null, // GCOV files found on this computer (local mode), null until loaded

  toast(text, kind = 'info', action = null) {
    const id = Math.random().toString(36).slice(2)
    set((s) => ({ toasts: [...s.toasts.slice(-2), { id, text, kind, action }] }))
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 6000)
  },
  dismissToast(id) {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
  },

  async init() {
    const mode = await detectMode()
    set({ mode })
    await get().refresh()
    // Open a run only when the link names one (?run=<id>). Otherwise start on the workspace home.
    const wanted = new URLSearchParams(window.location.search).get('run')
    const { runs } = get()
    const target = runs.find((r) => r.id === wanted)
    if (target) get().open(target.id)
    else if (wanted) get().close()
    if (mode === 'local') get().loadScenes()
    // Follow runs that were already going when the page loaded.
    if (mode === 'local') runs.filter((r) => ['queued', 'running'].includes(runStatus(r).kind)).forEach((r) => get().follow(r.id))
  },

  async loadScenes() {
    try {
      const r = await fetch(`${gatewayBase()}/scenes`)
      const list = r.ok ? await r.json() : []
      set({ scenes: Array.isArray(list) ? list : [] })
    } catch {
      set({ scenes: [] })
    }
  },

  async refresh() {
    const { mode } = get()
    if (mode === 'offline' || mode === 'connecting') return set({ loaded: true })
    try {
      const runs = await fetchRuns(mode, abortable('runs').signal)
      set({ runs, loaded: true })
    } catch (e) {
      if (e.name === 'AbortError') return
      set({ loaded: true })
      if (mode === 'local') set({ mode: 'offline' })
    }
  },

  async retry() {
    set({ mode: 'connecting' })
    await get().init()
  },

  open(id) {
    set((s) => ({ openId: id, view: RUN_VIEWS.includes(s.view) ? s.view : 'map' }))
    const url = new URL(window.location.href)
    url.searchParams.set('run', id)
    window.history.replaceState(null, '', url)
    get().loadReport(id)
  },

  /** Back to the workspace home: no run open, nothing drawn on the map. */
  close() {
    set((s) => ({ openId: null, view: s.view === 'processing' ? 'processing' : 'map' }))
    const url = new URL(window.location.href)
    url.searchParams.delete('run')
    window.history.replaceState(null, '', url)
  },

  showForm() {
    set({ view: 'processing' })
  },

  setView(view) {
    if (!VIEWS.includes(view)) return
    set({ view })
  },

  toggleLog(v) {
    set((s) => ({ logOpen: typeof v === 'boolean' ? v : !s.logOpen }))
  },

  async loadReport(id) {
    const run = get().runs.find((r) => r.id === id)
    if (!run || get().reports[id]?.status === 'ok') return
    const path = run.artifacts?.report
    if (!path) {
      set((s) => ({ reports: { ...s.reports, [id]: { status: runStatus(run).kind === 'completed' ? 'error' : 'pending', error: 'This run has no readable report.' } } }))
      return
    }
    set((s) => ({ reports: { ...s.reports, [id]: { status: 'loading' } } }))
    try {
      const json = await fetchJson(path, get().mode, abortable(`report:${id}`).signal)
      const data = parseReport(json)
      set((s) => ({ reports: { ...s.reports, [id]: data ? { status: 'ok', data } : { status: 'error', error: 'This run has no readable report.' } } }))
    } catch (e) {
      if (e.name === 'AbortError') return
      set((s) => ({ reports: { ...s.reports, [id]: { status: 'error', error: e.message } } }))
    }
  },

  async loadRegions(id) {
    const run = get().runs.find((r) => r.id === id)
    const path = run?.artifacts?.geojson
    if (!path || get().regions[id]) return
    set((s) => ({ regions: { ...s.regions, [id]: { status: 'loading' } } }))
    try {
      const data = await fetchJson(path, get().mode, abortable(`regions:${id}`).signal)
      set((s) => ({ regions: { ...s.regions, [id]: { status: 'ok', data } } }))
    } catch (e) {
      if (e.name === 'AbortError') return
      set((s) => ({ regions: { ...s.regions, [id]: { status: 'error', error: e.message } } }))
    }
  },

  async startRun(body, { force = false } = {}) {
    const res = await postRun({ ...body, force })
    await get().refresh()
    if (res.reused) {
      get().open(res.job_id)
      get().toast('Same inputs as an earlier run. Opened it.', 'info', { label: 'Run again', run: () => get().startRun(body, { force: true }) })
      return res.job_id
    }
    set({ openId: res.job_id, view: 'map' })
    get().follow(res.job_id)
    return res.job_id
  },

  follow(id) {
    if (streams.has(id)) return
    const es = openLogStream(id)
    streams.set(id, es)
    set((s) => ({ logs: { ...s.logs, [id]: [] }, stages: { ...s.stages, [id]: { stage: null, startedAt: Date.now() } } }))
    es.onmessage = (ev) => {
      const line = ev.data
      const stage = stageFromLine(line)
      set((s) => ({
        logs: { ...s.logs, [id]: [...(s.logs[id] || []), line].slice(-4000) },
        stages: stage ? { ...s.stages, [id]: { ...s.stages[id], stage } } : s.stages,
      }))
      if (line.startsWith('[SYSTEM] PROCESS_COMPLETED') || line.startsWith('[SYSTEM] PROCESS_FAILED')) {
        es.close()
        streams.delete(id)
        const ok = line.includes('COMPLETED')
        const wasActive = ['running', 'queued'].includes(runStatus(get().runs.find((r) => r.id === id)).kind)
        get().refresh().then(() => {
          if (get().openId === id) {
            set((s) => ({ reports: { ...s.reports, [id]: undefined } }))
            get().loadReport(id)
          }
        })
        if (wasActive) get().toast(ok ? 'Run finished.' : 'Run failed. Open the log for details.', ok ? 'ok' : 'error')
      }
    }
    // A finished run only replays its saved log; close the stream once that has arrived.
    if (!['running', 'queued'].includes(runStatus(get().runs.find((r) => r.id === id)).kind)) {
      setTimeout(() => { es.close(); streams.delete(id) }, 2000)
    }
    es.onerror = () => {
      // Let EventSource reconnect on its own; stop only when the server closed it for good.
      if (es.readyState === EventSource.CLOSED) {
        streams.delete(id)
        get().refresh()
      }
    }
  },

  stopFollowingAll() {
    streams.forEach((es) => es.close())
    streams.clear()
  },

  async cancel(id) {
    try {
      await cancelRun(id)
    } catch (e) {
      get().toast(e.message, 'error')
    }
  },

  async remove(id) {
    try {
      await deleteRun(id)
      set((s) => ({ openId: s.openId === id ? null : s.openId }))
      await get().refresh()
    } catch (e) {
      get().toast(e.message, 'error')
    }
  },
}))
