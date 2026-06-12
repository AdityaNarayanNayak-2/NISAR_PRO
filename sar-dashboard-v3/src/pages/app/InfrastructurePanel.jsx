import React, { useState } from 'react';
import { FolderOpen } from 'lucide-react';
import { MONO, SANS, C } from './constants';
import { parseNisarFilename, sevColor, formatElapsed } from './helpers';

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

    const showResults = viewingResult?.insarReport?.summary;
    const masterFilename = localFilePath ? localFilePath.split('/').pop() : '';
    const slaveFilename = slaveFilePath ? slaveFilePath.split('/').pop() : '';

    return (
        <>
            {/* ════════════════════════════════════════════════════
                ZONE 1: LEFT PANEL (240px)
                ════════════════════════════════════════════════════ */}
            <div style={{
                position: 'absolute', top: '42px', left: 0, bottom: 0,
                width: '240px', background: '#111111',
                borderRight: '1px solid #2A2A2A', zIndex: 100,
                overflowY: 'auto', padding: '16px',
                boxSizing: 'border-box',
            }}>
                {/* A) SEARCH ASSET */}
                <div style={{ fontFamily: MONO, fontSize: '10px', color: '#555555', letterSpacing: '0.1em', marginBottom: '8px' }}>SEARCH ASSET</div>
                <div style={{ position: 'relative', marginBottom: assetSearchOpen ? '0px' : '8px' }}>
                    <input
                        type="text"
                        value={assetSearch}
                        onChange={(e) => { setAssetSearch(e.target.value); searchAssets(e.target.value); }}
                        placeholder="Search dam or bridge..."
                        style={{ width: '100%', padding: '8px 10px', background: C.bg2, border: `1px solid ${C.bg3}`, color: C.text, fontFamily: MONO, fontSize: '12px', boxSizing: 'border-box', outline: 'none', borderRadius: '2px' }}
                        onFocus={(e) => e.target.style.borderColor = C.bg4}
                        onBlur={(e) => { setTimeout(() => { e.target.style.borderColor = C.bg3; setAssetSearchOpen(false); }, 200); }}
                    />
                    {assetSearchOpen && assetResults.length > 0 && (
                        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: C.bg2, border: `1px solid ${C.bg3}`, borderTop: 'none', zIndex: 200, maxHeight: '200px', overflowY: 'auto' }}>
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
                                    onMouseEnter={(e) => e.currentTarget.style.background = C.bg3}
                                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                >
                                    <span style={{ fontFamily: MONO, fontSize: '11px', color: C.text }}>{asset.name}</span>
                                    <span style={{ fontFamily: MONO, fontSize: '10px', color: C.textDim }}>{asset.state || asset.country}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* B) ASSET CARD */}
                {assetLat && assetLon && assetName && (
                    <div style={{ marginBottom: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                            <div style={{ fontFamily: MONO, fontSize: '13px', color: '#F0F0F0', fontWeight: 600 }}>{assetName}</div>
                            <span style={{ fontFamily: MONO, fontSize: '9px', color: '#C8A96E', background: '#1A1A1A', border: '1px solid #2A2A2A', padding: '2px 6px', borderRadius: '2px', letterSpacing: '0.05em', flexShrink: 0 }}>{assetType}</span>
                        </div>
                        {assetState && <div style={{ fontFamily: MONO, fontSize: '11px', color: '#888888', marginBottom: '6px' }}>{assetState}</div>}
                        <div style={{ fontFamily: MONO, fontSize: '10px', color: '#555555' }}>{assetLat}°N, {assetLon}°E</div>
                        {/* TOGGLE */}
                        <div style={{ display: 'flex', gap: '16px', marginTop: '16px' }}>
                            <button 
                                onClick={() => setActiveView('STRUCTURAL')}
                                style={{
                                    fontFamily: MONO, fontSize: '10px', background: 'none', border: 'none', padding: '0 0 4px 0', cursor: 'pointer',
                                    color: activeView === 'STRUCTURAL' ? '#F0F0F0' : '#555555',
                                    borderBottom: activeView === 'STRUCTURAL' ? '2px solid #C8A96E' : '2px solid transparent'
                                }}
                            >
                                STRUCTURAL
                            </button>
                            <button 
                                onClick={() => setActiveView('FLOOD RISK')}
                                style={{
                                    fontFamily: MONO, fontSize: '10px', background: 'none', border: 'none', padding: '0 0 4px 0', cursor: 'pointer',
                                    color: activeView === 'FLOOD RISK' ? '#F0F0F0' : '#555555',
                                    borderBottom: activeView === 'FLOOD RISK' ? '2px solid #C8A96E' : '2px solid transparent'
                                }}
                            >
                                FLOOD RISK
                            </button>
                        </div>
                    </div>
                )}

                {activeView === 'STRUCTURAL' && (
                    <>
                        {/* C) DIVIDER */}
                        <div style={{ height: '1px', background: '#2A2A2A', margin: '12px 0' }} />

                        {/* D) FIELD CONTEXT */}
                        <div style={{ fontFamily: MONO, fontSize: '10px', color: '#555555', letterSpacing: '0.1em', marginBottom: '8px' }}>FIELD CONTEXT</div>
                        {[
                            {
                                label: 'RESERVOIR',
                                value: envContext?.reservoir || 'UNAVAILABLE',
                                dot: envContext?.reservoir && envContext.reservoir !== 'UNAVAILABLE' && envContext.reservoir.includes('%')
                                    ? (parseFloat(envContext.reservoir) > 90 ? C.caution : C.stable)
                                    : C.textDim,
                                subtext: (!envContext?.reservoir || envContext?.reservoir === 'UNAVAILABLE') && (
                                    <div style={{ color: '#C8A96E', fontSize: '9px', fontFamily: MONO, marginTop: '4px', lineHeight: 1.3 }}>
                                        Future Modules: India-WRIS integration, CWC reservoir bulletins, State water resources feeds
                                    </div>
                                )
                            },
                            {
                                label: 'RAINFALL',
                                value: envContext?.rainfall || 'UNAVAILABLE',
                                dot: envContext?.rainfall && envContext.rainfall !== 'UNAVAILABLE' && (envContext.rainfall.includes('342mm') || envContext.rainfall.includes('mm/hr'))
                                    ? C.data
                                    : C.stable
                            },
                            {
                                label: 'SOIL MOIST.',
                                value: envContext?.soil_moisture || 'UNAVAILABLE',
                                dot: envContext?.soil_moisture && envContext.soil_moisture !== 'UNAVAILABLE' && (envContext.soil_moisture.toLowerCase().includes('anomaly') || envContext.soil_moisture.includes('saturated'))
                                    ? C.caution
                                    : C.stable
                            },
                            {
                                label: 'SEISMIC',
                                value: envContext?.seismic || 'UNAVAILABLE',
                                dot: envContext?.seismic && envContext.seismic !== 'UNAVAILABLE' && (envContext.seismic.toLowerCase().includes('no activity') || envContext.seismic.toLowerCase().includes('no events'))
                                    ? C.stable
                                    : C.caution
                            },
                            {
                                label: 'SEASON',
                                value: envContext?.season || 'UNAVAILABLE',
                                dot: envContext?.season && envContext.season !== 'UNAVAILABLE' ? C.accent.infra : C.textDim
                            },
                        ].map(({ label, value, dot, subtext }) => (
                            <div key={label} style={{ display: 'flex', flexDirection: 'column', padding: '5px 0', borderBottom: `1px solid ${C.bg2}` }}>
                                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', fontFamily: MONO, fontSize: '11px' }}>
                                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: dot, flexShrink: 0, marginTop: '4px' }} />
                                    <span style={{ color: C.textDim, width: '75px', flexShrink: 0 }}>{label}</span>
                                    <span style={{ color: C.text, fontSize: '10px', lineHeight: 1.4, wordBreak: 'break-word' }}>{value}</span>
                                </div>
                                {subtext}
                            </div>
                        ))}

                        {/* E) ASSESSMENT block */}
                        <div style={{ marginTop: '12px', padding: '10px', background: C.bg2, borderRadius: '2px', border: `1px solid ${C.bg3}` }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                <span style={{ fontFamily: MONO, fontSize: '10px', color: C.textDim }}>STATUS</span>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: envContext?.confidence === 'HIGH' ? C.critical : envContext?.confidence === 'MODERATE' ? C.caution : C.stable }} />
                                    <span style={{ fontFamily: MONO, fontSize: '11px', fontWeight: 600, color: envContext?.confidence === 'HIGH' ? C.critical : envContext?.confidence === 'MODERATE' ? C.caution : C.stable }}>
                                        {envContext?.confidence || 'UNAVAILABLE'}
                                    </span>
                                </span>
                            </div>
                            <div style={{ fontFamily: SANS, fontSize: '11px', color: C.text, marginBottom: '6px', lineHeight: 1.4 }}>
                                {envContext?.assessment || 'Environmental assessment context unavailable.'}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontFamily: MONO, fontSize: '9px', color: C.textDim, marginTop: '6px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '6px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: '#C8A96E' }}>PROVENANCE: Government / Scientific Sources</span>
                                    {contextFetchedAt && <span>{contextFetchedAt.toISOString().slice(0, 16).replace('T', ' ')} UTC</span>}
                                </div>
                                <div style={{ color: C.textDim }}>{envContext?.source || 'UNAVAILABLE'}</div>
                            </div>
                        </div>

                        {/* Fetch button when no context loaded */}
                        {assetLat && assetLon && !envContext && (
                            <button
                                onClick={fetchContext}
                                style={{ width: '100%', background: 'transparent', border: `1px solid ${C.bg3}`, color: '#888888', fontFamily: MONO, fontSize: '11px', padding: '8px 10px', borderRadius: '2px', cursor: 'pointer', marginTop: '12px' }}
                                onMouseEnter={(e) => { e.target.style.borderColor = '#404040'; e.target.style.color = '#F0F0F0'; }}
                                onMouseLeave={(e) => { e.target.style.borderColor = '#2A2A2A'; e.target.style.color = '#888888'; }}
                            >
                                {fetchingContext ? 'FETCHING FIELD DATA...' : 'FETCH CONTEXT'}
                            </button>
                        )}

                        {/* F) ALERTS — rule-based, fires only on real insarReport values */}
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
                                alerts.push({ severity: 'CAUTION', message: 'Reservoir at high capacity — monitor embankment displacement' });
                            if (alerts.length === 0)
                                alerts.push({ severity: 'STABLE', message: 'No anomalies detected — baseline monitoring active' });

                            alerts.sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity]);
                            const visible = alerts.slice(0, 3);

                            const badgeStyle = (sev) => {
                                const base = { fontFamily: MONO, fontSize: '8px', fontWeight: 600, padding: '2px 5px', borderRadius: '1px', whiteSpace: 'nowrap', flexShrink: 0 };
                                if (sev === 'CRITICAL') return { ...base, background: '#C0392B', color: '#F0F0F0' };
                                if (sev === 'ALERT') return { ...base, background: '#D4822A', color: '#F0F0F0' };
                                if (sev === 'CAUTION') return { ...base, background: '#E6A817', color: '#0A0A0A' };
                                return { ...base, background: '#1A1A1A', color: '#4CAF50', border: '1px solid #4CAF50' };
                            };

                            return (
                                <>
                                    <div style={{ height: '1px', background: '#2A2A2A', margin: '12px 0' }} />
                                    <div style={{ fontFamily: MONO, fontSize: '10px', color: '#555555', letterSpacing: '0.1em', marginBottom: '8px' }}>ALERTS</div>
                                    {visible.map((a, i) => (
                                        <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', padding: '8px 0', borderBottom: '1px solid #1A1A1A' }}>
                                            <span style={badgeStyle(a.severity)}>{a.severity}</span>
                                            <span style={{ fontFamily: MONO, fontSize: '10px', color: '#888888', lineHeight: 1.5 }}>{a.message}</span>
                                        </div>
                                    ))}
                                </>
                            );
                        })()}
                    </>
                )}

                {activeView === 'FLOOD RISK' && (() => {
                    const insarSummary = viewingResult?.insarReport?.summary;
                    let score = 0;
                    let factors = [];

                    // Reservoir loading (0-30 points)
                    if (envContext?.storage_pct > 95) {
                        score += 30;
                        factors.push('Reservoir critically full');
                    } else if (envContext?.storage_pct > 85) {
                        score += 20;
                        factors.push('Reservoir at high capacity');
                    } else if (envContext?.storage_pct > 70) {
                        score += 10;
                        factors.push('Reservoir moderately loaded');
                    }

                    // Rainfall (0-30 points)
                    const rainfall = parseFloat(envContext?.rainfall);
                    if (!isNaN(rainfall)) {
                        if (rainfall > 200) {
                            score += 30;
                            factors.push('Extreme rainfall (72h)');
                        } else if (rainfall > 100) {
                            score += 20;
                            factors.push('Heavy rainfall (72h)');
                        } else if (rainfall > 50) {
                            score += 10;
                            factors.push('Moderate rainfall (72h)');
                        }
                    }

                    // Soil saturation (0-20 points)
                    if (envContext?.soil_moisture?.toLowerCase().includes('saturated')) {
                        score += 20;
                        factors.push('Soil saturated');
                    } else if (envContext?.soil_moisture?.toLowerCase().includes('high') || 
                               envContext?.soil_moisture?.toLowerCase().includes('anomaly')) {
                        score += 12;
                        factors.push('High soil moisture anomaly');
                    } else if (envContext?.soil_moisture?.toLowerCase().includes('moist')) {
                        score += 6;
                        factors.push('Elevated soil moisture');
                    }

                    // Seismic (0-10 points)
                    if (envContext?.seismic?.toLowerCase().includes('events')) {
                        score += 10;
                        factors.push('Recent seismic activity');
                    }

                    // InSAR displacement (0-10 points)
                    if (insarSummary?.critical_count > 0) {
                        score += 10;
                        factors.push('Critical displacement detected');
                    } else if (insarSummary?.alert_count > 0) {
                        score += 5;
                        factors.push('Embankment displacement alert');
                    }

                    // Risk level
                    const level = score >= 70 ? 'CRITICAL' :
                                  score >= 50 ? 'HIGH' :
                                  score >= 30 ? 'MODERATE' : 'LOW';

                    const color = score >= 70 ? '#C0392B' :
                                  score >= 50 ? '#D4822A' :
                                  score >= 30 ? '#E6A817' : '#4CAF50';
                                  
                    let actions = [];
                    if (score >= 70) {
                      actions = [
                        "Activate emergency response protocol",
                        "Alert downstream village panchayats",
                        "Pre-position NDRF/SDRF teams",
                        "Open relief camps at safe elevations",
                        "Notify district collector office"
                      ];
                    } else if (score >= 50) {
                      actions = [
                        "Increase monitoring frequency",
                        "Alert downstream gram panchayats",
                        "Pre-position relief materials",
                        "Brief local administration"
                      ];
                    } else if (score >= 30) {
                      actions = [
                        "Monitor reservoir levels hourly",
                        "Check embankment condition",
                        "Review evacuation routes"
                      ];
                    } else {
                      actions = [
                        "Continue routine monitoring",
                        "Next scheduled inspection on track"
                      ];
                    }

                    return (
                        <>
                            {/* DIVIDER */}
                            <div style={{ height: '1px', background: '#2A2A2A', margin: '12px 0' }} />
                            
                            {/* SECTION 1: FLOOD RISK INDEX */}
                            <div style={{ fontFamily: MONO, fontSize: '10px', color: '#555555', marginBottom: '12px' }}>FLOOD RISK INDEX</div>
                            <div>
                                <div style={{ fontFamily: MONO, fontSize: '48px', fontWeight: 600, color: color, lineHeight: 1 }}>{score}/100</div>
                                <div style={{ display: 'inline-block', fontFamily: MONO, fontSize: '11px', fontWeight: 600, color: color, border: `1px solid ${color}`, padding: '3px 10px', marginTop: '8px', marginBottom: '8px' }}>
                                    {level} RISK
                                </div>
                                <div style={{ fontFamily: MONO, fontSize: '9px', color: '#555555' }}>NISAR · WRIS · IMD · USGS</div>
                            </div>
                            
                            <div style={{ height: '1px', background: '#2A2A2A', margin: '12px 0' }} />
                            
                            {/* SECTION 2: CONTRIBUTING FACTORS */}
                            <div style={{ fontFamily: MONO, fontSize: '10px', color: '#555555', marginBottom: '8px' }}>RISK FACTORS</div>
                            {factors.length > 0 ? factors.map((factor, i) => (
                                <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid #1A1A1A' }}>
                                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#D4822A', flexShrink: 0 }} />
                                    <div style={{ fontFamily: MONO, fontSize: '10px', color: '#F0F0F0' }}>{factor}</div>
                                </div>
                            )) : (
                                <div style={{ fontFamily: MONO, fontSize: '10px', color: '#555555' }}>No elevated risk factors detected</div>
                            )}

                            <div style={{ height: '1px', background: '#2A2A2A', margin: '12px 0' }} />

                            {/* SECTION 3: DATA SOURCES */}
                            <div style={{ fontFamily: MONO, fontSize: '10px', color: '#555555', marginBottom: '8px' }}>DATA INPUTS</div>
                            {[
                                {
                                    label: 'RESERVOIR',
                                    value: envContext?.reservoir || 'UNAVAILABLE',
                                    dot: envContext?.reservoir && envContext.reservoir !== 'UNAVAILABLE' && envContext.reservoir.includes('%')
                                        ? (parseFloat(envContext.reservoir) > 90 ? C.caution : C.stable)
                                        : C.textDim,
                                    subtext: (!envContext?.reservoir || envContext?.reservoir === 'UNAVAILABLE') && (
                                        <div style={{ color: '#C8A96E', fontSize: '9px', fontFamily: MONO, marginTop: '4px', lineHeight: 1.3 }}>
                                            Future Modules: India-WRIS integration, CWC reservoir bulletins, State water resources feeds
                                        </div>
                                    )
                                },
                                {
                                    label: 'RAINFALL',
                                    value: envContext?.rainfall || 'UNAVAILABLE',
                                    dot: envContext?.rainfall && envContext.rainfall !== 'UNAVAILABLE' && (envContext.rainfall.includes('342mm') || envContext.rainfall.includes('mm/hr'))
                                        ? C.data
                                        : C.stable
                                },
                                {
                                    label: 'SOIL',
                                    value: envContext?.soil_moisture || 'UNAVAILABLE',
                                    dot: envContext?.soil_moisture && envContext.soil_moisture !== 'UNAVAILABLE' && (envContext.soil_moisture.toLowerCase().includes('anomaly') || envContext.soil_moisture.includes('saturated'))
                                        ? C.caution
                                        : C.stable
                                },
                                {
                                    label: 'SEISMIC',
                                    value: envContext?.seismic || 'UNAVAILABLE',
                                    dot: envContext?.seismic && envContext.seismic !== 'UNAVAILABLE' && (envContext.seismic.toLowerCase().includes('no activity') || envContext.seismic.toLowerCase().includes('no events'))
                                        ? C.stable
                                        : C.caution
                                },
                                {
                                    label: 'INSAR',
                                    value: insarSummary ? `${insarSummary.total_ps_points} PS pts` : 'NO ACQUISITION',
                                    dot: insarSummary ? C.stable : C.textDim
                                }
                            ].map(({ label, value, dot, subtext }) => (
                                <div key={label} style={{ display: 'flex', flexDirection: 'column', padding: '5px 0', borderBottom: `1px solid ${C.bg2}` }}>
                                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', fontFamily: MONO, fontSize: '11px' }}>
                                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: dot, flexShrink: 0, marginTop: '4px' }} />
                                        <span style={{ color: C.textDim, width: '65px', flexShrink: 0 }}>{label}</span>
                                        <span style={{ color: C.text, fontSize: '10px', lineHeight: 1.4, wordBreak: 'break-word' }}>{value}</span>
                                    </div>
                                    {subtext}
                                </div>
                            ))}

                            <div style={{ height: '1px', background: '#2A2A2A', margin: '12px 0' }} />

                            {/* SECTION 4: RECOMMENDED ACTIONS */}
                            <div style={{ fontFamily: MONO, fontSize: '10px', color: '#555555', marginBottom: '8px' }}>ACTIONS</div>
                            {actions.map((action, i) => (
                                <div key={i} style={{ display: 'flex', gap: '8px', padding: '5px 0', borderBottom: '1px solid #1A1A1A' }}>
                                    <div style={{ fontFamily: MONO, fontSize: '10px', color: '#C8A96E', flexShrink: 0 }}>→</div>
                                    <div style={{ fontFamily: SANS, fontSize: '10px', color: '#888888', lineHeight: 1.4 }}>{action}</div>
                                </div>
                            ))}

                            <div style={{ height: '1px', background: '#2A2A2A', margin: '12px 0' }} />

                            {/* SECTION 5: AFFECTED AREAS */}
                            <div style={{ fontFamily: MONO, fontSize: '10px', color: '#555555', marginBottom: '8px' }}>DOWNSTREAM EXPOSURE</div>
                            {assetName?.toLowerCase().includes('hirakud') || assetName?.toLowerCase().includes('mahanadi') ? (
                                (() => {
                                    const mahanadi_downstream = [
                                      { name: 'Sambalpur', dist: '15km', pop: '185k', risk: 'HIGH' },
                                      { name: 'Sonepur', dist: '90km', pop: '42k', risk: 'MODERATE' },
                                      { name: 'Cuttack', dist: '240km', pop: '610k', risk: 'LOW' },
                                    ];
                                    const badgeStyle = (sev) => {
                                        const base = { fontFamily: MONO, fontSize: '8px', fontWeight: 600, padding: '2px 5px', borderRadius: '1px', whiteSpace: 'nowrap', flexShrink: 0 };
                                        if (sev === 'CRITICAL') return { ...base, background: '#C0392B', color: '#F0F0F0' };
                                        if (sev === 'HIGH')     return { ...base, background: '#D4822A', color: '#F0F0F0' };
                                        if (sev === 'MODERATE') return { ...base, background: '#E6A817', color: '#0A0A0A' };
                                        return { ...base, background: '#1A1A1A', color: '#4CAF50', border: '1px solid #4CAF50' };
                                    };
                                    return mahanadi_downstream.map((area, i) => (
                                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #1A1A1A' }}>
                                            <div>
                                                <div style={{ fontFamily: MONO, fontSize: '11px', color: '#F0F0F0', marginBottom: '2px' }}>{area.name}</div>
                                                <div style={{ fontFamily: MONO, fontSize: '9px', color: '#555555' }}>Dist: {area.dist} | Pop: {area.pop}</div>
                                            </div>
                                            <div style={badgeStyle(area.risk)}>{area.risk}</div>
                                        </div>
                                    ));
                                })()
                            ) : (
                                <div style={{ fontFamily: MONO, fontSize: '10px', color: '#555555', lineHeight: 1.4 }}>
                                    Downstream exposure data available<br />for Mahanadi basin assets.
                                </div>
                            )}
                        </>
                    );
                })()}

                {/* Fetch button when no context loaded */}
                {assetLat && assetLon && !envContext && (
                    <button
                        onClick={fetchContext}
                        style={{ width: '100%', background: 'transparent', border: `1px solid ${C.bg3}`, color: '#888888', fontFamily: MONO, fontSize: '11px', padding: '8px 10px', borderRadius: '2px', cursor: 'pointer', marginTop: '12px' }}
                        onMouseEnter={(e) => { e.target.style.borderColor = '#404040'; e.target.style.color = '#F0F0F0'; }}
                        onMouseLeave={(e) => { e.target.style.borderColor = '#2A2A2A'; e.target.style.color = '#888888'; }}
                    >
                        {fetchingContext ? 'FETCHING FIELD DATA...' : 'FETCH CONTEXT'}
                    </button>
                )}
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
                    {/* MASTER */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                        <span style={{ fontFamily: MONO, fontSize: '10px', color: '#555555', flexShrink: 0 }}>MASTER</span>
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
                        >
                            <FolderOpen size={14} />
                        </button>
                    </div>

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
                        >
                            <FolderOpen size={14} />
                        </button>
                    </div>

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

            {/* ════════════════════════════════════════════════════
                ZONE 4: RIGHT RESULTS PANEL (320px, slide-in)
                ════════════════════════════════════════════════════ */}
            <div style={{
                position: 'absolute', top: '42px', right: 0, bottom: '80px',
                width: '320px', background: '#111111',
                borderLeft: '1px solid #2A2A2A', zIndex: 100,
                transform: showResults ? 'translateX(0)' : 'translateX(100%)',
                transition: 'transform 200ms ease',
                overflowY: 'auto', padding: '16px',
                boxSizing: 'border-box',
            }}>
                {showResults && (() => {
                    const s = viewingResult.insarReport.summary;
                    const topScatterers = (viewingResult.insarReport.scatterers || [])
                        .sort((a, b) => Math.abs(b.displacement_mm) - Math.abs(a.displacement_mm))
                        .slice(0, 10);
                    const dispMagnitude = Math.abs(s.max_displacement_mm || 0);
                    const dispColorVal = dispMagnitude < 5 ? '#4CAF50' : dispMagnitude < 10 ? '#E6A817' : dispMagnitude < 20 ? '#D4822A' : '#C0392B';

                    return (
                        <>
                            <div style={{ fontFamily: MONO, fontSize: '10px', color: '#555555', letterSpacing: '0.1em', marginBottom: '12px' }}>STRUCTURAL ANALYSIS</div>

                            {/* HEALTH MATRIX */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px', background: '#2A2A2A', border: '1px solid #2A2A2A', marginBottom: '16px' }}>
                                <div style={{ background: '#111111', padding: '8px', textAlign: 'center' }}>
                                    <div style={{ fontFamily: MONO, fontSize: '9px', color: '#555555', marginBottom: '4px' }}>STABLE</div>
                                    <div style={{ fontFamily: MONO, fontSize: '22px', fontWeight: 600, color: '#4CAF50' }}>{s.stable_count}</div>
                                </div>
                                <div style={{ background: '#111111', padding: '8px', textAlign: 'center' }}>
                                    <div style={{ fontFamily: MONO, fontSize: '9px', color: '#555555', marginBottom: '4px' }}>CAUTION</div>
                                    <div style={{ fontFamily: MONO, fontSize: '22px', fontWeight: 600, color: '#E6A817' }}>{s.caution_count}</div>
                                </div>
                                <div style={{ background: '#111111', padding: '8px', textAlign: 'center' }}>
                                    <div style={{ fontFamily: MONO, fontSize: '9px', color: '#555555', marginBottom: '4px' }}>ALERT</div>
                                    <div style={{ fontFamily: MONO, fontSize: '22px', fontWeight: 600, color: '#D4822A' }}>{s.alert_count}</div>
                                </div>
                                <div style={{ background: '#111111', padding: '8px', textAlign: 'center', border: s.critical_count > 0 ? '1px solid #C0392B' : 'none' }}>
                                    <div style={{ fontFamily: MONO, fontSize: '9px', color: '#555555', marginBottom: '4px' }}>CRITICAL</div>
                                    <div style={{ fontFamily: MONO, fontSize: '22px', fontWeight: 600, color: '#C0392B' }}>{s.critical_count}</div>
                                </div>
                            </div>

                            {/* DIVIDER */}
                            <div style={{ height: '1px', background: '#2A2A2A', margin: '12px 0' }} />

                            {/* Displacement stats */}
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
                                    <span style={{ color: '#F0F0F0' }}>{s.median_displacement_mm?.toFixed(2)} mm</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #1A1A1A', fontFamily: MONO, fontSize: '11px' }}>
                                    <span style={{ color: '#555555' }}>TOTAL PS POINTS</span>
                                    <span style={{ color: '#F0F0F0' }}>{s.total_ps_points}</span>
                                </div>
                            </div>

                            {/* DIVIDER */}
                            <div style={{ height: '1px', background: '#2A2A2A', margin: '12px 0' }} />

                            {/* TOP 10 SCATTERERS */}
                            {topScatterers.length > 0 && (
                                <div>
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
                                            <div style={{ width: '40px', color: '#F0F0F0' }}>{pt.coherence?.toFixed(2)}</div>
                                            <div style={{ width: '60px', color: sevColor(pt.severity) }}>{pt.severity}</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    );
                })()}
            </div>
        </>
    );
}
