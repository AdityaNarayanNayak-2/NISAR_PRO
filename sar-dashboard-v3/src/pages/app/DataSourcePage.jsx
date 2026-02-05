import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useWorkflowStore } from '../../store/workflowStore'
import { format, subDays } from 'date-fns'

const missions = [
    { id: 'nisar', name: 'NISAR', org: 'NASA-ISRO', band: 'L + S', flag: '🇺🇸🇮🇳', color: '#6366f1' },
    { id: 'sentinel1', name: 'Sentinel-1', org: 'ESA', band: 'C-Band', flag: '🇪🇺', color: '#06b6d4' },
    { id: 'iceye', name: 'ICEYE', org: 'Commercial', band: 'X-Band', flag: '🇫🇮', color: '#8b5cf6' },
    { id: 'capella', name: 'Capella', org: 'Commercial', band: 'X-Band', flag: '🇺🇸', color: '#f59e0b' },
]

// Mock available scenes
const mockScenes = [
    { id: 'S1A_IW_SLC_20260201', mission: 'sentinel1', date: '2026-02-01', size: '1.2 GB', cloud: 0, mode: 'IW' },
    { id: 'S1A_IW_SLC_20260125', mission: 'sentinel1', date: '2026-01-25', size: '1.1 GB', cloud: 0, mode: 'IW' },
    { id: 'NISAR_L1_SLC_20260130', mission: 'nisar', date: '2026-01-30', size: '2.4 GB', cloud: 0, mode: 'ScanSAR' },
    { id: 'NISAR_L1_SLC_20260118', mission: 'nisar', date: '2026-01-18', size: '2.3 GB', cloud: 0, mode: 'ScanSAR' },
    { id: 'ICEYE_X2_SLC_20260128', mission: 'iceye', date: '2026-01-28', size: '0.8 GB', cloud: 0, mode: 'Spotlight' },
]

