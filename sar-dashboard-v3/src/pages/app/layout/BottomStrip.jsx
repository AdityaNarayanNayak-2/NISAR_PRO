import React from 'react';
import { MONO, C, TM } from '../constants';
import { formatElapsed } from '../helpers';
import { useJobStore } from '../stores/useJobStore';
import { useMapStore } from '../stores/useMapStore';

export default function BottomStrip({ activeView = 'map' }) {
    const viewingResult = useMapStore(state => state.viewingResult);
    const terminalOpen = useJobStore(state => state.terminalOpen);
    const activeJobId = useJobStore(state => state.activeJobId);

    if (!viewingResult || viewingResult.pipeline !== 'flood' || !viewingResult.floodReport || activeView !== 'map') {
        return null;
    }

    return (
        <div className="nisar-bottom-strip" style={{
            position: 'absolute',
            bottom: terminalOpen && activeJobId ? '240px' : 0,
            left: `${TM.side}px`,
            right: `${TM.panel}px`,
            height: '32px',
            background: 'rgba(10, 14, 20, 0.95)',
            backdropFilter: 'blur(8px)',
            borderTop: '1px solid rgba(255, 255, 255, 0.06)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 16px',
            fontFamily: MONO,
            fontSize: '10px',
            color: C.textMid,
            zIndex: 950,
            transition: 'bottom 200ms ease'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: C.accent.flood, fontWeight: 'bold' }}>FLOOD DETECTION</span>
                <span style={{ color: 'rgba(255,255,255,0.12)' }}>|</span>
                <span>LOG-RATIO + OTSU ({viewingResult.floodReport.method?.threshold_db || '-3.0'} dB)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>POLYGONS: {viewingResult.floodReport.flood_regions || 0}</span>
                {viewingResult.elapsed && (
                    <>
                        <span style={{ color: 'rgba(255,255,255,0.12)' }}>|</span>
                        <span>ELAPSED: {formatElapsed(viewingResult.elapsed)}</span>
                    </>
                )}
            </div>
        </div>
    );
}
