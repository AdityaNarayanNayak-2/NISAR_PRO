import { create } from 'zustand'

export const DEFAULT_LAYERS = { 1: true, 2: true, 3: true, 4: true, 5: true, radar: true }

export const useMapStore = create((set) => ({
  phase: 'detected', // baseline | active | detected
  basemap: 'satellite', // satellite | plain
  labels: true, // place names and boundaries on the basemap
  playing: false,
  layers: { ...DEFAULT_LAYERS },
  opacity: 0.85,
  selectedRegionId: null,
  hoverClass: null,
  cursor: null,
  viewBounds: null, // {west, south, east, north} of the visible map, updated on moveend
  aoi: null, // box drawn by the user for "In this area"
  // Map picking for the Process panel and the Brief: null | 'centre' | 'box' | 'aoi'
  picking: null,
  picked: null, // last result: {kind: "centre", lat, lon} | {kind: "box", bbox}
  preview: null, // GeoJSON geometry outlined on the map (crop box, catalog footprint)
  facilities: null, // Impact tab: OpenStreetMap facilities near the flood extent, drawn as dots
  setPhase: (phase) => set({ phase }),
  setBasemap: (basemap) => set({ basemap }),
  toggleLabels: () => set((s) => ({ labels: !s.labels })),
  setPlaying: (playing) => set({ playing }),
  setLayers: (patch) => set((s) => ({ layers: { ...s.layers, ...patch } })),
  toggleLayer: (key) => set((s) => ({ layers: { ...s.layers, [key]: !s.layers[key] } })),
  setOpacity: (opacity) => set({ opacity }),
  selectRegion: (selectedRegionId) => set({ selectedRegionId }),
  setHoverClass: (hoverClass) => set({ hoverClass }),
  setCursor: (cursor) => set({ cursor }),
  setViewBounds: (viewBounds) => set({ viewBounds }),
  setAoi: (aoi) => set({ aoi }),
  setPreview: (preview) => set({ preview }),
  setFacilities: (facilities) => set({ facilities }),
  startPicking: (picking) => set({ picking }),
  finishPicking: (picked) => set((s) => (s.picking === 'aoi' ? { picking: null, aoi: picked.bbox } : { picking: null, picked })),
  resetForRun: () => set({ phase: 'detected', playing: false, selectedRegionId: null, hoverClass: null, aoi: null }),
}))
