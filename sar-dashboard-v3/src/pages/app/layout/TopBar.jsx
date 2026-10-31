import React, { useEffect, useState } from 'react';
import { ChevronDown, FileText, Search } from 'lucide-react';
import { useGatewayStore } from '../stores/useGatewayStore';
import { useJobStore } from '../stores/useJobStore';
import { useMapStore } from '../stores/useMapStore';
import { PROFILES } from '../constants';
import { parseFloodReport } from '../flood/floodReportHelpers';

const NAV_ITEMS = [
    ['map', 'Live Map'],
    ['timeseries', 'Time Series'],
    ['regions', 'Regions'],
    ['reports', 'Reports'],
    ['processing', 'Processing'],
];

export default function TopBar({ profile, setProfile, onOpenReport, activeView = 'map', onSelectView }) {
    const gatewayOnline = useGatewayStore(state => state.gatewayOnline);
    const terminalOpen = useJobStore(state => state.terminalOpen);
    const setTerminalOpen = useJobStore(state => state.setTerminalOpen);
    const viewingResult = useMapStore(state => state.viewingResult);
    const [profileOpen, setProfileOpen] = useState(false);
    const [utcTime, setUtcTime] = useState('');

    const ribbonData = profile === 'flood' && viewingResult?.pipeline === 'flood' && viewingResult.floodReport
        ? parseFloodReport(viewingResult.floodReport)
        : null;

    useEffect(() => {
        const tick = () => setUtcTime(`${new Date().toISOString().slice(11, 19)} UTC`);
        tick();
        const timer = setInterval(tick, 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        if (!profileOpen) return undefined;
        const close = () => setProfileOpen(false);
        document.addEventListener('click', close);
        return () => document.removeEventListener('click', close);
    }, [profileOpen]);

    return (
        <>
            <header className="nisar-topbar" aria-label="Workspace navigation">
                <div className="nisar-brand-cluster">
                    <div className="nisar-brand-mark" aria-label="NISAR Pro"><span>///</span> NISAR <b>PRO</b></div>
                    <div className="nisar-profile-picker">
                        <button type="button" className="nisar-profile-trigger" onClick={(event) => { event.stopPropagation(); setProfileOpen(value => !value); }} aria-expanded={profileOpen}>
                            {PROFILES[profile]?.label?.replace(' MONITORING', '') || 'WORKSPACE'} <ChevronDown size={13} />
                        </button>
                        {profileOpen && (
                            <div className="nisar-profile-menu" onClick={event => event.stopPropagation()}>
                                {Object.values(PROFILES).map(item => (
                                    <button type="button" key={item.id} className={profile === item.id ? 'is-active' : ''} onClick={() => { setProfile(item.id); setProfileOpen(false); }}>
                                        {item.label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    <nav className="nisar-pill-nav" aria-label="Workspace sections">
                        {NAV_ITEMS.map(([id, label]) => (
                            <button
                                type="button"
                                key={id}
                                className={activeView === id ? 'is-active' : ''}
                                onClick={() => onSelectView?.(id)}
                            >
                                {label}
                            </button>
                        ))}
                        {profile === 'flood' && (
                            <button
                                type="button"
                                className={activeView === 'evaluation' ? 'is-active' : ''}
                                onClick={() => onSelectView?.('evaluation')}
                            >
                                Evaluation Hub
                            </button>
                        )}
                    </nav>
                </div>
            </header>

            <div className="nisar-command-pill" role="search" aria-label="Workspace command search">
                <Search size={15} aria-hidden="true" />
                <span>Search region or lat/lon</span>
                <kbd>Ctrl + Shift + F</kbd>
                <span className={`nisar-online-dot ${gatewayOnline ? 'is-online' : 'is-offline'}`} />
                <span className="nisar-command-status">{gatewayOnline ? 'Online' : 'Offline'}</span>
                {ribbonData && <button type="button" className="nisar-report-shortcut" onClick={onOpenReport}><FileText size={14} /> Report</button>}
                <button type="button" className="nisar-terminal-shortcut" onClick={() => setTerminalOpen(value => !value)}>{terminalOpen ? 'Close terminal' : utcTime}</button>
            </div>
        </>
    );
}
