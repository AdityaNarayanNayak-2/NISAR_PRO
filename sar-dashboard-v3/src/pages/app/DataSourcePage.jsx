import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useWorkflowStore } from '../../store/workflowStore'
import { format, subDays } from 'date-fns'

const missions = [
    { id: 'nisar', name: 'NISAR', org: 'NASA-ISRO', band: 'L + S Band', status: 'Active' },
    { id: 'sentinel1', name: 'Sentinel-1', org: 'ESA', band: 'C-Band', status: 'Active' },
    { id: 'iceye', name: 'ICEYE', org: 'Commercial', band: 'X-Band', status: 'Active' },
    { id: 'capella', name: 'Capella', org: 'Commercial', band: 'X-Band', status: 'Active' },
]

const mockScenes = [
    { id: 'S1A_IW_SLC_20260201', mission: 'sentinel1', date: '2026-02-01', size: '1.2 GB', mode: 'IW' },
    { id: 'S1A_IW_SLC_20260125', mission: 'sentinel1', date: '2026-01-25', size: '1.1 GB', mode: 'IW' },
    { id: 'NISAR_L1_SLC_20260130', mission: 'nisar', date: '2026-01-30', size: '2.4 GB', mode: 'ScanSAR' },
    { id: 'NISAR_L1_SLC_20260118', mission: 'nisar', date: '2026-01-18', size: '2.3 GB', mode: 'ScanSAR' },
    { id: 'ICEYE_X2_SLC_20260128', mission: 'iceye', date: '2026-01-28', size: '0.8 GB', mode: 'Spotlight' },
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

    const filteredScenes = mockScenes.filter(s => !selectedMission || s.mission === selectedMission)

    const toggleScene = (scene) => {
        if (selectedScenes.find(s => s.id === scene.id)) {
            setSelectedScenes(selectedScenes.filter(s => s.id !== scene.id))
        } else {
            setSelectedScenes([...selectedScenes, scene])
        }
    }

    const handleContinue = () => {
        setDataSource({ mission: selectedMission, dateRange, selectedScenes })
        nextStep()
        navigate('/app/configure')
    }

    return (
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                style={{ marginBottom: 'var(--space-xl)' }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 'var(--space-xs)' }}>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 600 }}>Select Data Source</h1>
                    {location.name && (
                        <span style={{
                            padding: '4px 10px',
                            background: 'rgba(99, 102, 241, 0.1)',
                            border: '1px solid rgba(99, 102, 241, 0.2)',
                            borderRadius: 'var(--radius-full)',
                            fontSize: '0.75rem',
                            color: 'var(--accent-primary)'
                        }}>
                            {location.name}
                        </span>
                    )}
                </div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                    Choose a SAR mission and select available scenes
                </p>
            </motion.div>

            {/* Mission Selection */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                style={{ marginBottom: 'var(--space-xl)' }}
            >
                <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginBottom: 'var(--space-md)', fontWeight: 500 }}>
                    Mission
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-md)' }}>
                    {missions.map((mission) => (
                        <button
                            key={mission.id}
                            onClick={() => setSelectedMission(mission.id)}
                            style={{
                                padding: 'var(--space-lg)',
                                background: selectedMission === mission.id ? 'rgba(99, 102, 241, 0.1)' : 'var(--bg-secondary)',
                                border: `1px solid ${selectedMission === mission.id ? 'rgba(99, 102, 241, 0.3)' : 'var(--border-subtle)'}`,
                                borderRadius: 'var(--radius-lg)',
                                cursor: 'pointer',
                                textAlign: 'left',
                                transition: 'all 0.15s ease'
                            }}
                        >
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                                {mission.name}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                                {mission.band}
                            </div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                                {mission.org}
                            </div>
                        </button>
                    ))}
                </div>
            </motion.div>

            {/* Date Range */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                style={{
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-lg)',
                    padding: 'var(--space-lg)',
                    marginBottom: 'var(--space-xl)'
                }}
            >
                <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginBottom: 'var(--space-md)', fontWeight: 500 }}>
                    Date Range
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-lg)', alignItems: 'center' }}>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-tertiary)', marginBottom: '4px' }}>From</label>
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
                                fontSize: '0.85rem'
                            }}
                        />
                    </div>
                    <span style={{ color: 'var(--text-tertiary)', marginTop: '18px' }}>→</span>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-tertiary)', marginBottom: '4px' }}>To</label>
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
                                fontSize: '0.85rem'
                            }}
                        />
                    </div>
                </div>
            </motion.div>

            {/* Scenes Table */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)' }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', fontWeight: 500 }}>
                        Available Scenes ({filteredScenes.length})
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--accent-primary)' }}>
                        {selectedScenes.length} selected
                    </div>
                </div>

                <div style={{
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-lg)',
                    overflow: 'hidden'
                }}>
                    {/* Header */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: '40px 1fr 100px 80px 100px',
                        gap: 'var(--space-md)',
                        padding: 'var(--space-md) var(--space-lg)',
                        background: 'var(--bg-tertiary)',
                        fontSize: '0.75rem',
                        color: 'var(--text-tertiary)',
                        fontWeight: 500
                    }}>
                        <div></div>
                        <div>Scene ID</div>
                        <div>Mode</div>
                        <div>Size</div>
                        <div>Date</div>
                    </div>

                    {/* Rows */}
                    {filteredScenes.map((scene, i) => {
                        const isSelected = selectedScenes.find(s => s.id === scene.id)
                        return (
                            <div
                                key={scene.id}
                                onClick={() => toggleScene(scene)}
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: '40px 1fr 100px 80px 100px',
                                    gap: 'var(--space-md)',
                                    padding: 'var(--space-md) var(--space-lg)',
                                    borderTop: '1px solid var(--border-subtle)',
                                    cursor: 'pointer',
                                    background: isSelected ? 'rgba(99, 102, 241, 0.05)' : 'transparent',
                                    transition: 'background 0.15s ease'
                                }}
                            >
                                <div>
                                    <div style={{
                                        width: '18px',
                                        height: '18px',
                                        borderRadius: '4px',
                                        border: `2px solid ${isSelected ? 'var(--accent-primary)' : 'var(--border-default)'}`,
                                        background: isSelected ? 'var(--accent-primary)' : 'transparent',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: 'white',
                                        fontSize: '0.7rem'
                                    }}>
                                        {isSelected && '✓'}
                                    </div>
                                </div>
                                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>{scene.id}</div>
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{scene.mode}</div>
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{scene.size}</div>
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>{scene.date}</div>
                            </div>
                        )
                    })}
                </div>
            </motion.div>

            {/* Continue */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                style={{ marginTop: 'var(--space-xl)', display: 'flex', justifyContent: 'flex-end' }}
            >
                <button
                    onClick={handleContinue}
                    disabled={selectedScenes.length === 0}
                    style={{
                        padding: 'var(--space-md) var(--space-xl)',
                        background: selectedScenes.length > 0 ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                        border: 'none',
                        borderRadius: 'var(--radius-md)',
                        color: selectedScenes.length > 0 ? 'white' : 'var(--text-tertiary)',
                        cursor: selectedScenes.length > 0 ? 'pointer' : 'not-allowed',
                        fontSize: '0.9rem',
                        fontWeight: 500
                    }}
                >
                    Continue →
                </button>
            </motion.div>
        </div>
    )
}

export default DataSourcePage
