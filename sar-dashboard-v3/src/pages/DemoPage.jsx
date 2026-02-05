import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'

const pageVariants = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 }
}

// Simulated processing jobs
const initialJobs = [
    { id: 'SAR-2026-001', name: 'NISAR_L1_SLC_Mumbai', status: 'completed', progress: 100, time: '2m 34s' },
    { id: 'SAR-2026-002', name: 'S1A_IW_SLC_Delhi', status: 'processing', progress: 67, time: '1m 45s' },
    { id: 'SAR-2026-003', name: 'NISAR_L2_INSAR_Kolkata', status: 'queued', progress: 0, time: '--' },
]

function DemoPage() {
    const [jobs, setJobs] = useState(initialJobs)
    const [selectedJob, setSelectedJob] = useState(null)
    const [isProcessing, setIsProcessing] = useState(false)

    // Simulate processing progress
    useEffect(() => {
        const interval = setInterval(() => {
            setJobs(prev => prev.map(job => {
                if (job.status === 'processing' && job.progress < 100) {
                    const newProgress = Math.min(job.progress + Math.random() * 5, 100)
                    return {
                        ...job,
                        progress: newProgress,
                        status: newProgress >= 100 ? 'completed' : 'processing'
                    }
                }
                return job
            }))
        }, 1000)
        return () => clearInterval(interval)
    }, [])

    const startNewJob = () => {
        setIsProcessing(true)
        const newJob = {
            id: `SAR-2026-${String(jobs.length + 1).padStart(3, '0')}`,
            name: `DEMO_SLC_${Date.now()}`,
            status: 'processing',
            progress: 0,
            time: '0s'
        }
        setJobs(prev => [...prev, newJob])
        setSelectedJob(newJob.id)
    }

    return (
        <motion.main
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.5 }}
            style={{ paddingTop: '120px', minHeight: '100vh' }}
        >
            {/* Header */}
            <section className="section">
                <div className="container">
                    <motion.div
                        className="section-header"
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                    >
                        <span className="section-label">Live Demo</span>
                        <h1>SAR Processing <span className="text-gradient">Console</span></h1>
                        <p style={{
                            color: 'var(--text-secondary)',
                            maxWidth: '600px',
                            margin: '0 auto',
                            marginTop: 'var(--space-lg)'
                        }}>
                            Real-time visualization of our Range-Doppler Algorithm in action
                        </p>
                    </motion.div>
                </div>
            </section>

            {/* Processing Console */}
            <section className="section" style={{ paddingTop: 0 }}>
                <div className="container">
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 2fr',
                        gap: 'var(--space-xl)',
                    }}>

                        {/* Job Queue */}
                        <motion.div
                            className="card"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.3 }}
                        >
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginBottom: 'var(--space-lg)'
                            }}>
                                <h3 style={{ fontSize: '1.1rem' }}>Processing Queue</h3>
                                <button
                                    className="btn btn-primary"
                                    onClick={startNewJob}
                                    style={{ padding: 'var(--space-sm) var(--space-md)', fontSize: '0.8rem' }}
                                >
                                    + New Job
                                </button>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                                {jobs.map((job, i) => (
                                    <motion.div
                                        key={job.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.4 + i * 0.1 }}
                                        onClick={() => setSelectedJob(job.id)}
                                        style={{
                                            padding: 'var(--space-md)',
                                            background: selectedJob === job.id ? 'var(--bg-tertiary)' : 'var(--bg-secondary)',
                                            border: `1px solid ${selectedJob === job.id ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
                                            borderRadius: 'var(--radius-md)',
                                            cursor: 'pointer',
                                            transition: 'all var(--transition-fast)'
                                        }}
                                    >
                                        <div style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            marginBottom: 'var(--space-xs)'
                                        }}>
                                            <span style={{
                                                fontFamily: 'var(--font-mono)',
                                                fontSize: '0.75rem',
                                                color: 'var(--text-tertiary)'
                                            }}>
                                                {job.id}
                                            </span>
                                            <span style={{
                                                fontFamily: 'var(--font-mono)',
                                                fontSize: '0.75rem',
                                                fontWeight: 600,
                                                color: job.status === 'completed' ? '#10b981' :
                                                    job.status === 'processing' ? 'var(--accent-primary)' :
                                                        'var(--text-tertiary)',
                                                textTransform: 'uppercase'
                                            }}>
                                                {job.status}
                                            </span>
                                        </div>
                                        <div style={{
                                            fontSize: '0.9rem',
                                            fontWeight: 500,
                                            marginBottom: 'var(--space-sm)'
                                        }}>
                                            {job.name}
                                        </div>
                                        <div style={{
                                            height: '4px',
                                            background: 'var(--bg-primary)',
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
                                    </motion.div>
                                ))}
                            </div>
                        </motion.div>

                        {/* Visualization Panel */}
                        <motion.div
                            className="card card-glass"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.4 }}
                            style={{ minHeight: '500px' }}
                        >
                            <h3 style={{ marginBottom: 'var(--space-lg)' }}>Processing Visualization</h3>

                            {/* Simulated SAR Image */}
                            <div style={{
                                aspectRatio: '16/9',
                                background: 'linear-gradient(135deg, var(--bg-primary) 0%, var(--bg-tertiary) 100%)',
                                borderRadius: 'var(--radius-md)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                position: 'relative',
                                overflow: 'hidden'
                            }}>
                                {/* Animated radar scan effect */}
                                <motion.div
                                    animate={{ rotate: 360 }}
                                    transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
                                    style={{
                                        width: '200px',
                                        height: '200px',
                                        background: 'conic-gradient(from 0deg, transparent 0deg, var(--accent-primary) 30deg, transparent 60deg)',
                                        borderRadius: '50%',
                                        opacity: 0.3
                                    }}
                                />
                                <div style={{
                                    position: 'absolute',
                                    fontFamily: 'var(--font-mono)',
                                    fontSize: '0.85rem',
                                    color: 'var(--text-tertiary)'
                                }}>
                                    {selectedJob ? `Viewing: ${selectedJob}` : 'Select a job to visualize'}
                                </div>
                            </div>

                            {/* Processing Stages */}
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(4, 1fr)',
                                gap: 'var(--space-md)',
                                marginTop: 'var(--space-xl)'
                            }}>
                                {['Raw Data', 'Range Comp', 'RCMC', 'Focused'].map((stage, i) => (
                                    <div
                                        key={stage}
                                        style={{
                                            textAlign: 'center',
                                            padding: 'var(--space-md)',
                                            background: i <= 2 ? 'rgba(99, 102, 241, 0.1)' : 'var(--bg-tertiary)',
                                            borderRadius: 'var(--radius-sm)',
                                            border: `1px solid ${i <= 2 ? 'var(--accent-primary)' : 'var(--border-subtle)'}`
                                        }}
                                    >
                                        <div style={{ fontSize: '1.5rem', marginBottom: 'var(--space-xs)' }}>
                                            {i === 0 ? '📡' : i === 1 ? '📊' : i === 2 ? '🎯' : '🖼️'}
                                        </div>
                                        <div style={{
                                            fontSize: '0.75rem',
                                            fontFamily: 'var(--font-mono)',
                                            color: i <= 2 ? 'var(--text-accent)' : 'var(--text-tertiary)'
                                        }}>
                                            {stage}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* Metrics Dashboard */}
            <section className="section">
                <div className="container">
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                        gap: 'var(--space-lg)'
                    }}>
                        {[
                            { label: 'Total Jobs', value: jobs.length, icon: '📋' },
                            { label: 'Completed', value: jobs.filter(j => j.status === 'completed').length, icon: '✅' },
                            { label: 'Processing', value: jobs.filter(j => j.status === 'processing').length, icon: '⚡' },
                            { label: 'Queued', value: jobs.filter(j => j.status === 'queued').length, icon: '⏳' },
                        ].map((stat, i) => (
                            <motion.div
                                key={stat.label}
                                className="card"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.5 + i * 0.1 }}
                                style={{ textAlign: 'center' }}
                            >
                                <div style={{ fontSize: '2rem', marginBottom: 'var(--space-sm)' }}>{stat.icon}</div>
                                <div style={{
                                    fontSize: '2.5rem',
                                    fontWeight: 700,
                                    color: 'var(--text-primary)'
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
                </div>
            </section>
        </motion.main>
    )
}

export default DemoPage
