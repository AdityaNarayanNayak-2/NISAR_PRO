import { create } from 'zustand';

const STORAGE_KEY_SAVED_JOBS = 'nisarpro_saved_jobs';

function loadPersistedJobs() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY_SAVED_JOBS);
        if (raw) {
            return JSON.parse(raw);
        }
    } catch (e) {
        console.warn('Failed to load persisted jobs:', e);
    }
    return {};
}

function savePersistedJobs(jobs) {
    try {
        if (!jobs || typeof jobs !== 'object') return;
        const toSave = {};
        for (const [id, job] of Object.entries(jobs)) {
            if (job && job.status === 'completed') {
                toSave[id] = {
                    ...job,
                    floodGeoJson: null
                };
            }
        }
        localStorage.setItem(STORAGE_KEY_SAVED_JOBS, JSON.stringify(toSave));
    } catch (e) {
        console.warn('Failed to save persisted jobs:', e);
    }
}

export const useJobStore = create((set) => ({
    jobs: loadPersistedJobs(),
    setJobs: (jobsOrFn) => set((state) => {
        const next = typeof jobsOrFn === 'function' ? jobsOrFn(state.jobs) : jobsOrFn;
        savePersistedJobs(next);
        return { jobs: next };
    }),

    activeJobId: null,
    setActiveJobId: (id) => set({ activeJobId: id }),

    logs: {},
    setLogs: (logsOrFn) => set((state) => ({
        logs: typeof logsOrFn === 'function' ? logsOrFn(state.logs) : logsOrFn
    })),

    appendLog: (jobId, line) => set((state) => ({
        logs: {
            ...state.logs,
            [jobId]: [...(state.logs[jobId] || []), line]
        }
    })),

    terminalOpen: false,
    setTerminalOpen: (openOrFn) => set((state) => ({
        terminalOpen: typeof openOrFn === 'function' ? openOrFn(state.terminalOpen) : openOrFn
    })),

    elapsed: {},
    setElapsed: (elapsedOrFn) => set((state) => ({
        elapsed: typeof elapsedOrFn === 'function' ? elapsedOrFn(state.elapsed) : elapsedOrFn
    })),

    activeJobStage: null,
    setActiveJobStage: (stage) => set({ activeJobStage: stage }),
}));
