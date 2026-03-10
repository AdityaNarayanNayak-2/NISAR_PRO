import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'

const homeUseCases = [
    {
        key: 'agriculture',
        title: 'Agriculture',
        summary: 'Precision farming with crop health monitoring, soil moisture analysis, and yield prediction using multi-temporal SAR.',
        chips: ['Crop Health', 'Soil Moisture', 'Yield Prediction'],
        link: '/use-cases#agriculture'
    },
    {
        key: 'urban',
        title: 'Urban Planning',
        summary: 'Monitor infrastructure stability, track urban expansion, and detect mm-level ground subsidence with InSAR.',
        chips: ['Subsidence', 'Infrastructure', 'Construction'],
        link: '/use-cases#urban'
    },
    {
        key: 'environment',
        title: 'Environmental',
        summary: 'Track deforestation, monitor glaciers, detect oil spills, and quantify carbon for climate action.',
        chips: ['Deforestation', 'Glaciers', 'Oil Spills'],
        link: '/use-cases#environment'
    },
    {
        key: 'disaster',
        title: 'Disaster Response',
        summary: 'Rapid flood mapping, earthquake damage assessment, and landslide prediction when every minute counts.',
        chips: ['Floods', 'Earthquakes', 'Landslides'],
        link: '/use-cases#disaster'
    },
    {
        key: 'mining',
        title: 'Mining & Resources',
        summary: 'Detect mineral deposits, monitor land stability, track excavation, and ensure environmental compliance.',
        chips: ['Deposits', 'Stability', 'Compliance'],
        link: '/use-cases#mining'
    },
    {
        key: 'defense',
        title: 'Defense & Security',
        summary: 'ISR missions, change detection, maritime surveillance, and border security — all-weather, day-night.',
        chips: ['ISR', 'Surveillance', 'Maritime'],
        link: '/use-cases#defense'
    }
]

function DataVisualization() {
    return (
        <section className="home-usecase-section">
            <div className="container">
                <motion.div
                    initial={{ opacity: 0, y: 18 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="home-usecase-header"
                >
                    <span className="home-usecase-label">Use Cases</span>
                    <h2>SAR application coverage by domain</h2>
                    <p>
                        Industry templates structured for operations teams. Each card highlights where SAR processing
                        contributes measurable value in planning, monitoring, and incident response.
                    </p>
                </motion.div>

                <div className="home-usecase-grid">
                    {homeUseCases.map((item, index) => (
                        <motion.article
                            key={item.key}
                            initial={{ opacity: 0, y: 18 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: index * 0.05 }}
                            className="home-usecase-card"
                        >
                            <div className="home-usecase-card-head">
                                <span>{item.title}</span>
                                <span className="home-usecase-state">Operational</span>
                            </div>
                            <p>{item.summary}</p>
                            <div className="home-usecase-chip-row">
                                {item.chips.map((chip) => (
                                    <span key={chip} className="home-usecase-chip">{chip}</span>
                                ))}
                            </div>
                            <Link to={item.link} className="home-usecase-link">
                                Explore use cases <ChevronRight size={16} />
                            </Link>
                        </motion.article>
                    ))}
                </div>
            </div>
        </section>
    )
}

export default DataVisualization
