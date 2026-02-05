import { Routes, Route } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import HomePage from './pages/HomePage'
import TechnologyPage from './pages/TechnologyPage'
import DemoPage from './pages/DemoPage'
import UseCasesPage from './pages/UseCasesPage'

// App workflow pages
import AppLayout from './pages/app/AppLayout'
import AppDashboard from './pages/app/AppDashboard'
import SelectLocationPage from './pages/app/SelectLocationPage'
import DataSourcePage from './pages/app/DataSourcePage'
import ConfigurePage from './pages/app/ConfigurePage'
import JobsPage from './pages/app/JobsPage'
import ResultsPage from './pages/app/ResultsPage'

import './App.css'

function App() {
  return (
    <>
      {/* Background Effects */}
      <div className="bg-gradient-mesh" />
      <div className="bg-grid" />

      <Navbar />

      <AnimatePresence mode="wait">
        <Routes>
          {/* Marketing Pages */}
          <Route path="/" element={<HomePage />} />
          <Route path="/technology" element={<TechnologyPage />} />
          <Route path="/demo" element={<DemoPage />} />
          <Route path="/use-cases" element={<UseCasesPage />} />

          {/* App Workflow */}
          <Route path="/app" element={<AppLayout />}>
            <Route index element={<AppDashboard />} />
            <Route path="select" element={<SelectLocationPage />} />
            <Route path="data" element={<DataSourcePage />} />
            <Route path="configure" element={<ConfigurePage />} />
            <Route path="jobs" element={<JobsPage />} />
            <Route path="results" element={<ResultsPage />} />
          </Route>
        </Routes>
      </AnimatePresence>

      <Footer />
    </>
  )
}

export default App
