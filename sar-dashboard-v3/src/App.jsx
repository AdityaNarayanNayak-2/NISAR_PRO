import { Routes, Route } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import HomePage from './pages/HomePage'
import TechnologyPage from './pages/TechnologyPage'
import DemoPage from './pages/DemoPage'
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
          <Route path="/" element={<HomePage />} />
          <Route path="/technology" element={<TechnologyPage />} />
          <Route path="/demo" element={<DemoPage />} />
        </Routes>
      </AnimatePresence>

      <Footer />
    </>
  )
}

export default App
