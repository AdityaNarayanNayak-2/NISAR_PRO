import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Leaf, Building2, Trees, ShieldAlert, Pickaxe, Shield, ChevronRight } from 'lucide-react'

const industries = [
    {
        icon: <Leaf size={28} className="text-green-500" />,
        title: 'Agriculture',
        description: 'Precision farming with crop health monitoring, soil moisture analysis, and yield prediction using multi-temporal SAR.',
        applications: ['Crop Health', 'Soil Moisture', 'Yield Prediction'],
        color: '#22c55e',
        link: '/use-cases#agriculture'
    },
    {
        icon: <Building2 size={28} className="text-purple-500" />,
        title: 'Urban Planning',
        description: 'Monitor infrastructure stability, track urban expansion, and detect mm-level ground subsidence with InSAR.',
        applications: ['Subsidence', 'Infrastructure', 'Construction'],
        color: '#a855f7',
        link: '/use-cases#urban'
    },
    {
        icon: <Trees size={28} className="text-cyan-500" />,
        title: 'Environmental',
        description: 'Track deforestation, monitor glaciers, detect oil spills, and quantify carbon for climate action.',
        applications: ['Deforestation', 'Glaciers', 'Oil Spills'],
        color: '#06b6d4',
        link: '/use-cases#environment'
    },
    {
        icon: <ShieldAlert size={28} className="text-red-500" />,
        title: 'Disaster Response',
        description: 'Rapid flood mapping, earthquake damage assessment, and landslide prediction when every minute counts.',
        applications: ['Floods', 'Earthquakes', 'Landslides'],
        color: '#ef4444',
        link: '/use-cases#disaster'
    },
    {
        icon: <Pickaxe size={28} className="text-amber-500" />,
        title: 'Mining & Resources',
        description: 'Detect mineral deposits, monitor land stability, track excavation, and ensure environmental compliance.',
        applications: ['Deposits', 'Stability', 'Compliance'],
        color: '#f59e0b',
        link: '/use-cases#mining'
    },
    {
        icon: <Shield size={28} className="text-pink-500" />,
        title: 'Defense & Security',
        description: 'ISR missions, change detection, maritime surveillance, and border security — all-weather, day-night.',
        applications: ['ISR', 'Surveillance', 'Maritime'],
        color: '#ec4899',
        link: '/use-cases#defense'
    }
]

function DataVisualization() {
    return (
        <section style={{
            padding: '120px 0',
            background: '#040404',
            position: 'relative',
            overflow: 'hidden'
        }}>
            <div className="container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 2rem' }}>
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    style={{ textAlign: 'center', marginBottom: '80px' }}
                >
                    <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        padding: '6px 16px',
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '100px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em',
                        color: '#94a3b8',
                        marginBottom: '24px'
                    }}>
                        Use Cases
                    </div>
                    <h2 style={{ fontSize: 'clamp(2.5rem, 4vw, 3.5rem)', fontWeight: 700, color: '#ffffff', letterSpacing: '-0.02em', marginBottom: '16px' }}>
                        SAR for <span style={{ color: '#94a3b8' }}>Every Sector</span>
                    </h2>
                    <p style={{ color: '#94a3b8', fontSize: '1.1rem', maxWidth: '600px', margin: '0 auto' }}>
                        Process any SAR data for actionable insights across industries, regardless of weather or daylight.
                    </p>
                </motion.div>

                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
                    gap: '24px',
                }}>
                    {industries.map((industry, index) => (
                        <motion.div
                            key={industry.title}
                            initial={{ opacity: 0, y: 30 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: index * 0.1 }}
                            whileHover={{ y: -4, borderColor: `rgba(${industry.color}, 0.5)` }}
                            style={{
                                background: 'rgba(255, 255, 255, 0.02)',
                                border: '1px solid rgba(255, 255, 255, 0.05)',
                                borderRadius: '20px',
                                padding: '32px',
                                position: 'relative',
                                overflow: 'hidden',
                                display: 'flex',
                                flexDirection: 'column',
                                transition: 'all 0.3s ease',
                                cursor: 'pointer'
                            }}
                            onMouseEnter={e => {
                                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
                                e.currentTarget.style.boxShadow = `0 8px 32px ${industry.color}15`;
                            }}
                            onMouseLeave={e => {
                                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)';
                                e.currentTarget.style.boxShadow = 'none';
                            }}
                        >
                            {/* Top accent line */}
                            <div style={{
                                position: 'absolute',
                                top: 0, left: 0, right: 0, height: '2px',
                                background: `linear-gradient(90deg, transparent, ${industry.color}, transparent)`
                            }} />

                            <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
                                {/* Icon */}
                                <div style={{
                                    width: '48px', height: '48px',
                                    borderRadius: '12px',
                                    background: `${industry.color}15`,
                                    border: `1px solid ${industry.color}30`,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    marginBottom: '24px'
                                }}>
                                    {industry.icon}
                                </div>

                                {/* Title & Desc */}
                                <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#ffffff', marginBottom: '12px' }}>
                                    {industry.title}
                                </h3>
                                <p style={{ color: '#94a3b8', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '24px', flexGrow: 1 }}>
                                    {industry.description}
                                </p>

                                {/* Tags */}
                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '32px' }}>
                                    {industry.applications.map(app => (
                                        <span key={app} style={{
                                            padding: '4px 10px',
                                            background: `${industry.color}10`,
                                            border: `1px solid ${industry.color}20`,
                                            borderRadius: '6px',
                                            fontSize: '0.75rem',
                                            fontFamily: '"JetBrains Mono", monospace',
                                            color: industry.color
                                        }}>
                                            {app}
                                        </span>
                                    ))}
                                </div>

                                {/* Link */}
                                < Link to={industry.link} style={{
                                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                                    color: industry.color, textDecoration: 'none',
                                    fontSize: '0.9rem', fontWeight: 500
                                }}>
                                    Explore use cases <ChevronRight size={16} />
                                </Link>
                            </div>
                        </motion.div>
                    ))
                    }
                </div >

                <div style={{ display: 'flex', justifyContent: 'center', marginTop: '64px' }}>
                    <Link to="/use-cases" style={{
                        display: 'inline-flex', alignItems: 'center', gap: '8px',
                        padding: '12px 28px', background: '#ffffff', color: '#000000',
                        borderRadius: '8px', fontSize: '0.95rem', fontWeight: 600, textDecoration: 'none',
                        transition: 'transform 0.2s ease', boxShadow: '0 0 24px rgba(255,255,255,0.1)'
                    }}
                        onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                        onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                    >
                        View All Use Cases <ChevronRight size={18} />
                    </Link>
                </div>
            </div >
        </section >
    )
}

export default DataVisualization
