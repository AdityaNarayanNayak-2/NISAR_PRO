import React from 'react';
import { motion } from 'framer-motion';
import { Download, HardDrive, Info } from 'lucide-react';
import { MONO, SANS, C } from '../constants';

export default function DataExportsView({ viewingResult }) {
    const flood = viewingResult?.pipeline === 'flood' ? viewingResult : null;
    const downloads = flood ? [
        ['Flood overlay PNG', flood.url],
        ['Flood report JSON', flood.floodReportPath && flood.url.replace(/_flood\.png$/, '_flood.json')],
        ['Flood polygons GeoJSON', flood.floodGeoJsonPath && flood.url.replace(/_flood\.png$/, '_flood.geo.json')],
        ['Classification GeoTIFF', flood.url?.replace(/_flood\.png$/, '_flood_class.tif')],
    ].filter(([, url]) => url) : [];

    return (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 180, damping: 20 }} style={{ flex: 1, background: '#0a0d10', padding: '24px', overflowY: 'auto', boxSizing: 'border-box' }}>
            <div style={{ borderBottom: '1px solid #1c2430', paddingBottom: '16px', fontFamily: MONO }}>
                <div style={{ color: C.accent.flood, fontSize: '13px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}><HardDrive size={16} /> JOB DATA PRODUCTS</div>
                <div style={{ fontFamily: SANS, fontSize: '11px', color: C.textDim, marginTop: '4px' }}>Links are generated only from the selected processor job; no placeholder products are offered.</div>
            </div>
            {downloads.length ? <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginTop: '20px' }}>
                {downloads.map(([label, url]) => <a key={label} href={url} download style={{ border: '1px solid rgba(42,139,145,.25)', padding: '16px', color: C.text, textDecoration: 'none', fontFamily: MONO, fontSize: '11px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>{label}<Download size={14} color={C.accent.flood} /></a>)}
            </div> : <div style={{ marginTop: '20px', display: 'flex', gap: '10px', alignItems: 'center', fontFamily: MONO, fontSize: '11px', color: C.textDim }}><Info size={15} /> Select a completed flood analysis to access its products.</div>}
        </motion.div>
    );
}
