import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'
import { ChevronRight, ArrowRight } from 'lucide-react'

// ─── DOMAIN INTELLIGENCE CONFIG ────────────────────────────────AAAAAAAA────

const DOMAINS = [
    {
        id: 'maritime',
        title: 'MARITIME',
        accent: '#00f0ff',
        logs: [
            "[SYS] CFAR pipeline initialized.",
            "[PROC] Threshold = 10^-6, scanning Sector 8A...",
            "[TGT] Anomaly detected: -42dBc | 41.2°N 71.9°W",
            "[CLASS] Signature match: Large Commercial Vessel.",
            "[TRK] Kinematics locking... heading 045° at 14.2kts.",
            "[SYS] Real-time surveillance package updated."
        ],
        description: "Dark vessel tracking and deep ocean surveillance using uncompromised L-band penetration."
    },
    {
        id: 'infrastructure',
        title: 'STRUCTURAL',
        accent: '#f59e0b',
        logs: [
            "[DATA] Loading SLC stacks for urban grid #044.",
            "[PROC] Coregistering temporal baselines...",
            "[CALC] Executing Persistent Scatterer filtering...",
            "[WARN] Subsidence detected > 4mm/yr at Zone 3.",
            "[WARN] Thermal expansion flags triggered on deck.",
            "[SYS] Vector displacement mapping exported."
        ],
        description: "Millimeter-level deformation intelligence for dams, bridges, and critical urban nodes."
    },
    {
        id: 'sar',
        title: 'CORE InSAR',
        accent: '#3b82f6',
        logs: [
            "[ACQ] Fetching Sentinel-1/NISAR dual-pol feeds...",
            "[PROC] Generating raw complex backscatter...",
            "[INTR] Phase unwrapping via SNAPHU initialized.",
            "[DEM] Topographic phase removal converging.",
            "[COH] Coherence mask threshold > 0.4.",
            "[SYS] Synthetic aperture array focused."
        ],
        description: "Raw phase intelligence and complex interferometry pushing the limits of physics."
    }
];

// ─── VISUALIZER COMPONENTS ──────────────────────────────────────────────────

function MaritimeVisualizer() {
    return (
        <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: '#020617' }}>
            {/* Radar Sweep */}
            <motion.div 
                animate={{ rotate: 360 }}
                transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                style={{ 
                    position: 'absolute', top: '50%', left: '50%', width: '150%', height: '150%',
                    background: 'conic-gradient(from 0deg, transparent 70%, rgba(0, 240, 255, 0.4) 100%)',
                    transformOrigin: '0 0',
                    borderRight: '2px solid #00f0ff',
                    zIndex: 1
                }} 
            />
            {/* Target Pings */}
            {[0, 1, 2].map(i => (
                <div key={i} style={{ 
                    position: 'absolute', 
                    top: `${30 + i * 20}%`, left: `${40 + i * 15}%`, 
                    zIndex: 2, display: 'flex', alignItems: 'center', gap: '8px' 
                }}>
                    <motion.div 
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: [0, 1.5, 1], opacity: [0, 1, 0.4] }}
                        transition={{ duration: 2, repeat: Infinity, delay: i * 1.5, ease: "easeOut" }}
                        style={{ width: '10px', height: '10px', background: '#00f0ff', borderRadius: '50%', boxShadow: '0 0 20px #00f0ff' }}
                    />
                    <div style={{ color: '#00f0ff', fontSize: '10px', fontFamily: '"JetBrains Mono", monospace' }}>TGT-{100+i}</div>
                </div>
            ))}
        </div>
    )
}

