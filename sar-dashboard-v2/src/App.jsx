import React, { useState, useEffect } from 'react';
import './App.css';

const mockJobs = [
    { id: 1, name: "Sentinel-1 Scan 001", status: "Completed", progress: 100 },
    { id: 2, name: "Sentinel-1 Scan 002", status: "Processing", progress: 65 },
    { id: 3, name: "Sentinel-1 Scan 003", status: "Queued", progress: 0 },
];

function App() {
    const [jobs, setJobs] = useState(mockJobs);

    useEffect(() => {
        const interval = setInterval(() => {
            setJobs(prevJobs =>
                prevJobs.map(job => {
                    if (job.status === 'Processing' && job.progress < 100) {
                        return { ...job, progress: job.progress + 5 };
                    } else if (job.status === 'Processing' && job.progress >= 100) {
                        return { ...job, status: 'Completed', progress: 100 };
                    }
                    return job;
                })
            );
        }, 2000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="dashboard">
            <header className="header">
                <h1>SAR Processing Dashboard</h1>
                <p>Sentinel-1 Anomaly Detection System</p>
            </header>
            <main className="main">
                <section className="jobs">
                    <h2>Active Jobs</h2>
                    <div className="job-list">
                        {jobs.map(job => (
                            <div key={job.id} className="job-card">
                                <h3>{job.name}</h3>
                                <p>Status: <span className={`status ${job.status.toLowerCase()}`}>{job.status}</span></p>
                                <div className="progress-bar">
                                    <div className="progress-fill" style={{ width: `${job.progress}%` }}></div>
                                </div>
                                <p>{job.progress}%</p>
                            </div>
                        ))}
                    </div>
                </section>
            </main>
        </div>
    );
}

export default App;