function DataSourcePage() {
    const navigate = useNavigate()
    const { dataSource, setDataSource, nextStep, location } = useWorkflowStore()

    const [selectedMission, setSelectedMission] = useState(dataSource.mission)
    const [dateRange, setDateRange] = useState({
        start: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
        end: format(new Date(), 'yyyy-MM-dd')
    })
    const [selectedScenes, setSelectedScenes] = useState(dataSource.selectedScenes)

    const filteredScenes = mockScenes.filter(s =>
        !selectedMission || s.mission === selectedMission
    )

    const toggleScene = (scene) => {
        if (selectedScenes.find(s => s.id === scene.id)) {
            setSelectedScenes(selectedScenes.filter(s => s.id !== scene.id))
        } else {
            setSelectedScenes([...selectedScenes, scene])
        }
    }

    const handleContinue = () => {
        setDataSource({
            mission: selectedMission,
            dateRange,
            selectedScenes
        })
        nextStep()
        navigate('/app/configure')
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
                        STEP 2
                    </span>
                    {location.name && (
                        <span style={{
                            padding: 'var(--space-xs) var(--space-sm)',
                            background: 'rgba(34, 197, 94, 0.1)',
                            border: '1px solid rgba(34, 197, 94, 0.3)',
                            borderRadius: 'var(--radius-full)',
                            fontSize: '0.7rem',
                            fontFamily: 'var(--font-mono)',
                            color: '#22c55e'
                        }}>
                            📍 {location.name}
                        </span>
                    )}
                </div>
                <h1 style={{ marginBottom: 'var(--space-sm)' }}>
                    Select <span className="text-gradient">Data Source</span>
                </h1>
                <p style={{ color: 'var(--text-secondary)' }}>
                    Choose a mission and select available SAR scenes for your area
                </p>
            </motion.div>

            {/* Mission Selection */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                style={{ marginBottom: 'var(--space-xl)' }}
            >
                <h3 style={{ fontSize: '1rem', marginBottom: 'var(--space-md)' }}>Mission</h3>
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                    gap: 'var(--space-md)'
                }}>
                    {missions.map((mission) => (
                        <motion.button
                            key={mission.id}
                            whileHover={{ y: -3 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => setSelectedMission(mission.id)}
                            style={{
                                padding: 'var(--space-lg)',
                                background: selectedMission === mission.id
                                    ? `${mission.color}20`
                                    : 'var(--bg-secondary)',
                                border: `2px solid ${selectedMission === mission.id ? mission.color : 'var(--border-subtle)'}`,
                                borderRadius: 'var(--radius-lg)',
                                cursor: 'pointer',
                                textAlign: 'left'
                            }}
                        >
                            <div style={{ fontSize: '1.5rem', marginBottom: 'var(--space-sm)' }}>
                                {mission.flag}
                            </div>
                            <div style={{
                                fontWeight: 600,
                                color: 'var(--text-primary)',
                                marginBottom: 'var(--space-xs)'
                            }}>
                                {mission.name}
                            </div>
                            <div style={{
                                fontSize: '0.75rem',
                                color: 'var(--text-tertiary)',
                                fontFamily: 'var(--font-mono)'
                            }}>
                                {mission.band} • {mission.org}
                            </div>
                        </motion.button>
                    ))}
                </div>
            </motion.div>

            {/* Date Range */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="card"
                style={{ marginBottom: 'var(--space-xl)' }}
            >
                <h3 style={{ fontSize: '1rem', marginBottom: 'var(--space-md)' }}>Date Range</h3>
                <div style={{ display: 'flex', gap: 'var(--space-lg)', alignItems: 'center' }}>
                    <div>
                        <label style={{
                            display: 'block',
                            fontSize: '0.8rem',
                            color: 'var(--text-tertiary)',
                            marginBottom: 'var(--space-xs)'
                        }}>From</label>
                        <input
                            type="date"
                            value={dateRange.start}
                            onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                            style={{
                                padding: 'var(--space-sm) var(--space-md)',
                                background: 'var(--bg-tertiary)',
                                border: '1px solid var(--border-default)',
                                borderRadius: 'var(--radius-md)',
                                color: 'var(--text-primary)',
                                fontSize: '0.9rem'
                            }}
                        />
                    </div>
                    <span style={{ color: 'var(--text-tertiary)', marginTop: '20px' }}>→</span>
                    <div>
                        <label style={{
                            display: 'block',
                            fontSize: '0.8rem',
                            color: 'var(--text-tertiary)',
                            marginBottom: 'var(--space-xs)'
                        }}>To</label>
                        <input
                            type="date"
                            value={dateRange.end}
                            onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                            style={{
                                padding: 'var(--space-sm) var(--space-md)',
                                background: 'var(--bg-tertiary)',
                                border: '1px solid var(--border-default)',
                                borderRadius: 'var(--radius-md)',
                                color: 'var(--text-primary)',
                                fontSize: '0.9rem'
                            }}
                        />
                    </div>
                </div>
            </motion.div>

            {/* Available Scenes */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
            >
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 'var(--space-md)'
                }}>
                    <h3 style={{ fontSize: '1rem' }}>
                        Available Scenes ({filteredScenes.length})
                    </h3>
                    <span style={{
                        fontSize: '0.8rem',
                        color: 'var(--accent-primary)',
                        fontFamily: 'var(--font-mono)'
                    }}>
                        {selectedScenes.length} selected
                    </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                    {filteredScenes.map((scene) => {
                        const isSelected = selectedScenes.find(s => s.id === scene.id)
                        return (
                            <motion.div
                                key={scene.id}
                                whileHover={{ backgroundColor: 'var(--bg-tertiary)' }}
                                onClick={() => toggleScene(scene)}
                                className="card"
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: 'var(--space-md) var(--space-lg)',
                                    cursor: 'pointer',
                                    border: isSelected
                                        ? '2px solid var(--accent-primary)'
                                        : '1px solid var(--border-subtle)',
                                    background: isSelected
                                        ? 'rgba(99, 102, 241, 0.1)'
                                        : 'var(--bg-secondary)'
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                                    <div style={{
                                        width: '24px',
                                        height: '24px',
                                        borderRadius: 'var(--radius-sm)',
                                        border: `2px solid ${isSelected ? 'var(--accent-primary)' : 'var(--border-default)'}`,
                                        background: isSelected ? 'var(--accent-primary)' : 'transparent',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: 'white',
                                        fontSize: '0.8rem'
                                    }}>
                                        {isSelected && '✓'}
                                    </div>
                                    <div>
                                        <div style={{
                                            fontFamily: 'var(--font-mono)',
                                            fontSize: '0.85rem',
                                            marginBottom: '2px'
                                        }}>
                                            {scene.id}
                                        </div>
                                        <div style={{
                                            fontSize: '0.75rem',
                                            color: 'var(--text-tertiary)'
                                        }}>
                                            {scene.mode} • {scene.size}
                                        </div>
                                    </div>
                                </div>
                                <div style={{
                                    fontSize: '0.85rem',
                                    color: 'var(--text-secondary)',
                                    fontFamily: 'var(--font-mono)'
                                }}>
                                    {scene.date}
                                </div>
                            </motion.div>
                        )
                    })}
                </div>
            </motion.div>

            {/* Continue Button */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                style={{
                    marginTop: 'var(--space-2xl)',
                    display: 'flex',
                    justifyContent: 'flex-end'
                }}
            >
                <button
                    onClick={handleContinue}
                    disabled={selectedScenes.length === 0}
                    className="btn btn-primary"
                    style={{
                        opacity: selectedScenes.length > 0 ? 1 : 0.5,
                        cursor: selectedScenes.length > 0 ? 'pointer' : 'not-allowed'
                    }}
                >
                    Continue to Configure →
                </button>
            </motion.div>
        </div>
    )
}

export default DataSourcePage
