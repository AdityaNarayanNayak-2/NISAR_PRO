import { motion } from 'framer-motion'

function DataVisualization() {
    return (
        <section className="section">
            <div className="container">
                <motion.div
                    className="section-header"
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                >
                    <span className="section-label">Analysis</span>
                    <h2>Data <span className="text-gradient">Applications</span></h2>
                    <p style={{
                        color: 'var(--text-secondary)',
                        maxWidth: '600px',
                        margin: '0 auto',
                        marginTop: 'var(--space-md)'
                    }}>
                        Transform SAR data into actionable insights
                    </p>
                </motion.div>

                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                    gap: 'var(--space-xl)',
                    marginTop: 'var(--space-2xl)'
                }}>
                    {/* Application Card 1 */}
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        whileHover={{ scale: 1.02 }}
                        className="card"
                        style={{
                            background: 'linear-gradient(135deg, var(--bg-secondary) 0%, var(--bg-tertiary) 100%)',
                            overflow: 'hidden',
                            position: 'relative'
                        }}
                    >
                        {/* Animated Background */}
                        <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
                            style={{
                                position: 'absolute',
                                top: '-50%',
                                right: '-50%',
                                width: '200%',
                                height: '200%',
                                background: 'conic-gradient(from 0deg, transparent 0deg, rgba(99, 102, 241, 0.1) 60deg, transparent 120deg)',
                                pointerEvents: 'none'
                            }}
                        />
                        <div style={{ position: 'relative', zIndex: 1 }}>
                            <div style={{
                                fontSize: '3rem',
                                marginBottom: 'var(--space-lg)'
                            }}>
                                🌍
                            </div>
                            <h3 style={{ marginBottom: 'var(--space-sm)' }}>Surface Deformation</h3>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                                InSAR analysis for earthquake monitoring, landslide detection, and infrastructure stability
                            </p>
                            <div style={{
                                display: 'flex',
                                gap: 'var(--space-sm)',
                                marginTop: 'var(--space-lg)',
                                flexWrap: 'wrap'
                            }}>
                                {['Earthquakes', 'Landslides', 'Subsidence'].map(tag => (
                                    <span key={tag} style={{
                                        padding: 'var(--space-xs) var(--space-sm)',
                                        background: 'rgba(99, 102, 241, 0.1)',
                                        border: '1px solid rgba(99, 102, 241, 0.2)',
                                        borderRadius: 'var(--radius-sm)',
                                        fontSize: '0.75rem',
                                        color: 'var(--text-accent)'
                                    }}>
                                        {tag}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </motion.div>

                    {/* Application Card 2 */}
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.1 }}
                        whileHover={{ scale: 1.02 }}
                        className="card"
                        style={{
                            background: 'linear-gradient(135deg, var(--bg-secondary) 0%, var(--bg-tertiary) 100%)',
                            overflow: 'hidden',
                            position: 'relative'
                        }}
                    >
                        <motion.div
                            animate={{
                                background: [
                                    'radial-gradient(circle at 20% 20%, rgba(139, 92, 246, 0.15) 0%, transparent 50%)',
                                    'radial-gradient(circle at 80% 80%, rgba(139, 92, 246, 0.15) 0%, transparent 50%)',
                                    'radial-gradient(circle at 20% 20%, rgba(139, 92, 246, 0.15) 0%, transparent 50%)'
                                ]
                            }}
                            transition={{ duration: 8, repeat: Infinity }}
                            style={{
                                position: 'absolute',
                                inset: 0,
                                pointerEvents: 'none'
                            }}
                        />
                        <div style={{ position: 'relative', zIndex: 1 }}>
                            <div style={{
                                fontSize: '3rem',
                                marginBottom: 'var(--space-lg)'
                            }}>
                                🌊
                            </div>
                            <h3 style={{ marginBottom: 'var(--space-sm)' }}>Maritime Monitoring</h3>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                                Ship detection, oil spill tracking, and sea ice monitoring in all weather conditions
                            </p>
                            <div style={{
                                display: 'flex',
                                gap: 'var(--space-sm)',
                                marginTop: 'var(--space-lg)',
                                flexWrap: 'wrap'
                            }}>
                                {['Ships', 'Oil Spills', 'Sea Ice'].map(tag => (
                                    <span key={tag} style={{
                                        padding: 'var(--space-xs) var(--space-sm)',
                                        background: 'rgba(139, 92, 246, 0.1)',
                                        border: '1px solid rgba(139, 92, 246, 0.2)',
                                        borderRadius: 'var(--radius-sm)',
                                        fontSize: '0.75rem',
                                        color: 'var(--accent-secondary)'
                                    }}>
                                        {tag}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </motion.div>

                    {/* Application Card 3 */}
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.2 }}
                        whileHover={{ scale: 1.02 }}
                        className="card"
                        style={{
                            background: 'linear-gradient(135deg, var(--bg-secondary) 0%, var(--bg-tertiary) 100%)',
                            overflow: 'hidden',
                            position: 'relative'
                        }}
                    >
                        <motion.div
                            animate={{
                                scale: [1, 1.5, 1],
                                opacity: [0.1, 0.2, 0.1]
                            }}
                            transition={{ duration: 4, repeat: Infinity }}
                            style={{
                                position: 'absolute',
                                top: '50%',
                                left: '50%',
                                transform: 'translate(-50%, -50%)',
                                width: '150px',
                                height: '150px',
                                background: 'radial-gradient(circle, rgba(6, 182, 212, 0.2) 0%, transparent 70%)',
                                borderRadius: '50%',
                                pointerEvents: 'none'
                            }}
                        />
                        <div style={{ position: 'relative', zIndex: 1 }}>
                            <div style={{
                                fontSize: '3rem',
                                marginBottom: 'var(--space-lg)'
                            }}>
                                🌲
                            </div>
                            <h3 style={{ marginBottom: 'var(--space-sm)' }}>Forest Monitoring</h3>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                                Biomass estimation, deforestation tracking, and carbon sequestration analysis
                            </p>
                            <div style={{
                                display: 'flex',
                                gap: 'var(--space-sm)',
                                marginTop: 'var(--space-lg)',
                                flexWrap: 'wrap'
                            }}>
                                {['Biomass', 'Deforestation', 'Carbon'].map(tag => (
                                    <span key={tag} style={{
                                        padding: 'var(--space-xs) var(--space-sm)',
                                        background: 'rgba(6, 182, 212, 0.1)',
                                        border: '1px solid rgba(6, 182, 212, 0.2)',
                                        borderRadius: 'var(--radius-sm)',
                                        fontSize: '0.75rem',
                                        color: 'var(--accent-tertiary)'
                                    }}>
                                        {tag}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </motion.div>
                </div>

                {/* CTA */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    style={{
                        textAlign: 'center',
                        marginTop: 'var(--space-3xl)'
                    }}
                >
                    <a href="/demo" className="btn btn-primary">
                        Explore Demo
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M5 12h14M12 5l7 7-7 7" />
                        </svg>
                    </a>
                </motion.div>
            </div>
        </section>
    )
}

export default DataVisualization
