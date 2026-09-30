import { useEffect, useRef, useState } from 'react'
import { createStory } from './storyScene'
import './story-scroll.css'

// Chapter thresholds match the progress windows in storyScene.js
const CHAPTERS = [
    { at: 0,    tag: '01 / THE EVENT',      title: 'A dam releases stored water.',                   copy: 'An upstream spillway opens. Water leaves the reservoir and follows the valley downhill.' },
    { at: .14,  tag: '02 / THE IMPACT',     title: 'The flood reaches a city.',                      copy: 'Ground truth is slow and dangerous to collect while the water is still moving.' },
    { at: .34,  tag: '03 / THE OBSERVER',   title: 'A radar satellite passes overhead.',             copy: 'L-band SAR orbits above and looks down, whatever the weather or the hour.' },
    { at: .50,  tag: '04 / THE CAPTURE',    title: 'It captures the ground, not the clouds.',        copy: 'Calm floodwater returns almost no radar signal, so it shows up dark against the land.' },
    { at: .64,  tag: '05 / THE PIPELINE',   title: 'NISAR Pro compares before and after.',           copy: 'Baseline and active acquisitions go through log-ratio change, Otsu thresholding and region growing.' },
    { at: .80,  tag: '06 / THE OUTPUT',     title: 'The result: the affected area.',                 copy: 'Flood extent separated from permanent water, and the built-up land it touches, kept with its report.' },
    { at: .93,  tag: '07 / THE REAL RESULT', title: 'The same method, on a real event.',             copy: 'Upper Kolab Reservoir, Odisha. Active 24 Jul 2026 against a 1 Jan 2026 baseline: 145.45 acres of new inundation.' },
]
const smooth = t => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t) }

export default function StoryScroll() {
    const track = useRef(null), canvas = useRef(null), card = useRef(null), pRef = useRef(0)
    const [ch, setCh] = useState(0)

    useEffect(() => {
        const el = track.current
        const onScroll = () => {
            const r = el.getBoundingClientRect(), span = r.height - window.innerHeight
            const p = Math.min(1, Math.max(0, -r.top / span))
            pRef.current = p
            const idx = CHAPTERS.reduce((a, c, i) => (p >= c.at ? i : a), 0)
            setCh(prev => (prev === idx ? prev : idx))
            if (card.current) card.current.style.opacity = smooth((p - .93) / .05)
        }
        onScroll()
        window.addEventListener('scroll', onScroll, { passive: true })
        window.addEventListener('resize', onScroll)
        const story = createStory(canvas.current, () => pRef.current)
        return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); story.destroy() }
    }, [])

    const c = CHAPTERS[ch], real = ch === CHAPTERS.length - 1
    return (
        <section className="landing-story" aria-label="How NISAR Pro turns a dam release into a mapped flood extent">
            <div className="landing-story-track" ref={track}>
                <div className="landing-story-pin">
                    <canvas ref={canvas} className="landing-story-canvas" aria-hidden="true" />
                    <div className={`landing-story-badge ${real ? 'is-real' : ''}`}>{real ? 'ACTUAL NISAR PRO OUTPUT' : 'ILLUSTRATIVE SCENARIO'}</div>
                    <figure className="landing-story-card" ref={card} style={{ opacity: 0 }}>
                        <img src="/landing/flood-workspace-full.png" alt="Captured NISAR Pro flood workspace for Upper Kolab Reservoir showing 145.45 acres of new inundation" loading="lazy" />
                    </figure>
                    <ol className="landing-story-dots" aria-label="Story chapters">
                        {CHAPTERS.map((x, i) => <li key={x.tag} className={i === ch ? 'on' : i < ch ? 'done' : ''} aria-current={i === ch ? 'step' : undefined}><span className="sr-only">{x.title}</span></li>)}
                    </ol>
                    <div className="landing-story-caption" aria-live="polite">
                        <div className="landing-label">{c.tag}</div>
                        <h2 key={c.tag}>{c.title}</h2>
                        <p>{c.copy}</p>
                    </div>
                </div>
            </div>
        </section>
    )
}
