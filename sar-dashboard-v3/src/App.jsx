import { Routes, Route, useLocation } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import { AnimatePresence } from 'framer-motion'
import Navbar from './components/Navbar'
import Footer from './components/Footer'

const HomePage = lazy(() => import('./pages/marketing/LandingPage'))
const DocsPage = lazy(() => import('./pages/DocsPage'))
const AppLayout = lazy(() => import('./pages/app/AppLayout'))
const AppDashboard = lazy(() => import('./pages/app/AppDashboard'))

import './App.css'

function App() {
  const location = useLocation();
  const isAppDashboard = location.pathname.startsWith('/app');
  const isImmersive = location.pathname.startsWith('/docs');
  const hideChrome = isAppDashboard || isImmersive;

  return (
    <>
      {!hideChrome && <Navbar />}

      <Suspense fallback={<div className="route-loading" aria-live="polite">LOADING NISAR PRO...</div>}>
        <AnimatePresence mode="wait">
          <Routes>
            {/* Marketing Pages */}
            <Route path="/" element={<HomePage />} />
<Route path="/docs" element={<DocsPage />} />

            {/* App */}
            <Route path="/app" element={<AppLayout />}>
              <Route index element={<AppDashboard />} />
            </Route>
          </Routes>
        </AnimatePresence>
      </Suspense>

      {!hideChrome && <Footer />}
    </>
  )
}

export default App
