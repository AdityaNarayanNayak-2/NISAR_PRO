import { motion } from 'framer-motion'

const technologies = [
    {
        category: 'Core Processing',
        description: 'High-performance SAR signal processing',
        items: [
            { name: 'Rust', description: 'Memory-safe, zero-cost abstractions for real-time processing' },
            { name: 'ISCE3', description: 'NASA JPL InSAR Scientific Computing Environment integration' },
            { name: 'NumPy/SciPy', description: 'Scientific computing for validation and prototyping' }
        ]
    },
    {
        category: 'Infrastructure',
        description: 'Enterprise-grade deployment stack',
        items: [
            { name: 'Red Hat Enterprise Linux 10', description: 'Production-grade OS with extended lifecycle support' },
            { name: 'Podman', description: 'Rootless container runtime for secure workloads' },
            { name: 'Kubernetes', description: 'Container orchestration for distributed processing' }
        ]
    },
    {
        category: 'Infrastructure as Code',
        description: 'Reproducible, auditable deployments',
        items: [
            { name: 'OpenTofu', description: 'Open-source infrastructure provisioning' },
            { name: 'Helm', description: 'Kubernetes package management' },
            { name: 'FluxCD', description: 'GitOps continuous delivery and reconciliation' }
        ]
    },
    {
        category: 'DevOps & CI/CD',
        description: 'Automated build and deployment pipeline',
        items: [
            { name: 'GitLab', description: 'Source control, CI/CD pipelines, container registry' },
            { name: 'Renovate', description: 'Automated dependency updates' },
            { name: 'Trivy', description: 'Container and infrastructure security scanning' }
        ]
    },
    {
        category: 'Data Pipeline',
        description: 'Multi-source SAR data ingestion',
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
        <motion.main
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ paddingTop: '100px', paddingBottom: 'var(--space-3xl)' }}
        >
            {/* Header */}
            <section style={{ paddingBottom: 'var(--space-3xl)' }}>
                <div className="container">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        style={{ maxWidth: '700px' }}
                    >
                        <div style={{
                            fontSize: '0.75rem',
                            fontWeight: 500,
                            color: 'var(--accent-primary)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.1em',
                            marginBottom: 'var(--space-sm)'
                        }}>
                            Technology Stack
                        </div>
                        <h1 style={{ fontSize: '2.5rem', fontWeight: 600, marginBottom: 'var(--space-md)' }}>
                            Enterprise-Grade Infrastructure
                        </h1>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', lineHeight: 1.6 }}>
                            Built on proven open-source technologies for reliability, security, and performance at scale.
                        </p>
                    </motion.div>
                </div>
            </section>

            {/* Metrics */}
            <section style={{ paddingBottom: 'var(--space-3xl)' }}>
                <div className="container">
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(4, 1fr)',
                        gap: 'var(--space-md)'
                    }}>
                        {metrics.map((metric, i) => (
                            <motion.div
                                key={metric.label}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.05 }}
                                style={{
                                    padding: 'var(--space-xl)',
                                    background: 'var(--bg-secondary)',
                                    border: '1px solid var(--border-subtle)',
                                    borderRadius: 'var(--radius-lg)'
                                }}
                            >
                                <div style={{
                                    fontSize: '2rem',
                                    fontWeight: 700,
                                    color: 'var(--accent-primary)',
                                    fontFamily: 'var(--font-mono)',
                                    marginBottom: 'var(--space-xs)'
                                }}>
                                    {metric.value}
                                </div>
                                <div style={{ fontWeight: 600, marginBottom: '2px' }}>
                                    {metric.label}
                                </div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
                                    {metric.sublabel}
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Technology Stack */}
            <section>
                <div className="container">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2xl)' }}>
                        {technologies.map((category, catIndex) => (
                            <motion.div
                                key={category.category}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.1 + catIndex * 0.05 }}
                            >
                                {/* Category Header */}
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'baseline',
                                    gap: 'var(--space-md)',
                                    marginBottom: 'var(--space-lg)',
                                    paddingBottom: 'var(--space-sm)',
                                    borderBottom: '1px solid var(--border-subtle)'
                                }}>
                                    <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>
                                        {category.category}
                                    </h2>
                                    <span style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>
                                        {category.description}
                                    </span>
                                </div>

                                {/* Items */}
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(3, 1fr)',
                                    gap: 'var(--space-md)'
                                }}>
                                    {category.items.map((tech) => (
                                        <div
                                            key={tech.name}
                                            style={{
                                                padding: 'var(--space-lg)',
                                                background: 'var(--bg-secondary)',
                                                border: '1px solid var(--border-subtle)',
                                                borderRadius: 'var(--radius-md)'
                                            }}
                                        >
                                            <div style={{
                                                fontWeight: 600,
                                                marginBottom: 'var(--space-xs)'
                                            }}>
                                                {tech.name}
                                            </div>
                                            <div style={{
                                                fontSize: '0.85rem',
                                                color: 'var(--text-tertiary)',
                                                lineHeight: 1.5
                                            }}>
                                                {tech.description}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Architecture Diagram */}
            <section style={{ marginTop: 'var(--space-3xl)' }}>
                <div className="container">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                    >
                        <div style={{
                            fontSize: '0.75rem',
                            fontWeight: 500,
                            color: 'var(--accent-primary)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.1em',
                            marginBottom: 'var(--space-sm)'
                        }}>
                            Architecture
                        </div>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: 'var(--space-xl)' }}>
                            System Overview
                        </h2>

                        <div style={{
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: 'var(--radius-lg)',
                            padding: 'var(--space-2xl)',
                            overflow: 'auto'
                        }}>
                            <pre style={{
                                fontFamily: 'var(--font-mono)',
                                fontSize: '0.8rem',
                                color: 'var(--text-secondary)',
                                lineHeight: 1.6,
                                margin: 0
                            }}>
                                {`┌────────────────────────────────────────────────────────────────────────┐
│                        SAR PROCESSING PLATFORM                         │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  ┌──────────────┐      ┌───────────────┐      ┌──────────────────┐    │
│  │   GitLab     │─────▶│   Dashboard   │◀────▶│    Gateway       │    │
│  │  CI/CD       │      │   (React)     │      │    (Go/Rust)     │    │
│  └──────────────┘      └───────────────┘      └────────┬─────────┘    │
│         │                                              │              │
│         ▼                                              ▼              │
│  ┌──────────────┐      ┌───────────────┐      ┌──────────────────┐    │
│  │   Podman     │      │   Operator    │─────▶│   Processor      │    │
│  │   Registry   │      │   (Rust)      │      │   (Rust/ISCE3)   │    │
│  └──────────────┘      └───────────────┘      └──────────────────┘    │
│                                                                        │
│  ══════════════════════════════════════════════════════════════════   │
│                    Kubernetes on Red Hat Enterprise Linux 10           │
│  ══════════════════════════════════════════════════════════════════   │
│                                                                        │
│  ┌──────────────┐      ┌───────────────┐      ┌──────────────────┐    │
│  │  Raw Data    │      │   Processed   │      │    OpenTofu      │    │
│  │  (S3)        │      │   (S3)        │      │    State         │    │
│  └──────────────┘      └───────────────┘      └──────────────────┘    │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘`}
                            </pre>
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* Footer CTA */}
            <section style={{ marginTop: 'var(--space-3xl)', textAlign: 'center' }}>
                <div className="container">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                        style={{
                            padding: 'var(--space-2xl)',
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: 'var(--radius-lg)'
                        }}
                    >
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: 'var(--space-sm)' }}>
                            Open Source & Vendor Neutral
                        </h3>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-lg)', maxWidth: '500px', margin: '0 auto var(--space-lg)' }}>
                            Built entirely on open-source technologies. No vendor lock-in, full auditability.
                        </p>
                        <a
                            href="https://gitlab.com/Aditya-Narayan-Nayak/nisar_pro"
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                                display: 'inline-block',
                                padding: 'var(--space-md) var(--space-xl)',
                                background: 'var(--accent-primary)',
                                color: 'white',
                                textDecoration: 'none',
                                borderRadius: 'var(--radius-md)',
                                fontWeight: 500,
                                fontSize: '0.9rem'
                            }}
                        >
                            View on GitLab →
                        </a>
                    </motion.div>
                </div>
            </section>
        </motion.main>
    )
}

export default TechnologyPage
