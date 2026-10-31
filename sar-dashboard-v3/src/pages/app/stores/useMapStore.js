import { create } from 'zustand';

// Ensure old cached results in localStorage are purged so opening Flood never auto-loads previous runs
try {
    if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem('nisarpro_active_flood_result');
    }
} catch (e) {
    // Ignore storage quota/permission errors
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

    viewingResult: null,
    setViewingResult: (result) => set((state) => ({
        viewingResult: typeof result === 'function' ? result(state.viewingResult) : result
    })),

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
