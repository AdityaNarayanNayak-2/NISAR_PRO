import React, { useEffect, useMemo, useState } from 'react';
import { ImageOverlay, useMap } from 'react-leaflet';
import { Pause, Play, RotateCcw } from 'lucide-react';
import { api } from '../../../config/api';
import { MONO, C } from '../constants';
import { parseNisarDate } from './floodReportHelpers';

const PHASES = ['baseline', 'active', 'detected'];

function ReplayViewport({ bounds, phase, baselineUrl, activeUrl, maskUrl, opacity, onAssetError }) {
    const map = useMap();
    useEffect(() => {
        if (bounds) map.fitBounds(bounds, { padding: [24, 24], animate: false });
    }, [bounds, map]);

    return (
        <>
            {phase === 'baseline' && baselineUrl && <ImageOverlay url={baselineUrl} bounds={bounds} opacity={opacity} eventHandlers={{ error: onAssetError }} />}
            {phase === 'active' && activeUrl && <ImageOverlay url={activeUrl} bounds={bounds} opacity={opacity} eventHandlers={{ error: onAssetError }} />}
            {phase === 'detected' && activeUrl && <ImageOverlay url={activeUrl} bounds={bounds} opacity={opacity * 0.78} eventHandlers={{ error: onAssetError }} />}
            {phase === 'detected' && maskUrl && <ImageOverlay url={maskUrl} bounds={bounds} opacity={Math.min(1, opacity + 0.08)} />}
        </>
    );
}

export default function FloodEventReplay({ result, report, bounds, onPhaseChange, onReplayUnavailable }) {
    const [phaseIndex, setPhaseIndex] = useState(2);
    const [playing, setPlaying] = useState(false);
    const [reducedMotion, setReducedMotion] = useState(false);
    const [assetError, setAssetError] = useState(false);

    const paths = useMemo(() => {
        const floodUrl = result?.url;
        if (!floodUrl) return null;
        const replaceFloodName = (name) => floodUrl.replace(/_flood\.png(?:\?.*)?$/, `_${name}.png`);
        return {
            baseline: result.floodBaselinePath ? api(result.floodBaselinePath) : replaceFloodName('flood_baseline'),
            active: result.floodActivePath ? api(result.floodActivePath) : replaceFloodName('flood_active'),
            mask: floodUrl,
        };
    }, [result]);

    useEffect(() => {
        const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
        const update = () => setReducedMotion(Boolean(media?.matches));
        update();
        media?.addEventListener?.('change', update);
        return () => media?.removeEventListener?.('change', update);
    }, []);

    useEffect(() => {
        if (!playing || reducedMotion) return undefined;
        const timer = window.setInterval(() => {
            setPhaseIndex(current => {
                if (current >= PHASES.length - 1) {
                    setPlaying(false);
                    return current;
                }
                return current + 1;
            });
        }, 1500);
        return () => window.clearInterval(timer);
    }, [playing, reducedMotion]);

    const phase = PHASES[phaseIndex];
    useEffect(() => onPhaseChange?.(phase), [onPhaseChange, phase]);

    if (!result || !bounds || result.pipeline !== 'flood' || !paths || !result.floodReplayAvailable || assetError) {
        return null;
    }

    const activeDate = parseNisarDate(report?.product?.active_id);
    const baselineDate = parseNisarDate(report?.product?.baseline_id);
    const labels = {
        baseline: { title: 'BASELINE OBSERVATION', date: baselineDate },
        active: { title: 'ACTIVE OBSERVATION', date: activeDate },
        detected: { title: 'DERIVED FLOOD DETECTION', date: 'Analysis result' },
    };

    const setPhase = (index) => {
        setPlaying(false);
        setPhaseIndex(index);
    };

    return (
        <>
            <ReplayViewport
                bounds={bounds}
                phase={phase}
                baselineUrl={paths.baseline}
                activeUrl={paths.active}
                maskUrl={paths.mask}
                opacity={0.92}
                onAssetError={() => { setAssetError(true); onReplayUnavailable?.(); }}
            />
            <div
                className="flood-replay-control"
                role="region"
                aria-label="Flood event replay"
            >
                <div className="flood-replay-kicker">FLOOD EVENT REPLAY</div>
                <div className="flood-replay-title">{labels[phase].title}</div>
                <div className="flood-replay-date">{labels[phase].date}</div>
                <div className="flood-replay-track" role="group" aria-label="Acquisition timeline">
                    {PHASES.map((item, index) => (
                        <button
                            key={item}
                            type="button"
                            className={`flood-replay-step ${index === phaseIndex ? 'is-active' : ''}`}
                            onClick={() => setPhase(index)}
                            aria-label={`Show ${labels[item].title.toLowerCase()}`}
                            aria-pressed={index === phaseIndex}
                        >
                            <span className="flood-replay-dot" />
                            <span>{item === 'detected' ? 'RESULT' : item.toUpperCase()}</span>
                            <small>{labels[item].date}</small>
                        </button>
                    ))}
                </div>
                <div className="flood-replay-actions">
                    <button type="button" onClick={() => setPlaying(value => !value)} disabled={reducedMotion} aria-label={playing ? 'Pause replay' : 'Play replay'}>
                        {playing ? <Pause size={13} /> : <Play size={13} />}
                        {playing ? 'PAUSE' : 'PLAY'}
                    </button>
                    <button type="button" onClick={() => { setPlaying(false); setPhaseIndex(0); }} aria-label="Replay from baseline">
                        <RotateCcw size={13} /> REPLAY
                    </button>
                </div>
                <div className="flood-replay-note">
                    {reducedMotion ? 'Reduced motion enabled · select a phase manually' : 'Two acquisitions · result is derived, not an interpolated observation'}
                </div>
            </div>
        </>
    );
}
