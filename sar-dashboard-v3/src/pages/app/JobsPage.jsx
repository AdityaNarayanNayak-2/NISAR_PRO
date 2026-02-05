import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { mockJobs } from '../../store/workflowStore'
import { formatDistanceToNow } from 'date-fns'

function JobsPage() {
    const [jobs, setJobs] = useState(mockJobs)
    const [filter, setFilter] = useState('all')

    useEffect(() => {
        const interval = setInterval(() => {
            setJobs(prevJobs =>
                prevJobs.map(job => {
                    if (job.status === 'processing' && job.progress < 100) {
                        const newProgress = Math.min(job.progress + Math.random() * 3, 100)
                        return {
                            ...job,
                            progress: newProgress,
                            status: newProgress >= 100 ? 'completed' : 'processing'
                        }
                    }
                    return job
                })
            )
        }, 2000)
        return () => clearInterval(interval)
    }, [])

    const filteredJobs = filter === 'all' ? jobs : jobs.filter(j => j.status === filter)

    const getStatusStyle = (status) => {
        switch (status) {
            case 'completed': return { bg: 'rgba(34, 197, 94, 0.1)', border: 'rgba(34, 197, 94, 0.2)', color: '#22c55e' }
            case 'processing': return { bg: 'rgba(99, 102, 241, 0.1)', border: 'rgba(99, 102, 241, 0.2)', color: '#6366f1' }
            case 'queued': return { bg: 'rgba(156, 163, 175, 0.1)', border: 'rgba(156, 163, 175, 0.2)', color: '#9ca3af' }
            default: return { bg: 'transparent', border: 'transparent', color: 'var(--text-tertiary)' }
        }
    }

    return (
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                style={{ marginBottom: 'var(--space-xl)' }}
            >
                <h1 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: 'var(--space-xs)' }}>
                    Processing Jobs
                </h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                    Monitor your SAR processing jobs
                </p>
            </motion.div>

            {/* Stats */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    gap: 'var(--space-md)',
                    marginBottom: 'var(--space-xl)'
                }}
            >
                {[
                    { label: 'Total', value: jobs.length },
                    { label: 'Processing', value: jobs.filter(j => j.status === 'processing').length },
                    { label: 'Completed', value: jobs.filter(j => j.status === 'completed').length },
                    { label: 'Queued', value: jobs.filter(j => j.status === 'queued').length }
                ].map(stat => (
                    <div
                        key={stat.label}
                        style={{
                            padding: 'var(--space-md)',
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: 'var(--radius-md)',
                            textAlign: 'center'
                        }}
                    >
                        <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>{stat.value}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{stat.label}</div>
                    </div>
                ))}
            </motion.div>

            {/* Filters */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                style={{ display: 'flex', gap: 'var(--space-xs)', marginBottom: 'var(--space-lg)' }}
            >
                {['all', 'processing', 'completed', 'queued'].map((f) => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        style={{
                            padding: 'var(--space-xs) var(--space-md)',
                            background: filter === f ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                            border: 'none',
                            borderRadius: 'var(--radius-md)',
                            color: filter === f ? 'white' : 'var(--text-secondary)',
                            cursor: 'pointer',
                            fontSize: '0.8rem',
                            textTransform: 'capitalize'
                        }}
                    >
                        {f}
                    </button>
                ))}
            </motion.div>

            {/* Jobs Table */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                style={{
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-lg)',
                    overflow: 'hidden'
                }}
            >
                {/* Header */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 120px 180px 100px 80px',
                    gap: 'var(--space-md)',
                    padding: 'var(--space-md) var(--space-lg)',
                    background: 'var(--bg-tertiary)',
                    fontSize: '0.75rem',
                    color: 'var(--text-tertiary)',
                    fontWeight: 500
                }}>
                    <div>Job Name</div>
                    <div>Type</div>
                    <div>Progress</div>
                    <div>Status</div>
                    <div></div>
                </div>

                {/* Rows */}
                {filteredJobs.map((job) => {
                    const statusStyle = getStatusStyle(job.status)
                    return (
                        <div
                            key={job.id}
                            style={{
                                display: 'grid',
                                gridTemplateColumns: '1fr 120px 180px 100px 80px',
                                gap: 'var(--space-md)',
                                padding: 'var(--space-lg)',
                                borderTop: '1px solid var(--border-subtle)',
                                alignItems: 'center'
                            }}
                        >
                            <div>
                                <div style={{ fontWeight: 500, marginBottom: '2px' }}>{job.name}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                                    {job.id}
                                </div>
                            </div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                {job.mission.toUpperCase()}
                            </div>
                            <div>
                                {job.status === 'processing' ? (
                                    <div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '0.75rem' }}>
                                            <span style={{ color: 'var(--text-tertiary)' }}>Processing</span>
                                            <span style={{ fontFamily: 'var(--font-mono)' }}>{Math.round(job.progress)}%</span>
                                        </div>
                                        <div style={{ height: '4px', background: 'var(--bg-tertiary)', borderRadius: '2px', overflow: 'hidden' }}>
                                            <div style={{ width: `${job.progress}%`, height: '100%', background: 'var(--accent-primary)', borderRadius: '2px' }} />
                                        </div>
                                    </div>
                                ) : (
                                    <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>—</span>
                                )}
                            </div>
                            <div>
                                <span style={{
                                    padding: '4px 8px',
                                    background: statusStyle.bg,
                                    border: `1px solid ${statusStyle.border}`,
                                    borderRadius: 'var(--radius-sm)',
                                    fontSize: '0.75rem',
                                    color: statusStyle.color,
                                    textTransform: 'capitalize'
                                }}>
                                    {job.status}
                                </span>
                            </div>
                            <div>
                                {job.status === 'completed' ? (
                                    <Link to="/app/results" style={{ fontSize: '0.8rem', color: 'var(--accent-primary)', textDecoration: 'none' }}>
                                        View →
                                    </Link>
                                ) : (
                                    <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>—</span>
                                )}
                            </div>
                        </div>
                    )
                })}
            </motion.div>
        </div>
    )
}

export default JobsPage
