import { motion } from 'framer-motion'

const features = [
    {
        icon: '📡',
        title: 'Range-Doppler Algorithm',
        description: 'High-performance RDA with sinc interpolation for precise image focusing',
        gradient: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)'
    },
    {
        icon: '🎯',
        title: 'RCMC Integration',
        description: 'Range Cell Migration Correction for production-quality PSLR < -13dB',
        gradient: 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)'
    },
    {
        icon: '⚡',
        title: '10x Faster',
        description: 'Rust-powered processing engine outperforms Python implementations',
        gradient: 'linear-gradient(135deg, #06b6d4 0%, #10b981 100%)'
    },
    {
        icon: '☁️',
        title: 'Cloud Native',
        description: 'Kubernetes-ready with GitOps deployment via FluxCD',
        gradient: 'linear-gradient(135deg, #10b981 0%, #6366f1 100%)'
    },
    {
        icon: '🛰️',
        title: 'Multi-Mission',
        description: 'Support for NISAR L1/L2 and Sentinel-1 SAFE formats',
        gradient: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)'
    },
    {
        icon: '🔬',
        title: 'ISCE3 Hybrid',
        description: 'Optional NASA JPL ISCE3 integration for advanced InSAR',
        gradient: 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)'
    }
]

const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1
        }
    }
}

const itemVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0 }
}

function Features() {
    return (
        <section className="section" style={{ position: 'relative' }}>
            <div className="container">
                <motion.div
                    className="section-header"
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                >
                    <span className="section-label">Capabilities</span>
                    <h2>Everything You Need for <span className="text-gradient">SAR Processing</span></h2>
                    <p style={{
                        color: 'var(--text-secondary)',
                        maxWidth: '600px',
                        margin: '0 auto',
                        marginTop: 'var(--space-md)'
                    }}>
                        Enterprise-grade features built for scale, reliability, and precision
                    </p>
                </motion.div>

                <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: "-100px" }}
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                        gap: 'var(--space-lg)'
                    }}
                >
                    {features.map((feature, index) => (
                        <motion.div
                            key={feature.title}
                            variants={itemVariants}
                            whileHover={{
                                y: -8,
                                transition: { duration: 0.3 }
                            }}
                            className="card"
                            style={{
                                position: 'relative',
                                overflow: 'hidden'
                            }}
                        >
                            {/* Gradient Border Effect on Hover */}
                            <div style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                right: 0,
                                height: '2px',
                                background: feature.gradient,
                                opacity: 0.7
                            }} />

                            {/* Icon */}
                            <div style={{
                                width: '48px',
                                height: '48px',
                                borderRadius: 'var(--radius-md)',
                                background: 'var(--bg-tertiary)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '1.5rem',
                                marginBottom: 'var(--space-lg)'
                            }}>
                                {feature.icon}
                            </div>

                            {/* Content */}
                            <h4 style={{ marginBottom: 'var(--space-sm)' }}>
                                {feature.title}
                            </h4>
                            <p style={{
                                color: 'var(--text-secondary)',
                                fontSize: '0.95rem',
                                lineHeight: 1.6
                            }}>
                                {feature.description}
                            </p>

                            {/* Learn More Link */}
                            <motion.a
                                href="/technology"
                                whileHover={{ x: 5 }}
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 'var(--space-xs)',
                                    marginTop: 'var(--space-lg)',
                                    color: 'var(--accent-primary)',
                                    textDecoration: 'none',
                                    fontSize: '0.85rem',
                                    fontWeight: 500
                                }}
                            >
                                Learn more
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M5 12h14M12 5l7 7-7 7" />
                                </svg>
                            </motion.a>
                        </motion.div>
                    ))}
                </motion.div>
            </div>
        </section>
    )
}

export default Features
