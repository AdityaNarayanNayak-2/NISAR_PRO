import React, { useState } from 'react';
import { Download, Layers, X } from 'lucide-react';
import { MONO, C, TM } from '../constants';
import { useMapStore } from '../stores/useMapStore';
import { api } from '../../../config/api';

export default function MapLayerControls({ profile = 'flood', activeView = 'map' }) {
    const viewingResult = useMapStore(state => state.viewingResult);

    const layerOpacity = useMapStore(state => state.layerOpacity);
    const setLayerOpacity = useMapStore(state => state.setLayerOpacity);
    const showFloodPng = useMapStore(state => state.showFloodPng);
    const setShowFloodPng = useMapStore(state => state.setShowFloodPng);
    const showFloodGeoJson = useMapStore(state => state.showFloodGeoJson);
    const setShowFloodGeoJson = useMapStore(state => state.setShowFloodGeoJson);

    const showPermanentWater = useMapStore(state => state.showPermanentWater);
    const setShowPermanentWater = useMapStore(state => state.setShowPermanentWater);

    const showHighConf = useMapStore(state => state.showHighConf);
    const setShowHighConf = useMapStore(state => state.setShowHighConf);

    const showMedConf = useMapStore(state => state.showMedConf);
    const setShowMedConf = useMapStore(state => state.setShowMedConf);

    const showLowConf = useMapStore(state => state.showLowConf);
    const setShowLowConf = useMapStore(state => state.setShowLowConf);
    const [isOpen, setIsOpen] = useState(false);

    // Only render when on flood profile map view with an active flood result
    if (profile !== 'flood' || activeView !== 'map' || !viewingResult || viewingResult.pipeline !== 'flood') {
        return null;
    }

    const layers = [
        { label: 'Raster preview (PNG)', color: '#d8dbe0', value: showFloodPng, onChange: () => setShowFloodPng(!showFloodPng) },
        { label: 'Flood polygons (GeoJSON)', color: '#f3a35c', value: showFloodGeoJson, onChange: () => setShowFloodGeoJson(!showFloodGeoJson) },
        { label: 'Permanent Water', color: '#2166c1', value: showPermanentWater, onChange: () => setShowPermanentWater(!showPermanentWater) },
        { label: 'High Conf', color: '#00a6c7', value: showHighConf, onChange: () => setShowHighConf(!showHighConf) },
        { label: 'Med Conf', color: '#42c6d5', value: showMedConf, onChange: () => setShowMedConf(!showMedConf) },
        { label: 'Low Conf', color: '#91d9dc', value: showLowConf, onChange: () => setShowLowConf(!showLowConf) },
    ];

    return (
        <div className="nisar-layer-controls" style={{
            position: 'absolute',
            top: '54px',
            left: `calc(${TM.side}px + 12px)`,
            zIndex: 1000,
            fontFamily: MONO,
        }}>
            <button
                type="button"
                aria-expanded={isOpen}
                aria-controls="flood-layer-controls"
                onClick={() => setIsOpen(value => !value)}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    minHeight: '34px',
                    padding: '0 11px',
                    color: isOpen ? '#f4fafc' : C.textMid,
                    background: isOpen ? 'rgba(7, 32, 42, 0.96)' : 'rgba(7, 20, 28, 0.88)',
                    border: `1px solid ${isOpen ? 'rgba(66, 198, 213, .55)' : 'rgba(255, 255, 255, .14)'}`,
                    boxShadow: '0 8px 22px rgba(0, 0, 0, .28)',
                    backdropFilter: 'blur(10px)',
                    cursor: 'pointer',
                    font: 'inherit',
                    fontSize: '9px',
                    letterSpacing: '.12em',
                }}
            >
                <Layers size={14} color={C.accent.flood} />
                <span>LAYERS</span>
                {isOpen ? <X size={13} /> : <span style={{ color: C.textDim }}>·</span>}
            </button>

            {isOpen && <div
                id="flood-layer-controls"
                style={{
            marginTop: '7px',
            width: '220px',
            background: 'rgba(7, 20, 28, 0.96)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            border: '1px solid rgba(66, 198, 213, 0.24)',
            padding: '12px 14px',
            boxSizing: 'border-box',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
        }}>
            {/* Header */}
            <div style={{
                fontSize: '9px',
                color: C.textDim,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                marginBottom: '10px',
                fontWeight: 700,
            }}>
                LAYER CONTROLS
            </div>

            {/* Overlay Opacity Slider */}
            <div style={{ marginBottom: '12px' }}>
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '9px',
                    color: C.textMid,
                    marginBottom: '6px',
                    letterSpacing: '0.04em',
                }}>
                    <span>OVERLAY OPACITY</span>
                    <span style={{ color: C.accent.flood, fontWeight: 700 }}>
                        {Math.round(layerOpacity * 100)}%
                    </span>
                </div>
                <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={layerOpacity}
                    onChange={(e) => setLayerOpacity(parseFloat(e.target.value))}
                    style={{
                        width: '100%',
                        height: '4px',
                        background: '#2A2A2A',
                        borderRadius: '2px',
                        outline: 'none',
                        cursor: 'pointer',
                        accentColor: C.accent.flood,
                        display: 'block',
                    }}
                />
            </div>

            {/* Divider */}
            <div style={{ height: '1px', background: 'rgba(255, 255, 255, 0.06)', margin: '10px 0' }} />

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '10px', color: C.textDim, fontSize: '9px' }}>
                <span>GeoTIFF classification raster</span>
                {viewingResult?.floodReportPath && (
                    <a
                        href={api(viewingResult.floodReportPath.replace(/\.json$/, '_class.tif'))}
                        download
                        title="Download authoritative GeoTIFF raster"
                        style={{ display: 'inline-flex', color: C.textMid }}
                    >
                        <Download size={13} />
                    </a>
                )}
            </div>

            {/* Classification Layer Toggles */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {layers.map((layer) => (
                    <div
                        key={layer.label}
                        onClick={layer.onChange}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '4px 0',
                            cursor: 'pointer',
                            userSelect: 'none',
                        }}
                    >
                        {/* Label with colored dot */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                            <span style={{
                                width: '6px',
                                height: '6px',
                                borderRadius: '50%',
                                background: layer.color,
                                display: 'inline-block',
                                opacity: layer.value ? 1 : 0.35,
                                boxShadow: layer.value ? `0 0 6px ${layer.color}` : 'none',
                            }} />
                            <span style={{
                                fontSize: '10px',
                                color: layer.value ? C.text : C.textDim,
                                transition: 'color 150ms ease',
                            }}>
                                {layer.label}
                            </span>
                        </div>

                        {/* Custom Tactical Switch */}
                        <div style={{
                            width: '24px',
                            height: '12px',
                            borderRadius: '6px',
                            background: layer.value ? C.accent.flood : '#333333',
                            position: 'relative',
                            display: 'flex',
                            alignItems: 'center',
                            padding: '0 2px',
                            transition: 'background 150ms ease',
                            boxSizing: 'border-box',
                        }}>
                            <div style={{
                                width: '8px',
                                height: '8px',
                                borderRadius: '50%',
                                background: '#FFFFFF',
                                transform: layer.value ? 'translateX(12px)' : 'translateX(0px)',
                                transition: 'transform 150ms cubic-bezier(0.4, 0, 0.2, 1)',
                                boxShadow: '0 1px 2px rgba(0, 0, 0, 0.4)',
                            }} />
                        </div>
                    </div>
                ))}
            </div>
            </div>}
        </div>
    );
}
