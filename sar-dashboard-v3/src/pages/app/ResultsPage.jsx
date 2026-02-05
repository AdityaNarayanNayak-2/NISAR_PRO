import { useState } from 'react'
import { motion } from 'framer-motion'
import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

// Mock result data
const mockResult = {
    id: 'result-001',
    jobId: 'job-001',
    jobName: 'Mumbai Coastal InSAR',
    processType: 'insar',
    completedAt: new Date().toISOString(),
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
        { name: 'Statistics', format: 'JSON', size: '2.4 KB' },
    ]
}

// Mock GeoJSON polygon for result overlay
const resultPolygon = {
    type: 'Feature',
    properties: {},
    geometry: {
        type: 'Polygon',
        coordinates: [[
            [72.77, 19.00],
            [72.97, 19.00],
            [72.97, 19.15],
            [72.77, 19.15],
            [72.77, 19.00]
        ]]
    }
}

function ResultsPage() {
    const [activeTab, setActiveTab] = useState('map')

    return (
        <div>
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                style={{ marginBottom: 'var(--space-xl)' }}
            >
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-sm)',
                    marginBottom: 'var(--space-sm)'
                }}>
                    <span style={{
                        padding: 'var(--space-xs) var(--space-sm)',
                        background: 'var(--accent-gradient)',
                        borderRadius: 'var(--radius-full)',
                        fontSize: '0.7rem',
                        fontFamily: 'var(--font-mono)'
                    }}>
                        STEP 5-6
                    </span>
                    <span style={{
                        padding: 'var(--space-xs) var(--space-sm)',
                        background: 'rgba(34, 197, 94, 0.1)',
                        border: '1px solid rgba(34, 197, 94, 0.3)',
                        borderRadius: 'var(--radius-full)',
                        fontSize: '0.7rem',
                        fontFamily: 'var(--font-mono)',
                        color: '#22c55e'
                    }}>
                        ✅ Complete
                    </span>
                </div>
                <h1 style={{ marginBottom: 'var(--space-sm)' }}>
                    Analysis <span className="text-gradient">Results</span>
                </h1>
                <p style={{ color: 'var(--text-secondary)' }}>
                    {mockResult.jobName} — {mockResult.processType.toUpperCase()}
                </p>
            </motion.div>

            {/* Stats Cards */}
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
                    { label: 'Coherence', value: mockResult.stats.coherence, unit: '', icon: '📊' },
                    { label: 'Coverage', value: mockResult.stats.coverage, unit: '%', icon: '🗺️' },
                    { label: 'Resolution', value: mockResult.stats.resolution, unit: '', icon: '🔍' },
                    { label: 'Max Deformation', value: mockResult.stats.maxDeformation, unit: '', icon: '📉' },
                ].map((stat, i) => (
                    <motion.div
                        key={stat.label}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.2 + i * 0.05 }}
                        className="card"
                        style={{ textAlign: 'center' }}
                    >
                        <div style={{ fontSize: '1.5rem', marginBottom: 'var(--space-sm)' }}>
                            {stat.icon}
                        </div>
                        <div style={{
                            fontSize: '1.5rem',
                            fontWeight: 700,
                            color: 'var(--text-primary)',
                            fontFamily: 'var(--font-mono)'
                        }}>
                            {stat.value}{stat.unit}
                        </div>
                        <div style={{
                            fontSize: '0.8rem',
                            color: 'var(--text-tertiary)'
                        }}>
                            {stat.label}
                        </div>
                    </motion.div>
                ))}
            </motion.div>

            {/* Tabs */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                style={{
                    display: 'flex',
                    gap: 'var(--space-sm)',
                    marginBottom: 'var(--space-lg)'
                }}
            >
                {['map', 'outputs', 'export'].map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        style={{
                            padding: 'var(--space-sm) var(--space-lg)',
                            background: activeTab === tab ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                            border: 'none',
                            borderRadius: 'var(--radius-md)',
                            color: activeTab === tab ? 'white' : 'var(--text-secondary)',
                            cursor: 'pointer',
                            fontSize: '0.9rem',
                            textTransform: 'capitalize',
                            fontWeight: activeTab === tab ? 600 : 400
                        }}
                    >
                        {tab === 'map' && '🗺️ '}
                        {tab === 'outputs' && '📁 '}
                        {tab === 'export' && '⬇️ '}
                        {tab}
                    </button>
                ))}
            </motion.div>

            {/* Tab Content */}
            <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
            >
                {activeTab === 'map' && (
                    <div className="card" style={{ padding: 0, overflow: 'hidden', height: '500px' }}>
                        <MapContainer
                            center={[19.076, 72.877]}
                            zoom={11}
                            style={{ height: '100%', width: '100%' }}
                        >
                            <TileLayer
                                attribution='&copy; <a href="https://carto.com/">CARTO</a>'
                                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                            />
                            <GeoJSON
                                data={resultPolygon}
                                style={{
                                    fillColor: '#6366f1',
                                    fillOpacity: 0.4,
                                    color: '#6366f1',
                                    weight: 2
                                }}
                            />
                        </MapContainer>
                        <div style={{
                            position: 'absolute',
                            bottom: 'var(--space-lg)',
                            right: 'var(--space-lg)',
                            background: 'var(--bg-secondary)',
                            padding: 'var(--space-md)',
                            borderRadius: 'var(--radius-md)',
                            fontSize: '0.8rem',
                            boxShadow: 'var(--shadow-lg)',
                            zIndex: 1000
                        }}>
                            <div style={{ fontWeight: 600, marginBottom: 'var(--space-xs)' }}>Deformation Scale</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                                <div style={{
                                    width: '100px',
                                    height: '10px',
                                    background: 'linear-gradient(to right, #22c55e, #eab308, #ef4444)',
                                    borderRadius: 'var(--radius-sm)'
                                }} />
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>mm/yr</span>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'outputs' && (
                    <div className="card">
                        <h3 style={{ marginBottom: 'var(--space-lg)' }}>Output Files</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                            {mockResult.outputs.map((output) => (
                                <div
                                    key={output.name}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        padding: 'var(--space-md)',
                                        background: 'var(--bg-tertiary)',
                                        borderRadius: 'var(--radius-md)'
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                                        <span style={{ fontSize: '1.2rem' }}>
                                            {output.format === 'GeoTIFF' ? '🗺️' : '📄'}
                                        </span>
                                        <div>
                                            <div style={{ fontWeight: 500 }}>{output.name}</div>
                                            <div style={{
                                                fontSize: '0.75rem',
                                                color: 'var(--text-tertiary)',
                                                fontFamily: 'var(--font-mono)'
                                            }}>
                                                {output.format} • {output.size}
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        className="btn btn-secondary"
                                        style={{ padding: 'var(--space-xs) var(--space-md)' }}
                                    >
                                        ⬇️ Download
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === 'export' && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-lg)' }}>
                        <motion.div
                            whileHover={{ y: -3 }}
                            className="card"
                            style={{ textAlign: 'center', cursor: 'pointer' }}
                        >
                            <div style={{ fontSize: '2.5rem', marginBottom: 'var(--space-md)' }}>📦</div>
                            <h4 style={{ marginBottom: 'var(--space-sm)' }}>Download All</h4>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                Get all outputs as a ZIP archive
                            </p>
                            <button className="btn btn-primary" style={{ marginTop: 'var(--space-lg)', width: '100%' }}>
                                Download ZIP
                            </button>
                        </motion.div>

                        <motion.div
                            whileHover={{ y: -3 }}
                            className="card"
                            style={{ textAlign: 'center', cursor: 'pointer' }}
                        >
                            <div style={{ fontSize: '2.5rem', marginBottom: 'var(--space-md)' }}>🔄</div>
                            <h4 style={{ marginBottom: 'var(--space-sm)' }}>Schedule Recurring</h4>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                Automate this analysis weekly or monthly
                            </p>
                            <button className="btn btn-secondary" style={{ marginTop: 'var(--space-lg)', width: '100%' }}>
                                Set Schedule
                            </button>
                        </motion.div>

                        <motion.div
                            whileHover={{ y: -3 }}
                            className="card"
                            style={{ textAlign: 'center', cursor: 'pointer' }}
                        >
                            <div style={{ fontSize: '2.5rem', marginBottom: 'var(--space-md)' }}>🔗</div>
                            <h4 style={{ marginBottom: 'var(--space-sm)' }}>Share Results</h4>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                Generate a shareable link to these results
                            </p>
                            <button className="btn btn-secondary" style={{ marginTop: 'var(--space-lg)', width: '100%' }}>
                                Copy Link
                            </button>
                        </motion.div>
                    </div>
                )}
            </motion.div>
        </div>
    )
}

export default ResultsPage
