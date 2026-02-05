import { Outlet, NavLink, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useWorkflowStore } from '../../store/workflowStore'

const steps = [
    { id: 1, path: '/app', label: 'Dashboard', icon: '🏠' },
    { id: 2, path: '/app/select', label: 'Location', icon: '📍' },
    { id: 3, path: '/app/data', label: 'Data Source', icon: '🛰️' },
    { id: 4, path: '/app/configure', label: 'Configure', icon: '⚙️' },
    { id: 5, path: '/app/jobs', label: 'Processing', icon: '⚡' },
    { id: 6, path: '/app/results', label: 'Results', icon: '📊' },
]

function AppLayout() {
    const location = useLocation()
    const { currentStep, isStepComplete } = useWorkflowStore()

    return (
        <div style={{
            display: 'flex',
            minHeight: '100vh',
            paddingTop: '70px'
        }}>
            {/* Sidebar */}
            <motion.aside
                initial={{ x: -280 }}
                animate={{ x: 0 }}
                style={{
                    width: '260px',
                    background: 'var(--bg-secondary)',
                    borderRight: '1px solid var(--border-subtle)',
                    padding: 'var(--space-lg)',
                    position: 'fixed',
                    top: '70px',
                    left: 0,
                    bottom: 0,
                    overflowY: 'auto',
                    zIndex: 100
                }}
            >
                {/* App Title */}
                <div style={{ marginBottom: 'var(--space-xl)' }}>
                    <h3 style={{
                        fontSize: '1rem',
                        color: 'var(--text-primary)',
                        marginBottom: 'var(--space-xs)'
                    }}>
                        SAR Analyzer
                    </h3>
                    <span style={{
                        fontSize: '0.75rem',
                        color: 'var(--text-tertiary)',
                        fontFamily: 'var(--font-mono)'
                    }}>
                        Processing Workflow
                    </span>
                </div>

                {/* Navigation */}
                <nav style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
                    {steps.map((step, index) => {
                        const isActive = location.pathname === step.path
                        const isComplete = index > 0 && isStepComplete(index)

                        return (
                            <NavLink
                                key={step.path}
                                to={step.path}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 'var(--space-md)',
                                    padding: 'var(--space-md)',
                                    borderRadius: 'var(--radius-md)',
                                    textDecoration: 'none',
                                    background: isActive ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                                    border: isActive ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid transparent',
                                    transition: 'all var(--transition-fast)'
                                }}
                            >
                                <span style={{
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: 'var(--radius-sm)',
                                    background: isActive ? 'var(--accent-gradient)' : 'var(--bg-tertiary)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '1rem'
                                }}>
                                    {isComplete ? '✓' : step.icon}
                                </span>
                                <div>
                                    <div style={{
                                        fontSize: '0.85rem',
                                        fontWeight: isActive ? 600 : 400,
                                        color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)'
                                    }}>
                                        {step.label}
                                    </div>
                                    {index > 0 && (
                                        <div style={{
                                            fontSize: '0.7rem',
                                            color: 'var(--text-tertiary)',
                                            fontFamily: 'var(--font-mono)'
                                        }}>
                                            Step {index}
                                        </div>
                                    )}
                                </div>
                            </NavLink>
                        )
                    })}
                </nav>

                {/* Quick Actions */}
                <div style={{
                    marginTop: 'var(--space-2xl)',
                    padding: 'var(--space-md)',
                    background: 'var(--bg-tertiary)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-subtle)'
                }}>
                    <div style={{
                        fontSize: '0.75rem',
                        color: 'var(--text-tertiary)',
                        marginBottom: 'var(--space-sm)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em'
                    }}>
                        Quick Actions
                    </div>
                    <NavLink
                        to="/app/select"
                        style={{
                            display: 'block',
                            padding: 'var(--space-sm)',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: '0.85rem',
                            color: 'var(--accent-primary)',
                            textDecoration: 'none'
                        }}
                    >
                        + New Analysis
                    </NavLink>
                </div>
            </motion.aside>

            {/* Main Content */}
            <main style={{
                flex: 1,
                marginLeft: '260px',
                padding: 'var(--space-xl)',
                minHeight: 'calc(100vh - 70px)'
            }}>
                <Outlet />
            </main>
        </div>
    )
}

export default AppLayout
