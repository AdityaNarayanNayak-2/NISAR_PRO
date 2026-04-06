import { motion } from 'framer-motion'

const technologies = [
    {
        category: 'SAR Processing Engine',
        description: 'Production-grade signal processing in Rust',
        items: [
            { name: 'Range-Doppler Algorithm', description: 'Zero-padded FFT convolution, corrected azimuth matched filter, optimized memory allocation' },
            { name: 'Range Cell Migration Correction', description: 'Sinc-interpolated RCMC with configurable kernel width for sub-pixel accuracy' },
            { name: 'Lee Sigma Filter', description: 'Adaptive 7×7 statistical speckle filtering with edge-preserving sigma bounds' },
            { name: 'Frost Filter', description: 'Exponentially weighted speckle reduction using local statistics' },
            { name: 'CLAHE', description: 'Contrast Limited Adaptive Histogram Equalization (8×8 grid) for terrain detail recovery' },
            { name: 'Pauli Decomposition', description: 'Polarimetric RGB composites — Double-bounce (red), Volume (green), Surface (blue)' },
        ]
    },
    {
        category: 'InSAR & Infrastructure Health',
        description: 'Interferometric analysis for structural monitoring',
        items: [
            { name: 'Interferogram Formation', description: 'SLC₁ × conj(SLC₂) complex phase differencing between temporal acquisitions' },
            { name: 'Coherence Estimation', description: 'Normalized cross-correlation for persistent scatterer identification' },
            { name: 'Goldstein Phase Filter', description: 'Adaptive spectral filtering for noise reduction while preserving fringe edges' },
            { name: 'Health Classification', description: 'Displacement thresholding: STABLE (<2mm) → CAUTION → ALERT → CRITICAL (>25mm)' },
        ]
    },
    {
        category: 'Data Pipeline',
        description: 'Multi-format SAR data ingestion',
        items: [
            { name: 'NISAR HDF5 Parser', description: 'Reads RSLC, GSLC, GCOV, GUNW products — complex SLC extraction from compound datatypes' },
            { name: 'WGS84 Georeferencing', description: 'Bounding box extraction from coordinate grids and identification metadata' },
            { name: 'NASA ASF Integration', description: 'Direct catalog search via Copernicus/ASF APIs with footprint rendering' },
        ]
    },
    {
        category: 'Infrastructure',
        description: 'Local-first, cloud-ready deployment',
        items: [
            { name: 'Axum Gateway', description: 'Rust HTTP server with SSE log streaming, job management, and static file serving' },
            { name: 'Local Subprocess Mode', description: 'Spawns sar_processor as tokio::process::Command — no K8s required for development' },
            { name: 'kube-rs Operator', description: 'Custom SarJob CRD controller that reconciles processing jobs into Kubernetes batch pods' },
            { name: 'Podman / Kind', description: 'Rootless containers and local Kubernetes clusters for testing and production' },
        ]
    },
    {
        category: 'Frontend',
        description: 'Real-time geospatial intelligence dashboard',
        items: [
            { name: 'React + Leaflet', description: 'Live map with grayscale dark tiles, scene footprints, and processed image overlays' },
            { name: 'SSE Terminal', description: 'Real-time log streaming from the processor — watch radar parameters scroll as data is processed' },
            { name: 'NASA ASF Catalog', description: 'Search panel with date range, spatial target, and NISAR product type filtering' },
        ]
    }
]

const metrics = [
    { value: '6.4 GB', label: 'RSLC Processed', sublabel: '840M complex samples' },
    { value: '~3 min', label: 'Processing Time', sublabel: 'Release binary, local' },
    { value: '6.3 MB', label: 'Binary Size', sublabel: 'Optimized Rust release' },
    { value: '0', label: 'Python Dependencies', sublabel: 'Pure Rust pipeline' },
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
                            What's Actually Running
                        </h1>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', lineHeight: 1.6 }}>
                            Every component listed here is implemented, compiled, and tested — not planned, not aspirational.
                            The SAR processor is a single Rust binary with zero Python dependencies.
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
                                    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
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
                                                marginBottom: 'var(--space-xs)',
                                                fontFamily: 'var(--font-mono)',
                                                fontSize: '0.9rem'
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
                                {`┌──────────────────────────────────────────────────────────────────────────┐
│                      NISAR Pro — System Architecture                      │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────────┐      ┌────────────────┐      ┌─────────────────┐  │
│  │   React + Leaflet │◀────▶│   Axum Gateway  │─────▶│  sar_processor  │  │
│  │   Dashboard       │ SSE  │   (Rust)        │spawn │  (Rust binary)  │  │
│  │   + Live Terminal │      │   Port 3000     │      │  RDA / InSAR    │  │
│  └──────────────────┘      └────────────────┘      └─────────────────┘  │
│           │                        │                        │            │
│           │                        │ (optional)             ▼            │
│           │                 ┌──────┴──────┐      ┌─────────────────┐    │
│           │                 │  kube-rs     │      │  Output:        │    │
│           │                 │  Operator    │      │  • PNG image    │    │
│           │                 │  (SarJob CRD)│      │  • .geo.json    │    │
│           │                 └─────────────┘      │  • health.json  │    │
│           │                                      └─────────────────┘    │
│           ▼                                                              │
│  ┌──────────────────┐      ┌────────────────┐                           │
│  │  NASA ASF Catalog │      │  NISAR HDF5    │                           │
│  │  Search API       │      │  RSLC / GCOV   │                           │
│  └──────────────────┘      └────────────────┘                           │
│                                                                          │
│  ════════════════════════════════════════════════════════════════════    │
│              Podman + Kind (Kubernetes) on Linux                         │
│  ════════════════════════════════════════════════════════════════════    │
└──────────────────────────────────────────────────────────────────────────┘`}
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
