import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { mockJobs } from '../../store/workflowStore'

const statusColors = {
    completed: { bg: 'rgba(34, 197, 94, 0.1)', border: 'rgba(34, 197, 94, 0.3)', text: '#22c55e' },
    processing: { bg: 'rgba(99, 102, 241, 0.1)', border: 'rgba(99, 102, 241, 0.3)', text: '#6366f1' },
    queued: { bg: 'rgba(113, 113, 122, 0.1)', border: 'rgba(113, 113, 122, 0.3)', text: '#71717a' },
    failed: { bg: 'rgba(239, 68, 68, 0.1)', border: 'rgba(239, 68, 68, 0.3)', text: '#ef4444' },
}

function JobsPage() {
    const [jobs, setJobs] = useState(mockJobs)
    const [filter, setFilter] = useState('all')

    // Simulate progress updates
    useEffect(() => {
        const interval = setInterval(() => {
            setJobs(prevJobs =>
                prevJobs.map(job => {
                    if (job.status === 'processing' && job.progress < 100) {
                        const newProgress = Math.min(job.progress + Math.random() * 5, 100)
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

    const filteredJobs = filter === 'all'
        ? jobs
        : jobs.filter(j => j.status === filter)

    return (
        <div>
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                style={{ marginBottom: 'var(--space-xl)' }}
            >
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-sm)',
                    marginBottom: 'var(--space-sm)'
                }}>
                    <span style={{
                        padding: 'var(--space-xs) var(--space-sm)',
                        background: 'var(--accent-gradient)',
                        borderRadius: 'var(--radius-full)',
                        fontSize: '0.7rem',
                        fontFamily: 'var(--font-mono)'
                    }}>
                        STEP 4
                    </span>
                </div>
                <h1 style={{ marginBottom: 'var(--space-sm)' }}>
                    Processing <span className="text-gradient">Jobs</span>
                </h1>
                <p style={{ color: 'var(--text-secondary)' }}>
                    Monitor your SAR processing jobs in real-time
                </p>
            </motion.div>

            {/* Quick Stats */}
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
                    { label: 'Total', value: jobs.length, color: 'var(--text-primary)' },
                    { label: 'Processing', value: jobs.filter(j => j.status === 'processing').length, color: '#6366f1' },
                    { label: 'Completed', value: jobs.filter(j => j.status === 'completed').length, color: '#22c55e' },
                    { label: 'Queued', value: jobs.filter(j => j.status === 'queued').length, color: '#71717a' },
                ].map((stat) => (
                    <div
                        key={stat.label}
                        className="card"
                        style={{ textAlign: 'center', padding: 'var(--space-lg)' }}
                    >
                        <div style={{
                            fontSize: '1.75rem',
                            fontWeight: 700,
                            color: stat.color
                        }}>
                            {stat.value}
                        </div>
                        <div style={{
                            fontSize: '0.8rem',
                            color: 'var(--text-tertiary)'
                        }}>
                            {stat.label}
                        </div>
                    </div>
                ))}
            </motion.div>

            {/* Filters */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                style={{
                    display: 'flex',
                    gap: 'var(--space-sm)',
                    marginBottom: 'var(--space-lg)'
                }}
            >
                {['all', 'processing', 'completed', 'queued'].map((f) => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        style={{
                            padding: 'var(--space-sm) var(--space-md)',
                            background: filter === f ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                            border: 'none',
                            borderRadius: 'var(--radius-md)',
                            color: filter === f ? 'white' : 'var(--text-secondary)',
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                            textTransform: 'capitalize'
                        }}
                    >
                        {f}
                    </button>
                ))}
            </motion.div>

            {/* Jobs List */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}
            >
                {filteredJobs.map((job, index) => {
                    const colors = statusColors[job.status]
                    return (
                        <motion.div
                            key={job.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className="card"
                            style={{
                                display: 'grid',
                                gridTemplateColumns: '1fr 150px 120px 100px',
                                alignItems: 'center',
                                gap: 'var(--space-lg)',
                                background: colors.bg,
                                border: `1px solid ${colors.border}`
                            }}
                        >
                            {/* Job Info */}
                            <div>
                                <div style={{
                                    fontWeight: 600,
                                    marginBottom: 'var(--space-xs)'
                                }}>
                                    {job.name}
                                </div>
                                <div style={{
                                    fontSize: '0.8rem',
                                    color: 'var(--text-tertiary)',
                                    fontFamily: 'var(--font-mono)'
                                }}>
                                    {job.id} • {job.mission.toUpperCase()} • {job.processType.toUpperCase()}
                                </div>
                            </div>

                            {/* Progress */}
                            <div>
                                {job.status === 'processing' ? (
                                    <div>
                                        <div style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            marginBottom: 'var(--space-xs)',
                                            fontSize: '0.8rem'
                                        }}>
                                            <span>Progress</span>
                                            <span style={{ fontFamily: 'var(--font-mono)' }}>
                                                {Math.round(job.progress)}%
                                            </span>
                                        </div>
                                        <div style={{
                                            height: '6px',
                                            background: 'var(--bg-tertiary)',
                                            borderRadius: 'var(--radius-full)',
                                            overflow: 'hidden'
                                        }}>
                                            <motion.div
                                                initial={{ width: 0 }}
                                                animate={{ width: `${job.progress}%` }}
                                                style={{
                                                    height: '100%',
                                                    background: 'var(--accent-gradient)',
                                                    borderRadius: 'var(--radius-full)'
                                                }}
                                            />
                                        </div>
                                    </div>
                                ) : (
                                    <span style={{
                                        fontSize: '0.85rem',
                                        color: 'var(--text-tertiary)'
                                    }}>
                                        —
                                    </span>
                                )}
                            </div>

                            {/* Status */}
                            <div style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 'var(--space-xs)',
                                padding: 'var(--space-xs) var(--space-sm)',
                                background: colors.bg,
                                border: `1px solid ${colors.border}`,
                                borderRadius: 'var(--radius-full)',
                                fontSize: '0.8rem',
                                color: colors.text,
                                textTransform: 'capitalize'
                            }}>
                                {job.status === 'completed' && '✅'}
                                {job.status === 'processing' && '⚡'}
                                {job.status === 'queued' && '⏳'}
                                {job.status}
                            </div>

                            {/* Actions */}
                            <div style={{ textAlign: 'right' }}>
                                {job.status === 'completed' ? (
                                    <Link
                                        to="/app/results"
                                        style={{
                                            color: 'var(--accent-primary)',
                                            textDecoration: 'none',
                                            fontSize: '0.85rem'
                                        }}
                                    >
                                        View Results →
                                    </Link>
                                ) : (
                                    <span style={{
                                        fontSize: '0.85rem',
                                        color: 'var(--text-tertiary)'
                                    }}>
                                        {job.status === 'processing' ? 'Running...' : 'Pending'}
                                    </span>
                                )}
                            </div>
                        </motion.div>
                    )
                })}
            </motion.div>
        </div>
    )
}

export default JobsPage
