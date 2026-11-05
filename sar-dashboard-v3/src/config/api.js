// Centralized API configuration
// Reads gateway URL from localStorage (set by ConnectionSetup) or falls back to localhost

const STORAGE_KEY = 'nisarpro_gateway_url';
export const DEFAULT_URL = 'http://localhost:3000';
export const PUBLIC_FALLBACK_URL = 'https://engaged-mystery-trucks-crawford.trycloudflare.com';

export function getGatewayUrl() {
    const custom = localStorage.getItem(STORAGE_KEY);
    if (custom) return custom;

    // Check build-time or runtime environment variable
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_GATEWAY_URL) {
        return import.meta.env.VITE_GATEWAY_URL.replace(/\/+$/, '');
    }

    if (typeof window !== 'undefined' && window.location) {
        // Local Vite dev server -> connect to local gateway on port 3000
        if (window.location.port === '5173') {
            return `http://${window.location.hostname}:3000`;
        }
        // If served from the gateway directly (e.g. localhost:3000 or the Cloudflare tunnel)
        if (window.location.hostname !== 'localhost' && !window.location.hostname.endsWith('.pages.dev')) {
            return window.location.origin;
        }
        // If hosted on Cloudflare Pages (*.pages.dev) without local backend, fallback to the live Cloudflare Tunnel
        if (window.location.hostname.endsWith('.pages.dev')) {
            return PUBLIC_FALLBACK_URL;
        }
    }
    return DEFAULT_URL;
}

export function setGatewayUrl(url) {
    if (!url) {
        localStorage.removeItem(STORAGE_KEY);
        return;
    }
    // Strip trailing slash
    const clean = url.trim().replace(/\/+$/, '');
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
