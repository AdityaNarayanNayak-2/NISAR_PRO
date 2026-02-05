import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'

const pageVariants = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 }
}

const useCases = [
    {
        id: 'agriculture',
        icon: '🌾',
        title: 'Agriculture',
        tagline: 'Precision farming powered by radar',
        color: '#22c55e',
        applications: [
            { name: 'Crop Health Monitoring', desc: 'Track vegetation indices and growth patterns' },
            { name: 'Soil Moisture Analysis', desc: 'L-band penetration for subsurface moisture' },
            { name: 'Irrigation Mapping', desc: 'Optimize water usage with temporal analysis' },
            { name: 'Yield Prediction', desc: 'ML models on multi-temporal SAR data' },
            { name: 'Damage Assessment', desc: 'Post-storm crop loss for insurance claims' },
        ]
    },
    {
        id: 'mining',
        icon: '⛏️',
        title: 'Mining & Resources',
        tagline: 'Subsurface intelligence at scale',
        color: '#f59e0b',
        applications: [
            { name: 'Deposit Detection', desc: 'Identify mineral-rich geological formations' },
            { name: 'Illegal Mining Detection', desc: 'Change detection for unauthorized activity' },
            { name: 'Land Stability Monitoring', desc: 'InSAR for subsidence and slope movement' },
            { name: 'Excavation Tracking', desc: 'Volume estimation from DEM differencing' },
            { name: 'Environmental Compliance', desc: 'Monitor rehabilitation and reclamation' },
        ]
    },
    {
        id: 'urban',
        icon: '🏙️',
        title: 'Urban Planning',
        tagline: 'Smart city infrastructure insights',
        color: '#8b5cf6',
        applications: [
            { name: 'Urban Growth Monitoring', desc: 'Track expansion and densification patterns' },
            { name: 'Infrastructure Assessment', desc: 'Bridge, dam, and building stability' },
            { name: 'Land Subsidence', desc: 'mm-level ground deformation detection' },
            { name: 'Construction Progress', desc: 'Automated site monitoring from orbit' },
            { name: 'Transportation Networks', desc: 'Road and rail infrastructure analysis' },
        ]
    },
    {
        id: 'environment',
        icon: '🌍',
        title: 'Environmental',
        tagline: 'Climate action through observation',
        color: '#06b6d4',
        applications: [
            { name: 'Deforestation Tracking', desc: 'Near real-time forest loss alerts' },
            { name: 'Glacier Monitoring', desc: 'Ice flow velocity and mass balance' },
            { name: 'Oil Spill Detection', desc: 'Ocean surface anomaly identification' },
            { name: 'Wetland Mapping', desc: 'Flood extent and water body changes' },
            { name: 'Carbon Estimation', desc: 'Biomass quantification for carbon credits' },
        ]
    },
    {
        id: 'defense',
        icon: '🛡️',
        title: 'Defense & Security',
        tagline: 'Tactical advantage through SAR',
        color: '#ef4444',
        applications: [
            { name: 'ISR Missions', desc: 'Intelligence, Surveillance, Reconnaissance' },
            { name: 'Change Detection', desc: 'Identify new structures or movements' },
            { name: 'Maritime Surveillance', desc: 'Ship detection and tracking' },
            { name: 'Border Security', desc: 'All-weather monitoring capabilities' },
            { name: 'Terrain Analysis', desc: 'Mission planning and route optimization' },
        ]
    },
    {
        id: 'disaster',
        icon: '🚨',
        title: 'Disaster Management',
        tagline: 'Rapid response when it matters',
        color: '#ec4899',
        applications: [
            { name: 'Flood Mapping', desc: 'Real-time inundation extent assessment' },
            { name: 'Earthquake Damage', desc: 'Building damage classification' },
            { name: 'Landslide Detection', desc: 'InSAR for slope failure prediction' },
            { name: 'Volcanic Activity', desc: 'Deformation monitoring and alerts' },
            { name: 'GLOF Prediction', desc: 'Glacial lake outburst early warning' },
        ]
    }
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
                        <span className="section-label">Applications</span>
                        <h1>SAR for <span className="text-gradient">Every Industry</span></h1>
                        <p style={{
                            color: 'var(--text-secondary)',
                            maxWidth: '700px',
                            margin: '0 auto',
                            marginTop: 'var(--space-lg)',
                            fontSize: '1.1rem'
                        }}>
                            From precision agriculture to national security — unlock insights from
                            any SAR data source with our open-source processing platform
                        </p>
                    </motion.div>
                </div>
            </section>

            {/* Use Cases Grid */}
            <section className="section" style={{ paddingTop: 0 }}>
                <div className="container">
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
                        gap: 'var(--space-xl)'
                    }}>
                        {useCases.map((useCase, index) => (
                            <motion.div
                                key={useCase.id}
                                initial={{ opacity: 0, y: 30 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.3 + index * 0.1 }}
                                whileHover={{ y: -5 }}
                                className="card"
                                style={{
                                    position: 'relative',
                                    overflow: 'hidden'
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

                                {/* Header */}
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

                                {/* Applications List */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                                    {useCase.applications.map((app, i) => (
                                        <motion.div
                                            key={app.name}
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: 0.5 + index * 0.1 + i * 0.05 }}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'flex-start',
                                                gap: 'var(--space-sm)',
                                                padding: 'var(--space-sm)',
                                                borderRadius: 'var(--radius-sm)',
                                                background: 'var(--bg-tertiary)',
                                                transition: 'background var(--transition-fast)'
                                            }}
                                            whileHover={{ background: 'var(--bg-elevated)' }}
                                        >
                                            <div style={{
                                                width: '6px',
                                                height: '6px',
                                                borderRadius: '50%',
                                                background: useCase.color,
                                                marginTop: '6px',
                                                flexShrink: 0
                                            }} />
                                            <div>
                                                <div style={{
                                                    fontWeight: 500,
                                                    fontSize: '0.9rem',
                                                    marginBottom: '2px'
                                                }}>
                                                    {app.name}
                                                </div>
                                                <div style={{
                                                    color: 'var(--text-tertiary)',
                                                    fontSize: '0.8rem'
                                                }}>
                                                    {app.desc}
                                                </div>
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Comparison Section */}
            <section className="section" style={{
                background: 'linear-gradient(180deg, var(--bg-secondary) 0%, var(--bg-primary) 100%)'
            }}>
                <div className="container">
                    <motion.div
                        className="section-header"
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                    >
                        <span className="section-label">Why SAR Analyzer</span>
                        <h2>The <span className="text-gradient">Open Processing</span> Layer</h2>
                        <p style={{
                            color: 'var(--text-secondary)',
                            maxWidth: '600px',
                            margin: 'var(--space-md) auto 0'
                        }}>
                            While others build proprietary hardware, we provide the universal
                            software layer that works with <strong>any</strong> SAR data
                        </p>
                    </motion.div>

                    {/* Comparison Table */}
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="card card-glass"
                        style={{
                            maxWidth: '900px',
                            margin: '0 auto',
                            overflow: 'hidden'
                        }}
                    >
                        <table style={{
                            width: '100%',
                            borderCollapse: 'collapse',
                            fontSize: '0.9rem'
                        }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--border-default)' }}>
                                    <th style={{
                                        padding: 'var(--space-lg)',
                                        textAlign: 'left',
                                        fontWeight: 600
                                    }}>Feature</th>
                                    <th style={{
                                        padding: 'var(--space-lg)',
                                        textAlign: 'center',
                                        color: 'var(--accent-primary)',
                                        fontWeight: 600
                                    }}>SAR Analyzer</th>
                                    <th style={{
                                        padding: 'var(--space-lg)',
                                        textAlign: 'center',
                                        color: 'var(--text-tertiary)',
                                        fontWeight: 600
                                    }}>Hardware Vendors</th>
                                </tr>
                            </thead>
                            <tbody>
                                {[
                                    ['Open Source', '✅ MIT License', '❌ Proprietary'],
                                    ['Data Source', '✅ Any (NISAR, Sentinel, ICEYE, etc)', '⚠️ Own sensors only'],
                                    ['Deployment', '✅ Cloud, On-Prem, Edge', '⚠️ Vendor cloud'],
                                    ['Customization', '✅ Full code access', '❌ Black box'],
                                    ['Cost', '✅ Free + cloud compute', '💰 $$$$ licensing'],
                                    ['RDA + RCMC', '✅ Production-grade Rust', '✅ Varies'],
                                    ['ISCE3 Integration', '✅ Optional hybrid', '❌ N/A'],
                                ].map(([feature, ours, theirs], i) => (
                                    <tr
                                        key={feature}
                                        style={{
                                            borderBottom: i < 6 ? '1px solid var(--border-subtle)' : 'none'
                                        }}
                                    >
                                        <td style={{
                                            padding: 'var(--space-md) var(--space-lg)',
                                            fontWeight: 500
                                        }}>{feature}</td>
                                        <td style={{
                                            padding: 'var(--space-md) var(--space-lg)',
                                            textAlign: 'center',
                                            color: 'var(--text-primary)'
                                        }}>{ours}</td>
                                        <td style={{
                                            padding: 'var(--space-md) var(--space-lg)',
                                            textAlign: 'center',
                                            color: 'var(--text-tertiary)'
                                        }}>{theirs}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </motion.div>

                    {/* Data Sources */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        style={{
                            marginTop: 'var(--space-3xl)',
                            textAlign: 'center'
                        }}
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
                                { name: 'NISAR', org: 'NASA-ISRO' },
                                { name: 'Sentinel-1', org: 'ESA' },
                                { name: 'ICEYE', org: 'Commercial' },
                                { name: 'Capella', org: 'Commercial' },
                                { name: 'ALOS-2', org: 'JAXA' },
                            ].map((source) => (
                                <div key={source.name} style={{ textAlign: 'center' }}>
                                    <div style={{
                                        fontFamily: 'var(--font-mono)',
                                        fontWeight: 600,
                                        fontSize: '1.1rem',
                                        color: 'var(--text-primary)'
                                    }}>
                                        {source.name}
                                    </div>
                                    <div style={{
                                        fontSize: '0.75rem',
                                        color: 'var(--text-tertiary)'
                                    }}>
                                        {source.org}
                                    </div>
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
                        <h2>Ready to Process Your SAR Data?</h2>
                        <p style={{
                            color: 'var(--text-secondary)',
                            marginTop: 'var(--space-md)',
                            marginBottom: 'var(--space-xl)'
                        }}>
                            Get started with our open-source platform today
                        </p>
                        <div style={{ display: 'flex', gap: 'var(--space-md)', justifyContent: 'center' }}>
                            <Link to="/demo" className="btn btn-primary">
                                Try Live Demo
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
