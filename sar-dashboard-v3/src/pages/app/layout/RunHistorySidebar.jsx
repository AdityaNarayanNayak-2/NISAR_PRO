import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp, History, X, CheckCircle2 } from 'lucide-react';
import { MONO, C } from '../constants';
import { api } from '../../../config/api';
import { useJobStore } from '../stores/useJobStore';
import { useMapStore } from '../stores/useMapStore';

const CANONICAL_ORDER = [
    'sar-bihar-ls-fused-aug31-sep12',
    'sar-8b6af0bc',
    'sar-32db293a',
    'sar-bihar-sep12-oct18-recession',
];

const THEME_STYLES = {
    emerald: {
        badgeBg: 'rgba(16, 185, 129, 0.14)',
        badgeText: '#34d399',
        badgeBorder: 'rgba(16, 185, 129, 0.35)',
        dot: '#10b981',
        metricColor: '#6ee7b7',
        activeBorder: 'rgba(52, 211, 153, 0.8)',
        activeBg: 'rgba(16, 185, 129, 0.08)',
        activeGlow: '0 0 16px rgba(16, 185, 129, 0.22)',
    },
    amber: {
        badgeBg: 'rgba(245, 158, 11, 0.14)',
        badgeText: '#fbbf24',
        badgeBorder: 'rgba(245, 158, 11, 0.35)',
        dot: '#f59e0b',
        metricColor: '#fcd34d',
        activeBorder: 'rgba(251, 191, 36, 0.8)',
        activeBg: 'rgba(245, 158, 11, 0.08)',
        activeGlow: '0 0 16px rgba(245, 158, 11, 0.22)',
    },
    sky: {
        badgeBg: 'rgba(14, 165, 233, 0.14)',
        badgeText: '#38bdf8',
        badgeBorder: 'rgba(14, 165, 233, 0.35)',
        dot: '#0ea5e9',
        metricColor: '#7dd3fc',
        activeBorder: 'rgba(56, 189, 248, 0.8)',
        activeBg: 'rgba(14, 165, 233, 0.08)',
        activeGlow: '0 0 16px rgba(14, 165, 233, 0.22)',
    },
    purple: {
        badgeBg: 'rgba(168, 85, 247, 0.14)',
        badgeText: '#c084fc',
        badgeBorder: 'rgba(168, 85, 247, 0.35)',
        dot: '#a855f7',
        metricColor: '#d8b4fe',
        activeBorder: 'rgba(192, 132, 252, 0.8)',
        activeBg: 'rgba(168, 85, 247, 0.08)',
        activeGlow: '0 0 16px rgba(168, 85, 247, 0.22)',
    },
    rose: {
        badgeBg: 'rgba(239, 68, 68, 0.14)',
        badgeText: '#f87171',
        badgeBorder: 'rgba(239, 68, 68, 0.35)',
        dot: '#ef4444',
        metricColor: '#fca5a5',
        activeBorder: 'rgba(248, 113, 113, 0.8)',
        activeBg: 'rgba(239, 68, 68, 0.08)',
        activeGlow: '0 0 16px rgba(239, 68, 68, 0.22)',
    },
};

function getJobMeta(job) {
    const id = job.id || '';
    const report = job.floodReport || {};
    const areas = report.areas || {};
    const floodKm2 = areas.total_flood_km2;
    const recededKm2 = areas.receded_water_km2;

    let title = job.name || 'Bihar Flood Analysis';
    let band = job.bandLabel || 'SAR';
    let dates = job.dateRange || '31 Aug → 12 Sep 2026';
    let metric = job.areaSummary || '';
    let theme = 'emerald';

    if (id.includes('fused') || report.radar_band === 'fusion' || (floodKm2 && Math.abs(floodKm2 - 1337.15) < 5)) {
        title = 'Bihar Ganga (L+S Dual-Band Fused)';
        band = 'L+S FUSED';
        dates = '31 Aug → 12 Sep 2026';
        metric = '+1,337.2 km² gain (Consensus)';
        theme = 'emerald';
    } else if (id.includes('recession') || (recededKm2 && Math.abs(recededKm2 - 2650.27) < 5)) {
        title = 'Bihar Post-Monsoon Recession';
        band = 'RECESSION';
        dates = '12 Sep → 18 Oct 2026';
        metric = '-2,650.3 km² drained';
        theme = 'purple';
    } else if (id.includes('8b6af') || report.radar_band === 'l' || (areas.permanent_water_km2 && Math.abs(areas.permanent_water_km2 - 3978.67) < 10)) {
        title = 'Bihar Ganga LSAR (L-Band Alone)';
        band = 'L-BAND';
        dates = '31 Aug → 12 Sep 2026';
        metric = '+1,173.6 km² gain (Penetration)';
        theme = 'amber';
    } else if (id.includes('32db2') || report.radar_band === 's' || (areas.permanent_water_km2 && Math.abs(areas.permanent_water_km2 - 2695.48) < 10)) {
        title = 'Bihar Ganga SSAR (S-Band Alone)';
        band = 'S-BAND';
        dates = '31 Aug → 12 Sep 2026';
        metric = '+1,192.4 km² gain (Surface)';
        theme = 'sky';
    } else {
        if (job.status === 'running') {
            metric = 'Processing swath in progress...';
            theme = 'amber';
        } else if (job.status === 'failed') {
            metric = 'Run execution failed';
            theme = 'rose';
        } else if (floodKm2) {
            metric = `+${floodKm2.toFixed(1)} km² flood area`;
        }
    }

    return { title, band, dates, metric, theme };
}

