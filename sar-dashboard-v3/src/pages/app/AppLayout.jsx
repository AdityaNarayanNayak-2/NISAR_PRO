import { Outlet, NavLink, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useWorkflowStore } from '../../store/workflowStore'
import '../../styles/app-theme.css'

const workflowSteps = [
    { id: 1, path: '/app/select', label: 'Select Area' },
    { id: 2, path: '/app/data', label: 'Data Source' },
    { id: 3, path: '/app/configure', label: 'Configure' },
    { id: 4, path: '/app/jobs', label: 'Processing' },
    { id: 5, path: '/app/results', label: 'Results' },
]

function AppLayout() {
    const location = useLocation()
    const { isStepComplete } = useWorkflowStore()

    const isOnDashboard = location.pathname === '/app'
    const currentStepIndex = workflowSteps.findIndex(s => s.path === location.pathname)

    return (
        <div
            className="app-shell"
            style={{ minHeight: '100vh', paddingTop: '70px' }}
        >
            {/* Workflow Top Bar — hidden on dashboard */}
            {!isOnDashboard && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{
                        background: 'rgba(255,255,255,0.85)',
                        backdropFilter: 'blur(12px)',
                        borderBottom: '1px solid #e8e8e8',
                        padding: '14px 0',
                        position: 'sticky',
                        top: '70px',
                        zIndex: 50
                    }}
                >
                    <div style={{
                        maxWidth: '1200px',
                        margin: '0 auto',
                        padding: '0 32px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                    }}>
                        {/* Breadcrumb */}
                        <NavLink
                            to="/app"
                            style={{
                                fontSize: '0.85rem',
                                color: '#0078d4',
                                textDecoration: 'none',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                flexShrink: 0
                            }}
                        >
                            ← Dashboard
                        </NavLink>

                        {/* Pill Stepper - centered */}
                        <div className="app-stepper">
                            {workflowSteps.map((step, index) => {
                                const isActive = location.pathname === step.path
                                const isCompleted = currentStepIndex > index || isStepComplete(index + 1)

                                return (
                                    <div
                                        key={step.id}
                                        style={{ display: 'flex', alignItems: 'center' }}
                                    >
                                        <NavLink
                                            to={step.path}
                                            className={`app-step-item${isActive ? ' active' : ''}${isCompleted ? ' completed' : ''}`}
                                        >
                                            <div className="app-step-num">
                                                {isCompleted ? '✓' : step.id}
                                            </div>
                                            {step.label}
                                        </NavLink>
                                        {index < workflowSteps.length - 1 && (
                                            <div className={`app-step-connector${isCompleted ? ' done' : ''}`} />
                                        )}
                                    </div>
                                )
                            })}
                        </div>

                        {/* Spacer so breadcrumb doesn't fight stepper */}
                        <div style={{ width: '100px' }} />
                    </div>
                </motion.div>
            )}

            {/* Main Content */}
            <main style={{
                maxWidth: '1200px',
                margin: '0 auto',
                padding: isOnDashboard ? '40px 32px' : '36px 32px',
                minHeight: 'calc(100vh - 130px)'
            }}>
                <Outlet />
            </main>
        </div>
    )
}

export default AppLayout
