import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { MapContainer, TileLayer, Rectangle, useMapEvents } from 'react-leaflet'
import { useWorkflowStore } from '../../store/workflowStore'
import 'leaflet/dist/leaflet.css'

const savedLocations = [
    { id: 1, name: 'Mumbai Coast', center: [19.076, 72.877], zoom: 10 },
    { id: 2, name: 'Delhi NCR', center: [28.613, 77.209], zoom: 10 },
    { id: 3, name: 'Himalayan Glaciers', center: [30.733, 79.066], zoom: 9 },
    { id: 4, name: 'Chennai Port', center: [13.082, 80.270], zoom: 11 },
]

function DrawRectangle({ onDraw, isDrawing }) {
    const [startPos, setStartPos] = useState(null)
    const [bounds, setBounds] = useState(null)
    useMapEvents({
        mousedown(e) { if (isDrawing) setStartPos(e.latlng) },
        mousemove(e) { if (startPos && isDrawing) setBounds([[startPos.lat, startPos.lng], [e.latlng.lat, e.latlng.lng]]) },
        mouseup(e) {
            if (startPos && isDrawing) {
                const b = [[startPos.lat, startPos.lng], [e.latlng.lat, e.latlng.lng]]
                setBounds(b); onDraw(b); setStartPos(null)
            }
        }
    })
    return bounds ? <Rectangle bounds={bounds} pathOptions={{ color: '#0078d4', weight: 2, fillColor: '#0078d4', fillOpacity: 0.12 }} /> : null
}

