import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Link, useLocation } from 'react-router-dom'
import { Satellite, Rocket, ChevronRight, Github } from 'lucide-react'

const navLinks = [
    { path: '/', label: 'Home' },
    { path: '/use-cases', label: 'Use Cases' },
    { path: '/technology', label: 'Technology' },
    { path: '/demo', label: 'Demo' },
]

function Navbar() {
    const [scrolled, setScrolled] = useState(false)
    const location = useLocation()

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 50)
        window.addEventListener('scroll', handleScroll)
        return () => window.removeEventListener('scroll', handleScroll)
    }, [])

    return (
        <motion.nav
            initial={{ y: -100 }}
            animate={{ y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                zIndex: 1000,
                padding: scrolled ? '1rem 0' : '1.5rem 0',
                background: scrolled ? 'rgba(10, 10, 15, 0.6)' : 'transparent',
                backdropFilter: scrolled ? 'blur(24px)' : 'none',
                WebkitBackdropFilter: scrolled ? 'blur(24px)' : 'none',
                borderBottom: scrolled ? '1px solid rgba(255, 255, 255, 0.05)' : '1px solid transparent',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
        >
            <div className="container" style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                maxWidth: '1400px',
                margin: '0 auto',
                padding: '0 2rem'
            }}>
                {/* Logo */}
                <Link to="/" style={{ textDecoration: 'none' }}>
                    <motion.div
                        whileHover={{ scale: 1.02 }}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px'
                        }}
                    >
                        <div style={{
                            width: '32px',
                            height: '32px',
                            background: 'linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)',
                            borderRadius: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 0 20px rgba(59, 130, 246, 0.3)'
                        }}>
                            <Satellite size={18} color="white" />
                        </div>
                        <span style={{
                            fontFamily: '"JetBrains Mono", monospace',
                            fontWeight: 600,
                            fontSize: '1rem',
                            color: '#ffffff',
                            letterSpacing: '-0.02em',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '2px'
                        }}>
                            SAR<span style={{ color: '#60a5fa' }}>Analyzer</span>
                        </span>
                    </motion.div>
                </Link>

                {/* Desktop Navigation */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '2rem',
                    background: scrolled ? 'transparent' : 'rgba(255,255,255,0.03)',
                    padding: scrolled ? '0' : '8px 24px',
                    borderRadius: '100px',
                    border: scrolled ? 'none' : '1px solid rgba(255,255,255,0.05)',
                    transition: 'all 0.3s ease'
                }}>
                    <ul style={{
                        display: 'flex',
                        listStyle: 'none',
                        gap: '2rem',
                        margin: 0,
                        padding: 0
                    }}>
                        {navLinks.map((link) => (
                            <li key={link.path}>
                                <Link
                                    to={link.path}
                                    style={{
                                        textDecoration: 'none',
                                        fontFamily: '"Inter", sans-serif',
                                        fontSize: '0.85rem',
                                        fontWeight: 500,
                                        color: location.pathname === link.path
                                            ? '#ffffff'
                                            : '#a1a1aa',
                                        transition: 'color 0.2s ease',
                                        position: 'relative'
                                    }}
                                    onMouseEnter={(e) => e.target.style.color = '#ffffff'}
                                    onMouseLeave={(e) => e.target.style.color = location.pathname === link.path ? '#ffffff' : '#a1a1aa'}
                                >
                                    {link.label}
                                </Link>
                            </li>
                        ))}
                    </ul>
                </div>

                {/* Right Actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <a
                        href="https://gitlab.com/Aditya-Narayan-Nayak/nisar_pro"
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            color: '#a1a1aa',
                            textDecoration: 'none',
                            fontSize: '0.85rem',
                            fontWeight: 500,
                            transition: 'color 0.2s ease'
                        }}
                        onMouseEnter={e => e.currentTarget.style.color = '#fff'}
                        onMouseLeave={e => e.currentTarget.style.color = '#a1a1aa'}
                    >
                        <Github size={16} />
                        <span>Source</span>
                    </a>
                    <Link
                        to="/app"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            background: '#ffffff',
                            color: '#000000',
                            padding: '8px 16px',
                            borderRadius: '99px',
                            fontSize: '0.85rem',
                            fontWeight: 600,
                            textDecoration: 'none',
                            transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                            boxShadow: '0 4px 14px 0 rgba(255,255,255,0.1)'
                        }}
                        onMouseEnter={e => {
                            e.currentTarget.style.transform = 'translateY(-1px)';
                            e.currentTarget.style.boxShadow = '0 6px 20px rgba(255,255,255,0.2)';
                        }}
                        onMouseLeave={e => {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = '0 4px 14px 0 rgba(255,255,255,0.1)';
                        }}
                    >
                        Launch App
                        <ChevronRight size={14} strokeWidth={2.5} />
                    </Link>
                </div>
            </div>
        </motion.nav>
    )
}

export default Navbar
