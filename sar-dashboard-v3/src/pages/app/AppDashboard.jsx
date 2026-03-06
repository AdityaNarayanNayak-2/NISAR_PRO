import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { mockJobs } from '../../store/workflowStore'
import { formatDistanceToNow } from 'date-fns'

function AppDashboard() {
    const activeJobs = mockJobs.filter(j => j.status === 'processing')
    const completedJobs = mockJobs.filter(j => j.status === 'completed')

    return (
        <div style={{ maxWidth: '960px' }}>
            {/* Header */}
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: '36px' }}>
                <h1 style={{ fontSize: '2rem', fontWeight: 700, color: '#000', letterSpacing: '-0.02em', marginBottom: '6px' }}>
                    Processing Dashboard
                </h1>
                <p style={{ color: '#666', fontSize: '0.95rem' }}>
                    Start a new analysis or monitor existing SAR processing jobs
                </p>
            </motion.div>

            {/* Quick Actions — curvy white cards */}
            <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08 }}
                style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '36px' }}
            >
                {[
                    { to: '/app/select', icon: '＋', label: 'New Analysis', desc: 'Start a new SAR processing workflow', accent: true },
                    { to: '/app/data', icon: '🛰', label: 'Browse Data', desc: 'Explore NISAR, Sentinel-1 and more', accent: false },
                    { to: '/app/jobs', icon: '📊', label: 'All Jobs', desc: `${mockJobs.length} total jobs in system`, accent: false },
                ].map((item) => (
                    <Link key={item.to} to={item.to} style={{ textDecoration: 'none' }}>
                        <motion.div
                            whileHover={{ translateY: -2, boxShadow: '0 8px 28px rgba(0,0,0,0.12)' }}
                            transition={{ duration: 0.2 }}
                            style={{
                                background: item.accent ? '#0078d4' : '#ffffff',
                                borderRadius: '20px',
                                boxShadow: '0 4px 20px rgba(0,0,0,0.07)',
                                padding: '28px 24px',
                                cursor: 'pointer'
                            }}
                        >
                            <div style={{
                                width: '40px', height: '40px',
                                background: item.accent ? 'rgba(255,255,255,0.2)' : '#f0f6fc',
                                borderRadius: '12px',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '1.2rem', marginBottom: '16px'
                            }}>
                                {item.icon}
                            </div>
                            <div style={{ fontWeight: 700, fontSize: '1rem', color: item.accent ? '#fff' : '#1a1a1a', marginBottom: '4px' }}>
                                {item.label}
                            </div>
                            <div style={{ fontSize: '0.85rem', color: item.accent ? 'rgba(255,255,255,0.75)' : '#666' }}>
                                {item.desc}
                            </div>
                        </motion.div>
                    </Link>
                ))}
            </motion.div>

            {/* Active Jobs */}
            {activeJobs.length > 0 && (
                <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 }}
                    style={{ marginBottom: '28px' }}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                        <h2 style={{ fontSize: '1rem', fontWeight: 600, color: '#1a1a1a' }}>Active Processing</h2>
                        <span style={{ fontSize: '0.8rem', color: '#888' }}>{activeJobs.length} running</span>
                    </div>
                    <div style={{ background: '#fff', borderRadius: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.07)', overflow: 'hidden' }}>
                        {activeJobs.map((job, i) => (
                            <div key={job.id} style={{
                                padding: '18px 24px',
                                borderBottom: i < activeJobs.length - 1 ? '1px solid #f0f0f0' : 'none',
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                            }}>
                                <div>
                                    <div style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: '2px' }}>{job.name}</div>
                                    <div style={{ fontSize: '0.78rem', color: '#888', fontFamily: 'JetBrains Mono, monospace' }}>
                                        {job.mission.toUpperCase()} · {job.processType.toUpperCase()}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                    <div style={{ width: '140px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', fontSize: '0.75rem', color: '#888' }}>
                                            <span>Progress</span>
                                            <span>{Math.round(job.progress)}%</span>
                                        </div>
                                        <div style={{ height: '5px', background: '#ebebeb', borderRadius: '99px', overflow: 'hidden' }}>
                                            <div style={{ width: `${job.progress}%`, height: '100%', background: '#0078d4', borderRadius: '99px', transition: 'width 0.4s ease' }} />
                                        </div>
                                    </div>
                                    <Link to="/app/jobs" style={{ fontSize: '0.85rem', color: '#0078d4', textDecoration: 'none' }}>View →</Link>
                                </div>
                            </div>
                        ))}
                    </div>
                </motion.div>
            )}

            {/* Recent Results */}
            <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.22 }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                    <h2 style={{ fontSize: '1rem', fontWeight: 600, color: '#1a1a1a' }}>Recent Results</h2>
                    <Link to="/app/results" style={{ fontSize: '0.85rem', color: '#0078d4', textDecoration: 'none' }}>View all →</Link>
                </div>
                <div style={{ background: '#fff', borderRadius: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.07)', overflow: 'hidden' }}>
                    {completedJobs.length > 0 ? completedJobs.map((job, i) => (
                        <div key={job.id} style={{
                            padding: '18px 24px',
                            borderBottom: i < completedJobs.length - 1 ? '1px solid #f0f0f0' : 'none',
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                        }}>
                            <div>
                                <div style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: '2px' }}>{job.name}</div>
                                <div style={{ fontSize: '0.78rem', color: '#888' }}>
                                    Completed {job.completedAt ? formatDistanceToNow(job.completedAt, { addSuffix: true }) : 'recently'}
                                </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                <span style={{
                                    padding: '3px 10px', borderRadius: '99px', fontSize: '0.75rem', fontWeight: 500,
                                    background: 'rgba(26,127,60,0.08)', color: '#1a7f3c', border: '1px solid rgba(26,127,60,0.2)'
                                }}>
                                    Completed
                                </span>
                                <Link to="/app/results" style={{ fontSize: '0.85rem', color: '#0078d4', textDecoration: 'none' }}>View →</Link>
                            </div>
                        </div>
                    )) : (
                        <div style={{ padding: '40px', textAlign: 'center', color: '#aaa', fontSize: '0.9rem' }}>
                            No completed jobs yet
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    )
}

export default AppDashboard
