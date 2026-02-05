import { motion } from 'framer-motion'

const stages = [
    { id: 1, name: 'Raw Data', icon: '📡', description: 'L0 SAR signal' },
    { id: 2, name: 'Range Compress', icon: '📊', description: 'Matched filter' },
    { id: 3, name: 'RCMC', icon: '🎯', description: 'Migration correct' },
    { id: 4, name: 'Azimuth Compress', icon: '🔬', description: 'Doppler focus' },
    { id: 5, name: 'Focused Image', icon: '🖼️', description: 'L1 SLC output' },
]

function ProcessingPipeline() {
    return (
        <section className="section" style={{
            background: 'linear-gradient(180deg, var(--bg-primary) 0%, var(--bg-secondary) 100%)'
        }}>
            <div className="container">
                <motion.div
                    className="section-header"
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                >
                    <span className="section-label">Pipeline</span>
                    <h2>Range-Doppler <span className="text-gradient">Algorithm</span></h2>
                    <p style={{
                        color: 'var(--text-secondary)',
                        maxWidth: '500px',
                        margin: '0 auto',
                        marginTop: 'var(--space-md)'
                    }}>
                        Our production RDA pipeline with integrated RCMC
                    </p>
                </motion.div>

                {/* Pipeline Visualization */}
                <motion.div
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 0,
                        marginTop: 'var(--space-2xl)',
                        flexWrap: 'wrap'
                    }}
                >
                    {stages.map((stage, index) => (
                        <motion.div
                            key={stage.id}
                            initial={{ opacity: 0, scale: 0.8 }}
                            whileInView={{ opacity: 1, scale: 1 }}
                            viewport={{ once: true }}
                            transition={{ delay: index * 0.15 }}
                            style={{
                                display: 'flex',
                                alignItems: 'center'
                            }}
                        >
                            {/* Stage Card */}
                            <motion.div
                                whileHover={{ y: -5, boxShadow: 'var(--shadow-glow-accent)' }}
                                style={{
                                    background: 'var(--bg-tertiary)',
                                    border: '1px solid var(--border-subtle)',
                                    borderRadius: 'var(--radius-lg)',
                                    padding: 'var(--space-lg)',
                                    textAlign: 'center',
                                    minWidth: '140px',
                                    transition: 'all var(--transition-base)'
                                }}
                            >
                                <motion.div
                                    animate={{
                                        scale: [1, 1.1, 1],
                                    }}
                                    transition={{
                                        duration: 2,
                                        repeat: Infinity,
                                        delay: index * 0.3,
                                        ease: 'easeInOut'
                                    }}
                                    style={{
                                        fontSize: '2rem',
                                        marginBottom: 'var(--space-sm)'
                                    }}
                                >
                                    {stage.icon}
                                </motion.div>
                                <div style={{
                                    fontSize: '0.9rem',
                                    fontWeight: 600,
                                    marginBottom: 'var(--space-xs)'
                                }}>
                                    {stage.name}
                                </div>
                                <div style={{
                                    fontSize: '0.75rem',
                                    color: 'var(--text-tertiary)',
                                    fontFamily: 'var(--font-mono)'
                                }}>
                                    {stage.description}
                                </div>
                            </motion.div>

                            {/* Arrow Connector */}
                            {index < stages.length - 1 && (
                                <motion.div
                                    initial={{ scaleX: 0 }}
                                    whileInView={{ scaleX: 1 }}
                                    viewport={{ once: true }}
                                    transition={{ delay: index * 0.15 + 0.1 }}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        padding: '0 var(--space-sm)'
                                    }}
                                >
                                    <div style={{
                                        width: '30px',
                                        height: '2px',
                                        background: 'var(--accent-gradient)'
                                    }} />
                                    <div style={{
                                        width: 0,
                                        height: 0,
                                        borderLeft: '8px solid var(--accent-primary)',
                                        borderTop: '5px solid transparent',
                                        borderBottom: '5px solid transparent'
                                    }} />
                                </motion.div>
                            )}
                        </motion.div>
                    ))}
                </motion.div>

                {/* Code Snippet */}
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.5 }}
                    className="card card-glass"
                    style={{
                        marginTop: 'var(--space-3xl)',
                        maxWidth: '700px',
                        margin: 'var(--space-3xl) auto 0'
                    }}
                >
                    <div style={{
                        display: 'flex',
                        gap: 'var(--space-xs)',
                        marginBottom: 'var(--space-md)'
                    }}>
                        <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#ff5f56' }} />
                        <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#ffbd2e' }} />
                        <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#27ca40' }} />
                    </div>
                    <pre style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.85rem',
                        lineHeight: 1.6,
                        color: 'var(--text-secondary)',
                        overflow: 'auto'
                    }}>
                        <code>{`// Rust SAR Processing Pipeline
let processor = SARProcessor::new(
    5.4e9,    // C-band carrier
    25.0e6,   // Sample rate
    50.0e-6,  // Pulse duration
    20.0e6,   // Bandwidth
    1600.0    // PRF
);

// Full RDA with RCMC
let focused = processor.process_rda(&raw_data);
// → Output: L1 SLC with PSLR < -13 dB`}</code>
                    </pre>
                </motion.div>
            </div>
        </section>
    )
}

export default ProcessingPipeline
