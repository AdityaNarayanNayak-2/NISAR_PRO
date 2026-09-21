import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText } from 'lucide-react';
import { MONO, SANS, C, PROFILES } from '../constants';
import { parseFloodReport } from '../flood/floodReportHelpers';
import { useGatewayStore } from '../stores/useGatewayStore';
import { useJobStore } from '../stores/useJobStore';
import { useMapStore } from '../stores/useMapStore';

export default function TopBar({ profile, setProfile, onOpenReport }) {
    const gatewayOnline = useGatewayStore(state => state.gatewayOnline);
    const terminalOpen = useJobStore(state => state.terminalOpen);
    const setTerminalOpen = useJobStore(state => state.setTerminalOpen);
    const viewingResult = useMapStore(state => state.viewingResult);

    const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
    const [utcTime, setUtcTime] = useState('');

    const activeProfile = PROFILES[profile] || PROFILES.infrastructure;

    // UTC clock
    useEffect(() => {
        const tick = () => {
            const n = new Date();
            const d = n.toISOString().slice(0, 10);
            const t = n.toISOString().slice(11, 19);
            setUtcTime(`${d} · ${t} UTC`);
        };
        tick();
        const i = setInterval(tick, 1000);
        return () => clearInterval(i);
    }, []);

    // Close dropdown on outside click
    useEffect(() => {
        if (!profileDropdownOpen) return;
        const handler = () => setProfileDropdownOpen(false);
        document.addEventListener('click', handler);
        return () => document.removeEventListener('click', handler);
    }, [profileDropdownOpen]);

    const ribbonData = (profile === 'flood' && viewingResult && viewingResult.pipeline === 'flood' && viewingResult.floodReport)
        ? parseFloodReport(viewingResult.floodReport)
        : null;

    return (
        <header style={{
            position: 'fixed', top: 0, left: 0, right: 0, height: '42px', zIndex: 1100,
            background: 'rgba(17, 17, 17, 0.82)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
            borderTop: `2px solid ${activeProfile.accent}`,
            borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '0 16px',
        }}>
            {/* Left: Title + Profile Switcher */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0' }}>
                <span style={{ fontFamily: SANS, fontWeight: 600, fontSize: '13px', color: C.text, marginRight: '12px' }}>
                    NISAR PRO
                </span>
                <div style={{ width: '1px', height: '20px', background: C.bg3, marginRight: '12px' }} />

                {/* Profile Switcher */}
                <div style={{ position: 'relative' }}>
                    <button
                        onClick={(e) => { e.stopPropagation(); setProfileDropdownOpen(prev => !prev); }}
                        style={{
                            background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px',
                            fontFamily: MONO, fontSize: '11px', letterSpacing: '0.08em',
                            color: activeProfile.accent,
                            display: 'flex', alignItems: 'center', gap: '6px',
                        }}
                    >
                        {activeProfile.label} ▾
                    </button>

                    {/* Dropdown */}
                    <AnimatePresence>
                        {profileDropdownOpen && (
                            <motion.div
                                initial={{ opacity: 0, y: -8, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: -8, scale: 0.95 }}
                                transition={{ type: 'spring', stiffness: 350, damping: 25 }}
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                    position: 'absolute', top: '32px', left: 0, zIndex: 300,
                                    background: C.bg1, border: `1px solid ${C.bg3}`,
                                    borderRadius: '2px', minWidth: '180px',
                                    boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                                }}
                            >
                                {Object.values(PROFILES).map(p => (
                                    <button
                                        key={p.id}
                                        onClick={() => { setProfile(p.id); setProfileDropdownOpen(false); }}
                                        style={{
                                            display: 'block', width: '100%', textAlign: 'left',
                                            padding: '8px 12px', border: 'none', cursor: 'pointer',
                                            fontFamily: MONO, fontSize: '11px', letterSpacing: '0.08em',
                                            background: profile === p.id ? C.bg2 : C.bg1,
                                            color: profile === p.id ? p.accent : C.textMid,
                                            borderLeft: profile === p.id ? `3px solid ${p.accent}` : '3px solid transparent',
                                        }}
                                        onMouseEnter={(e) => { if (profile !== p.id) e.target.style.background = C.bg2; }}
                                        onMouseLeave={(e) => { if (profile !== p.id) e.target.style.background = C.bg1; }}
                                    >
                                        {p.label}
                                    </button>
                                ))}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* Center: Metadata Ribbon or Terminal Toggle */}
            {ribbonData ? (
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    fontFamily: MONO,
                    fontSize: '11px',
                    color: C.textMid,
                    letterSpacing: '0.05em'
                }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: C.text }}>
                        <span style={{
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            background: C.accent.flood,
                            display: 'inline-block',
                            boxShadow: `0 0 8px ${C.accent.flood}`
                        }} />
                        {ribbonData.location.toUpperCase()}
                    </span>
                    <span style={{ color: C.bg4 }}>|</span>
                    <span>ACTIVE: <span style={{ color: C.text }}>{ribbonData.activeDate.toUpperCase()}</span></span>
                    <span style={{ color: C.bg4 }}>|</span>
                    <span>BASELINE: <span style={{ color: C.text }}>{ribbonData.baselineDate.toUpperCase()}</span></span>
                    <span style={{ color: C.bg4 }}>|</span>
                    <span>CHANGE: <span style={{ color: C.accent.flood, fontWeight: 'bold' }}>{ribbonData.totalFloodAcres.toFixed(2)} ACRES</span></span>
                    <span style={{ color: C.bg4 }}>|</span>
                    <span>GRID: <span style={{ color: C.text }}>{ribbonData.gridLabel}</span></span>
                    <span style={{ color: C.bg4 }}>|</span>
                    <span>EPSG: <span style={{ color: C.text }}>{ribbonData.epsg.includes('EPSG:') ? ribbonData.epsg.split('EPSG:')[1] : '32644'}</span></span>
                </div>
            ) : (
                <button
                    onClick={() => setTerminalOpen(prev => !prev)}
                    style={{
                        background: 'transparent', border: 'none', cursor: 'pointer',
                        fontFamily: MONO, fontSize: '10px', letterSpacing: '0.08em',
                        color: terminalOpen ? C.accent.infra : C.textDim,
                    }}
                >
                    {terminalOpen ? '▼ TERMINAL' : 'TERMINAL'}
                </button>
            )}

            {/* Right: Status + Clock + Home */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {ribbonData && (
                    <>
                        <button
                            onClick={onOpenReport}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                background: 'rgba(42, 139, 145, 0.1)',
                                border: '1px solid rgba(42, 139, 145, 0.3)',
                                color: C.accent.flood,
                                fontFamily: MONO,
                                fontSize: '10px',
                                fontWeight: 'bold',
                                padding: '4px 8px',
                                borderRadius: '2px',
                                cursor: 'pointer',
                                outline: 'none',
                                transition: 'all 0.2s',
                            }}
                            onMouseEnter={e => e.target.style.background = 'rgba(42, 139, 145, 0.2)'}
                            onMouseLeave={e => e.target.style.background = 'rgba(42, 139, 145, 0.1)'}
                        >
                            <FileText size={12} />
                            <span>VIEW ANALYSIS REPORT</span>
                        </button>
                        <div style={{ width: '1px', height: '16px', background: C.bg3 }} />
                    </>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontFamily: MONO, fontSize: '11px', color: C.textMid }}>
                    <div style={{
                        width: '6px', height: '6px', borderRadius: '50%',
                        background: gatewayOnline ? C.stable : C.critical,
                    }} />
                    {gatewayOnline ? 'ONLINE' : 'OFFLINE'}
                </div>
                <div style={{ width: '1px', height: '16px', background: C.bg3 }} />
                <span style={{ fontFamily: MONO, fontSize: '11px', color: C.textDim }}>{utcTime}</span>
                <div style={{ width: '1px', height: '16px', background: C.bg3 }} />
                <a href="/" style={{ fontFamily: MONO, fontSize: '11px', color: C.textDim, textDecoration: 'none' }}>← HOME</a>
            </div>
        </header>
    );
}
