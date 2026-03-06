import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Unlock, Globe2, Cloud, Zap, ArrowRight, Satellite } from 'lucide-react'

function Comparison() {
    return (
        <section style={{
            padding: '120px 0',
            background: 'linear-gradient(180deg, #040404 0%, #09090b 100%)',
            borderTop: '1px solid rgba(255,255,255,0.05)',
            position: 'relative'
        }}>
            <div className="container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 2rem' }}>
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    style={{ textAlign: 'center', marginBottom: '80px' }}
                >
                    <div style={{
                        display: 'inline-flex', alignItems: 'center', padding: '6px 16px',
                        background: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.2)',
                        borderRadius: '100px', fontSize: '0.75rem', fontWeight: 600,
                        textTransform: 'uppercase', letterSpacing: '0.1em', color: '#818cf8',
                        marginBottom: '24px'
                    }}>
                        Open Source
                    </div>
                    <h2 style={{ fontSize: 'clamp(2.5rem, 4vw, 3.5rem)', fontWeight: 700, color: '#ffffff', letterSpacing: '-0.02em', marginBottom: '24px' }}>
                        The Universal <span style={{ color: '#818cf8' }}>Processing Layer</span>
                    </h2>
                    <p style={{ color: '#94a3b8', fontSize: '1.1rem', maxWidth: '650px', margin: '0 auto', lineHeight: 1.6 }}>
                        While others build proprietary hardware, we provide the open software layer
                        that works with <strong style={{ color: '#ffffff' }}>any</strong> SAR data source.
                    </p>
                </motion.div>

                {/* Key Differentiators */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                    gap: '24px',
                    marginBottom: '80px'
                }}>
                    {[
                        { icon: <Unlock size={32} className="text-blue-400" />, title: 'Open Source', desc: 'MIT licensed. Full code access. No vendor lock-in.', badge: 'Free Forever', color: '#60a5fa' },
                        { icon: <Globe2 size={32} className="text-emerald-400" />, title: 'Any Data Source', desc: 'NISAR, Sentinel-1, ICEYE, Capella, ALOS-2.', badge: 'Universal', color: '#34d399' },
                        { icon: <Cloud size={32} className="text-purple-400" />, title: 'Deploy Anywhere', desc: 'Cloud, on-prem, edge. Kubernetes-native architecture.', badge: 'Your Cloud', color: '#c084fc' },
                        { icon: <Zap size={32} className="text-amber-400" />, title: 'Rust Performance', desc: '10x faster than Python. Memory-safe. Production-ready.', badge: 'Blazing Fast', color: '#fbbf24' }
                    ].map((item, index) => (
                        <motion.div
                            key={item.title}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: index * 0.1 }}
                            style={{
                                background: 'transparent',
                                border: '1px solid rgba(255,255,255,0.05)',
                                borderRadius: '24px',
                                padding: '32px',
                                textAlign: 'center',
                                transition: 'background 0.3s ease',
                                cursor: 'default'
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
                                <div style={{
                                    width: '64px', height: '64px', borderRadius: '16px',
                                    background: `radial-gradient(circle at top left, ${item.color}20, transparent)`,
                                    border: `1px solid ${item.color}30`,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                }}>
                                    {item.icon}
                                </div>
                            </div>

                            <div style={{
                                display: 'inline-block', padding: '4px 12px',
                                background: `${item.color}10`, border: `1px solid ${item.color}30`,
                                borderRadius: '100px', fontSize: '0.7rem', fontFamily: '"JetBrains Mono", monospace',
                                color: item.color, textTransform: 'uppercase', letterSpacing: '0.05em',
                                marginBottom: '16px'
                            }}>
                                {item.badge}
                            </div>
                            <h4 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#ffffff', marginBottom: '12px' }}>{item.title}</h4>
                            <p style={{ color: '#94a3b8', fontSize: '0.95rem', lineHeight: 1.5, margin: 0 }}>
                                {item.desc}
                            </p>
                        </motion.div>
                    ))}
                </div>

                {/* Data Sources Compatibility */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    style={{
                        background: 'rgba(255, 255, 255, 0.02)',
                        border: '1px solid rgba(255, 255, 255, 0.05)',
                        borderRadius: '24px',
                        padding: '48px',
                        textAlign: 'center',
                        position: 'relative',
                        overflow: 'hidden'
                    }}
                >
                    {/* Corner gradient */}
                    <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: '60%', height: '1px', background: 'linear-gradient(90deg, transparent, rgba(129, 140, 248, 0.5), transparent)' }} />

                    <p style={{ color: '#94a3b8', marginBottom: '32px', fontSize: '0.95rem', fontWeight: 500 }}>
                        <Satellite size={16} className="text-indigo-400" style={{ display: 'inline', verticalAlign: 'text-bottom', marginRight: '6px' }} />
                        Compatible with major SAR data providers
                    </p>
                    <div style={{
                        display: 'flex', justifyContent: 'center', alignItems: 'center',
                        gap: '48px', flexWrap: 'wrap'
                    }}>
                        {[
                            { name: 'NISAR', org: 'NASA-ISRO', code: 'US/IN' },
                            { name: 'Sentinel-1', org: 'ESA', code: 'EU' },
                            { name: 'ICEYE', org: 'Commercial', code: 'FI' },
                            { name: 'Capella', org: 'Commercial', code: 'US' },
                            { name: 'ALOS-2', org: 'JAXA', code: 'JP' },
                        ].map((source, i) => (
                            <motion.div
                                key={source.name}
                                initial={{ opacity: 0, y: 10 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: 0.2 + i * 0.1 }}
                                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}
                            >
                                <div style={{
                                    fontFamily: '"JetBrains Mono", monospace',
                                    fontSize: '0.75rem',
                                    color: '#4f46e5',
                                    marginBottom: '8px'
                                }}>
                                    {source.code}
                                </div>
                                <div style={{
                                    fontWeight: 600, fontSize: '1.25rem', color: '#e2e8f0', marginBottom: '4px'
                                }}>
                                    {source.name}
                                </div>
                                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                                    {source.org}
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </motion.div>

                {/* CTA */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    style={{ textAlign: 'center', marginTop: '64px' }}
                >
                    <Link to="/technology" style={{
                        display: 'inline-flex', alignItems: 'center', gap: '8px',
                        padding: '12px 28px', background: 'rgba(255,255,255,0.05)', color: '#ffffff',
                        border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px',
                        fontSize: '0.95rem', fontWeight: 500, textDecoration: 'none',
                        transition: 'all 0.2s ease'
                    }}
                        onMouseEnter={e => {
                            e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
                        }}
                        onMouseLeave={e => {
                            e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                        }}
                    >
                        Read Technical Specs <ArrowRight size={16} />
                    </Link>
                </motion.div>
            </div >
        </section >
    )
}

export default Comparison
