import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp, History, X } from 'lucide-react';
import { MONO, C } from '../constants';
import { api } from '../../../config/api';
import { useJobStore } from '../stores/useJobStore';
import { useMapStore } from '../stores/useMapStore';

export default function RunHistorySidebar({ profile = 'flood', activeView = 'map', onCancel }) {
    const [collapsed, setCollapsed] = useState(false);
    const [hoveredId, setHoveredId] = useState(null);

    const jobs = useJobStore(state => state.jobs);
    const activeJobId = useJobStore(state => state.activeJobId);
    const setActiveJobId = useJobStore(state => state.setActiveJobId);
    const setTerminalOpen = useJobStore(state => state.setTerminalOpen);

    const setViewingResult = useMapStore(state => state.setViewingResult);
    const setFlyToCenter = useMapStore(state => state.setFlyToCenter);

    // Only render on flood profile map view
    if (profile !== 'flood' || activeView !== 'map') {
        return null;
    }

    const jobList = Object.values(jobs).sort((a, b) => {
        const timeA = a.startedAt || 0;
        const timeB = b.startedAt || 0;
        return timeB - timeA;
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
                setFlyToCenter([(south + north) / 2, (west + east) / 2]);
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
                background: 'rgba(7, 20, 28, 0.96)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                border: '1px solid rgba(66, 198, 213, 0.18)',
                borderRadius: '2px',
                boxSizing: 'border-box',
                fontFamily: MONO,
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
                overflow: 'hidden',
            }}
        >
            {/* Header */}
            <div
                onClick={() => setCollapsed(prev => !prev)}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    borderBottom: collapsed ? 'none' : '1px solid rgba(255, 255, 255, 0.05)',
                    cursor: 'pointer',
                    userSelect: 'none',
                    background: 'rgba(255, 255, 255, 0.01)',
                }}
            >
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '9px',
                    color: C.textDim,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    fontWeight: 700,
                }}>
                    <History size={11} color={C.accent.flood} />
                    <span>RECENT RUNS</span>
                    <span style={{
                        fontSize: '8px',
                        color: C.accent.flood,
                        background: 'rgba(15, 150, 156, 0.15)',
                        padding: '1px 4px',
                        borderRadius: '2px'
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
                    {collapsed ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
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
                            maxHeight: '220px',
                            overflowY: 'auto',
                            display: 'flex',
                            flexDirection: 'column',
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
                                NO RUNS RECORDED
                            </div>
                        ) : (
                            jobList.map((job) => {
                                const isHovered = hoveredId === job.id;
                                const isActive = activeJobId === job.id;

                                const isCompleted = job.status === 'completed';
                                const isRunning = job.status === 'running';

                                const dotColor = isCompleted
                                    ? C.stable
                                    : isRunning
                                        ? '#E6A817'
                                        : C.critical;

                                const timeLabel = job.startedAt
                                    ? new Date(job.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                    : 'HIST';

                                const displayTitle = job.name || job.id.slice(0, 10);

                                return (
                                    <div
                                        key={job.id}
                                        onClick={() => handleJobClick(job)}
                                        onMouseEnter={() => setHoveredId(job.id)}
                                        onMouseLeave={() => setHoveredId(null)}
                                        className="flood-run-card"
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            padding: '8px 12px',
                                            cursor: 'pointer',
                                            borderBottom: '1px solid rgba(255, 255, 255, 0.03)',
                                            borderLeft: (isHovered || isActive)
                                                ? `2px solid ${C.accent.flood}`
                                                : '2px solid transparent',
                                            background: (isHovered || isActive)
                                                ? 'rgba(255, 255, 255, 0.03)'
                                                : 'transparent',
                                            transition: 'all 120ms ease',
                                            userSelect: 'none',
                                            boxSizing: 'border-box',
                                        }}
                                    >
                                        {/* Status Dot + Name */}
                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            minWidth: 0,
                                            flex: 1,
                                        }}>
                                            <span style={{
                                                width: '6px',
                                                height: '6px',
                                                borderRadius: '50%',
                                                background: dotColor,
                                                display: 'inline-block',
                                                flexShrink: 0,
                                                boxShadow: isRunning
                                                    ? '0 0 6px #E6A817'
                                                    : isCompleted
                                                        ? `0 0 4px ${C.stable}`
                                                        : 'none',
                                            }} />
                                            <span style={{
                                                fontSize: '10px',
                                                color: (isHovered || isActive) ? C.text : C.textMid,
                                                whiteSpace: 'nowrap',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                fontWeight: isActive ? 600 : 400,
                                            }}
                                                title={job.name || job.id}
                                            >
                                                {displayTitle}
                                            </span>
                                        </div>

                                        {/* Cancel action for running jobs */}
                                        {isRunning && onCancel && (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); onCancel(job.id); }}
                                                title="Cancel job"
                                                style={{
                                                    background: 'none',
                                                    border: 'none',
                                                    color: C.critical,
                                                    cursor: 'pointer',
                                                    padding: '2px',
                                                    flexShrink: 0,
                                                    marginLeft: '4px',
                                                    display: 'flex',
                                                    alignItems: 'center'
                                                }}
                                            >
                                                <X size={12} />
                                            </button>
                                        )}

                                        {/* Timestamp badge */}
                                        <span style={{
                                            fontSize: '8px',
                                            color: C.textDim,
                                            marginLeft: '6px',
                                            flexShrink: 0,
                                            letterSpacing: '0.04em'
                                        }}>
                                            {timeLabel}
                                        </span>
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
