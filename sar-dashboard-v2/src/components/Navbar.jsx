import React, { useState, useEffect } from 'react';
import '../App.css';

const Navbar = () => {
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            const isScrolled = window.scrollY > 50;
            if (isScrolled !== scrolled) {
                setScrolled(isScrolled);
            }
        };

        document.addEventListener('scroll', handleScroll);
        return () => {
            document.removeEventListener('scroll', handleScroll);
        };
    }, [scrolled]);

    return (
        <nav className={`navbar ${scrolled ? 'scrolled' : ''}`}>
            <div className="navbar-container">
                <div className="navbar-logo">
                    SAR ANALYZER
                </div>
                <ul className="navbar-menu">
                    <li><a href="#home">HOME</a></li>
                    <li><a href="#missions">MISSIONS</a></li>
                    <li><a href="#live-data">LIVE DATA</a></li>
                    <li><a href="#api">API</a></li>
                    <li><a href="#contact">CONTACT</a></li>
                </ul>
                <div className="navbar-action">
                    <button className="btn-primary">LAUNCH CONSOLE</button>
                </div>
            </div>
        </nav>
    );
};

export default Navbar;
