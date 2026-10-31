import React from 'react';
import { motion } from 'framer-motion';
import { Download, HardDrive, Info } from 'lucide-react';
import { MONO, SANS, C } from '../constants';
import { api } from '../../../config/api';

export default function DataExportsView({ viewingResult }) {
    const flood = viewingResult?.pipeline === 'flood' ? viewingResult : null;
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
        <motion.div className="flood-view-page" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 180, damping: 20 }} style={{ flex: 1, background: '#0a0d10', padding: '24px', overflowY: 'auto', boxSizing: 'border-box' }}>
            <div style={{ borderBottom: '1px solid #1c2430', paddingBottom: '16px', fontFamily: MONO }}>
                <div style={{ color: C.accent.flood, fontSize: '13px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}><HardDrive size={16} /> JOB DATA PRODUCTS</div>
                <div style={{ fontFamily: SANS, fontSize: '11px', color: C.textDim, marginTop: '4px' }}>Links are generated only from the selected processor job; no placeholder products are offered.</div>
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
