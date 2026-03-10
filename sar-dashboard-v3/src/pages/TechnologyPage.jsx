import { motion } from 'framer-motion'

const technologyCards = [
    {
        id: 'algorithm-stack',
        type: 'large',
        category: 'CORE ALGORITHMS',
        title: 'Range-Doppler and RCMC pipeline architecture',
        description: 'Processing stages are versioned, benchmarked, and traceable from raw IQ samples to analysis outputs.',
        bullets: [
            'Deterministic stage graph for reproducible re-runs',
            'RCMC + azimuth compression tuned by mission profile',
            'Intermediate checkpoints for audit and rollback',
            'Validation harness aligned to reference scenes'
        ],
        metrics: ['Pipeline versions: semantically pinned', 'Reference packs: 32 scenes', 'Numerical drift threshold: < 0.5%'],
        action: 'View processing specification',
        status: 'Validated'
    },
    {
        id: 'runtime',
        type: 'small',
        category: 'RUNTIME',
        title: 'Rust-first execution runtime',
        description: 'Memory-safe compute path for long-running scene batches with explicit ownership and bounded allocations.',
        bullets: [
            'Predictable memory profile',
            'Zero-cost abstractions in hot path',
            'Error states mapped to operator policies'
        ],
        metrics: ['Peak RSS (median): 7.6 GB', 'Crash-free batch run: 72h'],
        action: 'Read runtime report',
        status: 'Validated'
    },
    {
        id: 'orchestration-stack',
        type: 'small',
        category: 'ORCHESTRATION',
        title: 'Kubernetes + operator control plane',
        description: 'Cloud-native control for queueing, scheduling, and lifecycle management across heterogeneous workload classes.',
        bullets: [
            'SARJob CRD-driven orchestration',
            'Failure-aware retries by stage type',
            'Prometheus-compatible telemetry streams'
        ],
        metrics: ['Scheduler success: 99.2%', 'Median recovery time: 86s'],
        action: 'Inspect deployment topology',
        status: 'In Progress'
    },
    {
        id: 'mission-compatibility',
        type: 'large',
        category: 'MISSION SUPPORT',
        title: 'Unified mission adapters and validation matrix',
        description: 'Ingest adapters normalize mission metadata while preserving instrument-specific parameters needed for science-grade processing.',
        bullets: [
            'Adapter layer for Sentinel-1, NISAR, ICEYE and Capella',
            'Schema normalization with mission-specific extension fields',
            'Cross-mission QA checks before job release',
            'Versioned compatibility table for operations teams'
        ],
        metrics: ['Supported missions: 4', 'Adapter test coverage: 98.9%', 'Schema compatibility checks: automated'],
        action: 'Open compatibility matrix',
        status: 'Planned'
    }
]

function TechnologyPage() {
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
                        <span className="section-label">Technology</span>
                        <h1 style={{ marginTop: 'var(--space-sm)' }}>Implementation profile and platform posture</h1>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', marginTop: 'var(--space-md)' }}>
                            Engineering-focused overview of processing depth, orchestration design, mission interoperability,
                            and benchmark discipline.
                        </p>
                    </div>
                </div>
            </section>

            <section className="section" style={{ paddingTop: 0 }}>
                <div className="container">
                    <div className="enterprise-card-grid">
                        {technologyCards.map((card, index) => (
                            <motion.article
                                key={card.id}
                                className={`enterprise-card ${card.type === 'large' ? 'span-2' : ''}`}
                                initial={{ opacity: 0, y: 12 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.05 + index * 0.05, duration: 0.25 }}
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

export default TechnologyPage
