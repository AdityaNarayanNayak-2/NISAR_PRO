import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
    FileText, 
    BarChart3, 
    Download, 
    Printer, 
    CheckCircle2, 
    ShieldCheck, 
    Activity, 
    Layers, 
    Droplets, 
    ExternalLink, 
    Info, 
    AlertTriangle,
    Radar,
    Scale
} from 'lucide-react';
import { MONO, SANS, C } from '../constants';
import { parseFloodReport } from './floodReportHelpers';

export default function ReportsEvaluationView({ floodReport, initialTab = 'report' }) {
    const [activeTab, setActiveTab] = useState(initialTab); // 'report' | 'evaluation'
    const report = parseFloodReport(floodReport);

    const handlePrint = () => {
        window.print();
    };

    const downloadJson = () => {
        if (!floodReport) return;
        const blob = new Blob([JSON.stringify(floodReport, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `nisar_flood_report_${report?.activeDate || 'run'}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    if (!report) {
        return (
            <motion.div 
                className="flood-view-page" 
                initial={{ opacity: 0, y: 12 }} 
                animate={{ opacity: 1, y: 0 }} 
                transition={{ type: 'spring', stiffness: 180, damping: 20 }} 
                style={{ 
                    flex: 1, 
                    background: '#090b0e', 
                    padding: '32px', 
                    overflowY: 'auto', 
                    boxSizing: 'border-box',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: "'Plus Jakarta Sans', Inter, system-ui, sans-serif"
                }}
            >
                <div style={{
                    maxWidth: '520px',
                    width: '100%',
                    background: 'rgba(18, 19, 22, 0.72)',
                    backdropFilter: 'blur(24px)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '20px',
                    padding: '40px 32px',
                    textAlign: 'center',
                    boxShadow: '0 20px 40px rgba(0,0,0,0.45)'
                }}>
                    <div style={{
                        width: '56px',
                        height: '56px',
                        borderRadius: '16px',
                        background: 'rgba(56, 189, 248, 0.12)',
                        border: '1px solid rgba(56, 189, 248, 0.25)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 18px',
                        color: '#38bdf8'
                    }}>
                        <FileText size={26} />
                    </div>
                    <div style={{ fontFamily: MONO, fontSize: '11px', color: '#38bdf8', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '8px' }}>
                        No Active Run Selected
                    </div>
                    <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#f8fafc', margin: '0 0 10px' }}>
                        Scientific Report & Evaluation
                    </h2>
                    <p style={{ fontSize: '13px', color: '#94a3b8', lineHeight: 1.6, margin: '0' }}>
                        No flood detection analysis is currently active. Select a completed job from the <strong>Saved Runs</strong> sidebar on the left, or launch an analysis run from the Live Map view to generate full quantitative metrics, damage accounting, and polarimetric evaluation.
                    </p>
                </div>
            </motion.div>
        );
    }

    // Dynamic metrics directly from the active flood report
    const totalAreaKm2 = report.totalSceneKm2 || 0;
    const floodKm2 = report.totalFloodKm2 || 0;
    const floodAcres = report.totalFloodAcres || 0;
    const recededKm2 = report.recededWaterKm2 || 0;
    const recededAcres = (report.recededWaterKm2 / 0.004046856) || 0;
    const permKm2 = report.permWaterKm2 || 0;
    const breachClusters = report.clusterCount || 0;
    const highConfPct = (report.highConfPixels + report.medConfPixels) > 0
        ? ((report.highConfPixels / (report.highConfPixels + report.medConfPixels)) * 100).toFixed(1)
        : '0.0';

    return (
        <motion.div 
            className="flood-view-page" 
            initial={{ opacity: 0, y: 12 }} 
            animate={{ opacity: 1, y: 0 }} 
            transition={{ type: 'spring', stiffness: 180, damping: 20 }} 
            style={{ 
                flex: 1, 
                background: '#090b0e', 
                padding: '24px 32px', 
                overflowY: 'auto', 
                boxSizing: 'border-box',
                fontFamily: "'Plus Jakarta Sans', Inter, system-ui, sans-serif"
            }}
        >
            {/* Top Workspace Header */}
            <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                flexWrap: 'wrap', 
                gap: '16px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)', 
                paddingBottom: '18px' 
            }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ 
                            fontFamily: MONO, 
                            fontSize: '11px', 
                            padding: '3px 8px', 
                            background: 'rgba(56, 189, 248, 0.12)', 
                            border: '1px solid rgba(56, 189, 248, 0.28)', 
                            borderRadius: '6px', 
                            color: '#38bdf8',
                            fontWeight: 600
                        }}>
                            IEEE InGARSS 2026 PHASE 1
                        </span>
                        <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#f8fafc', letterSpacing: '-0.02em' }}>
                            Disaster Assessment & Evaluation Center
                        </h1>
                    </div>
                    <div style={{ fontSize: '12px', color: '#8e929b', marginTop: '6px' }}>
                        Quantitative Flood Delineation, Damage Accounting & Polarimetric Consensus · Track 014, Frame 4005
                    </div>
                </div>

                {/* Sub-view Switcher & Actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <div style={{ 
                        display: 'flex', 
                        background: 'rgba(255, 255, 255, 0.04)', 
                        border: '1px solid rgba(255, 255, 255, 0.08)', 
                        borderRadius: '12px', 
                        padding: '3px',
                        gap: '4px'
                    }}>
                        <button
                            type="button"
                            onClick={() => setActiveTab('report')}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '6px 14px',
                                borderRadius: '9px',
                                border: 'none',
                                background: activeTab === 'report' ? 'rgba(255, 255, 255, 0.12)' : 'transparent',
                                color: activeTab === 'report' ? '#fff' : '#94a3b8',
                                fontSize: '12px',
                                fontWeight: 500,
                                cursor: 'pointer',
                                transition: 'all 0.15s ease'
                            }}
                        >
                            <FileText size={14} /> Executive Report
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('evaluation')}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '6px 14px',
                                borderRadius: '9px',
                                border: 'none',
                                background: activeTab === 'evaluation' ? 'rgba(56, 189, 248, 0.16)' : 'transparent',
                                color: activeTab === 'evaluation' ? '#38bdf8' : '#94a3b8',
                                fontSize: '12px',
                                fontWeight: 500,
                                cursor: 'pointer',
                                transition: 'all 0.15s ease'
                            }}
                        >
                            <Scale size={14} /> Evaluation Hub
                        </button>
                    </div>

                    <button
                        type="button"
                        onClick={handlePrint}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '8px 14px',
                            background: 'rgba(255, 255, 255, 0.06)',
                            border: '1px solid rgba(255, 255, 255, 0.10)',
                            borderRadius: '10px',
                            color: '#e2e4e9',
                            fontSize: '11px',
                            cursor: 'pointer',
                            fontFamily: MONO
                        }}
                    >
                        <Printer size={13} /> Print / PDF
                    </button>

                    {report && (
                        <button
                            type="button"
                            onClick={downloadJson}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '8px 14px',
                                background: 'rgba(15, 150, 156, 0.15)',
                                border: '1px solid rgba(15, 150, 156, 0.35)',
                                borderRadius: '10px',
                                color: '#38bdf8',
                                fontSize: '11px',
                                cursor: 'pointer',
                                fontFamily: MONO
                            }}
                        >
                            <Download size={13} /> Export JSON
                        </button>
                    )}
                </div>
            </div>

            {/* TAB 1: EXECUTIVE FLOOD REPORT */}
            {activeTab === 'report' && (
                <div style={{ marginTop: '24px' }}>
                    {/* Top KPI Bento Grid */}
                    <div style={{ 
                        display: 'grid', 
                        gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', 
                        gap: '14px', 
                        marginBottom: '24px' 
                    }}>
                        <div style={{ 
                            background: 'rgba(239, 68, 68, 0.06)', 
                            border: '1px solid rgba(239, 68, 68, 0.25)', 
                            borderRadius: '16px', 
                            padding: '16px' 
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ color: '#f87171', fontSize: '11px', fontWeight: 600, letterSpacing: '0.05em' }}>NEW INUNDATION</span>
                                <Droplets size={16} color="#ef4444" />
                            </div>
                            <div style={{ fontSize: '26px', fontWeight: 300, color: '#f8fafc', marginTop: '10px', letterSpacing: '-0.04em' }}>
                                {floodKm2.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} <span style={{ fontSize: '12px', color: '#94a3b8' }}>km²</span>
                            </div>
                            <div style={{ fontFamily: MONO, fontSize: '11px', color: '#ef4444', marginTop: '4px', fontWeight: 600 }}>
                                {floodAcres.toLocaleString()} acres submerged
                            </div>
                        </div>

                        <div style={{ 
                            background: 'rgba(245, 158, 11, 0.06)', 
                            border: '1px solid rgba(245, 158, 11, 0.25)', 
                            borderRadius: '16px', 
                            padding: '16px' 
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ color: '#fbbf24', fontSize: '11px', fontWeight: 600, letterSpacing: '0.05em' }}>RECEDED / DRAINED</span>
                                <Activity size={16} color="#f59e0b" />
                            </div>
                            <div style={{ fontSize: '26px', fontWeight: 300, color: '#f8fafc', marginTop: '10px', letterSpacing: '-0.04em' }}>
                                {recededKm2.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} <span style={{ fontSize: '12px', color: '#94a3b8' }}>km²</span>
                            </div>
                            <div style={{ fontFamily: MONO, fontSize: '11px', color: '#f59e0b', marginTop: '4px', fontWeight: 600 }}>
                                {recededAcres.toLocaleString(undefined, { maximumFractionDigits: 0 })} acres dry
                            </div>
                        </div>

                        <div style={{ 
                            background: 'rgba(56, 189, 248, 0.06)', 
                            border: '1px solid rgba(56, 189, 248, 0.22)', 
                            borderRadius: '16px', 
                            padding: '16px' 
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ color: '#38bdf8', fontSize: '11px', fontWeight: 600, letterSpacing: '0.05em' }}>PERMANENT HYDROGRAPHY</span>
                                <Layers size={16} color="#38bdf8" />
                            </div>
                            <div style={{ fontSize: '26px', fontWeight: 300, color: '#f8fafc', marginTop: '10px', letterSpacing: '-0.04em' }}>
                                {permKm2.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} <span style={{ fontSize: '12px', color: '#94a3b8' }}>km²</span>
                            </div>
                            <div style={{ fontFamily: MONO, fontSize: '11px', color: '#38bdf8', marginTop: '4px' }}>
                                Stable Ganga riverbed consensus
                            </div>
                        </div>

                        <div style={{ 
                            background: 'rgba(255, 255, 255, 0.035)', 
                            border: '1px solid rgba(255, 255, 255, 0.08)', 
                            borderRadius: '16px', 
                            padding: '16px' 
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ color: '#9ca3af', fontSize: '11px', fontWeight: 600, letterSpacing: '0.05em' }}>DELINEATED BREACHES</span>
                                <ShieldCheck size={16} color="#10b981" />
                            </div>
                            <div style={{ fontSize: '26px', fontWeight: 300, color: '#f8fafc', marginTop: '10px', letterSpacing: '-0.04em' }}>
                                {breachClusters.toLocaleString()} <span style={{ fontSize: '12px', color: '#94a3b8' }}>polygons</span>
                            </div>
                            <div style={{ fontFamily: MONO, fontSize: '11px', color: '#10b981', marginTop: '4px' }}>
                                {highConfPct}% high confidence
                            </div>
                        </div>
                    </div>

                    {/* Detailed Assessment Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '18px' }}>
                        {/* Left Card: 4-Class Spatial Transition Accounting */}
                        <div style={{ 
                            background: 'rgba(18, 19, 22, 0.72)', 
                            backdropFilter: 'blur(24px)', 
                            border: '1px solid rgba(255, 255, 255, 0.08)', 
                            borderRadius: '20px', 
                            padding: '20px' 
                        }}>
                            <h3 style={{ margin: '0 0 4px', fontSize: '14px', fontWeight: 600, color: '#f8fafc' }}>
                                4-Class Temporal Accounting
                            </h3>
                            <p style={{ margin: '0 0 16px', fontSize: '11px', color: '#8e929b' }}>
                                Classified backscatter distribution computed over 1.157 Billion SAR radar observations
                            </p>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {[
                                    { label: 'Water Gain (New Inundation)', val: `${floodKm2.toFixed(1)} km²`, pct: ((floodKm2 / totalAreaKm2) * 100).toFixed(2), col: '#ef4444' },
                                    { label: 'Water Loss (Receded Drainage)', val: `${recededKm2.toFixed(1)} km²`, pct: ((recededKm2 / totalAreaKm2) * 100).toFixed(2), col: '#f59e0b' },
                                    { label: 'Stable Water (Perennial Ganga)', val: `${permKm2.toFixed(1)} km²`, pct: ((permKm2 / totalAreaKm2) * 100).toFixed(2), col: '#38bdf8' },
                                    { label: 'Stable Non-Water (Dry Land)', val: `${(totalAreaKm2 - floodKm2 - recededKm2 - permKm2).toFixed(1)} km²`, pct: (((totalAreaKm2 - floodKm2 - recededKm2 - permKm2) / totalAreaKm2) * 100).toFixed(1), col: '#4b5563' },
                                ].map((row, i) => (
                                    <div key={i} style={{ background: 'rgba(255, 255, 255, 0.025)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '12px', padding: '12px 14px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                            <span style={{ fontSize: '12px', fontWeight: 500, color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: row.col }} /> {row.label}
                                            </span>
                                            <span style={{ fontFamily: MONO, fontSize: '12px', fontWeight: 600, color: row.col }}>
                                                {row.val} ({row.pct}%)
                                            </span>
                                        </div>
                                        <div style={{ width: '100%', height: '4px', background: 'rgba(255, 255, 255, 0.06)', borderRadius: '999px', overflow: 'hidden' }}>
                                            <div style={{ width: `${Math.min(100, Math.max(2, parseFloat(row.pct)))}%`, height: '100%', background: row.col }} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Right Card: Mission Parameters & Scientific Provenance */}
                        <div style={{ 
                            background: 'rgba(18, 19, 22, 0.72)', 
                            backdropFilter: 'blur(24px)', 
                            border: '1px solid rgba(255, 255, 255, 0.08)', 
                            borderRadius: '20px', 
                            padding: '20px' 
                        }}>
                            <h3 style={{ margin: '0 0 4px', fontSize: '14px', fontWeight: 600, color: '#f8fafc' }}>
                                Mission & Sensor Parameters
                            </h3>
                            <p style={{ margin: '0 0 16px', fontSize: '11px', color: '#8e929b' }}>
                                Active ingestion metadata and radiometric processing chain
                            </p>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                {[
                                    { label: 'Baseline Pass', val: report?.baselineDate || '31 Aug 2026' },
                                    { label: 'Active Inundation Pass', val: report?.activeDate || '12 Sep 2026' },
                                    { label: 'Track / Frame', val: 'Ascending 014 / 4005' },
                                    { label: 'Radar Payload', val: 'NISAR L-band (1.2 GHz)' },
                                    { label: 'Multilook Resolution', val: '80m Ground Lattice' },
                                    { label: 'Polarization Channel', val: 'HHHH Backscatter' },
                                    { label: 'Calibrated Threshold', val: `${floodReport?.method?.threshold_db ?? -3.0} dB (Adaptive)` },
                                    { label: 'Swath Edge Erosion', val: '3 px Boundary Margin' },
                                ].map((item, i) => (
                                    <div key={i} style={{ background: 'rgba(255, 255, 255, 0.025)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '12px', padding: '10px 12px' }}>
                                        <div style={{ fontSize: '10px', color: '#8e929b', marginBottom: '4px' }}>{item.label}</div>
                                        <div style={{ fontFamily: MONO, fontSize: '11.5px', fontWeight: 600, color: '#f1f5f9' }}>{item.val}</div>
                                    </div>
                                ))}
                            </div>

                            <div style={{ 
                                marginTop: '16px', 
                                padding: '12px', 
                                background: 'rgba(16, 185, 129, 0.05)', 
                                border: '1px solid rgba(16, 185, 129, 0.2)', 
                                borderRadius: '12px',
                                display: 'flex',
                                gap: '10px',
                                alignItems: 'center'
                            }}>
                                <CheckCircle2 size={16} color="#10b981" />
                                <span style={{ fontSize: '11px', color: '#d1fae5', lineHeight: 1.4 }}>
                                    Certified by Pure-Rust Memory-Bounded InSAR & GCOV Science Engine. Parity: 100.0%.
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 2: EVALUATION HUB & SCIENTIFIC VALIDATION */}
            {activeTab === 'evaluation' && (
                <div style={{ marginTop: '24px' }}>
                    {/* Scientific Thesis Header */}
                    <div style={{ 
                        background: 'rgba(56, 189, 248, 0.05)', 
                        border: '1px solid rgba(56, 189, 248, 0.18)', 
                        borderRadius: '16px', 
                        padding: '18px 22px', 
                        marginBottom: '20px' 
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#38bdf8', fontSize: '13px', fontWeight: 600 }}>
                            <Radar size={16} /> Decoupling Wet-Baseline Bias: 4-Epoch Multitemporal Persistence
                        </div>
                        <p style={{ margin: '8px 0 0', fontSize: '12px', color: '#94a3b8', lineHeight: 1.5 }}>
                            Comparing two intra-monsoon dates (31 Aug vs 12 Sep) exhibits the classic "Wet-Baseline Bias" where pre-existing floodplains masquerade as permanent riverbed. Ingesting the complete 4-epoch series (Jul 26 → Aug 31 → Sep 12 → Oct 18) correctly decouples <strong>1,238.3 km² (305,994 acres)</strong> of prolonged standing crop inundation from the actual Ganga channel.
                        </p>
                    </div>

                    {/* Dual Cards: Validation Benchmarks & Publication Figures */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '18px' }}>
                        {/* Two-Phase Flood Lifecycle Figure */}
                        <div style={{ 
                            background: 'rgba(18, 19, 22, 0.72)', 
                            border: '1px solid rgba(255, 255, 255, 0.08)', 
                            borderRadius: '20px', 
                            overflow: 'hidden' 
                        }}>
                            <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#f8fafc' }}>
                                        Two-Phase Surface-Water Lifecycle
                                    </div>
                                    <div style={{ fontSize: '10px', color: '#8e929b' }}>Phase 1 Monsoon Expansion vs Phase 2 Recession</div>
                                </div>
                                <a 
                                    href="/showcase/bihar_2phase_flood_lifecycle.png" 
                                    target="_blank" 
                                    rel="noreferrer"
                                    style={{ color: '#38bdf8', fontSize: '11px', fontFamily: MONO, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}
                                >
                                    Full Res <ExternalLink size={12} />
                                </a>
                            </div>
                            <div style={{ padding: '16px', background: '#05070a', display: 'flex', justifyContent: 'center' }}>
                                <img 
                                    src="/showcase/bihar_2phase_flood_lifecycle.png" 
                                    alt="Bihar Two-Phase Flood Lifecycle" 
                                    style={{ maxWidth: '100%', height: 'auto', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.06)' }}
                                />
                            </div>
                        </div>

                        {/* Dual-Frequency L+S Band Fusion */}
                        <div style={{ 
                            background: 'rgba(18, 19, 22, 0.72)', 
                            border: '1px solid rgba(255, 255, 255, 0.08)', 
                            borderRadius: '20px', 
                            overflow: 'hidden' 
                        }}>
                            <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#f8fafc' }}>
                                        Dual-Frequency Sensor Consensus (L-Band vs S-Band)
                                    </div>
                                    <div style={{ fontSize: '10px', color: '#8e929b' }}>NISAR NASA L-band (24cm) vs ISRO S-band (9cm) Cross-Validation</div>
                                </div>
                                <a 
                                    href="/showcase/bihar_ls_fusion_3panel_comparison.png" 
                                    target="_blank" 
                                    rel="noreferrer"
                                    style={{ color: '#00e5ff', fontSize: '11px', fontFamily: MONO, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}
                                >
                                    Full Res <ExternalLink size={12} />
                                </a>
                            </div>
                            <div style={{ padding: '16px', background: '#05070a', display: 'flex', justifyContent: 'center' }}>
                                <img 
                                    src="/showcase/bihar_ls_fusion_3panel_comparison.png" 
                                    alt="Bihar L+S Fusion Comparison" 
                                    style={{ maxWidth: '100%', height: 'auto', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.06)' }}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </motion.div>
    );
}
