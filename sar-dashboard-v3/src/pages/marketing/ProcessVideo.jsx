import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { MonitorPlay, ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import BrowserFrame from './BrowserFrame'

const PROCESS_VIDEO_SRC = '/landing/nisar-pro-process.mp4'
const PROCESS_VIDEO_POSTER = '/landing/flood-workspace-full.png'

function ProcessRecording() {
    const [videoState, setVideoState] = useState('checking')

    useEffect(() => {
        if (typeof window === 'undefined' || !window.fetch) return
        let active = true
        fetch(PROCESS_VIDEO_SRC, { method: 'HEAD' })
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

    if (videoState === 'ready') {
        return (
            <div className="landing-process-stage">
                <video className="landing-process-video" controls playsInline preload="metadata" poster={PROCESS_VIDEO_POSTER} aria-label="Recorded NISAR Pro processing session walking through two SAR scenes from download to classified extent">
                    <source src={PROCESS_VIDEO_SRC} type="video/mp4" />
                </video>
            </div>
        )
    }

    return (
        <div className="landing-process-pending" aria-label={videoState === 'checking' ? 'Checking for processing recording' : 'Processing recording not available yet'}>
            <div className="landing-process-pending-grid" aria-hidden="true" />
            <MonitorPlay className="landing-process-pending-icon" size={30} strokeWidth={1.2} aria-hidden="true" />
            <div className="landing-process-pending-copy">
                <div className="landing-process-pending-label">RECORDED PROCESSING SESSION</div>
                <p>We are recording the real processing run — download, processor run, and workspace review — and it will appear here.</p>
            </div>
        </div>
    )
}

export default function ProcessVideo() {
    return (
        <section className="landing-process" id="process" aria-labelledby="landing-process-title">
            <div className="landing-section-inner">
                <div className="landing-section-intro landing-section-intro-split">
                    <div className="landing-label">THE RECORDED RUN</div>
                    <div>
                        <h2 id="landing-process-title">Two scenes, one process.<br />See it happen.</h2>
                        <p>Watch the real workflow: start from the baseline and active acquisitions, run the change detection, and end with the classified extent — the same method the dashboard reports.</p>
                    </div>
                </div>
                <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: .3 }} transition={{ duration: .7, ease: [0.22, 1, 0.36, 1] }}>
                    <BrowserFrame label="NISAR PRO" url="/run/flood-upper-kolab" badge="RECORDED SESSION" chips={['FROM DOWNLOAD TO CLASSIFIED EXTENT', 'LOG-RATIO · OTSU · REGION GROWING']}>
                        <ProcessRecording />
                    </BrowserFrame>
                </motion.div>
                <Link className="landing-inline-link" to="/app">Run it yourself in the dashboard <ArrowUpRight size={16} /></Link>
            </div>
        </section>
    )
}