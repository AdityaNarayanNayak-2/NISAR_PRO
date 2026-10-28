// Helper to parse dates from NISAR HDF5 filenames
// Filename format example: NISAR_L2_PR_GCOV_026_055_A_011_4005_DHDH_A_20260724T000130_20260724T000204_P05023_N_F_J_001.h5
export function parseNisarDate(filename) {
    if (!filename) return 'N/A';
    // Look for YYYYMMDD string (typically followed by T and 6 digits)
    const match = filename.match(/_(\d{8})T/);
    if (match && match[1]) {
        const year = match[1].slice(0, 4);
        const monthIndex = parseInt(match[1].slice(4, 6)) - 1;
        const day = parseInt(match[1].slice(6, 8));
        
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        if (monthIndex >= 0 && monthIndex < 12) {
            return `${day} ${months[monthIndex]} ${year}`;
        }
    }
    // Fallback if regex doesn't match standard NISAR structure
    return filename.slice(0, 15) + '...';
}

// Map coordinates to location names
export function getGeoLocation(lat, lon) {
    if (!lat || !lon) return 'Unknown Area';
    const lLat = parseFloat(lat);
    const lLon = parseFloat(lon);
    
    // Check known geographic assets in Koraput / Odisha
    if (Math.abs(lLat - 18.7883) < 0.08 && Math.abs(lLon - 82.6003) < 0.08) {
        return 'Upper Kolab Reservoir, Odisha, India';
    }
    if (Math.abs(lLat - 18.9306) < 0.08 && Math.abs(lLon - 82.3885) < 0.08) {
        return 'Kundra Block, Koraput, Odisha, India';
    }
    if (Math.abs(lLat - 27.2055) < 0.25 && Math.abs(lLon - 94.8948) < 0.25) {
        return 'Brahmaputra Valley (Dibrugarh–Dhemaji Sector), Assam, India';
    }
    if (Math.abs(lLat - 25.5000) < 0.60 && Math.abs(lLon - 86.5000) < 0.60) {
        return 'Ganga Alluvial Plain (Begusarai–Khagaria), Bihar, India';
    }
    return `${lLat.toFixed(4)}° N, ${lLon.toFixed(4)}° E`;
}

// Convert coordinates to EPSG string
export function getEPSGZone(lon) {
    if (!lon) return 'EPSG:32644'; // Default to Zone 44N
    const lLon = parseFloat(lon);
    
    // UTM Zone formula: Zone = floor((lon + 180) / 6) + 1
    const zone = Math.floor((lLon + 180) / 6) + 1;
    // Assuming Northern hemisphere for NISAR India regions
    return `UTM Zone ${zone}N / EPSG:${32600 + zone}`;
}

// Convert a crop preset token (e.g. "20x20km") into a human label ("20 km × 20 km")
export function formatCropPreset(preset) {
    if (!preset) return null;
    if (String(preset).toLowerCase() === 'full') return 'Full Scene (80m Multilook)';
    const match = String(preset).match(/^(\d+)x(\d+)km$/i);
    if (match) return `${match[1]} km × ${match[2]} km`;
    return String(preset);
}

export function parseFloodReport(report) {
    if (!report) return null;

    const areas = report.areas || {};
    const product = report.product || {};
    const method = report.method || {};
    const crop = report.crop || {};

    const activeDate = parseNisarDate(product.active_id);
    const baselineDate = parseNisarDate(product.baseline_id);
    const location = getGeoLocation(crop.center_lat, crop.center_lon);
    const epsg = getEPSGZone(crop.center_lon);
    const cropPresetLabel = formatCropPreset(crop.preset);
    
    const dx = product.pixel_spacing_x_m || 10.0;
    const dy = product.pixel_spacing_y_m || -10.0;
    const gridLabel = `${Math.abs(dx)} m × ${Math.abs(dy)} m`;
    
    const totalAreaAcres = areas.total_area_acres || 0;
    const totalFloodAcres = areas.total_flood_acres || 0;
    const highConfAcres = areas.new_inundation_high_acres || 0;
    const medConfAcres = areas.new_inundation_medium_acres || 0;
    const lowConfAcres = areas.new_inundation_low_acres || 0;
    const permWaterAcres = areas.permanent_water_acres || 0;
    const recededWaterAcres = areas.receded_water_acres || 0;
    const stableNonWaterAcres = areas.stable_non_water_acres || 0;

    const totalAreaKm2 = areas.total_area_km2 || (totalAreaAcres * 0.004046856);
    const totalFloodKm2 = areas.total_flood_km2 || (totalFloodAcres * 0.004046856);
    const highConfKm2 = areas.new_inundation_high_km2 || (highConfAcres * 0.004046856);
    const medConfKm2 = areas.new_inundation_medium_km2 || (medConfAcres * 0.004046856);
    const lowConfKm2 = areas.new_inundation_low_km2 || (lowConfAcres * 0.004046856);
    const permWaterKm2 = areas.permanent_water_km2 || (permWaterAcres * 0.004046856);
    const recededWaterKm2 = areas.receded_water_km2 || (recededWaterAcres * 0.004046856);
    const stableNonWaterKm2 = areas.stable_non_water_km2 || (stableNonWaterAcres * 0.004046856);
    
    const detectedRegionsCount = report.flood_regions || 0;
    
    // Format methodology steps list
    const steps = [
        {
            name: '3×3 Median Filter',
            detail: 'Speckle noise reduction with edge preservation',
            status: 'success'
        },
        {
            name: 'Log-Ratio Detection',
            detail: 'Formula: 10 · log10(active / baseline)',
            status: 'success'
        },
        {
            name: 'Otsu Thresholding',
            detail: `Bimodal split at ${method.threshold_db != null ? method.threshold_db.toFixed(2) : '-3.0'} dB`,
            status: 'success'
        },
        {
            name: 'Dual-Threshold Growth',
            detail: `Seed: ${method.seed_threshold_db || '-5.0'} dB | Growth: ${method.growth_threshold_db || '-2.5'} dB`,
            status: method.region_growing ? 'success' : 'skipped'
        },
        {
            name: 'Morphology & Area Filter',
            detail: method.morphology || 'open_3x3 + close_3x3',
            status: 'success'
        }
    ];

    return {
        activeDate,
        baselineDate,
        location,
        epsg,
        gridLabel,
        cropPreset: crop.preset || null,
        cropPresetLabel,
        dx,
        dy,
        totalAreaAcres,
        totalFloodAcres,
        highConfAcres,
        medConfAcres,
        lowConfAcres,
        permWaterAcres,
        recededWaterAcres,
        stableNonWaterAcres,
        totalAreaKm2,
        totalFloodKm2,
        highConfKm2,
        medConfKm2,
        lowConfKm2,
        permWaterKm2,
        recededWaterKm2,
        stableNonWaterKm2,
        detectedRegionsCount,
        steps,
        warnings: report.warnings || [],
        sensor: product.instrument === 'SSAR' || product.frequency === 'S' || product.radar_band === 'S-band' 
            ? 'NISAR SSAR (ISRO S-band)' 
            : 'NISAR LSAR (NASA L-band)',
        band: product.radar_band || (product.frequency === 'S' ? 'S-band' : 'L-band'),
        wavelengthM: product.wavelength_m || (product.frequency === 'S' ? 0.0937 : 0.2384),
        centerFrequencyHz: product.center_frequency_hz || (product.frequency === 'S' ? 3.2e9 : 1.2575e9),
        polarization: product.polarization || 'HH'
    };
}
