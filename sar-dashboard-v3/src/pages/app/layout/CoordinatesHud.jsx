import React from 'react';
import { MONO, C, TM } from '../constants';
import { useGatewayStore } from '../stores/useGatewayStore';
import { useJobStore } from '../stores/useJobStore';
import { useMapStore } from '../stores/useMapStore';

export default function CoordinatesHud({ profile, activeView, metadata }) {
    const mouseCoords = useMapStore(state => state.mouseCoords);
    const viewingResult = useMapStore(state => state.viewingResult);
    const gatewayOnline = useGatewayStore(state => state.gatewayOnline);
    const terminalOpen = useJobStore(state => state.terminalOpen);
    const activeJobId = useJobStore(state => state.activeJobId);

    const bottomOffset = (() => {
        let b = 8;
        if (profile === 'infrastructure') return '90px';
        if (profile === 'flood' && viewingResult?.pipeline === 'flood' && viewingResult.floodReport && activeView === 'map') b = 40;
        if (terminalOpen && activeJobId) b += 240;
        return `${b}px`;
    })();

    const leftOffset = profile === 'infrastructure' ? '248px' : profile === 'flood' ? `${TM.side + 8}px` : '16px';

    return (
        <div className="nisar-coordinates-hud" style={{
            position: 'absolute',
            bottom: bottomOffset,
            left: leftOffset,
            zIndex: 960,
            background: 'rgba(17, 17, 17, 0.85)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
            border: '1px solid rgba(255, 255, 255, 0.06)', padding: '4px 12px',
            fontFamily: MONO, fontSize: '11px', color: C.data,
            display: 'flex', alignItems: 'center', gap: '10px', borderRadius: '2px',
            transition: 'bottom 200ms ease'
        }}>
            <span>LAT: {mouseCoords.lat}°</span>
            <span>LON: {mouseCoords.lon}°</span>
            {metadata && <>
                <div style={{ width: '1px', height: '12px', background: 'rgba(255,255,255,0.1)' }} />
                <span style={{ color: C.textMid, fontSize: '10px' }}>{metadata.band?.split(' ')[0] || 'L-BAND'}</span>
                <span style={{ color: C.textMid, fontSize: '10px' }}>{metadata.direction || ''}</span>
            </>}
            <div style={{ width: '1px', height: '12px', background: 'rgba(255,255,255,0.1)' }} />
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px', color: C.textMid, fontSize: '10px' }}>
                <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: gatewayOnline ? C.stable : C.critical }} />
                {gatewayOnline ? 'ONLINE' : 'OFFLINE'}
            </span>
        </div>
    );
}
