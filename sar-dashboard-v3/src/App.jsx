import { Routes, Route } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import { AnimatePresence } from 'framer-motion'

const HomePage = lazy(() => import('./pages/marketing/RunLayerLanding'))
const DocsPage = lazy(() => import('./pages/DocsPage'))
const Workspace = lazy(() => import('./pages/app/Workspace'))
const InsarPaused = lazy(() => import('./pages/app/InsarPaused'))
const ReportPage = lazy(() => import('./pages/app/ReportPage'))

import './App.css'

function App() {
  return (
    <>
      <Suspense fallback={<div className="route-loading" aria-live="polite">Loading NISAR Pro…</div>}>
        <AnimatePresence mode="wait">
          <Routes>
            {/* Marketing Pages */}
            <Route path="/" element={<HomePage />} />
            <Route path="/docs" element={<DocsPage />} />

            {/* App */}
            <Route path="/app" element={<Workspace />} />
            <Route path="/app/insar" element={<InsarPaused />} />
            <Route path="/app/report/:id" element={<ReportPage />} />
          </Routes>
        </AnimatePresence>
      </Suspense>

    </>
  )
}

export default App
