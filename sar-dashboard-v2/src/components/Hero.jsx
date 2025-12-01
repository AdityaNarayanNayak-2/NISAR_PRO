import React, { useState } from 'react';
import Spline from '@splinetool/react-spline';
import { motion } from 'framer-motion';
import '../App.css';

const Hero = ({ onSearchResults }) => {
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSearch = async (e) => {
        if (e.key === 'Enter') {
            setLoading(true);
            try {
                // Default to Bangalore if query is empty for demo
                const lat = 12.97;
                const lon = 77.59;

                const response = await fetch(`/ api / search ? lat = ${lat}& lon=${lon} `);
                const data = await response.json();

                // Transform ESA data to our Job format
                const jobs = data.map((scene, index) => ({
                    id: index + 100,
                    name: `${scene.platform} -${scene.date.substring(0, 10)} `,
                    status: 'Queued',
                    progress: 0
                }));

                onSearchResults(jobs);
            } catch (error) {
                console.error("Search failed:", error);
            } finally {
                setLoading(false);
            }
        }
    };

    return (
        <section className="hero-section" id="home">
            <div className="spline-background">
                {/* Using a high-quality Earth/Space scene */}
                <Spline scene="https://prod.spline.design/6Wq1Q7YGyM-iab9i/scene.splinecode" />
            </div>

            <div className="hero-overlay">
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 1, delay: 0.5 }}
                    className="hero-content"
                >
                    <h1>GLOBAL RADAR INTELLIGENCE</h1>
                    <p>REAL-TIME SENTINEL-1 & NISAR S-BAND ANALYSIS</p>

                    <div className="hero-search-container">
                        <div className="search-icon">
                            {loading ? <span className="loader">↻</span> : '⌕'}
                        </div>
                        <input
                            type="text"
                            placeholder="Press Enter to search (Demo: Bangalore)"
                            className="hero-search-input"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={handleSearch}
                        />
                    </div>
                </motion.div>
            </div>
        </section>
    );
};

export default Hero;
