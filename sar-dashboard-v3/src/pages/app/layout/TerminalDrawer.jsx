import React, { useRef, useEffect } from 'react';
import { Terminal, X } from 'lucide-react';
import { MONO, C, TM, INFRA_LAYOUT } from '../constants';
import { useJobStore } from '../stores/useJobStore';
import { useMapStore } from '../stores/useMapStore';

export default function TerminalDrawer({ profile, activeView = 'map', onCancel }) {
    const logs = useJobStore(state => state.logs);
    const activeJobId = useJobStore(state => state.activeJobId);
    const jobs = useJobStore(state => state.jobs);
    const terminalOpen = useJobStore(state => state.terminalOpen);
    const setTerminalOpen = useJobStore(state => state.setTerminalOpen);
    const viewingResult = useMapStore(state => state.viewingResult);

    const terminalRef = useRef(null);
    const userScrolledUp = useRef(false);

    const activeJob = activeJobId ? jobs[activeJobId] : null;
    const currentLogs = activeJobId ? logs[activeJobId] || [] : [];

    const handleTerminalScroll = () => {
        if (!terminalRef.current) return;
        const el = terminalRef.current;
        userScrolledUp.current = !(el.scrollHeight - el.scrollTop - el.clientHeight < 40);
    };

    // Auto-scroll to bottom when new logs arrive if user hasn't scrolled up
    useEffect(() => {
        if (terminalRef.current && !userScrolledUp.current) {
            terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
        }
    }, [currentLogs.length]);

    return (
        <>
            {/* ═══ TERMINAL DRAWER ═══ */}
            <div className={`nisar-terminal-drawer ${terminalOpen ? 'is-open' : 'is-closed'}`} style={{
                position: 'absolute',
                bottom: profile === 'infrastructure' ? `${INFRA_LAYOUT.bottom}px` : 0,
                left: profile === 'infrastructure' ? `${INFRA_LAYOUT.left}px` : profile === 'flood' ? `${TM.side}px` : 0,
                    right: (profile === 'infrastructure' || (profile === 'flood' && activeView !== 'map')) ? 0 : `${TM.panel}px`,
                zIndex: 1000,
                height: terminalOpen ? '240px' : '0px',
                transition: 'height 200ms ease', overflow: 'hidden',
                background: 'rgba(10, 10, 10, 0.9)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
                borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                display: 'flex', flexDirection: 'column'
            }}>
                <div className="nisar-terminal-header" style={{ height: '36px', background: '#111111', borderBottom: '1px solid #2A2A2A', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 16px', flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Terminal size={14} color="#888888" />
                        <span style={{ fontFamily: MONO, fontSize: '10px', color: '#555555' }}>PROCESSING LOG</span>
                        {activeJob?.status === 'running' && (
                            <span style={{ fontFamily: MONO, fontSize: '9px', color: '#E6A817', border: '1px solid #E6A817', padding: '1px 4px', borderRadius: '2px' }}>LIVE</span>
                        )}
                        {currentLogs.length > 0 && (
                            <span style={{ fontFamily: MONO, fontSize: '10px', color: '#555555', marginLeft: '4px' }}>{currentLogs.length} LINES</span>
                        )}
                        {activeJob?.status === 'running' && onCancel && (
                            <button
                                onClick={() => onCancel(activeJob.id)}
                                style={{
                                    marginLeft: '8px',
                                    padding: '2px 8px',
                                    background: 'transparent',
                                    border: '1px solid rgba(192, 57, 43, 0.7)',
                                    color: '#C0392B',
                                    fontFamily: MONO,
                                    fontSize: '9px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    borderRadius: '2px',
                                }}
                                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(192, 57, 43, 0.15)'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                                title="Send cancel request to the gateway"
                            >✕ CANCEL</button>
                        )}
                    </div>
                    <button onClick={() => setTerminalOpen(false)} style={{ background: 'none', border: 'none', color: '#555555', cursor: 'pointer', padding: '4px' }}
                        onMouseEnter={e => e.currentTarget.style.color = '#F0F0F0'} onMouseLeave={e => e.currentTarget.style.color = '#555555'}>
                        <X size={14} />
                    </button>
                </div>
                <div className="nisar-terminal-log" ref={terminalRef} onScroll={handleTerminalScroll} style={{ flex: 1, padding: '12px 16px', overflowY: 'auto', fontFamily: MONO, fontSize: '11px', lineHeight: 1.7 }}>
                    {currentLogs.length === 0 ? (
                        <div style={{ color: '#555555' }}>
                            {!activeJobId ? 'NO ACTIVE JOB SELECTED — START A RUN OR SELECT FROM RECENT RUNS' : 'WAITING FOR PROCESSOR OUTPUT'}
                        </div>
                    ) : (
                        currentLogs.map((line, idx) => {
                            let displayLine = line;
                            let isErr = line.includes('ERROR') || line.includes('FAILED') || line.includes('Failed');
                            let isSucc = line.includes('COMPLETED') || line.includes('✓') || line.includes('COMPLETE');
                            let isSys = line.includes('[SYSTEM]');
                            let isCfar = line.includes('CFAR') || line.includes('ship') || line.includes('vessel');
                            let isInSar = line.includes('InSAR') || line.includes('phase');
                            
                            if (line.startsWith('{')) {
                                try {
                                    const parsed = JSON.parse(line);
                                    if (parsed.event === 'progress') {
                                        displayLine = `[${parsed.stage}] ${parsed.message}`;
                                        if (parsed.stage === 'COMPLETE') isSucc = true;
                                        else if (parsed.stage === 'FAILED') isErr = true;
                                        else isSys = true;
                                    } else if (parsed.event === 'georef') {
                                        displayLine = `[SYSTEM] Georeferencing bounding box: ${JSON.stringify(parsed.bbox)}`;
                                        isSys = true;
                                    } else if (parsed.event === 'flood_report') {
                                        displayLine = `[SYSTEM] Flood report written successfully.`;
                                        isSys = true;
                                    } else if (parsed.event === 'output') {
                                        displayLine = `[SYSTEM] Classification raster generated: ${parsed.path}`;
                                        isSys = true;
                                    }
                                } catch { void 0; }
                            }
                            
                            const color = isErr ? '#C0392B' : isSucc ? '#4CAF50' : isSys ? '#7EB8D4' : isCfar ? '#E6A817' : isInSar ? '#9B8EC4' : '#555555';
                            return (
                                <div key={idx} style={{ color, wordBreak: 'break-all', paddingLeft: '14px', textIndent: '-14px' }}>
                                    <span style={{ color: '#2A2A2A', marginRight: '6px' }}>›</span>
                                    {displayLine}
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* ═══ MINIMIZED TERMINAL BUTTON ═══ */}
            {!terminalOpen && activeJobId && activeView === 'map' && (
                <button
                    onClick={() => setTerminalOpen(true)}
                    className="nisar-terminal-toggle"
                    style={{
                        position: 'absolute',
                        bottom: (viewingResult?.pipeline === 'flood' && viewingResult.floodReport) ? '40px' : '8px',
                        right: profile === 'infrastructure' ? '12px' : `${TM.panel + 12}px`,
                        zIndex: 960,
                        background: 'rgba(17,17,17,0.9)', border: '1px solid #2A2A2A', borderRadius: '2px',
                        padding: '5px 10px', color: '#888888', fontFamily: MONO, fontSize: '10px',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent.flood; e.currentTarget.style.color = '#F0F0F0'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = '#2A2A2A'; e.currentTarget.style.color = '#888888'; }}
                >
                    <Terminal size={11} /> SHOW LOG
                </button>
            )}
        </>
    );
}
