import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'

const pageVariants = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 }
}

const useCases = [
    {
        id: 'infrastructure',
        icon: '🏗️',
        title: 'Bridge & Dam Monitoring',
        tagline: 'Millimeter-precision structural health from orbit',
        color: '#f59e0b',
        status: 'IN DEVELOPMENT',
        description: 'Using InSAR phase differencing to detect sub-centimeter deformation in bridges, dams, and critical infrastructure. NISAR images every bridge on Earth twice every 12 days — making proactive maintenance possible at global scale.',
        techniques: ['Multi-Temporal InSAR', 'Persistent Scatterer Detection', 'Coherence Mapping', 'Phase-to-Displacement Conversion'],
    },
    {
        id: 'displacement',
        icon: '🌍',
        title: 'Land Displacement',
        tagline: 'Ground deformation and subsidence detection',
        color: '#8b5cf6',
        status: 'IN DEVELOPMENT',
        description: 'Detecting land subsidence, tectonic deformation, and slope instability using differential InSAR. Critical for urban planning in areas prone to groundwater extraction, mining-induced collapse, or seismic activity.',
        techniques: ['DInSAR', 'Time-Series Analysis', 'Goldstein Phase Filtering', 'Displacement Rate Estimation'],
    },
    {
        id: 'maritime',
        icon: '🚢',
        title: 'Ship Detection & Monitoring',
        tagline: 'All-weather maritime surveillance',
        color: '#06b6d4',
        status: 'PLANNED',
        description: 'Bright radar returns on dark ocean backgrounds make SAR ideal for vessel detection. CFAR (Constant False Alarm Rate) thresholding on calibrated backscatter identifies ships regardless of weather, cloud cover, or time of day.',
        techniques: ['CFAR Detection', 'Backscatter Calibration', 'Wake Analysis', 'AIS Correlation'],
    },
    {
        id: 'waste',
        icon: '🏭',
        title: 'Industrial Waste Pond Detection',
        tagline: 'Environmental compliance monitoring',
        color: '#ef4444',
        status: 'PLANNED',
        description: 'SAR coherence drops sharply over liquid surfaces while maintaining high coherence over surrounding industrial structures. This contrast enables automated detection and monitoring of waste ponds, tailings dams, and unauthorized discharge sites.',
        techniques: ['Coherence Change Detection', 'Polarimetric Decomposition', 'Multi-Temporal Differencing', 'Anomaly Mapping'],
    },
]

