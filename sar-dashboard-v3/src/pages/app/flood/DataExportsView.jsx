import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Download, HardDrive, Info, Trash2 } from 'lucide-react';
import { MONO, SANS, C } from '../constants';
import { api } from '../../../config/api';

export default function DataExportsView({ viewingResult }) {
    const [deleting, setDeleting] = useState(false);
    const flood = viewingResult?.pipeline === 'flood' ? viewingResult : null;

    const handleDeleteJob = async () => {
        if (!flood?.id) return;
        if (!window.confirm(`Permanently delete all artifacts for job ${flood.id}?`)) return;
        setDeleting(true);
        try {
            await fetch(api(`/jobs/${flood.id}`), { method: 'DELETE' });
            window.location.reload();
        } catch (err) {
            alert(`Failed to delete job: ${err.message}`);
            setDeleting(false);
        }
    };
    const downloads = [];
    if (flood) {
        const reportPath = flood.floodReportPath
            || (flood.output_path ? flood.output_path.replace(/_flood\.png$/, '_flood.json') : null);
        const pngUrl = flood.url || (flood.output_path ? api(flood.output_path) : null);
        const geoJsonUrl = flood.floodGeoJsonPath
            ? api(flood.floodGeoJsonPath)
            : (reportPath ? api(reportPath.replace(/\.json$/, '.geo.json')) : null);

        if (pngUrl) downloads.push({ group: 'Visual products', label: 'Flood overlay', detail: 'Browser preview', ext: 'PNG', url: pngUrl });
        if (flood.floodBaselinePath) downloads.push({ group: 'Visual products', label: 'Baseline observation', detail: 'Acquisition 1', ext: 'PNG', url: api(flood.floodBaselinePath) });
        if (flood.floodActivePath) downloads.push({ group: 'Visual products', label: 'Active observation', detail: 'Acquisition 2', ext: 'PNG', url: api(flood.floodActivePath) });
        if (reportPath) {
            downloads.push({ group: 'Analysis products', label: 'Flood report', detail: 'Processor metadata', ext: 'JSON', url: api(reportPath) });
            if (geoJsonUrl) downloads.push({ group: 'Analysis products', label: 'Flood polygons', detail: 'Connected regions', ext: 'GEOJSON', url: geoJsonUrl });
            downloads.push({ group: 'Analysis products', label: 'Classification raster', detail: 'Authoritative GIS output', ext: 'GEOTIFF', url: api(reportPath.replace(/\.json$/, '_class.tif')) });
        }
    }

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
            <div style={{ 
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)', 
                paddingBottom: '20px', 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'flex-start', 
                flexWrap: 'wrap', 
                gap: '16px' 
            }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ 
                            fontFamily: MONO, 
                            fontSize: '11px', 
                            color: '#38bdf8', 
                            background: 'rgba(56, 189, 248, 0.1)', 
                            border: '1px solid rgba(56, 189, 248, 0.25)', 
                            padding: '3px 8px', 
                            borderRadius: '999px',
                            fontWeight: 700,
                            letterSpacing: '0.06em'
                        }}>
                            DATA REPOSITORY
                        </span>
                    </div>
                    <h1 style={{ margin: '8px 0 4px', fontSize: '22px', fontWeight: 700, color: '#f4f5f7', letterSpacing: '-0.02em' }}>
                        Job Data Products & GIS Exports
                    </h1>
                    <div style={{ fontSize: '13px', color: '#9ca0a8' }}>
                        Direct geospatial raster, polygon GeoJSON, and scientific metadata outputs generated from Rust analysis.
                    </div>
                </div>
                {flood && (
                    <button
                        type="button"
                        onClick={handleDeleteJob}
                        disabled={deleting}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '6px 12px',
                            background: 'rgba(239, 68, 68, 0.12)',
                            color: '#f87171',
                            border: '1px solid rgba(239, 68, 68, 0.35)',
                            borderRadius: '6px',
                            fontFamily: MONO,
                            fontSize: '11px',
                            cursor: deleting ? 'not-allowed' : 'pointer',
                            opacity: deleting ? 0.6 : 1,
                            transition: 'all 0.15s ease'
                        }}
                    >
                        <Trash2 size={13} />
                        {deleting ? 'Deleting...' : 'Delete Job Artifacts'}
                    </button>
                )}
            </div>
            {downloads.length ? ['Visual products', 'Analysis products'].map(group => {
                const items = downloads.filter(item => item.group === group);
                return <section className="flood-export-group" key={group}>
                    <div className="flood-export-group-title">{group}</div>
                    <div className="flood-export-grid">
                        {items.map(item => <a className="flood-export-card" key={item.label} href={item.url} download>
                            <span className="flood-export-type">{item.ext}</span>
                            <span className="flood-export-copy"><strong>{item.label}</strong><small>{item.detail}</small></span>
                            <Download size={15} />
                        </a>)}
                    </div>
                </section>;
            }) : <div className="flood-empty-state"><Info size={15} /> Select a completed flood analysis to access its products.</div>}
        </motion.div>
    );
}
