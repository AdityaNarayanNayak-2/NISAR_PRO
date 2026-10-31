import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapContainer, TileLayer, ImageOverlay, GeoJSON, CircleMarker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { api } from '../../config/api';
import { Terminal, Play, ChevronDown, CheckCircle, AlertTriangle, Loader, Search, FolderOpen, Eye, Download, ArrowLeft, MapPin, Calendar, Layers, X, Anchor, Crosshair, Waves, Palette, WifiOff, Clock, Info, Ship, FileText } from 'lucide-react';

import { MONO, SANS, C, PROFILES, TM, INFRA_LAYOUT } from './constants';
import { parseNisarFilename, normalizeJobStatus, jobErrorMessage } from './helpers';
import { parseFloodReport } from './flood/floodReportHelpers';
import { MapFlyTo, MapFlyToBounds, MapEventTracker, MapResizer, MapAoiDrawer, MapZoomGate } from './MapComponents';
import L from 'leaflet';
import InfrastructurePanel from './InfrastructurePanel';
import WorkspaceSidebar from './flood/WorkspaceSidebar';
import FloodInsightPanel from './flood/FloodInsightPanel';
import FloodConfigPanel from './flood/FloodConfigPanel';
import AnalysisReportModal from './flood/AnalysisReportModal';
import TimeSeriesView from './flood/TimeSeriesView';
import RegionsView from './flood/RegionsView';
import ProcessingView from './flood/ProcessingView';
import DataExportsView from './flood/DataExportsView';
import SettingsView from './flood/SettingsView';
import FloodEventReplay from './flood/FloodEventReplay';

import { useGatewayStore } from './stores/useGatewayStore';
import { useMapStore } from './stores/useMapStore';
import { useJobStore } from './stores/useJobStore';
import TopBar from './layout/TopBar';
import BottomStrip from './layout/BottomStrip';
import CoordinatesHud from './layout/CoordinatesHud';
import TerminalDrawer from './layout/TerminalDrawer';
import ProcessingProgressBar from './layout/ProcessingProgressBar';
import MapLayerControls from './layout/MapLayerControls';
import RunHistorySidebar from './layout/RunHistorySidebar';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';

// Only mount the per-pixel flood vector layer once the user zooms this far in.
// Below this the raster *_flood.png mask already shows the full classification.
const FLOOD_FEATURE_ZOOM = 11;
const MAX_RASTER_GEOJSON_FEATURES = 2000;

