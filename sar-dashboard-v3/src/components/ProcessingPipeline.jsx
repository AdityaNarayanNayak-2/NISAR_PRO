import { motion } from 'framer-motion'
import { Database, Filter, Target, Microscope, Image as ImageIcon } from 'lucide-react'

// Sleek modern icons, no emojis
const stages = [
    { id: 1, name: 'Raw Data', icon: <Database size={24} className="text-gray-400" />, description: 'L0 SAR signal', color: '#94a3b8' },
    { id: 2, name: 'Range Compress', icon: <Filter size={24} className="text-blue-400" />, description: 'Matched filter', color: '#60a5fa' },
    { id: 3, name: 'RCMC', icon: <Target size={24} className="text-indigo-400" />, description: 'Migration correct', color: '#818cf8' },
    { id: 4, name: 'Azimuth Compress', icon: <Microscope size={24} className="text-purple-400" />, description: 'Doppler focus', color: '#c084fc' },
    { id: 5, name: 'Focused Image', icon: <ImageIcon size={24} className="text-emerald-400" />, description: 'L1 SLC output', color: '#34d399' },
]

function ProcessingPipeline() {
    return (
        <section style={{
            padding: '120px 0',
            background: 'linear-gradient(to bottom, #040404 0%, #0a0a0f 100%)',
            position: 'relative',
            overflow: 'hidden'
        }}>
            <div className="container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 2rem' }}>
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    style={{ textAlign: 'center', marginBottom: '80px' }}
                >
                    <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        padding: '6px 16px',
                        background: 'rgba(59, 130, 246, 0.1)',
                        border: '1px solid rgba(59, 130, 246, 0.2)',
                        borderRadius: '100px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em',
                        color: '#60a5fa',
                        marginBottom: '24px'
                    }}>
                        Architecture
                    </div>
                    <h2 style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 700, color: '#ffffff', letterSpacing: '-0.02em', marginBottom: '16px' }}>
                        The Range-Doppler Algorithm
                    </h2>
                    <p style={{ color: '#94a3b8', fontSize: '1.1rem', maxWidth: '600px', margin: '0 auto' }}>
                        A visual breakdown of the production SAR processing pipeline with integrated Range Cell Migration Correction.
                    </p>
                </motion.div>

                {/* Pipeline Visualization - Horizontal connecting nodes */}
                <div style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'center',
                    gap: 0,
                    maxWidth: '1000px',
                    margin: '0 auto',
                    position: 'relative'
                }}>
                    {stages.map((stage, index) => (
                        <div key={stage.id} style={{ display: 'flex', alignItems: 'center', flex: index < stages.length - 1 ? 1 : 'none' }}>
                            <motion.div
                                initial={{ opacity: 0, scale: 0.8 }}
                                whileInView={{ opacity: 1, scale: 1 }}
                                viewport={{ once: true }}
                                transition={{ delay: index * 0.15 }}
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    position: 'relative',
                                    zIndex: 10
                                }}
                            >
                                {/* Glowing Icon Node */}
                                <motion.div
                                    whileHover={{ scale: 1.1, boxShadow: `0 0 30px ${stage.color}60` }}
                                    style={{
                                        width: '64px',
                                        height: '64px',
                                        borderRadius: '16px',
                                        background: 'rgba(25, 25, 30, 0.8)',
                                        border: '1px solid rgba(255, 255, 255, 0.1)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        marginBottom: '16px',
                                        boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
                                        backdropFilter: 'blur(10px)',
                                        position: 'relative',
                                        cursor: 'pointer',
                                        transition: 'all 0.3s ease'
                                    }}
                                >
                                    {/* Inner Glow */}
                                    <div style={{
                                        position: 'absolute',
                                        inset: 0,
                                        borderRadius: '16px',
                                        background: `radial-gradient(circle at center, ${stage.color}20 0%, transparent 70%)`,
                                        zIndex: 0
                                    }} />
                                    <div style={{ position: 'relative', zIndex: 1 }}>{stage.icon}</div>
                                </motion.div>

                                {/* Text */}
                                <div style={{ textAlign: 'center', width: '120px' }}>
                                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#f8fafc', marginBottom: '4px' }}>
                                        {stage.name}
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: '#64748b', fontFamily: '"JetBrains Mono", monospace' }}>
                                        {stage.description}
                                    </div>
                                </div>
                            </motion.div>

                            {/* Animated Connecting Line */}
                            {
                                index < stages.length - 1 && (
                                    <div style={{
                                        flex: 1,
                                        height: '64px', // align with the icon box
                                        display: 'flex',
                                        alignItems: 'center',
                                        transform: 'translateY(-30px)', // adjust for text below
                                        padding: '0 8px',
                                        position: 'relative',
                                        zIndex: 1
                                    }}>
                                        {/* Background Track */}
                                        <div style={{ width: '100%', height: '2px', background: 'rgba(255,255,255,0.05)', position: 'absolute', left: 0 }} />

                                        {/* Animated Flow Line */}
                                        <motion.div
                                            initial={{ scaleX: 0, originX: 0 }}
                                            whileInView={{ scaleX: 1 }}
                                            viewport={{ once: true }}
                                            transition={{ duration: 0.8, delay: index * 0.15 + 0.2, ease: 'linear' }}
                                            style={{
                                                width: '100%',
                                                height: '2px',
                                                background: `linear-gradient(90deg, ${stage.color}, ${stages[index + 1].color})`,
                                                position: 'absolute',
                                                left: 0,
                                                boxShadow: `0 0 10px ${stage.color}80`
                                            }}
                                        />

                                        {/* Moving particle */}
                                        <motion.div
                                            animate={{ x: ['0%', '100%'], opacity: [0, 1, 0] }}
                                            transition={{ duration: 2, repeat: Infinity, ease: 'linear', delay: index * 0.5 }}
                                            style={{
                                                width: '8px',
                                                height: '2px',
                                                background: '#ffffff',
                                                boxShadow: '0 0 8px #ffffff',
                                                position: 'absolute',
                                                left: 0
                                            }}
                                        />
                                    </div>
                                )
                            }
                        </div>
                    ))}
                </div>

                {/* Code Snippet Terminal */}
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.5 }}
                    style={{
                        marginTop: '80px',
                        maxWidth: '700px',
                        margin: '80px auto 0',
                        background: '#09090b',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '16px',
                        overflow: 'hidden',
                        boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
                    }}
                >
                    {/* Terminal Header */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: '#18181b',
                        padding: '12px 16px',
                        borderBottom: '1px solid rgba(255,255,255,0.05)'
                    }}>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#ef4444' }} />
                            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#eab308' }} />
                            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#22c55e' }} />
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#71717a', fontFamily: '"JetBrains Mono", monospace' }}>
                            src/processor/rda.rs
                        </div>
                        <div style={{ width: 40 }} /> {/* Spacer for centering */}
                    </div>

                    {/* Terminal Content */}
                    <div style={{ padding: '24px' }}>
                        <pre style={{
                            fontFamily: '"JetBrains Mono", monospace',
                            fontSize: '0.85rem',
                            lineHeight: 1.6,
                            margin: 0,
                            overflow: 'auto'
                        }}>
                            <code style={{ color: '#c4b5fd' }}>// Rust SAR Processing Pipeline</code>
                            <br />
                            <code style={{ color: '#60a5fa' }}>let</code> <code style={{ color: '#e2e8f0' }}>processor = SARProcessor::new(</code>
                            <br />
                            <code style={{ color: '#a78bfa' }}>    5.4e9</code><code style={{ color: '#e2e8f0' }}>,    </code><code style={{ color: '#71717a' }}>// C-band carrier freq</code>
                            <br />
                            <code style={{ color: '#a78bfa' }}>    25.0e6</code><code style={{ color: '#e2e8f0' }}>,   </code><code style={{ color: '#71717a' }}>// Sample rate</code>
                            <br />
                            <code style={{ color: '#a78bfa' }}>    50.0e-6</code><code style={{ color: '#e2e8f0' }}>,  </code><code style={{ color: '#71717a' }}>// Pulse duration</code>
                            <br />
                            <code style={{ color: '#a78bfa' }}>    20.0e6</code><code style={{ color: '#e2e8f0' }}>,   </code><code style={{ color: '#71717a' }}>// Bandwidth</code>
                            <br />
                            <code style={{ color: '#a78bfa' }}>    1600.0</code><code style={{ color: '#e2e8f0' }}>    </code><code style={{ color: '#71717a' }}>// PRF</code>
                            <br />
                            <code style={{ color: '#e2e8f0' }}>);</code>
                            <br /><br />
                            <code style={{ color: '#c4b5fd' }}>// Full RDA with Range Cell Migration Correction</code>
                            <br />
                            <code style={{ color: '#60a5fa' }}>let</code> <code style={{ color: '#e2e8f0' }}>focused = processor.process_rda(&raw_data);</code>
                            <br />
                            <code style={{ color: '#34d399' }}>// → Output: L1 SLC image with PSLR &lt; -13 dB</code>
                        </pre>
                    </div>
                </motion.div>
            </div>
        </section >
    )
}

export default ProcessingPipeline
