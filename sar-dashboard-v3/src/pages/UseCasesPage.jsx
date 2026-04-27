import { useState, useRef, useEffect } from 'react'
import { motion, useInView } from 'framer-motion'
import { Link } from 'react-router-dom'
import { ArrowRight, Radar, ShieldCheck, Waves, BarChart3, ScanLine, Crosshair, Terminal, Activity, AlertTriangle } from 'lucide-react'

// ─── STYLING & ANIMATIONS (Cubic Bezier only) ──────────────────────────────
const globalCSS = `
@keyframes swath-sweep {
    0% { transform: translate(-30vw, -20vh) rotate(-15deg); opacity: 0; }
    20% { opacity: 1; }
    80% { opacity: 1; }
    100% { transform: translate(120vw, 80vh) rotate(-15deg); opacity: 0; }
}
@keyframes ping-elastic {
    0% { transform: scale(0); opacity: 0; }
    60% { transform: scale(1.2); opacity: 1; }
    100% { transform: scale(1); opacity: 1; }
}
@keyframes pulse-ring-cyan {
    0% { box-shadow: 0 0 0 0 rgba(0, 240, 255, 0.4); }
    70% { box-shadow: 0 0 0 15px rgba(0, 240, 255, 0); }
    100% { box-shadow: 0 0 0 0 rgba(0, 240, 255, 0); }
}
@keyframes warp-heatmap {
    0% { filter: hue-rotate(0deg) blur(8px) opacity(0.3); transform: scaleY(1); }
    50% { filter: hue-rotate(40deg) blur(12px) opacity(0.6); transform: scaleY(1.02); }
    100% { filter: hue-rotate(90deg) blur(8px) opacity(0.85); transform: scaleY(1.05); }
}
@keyframes terminal-scroll {
    0% { transform: translateY(0); }
    100% { transform: translateY(-50%); }
}

.use-section { scroll-snap-align: start; scroll-snap-stop: always; }
.glass-panel {
    background: rgba(255, 255, 255, 0.03);
    backdrop-filter: blur(40px);
    -webkit-backdrop-filter: blur(40px);
    border: 1px solid rgba(255, 255, 255, 0.1);
}
.display-font { font-family: 'Space Grotesk', sans-serif; letter-spacing: -0.04em; }
.body-font { font-family: 'Outfit', sans-serif; }
.data-font { font-family: 'JetBrains Mono', monospace; }
`

const IMAGES = {
    maritime: 'https://images.unsplash.com/photo-1769837496184-32831581c55a?q=80&w=2128&auto=format&fit=crop',
    dam: 'https://images.unsplash.com/photo-1563951218203-70e139b56e47?q=80&w=1171&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D?w=1920&q=80&auto=format',
    bridge: 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=1920&q=80&auto=format',
}

// ─── UTILS ──────────────────────────────────────────────────────────────────
const cubicTransition = { duration: 1.2, ease: [0.16, 1, 0.3, 1] }

