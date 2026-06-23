import React, { useState } from 'react';
import { FolderOpen, Upload } from 'lucide-react';
import { MONO, SANS, C } from './constants';
import { parseNisarFilename, sevColor, formatElapsed } from './helpers';
import { api } from '../../config/api';

export default function InfrastructurePanel({
    assetSearch,
    setAssetSearch,
    searchAssets,
    assetSearchOpen,
    setAssetSearchOpen,
    assetResults,
    setAssetResults,
    assetName,
    setAssetName,
    assetType,
    setAssetType,
    assetLat,
    setAssetLat,
    assetLon,
    setAssetLon,
    assetState,
    setAssetState,
    setFlyToCenter,
    envContext,
    fetchingContext,
    fetchContext,
    contextFetchedAt,
    localFilePath,
    setLocalFilePath,
    metadata,
    slaveFilePath,
    setSlaveFilePath,
    activeLayer,
    setActiveLayer,
    startJob,
    getInputFile,
    runningJobs,
    gatewayOnline,
    elapsed,
    viewingResult,
}) {
    const [editingMaster, setEditingMaster] = useState(false);
    const [editingSlave, setEditingSlave] = useState(false);
    const [activeView, setActiveView] = useState('STRUCTURAL');
    const [uploading, setUploading] = useState(false);

    const showResults = viewingResult?.insarReport?.summary;
    const masterFilename = localFilePath ? localFilePath.split('/').pop() : '';
    const slaveFilename = slaveFilePath ? slaveFilePath.split('/').pop() : '';

    const isGunw = !localFilePath || localFilePath.toLowerCase().includes('_gunw') || localFilePath.toLowerCase().endsWith('.h5') || localFilePath.toLowerCase().endsWith('.he5');

    const handleUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await fetch(api('/upload'), {
                method: 'POST',
                body: formData,
            });
            if (!res.ok) throw new Error('Upload failed');
            const data = await res.json();
            if (data.path) {
                setLocalFilePath(data.path);
            }
        } catch (err) {
            console.error('File upload error:', err);
            alert('Upload failed: ' + err.message);
        } finally {
            setUploading(false);
            e.target.value = '';
        }
    };

    // ── 6-METRIC SCORECARD MATHEMATICAL CALCULATIONS ──
    const insarSummary = viewingResult?.insarReport?.summary;

    // B. Deformation Score (0-100)
    let deformationScore = 0;
    if (insarSummary) {
        const crit = insarSummary.critical_count || 0;
        const alrt = insarSummary.alert_count || 0;
        const maxDisp = Math.abs(insarSummary.max_displacement_mm || 0);
        deformationScore = Math.min(100, Math.max(0, Math.round(
            (crit * 15) + (alrt * 1.5) + (maxDisp * 3.5)
        )));
    }

    // C. Water Spread / Reservoir Expansion Score (0-100)
    const storagePct = envContext?.storage_pct != null ? envContext.storage_pct : null;
    const waterSpreadScore = storagePct !== null ? Math.min(100, Math.max(0, Math.round(storagePct))) : 0;

    // D. External Stress Score (0-100)
    const rainfall = parseFloat(envContext?.rainfall) || 0;
    const rainContrib = Math.min(40, rainfall * 0.5);

    const soilText = envContext?.soil_moisture?.toLowerCase() || '';
    const soilContrib = soilText.includes('saturated') ? 30 :
        (soilText.includes('high') || soilText.includes('anomaly')) ? 18 :
            (soilText.includes('moist') || soilText.includes('moisture')) ? 10 : 0;

    const seismicText = envContext?.seismic?.toLowerCase() || '';
    const seismicContrib = seismicText.includes('events') ? 30 : 0;

    const externalStressScore = Math.min(100, Math.max(0, Math.round(
        rainContrib + soilContrib + seismicContrib
    )));

    // F. Trend Score (0-100)
    let trendScore = 0;
    if (deformationScore > 0) {
        trendScore = Math.min(100, Math.max(0, Math.round(deformationScore * 0.8 + 10)));
    }

    // E. Confidence Score (0-100)
    let confidenceScore = 15; // default low baseline
    if (insarSummary && envContext) {
        confidenceScore = 95;
    } else if (envContext) {
        confidenceScore = 70;
    } else if (insarSummary) {
        confidenceScore = 60;
    }
    if (insarSummary && insarSummary.mean_coherence != null) {
        confidenceScore = Math.max(20, Math.round(confidenceScore * (insarSummary.mean_coherence / 0.8)));
    }

    // A. Overall Dam Risk Score (0-100)
    const overallRiskScore = Math.min(100, Math.max(0, Math.round(
        (deformationScore * 0.40) +
        (waterSpreadScore * 0.20) +
        (externalStressScore * 0.20) +
        (trendScore * 0.20)
    )));

    return (
        <>
            {/* ════════════════════════════════════════════════════
                ZONE 1: LEFT PANEL (240px)
                ════════════════════════════════════════════════════ */}
            <div style={{
                position: 'absolute', top: '42px', left: 0, bottom: 0,
                width: '240px', background: C.bg0,
                borderRight: `1px solid ${C.bg3}`, zIndex: 100,
                overflowY: 'auto',
                boxSizing: 'border-box',
            }}>
                {/* ── PANEL 1: ASSET ── */}
                <div style={{ background: C.bg1, borderBottom: `2px solid ${C.accent.infra}`, padding: '12px 14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ fontFamily: MONO, fontSize: '9px', color: C.textDim, letterSpacing: '0.15em', textTransform: 'uppercase' }}>Asset</span>
                    </div>
                    <div style={{ position: 'relative', marginBottom: assetSearchOpen ? '0px' : '0px' }}>
                        <input
                            type="text"
                            value={assetSearch}
                            onChange={(e) => { setAssetSearch(e.target.value); searchAssets(e.target.value); }}
                            placeholder="Search dam or bridge..."
                            style={{ width: '100%', padding: '7px 10px', background: C.bg0, border: `1px solid ${C.bg3}`, color: C.text, fontFamily: MONO, fontSize: '11px', boxSizing: 'border-box', outline: 'none', borderRadius: 0 }}
                            onFocus={(e) => e.target.style.borderColor = C.bg4}
                            onBlur={(e) => { setTimeout(() => { e.target.style.borderColor = C.bg3; setAssetSearchOpen(false); }, 200); }}
                        />
                        {assetSearchOpen && assetResults.length > 0 && (
                            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: C.bg0, border: `1px solid ${C.bg3}`, borderTop: 'none', zIndex: 200, maxHeight: '200px', overflowY: 'auto' }}>
                                {assetResults.map((asset, i) => (
                                    <div
                                        key={asset.id || i}
                                        onMouseDown={() => {
                                            setAssetSearch(asset.name);
                                            setAssetName(asset.name);
                                            setAssetType(asset.asset_type);
                                            setAssetLat(asset.lat.toString());
                                            setAssetLon(asset.lon.toString());
                                            setAssetState(asset.state || asset.country || '');
                                            setAssetResults([]);
                                            setAssetSearchOpen(false);
                                            setFlyToCenter([asset.lat, asset.lon]);
                                        }}
                                        style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: `1px solid ${C.bg3}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                                        onMouseEnter={(e) => e.currentTarget.style.background = C.bg2}
                                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                    >
                                        <span style={{ fontFamily: MONO, fontSize: '11px', color: C.text }}>{asset.name}</span>
                                        <span style={{ fontFamily: MONO, fontSize: '10px', color: C.textDim }}>{asset.state || asset.country}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Asset details when selected */}
                    {assetLat && assetLon && assetName && (
                        <>
                            <div style={{ fontFamily: MONO, fontSize: '13px', color: C.text, fontWeight: 600, marginTop: '10px' }}>{assetName}</div>
                            <div style={{ display: 'flex', gap: '16px', marginTop: '6px' }}>
                                <div>
                                    <div style={{ fontFamily: MONO, fontSize: '9px', color: C.textDim }}>TYPE</div>
                                    <div style={{ fontFamily: MONO, fontSize: '11px', color: C.accent.infra }}>{assetType}</div>
                                </div>
                                <div>
                                    <div style={{ fontFamily: MONO, fontSize: '9px', color: C.textDim }}>STATE</div>
                                    <div style={{ fontFamily: MONO, fontSize: '11px', color: C.textMid }}>{assetState || '—'}</div>
                                </div>
                            </div>
                            <div style={{ fontFamily: MONO, fontSize: '9px', color: C.textDim, marginTop: '6px' }}>{assetLat}°N  {assetLon}°E</div>

                            {/* STRUCTURAL / FLOOD RISK toggle */}
                            <div style={{ display: 'flex', marginTop: '10px' }}>
                                <button
                                    onClick={() => setActiveView('STRUCTURAL')}
                                    style={{
                                        flex: 1, fontFamily: MONO, fontSize: '10px', padding: '6px 0', cursor: 'pointer',
                                        background: activeView === 'STRUCTURAL' ? C.bg2 : 'transparent',
                                        color: activeView === 'STRUCTURAL' ? C.text : C.textDim,
                                        border: 'none',
                                        borderBottom: activeView === 'STRUCTURAL' ? `2px solid ${C.accent.infra}` : '2px solid transparent',
                                    }}
                                >
                                    STRUCTURAL
                                </button>
                                <button
                                    onClick={() => setActiveView('FLOOD RISK')}
                                    style={{
                                        flex: 1, fontFamily: MONO, fontSize: '10px', padding: '6px 0', cursor: 'pointer',
                                        background: activeView === 'FLOOD RISK' ? C.bg2 : 'transparent',
                                        color: activeView === 'FLOOD RISK' ? C.text : C.textDim,
                                        border: 'none',
                                        borderBottom: activeView === 'FLOOD RISK' ? `2px solid ${C.accent.infra}` : '2px solid transparent',
                                    }}
                                >
                                    FLOOD RISK
                                </button>
                            </div>
                        </>
                    )}
                </div>

                {activeView === 'STRUCTURAL' && (
                    <>
                        {/* ── PANEL 2: FIELD TELEMETRY ── */}
                        <div style={{ padding: '12px 14px', borderBottom: '1px solid #1A1A1A' }}>
                            <div style={{ fontFamily: MONO, fontSize: '9px', color: '#555555', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '10px' }}>FIELD TELEMETRY</div>
                            {[
                                {
                                    label: 'RESERVOIR',
                                    value: envContext?.reservoir || '—',
                                    status: envContext?.reservoir && envContext.reservoir !== 'UNAVAILABLE' && envContext.reservoir.includes('%')
                                        ? (parseFloat(envContext.reservoir) > 90 ? 'warn' : 'ok')
                                        : 'off',
                                },
                                {
                                    label: 'RAINFALL',
                                    value: envContext?.rainfall || '—',
                                    status: envContext?.rainfall && envContext.rainfall !== 'UNAVAILABLE'
                                        ? (envContext.rainfall.includes('mm') ? 'data' : 'ok')
                                        : 'off',
                                },
                                {
                                    label: 'SOIL',
                                    value: envContext?.soil_moisture || '—',
                                    status: envContext?.soil_moisture && envContext.soil_moisture !== 'UNAVAILABLE'
                                        ? (envContext.soil_moisture.toLowerCase().includes('anomaly') || envContext.soil_moisture.includes('saturated') ? 'warn' : 'ok')
                                        : 'off',
                                },
                                {
                                    label: 'SEISMIC',
                                    value: envContext?.seismic || '—',
                                    status: envContext?.seismic && envContext.seismic !== 'UNAVAILABLE'
                                        ? (envContext.seismic.toLowerCase().includes('no activity') || envContext.seismic.toLowerCase().includes('no events') ? 'ok' : 'warn')
                                        : 'off',
                                },
                                {
                                    label: 'SEASON',
                                    value: envContext?.season || '—',
                                    status: envContext?.season && envContext.season !== 'UNAVAILABLE' ? 'accent' : 'off',
                                },
                            ].map(({ label, value, status }) => {
                                const dotColor = status === 'ok' ? C.stable
                                    : status === 'warn' ? C.caution
                                        : status === 'data' ? C.data
                                            : status === 'accent' ? C.accent.infra
                                                : '#333333';
                                return (
                                    <div key={label} style={{
                                        display: 'flex', alignItems: 'center', gap: '8px',
                                        padding: '6px 0',
                                        borderBottom: '1px solid #161616',
                                    }}>
                                        <div style={{
                                            width: '5px', height: '5px', borderRadius: '50%',
                                            background: dotColor, flexShrink: 0,
                                            boxShadow: status !== 'off' ? `0 0 4px ${dotColor}40` : 'none',
                                        }} />
                                        <span style={{ fontFamily: MONO, fontSize: '10px', color: '#555555', width: '68px', flexShrink: 0 }}>{label}</span>
                                        <span style={{
                                            fontFamily: MONO, fontSize: '10px',
                                            color: value === '—' ? '#333333' : '#CCCCCC',
                                            lineHeight: 1.4, wordBreak: 'break-word', flex: 1,
                                        }}>{value}</span>
                                    </div>
                                );
                            })}
                        </div>

                        {/* ── PANEL 3: ASSESSMENT ── */}
                        <div style={{ padding: '12px 14px', borderBottom: '1px solid #1A1A1A' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                <span style={{ fontFamily: MONO, fontSize: '9px', color: '#555555', letterSpacing: '0.15em', textTransform: 'uppercase' }}>ASSESSMENT</span>
                                {(() => {
                                    const conf = envContext?.confidence;
                                    const pillColor = conf === 'HIGH' ? C.critical
                                        : conf === 'MODERATE' ? C.caution
                                            : conf === 'LOW' ? C.stable
                                                : '#333333';
                                    return (
                                        <span style={{
                                            fontFamily: MONO, fontSize: '8px', fontWeight: 600,
                                            padding: '2px 8px', borderRadius: '1px',
                                            background: conf ? `${pillColor}20` : '#1A1A1A',
                                            color: conf ? pillColor : '#555555',
                                            border: `1px solid ${conf ? `${pillColor}40` : '#2A2A2A'}`,
                                            letterSpacing: '0.08em',
                                        }}>
                                            {conf || 'NO DATA'}
                                        </span>
                                    );
                                })()}
                            </div>
                            <div style={{
                                fontFamily: SANS, fontSize: '11px', color: '#CCCCCC',
                                lineHeight: 1.5, marginBottom: '10px',
                            }}>
                                {envContext?.assessment || 'Environmental assessment context unavailable.'}
                            </div>
                            <div style={{
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                fontFamily: MONO, fontSize: '8px', color: '#444444',
                                paddingTop: '8px', borderTop: '1px solid #1A1A1A',
                            }}>
                                <span>{envContext?.source || 'NO SOURCE'}</span>
                                {contextFetchedAt && (
                                    <span>{contextFetchedAt.toISOString().slice(0, 16).replace('T', ' ')}</span>
                                )}
                            </div>
                        </div>

                        {/* Fetch button when no context loaded */}
                        {assetLat && assetLon && !envContext && (
                            <div style={{ padding: '0 14px' }}>
                                <button
                                    onClick={fetchContext}
                                    style={{
                                        width: '100%', background: 'transparent',
                                        border: `1px solid #2A2A2A`, color: '#666666',
                                        fontFamily: MONO, fontSize: '10px', letterSpacing: '0.08em',
                                        padding: '8px 0', borderRadius: '1px',
                                        cursor: 'pointer', marginTop: '12px',
                                        transition: 'all 150ms ease',
                                    }}
                                    onMouseEnter={(e) => { e.target.style.borderColor = '#C8A96E'; e.target.style.color = '#C8A96E'; }}
                                    onMouseLeave={(e) => { e.target.style.borderColor = '#2A2A2A'; e.target.style.color = '#666666'; }}
                                >
                                    {fetchingContext ? 'FETCHING...' : 'FETCH TELEMETRY'}
                                </button>
                            </div>
                        )}

                        {/* ── PANEL 4: ALERTS ── */}
                        {viewingResult?.insarReport?.summary && (() => {
                            const s = viewingResult.insarReport.summary;
                            const SEV_ORDER = { CRITICAL: 0, ALERT: 1, CAUTION: 2, STABLE: 3 };
                            const alerts = [];

                            if (s.critical_count > 0)
                                alerts.push({ severity: 'CRITICAL', message: `${s.critical_count} PS points exceed critical displacement threshold` });
                            if (s.alert_count > 50)
                                alerts.push({ severity: 'ALERT', message: `${s.alert_count} points showing significant deformation` });
                            if (Math.abs(s.max_displacement_mm) > 10)
                                alerts.push({ severity: 'ALERT', message: `Max displacement ${s.max_displacement_mm.toFixed(1)}mm exceeds 10mm threshold` });
                            if (s.max_displacement_mm < -5)
                                alerts.push({ severity: 'CAUTION', message: `Subsidence detected: ${Math.abs(s.max_displacement_mm).toFixed(1)}mm` });
                            if (envContext?.storage_pct > 90 && s.caution_count > 0)
                                alerts.push({ severity: 'CAUTION', message: 'Reservoir at high capacity — monitor embankment' });
                            if (alerts.length === 0)
                                alerts.push({ severity: 'STABLE', message: 'Baseline monitoring active — no anomalies' });

                            alerts.sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity]);
                            const visible = alerts.slice(0, 3);

                            const pillStyle = (sev) => {
                                const base = {
                                    fontFamily: MONO, fontSize: '8px', fontWeight: 600,
                                    padding: '2px 6px', borderRadius: '1px',
                                    letterSpacing: '0.04em', whiteSpace: 'nowrap', flexShrink: 0,
                                };
                                if (sev === 'CRITICAL') return { ...base, background: C.critical, color: '#F0F0F0' };
                                if (sev === 'ALERT') return { ...base, background: C.alert, color: '#F0F0F0' };
                                if (sev === 'CAUTION') return { ...base, background: C.caution, color: '#0A0A0A' };
                                return { ...base, background: 'transparent', color: C.stable, border: `1px solid ${C.stable}` };
                            };

                            return (
                                <div style={{ padding: '12px 14px' }}>
                                    <div style={{ fontFamily: MONO, fontSize: '9px', color: '#555555', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '10px' }}>ALERTS</div>
                                    {visible.map((a, i) => (
                                        <div key={i} style={{
                                            display: 'flex', gap: '8px', alignItems: 'flex-start',
                                            padding: '7px 0',
                                            borderBottom: i < visible.length - 1 ? '1px solid #161616' : 'none',
                                        }}>
                                            <span style={pillStyle(a.severity)}>{a.severity}</span>
                                            <span style={{ fontFamily: MONO, fontSize: '10px', color: '#888888', lineHeight: 1.5, flex: 1 }}>{a.message}</span>
                                        </div>
                                    ))}
                                </div>
                            );
                        })()}
                    </>
                )}

                {activeView === 'FLOOD RISK' && (() => {
                    const insarSummary = viewingResult?.insarReport?.summary;

                    // ── Compute factor scores from real data ──
                    let reservoirScore = 0;
                    const storagePct = envContext?.storage_pct;
                    if (storagePct > 95) reservoirScore = 30;
                    else if (storagePct > 85) reservoirScore = 20;
                    else if (storagePct > 70) reservoirScore = 10;

                    let rainfallScore = 0;
                    const rainfall = parseFloat(envContext?.rainfall);
                    if (!isNaN(rainfall)) {
                        if (rainfall > 200) rainfallScore = 30;
                        else if (rainfall > 100) rainfallScore = 20;
                        else if (rainfall > 50) rainfallScore = 10;
                    }

                    let soilScore = 0;
                    const soilText = envContext?.soil_moisture?.toLowerCase() || '';
                    if (soilText.includes('saturated')) soilScore = 20;
                    else if (soilText.includes('high') || soilText.includes('anomaly')) soilScore = 12;
                    else if (soilText.includes('moist')) soilScore = 6;

                    let seismicScore = 0;
                    if (envContext?.seismic?.toLowerCase().includes('events')) seismicScore = 10;

                    let insarScore = 0;
                    if (insarSummary?.critical_count > 0) insarScore = 10;
                    else if (insarSummary?.alert_count > 0) insarScore = 5;

                    const score = reservoirScore + rainfallScore + soilScore + seismicScore + insarScore;

                    const level = score >= 70 ? 'CRITICAL' :
                        score >= 50 ? 'HIGH' :
                            score >= 30 ? 'MODERATE' : 'LOW';

                    const color = score >= 70 ? C.critical :
                        score >= 50 ? C.alert :
                            score >= 30 ? C.caution : C.stable;

                    const factors = [
                        { label: 'RESERVOIR', scored: reservoirScore, max: 30, color: '#D4822A' },
                        { label: 'RAINFALL', scored: rainfallScore, max: 30, color: C.data },
                        { label: 'SOIL', scored: soilScore, max: 20, color: C.caution },
                        { label: 'SEISMIC', scored: seismicScore, max: 10, color: '#9B8EC4' },
                        { label: 'INSAR', scored: insarScore, max: 10, color: C.accent.infra },
                    ];

                    return (
                        <>
                            {/* ── PANEL 2: FLOOD RISK INDEX ── */}
                            <div style={{ padding: '14px 14px 12px', borderBottom: '1px solid #1A1A1A' }}>
                                <div style={{ fontFamily: MONO, fontSize: '9px', color: '#555555', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '12px' }}>FLOOD RISK INDEX</div>
                                <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '8px' }}>
                                    <span style={{ fontFamily: MONO, fontSize: '42px', fontWeight: 600, color, lineHeight: 1 }}>{score}</span>
                                    <span style={{ fontFamily: MONO, fontSize: '16px', color: '#444444' }}>/100</span>
                                </div>
                                <div style={{
                                    display: 'inline-block', fontFamily: MONO, fontSize: '9px', fontWeight: 600,
                                    color, padding: '2px 8px', borderRadius: '1px',
                                    background: `${color}20`, border: `1px solid ${color}40`,
                                    letterSpacing: '0.08em', marginBottom: '8px',
                                }}>{level} RISK</div>
                                <div style={{ fontFamily: MONO, fontSize: '8px', color: '#444444' }}>NISAR · WRIS · IMD · USGS</div>

                                {/* Contributors breakdown */}
                                <div style={{ marginTop: '12px' }}>
                                    <div style={{ fontFamily: MONO, fontSize: '9px', color: '#555555', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '6px' }}>CONTRIBUTORS</div>
                                    {(() => {
                                        const active = factors.filter(f => f.scored > 0).sort((a, b) => b.scored - a.scored);
                                        if (active.length === 0) {
                                            return <div style={{ fontFamily: MONO, fontSize: '10px', color: '#888888' }}>No active risk contributors</div>;
                                        }
                                        return (
                                            <>
                                                {active.map(f => (
                                                    <div key={f.label} style={{ fontFamily: MONO, fontSize: '10px', color: '#888888', lineHeight: 1.6 }}>
                                                        + {f.label} {'·'.repeat(Math.max(1, 18 - f.label.length))} {f.scored}
                                                    </div>
                                                ))}
                                                <div style={{ fontFamily: MONO, fontSize: '9px', color: '#C8A96E', marginTop: '6px' }}>
                                                    Highest: {active[0].label} at {active[0].scored}/{active[0].max}
                                                </div>
                                            </>
                                        );
                                    })()}
                                </div>
                            </div>

                            {/* ── PANEL 3: FACTOR BREAKDOWN (bars) ── */}
                            <div style={{ padding: '12px 14px' }}>
                                <div style={{ fontFamily: MONO, fontSize: '9px', color: '#555555', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '10px' }}>FACTOR BREAKDOWN</div>
                                {factors.map(f => (
                                    <div key={f.label} style={{ marginBottom: '8px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                                            <span style={{ fontFamily: MONO, fontSize: '9px', color: '#666666' }}>{f.label}</span>
                                            <span style={{ fontFamily: MONO, fontSize: '9px', color: f.scored > 0 ? '#CCCCCC' : '#333333' }}>{f.scored}/{f.max}</span>
                                        </div>
                                        <div style={{ height: '4px', background: '#1A1A1A', borderRadius: '1px', overflow: 'hidden' }}>
                                            <div style={{
                                                height: '100%', borderRadius: '1px',
                                                width: `${(f.scored / f.max) * 100}%`,
                                                background: f.scored > 0 ? f.color : 'transparent',
                                                transition: 'width 300ms ease',
                                            }} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    );
                })()}


            </div>

            {/* ════════════════════════════════════════════════════
                ZONE 3: BOTTOM BAR (80px)
                ════════════════════════════════════════════════════ */}
            <div style={{
                position: 'absolute', bottom: 0, left: '240px', right: 0,
                height: '80px', background: '#111111',
                borderTop: '1px solid #2A2A2A', zIndex: 100,
                display: 'flex', alignItems: 'center',
                padding: '0 20px', gap: '24px',
                boxSizing: 'border-box',
            }}>
                {/* LEFT GROUP: Master + Slave + Pipeline */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', minWidth: 0 }}>
                    {/* MASTER / GNUW FILE */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                        <span style={{ fontFamily: MONO, fontSize: '10px', color: '#555555', flexShrink: 0 }}>
                            {isGunw ? 'GNUW FILE' : 'MASTER'}
                        </span>
                        {editingMaster ? (
                            <input
                                autoFocus
                                type="text"
                                value={localFilePath}
                                onChange={e => setLocalFilePath(e.target.value)}
                                onBlur={() => setEditingMaster(false)}
                                onKeyDown={e => { if (e.key === 'Enter') setEditingMaster(false); }}
                                style={{ width: '220px', padding: '4px 8px', background: C.bg2, border: `1px solid ${C.bg3}`, color: '#F0F0F0', fontFamily: MONO, fontSize: '11px', outline: 'none', borderRadius: '2px', boxSizing: 'border-box' }}
                            />
                        ) : (
                            <span
                                style={{ fontFamily: MONO, fontSize: '11px', color: '#F0F0F0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '180px' }}
                                title={localFilePath}
                            >
                                {masterFilename || '—'}
                            </span>
                        )}
                        <button
                            onClick={() => setEditingMaster(true)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: '#555555', display: 'flex', alignItems: 'center' }}
                            onMouseEnter={e => e.currentTarget.style.color = '#F0F0F0'}
                            onMouseLeave={e => e.currentTarget.style.color = '#555555'}
                            title="Edit file path"
                        >
                            <FolderOpen size={14} />
                        </button>
                        <label
                            style={{ display: 'flex', alignItems: 'center', cursor: uploading ? 'not-allowed' : 'pointer', padding: '2px', color: '#555555' }}
                            onMouseEnter={e => !uploading && (e.currentTarget.style.color = '#F0F0F0')}
                            onMouseLeave={e => !uploading && (e.currentTarget.style.color = '#555555')}
                            title="Upload local HDF5 product"
                        >
                            <Upload size={14} />
                            <input
                                type="file"
                                accept=".h5,.he5"
                                onChange={handleUpload}
                                disabled={uploading}
                                style={{ display: 'none' }}
                            />
                        </label>
                        {uploading && (
                            <span style={{ fontFamily: MONO, fontSize: '9px', color: '#E6A817', marginLeft: '4px' }}>
                                UPLOADING...
                            </span>
                        )}
                    </div>

                    {!isGunw && (
                        <>
                            {/* Separator */}
                            <div style={{ width: '1px', height: '32px', background: '#2A2A2A', flexShrink: 0 }} />

                            {/* SLAVE */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                                <span style={{ fontFamily: MONO, fontSize: '10px', color: '#555555', flexShrink: 0 }}>SLAVE</span>
                                {editingSlave ? (
                                    <input
                                        autoFocus
                                        type="text"
                                        value={slaveFilePath}
                                        onChange={e => setSlaveFilePath(e.target.value)}
                                        onBlur={() => setEditingSlave(false)}
                                        onKeyDown={e => { if (e.key === 'Enter') setEditingSlave(false); }}
                                        style={{ width: '220px', padding: '4px 8px', background: C.bg2, border: `1px solid ${C.bg3}`, color: '#F0F0F0', fontFamily: MONO, fontSize: '11px', outline: 'none', borderRadius: '2px', boxSizing: 'border-box' }}
                                    />
                                ) : (
                                    <span
                                        style={{ fontFamily: MONO, fontSize: '11px', color: slaveFilename ? '#888888' : '#555555', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '140px' }}
                                        title={slaveFilePath}
                                    >
                                        {slaveFilename || 'SYNTHETIC'}
                                    </span>
                                )}
                                <button
                                    onClick={() => setEditingSlave(true)}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: '#555555', display: 'flex', alignItems: 'center' }}
                                    onMouseEnter={e => e.currentTarget.style.color = '#F0F0F0'}
                                    onMouseLeave={e => e.currentTarget.style.color = '#555555'}
                                    title="Edit slave file path"
                                >
                                    <FolderOpen size={14} />
                                </button>
                            </div>
                        </>
                    )}

                    {/* Separator */}
                    <div style={{ width: '1px', height: '32px', background: '#2A2A2A', flexShrink: 0 }} />

                    {/* PIPELINE */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontFamily: MONO, fontSize: '10px', color: '#555555', flexShrink: 0 }}>PIPELINE</span>
                        <span style={{ fontFamily: MONO, fontSize: '11px', color: '#C8A96E' }}>InSAR Analysis</span>
                    </div>
                </div>

                {/* CENTER GROUP: Layer tabs */}
                <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '16px' }}>
                    {['amplitude', 'deformation', 'coherence'].map((layer) => {
                        const isActive = activeLayer === layer;
                        return (
                            <button
                                key={layer}
                                onClick={() => setActiveLayer(layer)}
                                style={{
                                    fontFamily: MONO, fontSize: '11px',
                                    background: 'none', border: 'none',
                                    padding: '4px 0', cursor: 'pointer',
                                    color: isActive ? '#F0F0F0' : '#555555',
                                    borderBottom: isActive ? '2px solid #C8A96E' : '2px solid transparent',
                                }}
                            >
                                {layer.toUpperCase()}
                            </button>
                        );
                    })}
                </div>

                {/* RIGHT GROUP: Start / Processing */}
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {runningJobs.length > 0 ? (
                        <>
                            <span style={{ fontFamily: MONO, fontSize: '11px', color: '#E6A817' }}>PROCESSING...</span>
                            <span style={{ fontFamily: MONO, fontSize: '11px', color: '#555555' }}>{formatElapsed(elapsed[runningJobs[0]?.id])}</span>
                        </>
                    ) : (
                        <button
                            onClick={startJob}
                            disabled={!getInputFile() || runningJobs.length > 0 || !gatewayOnline}
                            style={{
                                background: '#C8A96E', color: '#0A0A0A',
                                fontFamily: MONO, fontSize: '12px', fontWeight: 600,
                                padding: '10px 24px', border: 'none', borderRadius: '2px',
                                cursor: (!getInputFile() || runningJobs.length > 0 || !gatewayOnline) ? 'not-allowed' : 'pointer',
                                opacity: (!getInputFile() || runningJobs.length > 0 || !gatewayOnline) ? 0.3 : 1,
                            }}
                        >
                            START PROCESSING
                        </button>
                    )}
                </div>
            </div>

            {(() => {
                const showStructural = (showResults || localFilePath) && activeView === 'STRUCTURAL';
                const showFloodRight = activeView === 'FLOOD RISK' && !!envContext;
                const panelVisible = showStructural || showFloodRight;

                return (
                    <div style={{
                        position: 'absolute', top: '42px', right: 0, bottom: '80px',
                        width: '320px', background: '#111111',
                        borderLeft: '1px solid #2A2A2A', zIndex: 100,
                        transform: panelVisible ? 'translateX(0)' : 'translateX(100%)',
                        transition: 'transform 200ms ease',
                        overflowY: 'auto', padding: '16px',
                        boxSizing: 'border-box',
                    }}>
                        {/* ── STRUCTURAL ANALYSIS (existing) ── */}
                        {showStructural && (() => {
                            const s = viewingResult?.insarReport?.summary;
                            const topScatterers = s ? (viewingResult?.insarReport?.scatterers || [])
                                .sort((a, b) => Math.abs(b.displacement_mm) - Math.abs(a.displacement_mm))
                                .slice(0, 10) : [];
                            const dispMagnitude = s ? Math.abs(s.max_displacement_mm || 0) : 0;
                            const dispColorVal = dispMagnitude < 5 ? C.stable : dispMagnitude < 10 ? C.caution : dispMagnitude < 20 ? C.alert : C.critical;

                            return (
                                <>
                                    <div style={{ fontFamily: MONO, fontSize: '10px', color: '#555555', letterSpacing: '0.1em', marginBottom: '12px' }}>STRUCTURAL ANALYSIS</div>

                                    {/* HEALTH MATRIX */}
                                    {s && (
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px', background: '#2A2A2A', border: '1px solid #2A2A2A', marginBottom: '16px' }}>
                                            <div style={{ background: '#111111', padding: '8px', textAlign: 'center' }}>
                                                <div style={{ fontFamily: MONO, fontSize: '9px', color: '#555555', marginBottom: '4px' }}>STABLE</div>
                                                <div style={{ fontFamily: MONO, fontSize: '22px', fontWeight: 600, color: C.stable }}>{s.stable_count}</div>
                                            </div>
                                            <div style={{ background: '#111111', padding: '8px', textAlign: 'center' }}>
                                                <div style={{ fontFamily: MONO, fontSize: '9px', color: '#555555', marginBottom: '4px' }}>CAUTION</div>
                                                <div style={{ fontFamily: MONO, fontSize: '22px', fontWeight: 600, color: C.caution }}>{s.caution_count}</div>
                                            </div>
                                            <div style={{ background: '#111111', padding: '8px', textAlign: 'center' }}>
                                                <div style={{ fontFamily: MONO, fontSize: '9px', color: '#555555', marginBottom: '4px' }}>ALERT</div>
                                                <div style={{ fontFamily: MONO, fontSize: '22px', fontWeight: 600, color: C.alert }}>{s.alert_count}</div>
                                            </div>
                                            <div style={{ background: C.bg1, padding: '8px', textAlign: 'center', border: s.critical_count > 0 ? `1px solid ${C.critical}` : 'none' }}>
                                                <div style={{ fontFamily: MONO, fontSize: '9px', color: C.textDim, marginBottom: '4px' }}>CRITICAL</div>
                                                <div style={{ fontFamily: MONO, fontSize: '22px', fontWeight: 600, color: C.critical }}>{s.critical_count}</div>
                                            </div>
                                        </div>
                                    )}

                                    {/* DIVIDER */}
                                    {s && <div style={{ height: '1px', background: '#2A2A2A', margin: '12px 0' }} />}

                                    {/* Displacement stats */}
                                    {s && (
                                        <div style={{ marginBottom: '16px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #1A1A1A', fontFamily: MONO, fontSize: '11px' }}>
                                                <span style={{ color: '#555555' }}>MAX DISPLACEMENT</span>
                                                <span>
                                                    <span style={{ color: dispColorVal }}>{s.max_displacement_mm?.toFixed(2)} mm</span>
                                                    {(s.max_displacement_mm || 0) < 0 && <span style={{ color: '#E6A817', marginLeft: '4px' }}>(SUBSIDENCE)</span>}
                                                </span>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #1A1A1A', fontFamily: MONO, fontSize: '11px' }}>
                                                <span style={{ color: '#555555' }}>MEDIAN</span>
                                                <span style={{ color: C.text }}>{s.median_displacement_mm?.toFixed(2)} mm</span>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #1A1A1A', fontFamily: MONO, fontSize: '11px' }}>
                                                <span style={{ color: C.textDim }}>TOTAL PS POINTS</span>
                                                <span style={{ color: C.text }}>{s.total_ps_points}</span>
                                            </div>
                                        </div>
                                    )}

                                    {/* DIVIDER */}
                                    {s && <div style={{ height: '1px', background: '#2A2A2A', margin: '12px 0' }} />}

                                    {/* TOP 10 SCATTERERS */}
                                    {s && topScatterers.length > 0 && (
                                        <div style={{ marginBottom: '16px' }}>
                                            <div style={{ fontFamily: MONO, fontSize: '10px', color: '#555555', display: 'flex', paddingBottom: '4px', borderBottom: '1px solid #1A1A1A' }}>
                                                <div style={{ width: '20px' }}>#</div>
                                                <div style={{ flex: 1 }}>DISP (mm)</div>
                                                <div style={{ width: '40px' }}>COH</div>
                                                <div style={{ width: '60px' }}>SEV</div>
                                            </div>
                                            {topScatterers.map((pt, idx) => (
                                                <div key={idx} style={{ fontFamily: MONO, fontSize: '10px', display: 'flex', padding: '4px 0', borderBottom: '1px solid #1A1A1A' }}>
                                                    <div style={{ width: '20px', color: '#888888' }}>{idx + 1}</div>
                                                    <div style={{ flex: 1, color: sevColor(pt.severity) }}>{pt.displacement_mm?.toFixed(2)}</div>
                                                    <div style={{ width: '40px', color: C.text }}>{pt.coherence?.toFixed(2)}</div>
                                                    <div style={{ width: '60px', color: sevColor(pt.severity) }}>{pt.severity}</div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* DIVIDER */}
                                    {s && <div style={{ height: '1px', background: '#2A2A2A', margin: '12px 0' }} />}

                                    {/* ACQUISITION METADATA */}
                                    {localFilePath && (() => {
                                        const filename = (viewingResult?.url || localFilePath || '').toUpperCase();
                                        let productVal = 'NISAR Product';
                                        if (filename.includes('_GUNW_')) productVal = 'GUNW — Pre-computed InSAR';
                                        else if (filename.includes('_GCOV_')) productVal = 'GCOV — Geocoded Covariance';
                                        else if (filename.includes('_RSLC_')) productVal = 'RSLC — Range SLC';

                                        return (
                                            <div>
                                                <div style={{ fontFamily: MONO, fontSize: '9px', color: '#555555', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '10px' }}>ACQUISITION METADATA</div>
                                                {[
                                                    { label: 'SATELLITE', value: 'NISAR (NASA/ISRO)' },
                                                    { label: 'PIPELINE', value: (viewingResult?.pipeline || 'insar') === 'insar' ? 'InSAR Analysis' : 'SAR Focus' },
                                                    { label: 'PRODUCT', value: productVal },
                                                    { label: 'BAND', value: 'L-Band (1.26 GHz)' },
                                                    { label: 'ORBIT', value: 'Descending' },
                                                ].map(({ label, value }) => (
                                                    <div key={label} style={{
                                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                                        padding: '6px 0',
                                                        borderBottom: '1px solid #161616',
                                                    }}>
                                                        <span style={{ fontFamily: MONO, fontSize: '11px', color: '#555555' }}>{label}</span>
                                                        <span style={{ fontFamily: MONO, fontSize: '11px', color: '#F0F0F0', textAlign: 'right' }}>{value || '—'}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        );
                                    })()}
                                </>
                            );
                        })()}

                        {/* ── FLOOD RISK FACTOR ANALYSIS ── */}
                        {showFloodRight && (() => {
                            const insarSummary = viewingResult?.insarReport?.summary;

                            // Recompute factor scores (same logic as left panel)
                            const storagePct = envContext?.storage_pct;
                            let reservoirScore = 0;
                            if (storagePct > 95) reservoirScore = 30;
                            else if (storagePct > 85) reservoirScore = 20;
                            else if (storagePct > 70) reservoirScore = 10;

                            let rainfallScore = 0;
                            const rainfall = parseFloat(envContext?.rainfall);
                            if (!isNaN(rainfall)) {
                                if (rainfall > 200) rainfallScore = 30;
                                else if (rainfall > 100) rainfallScore = 20;
                                else if (rainfall > 50) rainfallScore = 10;
                            }

                            let soilScore = 0;
                            const soilText = envContext?.soil_moisture?.toLowerCase() || '';
                            if (soilText.includes('saturated')) soilScore = 20;
                            else if (soilText.includes('high') || soilText.includes('anomaly')) soilScore = 12;
                            else if (soilText.includes('moist')) soilScore = 6;

                            let seismicScore = 0;
                            if (envContext?.seismic?.toLowerCase().includes('events')) seismicScore = 10;

                            let insarScore = 0;
                            if (insarSummary?.critical_count > 0) insarScore = 10;
                            else if (insarSummary?.alert_count > 0) insarScore = 5;

                            const score = reservoirScore + rainfallScore + soilScore + seismicScore + insarScore;

                            const factors = [
                                { label: 'RESERVOIR', scored: reservoirScore, max: 30, color: '#7EB8D4', raw: envContext?.reservoir || '—' },
                                { label: 'RAINFALL', scored: rainfallScore, max: 30, color: '#4A8FA8', raw: envContext?.rainfall || '—' },
                                { label: 'SOIL', scored: soilScore, max: 20, color: '#C8A96E', raw: envContext?.soil_moisture || '—' },
                                { label: 'SEISMIC', scored: seismicScore, max: 10, color: '#9B8EC4', raw: envContext?.seismic || '—' },
                                { label: 'INSAR', scored: insarScore, max: 10, color: '#4CAF50', raw: insarSummary ? `${insarSummary.total_ps_points} PS pts` : '—' },
                            ];

                            const totalMax = 100;

                            return (
                                <>
                                    <div style={{ fontFamily: MONO, fontSize: '9px', color: '#555555', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '14px' }}>FACTOR ANALYSIS</div>

                                    {/* ── DONUT/RING CHART ── */}
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '16px' }}>
                                        <svg width="120" height="120" viewBox="0 0 120 120">
                                            {/* Background circle */}
                                            <circle cx="60" cy="60" r="45" fill="none" stroke="#1A1A1A" strokeWidth="12" />
                                            {/* Segments */}
                                            {(() => {
                                                let accumulatedLength = 0;
                                                const circumference = 282.7;
                                                return factors.map(f => {
                                                    const segmentLength = (f.scored / 100) * circumference;
                                                    const dashOffset = -accumulatedLength;
                                                    accumulatedLength += segmentLength;

                                                    if (f.scored === 0) return null;

                                                    return (
                                                        <circle
                                                            key={f.label}
                                                            cx="60"
                                                            cy="60"
                                                            r="45"
                                                            fill="none"
                                                            stroke={f.color}
                                                            strokeWidth="12"
                                                            strokeDasharray={`${segmentLength} ${circumference}`}
                                                            strokeDashoffset={dashOffset}
                                                            transform="rotate(-90 60 60)"
                                                            style={{ transition: 'stroke-dashoffset 300ms ease' }}
                                                        />
                                                    );
                                                });
                                            })()}
                                            {/* Center text */}
                                            <text x="60" y="56" textAnchor="middle" dominantBaseline="middle" style={{ fontFamily: MONO, fill: '#F0F0F0', fontSize: '18px', fontWeight: 600 }}>
                                                {score}
                                            </text>
                                            <text x="60" y="74" textAnchor="middle" dominantBaseline="middle" style={{ fontFamily: MONO, fill: '#555555', fontSize: '11px' }}>
                                                /100
                                            </text>
                                        </svg>

                                        {/* Legend below chart */}
                                        <div style={{ width: '100%', marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                            {factors.map(f => (
                                                <div key={f.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontFamily: MONO, fontSize: '10px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: f.color }} />
                                                        <span style={{ color: '#888888' }}>{f.label}</span>
                                                    </div>
                                                    <span style={{ color: f.scored > 0 ? '#F0F0F0' : '#333333', fontWeight: f.scored > 0 ? 600 : 400 }}>{f.scored}/{f.max}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div style={{ height: '1px', background: '#2A2A2A', margin: '12px 0' }} />

                                    {/* ── SENSOR STATUS GRID ── */}
                                    <div style={{ fontFamily: MONO, fontSize: '9px', color: '#555555', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '10px' }}>SENSOR STATUS</div>
                                    {factors.map(f => {
                                        const isActive = f.raw !== '—';
                                        return (
                                            <div key={f.label} style={{
                                                display: 'flex', alignItems: 'center',
                                                padding: '8px 0',
                                                borderBottom: '1px solid #161616',
                                            }}>
                                                <div style={{
                                                    width: '5px', height: '5px', borderRadius: '50%',
                                                    background: isActive ? f.color : '#333333',
                                                    flexShrink: 0, marginRight: '8px',
                                                    boxShadow: isActive ? `0 0 4px ${f.color}40` : 'none',
                                                }} />
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ fontFamily: MONO, fontSize: '9px', color: '#666666', marginBottom: '2px' }}>{f.label}</div>
                                                    <div style={{
                                                        fontFamily: MONO, fontSize: '10px',
                                                        color: isActive ? '#CCCCCC' : '#333333',
                                                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                                    }}>{f.raw}</div>
                                                </div>
                                                <div style={{
                                                    fontFamily: MONO, fontSize: '11px', fontWeight: 600,
                                                    color: f.scored > 0 ? f.color : '#333333',
                                                    marginLeft: '8px', flexShrink: 0,
                                                }}>
                                                    +{f.scored}
                                                </div>
                                            </div>
                                        );
                                    })}

                                    <div style={{ height: '1px', background: '#2A2A2A', margin: '12px 0' }} />

                                    {/* ── WEIGHT DISTRIBUTION ── */}
                                    <div style={{ fontFamily: MONO, fontSize: '9px', color: '#555555', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '10px' }}>WEIGHT DISTRIBUTION</div>
                                    {factors.map(f => (
                                        <div key={f.label} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                                            <span style={{ fontFamily: MONO, fontSize: '8px', color: '#555555', width: '56px', flexShrink: 0 }}>{f.label}</span>
                                            <div style={{ flex: 1, height: '3px', background: '#1A1A1A', borderRadius: '1px', overflow: 'hidden' }}>
                                                <div style={{
                                                    height: '100%', borderRadius: '1px',
                                                    width: `${(f.max / totalMax) * 100}%`,
                                                    background: `${f.color}60`,
                                                    position: 'relative',
                                                }}>
                                                    <div style={{
                                                        position: 'absolute', left: 0, top: 0, height: '100%',
                                                        width: f.max > 0 ? `${(f.scored / f.max) * 100}%` : '0%',
                                                        background: f.color, borderRadius: '1px',
                                                        transition: 'width 300ms ease',
                                                    }} />
                                                </div>
                                            </div>
                                            <span style={{ fontFamily: MONO, fontSize: '8px', color: '#666666', width: '28px', textAlign: 'right', flexShrink: 0 }}>{f.max}pt</span>
                                        </div>
                                    ))}
                                </>
                            );
                        })()}
                    </div>
                );
            })()}
        </>
    );
}
