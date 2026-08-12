import React from 'react';
import { HardDrive, Download, FileJson, FileCode, CheckCircle2 } from 'lucide-react';
import { MONO, SANS, C } from './constants';

export default function DataExportsView() {
    const downloadFile = (filename, content, type) => {
        const blob = new Blob([content], { type });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleDownloadGeoJson = () => {
        const geojson = {
            type: 'FeatureCollection',
            properties: {
                title: 'Kundra Odisha Inundation Vector Suite',
                epsg: 'EPSG:32644',
                sensor: 'NISAR L-band',
                date: '27 July 2026'
            },
            features: []
        };
        downloadFile('NISAR_KUNDRA_FLOOD_2026.geojson', JSON.stringify(geojson, null, 2), 'application/json');
    };

    const handleDownloadXml = () => {
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<NisarMetadata>
    <ProductType>L2_GCOV</ProductType>
    <SensorBand>L-band</SensorBand>
    <Polarization>HH</Polarization>
    <SpatialReference>EPSG:32644</SpatialReference>
    <TotalAcres>145.45</TotalAcres>
</NisarMetadata>`;
        downloadFile('NISAR_METADATA_L2_GCOV.xml', xml, 'application/xml');
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

    const products = [
        {
            title: 'GeoTIFF Float32 COG',
            desc: 'Cloud-Optimized GeoTIFF containing 32-bit floating point SAR log-ratio Δσ0 backscatter values.',
            actionLabel: 'DOWNLOAD GEOTIFF',
            action: () => downloadFile('NISAR_KUNDRA_BACKSCATTER_DELTA.tif', 'GEO_TIFF_BINARY_STUB', 'image/tiff')
        },
        {
            title: 'GeoJSON Vectors (Catalog)',
            desc: 'Contiguous connection vector segments filtered by minimum acreage threshold (&gt; 0.08 ac).',
            actionLabel: 'DOWNLOAD GEOJSON',
            action: handleDownloadGeoJson
        },
        {
            title: 'Scientific XML Metadata',
            desc: 'ISO 19115 compliant spatial and sensor metadata describing calibration variables and algorithms.',
            actionLabel: 'DOWNLOAD XML METADATA',
            action: handleDownloadXml
        },
        {
            title: 'ASCII Grid Matrix',
            desc: 'Standard ArcInfo ASCII text format grid representing change ratios for third-party GIS imports.',
            actionLabel: 'DOWNLOAD ASCII GRID',
            action: () => downloadFile('NISAR_KUNDRA_FLOOD_MATRIX.asc', 'ncols 1000\nnrows 1000\nxllcorner 82.5533\nyllcorner 18.7433\ncellsize 10\nNODATA_value -9999', 'text/plain')
        }
    ];

    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#0a0d10', padding: '24px', overflowY: 'auto', boxSizing: 'border-box' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1c2430', paddingBottom: '16px', flexShrink: 0 }}>
                <div>
                    <div style={titleStyle}>
                        <HardDrive size={16} />
                        <span>NISAR PRO DATA PRODUCTS & EXPORT CENTER</span>
                    </div>
                    <div style={{ fontFamily: SANS, fontSize: '11px', color: C.textDim, marginTop: '4px' }}>
                        Standardized Cloud-Optimized GeoTIFF (COG), GeoJSON vector layers, and scientific metadata payloads.
                    </div>
                </div>

                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontFamily: MONO,
                    fontSize: '10px',
                    color: C.accent.flood,
                    background: 'rgba(192, 57, 43, 0.1)',
                    border: '1px solid rgba(192, 57, 43, 0.3)',
                    padding: '6px 12px',
                    borderRadius: '2px',
                    fontWeight: 'bold'
                }}>
                    <CheckCircle2 size={12} />
                    <span>EPSG:32644 COMPLIANT</span>
                </div>
            </div>

            {/* Grid display */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', margin: '20px 0' }}>
                {products.map((p, idx) => (
                    <div key={idx} style={{
                        background: '#0e131b',
                        border: '1px solid #1c2735',
                        borderRadius: '4px',
                        padding: '16px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: '12px'
                    }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '4px',
                                background: 'rgba(192, 57, 43, 0.1)',
                                border: '1px solid rgba(192, 57, 43, 0.3)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: C.accent.flood
                            }}>
                                <HardDrive size={16} />
                            </div>
                            <div style={{ fontFamily: MONO, fontSize: '12px', fontWeight: 'bold', color: C.text }}>
                                {p.title}
                            </div>
                            <p style={{ fontFamily: SANS, fontSize: '11px', color: C.textDim, lineHeight: 1.4, margin: 0 }}>
                                {p.desc}
                            </p>
                        </div>

                        <button
                            onClick={p.action}
                            style={{
                                width: '100%',
                                padding: '8px',
                                background: 'rgba(192, 57, 43, 0.05)',
                                border: `1px solid ${C.accent.flood}`,
                                color: C.accent.flood,
                                fontFamily: MONO,
                                fontSize: '11px',
                                cursor: 'pointer',
                                borderRadius: '2px',
                                transition: 'all 0.2s',
                                outline: 'none',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '6px'
                            }}
                            onMouseEnter={e => e.target.style.background = 'rgba(192, 57, 43, 0.12)'}
                            onMouseLeave={e => e.target.style.background = 'rgba(192, 57, 43, 0.05)'}
                        >
                            <Download size={12} />
                            <span>{p.actionLabel}</span>
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}
