import { C } from './constants';

// ── Parse NISAR Filename ──
export function parseNisarFilename(filepath) {
    if (!filepath || typeof filepath !== 'string') return null;
    const fname = filepath.split('/').pop();
    const parts = fname.split('_');
    if (parts.length < 10 || !parts[0].startsWith('NISAR')) return null;
    const levelCode = parts[1]; const mode = parts[2]; const product = parts[3]; const direction = parts[6];
    const dateStr = parts.find(p => /^\d{8}T\d{6}$/.test(p));
    const productNames = { RSLC: 'Range-compressed SLC', GSLC: 'Geocoded SLC', GCOV: 'Geocoded Covariance', GUNW: 'Unwrapped Interferogram' };
    const levelNames = { L1: 'Level-1', L2: 'Level-2', L0: 'Level-0', S1: 'Level-1 (S-Band)', S2: 'Level-2 (S-Band)' };
    let acqDate = null;
    if (dateStr) { acqDate = `${dateStr.slice(0,4)}-${dateStr.slice(4,6)}-${dateStr.slice(6,8)}`; }
    
    const isSBand = levelCode.startsWith('S') || fname.includes('SSAR') || fname.includes('_S_');
    const band = isSBand 
        ? 'S-Band (3.20 GHz / 9.3 cm - ISRO)' 
        : (mode === 'PR' ? 'L-Band (1.24 GHz - NASA)' : 'L-Band (1.24 GHz)');
    const sensor = isSBand ? 'NISAR SSAR (ISRO)' : 'NISAR LSAR (NASA)';

    return {
        mission: isSBand ? 'NISAR (ISRO S-Band)' : 'NISAR (NASA/ISRO)', 
        level: levelNames[levelCode] || levelCode, 
        product,
        productFull: productNames[product] || product, 
        mode: mode === 'PR' ? 'L-Band + S-Band' : mode,
        band, 
        sensor,
        direction: direction === 'D' ? 'Descending' : direction === 'A' ? 'Ascending' : direction,
        acquisitionDate: acqDate, 
        filename: fname,
    };
}

// ── Severity color helper ──
export function sevColor(sev) {
    if (sev === 'Critical') return C.critical;
    if (sev === 'Alert') return C.alert;
    if (sev === 'Caution') return C.caution;
    return C.stable;
}

export function dispColor(mm) {
    const v = Math.abs(mm);
    if (v >= 20) return C.critical;
    if (v >= 10) return C.alert;
    if (v >= 5) return C.caution;
    return C.stable;
}

export const formatBytes = (bytes) => {
    const b = parseInt(bytes, 10);
    if (isNaN(b) || b === 0) return '0 B';
    const k = 1024, sizes = ['B','KB','MB','GB','TB'];
    const i = Math.floor(Math.log(b) / Math.log(k));
    return parseFloat((b / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const formatElapsed = (secs) => {
    if (!secs) return '0s';
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
};

// The gateway serializes JobStatus::Failed as an object {"failed":"message"}.
// Normalize any inbound status (object or string) to a stable string value.
export function normalizeJobStatus(status) {
    if (status && typeof status === 'object') {
        if ('failed' in status) return 'failed';
        if ('cancelled' in status) return 'failed';
        return 'unknown';
    }
    const norm = String(status ?? '').toLowerCase();
    if (norm === 'failed' || norm === 'cancelled') return 'failed';
    if (norm === 'queued' || norm === 'running' || norm === 'completed') return norm;
    return norm || 'unknown';
}

// Extract a human-readable error message from a job status value, if present.
export function jobErrorMessage(status) {
    if (status && typeof status === 'object') {
        if (typeof status.failed === 'string') return status.failed;
        if (typeof status.cancelled === 'string') return status.cancelled;
        if (typeof status.error === 'string') return status.error;
    }
    return null;
}

// Validate Leaflet-compatible LatLngBounds [[south, west], [north, east]]
export function isValidLatLngBounds(b) {
    if (!b || !Array.isArray(b) || b.length !== 2) return false;
    const [sw, ne] = b;
    if (!Array.isArray(sw) || !Array.isArray(ne) || sw.length < 2 || ne.length < 2) return false;
    return Number.isFinite(sw[0]) && Number.isFinite(sw[1]) && Number.isFinite(ne[0]) && Number.isFinite(ne[1]);
}

// Safely extract valid [[south, west], [north, east]] bounds from job/result objects with intelligent fallbacks
export function extractBoundsFromResult(res) {
    if (!res) return null;
    if (isValidLatLngBounds(res.bounds)) return res.bounds;
    
    // Check bbox object { south, west, north, east }
    const bb = res.bbox || res.floodReport?.georef_bbox || res.floodReport?.crop?.bbox || res.floodReport?.product?.bbox;
    if (bb && Number.isFinite(bb.south) && Number.isFinite(bb.west) && Number.isFinite(bb.north) && Number.isFinite(bb.east)) {
        return [[bb.south, bb.west], [bb.north, bb.east]];
    }

    // Default Bihar Ganga target scene bounds if result is for Bihar flood
    if (res.pipeline === 'flood' || (res.id && String(res.id).includes('bihar'))) {
        return [[25.4098, 86.3946], [25.5902, 86.6054]];
    }

    return null;
}

