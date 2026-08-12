import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapContainer, TileLayer, ImageOverlay, GeoJSON, CircleMarker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { api, getGatewayUrl } from '../../config/api';
import { Terminal, Play, ChevronDown, CheckCircle, AlertTriangle, Loader, Search, FolderOpen, Satellite, Eye, Download, ArrowLeft, MapPin, Calendar, Layers, X, Anchor, Crosshair, Waves, Palette, WifiOff, Clock, Info, Ship, FileText } from 'lucide-react';

import { MONO, SANS, C, PROFILES } from './constants';
import { parseNisarFilename, sevColor, dispColor, formatBytes, formatElapsed } from './helpers';
import { MapFlyTo, MapEventTracker } from './MapComponents';
import SarSciencePanel from './SarSciencePanel';
import InfrastructurePanel from './InfrastructurePanel';
import WorkspaceSidebar from './flood/WorkspaceSidebar';
import FloodInsightPanel from './flood/FloodInsightPanel';
import { parseFloodReport } from './flood/floodReportHelpers';
import AnalysisReportModal from './flood/AnalysisReportModal';
import TimeSeriesView from './flood/TimeSeriesView';
import RegionsView from './flood/RegionsView';
import ProcessingView from './flood/ProcessingView';
import DataExportsView from './flood/DataExportsView';
import SettingsView from './flood/SettingsView';


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
    const [profile, setProfile] = useState('infrastructure');

    const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
    const [reportModalOpen, setReportModalOpen] = useState(false);
    const [utcTime, setUtcTime] = useState('');
    const [downloadProgress, setDownloadProgress] = useState(null);
    const [assetType, setAssetType] = useState('DAM');
    const [assetName, setAssetName] = useState('');
    const [assetLat, setAssetLat] = useState('');
    const [assetLon, setAssetLon] = useState('');
    const [envContext, setEnvContext] = useState(null);
    const [fetchingContext, setFetchingContext] = useState(false);
    const [visibleLayers, setVisibleLayers] = useState({ deformation: true, coherence: false, amplitude: false });
    // Derive activeLayer for TileLayer: deformation takes priority
    const activeLayer = visibleLayers.deformation ? 'deformation' : visibleLayers.coherence ? 'coherence' : 'amplitude';
    const [slaveFilePath, setSlaveFilePath] = useState('');
    const [assetSearch, setAssetSearch] = useState('');
    const [assetResults, setAssetResults] = useState([]);
    const [assetSearchOpen, setAssetSearchOpen] = useState(false);
    const [assetState, setAssetState] = useState('');
    const [contextFetchedAt, setContextFetchedAt] = useState(null);

    // ── SAR Science InSAR crop state ──
    const [cropLat, setCropLat] = useState('');
    const [cropLon, setCropLon] = useState('');
    const [cropPreset, setCropPreset] = useState('5x5km');

    // ── Flood Mapping States ──
    const [gunwFilePath, setGunwFilePath] = useState('');
    const [minChangeDb, setMinChangeDb] = useState(-3.0);
    const [seedThresholdDb, setSeedThresholdDb] = useState(-5.0);
    const [growthThresholdDb, setGrowthThresholdDb] = useState(-2.5);
    const [minAreaPixels, setMinAreaPixels] = useState(8);

    // ── Flood Workspace Multi-view States ──
    const [activeView, setActiveView] = useState('map');
    const [selectedRegion, setSelectedRegion] = useState(null);

    // Reset active view and selected region when changing profile
    useEffect(() => {
        if (profile === 'flood') {
            setActiveView('map');
            setSelectedRegion(null);
        }
    }, [profile]);

    // Center map to bounds of newly active results
    useEffect(() => {
        if (viewingResult && viewingResult.bounds) {
            const [[south, west], [north, east]] = viewingResult.bounds;
            setFlyToCenter([(south + north) / 2, (west + east) / 2]);
        }
    }, [viewingResult]);

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
        } catch (err) { console.error('Catalog search failed:', err); showError('Catalog search failed - is the gateway running?'); setSearchResults([]); }
        finally { setIsSearching(false); }
    };

    const loadFloodArtifacts = (id, reportPath) => {
        const reportUrl = api(`/${reportPath}`);
        const geoJsonPath = reportPath.replace(/\.json$/, '.geo.json');

        Promise.all([
            fetch(reportUrl).then(response => {
                if (!response.ok) throw new Error(`Flood report request failed: ${response.status}`);
                return response.json();
            }),
            fetch(api(`/${geoJsonPath}`)).then(response => response.ok ? response.json() : null),
        ]).then(([floodReport, floodGeoJson]) => {
            setJobs(previous => ({
                ...previous,
                [id]: { ...previous[id], floodReport, floodGeoJson, floodReportPath: reportPath, floodGeoJsonPath: geoJsonPath },
            }));
            setViewingResult(previous => previous?.pipeline === 'flood'
                ? { ...previous, floodReport, floodGeoJson, floodReportPath: reportPath, floodGeoJsonPath: geoJsonPath }
                : previous);
        }).catch(error => console.error('Unable to load flood artifacts:', error));
    };

    // ── Start Job (PRESERVED) ──
    const startJob = async () => {
        const inputFile = getInputFile();
        if (!inputFile) return;
        if (!gatewayOnline) { showError('Gateway is offline. Start it with: LOCAL_MODE=true RUST_LOG=info cargo run --release'); return; }
        const activePipeline = profile === 'infrastructure' ? 'insar' : profile === 'flood' ? 'flood' : pipeline;

        try {
            const body = {
                input_file: inputFile,
                synthetic: false,
                pipeline: activePipeline
            };
            if (profile === 'infrastructure') {
                body.slave_file = slaveFilePath || null;
                body.crop_lat = parseFloat(assetLat) || null;
                body.crop_lon = parseFloat(assetLon) || null;
                body.crop_radius_km = 10.0;
            }
            // Flood profile → use sar_science_processor with 'science' processor mode
            if (profile === 'flood') {
                body.processor = 'science';
                if (cropLat && cropLon) {
                    body.crop_lat = parseFloat(cropLat) || null;
                    body.crop_lon = parseFloat(cropLon) || null;
                    body.crop_preset = cropPreset;
                }
                body.slave_file = slaveFilePath || null;
                body.gunw_file = gunwFilePath || null;
                body.min_change_db = parseFloat(minChangeDb);
                body.seed_threshold_db = parseFloat(seedThresholdDb);
                body.growth_threshold_db = parseFloat(growthThresholdDb);
                body.min_area_pixels = parseInt(minAreaPixels);
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
                        } else if (parsed.event === 'flood_report' && parsed.path) {
                            loadFloodArtifacts(id, parsed.path);
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
        const activePipeline = profile === 'infrastructure' ? 'insar' : profile === 'flood' ? 'flood' : pipeline;
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
            if (profile === 'flood') {
                body.processor = 'science';
                if (cropLat && cropLon) {
                    body.crop_lat = parseFloat(cropLat) || null;
                    body.crop_lon = parseFloat(cropLon) || null;
                    body.crop_preset = cropPreset;
                }
                body.slave_file = slaveFilePath || null;
                body.gunw_file = gunwFilePath || null;
                body.min_change_db = parseFloat(minChangeDb);
                body.seed_threshold_db = parseFloat(seedThresholdDb);
                body.growth_threshold_db = parseFloat(growthThresholdDb);
                body.min_area_pixels = parseInt(minAreaPixels);
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
                if (line.startsWith('{')) { try { const parsed = JSON.parse(line); if (parsed.event === 'georef' && parsed.bbox) { const { north, south, east, west } = parsed.bbox; if (Math.abs(north - south) > 0.0001 && Math.abs(east - west) > 0.0001) { setJobs(prev => ({ ...prev, [id]: { ...prev[id], bounds: [[south, west], [north, east]], bbox: parsed.bbox } })); setFlyToCenter([(north + south) / 2, (east + west) / 2]); } } else if (parsed.event === 'insar_report' && parsed.path) { fetch(api(`/${parsed.path}`)).then(r => r.json()).then(report => { setJobs(prev => ({ ...prev, [id]: { ...prev[id], insarReport: report } })); }).catch(console.error); } else if (parsed.event === 'ships_detected' && parsed.path) { fetch(api(`/${parsed.path}`)).then(r => r.json()).then(ships => { setJobs(prev => ({ ...prev, [id]: { ...prev[id], ships } })); }).catch(console.error); } else if (parsed.event === 'flood_report' && parsed.path) { loadFloodArtifacts(id, parsed.path); } } catch { } }
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
                        if (currentJobs[id].pipeline === 'flood' && data.flood_report_path) {
                            const reportUrl = api(`/${data.flood_report_path}`);
                            const geoJsonUrl = api(`/${data.flood_geojson_path}`);
                            Promise.all([
                                fetch(reportUrl).then(r => r.json()),
                                fetch(geoJsonUrl).then(r => r.ok ? r.json() : null)
                            ]).then(([floodReport, floodGeoJson]) => {
                                setJobs(prev => ({
                                    ...prev,
                                    [id]: {
                                        ...prev[id],
                                        status: 'completed',
                                        output_path: data.output_path,
                                        floodReport,
                                        floodGeoJson,
                                        floodReportPath: data.flood_report_path,
                                        floodGeoJsonPath: data.flood_geojson_path
                                    }
                                }));
                                setTimeout(() => {
                                    setViewingResult({
                                        url: api(data.output_path),
                                        bounds: jobBounds,
                                        floodReport,
                                        floodGeoJson,
                                        floodReportPath: data.flood_report_path,
                                        floodGeoJsonPath: data.flood_geojson_path,
                                        pipeline: 'flood',
                                        elapsed: elapsedRef.current[id] || null,
                                        bbox: data.bbox || null
                                    });
                                }, 800);
                            }).catch(console.error);
                        } else {
                            setTimeout(() => {
                                setViewingResult({
                                    url: api(data.output_path),
                                    bounds: jobBounds,
                                    insarReport: jobsRef.current[id]?.insarReport || null,
                                    ships: jobsRef.current[id]?.ships || null,
                                    pipeline: currentJobs[id].pipeline || 'standard_rda',
                                    elapsed: elapsedRef.current[id] || null,
                                    bbox: jobsRef.current[id]?.bbox || data.bbox || null
                                });
                            }, 800);
                        }
                        setVisibleLayers({ deformation: true, coherence: false, amplitude: false });
                    }
                    setJobs(prev => ({
                        ...prev,
                        [id]: {
                            ...prev[id],
                            status: data.status,
                            output_path: data.output_path,
                            floodReportPath: data.flood_report_path || prev[id]?.floodReportPath,
                            floodGeoJsonPath: data.flood_geojson_path || prev[id]?.floodGeoJsonPath
                        }
                    }));
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
            const url = api(`/context?lat=${assetLat}&lon=${assetLon}&asset_type=${assetType}`);
            console.log("Fetching environmental context from:", url);
            const res = await fetch(url);
            if (!res.ok) {
                throw new Error(`HTTP error! status: ${res.status}`);
            }
            const data = await res.json();
            console.log("Fetched environmental context successfully:", data);
            setEnvContext(data);
            setContextFetchedAt(new Date());
        } catch (err) {
            console.error("Failed to fetch environmental context:", err);
            showError(`Failed to fetch environmental context: ${err.message}`);
            setEnvContext(null);
        }
        finally {
            setFetchingContext(false);
        }
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
        { id: 'flood', label: 'Flood & Inundation', desc: 'Multi-temporal log-ratio + region growing' },
    ];
    const pipelines = profile === 'flood'
        ? allPipelines.filter(p => p.id === 'flood')
        : allPipelines;

    const runningJobs = Object.values(jobs).filter(j => j.status === 'running');
    const activeJob = activeJobId ? jobs[activeJobId] : null;
    const activeProfile = PROFILES[profile] || PROFILES['infrastructure'];
    const activePipeline = profile === 'infrastructure' ? 'insar' : profile === 'flood' ? 'flood' : pipeline;

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
        } else if (profile === 'flood') {
            setPipeline('flood');
        } else if (profile === 'sar_science') {
            setPipeline('standard_rda');
        } else if (profile === 'insar') {
            setPipeline('insar');
        }
        setVisibleLayers({ deformation: true, coherence: false, amplitude: false });
    }, [profile]);

    // Auto-center map when a completed result is loaded
    useEffect(() => {
        if (viewingResult && viewingResult.bbox) {
            setFlyToCenter([
                (viewingResult.bbox.south + viewingResult.bbox.north) / 2,
                (viewingResult.bbox.west + viewingResult.bbox.east) / 2
            ]);
        } else if (viewingResult && viewingResult.bounds) {
            const [[south, west], [north, east]] = viewingResult.bounds;
            setFlyToCenter([(south + north) / 2, (west + east) / 2]);
        }
    }, [viewingResult]);

    const ribbonData = (profile === 'flood' && viewingResult && viewingResult.pipeline === 'flood' && viewingResult.floodReport)
        ? parseFloodReport(viewingResult.floodReport)
        : null;

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
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                            {/* Card 1: INFRASTRUCTURE MONITORING */}
                            <motion.div
                                onClick={() => { setProfile('infrastructure'); setMissionSelected(true); }}
                                style={{
                                    width: '280px',
                                    height: '160px',
                                    background: 'rgba(255, 255, 255, 0.015)',
                                    border: '1px solid rgba(255, 255, 255, 0.05)',
                                    borderRadius: '2px',
                                    padding: '24px',
                                    cursor: 'pointer',
                                    boxSizing: 'border-box',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'space-between'
                                }}
                                whileHover={{ y: -4, borderColor: C.accent.infra, background: 'rgba(255, 255, 255, 0.025)' }}
                                whileTap={{ scale: 0.98 }}
                                transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                            >
                                <div style={{ fontFamily: MONO, fontSize: '10px', color: C.textDim, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                                    INFRASTRUCTURE MONITORING
                                </div>
                                <div>
                                    <div style={{ fontFamily: SANS, fontSize: '13px', color: C.text, fontWeight: 500 }}>
                                        InSAR deformation and structural monitoring
                                    </div>
                                    <div style={{ width: '12px', height: '2px', background: C.accent.infra, marginTop: '8px' }} />
                                </div>
                            </motion.div>

                            {/* Card 2: FLOOD MONITORING */}
                            <motion.div
                                onClick={() => { setProfile('flood'); setMissionSelected(true); }}
                                style={{
                                    width: '280px',
                                    height: '160px',
                                    background: 'rgba(255, 255, 255, 0.015)',
                                    border: '1px solid rgba(255, 255, 255, 0.05)',
                                    borderRadius: '2px',
                                    padding: '24px',
                                    cursor: 'pointer',
                                    boxSizing: 'border-box',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'space-between'
                                }}
                                whileHover={{ y: -4, borderColor: C.accent.flood, background: 'rgba(255, 255, 255, 0.025)' }}
                                whileTap={{ scale: 0.98 }}
                                transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                            >
                                <div style={{ fontFamily: MONO, fontSize: '10px', color: C.textDim, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                                    FLOOD MONITORING
                                </div>
                                <div>
                                    <div style={{ fontFamily: SANS, fontSize: '13px', color: C.text, fontWeight: 500 }}>
                                        Multi-temporal GCOV change detection
                                    </div>
                                    <div style={{ width: '12px', height: '2px', background: C.accent.flood, marginTop: '8px' }} />
                                </div>
                            </motion.div>

                            {/* Card 3: SAR SCIENCE */}
                            <motion.div
                                onClick={() => { setProfile('sar_science'); setMissionSelected(true); }}
                                style={{
                                    width: '280px',
                                    height: '160px',
                                    background: 'rgba(255, 255, 255, 0.015)',
                                    border: '1px solid rgba(255, 255, 255, 0.05)',
                                    borderRadius: '2px',
                                    padding: '24px',
                                    cursor: 'pointer',
                                    boxSizing: 'border-box',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'space-between'
                                }}
                                whileHover={{ y: -4, borderColor: C.accent.sar, background: 'rgba(255, 255, 255, 0.025)' }}
                                whileTap={{ scale: 0.98 }}
                                transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                            >
                                <div style={{ fontFamily: MONO, fontSize: '10px', color: C.textDim, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                                    SAR SCIENCE
                                </div>
                                <div>
                                    <div style={{ fontFamily: SANS, fontSize: '13px', color: C.text, fontWeight: 500 }}>
                                        RSLC / GCOV / RDA viewer (Telemetry)
                                    </div>
                                    <div style={{ width: '12px', height: '2px', background: C.accent.sar, marginTop: '8px' }} />
                                </div>
                            </motion.div>

                            {/* Card 4: INSAR PROCESSING */}
                            <motion.div
                                onClick={() => { setProfile('insar'); setMissionSelected(true); }}
                                style={{
                                    width: '280px',
                                    height: '160px',
                                    background: 'rgba(255, 255, 255, 0.015)',
                                    border: '1px solid rgba(255, 255, 255, 0.05)',
                                    borderRadius: '2px',
                                    padding: '24px',
                                    cursor: 'pointer',
                                    boxSizing: 'border-box',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'space-between'
                                }}
                                whileHover={{ y: -4, borderColor: C.accent.insar, background: 'rgba(255, 255, 255, 0.025)' }}
                                whileTap={{ scale: 0.98 }}
                                transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                            >
                                <div style={{ fontFamily: MONO, fontSize: '10px', color: C.textDim, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                                    INSAR PROCESSING
                                </div>
                                <div>
                                    <div style={{ fontFamily: SANS, fontSize: '13px', color: C.text, fontWeight: 500 }}>
                                        Advanced multi-pass interferometry
                                    </div>
                                    <div style={{ width: '12px', height: '2px', background: C.accent.insar, marginTop: '8px' }} />
                                </div>
                            </motion.div>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══ TOPBAR ═══ */}
            <div style={{
                position: 'fixed', top: 0, left: 0, right: 0, height: '42px', zIndex: 1100,
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
                        <AnimatePresence>
                            {profileDropdownOpen && (
                                <motion.div
                                    initial={{ opacity: 0, y: -8, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: -8, scale: 0.95 }}
                                    transition={{ type: 'spring', stiffness: 350, damping: 25 }}
                                    onClick={(e) => e.stopPropagation()}
                                    style={{
                                        position: 'absolute', top: '32px', left: 0, zIndex: 300,
                                        background: C.bg1, border: `1px solid ${C.bg3}`,
                                        borderRadius: '2px', minWidth: '180px',
                                        boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                                    }}
                                >
                                    {Object.values(PROFILES).map(p => (
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
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>

                {/* Center: Metadata Ribbon or Terminal Toggle */}
                {ribbonData ? (
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        fontFamily: MONO,
                        fontSize: '11px',
                        color: C.textMid,
                        letterSpacing: '0.05em'
                    }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: C.text }}>
                            <span style={{
                                width: '6px',
                                height: '6px',
                                borderRadius: '50%',
                                background: C.accent.flood,
                                display: 'inline-block',
                                boxShadow: `0 0 8px ${C.accent.flood}`
                            }} />
                            {ribbonData.location.toUpperCase()}
                        </span>
                        <span style={{ color: C.bg4 }}>|</span>
                        <span>ACTIVE: <span style={{ color: C.text }}>{ribbonData.activeDate.toUpperCase()}</span></span>
                        <span style={{ color: C.bg4 }}>|</span>
                        <span>BASELINE: <span style={{ color: C.text }}>{ribbonData.baselineDate.toUpperCase()}</span></span>
                        <span style={{ color: C.bg4 }}>|</span>
                        <span>CHANGE: <span style={{ color: C.accent.flood, fontWeight: 'bold' }}>{ribbonData.totalFloodAcres.toFixed(2)} ACRES</span></span>
                        <span style={{ color: C.bg4 }}>|</span>
                        <span>GRID: <span style={{ color: C.text }}>{ribbonData.gridLabel}</span></span>
                        <span style={{ color: C.bg4 }}>|</span>
                        <span>EPSG: <span style={{ color: C.text }}>{ribbonData.epsg.includes('EPSG:') ? ribbonData.epsg.split('EPSG:')[1] : '32644'}</span></span>
                    </div>
                ) : (
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
                )}

                {/* Right: Status + Clock + Home */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {ribbonData && (
                        <>
                            <button
                                onClick={() => setReportModalOpen(true)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    background: 'rgba(42, 139, 145, 0.1)',
                                    border: '1px solid rgba(42, 139, 145, 0.3)',
                                    color: C.accent.flood,
                                    fontFamily: MONO,
                                    fontSize: '10px',
                                    fontWeight: 'bold',
                                    padding: '4px 8px',
                                    borderRadius: '2px',
                                    cursor: 'pointer',
                                    outline: 'none',
                                    transition: 'all 0.2s',
                                }}
                                onMouseEnter={e => e.target.style.background = 'rgba(42, 139, 145, 0.2)'}
                                onMouseLeave={e => e.target.style.background = 'rgba(42, 139, 145, 0.1)'}
                            >
                                <FileText size={12} />
                                <span>VIEW ANALYSIS REPORT</span>
                            </button>
                            <div style={{ width: '1px', height: '16px', background: C.bg3 }} />
                        </>
                    )}
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
                style={{
                    display: (profile === 'flood' && activeView !== 'map') ? 'none' : 'block',
                    position: 'absolute',
                    top: '42px',
                    left: profile === 'infrastructure' ? '240px' : profile === 'flood' ? '180px' : '0px',
                    right: profile === 'infrastructure' ? '0px' : (profile === 'flood' && activeView === 'map') ? '340px' : '0px',
                    bottom: profile === 'infrastructure' ? '80px' : (viewingResult && viewingResult.pipeline === 'flood' && viewingResult.floodReport) ? '32px' : '0px',
                    cursor: 'crosshair',
                    zIndex: 0
                }}
                zoomControl={false}
                attributionControl={false}
            >
                <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}" />
                {viewingResult && viewingResult.url && viewingResult.bounds && (
                    <ImageOverlay
                        url={viewingResult.url}
                        bounds={viewingResult.bounds}
                        opacity={0.8}
                    />
                )}
                <MapEventTracker setCoords={setMouseCoords} setMapBounds={setMapBounds} />
                {flyToCenter && <MapFlyTo center={flyToCenter} />}

                {selectedScene && selectedScene.footprint && (
                    <GeoJSON
                        key={selectedScene.id}
                        data={selectedScene.footprint}
                        style={{ color: '#0ea5e9', weight: 1.5, fillOpacity: 0.08, dashArray: '6' }}
                    />
                )}

                {/* Continuous 2D Raster Overlay (InSAR Deformation & Coherence Images) */}
                {/* InSAR Persistent Scatterer Overlays (Micro Tactical Spectrum Points) */}
                {viewingResult && viewingResult.insarReport && viewingResult.insarReport.scatterers && (() => {
                    const scatterers = viewingResult.insarReport.scatterers;
                    // Filter for high coherence points to eliminate noisy background points
                    const filteredPoints = scatterers.filter(p => (p.coherence ?? 1.0) >= 0.65);
                    const pointsToRender = filteredPoints.length > 0 ? filteredPoints : scatterers;

                    return pointsToRender.map((point, idx) => {
                        const sev = (point.severity || '').toUpperCase();
                        const disp = point.displacement_mm ?? 0;
                        const absDisp = Math.abs(disp);

                        // Exact Displacement Spectrum Color
                        let pColor = '#22c55e'; // Stable Emerald
                        if (sev === 'CRITICAL' || absDisp >= 15) pColor = '#ef4444'; // Red Subsidence/Outlier
                        else if (sev === 'ALERT' || (disp <= -6 || disp >= 10)) pColor = '#f59e0b'; // Amber Alert
                        else if (sev === 'CAUTION' || (disp <= -2 || disp >= 4)) pColor = '#e6a817'; // Gold Caution
                        else if (disp > 2) pColor = '#3b82f6'; // Blue Uplift

                        const radius = (sev === 'CRITICAL' || absDisp >= 15) ? 2.5 : (sev === 'ALERT') ? 2.0 : 1.5;

                        return (
                            <CircleMarker
                                key={`ps-${idx}`}
                                center={[point.lat, point.lon]}
                                radius={radius}
                                pathOptions={{
                                    color: pColor,
                                    fillColor: pColor,
                                    fillOpacity: 0.85,
                                    weight: 0.5,
                                }}
                            >
                                <Popup>
                                    <div style={{ fontSize: '0.7rem', fontFamily: MONO, color: '#e2e8f0' }}>
                                        <strong style={{ color: '#c8a96e' }}>PS Point #{idx + 1}</strong><br />
                                        Severity: <span style={{ color: pColor, fontWeight: 600 }}>{sev || 'STABLE'}</span><br />
                                        Displacement: <strong>{disp.toFixed(2)} mm</strong><br />
                                        Coherence: {(point.coherence ?? 0).toFixed(2)}
                                    </div>
                                </Popup>
                            </CircleMarker>
                        );
                    });
                })()}

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

                {profile === 'flood' && viewingResult?.pipeline === 'flood' && viewingResult.floodGeoJson && (
                    <GeoJSON
                        key={viewingResult.floodGeoJsonPath || viewingResult.url}
                        data={viewingResult.floodGeoJson}
                        style={feature => {
                            const classCode = feature?.properties?.class_code;
                            const isSelected = selectedRegion?.id === feature?.id;
                            const color = classCode === 1 ? '#2563eb' : classCode === 2 ? '#ff2800' : classCode === 3 ? '#ffa000' : '#ffe600';
                            return { fillOpacity: isSelected ? 0.75 : 0.42, fillColor: color, color, weight: isSelected ? 2 : 0.5 };
                        }}
                        onEachFeature={(feature, layer) => {
                            layer.on('click', () => setSelectedRegion(feature));
                            const confidence = feature.properties?.confidence || 'unknown';
                            layer.bindPopup(`<strong>Flood classification</strong><br/>Confidence: ${confidence}`);
                        }}
                    />
                )}
            </MapContainer>

            {/* ── MAP LEGEND ── */}
            {profile === 'infrastructure' && viewingResult && (
                <div style={{
                    position: 'absolute',
                    bottom: '94px',
                    left: '252px',
                    zIndex: 1000,
                    background: 'rgba(10, 10, 10, 0.92)',
                    border: '1px solid #2A2A2A',
                    padding: '10px 12px 8px',
                    pointerEvents: 'none',
                }}>
                    <div style={{ fontFamily: MONO, fontSize: '8px', color: '#888888', letterSpacing: '0.12em', marginBottom: '6px' }}>
                        {activeLayer === 'coherence' ? 'COHERENCE' : 'LOS DISPLACEMENT'}
                    </div>

                    {activeLayer === 'coherence' ? (
                        <>
                            <div style={{ width: '140px', height: '8px', background: 'linear-gradient(to right, #000000, #444444, #888888, #CCCCCC, #FFFFFF)', borderRadius: '1px' }} />
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                                <span style={{ fontFamily: MONO, fontSize: '8px', color: '#666666' }}>0.0</span>
                                <span style={{ fontFamily: MONO, fontSize: '8px', color: '#666666' }}>0.5</span>
                                <span style={{ fontFamily: MONO, fontSize: '8px', color: '#666666' }}>1.0</span>
                            </div>
                        </>
                    ) : (
                        <>
                            <div style={{ width: '140px', height: '8px', background: 'linear-gradient(to right, #D7191C, #FDAE61, #FFFFBF, #A6D96A, #1A9641)', borderRadius: '1px' }} />
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                                <span style={{ fontFamily: MONO, fontSize: '8px', color: '#666666' }}>-30</span>
                                <span style={{ fontFamily: MONO, fontSize: '8px', color: '#666666' }}>0</span>
                                <span style={{ fontFamily: MONO, fontSize: '8px', color: '#666666' }}>+30</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}>
                                <span style={{ fontFamily: MONO, fontSize: '7px', color: '#555555' }}>Subsidence</span>
                                <span style={{ fontFamily: MONO, fontSize: '7px', color: '#555555' }}>Uplift</span>
                            </div>
                        </>
                    )}

                    <div style={{ fontFamily: MONO, fontSize: '7px', color: '#3A3A3A', marginTop: '6px' }}>mm</div>
                </div>
            )}

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
                    visibleLayers={visibleLayers}
                    setVisibleLayers={setVisibleLayers}
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
                display: (profile === 'infrastructure' || (profile === 'flood' && activeView !== 'map')) ? 'none' : 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
            }}>

                {/* ── PROFILE: FLOOD MONITORING ── */}
                {profile === 'flood' && (
                    viewingResult && viewingResult.pipeline === 'flood' ? (
                        viewingResult.floodReport ? (
                            <FloodInsightPanel
                                floodReport={viewingResult.floodReport}
                                elapsed={viewingResult.elapsed}
                                onClose={() => setViewingResult(null)}
                                onExportGeoJson={() => {
                                    if (!viewingResult || !viewingResult.floodGeoJsonPath) return;
                                    const link = document.createElement('a');
                                    link.href = api(`/${viewingResult.floodGeoJsonPath}`);
                                    link.download = viewingResult.floodGeoJsonPath.split('/').pop() || 'flood_map.geo.json';
                                    link.click();
                                }}
                                onViewReport={() => setReportModalOpen(true)}
                            />
                        ) : (
                            <div style={{ flex: 1, padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', background: 'rgba(10, 13, 16, 0.95)', fontFamily: MONO, fontSize: '11px', color: C.textMid, boxSizing: 'border-box' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1c2430', paddingBottom: '12px' }}>
                                    <span style={{ color: C.accent.flood, fontWeight: 'bold' }}>FLOOD MONITORING</span>
                                    <button onClick={() => setViewingResult(null)} style={{ background: 'none', border: 'none', color: C.textDim, cursor: 'pointer', fontFamily: MONO, fontSize: '12px' }}>✕</button>
                                </div>
                                <div style={{ marginTop: '80px', textAlign: 'center', color: C.critical, fontWeight: 'bold', fontSize: '12px', letterSpacing: '0.05em' }}>
                                    RESULT DATA UNAVAILABLE
                                </div>
                                <div style={{ textAlign: 'center', color: C.textDim, fontSize: '10px', lineHeight: 1.5, marginTop: '8px' }}>
                                    The processor report JSON or classification product could not be loaded. Please ensure the pipeline completed successfully.
                                </div>
                            </div>
                        )
                    ) : (
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
                            cropLat={cropLat}
                            setCropLat={setCropLat}
                            cropLon={cropLon}
                            setCropLon={setCropLon}
                            cropPreset={cropPreset}
                            setCropPreset={setCropPreset}
                            slaveFilePath={slaveFilePath}
                            setSlaveFilePath={setSlaveFilePath}
                            gunwFilePath={gunwFilePath}
                            setGunwFilePath={setGunwFilePath}
                            minChangeDb={minChangeDb}
                            setMinChangeDb={setMinChangeDb}
                            seedThresholdDb={seedThresholdDb}
                            setSeedThresholdDb={setSeedThresholdDb}
                            growthThresholdDb={growthThresholdDb}
                            setGrowthThresholdDb={setGrowthThresholdDb}
                            minAreaPixels={minAreaPixels}
                            setMinAreaPixels={setMinAreaPixels}
                        />
                    )
                )}

                {/* ── PROFILE: SAR SCIENCE / INSAR PROCESSING PLACEHOLDERS ── */}
                {(profile === 'sar_science' || profile === 'insar') && (
                    <div style={{ flex: 1, padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '12px', textAlign: 'center' }}>
                        <Satellite size={32} color={activeProfile.accent} style={{ opacity: 0.6 }} />
                        <div style={{ fontFamily: MONO, fontSize: '12px', fontWeight: 600, color: C.text }}>
                            {activeProfile.label}
                        </div>
                        <div style={{ fontFamily: SANS, fontSize: '11px', color: C.textDim, lineHeight: 1.5 }}>
                            {profile === 'sar_science'
                                ? 'Telemetry analysis viewer modules are currently being calibrated for standard NISAR GCOV, RSLC, and RDA products.'
                                : 'Interferometric coregistration and baseline processing tools are currently under review.'}
                        </div>
                        <div style={{ fontFamily: MONO, fontSize: '9px', color: activeProfile.accent, background: 'rgba(255,255,255,0.03)', padding: '4px 8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                            COMING SOON · v0.5.0
                        </div>
                    </div>
                )}
            </div>
        // Continued in part 5...
            {/* ═══ BOTTOM PROCESSING SUMMARY STRIP ═══ */}
            {viewingResult && viewingResult.pipeline === 'flood' && viewingResult.floodReport && (
                <div style={{
                    position: 'absolute',
                    bottom: terminalOpen && activeJobId ? '240px' : '0px',
                    left: 0,
                    right: 0,
                    height: '32px',
                    background: 'rgba(15, 10, 10, 0.9)',
                    borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0 16px',
                    fontFamily: MONO,
                    fontSize: '10px',
                    color: C.textMid,
                    zIndex: 900,
                    transition: 'bottom 200ms ease'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ color: C.accent.flood, fontWeight: 'bold' }}>PIPELINE: FLOOD DETECTION</span>
                        <span style={{ color: C.bg4 }}>|</span>
                        <span>ALGORITHM: LOG-RATIO + OTSU ({viewingResult.floodReport.method?.threshold_db || '-3.0'} dB) + REGION GROWING</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>POLYGONS: {viewingResult.floodReport.flood_regions || 0}</span>
                        {viewingResult.elapsed && (
                            <>
                                <span style={{ color: C.bg4 }}>|</span>
                                <span>ELAPSED: {formatElapsed(viewingResult.elapsed)}</span>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* ═══ GATEWAY OFFLINE BANNER ═══ */}
            {!gatewayOnline && (
                <div style={{
                    position: 'absolute', top: '16px', left: '50%', transform: 'translateX(-50%)', zIndex: 1100,
                    background: '#C0392B', padding: '8px 16px', borderRadius: '2px', border: '1px solid #C0392B',
                    display: 'flex', alignItems: 'center', gap: '8px',
                    fontFamily: MONO, fontSize: '11px', color: '#F0F0F0',
                }}>
                    <WifiOff size={12} /> GATEWAY OFFLINE - RUN: LOCAL_MODE=true cargo run --release
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
                position: 'absolute',
                bottom: profile === 'infrastructure' ? '90px' : (viewingResult && viewingResult.pipeline === 'flood' && viewingResult.floodReport) ? '48px' : '16px',
                left: profile === 'infrastructure' ? '248px' : profile === 'flood' ? '196px' : '16px',
                zIndex: 900,
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
                            let displayLine = line;
                            let isErr = line.includes('ERROR') || line.includes('FAILED') || line.includes('Failed');
                            let isSucc = line.includes('COMPLETED') || line.includes('✓') || line.includes('COMPLETE');
                            let isSys = line.includes('[SYSTEM]');
                            let isCfar = line.includes('CFAR') || line.includes('ship') || line.includes('vessel');
                            let isInSar = line.includes('InSAR') || line.includes('phase');
                            
                            if (line.startsWith('{')) {
                                try {
                                    const parsed = JSON.parse(line);
                                    if (parsed.event === 'progress') {
                                        displayLine = `[${parsed.stage}] ${parsed.message}`;
                                        if (parsed.stage === 'COMPLETE') isSucc = true;
                                        else if (parsed.stage === 'FAILED') isErr = true;
                                        else isSys = true;
                                    } else if (parsed.event === 'georef') {
                                        displayLine = `[SYSTEM] Georeferencing bounding box: ${JSON.stringify(parsed.bbox)}`;
                                        isSys = true;
                                    } else if (parsed.event === 'flood_report') {
                                        displayLine = `[SYSTEM] Flood report written successfully.`;
                                        isSys = true;
                                    } else if (parsed.event === 'output') {
                                        displayLine = `[SYSTEM] Classification raster generated: ${parsed.path}`;
                                        isSys = true;
                                    }
                                } catch (e) {}
                            }
                            
                            const color = isErr ? '#C0392B' : isSucc ? '#4CAF50' : isSys ? '#7EB8D4' : isCfar ? '#E6A817' : isInSar ? '#9B8EC4' : '#555555';
                            return (
                                <div key={idx} style={{ color, wordBreak: 'break-all', paddingLeft: '14px', textIndent: '-14px' }}>
                                    <span style={{ color: '#2A2A2A', marginRight: '6px' }}>›</span>
                                    {displayLine}
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
                        position: 'absolute',
                        bottom: (viewingResult && viewingResult.pipeline === 'flood' && viewingResult.floodReport) ? '48px' : '16px',
                        right: '16px',
                        zIndex: 900,
                        background: '#111111', border: '1px solid #2A2A2A', borderRadius: '2px',
                        padding: '6px 12px', color: '#888888', fontFamily: MONO, fontSize: '11px',
                        cursor: 'pointer'
                    }}
                    onMouseEnter={e => { e.target.style.borderColor = '#404040'; e.target.style.color = '#F0F0F0'; }}
                    onMouseLeave={e => { e.target.style.borderColor = '#2A2A2A'; e.target.style.color = '#888888'; }}
                >
                </button>
            )}

            {/* ═══ ANALYSIS REPORT MODAL ═══ */}
            {reportModalOpen && viewingResult && viewingResult.floodReport && (
                <AnalysisReportModal
                    floodReport={viewingResult.floodReport}
                    onClose={() => setReportModalOpen(false)}
                />
            )}

            {/* ═══ WORKSPACE SIDEBAR NAVIGATION (profile === 'flood') ═══ */}
            {profile === 'flood' && (
                <div style={{ position: 'absolute', left: 0, top: '42px', bottom: 0, width: '180px', zIndex: 1000, display: 'flex', flexDirection: 'column' }}>
                    <WorkspaceSidebar
                        activeView={activeView}
                        onSelectView={setActiveView}
                        onOpenReport={() => {
                            if (viewingResult?.pipeline === 'flood' && viewingResult.floodReport) {
                                setReportModalOpen(true);
                            } else {
                                showError('Run or select a completed flood analysis to open its report.');
                            }
                        }}
                        gatewayOnline={gatewayOnline}
                    />
                </div>
            )}

            {/* ═══ WORKSPACE TAB PANELS (profile === 'flood' and not 'map') ═══ */}
            {profile === 'flood' && activeView !== 'map' && (
                <div style={{
                    position: 'absolute',
                    left: '180px',
                    top: '42px',
                    right: 0,
                    bottom: 0,
                    background: '#0a0d10',
                    zIndex: 10,
                    display: 'flex',
                    flexDirection: 'column'
                }}>
                    {activeView === 'timeseries' && <TimeSeriesView floodReport={viewingResult?.floodReport} />}
                    {activeView === 'regions' && (
                        <RegionsView
                            floodGeoJson={viewingResult?.floodGeoJson}
                            floodGeoJsonPath={viewingResult?.floodGeoJsonPath ? api(`/${viewingResult.floodGeoJsonPath}`) : null}
                            onSelectRegionOnMap={(region) => {
                                setSelectedRegion(region);
                                if (!viewingResult?.floodReport) return;
                                const extractCentroid = (geometry) => {
                                    if (!geometry) return null;
                                    if (geometry.type === 'Polygon') {
                                        const ring = geometry.coordinates?.[0];
                                        if (!ring || !ring.length) return null;
                                        let sumLat = 0, sumLon = 0;
                                        for (const [lon, lat] of ring) {
                                            sumLat += lat;
                                            sumLon += lon;
                                        }
                                        return [sumLat / ring.length, sumLon / ring.length];
                                    }
                                    if (geometry.type === 'MultiPolygon') {
                                        let sumLat = 0, sumLon = 0, count = 0;
                                        for (const poly of geometry.coordinates || []) {
                                            const ring = poly?.[0];
                                            if (ring && ring.length) {
                                                for (const [lon, lat] of ring) {
                                                    sumLat += lat;
                                                    sumLon += lon;
                                                    count++;
                                                }
                                            }
                                        }
                                        if (count > 0) return [sumLat / count, sumLon / count];
                                    }
                                    if (geometry.type === 'Point') {
                                        const [lon, lat] = geometry.coordinates || [];
                                        if (lat != null && lon != null) return [lat, lon];
                                    }
                                    return null;
                                };
                                const center = extractCentroid(region.geometry);
                                if (center) {
                                    setFlyToCenter(center);
                                }
                                setActiveView('map');
                            }}
                        />
                    )}
                    {activeView === 'processing' && <ProcessingView floodReport={viewingResult?.floodReport} />}
                    {activeView === 'data' && <DataExportsView viewingResult={viewingResult} />}
                    {activeView === 'settings' && <SettingsView />}
                </div>
            )}

            {/* ═══ FLOOD COMPARISON STRIP ═══ */}
            {profile === 'flood' && activeView === 'map' && viewingResult?.floodReport && (
                <div style={{
                    position: 'absolute',
                    bottom: '24px',
                    left: '196px',
                    right: '356px',
                    height: '42px',
                    zIndex: 900,
                    background: 'rgba(10, 15, 20, 0.95)',
                    backdropFilter: 'blur(8px)',
                    border: '1px solid #1c2532',
                    borderRadius: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 16px',
                    boxSizing: 'border-box',
                    justifyContent: 'space-between',
                    userSelect: 'none'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button style={{
                            background: 'rgba(42, 139, 145, 0.15)',
                            border: '1px solid rgba(42, 139, 145, 0.3)',
                            color: C.accent.flood,
                            fontFamily: MONO,
                            fontSize: '9px',
                            padding: '4px 8px',
                            borderRadius: '2px',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            outline: 'none'
                        }}>
                            ACTIVE / BASELINE
                        </button>
                        <span style={{ fontFamily: MONO, fontSize: '9px', color: '#475569', letterSpacing: '0.05em' }}>
                            | REAL JOB COMPARISON
                        </span>
                    </div>

                    <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                        {[
                            { date: parseFloodReport(viewingResult.floodReport)?.baselineDate || 'BASELINE', active: false },
                            { date: parseFloodReport(viewingResult.floodReport)?.activeDate || 'ACTIVE', active: true },
                        ].map((pt, idx) => (
                            <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' }}>
                                <div style={{
                                    width: '6px',
                                    height: '6px',
                                    borderRadius: '50%',
                                    background: pt.active ? C.accent.flood : '#334155',
                                    border: pt.active ? `1px solid ${C.text}` : '1px solid transparent',
                                    boxShadow: pt.active ? `0 0 8px ${C.accent.flood}` : 'none',
                                    marginBottom: '4px'
                                }} />
                                <span style={{ fontFamily: MONO, fontSize: '8px', color: pt.active ? C.text : '#475569', fontWeight: pt.active ? 'bold' : 'normal' }}>
                                    {pt.date}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

export default AppDashboard;