export default function RunHistorySidebar({ profile = 'flood', activeView = 'map', onCancel }) {
    const [collapsed, setCollapsed] = useState(false);
    const [hoveredId, setHoveredId] = useState(null);

    const jobs = useJobStore(state => state.jobs);
    const activeJobId = useJobStore(state => state.activeJobId);
    const setActiveJobId = useJobStore(state => state.setActiveJobId);
    const setTerminalOpen = useJobStore(state => state.setTerminalOpen);

    const viewingResult = useMapStore(state => state.viewingResult);
    const setViewingResult = useMapStore(state => state.setViewingResult);
    const setFlyToCenter = useMapStore(state => state.setFlyToCenter);

    // Only render on flood profile map view
    if (profile !== 'flood' || activeView !== 'map') {
        return null;
    }

    const jobList = Object.values(jobs).sort((a, b) => {
        const idxA = CANONICAL_ORDER.indexOf(a.id);
        const idxB = CANONICAL_ORDER.indexOf(b.id);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return (b.startedAt || 0) - (a.startedAt || 0);
    });

    const handleJobClick = (job) => {
        setActiveJobId(job.id);

        if (job.status === 'running' || job.status === 'failed') {
            setTerminalOpen(true);
            return;
        }

        if (job.status === 'completed' && job.output_path) {
            const jobResult = {
                id: job.id,
                url: api(job.output_path),
                bounds: job.bounds,
                bbox: job.bbox,
                floodReport: job.floodReport,
                floodGeoJson: job.floodGeoJson,
                floodReportPath: job.floodReportPath,
                floodGeoJsonPath: job.floodGeoJsonPath,
                floodBaselinePath: job.floodBaselinePath,
                floodActivePath: job.floodActivePath,
                floodReplayAvailable: job.floodReplayAvailable,
                pipeline: job.pipeline || 'flood',
                elapsed: job.elapsed,
            };
            setViewingResult(jobResult);

            if (job.bounds && job.bounds.length === 2) {
                const [[south, west], [north, east]] = job.bounds;
                if (Number.isFinite(south) && Number.isFinite(north) && Number.isFinite(west) && Number.isFinite(east)) {
                    setFlyToCenter([(south + north) / 2, (west + east) / 2]);
                }
            }
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="flood-run-history"
            style={{
                position: 'relative',
                width: '100%',
                boxSizing: 'border-box',
                fontFamily: MONO,
                overflow: 'hidden',
            }}
        >
            {/* Header (collapsible toggle) */}
            <div
                onClick={() => setCollapsed(prev => !prev)}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 4px 10px',
                    cursor: 'pointer',
                    userSelect: 'none',
                }}
            >
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '10px',
                    color: C.textDim,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    fontWeight: 700,
                }}>
                    <History size={12} color={C.accent.flood} />
                    <span>NISAR SCENES & PASSES</span>
                    <span style={{
                        fontSize: '9px',
                        color: C.accent.flood,
                        background: 'rgba(15, 150, 156, 0.15)',
                        padding: '1px 5px',
                        borderRadius: '3px',
                        fontWeight: 600,
                    }}>
                        {jobList.length}
                    </span>
                </div>
                <button
                    style={{
                        background: 'none',
                        border: 'none',
                        color: C.textDim,
                        cursor: 'pointer',
                        padding: 0,
                        display: 'flex',
                        alignItems: 'center'
                    }}
                >
                    {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                </button>
            </div>

            {/* Collapsible List Container */}
            <AnimatePresence>
                {!collapsed && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px',
                            maxHeight: '380px',
                            overflowY: 'auto',
                            paddingRight: '2px',
                        }}
                    >
                        {jobList.length === 0 ? (
                            <div style={{
                                padding: '16px 12px',
                                fontSize: '10px',
                                color: C.textDim,
                                textAlign: 'center',
                                letterSpacing: '0.04em'
                            }}>
                                NO SCENES RECORDED
                            </div>
                        ) : (
                            jobList.map((job) => {
                                const isHovered = hoveredId === job.id;
                                const isActive = activeJobId === job.id || viewingResult?.id === job.id;
                                const meta = getJobMeta(job);
                                const theme = THEME_STYLES[meta.theme] || THEME_STYLES.emerald;
                                const isRunning = job.status === 'running';

                                return (
                                    <div
                                        key={job.id}
                                        onClick={() => handleJobClick(job)}
                                        onMouseEnter={() => setHoveredId(job.id)}
                                        onMouseLeave={() => setHoveredId(null)}
                                        className={`flood-run-card ${isActive ? 'is-active' : ''}`}
                                        style={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '5px',
                                            padding: '10px 12px',
                                            borderRadius: '10px',
                                            background: isActive
                                                ? theme.activeBg
                                                : isHovered
                                                    ? 'rgba(255, 255, 255, 0.05)'
                                                    : 'rgba(255, 255, 255, 0.02)',
                                            border: isActive
                                                ? `1px solid ${theme.activeBorder}`
                                                : isHovered
                                                    ? '1px solid rgba(255, 255, 255, 0.18)'
                                                    : '1px solid rgba(255, 255, 255, 0.07)',
                                            boxShadow: isActive ? theme.activeGlow : 'none',
                                            cursor: 'pointer',
                                            transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
                                            position: 'relative',
                                            userSelect: 'none',
                                            boxSizing: 'border-box',
                                        }}
                                    >
                                        {/* Top row: Band badge + Dates + Cancel action */}
                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            gap: '8px',
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <span style={{
                                                    width: '6px',
                                                    height: '6px',
                                                    borderRadius: '50%',
                                                    background: isRunning ? '#E6A817' : theme.dot,
                                                    boxShadow: isRunning ? '0 0 6px #E6A817' : `0 0 5px ${theme.dot}`,
                                                    display: 'inline-block',
                                                    flexShrink: 0,
                                                }} />
                                                <span style={{
                                                    fontSize: '9px',
                                                    fontWeight: 700,
                                                    letterSpacing: '0.06em',
                                                    padding: '2px 6px',
                                                    borderRadius: '4px',
                                                    background: theme.badgeBg,
                                                    color: theme.badgeText,
                                                    border: `1px solid ${theme.badgeBorder}`,
                                                    lineHeight: 1.2,
                                                    textTransform: 'uppercase',
                                                }}>
                                                    {meta.band}
                                                </span>
                                            </div>

                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <span style={{
                                                    fontSize: '9px',
                                                    color: 'rgba(255, 255, 255, 0.55)',
                                                    letterSpacing: '0.02em',
                                                    whiteSpace: 'nowrap',
                                                    fontWeight: 500,
                                                }}>
                                                    {meta.dates}
                                                </span>
                                                {isRunning && onCancel && (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); onCancel(job.id); }}
                                                        title="Cancel running job"
                                                        style={{
                                                            background: 'none',
                                                            border: 'none',
                                                            color: C.critical,
                                                            cursor: 'pointer',
                                                            padding: '1px',
                                                            display: 'flex',
                                                            alignItems: 'center'
                                                        }}
                                                    >
                                                        <X size={12} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {/* Middle row: Descriptive Title */}
                                        <div style={{
                                            fontSize: '11px',
                                            fontWeight: isActive ? 600 : 500,
                                            color: isActive ? '#FFFFFF' : isHovered ? '#F3F4F6' : '#E5E7EB',
                                            lineHeight: 1.35,
                                            wordBreak: 'break-word',
                                        }}>
                                            {meta.title}
                                        </div>

                                        {/* Bottom row: Quantitative Impact / Metric + Active Indicator */}
                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            paddingTop: '3px',
                                            borderTop: '1px solid rgba(255, 255, 255, 0.04)',
                                        }}>
                                            <span style={{
                                                fontSize: '10px',
                                                fontFamily: MONO,
                                                fontWeight: 600,
                                                color: theme.metricColor,
                                                letterSpacing: '0.02em',
                                            }}>
                                                {meta.metric}
                                            </span>

                                            {isActive && (
                                                <span style={{
                                                    fontSize: '8px',
                                                    fontWeight: 700,
                                                    letterSpacing: '0.08em',
                                                    color: theme.badgeText,
                                                    background: theme.badgeBg,
                                                    padding: '1px 5px',
                                                    borderRadius: '3px',
                                                    border: `1px solid ${theme.badgeBorder}`,
                                                    textTransform: 'uppercase',
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '3px',
                                                }}>
                                                    <CheckCircle2 size={9} />
                                                    ACTIVE
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}
