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
        mousedown(e) {
            if (isDrawing) setStartPos(e.latlng)
        },
        mousemove(e) {
            if (startPos && isDrawing) {
                setBounds([[startPos.lat, startPos.lng], [e.latlng.lat, e.latlng.lng]])
            }
        },
        mouseup(e) {
            if (startPos && isDrawing) {
                const finalBounds = [[startPos.lat, startPos.lng], [e.latlng.lat, e.latlng.lng]]
                setBounds(finalBounds)
                onDraw(finalBounds)
                setStartPos(null)
            }
        }
    })

    return bounds ? (
        <Rectangle
            bounds={bounds}
            pathOptions={{ color: '#6366f1', weight: 2, fillColor: '#6366f1', fillOpacity: 0.15 }}
        />
    ) : null
}

function SelectLocationPage() {
    const navigate = useNavigate()
    const { setLocation, nextStep } = useWorkflowStore()
    const [drawnArea, setDrawnArea] = useState(null)
    const [mapCenter, setMapCenter] = useState([20.5937, 78.9629])
    const [mapZoom, setMapZoom] = useState(5)
    const [locationName, setLocationName] = useState('')
    const [isDrawing, setIsDrawing] = useState(false)

    const handleDraw = (bounds) => {
        const geoJSON = {
            type: 'Feature',
            geometry: {
                type: 'Polygon',
                coordinates: [[
                    [bounds[0][1], bounds[0][0]],
                    [bounds[1][1], bounds[0][0]],
                    [bounds[1][1], bounds[1][0]],
                    [bounds[0][1], bounds[1][0]],
                    [bounds[0][1], bounds[0][0]]
                ]]
            }
        }
        setDrawnArea(geoJSON)
        setIsDrawing(false)
    }

    const handleSelectSaved = (loc) => {
        setMapCenter(loc.center)
        setMapZoom(loc.zoom)
        setLocationName(loc.name)
        const offset = 0.15
        setDrawnArea({
            type: 'Feature',
            geometry: {
                type: 'Polygon',
                coordinates: [[
                    [loc.center[1] - offset, loc.center[0] - offset],
                    [loc.center[1] + offset, loc.center[0] - offset],
                    [loc.center[1] + offset, loc.center[0] + offset],
                    [loc.center[1] - offset, loc.center[0] + offset],
                    [loc.center[1] - offset, loc.center[0] - offset]
                ]]
            }
        })
    }

    const handleContinue = () => {
        if (drawnArea) {
            setLocation({ type: 'draw', coordinates: drawnArea, name: locationName || 'Custom Area' })
            nextStep()
            navigate('/app/data')
        }
    }

    return (
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                style={{ marginBottom: 'var(--space-xl)' }}
            >
                <h1 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: 'var(--space-xs)' }}>
                    Select Area of Interest
                </h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                    Draw a region on the map or select a saved location
                </p>
            </motion.div>

            <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 300px',
                gap: 'var(--space-xl)',
                minHeight: '500px'
            }}>
                {/* Map */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.1 }}
                    style={{
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-lg)',
                        overflow: 'hidden',
                        position: 'relative'
                    }}
                >
                    <MapContainer
                        center={mapCenter}
                        zoom={mapZoom}
                        style={{ height: '100%', width: '100%', minHeight: '500px', cursor: isDrawing ? 'crosshair' : 'grab' }}
                    >
                        <TileLayer
                            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                        />
                        <DrawRectangle onDraw={handleDraw} isDrawing={isDrawing} />
                        {drawnArea && !isDrawing && (
                            <Rectangle
                                bounds={[
                                    [drawnArea.geometry.coordinates[0][0][1], drawnArea.geometry.coordinates[0][0][0]],
                                    [drawnArea.geometry.coordinates[0][2][1], drawnArea.geometry.coordinates[0][2][0]]
                                ]}
                                pathOptions={{ color: '#6366f1', weight: 2, fillColor: '#6366f1', fillOpacity: 0.2 }}
                            />
                        )}
                    </MapContainer>

                    {/* Map toolbar */}
                    <div style={{
                        position: 'absolute',
                        top: 'var(--space-md)',
                        right: 'var(--space-md)',
                        zIndex: 1000,
                        display: 'flex',
                        gap: 'var(--space-sm)'
                    }}>
                        <button
                            onClick={() => { setIsDrawing(!isDrawing); setDrawnArea(null) }}
                            style={{
                                padding: 'var(--space-sm) var(--space-md)',
                                background: isDrawing ? 'var(--accent-primary)' : 'var(--bg-secondary)',
                                border: '1px solid var(--border-default)',
                                borderRadius: 'var(--radius-md)',
                                color: isDrawing ? 'white' : 'var(--text-primary)',
                                cursor: 'pointer',
                                fontSize: '0.85rem'
                            }}
                        >
                            {isDrawing ? 'Click & Drag to Draw' : 'Draw Rectangle'}
                        </button>
                        {drawnArea && (
                            <button
                                onClick={() => setDrawnArea(null)}
                                style={{
                                    padding: 'var(--space-sm) var(--space-md)',
                                    background: 'var(--bg-secondary)',
                                    border: '1px solid var(--border-default)',
                                    borderRadius: 'var(--radius-md)',
                                    color: 'var(--text-secondary)',
                                    cursor: 'pointer',
                                    fontSize: '0.85rem'
                                }}
                            >
                                Clear
                            </button>
                        )}
                    </div>
                </motion.div>

                {/* Sidebar */}
                <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 }}
                    style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}
                >
                    {/* Location Name */}
                    <div style={{
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-lg)',
                        padding: 'var(--space-lg)'
                    }}>
                        <label style={{
                            display: 'block',
                            fontSize: '0.8rem',
                            color: 'var(--text-tertiary)',
                            marginBottom: 'var(--space-sm)',
                            fontWeight: 500
                        }}>
                            Location Name
                        </label>
                        <input
                            type="text"
                            value={locationName}
                            onChange={(e) => setLocationName(e.target.value)}
                            placeholder="e.g., Mumbai Coastal Study"
                            style={{
                                width: '100%',
                                padding: 'var(--space-sm) var(--space-md)',
                                background: 'var(--bg-tertiary)',
                                border: '1px solid var(--border-default)',
                                borderRadius: 'var(--radius-md)',
                                color: 'var(--text-primary)',
                                fontSize: '0.9rem'
                            }}
                        />
                    </div>

                    {/* Saved Locations */}
                    <div style={{
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-lg)',
                        padding: 'var(--space-lg)',
                        flex: 1
                    }}>
                        <div style={{
                            fontSize: '0.8rem',
                            color: 'var(--text-tertiary)',
                            marginBottom: 'var(--space-md)',
                            fontWeight: 500
                        }}>
                            Saved Locations
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
                            {savedLocations.map((loc) => (
                                <button
                                    key={loc.id}
                                    onClick={() => handleSelectSaved(loc)}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 'var(--space-sm)',
                                        padding: 'var(--space-sm) var(--space-md)',
                                        background: locationName === loc.name ? 'rgba(99, 102, 241, 0.1)' : 'var(--bg-tertiary)',
                                        border: locationName === loc.name ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid transparent',
                                        borderRadius: 'var(--radius-md)',
                                        cursor: 'pointer',
                                        textAlign: 'left',
                                        color: 'var(--text-primary)',
                                        fontSize: '0.85rem',
                                        transition: 'all 0.15s ease'
                                    }}
                                >
                                    <span style={{ opacity: 0.6 }}>📍</span>
                                    {loc.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Status & Continue */}
                    <div style={{
                        background: drawnArea ? 'rgba(34, 197, 94, 0.05)' : 'var(--bg-secondary)',
                        border: `1px solid ${drawnArea ? 'rgba(34, 197, 94, 0.2)' : 'var(--border-subtle)'}`,
                        borderRadius: 'var(--radius-lg)',
                        padding: 'var(--space-lg)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 'var(--space-md)' }}>
                            <div style={{
                                width: '8px',
                                height: '8px',
                                borderRadius: '50%',
                                background: drawnArea ? '#22c55e' : 'var(--text-tertiary)'
                            }} />
                            <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>
                                {drawnArea ? 'Area selected' : 'No area selected'}
                            </span>
                        </div>

                        <button
                            onClick={handleContinue}
                            disabled={!drawnArea}
                            style={{
                                width: '100%',
                                padding: 'var(--space-md)',
                                background: drawnArea ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                                border: 'none',
                                borderRadius: 'var(--radius-md)',
                                color: drawnArea ? 'white' : 'var(--text-tertiary)',
                                cursor: drawnArea ? 'pointer' : 'not-allowed',
                                fontSize: '0.9rem',
                                fontWeight: 500
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
