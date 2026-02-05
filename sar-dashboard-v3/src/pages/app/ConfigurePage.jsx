import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useWorkflowStore } from '../../store/workflowStore'

const processTypes = [
    {
        id: 'insar',
        name: 'InSAR Analysis',
        icon: '🎯',
        description: 'Interferometric SAR for deformation mapping',
        useCases: ['Subsidence', 'Earthquakes', 'Volcanoes']
    },
    {
        id: 'polsar',
        name: 'PolSAR',
        icon: '🔬',
        description: 'Polarimetric decomposition for land classification',
        useCases: ['Land Cover', 'Biomass', 'Crop Types']
    },
    {
        id: 'slc',
        name: 'SLC Focusing',
        icon: '📡',
        description: 'Range-Doppler Algorithm with RCMC',
        useCases: ['Raw to SLC', 'Custom Focus', 'Quality Check']
    },
    {
        id: 'change',
        name: 'Change Detection',
        icon: '🔄',
        description: 'Multi-temporal analysis for change mapping',
        useCases: ['Urban Growth', 'Disaster', 'Mining']
    }
]

const presets = [
    { id: 'quick', name: 'Quick', icon: '⚡', time: '~5 min', description: 'Lower resolution, faster processing' },
    { id: 'balanced', name: 'Balanced', icon: '⚖️', time: '~15 min', description: 'Recommended for most use cases' },
    { id: 'quality', name: 'Quality', icon: '💎', time: '~45 min', description: 'Maximum resolution and accuracy' },
]

