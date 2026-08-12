import React, { useState } from 'react';
import { Cpu, Settings, Layers, Info, CheckCircle2 } from 'lucide-react';
import { MONO, SANS, C } from './constants';

export default function ProcessingView() {
    const [speckleFilter, setSpeckleFilter] = useState('3x3 Median');
    const [minChangeDb, setMinChangeDb] = useState(-3.0);
    const [seedDb, setSeedDb] = useState(-5.0);
    const [growthDb, setGrowthDb] = useState(-2.5);

    const steps = [
        {
            id: 'step-1',
            name: '3×3 Median Speckle Filtering',
            category: 'preprocessing',
            description: 'Suppresses granular L-band speckle noise while preserving sharp agricultural water-land boundaries and narrow canal geometry.',
            input: 'Raw L1B Slant-Range SLC HH',
            output: 'Filtered Backscatter σ0 (dB)',
            params: [
                { name: 'Kernel Window', val: speckleFilter },
                { name: 'Filter Type', val: 'Order-Statistic Median' },
                { name: 'Equivalent Looks', val: '4.8 ENL' }
            ]
        },
        {
            id: 'step-2',
            name: 'Log-Ratio Change Detection',
            category: 'detection',
            description: 'Calculates normalized logarithmic backscatter ratio Δσ0 = 10 · log10(I_active / I_baseline) to isolate specular reflection drops.',
            input: 'Filtered σ0 (27 Jul vs 13 Jan)',
            output: 'Log-Ratio Delta Map (dB)',
            params: [
                { name: 'Formula', val: '10 · log10(σ0_active / σ0_baseline)' },
                { name: 'Target Dynamic Range', val: '-24.0 to +8.0 dB' },
                { name: 'Minimum Specular Drop', val: `${minChangeDb.toFixed(1)} dB` }
            ]
        },
        {
            id: 'step-3',
            name: 'Otsu Global Thresholding',
            category: 'detection',
            description: 'Finds optimal bimodal histogram split threshold maximizing inter-class variance between flooded and unflooded terrain.',
            input: 'Log-Ratio Delta Map',
            output: 'Binary Seed Mask',
            params: [
                { name: 'Effective Threshold', val: `${minChangeDb.toFixed(1)} dB` },
                { name: 'Histogram Bins', val: '256 bins' },
                { name: 'Inter-class Variance', val: '0.842' }
            ]
        },
        {
            id: 'step-4',
            name: 'Two-Threshold Region Growing',
            category: 'detection',
            description: 'Expands core high-confidence seeds into surrounding inundation margin pixels down to secondary threshold.',
            input: 'Binary Seed Mask + Delta Map',
            output: 'Raw Inundation Clusters',
            params: [
                { name: 'Seed Threshold T_high', val: `${seedDb.toFixed(1)} dB` },
                { name: 'Growth Threshold T_low', val: `${growthDb.toFixed(1)} dB` },
                { name: 'Connectivity', val: '8-neighbor pixel' }
            ]
        },
        {
            id: 'step-5',
            name: 'Morphological Cleanup',
            category: 'postprocessing',
            description: 'Applies opening (erosion followed by dilation) and closing operators to smooth boundaries and fill internal canopy pinholes.',
            input: 'Raw Inundation Clusters',
            output: 'Cleaned Raster Mask',
            params: [
                { name: 'Opening Kernel', val: '3 × 3 square' },
                { name: 'Closing Kernel', val: '3 × 3 square' },
                { name: 'Boundary Smoothing', val: 'Enabled' }
            ]
        },
        {
            id: 'step-6',
            name: 'Connected-Component Vectorization',
            category: 'postprocessing',
            description: 'Filters out isolated noise (< 5 pixels / < 0.12 acres) and vectorizes contiguous flood clusters into polygon regions.',
            input: 'Cleaned Raster Mask',
            output: 'EPSG:32644 GeoJSON Vector Layers',
            params: [
                { name: 'Min Cluster Area', val: '500 m² (5 pixels)' },
                { name: 'Confidence Assignment', val: 'Dual-tier (High / Med)' },
                { name: 'Total Regions Output', val: '204 polygons' }
            ]
        }
    ];

    const titleStyle = {
        fontFamily: MONO,
        fontSize: '13px',
        fontWeight: 'bold',
        color: C.accent.flood,
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
    };

    const sectionTitleStyle = {
        fontFamily: MONO,
        fontSize: '11px',
        color: C.textMid,
        fontWeight: 'bold',
        borderBottom: '1px solid #1c2430',
        paddingBottom: '8px',
        marginBottom: '12px',
        display: 'flex',
        alignItems: 'center',
        gap: '6px'
    };

    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#0a0d10', padding: '24px', overflowY: 'auto', boxSizing: 'border-box' }}>
            {/* Header banner */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1c2430', paddingBottom: '16px', flexShrink: 0 }}>
                <div>
                    <div style={titleStyle}>
                        <Cpu size={16} />
                        <span>NISAR PRO PROCESSING ALGORITHM PIPELINE</span>
                    </div>
                    <div style={{ fontFamily: SANS, fontSize: '11px', color: C.textDim, marginTop: '4px' }}>
                        Dual-pass SAR polarization change detection and connected-component morphological vectorization engine.
                    </div>
                </div>
            </div>

            {/* Slider configuration & Schematic block */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px', margin: '20px 0' }}>
                {/* Configuration sliders */}
                <div style={{ background: '#0e131b', border: '1px solid #1c2735', borderRadius: '4px', padding: '16px' }}>
                    <div style={sectionTitleStyle}>
                        <Settings size={12} style={{ color: C.accent.flood }} />
                        <span>ACTIVE PIPELINE CALIBRATION</span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontFamily: MONO, fontSize: '10px' }}>
                        {/* Speckle Filter Select */}
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                <span style={{ color: C.textDim }}>Speckle Filtering:</span>
                                <span style={{ color: C.text }}>{speckleFilter}</span>
                            </div>
                            <select
                                value={speckleFilter}
                                onChange={e => setSpeckleFilter(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '6px',
                                    background: C.bg1,
                                    border: '1px solid #1c2532',
                                    color: C.text,
                                    fontFamily: MONO,
                                    fontSize: '11px',
                                    outline: 'none',
                                    borderRadius: '2px'
                                }}
                            >
                                <option value="3x3 Median">3x3 Median Window Filter</option>
                                <option value="5x5 Median">5x5 Median Window Filter</option>
                                <option value="3x3 Lee">3x3 Multiplicative Lee Filter</option>
                            </select>
                        </div>

                        {/* Otsu limit DB */}
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                <span style={{ color: C.textDim }}>Minimum Specular Drop:</span>
                                <span style={{ color: C.accent.flood, fontWeight: 'bold' }}>{minChangeDb.toFixed(1)} dB</span>
                            </div>
                            <input
                                type="range"
                                min="-6.0"
                                max="-1.5"
                                step="0.5"
                                value={minChangeDb}
                                onChange={e => setMinChangeDb(parseFloat(e.target.value))}
                                style={{ width: '100%', accentColor: C.accent.flood }}
                            />
                        </div>

                        {/* Seed Db */}
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                <span style={{ color: C.textDim }}>Growth Seed Threshold (T_high):</span>
                                <span style={{ color: C.accent.flood, fontWeight: 'bold' }}>{seedDb.toFixed(1)} dB</span>
                            </div>
                            <input
                                type="range"
                                min="-10.0"
                                max="-4.0"
                                step="0.5"
                                value={seedDb}
                                onChange={e => setSeedDb(parseFloat(e.target.value))}
                                style={{ width: '100%', accentColor: C.accent.flood }}
                            />
                        </div>

                        {/* Growth Db */}
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                <span style={{ color: C.textDim }}>Growth limit Boundary (T_low):</span>
                                <span style={{ color: C.accent.flood, fontWeight: 'bold' }}>{growthDb.toFixed(1)} dB</span>
                            </div>
                            <input
                                type="range"
                                min="-4.5"
                                max="-1.5"
                                step="0.5"
                                value={growthDb}
                                onChange={e => setGrowthDb(parseFloat(e.target.value))}
                                style={{ width: '100%', accentColor: C.accent.flood }}
                            />
                        </div>
                    </div>
                </div>

                {/* Schematic connection display */}
                <div style={{ background: '#0e131b', border: '1px solid #1c2735', borderRadius: '4px', padding: '16px', display: 'flex', flexDirection: 'column' }}>
                    <div style={sectionTitleStyle}>
                        <Cpu size={12} style={{ color: C.accent.flood }} />
                        <span>PIPELINE SCHEMATIC MAP</span>
                    </div>

                    <div style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        fontFamily: MONO,
                        fontSize: '9px',
                        padding: '10px 0',
                        gap: '6px'
                    }}>
                        {[
                            { step: 'STAGE 1', name: '3x3 Median Speckle Filter', output: 'ENL 4.8 Backscatter Raster' },
                            { step: 'STAGE 2', name: 'Log-Ratio Delta Calculation', output: 'Δσ0 Log Amplitude Difference Map' },
                            { step: 'STAGE 3', name: 'Bimodal Otsu Auto-Calibration', output: 'High confidence seed mask' },
                            { step: 'STAGE 4', name: 'Morphological regularisation', output: 'Connected-component clean vector sets' }
                        ].map((s, idx) => (
                            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{
                                    width: '54px',
                                    padding: '4px',
                                    background: 'rgba(192, 57, 43, 0.1)',
                                    color: C.accent.flood,
                                    border: `1px solid rgba(192, 57, 43, 0.3)`,
                                    borderRadius: '2px',
                                    fontWeight: 'bold',
                                    textAlign: 'center'
                                }}>
                                    {s.step}
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ color: C.text, fontWeight: 'semibold', fontSize: '10px' }}>{s.name}</div>
                                    <div style={{ color: C.textDim, marginTop: '2px' }}>OUTPUT: {s.output}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Detailed Cards Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
                {steps.map(step => (
                    <div key={step.id} style={{
                        background: '#0e131b',
                        border: '1px solid #1c2735',
                        borderRadius: '4px',
                        padding: '14px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: '10px'
                    }}>
                        <div style={{ spaceY: '6px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{
                                    fontFamily: MONO,
                                    fontSize: '9px',
                                    padding: '2px 6px',
                                    background: 'rgba(76, 175, 80, 0.1)',
                                    color: C.stable,
                                    borderRadius: '2px',
                                    fontWeight: 'bold',
                                    textTransform: 'uppercase'
                                }}>
                                    {step.category}
                                </span>
                                <CheckCircle2 size={12} style={{ color: C.stable }} />
                            </div>
                            <div style={{ fontFamily: MONO, fontSize: '12px', fontWeight: 'bold', color: C.text, marginTop: '8px' }}>
                                {step.name}
                            </div>
                            <p style={{ fontFamily: SANS, fontSize: '11px', color: C.textDim, lineHeight: 1.4, margin: '6px 0 0 0' }}>
                                {step.description}
                            </p>
                        </div>

                        <div style={{ borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {step.params.map((p, pIdx) => (
                                <div key={pIdx} style={{ display: 'flex', justifyContent: 'space-between', fontFamily: MONO, fontSize: '10px' }}>
                                    <span style={{ color: C.textDim }}>{p.name}:</span>
                                    <span style={{ color: C.accent.flood, fontWeight: 'semibold' }}>{p.val}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
