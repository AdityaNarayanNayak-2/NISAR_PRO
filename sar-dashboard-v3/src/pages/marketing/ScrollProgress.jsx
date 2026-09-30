import { useScroll, useSpring, motion } from 'framer-motion'

export default function ScrollProgress() {
    const { scrollYProgress } = useScroll()
    const scaleX = useSpring(scrollYProgress, { stiffness: 140, damping: 30, mass: .4 })
    return <motion.div className="landing-progress" style={{ scaleX }} aria-hidden="true" />
}