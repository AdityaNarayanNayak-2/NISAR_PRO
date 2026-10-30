import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, Calendar, Clock, Layers, Activity, ArrowRight, BarChart3, Droplets, Info, CheckCircle2 } from 'lucide-react';
import { MONO, SANS, C } from '../constants';
import { parseFloodReport } from './floodReportHelpers';

export default function TimeSeriesView({ floodReport, allJobs = [] }) {
    const report = parseFloodReport(floodReport);
    const [activeTab, setActiveTab] = useState('lifecycle'); // 'lifecycle' | 'persistence' | 'showcase'

    // 4 Master Epochs of the 2026 Bihar Flood
    const EPOCHS = [
        {
            id: 'epoch-1',
            date: '26 Jul 2026',
            cycle: '026',
            title: 'Early Monsoon Baseline',
            desc: 'Pre-flood baseline: Ganges riverbed and perennial water bodies before heavy mountain runoff.',
            waterKm2: 2740.36,
            waterAcres: 677157,
            status: 'Dry Season Baseline',
            color: '#38bdf8',
        },
        {
            id: 'epoch-2',
            date: '31 Aug 2026',
            cycle: '029',
            title: 'Pre-Flood Saturated Baseline',
            desc: 'Monsoon onset saturation: soil moisture at capacity, seasonal wetlands filled.',
            waterKm2: 3978.67,
            waterAcres: 983151,
            status: 'Saturated Baseline',
            color: '#00e5ff',
        },
        {
            id: 'epoch-3',
            date: '12 Sep 2026',
            cycle: '030',
            title: 'Peak Gangetic Inundation',
            desc: 'Catastrophic flood peak: embankment breaches along Kosi and Gandak, 1,745 active flood clusters.',
            waterKm2: 5152.23,
            waterAcres: 1273143,
            status: 'Maximum Extent (Peak)',
            color: '#ef4444',
            isPeak: true,
        },
        {
            id: 'epoch-4',
            date: '18 Oct 2026',
            cycle: '033',
            title: 'Post-Monsoon Recession',
            desc: 'Hydrological drainage: floodwaters receded back to main channel; agricultural silt recovery.',
            waterKm2: 2501.96,
            waterAcres: 618247,
            status: 'Drainage & Recovery',
            color: '#f59e0b',
        },
    ];

    // Transitions between epochs
    const TRANSITIONS = [
        {
            phase: 'Phase 1: Peak Monsoon Expansion',
            window: '31 Aug 2026 → 12 Sep 2026',
            interval: '12 days (1 orbit cycle)',
            waterGainKm2: 1173.56,
            waterGainAcres: 289992,
            waterLossKm2: 943.25,
            waterLossAcres: 233082,
            netKm2: 230.31,
            netAcres: 56910,
            regions: 1745,
            direction: 'expansion',
            summary: 'Extensive levee spillovers across Samastipur, Begusarai, and Khagaria. Agricultural inundation reached historical high.'
        },
        {
            phase: 'Phase 2: Post-Monsoon Flood Recession',
            window: '12 Sep 2026 → 18 Oct 2026',
            interval: '36 days (3 orbit cycles)',
            waterGainKm2: 243.40,
            waterGainAcres: 60145,
            waterLossKm2: 2650.27,
            waterLossAcres: 654882,
            netKm2: -2406.87,
            netAcres: -594737,
            regions: 412,
            direction: 'recession',
            summary: 'Rapid drainage into the lower Bay of Bengal basin. Over 654,000 acres of submerged agricultural land dry out for Rabi crop preparation.'
        },
        {
            phase: 'Cumulative Monsoon Surge',
            window: '26 Jul 2026 → 12 Sep 2026',
            interval: '48 days (Full Monsoon Surge)',
            waterGainKm2: 2501.63,
            waterGainAcres: 618165,
            waterLossKm2: 2184.10,
            waterLossAcres: 539702,
            netKm2: 317.53,
            netAcres: 78463,
            regions: 1607,
            direction: 'expansion',
            summary: 'Total monsoon footprint: 2,501 km² of total seasonal inundation over pre-monsoon dry channels.'
        }
    ];

    // Max water km2 for SVG scaling
    const maxWater = 5500;

    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 180, damping: 20 }}
            style={{
                flex: 1,
                background: '#0a0d10',
                padding: '24px',
                overflowY: 'auto',
                boxSizing: 'border-box',
                color: C.text,
            }}
        >
            {/* Header */}
            <div style={{ borderBottom: '1px solid #1c2430', paddingBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                    <div style={{ fontFamily: MONO, fontSize: '13px', fontWeight: 'bold', color: C.accent.flood, display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <TrendingUp size={17} /> 4-EPOCH MULTI-TEMPORAL LIFECYCLE & PERSISTENCE STUDIO
                    </div>
                    <div style={{ fontFamily: SANS, fontSize: '11px', color: C.textDim, marginTop: '4px' }}>
                        NISAR L2 GCOV (Track 014, Frame 4005) · Ganga Alluvial Plain, Bihar · Jul 26 → Aug 31 → Sep 12 → Oct 18, 2026
                    </div>
                </div>

                {/* Tab Navigation */}
                <div style={{ display: 'flex', background: '#111822', padding: '3px', borderRadius: '6px', border: '1px solid #1f2937', gap: '4px' }}>
                    {[
                        { id: 'lifecycle', label: 'Hydrograph & Transitions', icon: Activity },
                        { id: 'persistence', label: 'Flood Persistence Matrix', icon: Layers },
                        { id: 'showcase', label: 'Publication Figures', icon: BarChart3 },
                    ].map(tab => {
                        const Icon = tab.icon;
                        const active = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setActiveTab(tab.id)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    padding: '6px 12px',
                                    background: active ? '#1e293b' : 'transparent',
                                    color: active ? '#38bdf8' : C.textDim,
                                    border: active ? '1px solid rgba(56,189,248,0.3)' : '1px solid transparent',
                                    borderRadius: '4px',
                                    fontFamily: MONO,
                                    fontSize: '11px',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease',
                                }}
                            >
                                <Icon size={13} />
                                {tab.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* TAB 1: HYDROGRAPH & TRANSITIONS */}
            {activeTab === 'lifecycle' && (
                <div style={{ marginTop: '20px' }}>
                    {/* Visual 4-Epoch Timeline Cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '12px', marginBottom: '24px' }}>
                        {EPOCHS.map((epoch, idx) => (
                            <div
                                key={epoch.id}
                                style={{
                                    background: epoch.isPeak ? 'rgba(239, 68, 68, 0.08)' : '#11161f',
                                    border: `1px solid ${epoch.isPeak ? 'rgba(239, 68, 68, 0.4)' : '#1e293b'}`,
                                    borderRadius: '8px',
                                    padding: '14px',
                                    position: 'relative',
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                    <span style={{ fontFamily: MONO, fontSize: '10px', color: epoch.color, fontWeight: 'bold' }}>
                                        EPOCH {idx + 1} · CYCLE {epoch.cycle}
                                    </span>
                                    <span style={{ fontFamily: MONO, fontSize: '9px', background: '#1e293b', padding: '2px 6px', borderRadius: '4px', color: '#94a3b8' }}>
                                        {epoch.date}
                                    </span>
                                </div>
                                <div style={{ fontFamily: SANS, fontSize: '13px', fontWeight: 'bold', color: '#f8fafc', marginBottom: '6px' }}>
                                    {epoch.title}
                                </div>
                                <div style={{ fontFamily: SANS, fontSize: '10px', color: '#94a3b8', lineHeight: '1.4', marginBottom: '12px', minHeight: '40px' }}>
                                    {epoch.desc}
                                </div>
                                <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                                    <div>
                                        <span style={{ fontFamily: MONO, fontSize: '16px', fontWeight: 'bold', color: epoch.color }}>
                                            {epoch.waterKm2.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                                        </span>
                                        <span style={{ fontFamily: MONO, fontSize: '10px', color: '#64748b', marginLeft: '4px' }}>km²</span>
                                    </div>
                                    <span style={{ fontFamily: MONO, fontSize: '10px', color: '#94a3b8' }}>
                                        {epoch.waterAcres.toLocaleString()} ac
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* SVG Hydrograph Bell Curve */}
                    <div style={{ background: '#0e131b', border: '1px solid #1e293b', borderRadius: '8px', padding: '20px', marginBottom: '24px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <div>
                                <span style={{ fontFamily: MONO, fontSize: '11px', fontWeight: 'bold', color: '#38bdf8' }}>
                                    BIHAR MONSOON HYDROGRAPH · TOTAL SURFACE WATER PROFILE
                                </span>
                                <span style={{ display: 'block', fontFamily: SANS, fontSize: '10px', color: '#64748b', marginTop: '2px' }}>
                                    Derived from 1.157 Billion observations per epoch via calibrated GCOV log-ratio backscatter
                                </span>
                            </div>
                            <div style={{ display: 'flex', gap: '12px', fontFamily: MONO, fontSize: '10px', color: '#94a3b8' }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                    <span style={{ width: '8px', height: '8px', background: '#38bdf8', borderRadius: '2px' }} /> Baseline Extent
                                </span>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                    <span style={{ width: '8px', height: '8px', background: '#ef4444', borderRadius: '2px' }} /> Peak Inundation
                                </span>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                    <span style={{ width: '8px', height: '8px', background: '#f59e0b', borderRadius: '2px' }} /> Receding Stage
                                </span>
                            </div>
                        </div>

                        {/* Responsive SVG Chart */}
                        <div style={{ width: '100%', height: '140px' }}>
                            <svg viewBox="0 0 800 140" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                                <defs>
                                    <linearGradient id="hydroFill" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.35" />
                                        <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.02" />
                                    </linearGradient>
                                </defs>
                                {/* Grid lines */}
                                {[0, 35, 70, 105].map(y => (
                                    <line key={y} x1="50" y1={y} x2="770" y2={y} stroke="#1e293b" strokeDasharray="3 3" />
                                ))}
                                {/* Area curve */}
                                <polygon
                                    points="100,120 100,80 300,50 500,15 700,85 700,120"
                                    fill="url(#hydroFill)"
                                />
                                {/* Connecting line */}
                                <polyline
                                    points="100,80 300,50 500,15 700,85"
                                    fill="none"
                                    stroke="#38bdf8"
                                    strokeWidth="2.5"
                                    strokeLinecap="round"
                                />
                                {/* Points & Values */}
                                {[
                                    { x: 100, y: 80, val: '2,740 km²', date: '26 Jul (Onset)', col: '#38bdf8' },
                                    { x: 300, y: 50, val: '3,979 km²', date: '31 Aug (Base)', col: '#00e5ff' },
                                    { x: 500, y: 15, val: '5,152 km² (+1,174 km²)', date: '12 Sep (Peak)', col: '#ef4444' },
                                    { x: 700, y: 85, val: '2,502 km² (−2,650 km²)', date: '18 Oct (Receded)', col: '#f59e0b' },
                                ].map((pt, i) => (
                                    <g key={i}>
                                        <circle cx={pt.x} cy={pt.y} r="5" fill={pt.col} stroke="#0a0d10" strokeWidth="2" />
                                        <text x={pt.x} y={pt.y - 10} textAnchor="middle" fill={pt.col} fontSize="10" fontFamily={MONO} fontWeight="bold">
                                            {pt.val}
                                        </text>
                                        <text x={pt.x} y="135" textAnchor="middle" fill="#64748b" fontSize="9" fontFamily={MONO}>
                                            {pt.date}
                                        </text>
                                    </g>
                                ))}
                            </svg>
                        </div>
                    </div>

                    {/* Transition Dynamics Table */}
                    <div style={{ background: '#0e131b', border: '1px solid #1e293b', borderRadius: '8px', padding: '16px' }}>
                        <div style={{ fontFamily: MONO, fontSize: '11px', fontWeight: 'bold', color: '#f8fafc', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Droplets size={14} color="#00e5ff" /> TWO-PHASE SURFACE WATER TRANSITION DYNAMICS
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '10px' }}>
                            {TRANSITIONS.map((trans, i) => (
                                <div key={i} style={{ background: '#11161f', border: '1px solid #1f2937', borderRadius: '6px', padding: '12px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '6px' }}>
                                        <div>
                                            <span style={{ fontFamily: SANS, fontSize: '12px', fontWeight: 'bold', color: '#f1f5f9' }}>{trans.phase}</span>
                                            <span style={{ fontFamily: MONO, fontSize: '10px', color: '#64748b', marginLeft: '8px' }}>{trans.window}</span>
                                        </div>
                                        <span style={{ fontFamily: MONO, fontSize: '10px', background: trans.direction === 'expansion' ? 'rgba(56,189,248,0.1)' : 'rgba(245,158,11,0.1)', color: trans.direction === 'expansion' ? '#38bdf8' : '#f59e0b', padding: '2px 8px', borderRadius: '4px', border: `1px solid ${trans.direction === 'expansion' ? 'rgba(56,189,248,0.25)' : 'rgba(245,158,11,0.25)'}` }}>
                                            {trans.interval}
                                        </span>
                                    </div>
                                    <p style={{ fontFamily: SANS, fontSize: '10.5px', color: '#94a3b8', margin: '0 0 10px 0', lineHeight: '1.4' }}>
                                        {trans.summary}
                                    </p>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px', borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '8px', fontFamily: MONO, fontSize: '10px' }}>
                                        <div>
                                            <span style={{ color: '#64748b' }}>Water Gain:</span><br />
                                            <strong style={{ color: '#38bdf8' }}>+{trans.waterGainKm2.toFixed(1)} km²</strong> ({trans.waterGainAcres.toLocaleString()} ac)
                                        </div>
                                        <div>
                                            <span style={{ color: '#64748b' }}>Water Loss / Receded:</span><br />
                                            <strong style={{ color: '#f59e0b' }}>−{trans.waterLossKm2.toFixed(1)} km²</strong> ({trans.waterLossAcres.toLocaleString()} ac)
                                        </div>
                                        <div>
                                            <span style={{ color: '#64748b' }}>Net Transition:</span><br />
                                            <strong style={{ color: trans.netKm2 > 0 ? '#38bdf8' : '#34d399' }}>{trans.netKm2 > 0 ? `+${trans.netKm2.toFixed(1)}` : trans.netKm2.toFixed(1)} km²</strong>
                                        </div>
                                        <div>
                                            <span style={{ color: '#64748b' }}>Delineated Clusters:</span><br />
                                            <strong style={{ color: '#f8fafc' }}>{trans.regions} zones</strong>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 2: FLOOD PERSISTENCE MATRIX */}
            {activeTab === 'persistence' && (
                <div style={{ marginTop: '20px' }}>
                    <div style={{ background: '#0e131b', border: '1px solid #1e293b', borderRadius: '8px', padding: '18px', marginBottom: '16px' }}>
                        <div style={{ fontFamily: MONO, fontSize: '12px', fontWeight: 'bold', color: '#38bdf8', marginBottom: '6px' }}>
                            TEMPORAL PERSISTENCE & INUNDATION DURATION ANALYSIS
                        </div>
                        <p style={{ fontFamily: SANS, fontSize: '11px', color: '#94a3b8', lineHeight: '1.5', margin: 0 }}>
                            By tracking every pixel across all four orbital repeat passes (Jul 26, Aug 31, Sep 12, Oct 18), we classify inundation duration. This separates catastrophic agricultural submergence from persistent riverbed channels and flash floods.
                        </p>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
                        {[
                            {
                                tier: 'Flash Inundation (1 Epoch)',
                                duration: '≤ 12 Days Submergence',
                                condition: 'Inundated exclusively during Sep 12 peak flood',
                                areaKm2: '718.64 km²',
                                areaAcres: '177,581 acres',
                                hex: '#ef4444',
                                impact: 'Acute crop lodging and immediate standing water; rapid recession allowed high post-flood soil recovery.',
                            },
                            {
                                tier: 'Prolonged Seasonal Submergence (2 Epochs)',
                                duration: '12 – 48 Days Submergence',
                                condition: 'Inundated in both Aug 31 & Sep 12 passes',
                                areaKm2: '454.91 km²',
                                areaAcres: '112,411 acres',
                                hex: '#f97316',
                                impact: 'Complete loss of Kharif paddy crop; long-duration standing water created anaerobic soil conditions.',
                            },
                            {
                                tier: 'Receded Floodwaters (Recovered Land)',
                                duration: 'Drainage Phase (Sep 12 → Oct 18)',
                                condition: 'Water in Sep 12, dry non-water backscatter by Oct 18',
                                areaKm2: '2,650.27 km²',
                                areaAcres: '654,882 acres',
                                hex: '#f59e0b',
                                impact: 'Fertile silt deposition unmasked across North Bihar floodplain, enabling timely winter Rabi sowing.',
                            },
                            {
                                tier: 'Perennial Riverbed Consensus (All 4 Epochs)',
                                duration: 'Persistent Permanent Water (> 90 Days)',
                                condition: 'Water backscatter < -15.5 dB on all 4 satellite dates',
                                areaKm2: '2,740.36 km²',
                                areaAcres: '677,157 acres',
                                hex: '#00e5ff',
                                impact: 'Main Ganga river navigation channel and permanent wetlands; excluded from flood damage claims.',
                            },
                        ].map((card, i) => (
                            <div key={i} style={{ background: '#11161f', border: `1px solid rgba(255,255,255,0.08)`, borderLeft: `4px solid ${card.hex}`, borderRadius: '6px', padding: '14px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
                                    <span style={{ fontFamily: SANS, fontSize: '12px', fontWeight: 'bold', color: '#f8fafc' }}>{card.tier}</span>
                                    <span style={{ fontFamily: MONO, fontSize: '9px', color: card.hex, background: 'rgba(255,255,255,0.04)', padding: '2px 6px', borderRadius: '4px' }}>{card.duration}</span>
                                </div>
                                <div style={{ fontFamily: MONO, fontSize: '10px', color: '#64748b', marginBottom: '8px' }}>{card.condition}</div>
                                <div style={{ fontFamily: MONO, fontSize: '14px', fontWeight: 'bold', color: card.hex, marginBottom: '6px' }}>
                                    {card.areaKm2} <span style={{ fontSize: '10px', color: '#94a3b8' }}>({card.areaAcres})</span>
                                </div>
                                <div style={{ fontFamily: SANS, fontSize: '10px', color: '#94a3b8', lineHeight: '1.4' }}>
                                    {card.impact}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* TAB 3: PUBLICATION SHOWCASE FIGURES */}
            {activeTab === 'showcase' && (
                <div style={{ marginTop: '20px' }}>
                    <div style={{ background: '#0e131b', border: '1px solid #1e293b', borderRadius: '8px', padding: '16px', marginBottom: '16px' }}>
                        <div style={{ fontFamily: MONO, fontSize: '12px', fontWeight: 'bold', color: '#38bdf8', marginBottom: '6px' }}>
                            IEEE InGARSS 2026 SUBMISSION SHOWCASE ASSETS
                        </div>
                        <p style={{ fontFamily: SANS, fontSize: '11px', color: '#94a3b8', margin: 0 }}>
                            High-resolution figures generated directly from the 80m ground lattice comparing multi-temporal flood lifecycle and L-band vs S-band polarimetric consensus.
                        </p>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '16px' }}>
                        {/* Lifecycle Figure */}
                        <div style={{ background: '#11161f', border: '1px solid #1e293b', borderRadius: '8px', overflow: 'hidden' }}>
                            <div style={{ padding: '12px 16px', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontFamily: MONO, fontSize: '11px', fontWeight: 'bold', color: '#f8fafc' }}>
                                    Two-Phase Flood Lifecycle (Phase 1 vs Phase 2)
                                </span>
                                <a href="/showcase/bihar_2phase_flood_lifecycle.png" target="_blank" rel="noreferrer" style={{ fontFamily: MONO, fontSize: '10px', color: '#38bdf8', textDecoration: 'none' }}>
                                    Full Res ↗
                                </a>
                            </div>
                            <div style={{ padding: '12px', background: '#070a0e', display: 'flex', justifyContent: 'center' }}>
                                <img
                                    src="/showcase/bihar_2phase_flood_lifecycle.png"
                                    alt="Bihar 2-Phase Flood Lifecycle"
                                    style={{ maxWidth: '100%', height: 'auto', borderRadius: '4px', border: '1px solid #1f2937' }}
                                />
                            </div>
                        </div>

                        {/* Dual-Frequency L+S Fusion Figure */}
                        <div style={{ background: '#11161f', border: '1px solid #1e293b', borderRadius: '8px', overflow: 'hidden' }}>
                            <div style={{ padding: '12px 16px', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontFamily: MONO, fontSize: '11px', fontWeight: 'bold', color: '#f8fafc' }}>
                                    Dual-Frequency Sensor Fusion (L-band vs S-band)
                                </span>
                                <a href="/showcase/bihar_ls_fusion_3panel_comparison.png" target="_blank" rel="noreferrer" style={{ fontFamily: MONO, fontSize: '10px', color: '#00e5ff', textDecoration: 'none' }}>
                                    Full Res ↗
                                </a>
                            </div>
                            <div style={{ padding: '12px', background: '#070a0e', display: 'flex', justifyContent: 'center' }}>
                                <img
                                    src="/showcase/bihar_ls_fusion_3panel_comparison.png"
                                    alt="Bihar L+S Fusion Comparison"
                                    style={{ maxWidth: '100%', height: 'auto', borderRadius: '4px', border: '1px solid #1f2937' }}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </motion.div>
    );
}