// ─── MARITIME WIDGET (Elliptical sweep & detections) ─────────────────────
function MaritimeOverlay() {
    return (
        <>
            {/* Authentic side-looking SAR Swath (NOT a full-screen line) */}
            <div style={{ position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none', overflow: 'hidden' }}>
                <div style={{
                    position: 'absolute', top: '20vh', left: 0,
                    width: '600px', height: '200px',
                    borderRadius: '50%', // Makes it an ellipse
                    background: 'radial-gradient(ellipse at center, rgba(0, 240, 255, 0.15) 0%, transparent 60%)',
                    border: '1px solid rgba(0, 240, 255, 0.4)',
                    boxShadow: '0 0 60px 20px rgba(0, 240, 255, 0.05) inset',
                    animation: 'swath-sweep 12s cubic-bezier(0.4, 0, 0.2, 1) infinite',
                }} />
            </div>

            {/* Target Reticles (Pinging in) */}
            <div style={{ position: 'absolute', inset: 0, zIndex: 3, pointerEvents: 'none' }}>
                {[
                    { left: '42%', top: '55%', delay: '1.2s' },
                    { left: '55%', top: '65%', delay: '1.8s' },
                    { left: '62%', top: '48%', delay: '2.5s' }
                ].map((pos, i) => (
                    <div key={i} style={{
                        position: 'absolute', left: pos.left, top: pos.top,
                        width: '32px', height: '32px',
                        border: '1.5px solid #00f0ff', borderRadius: '50%',
                        transform: 'translate(-50%, -50%)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        animation: `ping-elastic 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) ${pos.delay} both, pulse-ring-cyan 2s infinite ${pos.delay}`,
                    }}>
                        <div style={{ width: '4px', height: '4px', background: '#00f0ff', borderRadius: '50%' }} />
                        {/* Target Label */}
                        <div style={{
                            position: 'absolute', top: '-24px', whiteSpace: 'nowrap',
                            color: '#00f0ff', fontSize: '0.65rem', fontWeight: 'bold',
                            fontFamily: '"JetBrains Mono", monospace', textShadow: '0 0 10px #00f0ff'
                        }}>
                            TGT-0{i + 1}
                        </div>
                    </div>
                ))}
            </div>

            {/* Right Side Glass Panel */}
            <motion.div
                initial={{ opacity: 0, x: 60 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ ...cubicTransition, delay: 0.5 }}
                className="glass-panel"
                style={{
                    position: 'absolute', top: '50%', right: '80px', transform: 'translateY(-50%)',
                    width: '380px', borderRadius: '16px', padding: '32px', zIndex: 10,
                    boxShadow: '0 40px 80px rgba(0,0,0,0.8), inset 0 0 0 1px rgba(0,240,255,0.1)'
                }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                    <span className="data-font" style={{ color: '#00f0ff', fontSize: '0.8rem', fontWeight: 700, letterSpacing: '1px' }}>
                        <Crosshair size={14} style={{ marginRight: '8px', verticalAlign: '-2px' }} />
                        CFAR LIVE ACQUISITION
                    </span>
                    <span className="data-font" style={{ background: '#ef4444', color: '#fff', fontSize: '0.65rem', padding: '4px 8px', borderRadius: '4px', fontWeight: 700 }}>REC</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {[
                        { id: 'TGT-01', rcs: '42.1 dB', status: 'Locked', coords: '14.5912° N, 71.2204° E' },
                        { id: 'TGT-02', rcs: '38.5 dB', status: 'Tracking', coords: '14.6108° N, 71.1892° E' },
                        { id: 'TGT-03', rcs: '55.2 dB', status: 'Locked', coords: '14.5531° N, 71.2988° E' },
                    ].map((t, i) => (
                        <motion.div key={i}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ ...cubicTransition, delay: 0.8 + (i * 0.15) }}
                            style={{
                                background: 'rgba(0,240,255,0.05)', border: '1px solid rgba(0,240,255,0.1)',
                                borderRadius: '8px', padding: '16px', display: 'flex', justifyContent: 'space-between',
                                borderLeft: t.status === 'Locked' ? '3px solid #00f0ff' : '3px solid rgba(0,240,255,0.2)'
                            }}
                        >
                            <div>
                                <div className="display-font" style={{ color: '#fff', fontSize: '1rem', fontWeight: 600 }}>{t.id}</div>
                                <div className="data-font" style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.65rem', marginTop: '6px' }}>{t.coords}</div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <div className="data-font" style={{ color: '#00f0ff', fontSize: '0.9rem', fontWeight: 800 }}>{t.rcs}</div>
                                <div className="data-font" style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.65rem', marginTop: '6px' }}>{t.status}</div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </motion.div>

            {/* Left Side Terminal Stream Overlay */}
            <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.5, duration: 2 }}
                style={{
                    position: 'absolute', bottom: '100px', left: '80px', width: '400px',
                    height: '140px', overflow: 'hidden', zIndex: 10,
                    maskImage: 'linear-gradient(to bottom, transparent, black 20%, black 80%, transparent)',
                    WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 20%, black 80%, transparent)',
                }}
            >
                <div className="data-font" style={{
                    color: 'rgba(0, 240, 255, 0.4)', fontSize: '0.65rem', lineHeight: 1.8,
                    animation: 'terminal-scroll 20s linear infinite', whiteSpace: 'pre'
                }}>
                    {`[SYS] Initializing CFAR pipeline...
[SYS] Setting PFA = 10^-6
[INFO] Chunk 001x004 loaded (1024x1024 px)
[PROC] Calculating integral image...
[PROC] Threshold applied: 42.1 dB
[WARN] Sea clutter variance high (State=5)
[TGT] Acquired TGT-01 at 14.59° N
[PROC] Downsampling ratio 8:1
[INFO] Memory utilization: 42.1 MB
[INFO] Chunk 002x004 loaded (1024x1024 px)
[TGT] Acquired TGT-02 at 14.61° N
[SYS] Pipeline nominal...`}
                </div>
            </motion.div>
        </>
    )
}

// ─── DAM WIDGET (Heatmap warp & Deformation velocity graph) ──────────────────
function DamOverlay() {
    return (
        <>
            {/* Animated SVG Heatmap over dam Face */}
            <div style={{ position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: '800px', height: '400px', position: 'relative', marginTop: '150px' }}>
                    <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
                        <polygon points="10,40 90,45 85,90 15,85"
                            fill="url(#heatGrad)"
                            style={{
                                animation: 'warp-heatmap 8s cubic-bezier(0.4, 0, 0.2, 1) alternate infinite',
                                opacity: 0.8
                            }}
                        />
                        <defs>
                            <radialGradient id="heatGrad" cx="50%" cy="50%" r="50%">
                                <stop offset="0%" stopColor="#ef4444" stopOpacity="0.8" />
                                <stop offset="40%" stopColor="#f59e0b" stopOpacity="0.5" />
                                <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                            </radialGradient>
                        </defs>
                    </svg>
                    {/* Floating Label */}
                    <div style={{
                        position: 'absolute', top: '30%', left: '45%', transform: 'translate(-50%, -50%)',
                        background: 'rgba(0,0,0,0.8)', padding: '6px 12px', borderRadius: '4px', border: '1px solid #f59e0b',
                        color: '#f59e0b', fontSize: '0.65rem', fontWeight: 800, fontFamily: '"JetBrains Mono", monospace'
                    }}>
                        Sector 3: +8.2mm
                    </div>
                </div>
            </div>

            {/* Disclaimer */}
            <div style={{ position: 'absolute', bottom: '40px', right: '80px', zIndex: 10 }}>
                <div className="data-font" style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.6rem', border: '1px solid rgba(255,255,255,0.1)', padding: '4px 8px', borderRadius: '4px', background: 'rgba(0,0,0,0.4)' }}>
                    DEMO: Simulated structural subsidence patterns based on typical earth-fill dam behavior.
                </div>
            </div>

            {/* Glass Panel: Deformation Graph */}
            <motion.div
                initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ ...cubicTransition, delay: 0.6 }}
                className="glass-panel"
                style={{
                    position: 'absolute', top: '50%', right: '80px', transform: 'translateY(-50%)',
                    width: '420px', borderRadius: '16px', padding: '32px', zIndex: 10,
                    boxShadow: '0 40px 80px rgba(0,0,0,0.8), inset 0 0 0 1px rgba(245,158,11,0.2)'
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
                    <Waves size={16} color="#f59e0b" />
                    <span className="data-font" style={{ color: '#f59e0b', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '1px' }}>
                        DEFORMATION VELOCITY GRAPH
                    </span>
                </div>

                <div style={{ height: '140px', position: 'relative', borderBottom: '1px solid rgba(255,255,255,0.1)', borderLeft: '1px solid rgba(255,255,255,0.1)', paddingBottom: '8px' }}>
                    <svg width="100%" height="100%" viewBox="0 0 300 100" preserveAspectRatio="none">
                        <motion.path
                            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 2, ease: "easeOut", delay: 1 }}
                            d="M 0,50 Q 50,45 100,55 T 200,65 T 300,20"
                            fill="none" stroke="#f59e0b" strokeWidth="3"
                        />
                        <motion.path
                            initial={{ opacity: 0 }} animate={{ opacity: 0.2 }} transition={{ delay: 2, duration: 1 }}
                            d="M 0,50 Q 50,45 100,55 T 200,65 T 300,20 L 300,100 L 0,100 Z"
                            fill="#f59e0b"
                        />
                    </svg>
                    <div className="data-font" style={{ position: 'absolute', left: '-30px', top: '0', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', color: 'rgba(255,255,255,0.3)', fontSize: '0.55rem', textAlign: 'right' }}>
                        <span>+5</span><span>0</span><span>-5</span><span>-10</span>
                    </div>
                </div>

                {/* Simulated Time Slider */}
                <div style={{ marginTop: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span className="data-font" style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.65rem' }}>TIME SLIDER</span>
                        <span className="data-font" style={{ color: '#f59e0b', fontSize: '0.75rem', fontWeight: 'bold' }}>NOV 2024</span>
                    </div>
                    <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', position: 'relative' }}>
                        <motion.div
                            initial={{ width: 0 }} animate={{ width: '80%' }} transition={{ duration: 8, ease: "linear", repeat: Infinity }}
                            style={{ height: '100%', background: '#f59e0b', borderRadius: '2px' }}
                        />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
                        <span className="data-font" style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.55rem' }}>JAN 2024</span>
                        <span className="data-font" style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.55rem' }}>DEC 2024</span>
                    </div>
                </div>
            </motion.div>
        </>
    )
}


// ─── BRIDGE WIDGET (Physics intelligent PS Points) ───────────────────────
function BridgeOverlay() {
    const [hoveredIdx, setHoveredIdx] = useState(null)
    // We visually divide the bridge.
    // Towers/Abutments = Stable (Green). Deck = Unstable (Amber).
    const towers = useRef(Array.from({ length: 40 }).map((_, i) => ({
        // Place points mostly vertically
        left: (25 + Math.random() * 5 + (i % 2 === 0 ? 0 : 40)) + '%',
        top: (20 + Math.random() * 60) + '%',
        stable: true
    }))).current;

    const deck = useRef(Array.from({ length: 60 }).map(() => ({
        // Place points horizontally across the bridge span
        left: (15 + Math.random() * 70) + '%',
        top: (65 + Math.random() * 10) + '%',
        stable: false
    }))).current;

    const points = [...towers, ...deck];

    return (
        <>
            {/* Split Screen Line */}
            <div style={{ position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none' }}>
                <div style={{
                    position: 'absolute', top: 0, bottom: 0, left: '50%', width: '1px',
                    background: 'linear-gradient(to bottom, transparent, rgba(255,255,255,0.2), transparent)'
                }} />
                <div className="data-font" style={{
                    position: 'absolute', top: '140px', left: '48%', transform: 'translateX(-100%)',
                    color: 'rgba(255,255,255,0.4)', fontSize: '0.65rem', letterSpacing: '2px'
                }}>OPTICAL</div>
                <div className="data-font" style={{
                    position: 'absolute', top: '140px', left: '52%',
                    color: '#3b82f6', fontSize: '0.65rem', fontWeight: 'bold', letterSpacing: '2px'
                }}>InSAR PHASE</div>
            </div>

            {/* Glowing PS Points */}
            <div style={{ position: 'absolute', inset: 0, zIndex: 2 }}>
                {points.map((p, i) => (
                    <motion.div key={i}
                        onMouseEnter={() => setHoveredIdx(i)}
                        onMouseLeave={() => setHoveredIdx(null)}
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{ opacity: p.stable ? 0.6 : (0.4 + Math.random() * 0.6), scale: 1 }}
                        transition={{ duration: 0.5, delay: 0.5 + Math.random() }}
                        className="ps-point"
                        style={{
                            position: 'absolute', left: p.left, top: p.top,
                            width: '4px', height: '4px', borderRadius: '50%',
                            background: p.stable ? '#10b981' : '#f59e0b',
                            boxShadow: p.stable ? '0 0 6px #10b981' : '0 0 10px #f59e0b',
                            cursor: 'pointer',
                            zIndex: hoveredIdx === i ? 100 : 1
                        }}
                    >
                        {/* Tooltip */}
                        <div style={{
                            position: 'absolute', bottom: '10px', left: '50%', transform: 'translateX(-50%)',
                            background: 'rgba(0,0,0,0.9)', padding: '4px 8px', borderRadius: '4px',
                            color: '#fff', fontSize: '0.55rem', fontFamily: '"JetBrains Mono", monospace',
                            whiteSpace: 'nowrap', border: `1px solid ${p.stable ? '#10b981' : '#f59e0b'}`,
                            pointerEvents: 'none', opacity: hoveredIdx === i ? 1 : 0, transition: 'opacity 0.2s',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
                        }}>
                            PS-{(4000 + i)} | {p.stable ? '0.0mm/yr | Stable' : '-3.2mm/yr'}
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Right Side Glass Panel */}
            <motion.div
                initial={{ opacity: 0, x: 60 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ ...cubicTransition, delay: 0.6 }}
                className="glass-panel"
                style={{
                    position: 'absolute', top: '50%', right: '80px', transform: 'translateY(-50%)',
                    width: '360px', borderRadius: '16px', padding: '32px', zIndex: 10,
                    boxShadow: '0 40px 80px rgba(0,0,0,0.8), inset 0 0 0 1px rgba(59,130,246,0.2)'
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
                    <ScanLine size={16} color="#3b82f6" />
                    <span className="data-font" style={{ color: '#3b82f6', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '1px' }}>
                        PS POINT CLUSTER ANALYSIS
                    </span>
                </div>

                <p className="body-font" style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '24px' }}>
                    10,000 bridges monitored simultaneously.<br />
                    <span style={{ color: '#ef4444' }}>12 flagged for investigation.</span><br />
                    Zero failures.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ padding: '12px', background: 'rgba(0,0,0,0.4)', borderRadius: '8px', borderLeft: '3px solid #10b981', display: 'flex', justifyContent: 'space-between' }}>
                        <span className="data-font" style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.65rem' }}>TOWERS & ABUTMENTS</span>
                        <span className="data-font" style={{ color: '#10b981', fontSize: '0.75rem', fontWeight: 'bold' }}>STABLE</span>
                    </div>
                    <div style={{ padding: '12px', background: 'rgba(0,0,0,0.4)', borderRadius: '8px', borderLeft: '3px solid #f59e0b', display: 'flex', justifyContent: 'space-between' }}>
                        <span className="data-font" style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.65rem' }}>SUSPENDED DECK</span>
                        <span className="data-font" style={{ color: '#f59e0b', fontSize: '0.75rem', fontWeight: 'bold' }}>THERMAL SHIFT</span>
                    </div>
                </div>

            </motion.div>
        </>
    )
}


// ─── DATA CONFIGURATION ─────────────────────────────────────────────────────

const SECTIONS = [
    {
        id: 'maritime',
        label: 'MARITIME',
        headline: 'Every Vessel.',
        headlineBold: 'Zero Blind Spots.',
        body: 'SAR radar ignores clouds, fog, and darkness. Our CA-CFAR engine processes NISAR L-band imagery in under 2 seconds, delivering geo-located vessel positions with military-grade precision.',
        cta: 'Launch Maritime Watch',
        to: '/app/maritime',
        image: IMAGES.maritime,
        accent: '#00f0ff',
        Overlay: MaritimeOverlay
    },
    {
        id: 'dam',
        label: 'INFRASTRUCTURE',
        headline: 'Detected 8.2mm',
        headlineBold: 'Before the First Crack.',
        body: 'InSAR phase differencing detects sub-centimeter deformation across every square meter of critical infrastructure. NISAR revisits every 12 days — turning reactive disaster response into continuous, preventive monitoring.',
        cta: 'Launch Infrastructure Monitor',
        to: '/app',
        image: IMAGES.dam,
        accent: '#f59e0b',
        Overlay: DamOverlay
    },
    {
        id: 'bridge',
        label: 'STRUCTURAL HEALTH',
        headline: '10,000 Bridges.',
        headlineBold: 'Zero Failures.',
        body: 'From local overpasses to Tower Bridge. By clustering Persistent Scatterer (PS) points on stable structures versus flexible decks, we measure thermal expansion and structural fatigue years before catastrophic failure.',
        cta: 'Launch Bridge Monitor',
        to: '/app',
        image: IMAGES.bridge,
        accent: '#3b82f6',
        Overlay: BridgeOverlay
    }
]


// ─── SCROLLYTELLING CONTAINER COMPONENT ─────────────────────────────────────
function Section({ data, index }) {
    const ref = useRef(null)
    const isInView = useInView(ref, { amount: 0.5 })

    const Overlay = data.Overlay

    return (
        <section
            ref={ref}
            id={data.id}
            className="use-section"
            style={{
                height: '100vh', width: '100%',
                position: 'relative', overflow: 'hidden',
                background: '#050a14' // Deep Navy base
            }}
        >
            {/* Dark Ocean / Cinematic Parallax Background */}
            <div style={{
                position: 'absolute', inset: -50, zIndex: 0,
                backgroundImage: `url(${data.image})`,
                backgroundSize: 'cover', backgroundPosition: 'center',
                filter: isInView ? 'brightness(0.5) saturate(0.8)' : 'brightness(0.1)',
                transform: isInView ? 'scale(1) translateZ(0)' : 'scale(1.05) translateZ(-50px)',
                transition: 'all 2s cubic-bezier(0.16, 1, 0.3, 1)',
            }} />

            {/* Gradient Mask for Readability */}
            <div style={{
                position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none',
                background: 'linear-gradient(90deg, rgba(5,10,20,0.95) 0%, rgba(5,10,20,0.7) 40%, transparent 100%)'
            }} />

            {/* Specific Physics-based Overlay */}
            {isInView && <Overlay />}

            {/* Left Content Column (Asymmetric Layout) */}
            <div style={{
                position: 'absolute', top: 0, bottom: 0, left: 0, zIndex: 10,
                width: '50%', padding: '0 80px',
                display: 'flex', flexDirection: 'column', justifyContent: 'center'
            }}>
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
                    transition={{ ...cubicTransition, delay: 0.1 }}
                    style={{ marginBottom: '24px' }}
                >
                    <span className="data-font" style={{ color: data.accent, fontSize: '0.75rem', fontWeight: 700, letterSpacing: '4px' }}>
                        {data.label} // 0{index + 1}
                    </span>
                </motion.div>

                <motion.h1
                    initial={{ opacity: 0, x: -40 }}
                    animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: -40 }}
                    transition={{ ...cubicTransition, delay: 0.2 }}
                    className="display-font"
                    style={{
                        fontSize: '96px', fontWeight: 300, lineHeight: 0.95,
                        color: 'rgba(255,255,255,0.7)', margin: 0
                    }}
                >
                    {data.headline}
                </motion.h1>

                <motion.h1
                    initial={{ opacity: 0, x: -40 }}
                    animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: -40 }}
                    transition={{ ...cubicTransition, delay: 0.3 }}
                    className="display-font"
                    style={{
                        fontSize: '96px', fontWeight: 800, lineHeight: 0.95,
                        color: '#fff', margin: '0 0 32px 0', textShadow: `0 10px 40px ${data.accent}40`
                    }}
                >
                    {data.headlineBold}
                </motion.h1>

                <motion.p
                    initial={{ opacity: 0 }}
                    animate={isInView ? { opacity: 1 } : { opacity: 0 }}
                    transition={{ ...cubicTransition, delay: 0.5 }}
                    className="body-font"
                    style={{
                        fontSize: '1.25rem', lineHeight: 1.6, color: 'rgba(255,255,255,0.5)',
                        maxWidth: '85%', marginBottom: '48px'
                    }}
                >
                    {data.body}
                </motion.p>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
                    transition={{ ...cubicTransition, delay: 0.6 }}
                >
                    <Link to={data.to} style={{ textDecoration: 'none' }}>
                        <button
                            className="body-font"
                            style={{
                                padding: '16px 40px', background: 'transparent',
                                color: '#fff', border: `1px solid ${data.accent}`,
                                borderRadius: '0px', // Architectual brutal/clean look
                                fontSize: '1rem', fontWeight: 700, cursor: 'pointer',
                                display: 'inline-flex', alignItems: 'center', gap: '12px',
                                boxShadow: `inset 0 0 0 0 ${data.accent}`,
                                transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
                            }}
                            onMouseEnter={e => { e.currentTarget.style.boxShadow = `inset 400px 0 0 0 ${data.accent}`; e.currentTarget.style.color = '#000' }}
                            onMouseLeave={e => { e.currentTarget.style.boxShadow = `inset 0 0 0 0 ${data.accent}`; e.currentTarget.style.color = '#fff' }}
                        >
                            {data.cta} <ArrowRight size={18} strokeWidth={2.5} />
                        </button>
                    </Link>
                </motion.div>
            </div>
        </section>
    )
}

// ─── MAIN PAGE COMPONENT ────────────────────────────────────────────────────
export default function UseCasesPage() {
    return (
        <div style={{ background: '#050a14' }}>
            <style dangerouslySetInnerHTML={{ __html: globalCSS }} />

            <div style={{
                height: '100vh', overflowY: 'auto',
                scrollSnapType: 'y mandatory', scrollBehavior: 'smooth'
            }}>
                {SECTIONS.map((section, idx) => (
                    <Section key={section.id} data={section} index={idx} />
                ))}
            </div>

            {/* Fixed Minimalist Progress Nav */}
            <div style={{
                position: 'fixed', right: '40px', top: '50%', transform: 'translateY(-50%)',
                zIndex: 1000, display: 'flex', flexDirection: 'column', gap: '20px', pointerEvents: 'none'
            }}>
                {/* Visual anchor dots for design, actual scroll is handled natively */}
                {[0, 1, 2].map(i => (
                    <div key={i} style={{ width: '4px', height: '40px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px' }} />
                ))}
            </div>
        </div>
    )
}