function ConfigurePage() {
    const navigate = useNavigate()
    const { config, setConfig, dataSource, location, nextStep } = useWorkflowStore()

    const [processType, setProcessType] = useState(config.processType)
    const [preset, setPreset] = useState(config.preset || 'balanced')
    const [showAdvanced, setShowAdvanced] = useState(false)

    const handleStartProcessing = () => {
        setConfig({ processType, preset, advancedOptions: {} })
        nextStep()
        navigate('/app/jobs')
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
                    marginBottom: 'var(--space-sm)',
                    flexWrap: 'wrap'
                }}>
                    <span style={{
                        padding: 'var(--space-xs) var(--space-sm)',
                        background: 'var(--accent-gradient)',
                        borderRadius: 'var(--radius-full)',
                        fontSize: '0.7rem',
                        fontFamily: 'var(--font-mono)'
                    }}>
                        STEP 3
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
                    {dataSource.selectedScenes.length > 0 && (
                        <span style={{
                            padding: 'var(--space-xs) var(--space-sm)',
                            background: 'rgba(6, 182, 212, 0.1)',
                            border: '1px solid rgba(6, 182, 212, 0.3)',
                            borderRadius: 'var(--radius-full)',
                            fontSize: '0.7rem',
                            fontFamily: 'var(--font-mono)',
                            color: '#06b6d4'
                        }}>
                            🛰️ {dataSource.selectedScenes.length} scenes
                        </span>
                    )}
                </div>
                <h1 style={{ marginBottom: 'var(--space-sm)' }}>
                    Configure <span className="text-gradient">Processing</span>
                </h1>
                <p style={{ color: 'var(--text-secondary)' }}>
                    Select processing type and quality preset
                </p>
            </motion.div>

            {/* Process Types */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                style={{ marginBottom: 'var(--space-2xl)' }}
            >
                <h3 style={{ fontSize: '1rem', marginBottom: 'var(--space-md)' }}>
                    Processing Type
                </h3>
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                    gap: 'var(--space-md)'
                }}>
                    {processTypes.map((type) => (
                        <motion.button
                            key={type.id}
                            whileHover={{ y: -3 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => setProcessType(type.id)}
                            style={{
                                padding: 'var(--space-xl)',
                                background: processType === type.id
                                    ? 'rgba(99, 102, 241, 0.15)'
                                    : 'var(--bg-secondary)',
                                border: `2px solid ${processType === type.id ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
                                borderRadius: 'var(--radius-lg)',
                                cursor: 'pointer',
                                textAlign: 'left'
                            }}
                        >
                            <div style={{
                                fontSize: '2rem',
                                marginBottom: 'var(--space-md)'
                            }}>
                                {type.icon}
                            </div>
                            <div style={{
                                fontWeight: 600,
                                color: 'var(--text-primary)',
                                marginBottom: 'var(--space-xs)',
                                fontSize: '1.1rem'
                            }}>
                                {type.name}
                            </div>
                            <div style={{
                                fontSize: '0.85rem',
                                color: 'var(--text-secondary)',
                                marginBottom: 'var(--space-md)'
                            }}>
                                {type.description}
                            </div>
                            <div style={{
                                display: 'flex',
                                gap: 'var(--space-xs)',
                                flexWrap: 'wrap'
                            }}>
                                {type.useCases.map(use => (
                                    <span key={use} style={{
                                        padding: '2px 8px',
                                        background: 'var(--bg-tertiary)',
                                        borderRadius: 'var(--radius-sm)',
                                        fontSize: '0.7rem',
                                        color: 'var(--text-tertiary)',
                                        fontFamily: 'var(--font-mono)'
                                    }}>
                                        {use}
                                    </span>
                                ))}
                            </div>
                        </motion.button>
                    ))}
                </div>
            </motion.div>

            {/* Presets */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                style={{ marginBottom: 'var(--space-2xl)' }}
            >
                <h3 style={{ fontSize: '1rem', marginBottom: 'var(--space-md)' }}>
                    Quality Preset
                </h3>
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: 'var(--space-md)'
                }}>
                    {presets.map((p) => (
                        <motion.button
                            key={p.id}
                            whileHover={{ y: -2 }}
                            onClick={() => setPreset(p.id)}
                            style={{
                                padding: 'var(--space-lg)',
                                background: preset === p.id
                                    ? 'rgba(99, 102, 241, 0.15)'
                                    : 'var(--bg-secondary)',
                                border: `2px solid ${preset === p.id ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
                                borderRadius: 'var(--radius-lg)',
                                cursor: 'pointer',
                                textAlign: 'center'
                            }}
                        >
                            <div style={{ fontSize: '1.5rem', marginBottom: 'var(--space-sm)' }}>
                                {p.icon}
                            </div>
                            <div style={{
                                fontWeight: 600,
                                color: 'var(--text-primary)',
                                marginBottom: '2px'
                            }}>
                                {p.name}
                            </div>
                            <div style={{
                                fontSize: '0.75rem',
                                color: 'var(--accent-primary)',
                                fontFamily: 'var(--font-mono)',
                                marginBottom: 'var(--space-xs)'
                            }}>
                                {p.time}
                            </div>
                            <div style={{
                                fontSize: '0.75rem',
                                color: 'var(--text-tertiary)'
                            }}>
                                {p.description}
                            </div>
                        </motion.button>
                    ))}
                </div>
            </motion.div>

            {/* Advanced Options Toggle */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="card"
                style={{ marginBottom: 'var(--space-2xl)' }}
            >
                <button
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        width: '100%',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--text-primary)'
                    }}
                >
                    <span style={{ fontWeight: 500 }}>Advanced Options</span>
                    <span style={{ transform: showAdvanced ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                        ▼
                    </span>
                </button>

                {showAdvanced && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        style={{ marginTop: 'var(--space-lg)' }}
                    >
                        <p style={{
                            color: 'var(--text-tertiary)',
                            fontSize: '0.85rem',
                            fontStyle: 'italic'
                        }}>
                            Advanced RDA parameters, RCMC settings, and output format configuration
                            coming soon. Default values optimized for best results.
                        </p>
                    </motion.div>
                )}
            </motion.div>

            {/* Summary & Start */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="card"
                style={{
                    background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(139, 92, 246, 0.05))',
                    border: '1px solid rgba(99, 102, 241, 0.3)'
                }}
            >
                <h3 style={{ marginBottom: 'var(--space-md)' }}>Summary</h3>
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                    gap: 'var(--space-md)',
                    marginBottom: 'var(--space-xl)'
                }}>
                    <div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginBottom: '2px' }}>
                            Location
                        </div>
                        <div style={{ fontWeight: 500 }}>{location.name || 'Custom Area'}</div>
                    </div>
                    <div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginBottom: '2px' }}>
                            Scenes
                        </div>
                        <div style={{ fontWeight: 500 }}>{dataSource.selectedScenes.length} selected</div>
                    </div>
                    <div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginBottom: '2px' }}>
                            Processing
                        </div>
                        <div style={{ fontWeight: 500, textTransform: 'capitalize' }}>{processType || '-'}</div>
                    </div>
                    <div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginBottom: '2px' }}>
                            Preset
                        </div>
                        <div style={{ fontWeight: 500, textTransform: 'capitalize' }}>{preset}</div>
                    </div>
                </div>

                <button
                    onClick={handleStartProcessing}
                    disabled={!processType}
                    className="btn btn-primary"
                    style={{
                        width: '100%',
                        justifyContent: 'center',
                        padding: 'var(--space-lg)',
                        fontSize: '1rem',
                        opacity: processType ? 1 : 0.5,
                        cursor: processType ? 'pointer' : 'not-allowed'
                    }}
                >
                    🚀 Start Processing
                </button>
            </motion.div>
        </div>
    )
}

export default ConfigurePage
