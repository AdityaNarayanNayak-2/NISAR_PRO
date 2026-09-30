import { useEffect, useRef, useState } from 'react'
import { BookOpen, FileText, Search, ChevronRight } from 'lucide-react'
import MarkdownRenderer from './docs-render'
import { docGroups, flatDocs, findDoc, homeAssets } from './docs-md'
import './docs.css'

const theme = {
    bg: '#0A0A0A',
    panel: '#111111',
    border: 'rgba(255,255,255,0.1)',
    textDef: 'rgba(255,255,255,0.85)',
    textMuted: 'rgba(255,255,255,0.55)',
    accent: '#00E5CC',
    mono: '"JetBrains Mono", monospace',
}

function Overview({ onOpen }) {
    return (
        <div className="docs-home">
            <div className="docs-home-hero">
                <div className="docs-home-eyebrow">NISAR PRO // DOCUMENTATION</div>
                <h1 className="docs-home-title">Everything you need to run,<br />operate, and understand NISAR Pro.</h1>
                <p className="docs-home-sub">
                    {flatDocs.length} living documents — the same markdown that ships in the repo's
                    <code className="docs-code-inline">Docs/</code> folder. Pick a guide on the left, or jump into a section below.
                </p>
                <img className="docs-home-hero-img" src={homeAssets.architectureOverview} alt="NISAR Pro platform architecture overview" />
            </div>

            <div className="docs-home-groups">
                {docGroups.map(group => (
                    <section key={group.title} className="docs-home-group">
                        <div className="docs-home-group-head">
                            <h2>{group.title}</h2>
                            <span>{group.items.length} docs</span>
                        </div>
                        <p className="docs-home-group-blurb">{group.blurb}</p>
                        <ul>
                            {group.items.map(item => (
                                <li key={item.id}>
                                    <button type="button" onClick={() => onOpen(item.id)}>
                                        <span><FileText size={14} /></span>
                                        <span>{item.label}</span>
                                        <ChevronRight size={14} />
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </section>
                ))}
            </div>
        </div>
    )
}

export default function DocsPage() {
    const [activeId, setActiveId] = useState('home')
    const [toc, setToc] = useState([])
    const [filter, setFilter] = useState('')
    const articleRef = useRef(null)

    const activeDoc = activeId === 'home' ? null : findDoc(activeId)
    const groups = filter.trim()
        ? [{ title: 'Search results', items: flatDocs.filter(d => d.label.toLowerCase().includes(filter.trim().toLowerCase())) }]
        : docGroups

    useEffect(() => {
        const main = articleRef.current
        if (!main || !activeDoc) {
            setToc([])
            return undefined
        }
        const headings = Array.from(main.querySelectorAll('.doc-md-heading'))
            .filter(h => Number(h.dataset.docDepth) >= 2 && Number(h.dataset.docDepth) <= 3)
        setToc(headings.map(h => ({ id: h.id, text: h.textContent })))

        const links = document.querySelectorAll('.toc-link')
        const observer = new IntersectionObserver(
            entries => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        links.forEach(l => (l.style.color = theme.textMuted))
                        const active = document.querySelector(`.toc-link[href="#${entry.target.id}"]`)
                        if (active) active.style.color = theme.accent
                    }
                })
            },
            { rootMargin: '-15% 0px -75% 0px' }
        )
        headings.forEach(h => observer.observe(h))
        return () => observer.disconnect()
    }, [activeDoc, activeId])

    const open = id => {
        setActiveId(id)
        window.scrollTo({ top: 0 })
    }

    return (
        <div className="docs-shell" style={{ background: theme.bg, color: theme.textDef }}>
            {/* Left sidebar */}
            <nav className="docs-sidebar" aria-label="Documentation navigation">
                <a href="/" className="docs-back">← NISARPro</a>
                <div className="docs-brand"><span style={{ color: theme.accent }}>//</span> Documentation</div>

                <div className="docs-search">
                    <Search size={14} />
                    <input
                        type="text"
                        placeholder="Filter 20 docs…"
                        value={filter}
                        onChange={e => setFilter(e.target.value)}
                        aria-label="Filter documentation"
                    />
                </div>

                {groups.map(group => (
                    <div key={group.title} className="docs-side-group">
                        <div className="docs-side-group-title">{group.title}</div>
                        <ul>
                            {group.items.map(item => (
                                <li key={item.id}>
                                    <button
                                        type="button"
                                        className={activeId === item.id ? 'is-active' : ''}
                                        onClick={() => open(item.id)}
                                    >
                                        {item.label}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}
                <button type="button" className={activeId === 'home' ? 'docs-side-home is-active' : 'docs-side-home'} onClick={() => open('home')}>
                    <BookOpen size={14} /> Docs home
                </button>
            </nav>

            {/* Main content */}
            <main className="docs-main" ref={articleRef}>
                <div className="docs-main-inner">
                    {activeDoc ? (
                        <>
                            <div className="docs-crumb">
                                <button type="button" onClick={() => open('home')}>Documentation</button>
                                <span>/</span>
                                <span>{activeDoc.group}</span>
                            </div>
                            <div className="docs-file">SOURCE <code>{activeDoc.file}</code></div>
                            <MarkdownRenderer src={activeDoc.md} />
                        </>
                    ) : (
                        <Overview onOpen={open} />
                    )}
                </div>
            </main>

            {/* Right TOC */}
            <aside className="docs-toc">
                {toc.length > 0 && (
                    <>
                        <div className="docs-toc-title">On this page</div>
                        <ul>
                            {toc.map(item => (
                                <li key={item.id}>
                                    <a href={`#${item.id}`} className="toc-link" style={{ color: theme.textMuted }}>
                                        {item.text}
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </>
                )}
            </aside>
        </div>
    )
}