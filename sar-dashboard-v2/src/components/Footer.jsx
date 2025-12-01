import React from 'react';
import '../App.css';

const Footer = () => {
    return (
        <footer className="footer" id="contact">
            <div className="footer-container">
                <div className="footer-column">
                    <h4>SAR ANALYZER</h4>
                    <p>Advanced Earth Observation Platform</p>
                    <p>© 2025 SAR Analyzer Systems</p>
                </div>
                <div className="footer-column">
                    <h4>SOLUTIONS</h4>
                    <ul>
                        <li><a href="#">Maritime Surveillance</a></li>
                        <li><a href="#">Deforestation Monitoring</a></li>
                        <li><a href="#">Disaster Response</a></li>
                        <li><a href="#">Urban Planning</a></li>
                    </ul>
                </div>
                <div className="footer-column">
                    <h4>DATA SOURCES</h4>
                    <ul>
                        <li><a href="#">ESA Copernicus</a></li>
                        <li><a href="#">ISRO Bhoonidhi</a></li>
                        <li><a href="#">NASA Earthdata</a></li>
                    </ul>
                </div>
                <div className="footer-column">
                    <h4>LEGAL</h4>
                    <ul>
                        <li><a href="#">Privacy Policy</a></li>
                        <li><a href="#">Terms of Service</a></li>
                    </ul>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
