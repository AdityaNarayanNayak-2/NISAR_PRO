import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'

/* ═══════════════════════════════════════════════════════════════
   DATA
   ═══════════════════════════════════════════════════════════════ */

const DOMAINS = [
    {
        title: 'Maritime',
        path: 'FAST PATH',
        pathColor: '#10b981',
        specs: [
            ['SENSOR', 'L-Band (NISAR)'],
            ['RESOLUTION', '25m spatial'],
            ['REVISIT', '12 days'],
            ['PENETRATION', 'All-weather / night'],
            ['OUTPUT', 'CFAR vessel tracks'],
        ],
        description: 'Dark vessel tracking and ocean domain awareness using L-band SAR penetration through cloud cover and sea state.',
    },
    {
        title: 'Structural',
        path: 'FAST PATH',
        pathColor: '#10b981',
        specs: [
            ['SENSOR', 'C-Band (S1) / L-Band'],
            ['RESOLUTION', '<1mm deformation'],
            ['REVISIT', '6–12 days'],
            ['PENETRATION', 'Surface / subsurface'],
            ['OUTPUT', '███████████ [RESTRICTED]'],
        ],
        description: 'Millimeter-level deformation intelligence for dams, bridges, reservoirs, and critical infrastructure assets.',
    },
    {
        title: 'Core InSAR',
        path: 'FULL PATH',
        pathColor: '#3b82f6',
        specs: [
            ['SENSOR', 'C+L Dual-Band'],
            ['RESOLUTION', 'λ/4π phase level'],
            ['REVISIT', '6–12 days'],
            ['PENETRATION', 'Vegetation canopy'],
            ['OUTPUT', 'COG Interferogram'],
        ],
        description: 'Raw phase intelligence from complex interferometry — from SLC ingest to centimeter-accurate displacement maps.',
    },
]

const BLDGS = [
    { x: 8, y: 8, w: 22, h: 16, d: -0.4 },
    { x: 34, y: 8, w: 16, h: 16, d: -0.8 },
    { x: 54, y: 6, w: 26, h: 18, d: -3.8 },
    { x: 84, y: 8, w: 18, h: 16, d: -0.3 },
    { x: 108, y: 10, w: 20, h: 14, d: -0.6 },
    { x: 12, y: 30, w: 20, h: 16, d: -0.5 },
    { x: 36, y: 28, w: 28, h: 20, d: -9.1 },
    { x: 68, y: 30, w: 18, h: 16, d: -2.4 },
    { x: 90, y: 28, w: 22, h: 18, d: -0.4 },
    { x: 116, y: 30, w: 16, h: 14, d: -1.1 },
    { x: 8, y: 54, w: 24, h: 14, d: -0.2 },
    { x: 36, y: 54, w: 18, h: 16, d: -4.6 },
    { x: 58, y: 56, w: 22, h: 12, d: -0.9 },
    { x: 84, y: 54, w: 20, h: 14, d: -0.3 },
    { x: 108, y: 56, w: 24, h: 12, d: -0.7 },
    { x: 14, y: 76, w: 20, h: 14, d: -0.5 },
    { x: 38, y: 76, w: 24, h: 14, d: -0.3 },
    { x: 66, y: 78, w: 18, h: 12, d: -1.8 },
    { x: 88, y: 76, w: 22, h: 14, d: -0.4 },
    { x: 114, y: 78, w: 18, h: 12, d: -0.6 },
]

const bFill = (d) => d <= -5 ? 'rgba(239,68,68,0.2)' : d <= -2 ? 'rgba(245,158,11,0.15)' : 'rgba(16,185,129,0.08)'
const bStroke = (d) => d <= -5 ? 'rgba(239,68,68,0.45)' : d <= -2 ? 'rgba(245,158,11,0.3)' : 'rgba(16,185,129,0.15)'
const bTextColor = (d) => d <= -5 ? '#ef4444' : d <= -2 ? '#f59e0b' : null

