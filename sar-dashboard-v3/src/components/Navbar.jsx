import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'

const navLinks = [
    { path: '/', label: 'Home' },
    { path: '/use-cases', label: 'Use Cases' },
    { path: '/technology', label: 'Technology' },
    { path: '/demo', label: 'Demo' },
]

function Navbar() {
    const [scrolled, setScrolled] = useState(false)
    const [mobileOpen, setMobileOpen] = useState(false)
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
                padding: scrolled ? '0.75rem 0' : '1.5rem 0',
                background: scrolled ? 'var(--glass-bg)' : 'transparent',
                backdropFilter: scrolled ? 'blur(20px)' : 'none',
                borderBottom: scrolled ? '1px solid var(--glass-border)' : 'none',
                transition: 'all var(--transition-base)'
            }}
        >
            <div className="container" style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
            }}>
                {/* Logo */}
                <Link to="/" style={{ textDecoration: 'none' }}>
                    <motion.div
                        whileHover={{ scale: 1.02 }}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 'var(--space-sm)'
                        }}
                    >
                        <div style={{
                            width: '36px',
                            height: '36px',
                            background: 'var(--accent-gradient)',
                            borderRadius: 'var(--radius-md)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '1.2rem'
                        }}>
                            🛰️
                        </div>
                        <span style={{
                            fontFamily: 'var(--font-mono)',
                            fontWeight: 700,
                            fontSize: '1.1rem',
                            color: 'var(--text-primary)',
                            letterSpacing: '-0.01em'
                        }}>
                            SAR<span style={{ color: 'var(--accent-primary)' }}>Analyzer</span>
                        </span>
                    </motion.div>
                </Link>

                {/* Desktop Navigation */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-xl)'
                }}>
                    <ul style={{
                        display: 'flex',
                        listStyle: 'none',
                        gap: 'var(--space-lg)'
                    }}>
                        {navLinks.map((link) => (
                            <li key={link.path}>
                                <Link
                                    to={link.path}
                                    style={{
                                        textDecoration: 'none',
                                        fontFamily: 'var(--font-sans)',
                                        fontSize: '0.9rem',
                                        fontWeight: 500,
                                        color: location.pathname === link.path
                                            ? 'var(--text-primary)'
                                            : 'var(--text-secondary)',
                                        transition: 'color var(--transition-fast)',
                                        position: 'relative'
                                    }}
                                >
                                    {link.label}
                                    {location.pathname === link.path && (
                                        <motion.div
                                            layoutId="nav-indicator"
                                            style={{
                                                position: 'absolute',
                                                bottom: '-6px',
                                                left: 0,
                                                right: 0,
                                                height: '2px',
                                                background: 'var(--accent-gradient)',
                                                borderRadius: 'var(--radius-full)'
                                            }}
                                        />
                                    )}
                                </Link>
                            </li>
                        ))}
                    </ul>

                    {/* CTA Button */}
                    <a
                        href="https://gitlab.com/Aditya-Narayan-Nayak/nisar_pro"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-primary"
                        style={{ padding: 'var(--space-sm) var(--space-lg)' }}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M22.65 14.39L12 22.13 1.35 14.39a.84.84 0 0 1-.3-.94l1.22-3.78 2.44-7.51A.42.42 0 0 1 4.82 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.49h8.1l2.44-7.51A.42.42 0 0 1 18.6 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.51L23 13.45a.84.84 0 0 1-.35.94z" />
                        </svg>
                        GitLab
                    </a>
                </div>
            </div>
        </motion.nav>
    )
}

export default Navbar