function InfrastructureVisualizer() {
    return (
        <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: '#050505', display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gridTemplateRows: 'repeat(10, 1fr)', gap: '4px', padding: '20px' }}>
            {Array.from({ length: 100 }).map((_, i) => {
                const isUnstable = i % 13 === 0 || i % 29 === 0;
                return (
                    <motion.div 
                        key={i}
                        animate={isUnstable ? { opacity: [0.3, 1, 0.3], scale: [1, 1.2, 1] } : { opacity: 0.2 }}
                        transition={{ duration: 1 + Math.random(), repeat: Infinity, ease: "easeInOut" }}
                        style={{ 
                            background: isUnstable ? '#f59e0b' : '#10b981',
                            borderRadius: '2px',
                            boxShadow: isUnstable ? '0 0 10px #f59e0b' : 'none'
                        }}
                    />
                )
            })}
            <div style={{ position: 'absolute', bottom: '20px', left: '20px', color: '#10b981', fontSize: '12px', fontFamily: '"JetBrains Mono", monospace' }}>STABLE</div>
            <div style={{ position: 'absolute', bottom: '20px', right: '20px', color: '#f59e0b', fontSize: '12px', fontFamily: '"JetBrains Mono", monospace' }}>WARPING</div>
        </div>
    )
}

function InSARVisualizer() {
    return (
        <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: '#000' }}>
            <svg width="100%" height="100%">
                <defs>
                    <radialGradient id="phaseGrad" cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.8" />
                        <stop offset="33%" stopColor="#ef4444" stopOpacity="0.8" />
                        <stop offset="66%" stopColor="#10b981" stopOpacity="0.8" />
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.8" />
                    </radialGradient>
                    <filter id="displacement">
                        <feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="3" result="noise" />
                        <feDisplacementMap in="SourceGraphic" in2="noise" scale="50" xChannelSelector="R" yChannelSelector="G" />
                    </filter>
                </defs>
                <motion.rect 
                    width="100%" height="100%" fill="url(#phaseGrad)" filter="url(#displacement)"
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                />
            </svg>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.5) 2px, rgba(0,0,0,0.5) 4px)' }} />
            <div style={{ position: 'absolute', top: '20px', left: '20px', color: '#fff', fontSize: '12px', fontFamily: '"JetBrains Mono", monospace', textShadow: '0 0 10px #000' }}>PHASE UNWRAPPING // 2π CYCLE</div>
        </div>
    )
}

// ─── MAIN COMPONENT ─────────────────────────────────────────────────────────

