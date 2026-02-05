import { motion } from 'framer-motion'
import Hero from '../components/Hero'
import Features from '../components/Features'
import DataVisualization from '../components/DataVisualization'
import ProcessingPipeline from '../components/ProcessingPipeline'

const pageVariants = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 }
}

function HomePage() {
    return (
        <motion.main
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.5 }}
        >
            <Hero />
            <Features />
            <ProcessingPipeline />
            <DataVisualization />
        </motion.main>
    )
}

export default HomePage
