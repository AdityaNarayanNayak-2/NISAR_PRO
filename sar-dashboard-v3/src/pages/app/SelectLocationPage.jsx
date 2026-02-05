import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { MapContainer, TileLayer, Rectangle, useMapEvents } from 'react-leaflet'
import { useWorkflowStore } from '../../store/workflowStore'
import 'leaflet/dist/leaflet.css'

// Saved locations (mock data)
const savedLocations = [
    { id: 1, name: 'Mumbai Coast', center: [19.076, 72.877], zoom: 10 },
    { id: 2, name: 'Delhi NCR', center: [28.613, 77.209], zoom: 10 },
    { id: 3, name: 'Himalayan Glaciers', center: [30.733, 79.066], zoom: 9 },
    { id: 4, name: 'Chennai Port', center: [13.082, 80.270], zoom: 11 },
]

// Custom draw component
function DrawRectangle({ onDraw }) {
    const [startPos, setStartPos] = useState(null)
    const [bounds, setBounds] = useState(null)

    useMapEvents({
        mousedown(e) {
            setStartPos(e.latlng)
        },
        mousemove(e) {
            if (startPos) {
                setBounds([[startPos.lat, startPos.lng], [e.latlng.lat, e.latlng.lng]])
            }
        },
        mouseup(e) {
            if (startPos) {
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
            pathOptions={{
                color: '#6366f1',
                weight: 2,
                fillColor: '#6366f1',
                fillOpacity: 0.2
            }}
        />
    ) : null
}

function SelectLocationPage() {
    const navigate = useNavigate()
    const { setLocation, nextStep, location } = useWorkflowStore()
    const [drawnArea, setDrawnArea] = useState(null)
    const [mapCenter, setMapCenter] = useState([20.5937, 78.9629]) // India center
    const [mapZoom, setMapZoom] = useState(5)
    const [locationName, setLocationName] = useState('')
    const [isDrawing, setIsDrawing] = useState(false)

    const handleDraw = (bounds) => {
        const geoJSON = {
            type: 'Feature',
            properties: {},
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
        // Auto-create a bounding box around saved location
        const offset = 0.15
        setDrawnArea({
            type: 'Feature',
            properties: {},
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
            setLocation({
                type: 'draw',
                coordinates: drawnArea,
                name: locationName || 'Custom Area'
            })
            nextStep()
            navigate('/app/data')
        }
    }

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
                        STEP 1
                    </span>
                </div>
                <h1 style={{ marginBottom: 'var(--space-sm)' }}>
                    Select <span className="text-gradient">Location</span>
                </h1>
                <p style={{ color: 'var(--text-secondary)' }}>
                    Click and drag on the map to select an area of interest, or choose a saved location
                </p>
            </motion.div>

            <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 280px',
                gap: 'var(--space-xl)',
                height: 'calc(100vh - 280px)'
            }}>
                {/* Map */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="card"
                    style={{
                        padding: 0,
                        overflow: 'hidden',
                        minHeight: '500px'
                    }}
                >
                    <MapContainer
                        center={mapCenter}
                        zoom={mapZoom}
                        style={{ height: '100%', width: '100%', cursor: isDrawing ? 'crosshair' : 'grab' }}
                    >
                        <TileLayer
                            attribution='&copy; <a href="https://carto.com/">CARTO</a>'
                            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                        />
                        {isDrawing && <DrawRectangle onDraw={handleDraw} />}
                        {drawnArea && !isDrawing && (
                            <Rectangle
                                bounds={[
                                    [drawnArea.geometry.coordinates[0][0][1], drawnArea.geometry.coordinates[0][0][0]],
                                    [drawnArea.geometry.coordinates[0][2][1], drawnArea.geometry.coordinates[0][2][0]]
                                ]}
                                pathOptions={{
                                    color: '#6366f1',
                                    weight: 2,
                                    fillColor: '#6366f1',
                                    fillOpacity: 0.3
                                }}
                            />
                        )}
                    </MapContainer>

                    {/* Draw button overlay */}
                    <div style={{
                        position: 'absolute',
                        top: 'var(--space-lg)',
                        right: 'var(--space-lg)',
                        zIndex: 1000
                    }}>
                        <button
                            onClick={() => setIsDrawing(!isDrawing)}
                            style={{
                                padding: 'var(--space-sm) var(--space-lg)',
                                background: isDrawing ? 'var(--accent-primary)' : 'var(--bg-secondary)',
                                border: '1px solid var(--border-default)',
                                borderRadius: 'var(--radius-md)',
                                color: isDrawing ? 'white' : 'var(--text-primary)',
                                cursor: 'pointer',
                                fontSize: '0.85rem',
                                fontWeight: 500
                            }}
                        >
                            {isDrawing ? '✓ Drawing...' : '✏️ Draw Area'}
                        </button>
                    </div>
                </motion.div>

                {/* Sidebar */}
                <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 }}
                    style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}
                >
                    {/* Location Name */}
                    <div className="card">
                        <label style={{
                            display: 'block',
                            fontSize: '0.85rem',
                            color: 'var(--text-secondary)',
                            marginBottom: 'var(--space-sm)'
                        }}>
                            Location Name
                        </label>
                        <input
                            type="text"
                            value={locationName}
                            onChange={(e) => setLocationName(e.target.value)}
                            placeholder="e.g., Mumbai Coast Study"
                            style={{
                                width: '100%',
                                padding: 'var(--space-md)',
                                background: 'var(--bg-tertiary)',
                                border: '1px solid var(--border-default)',
                                borderRadius: 'var(--radius-md)',
                                color: 'var(--text-primary)',
                                fontSize: '0.9rem'
                            }}
                        />
                    </div>

                    {/* Saved Locations */}
                    <div className="card">
                        <h4 style={{
                            fontSize: '0.9rem',
                            marginBottom: 'var(--space-md)'
                        }}>
                            Saved Locations
                        </h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                            {savedLocations.map((loc) => (
                                <button
                                    key={loc.id}
                                    onClick={() => handleSelectSaved(loc)}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 'var(--space-sm)',
                                        padding: 'var(--space-sm)',
                                        background: locationName === loc.name ? 'rgba(99, 102, 241, 0.15)' : 'var(--bg-tertiary)',
                                        border: locationName === loc.name ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid var(--border-subtle)',
                                        borderRadius: 'var(--radius-sm)',
                                        cursor: 'pointer',
                                        textAlign: 'left',
                                        color: 'var(--text-primary)',
                                        transition: 'all var(--transition-fast)'
                                    }}
                                >
                                    <span>📍</span>
                                    <span style={{ fontSize: '0.85rem' }}>{loc.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Status */}
                    <div className="card" style={{
                        background: drawnArea ? 'rgba(34, 197, 94, 0.1)' : 'var(--bg-secondary)',
                        border: drawnArea ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid var(--border-subtle)'
                    }}>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 'var(--space-sm)',
                            marginBottom: 'var(--space-sm)'
                        }}>
                            <span>{drawnArea ? '✅' : '⏳'}</span>
                            <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>
                                {drawnArea ? 'Area Selected' : 'Select an area'}
                            </span>
                        </div>
                        <p style={{
                            fontSize: '0.8rem',
                            color: 'var(--text-tertiary)',
                            margin: 0
                        }}>
                            {drawnArea
                                ? 'Your area of interest is ready'
                                : 'Click "Draw Area" then drag on map'}
                        </p>
                    </div>

                    {/* Continue Button */}
                    <button
                        onClick={handleContinue}
                        disabled={!drawnArea}
                        className="btn btn-primary"
                        style={{
                            opacity: drawnArea ? 1 : 0.5,
                            cursor: drawnArea ? 'pointer' : 'not-allowed',
                            width: '100%',
                            justifyContent: 'center'
                        }}
                    >
                        Continue to Data Source →
                    </button>
                </motion.div>
            </div>
        </div>
    )
}

export default SelectLocationPage
