import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapContainer, TileLayer, ImageOverlay, GeoJSON, CircleMarker, Popup, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { api, getGatewayUrl } from '../../config/api';
import { Terminal, Play, ChevronDown, CheckCircle, AlertTriangle, Loader, Search, FolderOpen, Satellite, Eye, Download, ArrowLeft, MapPin, Calendar, Layers, X, Anchor, Crosshair, Waves, Palette, WifiOff, Clock, Info, Ship } from 'lucide-react';

// ── Fonts ──
const MONO = '"IBM Plex Mono", monospace';
const SANS = '"Inter", sans-serif';

// ── Colors ──
const C = {
    bg0: '#0A0A0A', bg1: '#111111', bg2: '#1A1A1A', bg3: '#2A2A2A', bg4: '#404040',
    text: '#F0F0F0', textMid: '#888888', textDim: '#555555',
    accent: { sar: '#9B8EC4', infra: '#C8A96E', maritime: '#4A8FA8' },
    stable: '#4CAF50', caution: '#E6A817', alert: '#D4822A', critical: '#C0392B',
    data: '#7EB8D4',
};

// ── Profiles ──
const PROFILES = [
    { id: 'sar_science', label: 'SAR SCIENCE', accent: C.accent.sar },
    { id: 'infrastructure', label: 'INFRASTRUCTURE', accent: C.accent.infra },
    { id: 'maritime', label: 'MARITIME INTEL', accent: C.accent.maritime },
];

// ── Map Hooks ──
function MapFlyTo({ center }) {
    const map = useMap();
    useEffect(() => { if (center) map.flyTo(center, 8, { duration: 1.5 }); }, [center, map]);
    return null;
}
function MapEventTracker({ setCoords, setMapBounds }) {
    const map = useMap();
    useMapEvents({
        mousemove(e) { setCoords({ lat: e.latlng.lat.toFixed(4), lon: e.latlng.lng.toFixed(4) }); },
        moveend(e) { setMapBounds(e.target.getBounds()); }
    });
    useEffect(() => { setMapBounds(map.getBounds()); }, [map]);
    return null;
}

// ── Parse NISAR Filename ──
function parseNisarFilename(filepath) {
    if (!filepath) return null;
    const fname = filepath.split('/').pop();
    const parts = fname.split('_');
    if (parts.length < 10 || !parts[0].startsWith('NISAR')) return null;
    const level = parts[1]; const mode = parts[2]; const product = parts[3]; const direction = parts[6];
    const dateStr = parts.find(p => /^\d{8}T\d{6}$/.test(p));
    const productNames = { RSLC: 'Range-compressed SLC', GSLC: 'Geocoded SLC', GCOV: 'Geocoded Covariance', GUNW: 'Unwrapped Interferogram' };
    const levelNames = { L1: 'Level-1', L2: 'Level-2', L0: 'Level-0' };
    let acqDate = null;
    if (dateStr) { acqDate = `${dateStr.slice(0,4)}-${dateStr.slice(4,6)}-${dateStr.slice(6,8)}`; }
    return {
        mission: 'NISAR (NASA/ISRO)', level: levelNames[level] || level, product,
        productFull: productNames[product] || product, mode: mode === 'PR' ? 'L-Band + S-Band' : mode,
        band: 'L-Band (1.26 GHz)', direction: direction === 'D' ? 'Descending' : direction === 'A' ? 'Ascending' : direction,
        acquisitionDate: acqDate, filename: fname,
    };
}

// ── Severity color helper ──
function sevColor(sev) {
    if (sev === 'Critical') return C.critical;
    if (sev === 'Alert') return C.alert;
    if (sev === 'Caution') return C.caution;
    return C.stable;
}
function dispColor(mm) {
    const v = Math.abs(mm);
    if (v >= 20) return C.critical;
    if (v >= 10) return C.alert;
    if (v >= 5) return C.caution;
    return C.stable;
}