function SelectLocationPage() {
    const navigate = useNavigate()
    const { setLocation, nextStep } = useWorkflowStore()
    const [drawnArea, setDrawnArea] = useState(null)
    const [mapCenter] = useState([20.5937, 78.9629])
    const [mapZoom] = useState(5)
    const [locationName, setLocationName] = useState('')
    const [isDrawing, setIsDrawing] = useState(false)
    const [activeSaved, setActiveSaved] = useState(null)

    const handleDraw = (bounds) => {
        setDrawnArea({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [[[bounds[0][1], bounds[0][0]], [bounds[1][1], bounds[0][0]], [bounds[1][1], bounds[1][0]], [bounds[0][1], bounds[1][0]], [bounds[0][1], bounds[0][0]]]] } })
        setIsDrawing(false)
    }

    const handleSelectSaved = (loc) => {
        setActiveSaved(loc.id)
        setLocationName(loc.name)
        const off = 0.15
        setDrawnArea({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [[[loc.center[1] - off, loc.center[0] - off], [loc.center[1] + off, loc.center[0] - off], [loc.center[1] + off, loc.center[0] + off], [loc.center[1] - off, loc.center[0] + off], [loc.center[1] - off, loc.center[0] - off]]] } })
    }

    const handleContinue = () => {
        setLocation({ type: 'draw', coordinates: drawnArea, name: locationName || 'Custom Area' })
        nextStep(); navigate('/app/data')
    }

    return (
        <div style={{ maxWidth: '1160px' }}>
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: '24px' }}>
                <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#000', letterSpacing: '-0.02em', marginBottom: '6px' }}>
                    Select Area of Interest
                </h1>
                <p style={{ color: '#666', fontSize: '0.9rem' }}>Draw a region on the map or pick a saved location below</p>
            </motion.div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '20px', minHeight: '520px' }}>
                {/* Map */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.1 }}
                    style={{ background: '#fff', borderRadius: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.07)', overflow: 'hidden', position: 'relative' }}
                >
                    <MapContainer center={mapCenter} zoom={mapZoom} style={{ height: '100%', width: '100%', minHeight: '520px', cursor: isDrawing ? 'crosshair' : 'grab' }}>
                        <TileLayer
                            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                            attribution="&copy; CARTO"
                        />
                        <DrawRectangle onDraw={handleDraw} isDrawing={isDrawing} />
                        {drawnArea && !isDrawing && (
                            <Rectangle
                                bounds={[[drawnArea.geometry.coordinates[0][0][1], drawnArea.geometry.coordinates[0][0][0]], [drawnArea.geometry.coordinates[0][2][1], drawnArea.geometry.coordinates[0][2][0]]]}
                                pathOptions={{ color: '#0078d4', weight: 2, fillColor: '#0078d4', fillOpacity: 0.15 }}
                            />
                        )}
                    </MapContainer>
                    {/* Map toolbar */}
                    <div style={{ position: 'absolute', top: '14px', right: '14px', zIndex: 1000, display: 'flex', gap: '8px' }}>
                        <button
                            onClick={() => { setIsDrawing(!isDrawing); if (isDrawing) setDrawnArea(null) }}
                            style={{
                                padding: '8px 16px',
                                background: isDrawing ? '#0078d4' : '#fff',
                                border: '1px solid #e0e0e0',
                                borderRadius: '10px',
                                color: isDrawing ? '#fff' : '#1a1a1a',
                                cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500,
                                boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
                            }}
                        >
                            {isDrawing ? '↖ Drag to Draw' : '✏ Draw Rectangle'}
                        </button>
                        {drawnArea && (
                            <button
                                onClick={() => { setDrawnArea(null); setActiveSaved(null) }}
                                style={{ padding: '8px 14px', background: '#fff', border: '1px solid #e0e0e0', borderRadius: '10px', color: '#666', cursor: 'pointer', fontSize: '0.85rem', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
                            >
                                Clear
                            </button>
                        )}
                    </div>
                </motion.div>

                {/* Sidebar */}
                <motion.div
                    initial={{ opacity: 0, x: 16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.15 }}
                    style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
                >
                    {/* Name Input */}
                    <div style={{ background: '#fff', borderRadius: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.07)', padding: '22px 24px' }}>
                        <div style={{ fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#999', marginBottom: '10px' }}>
                            Location Name
                        </div>
                        <input
                            type="text"
                            value={locationName}
                            onChange={e => setLocationName(e.target.value)}
                            placeholder="e.g. Mumbai Coastal Study"
                            style={{
                                width: '100%', padding: '10px 14px',
                                background: '#f7f9fb', border: '1px solid #e8e8e8',
                                borderRadius: '10px', color: '#1a1a1a', fontSize: '0.9rem',
                                outline: 'none', fontFamily: 'inherit'
                            }}
                        />
                    </div>

                    {/* Saved Locations */}
                    <div style={{ background: '#fff', borderRadius: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.07)', padding: '22px 24px', flex: 1 }}>
                        <div style={{ fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#999', marginBottom: '12px' }}>
                            Saved Locations
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {savedLocations.map(loc => (
                                <button
                                    key={loc.id}
                                    onClick={() => handleSelectSaved(loc)}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '10px',
                                        padding: '10px 12px',
                                        background: activeSaved === loc.id ? '#e8f3fc' : '#f7f9fb',
                                        border: `1px solid ${activeSaved === loc.id ? '#b3d6f4' : 'transparent'}`,
                                        borderRadius: '12px', cursor: 'pointer', textAlign: 'left',
                                        color: '#1a1a1a', fontSize: '0.875rem',
                                        transition: 'all 0.15s ease'
                                    }}
                                >
                                    <span style={{ color: '#0078d4', fontSize: '0.9rem' }}>📍</span>
                                    {loc.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Status + Continue */}
                    <div style={{
                        background: drawnArea ? '#f0faf4' : '#fff',
                        border: `1px solid ${drawnArea ? '#b6e2c8' : '#e8e8e8'}`,
                        borderRadius: '20px', padding: '20px 24px'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: drawnArea ? '#1a7f3c' : '#ccc' }} />
                            <span style={{ fontSize: '0.875rem', fontWeight: 500, color: drawnArea ? '#1a7f3c' : '#888' }}>
                                {drawnArea ? 'Area selected' : 'No area selected'}
                            </span>
                        </div>
                        <button
                            onClick={handleContinue}
                            disabled={!drawnArea}
                            style={{
                                width: '100%', padding: '11px',
                                background: drawnArea ? '#0078d4' : '#e8e8e8',
                                border: 'none', borderRadius: '12px',
                                color: drawnArea ? '#fff' : '#aaa',
                                cursor: drawnArea ? 'pointer' : 'not-allowed',
                                fontSize: '0.9rem', fontWeight: 500,
                                transition: 'background 0.2s ease'
                            }}
                        >
                            Continue →
                        </button>
                    </div>
                </motion.div>
            </div>
        </div>
    )
}

export default SelectLocationPage
