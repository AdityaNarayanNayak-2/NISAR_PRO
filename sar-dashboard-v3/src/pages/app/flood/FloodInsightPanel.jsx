import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MONO, SANS, C } from '../constants';
import { parseFloodReport } from './floodReportHelpers';
import { formatElapsed } from '../helpers';
import { Activity, Radio, Cpu, Download, FileText, ArrowLeft, ArrowUpRight, ChevronDown } from 'lucide-react';

export default function FloodInsightPanel({ floodReport, floodGeoJson, selectedRegion, onSelectRegion, elapsed, onClose, onExportGeoJson, onViewReport }) {
    const [sections, setSections] = useState({
        impact: true,
        acquisition: true,
        methodology: true,
        actions: true
    });

    const toggleSection = (sec) => {
        setSections(prev => ({ ...prev, [sec]: !prev[sec] }));
    };

    const handleSectionKeyDown = (event, section) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            toggleSection(section);
        }
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

    // ── Reusable Style Objects (Code Quality Improvement) ──
    const cardBg = 'rgba(255, 255, 255, 0.015)';
    const cardBorder = '1px solid rgba(255, 255, 255, 0.04)';

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
        marginTop: '16px',
        transition: 'color 0.2s ease',
    };

    const renderMethodologyRow = (label, value, isHighlight = false) => (
        <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '8px 10px',
            background: cardBg,
            border: cardBorder,
            fontFamily: MONO,
            fontSize: '10px',
            letterSpacing: '0.02em',
            transition: 'background 0.2s ease'
        }}>
            <span style={{ color: C.textDim }}>{label}</span>
            <span style={{ color: isHighlight ? C.accent.flood : C.textMid, fontWeight: isHighlight ? 'bold' : 'normal' }}>
                {value}
            </span>
        </div>
    );

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
            {/* ── PANEL HEADER ── */}
            <div style={{
                padding: '16px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexShrink: 0,
                background: 'linear-gradient(180deg, rgba(255,255,255,0.02) 0%, transparent 100%)'
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
                        <div style={{ fontFamily: MONO, fontSize: '9px', color: C.textDim, marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            STATUS: <span style={{ color: C.stable, fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <span style={{ width: '5px', height: '5px', background: C.stable, borderRadius: '50%', boxShadow: '0 0 6px C.stable' }}></span>
                                CALIBRATED
                            </span>
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
                                letterSpacing: '0.05em',
                                transition: 'all 0.2s ease'
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(0, 229, 255, 0.2)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'rgba(0, 229, 255, 0.12)'}
                            title="Configure and start a new analysis"
                        >
                            + NEW RUN
                        </button>
                    )}
                </div>
            </div>

            {/* ── SCROLLABLE CONTENT ── */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 16px 16px' }}>

                {/* SECTION 1: FLOOD IMPACT */}
                <div role="button" tabIndex={0} aria-expanded={sections.impact} style={sectionHeaderStyle} onClick={() => toggleSection('impact')} onKeyDown={(event) => handleSectionKeyDown(event, 'impact')} onMouseEnter={e => e.currentTarget.style.color = C.text} onMouseLeave={e => e.currentTarget.style.color = C.textDim}>
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
                        <motion.div aria-hidden="true" animate={{ rotate: sections.impact ? 0 : 180 }} transition={{ duration: 0.2 }}>
                            <ChevronDown size={12} color={C.textDim} />
                        </motion.div>
                    </div>
                </div>

                <AnimatePresence>
                    {sections.impact && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2 }}
                            style={{ overflow: 'hidden' }}
                        >
                            <div style={{ marginTop: '10px' }}>
                                {/* Hero Measurement Card */}
                                <div style={{
                                    background: 'linear-gradient(145deg, rgba(42, 139, 145, 0.04), rgba(255, 255, 255, 0.015))',
                                    border: '1px solid rgba(255, 255, 255, 0.04)',
                                    borderRadius: '2px',
                                    padding: '16px',
                                    marginBottom: '10px',
                                    position: 'relative',
                                }}>
                                    {/* Tactical L-corner brackets */}
                                    <span style={{ position: 'absolute', top: '-1px', left: '-1px', width: '10px', height: '10px', borderTop: `2px solid ${C.accent.flood}`, borderLeft: `2px solid ${C.accent.flood}` }} />
                                    <span style={{ position: 'absolute', top: '-1px', right: '-1px', width: '10px', height: '10px', borderTop: '2px solid rgba(255, 255, 255, 0.4)', borderRight: '2px solid rgba(255, 255, 255, 0.4)' }} />
                                    <span style={{ position: 'absolute', bottom: '-1px', left: '-1px', width: '10px', height: '10px', borderBottom: '2px solid rgba(255, 255, 255, 0.4)', borderLeft: '2px solid rgba(255, 255, 255, 0.4)' }} />
                                    <span style={{ position: 'absolute', bottom: '-1px', right: '-1px', width: '10px', height: '10px', borderBottom: `2px solid ${C.accent.flood}`, borderRight: `2px solid ${C.accent.flood}` }} />

                                    <div style={{ fontFamily: MONO, fontSize: '9px', color: C.textDim, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '6px' }}>
                                        NEW INUNDATION (NET)
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', margin: '8px 0 4px 0' }}>
                                        <span style={{ fontFamily: SANS, fontSize: '36px', fontWeight: 300, color: C.text, letterSpacing: '-0.04em', lineHeight: 1, textShadow: '0 0 20px rgba(42, 139, 145, 0.3)' }}>
                                            {p.totalFloodAcres.toFixed(2)}
                                        </span>
                                        <span style={{ fontFamily: MONO, fontSize: '11px', fontWeight: 500, letterSpacing: '0.06em', color: C.accent.flood, marginLeft: '6px' }}>acres</span>
                                    </div>
                                    <div style={{ fontFamily: MONO, fontSize: '9px', color: C.textDim, marginTop: '8px' }}>
                                        Mapped Area · {p.totalAreaAcres.toLocaleString(undefined, { maximumFractionDigits: 2 })} ac{p.cropPreset ? ` · ${p.cropPreset.replace(/x/i, ' × ')}` : ''}
                                    </div>
                                </div>

                                {/* Wet-baseline diagnostic */}
                                {p.permWaterAcres > 5000 && p.totalFloodAcres < 250 && (
                                    <div style={{
                                        background: 'rgba(230, 168, 23, 0.08)',
                                        border: `1px solid ${C.caution}`,
                                        borderRadius: '2px',
                                        padding: '8px 10px',
                                        marginBottom: '10px',
                                        fontFamily: MONO,
                                        fontSize: '9px',
                                        color: '#f5d78e',
                                        lineHeight: 1.5
                                    }}>
                                        <strong style={{ color: C.caution }}>MONSOON BASELINE ADVISORY:</strong> Baseline ({p.baselineDate}) contains {p.permWaterAcres.toLocaleString(undefined, { maximumFractionDigits: 0 })} ac of standing water. Reported {p.totalFloodAcres.toFixed(2)} ac represents <em>net inter-monsoon expansion</em>, not total inundation footprint.
                                    </div>
                                )}

                                {/* 2x2 Bento Grid */}
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(2, 1fr)',
                                    gap: '6px',
                                    fontFamily: MONO,
                                    marginBottom: '12px',
                                    marginTop: '10px'
                                }}>
                                    {/* Bento Card Component Reusable Block */}
                                    {[
                                        { label: 'High Conf', value: p.highConfAcres.toFixed(2), unit: 'ac', color: C.accent.flood },
                                        { label: 'Medium Conf', value: p.medConfAcres.toFixed(2), unit: 'ac', color: C.caution },
                                        { label: 'Perm Water', value: p.permWaterAcres.toLocaleString(undefined, { maximumFractionDigits: 1 }), unit: 'ac', color: '#5483b3' },
                                        { label: 'Det. Regions', value: p.detectedRegionsCount, unit: 'poly', color: C.textDim }
                                    ].map((item, idx) => (
                                        <motion.div
                                            key={idx}
                                            style={{ background: cardBg, border: cardBorder, padding: '10px', position: 'relative', overflow: 'hidden' }}
                                            whileHover={{ background: 'rgba(255, 255, 255, 0.03)', scale: 1.02 }}
                                            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '8px', letterSpacing: '0.15em', textTransform: 'uppercase', color: C.textDim, marginBottom: '5px' }}>
                                                <span style={{ width: '6px', height: '6px', background: item.color, borderRadius: '50%', boxShadow: `0 0 6px ${item.color}` }} />
                                                <span>{item.label}</span>
                                            </div>
                                            <div style={{ fontFamily: SANS, fontSize: '18px', fontWeight: 300, color: C.text, letterSpacing: '-0.03em', lineHeight: 1.1 }}>
                                                {item.value}<span style={{ fontFamily: MONO, fontSize: '9px', color: C.textDim, marginLeft: '3px' }}>{item.unit}</span>
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>

                                {/* Proportion Bar */}
                                <div style={{ display: 'flex', height: '4px', overflow: 'hidden', background: 'rgba(255,255,255,0.04)', borderRadius: '2px', marginBottom: '14px', marginTop: '10px' }}>
                                    <div style={{ width: `${highPct}%`, background: C.accent.flood, transition: 'width 1s ease' }} title={`High Confidence: ${p.highConfAcres.toFixed(1)} ac`} />
                                    <div style={{ width: `${medPct}%`, background: C.caution, transition: 'width 1s ease' }} title={`Medium Confidence: ${p.medConfAcres.toFixed(1)} ac`} />
                                    <div style={{ width: `${permPct}%`, background: '#5483b3', transition: 'width 1s ease' }} title={`Permanent Water: ${p.permWaterAcres.toFixed(1)} ac`} />
                                </div>
                                <div className="flood-legend" aria-label="Flood impact confidence legend">
                                    <span><i style={{ background: C.accent.flood }} /> High confidence</span>
                                    <span><i style={{ background: C.caution }} /> Medium confidence</span>
                                    <span><i style={{ background: '#5483b3' }} /> Permanent water</span>
                                </div>

                                {/* 1-Click Flood Hotspot Table */}
                                {floodGeoJson?.features?.length > 0 && (
                                    <div style={{ marginTop: '12px', border: cardBorder, background: cardBg, borderRadius: '2px' }}>
                                        <div style={{ padding: '6px 10px', borderBottom: '1px solid rgba(255,255,255,0.05)', fontFamily: MONO, fontSize: '9px', color: C.textDim, display: 'flex', justifyContent: 'space-between' }}>
                                            <span>TOP INUNDATION CLUSTERS (CLICK TO FLY)</span>
                                            <span style={{ color: C.accent.flood }}>{floodGeoJson.features.length} ZONES</span>
                                        </div>
                                        <div style={{ maxHeight: '140px', overflowY: 'auto' }}>
                                            {[...floodGeoJson.features]
                                                .sort((a, b) => (b.properties?.area_acres || 0) - (a.properties?.area_acres || 0))
                                                .slice(0, 8)
                                                .map((feat, i) => {
                                                    const pr = feat.properties || {};
                                                    const isSel = selectedRegion?.id === feat.id || (pr.region_id && selectedRegion?.properties?.region_id === pr.region_id);
                                                    return (
                                                        <div
                                                            key={feat.id || i}
                                                            onClick={() => onSelectRegion && onSelectRegion(feat)}
                                                            style={{
                                                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                                                padding: '6px 10px', fontFamily: MONO, fontSize: '10px', cursor: 'pointer',
                                                                background: isSel ? 'rgba(15, 150, 156, 0.18)' : 'transparent',
                                                                borderBottom: '1px solid rgba(255,255,255,0.03)',
                                                                borderLeft: isSel ? `2px solid ${C.accent.flood}` : '2px solid transparent'
                                                            }}
                                                        >
                                                            <span style={{ color: C.text }}>{pr.region_id || `ZONE-${i + 1}`}</span>
                                                            <span style={{ color: pr.confidence === 'HIGH' ? C.accent.flood : C.caution, fontSize: '9px' }}>{pr.confidence || 'MED'}</span>
                                                            <span style={{ color: C.textMid }}>{pr.area_acres != null ? `${Number(pr.area_acres).toFixed(2)} ac` : `${pr.pixel_count || 1} px`}</span>
                                                        </div>
                                                    );
                                                })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* SECTION 2: ACQUISITION */}
                <div role="button" tabIndex={0} aria-expanded={sections.acquisition} style={sectionHeaderStyle} onClick={() => toggleSection('acquisition')} onKeyDown={(event) => handleSectionKeyDown(event, 'acquisition')} onMouseEnter={e => e.currentTarget.style.color = C.text} onMouseLeave={e => e.currentTarget.style.color = C.textDim}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: C.textMid }}>
                        <Radio size={12} style={{ color: C.accent.flood }} />
                        <span>SECTION 2 · ACQUISITION</span>
                    </div>
                    <motion.div aria-hidden="true" animate={{ rotate: sections.acquisition ? 0 : 180 }} transition={{ duration: 0.2 }}>
                        <ChevronDown size={12} color={C.textDim} />
                    </motion.div>
                </div>

                <AnimatePresence>
                    {sections.acquisition && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2 }}
                            style={{ overflow: 'hidden' }}
                        >
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: '1fr auto',
                                gap: '7px 12px',
                                fontFamily: MONO,
                                fontSize: '10px',
                                letterSpacing: '0.02em',
                                padding: '12px 4px',
                                marginTop: '4px',
                                background: cardBg,
                                border: cardBorder,
                                borderRadius: '2px'
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
                </AnimatePresence>

                {/* SECTION 3: DETECTION */}
                <div role="button" tabIndex={0} aria-expanded={sections.methodology} style={sectionHeaderStyle} onClick={() => toggleSection('methodology')} onKeyDown={(event) => handleSectionKeyDown(event, 'methodology')} onMouseEnter={e => e.currentTarget.style.color = C.text} onMouseLeave={e => e.currentTarget.style.color = C.textDim}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: C.textMid }}>
                        <Cpu size={12} style={{ color: C.accent.flood }} />
                        <span>SECTION 3 · DETECTION</span>
                    </div>
                    <motion.div aria-hidden="true" animate={{ rotate: sections.methodology ? 0 : 180 }} transition={{ duration: 0.2 }}>
                        <ChevronDown size={12} color={C.textDim} />
                    </motion.div>
                </div>

                <AnimatePresence>
                    {sections.methodology && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2 }}
                            style={{ marginTop: '10px', overflow: 'hidden' }}
                        >
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                {renderMethodologyRow('Methodology', 'Log-ratio SAR change')}

                                {floodReport.method?.raw_otsu_db != null ? (
                                    <>
                                        {renderMethodologyRow('Otsu Threshold (computed)', typeof floodReport.method.raw_otsu_db === 'number' ? `${Number(floodReport.method.raw_otsu_db).toFixed(2)} dB` : `${floodReport.method.raw_otsu_db} dB`)}
                                        {renderMethodologyRow('User Ceiling (min change)', floodReport.method.min_change_db != null ? `${floodReport.method.min_change_db} dB` : '-3.0 dB')}
                                        {renderMethodologyRow('Effective Threshold Used', typeof floodReport.method.threshold_db === 'number' ? `${Number(floodReport.method.threshold_db).toFixed(2)} dB` : `${floodReport.method?.threshold_db || '-3.0'} dB`, true)}
                                    </>
                                ) : (
                                    renderMethodologyRow('Otsu Threshold', `${floodReport.method?.threshold_db || '-3.0'} dB`)
                                )}

                                {renderMethodologyRow('Median Filter', '3 × 3 kernel')}
                                {renderMethodologyRow('Region Growing', floodReport.method?.region_growing ? 'Enabled' : 'Disabled')}
                            </div>

                            {/* Visual dual-threshold bar */}
                            {(() => {
                                const effDb = typeof floodReport.method?.threshold_db === 'number' ? floodReport.method.threshold_db : -3.0;
                                const growthDb = typeof floodReport.method?.growth_threshold_db === 'number' ? floodReport.method.growth_threshold_db : -2.5;
                                const toPct = (db) => Math.max(0, Math.min(100, ((db + 25) / 25) * 100));
                                return (
                                    <div style={{ marginTop: '10px', padding: '8px', background: cardBg, border: cardBorder, borderRadius: '2px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: MONO, fontSize: '8px', color: C.textDim }}>
                                            <span>−25 dB</span>
                                            <span>Δ BACKSCATTER</span>
                                            <span>0 dB</span>
                                        </div>
                                        <div style={{ position: 'relative', height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden', marginTop: '4px' }}>
                                            <div style={{ position: 'absolute', left: 0, width: `${toPct(effDb)}%`, height: '100%', background: C.accent.flood, opacity: 0.75 }} title={`High-conf seed (< ${effDb.toFixed(2)} dB)`} />
                                            <div style={{ position: 'absolute', left: `${toPct(effDb)}%`, width: `${Math.max(0, toPct(growthDb) - toPct(effDb))}%`, height: '100%', background: C.caution, opacity: 0.65 }} title={`Region growth (${effDb.toFixed(2)} to ${growthDb.toFixed(2)} dB)`} />
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: MONO, fontSize: '9px', marginTop: '6px' }}>
                                            <span style={{ color: C.accent.flood }}>Seed: {effDb.toFixed(2)} dB</span>
                                            <span style={{ color: C.caution }}>Growth: {growthDb.toFixed(2)} dB</span>
                                        </div>
                                    </div>
                                );
                            })()}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* SECTION 4: DATA & REPORTS */}
                <div role="button" tabIndex={0} aria-expanded={sections.actions} style={sectionHeaderStyle} onClick={() => toggleSection('actions')} onKeyDown={(event) => handleSectionKeyDown(event, 'actions')} onMouseEnter={e => e.currentTarget.style.color = C.text} onMouseLeave={e => e.currentTarget.style.color = C.textDim}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: C.textMid }}>
                        <FileText size={12} style={{ color: C.accent.flood }} />
                        <span>SECTION 4: DATA & REPORTS</span>
                    </div>
                    <motion.div aria-hidden="true" animate={{ rotate: sections.actions ? 0 : 180 }} transition={{ duration: 0.2 }}>
                        <ChevronDown size={12} color={C.textDim} />
                    </motion.div>
                </div>

                <AnimatePresence>
                    {sections.actions && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2 }}
                            style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px', overflow: 'hidden' }}
                        >
                            <motion.button className="flood-panel-action flood-panel-action-primary"
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

                            <motion.button className="flood-panel-action"
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
                                <motion.button className="flood-panel-action flood-panel-action-solid"
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
                                        gap: '6px',
                                        boxShadow: '0 0 15px rgba(15, 150, 156, 0.3)'
                                    }}
                                    whileHover={{ scale: 1.01, background: '#34a4ab', boxShadow: '0 0 20px rgba(15, 150, 156, 0.5)' }}
                                    whileTap={{ scale: 0.98 }}
                                >
                                    <FileText size={12} />
                                    <span>VIEW ANALYSIS REPORT</span>
                                    <ArrowUpRight size={10} style={{ marginLeft: '-2px' }} />
                                </motion.button>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
