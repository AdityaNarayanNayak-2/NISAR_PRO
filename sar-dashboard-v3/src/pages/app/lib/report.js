// Turns a processor report (<id>_flood.json) into the shape the UI uses.
// No invented values: anything missing stays null and is shown as "—".

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null)

/** Class codes written by the processor and the colours the dashboard paints them in.
 *  These display colours are independent of the PNG key colours below. */
export const CLASSES = [
  { code: 2, key: 'new_inundation_high', label: 'Flood, high confidence', legend: 'Flood · high', color: '#3d8df0' },
  { code: 3, key: 'new_inundation_medium', label: 'Flood, medium confidence', legend: 'Flood · medium', color: '#82b8f4' },
  { code: 4, key: 'new_inundation_low', label: 'Flood, low confidence', legend: 'Flood · low', color: '#c2dbf7' },
  { code: 1, key: 'permanent_water', label: 'Stable water', color: '#2f5aa6' },
  { code: 5, key: 'receded_water', label: 'Water loss', color: '#d4892f' },
  { code: 0, key: 'stable_non_water', label: 'Land', color: '#64748b' },
]

/** Exact RGB the engine writes for each class in <id>_flood.png (io.rs save_flood_map_png).
 *  Used only to read the class back from a pixel; the map is painted with CLASSES colours. */
export const FLOOD_PNG_COLORS = {
  1: [0, 229, 255],
  2: [216, 27, 96],
  3: [255, 138, 61],
  4: [255, 224, 184],
  5: [139, 108, 255],
}

export function granuleDate(name) {
  const m = /_(\d{4})(\d{2})(\d{2})T\d{6}/.exec(name || '')
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null
}

/** Track / frame from a NISAR GCOV name: ..._GCOV_<cycle>_<track>_<dir>_<frame>_... */
export function granuleTrackFrame(name) {
  const m = /_GCOV_(\d{3})_(\d{3})_([AD])_(\d{3})_/.exec(name || '')
  return m ? { cycle: Number(m[1]), track: Number(m[2]), direction: m[3] === 'A' ? 'Ascending' : 'Descending', frame: Number(m[4]) } : null
}

export function parseReport(json) {
  if (!json || typeof json !== 'object') return null
  const areas = json.areas || {}
  const product = json.product || {}
  const method = json.method || {}
  const area = (key) => ({ km2: num(areas[`${key}_km2`]), acres: num(areas[`${key}_acres`]) })

  const classes = CLASSES.map((c) => ({ ...c, ...area(c.key) }))
  // Percentages are of the area with data on both dates, not the whole footprint.
  const classSumKm2 = classes.reduce((s, c) => s + (c.km2 ?? 0), 0)
  const valid = area('valid_area')
  const validKm2 = valid.km2 ?? (classSumKm2 > 0 ? classSumKm2 : null)

  return {
    band: product.frequency || null,
    instrument: product.instrument || null,
    frequencyGHz: num(product.center_frequency_hz) != null ? product.center_frequency_hz / 1e9 : null,
    polarization: product.polarization || null,
    crs: product.crs || null,
    pixelSpacingM: num(product.pixel_spacing_x_m) != null ? Math.abs(product.pixel_spacing_x_m) : null,
    activeId: product.active_id || null,
    baselineId: product.baseline_id || null,
    activeDate: granuleDate(product.active_id),
    baselineDate: granuleDate(product.baseline_id),
    trackFrame: granuleTrackFrame(product.active_id),
    cropPreset: json.crop?.preset || null,
    newWater: area('total_flood'),
    classes,
    valid: { km2: validKm2, acres: valid.acres ?? (validKm2 != null ? validKm2 / 0.004046856 : null) },
    footprint: area('total_area'),
    regions: num(json.flood_regions),
    radarBand: product.radar_band || null,
    wavelengthM: num(product.wavelength_m),
    grid: num(json.replay?.rows) != null ? { rows: json.replay.rows, cols: json.replay.columns } : null,
    validPixels: num(areas.valid_pixels),
    cropCenter: num(json.crop?.center_lat) != null ? { lat: json.crop.center_lat, lon: json.crop.center_lon } : null,
    method: {
      // threshold_db = Otsu capped at the minimum change. The seed actually used is min(seed, this).
      effectiveOtsuDb: num(method.threshold_db),
      rawOtsuDb: num(method.raw_otsu_db),
      detector: method.detector || null,
      thresholdMethod: method.threshold_method || null,
      regionGrowing: typeof method.region_growing === 'boolean' ? method.region_growing : null,
      coherenceUsed: typeof method.coherence_used === 'boolean' ? method.coherence_used : null,
      seedDb: num(method.seed_threshold_db),
      growthDb: num(method.growth_threshold_db),
      otsuDb: num(method.raw_otsu_db ?? method.threshold_db),
      minChangeDb: num(method.min_change_db),
      permanentWaterDb: num(method.permanent_water_thresh_db),
      edgeErosionPx: num(method.swath_edge_erosion_px),
      minAreaPx: num(method.min_area_pixels),
      speckle: method.speckle_filter || null,
      morphology: method.morphology || null,
    },
    bbox: json.georef_bbox || null,
    overlayCrs: json.overlay_crs || null,
    warnings: Array.isArray(json.warnings) ? json.warnings : [],
    reasons: Array.isArray(json.confidence_reasons) ? json.confidence_reasons : [],
  }
}

/** Display colour of a class as [r, g, b]. */
export function classRgb(code) {
  const hex = CLASSES.find((c) => c.code === Number(code))?.color
  if (!hex) return null
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
}
