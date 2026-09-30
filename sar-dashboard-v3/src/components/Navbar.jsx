import { useEffect, useState } from 'react'
import { Github, Menu, X } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'

const navLinks = [
    { path: '/docs', label: 'Documentation' },
]

const landingAnchors = [
    { href: '#evidence', label: 'The evidence' },
    { href: '#features', label: 'Approaches' },
    { href: '#process', label: 'The run' },
]

export default function Navbar() {
    const [scrolled, setScrolled] = useState(false)
    const [menuOpen, setMenuOpen] = useState(false)
    const location = useLocation()

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 24)
        window.addEventListener('scroll', handleScroll, { passive: true })
        return () => window.removeEventListener('scroll', handleScroll)
    }, [])

    const isHome = location.pathname === '/'
    const isEditorial = isHome

    return (
        <header className={`site-header${scrolled ? ' is-scrolled' : ''}${isEditorial ? ' is-editorial' : ''}`}>
            <div className="site-header-inner">
                <Link className="site-brand" to="/" aria-label="NISAR Pro home">
                    <span>NISAR</span><b>PRO</b>
                </Link>

                <nav className={`site-nav${menuOpen ? ' is-open' : ''}`} aria-label="Primary navigation">
                    {isHome && landingAnchors.map(({ href, label }) => (
                        <a key={href} href={href} onClick={() => setMenuOpen(false)}>{label}</a>
                    ))}
                    {navLinks.map(({ path, label }) => (
                        <Link className={location.pathname === path ? 'is-active' : ''} key={path} to={path} onClick={() => setMenuOpen(false)}>{label}</Link>
                    ))}
                    <a href="https://gitlab.com/Aditya-Narayan-Nayak/nisar_pro" target="_blank" rel="noopener noreferrer">Source <Github size={14} aria-hidden="true" /></a>
                    <Link className="site-nav-launch" to="/app">Open workspace <span aria-hidden="true">↗</span></Link>
                </nav>

                <button className="site-menu-button" type="button" aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-expanded={menuOpen} onClick={() => setMenuOpen(value => !value)}>
                    {menuOpen ? <X size={19} /> : <Menu size={19} />}
                </button>
            </div>
        </header>
    )
}
