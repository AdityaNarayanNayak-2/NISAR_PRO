import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'

const footerLinks = {
    Product: [
        { label: 'Features', path: '/#features' },
        { label: 'Technology', path: '/technology' },
        { label: 'Demo', path: '/demo' },
    ],
    Resources: [
        { label: 'Documentation', url: 'https://gitlab.com/Aditya-Narayan-Nayak/nisar_pro/-/wikis/home' },
        { label: 'API Reference', url: '#' },
        { label: 'Changelog', url: 'https://gitlab.com/Aditya-Narayan-Nayak/nisar_pro/-/commits/main' },
    ],
    Company: [
        { label: 'About', path: '#' },
        { label: 'Blog', url: '#' },
        { label: 'Contact', url: 'mailto:contact@saranalyzer.io' },
    ]
}

const socialLinks = [
    {
        name: 'GitLab', url: 'https://gitlab.com/Aditya-Narayan-Nayak/nisar_pro', icon: (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.65 14.39L12 22.13 1.35 14.39a.84.84 0 0 1-.3-.94l1.22-3.78 2.44-7.51A.42.42 0 0 1 4.82 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.49h8.1l2.44-7.51A.42.42 0 0 1 18.6 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.51L23 13.45a.84.84 0 0 1-.35.94z" />
            </svg>
        )
    },
    {
        name: 'LinkedIn', url: 'https://linkedin.com/in/aditya-narayan-nayak', icon: (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
            </svg>
        )
    },
    {
        name: 'GitHub', url: 'https://github.com', icon: (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
            </svg>
        )
    }
]

