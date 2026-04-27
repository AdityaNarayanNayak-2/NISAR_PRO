import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapContainer, TileLayer, ImageOverlay, GeoJSON, CircleMarker, Popup, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { api, getGatewayUrl } from '../../config/api';
import { Terminal, Play, ChevronDown, CheckCircle, AlertTriangle, Loader, Search, FolderOpen, Satellite, Eye, Download, ArrowLeft, MapPin, Calendar, Layers, X, Anchor, Crosshair, Waves, Palette, WifiOff, Clock, Info, Ship } from 'lucide-react';

// --- Map Utility Hooks ---
function MapFlyTo({ center }) {
    const map = useMap();
    useEffect(() => {
        if (center) map.flyTo(center, 8, { duration: 1.5 });
    }, [center, map]);
    return null;
}

function MapEventTracker({ setCoords, setMapBounds }) {
    const map = useMap();
    useMapEvents({
        mousemove(e) {
            setCoords({ lat: e.latlng.lat.toFixed(4), lon: e.latlng.lng.toFixed(4) });
        },
        moveend(e) {
            setMapBounds(e.target.getBounds());
        }
    });
    useEffect(() => {
        setMapBounds(map.getBounds());
    }, [map]);
    return null;
}

// --- Parse NISAR Filename into Metadata ---
function parseNisarFilename(filepath) {
    if (!filepath) return null;
    const fname = filepath.split('/').pop();
    // NISAR naming: NISAR_L{level}_{mode}_{product}_{cycle}_{track}_{dir}_{frame}_{...}_{date}T{time}_{...}.h5
    const parts = fname.split('_');
    if (parts.length < 10 || !parts[0].startsWith('NISAR')) return null;

    const level = parts[1]; // L1, L2
    const mode = parts[2];  // PR
    const product = parts[3]; // RSLC, GCOV, GSLC, GUNW
    const direction = parts[6]; // D=Descending, A=Ascending
    const dateStr = parts.find(p => /^\d{8}T\d{6}$/.test(p));

    const productNames = {
        RSLC: 'Range-compressed SLC',
        GSLC: 'Geocoded SLC',
        GCOV: 'Geocoded Covariance',
        GUNW: 'Unwrapped Interferogram',
    };

    const levelNames = { L1: 'Level-1', L2: 'Level-2', L0: 'Level-0' };

    let acqDate = null;
    if (dateStr) {
        const y = dateStr.slice(0, 4);
        const m = dateStr.slice(4, 6);
        const d = dateStr.slice(6, 8);
        acqDate = `${y}-${m}-${d}`;
    }

    return {
        mission: 'NISAR (NASA/ISRO)',
        level: levelNames[level] || level,
        product: product,
        productFull: productNames[product] || product,
        mode: mode === 'PR' ? 'L-Band + S-Band' : mode,
        band: 'L-Band (1.26 GHz)',
        direction: direction === 'D' ? 'Descending' : direction === 'A' ? 'Ascending' : direction,
        acquisitionDate: acqDate,
        filename: fname,
    };
}

// --- Shared Styles ---
const panelStyle = {
    position: 'absolute', top: '16px', left: '16px', bottom: '16px',
    width: '380px', zIndex: 800,
    background: 'rgba(2, 6, 23, 0.92)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
    border: '1px solid rgba(30, 41, 59, 0.8)', borderRadius: '12px',
    display: 'flex', flexDirection: 'column', overflow: 'hidden',
    boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
};

const sectionLabel = {
    fontSize: '0.6rem', fontWeight: 700, letterSpacing: '1.5px',
    color: '#64748b', textTransform: 'uppercase', marginBottom: '10px',
    fontFamily: '"JetBrains Mono", monospace',
};

const inputStyle = {
    width: '100%', padding: '10px 12px', background: 'rgba(15, 23, 42, 0.8)',
    border: '1px solid #334155', color: '#e2e8f0', fontSize: '0.8rem',
    fontFamily: '"Inter", sans-serif', boxSizing: 'border-box', outline: 'none',
    borderRadius: '6px', transition: 'border-color 0.2s',
};

const btnPrimary = {
    width: '100%', padding: '12px', background: 'linear-gradient(135deg, #2563eb 0%, #0ea5e9 100%)',
    color: '#fff', border: 'none', borderRadius: '8px', fontSize: '0.85rem',
    fontWeight: 600, cursor: 'pointer', display: 'flex', justifyContent: 'center',
    alignItems: 'center', gap: '8px', transition: 'all 0.2s',
    boxShadow: '0 4px 14px rgba(37, 99, 235, 0.3)',
};

const btnSecondary = {
    width: '100%', padding: '10px', background: 'transparent',
    color: '#94a3b8', border: '1px solid #334155', borderRadius: '6px',
    fontSize: '0.8rem', fontWeight: 500, cursor: 'pointer',
    display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px',
    transition: 'all 0.2s',
};

const metaRow = {
    display: 'flex', justifyContent: 'space-between', padding: '4px 0',
    fontSize: '0.65rem', fontFamily: '"JetBrains Mono", monospace',
};

// --- Pipeline icon mapping ---
const pipelineIcons = {
    standard_rda: Crosshair,
    insar: Waves,
    polsar: Palette,
    cfar: Anchor,
};

