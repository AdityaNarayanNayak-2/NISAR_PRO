import React from 'react';
import { MONO, C, TM } from '../constants';
import { useJobStore } from '../stores/useJobStore';

const STAGES = ['LOADING ACTIVE', 'LOADING BASELINE', 'DETECTING', 'OUTPUTS', 'COMPLETE'];

function getStageIndex(currentStage) {
    if (!currentStage) return 0;
    const norm = String(currentStage).toUpperCase();
    if (norm.includes('ACTIVE') || norm.includes('1/5') || norm === 'SUBMITTED') return 0;
    if (norm.includes('BASELINE') || norm.includes('2/5')) return 1;
    if (norm.includes('DETECT') || norm.includes('CHANGE') || norm.includes('5/5') || norm.includes('PROCESS')) return 2;
    if (norm.includes('OUTPUT') || norm.includes('GEOSPATIAL') || norm === 'GENERATING_OUTPUTS') return 3;
    if (norm.includes('COMPLETE') || norm.includes('SUCCESS')) return 4;
    const idx = STAGES.indexOf(currentStage);
    return idx >= 0 ? idx : 0;
}

export default function ProcessingProgressBar({ profile = 'flood' }) {
    const activeJobId = useJobStore(state => state.activeJobId);
    const jobs = useJobStore(state => state.jobs);
    const activeJobStage = useJobStore(state => state.activeJobStage);

    const activeJob = activeJobId ? jobs[activeJobId] : null;

    // Only render if activeJob has status of 'running'
    if (!activeJob || activeJob.status !== 'running') {
        return null;
    }

    const currentIndex = getStageIndex(activeJobStage);
    const leftOffset = profile === 'flood' ? `${TM.side}px` : (profile === 'infrastructure' ? '240px' : '0px');

    return (
        <div style={{
            position: 'absolute',
            top: '42px',
            left: leftOffset,
            right: `${TM.panel}px`,
            height: '40px',
            zIndex: 1050,
            background: 'rgba(10, 10, 10, 0.94)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            borderBottom: `1px solid rgba(255, 255, 255, 0.08)`,
            display: 'flex',
            alignItems: 'center',
            padding: '0 16px',
            gap: '8px',
            boxSizing: 'border-box',
            fontFamily: MONO,
        }}>
            <div style={{
                fontSize: '9px',
                color: C.accent.flood,
                fontWeight: 'bold',
                letterSpacing: '0.08em',
                whiteSpace: 'nowrap',
                marginRight: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
            }}>
                <span style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: C.accent.flood,
                    display: 'inline-block',
                    boxShadow: `0 0 8px ${C.accent.flood}`
                }} />
                PROCESSING ({activeJobId?.slice(0, 8)})
            </div>

            <div style={{ flex: 1, display: 'flex', gap: '6px', height: '24px' }}>
                {STAGES.map((stage, idx) => {
                    const isCompleted = idx < currentIndex;
                    const isCurrent = idx === currentIndex;
                    const isPassed = isCompleted || isCurrent;

                    return (
                        <div
                            key={stage}
                            style={{
                                flex: 1,
                                height: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '6px',
                                padding: '0 8px',
                                borderRadius: '2px',
                                background: isCurrent
                                    ? 'rgba(15, 150, 156, 0.2)'
                                    : isCompleted
                                        ? 'rgba(15, 150, 156, 0.08)'
                                        : C.bg2,
                                border: `1px solid ${isPassed ? C.accent.flood : C.bg3}`,
                                transition: 'all 200ms ease',
                                boxSizing: 'border-box'
                            }}
                        >
                            <span style={{
                                fontSize: '8px',
                                fontWeight: 700,
                                color: isPassed ? C.accent.flood : C.textDim,
                            }}>
                                {idx + 1}
                            </span>
                            <span style={{
                                fontSize: '9px',
                                fontWeight: isCurrent ? 700 : 500,
                                letterSpacing: '0.04em',
                                color: isCurrent ? C.text : isCompleted ? C.accent.flood : C.textDim,
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                            }}>
                                {stage}
                            </span>
                            {isCurrent && (
                                <span style={{
                                    width: '4px',
                                    height: '4px',
                                    borderRadius: '50%',
                                    background: C.accent.flood,
                                    boxShadow: `0 0 6px ${C.accent.flood}`
                                }} />
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
