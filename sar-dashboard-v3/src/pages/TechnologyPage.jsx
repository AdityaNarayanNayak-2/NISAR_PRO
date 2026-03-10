import { motion } from 'framer-motion'

const technologies = [
    {
        category: 'Core Processing',
        description: 'High-performance SAR signal processing',
        accent: '#6366f1',
        items: [
            { name: 'Rust', description: 'Memory-safe, zero-cost abstractions for real-time processing' },
            { name: 'ISCE3', description: 'NASA JPL InSAR Scientific Computing Environment integration' },
            { name: 'NumPy/SciPy', description: 'Scientific computing for validation and prototyping' }
        ]
    },
    {
        category: 'Infrastructure',
        description: 'Enterprise-grade deployment stack',
        accent: '#06b6d4',
        items: [
            { name: 'Red Hat Enterprise Linux 10', description: 'Production-grade OS with extended lifecycle support' },
            { name: 'Podman', description: 'Rootless container runtime for secure workloads' },
            { name: 'Kubernetes', description: 'Container orchestration for distributed processing' }
        ]
    },
    {
        category: 'Infrastructure as Code',
        description: 'Reproducible, auditable deployments',
        accent: '#22c55e',
        items: [
            { name: 'OpenTofu', description: 'Open-source infrastructure provisioning' },
            { name: 'Helm', description: 'Kubernetes package management' },
            { name: 'FluxCD', description: 'GitOps continuous delivery and reconciliation' }
        ]
    },
    {
        category: 'DevOps & CI/CD',
        description: 'Automated build and deployment pipeline',
        accent: '#f59e0b',
        items: [
            { name: 'GitLab', description: 'Source control, CI/CD pipelines, container registry' },
            { name: 'Renovate', description: 'Automated dependency updates' },
            { name: 'Trivy', description: 'Container and infrastructure security scanning' }
        ]
    },
    {
        category: 'Data Pipeline',
        description: 'Multi-source SAR data ingestion',
        accent: '#ec4899',
        items: [
            { name: 'NISAR', description: 'NASA-ISRO L-band/S-band L1/L2 products' },
            { name: 'Sentinel-1', description: 'ESA SAFE format C-band SAR data' },
            { name: 'S3 Compatible Storage', description: 'Petabyte-scale object storage' }
        ]
    }
]

const metrics = [
    { value: '10x', label: 'Faster', sublabel: 'vs Python implementations' },
    { value: '<13dB', label: 'PSLR', sublabel: 'Production quality focus' },
    { value: '99.9%', label: 'Uptime', sublabel: 'Cloud-native reliability' },
    { value: '0', label: 'Memory Leaks', sublabel: 'Rust ownership model' }
]

function TechnologyPage() {
    return (
        <motion.main initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ paddingTop: '100px', paddingBottom: 'var(--space-3xl)' }}>
            <section style={{ paddingBottom: 'var(--space-3xl)' }}>
                <div className="container">
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ maxWidth: '760px' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 'var(--space-sm)' }}>
                            Technology Stack
                        </div>
                        <h1 style={{ fontSize: '2.5rem', fontWeight: 600, marginBottom: 'var(--space-md)' }}>
                            Enterprise-Grade Infrastructure
                        </h1>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', lineHeight: 1.6 }}>
                            Component cards redesigned with a modern bento + glow treatment inspired by contemporary UI showcases.
                        </p>
                    </motion.div>
                </div>
            </section>

            <section style={{ paddingBottom: 'var(--space-3xl)' }}>
                <div className="container">
                    <div className="tech-metrics-grid">
                        {metrics.map((metric, i) => (
                            <motion.div
                                key={metric.label}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.05 }}
                                className="tech-metric-card"
                            >
                                <div className="tech-metric-value">{metric.value}</div>
                                <div className="tech-metric-label">{metric.label}</div>
                                <div className="tech-metric-sub">{metric.sublabel}</div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            <section>
                <div className="container">
                    <div className="tech-categories">
                        {technologies.map((category, catIndex) => (
                            <motion.div
                                key={category.category}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.1 + catIndex * 0.05 }}
                                className="tech-category-card"
                                style={{ '--tech-accent': category.accent }}
                            >
                                <div className="tech-category-header">
                                    <div>
                                        <h2>{category.category}</h2>
                                        <p>{category.description}</p>
                                    </div>
                                    <span className="tech-pill">Mock data enabled</span>
                                </div>

                                <div className="tech-items-grid">
                                    {category.items.map((tech) => (
                                        <div key={tech.name} className="tech-item-card">
                                            <div className="tech-item-name">{tech.name}</div>
                                            <div className="tech-item-desc">{tech.description}</div>
                                        </div>
                                    ))}
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>
        </motion.main>
    )
}

export default TechnologyPage
