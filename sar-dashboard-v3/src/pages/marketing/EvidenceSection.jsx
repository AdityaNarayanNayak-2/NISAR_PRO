import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useScroll, useTransform } from 'framer-motion'
import { flushSync } from 'react-dom'
import BrowserFrame from './BrowserFrame'

const TABS = [
    {
        key: 'flood',
        tab: 'FLOOD MONITORING',
        label: 'NISAR PRO',
        url: '/workspace/flood-upper-kolab',
        badge: 'ACTIVE 24 JUL 2026 · BASELINE 1 JAN 2026',
        inspect: 'Inspect the flood workspace',
        src: '/landing/flood-workspace-full.png',
        alt: 'Captured NISAR Pro flood monitoring workspace for Upper Kolab Reservoir — 145.45 acres new inundation',
        chips: ['IMAGE · MASK · REPORT · GEOMETRY', 'NEW INUNDATION 145.45 AC', '204 REGIONS DETECTED', '1786.9 AC PERMANENT WATER', 'CHANGE THRESHOLD −3.00 DB'],
    },
    {
        key: 'infra',
        tab: 'INFRASTRUCTURE',
        label: 'NISAR PRO',
        url: '/workspace/infra-indravati-dam',
        badge: 'DEFORMATION · COHERENCE · PERSISTENT SCATTERERS',
        inspect: 'Inspect the infrastructure workspace',
        src: '/landing/infra-monitoring-result.png',
        alt: 'Captured NISAR Pro infrastructure monitoring workspace for Indravati Dam',
        chips: ['DEFORMATION · COHERENCE · PERSISTENT SCATTERERS', 'INDRAVATI DAM, NABARANGPUR, ODISHA'],
    },
]

const VT_NAME = 'landing-inspect-zoom'

function useReducedMotion() {
    const [reduced, setReduced] = useState(false)
    useEffect(() => {
        if (typeof window === 'undefined' || !window.matchMedia) return
        const query = window.matchMedia('(prefers-reduced-motion: reduce)')
        const sync = () => setReduced(query.matches)
        sync()
        query.addEventListener('change', sync)
        return () => query.removeEventListener('change', sync)
    }, [])
    return reduced
}

export default function EvidenceSection() {
    const sectionRef = useRef(null)
    const screenRef = useRef(null)
    const modalRef = useRef(null)
    const inspectRef = useRef(null)
    const [active, setActive] = useState(0)
    const [open, setOpen] = useState(false)
    const reduced = useReducedMotion()

    const { scrollYProgress } = useScroll({ target: sectionRef, offset: ['start end', 'end start'] })
    const drift = useTransform(scrollYProgress, [0, 1], [reduced ? 0 : 10, reduced ? 0 : -10])

    const tab = TABS[active]

    const morph = () => {
        const screenImg = screenRef.current && screenRef.current.querySelector('.landing-bf-shot img')
        const swap = (el, on) => el && (on ? el.style.setProperty('view-transition-name', VT_NAME) : el.style.removeProperty('view-transition-name'))
        const update = () => {
            swap(screenImg, false)
            flushSync(() => setOpen(true))
            swap(modalRef.current && modalRef.current.querySelector('.landing-bf-zoom'), true)
        }
        if (document.startViewTransition && !reduced) {
            swap(screenImg, true)
            const transition = document.startViewTransition(update)
            transition.finished.catch(() => {}).finally(() => {
                swap(modalRef.current && modalRef.current.querySelector('.landing-bf-zoom'), false)
                swap(screenRef.current && screenRef.current.querySelector('.landing-bf-shot img'), false)
            })
        } else {
            update()
        }
    }

    useEffect(() => {
        const onKey = (event) => { if (event.key === 'Escape') { setOpen(false); inspectRef.current && inspectRef.current.focus() } }
        if (open) { document.addEventListener('keydown', onKey); modalRef.current && modalRef.current.focus() }
        return () => document.removeEventListener('keydown', onKey)
    }, [open])

    const onTabsKeyDown = (event) => {
        const last = TABS.length - 1
        let next = null
        if (event.key === 'ArrowRight') next = (active + 1) % TABS.length
        else if (event.key === 'ArrowLeft') next = (active - 1 + TABS.length) % TABS.length
        else if (event.key === 'Home') next = 0
        else if (event.key === 'End') next = last
        if (next !== null) {
            event.preventDefault()
            setActive(next)
            const buttons = sectionRef.current && sectionRef.current.querySelectorAll('[role="tab"]')
            buttons && buttons[next] && buttons[next].focus()
        }
    }

    return (
        <section className="landing-evidence" id="evidence" ref={sectionRef} aria-labelledby="landing-evidence-title">
            <div className="landing-section-inner">
                <div className="landing-section-intro landing-section-intro-split">
                    <div className="landing-label">THE ACTUAL WORKSPACE</div>
                    <div>
                        <h2 id="landing-evidence-title">A product should show its work.</h2>
                        <p>Every result begins as an observation and ends as evidence someone else can inspect. The map is only one part of that chain.</p>
                    </div>
                </div>

                <div className="landing-bf-tabs" role="tablist" aria-label="Workspace examples" onKeyDown={onTabsKeyDown}>
                    {TABS.map((item, i) => (
                        <button key={item.key} type="button" role="tab" aria-selected={i === active} aria-controls="landing-bf-panel" tabIndex={i === active ? 0 : -1}
                            onClick={() => setActive(i)} className={`landing-bf-tab${i === active ? ' is-active' : ''}`}>
                            <span className="landing-bf-tab-index">0{i + 1}</span>{item.tab}
                        </button>
                    ))}
                </div>

                <BrowserFrame id="landing-bf-panel" label={tab.label} url={tab.url} badge={tab.badge} inspectLabel="INSPECT" onInspect={() => { inspectRef.current = sectionRef.current && sectionRef.current.querySelector('.landing-bf-inspect'); morph('open') }} chips={tab.chips}>
                    <div className="landing-bf-shot">
                        <AnimatePresence mode="wait" initial={false}>
                            <motion.div key={tab.key}
                                className="landing-bf-shade"
                                initial={{ opacity: 0, scale: 1.03 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                                transition={{ duration: .5, ease: [0.22, 1, 0.36, 1] }}
                                style={reduced ? undefined : { y: drift }}>
                                <img src={tab.src} alt={tab.alt} loading={active ? 'lazy' : 'eager'} fetchPriority={active ? undefined : 'high'} decoding="async" />
                            </motion.div>
                        </AnimatePresence>
                    </div>
                </BrowserFrame>

                <motion.button type="button" className="landing-inline-link" onClick={() => { morph('open') }} aria-haspopup="dialog">View the captured workspace closer</motion.button>

                <AnimatePresence>
                    {open && (
                        <motion.div className="landing-inspect" role="dialog" aria-modal="true" aria-label={tab.inspect}
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: .25 }}
                            ref={modalRef} tabIndex={-1} onMouseDown={(event) => { if (event.target === event.currentTarget) { setOpen(false); inspectRef.current && inspectRef.current.focus() } }}>
                            <div className="landing-inspect-card">
                                <div className="landing-inspect-bar"><span className="landing-inspect-label">{tab.label} · {tab.url}</span><button type="button" className="landing-inspect-close" onClick={() => { setOpen(false); inspectRef.current && inspectRef.current.focus() }}>CLOSE</button></div>
                                <img className="landing-bf-zoom" src={tab.src} alt={tab.alt} />
                                <div className="landing-inspect-caption">{tab.chips.join('   ·   ')}</div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </section>
    )
}