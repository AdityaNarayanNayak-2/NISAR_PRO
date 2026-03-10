import { motion } from 'framer-motion'

const useCaseCards = [
    {
        id: 'core-algorithm',
        type: 'large',
        category: 'MISSION PROCESSING',
        title: 'Range-Doppler chain for repeatable scene generation',
        description: 'Deterministic signal conditioning and image formation flow for mission operations and analyst review.',
        bullets: [
            'Range compression with configurable matched filtering window',
            'Azimuth compression with precomputed Doppler centroid support',
            'Block-level reproducibility checks against reference products',
            'Quality gate before export into downstream analytics'
        ],
        metrics: ['PSLR: -13.8 dB', 'ISLR: -9.4 dB', 'Scene build: 11m 24s (512 km swath)'],
        action: 'Inspect validation logs',
        status: 'Validated'
    },
    {
        id: 'rcmc',
        type: 'small',
        category: 'SIGNAL CORRECTION',
        title: 'RCMC implementation under controlled error bounds',
        description: 'Range Cell Migration Correction implemented with bounded interpolation error and checkpointed intermediate outputs.',
        bullets: [
            'Sinc-based interpolation kernels',
            'Kernel reuse across burst segments',
            'Error envelope tracked per strip'
        ],
        metrics: ['RCMC residual: < 0.18 px', 'FFT plan: 1024-point reusable'],
        action: 'View correction report',
        status: 'Validated'
    },
    {
        id: 'cloud-orchestration',
        type: 'small',
        category: 'PLATFORM INFRASTRUCTURE',
        title: 'Cloud-native orchestration for batch reliability',
        description: 'Processing jobs are scheduled on Kubernetes with explicit retry strategy and traceable execution records.',
        bullets: [
            'Operator-driven lifecycle for SARJob resources',
            'Pod-level retry policy by failure class',
            'Structured telemetry for each stage transition'
        ],
        metrics: ['Job recovery: 99.2%', 'Median queue wait: 38s'],
        action: 'Open orchestration profile',
        status: 'In Progress'
    },
    {
        id: 'performance',
        type: 'large',
        category: 'BENCHMARKS',
        title: 'Performance profile grounded in reproducible runs',
        description: 'Benchmark suite tracks execution time, memory profile, and output quality by mission and acquisition mode.',
        bullets: [
            'Sentinel-1 IW and NISAR L-band benchmark sets maintained in CI',
            'Memory ceiling alarms for long-strip workloads',
            'Per-stage timing breakdown for targeted optimization',
            'Output checksum audit before publishing artifacts'
        ],
        metrics: ['Throughput: 2.7 scenes / hour / node', 'Peak RAM: 7.6 GB', 'Re-run drift: < 0.3%'],
        action: 'View benchmark matrix',
        status: 'Validated'
    },
    {
        id: 'multi-mission',
        type: 'small',
        category: 'DATA INTEROPERABILITY',
        title: 'Multi-mission ingest pipeline',
        description: 'Common internal schema supports Sentinel-1, NISAR and commercial scenes without mission-specific UI branching.',
        bullets: [
            'Unified metadata model for ingest',
            'Mission adapters with explicit version mapping',
            'Cross-mission QA template'
        ],
        metrics: ['Supported missions: 4', 'Adapter test pass: 98.9%'],
        action: 'Review compatibility table',
        status: 'Planned'
    }
]

function UseCasesPage() {
    return (
        <motion.main
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
            style={{ paddingTop: '110px', paddingBottom: 'var(--space-3xl)' }}
        >
            <section className="section" style={{ paddingBottom: 'var(--space-xl)' }}>
                <div className="container">
                    <div style={{ maxWidth: '860px' }}>
                        <span className="section-label">Use Cases</span>
                        <h1 style={{ marginTop: 'var(--space-sm)' }}>Operational contexts for SAR processing</h1>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', marginTop: 'var(--space-md)' }}>
                            Structured capability cards focused on validated algorithm behavior, infrastructure readiness,
                            and mission-level reliability.
                        </p>
                    </div>
                </div>
            </section>

            <section className="section" style={{ paddingTop: 0 }}>
                <div className="container">
                    <div className="enterprise-card-grid">
                        {useCaseCards.map((card, index) => (
                            <motion.article
                                key={card.id}
                                className={`enterprise-card ${card.type === 'large' ? 'span-2' : ''}`}
                                initial={{ opacity: 0, y: 12 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.05 + index * 0.04, duration: 0.25 }}
                                whileHover={{ y: -3 }}
                            >
                                <div className="enterprise-card-head">
                                    <span className="enterprise-category">{card.category}</span>
                                    <span className={`enterprise-status ${card.status.toLowerCase().replace(' ', '-')}`}>{card.status}</span>
                                </div>
                                <h3>{card.title}</h3>
                                <p className="enterprise-body">{card.description}</p>
                                <ul className="enterprise-bullets">
                                    {card.bullets.map((item) => (
                                        <li key={item}>{item}</li>
                                    ))}
                                </ul>
                                <div className="enterprise-metrics">
                                    {card.metrics.map((metric) => (
                                        <div key={metric}>{metric}</div>
                                    ))}
                                </div>
                                <button className="enterprise-action" type="button">{card.action}</button>
                            </motion.article>
                        ))}
                    </div>
                </div>
            </section>
        </motion.main>
    )
}

export default UseCasesPage