export default function DataVisualization() {
    const [activeIndex, setActiveIndex] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setActiveIndex((current) => (current + 1) % DOMAINS.length);
        }, 6000);
        return () => clearInterval(interval);
    }, []);

    const activeDomain = DOMAINS[activeIndex];

    return (
        <section style={{ 
            background: '#050a14', 
            padding: '120px 0', 
            borderTop: '1px solid rgba(255,255,255,0.05)',
            borderBottom: '1px solid rgba(255,255,255,0.05)',
            minHeight: '80vh',
            display: 'flex',
            alignItems: 'center'
        }}>
            <div className="container" style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 2rem' }}>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4vw', alignItems: 'stretch' }}>
                    
                    {/* LEFT PANE: Typography & Intelligence Feed */}
                    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                        <div style={{ 
                            fontFamily: '"JetBrains Mono", monospace', 
                            color: activeDomain.accent, 
                            fontSize: '0.85rem', 
                            letterSpacing: '2px',
                            marginBottom: '20px'
                        }}>
                            0{activeIndex + 1} // DOMAIN INTELLIGENCE
                        </div>
                        
                        <AnimatePresence mode="wait">
                            <motion.h2 
                                key={activeDomain.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                                style={{ 
                                    fontFamily: '"Space Grotesk", sans-serif',
                                    fontSize: 'clamp(3rem, 5vw, 6rem)', 
                                    fontWeight: 800, 
                                    color: '#fff',
                                    lineHeight: 0.9,
                                    margin: '0 0 24px 0',
                                    textShadow: `0 10px 40px ${activeDomain.accent}30`
                                }}
                            >
                                {activeDomain.title}
                            </motion.h2>
                        </AnimatePresence>

                        <p style={{ 
                            fontFamily: '"Outfit", sans-serif',
                            color: 'rgba(255,255,255,0.6)', 
                            fontSize: '1.1rem', 
                            lineHeight: 1.6, 
                            marginBottom: '40px',
                            maxWidth: '90%'
                        }}>
                            {activeDomain.description}
                        </p>

                        {/* Terminal Log Output */}
                        <div style={{ 
                            background: 'rgba(0,0,0,0.4)', 
                            border: '1px solid rgba(255,255,255,0.1)', 
                            borderLeft: `3px solid ${activeDomain.accent}`,
                            padding: '24px', 
                            borderRadius: '4px',
                            minHeight: '200px'
                        }}>
                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={activeDomain.id}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 0 }}
                                    style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}
                                >
                                    {activeDomain.logs.map((log, i) => (
                                        <motion.div 
                                            key={i}
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: i * 0.4, duration: 0.3 }}
                                            style={{ 
                                                fontFamily: '"JetBrains Mono", monospace',
                                                fontSize: '0.8rem',
                                                color: log.includes('[WARN]') ? '#ef4444' : log.includes('[TGT]') ? '#00f0ff' : 'rgba(255,255,255,0.7)',
                                            }}
                                        >
                                            {log}
                                        </motion.div>
                                    ))}
                                </motion.div>
                            </AnimatePresence>
                        </div>

                        <div style={{ marginTop: '48px' }}>
                            <Link to="/use-cases" style={{
                                display: 'inline-flex', alignItems: 'center', gap: '12px',
                                padding: '16px 32px', border: '1px solid #fff', borderRadius: '0px',
                                color: '#fff', fontSize: '0.95rem', fontWeight: 600, textDecoration: 'none',
                                fontFamily: '"Outfit", sans-serif', textTransform: 'uppercase', letterSpacing: '1px',
                                transition: 'all 0.3s ease'
                            }}
                                onMouseEnter={e => {
                                    e.currentTarget.style.background = '#fff';
                                    e.currentTarget.style.color = '#000';
                                }}
                                onMouseLeave={e => {
                                    e.currentTarget.style.background = 'transparent';
                                    e.currentTarget.style.color = '#fff';
                                }}
                            >
                                Enter Mission Control <ArrowRight size={18} />
                            </Link>
                        </div>
                    </div>

                    {/* RIGHT PANE: Live Visualization Window */}
                    <div style={{ 
                        border: '1px solid rgba(255,255,255,0.1)',
                        background: '#000',
                        borderRadius: '0px',
                        overflow: 'hidden',
                        position: 'relative',
                        minHeight: '600px',
                        boxShadow: `0 20px 80px ${activeDomain.accent}20`
                    }}>
                        <div style={{ 
                            position: 'absolute', top: 0, left: 0, right: 0, 
                            borderBottom: '1px solid rgba(255,255,255,0.1)', 
                            background: 'rgba(255,255,255,0.03)',
                            padding: '12px 20px',
                            display: 'flex', gap: '8px', zIndex: 10
                        }}>
                            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ef4444' }}/>
                            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#f59e0b' }}/>
                            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10b981' }}/>
                        </div>

                        <div style={{ position: 'absolute', inset: '45px 0 0 0' }}>
                            <AnimatePresence mode="wait">
                                {activeIndex === 0 && <motion.div key="mar" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }} style={{ width: '100%', height: '100%' }}><MaritimeVisualizer /></motion.div>}
                                {activeIndex === 1 && <motion.div key="inf" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }} style={{ width: '100%', height: '100%' }}><InfrastructureVisualizer /></motion.div>}
                                {activeIndex === 2 && <motion.div key="sar" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }} style={{ width: '100%', height: '100%' }}><InSARVisualizer /></motion.div>}
                            </AnimatePresence>
                        </div>
                    </div>

                </div>
            </div>
        </section>
    );
}
