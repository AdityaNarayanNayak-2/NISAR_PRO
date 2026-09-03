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
    
    const dx = product.pixel_spacing_x_m || 10.0;
    const dy = product.pixel_spacing_y_m || -10.0;
    const gridLabel = `${Math.abs(dx)} m × ${Math.abs(dy)} m`;
    
    const totalAreaAcres = areas.total_area_acres || 0;
    const totalFloodAcres = areas.total_flood_acres || 0;
    const highConfAcres = areas.new_inundation_high_acres || 0;
    const medConfAcres = areas.new_inundation_medium_acres || 0;
    const lowConfAcres = areas.new_inundation_low_acres || 0;
    const permWaterAcres = areas.permanent_water_acres || 0;
    
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
            detail: `Bimodal split at ${method.threshold_db || '-3.0'} dB`,
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
        dx,
        dy,
        totalAreaAcres,
        totalFloodAcres,
        highConfAcres,
        medConfAcres,
        lowConfAcres,
        permWaterAcres,
        detectedRegionsCount,
        steps,
        warnings: report.warnings || [],
        confidenceReasons: report.confidence_reasons || [],
        sensor: 'NISAR L-band',
        polarization: product.polarization || 'HH'
    };
}
