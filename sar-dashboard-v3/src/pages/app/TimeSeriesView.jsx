import React, { useState } from 'react';
import { TrendingUp, Radio, Layers, Info } from 'lucide-react';
import { MONO, SANS, C } from './constants';

export default function TimeSeriesView() {
    const [hoveredIndex, setHoveredIndex] = useState(null);

    const timeline = [
        { date: '13 Jan', label: 'Baseline Pass', inundatedAcres: 0, highConfAcres: 0, medConfAcres: 0, meanBackscatterDb: -11.2, rainfallMm: 4.2 },
        { date: '05 Feb', label: 'Dry season', inundatedAcres: 0, highConfAcres: 0, medConfAcres: 0, meanBackscatterDb: -11.1, rainfallMm: 1.0 },
        { date: '01 Mar', label: 'Dry season', inundatedAcres: 0, highConfAcres: 0, medConfAcres: 0, meanBackscatterDb: -11.4, rainfallMm: 8.5 },
        { date: '18 Mar', label: 'SAR Pass 2', inundatedAcres: 4.2, highConfAcres: 1.5, medConfAcres: 2.7, meanBackscatterDb: -11.8, rainfallMm: 12.0 },
        { date: '15 Apr', label: 'Pre-monsoon', inundatedAcres: 8.1, highConfAcres: 3.0, medConfAcres: 5.1, meanBackscatterDb: -12.0, rainfallMm: 24.0 },
        { date: '22 May', label: 'SAR Pass 3', inundatedAcres: 18.5, highConfAcres: 8.2, medConfAcres: 10.3, meanBackscatterDb: -12.1, rainfallMm: 48.0 },
        { date: '12 Jun', label: 'Monsoon onset', inundatedAcres: 52.4, highConfAcres: 24.1, medConfAcres: 28.3, meanBackscatterDb: -14.2, rainfallMm: 142.0 },
        { date: '04 Jul', label: 'Heavy rainfall', inundatedAcres: 112.0, highConfAcres: 55.0, medConfAcres: 57.0, meanBackscatterDb: -15.9, rainfallMm: 210.0 },
        { date: '27 Jul', label: 'Active Peak Pass', inundatedAcres: 145.45, highConfAcres: 70.47, medConfAcres: 74.97, meanBackscatterDb: -16.8, rainfallMm: 285.5 },
    ];

    const chartW = 700;
    const chartH = 220;
    const marginL = 50;
    const marginR = 50;
    const marginT = 20;
    const marginB = 40;
    const plotW = chartW - marginL - marginR;
    const plotH = chartH - marginT - marginB;

    // Helper to calculate X coordinate
    const getX = (idx) => marginL + idx * (plotW / (timeline.length - 1));

    // Helper to calculate Y for Acreage (0 to 160 acres)
    const getYAcres = (acres) => marginT + plotH - (acres / 160) * plotH;

    // Helper to calculate Y for Rainfall (0 to 300 mm)
    const getYRain = (rain) => marginT + plotH - (rain / 300) * plotH;

    // Helper to calculate Y for Backscatter (-18 dB to -10 dB)
    const getYDb = (db) => {
        const minDb = -18;
        const maxDb = -10;
        return marginT + plotH - ((db - minDb) / (maxDb - minDb)) * plotH;
    };

    // Construct SVG Area Path for High Conf Acres
    const highConfPoints = timeline.map((d, i) => `${getX(i)},${getYAcres(d.highConfAcres)}`);
    const highConfAreaPath = `M${getX(0)},${getYAcres(0)} L${highConfPoints.join(' L')} L${getX(timeline.length - 1)},${getYAcres(0)} Z`;
    const highConfLinePath = `M${highConfPoints.join(' L')}`;

    // Construct SVG Area Path for Total Inundated Acres (High + Med)
    const totalPoints = timeline.map((d, i) => `${getX(i)},${getYAcres(d.highConfAcres + d.medConfAcres)}`);
    const totalAreaPath = `M${getX(0)},${getYAcres(0)} L${totalPoints.join(' L')} L${getX(timeline.length - 1)},${getYAcres(0)} Z`;
    const totalLinePath = `M${totalPoints.join(' L')}`;

    // Construct SVG Line Path for Backscatter decay
    const dbPoints = timeline.map((d, i) => `${getX(i)},${getYDb(d.meanBackscatterDb)}`);
    const dbLinePath = `M${dbPoints.join(' L')}`;

    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#0a0d10', padding: '24px', overflowY: 'auto', boxSizing: 'border-box' }}>
            {/* Header banner */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1c2430', paddingBottom: '16px', flexShrink: 0 }}>
                <div>
                    <div style={{ fontFamily: MONO, fontSize: '13px', fontWeight: 'bold', color: C.accent.flood, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <TrendingUp size={16} />
                        <span>NISAR L-BAND MULTI-PASS TEMPORAL ANALYSIS</span>
                    </div>
                    <div style={{ fontFamily: SANS, fontSize: '11px', color: C.textDim, marginTop: '4px' }}>
                        Mean backscatter intensity decay σ0 (dB) and inundation growth profile across 9 sequential observation cycles.
                    </div>
                </div>
            </div>

            {/* Inundation vs Rainfall Chart */}
            <div style={{ background: '#0e131b', border: '1px solid #1c2735', borderRadius: '4px', padding: '16px', margin: '20px 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontFamily: MONO, fontSize: '11px', fontWeight: 'bold', color: C.text }}>
                        <Layers size={12} style={{ color: C.accent.flood }} />
                        <span>INUNDATED ACREAGE VS RAINFALL ACCUMULATION</span>
                    </div>
                    {/* Legend */}
                    <div style={{ display: 'flex', gap: '16px', fontFamily: MONO, fontSize: '10px', color: C.textMid }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <div style={{ width: '10px', height: '10px', background: C.accent.flood }} />
                            <span>High Conf (Acres)</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <div style={{ width: '10px', height: '10px', background: C.caution }} />
                            <span>Med Conf (Acres)</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <div style={{ width: '10px', height: '10px', background: 'rgba(56, 189, 248, 0.25)' }} />
                            <span>Rainfall (mm)</span>
                        </div>
                    </div>
                </div>

                {/* Inline SVG Chart 1 */}
                <div style={{ position: 'relative' }}>
                    <svg viewBox={`0 0 ${chartW} ${chartH}`} style={{ width: '100%', height: 'auto', background: 'transparent' }}>
                        <defs>
                            <linearGradient id="highGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor={C.accent.flood} stopOpacity="0.4" />
                                <stop offset="100%" stopColor={C.accent.flood} stopOpacity="0.01" />
                            </linearGradient>
                            <linearGradient id="medGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor={C.caution} stopOpacity="0.3" />
                                <stop offset="100%" stopColor={C.caution} stopOpacity="0.01" />
                            </linearGradient>
                        </defs>

                        {/* Y-Axis Grid Lines */}
                        {[0, 40, 80, 120, 160].map(val => (
                            <g key={val}>
                                <line x1={marginL} y1={getYAcres(val)} x2={chartW - marginR} y2={getYAcres(val)} stroke="#1a2330" strokeWidth="1" />
                                <text x={marginL - 8} y={getYAcres(val) + 4} fill="#64748b" fontSize="9" fontFamily={MONO} textAnchor="end">{val} ac</text>
                            </g>
                        ))}

                        {/* Right Y-Axis (Rainfall Grid & Texts) */}
                        {[0, 75, 150, 225, 300].map(val => (
                            <g key={val}>
                                <text x={chartW - marginR + 8} y={getYRain(val) + 4} fill="#38bdf8" fontSize="9" fontFamily={MONO} textAnchor="start">{val} mm</text>
                            </g>
                        ))}

                        {/* Rainfall Bars (Rendered first as background) */}
                        {timeline.map((d, i) => {
                            const barW = 14;
                            const barH = marginT + plotH - getYRain(d.rainfallMm);
                            return (
                                <rect
                                    key={i}
                                    x={getX(i) - barW / 2}
                                    y={getYRain(d.rainfallMm)}
                                    width={barW}
                                    height={barH}
                                    fill="rgba(56, 189, 248, 0.22)"
                                    rx="1"
                                />
                            );
                        })}

                        {/* Area Paths (High + Med stack) */}
                        <path d={totalAreaPath} fill="url(#medGrad)" />
                        <path d={highConfAreaPath} fill="url(#highGrad)" />

                        {/* Area Outlines */}
                        <path d={totalLinePath} fill="none" stroke={C.caution} strokeWidth="1.5" />
                        <path d={highConfLinePath} fill="none" stroke={C.accent.flood} strokeWidth="1.5" />

                        {/* X-Axis labels & Vertical markers */}
                        {timeline.map((d, i) => (
                            <g key={i} onMouseEnter={() => setHoveredIndex(i)} onMouseLeave={() => setHoveredIndex(null)} style={{ cursor: 'pointer' }}>
                                <line x1={getX(i)} y1={marginT} x2={getX(i)} y2={marginT + plotH} stroke={hoveredIndex === i ? C.accent.flood : 'transparent'} strokeWidth="1.5" strokeDasharray="3" />
                                <text x={getX(i)} y={chartH - marginB + 16} fill={hoveredIndex === i ? C.text : C.textDim} fontSize="9" fontFamily={MONO} textAnchor="middle">{d.date}</text>
                                <circle cx={getX(i)} cy={getYAcres(d.highConfAcres + d.medConfAcres)} r={hoveredIndex === i ? 4 : 2} fill={C.caution} />
                            </g>
                        ))}
                    </svg>

                    {/* Dynamic Tooltip HUD */}
                    {hoveredIndex !== null && (
                        <div style={{
                            position: 'absolute',
                            top: '40px',
                            left: `${getX(hoveredIndex) > chartW / 2 ? getX(hoveredIndex) * 0.8 - 140 : getX(hoveredIndex) * 0.8 + 60}px`,
                            background: '#121822',
                            border: `1px solid ${C.bg3}`,
                            borderRadius: '3px',
                            padding: '10px',
                            fontFamily: MONO,
                            fontSize: '10px',
                            color: C.text,
                            pointerEvents: 'none',
                            zIndex: 100
                        }}>
                            <div style={{ fontWeight: 'bold', color: C.accent.flood, marginBottom: '4px' }}>
                                {timeline[hoveredIndex].label.toUpperCase()} ({timeline[hoveredIndex].date})
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px' }}>
                                    <span style={{ color: C.textDim }}>High Conf:</span>
                                    <span style={{ color: C.accent.flood }}>{timeline[hoveredIndex].highConfAcres.toFixed(1)} ac</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px' }}>
                                    <span style={{ color: C.textDim }}>Med Conf:</span>
                                    <span style={{ color: C.caution }}>{timeline[hoveredIndex].medConfAcres.toFixed(1)} ac</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px' }}>
                                    <span style={{ color: C.textDim }}>Total Inundation:</span>
                                    <span style={{ color: C.text }}>{timeline[hoveredIndex].inundatedAcres.toFixed(1)} ac</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px' }}>
                                    <span style={{ color: C.textDim }}>Rainfall Accum:</span>
                                    <span style={{ color: '#38bdf8' }}>{timeline[hoveredIndex].rainfallMm.toFixed(1)} mm</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Backscatter Decay Profile */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
                <div style={{ background: '#0e131b', border: '1px solid #1c2735', borderRadius: '4px', padding: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontFamily: MONO, fontSize: '11px', fontWeight: 'bold', color: C.text }}>
                            <Radio size={12} style={{ color: C.accent.flood }} />
                            <span>MEAN RADAR BACKSCATTER σ0 DECAY PROFILE (dB)</span>
                        </div>
                        <span style={{ fontFamily: MONO, fontSize: '9px', color: C.textDim }}>L-BAND HH POLARIZATION</span>
                    </div>

                    <svg viewBox={`0 0 ${chartW} ${chartH}`} style={{ width: '100%', height: 'auto', background: 'transparent' }}>
                        {/* Y-Axis Grid Lines */}
                        {[-18, -16, -14, -12, -10].map(val => (
                            <g key={val}>
                                <line x1={marginL} y1={getYDb(val)} x2={chartW - marginR} y2={getYDb(val)} stroke="#1a2330" strokeWidth="1" />
                                <text x={marginL - 8} y={getYDb(val) + 4} fill="#64748b" fontSize="9" fontFamily={MONO} textAnchor="end">{val} dB</text>
                            </g>
                        ))}

                        {/* Backscatter Line Path */}
                        <path d={dbLinePath} fill="none" stroke={C.accent.flood} strokeWidth="2" />

                        {/* X-Axis labels & Dot markers */}
                        {timeline.map((d, i) => (
                            <g key={i}>
                                <text x={getX(i)} y={chartH - marginB + 16} fill={C.textDim} fontSize="9" fontFamily={MONO} textAnchor="middle">{d.date}</text>
                                <circle cx={getX(i)} cy={getYDb(d.meanBackscatterDb)} r="4.5" fill="#0e131b" stroke={C.accent.flood} strokeWidth="2" />
                                <text x={getX(i)} y={getYDb(d.meanBackscatterDb) - 10} fill={C.text} fontSize="9" fontFamily={MONO} textAnchor="middle" fontWeight="bold">
                                    {d.meanBackscatterDb.toFixed(1)}
                                </text>
                            </g>
                        ))}
                    </svg>
                </div>
            </div>
        </div>
    );
}
