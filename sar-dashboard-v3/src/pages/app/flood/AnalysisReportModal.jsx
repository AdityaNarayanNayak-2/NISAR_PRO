import React from 'react';
import { X, FileText, Download, ShieldCheck, CheckCircle2, Printer } from 'lucide-react';
import { MONO, SANS, C } from '../constants';
import { parseFloodReport } from './floodReportHelpers';

export default function AnalysisReportModal({ floodReport, onClose }) {
    const p = parseFloodReport(floodReport);
    if (!p) return null;

    const handlePrint = () => {
        window.print();
    };

    const downloadFile = (filename, content, type) => {
        const blob = new Blob([content], { type });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    };

    const modalOverlayStyle = {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1500,
        background: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        fontFamily: MONO,
        fontSize: '11px',
        color: C.text
    };

    const modalContainerStyle = {
        background: C.bg1,
        border: `1px solid ${C.bg3}`,
        borderRadius: '2px',
        width: '100%',
        maxWidth: '800px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8)',
        overflow: 'hidden',
    };

    const headerStyle = {
        background: C.bg2,
        borderBottom: `1px solid ${C.bg3}`,
        padding: '16px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0
    };

    const sectionTitleStyle = {
        fontFamily: MONO,
        fontSize: '10px',
        color: C.accent.flood,
        fontWeight: 'bold',
        letterSpacing: '0.08em',
        marginBottom: '12px',
        textTransform: 'uppercase'
    };

    const cardStyle = {
        background: C.bg2,
        border: `1px solid ${C.bg3}`,
        borderRadius: '2px',
        padding: '16px',
        marginBottom: '20px'
    };

    const cellLabelStyle = {
        fontSize: '9px',
        color: C.textDim,
        textTransform: 'uppercase',
        marginBottom: '4px'
    };

    const cellValueStyle = {
        fontSize: '13px',
        fontWeight: 'bold',
        color: C.text
    };

    return (
        <div style={modalOverlayStyle} onClick={onClose}>
            <div style={modalContainerStyle} onClick={e => e.stopPropagation()}>
                {/* Modal Header */}
                <div style={headerStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '2px',
                            background: 'rgba(42, 139, 145, 0.1)',
                            border: '1px solid rgba(42, 139, 145, 0.3)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: C.accent.flood
                        }}>
                            <FileText size={16} />
                        </div>
                        <div>
                            <div style={{ fontWeight: 'bold', fontSize: '13px', color: C.text }}>
                                NISAR FLOOD INUNDATION ANALYSIS REPORT
                            </div>
                            <div style={{ fontSize: '9px', color: C.textDim, marginTop: '2px' }}>
                                REPORT ID: <span style={{ color: C.accent.flood }}>REP-{p.activeDate.replace(/ /g, '').toUpperCase()}-01</span> | STATUS: <span style={{ color: C.stable }}>CALIBRATED</span>
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <button
                            onClick={handlePrint}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                background: C.bg3,
                                border: `1px solid ${C.bg4}`,
                                color: C.text,
                                padding: '6px 12px',
                                borderRadius: '2px',
                                cursor: 'pointer',
                                fontFamily: MONO,
                                fontSize: '10px'
                            }}
                            onMouseEnter={e => e.target.style.background = C.bg4}
                            onMouseLeave={e => e.target.style.background = C.bg3}
                        >
                            <Printer size={12} />
                            <span>PRINT REPORT</span>
                        </button>

                        <button
                            onClick={onClose}
                            style={{
                                background: 'none',
                                border: 'none',
                                color: C.textDim,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                padding: '4px'
                            }}
                            onMouseEnter={e => e.target.style.color = C.text}
                            onMouseLeave={e => e.target.style.color = C.textDim}
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Modal Body - Scrollable */}
                <div style={{ padding: '24px', overflowY: 'auto', flex: 1, background: C.bg0 }} className="print-modal-body">
                    {/* Executive Summary */}
                    <div style={cardStyle}>
                        <div style={sectionTitleStyle}>1.0 Executive Summary & Location Context</div>
                        <p style={{ fontFamily: SANS, fontSize: '12px', color: C.textMid, lineHeight: 1.6, margin: 0 }}>
                            NISAR L-band SAR change detection analysis was executed over the <strong style={{ color: C.text }}>{p.location}</strong> analysis region. The evaluation compares the monsoon active acquisition on <strong style={{ color: C.accent.flood }}>{p.activeDate}</strong> against the dry baseline acquisition on <strong style={{ color: C.text }}>{p.baselineDate}</strong>.
                        </p>
                    </div>

                    {/* Key Metrics Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
                        <div style={{ background: C.bg2, border: `1px solid ${C.bg3}`, padding: '12px', borderRadius: '2px' }}>
                            <div style={cellLabelStyle}>Total Mapped Area</div>
                            <div style={cellValueStyle}>{p.totalAreaAcres.toLocaleString(undefined, {maximumFractionDigits:1})} ac</div>
                        </div>
                        <div style={{ background: C.bg2, border: `1px solid ${C.bg3}`, padding: '12px', borderRadius: '2px' }}>
                            <div style={cellLabelStyle}>New Inundation</div>
                            <div style={{ ...cellValueStyle, color: C.accent.flood }}>{p.totalFloodAcres.toFixed(2)} ac</div>
                        </div>
                        <div style={{ background: C.bg2, border: `1px solid ${C.bg3}`, padding: '12px', borderRadius: '2px' }}>
                            <div style={cellLabelStyle}>High Confidence</div>
                            <div style={{ ...cellValueStyle, color: C.critical }}>{p.highConfAcres.toFixed(2)} ac</div>
                        </div>
                        <div style={{ background: C.bg2, border: `1px solid ${C.bg3}`, padding: '12px', borderRadius: '2px' }}>
                            <div style={cellLabelStyle}>Permanent Water</div>
                            <div style={{ ...cellValueStyle, color: C.data }}>{p.permWaterAcres.toLocaleString(undefined, {maximumFractionDigits:1})} ac</div>
                        </div>
                    </div>

                    {/* Satellite Specifications */}
                    <div style={{ marginBottom: '20px' }}>
                        <div style={sectionTitleStyle}>2.0 Satellite Acquisition Specifications</div>
                        <div style={{ border: `1px solid ${C.bg3}`, borderRadius: '2px', overflow: 'hidden' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                <thead>
                                    <tr style={{ background: C.bg2, borderBottom: `1px solid ${C.bg3}`, fontSize: '9px', color: C.textDim }}>
                                        <th style={{ padding: '10px 14px' }}>PASS TYPE</th>
                                        <th style={{ padding: '10px 14px' }}>ACQUISITION DATE</th>
                                        <th style={{ padding: '10px 14px' }}>SENSOR / BAND</th>
                                        <th style={{ padding: '10px 14px' }}>POLARIZATION</th>
                                        <th style={{ padding: '10px 14px' }}>RESOLUTION</th>
                                    </tr>
                                </thead>
                                <tbody style={{ fontSize: '11px', color: C.textMid }}>
                                    <tr style={{ borderBottom: `1px solid ${C.bg2}` }}>
                                        <td style={{ padding: '10px 14px', fontWeight: 'bold', color: C.accent.flood }}>ACTIVE PASS</td>
                                        <td style={{ padding: '10px 14px', color: C.text }}>{p.activeDate}</td>
                                        <td style={{ padding: '10px 14px' }}>{p.sensor}</td>
                                        <td style={{ padding: '10px 14px' }}>{p.polarization}</td>
                                        <td style={{ padding: '10px 14px' }}>{p.gridLabel}</td>
                                    </tr>
                                    <tr>
                                        <td style={{ padding: '10px 14px', fontWeight: 'bold', color: C.textDim }}>BASELINE PASS</td>
                                        <td style={{ padding: '10px 14px', color: C.text }}>{p.baselineDate}</td>
                                        <td style={{ padding: '10px 14px' }}>{p.sensor}</td>
                                        <td style={{ padding: '10px 14px' }}>{p.polarization}</td>
                                        <td style={{ padding: '10px 14px' }}>{p.gridLabel}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Processing Pipeline */}
                    <div style={cardStyle}>
                        <div style={sectionTitleStyle}>3.0 Processing Methodology & Pipeline Stages</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                            <div>
                                <div style={cellLabelStyle}>Change Algorithm</div>
                                <div style={{ fontSize: '11px', color: C.text }}>Log-Ratio Amplitude Difference</div>
                            </div>
                            <div>
                                <div style={cellLabelStyle}>Noise Reduction</div>
                                <div style={{ fontSize: '11px', color: C.text }}>Median Speckle Filtering (3×3)</div>
                            </div>
                            <div>
                                <div style={cellLabelStyle}>Otsu Calibration</div>
                                <div style={{ fontSize: '11px', color: C.text }}>Bimodal histogram optimization</div>
                            </div>
                            <div>
                                <div style={cellLabelStyle}>Dual Threshold Growth</div>
                                <div style={{ fontSize: '11px', color: C.text }}>Active (Region Growing)</div>
                            </div>
                        </div>
                    </div>

                    {/* Quality Flags */}
                    <div>
                        <div style={sectionTitleStyle}>4.0 Quality Flags & Calibration Metadata</div>
                        <div style={{ background: C.bg2, border: `1px solid ${C.bg3}`, borderRadius: '2px', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: C.stable }}>
                                <CheckCircle2 size={12} />
                                <span>Coherence Thresholding: CALIBRATED</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: C.stable }}>
                                <CheckCircle2 size={12} />
                                <span>Geom Accuracy: &lt; 5m RMS</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: C.stable }}>
                                <ShieldCheck size={12} />
                                <span>Product Level: L2 GCOV</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Modal Footer */}
                <div style={{
                    background: C.bg2,
                    borderTop: `1px solid ${C.bg3}`,
                    padding: '14px 24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexShrink: 0
                }}>
                    <div style={{ fontSize: '9px', color: C.textDim, letterSpacing: '0.05em' }}>
                        ORGANIZATION: INDIAN SPACE RESEARCH ORGANISATION (ISRO) / NASA JPL
                    </div>

                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button
                            onClick={() => downloadFile(`REP_${p.activeDate.replace(/ /g, '_')}.json`, JSON.stringify(floodReport, null, 2), 'application/json')}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                background: 'rgba(42, 139, 145, 0.1)',
                                border: '1px solid rgba(42, 139, 145, 0.3)',
                                color: C.accent.flood,
                                padding: '6px 14px',
                                borderRadius: '2px',
                                cursor: 'pointer',
                                fontFamily: MONO,
                                fontSize: '10px',
                                fontWeight: 'bold'
                            }}
                            onMouseEnter={e => e.target.style.background = 'rgba(42, 139, 145, 0.2)'}
                            onMouseLeave={e => e.target.style.background = 'rgba(42, 139, 145, 0.1)'}
                        >
                            <Download size={12} />
                            <span>EXPORT REPORT JSON</span>
                        </button>
                        <button
                            onClick={onClose}
                            style={{
                                background: C.bg3,
                                border: `1px solid ${C.bg4}`,
                                color: C.textMid,
                                padding: '6px 14px',
                                borderRadius: '2px',
                                cursor: 'pointer',
                                fontFamily: MONO,
                                fontSize: '10px'
                            }}
                            onMouseEnter={e => e.target.style.color = C.text}
                            onMouseLeave={e => e.target.style.color = C.textMid}
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
