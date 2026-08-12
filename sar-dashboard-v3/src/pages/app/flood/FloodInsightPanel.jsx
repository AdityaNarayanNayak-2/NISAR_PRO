import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { MONO, SANS, C } from '../constants';
import { parseFloodReport } from './floodReportHelpers';
import { formatElapsed } from '../helpers';
import { Activity, Radio, Cpu, Layers, Download, FileText, ArrowLeft, ArrowUpRight } from 'lucide-react';

export default function FloodInsightPanel({ floodReport, elapsed, onClose, onExportGeoJson, onViewReport }) {
    const [sections, setSections] = useState({
        impact: true,
        acquisition: true,
        methodology: true,
        actions: true
    });

    const toggleSection = (sec) => {
        setSections(prev => ({ ...prev, [sec]: !prev[sec] }));
    };

    const p = parseFloodReport(floodReport);
    if (!p) {
        return (
            <div style={{ flex: 1, padding: '16px', fontFamily: MONO, fontSize: '11px', color: C.textDim }}>
                No active flood report data found.
            </div>
        );
    }

    // Calculate proportion bar percentages
    const totalNew = p.highConfAcres + p.medConfAcres + p.lowConfAcres;
    const totalWater = totalNew + p.permWaterAcres;
    const highPct = totalWater > 0 ? (p.highConfAcres / totalWater) * 100 : 0;
    const medPct = totalWater > 0 ? (p.medConfAcres / totalWater) * 100 : 0;
    const permPct = totalWater > 0 ? (p.permWaterAcres / totalWater) * 100 : 0;

    const handleExportReportJson = () => {
        const blob = new Blob([JSON.stringify(floodReport, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `flood_report_${p.activeDate.replace(/ /g, '_')}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const sectionHeaderStyle = {
        fontFamily: MONO,
        fontSize: '10px',
        color: C.textDim,
        fontWeight: 'bold',
        letterSpacing: '0.12em',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        cursor: 'pointer',
        padding: '14px 0 8px 0',
        userSelect: 'none',
        borderBottom: `1px solid rgba(255, 255, 255, 0.05)`,
        marginTop: '16px'
    };

    const cardBackground = 'rgba(255, 255, 255, 0.015)';
    const cardBorder = '1px solid rgba(255, 255, 255, 0.04)';

    return (
        <div style={{ 
            flex: 1, 
            display: 'flex', 
            flexDirection: 'column', 
            overflow: 'hidden', 
            background: 'rgba(12, 16, 21, 0.75)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            borderLeft: '1px solid rgba(255, 255, 255, 0.06)',
            boxShadow: 'inset 1px 0 0 rgba(255, 255, 255, 0.01)',
        }}>
            {/* PANEL HEADER */}
            <div style={{
                padding: '16px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexShrink: 0
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {onClose && (
                        <motion.button 
                            onClick={onClose}
                            style={{ background: 'none', border: 'none', color: C.textMid, cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', outline: 'none' }}
                            whileHover={{ scale: 1.1, color: '#ffffff' }}
                            whileTap={{ scale: 0.9 }}
                        >
                            <ArrowLeft size={14} />
                        </motion.button>
                    )}
                    <div>
                        <div style={{ fontFamily: MONO, fontSize: '11px', fontWeight: 600, color: C.text, letterSpacing: '0.05em' }}>
                            FLOOD RUN REPORT
                        </div>
                        <div style={{ fontFamily: MONO, fontSize: '9px', color: C.textDim, marginTop: '2px' }}>
                            STATUS: <span style={{ color: C.stable, fontWeight: 'bold' }}>CALIBRATED</span>
                        </div>
                    </div>
                </div>
                {elapsed && (
                    <div style={{
                        fontFamily: MONO,
                        fontSize: '10px',
                        background: 'rgba(76, 175, 80, 0.08)',
                        padding: '4px 8px',
                        borderRadius: '2px',
                        border: '1px solid rgba(76, 175, 80, 0.15)',
                        color: C.stable
                    }}>
                        ⏱ {formatElapsed(elapsed)}
                    </div>
                )}
            </div>

            {/* SCROLLABLE CONTENT */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 16px 16px' }}>

                {/* SECTION 1: FLOOD IMPACT */}
                <div style={sectionHeaderStyle} onClick={() => toggleSection('impact')}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: C.textMid }}>
                        <Activity size={12} style={{ color: C.accent.flood }} />
                        <span>SECTION 1: FLOOD IMPACT</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{
                            fontSize: '9px',
                            fontFamily: MONO,
                            color: C.accent.flood,
                            background: 'rgba(42, 139, 145, 0.08)',
                            border: '1px solid rgba(42, 139, 145, 0.2)',
                            padding: '2px 6px',
                            borderRadius: '2px',
                            fontWeight: 'bold'
                        }} onClick={e => e.stopPropagation()}>
                            {p.activeDate.toUpperCase()}
                        </span>
                        <span style={{ color: C.textDim }}>{sections.impact ? '▼' : '▲'}</span>
                    </div>
                </div>

                {sections.impact && (
                    <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                        style={{ marginTop: '10px' }}
                    >
                        {/* Hero Measurement Card */}
                        <div style={{
                            background: 'rgba(42, 139, 145, 0.04)',
                            border: '1px solid rgba(42, 139, 145, 0.15)',
                            borderRadius: '2px',
                            padding: '16px',
                            marginBottom: '10px',
                            position: 'relative',
                            overflow: 'hidden'
                        }}>
                            <div style={{ fontFamily: MONO, fontSize: '9px', color: C.accent.flood, letterSpacing: '0.05em', fontWeight: 'bold' }}>
                                NEW INUNDATION (NET)
                            </div>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', margin: '8px 0 4px 0' }}>
                                <span style={{ fontFamily: MONO, fontSize: '32px', fontWeight: 'bold', color: '#ffffff' }}>
                                    {p.totalFloodAcres.toFixed(2)}
                                </span>
                                <span style={{ fontFamily: MONO, fontSize: '11px', fontWeight: 'bold', color: C.accent.flood }}>ACRES</span>
                            </div>
                            <div style={{ fontFamily: MONO, fontSize: '9px', color: C.textDim }}>
                                Mapped Area: {p.totalAreaAcres.toLocaleString(undefined, { maximumFractionDigits: 2 })} ac (10 km × 10 km)
                            </div>
                        </div>

                        {/* 2x2 Bento Grid */}
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(2, 1fr)',
                            gap: '8px',
                            fontFamily: MONO,
                            marginBottom: '12px'
                        }}>
                            {/* High Conf */}
                            <div style={{ background: cardBackground, border: cardBorder, padding: '12px', borderRadius: '2px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '9px', color: C.textDim }}>
                                    <span>HIGH CONF</span>
                                    <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: C.accent.flood }} />
                                </div>
                                <div style={{ fontSize: '18px', fontWeight: 'bold', color: C.text }}>
                                    {p.highConfAcres.toFixed(2)}
                                </div>
                                <div style={{ fontSize: '9px', color: C.accent.flood }}>acres</div>
                            </div>

                            {/* Med Conf */}
                            <div style={{ background: cardBackground, border: cardBorder, padding: '12px', borderRadius: '2px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '9px', color: C.textDim }}>
                                    <span>MEDIUM CONF</span>
                                    <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: C.caution }} />
                                </div>
                                <div style={{ fontSize: '18px', fontWeight: 'bold', color: C.text }}>
                                    {p.medConfAcres.toFixed(2)}
                                </div>
                                <div style={{ fontSize: '9px', color: C.caution }}>acres</div>
                            </div>

                            {/* Permanent Water */}
                            <div style={{ background: cardBackground, border: cardBorder, padding: '12px', borderRadius: '2px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '9px', color: C.textDim }}>
                                    <span>PERM WATER</span>
                                    <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: C.data }} />
                                </div>
                                <div style={{ fontSize: '18px', fontWeight: 'bold', color: C.text }}>
                                    {p.permWaterAcres.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                                </div>
                                <div style={{ fontSize: '9px', color: C.data }}>acres</div>
                            </div>

                            {/* Detected Regions */}
                            <div style={{ background: cardBackground, border: cardBorder, padding: '12px', borderRadius: '2px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '9px', color: C.textDim }}>
                                    <span>DET. REGIONS</span>
                                    <Layers size={10} style={{ color: C.accent.flood }} />
                                </div>
                                <div style={{ fontSize: '18px', fontWeight: 'bold', color: C.text }}>
                                    {p.detectedRegionsCount}
                                </div>
                                <div style={{ fontSize: '9px', color: C.textDim }}>polygons</div>
                            </div>
                        </div>

                        {/* Proportion Bar */}
                        <div style={{ display: 'flex', height: '6px', borderRadius: '1px', overflow: 'hidden', background: 'rgba(255,255,255,0.05)', marginBottom: '14px' }}>
                            <div style={{ width: `${highPct}%`, background: C.accent.flood }} title={`High Confidence: ${p.highConfAcres.toFixed(1)} ac`} />
                            <div style={{ width: `${medPct}%`, background: C.caution }} title={`Medium Confidence: ${p.medConfAcres.toFixed(1)} ac`} />
                            <div style={{ width: `${permPct}%`, background: C.data }} title={`Permanent Water: ${p.permWaterAcres.toFixed(1)} ac`} />
                        </div>
                    </motion.div>
                )}

                {/* SECTION 2: ACQUISITION */}
                <div style={sectionHeaderStyle} onClick={() => toggleSection('acquisition')}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: C.textMid }}>
                        <Radio size={12} style={{ color: C.accent.flood }} />
                        <span>SECTION 2: ACQUISITION</span>
                    </div>
                    <span style={{ color: C.textDim }}>{sections.acquisition ? '▼' : '▲'}</span>
                </div>

                {sections.acquisition && (
                    <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                        style={{ marginTop: '10px' }}
                    >
                        <div style={{
                            background: cardBackground,
                            border: cardBorder,
                            borderRadius: '2px',
                            padding: '14px',
                            fontFamily: MONO,
                            fontSize: '11px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '10px'
                        }}>
                            {/* Column Header Grid */}
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(3, 1fr)',
                                borderBottom: '1px solid rgba(255,255,255,0.05)',
                                paddingBottom: '10px'
                            }}>
                                <div>
                                    <div style={{ fontSize: '9px', color: C.textDim }}>SENSOR</div>
                                    <div style={{ fontWeight: 'bold', color: C.text, marginTop: '3px' }}>NISAR</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '9px', color: C.textDim }}>BAND</div>
                                    <div style={{ fontWeight: 'bold', color: C.accent.flood, marginTop: '3px' }}>L-band</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '9px', color: C.textDim }}>POLARIZATION</div>
                                    <div style={{ fontWeight: 'bold', color: C.text, marginTop: '3px' }}>{p.polarization}</div>
                                </div>
                            </div>

                            {/* Active & Baseline Dates */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '10px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: C.textDim }}>Active Date:</span>
                                    <span style={{ color: C.accent.flood, fontWeight: 'bold' }}>{p.activeDate}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: C.textDim }}>Baseline Date:</span>
                                    <span style={{ color: C.textMid }}>{p.baselineDate}</span>
                                </div>
                            </div>

                            {/* Grid & CRS info */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', fontSize: '9px', color: C.textDim }}>
                                <div>
                                    <span>GRID: </span>
                                    <span style={{ color: C.textMid, fontWeight: 'semibold' }}>{p.gridLabel}</span>
                                </div>
                                <div>
                                    <span>CRS: </span>
                                    <span style={{ color: C.textMid, fontWeight: 'semibold' }}>{p.epsg}</span>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* SECTION 3: DETECTION */}
                <div style={sectionHeaderStyle} onClick={() => toggleSection('methodology')}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: C.textMid }}>
                        <Cpu size={12} style={{ color: C.accent.flood }} />
                        <span>SECTION 3: DETECTION</span>
                    </div>
                    <span style={{ color: C.textDim }}>{sections.methodology ? '▼' : '▲'}</span>
                </div>

                {sections.methodology && (
                    <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                        style={{ marginTop: '10px' }}
                    >
                        <div style={{
                            background: cardBackground,
                            border: cardBorder,
                            borderRadius: '2px',
                            padding: '14px',
                            fontFamily: MONO,
                            fontSize: '11px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.02)', paddingBottom: '4px' }}>
                                <span style={{ color: C.textDim }}>Methodology:</span>
                                <span style={{ color: C.textMid }}>Log-ratio SAR change</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.02)', paddingBottom: '4px' }}>
                                <span style={{ color: C.textDim }}>Otsu Threshold:</span>
                                <span style={{ color: C.accent.flood, fontWeight: 'bold' }}>{floodReport.method?.threshold_db || '-3.0'} dB</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.02)', paddingBottom: '4px' }}>
                                <span style={{ color: C.textDim }}>Median Filter:</span>
                                <span style={{ color: C.textMid }}>3 × 3 kernel</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.02)', paddingBottom: '4px' }}>
                                <span style={{ color: C.textDim }}>Region Growing:</span>
                                <span style={{ color: C.stable, fontWeight: 'semibold' }}>
                                    {floodReport.method?.region_growing ? 'Enabled' : 'Disabled'}
                                </span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: C.textDim }}>Morphology:</span>
                                <span style={{ color: C.textMid }}>Open 3x3 / Close 3x3</span>
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* SECTION 4: DATA & REPORTS */}
                <div style={sectionHeaderStyle} onClick={() => toggleSection('actions')}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: C.textMid }}>
                        <FileText size={12} style={{ color: C.accent.flood }} />
                        <span>SECTION 4: DATA & REPORTS</span>
                    </div>
                    <span style={{ color: C.textDim }}>{sections.actions ? '▼' : '▲'}</span>
                </div>

                {sections.actions && (
                    <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                        style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}
                    >
                        <motion.button
                            onClick={onExportGeoJson}
                            style={{
                                width: '100%',
                                padding: '10px',
                                background: 'rgba(42, 139, 145, 0.06)',
                                border: `1px solid rgba(42, 139, 145, 0.3)`,
                                color: C.accent.flood,
                                fontFamily: MONO,
                                fontSize: '11px',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                borderRadius: '2px',
                                outline: 'none',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '6px'
                            }}
                            whileHover={{ scale: 1.01, background: 'rgba(42, 139, 145, 0.12)', border: `1px solid ${C.accent.flood}` }}
                            whileTap={{ scale: 0.98 }}
                        >
                            <Download size={12} />
                            <span>EXPORT GEOMETRIES (GEOJSON)</span>
                        </motion.button>

                        <motion.button
                            onClick={handleExportReportJson}
                            style={{
                                width: '100%',
                                padding: '10px',
                                background: 'transparent',
                                border: `1px solid rgba(255,255,255,0.1)`,
                                color: C.textMid,
                                fontFamily: MONO,
                                fontSize: '11px',
                                cursor: 'pointer',
                                borderRadius: '2px',
                                outline: 'none',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '6px'
                            }}
                            whileHover={{ scale: 1.01, background: 'rgba(255, 255, 255, 0.03)', border: `1px solid rgba(255,255,255,0.2)` }}
                            whileTap={{ scale: 0.98 }}
                        >
                            <Download size={12} />
                            <span>EXPORT REPORT DATASHEET (JSON)</span>
                        </motion.button>

                        {onViewReport && (
                            <motion.button
                                onClick={onViewReport}
                                style={{
                                    width: '100%',
                                    padding: '10px',
                                    background: C.accent.flood,
                                    border: 'none',
                                    color: C.bg0,
                                    fontFamily: MONO,
                                    fontSize: '11px',
                                    fontWeight: 'bold',
                                    cursor: 'pointer',
                                    borderRadius: '2px',
                                    outline: 'none',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '6px'
                                }}
                                whileHover={{ scale: 1.01, background: '#34a4ab' }}
                                whileTap={{ scale: 0.98 }}
                            >
                                <FileText size={12} />
                                <span>VIEW ANALYSIS REPORT</span>
                                <ArrowUpRight size={10} style={{ marginLeft: '-2px' }} />
                            </motion.button>
                        )}
                    </motion.div>
                )}
            </div>
        </div>
    );
}
