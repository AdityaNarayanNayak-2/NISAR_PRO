import React, { useState, useMemo } from 'react';
import { Search, Download, Layers, Crosshair } from 'lucide-react';
import { MONO, SANS, C } from './constants';
import { DETECTED_FLOOD_REGIONS } from './floodRegionsData';

export default function RegionsView({ onSelectRegionOnMap }) {
    const [searchTerm, setSearchTerm] = useState('');
    const [confidenceFilter, setConfidenceFilter] = useState('all');
    const [sortField, setSortField] = useState('acres');
    const [sortOrder, setSortOrder] = useState('desc');
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 12;

    const filteredRegions = useMemo(() => {
        return DETECTED_FLOOD_REGIONS.filter(region => {
            const matchesSearch = 
                String(region.regionNumber).includes(searchTerm) ||
                region.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                region.nearestInfrastructure.toLowerCase().includes(searchTerm.toLowerCase());
            
            const matchesConf = confidenceFilter === 'all' || region.confidence === confidenceFilter;
            return matchesSearch && matchesConf;
        }).sort((a, b) => {
            const valA = a[sortField];
            const valB = b[sortField];
            if (typeof valA === 'number' && typeof valB === 'number') {
                return sortOrder === 'asc' ? valA - valB : valB - valA;
            }
            return 0;
        });
    }, [searchTerm, confidenceFilter, sortField, sortOrder]);

    const pageCount = Math.ceil(filteredRegions.length / pageSize);
    const paginatedRegions = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return filteredRegions.slice(start, start + pageSize);
    }, [filteredRegions, currentPage]);

    const toggleSort = (field) => {
        if (sortField === field) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortOrder('desc');
        }
        setCurrentPage(1);
    };

    const handleExportGeoJson = () => {
        const geojson = {
            type: 'FeatureCollection',
            features: filteredRegions.map(region => ({
                type: 'Feature',
                geometry: {
                    type: 'Polygon',
                    coordinates: [region.polygonCoords.map(([lat, lng]) => [lng, lat])],
                },
                properties: {
                    id: region.id,
                    regionNumber: region.regionNumber,
                    acres: region.acres,
                    confidence: region.confidence,
                    meanDeltaDb: region.meanDeltaDb,
                    nearestInfrastructure: region.nearestInfrastructure,
                },
            })),
        };

        const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `NISAR_KUNDRA_FLOOD_REGIONS_CATALOG.geojson`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const titleStyle = {
        fontFamily: MONO,
        fontSize: '13px',
        fontWeight: 'bold',
        color: C.accent.flood,
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
    };

    const tableHeaderStyle = (field, flexWidth) => ({
        flex: flexWidth,
        padding: '10px 12px',
        cursor: field ? 'pointer' : 'default',
        color: sortField === field ? C.text : C.textDim,
        fontWeight: 'bold',
        userSelect: 'none',
        display: 'flex',
        alignItems: 'center',
        gap: '4px'
    });

    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#0a0d10', padding: '24px', overflowY: 'auto', boxSizing: 'border-box' }}>
            {/* Header section */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1c2430', paddingBottom: '16px', flexShrink: 0, gap: '16px', flexWrap: 'wrap' }}>
                <div>
                    <div style={titleStyle}>
                        <Layers size={16} />
                        <span>DETECTED INUNDATION REGIONS CATALOG ({filteredRegions.length} POLYGONS)</span>
                    </div>
                    <div style={{ fontFamily: SANS, fontSize: '11px', color: C.textDim, marginTop: '4px' }}>
                        Contiguous connected-component vector segments filtered by minimum acreage threshold (&gt; 0.08 acres).
                    </div>
                </div>

                <button
                    onClick={handleExportGeoJson}
                    style={{
                        background: 'rgba(192, 57, 43, 0.1)',
                        border: '1px solid rgba(192, 57, 43, 0.3)',
                        color: C.accent.flood,
                        fontFamily: MONO,
                        fontSize: '11px',
                        fontWeight: 'bold',
                        padding: '8px 16px',
                        borderRadius: '2px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        outline: 'none',
                        transition: 'background 0.2s'
                    }}
                    onMouseEnter={e => e.target.style.background = 'rgba(192, 57, 43, 0.2)'}
                    onMouseLeave={e => e.target.style.background = 'rgba(192, 57, 43, 0.1)'}
                >
                    <Download size={13} />
                    <span>EXPORT CATALOG GEOJSON</span>
                </button>
            </div>

            {/* Filter controls */}
            <div style={{ display: 'flex', gap: '12px', margin: '16px 0', alignItems: 'center', flexWrap: 'wrap', flexShrink: 0 }}>
                {/* Search box */}
                <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
                    <Search size={12} style={{ position: 'absolute', left: '10px', top: '10px', color: C.textDim }} />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                        placeholder="Search regions by ID or nearest infrastructure..."
                        style={{
                            width: '100%',
                            padding: '8px 12px 8px 30px',
                            background: C.bg1,
                            border: '1px solid #1c2532',
                            borderRadius: '3px',
                            color: C.text,
                            fontFamily: MONO,
                            fontSize: '11px',
                            outline: 'none',
                            boxSizing: 'border-box'
                        }}
                    />
                </div>

                {/* Filter tabs */}
                <div style={{ display: 'flex', border: '1px solid #1c2532', borderRadius: '3px', overflow: 'hidden' }}>
                    {['all', 'high', 'medium'].map(t => (
                        <button
                            key={t}
                            onClick={() => { setConfidenceFilter(t); setCurrentPage(1); }}
                            style={{
                                padding: '8px 14px',
                                border: 'none',
                                background: confidenceFilter === t ? 'rgba(192, 57, 43, 0.15)' : C.bg1,
                                color: confidenceFilter === t ? C.accent.flood : C.textMid,
                                fontFamily: MONO,
                                fontSize: '11px',
                                cursor: 'pointer',
                                outline: 'none'
                            }}
                        >
                            {t.toUpperCase()} CONF
                        </button>
                    ))}
                </div>
            </div>

            {/* Table layout */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: '300px', border: '1px solid #1c2532', borderRadius: '4px', background: C.bg1, overflow: 'hidden' }}>
                {/* Headers */}
                <div style={{ display: 'flex', background: '#0e131b', borderBottom: '1px solid #1c2532', fontFamily: MONO, fontSize: '10px', textTransform: 'uppercase' }}>
                    <div style={tableHeaderStyle('regionNumber', 0.8)} onClick={() => toggleSort('regionNumber')}>
                        REGION {sortField === 'regionNumber' && (sortOrder === 'asc' ? '▲' : '▼')}
                    </div>
                    <div style={tableHeaderStyle('acres', 1.2)} onClick={() => toggleSort('acres')}>
                        ACREAGE {sortField === 'acres' && (sortOrder === 'asc' ? '▲' : '▼')}
                    </div>
                    <div style={tableHeaderStyle('confidence', 1.2)} onClick={() => toggleSort('confidence')}>
                        CONFIDENCE {sortField === 'confidence' && (sortOrder === 'asc' ? '▲' : '▼')}
                    </div>
                    <div style={tableHeaderStyle('meanDeltaDb', 1.2)} onClick={() => toggleSort('meanDeltaDb')}>
                        MEAN DELTA (dB) {sortField === 'meanDeltaDb' && (sortOrder === 'asc' ? '▲' : '▼')}
                    </div>
                    <div style={tableHeaderStyle(null, 3)}>NEAREST INFRASTRUCTURE</div>
                    <div style={tableHeaderStyle('distanceToInfraMeters', 1.2)} onClick={() => toggleSort('distanceToInfraMeters')}>
                        DISTANCE {sortField === 'distanceToInfraMeters' && (sortOrder === 'asc' ? '▲' : '▼')}
                    </div>
                    <div style={{ flex: 1, padding: '10px 12px', color: C.textDim, fontWeight: 'bold' }}>ACTION</div>
                </div>

                {/* Rows scrollable */}
                <div style={{ flex: 1, overflowY: 'auto' }}>
                    {paginatedRegions.length === 0 ? (
                        <div style={{ padding: '40px', textAlign: 'center', fontFamily: MONO, fontSize: '11px', color: C.textDim }}>
                            No flood region vector structures found matching current filter parameters.
                        </div>
                    ) : (
                        paginatedRegions.map((region, idx) => (
                            <div key={region.id} style={{
                                display: 'flex',
                                borderBottom: '1px solid rgba(255,255,255,0.02)',
                                fontFamily: MONO,
                                fontSize: '11px',
                                background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                                alignItems: 'center'
                            }}>
                                <div style={{ flex: 0.8, padding: '10px 12px', color: C.text }}>#{region.regionNumber}</div>
                                <div style={{ flex: 1.2, padding: '10px 12px', color: C.text, fontWeight: 'bold' }}>{region.acres.toFixed(2)} ac</div>
                                <div style={{ flex: 1.2, padding: '10px 12px' }}>
                                    <span style={{
                                        fontSize: '9px',
                                        padding: '2px 6px',
                                        background: region.confidence === 'high' ? 'rgba(192, 57, 43, 0.1)' : 'rgba(230, 168, 23, 0.1)',
                                        color: region.confidence === 'high' ? C.critical : C.caution,
                                        border: `1px solid ${region.confidence === 'high' ? 'rgba(192, 57, 43, 0.2)' : 'rgba(230, 168, 23, 0.2)'}`,
                                        borderRadius: '2px',
                                        fontWeight: 'bold',
                                        textTransform: 'uppercase'
                                    }}>{region.confidence}</span>
                                </div>
                                <div style={{ flex: 1.2, padding: '10px 12px', color: C.accent.flood, fontWeight: 'bold' }}>{region.meanDeltaDb.toFixed(1)} dB</div>
                                <div style={{ flex: 3, padding: '10px 12px', color: C.textMid, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {region.nearestInfrastructure}
                                </div>
                                <div style={{ flex: 1.2, padding: '10px 12px', color: C.textDim }}>{region.distanceToInfraMeters} m</div>
                                <div style={{ flex: 1, padding: '10px 12px' }}>
                                    <button
                                        onClick={() => onSelectRegionOnMap(region)}
                                        style={{
                                            background: 'none',
                                            border: 'none',
                                            color: C.stable,
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            fontFamily: MONO,
                                            fontSize: '10px',
                                            padding: '4px 8px',
                                            borderRadius: '2px',
                                            background: 'rgba(76, 175, 80, 0.05)',
                                            border: '1px solid rgba(76, 175, 80, 0.2)',
                                            outline: 'none'
                                        }}
                                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(76, 175, 80, 0.12)'}
                                        onMouseLeave={e => e.currentTarget.style.background = 'rgba(76, 175, 80, 0.05)'}
                                    >
                                        <Crosshair size={10} />
                                        <span>LOCATE</span>
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Footer Pagination */}
                {pageCount > 1 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: '#0e131b', borderTop: '1px solid #1c2532', fontFamily: MONO, fontSize: '11px', color: C.textDim, flexShrink: 0 }}>
                        <div>Showing {(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, filteredRegions.length)} of {filteredRegions.length} regions</div>
                        <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                disabled={currentPage === 1}
                                style={{
                                    padding: '4px 10px',
                                    background: C.bg2,
                                    border: '1px solid #1c2532',
                                    color: currentPage === 1 ? '#334155' : C.textMid,
                                    cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                                    borderRadius: '2px',
                                    outline: 'none'
                                }}
                            >
                                PREV
                            </button>
                            <button
                                onClick={() => setCurrentPage(prev => Math.min(pageCount, prev + 1))}
                                disabled={currentPage === pageCount}
                                style={{
                                    padding: '4px 10px',
                                    background: C.bg2,
                                    border: '1px solid #1c2532',
                                    color: currentPage === pageCount ? '#334155' : C.textMid,
                                    cursor: currentPage === pageCount ? 'not-allowed' : 'pointer',
                                    borderRadius: '2px',
                                    outline: 'none'
                                }}
                            >
                                NEXT
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
