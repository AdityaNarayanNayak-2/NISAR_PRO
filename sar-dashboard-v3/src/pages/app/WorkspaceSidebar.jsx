import React from 'react';
import { Map, TrendingUp, Layers, FileCode, Cpu, HardDrive, Settings } from 'lucide-react';
import { MONO, SANS, C } from './constants';

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
        background: '#0c1015',
        borderRight: '1px solid #1a212b',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        flexShrink: 0,
        userSelect: 'none',
        padding: '16px 0',
        height: '100%',
        boxSizing: 'border-box'
    };

    const sectionTitleStyle = {
        padding: '0 16px 6px 16px',
        fontSize: '9px',
        fontFamily: MONO,
        letterSpacing: '0.12em',
        color: '#475569',
        textTransform: 'uppercase',
        fontWeight: 'bold'
    };

    const navButtonStyle = (isActive) => ({
        width: 'calc(100% - 16px)',
        marginLeft: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 12px',
        border: isActive ? '1px solid #202c3d' : '1px solid transparent',
        background: isActive ? '#151c26' : 'transparent',
        color: isActive ? C.accent.flood : '#8a99ad',
        fontFamily: MONO,
        fontSize: '11px',
        cursor: 'pointer',
        borderRadius: '3px',
        outline: 'none',
        transition: 'all 0.15s ease',
        boxSizing: 'border-box',
        marginBottom: '2px',
        textAlign: 'left'
    });

    const handleHoverEnter = (e, isActive) => {
        if (!isActive) {
            e.currentTarget.style.color = '#e2e8f0';
            e.currentTarget.style.background = '#111720';
        }
    };

    const handleHoverLeave = (e, isActive) => {
        if (!isActive) {
            e.currentTarget.style.color = '#8a99ad';
            e.currentTarget.style.background = 'transparent';
        }
    };

    return (
        <aside style={sidebarStyle}>
            {/* Navigation Lists */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* Workspace navigation */}
                <div>
                    <div style={sectionTitleStyle}>WORKSPACE</div>
                    <nav style={{ display: 'flex', flexDirection: 'column' }}>
                        {mainNavItems.map(item => {
                            const Icon = item.icon;
                            const isActive = activeView === item.id;
                            return (
                                <button
                                    key={item.id}
                                    onClick={() => {
                                        if (item.id === 'reports') {
                                            onOpenReport();
                                        } else {
                                            onSelectView(item.id);
                                        }
                                    }}
                                    style={navButtonStyle(isActive)}
                                    onMouseEnter={e => handleHoverEnter(e, isActive)}
                                    onMouseLeave={e => handleHoverLeave(e, isActive)}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <Icon size={12} style={{ color: isActive ? C.accent.flood : '#64748b' }} />
                                        <span>{item.label}</span>
                                    </div>
                                    <span style={{ fontSize: '9px', color: isActive ? `${C.accent.flood}90` : '#334155' }}>
                                        {item.key}
                                    </span>
                                </button>
                            );
                        })}
                    </nav>
                </div>

                {/* System Navigation */}
                <div>
                    <div style={sectionTitleStyle}>SYSTEM</div>
                    <nav style={{ display: 'flex', flexDirection: 'column' }}>
                        {systemNavItems.map(item => {
                            const Icon = item.icon;
                            const isActive = activeView === item.id;
                            return (
                                <button
                                    key={item.id}
                                    onClick={() => onSelectView(item.id)}
                                    style={navButtonStyle(isActive)}
                                    onMouseEnter={e => handleHoverEnter(e, isActive)}
                                    onMouseLeave={e => handleHoverLeave(e, isActive)}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <Icon size={12} style={{ color: isActive ? C.accent.flood : '#64748b' }} />
                                        <span>{item.label}</span>
                                    </div>
                                    <span style={{ fontSize: '9px', color: isActive ? `${C.accent.flood}90` : '#334155' }}>
                                        {item.key}
                                    </span>
                                </button>
                            );
                        })}
                    </nav>
                </div>
            </div>

            {/* Footer System Status Panel */}
            <div style={{
                padding: '12px 16px 0 16px',
                borderTop: '1px solid #18202a',
                fontFamily: MONO,
                fontSize: '10px',
                color: '#475569',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>PIPELINE:</span>
                    <span style={{ color: gatewayOnline ? C.stable : C.critical, fontWeight: 'bold' }}>RUST v3.2</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>SENSOR:</span>
                    <span style={{ color: '#94a3b8' }}>NISAR L-HH</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>LATENCY:</span>
                    <span style={{ color: '#94a3b8' }}>0.42 SEC</span>
                </div>
            </div>
        </aside>
    );
}
