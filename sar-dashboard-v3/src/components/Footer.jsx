import { ArrowUpRight, Github, Linkedin } from 'lucide-react'
import { Link } from 'react-router-dom'

const footerGroups = [
    {
        label: 'Product',
        links: [
            { label: 'Capabilities', path: '/#features' },
            { label: 'Read the docs', path: '/docs' },
            { label: 'Open workspace', path: '/app' },
        ],
    },
    {
        label: 'Learn',
        links: [
            { label: 'Documentation', path: '/docs' },
            { label: 'Project repository', url: 'https://gitlab.com/Aditya-Narayan-Nayak/nisar_pro' },
            { label: 'Change history', url: 'https://gitlab.com/Aditya-Narayan-Nayak/nisar_pro/-/commits/main' },
        ],
    },
]

export default function Footer() {
    return (
        <footer className="site-footer">
            <div className="site-footer-inner">
                <div className="site-footer-top">
                    <div className="site-footer-brand">
                        <div className="site-brand site-brand-footer"><span>NISAR</span><b>PRO</b></div>
                        <p>Open tooling for turning SAR observations into reviewable geospatial evidence.</p>
                        <div className="site-footer-socials">
                            <a href="https://gitlab.com/Aditya-Narayan-Nayak/nisar_pro" target="_blank" rel="noopener noreferrer" aria-label="NISAR Pro on GitLab"><Github size={16} /></a>
                            <a href="https://linkedin.com/in/aditya-narayan-nayak" target="_blank" rel="noopener noreferrer" aria-label="NISAR Pro on LinkedIn"><Linkedin size={16} /></a>
                        </div>
                    </div>
                    <div className="site-footer-links">
                        {footerGroups.map(({ label, links }) => <div key={label}><h2>{label}</h2><ul>{links.map(link => <li key={link.label}>{link.path ? <Link to={link.path}>{link.label}</Link> : <a href={link.url} target="_blank" rel="noopener noreferrer">{link.label}<ArrowUpRight size={13} /></a>}</li>)}</ul></div>)}
                    </div>
                </div>
                <div className="site-footer-bottom"><span>© 2026 NISAR Pro</span><span>Built for careful observation, not spectacle.</span></div>
            </div>
        </footer>
    )
}
