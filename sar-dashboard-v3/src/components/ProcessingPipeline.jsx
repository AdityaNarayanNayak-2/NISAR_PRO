import { motion } from 'framer-motion'
import { useState, useEffect } from 'react'

const NisarIcon = () => (
    <svg width="46" height="32" viewBox="0 0 46 32" fill="none" style={{ color: '#818cf8' }}>
        <rect x="15" y="11" width="16" height="13" rx="2" fill="currentColor" opacity="0.85" />
        <path d="M19 11 Q23 4 27 11" stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.5" />
        <circle cx="23" cy="17" r="2" fill="currentColor" opacity="0.4" />
        <rect x="0" y="9" width="13" height="17" rx="1" fill="currentColor" opacity="0.18" />
        <rect x="33" y="9" width="13" height="17" rx="1" fill="currentColor" opacity="0.18" />
        {[4, 8, 9, 37, 41, 42].map(x => (
            <line key={x} x1={x} y1="9" x2={x} y2="26" stroke="currentColor" strokeOpacity="0.22" strokeWidth="0.5" />
        ))}
    </svg>
)

const SentinelIcon = () => (
    <svg width="40" height="28" viewBox="0 0 40 28" fill="none" style={{ color: '#818cf8' }}>
        <rect x="14" y="9" width="12" height="11" rx="1.5" fill="currentColor" opacity="0.85" />
        <line x1="20" y1="9" x2="20" y2="3" stroke="currentColor" strokeWidth="1.2" opacity="0.5" />
        <circle cx="20" cy="2.5" r="1.3" fill="currentColor" opacity="0.5" />
        <rect x="0" y="7" width="12" height="15" rx="1" fill="currentColor" opacity="0.18" />
        <rect x="28" y="7" width="12" height="15" rx="1" fill="currentColor" opacity="0.18" />
        {[4, 8, 32, 36].map(x => (
            <line key={x} x1={x} y1="7" x2={x} y2="22" stroke="currentColor" strokeOpacity="0.22" strokeWidth="0.5" />
        ))}
    </svg>
)

const IceyeIcon = () => (
    <svg width="32" height="22" viewBox="0 0 32 22" fill="none" style={{ color: '#818cf8' }}>
        <rect x="11" y="7" width="10" height="8" rx="1" fill="currentColor" opacity="0.85" />
        <rect x="0" y="5" width="9" height="12" rx="1" fill="currentColor" opacity="0.18" />
        <rect x="23" y="5" width="9" height="12" rx="1" fill="currentColor" opacity="0.18" />
        {[3, 6, 26, 29].map(x => (
            <line key={x} x1={x} y1="5" x2={x} y2="17" stroke="currentColor" strokeOpacity="0.22" strokeWidth="0.5" />
        ))}
    </svg>
)

