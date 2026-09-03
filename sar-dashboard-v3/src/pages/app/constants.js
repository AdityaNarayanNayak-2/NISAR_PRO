// ── Fonts ──
export const MONO = '"JetBrains Mono", "Geist Mono", monospace';
export const SANS = '"Inter", "Geist", system-ui, sans-serif';

// ── Colors ──
export const C = {
  bg0: '#0A0A0A', bg1: '#111111', bg2: '#1A1A1A', bg3: '#2A2A2A', bg4: '#404040',
  text: '#F0F0F0', textMid: '#888888', textDim: '#767676',
  accent: { sar: '#9B8EC4', infra: '#C8A96E', maritime: '#4A8FA8', flood: '#0F969C', insar: '#3A9AB8' },
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

// ── Flood Specific Design Tokens ──
export const TM = {
  bg: '#050505',
  bgElev: '#080808',
  bgPanel: 'rgba(12, 16, 21, 0.75)',
  bgCard: 'rgba(255, 255, 255, 0.015)',
  line: 'rgba(255, 255, 255, 0.06)',
  lineStrong: 'rgba(255, 255, 255, 0.12)',
  lineBright: 'rgba(255, 255, 255, 0.25)',
  text: '#C1E8FF',
  textDim: '#7DA0CA',
  textMute: '#5483B3',
  cyan: '#0F969C',
  cyanDim: 'rgba(15, 150, 156, 0.14)',
  cyanBorder: 'rgba(15, 150, 156, 0.35)',
  cyanDeep: '#0C7075',
  amber: '#C4A35A',
  ok: '#0F969C',
  highConf: '#6DA5C0',
  permWater: '#5483B3',
  critical: '#BD6C73',
  top: 40,
  side: 196,
  panel: 340,
  bottom: 36,
};