import { C } from './constants';

// ── Parse NISAR Filename ──
export function parseNisarFilename(filepath) {
    if (!filepath) return null;
    const fname = filepath.split('/').pop();
    const parts = fname.split('_');
    if (parts.length < 10 || !parts[0].startsWith('NISAR')) return null;
    const level = parts[1]; const mode = parts[2]; const product = parts[3]; const direction = parts[6];
    const dateStr = parts.find(p => /^\d{8}T\d{6}$/.test(p));
    const productNames = { RSLC: 'Range-compressed SLC', GSLC: 'Geocoded SLC', GCOV: 'Geocoded Covariance', GUNW: 'Unwrapped Interferogram' };
    const levelNames = { L1: 'Level-1', L2: 'Level-2', L0: 'Level-0' };
    let acqDate = null;
    if (dateStr) { acqDate = `${dateStr.slice(0,4)}-${dateStr.slice(4,6)}-${dateStr.slice(6,8)}`; }
    return {
        mission: 'NISAR (NASA/ISRO)', level: levelNames[level] || level, product,
        productFull: productNames[product] || product, mode: mode === 'PR' ? 'L-Band + S-Band' : mode,
        band: 'L-Band (1.26 GHz)', direction: direction === 'D' ? 'Descending' : direction === 'A' ? 'Ascending' : direction,
        acquisitionDate: acqDate, filename: fname,
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
