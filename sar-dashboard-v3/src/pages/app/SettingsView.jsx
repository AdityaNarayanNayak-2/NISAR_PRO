import React, { useState } from 'react';
import { Settings, Save, Globe, Database } from 'lucide-react';
import { MONO, SANS, C } from './constants';

export default function SettingsView() {
    const [crs, setCrs] = useState('EPSG:32644');
    const [polarization, setPolarization] = useState('HH');
    const [band, setBand] = useState('L-band');
    const [otsuDb, setOtsuDb] = useState('-3.0');
    const [saved, setSaved] = useState(false);

    const handleSave = () => {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    const titleStyle = {
        fontFamily: MONO,
        fontSize: '13px',
        fontWeight: 'bold',
        color: C.accent.flood,
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
    };

    const labelStyle = {
        fontFamily: MONO,
        fontSize: '10px',
        color: C.textDim,
        textTransform: 'uppercase',
        marginBottom: '6px',
        display: 'block'
    };

    const selectStyle = {
        width: '100%',
        padding: '8px 10px',
        background: '#121822',
        border: '1px solid #202b3a',
        borderRadius: '3px',
        color: C.text,
        fontFamily: MONO,
        fontSize: '11px',
        outline: 'none',
        boxSizing: 'border-box'
    };

    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#0a0d10', padding: '24px', overflowY: 'auto', boxSizing: 'border-box' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1c2430', paddingBottom: '16px', flexShrink: 0, gap: '16px', flexWrap: 'wrap' }}>
                <div>
                    <div style={titleStyle}>
                        <Settings size={16} />
                        <span>NISAR PRO SYSTEM & SENSOR CONFIGURATION</span>
                    </div>
                    <div style={{ fontFamily: SANS, fontSize: '11px', color: C.textDim, marginTop: '4px' }}>
                        Configure default sensor polarizations, orbit pass calibrations, and coordinate reference systems.
                    </div>
                </div>

                <button
                    onClick={handleSave}
                    style={{
                        background: C.accent.flood,
                        border: 'none',
                        color: C.bg0,
                        fontFamily: MONO,
                        fontSize: '11px',
                        fontWeight: 'bold',
                        padding: '8px 16px',
                        borderRadius: '2px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        outline: 'none',
                        transition: 'background 0.2s'
                    }}
                    onMouseEnter={e => e.target.style.background = '#d35400'}
                    onMouseLeave={e => e.target.style.background = C.accent.flood}
                >
                    <Save size={13} />
                    <span>{saved ? 'SETTINGS SAVED!' : 'SAVE CONFIGURATION'}</span>
                </button>
            </div>

            {/* Config grids */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', margin: '20px 0' }}>
                {/* Panel 1: Sensor info */}
                <div style={{ background: '#0e131b', border: '1px solid #1c2735', borderRadius: '4px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div style={{
                        fontFamily: MONO, fontSize: '11px', fontWeight: 'bold', color: C.text,
                        borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '8px',
                        display: 'flex', alignItems: 'center', gap: '6px'
                    }}>
                        <Globe size={12} style={{ color: C.accent.flood }} />
                        <span>SAR SENSOR PARAMETERS</span>
                    </div>

                    <div>
                        <label style={labelStyle}>RADAR FREQUENCY BAND:</label>
                        <select value={band} onChange={e => setBand(e.target.value)} style={selectStyle}>
                            <option value="L-band">L-band (1.25 GHz / 24 cm wavelength) — NISAR Default</option>
                            <option value="S-band">S-band (3.2 GHz / 9 cm wavelength) — NISAR Secondary</option>
                            <option value="C-band">C-band (5.4 GHz / 5.6 cm wavelength)</option>
                        </select>
                    </div>

                    <div>
                        <label style={labelStyle}>POLARIZATION CHANNEL:</label>
                        <select value={polarization} onChange={e => setPolarization(e.target.value)} style={selectStyle}>
                            <option value="HH">HH (Horizontal Transmit / Horizontal Receive)</option>
                            <option value="HV">HV (Horizontal Transmit / Vertical Receive)</option>
                            <option value="VV">VV (Vertical Transmit / Vertical Receive)</option>
                        </select>
                    </div>
                </div>

                {/* Panel 2: Spatial info */}
                <div style={{ background: '#0e131b', border: '1px solid #1c2735', borderRadius: '4px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div style={{
                        fontFamily: MONO, fontSize: '11px', fontWeight: 'bold', color: C.text,
                        borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '8px',
                        display: 'flex', alignItems: 'center', gap: '6px'
                    }}>
                        <Database size={12} style={{ color: C.accent.flood }} />
                        <span>GIS PROJECTION & SPATIAL GRID</span>
                    </div>

                    <div>
                        <label style={labelStyle}>TARGET CRS PROJECTION:</label>
                        <select value={crs} onChange={e => setCrs(e.target.value)} style={selectStyle}>
                            <option value="EPSG:32644">UTM Zone 44N / EPSG:32644 (Kundra Odisha Target)</option>
                            <option value="EPSG:4326">WGS 84 / EPSG:4326 (Geographic Lat/Lon)</option>
                            <option value="EPSG:3857">Web Mercator / EPSG:3857</option>
                        </select>
                    </div>

                    <div>
                        <label style={labelStyle}>DEFAULT OTSU THRESHOLD (dB):</label>
                        <input
                            type="text"
                            value={otsuDb}
                            onChange={e => setOtsuDb(e.target.value)}
                            style={{
                                ...selectStyle,
                                background: '#121822',
                                border: '1px solid #202b3a',
                                color: C.text
                            }}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
