import React from 'react';
import Spline from '@splinetool/react-spline';
import { motion } from 'framer-motion';
import '../App.css';

const Hero = () => {
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
                        <div className="search-icon">⌕</div>
                        <input
                            type="text"
                            placeholder="Search coordinates, scene ID, or location..."
                            className="hero-search-input"
                        />
                    </div>
                </motion.div>
            </div>
        </section>
    );
};

export default Hero;