function ProcessingPipeline() {
    const [utc, setUtc] = useState('')

    useEffect(() => {
        const tick = () => setUtc(new Date().toUTCString().slice(17, 25) + ' UTC')
        tick()
        const id = setInterval(tick, 1000)
        return () => clearInterval(id)
    }, [])

    const satellites = [
        { name: 'NISAR', sub: 'NASA-ISRO', band: 'L-Band SAR', Icon: NisarIcon },
        { name: 'Sentinel-1', sub: 'ESA', band: 'C-Band SAR', Icon: SentinelIcon },
        { name: 'ICEYE', sub: 'Commercial', band: 'X-Band SAR', Icon: IceyeIcon },
    ]

    const dataSources = [
        { name: 'NASA ASF', sub: 'STAC Catalog' },
        { name: 'USGS', sub: 'Seismic Feed' },
        { name: 'Open-Meteo', sub: 'Precip · Soil' },
        { name: 'India-WRIS', sub: 'Hydrology' },
    ]

    const outputs = [
        { title: 'Dam Risk Score', desc: 'Structural integrity from InSAR displacement', sym: '▲' },
        { title: 'Flood Risk Index', desc: 'Inundation probability mapping', sym: '◆' },
        { title: 'Displacement Alerts', desc: 'mm-level change detection', sym: '●' },
        { title: 'GeoTIFF Layers', desc: 'Cloud-optimized raster tiles', sym: '■' },
        { title: 'Infrastructure Reports', desc: 'Automated PDF/JSON export', sym: '◇' },
    ]

    const pipelineSteps = [
        { num: '01', name: 'SLC Ingest', desc: 'SAFE/zip → complex', phase: 0 },
        { num: '02', name: 'Orbit Interp', desc: 'Ephemeris fitting', phase: 0 },
        { num: '03', name: 'FFT Coreg', desc: 'Cross-correlation', phase: 1 },
        { num: '04', name: 'Sub-pixel', desc: 'Oversample + peak', phase: 1 },
        { num: '05', name: 'ESD Correct', desc: 'DEM phase assist', phase: 1 },
        { num: '06', name: 'Sinc Resamp', desc: 'Complex interp.', phase: 1 },
        { num: '07', name: 'Interf. Gen', desc: 'φ_m − φ_s', phase: 2 },
        { num: '08', name: 'Phase Remove', desc: 'Flat + topo φ', phase: 2 },
        { num: '09', name: 'Multilook', desc: 'Speckle reduce', phase: 2 },
        { num: '10', name: 'Goldstein', desc: 'Spectral filter', phase: 3 },
        { num: '11', name: 'SNAPHU', desc: 'MCF unwrap', phase: 3 },
        { num: '12', name: 'Disp. Scale', desc: 'λ/4π × Φ', phase: 4 },
        { num: '13', name: 'Atmo. Correct', desc: 'Tropo delay', phase: 4 },
        { num: '14', name: 'Geocode → COG', desc: 'UTM + tiled', phase: 4 },
    ]

    const phases = [
        { name: 'INGEST', color: '#3b82f6' },
        { name: 'COREGISTRATION', color: '#f59e0b' },
        { name: 'INTERFEROGRAM', color: '#10b981' },
        { name: 'FILTERING', color: '#8b5cf6' },
        { name: 'OUTPUT', color: '#ec4899' },
    ]

    const isFirstInPhase = (i) => i === 0 || pipelineSteps[i].phase !== pipelineSteps[i - 1].phase
    const getPhaseColor = (i) => phases[pipelineSteps[i].phase].color

    const renderPipelineRow = (steps, startIdx) => {
        const elements = []
        steps.forEach((step, i) => {
            const gi = startIdx + i
            const color = getPhaseColor(gi)
            if (i > 0) {
                const pc = getPhaseColor(gi - 1)
                elements.push(
                    <div key={`c-${step.num}`} className="pipe-hconn" style={{ '--pc': pc }}>
                        <div className="pipe-hline" />
                        <div className="pipe-hdot" style={{ animationDelay: `${(gi - 1) * 0.22}s` }} />
                    </div>
                )
            }
            elements.push(
                <motion.div
                    key={step.num}
                    className="pipe-node"
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.05, duration: 0.35 }}
                >
                    {isFirstInPhase(gi) && (
                        <div className="pipe-phase-tag" style={{
                            color, borderColor: color + '30', background: color + '0c',
                        }}>
                            {phases[step.phase].name}
                        </div>
                    )}
                    <div className="pipe-num" style={{
                        borderColor: color + '40', color, boxShadow: `0 0 10px ${color}12`,
                    }}>
                        {step.num}
                    </div>
                    <div className="pipe-name">{step.name}</div>
                    <div className="pipe-desc">{step.desc}</div>
                    {gi === 13 && (
                        <div className="pipe-out-badge" style={{
                            color: '#10b981', borderColor: 'rgba(16,185,129,0.25)',
                            background: 'rgba(16,185,129,0.08)',
                        }}>✓ COG</div>
                    )}
                </motion.div>
            )
        })
        return <div className="pipe-row">{elements}</div>
    }

    return (
        <>
            <style>{`
                @keyframes particleFall {
                    0% { top: -4px; opacity: 0; }
                    8% { opacity: 1; }
                    92% { opacity: 1; }
                    100% { top: calc(100% + 4px); opacity: 0; }
                }
                @keyframes particleFallUp {
                    0% { bottom: -4px; opacity: 0; }
                    8% { opacity: 1; }
                    92% { opacity: 1; }
                    100% { bottom: calc(100% + 4px); opacity: 0; }
                }
                @keyframes ledPulse {
                    0%, 100% { opacity: 1; box-shadow: 0 0 4px currentColor; }
                    50% { opacity: 0.35; box-shadow: 0 0 0px currentColor; }
                }
                @keyframes subtleSweep {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                @keyframes pipeHFlow {
                    0% { left: 0; opacity: 0; }
                    8% { opacity: 1; }
                    92% { opacity: 1; }
                    100% { left: calc(100% - 10px); opacity: 0; }
                }
                @keyframes pipeVFlow {
                    0% { top: 0; opacity: 0; }
                    8% { opacity: 1; }
                    92% { opacity: 1; }
                    100% { top: calc(100% - 10px); opacity: 0; }
                }
                @keyframes pipeSweep {
                    0% { background-position: 200% 0; }
                    100% { background-position: -200% 0; }
                }
                @keyframes outputGlow {
                    0%, 100% { opacity: 0.4; }
                    50% { opacity: 1; }
                }

                @media (prefers-reduced-motion: reduce) {
                    *, *::before, *::after {
                        animation-duration: 0.01ms !important;
                        animation-iteration-count: 1 !important;
                        transition-duration: 0.01ms !important;
                    }
                }

                .az {
                    position: relative;
                    border-radius: 6px;
                    padding: 22px 18px 16px;
                    transition: border-color 0.4s ease;
                }
                .az:hover { border-color: rgba(255,255,255,0.1); }
                .az-label {
                    position: absolute;
                    top: -9px;
                    left: 14px;
                    padding: 0 8px;
                    font-family: var(--font-mono, 'JetBrains Mono', monospace);
                    font-size: 0.55rem;
                    letter-spacing: 0.18em;
                    text-transform: uppercase;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                .az-class {
                    font-size: 0.5rem;
                    opacity: 0.6;
                    letter-spacing: 0.12em;
                }

                .an {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    background: rgba(8,10,16,0.85);
                    border: 1px solid rgba(255,255,255,0.05);
                    border-radius: 5px;
                    padding: 10px 13px;
                    transition: border-color 0.3s ease, background 0.3s ease, transform 0.2s ease;
                }
                .an:hover {
                    border-color: rgba(255,255,255,0.12);
                    background: rgba(12,14,22,0.95);
                }
                .an-led {
                    width: 5px;
                    height: 5px;
                    border-radius: 50%;
                    flex-shrink: 0;
                    animation: ledPulse 2.5s ease-in-out infinite;
                }
                .an-name {
                    font-family: var(--font-mono, 'JetBrains Mono', monospace);
                    font-size: 0.72rem;
                    color: #cbd5e1;
                    font-weight: 600;
                    letter-spacing: -0.01em;
                }
                .an-sub {
                    font-family: var(--font-mono, 'JetBrains Mono', monospace);
                    font-size: 0.55rem;
                    color: #64748b;
                    margin-top: 1px;
                }

                .an-sat {
                    flex-direction: column;
                    align-items: center;
                    text-align: center;
                    padding: 16px 12px 14px;
                    gap: 0;
                }
                .an-sat:hover { transform: translateY(-2px); }
                .an-sat-info { margin-top: 10px; }

                .aw {
                    position: relative;
                    height: 48px;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                }
                .aw-track {
                    position: absolute;
                    left: 50%;
                    transform: translateX(-50%);
                    width: 1px;
                    height: 100%;
                    background: rgba(255,255,255,0.045);
                }
                .aw-dot {
                    position: absolute;
                    left: 50%;
                    transform: translateX(-50%);
                    width: 10px;
                    height: 2px;
                    border-radius: 1px;
                    animation: particleFall 2.2s linear infinite;
                }
                .aw-dot-up { animation-name: particleFallUp; }
                .aw-proto {
                    font-family: var(--font-mono, 'JetBrains Mono', monospace);
                    font-size: 0.5rem;
                    letter-spacing: 0.12em;
                    color: #64748b;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    position: relative;
                    z-index: 2;
                }
                .aw-proto-tag {
                    padding: 1px 6px;
                    border-radius: 3px;
                    font-size: 0.45rem;
                    letter-spacing: 0.08em;
                }

                .as-bar {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 8px 13px;
                    border-top: 1px solid rgba(255,255,255,0.04);
                    margin-top: 12px;
                    font-family: var(--font-mono, 'JetBrains Mono', monospace);
                    font-size: 0.55rem;
                    color: #475569;
                    letter-spacing: 0.06em;
                }

                .dp-col { flex: 1; padding: 14px; }
                .dp-step {
                    font-family: var(--font-mono, 'JetBrains Mono', monospace);
                    font-size: 0.6rem;
                    color: #94a3b8;
                    padding: 4px 0;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }
                .dp-arrow {
                    color: #475569;
                    font-size: 0.55rem;
                    padding-left: 2px;
                }
                .dp-divider {
                    width: 1px;
                    background: rgba(255,255,255,0.05);
                    margin: 8px 0;
                    flex-shrink: 0;
                }

                .dc {
                    display: flex;
                    gap: 10px;
                    padding: 12px 0;
                    border-bottom: 1px solid rgba(255,255,255,0.03);
                }
                .dc:last-child { border-bottom: none; }
                .dc-icon {
                    color: #10b981;
                    font-size: 0.65rem;
                    margin-top: 3px;
                    opacity: 0.7;
                    flex-shrink: 0;
                }
                .dc-title {
                    font-family: var(--font-mono, 'JetBrains Mono', monospace);
                    font-size: 0.68rem;
                    color: #cbd5e1;
                    font-weight: 600;
                    margin-bottom: 2px;
                }
                .dc-desc {
                    font-family: var(--font-mono, 'JetBrains Mono', monospace);
                    font-size: 0.55rem;
                    color: #94a3b8;
                    line-height: 1.6;
                }

                .out-grid {
                    display: grid;
                    grid-template-columns: repeat(5, 1fr);
                    gap: 10px;
                    padding: 18px;
                }
                .out-card {
                    background: rgba(8,10,16,0.8);
                    border: 1px solid rgba(255,255,255,0.04);
                    border-radius: 5px;
                    padding: 14px 12px;
                    border-left: 2px solid rgba(249,115,22,0.35);
                    transition: border-color 0.3s ease, background 0.3s ease, transform 0.2s ease;
                }
                .out-card:hover {
                    border-color: rgba(249,115,22,0.5);
                    background: rgba(12,14,22,0.95);
                    transform: translateY(-1px);
                }
                .out-sym {
                    font-size: 0.7rem;
                    color: #f97316;
                    margin-bottom: 8px;
                    animation: outputGlow 3s ease-in-out infinite;
                }
                .out-title {
                    font-family: var(--font-mono, 'JetBrains Mono', monospace);
                    font-size: 0.62rem;
                    color: #e2e8f0;
                    font-weight: 600;
                    margin-bottom: 3px;
                    letter-spacing: -0.01em;
                }
                .out-desc {
                    font-family: var(--font-mono, 'JetBrains Mono', monospace);
                    font-size: 0.45rem;
                    color: #64748b;
                    line-height: 1.4;
                }

                .pipe-sweep {
                    position: absolute;
                    inset: 0;
                    background: linear-gradient(90deg, transparent 0%, rgba(16,185,129,0.018) 50%, transparent 100%);
                    background-size: 200% 100%;
                    animation: pipeSweep 7s ease-in-out infinite;
                    pointer-events: none;
                    border-radius: 6px;
                }
                .pipe-legend {
                    display: flex;
                    gap: 20px;
                    flex-wrap: wrap;
                    padding: 14px 18px 10px;
                    border-bottom: 1px solid rgba(255,255,255,0.04);
                }
                .pipe-legend-item {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    font-family: var(--font-mono, 'JetBrains Mono', monospace);
                    font-size: 0.45rem;
                    letter-spacing: 0.12em;
                    text-transform: uppercase;
                    color: #64748b;
                }
                .pipe-legend-dot {
                    width: 10px;
                    height: 2px;
                    border-radius: 1px;
                }
                .pipe-rows {
                    padding: 20px 18px 18px;
                    position: relative;
                }
                .pipe-row { display: flex; align-items: flex-start; }
                .pipe-node {
                    flex: 1;
                    min-width: 0;
                    text-align: center;
                    padding: 0 3px;
                    position: relative;
                    transition: transform 0.2s ease;
                }
                .pipe-node:hover { transform: translateY(-2px); }
                .pipe-phase-tag {
                    font-family: var(--font-mono, 'JetBrains Mono', monospace);
                    font-size: 0.38rem;
                    letter-spacing: 0.14em;
                    text-transform: uppercase;
                    padding: 2px 6px;
                    border: 1px solid;
                    border-radius: 3px;
                    display: inline-block;
                    margin-bottom: 8px;
                    font-weight: 600;
                }
                .pipe-num {
                    width: 28px;
                    height: 28px;
                    border: 1px solid;
                    border-radius: 5px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-family: var(--font-mono, 'JetBrains Mono', monospace);
                    font-size: 0.58rem;
                    font-weight: 700;
                    margin: 0 auto 6px;
                    transition: transform 0.2s ease;
                }
                .pipe-node:hover .pipe-num { transform: scale(1.08); }
                .pipe-name {
                    font-family: var(--font-mono, 'JetBrains Mono', monospace);
                    font-size: 0.6rem;
                    color: #e2e8f0;
                    font-weight: 600;
                    letter-spacing: -0.01em;
                    margin-bottom: 2px;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                .pipe-desc {
                    font-family: var(--font-mono, 'JetBrains Mono', monospace);
                    font-size: 0.42rem;
                    color: #64748b;
                    line-height: 1.3;
                }
                .pipe-out-badge {
                    font-family: var(--font-mono, 'JetBrains Mono', monospace);
                    font-size: 0.38rem;
                    letter-spacing: 0.1em;
                    font-weight: 700;
                    padding: 2px 7px;
                    border: 1px solid;
                    border-radius: 3px;
                    display: inline-block;
                    margin-top: 6px;
                }
                .pipe-hconn {
                    width: 28px;
                    display: flex;
                    align-items: center;
                    position: relative;
                    flex-shrink: 0;
                    align-self: center;
                    height: 28px;
                    margin-top: 22px;
                }
                .pipe-hline {
                    width: 100%;
                    height: 1px;
                    background: var(--pc);
                    opacity: 0.18;
                }
                .pipe-hdot {
                    position: absolute;
                    left: 0;
                    width: 10px;
                    height: 2px;
                    border-radius: 1px;
                    background: var(--pc);
                    box-shadow: 0 0 8px var(--pc);
                    animation: pipeHFlow 1.8s linear infinite;
                }
                .pipe-vconn {
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    height: 36px;
                    position: relative;
                    gap: 8px;
                }
                .pipe-vline {
                    width: 1px;
                    height: 100%;
                    background: linear-gradient(to bottom, rgba(16,185,129,0.2), rgba(139,92,246,0.2));
                    position: relative;
                    border-radius: 1px;
                }
                .pipe-vdot {
                    position: absolute;
                    left: -1.5px;
                    width: 4px;
                    height: 10px;
                    border-radius: 2px;
                    background: #10b981;
                    box-shadow: 0 0 8px rgba(16,185,129,0.6);
                    animation: pipeVFlow 1.6s ease-in-out infinite;
                }
                .pipe-vlabel {
                    font-family: var(--font-mono, 'JetBrains Mono', monospace);
                    font-size: 0.4rem;
                    letter-spacing: 0.1em;
                    color: #475569;
                    text-transform: uppercase;
                }

                .zone-e-glow {
                    position: absolute;
                    top: 0;
                    left: 50%;
                    transform: translateX(-50%);
                    width: 60%;
                    height: 1px;
                    background: linear-gradient(90deg, transparent, rgba(249,115,22,0.4), transparent);
                    box-shadow: 0 0 20px rgba(249,115,22,0.15);
                }

                @media (max-width: 1023px) {
                    .arch-grid { grid-template-columns: 1fr !important; }
                    .arch-right { border-left: none !important; padding-left: 0 !important; margin-left: 0 !important; margin-top: 40px; }
                    .an-row-3 { flex-wrap: wrap; }
                    .an-row-3 .an { flex: 1 1 45%; }
                    .dp-grid { flex-direction: column; }
                    .dp-divider { width: 100%; height: 1px; margin: 0 14px; }
                    .out-grid { grid-template-columns: repeat(2, 1fr) !important; }
                }
                @media (max-width: 900px) {
                    .pipe-row { flex-wrap: wrap; gap: 4px 0; }
                    .pipe-hconn { display: none; }
                    .pipe-node { flex: 1 1 30%; padding: 8px 6px; text-align: left; display: flex; align-items: center; gap: 10px; }
                    .pipe-num { margin: 0; flex-shrink: 0; }
                    .pipe-phase-tag { margin: 0; margin-right: 4px; flex-shrink: 0; }
                    .pipe-node:hover { transform: none; }
                    .pipe-vconn { height: 16px; }
                    .pipe-vconn .pipe-vline { display: none; }
                    .pipe-vconn .pipe-vdot { display: none; }
                }
                @media (max-width: 640px) {
                    .an-row-4 { flex-wrap: wrap; }
                    .an-row-4 .an { flex: 1 1 45%; }
                    .an-sat-row .an-sat { flex: 1 1 30% !important; }
                    .pipe-node { flex: 1 1 45%; }
                    .out-grid { grid-template-columns: 1fr !important; }
                }
            `}</style>

            <section style={{
                position: 'relative',
                padding: '100px 0 80px',
                background: '#0a0d14',
                overflow: 'hidden',
            }}>
                {/* Background layers */}
                <div style={{
                    position: 'absolute', inset: 0,
                    backgroundImage: 'radial-gradient(rgba(255,255,255,0.025) 1px, transparent 1px)',
                    backgroundSize: '24px 24px',
                    pointerEvents: 'none',
                }} />
                <div style={{
                    position: 'absolute', inset: 0,
                    backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 239px, rgba(255,255,255,0.01) 239px, rgba(255,255,255,0.01) 240px)',
                    pointerEvents: 'none',
                }} />
                <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0, height: 60,
                    background: 'linear-gradient(to bottom, var(--bg-primary, #0a0d14), transparent)',
                    zIndex: 2, pointerEvents: 'none',
                }} />
                <div style={{
                    position: 'absolute', top: 24, right: 40,
                    width: 28, height: 28, borderRadius: '50%',
                    background: 'conic-gradient(from 0deg, transparent 0deg, rgba(16,185,129,0.06) 40deg, transparent 80deg)',
                    animation: 'subtleSweep 10s linear infinite',
                    pointerEvents: 'none', zIndex: 1,
                }} />

                <div style={{ position: 'relative', zIndex: 1, maxWidth: 1200, margin: '0 auto', padding: '0 2rem' }}>

                    {/* ════════════════ HEADER ════════════════ */}
                    <motion.header
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: '-60px' }}
                        style={{ textAlign: 'center', marginBottom: 64 }}
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
                            <span style={{
                                width: 4, height: 4, borderRadius: '50%', background: '#10b981',
                                animation: 'ledPulse 2s ease-in-out infinite',
                            }} />
                            Architecture
                        </div>

                        <h2 style={{
                            fontSize: 'clamp(1.8rem, 3.5vw, 2.6rem)',
                            fontWeight: 700, color: '#f1f5f9',
                            letterSpacing: '-0.03em', lineHeight: 1.15,
                            marginBottom: 14,
                        }}>
                            Satellite to Decision<br />in Five Zones
                        </h2>

                        <p style={{
                            color: '#94a3b8', fontSize: '0.92rem',
                            maxWidth: 540, margin: '0 auto 20px', lineHeight: 1.7,
                        }}>
                            From orbit to operator action — data sovereignty by design.
                            Raw SAR never leaves the operator&apos;s hardware.
                        </p>

                        <div style={{
                            display: 'inline-flex', alignItems: 'center', gap: 12,
                            fontFamily: 'var(--font-mono, monospace)',
                            fontSize: '0.5rem', color: '#475569', letterSpacing: '0.1em',
                        }}>
                            <span style={{ color: '#64748b' }}>{utc}</span>
                            <span style={{ color: '#1e293b' }}>│</span>
                            <span>UPTIME 847d 14h</span>
                            <span style={{ color: '#1e293b' }}>│</span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                <span style={{
                                    width: 4, height: 4, borderRadius: '50%', background: '#10b981',
                                    animation: 'ledPulse 2s ease-in-out infinite',
                                }} />
                                <span style={{ color: '#10b981', opacity: 0.65 }}>ALL SYSTEMS NOMINAL</span>
                            </span>
                        </div>
                    </motion.header>

                    {/* ════════════════ MAIN GRID ════════════════ */}
                    <div className="arch-grid" style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 380px',
                        gap: 0,
                        alignItems: 'start',
                    }}>

                        {/* ─────── LEFT: VERTICAL FLOW D → C → B → A ─────── */}
                        <div>

                            {/* ═══ ZONE D — Space Segment ═══ */}
                            <motion.div
                                initial={{ opacity: 0, y: -16 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true, margin: '-40px' }}
                                transition={{ duration: 0.6 }}
                                className="az"
                                style={{
                                    border: '1px dashed rgba(99,102,241,0.22)',
                                    background: 'rgba(99,102,241,0.018)',
                                }}
                            >
                                <div className="az-label" style={{ background: '#0a0d14', color: '#a5b4fc' }}>
                                    ZONE D <span className="az-class">// SPACE SEGMENT</span>
                                </div>

                                <div className="an-sat-row" style={{ display: 'flex', gap: 10 }}>
                                    {satellites.map(sat => (
                                        <div key={sat.name} className="an an-sat" style={{ flex: 1, borderLeft: '2px solid rgba(99,102,241,0.3)' }}>
                                            <sat.Icon />
                                            <div className="an-sat-info">
                                                <div className="an-name">{sat.name}</div>
                                                <div className="an-sub">{sat.sub}</div>
                                                <div className="an-sub" style={{ color: '#818cf8', opacity: 0.75, marginTop: 2 }}>{sat.band}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </motion.div>

                            {/* Wire D → C */}
                            <div className="aw">
                                <div className="aw-track" />
                                <div className="aw-dot" style={{
                                    background: '#818cf8',
                                    boxShadow: '0 0 10px rgba(129,140,248,0.5)',
                                    animationDelay: '0s',
                                }} />
                                <div className="aw-dot" style={{
                                    background: '#f59e0b',
                                    boxShadow: '0 0 10px rgba(245,158,11,0.4)',
                                    animationDelay: '0.9s',
                                }} />
                                <div className="aw-proto">
                                    SAR RAW DATA
                                    <span className="aw-proto-tag" style={{
                                        background: 'rgba(99,102,241,0.1)',
                                        color: '#a5b4fc',
                                        border: '1px solid rgba(99,102,241,0.2)',
                                    }}>L / C / X-BAND</span>
                                </div>
                            </div>

                            {/* ═══ ZONE C — Scientific Data Sources ═══ */}
                            <motion.div
                                initial={{ opacity: 0, y: -16 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true, margin: '-40px' }}
                                transition={{ duration: 0.6, delay: 0.08 }}
                                className="az"
                                style={{
                                    border: '1px dashed rgba(245,158,11,0.15)',
                                    background: 'rgba(245,158,11,0.012)',
                                }}
                            >
                                <div className="az-label" style={{ background: '#0a0d14', color: '#fbbf24' }}>
                                    ZONE C <span className="az-class">// SCIENTIFIC DATA SOURCES</span>
                                </div>
                                <div className="an-row-4" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                    {dataSources.map(n => (
                                        <div key={n.name} className="an" style={{ flex: '1 1 140px', borderLeft: '2px solid rgba(245,158,11,0.25)' }}>
                                            <span className="an-led" style={{ color: '#f59e0b', background: '#f59e0b' }} />
                                            <div>
                                                <div className="an-name">{n.name}</div>
                                                <div className="an-sub">{n.sub}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </motion.div>

                            {/* Wire C → B */}
                            <div className="aw">
                                <div className="aw-track" />
                                <div className="aw-dot" style={{
                                    background: '#f59e0b',
                                    boxShadow: '0 0 10px rgba(245,158,11,0.4)',
                                    animationDelay: '0s',
                                }} />
                                <div className="aw-dot" style={{
                                    background: '#10b981',
                                    boxShadow: '0 0 10px rgba(16,185,129,0.4)',
                                    animationDelay: '0.9s',
                                }} />
                                <div className="aw-proto">
                                    ANCILLARY CONTEXT
                                    <span className="aw-proto-tag" style={{
                                        background: 'rgba(245,158,11,0.08)',
                                        color: '#fbbf24',
                                        border: '1px solid rgba(245,158,11,0.2)',
                                    }}>REST / STAC</span>
                                </div>
                            </div>

                            {/* ═══ ZONE B — Processing Layer ═══ */}
                            <motion.div
                                initial={{ opacity: 0, y: -16 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true, margin: '-40px' }}
                                transition={{ duration: 0.6, delay: 0.16 }}
                                className="az"
                                style={{
                                    border: '1px dashed rgba(16,185,129,0.2)',
                                    background: 'rgba(16,185,129,0.015)',
                                }}
                            >
                                <div className="az-label" style={{ background: '#0a0d14', color: '#34d399' }}>
                                    ZONE B <span className="az-class">// PROCESSING LAYER</span>
                                </div>

                                <div className="an-row-3" style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
                                    <div className="an" style={{ flex: 1, borderLeft: '2px solid rgba(16,185,129,0.35)' }}>
                                        <span className="an-led" style={{ color: '#10b981', background: '#10b981' }} />
                                        <div>
                                            <div className="an-name">sar-gateway</div>
                                            <div className="an-sub">Axum · Tokio · SSE</div>
                                        </div>
                                    </div>
                                    <div style={{
                                        display: 'flex', alignItems: 'center',
                                        color: '#334155', fontFamily: 'var(--font-mono, monospace)',
                                        fontSize: '0.7rem', flexShrink: 0, padding: '0 2px',
                                    }}>→</div>
                                    <div className="an" style={{ flex: 1, borderLeft: '2px solid rgba(16,185,129,0.35)' }}>
                                        <span className="an-led" style={{ color: '#10b981', background: '#10b981' }} />
                                        <div>
                                            <div className="an-name">sar_processor</div>
                                            <div className="an-sub">Rayon · HDF5-rust</div>
                                        </div>
                                    </div>
                                    <div style={{
                                        display: 'flex', alignItems: 'center',
                                        color: '#334155', fontFamily: 'var(--font-mono, monospace)',
                                        fontSize: '0.7rem', flexShrink: 0, padding: '0 2px',
                                    }}>→</div>
                                    <div className="an" style={{ flex: 1, borderLeft: '2px solid rgba(16,185,129,0.35)' }}>
                                        <span className="an-led" style={{ color: '#10b981', background: '#10b981' }} />
                                        <div>
                                            <div className="an-name">COG Streamer</div>
                                            <div className="an-sub">Tile Server</div>
                                        </div>
                                    </div>
                                </div>

                                <div className="as-bar">
                                    <span style={{ color: '#10b981', opacity: 0.4 }}>◈</span>
                                    Local HDF5 / netCDF4 / SAFE File Storage
                                    <span style={{ marginLeft: 'auto', opacity: 0.5 }}>ON-PREMISE</span>
                                </div>
                            </motion.div>

                            {/* Wire B → A */}
                            <div className="aw">
                                <div className="aw-track" />
                                <div className="aw-dot" style={{
                                    background: '#10b981',
                                    boxShadow: '0 0 10px rgba(16,185,129,0.5)',
                                    animationDelay: '0s',
                                }} />
                                <div className="aw-dot" style={{
                                    background: '#3b82f6',
                                    boxShadow: '0 0 10px rgba(59,130,246,0.4)',
                                    animationDelay: '0.8s',
                                }} />
                                <div className="aw-proto">
                                    HTTPS / LOCALHOST:3000
                                    <span className="aw-proto-tag" style={{
                                        background: 'rgba(59,130,246,0.1)',
                                        color: '#60a5fa',
                                        border: '1px solid rgba(59,130,246,0.2)',
                                    }}>TLS 1.3</span>
                                </div>
                            </div>

                            {/* ═══ ZONE A — User Interface (CENTERED) ═══ */}
                            <motion.div
                                initial={{ opacity: 0, y: -16 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true, margin: '-40px' }}
                                transition={{ duration: 0.6, delay: 0.24 }}
                                className="az"
                                style={{
                                    border: '1px dashed rgba(59,130,246,0.18)',
                                    background: 'rgba(59,130,246,0.015)',
                                }}
                            >
                                <div className="az-label" style={{ background: '#0a0d14', color: '#60a5fa' }}>
                                    ZONE A <span className="az-class">// USER INTERFACE</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                                    <div className="an" style={{ borderLeft: '2px solid rgba(59,130,246,0.35)', maxWidth: 340 }}>
                                        <span className="an-led" style={{ color: '#3b82f6', background: '#3b82f6' }} />
                                        <div>
                                            <div className="an-name">NISAR Pro Dashboard</div>
                                            <div className="an-sub">sar-dashboard-v3 · Leaflet · React.js</div>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        </div>

                        {/* ─────── RIGHT: DETAILS ─────── */}
                        <div className="arch-right" style={{
                            borderLeft: '1px solid rgba(255,255,255,0.04)',
                            paddingLeft: 36,
                            marginLeft: 36,
                        }}>

                            {/* Dual-Path Engine */}
                            <motion.div
                                initial={{ opacity: 0, x: 16 }}
                                whileInView={{ opacity: 1, x: 0 }}
                                viewport={{ once: true, margin: '-40px' }}
                                transition={{ duration: 0.6 }}
                                style={{
                                    border: '1px solid rgba(255,255,255,0.04)',
                                    borderRadius: 6,
                                    overflow: 'hidden',
                                    marginBottom: 28,
                                }}
                            >
                                <div style={{
                                    fontFamily: 'var(--font-mono, monospace)',
                                    fontSize: '0.55rem', letterSpacing: '0.16em',
                                    textTransform: 'uppercase', color: '#64748b',
                                    padding: '14px 16px 0', display: 'flex', alignItems: 'center', gap: 8,
                                }}>
                                    <div style={{ width: 8, height: 1, background: '#10b981', opacity: 0.5 }} />
                                    Dual-Path Engine
                                </div>

                                <div className="dp-grid" style={{ display: 'flex' }}>
                                    <div className="dp-col" style={{ background: 'rgba(16,185,129,0.015)' }}>
                                        <div style={{
                                            fontFamily: 'var(--font-mono, monospace)',
                                            fontSize: '0.6rem', fontWeight: 700,
                                            color: '#10b981', letterSpacing: '0.1em',
                                            marginBottom: 2,
                                        }}>FAST PATH</div>
                                        <div style={{
                                            fontFamily: 'var(--font-mono, monospace)',
                                            fontSize: '0.48rem', color: '#475569',
                                            marginBottom: 10, letterSpacing: '0.04em',
                                        }}>Pre-processed GUNW / netCDF</div>
                                        {['GUNW Parse', 'Extract Displacement', 'Context Merge', 'Threat Score Engine'].map((s, i) => (
                                            <div key={s} style={{ display: 'flex', flexDirection: 'column' }}>
                                                <div className="dp-step" style={{ color: i === 3 ? '#10b981' : undefined, opacity: i === 3 ? 0.85 : undefined }}>
                                                    <span style={{ width: 3, height: 3, borderRadius: '50%', background: i === 3 ? '#10b981' : '#475569', flexShrink: 0 }} />
                                                    {s}
                                                </div>
                                                {i < 3 && <div className="dp-arrow">↓</div>}
                                            </div>
                                        ))}
                                    </div>

                                    <div className="dp-divider" />

                                    <div className="dp-col" style={{ background: 'rgba(59,130,246,0.015)' }}>
                                        <div style={{
                                            fontFamily: 'var(--font-mono, monospace)',
                                            fontSize: '0.6rem', fontWeight: 700,
                                            color: '#3b82f6', letterSpacing: '0.1em',
                                            marginBottom: 2,
                                        }}>FULL PATH</div>
                                        <div style={{
                                            fontFamily: 'var(--font-mono, monospace)',
                                            fontSize: '0.48rem', color: '#475569',
                                            marginBottom: 10, letterSpacing: '0.04em',
                                        }}>Raw SLC Complex (14 step)</div>
                                        {['SLC Ingest + Orbit Interp', 'FFT Coregistration', 'Filter → SNAPHU Unwrap', 'Geocode → COG Export'].map((s, i) => (
                                            <div key={s} style={{ display: 'flex', flexDirection: 'column' }}>
                                                <div className="dp-step" style={{ color: i === 3 ? '#3b82f6' : undefined, opacity: i === 3 ? 0.85 : undefined }}>
                                                    <span style={{ width: 3, height: 3, borderRadius: '50%', background: i === 3 ? '#3b82f6' : '#475569', flexShrink: 0 }} />
                                                    {s}
                                                </div>
                                                {i < 3 && <div className="dp-arrow">↓</div>}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </motion.div>

                            {/* Key Decisions */}
                            <motion.div
                                initial={{ opacity: 0, x: 16 }}
                                whileInView={{ opacity: 1, x: 0 }}
                                viewport={{ once: true, margin: '-40px' }}
                                transition={{ duration: 0.6, delay: 0.1 }}
                            >
                                <div style={{
                                    fontFamily: 'var(--font-mono, monospace)',
                                    fontSize: '0.55rem', letterSpacing: '0.16em',
                                    textTransform: 'uppercase', color: '#64748b',
                                    marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8,
                                }}>
                                    <div style={{ width: 8, height: 1, background: '#10b981', opacity: 0.5 }} />
                                    Key Decisions
                                </div>

                                {[
                                    { title: 'Zero Data Upload Policy', desc: '5–30 GB SAR scenes never leave operator hardware. Browser → localhost loopback only.' },
                                    { title: 'SSE Log Streaming', desc: 'Heavy processor ops run async. Real-time stdout piped via Server-Sent Events.' },
                                    { title: 'Cloud-Optimized GeoTIFFs', desc: 'Internal tiling enables sub-meter zoom without loading full-raster into memory.' },
                                    { title: 'Air-Gap Capable', desc: 'Pre-acquired .nc / .h5 files from local drives. 100% offline operation.' },
                                ].map(d => (
                                    <div key={d.title} className="dc">
                                        <span className="dc-icon">◈</span>
                                        <div>
                                            <div className="dc-title">{d.title}</div>
                                            <div className="dc-desc">{d.desc}</div>
                                        </div>
                                    </div>
                                ))}
                            </motion.div>
                        </div>
                    </div>

                    {/* ════════════════ ZONE E — Operational Output ════════════════ */}
                    <motion.div
                        initial={{ opacity: 0, y: 16 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: '-40px' }}
                        transition={{ duration: 0.7, delay: 0.1 }}
                        style={{
                            marginTop: 48,
                            border: '1px solid rgba(249,115,22,0.18)',
                            borderRadius: 6,
                            overflow: 'hidden',
                            position: 'relative',
                            background: 'rgba(249,115,22,0.012)',
                        }}
                    >
                        <div className="zone-e-glow" />

                        <div style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '14px 18px',
                            borderBottom: '1px solid rgba(249,115,22,0.1)',
                            background: 'rgba(249,115,22,0.02)',
                            position: 'relative',
                            zIndex: 1,
                        }}>
                            <div style={{
                                fontFamily: 'var(--font-mono, monospace)',
                                fontSize: '0.55rem', letterSpacing: '0.16em',
                                textTransform: 'uppercase', color: '#fb923c',
                                display: 'flex', alignItems: 'center', gap: 8,
                            }}>
                                <div style={{ width: 8, height: 1, background: '#f97316', opacity: 0.6 }} />
                                ZONE E // OPERATIONAL OUTPUT
                            </div>
                            <div style={{
                                fontFamily: 'var(--font-mono, monospace)',
                                fontSize: '0.45rem', color: '#475569', letterSpacing: '0.08em',
                                display: 'flex', alignItems: 'center', gap: 6,
                            }}>
                                <span style={{
                                    width: 4, height: 4, borderRadius: '50%', background: '#f97316',
                                    animation: 'ledPulse 2s ease-in-out infinite',
                                }} />
                                DECISION INTEL
                            </div>
                        </div>

                        <div className="out-grid">
                            {outputs.map((out, i) => (
                                <motion.div
                                    key={out.title}
                                    className="out-card"
                                    initial={{ opacity: 0, y: 8 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true }}
                                    transition={{ delay: i * 0.06, duration: 0.35 }}
                                >
                                    <div className="out-sym" style={{ animationDelay: `${i * 0.5}s` }}>{out.sym}</div>
                                    <div className="out-title">{out.title}</div>
                                    <div className="out-desc">{out.desc}</div>
                                </motion.div>
                            ))}
                        </div>
                    </motion.div>

                    {/* ════════════════ PIPELINE DIAGRAM ════════════════ */}
                    <motion.div
                        initial={{ opacity: 0, y: 16 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: '-40px' }}
                        transition={{ duration: 0.7, delay: 0.15 }}
                        style={{
                            marginTop: 40,
                            border: '1px solid rgba(255,255,255,0.04)',
                            borderRadius: 6,
                            overflow: 'hidden',
                            position: 'relative',
                            background: 'rgba(255,255,255,0.008)',
                        }}
                    >
                        <div className="pipe-sweep" />

                        <div style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '14px 18px',
                            borderBottom: '1px solid rgba(255,255,255,0.04)',
                            background: 'rgba(255,255,255,0.015)',
                            position: 'relative',
                            zIndex: 1,
                        }}>
                            <div style={{
                                fontFamily: 'var(--font-mono, monospace)',
                                fontSize: '0.55rem', letterSpacing: '0.14em',
                                textTransform: 'uppercase', color: '#64748b',
                                display: 'flex', alignItems: 'center', gap: 8,
                            }}>
                                <div style={{ width: 8, height: 1, background: '#3b82f6', opacity: 0.5 }} />
                                Full-Path InSAR Processing Stack
                                <span style={{ opacity: 0.4, fontSize: '0.48rem' }}>— sar_processor binary</span>
                            </div>
                            <div style={{
                                fontFamily: 'var(--font-mono, monospace)',
                                fontSize: '0.45rem', color: '#475569', letterSpacing: '0.08em',
                                display: 'flex', alignItems: 'center', gap: 6,
                            }}>
                                <span style={{
                                    width: 4, height: 4, borderRadius: '50%', background: '#10b981',
                                    animation: 'ledPulse 2.5s ease-in-out infinite',
                                }} />
                                14 STEPS
                            </div>
                        </div>

                        <div className="pipe-legend" style={{ position: 'relative', zIndex: 1 }}>
                            {phases.map(p => (
                                <div key={p.name} className="pipe-legend-item">
                                    <div className="pipe-legend-dot" style={{ background: p.color, boxShadow: `0 0 6px ${p.color}40` }} />
                                    {p.name}
                                </div>
                            ))}
                        </div>

                        <div className="pipe-rows">
                            {renderPipelineRow(pipelineSteps.slice(0, 7), 0)}

                            <div className="pipe-vconn">
                                <div className="pipe-vline">
                                    <div className="pipe-vdot" />
                                </div>
                                <span className="pipe-vlabel">continues ▼</span>
                            </div>

                            {renderPipelineRow(pipelineSteps.slice(7), 7)}
                        </div>
                    </motion.div>

                </div>
            </section>
        </>
    )
}

export default ProcessingPipeline