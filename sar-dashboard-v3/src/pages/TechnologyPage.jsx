import { motion } from 'framer-motion'

const pageVariants = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 }
}

const technologies = [
    {
        category: 'Core Processing',
        items: [
            { name: 'Rust', logo: '🦀', description: 'Memory-safe, blazingly fast SAR processing engine' },
            { name: 'ISCE3', logo: '🛰️', description: 'NASA JPL\'s InSAR Scientific Computing Environment' },
            { name: 'RCMC', logo: '📡', description: 'Range Cell Migration Correction for sharp imagery' },
        ]
    },
    {
        category: 'Cloud Infrastructure',
        items: [
            { name: 'Kubernetes', logo: '☸️', description: 'Container orchestration for scalable processing' },
            { name: 'AWS/GCP', logo: '☁️', description: 'Multi-cloud deployment with Terraform' },
            { name: 'FluxCD', logo: '🔄', description: 'GitOps continuous delivery' },
        ]
    },
    {
        category: 'Data Pipeline',
        items: [
            { name: 'Sentinel-1', logo: '🌍', description: 'ESA SAFE format parsing & processing' },
            { name: 'NISAR', logo: '🚀', description: 'Ready for NASA-ISRO L1/L2 products' },
            { name: 'S3/GCS', logo: '💾', description: 'Petabyte-scale data lake architecture' },
        ]
    }
]

const metrics = [
    { value: '10x', label: 'Faster Processing', description: 'vs Python implementations' },
    { value: '< 13dB', label: 'PSLR Target', description: 'Production-quality focus' },
    { value: '99.9%', label: 'Uptime', description: 'Cloud-native reliability' },
    { value: '0', label: 'Memory Leaks', description: 'Rust\'s ownership model' },
]

function TechnologyPage() {
    return (
        <motion.main
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.5 }}
            style={{ paddingTop: '120px' }}
        >
            {/* Hero Section */}
            <section className="section">
                <div className="container">
                    <motion.div
                        className="section-header"
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                    >
                        <span className="section-label">Technology Stack</span>
                        <h1>Built for <span className="text-gradient">Performance</span></h1>
                        <p style={{
                            color: 'var(--text-secondary)',
                            maxWidth: '600px',
                            margin: '0 auto',
                            marginTop: 'var(--space-lg)'
                        }}>
                            Enterprise-grade SAR processing powered by cutting-edge technologies
                        </p>
                    </motion.div>
                </div>
            </section>

            {/* Metrics */}
            <section className="section" style={{ paddingTop: 0 }}>
                <div className="container">
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                        gap: 'var(--space-xl)'
                    }}>
                        {metrics.map((metric, i) => (
                            <motion.div
                                key={metric.label}
                                className="card"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.3 + i * 0.1 }}
                                style={{ textAlign: 'center' }}
                            >
                                <div style={{
                                    fontSize: '3rem',
                                    fontWeight: 700,
                                    background: 'var(--accent-gradient)',
                                    WebkitBackgroundClip: 'text',
                                    WebkitTextFillColor: 'transparent'
                                }}>
                                    {metric.value}
                                </div>
                                <div style={{
                                    fontSize: '1rem',
                                    fontWeight: 600,
                                    marginTop: 'var(--space-sm)'
                                }}>
                                    {metric.label}
                                </div>
                                <div style={{
                                    fontSize: '0.85rem',
                                    color: 'var(--text-tertiary)',
                                    marginTop: 'var(--space-xs)'
                                }}>
                                    {metric.description}
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Technology Grid */}
            {technologies.map((category, catIndex) => (
                <section key={category.category} className="section" style={{ paddingTop: 0 }}>
                    <div className="container">
                        <motion.h2
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.4 + catIndex * 0.2 }}
                            style={{
                                marginBottom: 'var(--space-xl)',
                                fontSize: '1.5rem',
                                borderLeft: '3px solid var(--accent-primary)',
                                paddingLeft: 'var(--space-md)'
                            }}
                        >
                            {category.category}
                        </motion.h2>

                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                            gap: 'var(--space-lg)'
                        }}>
                            {category.items.map((tech, i) => (
                                <motion.div
                                    key={tech.name}
                                    className="card"
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.5 + catIndex * 0.2 + i * 0.1 }}
                                    whileHover={{ scale: 1.02 }}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'flex-start',
                                        gap: 'var(--space-lg)'
                                    }}
                                >
                                    <div style={{
                                        fontSize: '2.5rem',
                                        lineHeight: 1
                                    }}>
                                        {tech.logo}
                                    </div>
                                    <div>
                                        <h4 style={{ marginBottom: 'var(--space-xs)' }}>{tech.name}</h4>
                                        <p style={{
                                            color: 'var(--text-secondary)',
                                            fontSize: '0.9rem'
                                        }}>
                                            {tech.description}
                                        </p>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </section>
            ))}

            {/* Architecture Preview */}
            <section className="section">
                <div className="container">
                    <div className="section-header">
                        <span className="section-label">Architecture</span>
                        <h2>Cloud-Native Design</h2>
                    </div>

                    <motion.div
                        className="card card-glass"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.6 }}
                        style={{
                            padding: 'var(--space-3xl)',
                            textAlign: 'center'
                        }}
                    >
                        <pre style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: '0.85rem',
                            color: 'var(--text-secondary)',
                            textAlign: 'left',
                            overflow: 'auto'
                        }}>
                            {`┌─────────────────────────────────────────────────────────────┐
│                     SAR PROCESSOR ARCHITECTURE              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ┌─────────┐     ┌──────────┐     ┌─────────────┐         │
│   │ Gateway │────▶│ Operator │────▶│  Processor  │         │
│   │  (Go)   │     │  (Rust)  │     │   (Rust)    │         │
│   └─────────┘     └──────────┘     └─────────────┘         │
│        │                                   │                │
│        ▼                                   ▼                │
│   ┌─────────┐                       ┌─────────────┐         │
│   │Dashboard│                       │ ISCE3 (C++) │         │
│   │ (React) │                       │  Optional   │         │
│   └─────────┘                       └─────────────┘         │
│                                                             │
│   ════════════════════════════════════════════════          │
│                    Kubernetes / EKS                          │
│   ════════════════════════════════════════════════          │
│                                                             │
│   [ S3 Raw Data ]  [ S3 Processed ]  [ ECR Images ]         │
│                                                             │
└─────────────────────────────────────────────────────────────┘`}
                        </pre>
                    </motion.div>
                </div>
            </section>
        </motion.main>
    )
}

export default TechnologyPage
