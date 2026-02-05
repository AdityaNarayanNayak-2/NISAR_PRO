import { useState } from 'react'
import { motion } from 'framer-motion'
import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

const mockResult = {
    id: 'result-001',
    jobName: 'Mumbai Coastal InSAR',
    processType: 'insar',
    stats: {
        coherence: 0.87,
        coverage: 98.5,
        resolution: '10m',
        maxDeformation: '-12.4 mm/yr'
    },
    outputs: [
        { name: 'Deformation Map', format: 'GeoTIFF', size: '245 MB' },
        { name: 'Coherence Map', format: 'GeoTIFF', size: '120 MB' },
        { name: 'Wrapped Phase', format: 'GeoTIFF', size: '180 MB' },
        { name: 'Statistics Report', format: 'JSON', size: '2.4 KB' }
    ]
}

const resultPolygon = {
    type: 'Feature',
    geometry: {
        type: 'Polygon',
        coordinates: [[[72.77, 19.00], [72.97, 19.00], [72.97, 19.15], [72.77, 19.15], [72.77, 19.00]]]
    }
}

function ResultsPage() {
    const [activeTab, setActiveTab] = useState('overview')

    return (
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                style={{ marginBottom: 'var(--space-xl)' }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 'var(--space-xs)' }}>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 600 }}>Analysis Results</h1>
                    <span style={{
                        padding: '4px 10px',
                        background: 'rgba(34, 197, 94, 0.1)',
                        border: '1px solid rgba(34, 197, 94, 0.2)',
                        borderRadius: 'var(--radius-full)',
                        fontSize: '0.75rem',
                        color: '#22c55e'
                    }}>
                        Complete
                    </span>
                </div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                    {mockResult.jobName} • {mockResult.processType.toUpperCase()}
                </p>
            </motion.div>

            {/* Stats */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    gap: 'var(--space-md)',
                    marginBottom: 'var(--space-xl)'
                }}
            >
                {[
                    { label: 'Coherence', value: mockResult.stats.coherence },
                    { label: 'Coverage', value: `${mockResult.stats.coverage}%` },
                    { label: 'Resolution', value: mockResult.stats.resolution },
                    { label: 'Max Deformation', value: mockResult.stats.maxDeformation }
                ].map(stat => (
                    <div
                        key={stat.label}
                        style={{
                            padding: 'var(--space-lg)',
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: 'var(--radius-lg)'
                        }}
                    >
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', marginBottom: '4px', textTransform: 'uppercase', fontWeight: 500 }}>
                            {stat.label}
                        </div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                            {stat.value}
                        </div>
                    </div>
                ))}
            </motion.div>

            {/* Tabs */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                style={{
                    display: 'flex',
                    gap: '0',
                    marginBottom: 'var(--space-lg)',
                    borderBottom: '1px solid var(--border-subtle)'
                }}
            >
                {['overview', 'outputs', 'export'].map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        style={{
                            padding: 'var(--space-sm) var(--space-lg)',
                            background: 'transparent',
                            border: 'none',
                            borderBottom: `2px solid ${activeTab === tab ? 'var(--accent-primary)' : 'transparent'}`,
                            color: activeTab === tab ? 'var(--text-primary)' : 'var(--text-tertiary)',
                            cursor: 'pointer',
                            fontSize: '0.9rem',
                            fontWeight: activeTab === tab ? 600 : 400,
                            textTransform: 'capitalize',
                            marginBottom: '-1px'
                        }}
                    >
                        {tab}
                    </button>
                ))}
            </motion.div>

            {/* Tab Content */}
            <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.15 }}
            >
                {activeTab === 'overview' && (
                    <div style={{
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-lg)',
                        overflow: 'hidden',
                        height: '450px'
                    }}>
                        <MapContainer center={[19.076, 72.877]} zoom={11} style={{ height: '100%', width: '100%' }}>
                            <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
                            <GeoJSON data={resultPolygon} style={{ fillColor: '#6366f1', fillOpacity: 0.3, color: '#6366f1', weight: 2 }} />
                        </MapContainer>
                    </div>
                )}

                {activeTab === 'outputs' && (
                    <div style={{
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-lg)',
                        overflow: 'hidden'
                    }}>
                        {/* Table Header */}
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 100px 100px 100px',
                            gap: 'var(--space-md)',
                            padding: 'var(--space-md) var(--space-lg)',
                            background: 'var(--bg-tertiary)',
                            fontSize: '0.75rem',
                            color: 'var(--text-tertiary)',
                            fontWeight: 500
                        }}>
                            <div>File</div>
                            <div>Format</div>
                            <div>Size</div>
                            <div></div>
                        </div>

                        {/* Table Rows */}
                        {mockResult.outputs.map((output, i) => (
                            <div
                                key={output.name}
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: '1fr 100px 100px 100px',
                                    gap: 'var(--space-md)',
                                    padding: 'var(--space-lg)',
                                    borderTop: '1px solid var(--border-subtle)',
                                    alignItems: 'center'
                                }}
                            >
                                <div style={{ fontWeight: 500 }}>{output.name}</div>
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{output.format}</div>
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>{output.size}</div>
                                <div>
                                    <button style={{
                                        padding: 'var(--space-xs) var(--space-md)',
                                        background: 'var(--bg-tertiary)',
                                        border: '1px solid var(--border-default)',
                                        borderRadius: 'var(--radius-md)',
                                        color: 'var(--text-primary)',
                                        cursor: 'pointer',
                                        fontSize: '0.8rem'
                                    }}>
                                        Download
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {activeTab === 'export' && (
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, 1fr)',
                        gap: 'var(--space-lg)'
                    }}>
                        {[
                            { title: 'Download All', desc: 'Get all outputs as ZIP archive', action: 'Download ZIP' },
                            { title: 'Schedule Recurring', desc: 'Automate this analysis weekly or monthly', action: 'Set Schedule' },
                            { title: 'Share Results', desc: 'Generate a shareable link', action: 'Copy Link' }
                        ].map(option => (
                            <div
                                key={option.title}
                                style={{
                                    padding: 'var(--space-xl)',
                                    background: 'var(--bg-secondary)',
                                    border: '1px solid var(--border-subtle)',
                                    borderRadius: 'var(--radius-lg)',
                                    textAlign: 'center'
                                }}
                            >
                                <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 'var(--space-xs)' }}>{option.title}</h3>
                                <p style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)', marginBottom: 'var(--space-lg)' }}>{option.desc}</p>
                                <button style={{
                                    padding: 'var(--space-sm) var(--space-lg)',
                                    background: 'var(--accent-primary)',
                                    border: 'none',
                                    borderRadius: 'var(--radius-md)',
                                    color: 'white',
                                    cursor: 'pointer',
                                    fontSize: '0.85rem',
                                    fontWeight: 500
                                }}>
                                    {option.action}
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