function AppDashboard() {
    // ── Zustand Stores (State Unification) ──
    const gatewayOnline = useGatewayStore(state => state.gatewayOnline);
    const setGatewayOnline = useGatewayStore(state => state.setGatewayOnline);

    const setMouseCoords = useMapStore(state => state.setMouseCoords);
    const mapBounds = useMapStore(state => state.mapBounds);
    const setMapBounds = useMapStore(state => state.setMapBounds);
    const flyToCenter = useMapStore(state => state.flyToCenter);
    const setFlyToCenter = useMapStore(state => state.setFlyToCenter);
    const drawnAoi = useMapStore(state => state.drawnAoi);
    const setDrawnAoi = useMapStore(state => state.setDrawnAoi);
    const isDrawingAoi = useMapStore(state => state.isDrawingAoi);
    const setIsDrawingAoi = useMapStore(state => state.setIsDrawingAoi);
    const viewingResult = useMapStore(state => state.viewingResult);
    const setViewingResult = useMapStore(state => state.setViewingResult);
    const selectedRegion = useMapStore(state => state.selectedRegion);
    const setSelectedRegion = useMapStore(state => state.setSelectedRegion);

    const layerOpacity = useMapStore(state => state.layerOpacity);
    const showFloodPng = useMapStore(state => state.showFloodPng);
    const showFloodGeoJson = useMapStore(state => state.showFloodGeoJson);
    const showPermanentWater = useMapStore(state => state.showPermanentWater);
    const showHighConf = useMapStore(state => state.showHighConf);
    const showMedConf = useMapStore(state => state.showMedConf);
    const showLowConf = useMapStore(state => state.showLowConf);
    const [replayPhase, setReplayPhase] = useState('detected');

    // ── Load/zoom affordances for heavy flood vector data ──
    const [geoJsonLoading, setGeoJsonLoading] = useState(false);
    const [jobsSyncing, setJobsSyncing] = useState(false);
    const [mapZoom, setMapZoom] = useState(9);
    const geoJsonLoadKeyRef = useRef(null);          // in-flight fetch dedupe key (path)
    const geoJsonFailedRef = useRef(new Set());      // paths that failed -> don't retry on every render
    const geoJsonRef = useRef(null);

    // Memoized flood-layer style: only re-applied when a toggle/selection actually changes,
    // so opacity-slider ticks no longer rebuild or restyle ~321k features.
    const floodStyle = useMemo(() => (feature) => {
        const raw = feature?.properties?.class_code;
        const classCode = (raw === undefined || raw === null || raw === '') ? null : Number(raw);
        const isSelected = selectedRegion && (
            (selectedRegion.id && feature?.id && selectedRegion.id === feature.id) ||
            (selectedRegion.properties?.region_id && feature?.properties?.region_id && selectedRegion.properties.region_id === feature.properties.region_id) ||
            (selectedRegion.id && feature?.properties?.region_id && selectedRegion.id === feature.properties.region_id) ||
            (selectedRegion.region_id && feature?.properties?.region_id && selectedRegion.region_id === feature.properties.region_id)
        );
        if (classCode === 1 && !showPermanentWater) return { fillOpacity: 0, opacity: 0, stroke: false };
        if (classCode === 2 && !showHighConf) return { fillOpacity: 0, opacity: 0, stroke: false };
        if (classCode === 3 && !showMedConf) return { fillOpacity: 0, opacity: 0, stroke: false };
        if ((classCode === 4 || classCode == null) && !showLowConf) return { fillOpacity: 0, opacity: 0, stroke: false };
        const color = classCode === 1 ? '#2166c1' : classCode === 2 ? '#00a6c7' : classCode === 3 ? '#42c6d5' : '#91d9dc';
        return {
            fillOpacity: (isSelected ? 0.95 : 0.65) * layerOpacity,
            fillColor: isSelected ? '#00ffff' : color,
            color: isSelected ? '#ffffff' : color,
            weight: isSelected ? 3 : 0.8
        };
    }, [showPermanentWater, showHighConf, showMedConf, showLowConf, selectedRegion, layerOpacity]);

    // Keep react-leaflet's underlying layers updated when style or selection changes
    useEffect(() => {
        if (!geoJsonRef.current) return;
        try {
            geoJsonRef.current.setStyle(floodStyle);
            if (selectedRegion) {
                const targetId = selectedRegion.id || selectedRegion.properties?.region_id || selectedRegion.region_id;
                geoJsonRef.current.eachLayer((layer) => {
                    const feat = layer.feature;
                    if (!feat) return;
                    const fid = feat.id || feat.properties?.region_id;
                    if (fid && targetId && fid === targetId) {
                        layer.openPopup();
                        if (layer.bringToFront) layer.bringToFront();
                    }
                });
            }
        } catch (err) {
            console.warn('GeoJSON restyle failed:', err);
        }
    }, [floodStyle, selectedRegion]);

    const floodFeatureCount = viewingResult?.floodGeoJson?.features?.length ?? 0;
    const showFloodVectors = floodFeatureCount > 0 && (floodFeatureCount <= MAX_RASTER_GEOJSON_FEATURES || mapZoom >= FLOOD_FEATURE_ZOOM);

    // Single owner of the heavy GeoJSON download: dedupes concurrent fetches of the same path,
    // surfaces a loading flag, and records failures so effects never hot-loop on them.
    const ensureFloodGeoJson = useCallback((path) => {
        if (!path || geoJsonFailedRef.current.has(path)) return Promise.resolve(null);
        if (geoJsonLoadKeyRef.current === path) return Promise.resolve(null);
        geoJsonLoadKeyRef.current = path;
        setGeoJsonLoading(true);
        return fetch(api(path))
            .then(r => r.ok ? r.json() : null)
            .then(geoJson => {
                if (geoJson) {
                    geoJsonFailedRef.current.delete(path);
                    return geoJson;
                }
                geoJsonFailedRef.current.add(path);
                return null;
            })
            .catch(err => {
                geoJsonFailedRef.current.add(path);
                console.error('GeoJSON load failed:', err);
                return null;
            })
            .finally(() => {
                geoJsonLoadKeyRef.current = null;
                setGeoJsonLoading(false);
            });
    }, []);

    const jobs = useJobStore(state => state.jobs);
    const setJobs = useJobStore(state => state.setJobs);
    const setActiveJobId = useJobStore(state => state.setActiveJobId);
    const setLogs = useJobStore(state => state.setLogs);
    const setTerminalOpen = useJobStore(state => state.setTerminalOpen);
    const elapsed = useJobStore(state => state.elapsed);
    const setElapsed = useJobStore(state => state.setElapsed);

    // ── Panel & Form State (PRESERVED) ──
    const [dataMode, setDataMode] = useState('local');
    // Keep file inputs portable: users choose paths that exist on their own machine.
    const [localFilePath, setLocalFilePath] = useState('');
    const [selectedScene, setSelectedScene] = useState(null);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [catalogTrack, setCatalogTrack] = useState('');
    const [catalogFrame, setCatalogFrame] = useState('');
    const uploadLocalFile = async (file, setPath) => {
        if (!file || !setPath) return;
        if (!gatewayOnline) {
            showError('Gateway is offline. Start the local gateway before choosing a file.');
            return;
        }
        try {
            const form = new FormData();
            form.append('file', file, file.name);
            const response = await fetch(api('/upload'), { method: 'POST', body: form });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok || !payload.path) throw new Error(payload.error || `Upload failed (${response.status})`);
            setPath(payload.path);
        } catch (error) {
            console.error('Local file upload failed:', error);
            showError(error.message || 'Could not upload the selected file to the gateway.');
        }
    };
    const [isSearching, setIsSearching] = useState(false);
    const [searchResults, setSearchResults] = useState([]);
    const terminalRef = useRef(null);
    const userScrolledUp = useRef(false);
    const [errorToast, setErrorToast] = useState(null);

    // ── URL & LocalStorage State Rehydration ──
    const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
    const paramJobId = urlParams.get('job_id');
    const paramReport = urlParams.get('report') === 'true';
    const paramView = urlParams.get('view');
    const paramProfile = urlParams.get('profile');

    const savedProfile = typeof localStorage !== 'undefined' ? localStorage.getItem('nisarpro_active_profile') : null;
    const requestedProfile = paramProfile || savedProfile;
    const initialProfile = requestedProfile === 'flood' || paramJobId ? 'flood' : 'infrastructure';
    // A saved profile should not silently open an old analysis. Explicit URL
    // deep-links may open a result; otherwise the user chooses a demo or run.
    const initialMissionSelected = Boolean(paramJobId || paramReport);

    // ── Profile State ──
    const [missionSelected, setMissionSelected] = useState(initialMissionSelected);
    const [demoDialogOpen, setDemoDialogOpen] = useState(false);
    const [profile, setProfileState] = useState(initialProfile);
    const setProfile = useCallback((newProfile) => {
        if (newProfile !== 'flood' && newProfile !== 'infrastructure') return;
        setProfileState(newProfile);
        if (newProfile === 'infrastructure') {
            setDataMode('local');
        }
        try { localStorage.setItem('nisarpro_active_profile', newProfile); } catch (error) {
            console.warn('Unable to persist active profile:', error);
        }
    }, []);
    const [reportModalOpen, setReportModalOpen] = useState(paramReport);
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

    // ── Shared crop state for the supported profiles ──
    const [cropLat, setCropLat] = useState('18.7883');
    const [cropLon, setCropLon] = useState('82.6003');
    const [cropPreset, setCropPreset] = useState('5x5km');

    // ── Flood Mapping States ──
    const [gunwFilePath, setGunwFilePath] = useState('');
    const [minChangeDb, setMinChangeDb] = useState(-3.0);
    const [seedThresholdDb, setSeedThresholdDb] = useState(-5.0);
    const [growthThresholdDb, setGrowthThresholdDb] = useState(-2.5);
    const [minAreaPixels, setMinAreaPixels] = useState(8);
    const [radarBand, setRadarBand] = useState('l');
    const [permanentWaterThreshold, setPermanentWaterThreshold] = useState(-13.0);
    const [swathEdgeErosion, setSwathEdgeErosion] = useState(3);
    const [recededWaterThreshold, setRecededWaterThreshold] = useState(3.0);
    const [speckleFilter, setSpeckleFilter] = useState('median-3');
    const [multilookFactor, setMultilookFactor] = useState(8);
    const [polarization, setPolarization] = useState('HHHH');

    // ── Flood Workspace Multi-view States ──
    const [activeView, setActiveView] = useState(paramView || 'map');
    const [inspectorOpen, setInspectorOpen] = useState(true);

    // ── Tactical Keyboard Shortcuts Hook (t: terminal, Esc: close, n: new run, r: report, 1-5: views) ──
    useKeyboardShortcuts(profile, setActiveView, setReportModalOpen);

    // Keep URL parameters synchronized with active state for direct linking and persistence
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const currentParams = new URLSearchParams(window.location.search);
        let changed = false;

        if (viewingResult?.id) {
            if (currentParams.get('job_id') !== viewingResult.id) {
                currentParams.set('job_id', viewingResult.id);
                changed = true;
            }
        } else if (currentParams.has('job_id') && !paramJobId) {
            currentParams.delete('job_id');
            changed = true;
        }

        if (reportModalOpen) {
            if (currentParams.get('report') !== 'true') {
                currentParams.set('report', 'true');
                changed = true;
            }
        } else if (currentParams.has('report')) {
            currentParams.delete('report');
            changed = true;
        }

        if (profile !== 'infrastructure') {
            if (currentParams.get('profile') !== profile) {
                currentParams.set('profile', profile);
                changed = true;
            }
        } else if (currentParams.has('profile')) {
            currentParams.delete('profile');
            changed = true;
        }

        if (activeView !== 'map') {
            if (currentParams.get('view') !== activeView) {
                currentParams.set('view', activeView);
                changed = true;
            }
        } else if (currentParams.has('view')) {
            currentParams.delete('view');
            changed = true;
        }

        if (changed) {
            const newUrl = `${window.location.pathname}?${currentParams.toString()}`;
            window.history.replaceState(null, '', newUrl);
        }
    }, [viewingResult?.id, reportModalOpen, profile, activeView, paramJobId]);

    // Ensure GeoJSON is fetched for a persisted viewingResult if missing (deduped against the job preload)
    useEffect(() => {
        if (viewingResult && !viewingResult.floodGeoJson && viewingResult.floodGeoJsonPath) {
            ensureFloodGeoJson(viewingResult.floodGeoJsonPath).then(geoJson => {
                if (geoJson) {
                    setViewingResult(prev => prev ? { ...prev, floodGeoJson: geoJson } : prev);
                }
            });
        }
    }, [viewingResult, setViewingResult, ensureFloodGeoJson]);

