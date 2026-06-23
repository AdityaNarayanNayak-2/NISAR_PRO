import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapContainer, TileLayer, ImageOverlay, GeoJSON, CircleMarker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { api, getGatewayUrl } from '../../config/api';
import { Terminal, Play, ChevronDown, CheckCircle, AlertTriangle, Loader, Search, FolderOpen, Satellite, Eye, Download, ArrowLeft, MapPin, Calendar, Layers, X, Anchor, Crosshair, Waves, Palette, WifiOff, Clock, Info, Ship } from 'lucide-react';

import { MONO, SANS, C, PROFILES } from './constants';
import { parseNisarFilename, sevColor, dispColor, formatBytes, formatElapsed } from './helpers';
import { MapFlyTo, MapEventTracker } from './MapComponents';
import SarSciencePanel from './SarSciencePanel';
import InfrastructurePanel from './InfrastructurePanel';
import MaritimePanel from './MaritimePanel';


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
    const [activeLayer, setActiveLayer] = useState('amplitude');
    const [slaveFilePath, setSlaveFilePath] = useState('');
    const [assetSearch, setAssetSearch] = useState('');
    const [assetResults, setAssetResults] = useState([]);
    const [assetSearchOpen, setAssetSearchOpen] = useState(false);
    const [assetState, setAssetState] = useState('');
    const [contextFetchedAt, setContextFetchedAt] = useState(null);

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
            const d = n.toISOString().slice(0, 10);
            const t = n.toISOString().slice(11, 19);
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
    const formatBytes = (bytes) => { const b = parseInt(bytes, 10); if (isNaN(b) || b === 0) return '0 B'; const k = 1024, sizes = ['B', 'KB', 'MB', 'GB', 'TB']; const i = Math.floor(Math.log(b) / Math.log(k)); return parseFloat((b / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]; };
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
        const activePipeline = profile === 'infrastructure' ? 'insar' : profile === 'maritime' ? 'cfar' : pipeline;

        try {
            const body = {
                input_file: inputFile,
                synthetic: false,
                pipeline: profile === 'infrastructure' ? 'insar' :
                    profile === 'maritime' ? 'cfar' : pipeline
            };
            if (profile === 'infrastructure') {
                body.slave_file = slaveFilePath || null;
                body.crop_lat = parseFloat(assetLat) || null;
                body.crop_lon = parseFloat(assetLon) || null;
                body.crop_radius_km = 10.0;
            }
            const res = await fetch(api('/jobs'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const data = await res.json();
            const id = data.job_id;
            setJobs(prev => ({ ...prev, [id]: { id, status: 'running', name: getInputLabel(), bounds: null, bbox: null, pipeline: activePipeline, startedAt: Date.now() } }));
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
            const body = {
                input_file: filePath,
                synthetic: false,
                pipeline: activePipeline
            };
            if (profile === 'infrastructure') {
                body.slave_file = slaveFilePath || null;
                body.crop_lat = parseFloat(assetLat) || null;
                body.crop_lon = parseFloat(assetLon) || null;
                body.crop_radius_km = 10.0;
            }
            const res = await fetch(api('/jobs'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const data = await res.json();
            const id = data.job_id;
            const label = filePath.split('/').pop();
            setJobs(prev => ({ ...prev, [id]: { id, status: 'running', name: label, bounds: null, bbox: null, pipeline: activePipeline, startedAt: Date.now() } }));
            setActiveJobId(id); setTerminalOpen(true);
            const sse = new EventSource(api(`/jobs/${id}/logs`));
            sse.onmessage = (event) => {
                const line = event.data;
                if (line.startsWith('{')) { try { const parsed = JSON.parse(line); if (parsed.event === 'georef' && parsed.bbox) { const { north, south, east, west } = parsed.bbox; if (Math.abs(north - south) > 0.0001 && Math.abs(east - west) > 0.0001) { setJobs(prev => ({ ...prev, [id]: { ...prev[id], bounds: [[south, west], [north, east]], bbox: parsed.bbox } })); setFlyToCenter([(north + south) / 2, (east + west) / 2]); } } else if (parsed.event === 'insar_report' && parsed.path) { fetch(api(`/${parsed.path}`)).then(r => r.json()).then(report => { setJobs(prev => ({ ...prev, [id]: { ...prev[id], insarReport: report } })); }).catch(console.error); } else if (parsed.event === 'ships_detected' && parsed.path) { fetch(api(`/${parsed.path}`)).then(r => r.json()).then(ships => { setJobs(prev => ({ ...prev, [id]: { ...prev[id], ships } })); }).catch(console.error); } } catch (e) { } }
                setLogs(prev => ({ ...prev, [id]: [...(prev[id] || []), line] }));
                if (terminalRef.current && !userScrolledUp.current) terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
                if (line.includes('[SYSTEM] PROCESS_COMPLETED') || line.includes('[SYSTEM] PROCESS_FAILED')) { sse.close(); setTimeout(() => { setJobs(prev => { const job = prev[id]; if (job) { setElapsed(e => ({ ...e, [id]: Math.floor((Date.now() - job.startedAt) / 1000) })); } return prev; }); }, 500); }
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
                        setActiveLayer('amplitude');
                    }
                    setJobs(prev => ({ ...prev, [id]: { ...prev[id], status: data.status, output_path: data.output_path } }));
                } catch (e) { }
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
            const data = await res.json(); setEnvContext(data); setContextFetchedAt(new Date());
        } catch { setEnvContext(null); }
        finally { setFetchingContext(false); }
    };

    // ── Search infrastructure assets via Nominatim ──
    const searchAssets = async (query) => {
        if (query.length < 2) { setAssetResults([]); setAssetSearchOpen(false); return; }
        try {
            const res = await fetch(api(`/assets/search?q=${encodeURIComponent(query)}`));
            const data = await res.json();
            setAssetResults(data);
            setAssetSearchOpen(data.length > 0);
        } catch { setAssetResults([]); }
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

    // Auto-fetch context when asset coordinates are set
    useEffect(() => {
        if (assetLat && assetLon && profile === 'infrastructure') {
            const timer = setTimeout(fetchContext, 500);
            return () => clearTimeout(timer);
        }
    }, [assetLat, assetLon]);

    // Force pipeline when switching profiles
    useEffect(() => {
        if (profile === 'infrastructure') {
            setPipeline('insar');
            setDataMode('local');
        }
        if (profile === 'maritime') setPipeline('cfar');
        setActiveLayer('amplitude');
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
                position: 'fixed', top: 0, left: 0, right: 0, height: '42px', zIndex: 200,
                background: 'rgba(17, 17, 17, 0.82)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
                borderTop: `2px solid ${activeProfile.accent}`,
                borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
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
                style={{ position: 'absolute', top: '42px', left: profile === 'infrastructure' ? '240px' : 0, right: 0, bottom: profile === 'infrastructure' ? '80px' : 0, cursor: 'crosshair', zIndex: 0 }}
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
                {viewingResult && viewingResult.url && (() => {
                    const resultPath = viewingResult.url.startsWith('/results/')
                        ? viewingResult.url.replace('/results/', '')
                        : viewingResult.url.split('/results/').pop();

                    let finalTifPath = resultPath;
                    let extraParams = '';

                    if (profile === 'infrastructure') {
                        const baseName = resultPath.replace('.tif', '');
                        if (activeLayer === 'deformation') {
                            finalTifPath = baseName + '_defo_phase.tif';
                            extraParams = '&colormap_name=rdylgn&rescale=-20,20';
                        } else if (activeLayer === 'coherence') {
                            finalTifPath = baseName + '_coherence.tif';
                            extraParams = '&colormap_name=greys&rescale=0,1';
                        }
                    }

                    const tifUrl = encodeURIComponent(
                        `file:///home/aditya/Desktop/sar_analyzer/sar-gateway/results/${finalTifPath}`
                    );
                    return (
                        <TileLayer
                            url={`http://localhost:8000/cog/tiles/WebMercatorQuad/{z}/{x}/{y}?url=${tifUrl}&tilesize=512${extraParams}`}
                            attribution=""
                            opacity={0.75}
                            key={`${viewingResult.url}_${activeLayer}`}
                            minZoom={7}
                            maxZoom={13}
                        />
                    );
                })()}

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
                                    <strong style={{ color: '#0f172a' }}>PS Point #{idx}</strong><br />
                                    Severity: {point.severity}<br />
                                    Displacement: {point.displacement_mm.toFixed(2)} mm<br />
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
                                        Backscatter: {ship.intensity.toFixed(2)}<br />
                                        Lat: {ship.lat.toFixed(5)}°<br />
                                        Lon: {ship.lon.toFixed(5)}°
                                    </div>
                                </div>
                            </Popup>
                        </CircleMarker>
                    ))
                )}
                {/* Processing scan ring (Phase E) */}
                {runningJobs.length > 0 && assetLat && assetLon && profile === 'infrastructure' && (
                    <CircleMarker
                        center={[parseFloat(assetLat), parseFloat(assetLon)]}
                        radius={20}
                        pathOptions={{
                            color: activeProfile.accent,
                            fillOpacity: 0,
                            weight: 2,
                            className: 'scan-pulse'
                        }}
                    />
                )}
            </MapContainer>

            {/* ═══ MAP CROSSHAIR (Phase D) ═══ */}
            <div className="map-crosshair" />
            <div className="map-crosshair-box" />

            {/* Continued in part 4... */}
            {/* ═══ INFRASTRUCTURE: 3-ZONE LAYOUT (rendered outside right panel) ═══ */}
            {profile === 'infrastructure' && (
                <InfrastructurePanel
                    assetSearch={assetSearch}
                    setAssetSearch={setAssetSearch}
                    searchAssets={searchAssets}
                    assetSearchOpen={assetSearchOpen}
                    setAssetSearchOpen={setAssetSearchOpen}
                    assetResults={assetResults}
                    setAssetResults={setAssetResults}
                    assetName={assetName}
                    setAssetName={setAssetName}
                    assetType={assetType}
                    setAssetType={setAssetType}
                    assetLat={assetLat}
                    setAssetLat={setAssetLat}
                    assetLon={assetLon}
                    setAssetLon={setAssetLon}
                    assetState={assetState}
                    setAssetState={setAssetState}
                    setFlyToCenter={setFlyToCenter}
                    envContext={envContext}
                    fetchingContext={fetchingContext}
                    fetchContext={fetchContext}
                    contextFetchedAt={contextFetchedAt}
                    localFilePath={localFilePath}
                    setLocalFilePath={setLocalFilePath}
                    metadata={metadata}
                    slaveFilePath={slaveFilePath}
                    setSlaveFilePath={setSlaveFilePath}
                    activeLayer={activeLayer}
                    setActiveLayer={setActiveLayer}
                    startJob={startJob}
                    getInputFile={getInputFile}
                    runningJobs={runningJobs}
                    gatewayOnline={gatewayOnline}
                    elapsed={elapsed}
                    viewingResult={viewingResult}
                />
            )}

            {/* ═══ RIGHT PANEL (SAR Science / Maritime only) ═══ */}
            <div style={{
                position: 'absolute', top: '42px', right: 0, bottom: 0, width: '340px', zIndex: 100,
                background: 'rgba(17, 17, 17, 0.82)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
                borderLeft: '1px solid rgba(255, 255, 255, 0.06)',
                display: profile === 'infrastructure' ? 'none' : 'flex', flexDirection: 'column', overflow: 'hidden',
            }}>

                {/* ── PROFILE: SAR SCIENCE ── */}
                {profile === 'sar_science' && (
                    <SarSciencePanel
                        dataMode={dataMode}
                        setDataMode={setDataMode}
                        localFilePath={localFilePath}
                        setLocalFilePath={setLocalFilePath}
                        metadata={metadata}
                        startDate={startDate}
                        setStartDate={setStartDate}
                        endDate={endDate}
                        setEndDate={setEndDate}
                        handleSearch={handleSearch}
                        isSearching={isSearching}
                        searchResults={searchResults}
                        selectedScene={selectedScene}
                        setSelectedScene={setSelectedScene}
                        pipelines={pipelines}
                        pipeline={pipeline}
                        setPipeline={setPipeline}
                        startJob={startJob}
                        getInputFile={getInputFile}
                        runningJobs={runningJobs}
                        gatewayOnline={gatewayOnline}
                        elapsed={elapsed}
                        jobs={jobs}
                        setActiveJobId={setActiveJobId}
                        setTerminalOpen={setTerminalOpen}
                        setViewingResult={setViewingResult}
                    />
                )}

                {/* ── PROFILE 3: MARITIME INTEL ── */}
                {profile === 'maritime' && (
                    <MaritimePanel
                        startDate={startDate}
                        setStartDate={setStartDate}
                        endDate={endDate}
                        setEndDate={setEndDate}
                        handleSearch={handleSearch}
                        isSearching={isSearching}
                        searchResults={searchResults}
                        selectedScene={selectedScene}
                        setSelectedScene={setSelectedScene}
                        dataMode={dataMode}
                        handleAcquireAndProcess={handleAcquireAndProcess}
                        runningJobs={runningJobs}
                        gatewayOnline={gatewayOnline}
                        downloadProgress={downloadProgress}
                        startJob={startJob}
                        getInputFile={getInputFile}
                        elapsed={elapsed}
                        viewingResult={viewingResult}
                    />
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
                position: 'absolute', bottom: profile === 'infrastructure' ? '90px' : '16px', left: profile === 'infrastructure' ? '248px' : '16px', zIndex: 900,
                background: 'rgba(17, 17, 17, 0.85)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
                border: '1px solid rgba(255, 255, 255, 0.06)', padding: '4px 12px',
                fontFamily: MONO, fontSize: '11px', color: C.data,
                display: 'flex', alignItems: 'center', gap: '10px', borderRadius: '2px'
            }}>
                <span>LAT: {mouseCoords.lat}°</span>
                <span>LON: {mouseCoords.lon}°</span>
                {metadata && <>
                    <div style={{ width: '1px', height: '12px', background: 'rgba(255,255,255,0.1)' }} />
                    <span style={{ color: C.textMid, fontSize: '10px' }}>{metadata.band?.split(' ')[0] || 'L-BAND'}</span>
                    <span style={{ color: C.textMid, fontSize: '10px' }}>{metadata.direction || ''}</span>
                </>}
                <div style={{ width: '1px', height: '12px', background: 'rgba(255,255,255,0.1)' }} />
                <span style={{ display: 'flex', alignItems: 'center', gap: '5px', color: C.textMid, fontSize: '10px' }}>
                    <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: gatewayOnline ? C.stable : C.critical }} />
                    {gatewayOnline ? 'ONLINE' : 'OFFLINE'}
                </span>
            </div>

            {/* ═══ TERMINAL DRAWER ═══ */}
            <div style={{
                position: 'absolute', bottom: profile === 'infrastructure' ? '80px' : 0, left: profile === 'infrastructure' ? '240px' : 0, right: 0, zIndex: 1000,
                height: terminalOpen && activeJobId ? '240px' : '0px',
                transition: 'height 200ms ease', overflow: 'hidden',
                background: 'rgba(10, 10, 10, 0.9)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
                borderTop: '1px solid rgba(255, 255, 255, 0.06)',
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

            {/* ═══ MAP LEGEND OVERLAY ═══ */}
            {profile === 'infrastructure' && viewingResult && (activeLayer === 'deformation' || activeLayer === 'coherence') && (
                <div style={{
                    position: 'absolute',
                    bottom: '96px',
                    left: '256px',
                    zIndex: 900,
                    background: 'rgba(17, 17, 17, 0.92)',
                    border: '1px solid #2A2A2A',
                    padding: '12px',
                    width: '120px',
                    boxSizing: 'border-box',
                    borderRadius: '2px',
                }}>
                    {activeLayer === 'deformation' ? (
                        <>
                            <div style={{ fontFamily: MONO, fontSize: '9px', color: '#555555', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '8px' }}>
                                InSAR DISPLACEMENT
                            </div>
                            <div style={{ fontFamily: MONO, fontSize: '9px', color: '#888888', marginBottom: '8px' }}>
                                LOS mm
                            </div>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'stretch' }}>
                                <div style={{
                                    height: '120px',
                                    width: '16px',
                                    borderRadius: '1px',
                                    background: 'linear-gradient(to bottom, #C0392B, #D4822A, #E6A817, #F0F0F0, #4A8FA8, #2E6B8A, #1A3A5C)'
                                }} />
                                <div style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'space-between',
                                    height: '120px',
                                }}>
                                    <span style={{ fontFamily: MONO, fontSize: '9px', color: '#C0392B', lineHeight: '9px' }}>+20</span>
                                    <span style={{ fontFamily: MONO, fontSize: '9px', color: '#D4822A', lineHeight: '9px' }}>+10</span>
                                    <span style={{ fontFamily: MONO, fontSize: '9px', color: '#888888', lineHeight: '9px' }}>0</span>
                                    <span style={{ fontFamily: MONO, fontSize: '9px', color: '#2E6B8A', lineHeight: '9px' }}>-10</span>
                                    <span style={{ fontFamily: MONO, fontSize: '9px', color: '#1A3A5C', lineHeight: '9px' }}>-20</span>
                                </div>
                            </div>
                            <div style={{ height: '1px', background: '#2A2A2A', margin: '8px 0' }} />
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <div style={{ fontFamily: MONO, fontSize: '9px', color: '#C0392B', textAlign: 'left' }}>UPLIFT</div>
                                <div style={{ fontFamily: MONO, fontSize: '9px', color: '#1A3A5C', textAlign: 'left' }}>SUBSIDENCE</div>
                            </div>
                        </>
                    ) : (
                        <>
                            <div style={{ fontFamily: MONO, fontSize: '9px', color: '#555555', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '8px' }}>
                                COHERENCE
                            </div>
                            <div style={{ fontFamily: MONO, fontSize: '9px', color: '#888888', marginBottom: '8px' }}>
                                0 — 1
                            </div>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'stretch' }}>
                                <div style={{
                                    height: '120px',
                                    width: '16px',
                                    borderRadius: '1px',
                                    background: 'linear-gradient(to bottom, #F0F0F0, #888888, #1A1A1A)'
                                }} />
                                <div style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'space-between',
                                    height: '120px',
                                }}>
                                    <span style={{ fontFamily: MONO, fontSize: '9px', color: '#F0F0F0', lineHeight: '9px' }}>1.0</span>
                                    <span style={{ fontFamily: MONO, fontSize: '9px', color: '#888888', lineHeight: '9px' }}>0.5</span>
                                    <span style={{ fontFamily: MONO, fontSize: '9px', color: '#555555', lineHeight: '9px' }}>0.0</span>
                                </div>
                            </div>
                            <div style={{ height: '1px', background: '#2A2A2A', margin: '8px 0' }} />
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <div style={{ fontFamily: MONO, fontSize: '9px', color: '#F0F0F0', textAlign: 'left' }}>HIGH COHERENCE</div>
                                <div style={{ fontFamily: MONO, fontSize: '9px', color: '#555555', textAlign: 'left' }}>LOW COHERENCE</div>
                            </div>
                        </>
                    )}
                </div>
            )}

        </div>
    );
}

export default AppDashboard;
