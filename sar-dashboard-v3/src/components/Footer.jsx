import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'

const footerLinks = {
    Product: [
        { label: 'Features', path: '/#features' },
        { label: 'Technology', path: '/technology' },
        { label: 'Demo', path: '/demo' },
    ],
    Resources: [
        { label: 'Documentation', url: 'https://gitlab.com/Aditya-Narayan-Nayak/nisar_pro/-/wikis/home' },
        { label: 'API Reference', url: '#' },
        { label: 'Changelog', url: 'https://gitlab.com/Aditya-Narayan-Nayak/nisar_pro/-/commits/main' },
    ],
    Company: [
        { label: 'About', path: '#' },
        { label: 'Blog', url: '#' },
        { label: 'Contact', url: 'mailto:contact@saranalyzer.io' },
    ]
}

const socialLinks = [
    {
        name: 'GitLab', url: 'https://gitlab.com/Aditya-Narayan-Nayak/nisar_pro', icon: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.65 14.39L12 22.13 1.35 14.39a.84.84 0 0 1-.3-.94l1.22-3.78 2.44-7.51A.42.42 0 0 1 4.82 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.49h8.1l2.44-7.51A.42.42 0 0 1 18.6 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.51L23 13.45a.84.84 0 0 1-.35.94z" />
            </svg>
        )
    },
    {
        name: 'LinkedIn', url: 'https://linkedin.com/in/aditya-narayan-nayak', icon: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
            </svg>
        )
    },
    {
        name: 'GitHub', url: 'https://github.com', icon: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
            </svg>
        )
    }
]

function Footer() {
    return (
        <footer style={{
            background: 'var(--bg-secondary)',
            borderTop: '1px solid var(--border-subtle)',
            paddingTop: 'var(--space-4xl)',
            paddingBottom: 'var(--space-2xl)'
        }}>
            <div className="container">
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: '2fr repeat(3, 1fr)',
                    gap: 'var(--space-3xl)'
                }}>
                    {/* Brand */}
                    <div>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 'var(--space-sm)',
                            marginBottom: 'var(--space-lg)'
                        }}>
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
                                fontSize: '1.1rem'
                            }}>
                                SAR<span style={{ color: 'var(--accent-primary)' }}>Analyzer</span>
                            </span>
                        </div>
                        <p style={{
                            color: 'var(--text-tertiary)',
                            fontSize: '0.9rem',
                            lineHeight: 1.7,
                            maxWidth: '300px'
                        }}>
                            Next-generation SAR processing platform built with Rust for speed,
                            reliability, and production-grade image quality.
                        </p>

                        {/* Social Links */}
                        <div style={{
                            display: 'flex',
                            gap: 'var(--space-md)',
                            marginTop: 'var(--space-xl)'
                        }}>
                            {socialLinks.map(social => (
                                <motion.a
                                    key={social.name}
                                    href={social.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    whileHover={{ y: -3, color: 'var(--accent-primary)' }}
                                    style={{
                                        color: 'var(--text-tertiary)',
                                        transition: 'color var(--transition-fast)'
                                    }}
                                    title={social.name}
                                >
                                    {social.icon}
                                </motion.a>
                            ))}
                        </div>
                    </div>

                    {/* Links */}
                    {Object.entries(footerLinks).map(([category, links]) => (
                        <div key={category}>
                            <h4 style={{
                                fontSize: '0.85rem',
                                fontWeight: 600,
                                textTransform: 'uppercase',
                                letterSpacing: '0.1em',
                                color: 'var(--text-primary)',
                                marginBottom: 'var(--space-lg)'
                            }}>
                                {category}
                            </h4>
                            <ul style={{ listStyle: 'none' }}>
                                {links.map(link => (
                                    <li key={link.label} style={{ marginBottom: 'var(--space-sm)' }}>
                                        {link.path ? (
                                            <Link
                                                to={link.path}
                                                style={{
                                                    color: 'var(--text-tertiary)',
                                                    textDecoration: 'none',
                                                    fontSize: '0.9rem',
                                                    transition: 'color var(--transition-fast)'
                                                }}
                                                onMouseEnter={e => e.target.style.color = 'var(--text-primary)'}
                                                onMouseLeave={e => e.target.style.color = 'var(--text-tertiary)'}
                                            >
                                                {link.label}
                                            </Link>
                                        ) : (
                                            <a
                                                href={link.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                style={{
                                                    color: 'var(--text-tertiary)',
                                                    textDecoration: 'none',
                                                    fontSize: '0.9rem',
                                                    transition: 'color var(--transition-fast)'
                                                }}
                                                onMouseEnter={e => e.target.style.color = 'var(--text-primary)'}
                                                onMouseLeave={e => e.target.style.color = 'var(--text-tertiary)'}
                                            >
                                                {link.label}
                                            </a>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>

                {/* Bottom */}
                <div style={{
                    marginTop: 'var(--space-3xl)',
                    paddingTop: 'var(--space-xl)',
                    borderTop: '1px solid var(--border-subtle)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 'var(--space-md)'
                }}>
                    <p style={{
                        color: 'var(--text-tertiary)',
                        fontSize: '0.85rem'
                    }}>
                        © 2026 SAR Analyzer. Built with 🦀 Rust & ❤️
                    </p>
                    <div style={{
                        display: 'flex',
                        gap: 'var(--space-lg)'
                    }}>
                        {['Privacy', 'Terms', 'Cookies'].map(item => (
                            <a
                                key={item}
                                href="#"
                                style={{
                                    color: 'var(--text-tertiary)',
                                    textDecoration: 'none',
                                    fontSize: '0.85rem',
                                    transition: 'color var(--transition-fast)'
                                }}
                                onMouseEnter={e => e.target.style.color = 'var(--text-primary)'}
                                onMouseLeave={e => e.target.style.color = 'var(--text-tertiary)'}
                            >
                                {item}
                            </a>
                        ))}
                    </div>
                </div>
            </div>
        </footer>
    )
}

export default Footer
