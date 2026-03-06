import { motion } from 'framer-motion'
import { useState } from 'react'
import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

const mockResult = {
    jobName: 'Mumbai Coastal InSAR',
    processType: 'InSAR',
    stats: [
        { label: 'Coherence', value: '0.87' },
        { label: 'Coverage', value: '98.5%' },
        { label: 'Resolution', value: '10 m' },
        { label: 'Max Deformation', value: '−12.4 mm/yr' }
    ],
    outputs: [
        { name: 'Deformation Map', format: 'GeoTIFF', size: '245 MB' },
        { name: 'Coherence Map', format: 'GeoTIFF', size: '120 MB' },
        { name: 'Wrapped Phase', format: 'GeoTIFF', size: '180 MB' },
        { name: 'Statistics Report', format: 'JSON', size: '2.4 KB' }
    ]
}

const resultPolygon = {
    type: 'Feature',
    geometry: { type: 'Polygon', coordinates: [[[72.77, 19.00], [72.97, 19.00], [72.97, 19.15], [72.77, 19.15], [72.77, 19.00]]] }
}

function ResultsPage() {
    const [tab, setTab] = useState('overview')

    return (
        <div style={{ maxWidth: '1060px' }}>
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: '28px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                    <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#000', letterSpacing: '-0.02em' }}>Analysis Results</h1>
                    <span style={{ padding: '3px 10px', background: 'rgba(26,127,60,0.08)', border: '1px solid rgba(26,127,60,0.2)', borderRadius: '99px', fontSize: '0.75rem', fontWeight: 500, color: '#1a7f3c' }}>
                        Complete
                    </span>
                </div>
                <p style={{ color: '#666', fontSize: '0.9rem' }}>
                    {mockResult.jobName} · {mockResult.processType}
                </p>
            </motion.div>

            {/* Stats */}
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
                style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '24px' }}
            >
                {mockResult.stats.map(s => (
                    <div key={s.label} style={{ background: '#fff', borderRadius: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.07)', padding: '22px 20px' }}>
                        <div style={{ fontSize: '0.7rem', color: '#bbb', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px', fontWeight: 600 }}>{s.label}</div>
                        <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#1a1a1a', fontFamily: 'JetBrains Mono, monospace' }}>{s.value}</div>
                    </div>
                ))}
            </motion.div>

            {/* Tab Bar */}
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}
                style={{ display: 'flex', gap: '0', borderBottom: '1px solid #e8e8e8', marginBottom: '20px' }}
            >
                {['overview', 'outputs', 'export'].map(t => (
                    <button key={t} onClick={() => setTab(t)}
                        style={{
                            padding: '10px 22px', background: 'transparent', border: 'none',
                            borderBottom: `2px solid ${tab === t ? '#0078d4' : 'transparent'}`,
                            color: tab === t ? '#0078d4' : '#888', cursor: 'pointer',
                            fontSize: '0.9rem', fontWeight: tab === t ? 600 : 400,
                            textTransform: 'capitalize', marginBottom: '-1px',
                            transition: 'all 0.2s ease'
                        }}
                    >
                        {t}
                    </button>
                ))}
            </motion.div>

            {/* Tab Content */}
            <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}>
                {tab === 'overview' && (
                    <div style={{ background: '#fff', borderRadius: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.07)', overflow: 'hidden', height: '440px' }}>
                        <MapContainer center={[19.076, 72.877]} zoom={11} style={{ height: '100%', width: '100%' }}>
                            <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
                            <GeoJSON data={resultPolygon} style={{ fillColor: '#0078d4', fillOpacity: 0.25, color: '#0078d4', weight: 2 }} />
                        </MapContainer>
                    </div>
                )}

                {tab === 'outputs' && (
                    <div style={{ background: '#fff', borderRadius: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.07)', overflow: 'hidden' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 90px 110px', gap: '12px', padding: '12px 24px', background: '#f7f9fb', fontSize: '0.7rem', fontWeight: 600, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #f0f0f0' }}>
                            <div>File</div><div>Format</div><div>Size</div><div></div>
                        </div>
                        {mockResult.outputs.map((o, i) => (
                            <div key={o.name} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 90px 110px', gap: '12px', padding: '16px 24px', borderBottom: i < mockResult.outputs.length - 1 ? '1px solid #f5f5f5' : 'none', alignItems: 'center' }}>
                                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{o.name}</div>
                                <div style={{ fontSize: '0.82rem', color: '#aaa', fontFamily: 'JetBrains Mono, monospace' }}>{o.format}</div>
                                <div style={{ fontSize: '0.82rem', color: '#bbb' }}>{o.size}</div>
                                <button style={{ padding: '7px 14px', background: 'transparent', border: '1px solid #d0d0d0', borderRadius: '8px', color: '#444', cursor: 'pointer', fontSize: '0.8rem', transition: 'background 0.15s ease' }}
                                    onMouseEnter={e => e.target.style.background = '#f5f5f5'}
                                    onMouseLeave={e => e.target.style.background = 'transparent'}
                                >
                                    Download
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {tab === 'export' && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                        {[
                            { title: 'Download All', desc: 'All outputs as a ZIP archive', action: 'Download ZIP' },
                            { title: 'Schedule Recurring', desc: 'Automate this analysis weekly or monthly', action: 'Set Schedule' },
                            { title: 'Share Results', desc: 'Generate a read-only shareable link', action: 'Copy Link' }
                        ].map(o => (
                            <div key={o.title} style={{ background: '#fff', borderRadius: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.07)', padding: '28px 24px', textAlign: 'center' }}>
                                <h3 style={{ fontWeight: 700, color: '#1a1a1a', fontSize: '1rem', marginBottom: '6px' }}>{o.title}</h3>
                                <p style={{ fontSize: '0.85rem', color: '#888', marginBottom: '20px' }}>{o.desc}</p>
                                <button style={{
                                    padding: '9px 22px', background: '#0078d4', border: 'none', borderRadius: '10px',
                                    color: '#fff', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 500,
                                    transition: 'background 0.2s ease'
                                }}
                                    onMouseEnter={e => e.target.style.background = '#0067b8'}
                                    onMouseLeave={e => e.target.style.background = '#0078d4'}
                                >
                                    {o.action}
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </motion.div>
        </div>
    )
}

export default ResultsPage
