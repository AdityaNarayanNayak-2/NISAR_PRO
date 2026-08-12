import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, Info } from 'lucide-react';
import { MONO, SANS, C } from '../constants';
import { parseFloodReport } from './floodReportHelpers';

export default function TimeSeriesView({ floodReport }) {
    const report = parseFloodReport(floodReport);

    return (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 180, damping: 20 }} style={{ flex: 1, background: '#0a0d10', padding: '24px', overflowY: 'auto', boxSizing: 'border-box' }}>
            <div style={{ borderBottom: '1px solid #1c2430', paddingBottom: '16px' }}>
                <div style={{ fontFamily: MONO, fontSize: '13px', fontWeight: 'bold', color: C.accent.flood, display: 'flex', gap: '8px', alignItems: 'center' }}><TrendingUp size={16} /> TIME SERIES</div>
                <div style={{ fontFamily: SANS, fontSize: '11px', color: C.textDim, marginTop: '4px' }}>Multi-temporal charts require multiple completed flood analyses; this job supplies one active/baseline comparison.</div>
            </div>
            {report ? (
                <div style={{ marginTop: '20px', border: '1px solid rgba(42,139,145,.25)', background: 'rgba(42,139,145,.06)', padding: '18px', fontFamily: MONO, fontSize: '11px', color: C.text }}>
                    <div style={{ color: C.accent.flood, fontWeight: 'bold', marginBottom: '14px' }}>CURRENT COMPARISON — REAL PROCESSOR REPORT</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '14px' }}>
                        <div><span style={{ color: C.textDim }}>Baseline</span><br />{report.baselineDate}</div>
                        <div><span style={{ color: C.textDim }}>Active</span><br />{report.activeDate}</div>
                        <div><span style={{ color: C.textDim }}>New inundation</span><br />{report.totalFloodAcres.toFixed(2)} acres</div>
                        <div><span style={{ color: C.textDim }}>Threshold</span><br />{floodReport.method?.threshold_db ?? 'N/A'} dB</div>
                    </div>
                </div>
            ) : (
                <div style={{ marginTop: '20px', display: 'flex', gap: '10px', alignItems: 'center', fontFamily: MONO, fontSize: '11px', color: C.textDim }}><Info size={15} /> No completed flood analysis is selected.</div>
            )}
        </motion.div>
    );
}
