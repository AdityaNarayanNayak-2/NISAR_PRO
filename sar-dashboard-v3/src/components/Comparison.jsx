import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'

function Comparison() {
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
                    <span className="section-label">Open Source</span>
                    <h2>The Universal <span className="text-gradient">Processing Layer</span></h2>
                    <p style={{
                        color: 'var(--text-secondary)',
                        maxWidth: '650px',
                        margin: 'var(--space-md) auto 0'
                    }}>
                        While others build proprietary hardware, we provide the open software layer
                        that works with <strong>any</strong> SAR data source
                    </p>
                </motion.div>

                {/* Key Differentiators */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                    gap: 'var(--space-lg)',
                    marginTop: 'var(--space-2xl)'
                }}>
                    {[
                        {
                            icon: '🔓',
                            title: 'Open Source',
                            description: 'MIT licensed. Full code access. No vendor lock-in.',
                            highlight: 'Free Forever'
                        },
                        {
                            icon: '🌐',
                            title: 'Any Data Source',
                            description: 'NISAR, Sentinel-1, ICEYE, Capella, ALOS-2, and more.',
                            highlight: 'Universal'
                        },
                        {
                            icon: '☁️',
                            title: 'Deploy Anywhere',
                            description: 'Cloud, on-prem, edge. Kubernetes-native.',
                            highlight: 'Your Cloud'
                        },
                        {
                            icon: '⚡',
                            title: 'Rust Performance',
                            description: '10x faster than Python. Memory-safe. Production-ready.',
                            highlight: 'Blazing Fast'
                        }
                    ].map((item, index) => (
                        <motion.div
                            key={item.title}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: index * 0.1 }}
                            className="card"
                            style={{ textAlign: 'center' }}
                        >
                            <div style={{ fontSize: '2.5rem', marginBottom: 'var(--space-md)' }}>
                                {item.icon}
                            </div>
                            <div style={{
                                display: 'inline-block',
                                padding: 'var(--space-xs) var(--space-sm)',
                                background: 'rgba(99, 102, 241, 0.1)',
                                border: '1px solid rgba(99, 102, 241, 0.3)',
                                borderRadius: 'var(--radius-full)',
                                fontSize: '0.7rem',
                                fontFamily: 'var(--font-mono)',
                                color: 'var(--accent-primary)',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                                marginBottom: 'var(--space-sm)'
                            }}>
                                {item.highlight}
                            </div>
                            <h4 style={{ marginBottom: 'var(--space-sm)' }}>{item.title}</h4>
                            <p style={{
                                color: 'var(--text-secondary)',
                                fontSize: '0.9rem',
                                margin: 0
                            }}>
                                {item.description}
                            </p>
                        </motion.div>
                    ))}
                </div>

                {/* Data Sources Compatibility */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="card card-glass"
                    style={{
                        marginTop: 'var(--space-3xl)',
                        textAlign: 'center',
                        padding: 'var(--space-2xl)'
                    }}
                >
                    <p style={{
                        color: 'var(--text-tertiary)',
                        marginBottom: 'var(--space-lg)',
                        fontSize: '0.85rem'
                    }}>
                        Compatible with major SAR data sources
                    </p>
                    <div style={{
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        gap: 'var(--space-3xl)',
                        flexWrap: 'wrap'
                    }}>
                        {[
                            { name: 'NISAR', org: 'NASA-ISRO', flag: '🇺🇸🇮🇳' },
                            { name: 'Sentinel-1', org: 'ESA', flag: '🇪🇺' },
                            { name: 'ICEYE', org: 'Commercial', flag: '🇫🇮' },
                            { name: 'Capella', org: 'Commercial', flag: '🇺🇸' },
                            { name: 'ALOS-2', org: 'JAXA', flag: '🇯🇵' },
                        ].map((source, i) => (
                            <motion.div
                                key={source.name}
                                initial={{ opacity: 0, y: 10 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: 0.3 + i * 0.1 }}
                                style={{ textAlign: 'center' }}
                            >
                                <div style={{ fontSize: '1.5rem', marginBottom: 'var(--space-xs)' }}>
                                    {source.flag}
                                </div>
                                <div style={{
                                    fontFamily: 'var(--font-mono)',
                                    fontWeight: 600,
                                    fontSize: '1rem',
                                    color: 'var(--text-primary)'
                                }}>
                                    {source.name}
                                </div>
                                <div style={{
                                    fontSize: '0.7rem',
                                    color: 'var(--text-tertiary)'
                                }}>
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
                    style={{
                        textAlign: 'center',
                        marginTop: 'var(--space-2xl)'
                    }}
                >
                    <Link to="/use-cases" className="btn btn-secondary">
                        See Full Comparison
                    </Link>
                </motion.div>
            </div>
        </section>
    )
}

export default Comparison
