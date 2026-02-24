import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useWorkflowStore } from '../../store/workflowStore'

const processTypes = [
    { id: 'insar', name: 'InSAR Analysis', description: 'Surface deformation mapping via interferometry' },
    { id: 'polsar', name: 'PolSAR Decomposition', description: 'Land cover classification via polarimetry' },
    { id: 'slc', name: 'SLC Focusing', description: 'Raw data focusing using Range-Doppler Algorithm' },
    { id: 'change', name: 'Change Detection', description: 'Multi-temporal coherence-based change analysis' }
]

const presets = [
    { id: 'quick', name: 'Quick', time: '~5 min', desc: 'Faster, lower resolution' },
    { id: 'balanced', name: 'Balanced', time: '~15 min', desc: 'Recommended for most uses' },
    { id: 'quality', name: 'High Quality', time: '~45 min', desc: 'Maximum accuracy' }
]

function ConfigurePage() {
    const navigate = useNavigate()
    const { config, setConfig, dataSource, location, nextStep } = useWorkflowStore()
    const [processType, setProcessType] = useState(config.processType)
    const [preset, setPreset] = useState(config.preset || 'balanced')

    return (
        <div style={{ maxWidth: '880px' }}>
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: '28px' }}>
                <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#000', letterSpacing: '-0.02em', marginBottom: '6px' }}>Configure Processing</h1>
                <p style={{ color: '#666', fontSize: '0.9rem' }}>Select your processing algorithm and quality preset</p>
            </motion.div>

            {/* Process Types */}
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} style={{ marginBottom: '24px' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#999', marginBottom: '12px' }}>Processing Type</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                    {processTypes.map(t => (
                        <button key={t.id} onClick={() => setProcessType(t.id)}
                            style={{
                                padding: '20px', textAlign: 'left',
                                background: processType === t.id ? '#e8f3fc' : '#fff',
                                border: `1px solid ${processType === t.id ? '#b3d6f4' : '#e8e8e8'}`,
                                borderRadius: '16px', cursor: 'pointer',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                                transition: 'all 0.2s ease'
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                                <div style={{
                                    width: '16px', height: '16px', borderRadius: '50%', flexShrink: 0,
                                    border: `2px solid ${processType === t.id ? '#0078d4' : '#ccc'}`,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                }}>
                                    {processType === t.id && <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#0078d4' }} />}
                                </div>
                                <span style={{ fontWeight: 700, color: '#1a1a1a', fontSize: '0.95rem' }}>{t.name}</span>
                            </div>
                            <p style={{ fontSize: '0.82rem', color: '#777', margin: 0, paddingLeft: '26px' }}>{t.description}</p>
                        </button>
                    ))}
                </div>
            </motion.div>

            {/* Presets */}
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.13 }} style={{ marginBottom: '24px' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#999', marginBottom: '12px' }}>Quality Preset</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                    {presets.map(p => (
                        <button key={p.id} onClick={() => setPreset(p.id)}
                            style={{
                                padding: '18px', textAlign: 'center',
                                background: preset === p.id ? '#e8f3fc' : '#fff',
                                border: `1px solid ${preset === p.id ? '#b3d6f4' : '#e8e8e8'}`,
                                borderRadius: '16px', cursor: 'pointer',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                                transition: 'all 0.2s ease'
                            }}
                        >
                            <div style={{ fontWeight: 700, color: '#1a1a1a', marginBottom: '3px' }}>{p.name}</div>
                            <div style={{ fontSize: '0.78rem', color: '#0078d4', fontFamily: 'JetBrains Mono, monospace', marginBottom: '4px' }}>{p.time}</div>
                            <div style={{ fontSize: '0.78rem', color: '#999' }}>{p.desc}</div>
                        </button>
                    ))}
                </div>
            </motion.div>

            {/* Summary & Launch */}
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}
                style={{ background: '#fff', borderRadius: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.07)', padding: '26px 28px' }}
            >
                <div style={{ fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#999', marginBottom: '18px' }}>Summary</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '24px' }}>
                    {[
                        { label: 'Location', val: location.name || 'Custom Area' },
                        { label: 'Scenes', val: `${dataSource.selectedScenes.length} selected` },
                        { label: 'Processing', val: processType || '—' },
                        { label: 'Preset', val: preset }
                    ].map(item => (
                        <div key={item.label}>
                            <div style={{ fontSize: '0.7rem', color: '#bbb', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>{item.label}</div>
                            <div style={{ fontWeight: 600, color: '#1a1a1a', fontSize: '0.9rem', textTransform: 'capitalize' }}>{item.val}</div>
                        </div>
                    ))}
                </div>
                <button
                    onClick={() => { setConfig({ processType, preset, advancedOptions: {} }); nextStep(); navigate('/app/jobs') }}
                    disabled={!processType}
                    style={{
                        width: '100%', padding: '13px',
                        background: processType ? '#0078d4' : '#e8e8e8',
                        border: 'none', borderRadius: '12px',
                        color: processType ? '#fff' : '#aaa',
                        cursor: processType ? 'pointer' : 'not-allowed',
                        fontSize: '0.95rem', fontWeight: 600,
                        transition: 'background 0.2s ease'
                    }}
                >
                    Start Processing
                </button>
            </motion.div>
        </div>
    )
}

export default ConfigurePage
