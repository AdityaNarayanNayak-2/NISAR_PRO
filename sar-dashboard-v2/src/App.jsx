import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import LiveFeed from './components/LiveFeed';
import Footer from './components/Footer';
import './App.css';

const mockJobs = [
    { id: 1, name: "SENTINEL-1A-IW-GRD", status: "Completed", progress: 100 },
    { id: 2, name: "SENTINEL-1B-IW-GRD", status: "Processing", progress: 65 },
    { id: 3, name: "SENTINEL-1A-IW-SLC", status: "Queued", progress: 0 },
    { id: 4, name: "NISAR-S-BAND-TEST", status: "Queued", progress: 0 },
    { id: 5, name: "SENTINEL-1B-EW-GRD", status: "Processing", progress: 12 },
    { id: 6, name: "SENTINEL-1A-WV-SLC", status: "Completed", progress: 100 },
];

function App() {
    const [jobs, setJobs] = useState(mockJobs);

    const handleSearchResults = (newJobs) => {
        // Prepend new search results to the job list
        setJobs(prev => [...newJobs, ...prev]);
        // Scroll to live feed
        document.getElementById('live-data').scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        const interval = setInterval(() => {
            setJobs(prevJobs =>
                prevJobs.map(job => {
                    if (job.status === 'Processing' && job.progress < 100) {
                        return { ...job, progress: Math.min(job.progress + 1, 100) };
                    } else if (job.status === 'Processing' && job.progress >= 100) {
                        return { ...job, status: 'Completed', progress: 100 };
                    }
                    return job;
                })
            );
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="app-container">
            <Navbar />
            <Hero onSearchResults={handleSearchResults} />
            <LiveFeed jobs={jobs} />
            <Footer />
        </div>
    );
}

export default App;
