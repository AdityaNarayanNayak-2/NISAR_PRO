import { Outlet } from 'react-router-dom';
import '../../styles/app-theme.css';

/**
 * Dashboard shell only.
 *
 * The product uses one real app route (`/app`). Profile-specific geometry and
 * controls belong to AppDashboard's Flood and Infrastructure surfaces. The
 * old multi-step workflow shell was unreachable and duplicated state that the
 * gateway-backed dashboard already owns.
 */
function AppLayout() {
    return (
        <div className="app-shell" style={{ minHeight: '100vh' }}>
            <main
                className="app-dashboard-main"
                style={{ width: '100%', height: '100dvh', minHeight: 0, display: 'flex', overflow: 'hidden' }}
            >
                <Outlet />
            </main>
        </div>
    );
}

export default AppLayout;
