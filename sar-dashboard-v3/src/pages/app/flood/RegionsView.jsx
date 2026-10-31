import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Layers, Search, Crosshair, Download, Info, ShieldCheck, AlertCircle, Compass } from 'lucide-react';
import { MONO, SANS, C } from '../constants';

export default function RegionsView({ floodGeoJson, floodGeoJsonPath, onSelectRegionOnMap }) {
    const [query, setQuery] = useState('');
    const [filterConf, setFilterConf] = useState('all'); // 'all' | 'high' | 'medium'
    const [pageLimit, setPageLimit] = useState(60);

    const rawFeatures = floodGeoJson?.features || [];

    // Filter and search
    const filteredFeatures = useMemo(() => {
        return rawFeatures.filter(feature => {
            const props = feature.properties || {};
            const conf = String(props.confidence || '').toLowerCase();
            const classCode = String(props.class_code || '');

            if (filterConf === 'high' && !conf.includes('high')) return false;
            if (filterConf === 'medium' && !conf.includes('med')) return false;

            if (!query.trim()) return true;
            const q = query.toLowerCase();
            return (
                conf.includes(q) || 
                classCode.includes(q) || 
                String(props.area_acres || '').includes(q) ||
                String(props.centroid_lat || '').includes(q)
            );
        });
    }, [rawFeatures, query, filterConf]);

    const displayedFeatures = filteredFeatures.slice(0, pageLimit);

    if (rawFeatures.length === 0) {
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
                        <Layers size={26} />
                    </div>
                    <div style={{ fontFamily: MONO, fontSize: '11px', color: '#38bdf8', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '8px' }}>
                        No Flood Regions Available
                    </div>
                    <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#f8fafc', margin: '0 0 10px' }}>
                        Delineated Flood Clusters
                    </h2>
                    <p style={{ fontSize: '13px', color: '#94a3b8', lineHeight: 1.6, margin: '0' }}>
                        No vector polygons are currently active. Select a completed flood analysis run from the sidebar or execute a new flood detection from the Live Map to inspect cluster polygons and breach coordinates.
                    </p>
                </div>
            </motion.div>
        );
    }

    // Calculate totals
    const totalHighConf = rawFeatures.filter(f => String(f.properties?.confidence || '').toLowerCase().includes('high')).length;
    const totalMedConf = rawFeatures.filter(f => String(f.properties?.confidence || '').toLowerCase().includes('med')).length;

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
            {/* Header */}
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
                            VECTOR CLUSTERS
                        </span>
                        <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#f8fafc', letterSpacing: '-0.02em' }}>
                            Flood Breach Zones & Connected Polygons
                        </h1>
                    </div>
                    <div style={{ fontSize: '12px', color: '#8e929b', marginTop: '6px' }}>
                        Connected flood clusters merged from 80m classified SAR cells, with spatial acreage and centroid anchors.
                    </div>
                </div>

                {floodGeoJsonPath && (
                    <a 
                        href={floodGeoJsonPath} 
                        download 
                        style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '6px', 
                            padding: '8px 14px', 
                            background: 'rgba(56, 189, 248, 0.10)', 
                            border: '1px solid rgba(56, 189, 248, 0.25)', 
                            borderRadius: '10px', 
                            color: '#38bdf8', 
                            fontFamily: MONO, 
                            fontSize: '11px', 
                            textDecoration: 'none' 
                        }}
                    >
                        <Download size={13} /> Download GeoJSON
                    </a>
                )}
            </div>

            {/* If no GeoJSON available */}
            {!floodGeoJson && (
                <div style={{ 
                    marginTop: '32px', 
                    padding: '32px', 
                    background: 'rgba(18, 19, 22, 0.72)', 
                    border: '1px solid rgba(255, 255, 255, 0.08)', 
                    borderRadius: '20px',
                    display: 'flex', 
                    flexDirection: 'column',
                    alignItems: 'center', 
                    gap: '12px',
                    color: '#8e929b',
                    textAlign: 'center'
                }}>
                    <Info size={24} color="#38bdf8" />
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#f8fafc' }}>No Completed Flood Vector Map Selected</div>
                    <div style={{ fontSize: '12px', maxWidth: '420px', lineHeight: 1.5 }}>
                        Select a completed flood analysis run from the sidebar or click "Run Analysis" to compute vector flood breach polygons.
                    </div>
                </div>
            )}

            {floodGeoJson && (
                <div style={{ marginTop: '20px' }}>
                    {/* KPI Quick Chips */}
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '18px' }}>
                        <div style={{ 
                            padding: '8px 14px', 
                            background: 'rgba(255, 255, 255, 0.035)', 
                            border: '1px solid rgba(255, 255, 255, 0.07)', 
                            borderRadius: '12px', 
                            fontSize: '12px', 
                            color: '#e2e8f0' 
                        }}>
                            Total Features: <strong style={{ color: '#fff' }}>{rawFeatures.length}</strong>
                        </div>
                        <div style={{ 
                            padding: '8px 14px', 
                            background: 'rgba(16, 185, 129, 0.08)', 
                            border: '1px solid rgba(16, 185, 129, 0.25)', 
                            borderRadius: '12px', 
                            fontSize: '12px', 
                            color: '#a7f3d0' 
                        }}>
                            High Confidence: <strong style={{ color: '#34d399' }}>{totalHighConf}</strong>
                        </div>
                        <div style={{ 
                            padding: '8px 14px', 
                            background: 'rgba(245, 158, 11, 0.08)', 
                            border: '1px solid rgba(245, 158, 11, 0.25)', 
                            borderRadius: '12px', 
                            fontSize: '12px', 
                            color: '#fde68a' 
                        }}>
                            Medium Confidence: <strong style={{ color: '#fbbf24' }}>{totalMedConf}</strong>
                        </div>
                    </div>

                    {/* Filter & Search Bar */}
                    <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center', 
                        gap: '12px', 
                        flexWrap: 'wrap', 
                        marginBottom: '20px' 
                    }}>
                        <div style={{ position: 'relative', flex: '1', minWidth: '240px' }}>
                            <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#8e929b' }} />
                            <input
                                aria-label="Filter flood vector features"
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                                placeholder="Search by feature #, confidence, or coordinates..."
                                style={{
                                    width: '100%',
                                    padding: '10px 14px 10px 36px',
                                    background: 'rgba(255, 255, 255, 0.035)',
                                    border: '1px solid rgba(255, 255, 255, 0.08)',
                                    borderRadius: '12px',
                                    color: '#f8fafc',
                                    fontSize: '12px',
                                    outline: 'none',
                                    boxSizing: 'border-box'
                                }}
                            />
                        </div>

                        {/* Confidence Filter Pills */}
                        <div style={{ display: 'flex', gap: '6px' }}>
                            {[
                                { id: 'all', label: 'All Clusters' },
                                { id: 'high', label: 'High Confidence' },
                                { id: 'medium', label: 'Medium Confidence' },
                            ].map(btn => (
                                <button
                                    key={btn.id}
                                    type="button"
                                    onClick={() => setFilterConf(btn.id)}
                                    style={{
                                        padding: '7px 12px',
                                        borderRadius: '10px',
                                        border: filterConf === btn.id ? '1px solid rgba(56, 189, 248, 0.35)' : '1px solid rgba(255, 255, 255, 0.08)',
                                        background: filterConf === btn.id ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255, 255, 255, 0.035)',
                                        color: filterConf === btn.id ? '#38bdf8' : '#94a3b8',
                                        fontSize: '11px',
                                        fontWeight: 500,
                                        cursor: 'pointer'
                                    }}
                                >
                                    {btn.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Features Grid */}
                    {displayedFeatures.length > 0 ? (
                        <div style={{ 
                            display: 'grid', 
                            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', 
                            gap: '12px' 
                        }}>
                            {displayedFeatures.map((feature, idx) => {
                                const props = feature.properties || {};
                                const isHigh = String(props.confidence || '').toLowerCase().includes('high');
                                const acres = props.area_acres != null ? Number(props.area_acres) : (props.pixel_count ? (props.pixel_count * 1.5815) : null);
                                const km2 = acres ? (acres * 0.004046856) : null;
                                const lat = props.centroid_lat != null ? Number(props.centroid_lat).toFixed(4) : null;
                                const lon = props.centroid_lon != null ? Number(props.centroid_lon).toFixed(4) : null;

                                return (
                                    <div
                                        key={feature.id || idx}
                                        style={{
                                            background: 'rgba(18, 19, 22, 0.72)',
                                            backdropFilter: 'blur(20px)',
                                            border: '1px solid rgba(255, 255, 255, 0.07)',
                                            borderRadius: '14px',
                                            padding: '14px',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            justifyContent: 'space-between',
                                            transition: 'border-color 0.2s ease, transform 0.2s ease',
                                        }}
                                    >
                                        <div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                                <span style={{ fontFamily: MONO, fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>
                                                    ZONE #{idx + 1}
                                                </span>
                                                <span style={{ 
                                                    fontFamily: MONO, 
                                                    fontSize: '9px', 
                                                    padding: '2px 6px', 
                                                    borderRadius: '4px',
                                                    background: isHigh ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.12)',
                                                    color: isHigh ? '#34d399' : '#fbbf24',
                                                    border: `1px solid ${isHigh ? 'rgba(16, 185, 129, 0.25)' : 'rgba(245, 158, 11, 0.25)'}`
                                                }}>
                                                    {isHigh ? 'High Confidence' : 'Moderate'}
                                                </span>
                                            </div>

                                            {/* Acreage Metric */}
                                            <div style={{ marginBottom: '8px' }}>
                                                <div style={{ fontFamily: MONO, fontSize: '18px', fontWeight: 300, color: '#f8fafc', letterSpacing: '-0.03em' }}>
                                                    {acres ? `${acres.toLocaleString(undefined, { maximumFractionDigits: 1 })} ac` : 'Cluster'}
                                                </div>
                                                {km2 && (
                                                    <div style={{ fontFamily: MONO, fontSize: '10.5px', color: '#94a3b8' }}>
                                                        {km2.toFixed(2)} km² inundation
                                                    </div>
                                                )}
                                            </div>

                                            {/* Centroid coordinates */}
                                            {lat && lon && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontFamily: MONO, fontSize: '10px', color: '#64748b', marginBottom: '10px' }}>
                                                    <Compass size={11} /> {lat}°N, {lon}°E
                                                </div>
                                            )}
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => onSelectRegionOnMap?.(feature)}
                                            style={{
                                                marginTop: '8px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '6px',
                                                width: '100%',
                                                padding: '7px',
                                                borderRadius: '8px',
                                                border: '1px solid rgba(56, 189, 248, 0.25)',
                                                background: 'rgba(56, 189, 248, 0.08)',
                                                color: '#38bdf8',
                                                fontFamily: MONO,
                                                fontSize: '10.5px',
                                                cursor: 'pointer',
                                                transition: 'all 0.15s ease'
                                            }}
                                        >
                                            <Crosshair size={12} /> Inspect on Live Map
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div style={{ padding: '24px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '14px', color: '#8e929b', fontSize: '12px' }}>
                            No flood breach features match "{query}".
                        </div>
                    )}

                    {/* Pagination Button */}
                    {filteredFeatures.length > pageLimit && (
                        <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'center' }}>
                            <button
                                type="button"
                                onClick={() => setPageLimit(prev => prev + 60)}
                                style={{
                                    padding: '8px 20px',
                                    borderRadius: '10px',
                                    background: 'rgba(255, 255, 255, 0.06)',
                                    border: '1px solid rgba(255, 255, 255, 0.12)',
                                    color: '#e2e4e9',
                                    fontSize: '11px',
                                    fontFamily: MONO,
                                    cursor: 'pointer'
                                }}
                            >
                                Show Next 60 Regions ({displayedFeatures.length} of {filteredFeatures.length} shown)
                            </button>
                        </div>
                    )}
                </div>
            )}
        </motion.div>
    );
}
