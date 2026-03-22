import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapContainer, TileLayer, ImageOverlay, GeoJSON, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Terminal, Crosshair, Play, ChevronDown, CheckCircle, AlertTriangle, Loader, FileText, Settings, Activity, Database, ShieldAlert, Cpu } from 'lucide-react';

// Maps hook to auto-center when region changes
function MapFlyTo({ center }) {
    const map = useMap();
    useEffect(() => {
        if (center) map.flyTo([center.lat, center.lon], 6, { duration: 1.5 });
    }, [center, map]);
    return null;
}

// Maps hook for live coordinates HUD
function LiveCoordinates({ setCoords }) {
    useMapEvents({
        mousemove(e) {
            setCoords({ lat: e.latlng.lat.toFixed(4), lon: e.latlng.lng.toFixed(4) });
        }
    });
    return null;
}

function AppDashboard() {
    // --- Configuration State ---
    const presetRegions = [
        { id: 'san_andreas', name: 'SAN_ANDREAS_FAULT', bounds: [[35.5, -121.0], [36.0, -120.0]], lat: 35.8, lon: -120.5 },
        { id: 'amazon', name: 'AMAZON_BASIN', bounds: [[-3.5, -60.5], [-3.0, -60.0]], lat: -3.2, lon: -60.2 },
        { id: 'gulf_mexico', name: 'GULF_OF_MEXICO', bounds: [[28.5, -90.5], [29.0, -90.0]], lat: 28.8, lon: -90.2 },
        { id: 'synthetic', name: 'SYNTHETIC_TARGET_01', bounds: [[28.5, -0.6], [28.8, -0.4]], lat: 28.65, lon: -0.53 }
    ];

    const [selectedRegion, setSelectedRegion] = useState(presetRegions[3]);
    const [analysisPurpose, setAnalysisPurpose] = useState('MARITIME_SURVEILLANCE');
    const [processingPipeline, setProcessingPipeline] = useState('STANDARD_RDA');
    const [mlModels, setMlModels] = useState({ shipDetection: true, floodMask: false });
    const [mouseCoords, setMouseCoords] = useState({ lat: '0.0000', lon: '0.0000' });
    
    // Remote Volume Configuration
    const [dataSourceType, setDataSourceType] = useState('SYNTHETIC_SIGNAL');
    const [dataSourceUri, setDataSourceUri] = useState('internal://generate_test_pattern');

    // Jobs State
    const [jobs, setJobs] = useState({});
    const [activeJobId, setActiveJobId] = useState(null);

    // Terminal & Result State
    const [terminalOpen, setTerminalOpen] = useState(false);
    const [logs, setLogs] = useState({});
    const terminalRef = useRef(null);
    const [viewingResult, setViewingResult] = useState(null);

    // --- Start Processing Job ---
    const startJob = async () => {
        try {
            const res = await fetch('http://localhost:3000/jobs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    input_file: dataSourceType === 'SYNTHETIC_SIGNAL' ? null : dataSourceUri,
                    synthetic: dataSourceType === 'SYNTHETIC_SIGNAL' 
                }) 
            });
            const data = await res.json();
            const id = data.job_id;
            
            setJobs(prev => ({ 
                ...prev, 
                [id]: { 
                    id, 
                    status: 'running', 
                    name: `${selectedRegion.name}_ANALYSIS`,
                    bounds: selectedRegion.bounds
                } 
            }));
            setLogs(prev => ({ ...prev, [id]: [] }));
            setActiveJobId(id);
            setTerminalOpen(true);
            
            // Connect SSE
            const sse = new EventSource(`http://localhost:3000/jobs/${id}/logs`);
            sse.onmessage = (e) => {
                const line = e.data;
                setLogs(prev => ({
                    ...prev,
                    [id]: [...(prev[id] || []), line]
                }));
                if (terminalRef.current) {
                    terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
                }
                
                if (line.includes('[SYSTEM] PROCESS_COMPLETED') || line.includes('[SYSTEM] PROCESS_FAILED')) {
                    sse.close();
                }
            };
        } catch (err) {
            console.error(err);
        }
    };

    // --- Poll Job Status ---
    useEffect(() => {
        const activeIds = Object.keys(jobs).filter(id => jobs[id].status === 'running' || jobs[id].status === 'queued');
        if (activeIds.length === 0) return;

        const interval = setInterval(async () => {
            for (const id of activeIds) {
                try {
                    const res = await fetch(`http://localhost:3000/jobs/${id}`);
                    const data = await res.json();
                    
                    if (data.status === 'completed' && jobs[id].status !== 'completed') {
                        setViewingResult({
                            url: `http://localhost:3000${data.output_path}`,
                            bounds: jobs[id].bounds
                        });
                    }
                    
                    setJobs(prev => ({
                        ...prev,
                        [id]: { ...prev[id], status: data.status, output_path: data.output_path }
                    }));
                } catch(e) {}
            }
        }, 3000);
        return () => clearInterval(interval);
    }, [jobs]);

    return (
        <div style={{ display: 'flex', width: '100%', height: '100vh', backgroundColor: '#000000', color: '#e2e8f0', fontFamily: '"Inter", sans-serif', overflow: 'hidden' }}>
            
            {/* 1. LEFT NAVIGATION DASHBOARD (Thin strip) */}
            <div style={{ width: '60px', borderRight: '1px solid #1e293b', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 0', background: '#050505', zIndex: 10 }}>
                <div style={{ color: '#0ea5e9', marginBottom: '40px' }}><Crosshair size={24} /></div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '30px', color: '#64748b' }}>
                    <Activity size={20} style={{ cursor: 'pointer', color: '#e2e8f0' }} />
                    <Database size={20} style={{ cursor: 'pointer' }} />
                    <Cpu size={20} style={{ cursor: 'pointer' }} />
                    <Settings size={20} style={{ cursor: 'pointer' }} />
                </div>
            </div>

            {/* 2. CENTRAL VIEWER (Map + HUD) */}
            <div style={{ flex: 1, position: 'relative', background: '#020617' }}>
                <MapContainer 
                    center={[selectedRegion.lat, selectedRegion.lon]} 
                    zoom={6} 
                    style={{ height: '100%', width: '100%', cursor: 'crosshair', filter: 'grayscale(100%) contrast(1.2) brightness(0.8)' }}
                    zoomControl={false}
                    attributionControl={false}
                >
                    <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}" />
                    <MapFlyTo center={selectedRegion} />
                    <LiveCoordinates setCoords={setMouseCoords} />

                    {viewingResult && (
                        <ImageOverlay
                            url={viewingResult.url}
                            bounds={viewingResult.bounds}
                            opacity={0.85}
                        />
                    )}
                </MapContainer>

                {/* HUD Overlay - Grid Lines */}
                <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'linear-gradient(rgba(14, 165, 233, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(14, 165, 233, 0.03) 1px, transparent 1px)', backgroundSize: '100px 100px', zIndex: 400 }} />

                {/* HUD Overlay - Center Crosshair */}
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', pointerEvents: 'none', zIndex: 400, opacity: 0.5 }}>
                    <div style={{ width: '40px', height: '1px', background: '#0ea5e9', position: 'absolute', top: '0', left: '-20px' }} />
                    <div style={{ width: '1px', height: '40px', background: '#0ea5e9', position: 'absolute', top: '-20px', left: '0' }} />
                    <div style={{ width: '8px', height: '8px', border: '1px solid #0ea5e9', borderRadius: '50%', position: 'absolute', top: '-4px', left: '-4px' }} />
                </div>

                {/* HUD Overlay - Coordinates */}
                <div style={{ position: 'absolute', bottom: '20px', left: '20px', zIndex: 1000, fontFamily: '"JetBrains Mono", monospace', fontSize: '0.75rem', color: '#0ea5e9', display: 'flex', gap: '16px', background: 'rgba(2, 6, 23, 0.7)', padding: '6px 12px', border: '1px solid #1e293b', backdropFilter: 'blur(4px)' }}>
                    <span>LAT: {mouseCoords.lat}°</span>
                    <span>LON: {mouseCoords.lon}°</span>
                    <span style={{ color: '#64748b' }}>| SYS: ALIVE</span>
                </div>

                {/* Global Status Header */}
                <div style={{ position: 'absolute', top: '20px', left: '20px', zIndex: 1000, background: 'rgba(2, 6, 23, 0.8)', border: '1px solid #1e293b', padding: '12px 20px', backdropFilter: 'blur(4px)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '2px', color: '#0ea5e9', fontFamily: '"JetBrains Mono", monospace' }}>NISAR_PRO // TACTICAL VIEW</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 300, color: '#f8fafc', letterSpacing: '1px' }}>GLOBAL ORBITAL GRID</div>
                </div>

                {/* Render Result Overlay Card */}
                <AnimatePresence>
                    {viewingResult && (
                        <motion.div 
                            initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                            style={{ position: 'absolute', top: '100px', left: '20px', zIndex: 1000, background: 'rgba(2, 6, 23, 0.85)', padding: '16px 20px', border: '1px solid #0ea5e9', backdropFilter: 'blur(8px)', width: '320px', fontFamily: '"JetBrains Mono", monospace' }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                                <div style={{ width: '8px', height: '8px', background: '#10b981', borderRadius: '50%', boxShadow: '0 0 8px #10b981' }} />
                                <span style={{ fontWeight: 600, fontSize: '0.85rem', color: '#e2e8f0', letterSpacing: '1px' }}>DATA.RENDER_COMPLETE</span>
                            </div>
                            <div style={{ fontSize: '0.7rem', color: '#64748b', marginBottom: '4px' }}>FILE: {viewingResult.url.split('/').pop()}</div>
                            <div style={{ fontSize: '0.7rem', color: '#0ea5e9', marginBottom: '16px' }}>PIPELINE: {processingPipeline}</div>
                            
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px', fontSize: '0.65rem' }}>
                                <div style={{ background: '#0f172a', padding: '6px', border: '1px solid #1e293b' }}>
                                    <div style={{ color: '#64748b', marginBottom: '2px' }}>BACKSCATTER</div>
                                    <div style={{ color: '#f8fafc' }}>CALIBRATED</div>
                                </div>
                                <div style={{ background: '#0f172a', padding: '6px', border: '1px solid #1e293b' }}>
                                    <div style={{ color: '#64748b', marginBottom: '2px' }}>RESOLUTION</div>
                                    <div style={{ color: '#f8fafc' }}>&lt; 10M / PX</div>
                                </div>
                            </div>

                            <button onClick={() => setViewingResult(null)} style={{ background: 'transparent', border: '1px solid #ef4444', color: '#ef4444', padding: '6px 0', fontSize: '0.7rem', width: '100%', cursor: 'pointer', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', transition: 'all 0.2s' }} onMouseOver={e=> {e.target.style.background = 'rgba(239, 68, 68, 0.1)'}} onMouseOut={e=> {e.target.style.background = 'transparent'}}>
                                CLEAR_OVERLAY
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* 3. RIGHT PANEL (Mission Control Inspector) */}
            <div style={{ width: '420px', borderLeft: '1px solid #1e293b', background: '#020617', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
                
                {/* Header */}
                <div style={{ padding: '20px 24px', borderBottom: '1px solid #1e293b', background: '#0f172a' }}>
                    <div style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '2px', color: '#64748b', fontFamily: '"JetBrains Mono", monospace', marginBottom: '4px' }}>TELEMETRY & COMMAND</div>
                    <div style={{ fontSize: '1.1rem', color: '#f8fafc', fontWeight: 400, letterSpacing: '0.5px' }}>MISSION_PARAMETERS</div>
                </div>
                
                {/* Configuration Section */}
                <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    
                    {/* Region */}
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <label style={{ fontSize: '0.65rem', fontWeight: 600, color: '#94a3b8', letterSpacing: '1px', fontFamily: '"JetBrains Mono", monospace' }}>TARGET_AREA</label>
                            <span style={{ fontSize: '0.65rem', color: '#0ea5e9', fontFamily: '"JetBrains Mono", monospace' }}>[LOCKED]</span>
                        </div>
                        <select 
                            value={selectedRegion.id}
                            onChange={e => setSelectedRegion(presetRegions.find(p => p.id === e.target.value))}
                            style={{ width: '100%', padding: '10px 12px', background: 'transparent', border: '1px solid #334155', color: '#f8fafc', fontSize: '0.85rem', fontFamily: '"JetBrains Mono", monospace', outline: 'none', appearance: 'none' }}
                        >
                            {presetRegions.map(r => (
                                <option key={r.id} value={r.id} style={{ background: '#0f172a' }}>{r.name}</option>
                            ))}
                        </select>
                        <div style={{ fontSize: '0.65rem', color: '#475569', marginTop: '6px', fontFamily: '"JetBrains Mono", monospace' }}>BOUNDS: {selectedRegion.bounds[0].map(v => v.toFixed(2)).join(',')} : {selectedRegion.bounds[1].map(v => v.toFixed(2)).join(',')}</div>
                    </div>

                    {/* Purpose */}
                    <div>
                        <label style={{ fontSize: '0.65rem', fontWeight: 600, color: '#94a3b8', letterSpacing: '1px', fontFamily: '"JetBrains Mono", monospace', marginBottom: '8px', display: 'block' }}>ANALYSIS_PURPOSE</label>
                        <select 
                            value={analysisPurpose}
                            onChange={e => setAnalysisPurpose(e.target.value)}
                            style={{ width: '100%', padding: '10px 12px', background: '#0f172a', border: '1px solid #334155', color: '#f8fafc', fontSize: '0.85rem', fontFamily: '"JetBrains Mono", monospace', outline: 'none', appearance: 'none' }}
                        >
                            <option value="AGRICULTURE">AGRICULTURE_YIELD_01</option>
                            <option value="MARITIME_SURVEILLANCE">MARITIME_SURVEILLANCE_OP</option>
                            <option value="URBAN_PLANNING">URBAN_SUBSIDENCE_TRACK</option>
                            <option value="FLOOD_DETECTION">FLOOD_DETECTION_MASK</option>
                        </select>
                    </div>

                    {/* Pipeline */}
                    <div>
                        <label style={{ fontSize: '0.65rem', fontWeight: 600, color: '#94a3b8', letterSpacing: '1px', fontFamily: '"JetBrains Mono", monospace', marginBottom: '8px', display: 'block' }}>K8S_PROCESSING_PIPELINE</label>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '6px' }}>
                            {['STANDARD_RDA', 'INSAR_C_BAND', 'POLSAR_QUAD'].map(pipe => (
                                <div key={pipe} onClick={() => setProcessingPipeline(pipe)} style={{ padding: '8px 12px', background: processingPipeline === pipe ? 'rgba(14, 165, 233, 0.1)' : 'transparent', border: processingPipeline === pipe ? '1px solid #0ea5e9' : '1px solid #1e293b', color: processingPipeline === pipe ? '#0ea5e9' : '#64748b', fontSize: '0.75rem', fontFamily: '"JetBrains Mono", monospace', cursor: 'pointer', transition: 'all 0.2s' }}>
                                    &gt; {pipe}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* ML Models */}
                    <div>
                        <label style={{ fontSize: '0.65rem', fontWeight: 600, color: '#94a3b8', letterSpacing: '1px', fontFamily: '"JetBrains Mono", monospace', marginBottom: '8px', display: 'block' }}>ML_INFERENCE_MODELS</label>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                            <div onClick={() => setMlModels({...mlModels, shipDetection: !mlModels.shipDetection})} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', background: mlModels.shipDetection ? '#1e293b' : 'transparent', border: mlModels.shipDetection ? '1px solid #64748b' : '1px solid #1e293b', cursor: 'pointer', transition: 'all 0.2s' }}>
                                <div style={{ width: '12px', height: '12px', background: mlModels.shipDetection ? '#10b981' : 'transparent', border: '1px solid #10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }} />
                                <span style={{ fontSize: '0.7rem', color: mlModels.shipDetection ? '#f8fafc' : '#64748b', fontFamily: '"JetBrains Mono", monospace' }}>SHIP_DETECT_V2</span>
                            </div>
                            <div onClick={() => setMlModels({...mlModels, floodMask: !mlModels.floodMask})} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', background: mlModels.floodMask ? '#1e293b' : 'transparent', border: mlModels.floodMask ? '1px solid #64748b' : '1px solid #1e293b', cursor: 'pointer', transition: 'all 0.2s' }}>
                                <div style={{ width: '12px', height: '12px', background: mlModels.floodMask ? '#10b981' : 'transparent', border: '1px solid #10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }} />
                                <span style={{ fontSize: '0.7rem', color: mlModels.floodMask ? '#f8fafc' : '#64748b', fontFamily: '"JetBrains Mono", monospace' }}>FLOOD_MASK_AI</span>
                            </div>
                        </div>
                    </div>

                    {/* Data Source Mount */}
                    <div>
                        <label style={{ fontSize: '0.65rem', fontWeight: 600, color: '#94a3b8', letterSpacing: '1px', fontFamily: '"JetBrains Mono", monospace', marginBottom: '8px', display: 'block' }}>DATA_SOURCE_MOUNT // STORAGE_VOLUME</label>
                        <select 
                            value={dataSourceType}
                            onChange={e => {
                                setDataSourceType(e.target.value);
                                if (e.target.value === 'SYNTHETIC_SIGNAL') setDataSourceUri('internal://generate_test_pattern');
                                else if (e.target.value === 'NASA_EARTHDATA_S3') setDataSourceUri('s3://nasa-asf-cumulus/sentinel-1/SLC/NisarpRSLCHDF5.h5');
                                else setDataSourceUri('/mnt/k8s/pvc-nisar-data/RSLC/NisarpRSLCHDF5.h5');
                            }}
                            style={{ width: '100%', padding: '10px 12px', background: '#0f172a', border: '1px solid #334155', color: '#f8fafc', fontSize: '0.85rem', fontFamily: '"JetBrains Mono", monospace', outline: 'none', appearance: 'none', marginBottom: '6px' }}
                        >
                            <option value="SYNTHETIC_SIGNAL">[INTERNAL] SYNTHETIC_SCATTER_TEST</option>
                            <option value="NASA_EARTHDATA_S3">[REMOTE_S3] NASA_EARTHDATA_ASF</option>
                            <option value="LOCAL_K8S_PVC">[NFS_VOLUME] K8S_PERSISTENT_CLAIM</option>
                        </select>
                        <input 
                            type="text"
                            value={dataSourceUri}
                            onChange={e => setDataSourceUri(e.target.value)}
                            disabled={dataSourceType === 'SYNTHETIC_SIGNAL'}
                            style={{ width: '100%', padding: '8px 12px', background: dataSourceType === 'SYNTHETIC_SIGNAL' ? 'rgba(15, 23, 42, 0.5)' : '#0f172a', border: '1px solid #334155', color: dataSourceType === 'SYNTHETIC_SIGNAL' ? '#475569' : '#0ea5e9', fontSize: '0.75rem', fontFamily: '"JetBrains Mono", monospace', outline: 'none' }}
                            placeholder="s3:// or /mnt/ absolute URI"
                        />
                    </div>

                    {/* Run Button */}
                    <button 
                        onClick={startJob} 
                        style={{ background: '#0ea5e9', color: '#fff', padding: '14px', border: 'none', fontSize: '0.85rem', fontFamily: '"JetBrains Mono", monospace', letterSpacing: '1px', fontWeight: 600, cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px', marginTop: '10px', textTransform: 'uppercase' }}
                        onMouseOver={e=> {e.target.style.background = '#0284c7'}} onMouseOut={e=> {e.target.style.background = '#0ea5e9'}}
                    >
                        <Play size={16} fill="#fff" /> INITIATE_ORBITAL_SCAN
                    </button>
                    <div style={{ textAlign: 'center', fontSize: '0.6rem', color: '#475569', fontFamily: '"JetBrains Mono", monospace' }}>WARNING: CONSUMES CLUSTER COMPUTE CREDITS</div>
                </div>

                {/* Job Tracking Section */}
                <div style={{ padding: '0 24px 24px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ paddingBottom: '12px', borderBottom: '1px solid #1e293b', marginBottom: '16px' }}>
                        <label style={{ fontSize: '0.65rem', fontWeight: 600, color: '#94a3b8', letterSpacing: '1px', fontFamily: '"JetBrains Mono", monospace' }}>ACTIVE_WORKLOADS // K8S</label>
                    </div>

                    {Object.values(jobs).length === 0 ? (
                        <div style={{ padding: '30px 20px', textAlign: 'center', color: '#475569', fontSize: '0.75rem', fontFamily: '"JetBrains Mono", monospace', border: '1px dashed #1e293b' }}>
                            [NO_ACTIVE_DEPLOYMENTS]
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {Object.values(jobs).map(job => (
                                <div key={job.id} 
                                    onClick={() => { setActiveJobId(job.id); setTerminalOpen(true); }}
                                    style={{ background: '#0f172a', border: '1px solid', borderColor: activeJobId === job.id ? '#0ea5e9' : '#1e293b', padding: '16px', cursor: 'pointer', position: 'relative', overflow: 'hidden' }}
                                >
                                    {/* Scanning background effect for running jobs */}
                                    {job.status === 'running' && (
                                        <motion.div animate={{ y: ['-100%', '200%'] }} transition={{ repeat: Infinity, duration: 2, ease: 'linear' }} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '50px', background: 'linear-gradient(to bottom, transparent, rgba(14, 165, 233, 0.05), transparent)', pointerEvents: 'none' }} />
                                    )}

                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                                        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#f8fafc', wordBreak: 'break-all', fontFamily: '"JetBrains Mono", monospace' }}>{job.name}</div>
                                        {job.status === 'running' ? <Loader className="animate-spin" size={16} color="#0ea5e9" /> :
                                         job.status === 'completed' ? <CheckCircle size={16} color="#10b981" /> :
                                         <AlertTriangle size={16} color="#ef4444" />}
                                    </div>
                                    <div style={{ fontSize: '0.65rem', color: '#64748b', fontFamily: '"JetBrains Mono", monospace', marginBottom: '16px' }}>TX_ID: {job.id.split('-')[0].toUpperCase()}</div>
                                    
                                    {/* Action Buttons for Completed Jobs */}
                                    {job.status === 'completed' && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            <button onClick={(e) => { e.stopPropagation(); setViewingResult({ url: `http://localhost:3000${job.output_path}`, bounds: job.bounds }); }} style={{ width: '100%', padding: '10px', background: 'transparent', color: '#10b981', border: '1px solid #10b981', fontSize: '0.7rem', fontFamily: '"JetBrains Mono", monospace', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', letterSpacing: '1px' }} onMouseOver={e=> {e.target.style.background = 'rgba(16, 185, 129, 0.1)'}} onMouseOut={e=> {e.target.style.background = 'transparent'}}>
                                                MOUNT_VISUAL_OVERLAY
                                            </button>
                                            <button onClick={(e) => { e.stopPropagation(); alert('PDF Report Compilation Triggered.'); }} style={{ width: '100%', padding: '10px', background: '#0f172a', color: '#e2e8f0', border: '1px solid #334155', fontSize: '0.7rem', fontFamily: '"JetBrains Mono", monospace', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', transition: 'all 0.2s', letterSpacing: '1px' }} onMouseOver={e=> {e.target.style.background = '#1e293b'}} onMouseOut={e=> {e.target.style.background = '#0f172a'}}>
                                                <FileText size={14} /> EXPORT_INTEL_PDF
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* 4. BLACK OPS TERMINAL */}
            <AnimatePresence>
                {terminalOpen && activeJobId && (
                    <motion.div
                        initial={{ opacity: 0, y: 100 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 100 }}
                        transition={{ type: 'spring', damping: 30, stiffness: 400 }}
                        style={{
                            position: 'absolute', bottom: '0', left: '60px', right: '420px', height: '300px',
                            background: 'rgba(0, 0, 0, 0.95)', borderTop: '1px solid #0ea5e9',
                            zIndex: 1000, display: 'flex', flexDirection: 'column', backdropFilter: 'blur(10px)'
                        }}
                    >
                        {/* Terminal Header */}
                        <div style={{ padding: '8px 16px', background: '#020617', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#0ea5e9', fontSize: '0.7rem', fontFamily: '"JetBrains Mono", monospace', letterSpacing: '1px' }}>
                                <Terminal size={14} /> KUBE_RS_STREAM :: {activeJobId.split('-')[0].toUpperCase()}
                                <span style={{ padding: '2px 6px', background: 'rgba(14, 165, 233, 0.1)', border: '1px solid #0ea5e9', color: '#0ea5e9', fontSize: '0.6rem', marginLeft: '10px' }}>LIVE</span>
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button onClick={() => setTerminalOpen(false)} style={{ background: 'transparent', border: '1px solid #334155', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}>
                                    <ChevronDown size={14} />
                                </button>
                            </div>
                        </div>
                        {/* Terminal Output */}
                        <div ref={terminalRef} style={{ flex: 1, padding: '16px', overflowY: 'auto', fontFamily: '"JetBrains Mono", Consolas, monospace', fontSize: '0.75rem', color: '#cbd5e1', lineHeight: 1.6 }}>
                            {(!logs[activeJobId] || logs[activeJobId].length === 0) ? (
                                <div style={{ color: '#475569', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ display: 'inline-block', width: '8px', height: '14px', background: '#0ea5e9', animation: 'blink 1s step-end infinite' }} />
                                    AWAITING_POD_SCHEDULING...
                                </div>
                            ) : (
                                logs[activeJobId].map((line, idx) => {
                                    const isError = line.includes('ERROR') || line.includes('Failed') || line.includes('FAILED');
                                    const isSuccess = line.includes('✓') || line.includes('COMPLETED');
                                    const isSys = line.includes('[SYSTEM]');
                                    
                                    return (
                                        <div key={idx} style={{ 
                                            color: isError ? '#ef4444' : isSuccess ? '#10b981' : isSys ? '#0ea5e9' : '#cbd5e1',
                                            wordBreak: 'break-all',
                                            paddingLeft: '16px',
                                            textIndent: '-16px'
                                        }}>
                                            <span style={{ color: '#475569', marginRight: '8px' }}>&gt;</span>
                                            {line}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                        <style dangerouslySetInnerHTML={{__html: `
                            @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
                            ::-webkit-scrollbar { width: 8px; height: 8px; }
                            ::-webkit-scrollbar-track { background: #020617; border-left: 1px solid #1e293b; }
                            ::-webkit-scrollbar-thumb { background: #334155; }
                            ::-webkit-scrollbar-thumb:hover { background: #475569; }
                        `}} />
                    </motion.div>
                )}
            </AnimatePresence>
            
            {/* Terminal minimized indicator */}
            {!terminalOpen && activeJobId && (
                <motion.button
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    onClick={() => setTerminalOpen(true)}
                    style={{ position: 'absolute', bottom: '20px', left: '80px', background: '#020617', color: '#0ea5e9', border: '1px solid #0ea5e9', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', zIndex: 1000, fontSize: '0.7rem', fontWeight: 600, fontFamily: '"JetBrains Mono", monospace', letterSpacing: '1px', textTransform: 'uppercase' }}
                >
                    <Terminal size={14} /> EXPAN_TELEMETRY_DATALINK [{logs[activeJobId]?.length || 0}]
                    {jobs[activeJobId]?.status === 'running' && <Loader className="animate-spin" size={12} />}
                </motion.button>
            )}
        </div>
    );
}

export default AppDashboard;
