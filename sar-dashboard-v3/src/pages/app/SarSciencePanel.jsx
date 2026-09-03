import React, { useState } from 'react';
import { MONO, SANS, C } from './constants';
import { formatBytes, formatElapsed } from './helpers';
import { api } from '../../config/api';

export default function SarSciencePanel({
    dataMode, setDataMode, localFilePath, setLocalFilePath, metadata,
    startDate, setStartDate, endDate, setEndDate,
    handleSearch, isSearching, searchResults, selectedScene, setSelectedScene,
    pipelines, pipeline, setPipeline,
    startJob, getInputFile, runningJobs, gatewayOnline,
    elapsed, jobs, setActiveJobId, setTerminalOpen, setViewingResult,
    cropLat, setCropLat, cropLon, setCropLon, cropPreset, setCropPreset,
    slaveFilePath, setSlaveFilePath,
    gunwFilePath, setGunwFilePath,
    minChangeDb, setMinChangeDb,
    seedThresholdDb, setSeedThresholdDb,
    growthThresholdDb, setGrowthThresholdDb,
    minAreaPixels, setMinAreaPixels,
    downloadProgress, handleAcquireAndProcess,
    drawnAoi, setDrawnAoi, isDrawingAoi, setIsDrawingAoi,
    setFlyToCenter,
}) {
    const accent = C.accent.flood;
    const activeBg = 'rgba(42, 139, 145, 0.08)';

    const [advancedOpen, setAdvancedOpen] = useState(false);

    const inputStyle = {
        width: '100%', padding: '7px 10px', background: C.bg2,
        border: `1px solid ${C.bg3}`, color: C.text, fontFamily: MONO,
        fontSize: '12px', boxSizing: 'border-box', outline: 'none', borderRadius: '2px',
    };

    const presetBtnStyle = (active) => ({
        flex: 1, padding: '6px 4px', background: active ? activeBg : 'transparent',
        border: active ? `1px solid ${accent}` : `1px solid ${C.bg3}`,
        color: active ? accent : C.textDim, fontFamily: MONO, fontSize: '10px',
        cursor: 'pointer', borderRadius: '2px', textAlign: 'center',
    });

    return (
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>

            {/* DATA SOURCE */}
            <div style={{ fontFamily: MONO, fontSize: '10px', color: C.textDim, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '10px' }}>DATA SOURCE</div>
            <div style={{ display: 'flex', gap: '0', marginBottom: '12px' }}>
                {['local','catalog'].map(m => (
                    <button key={m} onClick={() => setDataMode(m)} style={{
                        flex: 1, padding: '8px', background: 'none', cursor: 'pointer',
                        fontFamily: MONO, fontSize: '11px', border: 'none',
                        borderBottom: dataMode === m ? `2px solid ${accent}` : '2px solid transparent',
                        color: dataMode === m ? C.text : C.textDim,
                    }}>
                        {m === 'local' ? 'LOCAL FILE' : 'NASA CATALOG'}
                    </button>
                ))}
            </div>

            {dataMode === 'local' && (<>
                <input
                    type="text" value={localFilePath} onChange={e => setLocalFilePath(e.target.value)}
                    placeholder="/path/to/NISAR_*.h5"
                    style={inputStyle}
                    onFocus={e => e.target.style.borderColor = C.bg4}
                    onBlur={e => e.target.style.borderColor = C.bg3}
                />
                {metadata && (
                    <div style={{ marginTop: '10px' }}>
                        {[
                            ['Mission', metadata.mission],
                            ['Product', `${metadata.product} — ${metadata.productFull}`],
                            ['Level', metadata.level],
                            ['Band', metadata.band],
                            ['Orbit', metadata.direction],
                            ...(metadata.acquisitionDate ? [['Acquired', metadata.acquisitionDate]] : []),
                        ].map(([label, value]) => (
                            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: `1px solid ${C.bg2}`, fontFamily: MONO, fontSize: '11px' }}>
                                <span style={{ color: C.textDim }}>{label}</span>
                                <span style={{ color: label === 'Band' ? C.stable : C.text }}>{value}</span>
                            </div>
                        ))}
                    </div>
                )}
            </>)}

            {dataMode === 'catalog' && (<>
                {/* AOI Bounding Box Selector */}
                <div style={{ marginBottom: '10px', padding: '8px 10px', background: C.bg1, border: `1px solid ${drawnAoi ? accent : C.bg3}`, borderRadius: '2px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <span style={{ fontFamily: MONO, fontSize: '9px', color: C.textDim, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                            SEARCH AOI
                        </span>
                        {drawnAoi ? (
                            <span style={{ fontFamily: MONO, fontSize: '9px', color: accent, fontWeight: 600 }}>CUSTOM BOX</span>
                        ) : (
                            <span style={{ fontFamily: MONO, fontSize: '9px', color: C.textDim }}>VIEWPORT BBOX</span>
                        )}
                    </div>

                    <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                            type="button"
                            onClick={() => setIsDrawingAoi && setIsDrawingAoi(!isDrawingAoi)}
                            style={{
                                flex: 1, padding: '6px', background: isDrawingAoi ? accent : 'transparent',
                                border: `1px solid ${isDrawingAoi ? accent : C.bg3}`,
                                color: isDrawingAoi ? C.bg0 : C.text,
                                fontFamily: MONO, fontSize: '10px', fontWeight: 600, cursor: 'pointer', borderRadius: '2px'
                            }}
                        >
                            {isDrawingAoi ? 'DRAWING (DRAG ON MAP)...' : drawnAoi ? 'REDRAW BOX' : 'DRAW AOI ON MAP'}
                        </button>
                        {drawnAoi && (
                            <button
                                type="button"
                                onClick={() => setDrawnAoi && setDrawnAoi(null)}
                                style={{
                                    padding: '6px 10px', background: 'transparent',
                                    border: `1px solid ${C.bg3}`, color: C.textDim,
                                    fontFamily: MONO, fontSize: '10px', cursor: 'pointer', borderRadius: '2px'
                                }}
                                title="Reset to current map view"
                            >
                                CLEAR
                            </button>
                        )}
                    </div>
                    {drawnAoi && (
                        <div style={{ marginTop: '6px', fontFamily: MONO, fontSize: '9px', color: C.textMid, wordBreak: 'break-all' }}>
                            {drawnAoi.minLon.toFixed(2)}°E, {drawnAoi.minLat.toFixed(2)}°N → {drawnAoi.maxLon.toFixed(2)}°E, {drawnAoi.maxLat.toFixed(2)}°N
                        </div>
                    )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ ...inputStyle, fontSize: '11px' }} />
                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={{ ...inputStyle, fontSize: '11px' }} />
                </div>
                <button onClick={handleSearch} disabled={isSearching} style={{ width: '100%', padding: '8px', background: 'transparent', border: `1px solid ${C.bg3}`, color: C.textMid, fontFamily: MONO, fontSize: '11px', cursor: 'pointer', borderRadius: '2px' }}
                    onMouseEnter={e => { e.target.style.borderColor = C.bg4; e.target.style.color = C.text; }}
                    onMouseLeave={e => { e.target.style.borderColor = C.bg3; e.target.style.color = C.textMid; }}
                >{isSearching ? 'SEARCHING CATALOG...' : 'SEARCH CATALOG'}</button>
                {searchResults.length > 0 && (
                    <div style={{ marginTop: '10px' }}>
                        {searchResults.map(scene => (
                            <div key={scene.id} onClick={() => setSelectedScene(scene)} style={{
                                padding: '8px', borderBottom: `1px solid ${C.bg2}`, cursor: 'pointer',
                                borderLeft: selectedScene?.id === scene.id ? `3px solid ${accent}` : '3px solid transparent',
                                paddingLeft: selectedScene?.id === scene.id ? '13px' : '8px',
                            }}>
                                <div style={{ fontFamily: MONO, fontSize: '10px', color: selectedScene?.id === scene.id ? C.text : C.textMid, wordBreak: 'break-all', fontWeight: selectedScene?.id === scene.id ? 600 : 400 }}>{scene.id}</div>
                                <div style={{ fontFamily: MONO, fontSize: '10px', color: C.textDim, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <span>{scene.date?.split('T')[0]}</span>
                                        {scene.platform && (
                                            <span style={{ fontSize: '8px', padding: '1px 4px', background: C.bg2, borderRadius: '2px', color: accent }}>
                                                {scene.platform.includes('(') ? scene.platform.split('(')[0].trim() : scene.platform}
                                            </span>
                                        )}
                                    </span>
                                    <span style={{ color: C.text, fontWeight: 500 }}>{formatBytes(scene.size_bytes)}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Selected Granule Details & Live Download Progress */}
                {selectedScene && (
                    <div style={{ marginTop: '12px', padding: '10px', background: C.bg1, border: `1px solid ${C.bg3}`, borderRadius: '2px' }}>
                        <div style={{ fontFamily: MONO, fontSize: '9px', color: C.textDim, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '4px' }}>SELECTED GRANULE</div>
                        <div style={{ fontFamily: MONO, fontSize: '10px', color: C.text, wordBreak: 'break-all', marginBottom: '6px' }}>{selectedScene.id}</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: MONO, fontSize: '10px', color: C.textDim }}>
                            <span>SIZE: <strong style={{ color: C.text }}>{formatBytes(selectedScene.size_bytes)}</strong></span>
                            <span>ACQUIRED: <strong style={{ color: C.text }}>{selectedScene.date?.split('T')[0]}</strong></span>
                        </div>

                        {/* Live Download Progress Indicator */}
                        {downloadProgress && downloadProgress.granuleId === selectedScene.id && downloadProgress.status === 'downloading' && (
                            <div style={{ marginTop: '8px', padding: '8px', background: C.bg2, borderRadius: '2px', border: `1px solid ${accent}` }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: MONO, fontSize: '10px', color: accent, marginBottom: '4px' }}>
                                    <span>DOWNLOADING GRANULE...</span>
                                    <span style={{ fontWeight: 600 }}>{downloadProgress.progress}%</span>
                                </div>
                                <div style={{ height: '3px', background: C.bg3, borderRadius: '1px', overflow: 'hidden', marginBottom: '4px' }}>
                                    <div style={{ height: '100%', width: `${downloadProgress.progress}%`, background: accent, transition: 'width 0.2s linear' }} />
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: MONO, fontSize: '9px', color: C.textDim }}>
                                    <span>{formatBytes(downloadProgress.downloaded_bytes || 0)} / {formatBytes(downloadProgress.total_bytes || 0)}</span>
                                    <span>{downloadProgress.speed_mbps || 0} MB/s {downloadProgress.eta_secs ? `(ETA ${downloadProgress.eta_secs}s)` : ''}</span>
                                </div>
                            </div>
                        )}

                        {downloadProgress && downloadProgress.granuleId === selectedScene.id && downloadProgress.status === 'download_complete' && (
                            <div style={{ marginTop: '8px', padding: '6px 8px', background: 'rgba(61, 255, 154, 0.08)', border: '1px solid rgba(61, 255, 154, 0.3)', borderRadius: '2px', fontFamily: MONO, fontSize: '10px', color: C.stable, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span>●</span>
                                <span>CACHED ON LOCAL DISK</span>
                            </div>
                        )}
                    </div>
                )}
            </>)}

            {/* DIVIDER */}
            <div style={{ height: '1px', background: C.bg3, margin: '16px 0' }} />

            {/* PIPELINE */}
            {pipelines.length > 1 && (
                <>
                    <div style={{ fontFamily: MONO, fontSize: '10px', color: C.textDim, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '10px' }}>PIPELINE</div>
                    {pipelines.map(p => (
                        <div key={p.id} onClick={() => setPipeline(p.id)} style={{
                            padding: '8px 12px', cursor: 'pointer',
                            borderLeft: pipeline === p.id ? `3px solid ${accent}` : '3px solid transparent',
                            background: pipeline === p.id ? activeBg : 'transparent',
                            marginBottom: '2px',
                        }}
                            onMouseEnter={e => { if (pipeline !== p.id) e.target.style.background = C.bg2; }}
                            onMouseLeave={e => { if (pipeline !== p.id) e.target.style.background = 'transparent'; }}
                        >
                            <div style={{ fontFamily: MONO, fontSize: '12px', color: pipeline === p.id ? C.text : C.textMid }}>{p.label}</div>
                            <div style={{ fontFamily: SANS, fontSize: '11px', color: C.textDim, marginTop: '2px' }}>{p.desc}</div>
                        </div>
                    ))}
                    <div style={{ height: '1px', background: C.bg3, margin: '16px 0' }} />
                </>
            )}

            {/* ══ CROP CONTROLS (INSAR & FLOOD) ══ */}
            {(pipeline === 'insar' || pipeline === 'flood') && (<>
                <div style={{ fontFamily: MONO, fontSize: '10px', color: accent, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '10px' }}>
                    ▸ CROP REGION
                </div>
                
                {/* Quick Target Presets */}
                <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
                    <button
                        type="button"
                        onClick={() => {
                            setCropLat('18.7883');
                            setCropLon('82.6003');
                            if (setFlyToCenter) setFlyToCenter([18.7883, 82.6003]);
                        }}
                        style={{
                            flex: 1, padding: '5px 4px', fontFamily: MONO, fontSize: '9px',
                            background: (cropLat === '18.7883' && cropLon === '82.6003') ? 'rgba(0, 229, 255, 0.15)' : 'rgba(255,255,255,0.03)',
                            border: `1px solid ${(cropLat === '18.7883' && cropLon === '82.6003') ? accent : 'rgba(255,255,255,0.08)'}`,
                            color: (cropLat === '18.7883' && cropLon === '82.6003') ? accent : C.textMid,
                            cursor: 'pointer', textAlign: 'center', borderRadius: '2px'
                        }}
                    >
                        Kolab Dam
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            setCropLat('18.9306');
                            setCropLon('82.3885');
                            if (setFlyToCenter) setFlyToCenter([18.9306, 82.3885]);
                        }}
                        style={{
                            flex: 1, padding: '5px 4px', fontFamily: MONO, fontSize: '9px',
                            background: (cropLat === '18.9306' && cropLon === '82.3885') ? 'rgba(0, 229, 255, 0.15)' : 'rgba(255,255,255,0.03)',
                            border: `1px solid ${(cropLat === '18.9306' && cropLon === '82.3885') ? accent : 'rgba(255,255,255,0.08)'}`,
                            color: (cropLat === '18.9306' && cropLon === '82.3885') ? accent : C.textMid,
                            cursor: 'pointer', textAlign: 'center', borderRadius: '2px'
                        }}
                    >
                        Kundra Block
                    </button>
                </div>

                {/* Lat / Lon text inputs */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
                    <div>
                        <div style={{ fontFamily: MONO, fontSize: '9px', color: C.textDim, marginBottom: '4px' }}>LATITUDE</div>
                        <input
                            type="text" value={cropLat || ''} onChange={e => setCropLat(e.target.value)}
                            placeholder="18.7883"
                            style={inputStyle}
                        />
                    </div>
                    <div>
                        <div style={{ fontFamily: MONO, fontSize: '9px', color: C.textDim, marginBottom: '4px' }}>LONGITUDE</div>
                        <input
                            type="text" value={cropLon || ''} onChange={e => setCropLon(e.target.value)}
                            placeholder="82.6003"
                            style={inputStyle}
                        />
                    </div>
                </div>

                {/* Crop preset toggles */}
                <div style={{ fontFamily: MONO, fontSize: '9px', color: C.textDim, marginBottom: '6px' }}>CROP WINDOW</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '6px' }}>
                    {['1x1km', '5x5km', '1x2km', '10x10km', '20x20km'].map(p => (
                        <button key={p} onClick={() => setCropPreset(p)} style={presetBtnStyle(cropPreset === p)}>
                            {p.replace('km', ' km').replace('x', ' × ')}
                        </button>
                    ))}
                </div>
                <div style={{ fontFamily: SANS, fontSize: '10px', color: C.textDim, lineHeight: 1.4, marginBottom: '4px' }}>
                    Crop before loading. Larger windows use more RAM.
                </div>
            </>)}

            {/* ══ FLOOD MAPPING CONTROLS ══ */}
            {pipeline === 'flood' && (
                <>
                    <div style={{ height: '1px', background: C.bg3, margin: '14px 0' }} />
                    
                    {/* Baseline reference GCOV input */}
                    <div style={{ marginBottom: '10px' }}>
                        <div style={{ fontFamily: MONO, fontSize: '9px', color: C.textDim, marginBottom: '4px' }}>BASELINE REFERENCE (GCOV H5)</div>
                        <input
                            type="text" value={slaveFilePath || ''} onChange={e => setSlaveFilePath(e.target.value)}
                            placeholder="/path/to/NISAR_baseline_dry.h5"
                            style={inputStyle}
                        />
                    </div>

                    {/* Coherence helper GUNW input (Optional) */}
                    <div style={{ marginBottom: '14px' }}>
                        <div style={{ fontFamily: MONO, fontSize: '9px', color: C.textDim, marginBottom: '4px' }}>COHERENCE FILE (GUNW H5 - OPTIONAL)</div>
                        <input
                            type="text" value={gunwFilePath || ''} onChange={e => setGunwFilePath(e.target.value)}
                            placeholder="/path/to/NISAR_coherence.h5"
                            style={inputStyle}
                        />
                    </div>

                    {/* Collapsible Advanced Settings */}
                    <button
                        onClick={() => setAdvancedOpen(!advancedOpen)}
                        style={{
                            background: 'none', border: 'none', color: accent,
                            fontFamily: MONO, fontSize: '10px', cursor: 'pointer',
                            padding: '4px 0', display: 'flex', alignItems: 'center', gap: '4px',
                            outline: 'none', marginBottom: '10px'
                        }}
                    >
                        {advancedOpen ? '▼ ADVANCED CONFIGURATION' : '▶ ADVANCED CONFIGURATION'}
                    </button>

                    {advancedOpen && (
                        <div style={{ background: C.bg2, padding: '10px', border: `1px solid ${C.bg3}`, borderRadius: '2px', display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '10px' }}>
                            {/* min_change_db */}
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: MONO, fontSize: '9px', color: C.textDim, marginBottom: '2px' }}>
                                    <span>MIN CHANGE THRESHOLD</span>
                                    <span style={{ color: C.text }}>{minChangeDb} dB</span>
                                </div>
                                <input
                                    type="range" min="-10.0" max="-1.0" step="0.5"
                                    value={minChangeDb} onChange={e => setMinChangeDb(parseFloat(e.target.value))}
                                    style={{ width: '100%', accentColor: accent }}
                                />
                            </div>

                            {/* seed_threshold_db */}
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: MONO, fontSize: '9px', color: C.textDim, marginBottom: '2px' }}>
                                    <span>GROWTH SEED THRESHOLD</span>
                                    <span style={{ color: C.text }}>{seedThresholdDb} dB</span>
                                </div>
                                <input
                                    type="range" min="-12.0" max="-3.0" step="0.5"
                                    value={seedThresholdDb} onChange={e => setSeedThresholdDb(parseFloat(e.target.value))}
                                    style={{ width: '100%', accentColor: accent }}
                                />
                            </div>

                            {/* growth_threshold_db */}
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: MONO, fontSize: '9px', color: C.textDim, marginBottom: '2px' }}>
                                    <span>GROWTH LIMIT THRESHOLD</span>
                                    <span style={{ color: C.text }}>{growthThresholdDb} dB</span>
                                </div>
                                <input
                                    type="range" min="-6.0" max="-1.0" step="0.5"
                                    value={growthThresholdDb} onChange={e => setGrowthThresholdDb(parseFloat(e.target.value))}
                                    style={{ width: '100%', accentColor: accent }}
                                />
                            </div>

                            {/* min_area_pixels */}
                            <div>
                                <div style={{ fontFamily: MONO, fontSize: '9px', color: C.textDim, marginBottom: '4px' }}>MIN REGION AREA (PIXELS)</div>
                                <input
                                    type="number" value={minAreaPixels} onChange={e => setMinAreaPixels(parseInt(e.target.value) || 1)}
                                    style={{ ...inputStyle, background: C.bg1 }}
                                />
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* DIVIDER */}
            <div style={{ height: '1px', background: C.bg3, margin: '16px 0' }} />

            {/* EXECUTE */}
            <button onClick={startJob} disabled={!getInputFile() || runningJobs.length > 0 || !gatewayOnline || downloadProgress?.status === 'downloading'} style={{
                width: '100%', padding: '10px', background: accent, color: C.bg0,
                fontFamily: MONO, fontSize: '12px', fontWeight: 600, border: 'none', borderRadius: '2px',
                cursor: (!getInputFile() || runningJobs.length > 0 || !gatewayOnline || downloadProgress?.status === 'downloading') ? 'not-allowed' : 'pointer',
                opacity: (!getInputFile() || runningJobs.length > 0 || !gatewayOnline || downloadProgress?.status === 'downloading') ? 0.3 : 1,
            }}>
                {downloadProgress?.status === 'downloading'
                    ? `DOWNLOADING (${downloadProgress.progress}%)...`
                    : runningJobs.length > 0
                        ? 'PROCESSING...'
                        : dataMode === 'catalog'
                            ? 'DOWNLOAD & PROCESS'
                            : 'START PROCESSING'}
            </button>

            {dataMode === 'catalog' && selectedScene && downloadProgress?.status !== 'downloading' && (
                <button
                    onClick={() => handleAcquireAndProcess && handleAcquireAndProcess(false)}
                    disabled={runningJobs.length > 0 || !gatewayOnline}
                    style={{
                        width: '100%', marginTop: '6px', padding: '6px', background: 'transparent',
                        border: `1px solid ${C.bg3}`, color: C.textDim, fontFamily: MONO,
                        fontSize: '10px', cursor: 'pointer', borderRadius: '2px'
                    }}
                    onMouseEnter={e => { e.target.style.borderColor = C.bg4; e.target.style.color = C.text; }}
                    onMouseLeave={e => { e.target.style.borderColor = C.bg3; e.target.style.color = C.textDim; }}
                >
                    DOWNLOAD TO LOCAL DISK ONLY
                </button>
            )}
            {runningJobs.length > 0 && (
                <div style={{ marginTop: '8px', fontFamily: MONO, fontSize: '10px', color: C.textDim }}>
                    <div>ELAPSED  {formatElapsed(elapsed[runningJobs[0]?.id])}</div>
                    <div>JOB ID   {runningJobs[0]?.id?.slice(0, 8)}</div>
                </div>
            )}

            {/* DIVIDER */}
            {Object.values(jobs).length > 0 && <div style={{ height: '1px', background: C.bg3, margin: '16px 0' }} />}

            {/* COMPLETED JOBS */}
            {Object.values(jobs).length > 0 && (<>
                <div style={{ fontFamily: MONO, fontSize: '10px', color: C.textDim, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '10px' }}>COMPLETED JOBS</div>
                {Object.values(jobs).map(job => (
                    <div key={job.id} onClick={() => { setActiveJobId(job.id); setTerminalOpen(true); }} style={{ padding: '8px', borderBottom: `1px solid ${C.bg2}`, cursor: 'pointer' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontFamily: MONO, fontSize: '11px', color: C.textMid }}>{job.name}</span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontFamily: MONO, fontSize: '10px', color: C.textDim }}>
                                {job.status === 'completed' && <span style={{ color: C.stable }}>●</span>}
                                {job.status === 'running' && <span style={{ color: accent }}>●</span>}
                                {job.status === 'failed' && <span style={{ color: C.critical }}>●</span>}
                                {elapsed[job.id] != null && formatElapsed(elapsed[job.id])}
                            </span>
                        </div>
                        {job.status === 'completed' && (
                            <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                                <button onClick={(e) => { e.stopPropagation(); setViewingResult({ url: api(job.output_path), bounds: job.bounds, insarReport: job.insarReport, ships: job.ships, floodReport: job.floodReport, floodGeoJson: job.floodGeoJson, floodReportPath: job.floodReportPath, floodGeoJsonPath: job.floodGeoJsonPath, pipeline: job.pipeline, elapsed: elapsed[job.id], bbox: job.bbox }); }}
                                    style={{ flex: 1, padding: '4px 8px', background: 'transparent', border: `1px solid ${C.bg3}`, color: C.stable, fontFamily: MONO, fontSize: '10px', cursor: 'pointer', borderRadius: '2px' }}>VIEW</button>
                                <button onClick={(e) => { e.stopPropagation(); window.open(api(job.output_path), '_blank'); }}
                                    style={{ flex: 1, padding: '4px 8px', background: 'transparent', border: `1px solid ${C.bg3}`, color: C.textMid, fontFamily: MONO, fontSize: '10px', cursor: 'pointer', borderRadius: '2px' }}>DL</button>
                            </div>
                        )}
                    </div>
                ))}
            </>)}
        </div>
    );
}
