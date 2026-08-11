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
    visibleLayers,
    setVisibleLayers,
    startJob,
    getInputFile,
    runningJobs,
    gatewayOnline,
    elapsed,
    viewingResult,
}) {
    const [editingMaster, setEditingMaster] = useState(false);
    const [editingSlave, setEditingSlave] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [selectedPoint, setSelectedPoint] = useState(null);

    const s = viewingResult?.insarReport?.summary;
    const masterFilename = localFilePath ? localFilePath.split('/').pop() : '';
    const slaveFilename = slaveFilePath ? slaveFilePath.split('/').pop() : '';
    const isGunw = !localFilePath || localFilePath.toLowerCase().includes('_gunw') || localFilePath.toLowerCase().endsWith('.h5') || localFilePath.toLowerCase().endsWith('.he5');

    // ── PARSED METADATA ──
    const parsedMeta = parseNisarFilename(localFilePath) || parseNisarFilename(viewingResult?.url) || parseNisarFilename(viewingResult?.input_file);

    // ── DATE PARSING FOR TIMELINE ──
    const dateMatches = (localFilePath || '').match(/(\d{8})/g) || [];
    const fmtDate = (d) => {
        if (!d || d.length !== 8) return null;
        const dt = new Date(d.slice(0, 4), parseInt(d.slice(4, 6)) - 1, d.slice(6, 8));
        if (isNaN(dt)) return null;
        return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    };
    const masterDateStr = dateMatches[0] ? fmtDate(dateMatches[0]) : null;
    const slaveDateStr = dateMatches[1] ? fmtDate(dateMatches[1]) : (parsedMeta?.acquisitionDate ? fmtDate(parsedMeta.acquisitionDate.replace(/-/g, '')) : null);
    const baselineDays = (masterDateStr && slaveDateStr && dateMatches[0] && dateMatches[1])
        ? Math.round((new Date(dateMatches[1].slice(0, 4), parseInt(dateMatches[1].slice(4, 6)) - 1, dateMatches[1].slice(6, 8)) - new Date(dateMatches[0].slice(0, 4), parseInt(dateMatches[0].slice(4, 6)) - 1, dateMatches[0].slice(6, 8))) / 86400000)
        : null;

    // ── STATUS (Ratio & Proportion Based Evaluation) ──
    let statusText = 'NO DATA';
    let statusColor = '#555555';
    let healthScore = null;
    if (s) {
        const totalPts = s.total_ps_points || (s.stable_count + s.caution_count + s.alert_count + s.critical_count) || 1;
        const critPct = (s.critical_count / totalPts) * 100;
        const alertPct = (s.alert_count / totalPts) * 100;
        const cautionPct = (s.caution_count / totalPts) * 100;

        healthScore = Math.round(((s.stable_count * 1.0 + s.caution_count * 0.75 + s.alert_count * 0.4) / totalPts) * 100);

        if (critPct >= 15) { statusText = 'CRITICAL'; statusColor = '#ef4444'; }
        else if (critPct >= 5 || alertPct >= 20) { statusText = 'ALERT'; statusColor = '#f59e0b'; }
        else if (critPct >= 1 || alertPct >= 10 || cautionPct >= 25) { statusText = 'CAUTION'; statusColor = '#e6a817'; }
        else { statusText = 'NORMAL'; statusColor = '#4ade80'; }
    }

    // ── SATELLITE PASS ──
    const satellitePassRows = [
        { label: 'SATELLITE', value: 'NISAR (NASA/ISRO)', dotColor: '#4CAF50' },
        { label: 'PASS', value: parsedMeta?.direction || 'Descending', dotColor: '#333333' },
        { label: 'DATE', value: parsedMeta?.acquisitionDate || viewingResult?.date || '—', dotColor: (parsedMeta?.acquisitionDate || viewingResult?.date) ? '#4CAF50' : '#333333' },
    ];

    // ── ENVIRONMENTAL CONTEXT ROWS ──
    const envRows = [];
    envRows.push(
        { label: 'RAINFALL', value: envContext?.rainfall || '—', status: envContext?.rainfall && envContext.rainfall !== 'UNAVAILABLE' ? (envContext.rainfall.includes('mm') ? 'data' : 'ok') : 'off' },
        { label: 'SOIL', value: envContext?.soil_moisture || '—', status: envContext?.soil_moisture && envContext.soil_moisture !== 'UNAVAILABLE' ? (envContext.soil_moisture.toLowerCase().includes('anomaly') || envContext.soil_moisture.includes('saturated') ? 'warn' : 'ok') : 'off' },
        { label: 'SEISMIC', value: envContext?.seismic || '—', status: envContext?.seismic && envContext.seismic !== 'UNAVAILABLE' ? (envContext.seismic.toLowerCase().includes('no activity') || envContext.seismic.toLowerCase().includes('no events') ? 'ok' : 'warn') : 'off' },
        { label: 'SEASON', value: envContext?.season || '—', status: envContext?.season && envContext.season !== 'UNAVAILABLE' ? 'accent' : 'off' },
    );

    // ── ALERTS ──
    const SEV_ORDER = { CRITICAL: 0, ALERT: 1, CAUTION: 2, STABLE: 3 };
    const alerts = [];
    if (s) {
        if (s.critical_count > 0) alerts.push({ severity: 'CRITICAL', message: `${s.critical_count} PS points exceed critical displacement threshold` });
        if (s.alert_count > 50) alerts.push({ severity: 'ALERT', message: `${s.alert_count} points showing significant deformation` });
        if (Math.abs(s.max_displacement_mm) > 10) alerts.push({ severity: 'ALERT', message: `Max displacement ${s.max_displacement_mm.toFixed(1)}mm exceeds 10mm threshold` });
        if (s.max_displacement_mm < -5) alerts.push({ severity: 'CAUTION', message: `Subsidence detected: ${Math.abs(s.max_displacement_mm).toFixed(1)}mm` });
        if (envContext?.storage_pct > 90 && s.caution_count > 0) alerts.push({ severity: 'CAUTION', message: 'Reservoir at high capacity — monitor embankment' });
        if (alerts.length === 0) alerts.push({ severity: 'STABLE', message: 'Baseline monitoring active — no anomalies' });
    }
    alerts.sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity]);

    // ── RIGHT PANEL DATA ──
    const topScatterers = s ? (viewingResult?.insarReport?.scatterers || [])
        .sort((a, b) => Math.abs(b.displacement_mm) - Math.abs(a.displacement_mm))
        .slice(0, 10) : [];


    const filename = (viewingResult?.url || localFilePath || '').toUpperCase();
    const productVal = filename.includes('_GUNW_') ? 'GUNW — Pre-computed InSAR'
        : filename.includes('_GCOV_') ? 'GCOV — Geocoded Covariance'
            : filename.includes('_RSLC_') ? 'RSLC — Range SLC'
                : 'NISAR Product';

    const acquisitionRows = [
        { label: 'SATELLITE', value: 'NISAR (NASA/ISRO)' },
        { label: 'PIPELINE', value: (viewingResult?.pipeline || 'insar') === 'insar' ? 'InSAR Analysis' : 'SAR Focus' },
        { label: 'PRODUCT', value: productVal },
        { label: 'BAND', value: 'L-Band (1.26 GHz)' },
        { label: 'ORBIT', value: 'Descending' },
    ];

    const layerOptions = [
        { key: 'amplitude', label: 'AMPLITUDE' },
        { key: 'deformation', label: 'DEFORMATION' },
        { key: 'coherence', label: 'COHERENCE' },
    ];

    const handleUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploading(true);
        const formData = new FormData();
        formData.append('file', file);
        try {
            const res = await fetch(api('/upload'), { method: 'POST', body: formData });
            if (!res.ok) throw new Error('Upload failed');
            const data = await res.json();
            if (data.path) setLocalFilePath(data.path);
        } catch (err) {
            console.error('File upload error:', err);
            alert('Upload failed: ' + err.message);
        } finally {
            setUploading(false);
            e.target.value = '';
        }
    };

    const dotColorForStatus = (status) => {
        if (status === 'ok') return C.stable;
        if (status === 'warn') return C.caution;
        if (status === 'data') return C.data;
        if (status === 'accent') return C.accent.infra;
        return '#333333';
    };

    const pillStyle = (sev) => {
        const base = { fontFamily: MONO, fontSize: '8px', fontWeight: 600, padding: '2px 6px', borderRadius: '1px', letterSpacing: '0.04em', whiteSpace: 'nowrap', flexShrink: 0 };
        if (sev === 'CRITICAL') return { ...base, background: C.critical, color: '#F0F0F0' };
        if (sev === 'ALERT') return { ...base, background: C.alert, color: '#F0F0F0' };
        if (sev === 'CAUTION') return { ...base, background: C.caution, color: '#0A0A0A' };
        return { ...base, background: 'transparent', color: C.stable, border: `1px solid ${C.stable}` };
    };

    const telemetryRow = ({ label, value, dotColor }) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0', borderBottom: '1px solid #161616' }}>
            <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: dotColor, flexShrink: 0, boxShadow: dotColor !== '#333333' ? `0 0 4px ${dotColor}40` : 'none' }} />
            <span style={{ fontFamily: MONO, fontSize: '10px', color: '#555555', width: '68px', flexShrink: 0 }}>{label}</span>
            <span style={{ fontFamily: MONO, fontSize: '10px', color: value === '—' ? '#333333' : '#CCCCCC', lineHeight: 1.4, wordBreak: 'break-word', flex: 1 }}>{value}</span>
        </div>
    );

    return (
        <>
            {/* ═══════════════════════════════          {/* ════════════════════════════════════════════════════
                ZONE 1: LEFT PANEL (250px) - Compact No-Scroll UI
                ════════════════════════════════════════════════════ */}
            <div style={{
                position: 'absolute', top: '42px', left: 0, bottom: 0,
                width: '250px', background: C.bg0,
                borderRight: `1px solid ${C.bg3}`, zIndex: 100,
                overflowY: 'auto', boxSizing: 'border-box',
                padding: '10px 10px 16px', display: 'flex', flexDirection: 'column', gap: '8px'
            }}>
                {/* ═══════ ASSET MONITORING & SEARCH ═══════ */}
                <div style={{
                    background: 'linear-gradient(180deg, #0c0c0e 0%, #070708 100%)',
                    border: '1px solid #1a1a1f', borderRadius: '8px', padding: '10px', position: 'relative',
                }}>
                    <div style={{
                        position: 'absolute', top: 0, left: 0, right: 0, height: '2px',
                        background: 'linear-gradient(90deg, #c8a96e, transparent 60%)',
                        borderRadius: '8px 8px 0 0'
                    }} />

                    {/* Section Header */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                        <div style={{
                            width: '18px', height: '18px', borderRadius: '4px', background: '#111114',
                            border: '1px solid #1a1a1f', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: '#c8a96e', fontSize: '9px', fontFamily: MONO,
                        }}>◎</div>
                        <div style={{
                            fontFamily: MONO, fontSize: '9px', fontWeight: 600,
                            letterSpacing: '0.12em', textTransform: 'uppercase', color: '#666675',
                        }}>ASSET SEARCH</div>
                    </div>

                    {/* Search Input */}
                    <div style={{ position: 'relative' }}>
                        <span style={{
                            position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)',
                            color: '#444450', fontSize: '10px', fontFamily: MONO, pointerEvents: 'none',
                        }}>⌕</span>
                        <input
                            type="text"
                            value={assetSearch}
                            onChange={(e) => { setAssetSearch(e.target.value); searchAssets(e.target.value); }}
                            placeholder="Search dam or bridge..."
                            style={{
                                width: '100%', padding: '5px 8px 5px 24px', background: '#0e0e11',
                                border: '1px solid #1a1a1f', borderRadius: '4px', color: '#e8e8ec',
                                fontFamily: MONO, fontSize: '10px', outline: 'none', boxSizing: 'border-box',
                            }}
                            onFocus={(e) => { e.target.style.borderColor = '#c8a96e'; }}
                            onBlur={(e) => {
                                e.target.style.borderColor = '#1a1a1f';
                                setTimeout(() => setAssetSearchOpen(false), 200);
                            }}
                        />
                        {assetSearchOpen && assetResults.length > 0 && (
                            <div style={{
                                position: 'absolute', top: '100%', left: 0, right: 0, background: '#0c0c0e',
                                border: '1px solid #25252b', borderTop: 'none', borderRadius: '0 0 6px 6px',
                                zIndex: 200, maxHeight: '140px', overflowY: 'auto', marginTop: '2px',
                                boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                            }}>
                                {assetResults.map((asset, i) => (
                                    <div
                                        key={asset.id || i}
                                        onMouseDown={() => {
                                            setAssetSearch(asset.name); setAssetName(asset.name);
                                            setAssetType(asset.asset_type);
                                            setAssetLat(asset.lat.toString()); setAssetLon(asset.lon.toString());
                                            setAssetState(asset.state || asset.country || '');
                                            setAssetResults([]); setAssetSearchOpen(false);
                                            setFlyToCenter([asset.lat, asset.lon]);
                                        }}
                                        style={{
                                            padding: '6px 8px', cursor: 'pointer', borderBottom: '1px solid #1a1a1f',
                                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.background = '#18181c'}
                                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                    >
                                        <span style={{ fontFamily: MONO, fontSize: '10px', color: '#e8e8ec' }}>{asset.name}</span>
                                        <span style={{ fontFamily: MONO, fontSize: '8px', color: '#555560' }}>{asset.state || asset.country}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* ═══════ INTEGRATED ASSET & STATUS CARD ═══════ */}
                {assetLat && assetLon && assetName && (
                    <div style={{
                        background: '#0d0d10', border: '1px solid #1a1a1f', borderRadius: '8px',
                        padding: '10px', position: 'relative', overflow: 'hidden',
                    }}>
                        {/* Status Header */}
                        <div style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            marginBottom: '6px', gap: '6px'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                                <div style={{
                                    width: '8px', height: '8px', borderRadius: '50%', background: statusColor,
                                    boxShadow: `0 0 8px ${statusColor}60`, flexShrink: 0,
                                    animation: statusText === 'CRITICAL' || statusText === 'ALERT' ? 'pulse-red 1.5s infinite' : 'none'
                                }} />
                                <span style={{
                                    fontFamily: MONO, fontSize: '11px', fontWeight: 700, color: '#f0f0f4',
                                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                                }} title={assetName}>
                                    {assetName}
                                </span>
                            </div>

                            <span style={{
                                padding: '2px 6px', borderRadius: '3px', fontFamily: MONO,
                                fontSize: '8px', fontWeight: 700, letterSpacing: '0.05em',
                                background: `${statusColor}20`, color: statusColor,
                                border: `1px solid ${statusColor}40`, flexShrink: 0
                            }}>
                                {statusText}
                            </span>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: MONO, fontSize: '9px', marginBottom: '6px' }}>
                            <span style={{ color: '#c8a96e', fontWeight: 600 }}>{assetType}</span>
                            <span style={{ color: '#666675' }}>{assetState || 'India'}</span>
                        </div>

                        <div style={{
                            fontFamily: MONO, fontSize: '8px', color: '#555560', display: 'flex',
                            justifyContent: 'space-between', paddingTop: '6px', borderTop: '1px solid #16161a',
                        }}>
                            <span>COORDS</span>
                            <span style={{ color: '#888898' }}>{parseFloat(assetLat).toFixed(4)}°N {parseFloat(assetLon).toFixed(4)}°E</span>
                        </div>
                    </div>
                )}

                {/* Keyframes for status pulse */}
                <style>{`
                  @keyframes pulse-red {
                    0% { opacity: 0.4; }
                    50% { opacity: 1; }
                    100% { opacity: 0.4; }
                  }
                `}</style>

                {/* ═══════ ENVIRONMENTAL CONTEXT & TELEMETRY ═══════ */}
                <div style={{
                    background: '#0d0d10', border: '1px solid #1a1a1f', borderRadius: '8px',
                    padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ color: '#c8a96e', fontSize: '10px' }}>🌡</span>
                            <span style={{
                                fontFamily: MONO, fontSize: '9px', fontWeight: 700,
                                letterSpacing: '0.1em', textTransform: 'uppercase', color: '#888895',
                            }}>ENVIRONMENTAL TELEMETRY</span>
                        </div>
                        {envContext && (
                            <span style={{ fontFamily: MONO, fontSize: '7px', color: '#4ade80', letterSpacing: '0.05em' }}>● LIVE</span>
                        )}
                    </div>

                    {/* Reservoir Telemetry Grid (if reservoir present) */}
                    {envContext?.reservoir && envContext.reservoir !== 'UNAVAILABLE' && (
                        <div style={{
                            background: 'rgba(200,169,110,0.03)', border: '1px solid rgba(200,169,110,0.15)',
                            borderRadius: '6px', padding: '8px', position: 'relative'
                        }}>
                            <div style={{
                                fontFamily: MONO, fontSize: '9px', color: '#c8a96e', fontWeight: 700,
                                marginBottom: '6px', letterSpacing: '0.05em'
                            }}>
                                {envContext.reservoir}
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                                <div>
                                    <div style={{ fontFamily: MONO, fontSize: '7px', color: '#555560', textTransform: 'uppercase' }}>Current Level</div>
                                    <div style={{ fontFamily: MONO, fontSize: '11px', color: '#e8e8ec', fontWeight: 700 }}>
                                        {envContext.current_level_m != null ? `${envContext.current_level_m.toFixed(1)}m` : '—'}
                                    </div>
                                </div>
                                <div>
                                    <div style={{ fontFamily: MONO, fontSize: '7px', color: '#555560', textTransform: 'uppercase' }}>Storage Capacity</div>
                                    <div style={{
                                        fontFamily: MONO, fontSize: '11px', fontWeight: 700,
                                        color: envContext.storage_pct > 90 ? '#ef4444' : (envContext.storage_pct > 50 ? '#4ade80' : '#f59e0b')
                                    }}>
                                        {envContext.storage_pct != null ? `${envContext.storage_pct.toFixed(1)}%` : '—'}
                                    </div>
                                </div>
                                <div>
                                    <div style={{ fontFamily: MONO, fontSize: '7px', color: '#555560', textTransform: 'uppercase' }}>FRL / MDDL</div>
                                    <div style={{ fontFamily: MONO, fontSize: '9px', color: '#9999a0' }}>
                                        {envContext.full_reservoir_level_m != null ? `${envContext.full_reservoir_level_m.toFixed(0)}m / ${envContext.mddl_level_m?.toFixed(0)}m` : '—'}
                                    </div>
                                </div>
                                <div>
                                    <div style={{ fontFamily: MONO, fontSize: '7px', color: '#555560', textTransform: 'uppercase' }}>Basin</div>
                                    <div style={{ fontFamily: MONO, fontSize: '9px', color: '#9999a0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {envContext.river_basin || 'Local'}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Environmental Grid (Rainfall, Soil, Seismic, Season) */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                        {envRows.map((r) => {
                            const isOff = r.value === '—' || r.status === 'off';
                            const isWarn = r.status === 'warn';
                            const isData = r.status === 'data';
                            const isOk = r.status === 'ok';

                            const valColor = isOff ? '#444450' : isWarn ? '#f59e0b' : isData ? '#60a5fa' : isOk ? '#4ade80' : '#c8a96e';

                            return (
                                <div key={r.label} style={{
                                    background: '#09090c', border: `1px solid ${isWarn ? 'rgba(245,158,11,0.3)' : '#16161c'}`,
                                    borderRadius: '5px', padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: '2px'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <span style={{ fontFamily: MONO, fontSize: '7px', color: '#555565', letterSpacing: '0.05em' }}>{r.label}</span>
                                        <span style={{
                                            width: '4px', height: '4px', borderRadius: '50%', background: valColor,
                                            boxShadow: !isOff ? `0 0 4px ${valColor}60` : 'none'
                                        }} />
                                    </div>
                                    <span style={{
                                        fontFamily: MONO, fontSize: '10px', fontWeight: 700, color: valColor,
                                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                                    }} title={r.value}>
                                        {r.value}
                                    </span>
                                </div>
                            );
                        })}
                    </div>

                    {/* Fetch Button if not fetched */}
                    {assetLat && assetLon && !envContext && (
                        <button
                            onClick={fetchContext}
                            disabled={fetchingContext}
                            style={{
                                width: '100%', padding: '6px', background: 'transparent',
                                border: '1px solid #25252b', borderRadius: '4px', color: '#c8a96e',
                                fontFamily: MONO, fontSize: '9px', letterSpacing: '0.08em',
                                cursor: fetchingContext ? 'not-allowed' : 'pointer',
                                opacity: fetchingContext ? 0.5 : 1, marginTop: '2px'
                            }}
                        >
                            {fetchingContext ? 'FETCHING TELEMETRY...' : 'FETCH TELEMETRY'}
                        </button>
                    )}

                    {envContext?.source && (
                        <div style={{ fontFamily: MONO, fontSize: '7px', color: '#444450', textAlign: 'right', letterSpacing: '0.04em' }}>
                            SRC: {envContext.source}
                        </div>
                    )}
                </div>
            </div>


            {/* ════════════════════════════════════════════════════
                ZONE 3: BOTTOM BAR (80px)
                ════════════════════════════════════════════════════ */}
            <div style={{
                position: 'absolute', bottom: 0, left: '250px', right: 0,
                height: '80px', background: '#111111',
                borderTop: '1px solid #2A2A2A', zIndex: 100,
                display: 'flex', alignItems: 'center',
                padding: '0 20px', gap: '24px', boxSizing: 'border-box',
            }}>
                {/* LEFT: File + Pipeline */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                        <span style={{ fontFamily: MONO, fontSize: '10px', color: '#555555', flexShrink: 0 }}>{isGunw ? 'GUNW FILE' : 'MASTER'}</span>
                        {editingMaster ? (
                            <input autoFocus type="text" value={localFilePath} onChange={e => setLocalFilePath(e.target.value)} onBlur={() => setEditingMaster(false)} onKeyDown={e => { if (e.key === 'Enter') setEditingMaster(false); }}
                                style={{ width: '220px', padding: '4px 8px', background: C.bg2, border: `1px solid ${C.bg3}`, color: '#F0F0F0', fontFamily: MONO, fontSize: '11px', outline: 'none', borderRadius: '2px', boxSizing: 'border-box' }}
                            />
                        ) : (
                            <span style={{ fontFamily: MONO, fontSize: '11px', color: '#F0F0F0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '180px' }} title={localFilePath}>{masterFilename || '—'}</span>
                        )}
                        <button onClick={() => setEditingMaster(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: '#555555', display: 'flex', alignItems: 'center' }}
                            onMouseEnter={e => e.currentTarget.style.color = '#F0F0F0'} onMouseLeave={e => e.currentTarget.style.color = '#555555'} title="Edit file path"><FolderOpen size={14} /></button>
                        <label style={{ display: 'flex', alignItems: 'center', cursor: uploading ? 'not-allowed' : 'pointer', padding: '2px', color: '#555555' }}
                            onMouseEnter={e => !uploading && (e.currentTarget.style.color = '#F0F0F0')} onMouseLeave={e => !uploading && (e.currentTarget.style.color = '#555555')} title="Upload local HDF5 product">
                            <Upload size={14} />
                            <input type="file" accept=".h5,.he5" onChange={handleUpload} disabled={uploading} style={{ display: 'none' }} />
                        </label>
                        {uploading && <span style={{ fontFamily: MONO, fontSize: '9px', color: '#E6A817', marginLeft: '4px' }}>UPLOADING...</span>}
                    </div>

                    {!isGunw && (
                        <>
                            <div style={{ width: '1px', height: '32px', background: '#2A2A2A', flexShrink: 0 }} />
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                                <span style={{ fontFamily: MONO, fontSize: '10px', color: '#555555', flexShrink: 0 }}>SLAVE</span>
                                {editingSlave ? (
                                    <input autoFocus type="text" value={slaveFilePath} onChange={e => setSlaveFilePath(e.target.value)} onBlur={() => setEditingSlave(false)} onKeyDown={e => { if (e.key === 'Enter') setEditingSlave(false); }}
                                        style={{ width: '220px', padding: '4px 8px', background: C.bg2, border: `1px solid ${C.bg3}`, color: '#F0F0F0', fontFamily: MONO, fontSize: '11px', outline: 'none', borderRadius: '2px', boxSizing: 'border-box' }}
                                    />
                                ) : (
                                    <span style={{ fontFamily: MONO, fontSize: '11px', color: slaveFilename ? '#888888' : '#555555', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '140px' }} title={slaveFilePath}>{slaveFilename || 'SYNTHETIC'}</span>
                                )}
                                <button onClick={() => setEditingSlave(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: '#555555', display: 'flex', alignItems: 'center' }}
                                    onMouseEnter={e => e.currentTarget.style.color = '#F0F0F0'} onMouseLeave={e => e.currentTarget.style.color = '#555555'} title="Edit slave file path"><FolderOpen size={14} /></button>
                            </div>
                        </>
                    )}

                    <div style={{ width: '1px', height: '32px', background: '#2A2A2A', flexShrink: 0 }} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontFamily: MONO, fontSize: '10px', color: '#555555', flexShrink: 0 }}>PIPELINE</span>
                        <span style={{ fontFamily: MONO, fontSize: '11px', color: '#C8A96E' }}>InSAR Analysis</span>
                    </div>
                </div>

                {/* CENTER: Layer checkboxes */}
                <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '20px' }}>
                    {layerOptions.map(({ key, label }) => {
                        const checked = visibleLayers[key];
                        return (
                            <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', opacity: checked ? 1 : 0.7 }}>
                                <div style={{ width: '10px', height: '10px', border: `1px solid ${checked ? '#C8A96E' : '#404040'}`, background: checked ? '#C8A96E' : 'transparent', flexShrink: 0 }} />
                                <span style={{ fontFamily: MONO, fontSize: '10px', color: checked ? '#F0F0F0' : '#555555' }}>{label}</span>
                                <input type="checkbox" checked={checked} onChange={() => setVisibleLayers(prev => ({ ...prev, [key]: !prev[key] }))} style={{ display: 'none' }} />
                            </label>
                        );
                    })}
                </div>

                {/* RIGHT: Start button */}
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {runningJobs.length > 0 ? (
                        <>
                            <span style={{ fontFamily: MONO, fontSize: '11px', color: '#E6A817' }}>PROCESSING...</span>
                            <span style={{ fontFamily: MONO, fontSize: '11px', color: '#555555' }}>{formatElapsed(elapsed[runningJobs[0]?.id])}</span>
                        </>
                    ) : (
                        <button onClick={startJob} disabled={!getInputFile() || runningJobs.length > 0 || !gatewayOnline}
                            style={{ background: '#C8A96E', color: '#0A0A0A', fontFamily: MONO, fontSize: '12px', fontWeight: 600, padding: '10px 24px', border: 'none', borderRadius: '2px', cursor: (!getInputFile() || runningJobs.length > 0 || !gatewayOnline) ? 'not-allowed' : 'pointer', opacity: (!getInputFile() || runningJobs.length > 0 || !gatewayOnline) ? 0.3 : 1 }}>
                            START PROCESSING
                        </button>
                    )}
                </div>
            </div>

            {/* ════════════════════════════════════════════════════
                ZONE 2: RIGHT PANEL (320px)
                ════════════════════════════════════════════════════ */}
            {(s || localFilePath || (assetLat && assetLon)) && (
                <div style={{
                    position: 'absolute', top: '42px', right: 0, bottom: '80px',
                    width: '320px', background: '#111111',
                    borderLeft: '1px solid #2A2A2A', zIndex: 100,
                    overflowY: 'auto', padding: '16px', boxSizing: 'border-box',
                }}>
                    {selectedPoint ? (
                        <>
                            <div
                                onClick={() => setSelectedPoint(null)}
                                style={{ fontFamily: MONO, fontSize: '10px', color: '#C8A96E', cursor: 'pointer', marginBottom: '16px', display: 'inline-block' }}
                                onMouseEnter={e => e.currentTarget.style.color = '#F0F0F0'}
                                onMouseLeave={e => e.currentTarget.style.color = '#C8A96E'}
                            >
                                ← BACK TO OVERVIEW
                            </div>

                            <div style={{ fontFamily: MONO, fontSize: '10px', color: '#555555', letterSpacing: '0.1em', marginBottom: '12px' }}>PERSISTENT SCATTERER</div>

                            {/* POINT METRICS */}
                            <div style={{ marginBottom: '16px' }}>
                                {[
                                    { label: 'DISPLACEMENT', value: `${selectedPoint.displacement_mm?.toFixed(2) ?? '—'} mm`, color: sevColor(selectedPoint.severity) },
                                    { label: 'COHERENCE', value: `${selectedPoint.coherence?.toFixed(2) ?? '—'}`, color: '#F0F0F0' },
                                    { label: 'UNWRAPPED PHASE', value: `${selectedPoint.unwrapped_phase_rad?.toFixed(2) ?? '—'} rad`, color: '#F0F0F0' },
                                    { label: 'CLASSIFICATION', value: selectedPoint.severity || '—', color: sevColor(selectedPoint.severity) },
                                ].map(row => (
                                    <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #1A1A1A', fontFamily: MONO, fontSize: '11px' }}>
                                        <span style={{ color: '#555555' }}>{row.label}</span>
                                        <span style={{ color: row.color }}>{row.value}</span>
                                    </div>
                                ))}
                            </div>

                            <div style={{ height: '1px', background: '#2A2A2A', margin: '12px 0' }} />

                            {/* PROCESSING PIPELINE */}
                            <div style={{ fontFamily: MONO, fontSize: '9px', color: '#555555', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '10px' }}>PROCESSING PIPELINE</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                                {[
                                    'Raw Phase',
                                    'Water Masking',
                                    'Connected Components',
                                    'Quadratic Deramp (3 iter, 289 rejected)',
                                    'Median Reference',
                                    'LOS Conversion (λ = 23.8 cm)',
                                    'MAD Classification (σ = 2.5)',
                                ].map((step, i) => (
                                    <div key={step} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <div style={{
                                            width: '5px', height: '5px', borderRadius: '50%',
                                            background: i < 6 ? '#4CAF50' : sevColor(selectedPoint.severity),
                                            flexShrink: 0,
                                            boxShadow: i < 6 ? '0 0 4px #4CAF5040' : `0 0 4px ${sevColor(selectedPoint.severity)}40`,
                                        }} />
                                        <span style={{ fontFamily: MONO, fontSize: '10px', color: i < 6 ? '#888888' : '#CCCCCC' }}>{step}</span>
                                    </div>
                                ))}
                            </div>

                            <div style={{ height: '1px', background: '#2A2A2A', margin: '12px 0' }} />

                            {/* COORDINATES */}
                            <div style={{ fontFamily: MONO, fontSize: '9px', color: '#555555', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '10px' }}>COORDINATES</div>
                            <div style={{ marginBottom: '16px' }}>
                                {[
                                    { label: 'LAT', value: `${selectedPoint.lat?.toFixed(4) ?? '—'}°N` },
                                    { label: 'LON', value: `${selectedPoint.lon?.toFixed(4) ?? '—'}°E` },
                                    { label: 'PIXEL X', value: `${selectedPoint.x ?? '—'}` },
                                    { label: 'PIXEL Y', value: `${selectedPoint.y ?? '—'}` },
                                ].map(row => (
                                    <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #1A1A1A', fontFamily: MONO, fontSize: '11px' }}>
                                        <span style={{ color: '#555555' }}>{row.label}</span>
                                        <span style={{ color: '#CCCCCC' }}>{row.value}</span>
                                    </div>
                                ))}
                            </div>
                        </>
                    ) : (
                        <>
                            {/* ── SATELLITE PASS ── */}
                            {assetLat && assetLon && assetName && (
                                <div style={{
                                    background: 'linear-gradient(180deg, #111114 0%, rgba(200,169,110,0.01) 100%)',
                                    border: '1px solid #1a1a1f', borderRadius: '10px', padding: '14px',
                                    marginBottom: '14px', position: 'relative'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                                        <span style={{ fontSize: '11px', color: '#c8a96e' }}>🛰</span>
                                        <span style={{ fontFamily: MONO, fontSize: '9px', fontWeight: 600, letterSpacing: '0.1em', color: '#555560' }}>ORBITAL DATA / PASS</span>
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        {telemetryRow({ label: 'SATELLITE', value: 'NISAR (NASA/ISRO)', dotColor: '#4CAF50' })}
                                        {telemetryRow({ label: 'PASS DIRECTION', value: parsedMeta?.direction || 'Descending', dotColor: '#c8a96e' })}
                                    </div>

                                    {/* Timeline */}
                                    {masterDateStr && slaveDateStr ? (
                                        <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid #1a1a1f' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', padding: '0 8px' }}>
                                                {/* Master Point */}
                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 2 }}>
                                                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#c8a96e', border: '2px solid #0a0a0a', boxShadow: '0 0 8px rgba(200,169,110,0.4)' }} />
                                                    <div style={{ fontFamily: MONO, fontSize: '9px', color: '#e8e8ec', marginTop: '4px', fontWeight: 600 }}>{masterDateStr}</div>
                                                    <div style={{ fontFamily: MONO, fontSize: '7px', color: '#555560', letterSpacing: '0.05em' }}>MASTER</div>
                                                </div>

                                                {/* Animated Flow Track */}
                                                <div style={{
                                                    flex: 1, height: '2px', background: '#1a1a1f', margin: '0 8px',
                                                    position: 'relative', top: '-10px', overflow: 'hidden', borderRadius: '2px'
                                                }}>
                                                    <div style={{
                                                        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                                                        background: 'linear-gradient(90deg, transparent, #c8a96e, transparent)',
                                                        animation: 'timeline-flow 2s infinite linear'
                                                    }} />
                                                </div>

                                                {/* Slave Point */}
                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 2 }}>
                                                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#4CAF50', border: '2px solid #0a0a0a', boxShadow: '0 0 8px rgba(76,175,80,0.4)' }} />
                                                    <div style={{ fontFamily: MONO, fontSize: '9px', color: '#e8e8ec', marginTop: '4px', fontWeight: 600 }}>{slaveDateStr}</div>
                                                    <div style={{ fontFamily: MONO, fontSize: '7px', color: '#555560', letterSpacing: '0.05em' }}>SLAVE</div>
                                                </div>
                                            </div>

                                            {baselineDays != null && (
                                                <div style={{ textAlign: 'center', marginTop: '10px', fontFamily: MONO, fontSize: '9px' }}>
                                                    <span style={{ color: '#555560' }}>TEMPORAL BASELINE: </span>
                                                    <span style={{ color: '#c8a96e', fontWeight: 600 }}>{baselineDays} DAYS</span>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid #1a1a1f' }}>
                                            {telemetryRow({
                                                label: 'ACQ DATE',
                                                value: slaveDateStr || parsedMeta?.acquisitionDate || '—',
                                                dotColor: (slaveDateStr || parsedMeta?.acquisitionDate) ? '#4CAF50' : '#333333',
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* ── STRUCTURAL HEALTH ── */}
                            {s ? (
                                <div style={{
                                    background: 'linear-gradient(180deg, #111114 0%, rgba(255,255,255,0.01) 100%)',
                                    border: '1px solid #1a1a1f', borderRadius: '10px', padding: '14px',
                                    marginBottom: '14px'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                                        <span style={{ fontSize: '11px', color: '#c8a96e' }}>📈</span>
                                        <span style={{ fontFamily: MONO, fontSize: '9px', fontWeight: 600, letterSpacing: '0.1em', color: '#555560' }}>STRUCTURAL DISPLACEMENT</span>
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontFamily: MONO, fontSize: '10px', color: '#555560' }}>MEDIAN LOS</span>
                                            <span style={{ fontFamily: MONO, fontSize: '11px', fontWeight: 600, color: '#e8e8ec' }}>{s.median_displacement_mm?.toFixed(1) ?? '—'} mm</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontFamily: MONO, fontSize: '10px', color: '#555560' }}>MAX DEFORMATION</span>
                                            <span style={{ fontFamily: MONO, fontSize: '11px', fontWeight: 600, color: (s.max_displacement_mm || 0) > 30 ? '#ef4444' : '#e8e8ec' }}>{s.max_displacement_mm?.toFixed(1) ?? '—'} mm</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontFamily: MONO, fontSize: '10px', color: '#555560' }}>SCATTERERS (PS)</span>
                                            <span style={{ fontFamily: MONO, fontSize: '11px', fontWeight: 600, color: '#7eb8d4' }}>{s.total_ps_points ?? '—'}</span>
                                        </div>

                                        <div style={{ height: '1px', background: '#1a1a1f', margin: '4px 0' }} />

                                        <div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                                <span style={{ fontFamily: MONO, fontSize: '10px', color: '#555560' }}>MEAN COHERENCE</span>
                                                <span style={{ fontFamily: MONO, fontSize: '10px', fontWeight: 600, color: '#e8e8ec' }}>{s.mean_coherence?.toFixed(2) ?? '—'}</span>
                                            </div>
                                            {s.mean_coherence != null && (
                                                <div style={{ height: '3px', background: '#1a1a1f', borderRadius: '2px', overflow: 'hidden' }}>
                                                    <div style={{
                                                        height: '100%',
                                                        width: `${s.mean_coherence * 100}%`,
                                                        background: s.mean_coherence > 0.6 ? '#4ade80' : s.mean_coherence > 0.4 ? '#f59e0b' : '#ef4444',
                                                        borderRadius: '2px'
                                                    }} />
                                                </div>
                                            )}
                                        </div>

                                        <div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                                <span style={{ fontFamily: MONO, fontSize: '10px', color: '#555560' }}>RELIABLE PIXELS</span>
                                                <span style={{ fontFamily: MONO, fontSize: '10px', fontWeight: 600, color: '#e8e8ec' }}>{s.reliable_pct != null ? `${s.reliable_pct.toFixed(0)}%` : '—'}</span>
                                            </div>
                                            {s.reliable_pct != null && (
                                                <div style={{ height: '3px', background: '#1a1a1f', borderRadius: '2px', overflow: 'hidden' }}>
                                                    <div style={{
                                                        height: '100%',
                                                        width: `${s.reliable_pct}%`,
                                                        background: s.reliable_pct > 80 ? '#4ade80' : s.reliable_pct > 50 ? '#f59e0b' : '#ef4444',
                                                        borderRadius: '2px'
                                                    }} />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ) : (assetLat && assetLon && assetName) && (
                                <div style={{
                                    background: 'linear-gradient(180deg, #111114 0%, rgba(255,255,255,0.01) 100%)',
                                    border: '1px solid #1a1a1f', borderRadius: '10px', padding: '14px',
                                    marginBottom: '14px', display: 'flex', flexDirection: 'column', gap: '8px'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span style={{ fontSize: '11px', color: '#3a3a44' }}>📈</span>
                                        <span style={{ fontFamily: MONO, fontSize: '9px', fontWeight: 600, letterSpacing: '0.1em', color: '#3a3a44' }}>STRUCTURAL DISPLACEMENT</span>
                                    </div>
                                    <div style={{ fontFamily: MONO, fontSize: '10px', color: '#555560', marginTop: '4px' }}>
                                        No InSAR acquisition processed yet. Run processing to generate displacement metrics.
                                    </div>
                                </div>
                            )}

                            {/* ── ALERTS ── */}
                            {s && (
                                <div style={{ marginBottom: '14px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                                        <span style={{ fontSize: '11px', color: '#c8a96e' }}>⚠️</span>
                                        <span style={{ fontFamily: MONO, fontSize: '9px', fontWeight: 600, letterSpacing: '0.1em', color: '#555560' }}>ACTIVE ALERTS</span>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        {alerts.slice(0, 3).map((a, i) => (
                                            <div key={i} style={{
                                                display: 'flex', gap: '10px', alignItems: 'flex-start',
                                                padding: '10px 12px', background: '#111114',
                                                border: '1px solid #1a1a1f', borderRadius: '8px',
                                                borderLeft: `3px solid ${a.severity === 'CRITICAL' ? C.critical : a.severity === 'ALERT' ? C.alert : a.severity === 'CAUTION' ? C.caution : C.stable}`
                                            }}>
                                                <span style={pillStyle(a.severity)}>{a.severity}</span>
                                                <span style={{ fontFamily: MONO, fontSize: '10px', color: '#a8a8b2', lineHeight: 1.4, flex: 1 }}>{a.message}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Divider line before analysis sections */}
                            {s && <div style={{ height: '1px', background: '#1a1a1f', margin: '18px 0' }} />}

                            {/* ── DEFORMATION DISTRIBUTION SPECTRUM ── */}
                            {s && (
                                <>
                                    <div style={{
                                        background: 'linear-gradient(180deg, #111114 0%, rgba(200,169,110,0.02) 100%)',
                                        border: '1px solid #1a1a1f', borderRadius: '10px', padding: '14px',
                                        marginBottom: '14px'
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                            <span style={{ fontFamily: MONO, fontSize: '9px', fontWeight: 600, letterSpacing: '0.1em', color: '#555560' }}>DEFORMATION SPECTRUM</span>
                                            <span style={{ fontFamily: MONO, fontSize: '10px', fontWeight: 600, color: healthScore >= 80 ? '#4ade80' : healthScore >= 65 ? '#e6a817' : '#ef4444' }}>
                                                {healthScore != null ? `${healthScore}% STABILITY` : '—'}
                                            </span>
                                        </div>

                                        {/* Multi-segment proportional spectrum bar */}
                                        {(() => {
                                            const total = (s.stable_count + s.caution_count + s.alert_count + s.critical_count) || 1;
                                            const stPct = ((s.stable_count / total) * 100).toFixed(1);
                                            const caPct = ((s.caution_count / total) * 100).toFixed(1);
                                            const alPct = ((s.alert_count / total) * 100).toFixed(1);
                                            const crPct = ((s.critical_count / total) * 100).toFixed(1);
                                            return (
                                                <>
                                                    <div style={{ height: '6px', width: '100%', background: '#1a1a1f', borderRadius: '3px', display: 'flex', overflow: 'hidden', marginBottom: '10px' }}>
                                                        <div style={{ width: `${stPct}%`, background: '#4ade80', transition: 'width 0.4s ease' }} title={`Stable: ${s.stable_count} (${stPct}%)`} />
                                                        <div style={{ width: `${caPct}%`, background: '#e6a817', transition: 'width 0.4s ease' }} title={`Caution: ${s.caution_count} (${caPct}%)`} />
                                                        <div style={{ width: `${alPct}%`, background: '#f59e0b', transition: 'width 0.4s ease' }} title={`Alert: ${s.alert_count} (${alPct}%)`} />
                                                        <div style={{ width: `${crPct}%`, background: '#ef4444', transition: 'width 0.4s ease' }} title={`Critical: ${s.critical_count} (${crPct}%)`} />
                                                    </div>

                                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '4px', textAlign: 'center', fontFamily: MONO, fontSize: '9px' }}>
                                                        <div><span style={{ color: '#4ade80' }}>●</span> <span style={{ color: '#888888' }}>{s.stable_count}</span></div>
                                                        <div><span style={{ color: '#e6a817' }}>●</span> <span style={{ color: '#888888' }}>{s.caution_count}</span></div>
                                                        <div><span style={{ color: '#f59e0b' }}>●</span> <span style={{ color: '#888888' }}>{s.alert_count}</span></div>
                                                        <div><span style={{ color: '#ef4444' }}>●</span> <span style={{ color: '#888888' }}>{s.critical_count}</span></div>
                                                    </div>
                                                </>
                                            );
                                        })()}
                                    </div>

                                    {/* ── HIGHEST DEFORMATION POINTS TELEMETRY ── */}
                                    {topScatterers.length > 0 && (
                                        <div style={{
                                            background: '#111114', border: '1px solid #1a1a1f', borderRadius: '10px',
                                            padding: '14px', marginBottom: '14px'
                                        }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                                <span style={{ fontFamily: MONO, fontSize: '9px', fontWeight: 600, letterSpacing: '0.1em', color: '#555560' }}>MAX DISPLACEMENT POINTS</span>
                                                <span style={{ fontFamily: MONO, fontSize: '8px', color: '#3a3a44' }}>TOP 10</span>
                                            </div>

                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                {topScatterers.map((pt, idx) => {
                                                    const maxAbsDisp = Math.abs(topScatterers[0]?.displacement_mm || 30);
                                                    const barWidthPct = Math.min(100, (Math.abs(pt.displacement_mm) / maxAbsDisp) * 100);
                                                    const col = sevColor(pt.severity);
                                                    return (
                                                        <div
                                                            key={idx}
                                                            onClick={() => setSelectedPoint(pt)}
                                                            onMouseEnter={e => e.currentTarget.style.background = '#18181c'}
                                                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                                            style={{
                                                                padding: '6px 8px', borderRadius: '6px', border: '1px solid #1a1a1f',
                                                                cursor: 'pointer', transition: 'all 0.15s ease'
                                                            }}
                                                        >
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: MONO, fontSize: '10px', marginBottom: '4px' }}>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                    <span style={{ color: '#555560', fontSize: '9px' }}>#{idx + 1}</span>
                                                                    <span style={{ color: col, fontWeight: 600 }}>{pt.displacement_mm?.toFixed(2)} mm</span>
                                                                </div>
                                                                <span style={{ color: '#555560', fontSize: '9px' }}>COH {pt.coherence?.toFixed(2)}</span>
                                                            </div>
                                                            {/* Micro Magnitude Sparkbar */}
                                                            <div style={{ height: '2px', background: '#1a1a1f', borderRadius: '1px', overflow: 'hidden' }}>
                                                                <div style={{ height: '100%', width: `${barWidthPct}%`, background: col, borderRadius: '1px' }} />
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </>
                    )}
                </div>
            )}
        </>
    );
}