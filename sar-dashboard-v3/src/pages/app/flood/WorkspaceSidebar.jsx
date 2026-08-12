import React from 'react';
import { Map, TrendingUp, Layers, FileCode, Cpu, HardDrive, Settings } from 'lucide-react';
import { motion } from 'framer-motion';
import { MONO, SANS, C } from '../constants';

export default function WorkspaceSidebar({ activeView, onSelectView, onOpenReport, gatewayOnline }) {
    const mainNavItems = [
        { id: 'map', label: 'Map', icon: Map, key: 'M' },
        { id: 'timeseries', label: 'Time Series', icon: TrendingUp, key: 'T' },
        { id: 'regions', label: 'Regions', icon: Layers, key: 'R' },
        { id: 'reports', label: 'Reports', icon: FileCode, key: 'E' },
    ];

    const systemNavItems = [
        { id: 'processing', label: 'Processing', icon: Cpu, key: 'P' },
        { id: 'data', label: 'Data', icon: HardDrive, key: 'D' },
        { id: 'settings', label: 'Settings', icon: Settings, key: 'S' },
    ];

    const sidebarStyle = {
        width: '180px',
        background: 'rgba(12, 16, 21, 0.75)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderRight: '1px solid rgba(255, 255, 255, 0.06)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        flexShrink: 0,
        userSelect: 'none',
        padding: '20px 0',
        height: '100%',
        boxSizing: 'border-box',
        boxShadow: 'inset -1px 0 0 rgba(255, 255, 255, 0.01)',
    };

    const sectionTitleStyle = {
        padding: '0 18px 8px 18px',
        fontSize: '9px',
        fontFamily: MONO,
        letterSpacing: '0.15em',
        color: C.textDim,
        textTransform: 'uppercase',
        fontWeight: 'bold',
        opacity: 0.8
    };

    const navButtonStyle = (isActive) => ({
        width: 'calc(100% - 16px)',
        marginLeft: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 12px',
        border: isActive ? '1px solid rgba(42, 139, 145, 0.25)' : '1px solid transparent',
        background: isActive ? 'rgba(42, 139, 145, 0.08)' : 'transparent',
        color: isActive ? C.accent.flood : '#8a99ad',
        fontFamily: MONO,
        fontSize: '11px',
        cursor: 'pointer',
        borderRadius: '2px',
        outline: 'none',
        boxSizing: 'border-box',
        marginBottom: '4px',
        textAlign: 'left',
        position: 'relative',
        overflow: 'hidden'
    });

    return (
        <aside style={sidebarStyle}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {/* Workspace Nav */}
                <div>
                    <div style={sectionTitleStyle}>WORKSPACE</div>
                    <nav style={{ display: 'flex', flexDirection: 'column' }}>
                        {mainNavItems.map(item => {
                            const Icon = item.icon;
                            const isActive = activeView === item.id;
                            return (
                                <motion.button
                                    key={item.id}
                                    onClick={() => {
                                        if (item.id === 'reports') {
                                            onOpenReport();
                                        } else {
                                            onSelectView(item.id);
                                        }
                                    }}
                                    style={navButtonStyle(isActive)}
                                    whileHover={{ scale: 1.01, x: 2, background: isActive ? 'rgba(42, 139, 145, 0.12)' : 'rgba(255, 255, 255, 0.02)', color: isActive ? C.accent.flood : '#ffffff' }}
                                    whileTap={{ scale: 0.98 }}
                                    transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <Icon size={12} style={{ color: isActive ? C.accent.flood : '#55657d' }} />
                                        <span>{item.label}</span>
                                    </div>
                                    <span style={{ fontSize: '9px', color: isActive ? `${C.accent.flood}90` : '#334155', fontFamily: MONO }}>
                                        {item.key}
                                    </span>
                                </motion.button>
                            );
                        })}
                    </nav>
                </div>

                {/* System Nav */}
                <div>
                    <div style={sectionTitleStyle}>SYSTEM</div>
                    <nav style={{ display: 'flex', flexDirection: 'column' }}>
                        {systemNavItems.map(item => {
                            const Icon = item.icon;
                            const isActive = activeView === item.id;
                            return (
                                <motion.button
                                    key={item.id}
                                    onClick={() => onSelectView(item.id)}
                                    style={navButtonStyle(isActive)}
                                    whileHover={{ scale: 1.01, x: 2, background: isActive ? 'rgba(42, 139, 145, 0.12)' : 'rgba(255, 255, 255, 0.02)', color: isActive ? C.accent.flood : '#ffffff' }}
                                    whileTap={{ scale: 0.98 }}
                                    transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <Icon size={12} style={{ color: isActive ? C.accent.flood : '#55657d' }} />
                                        <span>{item.label}</span>
                                    </div>
                                    <span style={{ fontSize: '9px', color: isActive ? `${C.accent.flood}90` : '#334155', fontFamily: MONO }}>
                                        {item.key}
                                    </span>
                                </motion.button>
                            );
                        })}
                    </nav>
                </div>
            </div>

            {/* Footer System Status Panel */}
            <div style={{
                padding: '16px 18px 0 18px',
                borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                fontFamily: MONO,
                fontSize: '10px',
                color: C.textDim,
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>PIPELINE:</span>
                    <span style={{ color: gatewayOnline ? C.stable : C.critical, fontWeight: 'bold' }}>RUST v3.2</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>SENSOR:</span>
                    <span style={{ color: C.textMid }}>NISAR L-HH</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>LATENCY:</span>
                    <span style={{ color: C.textMid }}>0.42 SEC</span>
                </div>
            </div>
        </aside>
    );
}
