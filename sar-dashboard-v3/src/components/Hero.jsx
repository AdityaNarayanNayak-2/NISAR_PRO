import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Sparkles, ArrowRight, Terminal } from 'lucide-react'

function Hero() {
    return (
        <section style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            overflow: 'hidden',
            paddingTop: '80px',
            background: '#040404'
        }}>
            {/* Background Grid Pattern */}
            <div style={{
                position: 'absolute',
                inset: 0,
                backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px)',
                backgroundSize: '40px 40px',
                maskImage: 'radial-gradient(ellipse 60% 50% at 50% 50%, #000 0%, transparent 100%)',
                WebkitMaskImage: 'radial-gradient(ellipse 60% 50% at 50% 50%, #000 0%, transparent 100%)',
                zIndex: 0
            }} />

            {/* Glowing Orbs for subtle contrast */}
            <div style={{
                position: 'absolute',
                top: '20%',
                left: '20%',
                width: '400px',
                height: '400px',
                background: 'rgba(56, 189, 248, 0.08)',
                filter: 'blur(100px)',
                borderRadius: '50%',
                zIndex: 0
            }} />
            <div style={{
                position: 'absolute',
                bottom: '10%',
                right: '20%',
                width: '500px',
                height: '500px',
                background: 'rgba(129, 140, 248, 0.05)',
                filter: 'blur(120px)',
                borderRadius: '50%',
                zIndex: 0
            }} />

            <div className="container" style={{
                textAlign: 'center',
                position: 'relative',
                zIndex: 10,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                maxWidth: '900px'
            }}>
                {/* Entrance Badge */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                    style={{ marginBottom: '32px' }}
                >
                    <Link to="/technology" style={{ textDecoration: 'none' }}>
                        <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '6px 16px',
                            background: 'rgba(255, 255, 255, 0.03)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '100px',
                            fontSize: '0.8rem',
                            fontWeight: 500,
                            color: '#e2e8f0',
                            backdropFilter: 'blur(12px)',
                            WebkitBackdropFilter: 'blur(12px)',
                            transition: 'all 0.2s ease',
                            cursor: 'pointer'
                        }}
                            onMouseEnter={e => {
                                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
                                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                            }}
                            onMouseLeave={e => {
                                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                            }}
                        >
                            <Sparkles size={14} color="#60a5fa" />
                            Next-Generation Process Engine
                            <div style={{ width: '1px', height: '12px', background: 'rgba(255,255,255,0.2)', margin: '0 4px' }} />
                            <span style={{ color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                View tech <ArrowRight size={12} />
                            </span>
                        </div>
                    </Link>
                </motion.div>

                {/* Main Heading */}
                <motion.h1
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.1, ease: 'easeOut' }}
                    style={{
                        fontSize: 'clamp(3rem, 6vw, 5rem)',
                        fontWeight: 700,
                        letterSpacing: '-0.04em',
                        lineHeight: 1.1,
                        color: '#ffffff',
                        marginBottom: '24px'
                    }}
                >
                    Synthetic Aperture Radar
                    <br />
                    <span style={{
                        background: 'linear-gradient(135deg, #ffffff 0%, #94a3b8 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        backgroundClip: 'text'
                    }}>
                        Infrastructure.
                    </span>
                </motion.h1>

                {/* Subtitle */}
                <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.2, ease: 'easeOut' }}
                    style={{
                        fontSize: '1.15rem',
                        color: '#94a3b8',
                        maxWidth: '640px',
                        margin: '0 auto 40px',
                        lineHeight: 1.6,
                        fontWeight: 400
                    }}
                >
                    Production-grade image focusing with Rust and Kubernetes. Process NISAR and Sentinel-1 data at hyperscale without managing infrastructure.
                </motion.p>

                {/* CTA Buttons */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.3, ease: 'easeOut' }}
                    style={{
                        display: 'flex',
                        gap: '16px',
                        justifyContent: 'center',
                        alignItems: 'center'
                    }}
                >
                    {/* Primary Button */}
                    <Link to="/app" style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '12px 28px',
                        background: '#ffffff',
                        color: '#000000',
                        textDecoration: 'none',
                        borderRadius: '8px',
                        fontSize: '0.95rem',
                        fontWeight: 600,
                        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                        boxShadow: '0 0 24px rgba(255,255,255,0.1)'
                    }}
                        onMouseEnter={e => {
                            e.currentTarget.style.transform = 'translateY(-2px)';
                            e.currentTarget.style.boxShadow = '0 8px 32px rgba(255,255,255,0.2)';
                        }}
                        onMouseLeave={e => {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = '0 0 24px rgba(255,255,255,0.1)';
                        }}
                    >
                        Launch Interface
                        <ArrowRight size={16} strokeWidth={2.5} />
                    </Link>

                    {/* Secondary Button */}
                    <a href="https://gitlab.com/Aditya-Narayan-Nayak/nisar_pro" target="_blank" rel="noopener noreferrer" style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '12px 28px',
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        color: '#ffffff',
                        textDecoration: 'none',
                        borderRadius: '8px',
                        fontSize: '0.95rem',
                        fontWeight: 500,
                        transition: 'all 0.2s ease'
                    }}
                        onMouseEnter={e => {
                            e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
                        }}
                        onMouseLeave={e => {
                            e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                        }}
                    >
                        <Terminal size={16} />
                        View Source
                    </a>
                </motion.div>
            </div>
        </section>
    )
}

export default Hero
