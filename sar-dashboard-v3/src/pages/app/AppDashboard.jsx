import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { mockJobs } from '../../store/workflowStore'

function AppDashboard() {
    const recentJobs = mockJobs.slice(0, 3)

    return (
        <div>
            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                style={{ marginBottom: 'var(--space-2xl)' }}
            >
                <h1 style={{ marginBottom: 'var(--space-sm)' }}>
                    Welcome to <span className="text-gradient">SAR Analyzer</span>
                </h1>
                <p style={{ color: 'var(--text-secondary)' }}>
                    Start a new analysis or view your recent processing jobs
                </p>
            </motion.div>

            {/* Quick Stats */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: 'var(--space-lg)',
                marginBottom: 'var(--space-2xl)'
            }}>
                {[
                    { label: 'Active Jobs', value: '2', icon: '⚡', color: '#6366f1' },
                    { label: 'Completed', value: '24', icon: '✅', color: '#22c55e' },
                    { label: 'Data Processed', value: '1.2 TB', icon: '💾', color: '#8b5cf6' },
                    { label: 'Saved Areas', value: '5', icon: '📍', color: '#f59e0b' },
                ].map((stat, i) => (
                    <motion.div
                        key={stat.label}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="card"
                        style={{ textAlign: 'center' }}
                    >
                        <div style={{ fontSize: '2rem', marginBottom: 'var(--space-sm)' }}>
                            {stat.icon}
                        </div>
                        <div style={{
                            fontSize: '2rem',
                            fontWeight: 700,
                            color: stat.color
                        }}>
                            {stat.value}
                        </div>
                        <div style={{
                            fontSize: '0.85rem',
                            color: 'var(--text-tertiary)',
                            fontFamily: 'var(--font-mono)'
                        }}>
                            {stat.label}
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Main Actions */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                gap: 'var(--space-xl)',
                marginBottom: 'var(--space-2xl)'
            }}>
                {/* New Analysis Card */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    whileHover={{ y: -5 }}
                    className="card"
                    style={{
                        background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(139, 92, 246, 0.1))',
                        border: '1px solid rgba(99, 102, 241, 0.3)',
                        cursor: 'pointer'
                    }}
                >
                    <Link to="/app/select" style={{ textDecoration: 'none', color: 'inherit' }}>
                        <div style={{ fontSize: '3rem', marginBottom: 'var(--space-md)' }}>🚀</div>
                        <h3 style={{ marginBottom: 'var(--space-sm)' }}>Start New Analysis</h3>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                            Select a location, choose data source, and configure processing
                        </p>
                        <div style={{
                            marginTop: 'var(--space-lg)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 'var(--space-xs)',
                            color: 'var(--accent-primary)',
                            fontSize: '0.9rem',
                            fontWeight: 500
                        }}>
                            Begin workflow →
                        </div>
                    </Link>
                </motion.div>

                {/* Browse Data Card */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    whileHover={{ y: -5 }}
                    className="card"
                    style={{ cursor: 'pointer' }}
                >
                    <Link to="/app/data" style={{ textDecoration: 'none', color: 'inherit' }}>
                        <div style={{ fontSize: '3rem', marginBottom: 'var(--space-md)' }}>🛰️</div>
                        <h3 style={{ marginBottom: 'var(--space-sm)' }}>Browse Data Catalog</h3>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                            Explore available SAR scenes from NISAR, Sentinel-1, and more
                        </p>
                        <div style={{
                            marginTop: 'var(--space-lg)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 'var(--space-xs)',
                            color: 'var(--text-secondary)',
                            fontSize: '0.9rem'
                        }}>
                            Explore catalog →
                        </div>
                    </Link>
                </motion.div>
            </div>

            {/* Recent Jobs */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
            >
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 'var(--space-lg)'
                }}>
                    <h3>Recent Jobs</h3>
                    <Link
                        to="/app/jobs"
                        style={{
                            color: 'var(--accent-primary)',
                            textDecoration: 'none',
                            fontSize: '0.85rem'
                        }}
                    >
                        View all →
                    </Link>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                    {recentJobs.map((job) => (
                        <div
                            key={job.id}
                            className="card"
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: 'var(--space-lg)'
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                                <div style={{
                                    width: '40px',
                                    height: '40px',
                                    borderRadius: 'var(--radius-md)',
                                    background: job.status === 'completed' ? 'rgba(34, 197, 94, 0.2)' :
                                        job.status === 'processing' ? 'rgba(99, 102, 241, 0.2)' :
                                            'rgba(113, 113, 122, 0.2)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    {job.status === 'completed' ? '✅' :
                                        job.status === 'processing' ? '⚡' : '⏳'}
                                </div>
                                <div>
                                    <div style={{ fontWeight: 500 }}>{job.name}</div>
                                    <div style={{
                                        fontSize: '0.8rem',
                                        color: 'var(--text-tertiary)',
                                        fontFamily: 'var(--font-mono)'
                                    }}>
                                        {job.mission.toUpperCase()} • {job.processType.toUpperCase()}
                                    </div>
                                </div>
                            </div>

                            <div style={{ textAlign: 'right' }}>
                                <div style={{
                                    fontSize: '0.85rem',
                                    fontWeight: 500,
                                    color: job.status === 'completed' ? '#22c55e' :
                                        job.status === 'processing' ? 'var(--accent-primary)' :
                                            'var(--text-tertiary)',
                                    textTransform: 'capitalize'
                                }}>
                                    {job.status}
                                </div>
                                {job.status === 'processing' && (
                                    <div style={{
                                        width: '100px',
                                        height: '4px',
                                        background: 'var(--bg-tertiary)',
                                        borderRadius: 'var(--radius-full)',
                                        marginTop: 'var(--space-xs)',
                                        overflow: 'hidden'
                                    }}>
                                        <div style={{
                                            width: `${job.progress}%`,
                                            height: '100%',
                                            background: 'var(--accent-gradient)',
                                            borderRadius: 'var(--radius-full)'
                                        }} />
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </motion.div>
        </div>
    )
}

export default AppDashboard
