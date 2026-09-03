import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Cpu, Info } from 'lucide-react';
import { MONO, SANS, C } from '../constants';

export default function ProcessingView({ floodReport }) {
    const method = floodReport?.method;
    const rows = method ? [
        ['Detector', method.detector],
        ['Threshold method', method.threshold_method],
        ['Otsu computed', method.raw_otsu_db != null ? `${typeof method.raw_otsu_db === 'number' ? Number(method.raw_otsu_db).toFixed(2) : method.raw_otsu_db} dB` : null],
        ['User ceiling (min change)', method.min_change_db != null ? `${method.min_change_db} dB` : null],
        ['Effective threshold', method.threshold_db != null ? `${method.threshold_db} dB` : null],
        ['Seed / growth', method.seed_threshold_db != null && method.growth_threshold_db != null ? `${method.seed_threshold_db} / ${method.growth_threshold_db} dB` : null],
        ['Speckle filter', method.speckle_filter],
        ['Morphology', method.morphology],
        ['GUNW coherence', method.coherence_used ? 'Applied' : 'Not used'],
    ].filter(([, value]) => value != null) : [];

    return (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 180, damping: 20 }} style={{ flex: 1, background: '#0a0d10', padding: '24px', overflowY: 'auto', boxSizing: 'border-box' }}>
            <div style={{ borderBottom: '1px solid #1c2430', paddingBottom: '16px' }}>
                <div style={{ fontFamily: MONO, fontSize: '13px', fontWeight: 'bold', color: C.accent.flood, display: 'flex', gap: '8px', alignItems: 'center' }}><Cpu size={16} /> PROCESSING RECORD</div>
                <div style={{ fontFamily: SANS, fontSize: '11px', color: C.textDim, marginTop: '4px' }}>Read-only parameters recorded by the completed Rust flood analysis.</div>
            </div>
            {rows.length ? <div style={{ marginTop: '20px', border: '1px solid rgba(255,255,255,.07)', fontFamily: MONO, fontSize: '11px' }}>
                {rows.map(([name, value]) => <div key={name} style={{ padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,.05)', display: 'flex', gap: '16px', justifyContent: 'space-between' }}><span style={{ color: C.textDim }}>{name}</span><span style={{ color: C.text, textAlign: 'right' }}><CheckCircle2 size={12} color={C.stable} style={{ verticalAlign: 'middle', marginRight: '6px' }} />{value}</span></div>)}
            </div> : <div style={{ marginTop: '20px', display: 'flex', gap: '10px', alignItems: 'center', fontFamily: MONO, fontSize: '11px', color: C.textDim }}><Info size={15} /> Run a flood job to view its actual processing parameters.</div>}
        </motion.div>
    );
}
