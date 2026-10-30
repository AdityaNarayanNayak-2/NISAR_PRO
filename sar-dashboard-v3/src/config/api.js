// Centralized API configuration
// Reads gateway URL from localStorage (set by ConnectionSetup) or falls back to localhost

const STORAGE_KEY = 'nisarpro_gateway_url';
const DEFAULT_URL = 'http://localhost:3000';

export function getGatewayUrl() {
    const custom = localStorage.getItem(STORAGE_KEY);
    if (custom) return custom;
    if (typeof window !== 'undefined' && window.location) {
        if (window.location.port === '5173') {
            return `http://${window.location.hostname}:3000`;
        }
        if (window.location.origin && window.location.origin !== 'null') {
            return window.location.origin;
        }
    }
    return DEFAULT_URL;
}

export function setGatewayUrl(url) {
    // Strip trailing slash
    const clean = url.replace(/\/+$/, '');
    localStorage.setItem(STORAGE_KEY, clean);
}

export function isGatewayConfigured() {
    return !!localStorage.getItem(STORAGE_KEY);
}

// Helper to build full API URL
// Collapses duplicate slashes so callers can safely pass paths that already start with '/'
export function api(path) {
    if (!path) return '';
    if (typeof path === 'string' && (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('blob:') || path.startsWith('data:'))) {
        return path;
    }
    const base = getGatewayUrl();
    const cleanPath = path.replace(/\/{2,}/g, '/');
    return `${base}${cleanPath.startsWith('/') ? cleanPath : '/' + cleanPath}`;
}
