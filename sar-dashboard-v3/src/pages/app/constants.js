// ── Fonts ──
export const MONO = '"IBM Plex Mono", monospace';
export const SANS = '"Outfit", sans-serif';

// ── Colors ──
export const C = {
    bg0: '#0A0A0A', bg1: '#111111', bg2: '#1A1A1A', bg3: '#2A2A2A', bg4: '#404040',
    text: '#F0F0F0', textMid: '#888888', textDim: '#767676',
    accent: { sar: '#9B8EC4', infra: '#C8A96E', maritime: '#4A8FA8', flood: '#2A8B91', insar: '#3A9AB8' },
    stable: '#4CAF50', caution: '#E6A817', alert: '#D4822A', critical: '#C0392B',
    data: '#7EB8D4',
};

// ── Profiles ──
export const PROFILES = {
    infrastructure: { id: 'infrastructure', label: 'INFRASTRUCTURE MONITORING', accent: C.accent.infra },
    flood: { id: 'flood', label: 'FLOOD MONITORING', accent: C.accent.flood },
    sar_science: { id: 'sar_science', label: 'SAR SCIENCE', accent: C.accent.sar },
    insar: { id: 'insar', label: 'INSAR PROCESSING', accent: C.accent.insar },
};

