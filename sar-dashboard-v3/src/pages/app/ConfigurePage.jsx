import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useWorkflowStore } from '../../store/workflowStore'

const processTypes = [
    { id: 'insar', name: 'InSAR Analysis', description: 'Interferometric analysis for surface deformation' },
    { id: 'polsar', name: 'PolSAR Decomposition', description: 'Polarimetric analysis for land classification' },
    { id: 'slc', name: 'SLC Focusing', description: 'Range-Doppler Algorithm for raw data processing' },
    { id: 'change', name: 'Change Detection', description: 'Multi-temporal coherence change analysis' }
]

const presets = [
    { id: 'quick', name: 'Quick', time: '~5 min', description: 'Lower resolution, faster turnaround' },
    { id: 'balanced', name: 'Balanced', time: '~15 min', description: 'Recommended for most use cases' },
    { id: 'quality', name: 'High Quality', time: '~45 min', description: 'Maximum resolution and accuracy' }
]

function ConfigurePage() {
    const navigate = useNavigate()
    const { config, setConfig, dataSource, location, nextStep } = useWorkflowStore()

    const [processType, setProcessType] = useState(config.processType)
    const [preset, setPreset] = useState(config.preset || 'balanced')

    const handleStartProcessing = () => {
        setConfig({ processType, preset, advancedOptions: {} })
        nextStep()
        navigate('/app/jobs')
    }

    return (
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                style={{ marginBottom: 'var(--space-xl)' }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 'var(--space-xs)' }}>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 600 }}>Configure Processing</h1>
                </div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                    Select processing type and quality settings
                </p>
            </motion.div>

            {/* Processing Type */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                style={{ marginBottom: 'var(--space-2xl)' }}
            >
                <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginBottom: 'var(--space-md)', fontWeight: 500 }}>
                    Processing Type
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-md)' }}>
                    {processTypes.map((type) => (
                        <button
                            key={type.id}
                            onClick={() => setProcessType(type.id)}
                            style={{
                                padding: 'var(--space-lg)',
                                background: processType === type.id ? 'rgba(99, 102, 241, 0.1)' : 'var(--bg-secondary)',
                                border: `1px solid ${processType === type.id ? 'rgba(99, 102, 241, 0.3)' : 'var(--border-subtle)'}`,
                                borderRadius: 'var(--radius-lg)',
                                cursor: 'pointer',
                                textAlign: 'left',
                                transition: 'all 0.15s ease'
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 'var(--space-xs)' }}>
                                <div style={{
                                    width: '16px',
                                    height: '16px',
                                    borderRadius: '50%',
                                    border: `2px solid ${processType === type.id ? 'var(--accent-primary)' : 'var(--border-default)'}`,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    {processType === type.id && (
                                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-primary)' }} />
                                    )}
                                </div>
                                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{type.name}</span>
                            </div>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', margin: 0, paddingLeft: '24px' }}>
                                {type.description}
                            </p>
                        </button>
                    ))}
                </div>
            </motion.div>

            {/* Quality Preset */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                style={{ marginBottom: 'var(--space-2xl)' }}
            >
                <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginBottom: 'var(--space-md)', fontWeight: 500 }}>
                    Quality Preset
                </div>
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: 'var(--space-md)'
                }}>
                    {presets.map((p) => (
                        <button
                            key={p.id}
                            onClick={() => setPreset(p.id)}
                            style={{
                                padding: 'var(--space-lg)',
                                background: preset === p.id ? 'rgba(99, 102, 241, 0.1)' : 'var(--bg-secondary)',
                                border: `1px solid ${preset === p.id ? 'rgba(99, 102, 241, 0.3)' : 'var(--border-subtle)'}`,
                                borderRadius: 'var(--radius-lg)',
                                cursor: 'pointer',
                                textAlign: 'center',
                                transition: 'all 0.15s ease'
                            }}
                        >
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '2px' }}>
                                {p.name}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--accent-primary)', marginBottom: 'var(--space-xs)', fontFamily: 'var(--font-mono)' }}>
                                {p.time}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                                {p.description}
                            </div>
                        </button>
                    ))}
                </div>
            </motion.div>

            {/* Summary */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                style={{
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-lg)',
                    padding: 'var(--space-lg)'
                }}
            >
                <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginBottom: 'var(--space-md)', fontWeight: 500 }}>
                    Summary
                </div>
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    gap: 'var(--space-lg)',
                    marginBottom: 'var(--space-xl)'
                }}>
                    <div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', marginBottom: '4px', textTransform: 'uppercase' }}>Location</div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 500 }}>{location.name || 'Custom Area'}</div>
                    </div>
                    <div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', marginBottom: '4px', textTransform: 'uppercase' }}>Scenes</div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 500 }}>{dataSource.selectedScenes.length} selected</div>
                    </div>
                    <div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', marginBottom: '4px', textTransform: 'uppercase' }}>Processing</div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 500, textTransform: 'capitalize' }}>{processType || '—'}</div>
                    </div>
                    <div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', marginBottom: '4px', textTransform: 'uppercase' }}>Preset</div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 500, textTransform: 'capitalize' }}>{preset}</div>
                    </div>
                </div>

                <button
                    onClick={handleStartProcessing}
                    disabled={!processType}
                    style={{
                        width: '100%',
                        padding: 'var(--space-md)',
                        background: processType ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                        border: 'none',
                        borderRadius: 'var(--radius-md)',
                        color: processType ? 'white' : 'var(--text-tertiary)',
                        cursor: processType ? 'pointer' : 'not-allowed',
                        fontSize: '0.95rem',
                        fontWeight: 500
                    }}
                >
                    Start Processing
                </button>
            </motion.div>
        </div>
    )
}

export default ConfigurePage