function AppDashboard() {
    // --- State ---
    const [mouseCoords, setMouseCoords] = useState({ lat: '0.0000', lon: '0.0000' });
    const [mapBounds, setMapBounds] = useState(null);
    const [flyToCenter, setFlyToCenter] = useState(null);

    // Data Source
    const [dataMode, setDataMode] = useState('local'); // 'local' | 'catalog'
    const [localFilePath, setLocalFilePath] = useState('');
    const [selectedScene, setSelectedScene] = useState(null);

    // Catalog Search
    const [startDate, setStartDate] = useState('2026-01-01');
    const [endDate, setEndDate] = useState('2026-06-01');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);

    // Processing
    const [pipeline, setPipeline] = useState('standard_rda');

    // Jobs & Results
    const [jobs, setJobs] = useState({});
    const [activeJobId, setActiveJobId] = useState(null);
    const [terminalOpen, setTerminalOpen] = useState(false);
    const [logs, setLogs] = useState({});
    const terminalRef = useRef(null);
    const [viewingResult, setViewingResult] = useState(null);
    const userScrolledUp = useRef(false);

    // Elapsed time
    const [elapsed, setElapsed] = useState({});

    // Gateway health
    const [gatewayOnline, setGatewayOnline] = useState(true);

    // Error toast
    const [errorToast, setErrorToast] = useState(null);

    // --- Gateway Health Check ---
    useEffect(() => {
        const check = async () => {
            try {
                const res = await fetch(api('/jobs/health-ping'), { signal: AbortSignal.timeout(2000) });
                setGatewayOnline(true);
            } catch {
                // Even a 404 means the server is up
                try {
                    await fetch(api('/'), { signal: AbortSignal.timeout(2000) });
                    setGatewayOnline(true);
                } catch {
                    setGatewayOnline(false);
                }
            }
        };
        check();
        const interval = setInterval(check, 15000);
        return () => clearInterval(interval);
    }, []);

    // --- Elapsed time ticker ---
    useEffect(() => {
        const running = Object.values(jobs).filter(j => j.status === 'running');
        if (running.length === 0) return;
        const interval = setInterval(() => {
            setElapsed(prev => {
                const next = { ...prev };
                for (const j of running) {
                    if (j.startedAt) {
                        next[j.id] = Math.floor((Date.now() - j.startedAt) / 1000);
                    }
                }
                return next;
            });
        }, 1000);
        return () => clearInterval(interval);
    }, [jobs]);

    // --- Parsed metadata ---
    const metadata = parseNisarFilename(localFilePath);

    // --- Helpers ---
    const formatBytes = (bytes) => {
        const b = parseInt(bytes, 10);
        if (isNaN(b) || b === 0) return '0 B';
        const k = 1024, sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(b) / Math.log(k));
        return parseFloat((b / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const formatElapsed = (secs) => {
        if (!secs) return '0s';
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        return m > 0 ? `${m}m ${s}s` : `${s}s`;
    };

    const getInputFile = () => {
        if (dataMode === 'catalog' && selectedScene) return selectedScene.download_url;
        if (dataMode === 'local' && localFilePath) return localFilePath;
        return null;
    };

    const getInputLabel = () => {
        if (dataMode === 'catalog' && selectedScene) return selectedScene.id;
        if (dataMode === 'local' && localFilePath) return localFilePath.split('/').pop();
        return null;
    };

    const showError = useCallback((msg) => {
        setErrorToast(msg);
        setTimeout(() => setErrorToast(null), 5000);
    }, []);

    // --- Catalog Search ---
    const handleSearch = async () => {
        if (!mapBounds) return;
        setIsSearching(true);
        try {
            const bbox = `${mapBounds.getWest()},${mapBounds.getSouth()},${mapBounds.getEast()},${mapBounds.getNorth()}`;
            const res = await fetch(api(`/search/nisar?bbox=${bbox}&start_date=${startDate}T00:00:00Z&end_date=${endDate}T23:59:59Z`));
            const data = await res.json();
            setSearchResults(data);
        } catch (err) {
            console.error('Catalog search failed:', err);
            showError('Catalog search failed — is the gateway running?');
            setSearchResults([]);
        } finally {
            setIsSearching(false);
        }
    };

    // --- Start Job ---
    const startJob = async () => {
        const inputFile = getInputFile();
        if (!inputFile) return;

        if (!gatewayOnline) {
            showError('Gateway is offline. Start it with: LOCAL_MODE=true RUST_LOG=info cargo run --release');
            return;
        }

        try {
            const res = await fetch(api('/jobs'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ input_file: inputFile, synthetic: false, pipeline })
            });
            const data = await res.json();
            const id = data.job_id;

            setJobs(prev => ({
                ...prev,
                [id]: { id, status: 'running', name: getInputLabel(), bounds: null, bbox: null, pipeline, startedAt: Date.now() }
            }));
            setActiveJobId(id);
            setTerminalOpen(true);

            // SSE Log Stream
            const sse = new EventSource(api(`/jobs/${id}/logs`));
            sse.onmessage = (event) => {
                const line = event.data;

                // Parse structured events
                if (line.startsWith('{')) {
                    try {
                        const parsed = JSON.parse(line);
                        if (parsed.event === 'georef' && parsed.bbox) {
                            const { north, south, east, west } = parsed.bbox;
                            if (Math.abs(north - south) > 0.0001 && Math.abs(east - west) > 0.0001) {
                                const bounds = [[south, west], [north, east]];
                                setJobs(prev => ({ ...prev, [id]: { ...prev[id], bounds, bbox: parsed.bbox } }));
                                setFlyToCenter([(north + south) / 2, (east + west) / 2]);
                            }
                        } else if (parsed.event === 'insar_report' && parsed.path) {
                            fetch(api(`/${parsed.path}`))
                                .then(r => r.json())
                                .then(report => {
                                    setJobs(prev => ({ ...prev, [id]: { ...prev[id], insarReport: report } }));
                                })
                                .catch(console.error);
                        } else if (parsed.event === 'ships_detected' && parsed.path) {
                            fetch(api(`/${parsed.path}`))
                                .then(r => r.json())
                                .then(ships => {
                                    setJobs(prev => ({ ...prev, [id]: { ...prev[id], ships } }));
                                })
                                .catch(console.error);
                        }
                    } catch (err) { /* not JSON */ }
                }

                setLogs(prev => ({ ...prev, [id]: [...(prev[id] || []), line] }));

                // Smart scroll: only auto-scroll if user hasn't scrolled up
                if (terminalRef.current && !userScrolledUp.current) {
                    terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
                }

                if (line.includes('[SYSTEM] PROCESS_COMPLETED') || line.includes('[SYSTEM] PROCESS_FAILED')) {
                    sse.close();
                    // Small delay to let async ship/insar fetches land before setting result
                    setTimeout(() => {
                        setJobs(prev => {
                            const job = prev[id];
                            if (job) {
                                const finishedAt = Date.now();
                                const durationSecs = job.startedAt ? Math.floor((finishedAt - job.startedAt) / 1000) : null;
                                setElapsed(e => ({ ...e, [id]: durationSecs }));
                            }
                            return prev;
                        });
                    }, 500);
                }
            };

            sse.onerror = () => {
                showError('Lost connection to processing stream');
                sse.close();
            };
        } catch (err) {
            console.error(err);
            showError('Failed to start job — check gateway connection');
        }
    };

    // --- Refs for interval polling without dependency cycles ---
    const jobsRef = useRef(jobs);
    useEffect(() => { jobsRef.current = jobs; }, [jobs]);

    const elapsedRef = useRef(elapsed);
    useEffect(() => { elapsedRef.current = elapsed; }, [elapsed]);

    // --- Poll Job Status ---
    useEffect(() => {
        const interval = setInterval(async () => {
            const currentJobs = jobsRef.current;
            const activeIds = Object.keys(currentJobs).filter(id => currentJobs[id].status === 'running' || currentJobs[id].status === 'queued');
            if (activeIds.length === 0) return;

            for (const id of activeIds) {
                try {
                    const res = await fetch(api(`/jobs/${id}`));
                    const data = await res.json();

                    if (data.status === 'completed' && currentJobs[id].status !== 'completed') {
                        const jobBounds = currentJobs[id].bounds || (data.bbox ? [[data.bbox.south, data.bbox.west], [data.bbox.north, data.bbox.east]] : null);

                        // Delay slightly to let SSE ship/insar data arrive
                        setTimeout(() => {
                            setViewingResult({
                                url: api(data.output_path),
                                bounds: jobBounds,
                                insarReport: jobsRef.current[id]?.insarReport || null,
                                ships: jobsRef.current[id]?.ships || null,
                                pipeline: jobsRef.current[id]?.pipeline || 'standard_rda',
                                elapsed: elapsedRef.current[id] || null,
                                bbox: jobsRef.current[id]?.bbox || data.bbox || null,
                            });
                        }, 800);
                    }

                    setJobs(prev => ({
                        ...prev,
                        [id]: { ...prev[id], status: data.status, output_path: data.output_path }
                    }));
                } catch (e) {}
            }
        }, 3000);
        return () => clearInterval(interval);
    }, []);


    // --- Terminal scroll detection ---
    const handleTerminalScroll = () => {
        if (!terminalRef.current) return;
        const el = terminalRef.current;
        const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
        userScrolledUp.current = !atBottom;
    };

    const pipelines = [
        { id: 'standard_rda', label: 'Standard SAR Focus', desc: 'Range-Doppler Algorithm with RCMC, speckle filtering, and CLAHE' },
        { id: 'insar', label: 'InSAR Analysis', desc: 'Interferometric comparison of two temporal acquisitions' },
        { id: 'polsar', label: 'Polarimetric', desc: 'Pauli decomposition RGB composite (HH, HV, VV)' },
        { id: 'cfar', label: 'Maritime Intelligence', desc: 'Integral-image CA-CFAR ship detection with geo-located targeting' },
    ];

    const runningJobs = Object.values(jobs).filter(j => j.status === 'running');
    const activeJob = activeJobId ? jobs[activeJobId] : null;
    const shipCount = viewingResult?.ships?.length || 0;

    return (
        <div style={{ width: '100%', height: '100vh', position: 'relative', backgroundColor: '#000', overflow: 'hidden' }}>

            {/* ═══ FULL-SCREEN MAP ═══ */}
            <MapContainer
                center={[28.65, -0.53]}
                zoom={5}
                style={{ width: '100%', height: '100%', cursor: 'crosshair' }}
                zoomControl={false}
                attributionControl={false}
            >
                <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}" />
                <MapEventTracker setCoords={setMouseCoords} setMapBounds={setMapBounds} />
                {flyToCenter && <MapFlyTo center={flyToCenter} />}

                {selectedScene && selectedScene.footprint && (
                    <GeoJSON
                        key={selectedScene.id}
                        data={selectedScene.footprint}
                        style={{ color: '#0ea5e9', weight: 1.5, fillOpacity: 0.08, dashArray: '6' }}
                    />
                )}

                {viewingResult && viewingResult.bounds && (
                    <ImageOverlay url={viewingResult.url} bounds={viewingResult.bounds} opacity={0.65} />
                )}

                {/* InSAR Persistent Scatterer Overlays */}
                {viewingResult && viewingResult.insarReport && viewingResult.insarReport.scatterers && (
                    viewingResult.insarReport.scatterers.map((point, idx) => (
                        <CircleMarker
                            key={`ps-${idx}`}
                            center={[point.lat, point.lon]}
                            radius={4}
                            pathOptions={{
                                color: point.severity === 'CRITICAL' ? '#ef4444' :
                                       point.severity === 'ALERT' ? '#f97316' :
                                       point.severity === 'CAUTION' ? '#eab308' : '#10b981',
                                fillColor: point.severity === 'CRITICAL' ? '#ef4444' :
                                           point.severity === 'ALERT' ? '#f97316' :
                                           point.severity === 'CAUTION' ? '#eab308' : '#10b981',
                                fillOpacity: 0.8,
                                weight: 1
                            }}
                        >
                            <Popup>
                                <div style={{ fontSize: '0.7rem', fontFamily: '"JetBrains Mono"' }}>
                                    <strong style={{ color: '#0f172a' }}>PS Point #{idx}</strong><br/>
                                    Severity: {point.severity}<br/>
                                    Displacement: {point.displacement_mm.toFixed(2)} mm<br/>
                                    Coherence: {point.coherence.toFixed(2)}
                                </div>
                            </Popup>
                        </CircleMarker>
                    ))
                )}

                {/* CFAR Ship Detection Overlays — pulsing rings */}
                {viewingResult && viewingResult.ships && (
                    viewingResult.ships.map((ship, idx) => (
                        <CircleMarker
                            key={`ship-${idx}`}
                            center={[ship.lat, ship.lon]}
                            radius={8}
                            pathOptions={{
                                color: '#ef4444',
                                fillColor: 'rgba(239, 68, 68, 0.3)',
                                fillOpacity: 0.3,
                                weight: 2,
                                className: 'ship-pulse'
                            }}
                        >
                            <Popup>
                                <div style={{ fontSize: '0.7rem', fontFamily: '"JetBrains Mono"', minWidth: '160px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                                        <Ship size={12} color="#ef4444" />
                                        <strong style={{ color: '#0f172a' }}>Vessel #{idx + 1}</strong>
                                    </div>
                                    <div style={{ color: '#475569', lineHeight: 1.6 }}>
                                        Backscatter: {ship.intensity.toFixed(2)}<br/>
                                        Lat: {ship.lat.toFixed(5)}°<br/>
                                        Lon: {ship.lon.toFixed(5)}°
                                    </div>
                                </div>
                            </Popup>
                        </CircleMarker>
                    ))
                )}
            </MapContainer>

            {/* ═══ GATEWAY OFFLINE BANNER ═══ */}
            <AnimatePresence>
                {!gatewayOnline && (
                    <motion.div
                        initial={{ opacity: 0, y: -30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -30 }}
                        style={{
                            position: 'absolute', top: '16px', left: '50%', transform: 'translateX(-50%)', zIndex: 1100,
                            background: 'rgba(127, 29, 29, 0.95)', backdropFilter: 'blur(8px)',
                            padding: '10px 20px', borderRadius: '8px', border: '1px solid #ef4444',
                            display: 'flex', alignItems: 'center', gap: '10px',
                            fontSize: '0.75rem', color: '#fecaca', fontFamily: '"JetBrains Mono", monospace',
                        }}
                    >
                        <WifiOff size={14} /> Gateway offline — run: LOCAL_MODE=true cargo run --release
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ═══ ERROR TOAST ═══ */}
            <AnimatePresence>
                {errorToast && (
                    <motion.div
                        initial={{ opacity: 0, x: 60 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 60 }}
                        style={{
                            position: 'absolute', top: '16px', right: '20px', zIndex: 1100,
                            background: 'rgba(127, 29, 29, 0.95)', backdropFilter: 'blur(8px)',
                            padding: '12px 18px', borderRadius: '8px', border: '1px solid #ef4444',
                            maxWidth: '360px', fontSize: '0.75rem', color: '#fecaca',
                            fontFamily: '"Inter", sans-serif', boxShadow: '0 8px 25px rgba(0,0,0,0.4)',
                            display: 'flex', alignItems: 'center', gap: '10px',
                        }}
                    >
                        <AlertTriangle size={14} color="#ef4444" />
                        {errorToast}
                        <button onClick={() => setErrorToast(null)} style={{ background: 'none', border: 'none', color: '#fca5a5', cursor: 'pointer', marginLeft: 'auto', padding: '2px' }}>
                            <X size={12} />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ═══ SHIP COUNT HUD ═══ */}
            <AnimatePresence>
                {shipCount > 0 && viewingResult && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
                        style={{
                            position: 'absolute', top: '16px', right: '20px', zIndex: 900,
                            background: 'rgba(127, 29, 29, 0.9)', backdropFilter: 'blur(12px)',
                            padding: '10px 16px', borderRadius: '10px', border: '1px solid rgba(239, 68, 68, 0.5)',
                            display: 'flex', alignItems: 'center', gap: '10px',
                            boxShadow: '0 0 20px rgba(239, 68, 68, 0.15)',
                        }}
                    >
                        <div style={{ position: 'relative' }}>
                            <Anchor size={18} color="#ef4444" />
                            <motion.div
                                animate={{ scale: [1, 1.4, 1], opacity: [0.6, 0, 0.6] }}
                                transition={{ repeat: Infinity, duration: 2 }}
                                style={{ position: 'absolute', inset: '-4px', borderRadius: '50%', border: '1px solid #ef4444' }}
                            />
                        </div>
                        <div>
                            <div style={{ fontSize: '1rem', fontWeight: 700, color: '#fecaca', fontFamily: '"JetBrains Mono", monospace' }}>
                                {shipCount}
                            </div>
                            <div style={{ fontSize: '0.55rem', color: '#fca5a5', textTransform: 'uppercase', letterSpacing: '1px' }}>
                                Vessels Detected
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ═══ FLOATING WORKFLOW PANEL ═══ */}
            <div style={panelStyle}>

                {/* Panel Header */}
                <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(30, 41, 59, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '28px', height: '28px', background: 'linear-gradient(135deg, #2563eb, #0ea5e9)', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Satellite size={15} color="#fff" />
                        </div>
                        <div>
                            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f8fafc' }}>NISAR Pro</div>
                            <div style={{ fontSize: '0.6rem', color: '#64748b', fontFamily: '"JetBrains Mono", monospace' }}>SAR Processing Console</div>
                        </div>
                    </div>
                    <a href="/" style={{ color: '#64748b', textDecoration: 'none', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <ArrowLeft size={12} /> Home
                    </a>
                </div>

                {/* SCROLLABLE CONTENT */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>

                    {/* ── STEP 1: SELECT DATA ── */}
                    <div style={{ marginBottom: '24px' }}>
                        <div style={sectionLabel}>
                            <span style={{ color: '#2563eb', marginRight: '6px' }}>①</span> Select Data Source
                        </div>

                        {/* Mode Tabs */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
                            <button
                                onClick={() => setDataMode('local')}
                                style={{
                                    ...btnSecondary, padding: '10px 8px', fontSize: '0.75rem',
                                    background: dataMode === 'local' ? 'rgba(37, 99, 235, 0.1)' : 'transparent',
                                    borderColor: dataMode === 'local' ? '#2563eb' : '#334155',
                                    color: dataMode === 'local' ? '#60a5fa' : '#64748b',
                                }}
                            >
                                <FolderOpen size={14} /> Local File
                            </button>
                            <button
                                onClick={() => setDataMode('catalog')}
                                style={{
                                    ...btnSecondary, padding: '10px 8px', fontSize: '0.75rem',
                                    background: dataMode === 'catalog' ? 'rgba(37, 99, 235, 0.1)' : 'transparent',
                                    borderColor: dataMode === 'catalog' ? '#2563eb' : '#334155',
                                    color: dataMode === 'catalog' ? '#60a5fa' : '#64748b',
                                }}
                            >
                                <Satellite size={14} /> NASA Catalog
                            </button>
                        </div>

                        {/* Local File Mode */}
                        {dataMode === 'local' && (
                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0 }}>
                                <input
                                    type="text"
                                    value={localFilePath}
                                    onChange={e => setLocalFilePath(e.target.value)}
                                    placeholder="/path/to/NISAR_L2_PR_GCOV_*.h5"
                                    style={{ ...inputStyle, borderColor: localFilePath ? '#2563eb' : '#334155' }}
                                />
                                <div style={{ fontSize: '0.65rem', color: '#475569', marginTop: '6px' }}>
                                    Path to a NISAR HDF5 file (RSLC, GSLC, GCOV, or GUNW)
                                </div>

                                {/* Filename confirmation */}
                                {localFilePath && (
                                    <div style={{ marginTop: '8px', padding: '8px 10px', background: 'rgba(37, 99, 235, 0.05)', border: '1px solid rgba(37, 99, 235, 0.2)', borderRadius: '6px', fontSize: '0.7rem', color: '#60a5fa', fontFamily: '"JetBrains Mono", monospace', wordBreak: 'break-all' }}>
                                        ✓ {localFilePath.split('/').pop()}
                                    </div>
                                )}

                                {/* ── SATELLITE METADATA CARD ── */}
                                {metadata && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                                        style={{
                                            marginTop: '10px', padding: '10px 12px',
                                            background: 'rgba(15, 23, 42, 0.6)', border: '1px solid #1e293b',
                                            borderRadius: '8px',
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                                            <Info size={11} color="#0ea5e9" />
                                            <span style={{ fontSize: '0.6rem', fontWeight: 700, color: '#0ea5e9', textTransform: 'uppercase', letterSpacing: '1px' }}>
                                                Satellite Metadata
                                            </span>
                                        </div>
                                        <div style={metaRow}>
                                            <span style={{ color: '#64748b' }}>Mission</span>
                                            <span style={{ color: '#e2e8f0' }}>{metadata.mission}</span>
                                        </div>
                                        <div style={metaRow}>
                                            <span style={{ color: '#64748b' }}>Product</span>
                                            <span style={{ color: '#e2e8f0' }}>{metadata.product} — {metadata.productFull}</span>
                                        </div>
                                        <div style={metaRow}>
                                            <span style={{ color: '#64748b' }}>Level</span>
                                            <span style={{ color: '#e2e8f0' }}>{metadata.level}</span>
                                        </div>
                                        <div style={metaRow}>
                                            <span style={{ color: '#64748b' }}>Band</span>
                                            <span style={{ color: '#10b981' }}>{metadata.band}</span>
                                        </div>
                                        <div style={metaRow}>
                                            <span style={{ color: '#64748b' }}>Orbit</span>
                                            <span style={{ color: '#e2e8f0' }}>{metadata.direction}</span>
                                        </div>
                                        {metadata.acquisitionDate && (
                                            <div style={metaRow}>
                                                <span style={{ color: '#64748b' }}>Acquired</span>
                                                <span style={{ color: '#f59e0b' }}>{metadata.acquisitionDate}</span>
                                            </div>
                                        )}
                                    </motion.div>
                                )}
                            </motion.div>
                        )}

                        {/* Catalog Mode */}
                        {dataMode === 'catalog' && (
                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0 }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                                    <div>
                                        <label style={{ fontSize: '0.6rem', color: '#64748b', display: 'block', marginBottom: '4px' }}>Start Date</label>
                                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ ...inputStyle, fontSize: '0.75rem' }} />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '0.6rem', color: '#64748b', display: 'block', marginBottom: '4px' }}>End Date</label>
                                        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={{ ...inputStyle, fontSize: '0.75rem' }} />
                                    </div>
                                </div>
                                <div style={{ fontSize: '0.65rem', color: '#475569', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <MapPin size={10} /> Uses current map viewport as search area
                                </div>
                                <button onClick={handleSearch} disabled={isSearching} style={{ ...btnSecondary, borderColor: '#0ea5e9', color: '#0ea5e9' }}>
                                    <Search size={14} /> {isSearching ? 'Searching...' : 'Search NASA Catalog'}
                                </button>

                                {/* Search Results */}
                                {searchResults.length > 0 && (
                                    <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        <div style={{ fontSize: '0.65rem', color: '#64748b' }}>{searchResults.length} scene{searchResults.length > 1 ? 's' : ''} found</div>
                                        {searchResults.map(scene => (
                                            <div
                                                key={scene.id}
                                                onClick={() => setSelectedScene(scene)}
                                                style={{
                                                    padding: '10px 12px', background: selectedScene?.id === scene.id ? 'rgba(37, 99, 235, 0.1)' : 'rgba(15, 23, 42, 0.6)',
                                                    border: `1px solid ${selectedScene?.id === scene.id ? '#2563eb' : '#1e293b'}`,
                                                    borderRadius: '6px', cursor: 'pointer', transition: 'all 0.2s',
                                                }}
                                            >
                                                <div style={{ fontSize: '0.7rem', color: '#e2e8f0', wordBreak: 'break-all', marginBottom: '6px' }}>{scene.id}</div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6rem', color: '#64748b' }}>
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Calendar size={10} /> {scene.date?.split('T')[0]}</span>
                                                    <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}><Layers size={10} /> {formatBytes(scene.size_bytes)}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {searchResults.length === 0 && !isSearching && (
                                    <div style={{ marginTop: '10px', padding: '14px', textAlign: 'center', color: '#475569', fontSize: '0.7rem', border: '1px dashed #1e293b', borderRadius: '6px' }}>
                                        No results yet. Pan the map and search.
                                    </div>
                                )}
                            </motion.div>
                        )}
                    </div>

                    {/* Divider */}
                    <div style={{ height: '1px', background: 'linear-gradient(90deg, transparent, #1e293b, transparent)', marginBottom: '24px' }} />

                    {/* ── STEP 2: PROCESSING MODE ── */}
                    <div style={{ marginBottom: '24px' }}>
                        <div style={sectionLabel}>
                            <span style={{ color: '#2563eb', marginRight: '6px' }}>②</span> Processing Mode
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {pipelines.map(p => {
                                const Icon = pipelineIcons[p.id] || Crosshair;
                                return (
                                    <div
                                        key={p.id}
                                        onClick={() => setPipeline(p.id)}
                                        style={{
                                            padding: '10px 12px', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s',
                                            background: pipeline === p.id ? 'rgba(37, 99, 235, 0.08)' : 'transparent',
                                            border: `1px solid ${pipeline === p.id ? '#2563eb' : '#1e293b'}`,
                                            display: 'flex', alignItems: 'flex-start', gap: '10px',
                                        }}
                                    >
                                        <Icon size={16} color={pipeline === p.id ? '#60a5fa' : '#475569'} style={{ marginTop: '2px', flexShrink: 0 }} />
                                        <div>
                                            <div style={{ fontSize: '0.8rem', fontWeight: 500, color: pipeline === p.id ? '#60a5fa' : '#94a3b8', marginBottom: '2px' }}>
                                                {p.label}
                                            </div>
                                            <div style={{ fontSize: '0.65rem', color: '#475569' }}>{p.desc}</div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Start Button + Progress */}
                    <button
                        onClick={startJob}
                        disabled={!getInputFile() || runningJobs.length > 0 || !gatewayOnline}
                        style={{
                            ...btnPrimary, marginBottom: '8px',
                            opacity: (!getInputFile() || runningJobs.length > 0 || !gatewayOnline) ? 0.4 : 1,
                            cursor: (!getInputFile() || runningJobs.length > 0 || !gatewayOnline) ? 'not-allowed' : 'pointer',
                        }}
                    >
                        {runningJobs.length > 0 ? (
                            <><Loader className="animate-spin" size={16} /> Processing...</>
                        ) : (
                            <><Play size={16} fill="#fff" /> Start Processing</>
                        )}
                    </button>

                    {/* Progress bar for running jobs */}
                    {runningJobs.length > 0 && (
                        <div style={{ marginBottom: '24px' }}>
                            <div style={{ height: '3px', background: '#1e293b', borderRadius: '2px', overflow: 'hidden', marginBottom: '6px' }}>
                                <motion.div
                                    animate={{ x: ['-100%', '100%'] }}
                                    transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
                                    style={{ width: '40%', height: '100%', background: 'linear-gradient(90deg, transparent, #2563eb, transparent)' }}
                                />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6rem', fontFamily: '"JetBrains Mono", monospace' }}>
                                <span style={{ color: '#60a5fa' }}>Processing...</span>
                                <span style={{ color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <Clock size={10} /> {formatElapsed(elapsed[runningJobs[0]?.id])}
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Divider */}
                    <div style={{ height: '1px', background: 'linear-gradient(90deg, transparent, #1e293b, transparent)', marginBottom: '24px' }} />

                    {/* ── STEP 3: RESULTS ── */}
                    <div>
                        <div style={sectionLabel}>
                            <span style={{ color: '#2563eb', marginRight: '6px' }}>③</span> Results
                        </div>

                        {Object.values(jobs).length === 0 ? (
                            <div style={{ padding: '20px', textAlign: 'center', color: '#475569', fontSize: '0.75rem', border: '1px dashed #1e293b', borderRadius: '8px' }}>
                                No jobs yet. Select data and start processing.
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {Object.values(jobs).map(job => {
                                    const PipeIcon = pipelineIcons[job.pipeline] || Crosshair;
                                    return (
                                        <div
                                            key={job.id}
                                            onClick={() => { setActiveJobId(job.id); setTerminalOpen(true); }}
                                            style={{
                                                padding: '12px', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s', position: 'relative', overflow: 'hidden',
                                                background: activeJobId === job.id ? 'rgba(37, 99, 235, 0.05)' : 'rgba(15, 23, 42, 0.5)',
                                                border: `1px solid ${activeJobId === job.id ? '#2563eb' : '#1e293b'}`,
                                            }}
                                        >
                                            {/* Running animation */}
                                            {job.status === 'running' && (
                                                <motion.div
                                                    animate={{ y: ['-100%', '200%'] }}
                                                    transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
                                                    style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '40px', background: 'linear-gradient(to bottom, transparent, rgba(37, 99, 235, 0.06), transparent)', pointerEvents: 'none' }}
                                                />
                                            )}

                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <PipeIcon size={12} color="#475569" />
                                                    <div style={{ fontSize: '0.75rem', fontWeight: 500, color: '#e2e8f0', wordBreak: 'break-all' }}>
                                                        {job.name}
                                                    </div>
                                                </div>
                                                {job.status === 'running' ? <Loader className="animate-spin" size={14} color="#2563eb" /> :
                                                 job.status === 'completed' ? <CheckCircle size={14} color="#10b981" /> :
                                                 <AlertTriangle size={14} color="#ef4444" />}
                                            </div>

                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6rem', color: '#64748b', fontFamily: '"JetBrains Mono", monospace' }}>
                                                <span>{job.status === 'running' ? 'Processing...' : job.status === 'completed' ? 'Completed' : 'Failed'}</span>
                                                {elapsed[job.id] != null && (
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                        <Clock size={9} /> {formatElapsed(elapsed[job.id])}
                                                    </span>
                                                )}
                                            </div>

                                            {/* Actions for completed jobs */}
                                            {job.status === 'completed' && activeJobId === job.id && (
                                                <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setViewingResult({
                                                                url: api(job.output_path),
                                                                bounds: job.bounds,
                                                                insarReport: job.insarReport,
                                                                ships: job.ships,
                                                                pipeline: job.pipeline,
                                                                elapsed: elapsed[job.id],
                                                                bbox: job.bbox,
                                                            });
                                                        }}
                                                        style={{ ...btnSecondary, flex: 1, padding: '8px', fontSize: '0.7rem', borderColor: '#10b981', color: '#10b981' }}
                                                    >
                                                        <Eye size={12} /> View on Map
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); window.open(api(job.output_path), '_blank'); }}
                                                        style={{ ...btnSecondary, flex: 1, padding: '8px', fontSize: '0.7rem' }}
                                                    >
                                                        <Download size={12} /> Download
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ═══ RESULT OVERLAY INFO CARD (Enhanced) ═══ */}
            <AnimatePresence>
                {viewingResult && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
                        style={{
                            position: 'absolute', bottom: terminalOpen ? '280px' : '60px', right: '20px', zIndex: 900,
                            background: 'rgba(2, 6, 23, 0.93)', backdropFilter: 'blur(14px)',
                            padding: '16px 18px', border: '1px solid #10b981', borderRadius: '10px',
                            width: '300px', boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ width: '6px', height: '6px', background: '#10b981', borderRadius: '50%', boxShadow: '0 0 8px #10b981' }} />
                                <span style={{ fontWeight: 600, fontSize: '0.75rem', color: '#e2e8f0' }}>Result Ready</span>
                            </div>
                            <button onClick={() => setViewingResult(null)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '2px' }}>
                                <X size={14} />
                            </button>
                        </div>

                        <div style={{ fontSize: '0.65rem', color: '#64748b', fontFamily: '"JetBrains Mono", monospace', marginBottom: '8px' }}>
                            {viewingResult.url.split('/').pop()}
                        </div>

                        {/* Pipeline & timing */}
                        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                            {viewingResult.pipeline && (
                                <span style={{ padding: '3px 8px', background: 'rgba(37, 99, 235, 0.1)', border: '1px solid rgba(37, 99, 235, 0.3)', borderRadius: '4px', fontSize: '0.6rem', color: '#60a5fa', fontFamily: '"JetBrains Mono", monospace' }}>
                                    {pipelines.find(p => p.id === viewingResult.pipeline)?.label || viewingResult.pipeline}
                                </span>
                            )}
                            {viewingResult.elapsed != null && (
                                <span style={{ padding: '3px 8px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '4px', fontSize: '0.6rem', color: '#10b981', fontFamily: '"JetBrains Mono", monospace', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <Clock size={9} /> {formatElapsed(viewingResult.elapsed)}
                                </span>
                            )}
                        </div>

                        {/* Ship detection summary */}
                        {viewingResult.ships && viewingResult.ships.length > 0 && (
                            <div style={{ padding: '6px 8px', background: 'rgba(239, 68, 68, 0.06)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '6px', fontSize: '0.6rem', color: '#fca5a5', marginBottom: '6px' }}>
                                🚢 {viewingResult.ships.length} vessel{viewingResult.ships.length > 1 ? 's' : ''} detected via CA-CFAR
                            </div>
                        )}

                        {/* Bounding box coords */}
                        {viewingResult.bbox && (
                            <div style={{ fontSize: '0.55rem', color: '#475569', fontFamily: '"JetBrains Mono", monospace', lineHeight: 1.6 }}>
                                Bounds: {viewingResult.bbox.south?.toFixed(3)}°N → {viewingResult.bbox.north?.toFixed(3)}°N, {viewingResult.bbox.west?.toFixed(3)}°E → {viewingResult.bbox.east?.toFixed(3)}°E
                            </div>
                        )}

                        {!viewingResult.bounds && (
                            <div style={{ fontSize: '0.6rem', color: '#f59e0b', marginTop: '6px' }}>
                                ⚠ No georef data — overlay not shown on map
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ═══ COORDINATES HUD ═══ */}
            <div style={{
                position: 'absolute', bottom: terminalOpen ? '280px' : '16px', left: '410px', zIndex: 900,
                fontFamily: '"JetBrains Mono", monospace', fontSize: '0.7rem', color: '#0ea5e9',
                display: 'flex', gap: '14px', background: 'rgba(2, 6, 23, 0.75)', padding: '6px 12px',
                border: '1px solid rgba(30, 41, 59, 0.6)', borderRadius: '6px', backdropFilter: 'blur(8px)',
                transition: 'bottom 0.25s ease',
            }}>
                <span>LAT: {mouseCoords.lat}°</span>
                <span>LON: {mouseCoords.lon}°</span>
                <span style={{ color: gatewayOnline ? '#10b981' : '#ef4444' }}>● {gatewayOnline ? 'ONLINE' : 'OFFLINE'}</span>
            </div>

            {/* ═══ TERMINAL DRAWER ═══ */}
            <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 1000,
                height: terminalOpen && activeJobId ? '260px' : '0px',
                overflow: 'hidden', transition: 'height 0.25s ease',
                background: 'rgba(2, 6, 23, 0.97)', borderTop: '1px solid #1e293b',
                display: 'flex', flexDirection: 'column',
                backdropFilter: 'blur(12px)',
            }}>
                {/* Terminal Header */}
                <div style={{ padding: '8px 16px', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#94a3b8', fontSize: '0.7rem', fontFamily: '"JetBrains Mono", monospace' }}>
                        <Terminal size={14} color="#2563eb" />
                        <span>Processing Log</span>
                        {activeJob?.status === 'running' && (
                            <span style={{ padding: '2px 6px', background: 'rgba(37, 99, 235, 0.1)', border: '1px solid #2563eb', color: '#60a5fa', fontSize: '0.55rem', borderRadius: '3px' }}>LIVE</span>
                        )}
                        {logs[activeJobId] && (
                            <span style={{ color: '#334155', fontSize: '0.6rem' }}>{logs[activeJobId].length} lines</span>
                        )}
                    </div>
                    <button onClick={() => setTerminalOpen(false)} style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', padding: '4px' }}>
                        <ChevronDown size={14} />
                    </button>
                </div>
                {/* Terminal Output */}
                <div
                    ref={terminalRef}
                    onScroll={handleTerminalScroll}
                    style={{ flex: 1, padding: '12px 16px', overflowY: 'auto', fontFamily: '"JetBrains Mono", Consolas, monospace', fontSize: '0.72rem', color: '#94a3b8', lineHeight: 1.7 }}
                >
                    {(!logs[activeJobId] || logs[activeJobId].length === 0) ? (
                        <div style={{ color: '#334155', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ display: 'inline-block', width: '8px', height: '14px', background: '#2563eb', animation: 'blink 1s step-end infinite' }} />
                            Waiting for processor output...
                        </div>
                    ) : (
                        logs[activeJobId].map((line, idx) => {
                            const isError = line.includes('ERROR') || line.includes('Failed') || line.includes('FAILED');
                            const isSuccess = line.includes('✓') || line.includes('COMPLETED');
                            const isSys = line.includes('[SYSTEM]');
                            const isCfar = line.includes('CFAR') || line.includes('ship') || line.includes('vessel');
                            return (
                                <div key={idx} style={{ color: isError ? '#ef4444' : isSuccess ? '#10b981' : isSys ? '#60a5fa' : isCfar ? '#f59e0b' : '#94a3b8', wordBreak: 'break-all', paddingLeft: '14px', textIndent: '-14px' }}>
                                    <span style={{ color: '#334155', marginRight: '6px' }}>›</span>
                                    {line}
                                </div>
                            );
                        })
                    )}
                </div>
                <style dangerouslySetInnerHTML={{__html: `
                    @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
                    @keyframes ship-ring { 0% { box-shadow: 0 0 0 0 rgba(239,68,68,0.5); } 70% { box-shadow: 0 0 0 8px rgba(239,68,68,0); } 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0); } }
                    .ship-pulse { animation: ship-ring 2s infinite; }
                    ::-webkit-scrollbar { width: 6px; }
                    ::-webkit-scrollbar-track { background: transparent; }
                    ::-webkit-scrollbar-thumb { background: #334155; border-radius: 3px; }
                    ::-webkit-scrollbar-thumb:hover { background: #475569; }
                    .animate-spin { animation: spin 1s linear infinite; }
                    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                `}} />
            </div>

            {/* ═══ MINIMIZED TERMINAL BUTTON ═══ */}
            {!terminalOpen && activeJobId && (
                <motion.button
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    onClick={() => setTerminalOpen(true)}
                    style={{
                        position: 'absolute', bottom: '16px', right: '20px', zIndex: 900,
                        background: 'rgba(2, 6, 23, 0.9)', color: '#60a5fa',
                        border: '1px solid #2563eb', borderRadius: '8px',
                        padding: '8px 14px', display: 'flex', alignItems: 'center', gap: '8px',
                        cursor: 'pointer', fontSize: '0.7rem', fontWeight: 500,
                        fontFamily: '"JetBrains Mono", monospace',
                        backdropFilter: 'blur(8px)', boxShadow: '0 4px 14px rgba(0,0,0,0.3)',
                    }}
                >
                    <Terminal size={14} />
                    Show Log [{logs[activeJobId]?.length || 0} lines]
                    {activeJob?.status === 'running' && <Loader className="animate-spin" size={12} />}
                </motion.button>
            )}
        </div>
    );
}

export default AppDashboard;
