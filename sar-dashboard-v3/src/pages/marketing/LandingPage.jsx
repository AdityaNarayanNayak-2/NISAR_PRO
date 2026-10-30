import { createElement, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowDownRight, ArrowUpRight, Activity, Building2, Eye, FileCheck2, Waves } from 'lucide-react'
import { Link } from 'react-router-dom'
import StoryScroll from './StoryScroll'
import ProcessVideo from './ProcessVideo'
import EvidenceSection from './EvidenceSection'
import ScrollProgress from './ScrollProgress'
import './landing-page.css'

const pathways = [
    { label: '01 / FLOOD MONITORING', title: 'Find the change in the water.', copy: 'Compare baseline and active GCOV observations, separate new inundation from permanent water, and leave the mapped extent ready for review.', icon: Waves, tone: 'teal' },
    { label: '02 / INFRASTRUCTURE MONITORING', title: 'Stay close to the asset.', copy: 'Move from a broad scene to deformation, coherence, and persistent-scatterer evidence around the dam, bridge, or reservoir that matters.', icon: Building2, tone: 'ochre' },
    { label: '03 / OPEN PROCESSING', title: 'Keep the method visible.', copy: 'Follow the input, processor run, geospatial layers, geometry, and report instead of accepting an unexplained answer.', icon: FileCheck2, tone: 'ink' },
]

const LEGACY_WORKFLOW = [
    ['01', 'Baseline', 'Start from the reference acquisition — 1 Jan 2026 GCOV over Upper Kolab.'],
    ['02', 'Active acquisition', 'Add the 24 Jul 2026 observation on the same 10 m grid (WGS84 geographic output).'],
    ['03', 'Classified extent', 'Log-ratio + Otsu change, permanent water separated from new inundation.'],
    ['04', 'Report', 'Map, mask, geometry, and statistics kept together for review.'],
]

