// Landing page: NISAR Pro by RunLayer Lab. A scroll story for disaster authorities that ends in
// "get a free flood map of your district". Every number comes from the Bihar L-band run in the
// demo data (heroMeta.json, built by scripts/build_landing_assets.py).
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { formatArea, formatNumber } from '../app/lib/units'
import meta from './heroMeta.json'
import './runlayer.css'

const IMG = '/landing/hero'
const MAIL = ['ishaan4488', 'gmail.com'].join('@')
const s = meta.summary
const FX = formatArea(s.new_water.km2, s.new_water.acres)
const LOSS = formatArea(s.water_loss.km2, s.water_loss.acres)
const PHASES = [
  { key: 'before', label: 'Radar · 31 Aug 2026', note: 'Earlier NISAR pass' },
  { key: 'after', label: 'Radar · 12 Sep 2026', note: 'Later NISAR pass, through cloud' },
  { key: 'flood', label: 'Flood extent', note: 'Water that was not there on 31 Aug' },
]

function mailto(subject, body) {
  return `mailto:${MAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}
const FREE_MAP = mailto('Free flood map for our district', 'Name:\nOffice / department:\nDistrict or area:\nA past flood date (if known):\nPhone (optional):\n\nPlease send a free NISAR flood map and situation report for this area.')
const BRIEFING = mailto('30-minute briefing on NISAR Pro', 'Name:\nOffice / department:\nPreferred date and time:\n')

function useReducedMotion() {
  const [r] = useState(() => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  return r
}

/** The map stack sized to cover its box while keeping the image aspect, so % pin positions stay true. */
function Scene({ phase, pins = true, className = '' }) {
  const [w, h] = meta.size
  return (
    <div className={`rl-scene ${className}`} style={{ '--ar': `${w} / ${h}` }}>
      <div className="rl-scene-inner">
        <img src={`${IMG}/base.webp`} alt="" className="on" />
        <img src={`${IMG}/before.webp`} alt="" className={`radar ${phase === 0 ? 'on' : ''}`} />
        <img src={`${IMG}/after.webp`} alt="" className={`radar ${phase >= 1 ? 'on' : ''}`} />
        <img src={`${IMG}/flood.webp`} alt="" className={`flood ${phase === 2 ? 'on' : ''}`} />
        {pins && meta.pins.map((p, i) => (
          <span key={p.name} className={`rl-pin ${phase === 2 ? 'on' : ''}`} style={{ left: `${p.x}%`, top: `${p.y}%`, transitionDelay: `${300 + i * 150}ms` }}>{i + 1}</span>
        ))}
      </div>
    </div>
  )
}

function Nav() {
  const [solid, setSolid] = useState(false)
  useEffect(() => {
    const on = () => setSolid(window.scrollY > 40)
    on()
    window.addEventListener('scroll', on, { passive: true })
    return () => window.removeEventListener('scroll', on)
  }, [])
  return (
    <header className={`rl-nav ${solid ? 'solid' : ''}`}>
      <a href="#top" className="rl-brand"><span className="sl">///</span> NISAR Pro <span className="by">by RunLayer Lab</span></a>
      <nav>
        <a href="#how">How it works</a>
        <a href="#receive">What you get</a>
        <a href="#work">Work with us</a>
        <Link to="/docs">Docs</Link>
      </nav>
      <Link to="/app" className="rl-pill">Live demo</Link>
    </header>
  )
}

function Hero() {
  const reduced = useReducedMotion()
  const [phase, setPhase] = useState(2)
  useEffect(() => {
    if (reduced) return
    const steps = [0, 1, 2]
    let i = 2
    const durations = [2600, 2600, 6000]
    let t
    const next = () => { i = (i + 1) % 3; setPhase(steps[i]); t = setTimeout(next, durations[i]) }
    t = setTimeout(next, 4000)
    return () => clearTimeout(t)
  }, [reduced])
  return (
    <section className="rl-hero" id="top">
      <Scene phase={phase} className="rl-hero-map" />
      <div className="rl-hero-shade" />
      <div className="rl-hero-copy">
        <p className="rl-eyebrow">Flood mapping from NISAR radar</p>
        <h1>Where the water is.<br /><span>Through cloud, day and night.</span></h1>
        <p className="rl-lead">We compare two NISAR radar passes and map the flood: how much, where, and which places first. Your team gets km² and acres, place names, field waypoints and a report it can act on.</p>
        <div className="rl-ctas">
          <a className="rl-btn primary" href={FREE_MAP}>Get a free flood map of your district</a>
          <Link className="rl-btn" to="/app">Open the live demo</Link>
        </div>
      </div>
      <div className="rl-hero-cards">
        <div className="rl-card">
          <div className="rl-card-l">Flood extent · Bihar, Ganga plain</div>
          <div className="rl-big">{FX.km2.replace(' km²', '')}<small>km²</small></div>
          <div className="rl-sub">{FX.acres} · {s.band}-band · 31 Aug → 12 Sep 2026</div>
          <div className="rl-note">Radar-detected. Not confirmed on the ground.</div>
        </div>
        <div className="rl-card">
          <div className="rl-card-l">Send teams first</div>
          {meta.pins.map((p, i) => (
            <div key={p.name} className="rl-row"><span className="rl-pin static">{i + 1}</span><span className="n">{p.name}</span><b>{formatNumber(p.km2, 2)} km²</b></div>
          ))}
        </div>
      </div>
      <div className="rl-phase" aria-live="polite">
        {PHASES.map((p, i) => <span key={p.key} className={phase === i ? 'on' : ''}>{p.label}</span>)}
      </div>
    </section>
  )
}

function Proof() {
  return (
    <section className="rl-proof">
      <div><b>{FX.km2}</b><span>flood extent mapped over Bihar from one NISAR pass pair, {FX.acres}</span></div>
      <div><b>44–65 s</b><span>for a full scene pair (2 × 1.157 billion samples) on a 4-core laptop, under 2.5 GB RAM</span></div>
      <div><b>L and S band</b><span>checked against Sentinel-2 optical images on cloud-free pixels</span></div>
    </section>
  )
}

function FloodDay() {
  const q = [
    ['Where is the water?', 'Clouds stay over a flood for days and optical satellites see nothing. Radar sees through them, day and night.'],
    ['How much, and is it growing?', 'Flood extent in km² and acres for your area, compared with the previous pass.'],
    ['Where do we send teams first?', 'The largest flooded areas ranked, with village and district names and coordinates for the field.'],
  ]
  return (
    <section className="rl-sec" id="how">
      <p className="rl-eyebrow">On a flood day</p>
      <h2>Three questions every control room asks.</h2>
      <div className="rl-q">{q.map(([t, c], i) => <div key={t} className="rl-qcard"><span className="k">0{i + 1}</span><h3>{t}</h3><p>{c}</p></div>)}</div>
    </section>
  )
}

const LAYERS = [
  { img: 'base', t: 'The ground', c: 'Satellite basemap of your area.' },
  { img: 'before', t: 'Radar, earlier pass', c: 'What NISAR saw on 31 Aug 2026.' },
  { img: 'after', t: 'Radar, later pass', c: 'What it saw on 12 Sep 2026, through monsoon cloud.' },
  { img: 'flood', t: 'What changed', c: 'Flood extent at 80 m, by confidence, plus water that left.' },
  { img: 'pins', t: 'Where to act', c: 'Largest areas ranked, with place names and districts.' },
  { img: 'report', t: 'What you send up', c: 'A 2-page situation report, waypoints for field teams, the data files.' },
]

function LayerStack() {
  const ref = useRef(null)
  const [p, setP] = useState(0)
  useEffect(() => {
    const on = () => {
      const el = ref.current
      if (!el) return
      const r = el.getBoundingClientRect()
      const total = r.height - window.innerHeight
      setP(Math.min(1, Math.max(0, -r.top / Math.max(total, 1))))
    }
    on()
    window.addEventListener('scroll', on, { passive: true })
    window.addEventListener('resize', on)
    return () => { window.removeEventListener('scroll', on); window.removeEventListener('resize', on) }
  }, [])
  const active = Math.min(LAYERS.length - 1, Math.floor(p * LAYERS.length))
  const spread = 0.25 + 0.75 * Math.min(1, p * 1.6)
  return (
    <section className="rl-stack" ref={ref}>
      <div className="rl-stack-sticky">
        <div className="rl-stack-copy">
          <p className="rl-eyebrow">How a map is made</p>
          <h2>Six layers, one decision.</h2>
          <ol>
            {LAYERS.map((l, i) => (
              <li key={l.t} className={i === active ? 'on' : i < active ? 'done' : ''}><b>{l.t}</b><span>{l.c}</span></li>
            ))}
          </ol>
        </div>
        <div className="rl-stack-scene" aria-hidden="true">
          <div className="rl-stack-3d">
            {LAYERS.map((l, i) => (
              <div key={l.t} className={`rl-layer ${i === active ? 'on' : ''}`} style={{ transform: `translateZ(${(i - 2.5) * 70 * spread}px)` }}>
                {['base', 'before', 'after', 'flood'].includes(l.img) && <img src={`${IMG}/${l.img}.webp`} alt="" />}
                {l.img === 'pins' && meta.pins.map((pn, k) => <span key={pn.name} className="rl-pin static" style={{ position: 'absolute', left: `${pn.x}%`, top: `${pn.y}%` }}>{k + 1}</span>)}
                {l.img === 'report' && (
                  <div className="rl-mini-report">
                    <b>Situation report · Flood extent</b>
                    <span>{FX.km2} · {FX.acres}</span>
                    <i /><i /><i className="s" />
                  </div>
                )}
                <span className="rl-layer-tag">{l.t}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function Receive() {
  const items = [
    ['Situation report', 'Two A4 pages: flood extent, map with grid and numbered areas, district table, method and limits. Ready to print or forward.'],
    ['District table', 'Flood extent per district, with the share of the total. Who to call is clear in one look.'],
    ['Field waypoints', 'The largest areas as KML and GPX for phones and GPS units, with coordinates in decimal, DMS and UTM.'],
    ['Live dashboard', 'Replay the two passes, click any flooded area, sum any part of the map, see change since the last pass.'],
    ['After every pass', 'A new map and report for your area each time the satellite comes back over it.'],
  ]
  return (
    <section className="rl-sec" id="receive">
      <p className="rl-eyebrow">What your office receives</p>
      <h2>Not a picture. Things your team can use.</h2>
      <div className="rl-shots">
        <figure><img src="/landing/shots/live.webp" alt="NISAR Pro dashboard with numbered flood areas and an area card" loading="lazy" /><figcaption>Dashboard: numbered areas, area card with coordinates.</figcaption></figure>
        <figure><img src="/landing/shots/districts.webp" alt="Flood extent by district table" loading="lazy" /><figcaption>Flood extent by district.</figcaption></figure>
      </div>
      <div className="rl-grid5">{items.map(([t, c]) => <div key={t} className="rl-item"><h3>{t}</h3><p>{c}</p></div>)}</div>
    </section>
  )
}

function Work() {
  const steps = [
    ['Tell us your area', 'A district, a river reach or a whole state.'],
    ['We watch every pass', 'NISAR covers each place every 12 days. We pick up each new pass over your area.'],
    ['You get the map', 'Map, report and waypoints by email and on your dashboard, soon after the data is published.'],
    ['We run the system', 'Hosted by us, or installed on your own servers with training. You never manage the infrastructure.'],
  ]
  const offers = [
    ['Monsoon pilot', 'One district for one monsoon season. A map and report after every pass, and a review at the end.', 'Best first step'],
    ['Managed monitoring', 'Your areas all year. Maps after every pass, history and trends, a named contact.', ''],
    ['On your servers', 'NISAR Pro installed in your data centre, set up and maintained by us, with training for your staff.', ''],
  ]
  return (
    <section className="rl-sec" id="work">
      <p className="rl-eyebrow">Work with RunLayer Lab</p>
      <h2>You give us your area. We run everything else.</h2>
      <ol className="rl-steps">{steps.map(([t, c], i) => <li key={t}><span>{i + 1}</span><b>{t}</b><p>{c}</p></li>)}</ol>
      <div className="rl-offers">
        {offers.map(([t, c, tag]) => (
          <div key={t} className={`rl-offer ${tag ? 'hi' : ''}`}>
            {tag && <span className="tag">{tag}</span>}
            <h3>{t}</h3><p>{c}</p>
            <a href={mailto(`${t}: NISAR Pro`, 'Name:\nOffice / department:\nArea:\n')}>Ask about this ↗</a>
          </div>
        ))}
      </div>
    </section>
  )
}

function WhyNow() {
  return (
    <section className="rl-sec rl-now">
      <div>
        <p className="rl-eyebrow">Why now</p>
        <h2>Monsoon 2027 starts in June.</h2>
        <p className="rl-lead">NISAR is new, and few offices use its radar yet. A pilot needs a few weeks to set up for your area, so pilots for the 2027 season are agreed by May. We take three pilot districts for the season, so each one gets full attention.</p>
      </div>
      <a className="rl-btn primary" href={FREE_MAP}>Start with a free map of a past flood</a>
    </section>
  )
}

function Faq() {
  const qa = [
    ['Does this replace field reports?', 'No. It shows where radar detected water and ranks it, so teams know where to look first. Every map says it is not confirmed on the ground.'],
    ['How is this different from national flood maps?', 'National centres cover the whole country. We work for your district: your areas ranked with village names, district totals, waypoints for your teams, and a dashboard you control.'],
    ['What data do you use?', 'NISAR L2 GCOV radar from NASA and ISRO, which is free and public. Sentinel-1 support is planned.'],
    ['Where does it run?', 'On our servers, or on yours. A full scene pair takes about a minute on an ordinary 4-core machine.'],
    ['What does a pilot cost?', 'We agree scope and cost per district after a short call. The first map of a past flood is free.'],
  ]
  return (
    <section className="rl-sec rl-faq">
      <h2>Questions officers ask</h2>
      {qa.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}
    </section>
  )
}

function Final() {
  const [f, setF] = useState({ name: '', office: '', district: '', email: '' })
  const body = `Name: ${f.name}\nOffice / department: ${f.office}\nDistrict or area: ${f.district}\nReply to: ${f.email}\n\nPlease send a free NISAR flood map and situation report for this area.`
  return (
    <section className="rl-final" id="contact">
      <div className="rl-final-copy">
        <h2>Get a free flood map of your district.</h2>
        <p className="rl-lead">Tell us the area. We process a past NISAR pass over it and send you the map and a situation report, usually within a few days. No cost, no commitment.</p>
      </div>
      <form className="rl-form" onSubmit={(e) => { e.preventDefault(); window.location.href = mailto('Free flood map for our district', body) }}>
        {[['name', 'Your name'], ['office', 'Office or department'], ['district', 'District or area'], ['email', 'Email for the reply']].map(([k, l]) => (
          <label key={k}><span>{l}</span><input required={k !== 'office'} type={k === 'email' ? 'email' : 'text'} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></label>
        ))}
        <button type="submit" className="rl-btn primary">Request the free map</button>
        <small>Opens your email app with the request filled in. Or write to <a href={FREE_MAP}>{MAIL}</a>. <a href={BRIEFING}>Book a 30-minute briefing</a>.</small>
      </form>
    </section>
  )
}

function About() {
  return (
    <section className="rl-sec rl-about">
      <div className="rl-photo" aria-label="Aditya Narayan Nayak"><img src="/landing/aditya.jpg" alt="Aditya Narayan Nayak" onError={(e) => { e.currentTarget.style.display = 'none' }} /><span>AN</span></div>
      <div>
        <p className="rl-eyebrow">About RunLayer Lab</p>
        <h2>You talk to the person who built it.</h2>
        <p className="rl-lead">I am Aditya Narayan Nayak, from Kundura, Odisha. I built NISAR Pro end to end: the Rust radar engine that maps a full scene pair in about a minute, the processing service and the dashboard. The Bihar 2026 analysis is my IEEE InGARSS 2026 work. RunLayer Lab is small on purpose: one team that answers your call and runs your system.</p>
        <p className="rl-contact"><a href={BRIEFING}>{MAIL}</a></p>
      </div>
    </section>
  )
}

export default function RunLayerLanding() {
  useEffect(() => { document.title = 'NISAR Pro by RunLayer Lab · Flood maps from radar' }, [])
  return (
    <main className="rl">
      <Nav />
      <Hero />
      <Proof />
      <FloodDay />
      <LayerStack />
      <Receive />
      <Work />
      <WhyNow />
      <Faq />
      <Final />
      <About />
      <footer className="rl-foot">
        <span>NISAR Pro by RunLayer Lab</span>
        <span>Data: NASA-ISRO NISAR (ASF DAAC). Basemap imagery © Esri, Maxar, Earthstar Geographics. Place names © OpenStreetMap contributors.</span>
        <span>Radar-detected flood maps. Not confirmed on the ground.</span>
      </footer>
    </main>
  )
}