function Footer() {
    return (
        <>
            <style>{`
                @keyframes radarSweep {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                @keyframes scanLine {
                    0% { top: -2%; opacity: 0; }
                    5% { opacity: 1; }
                    95% { opacity: 1; }
                    100% { top: 102%; opacity: 0; }
                }
                @keyframes statusPulse {
                    0%, 100% { opacity: 1; box-shadow: 0 0 4px rgba(16,185,129,0.6); }
                    50% { opacity: 0.4; box-shadow: 0 0 0px rgba(16,185,129,0); }
                }
                @keyframes signalTravel {
                    0% { left: -5%; opacity: 0; }
                    5% { opacity: 1; }
                    95% { opacity: 1; }
                    100% { left: 105%; opacity: 0; }
                }
                @keyframes cursorBlink {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0; }
                }
                @keyframes contourDriftA {
                    0%, 100% { transform: translate(0, 0) scale(1); }
                    33% { transform: translate(3px, -2px) scale(1.005); }
                    66% { transform: translate(-1px, 1px) scale(0.998); }
                }
                @keyframes contourDriftB {
                    0%, 100% { transform: translate(0, 0); }
                    50% { transform: translate(-2px, 2px); }
                }
                @keyframes poiPing {
                    0% { r: 2; opacity: 0.8; }
                    100% { r: 12; opacity: 0; }
                }
                @keyframes fringeShift {
                    0% { background-position: 0 0; }
                    100% { background-position: 60px 0; }
                }
                .flink { display: flex; align-items: center; gap: 8px; color: #374151; text-decoration: none; font-size: 0.84rem; transition: color 0.3s ease; }
                .flink:hover { color: #94a3b8; }
                .flink:hover .fdot { background: #10b981; box-shadow: 0 0 8px rgba(16,185,129,0.5); }
                .fdot { width: 3px; height: 3px; border-radius: 50%; background: #111827; transition: all 0.3s ease; flex-shrink: 0; }
                .snode { width: 30px; height: 30px; border: 1px solid rgba(255,255,255,0.06); border-radius: 5px; display: flex; align-items: center; justify-content: center; color: #374151; transition: all 0.3s ease; text-decoration: none; }
                .snode:hover { border-color: rgba(16,185,129,0.4); color: #10b981; background: rgba(16,185,129,0.04); }
                .blegal { color: #1f2937; text-decoration: none; font-size: 0.68rem; transition: color 0.3s ease; letter-spacing: 0.06em; font-family: var(--font-mono, monospace); }
                .blegal:hover { color: #4b5563; }
            `}</style>

            <footer style={{
                position: 'relative',
                background: '#050709',
                overflow: 'hidden',
                borderTop: '1px solid rgba(16,185,129,0.08)',
            }}>

                {/* ── LAYER 0: Top fade gradient ── */}
                <div style={{
                    position: 'absolute',
                    top: 0, left: 0, right: 0,
                    height: '80px',
                    background: 'linear-gradient(to bottom, var(--bg-primary, #0a0a0a), transparent)',
                    zIndex: 2,
                    pointerEvents: 'none',
                }} />

                {/* ── LAYER 0: Dot grid ── */}
                <div style={{
                    position: 'absolute',
                    inset: 0,
                    backgroundImage: 'radial-gradient(rgba(255,255,255,0.025) 1px, transparent 1px)',
                    backgroundSize: '20px 20px',
                    pointerEvents: 'none',
                }} />

                {/* ── LAYER 0: Interference fringe strip (SAR aesthetic) ── */}
                <div style={{
                    position: 'absolute',
                    top: '40%',
                    left: 0,
                    right: 0,
                    height: '120px',
                    opacity: 0.018,
                    backgroundImage: `repeating-linear-gradient(
                        90deg,
                        #10b981 0px,
                        transparent 2px,
                        transparent 8px,
                        #10b981 10px,
                        #065f46 11px,
                        transparent 12px,
                        transparent 18px,
                        #10b981 20px,
                        transparent 22px,
                        transparent 30px
                    )`,
                    backgroundSize: '60px 100%',
                    animation: 'fringeShift 8s linear infinite',
                    pointerEvents: 'none',
                }} />

                {/* ── LAYER 1: Primary topographic contour map ── */}
                <svg style={{
                    position: 'absolute',
                    right: '-2%',
                    top: '8%',
                    width: '420px',
                    height: '320px',
                    opacity: 0.12,
                    pointerEvents: 'none',
                    animation: 'contourDriftA 30s ease-in-out infinite',
                }} viewBox="0 0 420 320" fill="none">
                    {/* Contour lines — tighter on east (steeper slope), wider on west */}
                    <path d="M 210,15 C 295,10 380,65 392,145 C 404,225 345,295 265,308 C 185,321 90,285 48,210 C 6,135 30,55 125,22 C 155,12 180,13 210,15 Z" stroke="#10b981" strokeWidth="0.5" />
                    <path d="M 210,42 C 278,38 350,82 360,148 C 370,214 325,272 258,282 C 191,292 115,265 80,205 C 45,145 60,78 138,48 C 162,38 185,40 210,42 Z" stroke="#10b981" strokeWidth="0.5" />
                    <path d="M 210,68 C 262,65 320,98 328,150 C 336,202 305,248 252,256 C 199,264 140,245 112,200 C 84,155 92,102 150,74 C 168,64 188,65 210,68 Z" stroke="#10b981" strokeWidth="0.55" />
                    <path d="M 210,92 C 248,90 292,112 298,152 C 304,192 282,225 244,231 C 206,237 165,224 144,192 C 123,160 128,122 164,98 C 178,90 194,90 210,92 Z" stroke="#10b981" strokeWidth="0.55" />
                    <path d="M 210,114 C 236,112 266,128 270,155 C 274,182 258,206 234,210 C 210,214 188,204 175,182 C 162,160 164,134 186,117 C 194,112 202,112 210,114 Z" stroke="#10b981" strokeWidth="0.6" />
                    <path d="M 210,135 C 224,134 244,144 246,160 C 248,176 238,190 224,192 C 210,194 198,187 191,174 C 184,161 188,142 200,136 C 203,134 207,134 210,135 Z" stroke="#10b981" strokeWidth="0.65" />
                    <path d="M 210,153 C 216,152 226,157 227,164 C 228,171 223,178 216,179 C 209,180 204,176 201,170 C 198,164 200,156 206,153 C 207,152 209,152 210,153 Z" stroke="#10b981" strokeWidth="0.7" />

                    {/* Cross-hair measurement lines */}
                    <line x1="20" y1="160" x2="410" y2="160" stroke="#10b981" strokeWidth="0.25" strokeDasharray="3 9" />
                    <line x1="210" y1="5" x2="210" y2="318" stroke="#10b981" strokeWidth="0.25" strokeDasharray="3 9" />

                    {/* Tick marks along cross-hairs */}
                    {[70, 120, 170, 220, 270, 320, 370].map(x => (
                        <line key={`vt-${x}`} x1={x} y1="156" x2={x} y2="164" stroke="#10b981" strokeWidth="0.25" />
                    ))}
                    {[40, 90, 140, 190, 240, 290].map(y => (
                        <line key={`ht-${y}`} x1="206" y1={y} x2="214" y2={y} stroke="#10b981" strokeWidth="0.25" />
                    ))}

                    {/* Elevation labels */}
                    <text x="375" y="155" fill="#10b981" fontSize="6" fontFamily="monospace" opacity="0.5">240m</text>
                    <text x="340" y="178" fill="#10b981" fontSize="5.5" fontFamily="monospace" opacity="0.4">180m</text>
                    <text x="305" y="200" fill="#10b981" fontSize="5" fontFamily="monospace" opacity="0.35">120m</text>
                    <text x="268" y="220" fill="#10b981" fontSize="5" fontFamily="monospace" opacity="0.3">60m</text>

                    {/* Points of interest — deformation monitoring sites */}
                    <g>
                        <circle cx="280" cy="130" r="2" fill="none" stroke="#10b981" strokeWidth="0.5" opacity="0.7" />
                        <line x1="276" y1="130" x2="284" y2="130" stroke="#10b981" strokeWidth="0.4" opacity="0.7" />
                        <line x1="280" y1="126" x2="280" y2="134" stroke="#10b981" strokeWidth="0.4" opacity="0.7" />
                        <circle cx="280" cy="130" fill="#10b981" opacity="0.15">
                            <animate attributeName="r" from="2" to="14" dur="3s" repeatCount="indefinite" />
                            <animate attributeName="opacity" from="0.4" to="0" dur="3s" repeatCount="indefinite" />
                        </circle>
                        <text x="286" y="127" fill="#10b981" fontSize="4.5" fontFamily="monospace" opacity="0.45">DAM-07</text>
                    </g>
                    <g>
                        <circle cx="160" cy="200" r="2" fill="none" stroke="#10b981" strokeWidth="0.5" opacity="0.5" />
                        <line x1="157" y1="200" x2="163" y2="200" stroke="#10b981" strokeWidth="0.4" opacity="0.5" />
                        <line x1="160" y1="197" x2="160" y2="203" stroke="#10b981" strokeWidth="0.4" opacity="0.5" />
                        <circle cx="160" cy="200" fill="#10b981" opacity="0.15">
                            <animate attributeName="r" from="2" to="12" dur="4s" begin="1.5s" repeatCount="indefinite" />
                            <animate attributeName="opacity" from="0.3" to="0" dur="4s" begin="1.5s" repeatCount="indefinite" />
                        </circle>
                        <text x="165" y="198" fill="#10b981" fontSize="4.5" fontFamily="monospace" opacity="0.35">RSV-03</text>
                    </g>

                    {/* Displacement vector arrow */}
                    <line x1="280" y1="132" x2="276" y2="140" stroke="#ef4444" strokeWidth="0.4" opacity="0.4" markerEnd="url(#arrowRed)" />
                    <defs>
                        <marker id="arrowRed" markerWidth="4" markerHeight="4" refX="3" refY="2" orient="auto">
                            <path d="M0,0 L4,2 L0,4" fill="none" stroke="#ef4444" strokeWidth="0.4" opacity="0.4" />
                        </marker>
                    </defs>
                    <text x="268" y="147" fill="#ef4444" fontSize="4" fontFamily="monospace" opacity="0.35">-12.4mm/yr</text>
                </svg>

                {/* ── LAYER 1: Secondary contour cluster ── */}
                <svg style={{
                    position: 'absolute',
                    left: '3%',
                    bottom: '12%',
                    width: '180px',
                    height: '140px',
                    opacity: 0.06,
                    pointerEvents: 'none',
                    animation: 'contourDriftB 35s ease-in-out infinite',
                }} viewBox="0 0 180 140" fill="none">
                    <path d="M 90,8 C 130,5 168,38 170,72 C 172,106 145,132 112,136 C 79,140 42,122 28,92 C 14,62 30,28 62,14 C 72,9 81,8 90,8 Z" stroke="#10b981" strokeWidth="0.5" />
                    <path d="M 90,28 C 118,26 148,50 150,74 C 152,98 132,118 108,121 C 84,124 58,112 48,90 C 38,68 46,44 68,32 C 75,28 82,27 90,28 Z" stroke="#10b981" strokeWidth="0.5" />
                    <path d="M 90,48 C 108,46 128,62 129,78 C 130,94 116,108 100,110 C 84,112 70,104 63,90 C 56,76 62,58 78,49 C 82,47 86,47 90,48 Z" stroke="#10b981" strokeWidth="0.55" />
                    <path d="M 90,66 C 100,65 112,74 112,82 C 112,90 105,97 97,98 C 89,99 82,94 79,87 C 76,80 79,70 86,66 C 87,65 89,65 90,66 Z" stroke="#10b981" strokeWidth="0.6" />
                    <text x="135" y="76" fill="#10b981" fontSize="5" fontFamily="monospace" opacity="0.6">90m</text>
                    <text x="115" y="94" fill="#10b981" fontSize="4.5" fontFamily="monospace" opacity="0.5">45m</text>
                </svg>

                {/* ── LAYER 1: Radar sweep behind brand ── */}
                <div style={{
                    position: 'absolute',
                    left: '42px',
                    top: '42px',
                    width: '72px',
                    height: '72px',
                    borderRadius: '50%',
                    background: 'conic-gradient(from 0deg, transparent 0deg, rgba(16,185,129,0.06) 40deg, transparent 80deg)',
                    animation: 'radarSweep 8s linear infinite',
                    pointerEvents: 'none',
                    zIndex: 0,
                }} />
                <div style={{
                    position: 'absolute',
                    left: '72px',
                    top: '72px',
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    border: '1px solid rgba(16,185,129,0.1)',
                    pointerEvents: 'none',
                    zIndex: 0,
                }} />
                <div style={{
                    position: 'absolute',
                    left: '64px',
                    top: '64px',
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    border: '1px solid rgba(16,185,129,0.05)',
                    pointerEvents: 'none',
                    zIndex: 0,
                }} />

                {/* ── LAYER 1: Horizontal scan line ── */}
                <div style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    height: '1px',
                    background: 'linear-gradient(90deg, transparent 5%, rgba(16,185,129,0.08) 30%, rgba(16,185,129,0.12) 50%, rgba(16,185,129,0.08) 70%, transparent 95%)',
                    animation: 'scanLine 10s linear infinite',
                    pointerEvents: 'none',
                    zIndex: 1,
                }} />

                {/* ── LAYER 2: HUD corner brackets ── */}
                {[
                    { top: '10px', left: '10px', br: 'none', bb: 'none' },
                    { top: '10px', right: '10px', bl: 'none', bb: 'none' },
                    { bottom: '10px', left: '10px', br: 'none', bt: 'none' },
                    { bottom: '10px', right: '10px', bl: 'none', bt: 'none' },
                ].map((c, i) => (
                    <div key={i} style={{
                        position: 'absolute',
                        width: '18px',
                        height: '18px',
                        borderTop: c.bt || '1px solid rgba(16,185,129,0.15)',
                        borderRight: c.br || '1px solid rgba(16,185,129,0.15)',
                        borderBottom: c.bb || '1px solid rgba(16,185,129,0.15)',
                        borderLeft: c.bl || '1px solid rgba(16,185,129,0.15)',
                        top: c.top, left: c.left, right: c.right, bottom: c.bottom,
                        pointerEvents: 'none',
                        zIndex: 3,
                    }} />
                ))}

                {/* ══════════ LAYER 3: CONTENT ══════════ */}
                <div className="container" style={{
                    position: 'relative',
                    zIndex: 2,
                    paddingTop: '72px',
                    paddingBottom: '28px',
                }}>

                    {/* ── Main grid ── */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: '260px repeat(3, 1fr)',
                        gap: '48px',
                        marginBottom: '40px',
                    }}>

                        {/* Brand column */}
                        <div>
                            <div style={{ marginBottom: '20px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <div style={{
                                        width: '30px',
                                        height: '30px',
                                        border: '1px solid rgba(16,185,129,0.25)',
                                        borderRadius: '5px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '0.85rem',
                                        background: 'rgba(16,185,129,0.04)',
                                        position: 'relative',
                                    }}>
                                        🛰️
                                        {/* Tiny corner accent on icon box */}
                                        <div style={{
                                            position: 'absolute',
                                            top: '-1px',
                                            right: '-1px',
                                            width: '5px',
                                            height: '5px',
                                            borderTop: '1px solid #10b981',
                                            borderRight: '1px solid #10b981',
                                            borderRadius: '0 4px 0 0',
                                            opacity: 0.5,
                                        }} />
                                    </div>
                                    <span style={{
                                        fontFamily: 'var(--font-mono, monospace)',
                                        fontWeight: 700,
                                        fontSize: '0.95rem',
                                        color: '#e2e8f0',
                                        letterSpacing: '-0.02em',
                                    }}>
                                        SAR<span style={{ color: '#10b981', margin: '0 1px' }}>│</span>ANALYZER
                                    </span>
                                </div>
                            </div>

                            <p style={{
                                color: '#2d3748',
                                fontSize: '0.78rem',
                                lineHeight: 1.85,
                                maxWidth: '220px',
                                fontFamily: 'var(--font-mono, monospace)',
                                margin: 0,
                            }}>
                                Next-generation SAR processing.
                                Rust-native throughput.
                                Operational geospatial
                                intelligence for critical
                                infrastructure monitoring.
                            </p>

                            {/* Social nodes */}
                            <div style={{ display: 'flex', gap: '6px', marginTop: '24px' }}>
                                {socialLinks.map(social => (
                                    <motion.a
                                        key={social.name}
                                        href={social.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        whileHover={{ y: -2 }}
                                        className="snode"
                                        title={social.name}
                                    >
                                        {social.icon}
                                    </motion.a>
                                ))}
                            </div>
                        </div>

                        {/* Link columns */}
                        {Object.entries(footerLinks).map(([category, links]) => (
                            <div key={category}>
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    marginBottom: '18px',
                                }}>
                                    <div style={{
                                        width: '10px',
                                        height: '1px',
                                        background: '#10b981',
                                        opacity: 0.6,
                                    }} />
                                    <h4 style={{
                                        fontSize: '0.65rem',
                                        fontWeight: 500,
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.18em',
                                        color: '#374151',
                                        margin: 0,
                                        fontFamily: 'var(--font-mono, monospace)',
                                    }}>
                                        {category}
                                    </h4>
                                </div>
                                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                                    {links.map(link => (
                                        <li key={link.label} style={{ marginBottom: '9px' }}>
                                            {link.path ? (
                                                <Link to={link.path} className="flink">
                                                    <span className="fdot" />
                                                    <span>{link.label}</span>
                                                </Link>
                                            ) : (
                                                <a href={link.url} target="_blank" rel="noopener noreferrer" className="flink">
                                                    <span className="fdot" />
                                                    <span>{link.label}</span>
                                                </a>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>

                    {/* ── Status bar ── */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '14px',
                        marginBottom: '28px',
                        fontFamily: 'var(--font-mono, monospace)',
                        fontSize: '0.58rem',
                        color: '#1f2937',
                        letterSpacing: '0.06em',
                        flexWrap: 'wrap',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{
                                width: '4px',
                                height: '4px',
                                borderRadius: '50%',
                                background: '#10b981',
                                animation: 'statusPulse 2.5s ease-in-out infinite',
                            }} />
                            <span style={{ color: '#10b981', opacity: 0.6 }}>SYSTEM NOMINAL</span>
                        </div>
                        <span style={{ color: '#111827' }}>│</span>
                        <span>NISAR_GCOV_v3.2</span>
                        <span style={{ color: '#111827' }}>│</span>
                        <span>UPLINK ACTIVE</span>
                        <span style={{ color: '#111827' }}>│</span>
                        <span>COHERENCE ≥ 0.85</span>
                        <span style={{ color: '#111827' }}>│</span>
                        <span>POL: VV+VH</span>
                    </div>

                    {/* ── Signal pulse divider ── */}
                    <div style={{
                        position: 'relative',
                        height: '1px',
                        background: 'rgba(255,255,255,0.03)',
                        marginBottom: '22px',
                    }}>
                        <div style={{
                            position: 'absolute',
                            top: '-3px',
                            width: '50px',
                            height: '7px',
                            background: 'linear-gradient(90deg, transparent, rgba(16,185,129,0.35), transparent)',
                            borderRadius: '50%',
                            filter: 'blur(1px)',
                            animation: 'signalTravel 5s linear infinite',
                        }} />
                        {[8, 22, 36, 50, 64, 78, 92].map(pct => (
                            <div key={pct} style={{
                                position: 'absolute',
                                left: `${pct}%`,
                                top: '-0.5px',
                                width: '2px',
                                height: '2px',
                                borderRadius: '50%',
                                background: 'rgba(255,255,255,0.04)',
                            }} />
                        ))}
                    </div>

                    {/* ── Bottom telemetry bar ── */}
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-end',
                        flexWrap: 'wrap',
                        gap: '16px',
                    }}>
                        {/* Left: Copyright + coordinates */}
                        <div style={{ fontFamily: 'var(--font-mono, monospace)' }}>
                            <p style={{ color: '#1f2937', fontSize: '0.7rem', margin: '0 0 5px 0' }}>
                                © 2026 NISAR Pro
                            </p>
                            <p style={{
                                color: '#111827',
                                fontSize: '0.55rem',
                                margin: 0,
                                letterSpacing: '0.1em',
                                display: 'flex',
                                gap: '12px',
                            }}>
                                <span>34.0522°N</span>
                                <span style={{ color: '#0a0a0a' }}>┃</span>
                                <span>118.2437°W</span>
                                <span style={{ color: '#0a0a0a' }}>┃</span>
                                <span>ORB 48291</span>
                                <span style={{ color: '#0a0a0a' }}>┃</span>
                                <span>ALT 747km</span>
                            </p>
                        </div>

                        {/* Center: Legal links */}
                        <div style={{ display: 'flex', gap: '20px' }}>
                            {['Privacy', 'Terms', 'Cookies'].map(item => (
                                <a key={item} href="#" className="blegal">{item}</a>
                            ))}
                        </div>

                        {/* Right: Built with + cursor */}
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px',
                            fontFamily: 'var(--font-mono, monospace)',
                            fontSize: '0.55rem',
                            color: '#111827',
                            letterSpacing: '0.1em',
                        }}>
                            <span>BUILT WITH</span>
                            <span style={{ fontSize: '0.6rem' }}>🦀</span>
                            <span>RUST</span>
                            <span style={{
                                display: 'inline-block',
                                width: '5px',
                                height: '11px',
                                background: '#10b981',
                                opacity: 0.5,
                                animation: 'cursorBlink 1.2s step-end infinite',
                                marginLeft: '3px',
                                verticalAlign: 'middle',
                            }} />
                        </div>
                    </div>
                </div>
            </footer>
        </>
    )
}

export default Footer