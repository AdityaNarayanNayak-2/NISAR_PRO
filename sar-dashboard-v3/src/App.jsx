import { Routes, Route, useLocation } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import HomePage from './pages/HomePage'
import TechnologyPage from './pages/TechnologyPage'
import UseCasesPage from './pages/UseCasesPage'

// App
import AppLayout from './pages/app/AppLayout'
import AppDashboard from './pages/app/AppDashboard'

import './App.css'

function App() {
  const location = useLocation();
  const isAppDashboard = location.pathname.startsWith('/app');

  return (
    <>
      {/* Background Effects */}
      {!isAppDashboard && (
        <>
          <div className="bg-gradient-mesh" />
          <div className="bg-grid" />
        </>
      )}

      {!isAppDashboard && <Navbar />}

      <AnimatePresence mode="wait">
        <Routes>
          {/* Marketing Pages */}
          <Route path="/" element={<HomePage />} />
          <Route path="/technology" element={<TechnologyPage />} />
          <Route path="/use-cases" element={<UseCasesPage />} />

          {/* App */}
          <Route path="/app" element={<AppLayout />}>
            <Route index element={<AppDashboard />} />
          </Route>
        </Routes>
      </AnimatePresence>

      {!isAppDashboard && <Footer />}
    </>
  )
}

export default App
