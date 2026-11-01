import React, { useState } from 'react';
import { MONO, SANS, C } from '../constants';
import { formatBytes, formatElapsed } from '../helpers';
import { useGatewayStore } from '../stores/useGatewayStore';
import { useJobStore } from '../stores/useJobStore';
import { useMapStore } from '../stores/useMapStore';

export default function FloodConfigPanel({
    dataMode, setDataMode, localFilePath, setLocalFilePath, metadata,
    startDate, setStartDate, endDate, setEndDate,
    catalogTrack, setCatalogTrack, catalogFrame, setCatalogFrame,
    onUploadFile,
    handleSearch, isSearching, searchResults, selectedScene, setSelectedScene,
    startJob, getInputFile, runningJobs,
    cropLat, setCropLat, cropLon, setCropLon, cropPreset, setCropPreset,
    slaveFilePath, setSlaveFilePath,
    gunwFilePath, setGunwFilePath,
    minChangeDb, setMinChangeDb,
    seedThresholdDb, setSeedThresholdDb,
    growthThresholdDb, setGrowthThresholdDb,
    minAreaPixels, setMinAreaPixels,
    radarBand, setRadarBand,
    permanentWaterThreshold, setPermanentWaterThreshold,
    swathEdgeErosion, setSwathEdgeErosion,
    recededWaterThreshold, setRecededWaterThreshold,
    speckleFilter, setSpeckleFilter,
    multilookFactor, setMultilookFactor,
    polarization, setPolarization,
    downloadProgress, handleAcquireAndProcess,
    onCancel,
}) {
    const accent = C.accent.flood;
    const activeBg = 'rgba(42, 139, 145, 0.08)';

    const [advancedOpen, setAdvancedOpen] = useState(false);
    const bandDefaults = radarBand === 's' ? { permanent: -12.5, seed: -4.8, growth: -2.2, min: -2.7 } : { permanent: -13.0, seed: -5.0, growth: -2.5, min: -3.0 };
    const resetCalibratedDefaults = () => {
        setPermanentWaterThreshold(bandDefaults.permanent);
        setSeedThresholdDb(bandDefaults.seed);
        setGrowthThresholdDb(bandDefaults.growth);
        setMinChangeDb(bandDefaults.min);
        setSwathEdgeErosion(3);
        setRecededWaterThreshold(3.0);
        setSpeckleFilter('median-3');
        setMultilookFactor(8);
        setPolarization('HHHH');
    };

    // Stores
    const gatewayOnline = useGatewayStore(state => state.gatewayOnline);
    const elapsed = useJobStore(state => state.elapsed);

    const drawnAoi = useMapStore(state => state.drawnAoi);
    const setDrawnAoi = useMapStore(state => state.setDrawnAoi);
    const isDrawingAoi = useMapStore(state => state.isDrawingAoi);
    const setIsDrawingAoi = useMapStore(state => state.setIsDrawingAoi);
    const setFlyToCenter = useMapStore(state => state.setFlyToCenter);

    const inputStyle = {
        width: '100%', padding: '7px 10px', background: C.bg2,
        border: `1px solid ${C.bg3}`, color: C.text, fontFamily: MONO,
        fontSize: '12px', boxSizing: 'border-box', outline: 'none', borderRadius: '2px',
    };

    const chooseLocalFile = (setPath) => {
        const picker = document.createElement('input');
        picker.type = 'file';
        picker.accept = '.h5,.hdf5,.nc,.tif,.tiff';
        picker.onchange = () => onUploadFile?.(picker.files?.[0], setPath);
        picker.click();
    };

    const sanitizePath = (val) => {
        if (!val) return '';
        const trimmed = val.trim();
        if (trimmed.startsWith('home/') || trimmed.startsWith('tmp/') || trimmed.startsWith('var/') || trimmed.startsWith('usr/') || trimmed.startsWith('opt/')) {
            return '/' + trimmed;
        }
        return trimmed;
    };

    const fileField = (label, value, setPath, placeholder, optional = false) => (
        <label className={optional ? 'flood-input-optional' : undefined}>
            <span>{label}</span>
            <div className="local-file-field">
                <input type="text" value={value || ''} onChange={e => setPath(sanitizePath(e.target.value))} placeholder={placeholder} style={inputStyle} />
                <button type="button" onClick={() => chooseLocalFile(setPath)} aria-label={`Choose ${label.toLowerCase()} file`}>Choose file</button>
            </div>
        </label>
    );

    const presetBtnStyle = (active) => ({
        flex: 1, padding: '6px 4px', background: active ? activeBg : 'transparent',
        border: active ? `1px solid ${accent}` : `1px solid ${C.bg3}`,
        color: active ? accent : C.textDim, fontFamily: MONO, fontSize: '10px',
        cursor: 'pointer', borderRadius: '2px', textAlign: 'center',
    });

    return (
        <div className="scientist-inspector scientist-inspector-config" style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>

            <div className="scientist-config-intro">
                <div>
                    <div className="scientist-config-kicker">FLOOD ANALYSIS</div>
                    <h2>Configure analysis</h2>
                    <p>Adjust calibrated radar parameters, inspect the expected effect, then run the Rust pipeline explicitly.</p>
                </div>
                <div className={`scientist-engine-state ${gatewayOnline ? 'is-ready' : 'is-offline'}`}><span />{gatewayOnline ? 'Gateway ready' : 'Gateway offline'}</div>
            </div>

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
                    style={{ ...inputStyle, display: 'none' }}
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

            <section className="flood-input-card" aria-labelledby="acquisition-pair-title">
                <div className="flood-input-card-heading"><div><span className="flood-input-step">01</span><h3 id="acquisition-pair-title">Acquisition pair</h3></div><span className="flood-input-card-note">Active + baseline</span></div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', marginBottom: '12px' }}>
                    <button
                        type="button"
                        onClick={() => {
                            setLocalFilePath('/home/aditya/Desktop/nisar_data/NISAR_L2_PR_GCOV_030_098_A_014_4005_DHDH_A_20260912T233810_20260912T233845_P05023_N_F_J_001.h5');
                            setSlaveFilePath('/home/aditya/Desktop/nisar_data/NISAR_L2_PR_GCOV_029_098_A_014_4005_DHDH_A_20260831T233810_20260831T233845_P05023_N_F_J_001.h5');
                            setRadarBand('l');
                            setCropPreset('full');
                        }}
                        style={{ padding: '6px 4px', background: C.bg2, border: `1px solid ${C.bg3}`, borderRadius: '4px', color: C.text, fontFamily: SANS, fontSize: '10px', cursor: 'pointer', textAlign: 'center' }}
                        title="Load Bihar L-Band Master Stack (Sep 12 Active vs Aug 31 Baseline)"
                    >
                        <strong>Bihar L-Band</strong>
                        <span style={{ display: 'block', fontSize: '9px', color: C.textDim }}>Aug 31 vs Sep 12</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            setLocalFilePath('/home/aditya/Desktop/nisar_data/NISAR_S2_UR_GCOV_030_098_A_014_3700_DHNA_A_20260912T233809_20260912T233846_P00500_N_F_I_001.h5');
                            setSlaveFilePath('/home/aditya/Desktop/nisar_data/NISAR_S2_UR_GCOV_029_098_A_014_3700_DHNA_A_20260831T233810_20260831T233846_P00500_M_F_I_001.h5');
                            setRadarBand('s');
                            setCropPreset('full');
                        }}
                        style={{ padding: '6px 4px', background: C.bg2, border: `1px solid ${C.bg3}`, borderRadius: '4px', color: C.text, fontFamily: SANS, fontSize: '10px', cursor: 'pointer', textAlign: 'center' }}
                        title="Load ISRO S-Band Master Stack (Sep 12 Active vs Aug 31 Baseline)"
                    >
                        <strong>ISRO S-Band</strong>
                        <span style={{ display: 'block', fontSize: '9px', color: C.textDim }}>Aug 31 vs Sep 12</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            setLocalFilePath('/home/aditya/Desktop/nisar_data/NISAR_L2_PR_GCOV_033_098_A_014_4005_DHDH_A_20261018T233811_20261018T233845_P05023_N_F_J_001.h5');
                            setSlaveFilePath('/home/aditya/Desktop/nisar_data/NISAR_L2_PR_GCOV_030_098_A_014_4005_DHDH_A_20260912T233810_20260912T233845_P05023_N_F_J_001.h5');
                            setRadarBand('l');
                            setCropPreset('full');
                        }}
                        style={{ padding: '6px 4px', background: C.bg2, border: `1px solid ${C.bg3}`, borderRadius: '4px', color: C.text, fontFamily: SANS, fontSize: '10px', cursor: 'pointer', textAlign: 'center' }}
                        title="Load Bihar Recession Stack (Oct 18 Active vs Sep 12 Baseline)"
                    >
                        <strong>Bihar Recession</strong>
                        <span style={{ display: 'block', fontSize: '9px', color: C.textDim }}>Sep 12 vs Oct 18</span>
                    </button>
                </div>
                {fileField('Active observation', localFilePath, setLocalFilePath, 'Choose active GCOV .h5')}
                {fileField('Baseline reference', slaveFilePath, setSlaveFilePath, 'Choose baseline GCOV .h5')}
                {fileField('Optional coherence helper', gunwFilePath, setGunwFilePath, 'Choose GUNW .h5 (optional)', true)}
            </section>

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
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                    <input type="text" inputMode="numeric" value={catalogTrack} onChange={e => setCatalogTrack(e.target.value.replace(/[^0-9,-]/g, ''))} placeholder="Track / orbit (optional)" aria-label="ASF relative orbit or NISAR track" style={{ ...inputStyle, fontSize: '11px' }} />
                    <input type="text" inputMode="numeric" value={catalogFrame} onChange={e => setCatalogFrame(e.target.value.replace(/[^0-9,-]/g, ''))} placeholder="Frame (optional)" aria-label="ASF frame" style={{ ...inputStyle, fontSize: '11px' }} />
                </div>
                <div style={{ fontFamily: SANS, fontSize: '10px', color: C.textDim, marginBottom: '8px' }}>For the Bihar reference stack: track <strong style={{ color: C.text }}>98</strong>, frame <strong style={{ color: C.text }}>14</strong>.</div>
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

            {/* SCIENTIST PHYSICS WORKBENCH */}
            <div className="flood-processing-controls" style={{ marginTop: '16px', padding: '12px', background: 'rgba(15,150,156,.05)', border: `1px solid ${C.accent.flood}55`, borderRadius: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                    <div><div style={{ fontFamily: SANS, fontSize: '13px', color: C.text, fontWeight: 600 }}>Processing controls</div><div style={{ fontFamily: SANS, fontSize: '10px', color: C.textDim, marginTop: '3px' }}>Calibrated parameters sent with the next run.</div></div>
                    <button type="button" onClick={resetCalibratedDefaults} style={{ border: `1px solid ${C.bg3}`, background: 'transparent', color: C.textDim, padding: '6px 8px', borderRadius: '999px', fontFamily: SANS, fontSize: '10px', cursor: 'pointer' }}>Reset defaults</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '5px', marginBottom: '12px' }}>
                    {[['l','L-band','1.24 GHz'],['s','S-band','3.20 GHz'],['fusion','L+S','paired report']].map(([value, label, detail]) => <button key={value} type="button" disabled={value === 'fusion'} onClick={() => setRadarBand(value)} title={value === 'fusion' ? 'Fusion requires a dual-granule gateway run and is not enabled by this request contract yet.' : detail} style={{ padding: '8px 4px', borderRadius: '7px', border: `1px solid ${radarBand === value ? accent : C.bg3}`, background: radarBand === value ? activeBg : 'transparent', color: value === 'fusion' ? C.textDim : radarBand === value ? accent : C.textMid, opacity: value === 'fusion' ? .55 : 1, cursor: value === 'fusion' ? 'not-allowed' : 'pointer', fontFamily: SANS, fontSize: '10px' }}><strong style={{ display: 'block' }}>{label}</strong><span style={{ fontSize: '9px' }}>{detail}</span></button>)}
                </div>
                <label style={{ display: 'block', fontFamily: SANS, fontSize: '10px', color: C.textMid, marginBottom: '10px' }}>Permanent water floor <strong style={{ color: C.text }}>{permanentWaterThreshold.toFixed(1)} dB</strong><input type="range" min="-18" max="-9" step="0.1" value={permanentWaterThreshold} onChange={e => setPermanentWaterThreshold(parseFloat(e.target.value))} style={{ width: '100%', accentColor: accent }} /></label>
                <label style={{ display: 'block', fontFamily: SANS, fontSize: '10px', color: C.textMid, marginBottom: '10px' }}>Swath-edge erosion <strong style={{ color: C.text }}>{swathEdgeErosion} px · {(swathEdgeErosion * 0.08).toFixed(2)} km</strong><input type="range" min="0" max="60" step="1" value={swathEdgeErosion} onChange={e => setSwathEdgeErosion(parseInt(e.target.value, 10))} style={{ width: '100%', accentColor: accent }} /></label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
                    <label style={{ fontFamily: SANS, fontSize: '10px', color: C.textMid }}>Seed threshold <strong style={{ color: C.text }}>{seedThresholdDb.toFixed(1)} dB</strong><input type="range" min="-10" max="0" step="0.1" value={seedThresholdDb} onChange={e => setSeedThresholdDb(parseFloat(e.target.value))} style={{ width: '100%', accentColor: accent }} /></label>
                    <label style={{ fontFamily: SANS, fontSize: '10px', color: C.textMid }}>Growth threshold <strong style={{ color: C.text }}>{growthThresholdDb.toFixed(1)} dB</strong><input type="range" min="-8" max="2" step="0.1" value={growthThresholdDb} onChange={e => setGrowthThresholdDb(parseFloat(e.target.value))} style={{ width: '100%', accentColor: accent }} /></label>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <label style={{ fontFamily: SANS, fontSize: '10px', color: C.textMid }}>Covariance channel<select value={polarization} onChange={e => setPolarization(e.target.value)} style={{ ...inputStyle, marginTop: '4px', fontFamily: SANS, fontSize: '10px' }}><option value="HHHH">HHHH · co-pol</option><option value="HVHV">HVHV · cross-pol</option><option value="dual">Dual-pol gated</option><option value="span">Polarimetric span</option></select></label>
                    <label style={{ fontFamily: SANS, fontSize: '10px', color: C.textMid }}>Multilook factor<select value={multilookFactor} onChange={e => setMultilookFactor(parseInt(e.target.value, 10))} style={{ ...inputStyle, marginTop: '4px', fontFamily: SANS, fontSize: '10px' }}><option value="8">8×8 · 80 m</option><option value="4">4×4 · 40 m</option><option value="2">2×2 · 20 m</option><option value="1">1×1 · 10 m</option></select></label>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '10px' }}>
                    <label style={{ fontFamily: SANS, fontSize: '10px', color: C.textDim }}>Speckle filter<select value={speckleFilter} onChange={e => setSpeckleFilter(e.target.value)} style={{ ...inputStyle, marginTop: '4px', fontFamily: SANS, fontSize: '10px' }}><option value="median-3">3×3 spatial median · active</option><option value="lee-frost" disabled>Lee + Frost · engine pending</option><option value="raw" disabled>Raw · engine pending</option></select></label>
                    <label style={{ fontFamily: SANS, fontSize: '10px', color: C.textDim }}>Recession threshold <strong style={{ color: C.text }}>+{recededWaterThreshold.toFixed(1)} dB</strong><input type="number" min="0" max="12" step="0.1" value={recededWaterThreshold} onChange={e => setRecededWaterThreshold(parseFloat(e.target.value) || 0)} style={{ ...inputStyle, marginTop: '4px' }} /><span style={{ display: 'block', fontSize: '9px', marginTop: '3px' }}>Displayed for audit; processor currently uses calibrated +3.0 dB.</span></label>
                </div>
                <div style={{ marginTop: '10px', paddingTop: '9px', borderTop: `1px solid ${C.bg3}`, display: 'flex', justifyContent: 'space-between', gap: '8px', fontFamily: SANS, fontSize: '9px', color: C.textDim }}><span>NESZ floor · -40.0 dB</span><span>Current filter · {speckleFilter}</span></div>
                <div style={{ marginTop: '7px', fontFamily: SANS, fontSize: '9px', color: C.textDim }}>Preview: seed → Otsu/min-change → growth. Histogram appears after a report supplies scene statistics; thresholds are not interpolated.</div>
            </div>

            {/* DIVIDER */}
            <div style={{ height: '1px', background: C.bg3, margin: '16px 0' }} />

            {/* ══ CROP CONTROLS (FLOOD) ══ */}
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
                        setCropLat('27.2055');
                        setCropLon('94.8948');
                        setCropPreset('20x20km');
                        if (setFlyToCenter) setFlyToCenter([27.2055, 94.8948]);
                    }}
                    style={{
                        flex: 1, padding: '5px 4px', fontFamily: MONO, fontSize: '9px',
                        background: (cropLat === '27.2055' && cropLon === '94.8948') ? 'rgba(0, 229, 255, 0.15)' : 'rgba(255,255,255,0.03)',
                        border: `1px solid ${(cropLat === '27.2055' && cropLon === '94.8948') ? accent : 'rgba(255,255,255,0.08)'}`,
                        color: (cropLat === '27.2055' && cropLon === '94.8948') ? accent : C.textMid,
                        cursor: 'pointer', textAlign: 'center', borderRadius: '2px'
                    }}
                >
                    Brahmaputra
                </button>
                <button
                    type="button"
                    onClick={() => {
                        setCropLat('25.5000');
                        setCropLon('86.5000');
                        setCropPreset('20x20km');
                        if (setFlyToCenter) setFlyToCenter([25.5000, 86.5000]);
                    }}
                    style={{
                        flex: 1, padding: '5px 4px', fontFamily: MONO, fontSize: '9px',
                        background: (cropLat === '25.5000' && cropLon === '86.5000') ? 'rgba(0, 229, 255, 0.15)' : 'rgba(255,255,255,0.03)',
                        border: `1px solid ${(cropLat === '25.5000' && cropLon === '86.5000') ? accent : 'rgba(255,255,255,0.08)'}`,
                        color: (cropLat === '25.5000' && cropLon === '86.5000') ? accent : C.textMid,
                        cursor: 'pointer', textAlign: 'center', borderRadius: '2px'
                    }}
                    title="InGARSS 2026 Target: Begusarai–Khagaria, Bihar"
                >
                    Bihar Ganga
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
            <div className="flood-crop-grid flood-window-choices" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '6px', marginBottom: '6px' }}>
                {['10x10km', '20x20km', 'full'].map(p => (
                    <button key={p} onClick={() => setCropPreset(p)} style={presetBtnStyle(cropPreset === p)}>
                        {p === 'full' ? 'FULL SCENE' : p.replace('km', ' km').replace('x', ' × ')}
                    </button>
                ))}
            </div>
            <div style={{ fontFamily: SANS, fontSize: '10px', color: C.textDim, lineHeight: 1.4, marginBottom: '4px' }}>
                Crop before loading. Larger windows use more RAM.
            </div>

            {/* ══ FLOOD MAPPING CONTROLS ══ */}
            <div style={{ height: '1px', background: C.bg3, margin: '14px 0' }} />
            
            {/* SCIENTIST PHYSICS WORKBENCH */}
            <section aria-labelledby="physics-workbench-title" style={{ display: 'none' }}>
                <div id="physics-workbench-title" style={{ fontFamily: SANS, fontSize: '12px', color: C.text, fontWeight: 600, marginBottom: '4px' }}>Scientist physics workbench</div>
                <div style={{ fontFamily: SANS, fontSize: '10px', color: C.textDim, lineHeight: 1.45, marginBottom: '10px' }}>Expose the calibrated band choice before a run. The processor still owns the final metadata and report.</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '5px', marginBottom: '10px' }}>
                    {[['l', 'L-band', '1.24 GHz'], ['s', 'S-band', '3.20 GHz'], ['fusion', 'L + S', 'paired report']].map(([value, label, note]) => <button key={value} type="button" onClick={() => value !== 'fusion' && setRadarBand(value)} disabled={value === 'fusion'} aria-pressed={radarBand === value} title={value === 'fusion' ? 'Use the verified fused report; paired fusion execution is the next gateway batch.' : undefined} style={{ padding: '8px 5px', borderRadius: '9px', border: `1px solid ${radarBand === value ? accent : C.bg3}`, background: radarBand === value ? 'rgba(15,150,156,.16)' : 'transparent', color: radarBand === value ? C.text : C.textDim, fontFamily: SANS, fontSize: '10px', cursor: value === 'fusion' ? 'not-allowed' : 'pointer', opacity: value === 'fusion' ? .55 : 1 }}><span style={{ display: 'block', fontWeight: 600 }}>{label}</span><span style={{ display: 'block', marginTop: '3px', fontFamily: MONO, fontSize: '8px', opacity: .75 }}>{note}</span></button>)}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', fontFamily: MONO, fontSize: '9px', color: C.textDim }}><span>NESZ FLOOR · -40.0 dB</span><span>MEDIAN · 3×3</span></div>
                <button type="button" onClick={() => { setRadarBand('l'); setMinChangeDb(-3); setSeedThresholdDb(-5); setGrowthThresholdDb(-2.5); setMinAreaPixels(8); }} style={{ marginTop: '10px', padding: '6px 8px', border: '1px solid rgba(255,255,255,.12)', borderRadius: '8px', background: 'transparent', color: C.textMid, fontFamily: SANS, fontSize: '10px', cursor: 'pointer' }}>Reset to calibrated L-band defaults</button>
            </section>

            {/* Baseline reference GCOV input */}
            <div style={{ marginBottom: '10px', display: 'none' }}>
                <div style={{ fontFamily: MONO, fontSize: '9px', color: C.textDim, marginBottom: '4px' }}>BASELINE REFERENCE (GCOV H5)</div>
                <input
                    type="text" value={slaveFilePath || ''} onChange={e => setSlaveFilePath(e.target.value)}
                    placeholder="/path/to/NISAR_baseline_dry.h5"
                    style={inputStyle}
                />
            </div>

            {/* Coherence helper GUNW input (Optional) */}
            <div style={{ marginBottom: '14px', display: 'none' }}>
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

            {/* DIVIDER */}
            <div style={{ height: '1px', background: C.bg3, margin: '16px 0' }} />

            {/* EXECUTE */}
            <button className="flood-primary-action" onClick={startJob} disabled={!getInputFile() || runningJobs.length > 0 || !gatewayOnline || downloadProgress?.status === 'downloading'} style={{
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
                <div style={{ marginTop: '8px', padding: '8px', background: C.bg1, border: '1px solid rgba(230, 168, 23, 0.4)', borderRadius: '2px', fontFamily: MONO, fontSize: '10px', color: C.textDim }}>
                    <div>ELAPSED  {formatElapsed(elapsed[runningJobs[0]?.id])}</div>
                    <div>JOB ID   {runningJobs[0]?.id?.slice(0, 8)}</div>
                    <button
                        onClick={() => onCancel && onCancel(runningJobs[0]?.id)}
                        style={{ width: '100%', marginTop: '6px', padding: '5px 8px', background: 'transparent', border: '1px solid rgba(192, 57, 43, 0.8)', color: '#C0392B', fontFamily: MONO, fontSize: '10px', fontWeight: 600, cursor: 'pointer', borderRadius: '2px' }}
                        onMouseEnter={e => { e.target.style.background = 'rgba(192, 57, 43, 0.15)'; }}
                        onMouseLeave={e => { e.target.style.background = 'transparent'; }}
                    >✕ CANCEL RUN</button>
                </div>
            )}
        </div>
    );
}
