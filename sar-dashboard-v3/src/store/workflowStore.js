import { create } from 'zustand'

// Workflow state management
export const useWorkflowStore = create((set, get) => ({
    // Current step (1-6)
    currentStep: 1,

    // Step 1: Location
    location: {
        type: null, // 'draw' | 'upload' | 'coordinates'
        coordinates: null, // GeoJSON
        name: ''
    },

    // Step 2: Data Source
    dataSource: {
        mission: null, // 'nisar' | 'sentinel1' | 'iceye' | 'capella'
        dateRange: { start: null, end: null },
        selectedScenes: []
    },

    // Step 3: Configuration  
    config: {
        processType: null, // 'insar' | 'polsar' | 'slc' | 'change'
        preset: 'balanced', // 'quick' | 'balanced' | 'quality'
        advancedOptions: {}
    },

    // Step 4: Job
    currentJob: null,

    // Step 5-6: Results
    results: null,

    // Actions
    setStep: (step) => set({ currentStep: step }),
    nextStep: () => set((state) => ({ currentStep: Math.min(state.currentStep + 1, 6) })),
    prevStep: () => set((state) => ({ currentStep: Math.max(state.currentStep - 1, 1) })),

    setLocation: (location) => set({ location }),
    setDataSource: (dataSource) => set({ dataSource }),
    setConfig: (config) => set({ config }),
    setCurrentJob: (job) => set({ currentJob: job }),
    setResults: (results) => set({ results }),

    // Reset workflow
    reset: () => set({
        currentStep: 1,
        location: { type: null, coordinates: null, name: '' },
        dataSource: { mission: null, dateRange: { start: null, end: null }, selectedScenes: [] },
        config: { processType: null, preset: 'balanced', advancedOptions: {} },
        currentJob: null,
        results: null
    }),

    // Check if step is complete
    isStepComplete: (step) => {
        const state = get()
        switch (step) {
            case 1: return !!state.location.coordinates
            case 2: return state.dataSource.selectedScenes.length > 0
            case 3: return !!state.config.processType
            case 4: return state.currentJob?.status === 'completed'
            case 5: return !!state.results
            default: return false
        }
    }
}))

// Mock jobs for demo
export const mockJobs = [
    {
        id: 'job-001',
        name: 'Mumbai Coastal InSAR',
        status: 'completed',
        progress: 100,
        mission: 'nisar',
        processType: 'insar',
        createdAt: new Date(Date.now() - 3600000),
        completedAt: new Date()
    },
    {
        id: 'job-002',
        name: 'Delhi Urban Change',
        status: 'processing',
        progress: 67,
        mission: 'sentinel1',
        processType: 'change',
        createdAt: new Date(Date.now() - 1800000),
        completedAt: null
    },
    {
        id: 'job-003',
        name: 'Himalayan Glacier Monitor',
        status: 'queued',
        progress: 0,
        mission: 'nisar',
        processType: 'insar',
        createdAt: new Date(),
        completedAt: null
    }
]
