import { motion } from 'framer-motion'

function Hero() {
    return (
        <section style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            overflow: 'hidden',
            paddingTop: '80px'
        }}>
            {/* Animated Background Orbs */}
            <div style={{
                position: 'absolute',
                inset: 0,
                overflow: 'hidden',
                pointerEvents: 'none'
            }}>
                <motion.div
                    animate={{
                        scale: [1, 1.2, 1],
                        x: [0, 50, 0],
                        y: [0, -30, 0]
                    }}
                    transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
                    style={{
                        position: 'absolute',
                        top: '10%',
                        right: '10%',
                        width: '500px',
                        height: '500px',
                        background: 'radial-gradient(circle, rgba(99, 102, 241, 0.2) 0%, transparent 70%)',
                        borderRadius: '50%',
                        filter: 'blur(40px)'
                    }}
                />
                <motion.div
                    animate={{
                        scale: [1, 1.3, 1],
                        x: [0, -40, 0],
                        y: [0, 40, 0]
                    }}
                    transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
                    style={{
                        position: 'absolute',
                        bottom: '20%',
                        left: '5%',
                        width: '400px',
                        height: '400px',
                        background: 'radial-gradient(circle, rgba(139, 92, 246, 0.15) 0%, transparent 70%)',
                        borderRadius: '50%',
                        filter: 'blur(40px)'
                    }}
                />
            </div>

            <div className="container" style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
                {/* Badge */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                >
                    <span className="section-label">
                        🛰️ Next-Generation SAR Processing
                    </span>
                </motion.div>

                {/* Main Heading */}
                <motion.h1
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3, duration: 0.6 }}
                    style={{
                        marginTop: 'var(--space-xl)',
                        marginBottom: 'var(--space-lg)'
                    }}
                >
                    Synthetic Aperture Radar
                    <br />
                    <span className="text-gradient">Made Simple</span>
                </motion.h1>

                {/* Subtitle */}
                <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    style={{
                        fontSize: '1.25rem',
                        color: 'var(--text-secondary)',
                        maxWidth: '600px',
                        margin: '0 auto',
                        lineHeight: 1.7
                    }}
                >
                    Production-grade image focusing with Rust, RCMC, and cloud-native architecture.
                    Process NISAR and Sentinel-1 data at scale.
                </motion.p>

                {/* CTA Buttons */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.7 }}
                    style={{
                        display: 'flex',
                        gap: 'var(--space-md)',
                        justifyContent: 'center',
                        marginTop: 'var(--space-2xl)'
                    }}
                >
                    <a href="/demo" className="btn btn-primary">
                        Try Live Demo
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M5 12h14M12 5l7 7-7 7" />
                        </svg>
                    </a>
                    <a href="/technology" className="btn btn-secondary">
                        View Technology
                    </a>
                </motion.div>

                {/* Scroll Indicator */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1.2 }}
                    style={{
                        position: 'absolute',
                        bottom: '-100px',
                        left: '50%',
                        transform: 'translateX(-50%)'
                    }}
                >
                    <motion.div
                        animate={{ y: [0, 10, 0] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        style={{
                            width: '24px',
                            height: '40px',
                            border: '2px solid var(--border-default)',
                            borderRadius: 'var(--radius-full)',
                            display: 'flex',
                            justifyContent: 'center',
                            paddingTop: '8px'
                        }}
                    >
                        <motion.div
                            animate={{ opacity: [0.3, 1, 0.3], y: [0, 8, 0] }}
                            transition={{ duration: 2, repeat: Infinity }}
                            style={{
                                width: '4px',
                                height: '8px',
                                background: 'var(--accent-primary)',
                                borderRadius: 'var(--radius-full)'
                            }}
                        />
                    </motion.div>
                </motion.div>
            </div>
        </section>
    )
}

export default Hero
