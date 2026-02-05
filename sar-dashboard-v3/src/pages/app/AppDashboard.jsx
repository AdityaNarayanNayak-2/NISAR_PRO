import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { mockJobs } from '../../store/workflowStore'
import { formatDistanceToNow } from 'date-fns'

function AppDashboard() {
    const activeJobs = mockJobs.filter(j => j.status === 'processing')
    const completedJobs = mockJobs.filter(j => j.status === 'completed')

    return (
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                style={{ marginBottom: 'var(--space-2xl)' }}
            >
                <h1 style={{
                    fontSize: '1.75rem',
                    fontWeight: 600,
                    marginBottom: 'var(--space-sm)'
                }}>
                    Processing Dashboard
                </h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
                    Manage your SAR processing jobs and start new analyses
                </p>
            </motion.div>

            {/* Quick Actions */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                style={{ marginBottom: 'var(--space-2xl)' }}
            >
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                    gap: 'var(--space-lg)'
                }}>
                    {/* New Analysis */}
                    <Link to="/app/select" style={{ textDecoration: 'none' }}>
                        <motion.div
                            whileHover={{ borderColor: 'var(--accent-primary)' }}
                            style={{
                                padding: 'var(--space-xl)',
                                background: 'var(--bg-secondary)',
                                border: '1px solid var(--border-subtle)',
                                borderRadius: 'var(--radius-lg)',
                                cursor: 'pointer',
                                transition: 'border-color 0.15s ease'
                            }}
                        >
                            <div style={{
                                width: '40px',
                                height: '40px',
                                background: 'rgba(99, 102, 241, 0.1)',
                                borderRadius: 'var(--radius-md)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginBottom: 'var(--space-md)',
                                fontSize: '1.2rem'
                            }}>
                                +
                            </div>
                            <h3 style={{
                                fontSize: '1rem',
                                fontWeight: 600,
                                marginBottom: 'var(--space-xs)',
                                color: 'var(--text-primary)'
                            }}>
                                New Analysis
                            </h3>
                            <p style={{
                                fontSize: '0.85rem',
                                color: 'var(--text-tertiary)',
                                margin: 0
                            }}>
                                Start a new SAR processing workflow
                            </p>
                        </motion.div>
                    </Link>

                    {/* Browse Data */}
                    <Link to="/app/data" style={{ textDecoration: 'none' }}>
                        <motion.div
                            whileHover={{ borderColor: 'var(--accent-primary)' }}
                            style={{
                                padding: 'var(--space-xl)',
                                background: 'var(--bg-secondary)',
                                border: '1px solid var(--border-subtle)',
                                borderRadius: 'var(--radius-lg)',
                                cursor: 'pointer',
                                transition: 'border-color 0.15s ease'
                            }}
                        >
                            <div style={{
                                width: '40px',
                                height: '40px',
                                background: 'rgba(6, 182, 212, 0.1)',
                                borderRadius: 'var(--radius-md)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginBottom: 'var(--space-md)',
                                fontSize: '1rem'
                            }}>
                                🛰️
                            </div>
                            <h3 style={{
                                fontSize: '1rem',
                                fontWeight: 600,
                                marginBottom: 'var(--space-xs)',
                                color: 'var(--text-primary)'
                            }}>
                                Browse Data
                            </h3>
                            <p style={{
                                fontSize: '0.85rem',
                                color: 'var(--text-tertiary)',
                                margin: 0
                            }}>
                                Explore available SAR scenes
                            </p>
                        </motion.div>
                    </Link>

                    {/* View Jobs */}
                    <Link to="/app/jobs" style={{ textDecoration: 'none' }}>
                        <motion.div
                            whileHover={{ borderColor: 'var(--accent-primary)' }}
                            style={{
                                padding: 'var(--space-xl)',
                                background: 'var(--bg-secondary)',
                                border: '1px solid var(--border-subtle)',
                                borderRadius: 'var(--radius-lg)',
                                cursor: 'pointer',
                                transition: 'border-color 0.15s ease'
                            }}
                        >
                            <div style={{
                                width: '40px',
                                height: '40px',
                                background: 'rgba(34, 197, 94, 0.1)',
                                borderRadius: 'var(--radius-md)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginBottom: 'var(--space-md)',
                                fontSize: '1rem'
                            }}>
                                📊
                            </div>
                            <h3 style={{
                                fontSize: '1rem',
                                fontWeight: 600,
                                marginBottom: 'var(--space-xs)',
                                color: 'var(--text-primary)'
                            }}>
                                All Jobs
                            </h3>
                            <p style={{
                                fontSize: '0.85rem',
                                color: 'var(--text-tertiary)',
                                margin: 0
                            }}>
                                {mockJobs.length} total jobs
                            </p>
                        </motion.div>
                    </Link>
                </div>
            </motion.div>

            {/* Active Jobs */}
            {activeJobs.length > 0 && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    style={{ marginBottom: 'var(--space-2xl)' }}
                >
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 'var(--space-md)'
                    }}>
                        <h2 style={{ fontSize: '1rem', fontWeight: 600 }}>
                            Active Processing
                        </h2>
                        <span style={{
                            fontSize: '0.8rem',
                            color: 'var(--text-tertiary)'
                        }}>
                            {activeJobs.length} running
                        </span>
                    </div>

                    <div style={{
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-lg)',
                        overflow: 'hidden'
                    }}>
                        {activeJobs.map((job, i) => (
                            <div
                                key={job.id}
                                style={{
                                    padding: 'var(--space-lg)',
                                    borderBottom: i < activeJobs.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between'
                                }}
                            >
                                <div style={{ flex: 1 }}>
                                    <div style={{
                                        fontWeight: 500,
                                        marginBottom: 'var(--space-xs)'
                                    }}>
                                        {job.name}
                                    </div>
                                    <div style={{
                                        fontSize: '0.8rem',
                                        color: 'var(--text-tertiary)',
                                        fontFamily: 'var(--font-mono)'
                                    }}>
                                        {job.mission.toUpperCase()} • {job.processType.toUpperCase()}
                                    </div>
                                </div>

                                <div style={{ width: '200px', marginRight: 'var(--space-lg)' }}>
                                    <div style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        marginBottom: '4px',
                                        fontSize: '0.75rem',
                                        color: 'var(--text-secondary)'
                                    }}>
                                        <span>Processing</span>
                                        <span style={{ fontFamily: 'var(--font-mono)' }}>{Math.round(job.progress)}%</span>
                                    </div>
                                    <div style={{
                                        height: '4px',
                                        background: 'var(--bg-tertiary)',
                                        borderRadius: '2px',
                                        overflow: 'hidden'
                                    }}>
                                        <div style={{
                                            width: `${job.progress}%`,
                                            height: '100%',
                                            background: 'var(--accent-primary)',
                                            borderRadius: '2px',
                                            transition: 'width 0.3s ease'
                                        }} />
                                    </div>
                                </div>

                                <Link
                                    to="/app/jobs"
                                    style={{
                                        fontSize: '0.85rem',
                                        color: 'var(--accent-primary)',
                                        textDecoration: 'none'
                                    }}
                                >
                                    View →
                                </Link>
                            </div>
                        ))}
                    </div>
                </motion.div>
            )}

            {/* Recent Completed */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
            >
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 'var(--space-md)'
                }}>
                    <h2 style={{ fontSize: '1rem', fontWeight: 600 }}>
                        Recent Results
                    </h2>
                    <Link
                        to="/app/results"
                        style={{
                            fontSize: '0.85rem',
                            color: 'var(--accent-primary)',
                            textDecoration: 'none'
                        }}
                    >
                        View all →
                    </Link>
                </div>

                <div style={{
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-lg)',
                    overflow: 'hidden'
                }}>
                    {completedJobs.length > 0 ? completedJobs.map((job, i) => (
                        <div
                            key={job.id}
                            style={{
                                padding: 'var(--space-lg)',
                                borderBottom: i < completedJobs.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between'
                            }}
                        >
                            <div>
                                <div style={{
                                    fontWeight: 500,
                                    marginBottom: 'var(--space-xs)'
                                }}>
                                    {job.name}
                                </div>
                                <div style={{
                                    fontSize: '0.8rem',
                                    color: 'var(--text-tertiary)'
                                }}>
                                    Completed {job.completedAt ? formatDistanceToNow(job.completedAt, { addSuffix: true }) : 'recently'}
                                </div>
                            </div>

                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 'var(--space-md)'
                            }}>
                                <span style={{
                                    padding: '4px 8px',
                                    background: 'rgba(34, 197, 94, 0.1)',
                                    border: '1px solid rgba(34, 197, 94, 0.2)',
                                    borderRadius: 'var(--radius-sm)',
                                    fontSize: '0.75rem',
                                    color: '#22c55e'
                                }}>
                                    Completed
                                </span>
                                <Link
                                    to="/app/results"
                                    style={{
                                        fontSize: '0.85rem',
                                        color: 'var(--accent-primary)',
                                        textDecoration: 'none'
                                    }}
                                >
                                    View →
                                </Link>
                            </div>
                        </div>
                    )) : (
                        <div style={{
                            padding: 'var(--space-2xl)',
                            textAlign: 'center',
                            color: 'var(--text-tertiary)'
                        }}>
                            No completed jobs yet
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    )
}

export default AppDashboard
