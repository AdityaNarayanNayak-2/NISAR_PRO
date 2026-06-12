import React from 'react';
import { MONO, C } from './constants';
import { formatBytes, formatElapsed } from './helpers';

export default function MaritimePanel({
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    handleSearch,
    isSearching,
    searchResults,
    selectedScene,
    setSelectedScene,
    dataMode,
    handleAcquireAndProcess,
    runningJobs,
    gatewayOnline,
    downloadProgress,
    startJob,
    getInputFile,
    elapsed,
    viewingResult,
}) {
    return (
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
            {/* SECTION: SEARCH AREA */}
            <div style={{ fontFamily: MONO, fontSize: '10px', color: '#555555', marginBottom: '8px' }}>SEARCH AREA</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    style={{ width: '100%', background: '#1A1A1A', border: '1px solid #2A2A2A', color: '#F0F0F0', fontFamily: MONO, fontSize: '12px', padding: '8px 10px', outline: 'none', borderRadius: '2px', boxSizing: 'border-box' }}
                    onFocus={(e) => e.target.style.borderColor = '#404040'}
                    onBlur={(e) => e.target.style.borderColor = '#2A2A2A'}
                />
                <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    style={{ width: '100%', background: '#1A1A1A', border: '1px solid #2A2A2A', color: '#F0F0F0', fontFamily: MONO, fontSize: '12px', padding: '8px 10px', outline: 'none', borderRadius: '2px', boxSizing: 'border-box' }}
                    onFocus={(e) => e.target.style.borderColor = '#404040'}
                    onBlur={(e) => e.target.style.borderColor = '#2A2A2A'}
                />
            </div>
            <button
                onClick={handleSearch}
                disabled={isSearching}
                style={{ width: '100%', background: 'transparent', border: '1px solid #2A2A2A', color: '#888888', fontFamily: MONO, fontSize: '11px', padding: '8px 10px', borderRadius: '2px', cursor: 'pointer', marginBottom: '16px' }}
                onMouseEnter={(e) => { e.target.style.borderColor = '#404040'; e.target.style.color = '#F0F0F0'; }}
                onMouseLeave={(e) => { e.target.style.borderColor = '#2A2A2A'; e.target.style.color = '#888888'; }}
            >
                {isSearching ? 'SEARCHING...' : 'SEARCH CATALOG'}
            </button>
            {searchResults.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '16px' }}>
                    {searchResults.map((scene) => (
                        <div
                            key={scene.id}
                            onClick={() => setSelectedScene(scene)}
                            style={{ padding: '8px', borderBottom: '1px solid #1A1A1A', borderLeft: selectedScene?.id === scene.id ? `3px solid #4A8FA8` : '3px solid transparent', paddingLeft: selectedScene?.id === scene.id ? '13px' : '8px', cursor: 'pointer' }}
                        >
                            <div style={{ fontFamily: MONO, fontSize: '10px', color: '#888888' }}>{scene.id}</div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: MONO, fontSize: '10px', color: '#555555', marginTop: '4px' }}>
                                <span>{scene.date?.split('T')[0]}</span>
                                <span>{formatBytes(scene.size_bytes)}</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <div style={{ fontFamily: MONO, fontSize: '10px', color: '#555555', marginBottom: '8px' }}>PIPELINE</div>
            <div style={{ fontFamily: MONO, fontSize: '12px', color: '#F0F0F0', marginBottom: '16px' }}>Maritime CFAR</div>

            <div style={{ height: '1px', background: '#2A2A2A', margin: '16px 0' }}></div>

            {/* SECTION: EXECUTE */}
            {dataMode === 'catalog' && selectedScene ? (
                <button
                    onClick={handleAcquireAndProcess}
                    disabled={runningJobs.length > 0 || !gatewayOnline}
                    style={{
                        width: '100%', background: '#C8A96E', color: '#0A0A0A', fontFamily: MONO, fontSize: '12px', fontWeight: 600, padding: '10px', border: 'none', borderRadius: '2px',
                        cursor: (runningJobs.length > 0 || !gatewayOnline) ? 'not-allowed' : 'pointer',
                        opacity: (runningJobs.length > 0 || !gatewayOnline) ? 0.3 : 1,
                    }}
                >
                    {downloadProgress !== null ? (
                        downloadProgress === 'complete' ? 'DOWNLOADING COMPLETE' : `DOWNLOADING  ${downloadProgress}%`
                    ) : runningJobs.length > 0 ? 'PROCESSING...' : 'ACQUIRE + PROCESS'}
                </button>
            ) : (
                <button
                    onClick={startJob}
                    disabled={!getInputFile() || runningJobs.length > 0 || !gatewayOnline}
                    style={{
                        width: '100%', background: '#C8A96E', color: '#0A0A0A', fontFamily: MONO, fontSize: '12px', fontWeight: 600, padding: '10px', border: 'none', borderRadius: '2px',
                        cursor: (!getInputFile() || runningJobs.length > 0 || !gatewayOnline) ? 'not-allowed' : 'pointer',
                        opacity: (!getInputFile() || runningJobs.length > 0 || !gatewayOnline) ? 0.3 : 1,
                    }}
                >
                    {runningJobs.length > 0 ? 'PROCESSING...' : 'START PROCESSING'}
                </button>
            )}
            {downloadProgress !== null && downloadProgress !== 'complete' && (
                <div style={{ height: '2px', background: '#1A1A1A', marginTop: '8px' }}>
                    <div style={{ height: '100%', width: `${downloadProgress}%`, background: '#C8A96E' }}></div>
                </div>
            )}
            {runningJobs.length > 0 && (
                <div style={{ marginTop: '8px', fontFamily: MONO, fontSize: '10px', color: '#555555' }}>
                    <div>ELAPSED  {formatElapsed(elapsed[runningJobs[0]?.id])}</div>
                    <div>JOB ID   {runningJobs[0]?.id?.substring(0, 8)}</div>
                </div>
            )}

            <div style={{ height: '1px', background: '#2A2A2A', margin: '16px 0' }}></div>

            {/* SECTION: DETECTION RESULTS */}
            {viewingResult?.ships?.length > 0 && (() => {
                const ships = viewingResult.ships;
                const intensities = ships.map((s) => s.intensity);
                const maxBackscatter = Math.max(...intensities);
                const minBackscatter = Math.min(...intensities);
                const meanBackscatter = intensities.reduce((a, b) => a + b, 0) / ships.length;

                return (
                    <div>
                        <div style={{ fontFamily: MONO, fontSize: '32px', fontWeight: 600, color: '#C0392B' }}>{ships.length}</div>
                        <div style={{ fontFamily: MONO, fontSize: '10px', color: '#888888', marginBottom: '16px' }}>VESSELS DETECTED VIA CA-CFAR</div>

                        <div style={{ marginBottom: '16px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontFamily: MONO, fontSize: '11px' }}>
                                <span style={{ color: '#555555' }}>MAX BACKSCATTER</span>
                                <span style={{ color: '#7EB8D4' }}>{maxBackscatter.toFixed(2)} dB</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontFamily: MONO, fontSize: '11px' }}>
                                <span style={{ color: '#555555' }}>MEAN BACKSCATTER</span>
                                <span style={{ color: '#7EB8D4' }}>{meanBackscatter.toFixed(2)} dB</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontFamily: MONO, fontSize: '11px' }}>
                                <span style={{ color: '#555555' }}>MIN BACKSCATTER</span>
                                <span style={{ color: '#7EB8D4' }}>{minBackscatter.toFixed(2)} dB</span>
                            </div>
                        </div>

                        <div>
                            {ships.map((ship, idx) => (
                                <div
                                    key={idx}
                                    style={{ padding: '6px 0', borderBottom: '1px solid #1A1A1A', fontFamily: MONO, fontSize: '10px', color: '#888888', cursor: 'pointer' }}
                                    onMouseEnter={(e) => { e.currentTarget.style.background = '#1A1A1A'; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                                >
                                    V{idx + 1}  {ship.lat.toFixed(5)}°N  {ship.lon.toFixed(5)}°E  {ship.intensity.toFixed(2)}dB
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })()}
        </div>
    );
}
