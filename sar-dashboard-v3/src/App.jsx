import { useState } from 'react'
import './App.css'
import Navbar from './components/Navbar'
import Hero from './components/Hero'
import LiveFeed from './components/LiveFeed'
import Footer from './components/Footer'

function App() {
  const [jobs, setJobs] = useState([
    { id: 1, name: 'NISAR_L1_SLC_2024_001', status: 'Completed', progress: 100 },
    { id: 2, name: 'S1A_IW_SLC_20241115', status: 'Processing', progress: 67 },
    { id: 3, name: 'NISAR_L2_INSAR_2024_002', status: 'Queued', progress: 0 },
  ]);

  const handleSearchResults = (newJobs) => {
    setJobs(newJobs);
  };

  return (
    <>
      <Navbar />
      <Hero onSearchResults={handleSearchResults} />
      <LiveFeed jobs={jobs} />
      <Footer />
    </>
  )
}

export default App
