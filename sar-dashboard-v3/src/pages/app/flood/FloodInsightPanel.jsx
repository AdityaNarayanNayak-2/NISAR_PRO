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
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
                    {onClose && (
                        <button
                            onClick={onClose}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                background: 'rgba(0, 229, 255, 0.12)',
                                border: `1px solid ${C.accent.flood}`,
                                color: C.accent.flood,
                                fontFamily: MONO,
                                fontSize: '10px',
                                fontWeight: 600,
                                padding: '4px 8px',
                                borderRadius: '2px',
                                cursor: 'pointer',
                                letterSpacing: '0.05em'
                            }}
                            title="Configure and start a new analysis"
                        >
                            + NEW RUN
                        </button>
                    )}
                </div>
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
                            background: 'rgba(255, 255, 255, 0.015)',
                            border: '1px solid rgba(255, 255, 255, 0.04)',
                            borderRadius: '2px',
                            padding: '16px',
                            marginBottom: '10px',
                            position: 'relative',
                        }}>
                            {/* L-corner brackets */}
                            <span style={{ position: 'absolute', top: '-1px', left: '-1px', width: '8px', height: '8px', borderTop: `1px solid ${C.accent.flood}`, borderLeft: `1px solid ${C.accent.flood}` }} />
                            <span style={{ position: 'absolute', top: '-1px', right: '-1px', width: '8px', height: '8px', borderTop: '1px solid rgba(255, 255, 255, 0.32)', borderRight: '1px solid rgba(255, 255, 255, 0.32)' }} />
                            <span style={{ position: 'absolute', bottom: '-1px', left: '-1px', width: '8px', height: '8px', borderBottom: '1px solid rgba(255, 255, 255, 0.32)', borderLeft: '1px solid rgba(255, 255, 255, 0.32)' }} />
                            <span style={{ position: 'absolute', bottom: '-1px', right: '-1px', width: '8px', height: '8px', borderBottom: `1px solid ${C.accent.flood}`, borderRight: `1px solid ${C.accent.flood}` }} />

                            <div style={{ fontFamily: MONO, fontSize: '9px', color: C.textDim, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '6px' }}>
                                NEW INUNDATION (NET)
                            </div>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', margin: '8px 0 4px 0' }}>
                                <span style={{ fontFamily: SANS, fontSize: '34px', fontWeight: 300, color: C.text, letterSpacing: '-0.04em', lineHeight: 1 }}>
                                    {p.totalFloodAcres.toFixed(2)}
                                </span>
                                <span style={{ fontFamily: MONO, fontSize: '11px', fontWeight: 500, letterSpacing: '0.06em', color: C.accent.flood, marginLeft: '6px' }}>acres</span>
                            </div>
                            <div style={{ fontFamily: MONO, fontSize: '9px', color: C.textDim, marginTop: '8px' }}>
                                Mapped Area · {p.totalAreaAcres.toLocaleString(undefined, { maximumFractionDigits: 2 })} ac · 10 km × 10 km
                            </div>
                        </div>

                        {/* 2x2 Bento Grid */}
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(2, 1fr)',
                            gap: '6px',
                            fontFamily: MONO,
                            marginBottom: '12px',
                            marginTop: '10px'
                        }}>
                            {/* High Conf */}
                            <div style={{ background: cardBackground, border: cardBorder, padding: '10px', position: 'relative' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '8px', letterSpacing: '0.15em', textTransform: 'uppercase', color: C.textDim, marginBottom: '5px' }}>
                                    <span style={{ width: '5px', height: '5px', background: C.accent.flood }} />
                                    <span>High Conf</span>
                                </div>
                                <div style={{ fontFamily: SANS, fontSize: '18px', fontWeight: 300, color: C.text, letterSpacing: '-0.03em', lineHeight: 1.1 }}>
                                    {p.highConfAcres.toFixed(2)}<span style={{ fontFamily: MONO, fontSize: '9px', color: C.textDim, marginLeft: '3px' }}>ac</span>
                                </div>
                            </div>

                            {/* Med Conf */}
                            <div style={{ background: cardBackground, border: cardBorder, padding: '10px', position: 'relative' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '8px', letterSpacing: '0.15em', textTransform: 'uppercase', color: C.textDim, marginBottom: '5px' }}>
                                    <span style={{ width: '5px', height: '5px', background: C.caution }} />
                                    <span>Medium Conf</span>
                                </div>
                                <div style={{ fontFamily: SANS, fontSize: '18px', fontWeight: 300, color: C.text, letterSpacing: '-0.03em', lineHeight: 1.1 }}>
                                    {p.medConfAcres.toFixed(2)}<span style={{ fontFamily: MONO, fontSize: '9px', color: C.textDim, marginLeft: '3px' }}>ac</span>
                                </div>
                            </div>

                            {/* Permanent Water */}
                            <div style={{ background: cardBackground, border: cardBorder, padding: '10px', position: 'relative' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '8px', letterSpacing: '0.15em', textTransform: 'uppercase', color: C.textDim, marginBottom: '5px' }}>
                                    <span style={{ width: '5px', height: '5px', background: '#5483b3' }} />
                                    <span>Perm Water</span>
                                </div>
                                <div style={{ fontFamily: SANS, fontSize: '18px', fontWeight: 300, color: C.text, letterSpacing: '-0.03em', lineHeight: 1.1 }}>
                                    {p.permWaterAcres.toLocaleString(undefined, { maximumFractionDigits: 1 })}<span style={{ fontFamily: MONO, fontSize: '9px', color: C.textDim, marginLeft: '3px' }}>ac</span>
                                </div>
                            </div>

                            {/* Detected Regions */}
                            <div style={{ background: cardBackground, border: cardBorder, padding: '10px', position: 'relative' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '8px', letterSpacing: '0.15em', textTransform: 'uppercase', color: C.textDim, marginBottom: '5px' }}>
                                    <span style={{ width: '5px', height: '5px', background: C.textDim }} />
                                    <span>Det. Regions</span>
                                </div>
                                <div style={{ fontFamily: SANS, fontSize: '18px', fontWeight: 300, color: C.text, letterSpacing: '-0.03em', lineHeight: 1.1 }}>
                                    {p.detectedRegionsCount}<span style={{ fontFamily: MONO, fontSize: '9px', color: C.textDim, marginLeft: '3px' }}>poly</span>
                                </div>
                            </div>
                        </div>

                        {/* Proportion Bar */}
                        <div style={{ display: 'flex', height: '2px', overflow: 'hidden', background: 'rgba(255,255,255,0.04)', marginBottom: '14px', marginTop: '10px' }}>
                            <div style={{ width: `${highPct}%`, background: C.accent.flood }} title={`High Confidence: ${p.highConfAcres.toFixed(1)} ac`} />
                            <div style={{ width: `${medPct}%`, background: C.caution }} title={`Medium Confidence: ${p.medConfAcres.toFixed(1)} ac`} />
                            <div style={{ width: `${permPct}%`, background: '#5483b3' }} title={`Permanent Water: ${p.permWaterAcres.toFixed(1)} ac`} />
                        </div>
                    </motion.div>
                )}

                {/* SECTION 2: ACQUISITION */}
                <div style={sectionHeaderStyle} onClick={() => toggleSection('acquisition')}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: C.textMid }}>
                        <Radio size={12} style={{ color: C.accent.flood }} />
                        <span>SECTION 2 · ACQUISITION</span>
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
                            display: 'grid',
                            gridTemplateColumns: '1fr auto',
                            gap: '7px 12px',
                            fontFamily: MONO,
                            fontSize: '10px',
                            letterSpacing: '0.02em',
                            padding: '4px 0'
                        }}>
                            <span style={{ color: C.textDim }}>Sensor</span>
                            <span style={{ color: C.accent.flood, fontWeight: 500 }}>NISAR</span>

                            <span style={{ color: C.textDim }}>Band</span>
                            <span style={{ color: C.textMid }}>L-band</span>

                            <span style={{ color: C.textDim }}>Polarization</span>
                            <span style={{ color: C.textMid }}>{p.polarization}</span>

                            <span style={{ color: C.textDim }}>Active date</span>
                            <span style={{ color: C.accent.flood, fontWeight: 500 }}>{p.activeDate}</span>

                            <span style={{ color: C.textDim }}>Baseline date</span>
                            <span style={{ color: C.textMid }}>{p.baselineDate}</span>

                            <span style={{ color: C.textDim }}>Grid</span>
                            <span style={{ color: C.textMid }}>{p.gridLabel}</span>

                            <span style={{ color: C.textDim }}>CRS</span>
                            <span style={{ color: C.textMid }}>{p.epsg}</span>
                        </div>
                    </motion.div>
                )}

                {/* SECTION 3: DETECTION */}
                <div style={sectionHeaderStyle} onClick={() => toggleSection('methodology')}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: C.textMid }}>
                        <Cpu size={12} style={{ color: C.accent.flood }} />
                        <span>SECTION 3 · DETECTION</span>
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
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '5px',
                        }}>
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '8px 10px',
                                background: cardBackground,
                                border: cardBorder,
                                fontFamily: MONO,
                                fontSize: '10px',
                                letterSpacing: '0.02em'
                            }}>
                                <span style={{ color: C.textDim }}>Methodology</span>
                                <span style={{ color: C.textMid }}>Log-ratio SAR change</span>
                            </div>

                            {floodReport.method?.raw_otsu_db != null ? (
                                <>
                                    <div style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        padding: '8px 10px',
                                        background: cardBackground,
                                        border: cardBorder,
                                        fontFamily: MONO,
                                        fontSize: '10px',
                                        letterSpacing: '0.02em'
                                    }}>
                                        <span style={{ color: C.textDim }}>Otsu Threshold (computed)</span>
                                        <span style={{ color: C.textMid }}>
                                            {typeof floodReport.method.raw_otsu_db === 'number'
                                                ? `${Number(floodReport.method.raw_otsu_db).toFixed(2)} dB`
                                                : `${floodReport.method.raw_otsu_db} dB`}
                                        </span>
                                    </div>

                                    <div style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        padding: '8px 10px',
                                        background: cardBackground,
                                        border: cardBorder,
                                        fontFamily: MONO,
                                        fontSize: '10px',
                                        letterSpacing: '0.02em'
                                    }}>
                                        <span style={{ color: C.textDim }}>User Ceiling (min change)</span>
                                        <span style={{ color: C.textMid }}>
                                            {floodReport.method.min_change_db != null
                                                ? `${floodReport.method.min_change_db} dB`
                                                : '-3.0 dB'}
                                        </span>
                                    </div>

                                    <div style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        padding: '8px 10px',
                                        background: cardBackground,
                                        border: cardBorder,
                                        fontFamily: MONO,
                                        fontSize: '10px',
                                        letterSpacing: '0.02em'
                                    }}>
                                        <span style={{ color: C.textDim }}>Effective Threshold Used</span>
                                        <span style={{ color: C.accent.flood, fontWeight: 'bold' }}>
                                            {typeof floodReport.method.threshold_db === 'number'
                                                ? `${Number(floodReport.method.threshold_db).toFixed(2)} dB`
                                                : `${floodReport.method?.threshold_db || '-3.0'} dB`}
                                            {Math.abs(Number(floodReport.method.raw_otsu_db) - Number(floodReport.method.threshold_db)) < 0.001 ? (
                                                <span style={{ color: C.textDim, fontWeight: 'normal', fontSize: '9px', marginLeft: '6px' }}>(computed)</span>
                                            ) : (
                                                <span style={{ color: C.textDim, fontWeight: 'normal', fontSize: '9px', marginLeft: '6px' }}>(capped)</span>
                                            )}
                                        </span>
                                    </div>
                                </>
                            ) : (
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    padding: '8px 10px',
                                    background: cardBackground,
                                    border: cardBorder,
                                    fontFamily: MONO,
                                    fontSize: '10px',
                                    letterSpacing: '0.02em'
                                }}>
                                    <span style={{ color: C.textDim }}>Otsu Threshold</span>
                                    <span style={{ color: C.textMid }}>{floodReport.method?.threshold_db || '-3.0'} dB</span>
                                </div>
                            )}

                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '8px 10px',
                                background: cardBackground,
                                border: cardBorder,
                                fontFamily: MONO,
                                fontSize: '10px',
                                letterSpacing: '0.02em'
                            }}>
                                <span style={{ color: C.textDim }}>Median Filter</span>
                                <span style={{ color: C.textMid }}>3 × 3 kernel</span>
                            </div>

                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '8px 10px',
                                background: cardBackground,
                                border: cardBorder,
                                fontFamily: MONO,
                                fontSize: '10px',
                                letterSpacing: '0.02em'
                            }}>
                                <span style={{ color: C.textDim }}>Region Growing</span>
                                <span style={{ color: C.textMid }}>{floodReport.method?.region_growing ? 'Enabled' : 'Disabled'}</span>
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
