import { create } from 'zustand';

const STORAGE_KEY_VIEWING_RESULT = 'nisarpro_active_flood_result';

function loadPersistedViewingResult() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY_VIEWING_RESULT);
        if (raw) {
            return JSON.parse(raw);
        }
    } catch (e) {
        console.warn('Failed to load persisted viewingResult:', e);
    }
    return null;
}

function savePersistedViewingResult(result) {
    try {
        if (!result) {
            localStorage.removeItem(STORAGE_KEY_VIEWING_RESULT);
            return;
        }
        // Save essentials, stripping heavy inline floodGeoJson to prevent localStorage quota issues
        const toSave = {
            ...result,
            floodGeoJson: null
        };
        localStorage.setItem(STORAGE_KEY_VIEWING_RESULT, JSON.stringify(toSave));
    } catch (e) {
        console.warn('Failed to save persisted viewingResult:', e);
    }
}

export const useMapStore = create((set) => ({
    mouseCoords: { lat: '0.0000', lon: '0.0000' },
    setMouseCoords: (coords) => set((state) => ({
        mouseCoords: typeof coords === 'function' ? coords(state.mouseCoords) : coords
    })),

    mapBounds: null,
    setMapBounds: (bounds) => set((state) => ({
        mapBounds: typeof bounds === 'function' ? bounds(state.mapBounds) : bounds
    })),

    flyToCenter: null,
    setFlyToCenter: (center) => set((state) => ({
        flyToCenter: typeof center === 'function' ? center(state.flyToCenter) : center
    })),

    drawnAoi: null,
    setDrawnAoi: (aoi) => set((state) => ({
        drawnAoi: typeof aoi === 'function' ? aoi(state.drawnAoi) : aoi
    })),

    isDrawingAoi: false,
    setIsDrawingAoi: (isDrawing) => set((state) => ({
        isDrawingAoi: typeof isDrawing === 'function' ? isDrawing(state.isDrawingAoi) : isDrawing
    })),

    viewingResult: loadPersistedViewingResult(),
    setViewingResult: (result) => set((state) => {
        const next = typeof result === 'function' ? result(state.viewingResult) : result;
        savePersistedViewingResult(next);
        return { viewingResult: next };
    }),

    selectedRegion: null,
    setSelectedRegion: (region) => set((state) => ({
        selectedRegion: typeof region === 'function' ? region(state.selectedRegion) : region
    })),

    // ── Layer Controls ──
    layerOpacity: 0.8,
    setLayerOpacity: (val) => set({ layerOpacity: typeof val === 'function' ? val : Number(val) }),

    // Flood artifact visibility is separate from classification styling. The
    // PNG is the browser preview; the GeoTIFF remains the authoritative
    // downloadable raster because browsers do not decode GeoTIFF natively.
    showFloodPng: true,
    setShowFloodPng: (val) => set((state) => ({
        showFloodPng: typeof val === 'function' ? val(state.showFloodPng) : val
    })),

    showFloodGeoJson: true,
    setShowFloodGeoJson: (val) => set((state) => ({
        showFloodGeoJson: typeof val === 'function' ? val(state.showFloodGeoJson) : val
    })),

    showPermanentWater: true,
    setShowPermanentWater: (val) => set((state) => ({
        showPermanentWater: typeof val === 'function' ? val(state.showPermanentWater) : val
    })),

    showHighConf: true,
    setShowHighConf: (val) => set((state) => ({
        showHighConf: typeof val === 'function' ? val(state.showHighConf) : val
    })),

    showMedConf: true,
    setShowMedConf: (val) => set((state) => ({
        showMedConf: typeof val === 'function' ? val(state.showMedConf) : val
    })),

    showLowConf: true,
    setShowLowConf: (val) => set((state) => ({
        showLowConf: typeof val === 'function' ? val(state.showLowConf) : val
    })),
}));