/* ═══════════════════════════════════════════════════════════════
   STATIC MICRO-VISUALIZATIONS  (zero animation, zero JS)
   ═══════════════════════════════════════════════════════════════ */

function RadarMicro() {
    return (
        <div style={{ width: '100%', height: 130, background: '#020810', overflow: 'hidden', position: 'relative' }}>
            <svg viewBox="0 0 200 130" preserveAspectRatio="xMidYMid slice" style={{ width: '100%', height: '100%', display: 'block' }}>
                {[25, 45, 60].map(r => (
                    <circle key={r} cx="100" cy="65" r={r} fill="none"
                        stroke="rgba(0,240,255,0.05)" strokeWidth="0.4"
                        strokeDasharray={r < 60 ? '2 2' : 'none'} />
                ))}
                <line x1="100" y1="5" x2="100" y2="125" stroke="rgba(0,240,255,0.025)" strokeWidth="0.3" />
                <line x1="40" y1="65" x2="160" y2="65" stroke="rgba(0,240,255,0.025)" strokeWidth="0.3" />
                <line x1="55" y1="20" x2="145" y2="110" stroke="rgba(0,240,255,0.015)" strokeWidth="0.2" />
                <line x1="55" y1="110" x2="145" y2="20" stroke="rgba(0,240,255,0.015)" strokeWidth="0.2" />
                {/* Frozen sweep trail */}
                <path d="M100,65 L148,17 L100,5 Z" fill="rgba(0,240,255,0.018)" />
                <line x1="100" y1="65" x2="148" y2="17" stroke="rgba(0,240,255,0.12)" strokeWidth="0.5" />
                {/* Blips */}
                <circle cx="122" cy="38" r="1.8" fill="#00f0ff" opacity="0.85" />
                <circle cx="78" cy="80" r="1.4" fill="#00f0ff" opacity="0.5" />
                <circle cx="115" cy="55" r="1.2" fill="#00f0ff" opacity="0.4" />
                <circle cx="135" cy="72" r="1.5" fill="#00f0ff" opacity="0.55" />
                {/* Blip labels */}
                <text x="127" y="36" fill="rgba(0,240,255,0.3)" fontSize="2.8" fontFamily="monospace">TGT-100</text>
                <text x="140" y="70" fill="rgba(0,240,255,0.2)" fontSize="2.5" fontFamily="monospace">TGT-101</text>
                {/* Cardinals */}
                {[['N', 100, 8], ['E', 194, 67], ['S', 100, 127], ['W', 7, 67]].map(([l, x, y]) => (
                    <text key={l} x={x} y={y} fill="rgba(0,240,255,0.12)" fontSize="3" textAnchor="middle" fontFamily="monospace">{l}</text>
                ))}
                {[25, 45].map(r => (
                    <text key={r} x={103} y={65 - r + 2.5} fill="rgba(0,240,255,0.08)" fontSize="2.3" fontFamily="monospace">{r}km</text>
                ))}
                <circle cx="100" cy="65" r="1.5" fill="#00f0ff" opacity="0.5" />
            </svg>
        </div>
    )
}

