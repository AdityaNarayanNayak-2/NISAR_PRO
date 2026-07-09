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

    // ── STATUS ──
    let statusText = 'NO DATA';
    let statusColor = '#555555';
    if (s) {
        if (s.critical_count > 0) { statusText = 'CRITICAL'; statusColor = '#C0392B'; }
        else if (s.alert_count > 0) { statusText = 'ALERT'; statusColor = '#D4822A'; }
        else if (s.caution_count > 0) { statusText = 'CAUTION'; statusColor = '#E6A817'; }
        else { statusText = 'NORMAL'; statusColor = '#4CAF50'; }
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
            {/* ════════════════════════════════════════════════════
                ZONE 1: LEFT PANEL (240px)
                ════════════════════════════════════════════════════ */}
            <div style={{
                position: 'absolute', top: '42px', left: 0, bottom: 0,
                width: '260px', background: C.bg0,
                borderRight: `1px solid ${C.bg3}`, zIndex: 100,
                overflowY: 'auto', boxSizing: 'border-box',
            }}>
                {/* ═══════ ASSET SECTION (REDESIGNED) ═══════ */}
                <div style={{
                    background: 'linear-gradient(180deg, #0c0c0e 0%, #070708 100%)',
                    borderBottom: '1px solid #1a1a1f', padding: '16px', position: 'relative',
                }}>
                    {/* Top gold accent line */}
                    <div style={{
                        position: 'absolute', top: 0, left: 0, right: 0, height: '2px',
                        background: 'linear-gradient(90deg, #c8a96e, transparent 60%)',
                    }} />

                    {/* Section Header */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                        <div style={{
                            width: '24px', height: '24px', borderRadius: '6px', background: '#111114',
                            border: '1px solid #1a1a1f', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: '#c8a96e', fontSize: '11px', fontFamily: MONO,
                        }}>◎</div>
                        <div style={{
                            fontFamily: MONO, fontSize: '9px', fontWeight: 600,
                            letterSpacing: '0.2em', textTransform: 'uppercase', color: '#555560',
                        }}>ASSET</div>
                        <div style={{ flex: 1, height: '1px', background: 'linear-gradient(90deg, #25252b, transparent)' }} />
                    </div>

                    {/* Search Input */}
                    <div style={{ position: 'relative', marginBottom: '12px' }}>
                        <span style={{
                            position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)',
                            color: '#3a3a44', fontSize: '12px', fontFamily: MONO, pointerEvents: 'none',
                        }}>⌕</span>
                        <input
                            type="text"
                            value={assetSearch}
                            onChange={(e) => { setAssetSearch(e.target.value); searchAssets(e.target.value); }}
                            placeholder="Search dam or bridge..."
                            style={{
                                width: '100%', padding: '10px 12px 10px 36px', background: '#0e0e11',
                                border: '1px solid #1a1a1f', borderRadius: '8px', color: '#e8e8ec',
                                fontFamily: MONO, fontSize: '11px', outline: 'none', boxSizing: 'border-box',
                                transition: 'all 0.2s ease',
                            }}
                            onFocus={(e) => { e.target.style.borderColor = '#c8a96e'; e.target.style.boxShadow = '0 0 0 3px rgba(200,169,110,0.15)'; }}
                            onBlur={(e) => {
                                e.target.style.borderColor = '#1a1a1f'; e.target.style.boxShadow = 'none';
                                setTimeout(() => setAssetSearchOpen(false), 200);
                            }}
                        />
                        {assetSearchOpen && assetResults.length > 0 && (
                            <div style={{
                                position: 'absolute', top: '100%', left: 0, right: 0, background: '#0c0c0e',
                                border: '1px solid #25252b', borderTop: 'none', borderRadius: '0 0 8px 8px',
                                zIndex: 200, maxHeight: '200px', overflowY: 'auto', marginTop: '4px',
                                boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
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
                                            padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #1a1a1f',
                                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                            transition: 'background 0.15s ease',
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.background = '#18181c'}
                                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                    >
                                        <span style={{ fontFamily: MONO, fontSize: '11px', color: '#e8e8ec' }}>{asset.name}</span>
                                        <span style={{ fontFamily: MONO, fontSize: '10px', color: '#555560' }}>{asset.state || asset.country}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Asset Info Card */}
                    {assetLat && assetLon && assetName && (
                        <div style={{
                            background: '#111114', border: '1px solid #1a1a1f', borderRadius: '10px',
                            padding: '14px', position: 'relative', overflow: 'hidden',
                        }}>
                            {/* Decorative gold glow */}
                            <div style={{
                                position: 'absolute', top: 0, right: 0, width: '60px', height: '60px',
                                background: 'radial-gradient(circle, rgba(200,169,110,0.08), transparent 70%)',
                                pointerEvents: 'none',
                            }} />

                            <div style={{
                                fontFamily: MONO, fontSize: '14px', fontWeight: 600, color: '#e8e8ec',
                                marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px',
                            }}>
                                <span style={{
                                    width: '6px', height: '6px', borderRadius: '50%', background: '#4ade80',
                                    boxShadow: '0 0 6px rgba(74,222,128,0.12)', flexShrink: 0,
                                }} />
                                {assetName}
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                                <div>
                                    <div style={{ fontFamily: MONO, fontSize: '8px', color: '#3a3a44', letterSpacing: '0.1em', textTransform: 'uppercase' }}>TYPE</div>
                                    <div style={{ fontFamily: MONO, fontSize: '11px', color: '#c8a96e', fontWeight: 500 }}>{assetType}</div>
                                </div>
                                <div>
                                    <div style={{ fontFamily: MONO, fontSize: '8px', color: '#3a3a44', letterSpacing: '0.1em', textTransform: 'uppercase' }}>STATE</div>
                                    <div style={{ fontFamily: MONO, fontSize: '11px', color: '#8a8a95' }}>{assetState || '—'}</div>
                                </div>
                            </div>

                            <div style={{
                                fontFamily: MONO, fontSize: '9px', color: '#555560', display: 'flex',
                                alignItems: 'center', gap: '6px', paddingTop: '8px',
                                borderTop: '1px solid #1a1a1f',
                            }}>
                                <span> Location:</span>
                                <span>{assetLat}°N  {assetLon}°E</span>
                            </div>

                            {/* Status Badge */}
                            <div style={{
                                display: 'inline-flex', alignItems: 'center', gap: '6px',
                                padding: '4px 10px', borderRadius: '20px', fontFamily: MONO,
                                fontSize: '9px', fontWeight: 600, letterSpacing: '0.08em', marginTop: '10px',
                                ...(statusText === 'CRITICAL' ? {
                                    background: 'rgba(239,68,68,0.1)', color: '#ef4444',
                                    border: '1px solid rgba(239,68,68,0.2)',
                                } : statusText === 'ALERT' ? {
                                    background: 'rgba(245,158,11,0.1)', color: '#f59e0b',
                                    border: '1px solid rgba(245,158,11,0.2)',
                                } : statusText === 'CAUTION' ? {
                                    background: 'rgba(230,168,23,0.1)', color: '#e6a817',
                                    border: '1px solid rgba(230,168,23,0.2)',
                                } : {
                                    background: 'rgba(74,222,128,0.1)', color: '#4ade80',
                                    border: '1px solid rgba(74,222,128,0.2)',
                                }),
                            }}>
                                <span style={{
                                    width: '5px', height: '5px', borderRadius: '50%',
                                    ...(statusText === 'CRITICAL' ? {
                                        background: '#ef4444', boxShadow: '0 0 6px rgba(239,68,68,0.15)',
                                        animation: 'pulse-red 2s infinite',
                                    } : statusText === 'ALERT' ? {
                                        background: '#f59e0b', boxShadow: '0 0 6px rgba(245,158,11,0.12)',
                                    } : statusText === 'CAUTION' ? {
                                        background: '#e6a817', boxShadow: '0 0 6px rgba(230,168,23,0.12)',
                                    } : {
                                        background: '#4ade80', boxShadow: '0 0 6px rgba(74,222,128,0.12)',
                                    }),
                                }} />
                                {statusText}
                            </div>
                        </div>
                    )}
                </div>

                {/* ── SYSTEM STATUS OVERVIEW ── */}
                {assetLat && assetLon && assetName && (
                    <div style={{ padding: '16px', borderBottom: '1px solid #1a1a1f' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                            <div style={{
                                width: '24px', height: '24px', borderRadius: '6px', background: '#111114',
                                border: '1px solid #1a1a1f', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: statusColor, fontSize: '11px', fontFamily: MONO,
                            }}>⚡</div>
                            <div style={{
                                fontFamily: MONO, fontSize: '9px', fontWeight: 600,
                                letterSpacing: '0.2em', textTransform: 'uppercase', color: '#555560',
                            }}>SYSTEM STATUS</div>
                            <div style={{ flex: 1, height: '1px', background: 'linear-gradient(90deg, #25252b, transparent)' }} />
                        </div>

                        <div style={{
                            background: 'linear-gradient(135deg, #111114 0%, rgba(255,255,255,0.01) 100%)',
                            border: '1px solid #1a1a1f', borderRadius: '10px', padding: '14px',
                            position: 'relative', overflow: 'hidden',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                {/* Pulse Indicator */}
                                <div style={{ position: 'relative', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <div style={{
                                        position: 'absolute', width: '24px', height: '24px', borderRadius: '50%',
                                        background: statusColor, opacity: 0.15,
                                        animation: statusText === 'CRITICAL' ? 'pulse-red 1s infinite' : 'pulse-red 2s infinite'
                                    }} />
                                    <div style={{
                                        width: '10px', height: '10px', borderRadius: '50%',
                                        background: statusColor, boxShadow: `0 0 10px ${statusColor}, 0 0 20px ${statusColor}`
                                    }} />
                                </div>

                                <div style={{ minWidth: 0, flex: 1 }}>
                                    <div style={{ fontFamily: MONO, fontSize: '7px', color: '#555560', letterSpacing: '0.08em', textTransform: 'uppercase' }}>INTEGRITY STATE</div>
                                    <div style={{ fontFamily: MONO, fontSize: '13px', fontWeight: 700, color: statusColor, letterSpacing: '0.05em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {statusText}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}


                {/* ═══════ ENVIRONMENTAL CONTEXT (REDESIGNED) ═══════ */}
                <div style={{ padding: '16px', borderBottom: '1px solid #1a1a1f' }}>

                    {/* Section Header */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                        <div style={{
                            width: '24px', height: '24px', borderRadius: '6px', background: '#111114',
                            border: '1px solid #1a1a1f', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: '#c8a96e', fontSize: '11px', fontFamily: MONO,
                        }}>🌡</div>
                        <div style={{
                            fontFamily: MONO, fontSize: '9px', fontWeight: 600,
                            letterSpacing: '0.2em', textTransform: 'uppercase', color: '#555560',
                        }}>ENVIRONMENTAL CONTEXT</div>
                        <div style={{ flex: 1, height: '1px', background: 'linear-gradient(90deg, #25252b, transparent)' }} />
                    </div>

                    {/* Reservoir Card */}
                    {envContext?.reservoir && envContext.reservoir !== 'UNAVAILABLE' && (
                        <div style={{
                            background: 'linear-gradient(135deg, #111114 0%, rgba(200,169,110,0.03) 100%)',
                            border: '1px solid #1a1a1f', borderRadius: '10px', padding: '14px',
                            marginBottom: '14px', position: 'relative', overflow: 'hidden',
                        }}>
                            {/* Gold accent bar on left */}
                            <div style={{
                                position: 'absolute', top: 0, left: 0, width: '3px', height: '100%',
                                background: 'linear-gradient(180deg, #c8a96e, transparent)',
                            }} />

                            <div style={{
                                fontFamily: MONO, fontSize: '10px', color: '#c8a96e', fontWeight: 600,
                                letterSpacing: '0.08em', marginBottom: '10px', paddingLeft: '8px',
                            }}>{envContext.reservoir.toUpperCase()}</div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px', paddingLeft: '8px' }}>
                                <div>
                                    <div style={{ fontFamily: MONO, fontSize: '7px', color: '#3a3a44', letterSpacing: '0.08em', textTransform: 'uppercase' }}>CURRENT LEVEL</div>
                                    <div style={{ fontFamily: MONO, fontSize: '12px', color: '#e8e8ec', fontWeight: 600 }}>
                                        {envContext.current_level_m != null ? `${envContext.current_level_m.toFixed(2)} m` : '—'}
                                    </div>
                                </div>
                                <div>
                                    <div style={{ fontFamily: MONO, fontSize: '7px', color: '#3a3a44', letterSpacing: '0.08em', textTransform: 'uppercase' }}>USABLE STORAGE</div>
                                    <div style={{
                                        fontFamily: MONO, fontSize: '12px', fontWeight: 600,
                                        color: envContext.storage_pct > 90 ? '#ef4444' : '#4ade80',
                                    }}>
                                        {envContext.storage_pct != null ? `${envContext.storage_pct.toFixed(2)}%` : '—'}
                                    </div>
                                </div>
                                <div>
                                    <div style={{ fontFamily: MONO, fontSize: '7px', color: '#3a3a44', letterSpacing: '0.08em', textTransform: 'uppercase' }}>FRL (FULL LIMIT)</div>
                                    <div style={{ fontFamily: MONO, fontSize: '10px', color: '#888888' }}>
                                        {envContext.full_reservoir_level_m != null ? `${envContext.full_reservoir_level_m.toFixed(2)} m` : '—'}
                                    </div>
                                </div>
                                <div>
                                    <div style={{ fontFamily: MONO, fontSize: '7px', color: '#3a3a44', letterSpacing: '0.08em', textTransform: 'uppercase' }}>MDDL (MIN LIMIT)</div>
                                    <div style={{ fontFamily: MONO, fontSize: '10px', color: '#888888' }}>
                                        {envContext.mddl_level_m != null ? `${envContext.mddl_level_m.toFixed(2)} m` : '—'}
                                    </div>
                                </div>
                            </div>

                            <div style={{
                                display: 'flex', justifyContent: 'space-between', fontFamily: MONO,
                                fontSize: '7px', color: '#3a3a44', borderTop: '1px solid #1a1a1f',
                                paddingTop: '8px', paddingLeft: '8px', letterSpacing: '0.05em',
                            }}>
                                <span>SOURCE: {envContext.source?.includes("OHPC") ? "OHPC" : "—"}</span>
                                <span>UPDATED: TODAY</span>
                            </div>
                        </div>
                    )}

                    {/* Environmental Data Rows — ALIVE */}
                    {envRows.map((r, i) => {
                        // Determine colors based on status
                        const isOff = r.value === '—' || r.status === 'off';
                        const isWarn = r.status === 'warn';
                        const isData = r.status === 'data';
                        const isOk = r.status === 'ok';
                        const isAccent = r.status === 'accent';

                        const dotColor = isOff ? '#3a3a44'
                            : isWarn ? '#f59e0b'
                                : isData ? '#60a5fa'
                                    : isOk ? '#4ade80'
                                        : '#c8a96e';

                        const glowColor = isOff ? 'transparent'
                            : isWarn ? 'rgba(245,158,11,0.2)'
                                : isData ? 'rgba(96,165,250,0.2)'
                                    : isOk ? 'rgba(74,222,128,0.2)'
                                        : 'rgba(200,169,110,0.15)';

                        const valueColor = isOff ? '#3a3a44'
                            : isWarn ? '#f59e0b'
                                : isData ? '#60a5fa'
                                    : isOk ? '#4ade80'
                                        : '#c8a96e';

                        const barFill = isOff ? 0
                            : isWarn ? 75
                                : isData ? 60
                                    : isOk ? 100
                                        : 50;

                        return (
                            <div key={r.label} style={{
                                padding: '10px 12px',
                                marginBottom: i < envRows.length - 1 ? '6px' : '0',
                                borderRadius: '8px',
                                background: isOff ? 'transparent' : 'rgba(255,255,255,0.015)',
                                border: `1px solid ${isOff ? '#1a1a1f' : 'rgba(255,255,255,0.04)'}`,
                                transition: 'all 0.2s ease',
                            }}
                                onMouseEnter={(e) => { if (!isOff) { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; } }}
                                onMouseLeave={(e) => { e.currentTarget.style.background = isOff ? 'transparent' : 'rgba(255,255,255,0.015)'; e.currentTarget.style.borderColor = isOff ? '#1a1a1f' : 'rgba(255,255,255,0.04)'; }}>

                                {/* Top row: dot + label + value */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                                    {/* Animated status dot */}
                                    <div style={{
                                        width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
                                        background: dotColor,
                                        boxShadow: `0 0 8px ${glowColor}, 0 0 16px ${glowColor}`,
                                        ...(isWarn ? { animation: 'pulse-red 2s infinite' } : {}),
                                    }} />

                                    {/* Label */}
                                    <span style={{
                                        fontFamily: MONO, fontSize: '9px', color: isOff ? '#3a3a44' : '#555560',
                                        width: '70px', flexShrink: 0, letterSpacing: '0.08em', fontWeight: 500
                                    }}>{r.label}</span>

                                    {/* Value — big and colored */}
                                    <span style={{
                                        fontFamily: MONO, fontSize: '11px', fontWeight: 600,
                                        flex: 1, textAlign: 'right', color: valueColor,
                                        lineHeight: 1.4,
                                    }}>{r.value}</span>
                                </div>

                                {/* Mini progress bar — shows "health" of this parameter */}
                                {!isOff && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <div style={{ flex: 1, height: '3px', background: '#1a1a1f', borderRadius: '2px', overflow: 'hidden' }}>
                                            <div style={{
                                                height: '100%',
                                                width: `${barFill}%`,
                                                background: `linear-gradient(90deg, ${dotColor}80, ${dotColor})`,
                                                borderRadius: '2px',
                                                transition: 'width 0.8s ease',
                                            }} />
                                        </div>
                                        <span style={{
                                            fontFamily: MONO, fontSize: '7px', color: '#3a3a44',
                                            letterSpacing: '0.05em', flexShrink: 0
                                        }}>
                                            {isWarn ? 'ELEVATED' : isData ? 'ACTIVE' : isOk ? 'NORMAL' : 'MONITORING'}
                                        </span>
                                    </div>
                                )}
                            </div>
                        );
                    })}


                    {/* Footer */}
                    <div style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        fontFamily: MONO, fontSize: '8px', color: '#3a3a44',
                        paddingTop: '10px', marginTop: '8px', borderTop: '1px solid #1a1a1f', letterSpacing: '0.03em',
                    }}>
                        <span>Source: {envContext?.source || 'Pending'}</span>
                        {contextFetchedAt && <span>{contextFetchedAt.toISOString().slice(0, 16).replace('T', ' ')}</span>}
                    </div>
                </div>

                {/* ═══════ FETCH BUTTON (REDESIGNED) ═══════ */}
                {assetLat && assetLon && !envContext && (
                    <div style={{ padding: '0 16px 16px' }}>
                        <button
                            onClick={fetchContext}
                            disabled={fetchingContext}
                            style={{
                                width: '100%', padding: '10px', background: 'transparent',
                                border: '1px solid #25252b', borderRadius: '8px', color: '#555560',
                                fontFamily: MONO, fontSize: '10px', letterSpacing: '0.1em',
                                cursor: fetchingContext ? 'not-allowed' : 'pointer',
                                transition: 'all 0.25s ease', position: 'relative', overflow: 'hidden',
                                opacity: fetchingContext ? 0.5 : 1,
                            }}
                            onMouseEnter={(e) => { if (!fetchingContext) { e.target.style.borderColor = '#c8a96e'; e.target.style.color = '#c8a96e'; } }}
                            onMouseLeave={(e) => { e.target.style.borderColor = '#25252b'; e.target.style.color = '#555560'; }}
                        >
                            {fetchingContext ? 'FETCHING...' : 'FETCH CONTEXT'}
                        </button>
                    </div>
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

                            {s && (
                                <>
                                    <div style={{ fontFamily: MONO, fontSize: '10px', color: '#555555', letterSpacing: '0.1em', marginBottom: '12px' }}>STRUCTURAL ANALYSIS</div>

                                    {/* HEALTH MATRIX */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px', background: '#2A2A2A', border: '1px solid #2A2A2A', marginBottom: '16px' }}>
                                        {[
                                            { label: 'STABLE', value: s.stable_count, color: C.stable },
                                            { label: 'CAUTION', value: s.caution_count, color: C.caution },
                                            { label: 'ALERT', value: s.alert_count, color: C.alert },
                                            { label: 'CRITICAL', value: s.critical_count, color: C.critical, highlight: s.critical_count > 0 },
                                        ].map(cell => (
                                            <div key={cell.label} style={{ background: cell.highlight ? C.bg1 : '#111111', padding: '8px', textAlign: 'center', border: cell.highlight ? `1px solid ${C.critical}` : 'none' }}>
                                                <div style={{ fontFamily: MONO, fontSize: '9px', color: '#555555', marginBottom: '4px' }}>{cell.label}</div>
                                                <div style={{ fontFamily: MONO, fontSize: '22px', fontWeight: 600, color: cell.color }}>{cell.value}</div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Divider */}
                                    <div style={{ height: '1px', background: '#2A2A2A', margin: '12px 0' }} />

                                    {/* TOP 10 SCATTERERS */}
                                    {topScatterers.length > 0 && (
                                        <div style={{ marginBottom: '16px' }}>
                                            <div style={{ fontFamily: MONO, fontSize: '10px', color: '#555555', display: 'flex', paddingBottom: '4px', borderBottom: '1px solid #1A1A1A' }}>
                                                <div style={{ width: '20px' }}>#</div>
                                                <div style={{ flex: 1 }}>DISP (mm)</div>
                                                <div style={{ width: '40px' }}>COH</div>
                                                <div style={{ width: '60px' }}>SEV</div>
                                            </div>
                                            {topScatterers.map((pt, idx) => (
                                                <div
                                                    key={idx}
                                                    onClick={() => setSelectedPoint(pt)}
                                                    onMouseEnter={e => e.currentTarget.style.background = '#1A1A1A'}
                                                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                                    style={{ fontFamily: MONO, fontSize: '10px', display: 'flex', padding: '4px 0', borderBottom: '1px solid #1A1A1A', cursor: 'pointer' }}
                                                >
                                                    <div style={{ width: '20px', color: '#888888' }}>{idx + 1}</div>
                                                    <div style={{ flex: 1, color: sevColor(pt.severity) }}>{pt.displacement_mm?.toFixed(2)}</div>
                                                    <div style={{ width: '40px', color: C.text }}>{pt.coherence?.toFixed(2)}</div>
                                                    <div style={{ width: '60px', color: sevColor(pt.severity) }}>{pt.severity}</div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Divider */}
                                    <div style={{ height: '1px', background: '#2A2A2A', margin: '12px 0' }} />
                                </>
                            )}

                            {/* ACQUISITION METADATA */}
                            {localFilePath && (
                                <div>
                                    <div style={{ fontFamily: MONO, fontSize: '9px', color: '#555555', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '10px' }}>ACQUISITION METADATA</div>
                                    {acquisitionRows.map(({ label, value }) => (
                                        <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #161616' }}>
                                            <span style={{ fontFamily: MONO, fontSize: '11px', color: '#555555' }}>{label}</span>
                                            <span style={{ fontFamily: MONO, fontSize: '11px', color: '#F0F0F0', textAlign: 'right' }}>{value || '—'}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}
        </>
    );
}