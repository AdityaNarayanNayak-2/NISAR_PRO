import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useWorkflowStore } from '../../store/workflowStore'
import { format, subDays } from 'date-fns'

const missions = [
    { id: 'nisar', name: 'NISAR', band: 'L + S Band', org: 'NASA-ISRO' },
    { id: 'sentinel1', name: 'Sentinel-1', band: 'C-Band', org: 'ESA' },
    { id: 'iceye', name: 'ICEYE', band: 'X-Band', org: 'Commercial' },
    { id: 'capella', name: 'Capella', band: 'X-Band', org: 'Commercial' },
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
    const [dateRange, setDateRange] = useState({ start: format(subDays(new Date(), 30), 'yyyy-MM-dd'), end: format(new Date(), 'yyyy-MM-dd') })
    const [selectedScenes, setSelectedScenes] = useState(dataSource.selectedScenes)

    const filtered = mockScenes.filter(s => !selectedMission || s.mission === selectedMission)

    const toggleScene = (scene) => {
        setSelectedScenes(prev => prev.find(s => s.id === scene.id) ? prev.filter(s => s.id !== scene.id) : [...prev, scene])
    }

    const handleContinue = () => {
        setDataSource({ mission: selectedMission, dateRange, selectedScenes })
        nextStep(); navigate('/app/configure')
    }

    return (
        <div style={{ maxWidth: '960px' }}>
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: '28px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                    <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#000', letterSpacing: '-0.02em' }}>Data Source</h1>
                    {location.name && (
                        <span style={{ padding: '3px 12px', background: '#e8f3fc', border: '1px solid #b3d6f4', borderRadius: '99px', fontSize: '0.78rem', color: '#0078d4', fontWeight: 500 }}>
                            {location.name}
                        </span>
                    )}
                </div>
                <p style={{ color: '#666', fontSize: '0.9rem' }}>Select a mission and choose scenes for your area</p>
            </motion.div>

            {/* Mission Cards */}
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} style={{ marginBottom: '20px' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#999', marginBottom: '12px' }}>Mission</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                    {missions.map(m => (
                        <button
                            key={m.id}
                            onClick={() => setSelectedMission(m.id)}
                            style={{
                                padding: '18px 16px', textAlign: 'left',
                                background: selectedMission === m.id ? '#e8f3fc' : '#fff',
                                border: `1px solid ${selectedMission === m.id ? '#b3d6f4' : '#e8e8e8'}`,
                                borderRadius: '16px', cursor: 'pointer',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                                transition: 'all 0.2s ease'
                            }}
                        >
                            <div style={{ fontWeight: 700, color: '#1a1a1a', marginBottom: '3px', fontSize: '0.95rem' }}>{m.name}</div>
                            <div style={{ fontSize: '0.75rem', color: '#888' }}>{m.band}</div>
                            <div style={{ fontSize: '0.7rem', color: '#bbb', marginTop: '2px' }}>{m.org}</div>
                        </button>
                    ))}
                </div>
            </motion.div>

            {/* Date Range */}
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}
                style={{ background: '#fff', borderRadius: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.07)', padding: '22px 24px', marginBottom: '20px' }}
            >
                <div style={{ fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#999', marginBottom: '14px' }}>Date Range</div>
                <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                    {['start', 'end'].map((key, i) => (
                        <div key={key}>
                            <div style={{ fontSize: '0.75rem', color: '#aaa', marginBottom: '5px' }}>{key === 'start' ? 'From' : 'To'}</div>
                            <input type="date" value={dateRange[key]} onChange={e => setDateRange(p => ({ ...p, [key]: e.target.value }))}
                                style={{ padding: '9px 14px', background: '#f7f9fb', border: '1px solid #e8e8e8', borderRadius: '10px', color: '#1a1a1a', fontSize: '0.875rem', fontFamily: 'inherit', outline: 'none' }}
                            />
                        </div>
                    ))}
                </div>
            </motion.div>

            {/* Scenes Table */}
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#999' }}>
                        Available Scenes ({filtered.length})
                    </div>
                    <div style={{ fontSize: '0.82rem', color: '#0078d4', fontWeight: 500 }}>{selectedScenes.length} selected</div>
                </div>

                <div style={{ background: '#fff', borderRadius: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.07)', overflow: 'hidden' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '36px 1fr 100px 80px 110px', gap: '12px', padding: '12px 24px', background: '#f7f9fb', fontSize: '0.72rem', fontWeight: 600, color: '#999', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #f0f0f0' }}>
                        <div></div><div>Scene ID</div><div>Mode</div><div>Size</div><div>Date</div>
                    </div>
                    {filtered.map((scene) => {
                        const sel = !!selectedScenes.find(s => s.id === scene.id)
                        return (
                            <div key={scene.id} onClick={() => toggleScene(scene)}
                                style={{ display: 'grid', gridTemplateColumns: '36px 1fr 100px 80px 110px', gap: '12px', padding: '14px 24px', borderBottom: '1px solid #f5f5f5', cursor: 'pointer', background: sel ? '#f0f7ff' : 'transparent', transition: 'background 0.15s ease', alignItems: 'center' }}
                            >
                                <div>
                                    <div style={{ width: '18px', height: '18px', borderRadius: '5px', border: `2px solid ${sel ? '#0078d4' : '#d0d0d0'}`, background: sel ? '#0078d4' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.65rem', fontWeight: 700 }}>
                                        {sel && '✓'}
                                    </div>
                                </div>
                                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.8rem', color: '#333' }}>{scene.id}</div>
                                <div style={{ fontSize: '0.85rem', color: '#666' }}>{scene.mode}</div>
                                <div style={{ fontSize: '0.85rem', color: '#888' }}>{scene.size}</div>
                                <div style={{ fontSize: '0.8rem', color: '#aaa' }}>{scene.date}</div>
                            </div>
                        )
                    })}
                </div>
            </motion.div>

            <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={handleContinue} disabled={selectedScenes.length === 0}
                    style={{ padding: '11px 28px', background: selectedScenes.length > 0 ? '#0078d4' : '#e8e8e8', border: 'none', borderRadius: '12px', color: selectedScenes.length > 0 ? '#fff' : '#aaa', cursor: selectedScenes.length > 0 ? 'pointer' : 'not-allowed', fontSize: '0.9rem', fontWeight: 500, transition: 'background 0.2s ease' }}
                >
                    Continue →
                </button>
            </div>
        </div>
    )
}

export default DataSourcePage
