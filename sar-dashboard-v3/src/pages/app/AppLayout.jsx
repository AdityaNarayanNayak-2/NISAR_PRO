import { Outlet, NavLink, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useWorkflowStore } from '../../store/workflowStore'

const workflowSteps = [
    { id: 1, path: '/app/select', label: 'Select Area', description: 'Define area of interest' },
    { id: 2, path: '/app/data', label: 'Data Source', description: 'Choose SAR mission' },
    { id: 3, path: '/app/configure', label: 'Configure', description: 'Processing options' },
    { id: 4, path: '/app/jobs', label: 'Processing', description: 'Monitor progress' },
    { id: 5, path: '/app/results', label: 'Results', description: 'View & export' },
]

function AppLayout() {
    const location = useLocation()
    const { isStepComplete } = useWorkflowStore()

    // Check if on dashboard
    const isOnDashboard = location.pathname === '/app'

    // Get current step index
    const currentStepIndex = workflowSteps.findIndex(s => s.path === location.pathname)

    return (
        <div style={{
            minHeight: '100vh',
            paddingTop: '70px',
            background: 'var(--bg-primary)'
        }}>
            {/* Top Workflow Bar - Only show when in workflow, not on dashboard */}
            {!isOnDashboard && (
                <div style={{
                    background: 'var(--bg-secondary)',
                    borderBottom: '1px solid var(--border-subtle)',
                    padding: 'var(--space-md) 0'
                }}>
                    <div className="container">
                        {/* Breadcrumb */}
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 'var(--space-sm)',
                            marginBottom: 'var(--space-md)',
                            fontSize: '0.8rem'
                        }}>
                            <NavLink
                                to="/app"
                                style={{
                                    color: 'var(--text-tertiary)',
                                    textDecoration: 'none',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                }}
                            >
                                ← Dashboard
                            </NavLink>
                            <span style={{ color: 'var(--text-tertiary)' }}>/</span>
                            <span style={{ color: 'var(--text-primary)' }}>New Analysis</span>
                        </div>

                        {/* Step Progress */}
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 'var(--space-xs)'
                        }}>
                            {workflowSteps.map((step, index) => {
                                const isActive = location.pathname === step.path
                                const isCompleted = currentStepIndex > index || isStepComplete(index + 1)
                                const isPast = currentStepIndex > index

                                return (
                                    <div
                                        key={step.id}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            flex: index < workflowSteps.length - 1 ? 1 : 'none'
                                        }}
                                    >
                                        <NavLink
                                            to={step.path}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 'var(--space-sm)',
                                                padding: 'var(--space-xs) var(--space-sm)',
                                                borderRadius: 'var(--radius-sm)',
                                                textDecoration: 'none',
                                                background: isActive ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                                                border: isActive ? '1px solid rgba(99, 102, 241, 0.2)' : '1px solid transparent',
                                                transition: 'all 0.15s ease'
                                            }}
                                        >
                                            <div style={{
                                                width: '24px',
                                                height: '24px',
                                                borderRadius: '50%',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontSize: '0.75rem',
                                                fontWeight: 600,
                                                background: isCompleted
                                                    ? 'var(--accent-primary)'
                                                    : isActive
                                                        ? 'var(--bg-tertiary)'
                                                        : 'var(--bg-tertiary)',
                                                color: isCompleted
                                                    ? 'white'
                                                    : isActive
                                                        ? 'var(--text-primary)'
                                                        : 'var(--text-tertiary)',
                                                border: isActive && !isCompleted ? '2px solid var(--accent-primary)' : 'none'
                                            }}>
                                                {isCompleted ? '✓' : step.id}
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                <span style={{
                                                    fontSize: '0.8rem',
                                                    fontWeight: isActive ? 600 : 400,
                                                    color: isActive ? 'var(--text-primary)' : isPast ? 'var(--text-secondary)' : 'var(--text-tertiary)'
                                                }}>
                                                    {step.label}
                                                </span>
                                            </div>
                                        </NavLink>

                                        {/* Connector line */}
                                        {index < workflowSteps.length - 1 && (
                                            <div style={{
                                                flex: 1,
                                                height: '2px',
                                                background: isPast ? 'var(--accent-primary)' : 'var(--border-subtle)',
                                                margin: '0 var(--space-sm)',
                                                borderRadius: '1px'
                                            }} />
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* Main Content */}
            <main style={{
                padding: 'var(--space-xl) 0',
                minHeight: 'calc(100vh - 140px)'
            }}>
                <div className="container">
                    <Outlet />
                </div>
            </main>
        </div>
    )
}

export default AppLayout