// Reset active view and selected region when changing profile, and preload completed flood runs from gateway
    useEffect(() => {
        if (profile !== 'flood') return;
        setSelectedRegion(null);
        let cancelled = false;
        const syncStart = window.setTimeout(() => setJobsSyncing(true), 0);
        fetch(api('/jobs'))
            .then(r => r.ok ? r.json() : [])
            .then(async (allJobs) => {
                const jobsToProcess = (Array.isArray(allJobs) && allJobs.length > 0) ? allJobs : [];

                // Fetch all flood reports in parallel (previously serial N+1 round-trips)
                const enriched = await Promise.all(jobsToProcess.map(async (j) => {
                    if (!j.flood_report_path) return null;
                    try {
                        const floodReport = await fetch(api(j.flood_report_path)).then(r => r.ok ? r.json() : null);
                        if (!floodReport) return null;
                        const jobBounds = j.bbox ? [[j.bbox.south, j.bbox.west], [j.bbox.north, j.bbox.east]] : null;
                        const label = floodReport.crop?.preset ? `RUN: ${floodReport.crop.preset} (${j.id.slice(0, 8)})` : `RUN (${j.id.slice(0, 8)})`;
                        return {
                            id: j.id,
                            name: label,
                            status: 'completed',
                            output_path: j.output_path,
                            floodReport,
                            floodReportPath: j.flood_report_path,
                            floodGeoJsonPath: j.flood_geojson_path,
                            floodBaselinePath: j.flood_baseline_path,
                            floodActivePath: j.flood_active_path,
                            floodReplayAvailable: Boolean(j.flood_baseline_path && j.flood_active_path && floodReport.replay?.available),
                            pipeline: 'flood',
                            bbox: j.bbox,
                            bounds: jobBounds,
                        };
                    } catch (err) {
                        console.warn(`Failed to preload job ${j.id}:`, err);
                        return null;
                    }
                }));

                if (cancelled) return;
                const loadedJobs = {};
                for (const e of enriched) if (e) loadedJobs[e.id] = e;

                if (Object.keys(loadedJobs).length > 0) {
                    setJobs(prev => ({ ...prev, ...loadedJobs }));

                    // History is loaded into the sidebar, but never selected
                    // automatically. Only an explicit URL job_id may open a result.
                    const targetJob = paramJobId ? loadedJobs[paramJobId] : null;
                    if (targetJob) {
                        ensureFloodGeoJson(targetJob.floodGeoJsonPath).then(geoJson => {
                            if (cancelled) return;
                            setViewingResult({
                                ...targetJob,
                                url: api(targetJob.output_path),
                                floodGeoJson: geoJson,
                                floodBaselinePath: targetJob.floodBaselinePath,
                                floodActivePath: targetJob.floodActivePath,
                                floodReplayAvailable: targetJob.floodReplayAvailable,
                            });
                            if (targetJob.bounds) {
                                const [[south, west], [north, east]] = targetJob.bounds;
                                setFlyToCenter([(south + north) / 2, (west + east) / 2]);
                            }
                        });
                    }
                }
            })
            .catch(console.error)
            .finally(() => { if (!cancelled) setJobsSyncing(false); });
        return () => { cancelled = true; window.clearTimeout(syncStart); };
    }, [profile, paramJobId, ensureFloodGeoJson, setFlyToCenter, setJobs, setSelectedRegion, setViewingResult]);

    // Center map to bounds of newly active results
    useEffect(() => {
        if (viewingResult && viewingResult.bounds) {
            const [[south, west], [north, east]] = viewingResult.bounds;
            setFlyToCenter([(south + north) / 2, (west + east) / 2]);
        }
    }, [viewingResult, setFlyToCenter]);

    // ── Gateway Health Check (PRESERVED) ──
    useEffect(() => {
        const check = async () => {
            try { const res = await fetch(api('/jobs/health-ping'), { signal: AbortSignal.timeout(2000) }); setGatewayOnline(res.ok); }
            catch { try { const res = await fetch(api('/jobs'), { signal: AbortSignal.timeout(2000) }); setGatewayOnline(res.ok); } catch { setGatewayOnline(false); } }
        };
        check(); const interval = setInterval(check, 15000);
        return () => clearInterval(interval);
    }, [setGatewayOnline]);

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
    }, [jobs, setElapsed]);

    // ── Helpers (PRESERVED) ──
    const metadata = parseNisarFilename(localFilePath);
    // Commented out to prevent shadowing of imported functions
    // const formatBytes = (bytes) => { const b = parseInt(bytes, 10); if (isNaN(b) || b === 0) return '0 B'; const k = 1024, sizes = ['B', 'KB', 'MB', 'GB', 'TB']; const i = Math.floor(Math.log(b) / Math.log(k)); return parseFloat((b / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]; };
    // const formatElapsed = (secs) => { if (!secs) return '0s'; const m = Math.floor(secs / 60); const s = secs % 60; return m > 0 ? `${m}m ${s}s` : `${s}s`; };
    const getInputFile = () => { if (dataMode === 'catalog' && selectedScene) return selectedScene.download_url; if (dataMode === 'local' && localFilePath) return localFilePath; return null; };
    const getInputLabel = () => { if (dataMode === 'catalog' && selectedScene) return selectedScene.id; if (dataMode === 'local' && localFilePath) return localFilePath.split('/').pop(); return null; };
    const showError = useCallback((msg) => { setErrorToast(msg); setTimeout(() => setErrorToast(null), 5000); }, [setErrorToast]);

    // ── Catalog Search (PRESERVED) ──
    const handleSearch = async () => {
        const bbox = drawnAoi ? drawnAoi.bbox : (mapBounds ? `${mapBounds.getWest().toFixed(4)},${mapBounds.getSouth().toFixed(4)},${mapBounds.getEast().toFixed(4)},${mapBounds.getNorth().toFixed(4)}` : null);
        if (!bbox) {
            showError('Please wait for map viewport to initialize or draw an AOI box.');
            return;
        }
        setIsSearching(true);
        try {
            let searchUrl = `/search/nisar?bbox=${bbox}`;
            if (startDate) searchUrl += `&start_date=${startDate}T00:00:00Z`;
            if (endDate) searchUrl += `&end_date=${endDate}T23:59:59Z`;
            if (catalogTrack.trim()) searchUrl += `&relative_orbit=${encodeURIComponent(catalogTrack.trim())}`;
            if (catalogFrame.trim()) searchUrl += `&asfframe=${encodeURIComponent(catalogFrame.trim())}`;
            const res = await fetch(api(searchUrl));
            const data = await res.json();
            const scenes = Array.isArray(data) ? data : [];
            setSearchResults(scenes);
            if (scenes.length === 0) {
                showError('No NISAR scenes found in this area/date range.');
            }
        } catch (err) {
            console.error('Catalog search failed:', err);
            showError('Catalog search failed - is the gateway running?');
            setSearchResults([]);
        } finally {
            setIsSearching(false);
        }
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
            setViewingResult(previous => ({
                ...(previous || {}),
                id,
                pipeline: 'flood',
                url: previous?.url || api(`/results/${id}_flood.png`),
                floodReport,
                floodGeoJson,
                floodReportPath: reportPath,
                floodGeoJsonPath: geoJsonPath,
                bounds: previous?.bounds
            }));
        }).catch(error => console.error('Unable to load flood artifacts:', error));
    };

    // ── Apply a terminal (completed / failed / cancelled) state to a job ──
    const applyTerminalState = (id, status, error) => {
        useJobStore.getState().setActiveJobStage(null);
        setJobs(prev => {
            const job = prev[id];
            if (job) {
                const fin = Date.now();
                const dur = job.startedAt ? Math.floor((fin - job.startedAt) / 1000) : null;
                setElapsed(e => ({ ...e, [id]: dur }));
                return { ...prev, [id]: { ...job, status, error } };
            }
            return prev;
        });
    };

    // ── Cancel a running job ──
    const cancelJob = async (jobId) => {
        if (!jobId) return;
        try {
            const res = await fetch(api(`/jobs/${jobId}/cancel`), { method: 'POST' });
            if (!res.ok) {
                const msg = await res.text().catch(() => '');
                throw new Error(msg || `Cancel rejected (HTTP ${res.status})`);
            }
        } catch (err) {
            showError(`Cancel failed: ${err.message || 'gateway rejected the request'}`);
        }
    };

    // ── Start Job (PRESERVED) ──
    const startJob = async () => {
        if (dataMode === 'catalog' && selectedScene) {
            handleAcquireAndProcess(true);
            return;
        }
        const inputFile = getInputFile();
        if (!inputFile) return;
        if (!gatewayOnline) { showError('Gateway is offline. Start it with: LOCAL_MODE=true RUST_LOG=info cargo run --release'); return; }
        const activePipeline = profile === 'infrastructure' ? 'insar' : 'flood';

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
                body.radar_band = radarBand;
                body.permanent_water_thresh_db = parseFloat(permanentWaterThreshold);
                body.swath_edge_erosion = parseInt(swathEdgeErosion);
                body.polarization = polarization;
                body.multilook_factor = parseInt(multilookFactor);
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
                        if (parsed.event === 'progress') {
                            useJobStore.getState().setActiveJobStage(parsed.stage);
                        } else if (parsed.event === 'georef' && parsed.bbox) {
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
                    } catch (parseError) {
                        // Processor logs are mostly plain text; only some lines are JSON events.
                        void parseError;
                    }
                }
                setLogs(prev => ({ ...prev, [id]: [...(prev[id] || []), line] }));
                if (terminalRef.current && !userScrolledUp.current) { terminalRef.current.scrollTop = terminalRef.current.scrollHeight; }
                if (line.includes('[SYSTEM] PROCESS_COMPLETED')) {
                    sse.close();
                    setTimeout(() => applyTerminalState(id, 'completed'), 500);
                } else if (line.includes('[SYSTEM] PROCESS_CANCELLED')) {
                    sse.close();
                    setTimeout(() => applyTerminalState(id, 'failed', 'Job cancelled by user'), 500);
                } else if (line.includes('[SYSTEM] PROCESS_TIMEOUT')) {
                    sse.close();
                    setTimeout(() => applyTerminalState(id, 'failed', 'Job timed out after 30 minutes'), 500);
                } else if (line.includes('[SYSTEM] PROCESS_FAILED')) {
                    const msg = line.split('PROCESS_FAILED')[1]?.replace(/^:\s*/, '').trim() || 'Processing failed';
                    sse.close();
                    setTimeout(() => applyTerminalState(id, 'failed', msg), 500);
                }
            };
            sse.onerror = () => { showError('Lost connection to processing stream'); sse.close(); };
        } catch (err) { console.error(err); showError('Failed to start job — check gateway connection'); }
    };

    // ── Start job from path (for ASF download flow) ──
    const startJobFromPath = async (filePath) => {
        if (!filePath) return;
        const activePipeline = profile === 'infrastructure' ? 'insar' : 'flood';
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
                body.radar_band = radarBand;
                body.permanent_water_thresh_db = parseFloat(permanentWaterThreshold);
                body.swath_edge_erosion = parseInt(swathEdgeErosion);
                body.polarization = polarization;
                body.multilook_factor = parseInt(multilookFactor);
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
                if (line.startsWith('{')) {
                    try {
                        const parsed = JSON.parse(line);
                        if (parsed.event === 'progress') {
                            useJobStore.getState().setActiveJobStage(parsed.stage);
                        } else if (parsed.event === 'georef' && parsed.bbox) {
                            const { north, south, east, west } = parsed.bbox;
                            if (Math.abs(north - south) > 0.0001 && Math.abs(east - west) > 0.0001) {
                                setJobs(prev => ({ ...prev, [id]: { ...prev[id], bounds: [[south, west], [north, east]], bbox: parsed.bbox } }));
                                setFlyToCenter([(north + south) / 2, (east + west) / 2]);
                            }
                        } else if (parsed.event === 'insar_report' && parsed.path) {
                            fetch(api(`/${parsed.path}`)).then(r => r.json()).then(report => { setJobs(prev => ({ ...prev, [id]: { ...prev[id], insarReport: report } })); }).catch(console.error);
                        } else if (parsed.event === 'ships_detected' && parsed.path) {
                            fetch(api(`/${parsed.path}`)).then(r => r.json()).then(ships => { setJobs(prev => ({ ...prev, [id]: { ...prev[id], ships } })); }).catch(console.error);
                        } else if (parsed.event === 'flood_report' && parsed.path) {
                            loadFloodArtifacts(id, parsed.path);
                        }
                    } catch (parseError) {
                        void parseError;
                    }
                }
                setLogs(prev => ({ ...prev, [id]: [...(prev[id] || []), line] }));
                if (terminalRef.current && !userScrolledUp.current) terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
                if (line.includes('[SYSTEM] PROCESS_COMPLETED') || line.includes('[SYSTEM] PROCESS_FAILED')) {
                    useJobStore.getState().setActiveJobStage(null);
                    sse.close();
                    setTimeout(() => { setJobs(prev => { const job = prev[id]; if (job) { setElapsed(e => ({ ...e, [id]: Math.floor((Date.now() - job.startedAt) / 1000) })); } return prev; }); }, 500);
                }
            };
            sse.onerror = () => { showError('Lost connection to processing stream'); sse.close(); };
        } catch (err) { console.error(err); showError('Failed to start job'); }
    };

    // ── ASF Acquire + Process ──
    const handleAcquireAndProcess = async (autoStart = true) => {
        if (!selectedScene) return;
        if (!gatewayOnline) { showError('Gateway is offline'); return; }
        setDownloadProgress({ status: 'downloading', progress: 0, granuleId: selectedScene.id });
        setTerminalOpen(true);
        const downloadUrl = api(`/asf/download-stream?granule_id=${encodeURIComponent(selectedScene.id)}&url=${encodeURIComponent(selectedScene.download_url)}`);
        const downloadSse = new EventSource(downloadUrl);
        downloadSse.onmessage = (e) => {
            try {
                const data = JSON.parse(e.data);
                if (data.status === 'downloading') {
                    setDownloadProgress({
                        status: 'downloading',
                        progress: data.progress,
                        downloaded_bytes: data.downloaded_bytes,
                        total_bytes: data.total_bytes,
                        speed_mbps: data.speed_mbps,
                        eta_secs: data.eta_secs,
                        granuleId: selectedScene.id
                    });
                } else if (data.status === 'download_complete') {
                    downloadSse.close();
                    setDownloadProgress({ status: 'download_complete', path: data.path, granuleId: selectedScene.id });
                    if (autoStart) {
                        startJobFromPath(data.path);
                    }
                } else if (data.status === 'error') {
                    downloadSse.close();
                    setDownloadProgress(null);
                    showError(data.message || 'Download failed');
                }
            } catch (err) {
                console.error('Failed to parse download SSE payload:', err);
            }
        };
        downloadSse.onerror = () => {
            downloadSse.close();
            setDownloadProgress(null);
            showError('Download stream connection interrupted.');
        };
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
                    const status = normalizeJobStatus(data.status);
                    const prevJob = currentJobs[id];
                    if (status === 'completed' && prevJob.status !== 'completed') {
                        const jobBounds = prevJob.bounds || (data.bbox ? [[data.bbox.south, data.bbox.west], [data.bbox.north, data.bbox.east]] : null);
                        if (prevJob.pipeline === 'flood' && data.flood_report_path) {
                            const reportUrl = api(data.flood_report_path);
                            const geoJsonUrl = api(data.flood_geojson_path);
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
                                        floodBaselinePath: data.flood_baseline_path,
                                        floodActivePath: data.flood_active_path,
                                        floodReplayAvailable: Boolean(data.flood_baseline_path && data.flood_active_path && floodReport.replay?.available),
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
                                    pipeline: currentJobs[id].pipeline || (profile === 'infrastructure' ? 'insar' : 'flood'),
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
                            status: status === 'failed' ? 'failed' : status,
                            error: status === 'failed' ? (jobErrorMessage(data.status) || prevJob.error) : prevJob.error,
                            output_path: data.output_path,
                            floodReportPath: data.flood_report_path || prev[id]?.floodReportPath,
                            floodGeoJsonPath: data.flood_geojson_path || prev[id]?.floodGeoJsonPath,
                            floodBaselinePath: data.flood_baseline_path || prev[id]?.floodBaselinePath,
                            floodActivePath: data.flood_active_path || prev[id]?.floodActivePath,
                            floodReplayAvailable: Boolean(data.flood_baseline_path && data.flood_active_path) || prev[id]?.floodReplayAvailable
                        }
                    }));
                } catch (error) {
                    console.warn('Job status polling failed:', error);
                }
            }
        }, 3000);
        return () => clearInterval(interval);
    }, [profile, setJobs, setViewingResult]);

    // ── Terminal scroll (PRESERVED) ──

    // ── Fetch environmental context ──
    const fetchContext = useCallback(async () => {
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
        } catch (err) {
            console.error("Failed to fetch environmental context:", err);
            showError(`Failed to fetch environmental context: ${err.message}`);
            setEnvContext(null);
        }
        finally {
            setFetchingContext(false);
        }
    }, [assetLat, assetLon, assetType, showError, setEnvContext, setFetchingContext]);


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

    const runningJobs = Object.values(jobs).filter(j => j.status === 'running');
    const activeProfile = PROFILES[profile] || PROFILES['infrastructure'];

    // Auto-fetch context when asset coordinates are set
    useEffect(() => {
        if (assetLat && assetLon && profile === 'infrastructure') {
            const timer = setTimeout(fetchContext, 500);
            return () => clearTimeout(timer);
        }
    }, [assetLat, assetLon, profile, fetchContext]);

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
    }, [viewingResult, setFlyToCenter]);

    return (
        <div className={`nisar-app-shell nisar-profile-${profile}`} style={{ width: '100%', height: '100dvh', minHeight: 0, position: 'relative', backgroundColor: C.bg0, overflow: 'hidden' }}>

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

                        </div>
                        <button
                            type="button"
                            onClick={() => setDemoDialogOpen(true)}
                            style={{ marginTop: '24px', padding: '11px 18px', borderRadius: '999px', border: `1px solid ${C.accent.flood}`, background: 'rgba(15,150,156,.12)', color: C.text, fontFamily: SANS, fontSize: '12px', cursor: 'pointer' }}
                        >Open verified flood demo</button>
                        <div style={{ marginTop: '10px', color: C.textDim, fontFamily: SANS, fontSize: '11px' }}>
                            Previous results appear only when the local gateway reports them.
                        </div>
                    </div>
                    {demoDialogOpen && (
                        <div role="dialog" aria-modal="true" aria-labelledby="demo-dialog-title" style={{ position: 'absolute', inset: 0, zIndex: 2, display: 'grid', placeItems: 'center', background: 'rgba(0,0,0,.58)', padding: '20px' }}>
                            <div style={{ width: 'min(440px, 100%)', padding: '26px', borderRadius: '20px', border: '1px solid rgba(255,255,255,.12)', background: 'rgba(17,22,29,.96)', boxShadow: '0 24px 80px rgba(0,0,0,.55)', fontFamily: SANS }}>
                                <div id="demo-dialog-title" style={{ color: C.text, fontSize: '18px', fontWeight: 600 }}>Open the verified flood workspace?</div>
                                <p style={{ color: C.textMid, fontSize: '13px', lineHeight: 1.6, margin: '12px 0 20px' }}>
                                    This opens the flood configuration workspace. A result is shown only after the gateway provides a real report and artifacts; no synthetic history or invented intermediate observations are loaded.
                                </p>
                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                                    <button type="button" onClick={() => setDemoDialogOpen(false)} style={{ padding: '10px 14px', borderRadius: '999px', border: '1px solid rgba(255,255,255,.14)', background: 'transparent', color: C.textMid, cursor: 'pointer' }}>Cancel</button>
                                    <button type="button" onClick={() => { setProfile('flood'); setMissionSelected(true); setDemoDialogOpen(false); }} style={{ padding: '10px 14px', borderRadius: '999px', border: `1px solid ${C.accent.flood}`, background: C.accent.flood, color: C.bg0, fontWeight: 600, cursor: 'pointer' }}>Open workspace</button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ═══ TOPBAR ═══ */}
            <TopBar profile={profile} setProfile={setProfile} activeView={activeView} onSelectView={setActiveView} onOpenReport={() => setReportModalOpen(true)} />

            {/* ═══ REAL-TIME PROCESSING PROGRESS BAR ═══ */}
            <ProcessingProgressBar profile={profile} onCancel={cancelJob} />

            {/* ═══ MAP LAYER CONTROLS ═══ */}
            <MapLayerControls profile={profile} activeView={activeView} />

            {/* ═══ RUN HISTORY SIDEBAR ═══ */}

            {/* ═══ FULL-SCREEN MAP ═══ */}
            <MapContainer
                center={[28.65, -0.53]}
                zoom={5}
                style={{
                    display: (profile === 'flood' && activeView !== 'map') ? 'none' : 'block',
                    position: 'absolute',
                    top: '0px',
                    left: '0px',
                    right: '0px',
                    bottom: '0px',
                    cursor: 'crosshair',
                    zIndex: 0
                }}
                zoomControl={false}
                attributionControl={false}
                preferCanvas
            >
                <TileLayer className="nisar-satellite-tiles" url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" />
                <TileLayer className="nisar-map-labels" opacity={0.65} url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}" />
                {viewingResult && viewingResult.url && viewingResult.bounds && showFloodPng && !viewingResult.floodReplayAvailable && (
                    <ImageOverlay
                        url={viewingResult.url}
                        bounds={viewingResult.bounds}
                        opacity={showPermanentWater ? layerOpacity : 0}
                    />
                )}
                <FloodEventReplay
                    key={viewingResult?.url || 'flood-replay'}
                    result={viewingResult}
                    report={viewingResult?.floodReport}
                    bounds={viewingResult?.bounds}
                    showRaster={showFloodPng}
                    onPhaseChange={setReplayPhase}
                    onReplayUnavailable={() => setReplayPhase('detected')}
                />
                <MapResizer />
                <MapEventTracker setCoords={setMouseCoords} setMapBounds={setMapBounds} />
                <MapZoomGate onZoomChange={setMapZoom} />
                <MapAoiDrawer
                    isDrawing={isDrawingAoi}
                    setIsDrawing={setIsDrawingAoi}
                    drawnAoi={drawnAoi}
                    setDrawnAoi={setDrawnAoi}
                    accent={activeProfile.accent || '#2a8b91'}
                />
                {flyToCenter && <MapFlyTo center={flyToCenter} />}

                {selectedScene && selectedScene.footprint && selectedScene.footprint.coordinates && (
                    <>
                        <MapFlyToBounds bounds={(() => {
                            try {
                                return L.geoJSON(selectedScene.footprint).getBounds();
                            } catch { return null; }
                        })()} />
                        <GeoJSON
                            key={selectedScene.id}
                            data={selectedScene.footprint}
                            style={{ color: '#0ea5e9', weight: 2, fillOpacity: 0.12, dashArray: '6' }}
                        />
                    </>
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

                        // If point is stable and has no alert status, hide it to avoid green dots cluttering the map
                        if (absDisp < 2.0 && sev !== 'CRITICAL' && sev !== 'ALERT' && sev !== 'CAUTION') {
                            return null;
                        }

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

{profile === 'flood' && viewingResult?.pipeline === 'flood' && viewingResult.floodGeoJson && showFloodGeoJson && showFloodVectors && (!viewingResult.floodReplayAvailable || replayPhase === 'detected') && (
                    <GeoJSON
                        ref={geoJsonRef}
                        key={viewingResult.floodGeoJsonPath || viewingResult.url}
                        data={viewingResult.floodGeoJson}
                        style={floodStyle}
                        onEachFeature={(feature, layer) => {
                            const props = feature.properties || {};
                            layer.on({
                                click: () => {
                                    setSelectedRegion(feature);
                                    if (props.centroid_lat && props.centroid_lon) {
                                        setFlyToCenter({ center: [props.centroid_lat, props.centroid_lon], zoom: 14 });
                                    }
                                },
                                mouseover: (e) => {
                                    e.target.setStyle({ weight: 2.5, fillOpacity: Math.min(1, 0.85 * layerOpacity), color: '#00e5ff' });
                                },
                                mouseout: (e) => {
                                    e.target.setStyle(floodStyle(feature));
                                }
                            });
                            layer.bindPopup(
                                `<div style="font-family: ${MONO}; font-size: 10px; color: #f0f0f0; min-width: 170px; line-height: 1.6;">
                                    <div style="color: #00e5ff; font-weight: 700; border-bottom: 1px solid #2a2a2a; padding-bottom: 4px; margin-bottom: 4px;">
                                        ${props.region_id || 'FLOOD ZONE'} · ${props.confidence || 'DETECTED'}
                                    </div>
                                    <div>Area: <strong>${props.area_acres != null ? Number(props.area_acres).toFixed(2) + ' ac' : '~0.10 ac'}</strong></div>
                                    <div>Pixels (20m): <strong>${props.pixel_count || 1} px</strong></div>
                                    ${props.high_conf_pixels != null ? `<div>High/Med Split: <strong>${props.high_conf_pixels}H / ${props.med_conf_pixels}M</strong></div>` : ''}
                                    ${props.centroid_lat ? `<div style="color: #888; font-size: 9px; margin-top: 3px;">${Number(props.centroid_lat).toFixed(4)}°N,${Number(props.centroid_lon).toFixed(4)}°E</div>` : ''}
                                </div>`
                        );
                    }}
                    />
                )}
            </MapContainer>

            {/* ── FLOOD HUD: SYNC/LOADING AFFORDANCES ── */}
            {profile === 'flood' && (jobsSyncing || geoJsonLoading) && (
                <div style={{
                    position: 'absolute', top: '58px', left: '224px', zIndex: 950,
                    background: 'rgba(10, 10, 10, 0.92)', border: '1px solid #2A2A2A', padding: '6px 10px',
                    display: 'flex', alignItems: 'center', gap: '8px', pointerEvents: 'none',
                }}>
                    {jobsSyncing && <><Loader size={12} className="spin" /> <span style={{ fontFamily: MONO, fontSize: '9px', color: '#dddddd', letterSpacing: '0.08em' }}>SYNCING PAST RUNS&hellip;</span></>}
                    {geoJsonLoading && <><Loader size={12} className="spin" /> <span style={{ fontFamily: MONO, fontSize: '9px', color: '#dddddd', letterSpacing: '0.08em' }}>LOADING FLOOD POLYGONS&hellip;</span></>}
                </div>
            )}

            {/* ── FLOOD HUD: TEMPORAL CONTEXT (pre/post acquisition dates) ── */}
            {profile === 'flood' && viewingResult?.pipeline === 'flood' && viewingResult.floodReport && (() => {
                const taper = parseFloodReport(viewingResult.floodReport);
                const method = viewingResult.floodReport.method || {};
                if (!taper || taper.baselineDate === 'N/A') return null;
                return (
                    <div style={{
                        position: 'absolute', bottom: '40px', left: '50%', transform: 'translateX(-50%)', zIndex: 950,
                        background: 'rgba(10, 10, 10, 0.92)', border: '1px solid #2A2A2A', padding: '6px 12px',
                        display: 'flex', alignItems: 'center', gap: '10px', pointerEvents: 'none',
                    }}>
                        <span style={{ fontFamily: MONO, fontSize: '8px', color: '#888888', letterSpacing: '0.12em' }}>BEFORE</span>
                        <span style={{ fontFamily: MONO, fontSize: '10px', color: '#a5d8ff' }}>{taper.baselineDate}</span>
                        <span style={{ fontFamily: MONO, fontSize: '10px', color: '#444444' }}>&rarr;</span>
                        <span style={{ fontFamily: MONO, fontSize: '8px', color: '#888888', letterSpacing: '0.12em' }}>AFTER</span>
                        <span style={{ fontFamily: MONO, fontSize: '10px', color: '#ffd166' }}>{taper.activeDate}</span>
                        <span style={{ width: '1px', height: '14px', background: '#333333' }} />
                        <span style={{ fontFamily: MONO, fontSize: '8px', color: '#888888', letterSpacing: '0.12em' }}>NEW WATER</span>
                        <span style={{ fontFamily: MONO, fontSize: '10px', color: '#42c6d5' }}>{taper.totalFloodAcres.toFixed(1)} ac</span>
                        <span style={{ fontFamily: MONO, fontSize: '8px', color: '#888888', letterSpacing: '0.12em' }}>OTSU</span>
                        <span style={{ fontFamily: MONO, fontSize: '10px', color: '#dddddd' }}>{Number(method.threshold_db || -3.0).toFixed(2)} dB</span>
                    </div>
                );
            })()}

            {/* ── FLOOD HUD: zoom hint when interactive polygons are deferred ── */}
            {profile === 'flood' && viewingResult?.pipeline === 'flood' && floodFeatureCount > MAX_RASTER_GEOJSON_FEATURES && !showFloodVectors && (
                <div style={{
                    position: 'absolute', top: '58px', left: '50%', transform: 'translateX(-50%)', zIndex: 950,
                    background: 'rgba(10, 10, 10, 0.92)', border: '1px solid #2A2A2A', padding: '6px 12px',
                    display: 'flex', alignItems: 'center', gap: '8px', pointerEvents: 'none',
                }}>
                    <Search size={12} style={{ color: '#42c6d5' }} />
                    <span style={{ fontFamily: MONO, fontSize: '9px', color: '#bbbbbb', letterSpacing: '0.08em' }}>
                        ZOOM IN TO {FLOOD_FEATURE_ZOOM}+ FOR INTERACTIVE FLOOD POLYGONS
                    </span>
                </div>
            )}

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

            {/* ═══ MAP CROSSHAIR (Aligned to MapContainer viewport) ═══ */}
            {!(profile === 'flood' && activeView !== 'map') && (
                <div
                    style={{
                        position: 'absolute',
                        top: '0px',
                        left: '0px',
                        right: '0px',
                        bottom: '0px',
                        pointerEvents: 'none',
                        zIndex: 500,
                        overflow: 'hidden',
                    }}
                >
                    <div className="map-crosshair" />
                    <div className="map-crosshair-box" />
                </div>
            )}

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
                    localFilePath={localFilePath}
                    setLocalFilePath={setLocalFilePath}
                    slaveFilePath={slaveFilePath}
                    setSlaveFilePath={setSlaveFilePath}
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

            {/* ═══ PROFILE-SPECIFIC RIGHT INSPECTOR ═══ */}
            {profile === 'flood' && activeView === 'map' && !inspectorOpen && (
                <button type="button" className="flood-inspector-open" onClick={() => setInspectorOpen(true)} aria-label="Show analysis inspector">
                    Show inspector
                </button>
            )}
            <div className={`nisar-inspector-panel ${inspectorOpen ? 'is-open' : 'is-collapsed'}`} style={{
                position: 'absolute', top: '20px', right: '20px', bottom: '20px', width: '380px', zIndex: 100,
                background: 'rgba(18, 19, 22, 0.84)', backdropFilter: 'blur(28px) saturate(140%)', WebkitBackdropFilter: 'blur(28px) saturate(140%)',
                border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '24px',
                boxShadow: '0 24px 60px rgba(0, 0, 0, 0.75)',
                display: (profile === 'infrastructure' || (profile === 'flood' && activeView !== 'map') || !inspectorOpen) ? 'none' : 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
            }}>

                {profile === 'flood' && activeView === 'map' && (
                    <button type="button" className="flood-inspector-hide" onClick={() => setInspectorOpen(false)} aria-label="Hide analysis inspector">Hide</button>
                )}

                {/* ── PROFILE: FLOOD MONITORING TOP TABS ── */}
                {profile === 'flood' && (
                    <div style={{
                        display: 'flex',
                        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                        background: 'rgba(10, 14, 20, 0.75)',
                        flexShrink: 0
                    }}>
                        <button className="scientist-mode-tab"
                            onClick={() => setViewingResult(null)}
                            style={{
                                flex: 1, padding: '10px 8px', fontFamily: MONO, fontSize: '10px', fontWeight: 600,
                                background: (!viewingResult || viewingResult.pipeline !== 'flood') ? 'rgba(255, 255, 255, 0.13)' : 'transparent',
                                border: 'none',
                                borderBottom: (!viewingResult || viewingResult.pipeline !== 'flood') ? '2px solid rgba(255, 255, 255, 0.35)' : '2px solid transparent',
                                color: (!viewingResult || viewingResult.pipeline !== 'flood') ? C.text : C.textDim,
                                cursor: 'pointer', textAlign: 'center', letterSpacing: '0.06em',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                            }}
                        >
                            Configure & Run
                        </button>
                        <button className="scientist-mode-tab"
                            onClick={() => {
                                const floodJob = Object.values(jobs).find(j => j.pipeline === 'flood' && j.floodReport);
                                if (floodJob) {
                                    setViewingResult({
                                        url: api(floodJob.output_path),
                                        bounds: floodJob.bounds,
                                        floodReport: floodJob.floodReport,
                                        floodGeoJson: floodJob.floodGeoJson,
                                        floodReportPath: floodJob.floodReportPath,
                                        floodGeoJsonPath: floodJob.floodGeoJsonPath,
                                        floodBaselinePath: floodJob.floodBaselinePath,
                                        floodActivePath: floodJob.floodActivePath,
                                        floodReplayAvailable: floodJob.floodReplayAvailable,
                                        pipeline: 'flood',
                                        elapsed: floodJob.elapsed || 42,
                                        bbox: floodJob.bbox
                                    });
                                }
                            }}
                            style={{
                                flex: 1, padding: '10px 8px', fontFamily: MONO, fontSize: '10px', fontWeight: 600,
                                background: (viewingResult && viewingResult.pipeline === 'flood') ? 'rgba(255, 255, 255, 0.13)' : 'transparent',
                                border: 'none',
                                borderBottom: (viewingResult && viewingResult.pipeline === 'flood') ? '2px solid rgba(255, 255, 255, 0.35)' : '2px solid transparent',
                                color: (viewingResult && viewingResult.pipeline === 'flood') ? C.text : C.textDim,
                                cursor: 'pointer', textAlign: 'center', letterSpacing: '0.06em',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                            }}
                        >
                            Analysis Report
                        </button>
                    </div>
                )}

                {/* ── PROFILE: FLOOD MONITORING CONTENT ── */}
                {profile === 'flood' && (
                    viewingResult && viewingResult.pipeline === 'flood' ? (
                        viewingResult.floodReport ? (
                            <FloodInsightPanel
                                floodReport={viewingResult.floodReport}
                                floodGeoJson={viewingResult.floodGeoJson}
                                selectedRegion={selectedRegion}
                                onSelectRegion={(feat) => {
                                    setSelectedRegion(feat);
                                    if (feat?.properties?.centroid_lat != null && feat?.properties?.centroid_lon != null) {
                                        setFlyToCenter({ center: [feat.properties.centroid_lat, feat.properties.centroid_lon], zoom: 14 });
                                    }
                                }}
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
                        <FloodConfigPanel
                            dataMode={dataMode}
                            setDataMode={setDataMode}
                            localFilePath={localFilePath}
                            setLocalFilePath={setLocalFilePath}
                            metadata={metadata}
                            startDate={startDate}
                            setStartDate={setStartDate}
                            endDate={endDate}
                            setEndDate={setEndDate}
                            catalogTrack={catalogTrack}
                            setCatalogTrack={setCatalogTrack}
                            catalogFrame={catalogFrame}
                            setCatalogFrame={setCatalogFrame}
                            onUploadFile={uploadLocalFile}
                            handleSearch={handleSearch}
                            isSearching={isSearching}
                            searchResults={searchResults}
                            selectedScene={selectedScene}
                            setSelectedScene={setSelectedScene}
                            startJob={startJob}
                            getInputFile={getInputFile}
                            runningJobs={runningJobs}
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
                            radarBand={radarBand}
                            setRadarBand={setRadarBand}
                            permanentWaterThreshold={permanentWaterThreshold}
                            setPermanentWaterThreshold={setPermanentWaterThreshold}
                            swathEdgeErosion={swathEdgeErosion}
                            setSwathEdgeErosion={setSwathEdgeErosion}
                            recededWaterThreshold={recededWaterThreshold}
                            setRecededWaterThreshold={setRecededWaterThreshold}
                            speckleFilter={speckleFilter}
                            setSpeckleFilter={setSpeckleFilter}
                            multilookFactor={multilookFactor}
                            setMultilookFactor={setMultilookFactor}
                            polarization={polarization}
                            setPolarization={setPolarization}
                            downloadProgress={downloadProgress}
                            handleAcquireAndProcess={handleAcquireAndProcess}
                            onCancel={cancelJob}
                        />
                    )
                )}

            </div>

            {/* ═══ BOTTOM PROCESSING SUMMARY STRIP ═══ */}
            <BottomStrip activeView={activeView} />

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
            <CoordinatesHud profile={profile} activeView={activeView} metadata={metadata} />

            {/* ═══ TERMINAL DRAWER ═══ */}
            <TerminalDrawer profile={profile} activeView={activeView} onCancel={cancelJob} />

            {/* ═══ ANALYSIS REPORT MODAL ═══ */}
            {reportModalOpen && viewingResult && viewingResult.floodReport && (
                <AnalysisReportModal
                    floodReport={viewingResult.floodReport}
                    onClose={() => setReportModalOpen(false)}
                />
            )}

            {/* ═══ WORKSPACE SIDEBAR NAVIGATION (profile === 'flood') ═══ */}
            {profile === 'flood' && (
                <div className="flood-left-rail" style={{ '--flood-side': `${TM.side}px` }}>
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
                    >
                        <RunHistorySidebar profile={profile} activeView={activeView} onCancel={cancelJob} />
                    </WorkspaceSidebar>
                </div>
            )}

            {/* ═══ WORKSPACE TAB PANELS (profile === 'flood' and not 'map') ═══ */}
            {profile === 'flood' && activeView !== 'map' && (
                <div style={{
                    position: 'absolute',
                    left: `${TM.side}px`,
                    top: '42px',
                    right: 0,
                    bottom: 0,
                    background: '#0a0d10',
                    zIndex: 10,
                    display: 'flex',
                    flexDirection: 'column'
                }}>
                    {activeView === 'timeseries' && <TimeSeriesView floodReport={viewingResult?.floodReport} allJobs={jobs} />}
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
                                const center = (region?.properties?.centroid_lat != null && region?.properties?.centroid_lon != null)
                                    ? [region.properties.centroid_lat, region.properties.centroid_lon]
                                    : extractCentroid(region.geometry);
                                if (center) {
                                    setFlyToCenter({ center, zoom: 14 });
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

            {/* FLOOD COMPARISON STRIP removed — info consolidated into bottom processing strip */}
        </div>
    );
}

export default AppDashboard;