// ══════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════
function AppDashboard() {
    // ── All original state (PRESERVED) ──
    const [mouseCoords, setMouseCoords] = useState({ lat: '0.0000', lon: '0.0000' });
    const [mapBounds, setMapBounds] = useState(null);
    const [flyToCenter, setFlyToCenter] = useState(null);
    const [dataMode, setDataMode] = useState('local');
    const [localFilePath, setLocalFilePath] = useState('');
    const [selectedScene, setSelectedScene] = useState(null);
    const [startDate, setStartDate] = useState('2026-01-01');
    const [endDate, setEndDate] = useState('2026-06-01');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [pipeline, setPipeline] = useState('standard_rda');
    const [jobs, setJobs] = useState({});
    const [activeJobId, setActiveJobId] = useState(null);
    const [terminalOpen, setTerminalOpen] = useState(false);
    const [logs, setLogs] = useState({});
    const terminalRef = useRef(null);
    const [viewingResult, setViewingResult] = useState(null);
    const userScrolledUp = useRef(false);
    const [elapsed, setElapsed] = useState({});
    const [gatewayOnline, setGatewayOnline] = useState(true);
    const [errorToast, setErrorToast] = useState(null);

    // ── New state for profiles ──
    const [missionSelected, setMissionSelected] = useState(false);
    const [profile, setProfile] = useState('sar_science');
    const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
    const [utcTime, setUtcTime] = useState('');
    const [downloadProgress, setDownloadProgress] = useState(null);
    const [assetType, setAssetType] = useState('DAM');
    const [assetName, setAssetName] = useState('');
    const [assetLat, setAssetLat] = useState('');
    const [assetLon, setAssetLon] = useState('');
    const [envContext, setEnvContext] = useState(null);
    const [fetchingContext, setFetchingContext] = useState(false);

    // ── Gateway Health Check (PRESERVED) ──
    useEffect(() => {
        const check = async () => {
            try { await fetch(api('/jobs/health-ping'), { signal: AbortSignal.timeout(2000) }); setGatewayOnline(true); }
            catch { try { await fetch(api('/'), { signal: AbortSignal.timeout(2000) }); setGatewayOnline(true); } catch { setGatewayOnline(false); } }
        };
        check(); const interval = setInterval(check, 15000);
        return () => clearInterval(interval);
    }, []);

    // ── Elapsed timer (PRESERVED) ──
    useEffect(() => {
        const running = Object.values(jobs).filter(j => j.status === 'running');
        if (running.length === 0) return;
        const interval = setInterval(() => {
            setElapsed(prev => {
                const next = { ...prev };
                for (const j of running) { if (j.startedAt) next[j.id] = Math.floor((Date.now() - j.startedAt) / 1000); }
                return next;
            });
        }, 1000);
        return () => clearInterval(interval);
    }, [jobs]);

    // ── UTC clock ──
    useEffect(() => {
        const tick = () => {
            const n = new Date();
            const d = n.toISOString().slice(0,10);
            const t = n.toISOString().slice(11,19);
            setUtcTime(`${d} · ${t} UTC`);
        };
        tick(); const i = setInterval(tick, 1000);
        return () => clearInterval(i);
    }, []);

    // ── Close dropdown on outside click ──
    useEffect(() => {
        if (!profileDropdownOpen) return;
        const handler = () => setProfileDropdownOpen(false);
        document.addEventListener('click', handler);
        return () => document.removeEventListener('click', handler);
    }, [profileDropdownOpen]);

    // ── Helpers (PRESERVED) ──
    const metadata = parseNisarFilename(localFilePath);
    const formatBytes = (bytes) => { const b = parseInt(bytes, 10); if (isNaN(b) || b === 0) return '0 B'; const k = 1024, sizes = ['B','KB','MB','GB','TB']; const i = Math.floor(Math.log(b) / Math.log(k)); return parseFloat((b / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]; };
    const formatElapsed = (secs) => { if (!secs) return '0s'; const m = Math.floor(secs / 60); const s = secs % 60; return m > 0 ? `${m}m ${s}s` : `${s}s`; };
    const getInputFile = () => { if (dataMode === 'catalog' && selectedScene) return selectedScene.download_url; if (dataMode === 'local' && localFilePath) return localFilePath; return null; };
    const getInputLabel = () => { if (dataMode === 'catalog' && selectedScene) return selectedScene.id; if (dataMode === 'local' && localFilePath) return localFilePath.split('/').pop(); return null; };
    const showError = useCallback((msg) => { setErrorToast(msg); setTimeout(() => setErrorToast(null), 5000); }, []);

    // ── Catalog Search (PRESERVED) ──
    const handleSearch = async () => {
        if (!mapBounds) return;
        setIsSearching(true);
        try {
            const bbox = `${mapBounds.getWest()},${mapBounds.getSouth()},${mapBounds.getEast()},${mapBounds.getNorth()}`;
            const res = await fetch(api(`/search/nisar?bbox=${bbox}&start_date=${startDate}T00:00:00Z&end_date=${endDate}T23:59:59Z`));
            const data = await res.json();
            setSearchResults(data);
        } catch (err) { console.error('Catalog search failed:', err); showError('Catalog search failed — is the gateway running?'); setSearchResults([]); }
        finally { setIsSearching(false); }
    };

    // ── Start Job (PRESERVED) ──
    const startJob = async () => {
        const inputFile = getInputFile();
        if (!inputFile) return;
        if (!gatewayOnline) { showError('Gateway is offline. Start it with: LOCAL_MODE=true RUST_LOG=info cargo run --release'); return; }
        try {
            const res = await fetch(api('/jobs'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ input_file: inputFile, synthetic: false, pipeline }) });
            const data = await res.json();
            const id = data.job_id;
            setJobs(prev => ({ ...prev, [id]: { id, status: 'running', name: getInputLabel(), bounds: null, bbox: null, pipeline, startedAt: Date.now() } }));
            setActiveJobId(id); setTerminalOpen(true);
            const sse = new EventSource(api(`/jobs/${id}/logs`));
            sse.onmessage = (event) => {
                const line = event.data;
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
                            fetch(api(`/${parsed.path}`)).then(r => r.json()).then(report => { setJobs(prev => ({ ...prev, [id]: { ...prev[id], insarReport: report } })); }).catch(console.error);
                        } else if (parsed.event === 'ships_detected' && parsed.path) {
                            fetch(api(`/${parsed.path}`)).then(r => r.json()).then(ships => { setJobs(prev => ({ ...prev, [id]: { ...prev[id], ships } })); }).catch(console.error);
                        }
                    } catch (err) { /* not JSON */ }
                }
                setLogs(prev => ({ ...prev, [id]: [...(prev[id] || []), line] }));
                if (terminalRef.current && !userScrolledUp.current) { terminalRef.current.scrollTop = terminalRef.current.scrollHeight; }
                if (line.includes('[SYSTEM] PROCESS_COMPLETED') || line.includes('[SYSTEM] PROCESS_FAILED')) {
                    sse.close();
                    setTimeout(() => { setJobs(prev => { const job = prev[id]; if (job) { const fin = Date.now(); const dur = job.startedAt ? Math.floor((fin - job.startedAt) / 1000) : null; setElapsed(e => ({ ...e, [id]: dur })); } return prev; }); }, 500);
                }
            };
            sse.onerror = () => { showError('Lost connection to processing stream'); sse.close(); };
        } catch (err) { console.error(err); showError('Failed to start job — check gateway connection'); }
    };

    // ── Start job from path (for ASF download flow) ──
    const startJobFromPath = async (filePath) => {
        if (!filePath) return;
        const activePipeline = profile === 'infrastructure' ? 'insar' : profile === 'maritime' ? 'cfar' : pipeline;
        try {
            const res = await fetch(api('/jobs'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ input_file: filePath, synthetic: false, pipeline: activePipeline }) });
            const data = await res.json();
            const id = data.job_id;
            const label = filePath.split('/').pop();
            setJobs(prev => ({ ...prev, [id]: { id, status: 'running', name: label, bounds: null, bbox: null, pipeline: activePipeline, startedAt: Date.now() } }));
            setActiveJobId(id); setTerminalOpen(true);
            const sse = new EventSource(api(`/jobs/${id}/logs`));
            sse.onmessage = (event) => {
                const line = event.data;
                if (line.startsWith('{')) { try { const parsed = JSON.parse(line); if (parsed.event === 'georef' && parsed.bbox) { const { north, south, east, west } = parsed.bbox; if (Math.abs(north-south)>0.0001 && Math.abs(east-west)>0.0001) { setJobs(prev => ({ ...prev, [id]: { ...prev[id], bounds: [[south,west],[north,east]], bbox: parsed.bbox } })); setFlyToCenter([(north+south)/2,(east+west)/2]); } } else if (parsed.event === 'insar_report' && parsed.path) { fetch(api(`/${parsed.path}`)).then(r=>r.json()).then(report => { setJobs(prev => ({ ...prev, [id]: { ...prev[id], insarReport: report } })); }).catch(console.error); } else if (parsed.event === 'ships_detected' && parsed.path) { fetch(api(`/${parsed.path}`)).then(r=>r.json()).then(ships => { setJobs(prev => ({ ...prev, [id]: { ...prev[id], ships } })); }).catch(console.error); } } catch(e){} }
                setLogs(prev => ({ ...prev, [id]: [...(prev[id]||[]), line] }));
                if (terminalRef.current && !userScrolledUp.current) terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
                if (line.includes('[SYSTEM] PROCESS_COMPLETED') || line.includes('[SYSTEM] PROCESS_FAILED')) { sse.close(); setTimeout(() => { setJobs(prev => { const job = prev[id]; if (job) { setElapsed(e => ({ ...e, [id]: Math.floor((Date.now()-job.startedAt)/1000) })); } return prev; }); }, 500); }
            };
            sse.onerror = () => { showError('Lost connection to processing stream'); sse.close(); };
        } catch (err) { console.error(err); showError('Failed to start job'); }
    };

    // ── ASF Acquire + Process ──
    const handleAcquireAndProcess = async () => {
        if (!selectedScene) return;
        setDownloadProgress(0); setTerminalOpen(true);
        const downloadSse = new EventSource(api(`/asf/download-stream?granule_id=${selectedScene.id}&url=${encodeURIComponent(selectedScene.download_url)}`));
        downloadSse.onmessage = (e) => {
            const data = JSON.parse(e.data);
            if (data.status === 'downloading') setDownloadProgress(data.progress);
            if (data.status === 'download_complete') { downloadSse.close(); setDownloadProgress('complete'); startJobFromPath(data.path); }
        };
        downloadSse.onerror = () => { downloadSse.close(); setDownloadProgress(null); showError('Download failed'); };
    };

    // ── Refs (PRESERVED) ──
    const jobsRef = useRef(jobs);
    useEffect(() => { jobsRef.current = jobs; }, [jobs]);
    const elapsedRef = useRef(elapsed);
    useEffect(() => { elapsedRef.current = elapsed; }, [elapsed]);

    // ── Poll Job Status (PRESERVED) ──
    useEffect(() => {
        const interval = setInterval(async () => {
            const currentJobs = jobsRef.current;
            const activeIds = Object.keys(currentJobs).filter(id => currentJobs[id].status === 'running' || currentJobs[id].status === 'queued');
            if (activeIds.length === 0) return;
            for (const id of activeIds) {
                try {
                    const res = await fetch(api(`/jobs/${id}`)); const data = await res.json();
                    if (data.status === 'completed' && currentJobs[id].status !== 'completed') {
                        const jobBounds = currentJobs[id].bounds || (data.bbox ? [[data.bbox.south, data.bbox.west], [data.bbox.north, data.bbox.east]] : null);
                        setTimeout(() => { setViewingResult({ url: api(data.output_path), bounds: jobBounds, insarReport: jobsRef.current[id]?.insarReport || null, ships: jobsRef.current[id]?.ships || null, pipeline: jobsRef.current[id]?.pipeline || 'standard_rda', elapsed: elapsedRef.current[id] || null, bbox: jobsRef.current[id]?.bbox || data.bbox || null }); }, 800);
                    }
                    setJobs(prev => ({ ...prev, [id]: { ...prev[id], status: data.status, output_path: data.output_path } }));
                } catch (e) {}
            }
        }, 3000);
        return () => clearInterval(interval);
    }, []);

    // ── Terminal scroll (PRESERVED) ──
    const handleTerminalScroll = () => { if (!terminalRef.current) return; const el = terminalRef.current; userScrolledUp.current = !(el.scrollHeight - el.scrollTop - el.clientHeight < 40); };

    // ── Fetch environmental context ──
    const fetchContext = async () => {
        if (!assetLat || !assetLon) return;
        setFetchingContext(true);
        try {
            const res = await fetch(api(`/context?lat=${assetLat}&lon=${assetLon}&asset_type=${assetType}`));
            const data = await res.json(); setEnvContext(data);
        } catch { setEnvContext(null); }
        finally { setFetchingContext(false); }
    };

    const allPipelines = [
        { id: 'standard_rda', label: 'Standard SAR Focus', desc: 'Range-Doppler + RCMC + speckle filter' },
        { id: 'polsar', label: 'Polarimetric', desc: 'Pauli decomposition RGB (HH, HV, VV)' },
        { id: 'insar', label: 'InSAR Analysis', desc: 'Interferometric phase + displacement' },
        { id: 'cfar', label: 'Maritime CFAR', desc: 'CA-CFAR vessel detection' },
    ];
    const pipelines = profile === 'sar_science'
        ? allPipelines.filter(p => p.id !== 'cfar')
        : allPipelines;

    const runningJobs = Object.values(jobs).filter(j => j.status === 'running');
    const activeJob = activeJobId ? jobs[activeJobId] : null;
    const activeProfile = PROFILES.find(p => p.id === profile);
    const activePipeline = profile === 'infrastructure' ? 'insar' : profile === 'maritime' ? 'cfar' : pipeline;

    // Force pipeline when switching profiles
    useEffect(() => {
        if (profile === 'infrastructure') setPipeline('insar');
        if (profile === 'maritime') setPipeline('cfar');
    }, [profile]);

    // ══════════════════════ RENDER ══════════════════════
    // Continued in part 2...
    return (
        <div style={{ width: '100%', height: '100vh', position: 'relative', backgroundColor: C.bg0, overflow: 'hidden' }}>

            {/* ═══ MISSION SELECT OVERLAY ═══ */}
            {!missionSelected && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: C.bg0 }}>
                    <div style={{ position: 'absolute', top: '16px', left: '16px', fontFamily: SANS, fontWeight: 600, fontSize: '13px', color: C.text }}>
                        NISAR PRO
                    </div>
                    <div style={{ position: 'absolute', top: '16px', right: '16px', fontFamily: MONO, fontSize: '11px', color: C.textDim }}>
                        v0.4.0 · 2026
                    </div>
                    
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                        <div style={{ fontFamily: MONO, fontSize: '11px', color: C.textDim, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '24px' }}>
                            SELECT MISSION PROFILE
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px', background: C.bg3, border: `1px solid ${C.bg3}` }}>
                            {/* Card 1: SAR SCIENCE */}
                            <div 
                                onClick={() => { setProfile('sar_science'); setMissionSelected(true); }}
                                style={{ width: '280px', height: '160px', background: C.bg1, padding: '32px', cursor: 'pointer', boxSizing: 'border-box' }}
                                onMouseEnter={e => { e.currentTarget.style.background = C.bg2; e.currentTarget.style.borderLeft = `3px solid ${C.accent.sar}`; e.currentTarget.style.paddingLeft = '29px'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = C.bg1; e.currentTarget.style.borderLeft = 'none'; e.currentTarget.style.paddingLeft = '32px'; }}
                            >
                                <div style={{ fontFamily: MONO, fontSize: '11px', color: C.textMid, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '8px' }}>SAR SCIENCE</div>
                                <div style={{ fontFamily: SANS, fontSize: '13px', color: C.text }}>Raw RSLC/GCOV processing pipeline</div>
                            </div>
                            
                            {/* Card 2: MARITIME INTEL */}
                            <div 
                                onClick={() => { setProfile('maritime'); setMissionSelected(true); }}
                                style={{ width: '280px', height: '160px', background: C.bg1, padding: '32px', cursor: 'pointer', boxSizing: 'border-box' }}
                                onMouseEnter={e => { e.currentTarget.style.background = C.bg2; e.currentTarget.style.borderLeft = `3px solid ${C.accent.maritime}`; e.currentTarget.style.paddingLeft = '29px'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = C.bg1; e.currentTarget.style.borderLeft = 'none'; e.currentTarget.style.paddingLeft = '32px'; }}
                            >
                                <div style={{ fontFamily: MONO, fontSize: '11px', color: C.textMid, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '8px' }}>MARITIME INTEL</div>
                                <div style={{ fontFamily: SANS, fontSize: '13px', color: C.text }}>CA-CFAR vessel detection and tracking</div>
                            </div>

                            {/* Card 3: INFRASTRUCTURE */}
                            <div 
                                onClick={() => { setProfile('infrastructure'); setMissionSelected(true); }}
                                style={{ width: '280px', height: '160px', background: C.bg1, padding: '32px', cursor: 'pointer', boxSizing: 'border-box' }}
                                onMouseEnter={e => { e.currentTarget.style.background = C.bg2; e.currentTarget.style.borderLeft = `3px solid ${C.accent.infra}`; e.currentTarget.style.paddingLeft = '29px'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = C.bg1; e.currentTarget.style.borderLeft = 'none'; e.currentTarget.style.paddingLeft = '32px'; }}
                            >
                                <div style={{ fontFamily: MONO, fontSize: '11px', color: C.textMid, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '8px' }}>INFRASTRUCTURE</div>
                                <div style={{ fontFamily: SANS, fontSize: '13px', color: C.text }}>InSAR deformation and structural monitoring</div>
                            </div>

                            {/* Card 4: ANALYST */}
                            <div 
                                onClick={() => { setProfile('analyst'); setMissionSelected(true); }}
                                style={{ width: '280px', height: '160px', background: C.bg1, padding: '32px', cursor: 'pointer', boxSizing: 'border-box' }}
                                onMouseEnter={e => { e.currentTarget.style.background = C.bg2; e.currentTarget.style.borderLeft = `3px solid #888888`; e.currentTarget.style.paddingLeft = '29px'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = C.bg1; e.currentTarget.style.borderLeft = 'none'; e.currentTarget.style.paddingLeft = '32px'; }}
                            >
                                <div style={{ fontFamily: MONO, fontSize: '11px', color: C.textMid, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '8px' }}>ANALYST</div>
                                <div style={{ fontFamily: SANS, fontSize: '13px', color: C.text }}>Full access — all pipelines and parameters</div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══ TOPBAR ═══ */}
            <div style={{
                position: 'fixed', top: 0, left: 0, right: 0, height: '40px', zIndex: 200,
                background: C.bg1, borderBottom: `1px solid ${C.bg3}`,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '0 16px',
            }}>
                {/* Left: Title + Profile Switcher */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0' }}>
                    <span style={{ fontFamily: SANS, fontWeight: 600, fontSize: '13px', color: C.text, marginRight: '12px' }}>
                        NISAR PRO
                    </span>
                    <div style={{ width: '1px', height: '20px', background: C.bg3, marginRight: '12px' }} />

                    {/* Profile Switcher */}
                    <div style={{ position: 'relative' }}>
                        <button
                            onClick={(e) => { e.stopPropagation(); setProfileDropdownOpen(prev => !prev); }}
                            style={{
                                background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px',
                                fontFamily: MONO, fontSize: '11px', letterSpacing: '0.08em',
                                color: activeProfile.accent,
                                display: 'flex', alignItems: 'center', gap: '6px',
                            }}
                        >
                            {activeProfile.label} ▾
                        </button>

                        {/* Dropdown */}
                        {profileDropdownOpen && (
                            <div
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                    position: 'absolute', top: '32px', left: 0, zIndex: 300,
                                    background: C.bg1, border: `1px solid ${C.bg3}`,
                                    borderRadius: '2px', minWidth: '180px',
                                    boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                                }}
                            >
                                {PROFILES.map(p => (
                                    <button
                                        key={p.id}
                                        onClick={() => { setProfile(p.id); setProfileDropdownOpen(false); }}
                                        style={{
                                            display: 'block', width: '100%', textAlign: 'left',
                                            padding: '8px 12px', border: 'none', cursor: 'pointer',
                                            fontFamily: MONO, fontSize: '11px', letterSpacing: '0.08em',
                                            background: profile === p.id ? C.bg2 : C.bg1,
                                            color: profile === p.id ? p.accent : C.textMid,
                                            borderLeft: profile === p.id ? `3px solid ${p.accent}` : '3px solid transparent',
                                        }}
                                        onMouseEnter={(e) => { if (profile !== p.id) e.target.style.background = C.bg2; }}
                                        onMouseLeave={(e) => { if (profile !== p.id) e.target.style.background = C.bg1; }}
                                    >
                                        {p.label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Center: Terminal Toggle */}
                <button
                    onClick={() => setTerminalOpen(prev => !prev)}
                    style={{
                        background: 'transparent', border: 'none', cursor: 'pointer',
                        fontFamily: MONO, fontSize: '10px', letterSpacing: '0.08em',
                        color: terminalOpen ? C.accent.infra : C.textDim,
                    }}
                >
                    {terminalOpen ? '▼ TERMINAL' : 'TERMINAL'}
                </button>

                {/* Right: Status + Clock + Home */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontFamily: MONO, fontSize: '11px', color: C.textMid }}>
                        <div style={{
                            width: '6px', height: '6px', borderRadius: '50%',
                            background: gatewayOnline ? C.stable : C.critical,
                        }} />
                        {gatewayOnline ? 'ONLINE' : 'OFFLINE'}
                    </div>
                    <div style={{ width: '1px', height: '16px', background: C.bg3 }} />
                    <span style={{ fontFamily: MONO, fontSize: '11px', color: C.textDim }}>{utcTime}</span>
                    <div style={{ width: '1px', height: '16px', background: C.bg3 }} />
                    <a href="/" style={{ fontFamily: MONO, fontSize: '11px', color: C.textDim, textDecoration: 'none' }}>← HOME</a>
                </div>
            </div>

            {/* Continued in part 3... */}
            {/* ═══ FULL-SCREEN MAP ═══ */}
            <MapContainer
                center={[28.65, -0.53]}
                zoom={5}
                style={{ position: 'absolute', top: '40px', left: 0, right: 0, bottom: 0, cursor: 'crosshair', zIndex: 0 }}
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

                {/* COG TileLayer via TiTiler */}
                {viewingResult && (
                    viewingResult.url ? (
                        <TileLayer
                            url={`http://localhost:8000/cog/tiles/WebMercatorQuad/{z}/{x}/{y}@2x?url=${encodeURIComponent('file://' + viewingResult.url.replace(/^\/results\//, '/home/aditya/Desktop/sar_analyzer/sar-gateway/results/'))}`}
                            attribution=""
                            opacity={0.75}
                            key={viewingResult.url}
                        />
                    ) : null
                )}

                {/* InSAR Persistent Scatterer Overlays */}
                {viewingResult && viewingResult.insarReport && viewingResult.insarReport.scatterers && (
                    viewingResult.insarReport.scatterers.map((point, idx) => (
                        <CircleMarker
                            key={`ps-${idx}`}
                            center={[point.lat, point.lon]}
                            radius={point.severity === 'Critical' ? 6 : point.severity === 'Alert' ? 5 : point.severity === 'Caution' ? 4 : 3}
                            pathOptions={{
                                color: sevColor(point.severity),
                                fillColor: sevColor(point.severity),
                                fillOpacity: 0.8,
                                weight: 1,
                            }}
                        >
                            <Popup>
                                <div style={{ fontSize: '0.7rem', fontFamily: MONO }}>
                                    <strong style={{ color: '#0f172a' }}>PS Point #{idx}</strong><br/>
                                    Severity: {point.severity}<br/>
                                    Displacement: {point.displacement_mm.toFixed(2)} mm<br/>
                                    Coherence: {point.coherence.toFixed(2)}
                                </div>
                            </Popup>
                        </CircleMarker>
                    ))
                )}

                {/* CFAR Ship Detection Overlays */}
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
                                <div style={{ fontSize: '0.7rem', fontFamily: MONO, minWidth: '160px' }}>
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

            {/* Continued in part 4... */}
            {/* ═══ RIGHT PANEL ═══ */}
            <div style={{
                position: 'absolute', top: '40px', right: 0, bottom: 0, width: '340px', zIndex: 100,
                background: C.bg1, borderLeft: `1px solid ${C.bg3}`,
                display: 'flex', flexDirection: 'column', overflow: 'hidden',
            }}>

            {/* ── PROFILE: SAR SCIENCE ── */}
            {profile === 'sar_science' && (
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>

                {/* DATA SOURCE */}
                <div style={{ fontFamily: MONO, fontSize: '10px', color: C.textDim, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '10px' }}>DATA SOURCE</div>
                <div style={{ display: 'flex', gap: '0', marginBottom: '12px' }}>
                    {['local','catalog'].map(m => (
                        <button key={m} onClick={() => setDataMode(m)} style={{
                            flex: 1, padding: '8px', background: 'none', cursor: 'pointer',
                            fontFamily: MONO, fontSize: '11px', border: 'none',
                            borderBottom: dataMode === m ? `2px solid ${C.accent.infra}` : '2px solid transparent',
                            color: dataMode === m ? C.text : C.textDim,
                        }}>
                            {m === 'local' ? 'LOCAL FILE' : 'NASA CATALOG'}
                        </button>
                    ))}
                </div>

                {dataMode === 'local' && (<>
                    <input
                        type="text" value={localFilePath} onChange={e => setLocalFilePath(e.target.value)}
                        placeholder="/path/to/NISAR_*.h5"
                        style={{ width: '100%', padding: '8px 10px', background: C.bg2, border: `1px solid ${C.bg3}`, color: C.text, fontFamily: MONO, fontSize: '12px', boxSizing: 'border-box', outline: 'none', borderRadius: '2px' }}
                        onFocus={e => e.target.style.borderColor = C.bg4}
                        onBlur={e => e.target.style.borderColor = C.bg3}
                    />
                    {metadata && (
                        <div style={{ marginTop: '10px' }}>
                            {[
                                ['Mission', metadata.mission],
                                ['Product', `${metadata.product} — ${metadata.productFull}`],
                                ['Level', metadata.level],
                                ['Band', metadata.band],
                                ['Orbit', metadata.direction],
                                ...(metadata.acquisitionDate ? [['Acquired', metadata.acquisitionDate]] : []),
                            ].map(([label, value]) => (
                                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: `1px solid ${C.bg2}`, fontFamily: MONO, fontSize: '11px' }}>
                                    <span style={{ color: C.textDim }}>{label}</span>
                                    <span style={{ color: label === 'Band' ? C.stable : C.text }}>{value}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </>)}

                {dataMode === 'catalog' && (<>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ width: '100%', padding: '8px 10px', background: C.bg2, border: `1px solid ${C.bg3}`, color: C.text, fontFamily: MONO, fontSize: '11px', boxSizing: 'border-box', outline: 'none', borderRadius: '2px' }} />
                        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={{ width: '100%', padding: '8px 10px', background: C.bg2, border: `1px solid ${C.bg3}`, color: C.text, fontFamily: MONO, fontSize: '11px', boxSizing: 'border-box', outline: 'none', borderRadius: '2px' }} />
                    </div>
                    <button onClick={handleSearch} disabled={isSearching} style={{ width: '100%', padding: '8px', background: 'transparent', border: `1px solid ${C.bg3}`, color: C.textMid, fontFamily: MONO, fontSize: '11px', cursor: 'pointer', borderRadius: '2px' }}
                        onMouseEnter={e => { e.target.style.borderColor = C.bg4; e.target.style.color = C.text; }}
                        onMouseLeave={e => { e.target.style.borderColor = C.bg3; e.target.style.color = C.textMid; }}
                    >{isSearching ? 'SEARCHING...' : 'SEARCH CATALOG'}</button>
                    {searchResults.length > 0 && (
                        <div style={{ marginTop: '10px' }}>
                            {searchResults.map(scene => (
                                <div key={scene.id} onClick={() => setSelectedScene(scene)} style={{
                                    padding: '8px', borderBottom: `1px solid ${C.bg2}`, cursor: 'pointer',
                                    borderLeft: selectedScene?.id === scene.id ? `3px solid ${C.accent.infra}` : '3px solid transparent',
                                    paddingLeft: selectedScene?.id === scene.id ? '13px' : '8px',
                                }}>
                                    <div style={{ fontFamily: MONO, fontSize: '10px', color: C.textMid, wordBreak: 'break-all' }}>{scene.id}</div>
                                    <div style={{ fontFamily: MONO, fontSize: '10px', color: C.textDim, display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}>
                                        <span>{scene.date?.split('T')[0]}</span>
                                        <span>{formatBytes(scene.size_bytes)}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </>)}

                {/* DIVIDER */}
                <div style={{ height: '1px', background: C.bg3, margin: '16px 0' }} />

                {/* PIPELINE */}
                <div style={{ fontFamily: MONO, fontSize: '10px', color: C.textDim, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '10px' }}>PIPELINE</div>
                {pipelines.map(p => (
                    <div key={p.id} onClick={() => setPipeline(p.id)} style={{
                        padding: '8px 12px', cursor: 'pointer',
                        borderLeft: pipeline === p.id ? `3px solid ${C.accent.infra}` : '3px solid transparent',
                        background: pipeline === p.id ? 'rgba(200,169,110,0.06)' : 'transparent',
                        marginBottom: '2px',
                    }}
                        onMouseEnter={e => { if (pipeline !== p.id) e.target.style.background = C.bg2; }}
                        onMouseLeave={e => { if (pipeline !== p.id) e.target.style.background = 'transparent'; }}
                    >
                        <div style={{ fontFamily: MONO, fontSize: '12px', color: pipeline === p.id ? C.text : C.textMid }}>{p.label}</div>
                        <div style={{ fontFamily: SANS, fontSize: '11px', color: C.textDim, marginTop: '2px' }}>{p.desc}</div>
                    </div>
                ))}

                {/* DIVIDER */}
                <div style={{ height: '1px', background: C.bg3, margin: '16px 0' }} />

                {/* EXECUTE */}
                <button onClick={startJob} disabled={!getInputFile() || runningJobs.length > 0 || !gatewayOnline} style={{
                    width: '100%', padding: '10px', background: C.accent.infra, color: C.bg0,
                    fontFamily: MONO, fontSize: '12px', fontWeight: 600, border: 'none', borderRadius: '2px',
                    cursor: (!getInputFile() || runningJobs.length > 0 || !gatewayOnline) ? 'not-allowed' : 'pointer',
                    opacity: (!getInputFile() || runningJobs.length > 0 || !gatewayOnline) ? 0.3 : 1,
                }}>
                    {runningJobs.length > 0 ? 'PROCESSING...' : 'START PROCESSING'}
                </button>
                {runningJobs.length > 0 && (
                    <div style={{ marginTop: '8px', fontFamily: MONO, fontSize: '10px', color: C.textDim }}>
                        <div>ELAPSED  {formatElapsed(elapsed[runningJobs[0]?.id])}</div>
                        <div>JOB ID   {runningJobs[0]?.id?.slice(0, 8)}</div>
                    </div>
                )}

                {/* DIVIDER */}
                {Object.values(jobs).length > 0 && <div style={{ height: '1px', background: C.bg3, margin: '16px 0' }} />}

                {/* COMPLETED JOBS */}
                {Object.values(jobs).length > 0 && (<>
                    <div style={{ fontFamily: MONO, fontSize: '10px', color: C.textDim, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '10px' }}>COMPLETED JOBS</div>
                    {Object.values(jobs).map(job => (
                        <div key={job.id} onClick={() => { setActiveJobId(job.id); setTerminalOpen(true); }} style={{ padding: '8px', borderBottom: `1px solid ${C.bg2}`, cursor: 'pointer' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontFamily: MONO, fontSize: '11px', color: C.textMid }}>{job.name}</span>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontFamily: MONO, fontSize: '10px', color: C.textDim }}>
                                    {job.status === 'completed' && <span style={{ color: C.stable }}>●</span>}
                                    {job.status === 'running' && <span style={{ color: C.accent.infra }}>●</span>}
                                    {job.status === 'failed' && <span style={{ color: C.critical }}>●</span>}
                                    {elapsed[job.id] != null && formatElapsed(elapsed[job.id])}
                                </span>
                            </div>
                            {job.status === 'completed' && (
                                <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                                    <button onClick={(e) => { e.stopPropagation(); setViewingResult({ url: api(job.output_path), bounds: job.bounds, insarReport: job.insarReport, ships: job.ships, pipeline: job.pipeline, elapsed: elapsed[job.id], bbox: job.bbox }); }}
                                        style={{ flex: 1, padding: '4px 8px', background: 'transparent', border: `1px solid ${C.bg3}`, color: C.stable, fontFamily: MONO, fontSize: '10px', cursor: 'pointer', borderRadius: '2px' }}>VIEW</button>
                                    <button onClick={(e) => { e.stopPropagation(); window.open(api(job.output_path), '_blank'); }}
                                        style={{ flex: 1, padding: '4px 8px', background: 'transparent', border: `1px solid ${C.bg3}`, color: C.textMid, fontFamily: MONO, fontSize: '10px', cursor: 'pointer', borderRadius: '2px' }}>DL</button>
                                </div>
                            )}
                        </div>
                    ))}
                </>)}
            </div>
            )}

            {/* Continued in part 4b — Infrastructure + Maritime panels... */}
            {/* ── PROFILE 2: INFRASTRUCTURE ── */}
            {profile === 'infrastructure' && (
                <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
                    {/* SECTION: ASSET SELECTION */}
                    <div style={{ fontFamily: MONO, fontSize: '10px', color: '#555555', marginBottom: '8px' }}>MONITORED ASSET</div>
                    <select
                        value={assetType}
                        onChange={(e) => setAssetType(e.target.value)}
                        style={{ width: '100%', background: '#1A1A1A', border: '1px solid #2A2A2A', color: '#F0F0F0', fontFamily: MONO, fontSize: '12px', padding: '8px 10px', outline: 'none', borderRadius: '2px', marginBottom: '8px' }}
                    >
                        <option value="DAM">DAM</option>
                        <option value="BRIDGE">BRIDGE</option>
                        <option value="EMBANKMENT">EMBANKMENT</option>
                    </select>
                    <input
                        type="text"
                        value={assetName}
                        onChange={(e) => setAssetName(e.target.value)}
                        placeholder="e.g. Hirakud Dam, Odisha"
                        style={{ width: '100%', background: '#1A1A1A', border: '1px solid #2A2A2A', color: '#F0F0F0', fontFamily: MONO, fontSize: '12px', padding: '8px 10px', outline: 'none', borderRadius: '2px', marginBottom: '8px' }}
                        onFocus={(e) => e.target.style.borderColor = '#404040'}
                        onBlur={(e) => e.target.style.borderColor = '#2A2A2A'}
                    />
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                        <input
                            type="text"
                            value={assetLat}
                            onChange={(e) => setAssetLat(e.target.value)}
                            placeholder="LAT"
                            style={{ flex: 1, background: '#1A1A1A', border: '1px solid #2A2A2A', color: '#F0F0F0', fontFamily: MONO, fontSize: '11px', padding: '8px 10px', outline: 'none', borderRadius: '2px', width: '100%' }}
                            onFocus={(e) => e.target.style.borderColor = '#404040'}
                            onBlur={(e) => e.target.style.borderColor = '#2A2A2A'}
                        />
                        <input
                            type="text"
                            value={assetLon}
                            onChange={(e) => setAssetLon(e.target.value)}
                            placeholder="LON"
                            style={{ flex: 1, background: '#1A1A1A', border: '1px solid #2A2A2A', color: '#F0F0F0', fontFamily: MONO, fontSize: '11px', padding: '8px 10px', outline: 'none', borderRadius: '2px', width: '100%' }}
                            onFocus={(e) => e.target.style.borderColor = '#404040'}
                            onBlur={(e) => e.target.style.borderColor = '#2A2A2A'}
                        />
                    </div>

                    {/* SECTION: ENVIRONMENTAL CONTEXT */}
                    <div style={{ fontFamily: MONO, fontSize: '10px', color: '#555555', marginBottom: '8px' }}>FIELD CONTEXT</div>
                    {envContext ? (
                        <div style={{ marginBottom: '16px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #1A1A1A', fontFamily: MONO, fontSize: '11px' }}>
                                <span style={{ color: '#555555' }}>RESERVOIR</span>
                                <span style={{ color: '#F0F0F0' }}>{envContext.reservoir}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #1A1A1A', fontFamily: MONO, fontSize: '11px' }}>
                                <span style={{ color: '#555555' }}>RAINFALL 72H</span>
                                <span style={{ color: '#F0F0F0' }}>{envContext.rainfall}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #1A1A1A', fontFamily: MONO, fontSize: '11px' }}>
                                <span style={{ color: '#555555' }}>SOIL MOIST.</span>
                                <span style={{ color: '#F0F0F0' }}>{envContext.soil_moisture}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #1A1A1A', fontFamily: MONO, fontSize: '11px' }}>
                                <span style={{ color: '#555555' }}>SEISMIC</span>
                                <span style={{ color: '#F0F0F0' }}>{envContext.seismic}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #1A1A1A', fontFamily: MONO, fontSize: '11px' }}>
                                <span style={{ color: '#555555' }}>SEASON</span>
                                <span style={{ color: '#F0F0F0' }}>{envContext.season}</span>
                            </div>
                            <div style={{ marginTop: '8px' }}>
                                <div style={{ fontFamily: SANS, fontSize: '12px', color: '#F0F0F0' }}>{envContext.assessment}</div>
                                <div style={{ fontFamily: MONO, fontSize: '11px', color: envContext.confidence === 'HIGH' ? '#4CAF50' : envContext.confidence === 'MODERATE' ? '#E6A817' : '#C0392B' }}>{envContext.confidence}</div>
                                <div style={{ fontFamily: MONO, fontSize: '10px', color: '#555555' }}>{envContext.source || "ERA5, GRanD, USGS, SMAP"}</div>
                            </div>
                        </div>
                    ) : (
                        <div style={{ marginBottom: '16px' }}>
                            {assetLat && assetLon && (
                                <button
                                    onClick={fetchContext}
                                    style={{ width: '100%', background: 'transparent', border: '1px solid #2A2A2A', color: '#888888', fontFamily: MONO, fontSize: '11px', padding: '8px 10px', borderRadius: '2px', cursor: 'pointer' }}
                                    onMouseEnter={(e) => { e.target.style.borderColor = '#404040'; e.target.style.color = '#F0F0F0'; }}
                                    onMouseLeave={(e) => { e.target.style.borderColor = '#2A2A2A'; e.target.style.color = '#888888'; }}
                                >
                                    {fetchingContext ? 'FETCHING FIELD DATA...' : 'FETCH CONTEXT'}
                                </button>
                            )}
                            {!fetchingContext && envContext === null && assetLat && assetLon && (
                                <div style={{ fontFamily: MONO, fontSize: '11px', color: '#555555', marginTop: '8px', textAlign: 'center' }}>CONTEXT UNAVAILABLE</div>
                            )}
                        </div>
                    )}

                    <div style={{ height: '1px', background: '#2A2A2A', margin: '16px 0' }}></div>

                    {/* SECTION: PIPELINE */}
                    <div style={{ fontFamily: MONO, fontSize: '10px', color: '#555555', marginBottom: '8px' }}>PIPELINE</div>
                    <div style={{ fontFamily: MONO, fontSize: '12px', color: '#C8A96E', marginBottom: '16px' }}>InSAR Analysis</div>

                    <div style={{ height: '1px', background: '#2A2A2A', margin: '16px 0' }}></div>

                    {/* SECTION: EXECUTE */}
                    <button
                        onClick={startJob}
                        disabled={!getInputFile() || runningJobs.length > 0 || !gatewayOnline}
                        style={{
                            width: '100%', background: '#C8A96E', color: '#0A0A0A', fontFamily: MONO, fontSize: '12px', fontWeight: 600, padding: '10px', border: 'none', borderRadius: '2px',
                            cursor: (!getInputFile() || runningJobs.length > 0 || !gatewayOnline) ? 'not-allowed' : 'pointer',
                            opacity: (!getInputFile() || runningJobs.length > 0 || !gatewayOnline) ? 0.3 : 1,
                        }}
                    >
                        {runningJobs.length > 0 ? 'PROCESSING...' : 'START PROCESSING'}
                    </button>
                    {runningJobs.length > 0 && (
                        <div style={{ marginTop: '8px', fontFamily: MONO, fontSize: '10px', color: '#555555' }}>
                            <div>ELAPSED  {formatElapsed(elapsed[runningJobs[0]?.id])}</div>
                            <div>JOB ID   {runningJobs[0]?.id?.substring(0, 8)}</div>
                        </div>
                    )}

                    <div style={{ height: '1px', background: '#2A2A2A', margin: '16px 0' }}></div>

                    {/* SECTION: INSAR RESULTS */}
                    {viewingResult?.insarReport?.summary && (() => {
                        const s = viewingResult.insarReport.summary;
                        const topScatterers = (viewingResult.insarReport.scatterers || [])
                            .sort((a, b) => Math.abs(b.displacement_mm) - Math.abs(a.displacement_mm))
                            .slice(0, 10);
                        const dispMagnitude = Math.abs(s.max_displacement_mm || 0);
                        const dispColorVal = dispMagnitude < 5 ? '#4CAF50' : dispMagnitude < 10 ? '#E6A817' : dispMagnitude < 20 ? '#D4822A' : '#C0392B';

                        return (
                            <div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px', background: '#2A2A2A', border: '1px solid #2A2A2A', marginBottom: '16px' }}>
                                    <div style={{ background: '#111111', padding: '8px', textAlign: 'center' }}>
                                        <div style={{ fontFamily: MONO, fontSize: '9px', color: '#555555', marginBottom: '4px' }}>STABLE</div>
                                        <div style={{ fontFamily: MONO, fontSize: '22px', fontWeight: 600, color: '#4CAF50' }}>{s.stable_count}</div>
                                    </div>
                                    <div style={{ background: '#111111', padding: '8px', textAlign: 'center' }}>
                                        <div style={{ fontFamily: MONO, fontSize: '9px', color: '#555555', marginBottom: '4px' }}>CAUTION</div>
                                        <div style={{ fontFamily: MONO, fontSize: '22px', fontWeight: 600, color: '#E6A817' }}>{s.caution_count}</div>
                                    </div>
                                    <div style={{ background: '#111111', padding: '8px', textAlign: 'center' }}>
                                        <div style={{ fontFamily: MONO, fontSize: '9px', color: '#555555', marginBottom: '4px' }}>ALERT</div>
                                        <div style={{ fontFamily: MONO, fontSize: '22px', fontWeight: 600, color: '#D4822A' }}>{s.alert_count}</div>
                                    </div>
                                    <div style={{ background: '#111111', padding: '8px', textAlign: 'center', border: s.critical_count > 0 ? '1px solid #C0392B' : 'none' }}>
                                        <div style={{ fontFamily: MONO, fontSize: '9px', color: '#555555', marginBottom: '4px' }}>CRITICAL</div>
                                        <div style={{ fontFamily: MONO, fontSize: '22px', fontWeight: 600, color: '#C0392B' }}>{s.critical_count}</div>
                                    </div>
                                </div>

                                <div style={{ marginBottom: '16px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #1A1A1A', fontFamily: MONO, fontSize: '11px' }}>
                                        <span style={{ color: '#555555' }}>MAX DISPLACEMENT</span>
                                        <span>
                                            <span style={{ color: dispColorVal }}>{s.max_displacement_mm?.toFixed(2)} mm</span>
                                            {(s.max_displacement_mm || 0) < 0 && <span style={{ color: '#E6A817', marginLeft: '4px' }}>(SUBSIDENCE)</span>}
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #1A1A1A', fontFamily: MONO, fontSize: '11px' }}>
                                        <span style={{ color: '#555555' }}>MEDIAN</span>
                                        <span style={{ color: '#F0F0F0' }}>{s.median_displacement_mm?.toFixed(2)} mm</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #1A1A1A', fontFamily: MONO, fontSize: '11px' }}>
                                        <span style={{ color: '#555555' }}>TOTAL PS POINTS</span>
                                        <span style={{ color: '#F0F0F0' }}>{s.total_ps_points}</span>
                                    </div>
                                </div>

                                {topScatterers.length > 0 && (
                                    <div>
                                        <div style={{ fontFamily: MONO, fontSize: '10px', color: '#555555', display: 'flex', paddingBottom: '4px', borderBottom: '1px solid #1A1A1A' }}>
                                            <div style={{ width: '20px' }}>#</div>
                                            <div style={{ flex: 1 }}>DISP (mm)</div>
                                            <div style={{ width: '40px' }}>COH</div>
                                            <div style={{ width: '60px' }}>SEV</div>
                                        </div>
                                        {topScatterers.map((pt, idx) => (
                                            <div key={idx} style={{ fontFamily: MONO, fontSize: '10px', display: 'flex', padding: '4px 0', borderBottom: '1px solid #1A1A1A' }}>
                                                <div style={{ width: '20px', color: '#888888' }}>{idx + 1}</div>
                                                <div style={{ flex: 1, color: sevColor(pt.severity) }}>{pt.displacement_mm?.toFixed(2)}</div>
                                                <div style={{ width: '40px', color: '#F0F0F0' }}>{pt.coherence?.toFixed(2)}</div>
                                                <div style={{ width: '60px', color: sevColor(pt.severity) }}>{pt.severity}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })()}
                </div>
            )}

            {/* ── PROFILE 3: MARITIME INTEL ── */}
            {profile === 'maritime' && (
                <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
                    {/* SECTION: SEARCH AREA */}
                    <div style={{ fontFamily: MONO, fontSize: '10px', color: '#555555', marginBottom: '8px' }}>SEARCH AREA</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            style={{ width: '100%', background: '#1A1A1A', border: '1px solid #2A2A2A', color: '#F0F0F0', fontFamily: MONO, fontSize: '12px', padding: '8px 10px', outline: 'none', borderRadius: '2px', boxSizing: 'border-box' }}
                            onFocus={(e) => e.target.style.borderColor = '#404040'}
                            onBlur={(e) => e.target.style.borderColor = '#2A2A2A'}
                        />
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            style={{ width: '100%', background: '#1A1A1A', border: '1px solid #2A2A2A', color: '#F0F0F0', fontFamily: MONO, fontSize: '12px', padding: '8px 10px', outline: 'none', borderRadius: '2px', boxSizing: 'border-box' }}
                            onFocus={(e) => e.target.style.borderColor = '#404040'}
                            onBlur={(e) => e.target.style.borderColor = '#2A2A2A'}
                        />
                    </div>
                    <button
                        onClick={handleSearch}
                        disabled={isSearching}
                        style={{ width: '100%', background: 'transparent', border: '1px solid #2A2A2A', color: '#888888', fontFamily: MONO, fontSize: '11px', padding: '8px 10px', borderRadius: '2px', cursor: 'pointer', marginBottom: '16px' }}
                        onMouseEnter={(e) => { e.target.style.borderColor = '#404040'; e.target.style.color = '#F0F0F0'; }}
                        onMouseLeave={(e) => { e.target.style.borderColor = '#2A2A2A'; e.target.style.color = '#888888'; }}
                    >
                        {isSearching ? 'SEARCHING...' : 'SEARCH CATALOG'}
                    </button>
                    {searchResults.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '16px' }}>
                            {searchResults.map((scene) => (
                                <div
                                    key={scene.id}
                                    onClick={() => setSelectedScene(scene)}
                                    style={{ padding: '8px', borderBottom: '1px solid #1A1A1A', borderLeft: selectedScene?.id === scene.id ? `3px solid #4A8FA8` : '3px solid transparent', paddingLeft: selectedScene?.id === scene.id ? '13px' : '8px', cursor: 'pointer' }}
                                >
                                    <div style={{ fontFamily: MONO, fontSize: '10px', color: '#888888' }}>{scene.id}</div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: MONO, fontSize: '10px', color: '#555555', marginTop: '4px' }}>
                                        <span>{scene.date?.split('T')[0]}</span>
                                        <span>{formatBytes(scene.size_bytes)}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    <div style={{ fontFamily: MONO, fontSize: '10px', color: '#555555', marginBottom: '8px' }}>PIPELINE</div>
                    <div style={{ fontFamily: MONO, fontSize: '12px', color: '#F0F0F0', marginBottom: '16px' }}>Maritime CFAR</div>

                    <div style={{ height: '1px', background: '#2A2A2A', margin: '16px 0' }}></div>

                    {/* SECTION: EXECUTE */}
                    {dataMode === 'catalog' && selectedScene ? (
                        <button
                            onClick={handleAcquireAndProcess}
                            disabled={runningJobs.length > 0 || !gatewayOnline}
                            style={{
                                width: '100%', background: '#C8A96E', color: '#0A0A0A', fontFamily: MONO, fontSize: '12px', fontWeight: 600, padding: '10px', border: 'none', borderRadius: '2px',
                                cursor: (runningJobs.length > 0 || !gatewayOnline) ? 'not-allowed' : 'pointer',
                                opacity: (runningJobs.length > 0 || !gatewayOnline) ? 0.3 : 1,
                            }}
                        >
                            {downloadProgress !== null ? (
                                downloadProgress === 'complete' ? 'DOWNLOADING COMPLETE' : `DOWNLOADING  ${downloadProgress}%`
                            ) : runningJobs.length > 0 ? 'PROCESSING...' : 'ACQUIRE + PROCESS'}
                        </button>
                    ) : (
                        <button
                            onClick={startJob}
                            disabled={!getInputFile() || runningJobs.length > 0 || !gatewayOnline}
                            style={{
                                width: '100%', background: '#C8A96E', color: '#0A0A0A', fontFamily: MONO, fontSize: '12px', fontWeight: 600, padding: '10px', border: 'none', borderRadius: '2px',
                                cursor: (!getInputFile() || runningJobs.length > 0 || !gatewayOnline) ? 'not-allowed' : 'pointer',
                                opacity: (!getInputFile() || runningJobs.length > 0 || !gatewayOnline) ? 0.3 : 1,
                            }}
                        >
                            {runningJobs.length > 0 ? 'PROCESSING...' : 'START PROCESSING'}
                        </button>
                    )}
                    {downloadProgress !== null && downloadProgress !== 'complete' && (
                        <div style={{ height: '2px', background: '#1A1A1A', marginTop: '8px' }}>
                            <div style={{ height: '100%', width: `${downloadProgress}%`, background: '#C8A96E' }}></div>
                        </div>
                    )}
                    {runningJobs.length > 0 && (
                        <div style={{ marginTop: '8px', fontFamily: MONO, fontSize: '10px', color: '#555555' }}>
                            <div>ELAPSED  {formatElapsed(elapsed[runningJobs[0]?.id])}</div>
                            <div>JOB ID   {runningJobs[0]?.id?.substring(0, 8)}</div>
                        </div>
                    )}

                    <div style={{ height: '1px', background: '#2A2A2A', margin: '16px 0' }}></div>

                    {/* SECTION: DETECTION RESULTS */}
                    {viewingResult?.ships?.length > 0 && (() => {
                        const ships = viewingResult.ships;
                        const intensities = ships.map((s) => s.intensity);
                        const maxBackscatter = Math.max(...intensities);
                        const minBackscatter = Math.min(...intensities);
                        const meanBackscatter = intensities.reduce((a, b) => a + b, 0) / ships.length;

                        return (
                            <div>
                                <div style={{ fontFamily: MONO, fontSize: '32px', fontWeight: 600, color: '#C0392B' }}>{ships.length}</div>
                                <div style={{ fontFamily: MONO, fontSize: '10px', color: '#888888', marginBottom: '16px' }}>VESSELS DETECTED VIA CA-CFAR</div>

                                <div style={{ marginBottom: '16px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontFamily: MONO, fontSize: '11px' }}>
                                        <span style={{ color: '#555555' }}>MAX BACKSCATTER</span>
                                        <span style={{ color: '#7EB8D4' }}>{maxBackscatter.toFixed(2)} dB</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontFamily: MONO, fontSize: '11px' }}>
                                        <span style={{ color: '#555555' }}>MEAN BACKSCATTER</span>
                                        <span style={{ color: '#7EB8D4' }}>{meanBackscatter.toFixed(2)} dB</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontFamily: MONO, fontSize: '11px' }}>
                                        <span style={{ color: '#555555' }}>MIN BACKSCATTER</span>
                                        <span style={{ color: '#7EB8D4' }}>{minBackscatter.toFixed(2)} dB</span>
                                    </div>
                                </div>

                                <div>
                                    {ships.map((ship, idx) => (
                                        <div
                                            key={idx}
                                            style={{ padding: '6px 0', borderBottom: '1px solid #1A1A1A', fontFamily: MONO, fontSize: '10px', color: '#888888', cursor: 'pointer' }}
                                            onMouseEnter={(e) => { e.currentTarget.style.background = '#1A1A1A'; }}
                                            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                                        >
                                            V{idx + 1}  {ship.lat.toFixed(5)}°N  {ship.lon.toFixed(5)}°E  {ship.intensity.toFixed(2)}dB
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })()}
                </div>
            )}
        </div>
        // Continued in part 5...
            {/* ═══ GATEWAY OFFLINE BANNER ═══ */}
            {!gatewayOnline && (
                <div style={{
                    position: 'absolute', top: '16px', left: '50%', transform: 'translateX(-50%)', zIndex: 1100,
                    background: '#C0392B', padding: '8px 16px', borderRadius: '2px', border: '1px solid #C0392B',
                    display: 'flex', alignItems: 'center', gap: '8px',
                    fontFamily: MONO, fontSize: '11px', color: '#F0F0F0',
                }}>
                    <WifiOff size={12} /> GATEWAY OFFLINE — RUN: LOCAL_MODE=true cargo run --release
                </div>
            )}

            {/* ═══ ERROR TOAST ═══ */}
            {errorToast && (
                <div style={{
                    position: 'absolute', top: '16px', right: '360px', zIndex: 1100,
                    background: '#1A1A1A', padding: '10px 14px', borderRadius: '2px', border: '1px solid #C0392B',
                    display: 'flex', alignItems: 'center', gap: '8px',
                    fontFamily: SANS, fontSize: '12px', color: '#F0F0F0',
                }}>
                    <AlertTriangle size={14} color="#C0392B" />
                    {errorToast}
                    <button onClick={() => setErrorToast(null)} style={{ background: 'none', border: 'none', color: '#555555', cursor: 'pointer', marginLeft: '12px' }}
                        onMouseEnter={e => e.target.style.color = '#F0F0F0'} onMouseLeave={e => e.target.style.color = '#555555'}
                    ><X size={12} /></button>
                </div>
            )}

            {/* ═══ COORDINATES HUD ═══ */}
            <div style={{
                position: 'absolute', bottom: '16px', left: '16px', zIndex: 900,
                background: '#111111', border: '1px solid #2A2A2A', padding: '4px 10px',
                fontFamily: MONO, fontSize: '11px', color: '#7EB8D4',
                display: 'flex', alignItems: 'center', gap: '12px', borderRadius: '2px'
            }}>
                <span>LAT: {mouseCoords.lat}°</span>
                <span>LON: {mouseCoords.lon}°</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#888888' }}>
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: gatewayOnline ? '#4CAF50' : '#C0392B' }} />
                    {gatewayOnline ? 'ONLINE' : 'OFFLINE'}
                </span>
            </div>

            {/* ═══ TERMINAL DRAWER ═══ */}
            <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 1000,
                height: terminalOpen && activeJobId ? '240px' : '0px',
                transition: 'height 200ms ease', overflow: 'hidden',
                background: '#0A0A0A', borderTop: '1px solid #2A2A2A',
                display: 'flex', flexDirection: 'column'
            }}>
                <div style={{ height: '36px', background: '#111111', borderBottom: '1px solid #2A2A2A', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 16px', flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Terminal size={14} color="#888888" />
                        <span style={{ fontFamily: MONO, fontSize: '10px', color: '#555555' }}>PROCESSING LOG</span>
                        {activeJob?.status === 'running' && (
                            <span style={{ fontFamily: MONO, fontSize: '9px', color: '#E6A817', border: '1px solid #E6A817', padding: '1px 4px', borderRadius: '2px' }}>LIVE</span>
                        )}
                        {logs[activeJobId] && (
                            <span style={{ fontFamily: MONO, fontSize: '10px', color: '#555555', marginLeft: '4px' }}>{logs[activeJobId].length} LINES</span>
                        )}
                    </div>
                    <button onClick={() => setTerminalOpen(false)} style={{ background: 'none', border: 'none', color: '#555555', cursor: 'pointer', padding: '4px' }}
                        onMouseEnter={e => e.currentTarget.style.color = '#F0F0F0'} onMouseLeave={e => e.currentTarget.style.color = '#555555'}>
                        <X size={14} />
                    </button>
                </div>
                <div ref={terminalRef} onScroll={handleTerminalScroll} style={{ flex: 1, padding: '12px 16px', overflowY: 'auto', fontFamily: MONO, fontSize: '11px', lineHeight: 1.7 }}>
                    {(!logs[activeJobId] || logs[activeJobId].length === 0) ? (
                        <div style={{ color: '#555555' }}>WAITING FOR PROCESSOR OUTPUT</div>
                    ) : (
                        logs[activeJobId].map((line, idx) => {
                            const isErr = line.includes('ERROR') || line.includes('FAILED') || line.includes('Failed');
                            const isSucc = line.includes('COMPLETED') || line.includes('✓');
                            const isSys = line.includes('[SYSTEM]');
                            const isCfar = line.includes('CFAR') || line.includes('ship') || line.includes('vessel');
                            const isInSar = line.includes('InSAR') || line.includes('phase');
                            const color = isErr ? '#C0392B' : isSucc ? '#4CAF50' : isSys ? '#7EB8D4' : isCfar ? '#E6A817' : isInSar ? '#9B8EC4' : '#555555';
                            return (
                                <div key={idx} style={{ color, wordBreak: 'break-all', paddingLeft: '14px', textIndent: '-14px' }}>
                                    <span style={{ color: '#2A2A2A', marginRight: '6px' }}>›</span>
                                    {line}
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* ═══ MINIMIZED TERMINAL BUTTON ═══ */}
            {!terminalOpen && activeJobId && (
                <button
                    onClick={() => setTerminalOpen(true)}
                    style={{
                        position: 'absolute', bottom: '16px', right: '16px', zIndex: 900,
                        background: '#111111', border: '1px solid #2A2A2A', borderRadius: '2px',
                        padding: '6px 12px', color: '#888888', fontFamily: MONO, fontSize: '11px',
                        cursor: 'pointer'
                    }}
                    onMouseEnter={e => { e.target.style.borderColor = '#404040'; e.target.style.color = '#F0F0F0'; }}
                    onMouseLeave={e => { e.target.style.borderColor = '#2A2A2A'; e.target.style.color = '#888888'; }}
                >
                    LOG [{logs[activeJobId]?.length || 0} LINES]{activeJob?.status === 'running' ? ' ···' : ''}
                </button>
            )}

        </div>
    );
}

export default AppDashboard;