function UseCasesPage() {
    return (
        <motion.main
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.5 }}
            style={{ paddingTop: '120px' }}
        >
            {/* Hero */}
            <section className="section">
                <div className="container">
                    <motion.div
                        className="section-header"
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                    >
                        <span className="section-label">Active Development</span>
                        <h1>What We're <span className="text-gradient">Building</span></h1>
                        <p style={{
                            color: 'var(--text-secondary)',
                            maxWidth: '700px',
                            margin: '0 auto',
                            marginTop: 'var(--space-lg)',
                            fontSize: '1.1rem'
                        }}>
                            Real SAR applications backed by working algorithms — not marketing promises.
                            Every use case listed here has a clear path to implementation on the NISAR Pro platform.
                        </p>
                    </motion.div>
                </div>
            </section>

            {/* Use Cases */}
            <section className="section" style={{ paddingTop: 0 }}>
                <div className="container">
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 'var(--space-2xl)'
                    }}>
                        {useCases.map((useCase, index) => (
                            <motion.div
                                key={useCase.id}
                                initial={{ opacity: 0, y: 30 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.3 + index * 0.1 }}
                                className="card"
                                style={{
                                    position: 'relative',
                                    overflow: 'hidden',
                                    display: 'grid',
                                    gridTemplateColumns: '1fr 1fr',
                                    gap: 'var(--space-2xl)',
                                    alignItems: 'start'
                                }}
                            >
                                {/* Color accent bar */}
                                <div style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    right: 0,
                                    height: '3px',
                                    background: useCase.color
                                }} />

                                {/* Left: Description */}
                                <div>
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 'var(--space-md)',
                                        marginBottom: 'var(--space-lg)'
                                    }}>
                                        <div style={{
                                            width: '56px',
                                            height: '56px',
                                            borderRadius: 'var(--radius-md)',
                                            background: `${useCase.color}20`,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: '1.8rem'
                                        }}>
                                            {useCase.icon}
                                        </div>
                                        <div>
                                            <h3 style={{ marginBottom: '2px' }}>{useCase.title}</h3>
                                            <p style={{
                                                color: 'var(--text-tertiary)',
                                                fontSize: '0.85rem',
                                                margin: 0
                                            }}>
                                                {useCase.tagline}
                                            </p>
                                        </div>
                                    </div>
                                    <p style={{
                                        color: 'var(--text-secondary)',
                                        lineHeight: 1.7,
                                        fontSize: '0.95rem'
                                    }}>
                                        {useCase.description}
                                    </p>
                                </div>

                                {/* Right: Techniques + Status */}
                                <div>
                                    <div style={{
                                        display: 'inline-block',
                                        padding: '4px 12px',
                                        background: useCase.status === 'IN DEVELOPMENT' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(100, 116, 139, 0.1)',
                                        border: `1px solid ${useCase.status === 'IN DEVELOPMENT' ? '#f59e0b' : '#64748b'}`,
                                        borderRadius: 'var(--radius-sm)',
                                        fontSize: '0.7rem',
                                        fontFamily: 'var(--font-mono)',
                                        fontWeight: 600,
                                        color: useCase.status === 'IN DEVELOPMENT' ? '#f59e0b' : '#64748b',
                                        letterSpacing: '0.05em',
                                        marginBottom: 'var(--space-lg)'
                                    }}>
                                        {useCase.status}
                                    </div>

                                    <div style={{ marginBottom: 'var(--space-sm)' }}>
                                        <div style={{
                                            fontSize: '0.75rem',
                                            fontWeight: 600,
                                            color: 'var(--text-tertiary)',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.05em',
                                            marginBottom: 'var(--space-sm)'
                                        }}>
                                            SAR Techniques Used
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                            {useCase.techniques.map(tech => (
                                                <div key={tech} style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '8px',
                                                    padding: '8px 12px',
                                                    background: 'var(--bg-tertiary)',
                                                    borderRadius: 'var(--radius-sm)',
                                                    fontSize: '0.85rem',
                                                    fontFamily: 'var(--font-mono)',
                                                    color: 'var(--text-secondary)'
                                                }}>
                                                    <div style={{
                                                        width: '6px',
                                                        height: '6px',
                                                        borderRadius: '50%',
                                                        background: useCase.color,
                                                        flexShrink: 0
                                                    }} />
                                                    {tech}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Data Sources */}
            <section className="section" style={{
                background: 'linear-gradient(180deg, var(--bg-secondary) 0%, var(--bg-primary) 100%)'
            }}>
                <div className="container">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        style={{ textAlign: 'center' }}
                    >
                        <p style={{
                            color: 'var(--text-tertiary)',
                            marginBottom: 'var(--space-lg)',
                            fontSize: '0.9rem'
                        }}>
                            Compatible with data from
                        </p>
                        <div style={{
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            gap: 'var(--space-2xl)',
                            flexWrap: 'wrap'
                        }}>
                            {[
                                { name: 'NISAR', org: 'NASA-ISRO', active: true },
                                { name: 'Sentinel-1', org: 'ESA', active: false },
                                { name: 'ALOS-2', org: 'JAXA', active: false },
                            ].map((source) => (
                                <div key={source.name} style={{ textAlign: 'center' }}>
                                    <div style={{
                                        fontFamily: 'var(--font-mono)',
                                        fontWeight: 600,
                                        fontSize: '1.1rem',
                                        color: source.active ? 'var(--accent-primary)' : 'var(--text-primary)'
                                    }}>
                                        {source.name}
                                    </div>
                                    <div style={{
                                        fontSize: '0.75rem',
                                        color: 'var(--text-tertiary)'
                                    }}>
                                        {source.org}
                                    </div>
                                    {source.active && (
                                        <div style={{
                                            fontSize: '0.6rem',
                                            color: '#10b981',
                                            fontWeight: 600,
                                            fontFamily: 'var(--font-mono)',
                                            marginTop: '4px'
                                        }}>
                                            ACTIVE
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* CTA */}
            <section className="section">
                <div className="container" style={{ textAlign: 'center' }}>
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                    >
                        <h2>Ready to Process Real SAR Data?</h2>
                        <p style={{
                            color: 'var(--text-secondary)',
                            marginTop: 'var(--space-md)',
                            marginBottom: 'var(--space-xl)'
                        }}>
                            Launch the dashboard and process NISAR RSLC files directly from your browser
                        </p>
                        <div style={{ display: 'flex', gap: 'var(--space-md)', justifyContent: 'center' }}>
                            <Link to="/app" className="btn btn-primary">
                                Launch Dashboard
                            </Link>
                            <a
                                href="https://gitlab.com/Aditya-Narayan-Nayak/nisar_pro"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn btn-secondary"
                            >
                                View Source
                            </a>
                        </div>
                    </motion.div>
                </div>
            </section>
        </motion.main>
    )
}

export default UseCasesPage
