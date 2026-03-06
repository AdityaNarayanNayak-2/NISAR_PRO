import { motion } from 'framer-motion'
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { mockJobs } from '../../store/workflowStore'

function JobsPage() {
    const [jobs, setJobs] = useState(mockJobs)
    const [filter, setFilter] = useState('all')

    useEffect(() => {
        const id = setInterval(() => {
            setJobs(prev => prev.map(j => {
                if (j.status === 'processing' && j.progress < 100) {
                    const p = Math.min(j.progress + Math.random() * 3, 100)
                    return { ...j, progress: p, status: p >= 100 ? 'completed' : 'processing' }
                }
                return j
            }))
        }, 2000)
        return () => clearInterval(id)
    }, [])

    const filtered = filter === 'all' ? jobs : jobs.filter(j => j.status === filter)

    const statusStyle = (s) => ({
        completed: { bg: 'rgba(26,127,60,0.08)', color: '#1a7f3c', border: 'rgba(26,127,60,0.2)' },
        processing: { bg: 'rgba(0,120,212,0.08)', color: '#0078d4', border: 'rgba(0,120,212,0.2)' },
        queued: { bg: 'rgba(120,120,120,0.07)', color: '#888', border: 'rgba(120,120,120,0.18)' }
    }[s] || {})

    return (
        <div style={{ maxWidth: '960px' }}>
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: '28px' }}>
                <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#000', letterSpacing: '-0.02em', marginBottom: '6px' }}>Processing Jobs</h1>
                <p style={{ color: '#666', fontSize: '0.9rem' }}>Monitor and manage your SAR processing queue</p>
            </motion.div>

            {/* Stats */}
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
                style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '24px' }}
            >
                {[
                    { label: 'Total', val: jobs.length },
                    { label: 'Processing', val: jobs.filter(j => j.status === 'processing').length },
                    { label: 'Completed', val: jobs.filter(j => j.status === 'completed').length },
                    { label: 'Queued', val: jobs.filter(j => j.status === 'queued').length }
                ].map(s => (
                    <div key={s.label} style={{ background: '#fff', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.07)', padding: '18px 20px', textAlign: 'center' }}>
                        <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#1a1a1a' }}>{s.val}</div>
                        <div style={{ fontSize: '0.78rem', color: '#aaa' }}>{s.label}</div>
                    </div>
                ))}
            </motion.div>

            {/* Filter Tabs */}
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}
                style={{ display: 'flex', gap: '6px', marginBottom: '16px' }}
            >
                {['all', 'processing', 'completed', 'queued'].map(f => (
                    <button key={f} onClick={() => setFilter(f)}
                        style={{
                            padding: '7px 18px',
                            background: filter === f ? '#1a1a1a' : '#fff',
                            border: `1px solid ${filter === f ? '#1a1a1a' : '#e0e0e0'}`,
                            borderRadius: '99px', color: filter === f ? '#fff' : '#666',
                            cursor: 'pointer', fontSize: '0.82rem', fontWeight: filter === f ? 600 : 400,
                            textTransform: 'capitalize', transition: 'all 0.15s ease'
                        }}
                    >
                        {f}
                    </button>
                ))}
            </motion.div>

            {/* Jobs Table */}
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }}
                style={{ background: '#fff', borderRadius: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.07)', overflow: 'hidden' }}
            >
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 110px 180px 100px 80px', gap: '12px', padding: '12px 24px', background: '#f7f9fb', fontSize: '0.7rem', fontWeight: 600, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #f0f0f0' }}>
                    <div>Job</div><div>Mission</div><div>Progress</div><div>Status</div><div></div>
                </div>

                {filtered.map((job) => {
                    const ss = statusStyle(job.status)
                    return (
                        <div key={job.id} style={{ display: 'grid', gridTemplateColumns: '1fr 110px 180px 100px 80px', gap: '12px', padding: '16px 24px', borderBottom: '1px solid #f5f5f5', alignItems: 'center' }}>
                            <div>
                                <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '2px' }}>{job.name}</div>
                                <div style={{ fontSize: '0.72rem', color: '#bbb', fontFamily: 'JetBrains Mono, monospace' }}>{job.id}</div>
                            </div>
                            <div style={{ fontSize: '0.82rem', color: '#888' }}>{job.mission.toUpperCase()}</div>
                            <div>
                                {job.status === 'processing' ? (
                                    <div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', fontSize: '0.75rem', color: '#aaa' }}>
                                            <span>Running</span><span>{Math.round(job.progress)}%</span>
                                        </div>
                                        <div style={{ height: '5px', background: '#ebebeb', borderRadius: '99px', overflow: 'hidden' }}>
                                            <div style={{ width: `${job.progress}%`, height: '100%', background: '#0078d4', borderRadius: '99px', transition: 'width 0.4s ease' }} />
                                        </div>
                                    </div>
                                ) : <span style={{ fontSize: '0.82rem', color: '#ccc' }}>—</span>}
                            </div>
                            <div>
                                <span style={{ padding: '3px 10px', borderRadius: '99px', fontSize: '0.75rem', fontWeight: 500, background: ss.bg, color: ss.color, border: `1px solid ${ss.border}`, textTransform: 'capitalize' }}>
                                    {job.status}
                                </span>
                            </div>
                            <div>
                                {job.status === 'completed'
                                    ? <Link to="/app/results" style={{ fontSize: '0.82rem', color: '#0078d4', textDecoration: 'none' }}>View →</Link>
                                    : <span style={{ fontSize: '0.82rem', color: '#ccc' }}>—</span>}
                            </div>
                        </div>
                    )
                })}
            </motion.div>
        </div>
    )
}

export default JobsPage
