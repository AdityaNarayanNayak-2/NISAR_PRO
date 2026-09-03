import { Routes, Route, useLocation } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { useState } from 'react'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import ConnectionSetup from './components/ConnectionSetup'
import HomePage from './pages/HomePage'
import DocsPage from './pages/DocsPage'
import UseCasesPage from './pages/UseCasesPage'

// App
import AppLayout from './pages/app/AppLayout'
import AppDashboard from './pages/app/AppDashboard'
import { isGatewayConfigured } from './config/api'

import './App.css'

function App() {
  const location = useLocation();
  const isAppDashboard = location.pathname.startsWith('/app');
  const isImmersive = location.pathname === '/use-cases' || location.pathname.startsWith('/docs');
  const hideChrome = isAppDashboard || isImmersive;

  return (
    <>
      {/* Background Effects */}
      {!hideChrome && (
        <>
          <div className="bg-gradient-mesh" />
          <div className="bg-grid" />
        </>
      )}

      {!hideChrome && <Navbar />}

      <AnimatePresence mode="wait">
        <Routes>
          {/* Marketing Pages */}
          <Route path="/" element={<HomePage />} />
          <Route path="/docs" element={<DocsPage />} />
          <Route path="/use-cases" element={<UseCasesPage />} />

          {/* App */}
          <Route path="/app" element={<AppLayout />}>
            <Route index element={<AppDashboard />} />
          </Route>
        </Routes>
      </AnimatePresence>

      {!hideChrome && <Footer />}
    </>
  )
}

export default App