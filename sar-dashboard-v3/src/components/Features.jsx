import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Activity, Zap, Cloud, Globe, Cpu, ChevronRight } from 'lucide-react'

// Bento Grid Layout using CSS Grid
// We have varying sizes for the bento boxes
const features = [
  {
    icon: <Cpu size={28} className="text-blue-400" />,
    title: 'Range-Doppler Engine',
    description: 'High-performance RDA with sinc interpolation for precise, artifact-free image focusing at scale.',
    gradient: 'radial-gradient(ellipse at top left, rgba(59, 130, 246, 0.15), transparent 70%)',
    colSpan: 2, // spans 2 columns
    rowSpan: 1
  },
  {
    icon: <Activity size={28} className="text-purple-400" />,
    title: 'RCMC Integrated',
    description: 'Range Cell Migration Correction ensures production-quality PSLR < -13dB.',
    gradient: 'radial-gradient(ellipse at top right, rgba(168, 85, 247, 0.15), transparent 70%)',
    colSpan: 1,
    rowSpan: 1
  },
  {
    icon: <Globe size={28} className="text-emerald-400" />,
    title: 'Multi-Mission Ready',
    description: 'Native parsing and decoding for NISAR L1/L2 and Sentinel-1 SAFE formats.',
    gradient: 'radial-gradient(ellipse at bottom left, rgba(52, 211, 153, 0.15), transparent 70%)',
    colSpan: 1,
    rowSpan: 1 // Standard height
  },
  {
    icon: <Zap size={28} className="text-yellow-400" />,
    title: '10x Faster Processing',
    description: 'Rewritten from the ground up in memory-safe Rust, drastically outperforming legacy Python tools.',
    gradient: 'radial-gradient(ellipse at bottom, rgba(250, 204, 21, 0.15), transparent 70%)',
    colSpan: 1,
    rowSpan: 1
  },
  {
    icon: <Cloud size={28} className="text-cyan-400" />,
    title: 'Cloud Native',
    description: 'Kubernetes Operator included. Deploy instantly via FluxCD and Helm.',
    gradient: 'radial-gradient(ellipse at bottom right, rgba(34, 211, 238, 0.15), transparent 70%)',
    colSpan: 1,
    rowSpan: 1
  }
]

function Features() {
  return (
    <section style={{
      padding: '120px 0',
      background: '#040404',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Background Glow */}
      <div style={{
        position: 'absolute',
        top: '40%', left: '50%', transform: 'translate(-50%, -50%)',
        width: '600px', height: '600px',
        background: 'radial-gradient(circle, rgba(255,255,255,0.02) 0%, transparent 60%)',
        pointerEvents: 'none'
      }} />

      <div className="container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 2rem', position: 'relative', zIndex: 10 }}>

        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          style={{ marginBottom: '64px' }}
        >
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '6px 16px',
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '100px',
            fontSize: '0.75rem',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: '#94a3b8',
            marginBottom: '24px'
          }}>
            Capabilities
          </div>
          <h2 style={{ fontSize: 'clamp(2.5rem, 4vw, 3.5rem)', fontWeight: 700, color: '#ffffff', letterSpacing: '-0.03em', lineHeight: 1.1, marginBottom: '24px' }}>
            Built for scale, <span style={{ color: '#94a3b8' }}>engineered for precision.</span>
          </h2>
          <p style={{ color: '#94a3b8', fontSize: '1.15rem', maxWidth: '600px', lineHeight: 1.6 }}>
            Every feature is designed from the ground up to integrate seamlessly into your hyperscale infrastructure.
          </p>
        </motion.div>

        {/* Bento Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gridAutoRows: '280px',
          gap: '24px',
          listStyle: 'none',
          padding: 0, margin: 0
        }}>
          {features.map((feature, idx) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1 }}
              style={{
                gridColumn: `span ${feature.colSpan}`,
                gridRow: `span ${feature.rowSpan}`,
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                borderRadius: '24px',
                padding: '40px',
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
                overflow: 'hidden',
                transition: 'all 0.3s ease',
                cursor: 'pointer'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.05)';
              }}
            >
              {/* Internal Gradient Glow */}
              <div style={{
                position: 'absolute',
                inset: 0,
                background: feature.gradient,
                opacity: 0.8,
                zIndex: 0,
                pointerEvents: 'none'
              }} />

              {/* Content */}
              <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
                <div style={{ marginBottom: 'auto' }}>
                  {feature.icon}
                </div>

                <div style={{ marginTop: '32px' }}>
                  <h3 style={{ fontSize: '1.5rem', fontWeight: 600, color: '#ffffff', marginBottom: '12px', letterSpacing: '-0.02em' }}>
                    {feature.title}
                  </h3>
                  <p style={{ color: '#94a3b8', fontSize: '1rem', lineHeight: 1.6, margin: 0 }}>
                    {feature.description}
                  </p>
                </div>

                {/* Arrow on hover (simulated via CSS classes normally, doing inline here) */}
                <div style={{ position: 'absolute', top: 0, right: 0, color: '#475569', transition: 'color 0.2s', padding: '4px' }}>
                  <ChevronRight size={20} />
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Link Output */}
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '48px' }}>
          <Link to="/technology" style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            color: '#ffffff', textDecoration: 'none', fontSize: '1rem', fontWeight: 500,
            borderBottom: '1px solid rgba(255,255,255,0.2)', paddingBottom: '4px',
            transition: 'all 0.2s ease'
          }}
            onMouseEnter={e => e.currentTarget.style.borderColor = '#ffffff'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'}
          >
            Explore full technical documentation <ChevronRight size={16} />
          </Link>
        </div>

      </div>
    </section>
  )
}

export default Features