function DisplacementMicro() {
    return (
        <div style={{ width: '100%', height: 130, background: '#040604', overflow: 'hidden', position: 'relative' }}>
            <div style={{
                position: 'absolute', inset: 0,
                backgroundImage: 'linear-gradient(rgba(245,158,11,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(245,158,11,0.015) 1px, transparent 1px)',
                backgroundSize: '20px 20px', pointerEvents: 'none',
            }} />
            <svg viewBox="0 0 140 96" preserveAspectRatio="xMidYMid slice" style={{ width: '100%', height: '100%', display: 'block', position: 'relative', zIndex: 1 }}>
                {BLDGS.map((b, i) => (
                    <g key={i}>
                        <rect x={b.x} y={b.y} width={b.w} height={b.h} rx="0.3"
                            fill={bFill(b.d)} stroke={bStroke(b.d)} strokeWidth="0.35" />
                        {bTextColor(b.d) && (
                            <text x={b.x + b.w / 2} y={b.y + b.h / 2 + 1}
                                fill={bTextColor(b.d)} fontSize="2.5"
                                fontFamily="monospace" textAnchor="middle" opacity="0.75">
                                {b.d.toFixed(1)}
                            </text>
                        )}
                        {b.d <= -5 && (
                            <line x1={b.x + b.w / 2} y1={b.y + b.h + 0.5}
                                x2={b.x + b.w / 2} y2={b.y + b.h + 3.5}
                                stroke="#ef4444" strokeWidth="0.4" opacity="0.5" />
                        )}
                    </g>
                ))}
                {/* Scale */}
                <text x="4" y="94" fill="rgba(245,158,11,0.1)" fontSize="2.2" fontFamily="monospace">mm/yr</text>
            </svg>
        </div>
    )
}

function FringeMicro() {
    return (
        <div style={{ width: '100%', height: 130, background: '#020408', overflow: 'hidden', position: 'relative' }}>
            <svg viewBox="0 0 200 130" preserveAspectRatio="xMidYMid slice" style={{ width: '100%', height: '100%', display: 'block' }} overflow="hidden">
                <defs>
                    <radialGradient id="capFringe" cx="46%" cy="48%" rx="44%" ry="40%">
                        <stop offset="0%" stopColor="#3b82f6" />
                        <stop offset="5%" stopColor="#06b6d4" />
                        <stop offset="10%" stopColor="#10b981" />
                        <stop offset="15%" stopColor="#84cc16" />
                        <stop offset="20%" stopColor="#eab308" />
                        <stop offset="25%" stopColor="#f97316" />
                        <stop offset="30%" stopColor="#ef4444" />
                        <stop offset="35%" stopColor="#ec4899" />
                        <stop offset="40%" stopColor="#8b5cf6" />
                        <stop offset="45%" stopColor="#3b82f6" />
                        <stop offset="50%" stopColor="#06b6d4" />
                        <stop offset="55%" stopColor="#10b981" />
                        <stop offset="60%" stopColor="#84cc16" />
                        <stop offset="65%" stopColor="#eab308" />
                        <stop offset="70%" stopColor="#f97316" />
                        <stop offset="75%" stopColor="#ef4444" />
                        <stop offset="80%" stopColor="#ec4899" />
                        <stop offset="85%" stopColor="#8b5cf6" />
                        <stop offset="90%" stopColor="#3b82f6" stopOpacity="0.4" />
                        <stop offset="100%" stopColor="#020408" />
                    </radialGradient>
                    <filter id="capWarp">
                        <feTurbulence type="turbulence" baseFrequency="0.013" numOctaves="3" seed="7" result="n" />
                        <feDisplacementMap in="SourceGraphic" in2="n" scale="26" xChannelSelector="R" yChannelSelector="G" />
                    </filter>
                </defs>
                <ellipse cx="100" cy="65" rx="94" ry="60" fill="url(#capFringe)" filter="url(#capWarp)" opacity="0.8" />
            </svg>
            {/* Scan lines */}
            <div style={{
                position: 'absolute', inset: 0,
                background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.2) 2px, rgba(0,0,0,0.2) 4px)',
                pointerEvents: 'none',
            }} />
            {/* Phase scale */}
            <div style={{
                position: 'absolute', bottom: 6, left: '50%', transform: 'translateX(-50%)',
                display: 'flex', alignItems: 'center', gap: 4,
                fontFamily: 'monospace', fontSize: '0.38rem', color: '#111827', zIndex: 2,
            }}>
                <span>-π</span>
                <div style={{
                    width: 60, height: 2.5, borderRadius: 1,
                    background: 'linear-gradient(90deg, #3b82f6, #06b6d4, #10b981, #eab308, #ef4444, #ec4899, #3b82f6)',
                    opacity: 0.35,
                }} />
                <span>+π</span>
            </div>
        </div>
    )
}

