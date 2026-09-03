import React from 'react';
import { Map, TrendingUp, Layers, FileCode, Cpu, HardDrive, Settings } from 'lucide-react';
import { motion } from 'framer-motion';
import { MONO, SANS, C, TM } from '../constants';

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
        width: `${TM.side}px`,
        background: '#0a0a0a',
        borderRight: '1px solid rgba(255, 255, 255, 0.08)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        userSelect: 'none',
        height: '100%',
        boxSizing: 'border-box',
        overflow: 'hidden'
    };

    const sectionTitleStyle = {
        fontFamily: MONO,
        fontSize: '9px',
        fontWeight: 500,
        letterSpacing: '0.16em',
        textTransform: 'uppercase',
        color: 'rgba(237, 237, 237, 0.32)',
        padding: '0 8px 8px 8px',
    };

    const navButtonStyle = (isActive) => ({
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        padding: '8px 10px',
        border: '1px solid transparent',
        borderRadius: '2px',
        background: 'transparent',
        color: 'rgba(237, 237, 237, 0.55)',
        fontFamily: SANS,
        fontSize: '12px',
        fontWeight: 400,
        letterSpacing: '-0.01em',
        cursor: 'pointer',
        boxSizing: 'border-box',
        marginBottom: '4px',
        textAlign: 'left',
        outline: 'none',
    });

    return (
        <aside style={sidebarStyle}>
            <div style={{ flex: 1, overflowY: 'auto', padding: '14px 10px', display: 'flex', flexDirection: 'column', gap: '22px' }}>
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
                                    animate={{
                                        color: isActive ? C.accent.flood : 'rgba(237, 237, 237, 0.55)',
                                        background: isActive ? 'rgba(15, 150, 156, 0.14)' : 'rgba(255, 255, 255, 0.0)',
                                        borderColor: isActive ? 'rgba(15, 150, 156, 0.35)' : 'rgba(255, 255, 255, 0.0)'
                                    }}
                                    whileHover={{ 
                                        color: isActive ? C.accent.flood : '#ffffff', 
                                        background: isActive ? 'rgba(15, 150, 156, 0.14)' : 'rgba(255, 255, 255, 0.03)',
                                        borderColor: isActive ? 'rgba(15, 150, 156, 0.35)' : 'rgba(255, 255, 255, 0.08)'
                                    }}
                                    whileTap={{ scale: 0.98 }}
                                    transition={{ duration: 0.15 }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <Icon size={13} style={{ opacity: isActive ? 1 : 0.65, color: isActive ? C.accent.flood : 'inherit' }} />
                                        <span>{item.label}</span>
                                    </div>
                                    <span style={{ 
                                        fontFamily: MONO, 
                                        fontSize: '9px', 
                                        color: isActive ? 'rgba(15, 150, 156, 0.55)' : 'rgba(237, 237, 237, 0.32)',
                                        letterSpacing: '0.04em'
                                    }}>
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
                                    animate={{
                                        color: isActive ? C.accent.flood : 'rgba(237, 237, 237, 0.55)',
                                        background: isActive ? 'rgba(15, 150, 156, 0.14)' : 'rgba(255, 255, 255, 0.0)',
                                        borderColor: isActive ? 'rgba(15, 150, 156, 0.35)' : 'rgba(255, 255, 255, 0.0)'
                                    }}
                                    whileHover={{ 
                                        color: isActive ? C.accent.flood : '#ffffff', 
                                        background: isActive ? 'rgba(15, 150, 156, 0.14)' : 'rgba(255, 255, 255, 0.03)',
                                        borderColor: isActive ? 'rgba(15, 150, 156, 0.35)' : 'rgba(255, 255, 255, 0.08)'
                                    }}
                                    whileTap={{ scale: 0.98 }}
                                    transition={{ duration: 0.15 }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <Icon size={13} style={{ opacity: isActive ? 1 : 0.65, color: isActive ? C.accent.flood : 'inherit' }} />
                                        <span>{item.label}</span>
                                    </div>
                                    <span style={{ 
                                        fontFamily: MONO, 
                                        fontSize: '9px', 
                                        color: isActive ? 'rgba(15, 150, 156, 0.55)' : 'rgba(237, 237, 237, 0.32)',
                                        letterSpacing: '0.04em'
                                    }}>
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
                padding: '10px 12px',
                borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                fontFamily: MONO,
                fontSize: '9px',
                color: 'rgba(237, 237, 237, 0.32)',
                display: 'flex',
                flexDirection: 'column',
                gap: '3px',
                flexShrink: 0
            }}>
                <span>Pipeline <strong style={{ color: C.accent.flood, fontWeight: 500 }}>Rust v3.2</strong></span>
                <span>Sensor <strong style={{ color: 'rgba(237, 237, 237, 0.55)', fontWeight: 500 }}>NISAR L-HH</strong></span>
                <span>Latency <strong style={{ color: 'rgba(237, 237, 237, 0.55)', fontWeight: 500 }}>0.42 sec</strong></span>
            </div>
        </aside>
    );
}