const pageVariants = { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
const visibleWorkflow = [
    ['01', 'Observe', 'Start from real NISAR L2 GCOV acquisitions and document band, mode, date, and coverage.'],
    ['02', 'Align', 'Bring comparable L-band and S-band observations onto a common UTM Zone 45N lattice.'],
    ['03', 'Classify', 'Separate persistent water, new water, receded water, and stable non-water with auditable thresholds.'],
    ['04', 'Review', 'Keep masks, geometry, dates, statistics, and limitations together in one report.'],
]

const HERO_VIDEO_SRC = '/landing/nisar-pro-hero.mp4'

function HeroRecording() {
    const [videoState, setVideoState] = useState('checking')
    const [reducedMotion, setReducedMotion] = useState(false)

    useEffect(() => {
        if (typeof window === 'undefined' || !window.matchMedia) return
        const query = window.matchMedia('(prefers-reduced-motion: reduce)')
        const sync = () => setReducedMotion(query.matches)
        sync()
        query.addEventListener('change', sync)
        return () => query.removeEventListener('change', sync)
    }, [])

    useEffect(() => {
        if (typeof window === 'undefined' || !window.fetch) return
        let active = true
        fetch(HERO_VIDEO_SRC, { method: 'HEAD' })
            .then(response => {
                if (!active) return
                const type = response.headers.get('content-type') || ''
                setVideoState(response.ok && type.startsWith('video/') ? 'ready' : 'missing')
            })
            .catch(() => {
                if (active) setVideoState('missing')
            })
        return () => { active = false }
    }, [])

    const showVideo = videoState === 'ready' && !reducedMotion

    return (
        <>
            {showVideo ? (
                <video
                    className="landing-event-video"
                    controls
                    muted
                    playsInline
                    preload="metadata"
                    poster="/landing/flood-workspace-full.png"
                    aria-label="Recorded NISAR Pro flood analysis session for Upper Kolab Reservoir"
                >
                    <source src={HERO_VIDEO_SRC} type="video/mp4" />
                </video>
            ) : (
                <img
                    className="landing-event-poster"
                    src="/landing/flood-analysis-result.png"
                    alt="NISAR Pro flood analysis result showing mapped inundation and report statistics"
                    loading="lazy"
                />
            )}
        </>
    )
}

function EarthEventHero() {
    return (
        <div className="landing-hero-visual" aria-label="Earth context transitioning to a real NISAR Pro flood analysis result">
            <div className="landing-earth-stage">
                <img className="landing-earth-image landing-earth-day" src="/earth.jpg" alt="Earth surface map showing global geographic context" />
                <img className="landing-earth-image landing-earth-night" src="/earth_night.png" alt="Earth at night showing the global observation context" />
                <div className="landing-earth-vignette" aria-hidden="true" />
                <div className="landing-earth-label"><span className="landing-live-dot" /> GLOBAL CONTEXT <span>·</span> NISAR OBSERVATION</div>
                <div className="landing-earth-marker" aria-label="Upper Kolab Dam analysis location"><span /><b>UPPER KOLAB / ODISHA</b><small>18.79° N · 82.60° E</small></div>
                <div className="landing-earth-rule" aria-hidden="true" />
            </div>
            <motion.figure className="landing-event-window" initial={{ opacity: 0, y: 28, scale: .97 }} whileInView={{ opacity: 1, y: 0, scale: 1 }} viewport={{ once: true, amount: .35 }} transition={{ duration: .75, ease: [0.22, 1, 0.36, 1] }}>
                <div className="landing-event-window-top"><span>OBSERVED EVENT / FLOOD EXTENT</span><span>24 JUL 2026</span></div>
                <HeroRecording />
                <figcaption><span>UPPER KOLAB RESERVOIR</span><strong>145.45 ACRES NEW INUNDATION</strong></figcaption>
            </motion.figure>
        </div>
    )
}

function LegacyHero() {
    return (
        <section className="landing-hero" aria-labelledby="landing-hero-title">
            <div className="landing-hero-inner">
                <div className="landing-hero-copy">
                    <div className="landing-hero-kicker">OPEN SAR ANALYSIS WORKSPACE <span>·</span> NISAR L-BAND</div>
                    <h1 id="landing-hero-title">See the change<br /><em>before it<span className="landing-mobile-break"><br /></span> becomes</em><br />the crisis.</h1>
                    <p>NISAR Pro turns satellite observations into reviewable flood and infrastructure intelligence—with the imagery, geometry, processing context, and report kept together.</p>
                    <div className="landing-actions"><Link className="landing-primary" to="/app">Explore the workspace <ArrowUpRight size={16} /></Link><Link className="landing-secondary" to="/docs">Read the method <ArrowUpRight size={15} /></Link></div>
                    <div className="landing-hero-note"><ArrowDownRight size={17} /><span>From global context to an observed event</span></div>
                </div>
                <EarthEventHero />
            </div>
            <div className="landing-hero-strip" aria-label="Acquisition metadata">
                <span>SENSOR · NISAR L-BAND HH</span><span>BASELINE · 1 JAN 2026</span><span>ACTIVE · 24 JUL 2026</span><span>GRID · 10 M × 10 M</span><span>OUTPUT · EPSG:4326</span>
            </div>
        </section>
    )
}

function LegacyFlagshipHero() {
    return (
        <section className="landing-hero landing-hero-flagship" aria-labelledby="landing-hero-title">
            <div className="landing-hero-inner">
                <div className="landing-hero-copy">
                    <div className="landing-hero-kicker">NISAR L2 GCOV <span>·</span> IEEE INGARSS 2026</div>
                    <h1 id="landing-hero-title">See the change<br /><em>before it becomes</em><br />the crisis.</h1>
                    <p>NISAR Pro turns satellite observations into reviewable flood and infrastructure intelligence—with the imagery, geometry, processing context, and report kept together.</p>
                    <div className="landing-actions"><Link className="landing-primary" to="/app">Open the workspace <ArrowUpRight size={16} /></Link><Link className="landing-secondary" to="/docs">Read the method <ArrowUpRight size={15} /></Link></div>
                    <div className="landing-hero-note"><ArrowDownRight size={17} /><span>From sensor physics to a decision-ready map</span></div>
                </div>
                <div className="landing-hero-visual" aria-label="Bihar Ganga Plain NISAR fused flood analysis context">
                    <div className="landing-earth-stage"><img className="landing-earth-image landing-earth-night" src="/earth_night.png" alt="Earth at night showing the global observation context" /><div className="landing-earth-vignette" aria-hidden="true" /><div className="landing-earth-label"><span className="landing-live-dot" /> INGARSS 2026 <span>·</span> NISAR OBSERVATION</div><div className="landing-earth-marker" aria-label="Bihar reference region"><span /><b>GANGA PLAIN / BIHAR</b><small>25.50° N · 86.50° E</small></div><div className="landing-earth-rule" aria-hidden="true" /></div>
                    <motion.figure className="landing-event-window" initial={{ opacity: 0, y: 28, scale: .97 }} whileInView={{ opacity: 1, y: 0, scale: 1 }} viewport={{ once: true, amount: .35 }} transition={{ duration: .75, ease: [0.22, 1, 0.36, 1] }}><div className="landing-event-window-top"><span>INGARSS 2026 / FUSED OBSERVATION</span><span>31 AUG → 12 SEP 2026</span></div><img className="landing-event-poster" src="/showcase/bihar_2phase_flood_lifecycle.png" alt="NISAR Pro Bihar flood lifecycle figure comparing L-band, S-band, and fused water change" loading="eager" /><figcaption><span>BIHAR GANGA PLAIN / EPSG:32645</span><strong>1,337.15 KM² NEW WATER</strong></figcaption></motion.figure>
                </div>
            </div>
            <div className="landing-hero-strip" aria-label="Acquisition metadata"><span>SENSOR · NISAR L + S GCOV</span><span>BASELINE · 31 AUG 2026</span><span>ACTIVE · 12 SEP 2026</span><span>GRID · 80 M × 80 M</span><span>OUTPUT · EPSG:32645</span></div>
        </section>
    )
}

function Hero() {
    return (
        <section className="landing-hero landing-hero-flagship" aria-labelledby="landing-hero-title">
            <div className="landing-hero-inner">
                <div className="landing-hero-copy">
                    <div className="landing-hero-kicker">OPEN SAR ANALYSIS WORKSPACE <span>·</span> NISAR L2 GCOV</div>
                    <h1 id="landing-hero-title">See the change<br /><em>before it becomes</em><br />the crisis.</h1>
                    <p>NISAR Pro turns satellite observations into reviewable flood and infrastructure intelligence—with the imagery, geometry, processing context, and report kept together.</p>
                    <div className="landing-actions"><Link className="landing-primary" to="/app">Open the workspace <ArrowUpRight size={16} /></Link><Link className="landing-secondary" to="/docs">Read the method <ArrowUpRight size={15} /></Link></div>
                    <div className="landing-hero-note"><ArrowDownRight size={17} /><span>From sensor physics to a decision-ready map</span></div>
                </div>
                <div className="landing-hero-visual" aria-label="NISAR Pro three-panel fused flood analysis">
                    <div className="landing-earth-stage"><img className="landing-earth-image landing-earth-night" src="/earth_night.png" alt="Earth at night showing the global observation context" /><div className="landing-earth-vignette" aria-hidden="true" /><div className="landing-earth-label"><span className="landing-live-dot" /> GLOBAL CONTEXT <span>·</span> NISAR OBSERVATION</div><div className="landing-earth-marker" aria-label="Selected NISAR scene"><span /><b>SELECTED SCENE</b><small>REAL GCOV OBSERVATION</small></div><div className="landing-earth-rule" aria-hidden="true" /></div>
                    <motion.figure className="landing-event-window" initial={{ opacity: 0, y: 28, scale: .97 }} whileInView={{ opacity: 1, y: 0, scale: 1 }} viewport={{ once: true, amount: .35 }} transition={{ duration: .75, ease: [0.22, 1, 0.36, 1] }}><div className="landing-event-window-top"><span>FUSED OBSERVATION / REAL OUTPUT</span><span>31 AUG → 12 SEP 2026</span></div><img className="landing-event-poster" src="/showcase/bihar_ls_fusion_3panel_comparison.png" alt="NISAR Pro three-panel L-band, S-band, and fused flood comparison" loading="eager" /><figcaption><span>L + S GCOV / EPSG:32645</span><strong>1,337.15 KM² NEW WATER</strong></figcaption></motion.figure>
                </div>
            </div>
            <div className="landing-hero-strip" aria-label="Acquisition metadata"><span>SENSOR · NISAR L + S GCOV</span><span>BASELINE · 31 AUG 2026</span><span>ACTIVE · 12 SEP 2026</span><span>GRID · 80 M × 80 M</span><span>OUTPUT · EPSG:32645</span></div>
        </section>
    )
}

function PathwaysSection() {
    return (
        <section className="landing-pathways" id="features" aria-labelledby="landing-pathways-title">
            <div className="landing-section-inner">
                <div className="landing-section-intro landing-section-intro-split"><div className="landing-label">ONE PLATFORM / THREE WAYS TO REVIEW</div><div><h2 id="landing-pathways-title">Choose the question.<br /><span>Keep the evidence.</span></h2><p>NISAR Pro gives each analysis a focused workspace without hiding the underlying data or method.</p></div></div>
                <div className="landing-pathway-list">{pathways.map(({ label, title, copy, icon: Icon, tone }) => <article className={`landing-pathway ${tone}`} key={label}><div className="landing-pathway-index">{label}</div>{createElement(Icon, { size: 24, strokeWidth: 1.35, 'aria-hidden': true })}<div className="landing-pathway-body"><h3>{title}</h3><p>{copy}</p></div><ArrowUpRight className="landing-pathway-arrow" size={20} aria-hidden="true" /></article>)}</div>
                <Link className="landing-inline-link" to="/docs">Explore the technical documentation <ArrowUpRight size={16} /></Link>
            </div>
        </section>
    )
}

function MethodSection() {
    return (
        <section className="landing-method" aria-labelledby="landing-method-title">
            <div className="landing-section-inner"><div className="landing-method-heading"><div className="landing-label">THE WORK BEHIND THE MAP</div><h2 id="landing-method-title">A result is useful only when people can trust how it got there.</h2></div><div className="landing-workflow">{visibleWorkflow.map(([number, title, copy]) => <article className="landing-workflow-step" key={number}><div className="landing-workflow-top"><span>{number}</span><Activity size={17} strokeWidth={1.4} /></div><h3>{title}</h3><p>{copy}</p></article>)}</div><div className="landing-integrity"><Eye size={19} strokeWidth={1.4} /><p><strong>Scientific restraint is a feature.</strong> When there are only two acquisitions, the comparison shows those two observed states. It does not invent a flood progression between dates.</p><Link to="/docs">Read the method <ArrowUpRight size={15} /></Link></div></div>
        </section>
    )
}

function FinalCta() {
    return (
        <section className="landing-final" aria-labelledby="landing-final-title">
            <div className="landing-section-inner">
                <div className="landing-label">OPEN REVIEW</div>
                <h2 id="landing-final-title">Look at the evidence yourself.</h2>
                <p>The workspace, the method, and the reports are ready to inspect.</p>
                <div className="landing-actions"><Link className="landing-primary" to="/app">Open the dashboard <ArrowUpRight size={16} /></Link><Link className="landing-secondary landing-secondary-light" to="/docs">Read documentation <ArrowUpRight size={15} /></Link></div>
            </div>
        </section>
    )
}

export default function LandingPage() {
    return <motion.main className="landing-page" variants={pageVariants} initial="initial" animate="animate" exit="exit" transition={{ duration: .45 }}><ScrollProgress /><Hero /><StoryScroll /><EvidenceSection /><PathwaysSection /><MethodSection /><FinalCta /><ProcessVideo /></motion.main>
}
