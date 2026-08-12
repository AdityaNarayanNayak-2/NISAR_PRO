import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Crosshair, Download, Info, Layers, Search } from 'lucide-react';
import { MONO, SANS, C } from '../constants';

export default function RegionsView({ floodGeoJson, floodGeoJsonPath, onSelectRegionOnMap }) {
    const [query, setQuery] = useState('');
    const features = useMemo(() => (floodGeoJson?.features || []).filter(feature => {
        const confidence = String(feature.properties?.confidence || 'unknown');
        const classCode = String(feature.properties?.class_code || '');
        return `${confidence} ${classCode}`.toLowerCase().includes(query.toLowerCase());
    }), [floodGeoJson, query]);

    return (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 180, damping: 20 }} style={{ flex: 1, background: '#0a0d10', padding: '24px', overflowY: 'auto', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap', borderBottom: '1px solid #1c2430', paddingBottom: '16px' }}>
                <div><div style={{ fontFamily: MONO, fontSize: '13px', color: C.accent.flood, fontWeight: 'bold', display: 'flex', gap: '8px', alignItems: 'center' }}><Layers size={16} /> FLOOD VECTOR FEATURES ({features.length})</div><div style={{ fontFamily: SANS, fontSize: '11px', color: C.textDim, marginTop: '4px' }}>Processor-exported GeoJSON features. The current exporter represents classified raster cells, not merged incident polygons.</div></div>
                {floodGeoJsonPath && <a href={floodGeoJsonPath} download style={{ color: C.accent.flood, fontFamily: MONO, fontSize: '11px', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}><Download size={13} /> DOWNLOAD GEOJSON</a>}
            </div>
            {floodGeoJson ? <><div style={{ position: 'relative', margin: '16px 0' }}><Search size={12} style={{ position: 'absolute', left: '10px', top: '10px', color: C.textDim }} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Filter by confidence or class code" style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px 8px 30px', background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.08)', color: C.text, fontFamily: MONO, fontSize: '11px' }} /></div>
                <div style={{ border: '1px solid rgba(255,255,255,.07)', fontFamily: MONO, fontSize: '11px' }}>{features.slice(0, 250).map((feature, index) => <div key={feature.id || index} style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,.05)', display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center' }}><span style={{ color: C.textMid }}>#{index + 1} · class {feature.properties?.class_code ?? '—'} · {feature.properties?.confidence || 'unknown'}</span><button onClick={() => onSelectRegionOnMap(feature)} style={{ background: 'transparent', color: C.accent.flood, border: 'none', fontFamily: MONO, fontSize: '10px', cursor: 'pointer', display: 'flex', gap: '5px', alignItems: 'center' }}><Crosshair size={12} /> MAP</button></div>)}</div>
                {features.length > 250 && <div style={{ marginTop: '12px', fontFamily: MONO, color: C.textDim, fontSize: '10px' }}>Showing the first 250 of {features.length} processor features.</div>}</> : <div style={{ marginTop: '20px', display: 'flex', gap: '10px', alignItems: 'center', fontFamily: MONO, fontSize: '11px', color: C.textDim }}><Info size={15} /> Select a completed flood job after its GeoJSON export is available.</div>}
        </motion.div>
    );
}
