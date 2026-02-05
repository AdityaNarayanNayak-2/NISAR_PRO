import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'

const industries = [
    {
        icon: '🌾',
        title: 'Agriculture',
        description: 'Precision farming with crop health monitoring, soil moisture analysis, and yield prediction using multi-temporal SAR.',
        applications: ['Crop Health', 'Soil Moisture', 'Yield Prediction'],
        color: '#22c55e',
        link: '/use-cases#agriculture'
    },
    {
        icon: '🏙️',
        title: 'Urban Planning',
        description: 'Monitor infrastructure stability, track urban expansion, and detect mm-level ground subsidence with InSAR.',
        applications: ['Subsidence', 'Infrastructure', 'Construction'],
        color: '#8b5cf6',
        link: '/use-cases#urban'
    },
    {
        icon: '🌍',
        title: 'Environmental',
        description: 'Track deforestation, monitor glaciers, detect oil spills, and quantify carbon for climate action.',
        applications: ['Deforestation', 'Glaciers', 'Oil Spills'],
        color: '#06b6d4',
        link: '/use-cases#environment'
    },
    {
        icon: '🚨',
        title: 'Disaster Response',
        description: 'Rapid flood mapping, earthquake damage assessment, and landslide prediction when every minute counts.',
        applications: ['Floods', 'Earthquakes', 'Landslides'],
        color: '#ef4444',
        link: '/use-cases#disaster'
    },
    {
        icon: '⛏️',
        title: 'Mining & Resources',
        description: 'Detect mineral deposits, monitor land stability, track excavation, and ensure environmental compliance.',
        applications: ['Deposits', 'Stability', 'Compliance'],
        color: '#f59e0b',
        link: '/use-cases#mining'
    },
    {
        icon: '🛡️',
        title: 'Defense & Security',
        description: 'ISR missions, change detection, maritime surveillance, and border security — all-weather, day-night.',
        applications: ['ISR', 'Surveillance', 'Maritime'],
        color: '#ec4899',
        link: '/use-cases#defense'
    }
]

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
                    <span className="section-label">Industries</span>
                    <h2>SAR for <span className="text-gradient">Every Sector</span></h2>
                    <p style={{
                        color: 'var(--text-secondary)',
                        maxWidth: '600px',
                        margin: '0 auto',
                        marginTop: 'var(--space-md)'
                    }}>
                        Process any SAR data for actionable insights across industries
                    </p>
                </motion.div>

                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
                    gap: 'var(--space-lg)',
                    marginTop: 'var(--space-2xl)'
                }}>
                    {industries.map((industry, index) => (
                        <motion.div
                            key={industry.title}
                            initial={{ opacity: 0, y: 30 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: index * 0.1 }}
                            whileHover={{ y: -6, borderColor: industry.color }}
                            className="card"
                            style={{
                                position: 'relative',
                                overflow: 'hidden',
                                cursor: 'pointer'
                            }}
                        >
                            {/* Top accent line */}
                            <div style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                right: 0,
                                height: '3px',
                                background: industry.color
                            }} />

                            {/* Animated background pulse */}
                            <motion.div
                                animate={{
                                    scale: [1, 1.5, 1],
                                    opacity: [0.05, 0.1, 0.05]
                                }}
                                transition={{
                                    duration: 4,
                                    repeat: Infinity,
                                    delay: index * 0.5
                                }}
                                style={{
                                    position: 'absolute',
                                    top: '50%',
                                    left: '50%',
                                    transform: 'translate(-50%, -50%)',
                                    width: '200px',
                                    height: '200px',
                                    background: `radial-gradient(circle, ${industry.color} 0%, transparent 70%)`,
                                    borderRadius: '50%',
                                    pointerEvents: 'none'
                                }}
                            />

                            <div style={{ position: 'relative', zIndex: 1 }}>
                                {/* Icon */}
                                <div style={{
                                    fontSize: '2.5rem',
                                    marginBottom: 'var(--space-md)'
                                }}>
                                    {industry.icon}
                                </div>

                                {/* Title */}
                                <h3 style={{ marginBottom: 'var(--space-sm)' }}>
                                    {industry.title}
                                </h3>

                                {/* Description */}
                                <p style={{
                                    color: 'var(--text-secondary)',
                                    fontSize: '0.9rem',
                                    lineHeight: 1.6,
                                    marginBottom: 'var(--space-lg)'
                                }}>
                                    {industry.description}
                                </p>

                                {/* Application tags */}
                                <div style={{
                                    display: 'flex',
                                    gap: 'var(--space-sm)',
                                    flexWrap: 'wrap',
                                    marginBottom: 'var(--space-lg)'
                                }}>
                                    {industry.applications.map(app => (
                                        <span
                                            key={app}
                                            style={{
                                                padding: 'var(--space-xs) var(--space-sm)',
                                                background: `${industry.color}15`,
                                                border: `1px solid ${industry.color}30`,
                                                borderRadius: 'var(--radius-sm)',
                                                fontSize: '0.75rem',
                                                fontFamily: 'var(--font-mono)',
                                                color: industry.color
                                            }}
                                        >
                                            {app}
                                        </span>
                                    ))}
                                </div>

                                {/* Learn More Link */}
                                <Link
                                    to="/use-cases"
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 'var(--space-xs)',
                                        color: industry.color,
                                        textDecoration: 'none',
                                        fontSize: '0.85rem',
                                        fontWeight: 500
                                    }}
                                >
                                    Explore use cases
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M5 12h14M12 5l7 7-7 7" />
                                    </svg>
                                </Link>
                            </div>
                        </motion.div>
                    ))}
                </div>

                {/* View All CTA */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    style={{
                        textAlign: 'center',
                        marginTop: 'var(--space-3xl)'
                    }}
                >
                    <Link to="/use-cases" className="btn btn-primary">
                        View All Use Cases
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M5 12h14M12 5l7 7-7 7" />
                        </svg>
                    </Link>
                </motion.div>
            </div>
        </section>
    )
}

export default DataVisualization
