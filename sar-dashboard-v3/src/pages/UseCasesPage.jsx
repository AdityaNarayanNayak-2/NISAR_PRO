import { motion } from 'framer-motion'

const domainCards = [
    {
        id: 'agriculture',
        title: 'Agriculture',
        summary: 'Precision farming with crop health monitoring, soil moisture analysis, and yield prediction using multi-temporal SAR.',
        chips: ['Crop Health', 'Soil Moisture', 'Yield Prediction'],
        status: 'Validated',
        insar: [
            'Temporal coherence mapping for irrigation and field movement patterns',
            'Ground motion screening to detect subsidence in intensive farming zones'
        ],
        polsar: [
            'Crop-type separation from polarization signatures',
            'Soil moisture and canopy structure discrimination'
        ]
    },
    {
        id: 'urban',
        title: 'Urban Planning',
        summary: 'Monitor infrastructure stability, track urban expansion, and detect mm-level ground subsidence with InSAR.',
        chips: ['Subsidence', 'Infrastructure', 'Construction'],
        status: 'Validated',
        insar: [
            'Millimeter-scale deformation timelines for roads, bridges, and built-up zones',
            'Construction corridor movement baselines for permitting reviews'
        ],
        polsar: [
            'Built-surface classification for expansion monitoring',
            'Urban feature separation for planning and risk zoning'
        ]
    },
    {
        id: 'environment',
        title: 'Environmental',
        summary: 'Track deforestation, monitor glaciers, detect oil spills, and quantify carbon for climate action.',
        chips: ['Deforestation', 'Glaciers', 'Oil Spills'],
        status: 'In Progress',
        insar: [
            'Glacier velocity and deformation time series for climate baselining',
            'Slope instability indicators for watershed monitoring'
        ],
        polsar: [
            'Biomass and vegetation structure characterization',
            'Surface scattering signatures for spill and wetland delineation'
        ]
    },
    {
        id: 'disaster',
        title: 'Disaster Response',
        summary: 'Rapid flood mapping, earthquake damage assessment, and landslide prediction when every minute counts.',
        chips: ['Floods', 'Earthquakes', 'Landslides'],
        status: 'Validated',
        insar: [
            'Pre/post event deformation differencing for damage triage',
            'Landslide susceptibility updates using displacement history'
        ],
        polsar: [
            'Flood-water extent mapping under cloud cover',
            'Surface condition classification for response routing'
        ]
    },
    {
        id: 'mining',
        title: 'Mining & Resources',
        summary: 'Detect mineral deposits, monitor land stability, track excavation, and ensure environmental compliance.',
        chips: ['Deposits', 'Stability', 'Compliance'],
        status: 'Planned',
        insar: [
            'Pit wall and tailings deformation surveillance',
            'Long-term subsidence monitoring around extraction zones'
        ],
        polsar: [
            'Surface material discrimination for exploration support',
            'Reclamation and disturbance classification for compliance review'
        ]
    },
    {
        id: 'defense',
        title: 'Defense & Security',
        summary: 'ISR missions, change detection, maritime surveillance, and border security — all-weather, day-night.',
        chips: ['ISR', 'Surveillance', 'Maritime'],
        status: 'In Progress',
        insar: [
            'Persistent change timelines for infrastructure and terrain shifts',
            'Movement cueing from repeat-pass deformation anomalies'
        ],
        polsar: [
            'Target and surface-type discrimination in mixed terrain',
            'Maritime object/background separation for broad-area screening'
        ]
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
                        <h1 style={{ marginTop: 'var(--space-sm)' }}>How this platform helps with InSAR and PolSAR</h1>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', marginTop: 'var(--space-md)' }}>
                            Domain cards below map operational outcomes to InSAR displacement analysis and PolSAR
                            scattering intelligence. Each card reflects deployable processing intent.
                        </p>
                    </div>
                </div>
            </section>

            <section className="section" style={{ paddingTop: 0 }}>
                <div className="container">
                    <div className="usecase-domain-grid">
                        {domainCards.map((domain, index) => (
                            <motion.article
                                key={domain.id}
                                id={domain.id}
                                className={`usecase-domain-card ${index % 3 === 0 ? 'domain-card-wide' : ''}`}
                                initial={{ opacity: 0, y: 16 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.05 }}
                            >
                                <div className="usecase-domain-top">
                                    <span className="usecase-domain-title">{domain.title}</span>
                                    <span className={`enterprise-status ${domain.status.toLowerCase().replace(' ', '-')}`}>{domain.status}</span>
                                </div>
                                <p className="usecase-domain-summary">{domain.summary}</p>
                                <div className="usecase-domain-chip-row">
                                    {domain.chips.map((chip) => (
                                        <span key={chip} className="usecase-domain-chip">{chip}</span>
                                    ))}
                                </div>

                                <div className="usecase-domain-tech-grid">
                                    <div className="usecase-tech-block">
                                        <div className="usecase-tech-label">InSAR Contribution</div>
                                        <ul>
                                            {domain.insar.map((line) => (
                                                <li key={line}>{line}</li>
                                            ))}
                                        </ul>
                                    </div>
                                    <div className="usecase-tech-block">
                                        <div className="usecase-tech-label">PolSAR Contribution</div>
                                        <ul>
                                            {domain.polsar.map((line) => (
                                                <li key={line}>{line}</li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            </motion.article>
                        ))}
                    </div>
                </div>
            </section>
        </motion.main>
    )
}

export default UseCasesPage