const VIZ = [RadarMicro, DisplacementMicro, FringeMicro]

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════ */

export default function DataVisualization() {
    return (
        <>
            <style>{`
                .cap-grid { display: grid; grid-template-columns: repeat(3, 1fr); }
                .cap-bdr { border-right: 1px solid rgba(255,255,255,0.04); }
                .cap-bdr:last-child { border-right: none; }
                .spec-row {
                    display: flex; justify-content: space-between; align-items: baseline;
                    padding: 5px 0;
                    border-bottom: 1px solid rgba(255,255,255,0.02);
                }
                .spec-row:last-child { border-bottom: none; }
                .spec-lbl {
                    font-family: var(--font-mono, 'JetBrains Mono', monospace);
                    font-size: 0.48rem; color: #0f1219; letter-spacing: 0.12em; text-transform: uppercase;
                    flex-shrink: 0;
                }
                .spec-val {
                    font-family: var(--font-mono, 'JetBrains Mono', monospace);
                    font-size: 0.6rem; color: #334155; text-align: right;
                }
                .cap-link {
                    color: #111827; text-decoration: none;
                    font-family: var(--font-mono, monospace); font-size: 0.45rem;
                    letter-spacing: 0.1em; text-transform: uppercase; transition: color 0.3s;
                }
                .cap-link:hover { color: #475569; }

                @media (max-width: 767px) {
                    .cap-grid { grid-template-columns: 1fr !important; }
                    .cap-bdr {
                        border-right: none !important;
                        border-bottom: 1px solid rgba(255,255,255,0.04) !important;
                    }
                    .cap-bdr:last-child { border-bottom: none !important; }
                }
            `}</style>

            <section style={{
                background: '#050709',
                padding: '100px 0 80px',
                position: 'relative', overflow: 'hidden',
            }}>
                {/* Background dot grid */}
                <div style={{
                    position: 'absolute', inset: 0,
                    backgroundImage: 'radial-gradient(rgba(255,255,255,0.015) 1px, transparent 1px)',
                    backgroundSize: '20px 20px', pointerEvents: 'none',
                }} />
                {/* Top fade */}
                <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0, height: 60,
                    background: 'linear-gradient(to bottom, var(--bg-primary, #0a0a0a), transparent)',
                    zIndex: 2, pointerEvents: 'none',
                }} />

                <div style={{ position: 'relative', zIndex: 1, maxWidth: 1200, margin: '0 auto', padding: '0 2rem' }}>

                    {/* ═══ HEADER ═══ */}
                    <motion.div
                        initial={{ opacity: 0, y: 16 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: '-60px' }}
                        style={{ textAlign: 'center', marginBottom: 48 }}
                    >
                        <div style={{
                            display: 'inline-flex', alignItems: 'center', gap: 8,
                            padding: '5px 14px',
                            border: '1px solid rgba(16,185,129,0.15)',
                            borderRadius: 100,
                            fontFamily: 'var(--font-mono, monospace)',
                            fontSize: '0.6rem', fontWeight: 600,
                            letterSpacing: '0.16em', textTransform: 'uppercase',
                            color: '#10b981', marginBottom: 20,
                            background: 'rgba(16,185,129,0.03)',
                        }}>
                            Capability Overview
                        </div>

                        <h2 style={{
                            fontSize: 'clamp(1.8rem, 3.5vw, 2.6rem)',
                            fontWeight: 700, color: '#e2e8f0',
                            letterSpacing: '-0.03em', lineHeight: 1.15, marginBottom: 16,
                        }}>
                            Operational Domains
                        </h2>

                        {/* Classification marking */}
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: 16,
                            justifyContent: 'center',
                        }}>
                            <div style={{ width: 40, height: '1px', background: 'rgba(255,255,255,0.04)' }} />
                            <span style={{
                                fontFamily: 'var(--font-mono, monospace)',
                                fontSize: '0.48rem', letterSpacing: '0.18em',
                                textTransform: 'uppercase', color: '#111827',
                            }}>
                                Unclassified // For Official Use Only
                            </span>
                            <div style={{ width: 40, height: '1px', background: 'rgba(255,255,255,0.04)' }} />
                        </div>
                    </motion.div>

                    {/* ═══ CAPABILITY MATRIX ═══ */}
                    <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: '-40px' }}
                        transition={{ duration: 0.6, delay: 0.1 }}
                        style={{
                            border: '1px solid rgba(255,255,255,0.04)',
                            borderRadius: 4, overflow: 'hidden',
                        }}
                    >
                        {/* ── Column headers ── */}
                        <div className="cap-grid" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                            {DOMAINS.map((d, i) => (
                                <div key={i} className="cap-bdr" style={{
                                    padding: '14px 20px',
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                }}>
                                    <span style={{
                                        fontFamily: 'var(--font-mono, monospace)',
                                        fontSize: '0.68rem', fontWeight: 700,
                                        color: '#475569', letterSpacing: '0.1em',
                                    }}>
                                        {d.title.toUpperCase()}
                                    </span>
                                    <span style={{
                                        fontFamily: 'var(--font-mono, monospace)',
                                        fontSize: '0.42rem', padding: '2px 7px', borderRadius: 2,
                                        background: `${d.pathColor}08`,
                                        color: `${d.pathColor}90`,
                                        border: `1px solid ${d.pathColor}18`,
                                        letterSpacing: '0.1em',
                                    }}>
                                        {d.path}
                                    </span>
                                </div>
                            ))}
                        </div>

                        {/* ── Micro-viz row ── */}
                        <div className="cap-grid" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                            {DOMAINS.map((_, i) => {
                                const Comp = VIZ[i]
                                return (
                                    <div key={i} className="cap-bdr">
                                        <Comp />
                                    </div>
                                )
                            })}
                        </div>

                        {/* ── Spec sheet row ── */}
                        <div className="cap-grid" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                            {DOMAINS.map((d, i) => (
                                <div key={i} className="cap-bdr" style={{ padding: '14px 20px' }}>
                                    {d.specs.map(([label, value], j) => (
                                        <div key={j} className="spec-row">
                                            <span className="spec-lbl">{label}</span>
                                            <span className="spec-val" style={{
                                                color: value.includes('████') ? '#ef4444' : undefined,
                                                fontSize: value.includes('████') ? '0.55rem' : undefined,
                                            }}>
                                                {value}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </div>

                        {/* ── Description row ── */}
                        <div className="cap-grid">
                            {DOMAINS.map((d, i) => (
                                <div key={i} className="cap-bdr" style={{
                                    padding: '16px 20px',
                                    fontFamily: 'var(--font-mono, monospace)',
                                    fontSize: '0.58rem', color: '#1e293b', lineHeight: 1.75,
                                }}>
                                    {d.description}
                                </div>
                            ))}
                        </div>
                    </motion.div>

                    {/* ═══ DOCUMENT FOOTER ═══ */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        whileInView={{ opacity: 1 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.3 }}
                        style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            marginTop: 10, padding: '0 4px', flexWrap: 'wrap', gap: 8,
                            fontFamily: 'var(--font-mono, monospace)',
                            fontSize: '0.42rem', color: '#0a0a0f', letterSpacing: '0.1em',
                        }}
                    >
                        <span>DOC-NISAR-CAP-2026-0047</span>
                        <span>PREPARED BY: NISAR PRO ANALYTICS</span>
                        <span>PAGE 04 OF 17</span>
                        <Link to="/use-cases" className="cap-link">Full Briefing →</Link>
                    </motion.div>
                </div>
            </section>
        </>
    )
}