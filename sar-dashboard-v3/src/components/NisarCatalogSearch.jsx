import React, { useState } from 'react';
import { Search, Map as MapIcon, Calendar, Satellite, LayoutList, Layers } from 'lucide-react';

function NisarCatalogSearch({ bounds, onSceneSelect }) {
    const [startDate, setStartDate] = useState('2026-01-01');
    const [endDate, setEndDate] = useState('2026-06-01');
    const [isLoading, setIsLoading] = useState(false);
    const [results, setResults] = useState([]);

    const handleSearch = async () => {
        if (!bounds) {
            alert("No map bounds detected. Please move the map to your area of interest.");
            return;
        }

        setIsLoading(true);
        try {
            // boundaries from react-leaflet are [southWest, northEast]
            const minLat = bounds.getSouth();
            const minLon = bounds.getWest();
            const maxLat = bounds.getNorth();
            const maxLon = bounds.getEast();

            const bbox = `${minLon},${minLat},${maxLon},${maxLat}`;
            
            const res = await fetch(`http://localhost:3000/search/nisar?bbox=${bbox}&start_date=${startDate}T00:00:00Z&end_date=${endDate}T23:59:59Z`);
            const data = await res.json();
            setResults(data);
        } catch (error) {
            console.error("Failed to fetch NASA catalog:", error);
            setResults([]);
        } finally {
            setIsLoading(false);
        }
    };

    const formatBytes = (bytes) => {
        const b = parseInt(bytes, 10);
        if (isNaN(b) || b === 0) return '0 B';
        const k = 1024, sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(b) / Math.log(k));
        return parseFloat((b / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    return (
        <div style={{ width: '380px', borderRight: '1px solid #1e293b', background: '#020617', display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Header */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #1e293b', background: '#0f172a' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#0ea5e9', marginBottom: '8px' }}>
                    <Satellite size={18} />
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, fontFamily: '"JetBrains Mono", monospace', letterSpacing: '1px' }}>NASA_ASF_CATALOG</span>
                </div>
                <div style={{ fontSize: '0.65rem', color: '#94a3b8', fontFamily: '"JetBrains Mono", monospace' }}>
                    QUERY DAAC FOR NISAR PRE-CAL L-BAND ACQUISITIONS
                </div>
            </div>

            {/* Filters */}
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', borderBottom: '1px solid #1e293b' }}>
                <div>
                    <label style={{ fontSize: '0.65rem', color: '#94a3b8', fontFamily: '"JetBrains Mono", monospace', display: 'block', marginBottom: '8px', fontWeight: 600, letterSpacing: '1px' }}>TIME_WINDOW_START</label>
                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', color: '#e2e8f0', padding: '10px', fontSize: '0.75rem', fontFamily: '"JetBrains Mono", monospace', outline: 'none' }} />
                </div>
                <div>
                    <label style={{ fontSize: '0.65rem', color: '#94a3b8', fontFamily: '"JetBrains Mono", monospace', display: 'block', marginBottom: '8px', fontWeight: 600, letterSpacing: '1px' }}>TIME_WINDOW_END</label>
                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', color: '#e2e8f0', padding: '10px', fontSize: '0.75rem', fontFamily: '"JetBrains Mono", monospace', outline: 'none' }} />
                </div>
                <div>
                    <label style={{ fontSize: '0.65rem', color: '#94a3b8', fontFamily: '"JetBrains Mono", monospace', display: 'block', marginBottom: '8px', fontWeight: 600, letterSpacing: '1px' }}>SPATIAL_TARGET</label>
                    <div style={{ fontSize: '0.65rem', color: '#0ea5e9', fontFamily: '"JetBrains Mono", monospace', display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(14, 165, 233, 0.1)', padding: '8px 10px', border: '1px solid #0ea5e9' }}>
                        <MapIcon size={12} /> BOUND_TO_ACTIVE_VIEWPORT
                    </div>
                </div>

                <button 
                    onClick={handleSearch}
                    disabled={isLoading}
                    style={{ background: 'transparent', border: '1px solid #0ea5e9', color: '#0ea5e9', padding: '12px', fontSize: '0.75rem', fontFamily: '"JetBrains Mono", monospace', textTransform: 'uppercase', cursor: isLoading ? 'not-allowed' : 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginTop: '10px', transition: 'all 0.2s', fontWeight: 700, letterSpacing: '1px' }}
                    onMouseOver={e=> {if(!isLoading) e.target.style.background = 'rgba(14, 165, 233, 0.1)'}} 
                    onMouseOut={e=> {if(!isLoading) e.target.style.background = 'transparent'}}
                >
                    <Search size={14} /> {isLoading ? 'SCANNING_ARCHIVES...' : 'EXECUTE_QUERY'}
                </button>
            </div>

            {/* Results List */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#94a3b8', marginBottom: '16px', paddingBottom: '8px', borderBottom: '1px solid #1e293b' }}>
                    <LayoutList size={14} />
                    <span style={{ fontSize: '0.65rem', fontWeight: 700, fontFamily: '"JetBrains Mono", monospace', letterSpacing: '1px' }}>AVAILABLE_SCENES [{results.length}]</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {results.length === 0 && !isLoading ? (
                        <div style={{ padding: '20px', textAlign: 'center', color: '#475569', fontSize: '0.7rem', fontFamily: '"JetBrains Mono", monospace', border: '1px dashed #1e293b' }}>
                            [NO_DATA_MATCHES_PARAMETERS]
                        </div>
                    ) : (
                        results.map(scene => (
                            <div 
                                key={scene.id}
                                onClick={() => onSceneSelect(scene)}
                                style={{ background: '#0f172a', border: '1px solid #334155', padding: '16px', cursor: 'pointer', transition: 'all 0.2s', position: 'relative', overflow: 'hidden' }}
                                onMouseOver={e=> {e.currentTarget.style.borderColor = '#0ea5e9'}}
                                onMouseOut={e=> {e.currentTarget.style.borderColor = '#334155'}}
                            >
                                <div style={{ fontSize: '0.7rem', color: '#f8fafc', fontFamily: '"JetBrains Mono", monospace', wordBreak: 'break-all', marginBottom: '12px', fontWeight: 400 }}>
                                    {scene.id}
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.65rem', color: '#64748b', fontFamily: '"JetBrains Mono", monospace' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Calendar size={12} /> {scene.date.split('T')[0]}</div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#10b981' }}><Layers size={12} /> {formatBytes(scene.size_bytes)}</div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}

export default NisarCatalogSearch;
