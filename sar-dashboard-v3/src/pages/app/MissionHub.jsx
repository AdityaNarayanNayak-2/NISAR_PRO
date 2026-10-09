import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { PROFILES } from './constants';
import './mission-hub.css';

const ENGINES = [
    {
        id: 'flood',
        name: 'Flood and inundation',
        desc: 'Compare a before and an after scene to see where water spread, and by how many acres.',
        tag: 'log-ratio change detection',
    },
    {
        id: 'infrastructure',
        name: 'Infrastructure movement',
        desc: 'Watch a chosen dam, bridge, or slope flex across repeat passes and flag the ones that moved.',
        tag: 'asset deformation',
    },
    {
        id: 'sar_science',
        name: 'SAR science',
        desc: 'Read raw GCOV and RSLC products, inspect backscatter, and geocode the result.',
        tag: 'GCOV / RSLC',
    },
    {
        id: 'insar',
        name: 'Interferometry',
        desc: 'Turn a master and slave pair into fringes, then unwrap them into a displacement map.',
        tag: 'interferometry · unwrap',
    },
];

export default function MissionHub({ onSelectMission }) {
    const reduce = useReducedMotion();
    const rise = reduce
        ? {}
        : { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } };

    return (
        <div className="mh">
            <div className="mh__topbar">
                <span className="mh__brand">
                    NISAR PRO
                    <span className="mh__brand-sub">SAR mission console</span>
                </span>
                <span className="mh__version">v0.4.0</span>
            </div>

            <div className="mh__stage">
                <div className="mh__hero">
                    <motion.div {...rise}>
                        <h1 className="mh__title">See the ground through cloud, dark, and rain.</h1>
                        <p className="mh__lede">
                            NISAR carries an L-band radar that images the surface whatever the weather or the
                            hour. Pick the signal to pull out of the echo.
                        </p>
                    </motion.div>

                    <div className="mh__scope" aria-hidden="true">
                        <span className="mh__sweep" />
                        <span className="mh__axis mh__axis--h" />
                        <span className="mh__axis mh__axis--v" />
                        <span className="mh__ring" style={{ inset: '12%' }} />
                        <span className="mh__ring" style={{ inset: '30%' }} />
                        <span className="mh__ring" style={{ inset: '48%' }} />
                        <span className="mh__blip" style={{ left: '63%', top: '38%' }} />
                    </div>
                </div>

                <p className="mh__list-label">Processing engines</p>
                <div className="mh__list">
                    {ENGINES.map((engine) => {
                        const accent = (PROFILES[engine.id] && PROFILES[engine.id].accent) || '#5AD6E3';
                        return (
                            <button
                                key={engine.id}
                                type="button"
                                className="mh__engine"
                                style={{ '--mh-accent': accent }}
                                onClick={() => onSelectMission(engine.id)}
                            >
                                <span className="mh__bar" />
                                <span>
                                    <span className="mh__name">{engine.name}</span>
                                    <span className="mh__desc">{engine.desc}</span>
                                </span>
                                <span className="mh__tag">{engine.tag}</span>
                            </button>
                        );
                    })}
                </div>

                <p className="mh__foot">Rendered from NASA–ISRO NISAR L-band SLC and GCOV products.</p>
            </div>
        </div>
    );
}
