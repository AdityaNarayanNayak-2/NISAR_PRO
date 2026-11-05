import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, CheckCircle2, AlertCircle, RefreshCw, X, Server, Globe } from 'lucide-react';
import { getGatewayUrl, setGatewayUrl, DEFAULT_URL, PUBLIC_FALLBACK_URL } from '../config/api';
import { useGatewayStore } from '../pages/app/stores/useGatewayStore';

const MONO = "'JetBrains Mono', monospace";
const SANS = "'Outfit', -apple-system, sans-serif";

export default function ConnectionModal({ isOpen, onClose }) {
    const [url, setUrl] = useState('');
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState(null); // { success: boolean, latency: number, message: string }
    const setGatewayOnline = useGatewayStore(state => state.setGatewayOnline);

    useEffect(() => {
        if (isOpen) {
            setUrl(getGatewayUrl());
            setTestResult(null);
        }
    }, [isOpen]);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && isOpen) onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const handleTest = async (testTarget) => {
        const targetUrl = (testTarget || url).trim().replace(/\/+$/, '');
        if (!targetUrl) return;
        setTesting(true);
        setTestResult(null);
        const start = performance.now();
        try {
            const res = await fetch(`${targetUrl}/jobs/health-ping`, {
                signal: AbortSignal.timeout(4000),
                headers: { 'Accept': 'application/json' }
            });
            const latency = Math.round(performance.now() - start);
            if (res.ok) {
                setTestResult({
                    success: true,
                    latency,
                    message: `Gateway healthy (${latency} ms)`
                });
            } else {
                setTestResult({
                    success: false,
                    latency,
                    message: `HTTP ${res.status}: ${res.statusText || 'Endpoint returned error'}`
                });
            }
        } catch (err) {
            setTestResult({
                success: false,
                latency: 0,
                message: err.name === 'TimeoutError' ? 'Connection timed out (>4s)' : 'Connection refused / network error'
            });
        } finally {
            setTesting(false);
        }
    };

    const handleSave = () => {
        const clean = url.trim().replace(/\/+$/, '');
        setGatewayUrl(clean);
        setGatewayOnline(testResult?.success ?? true);
        onClose();
        // Trigger health check in store
        const checkHealth = useGatewayStore.getState().checkGatewayHealth;
        if (checkHealth) checkHealth();
    };

    const handlePreset = (presetUrl) => {
        setUrl(presetUrl);
        handleTest(presetUrl);
    };

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            backgroundColor: 'rgba(5, 7, 10, 0.75)',
            backdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '16px'
        }} onClick={onClose}>
            <div style={{
                width: '100%', maxWidth: '480px',
                background: '#0E1117',
                border: '1px solid #30363D',
                borderRadius: '12px',
                boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
                overflow: 'hidden',
                color: '#E6EDF3',
                fontFamily: SANS
            }} onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '16px 20px',
                    borderBottom: '1px solid #21262D',
                    background: '#161B22'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                            width: '32px', height: '32px', borderRadius: '8px',
                            background: 'rgba(15, 150, 156, 0.15)', border: '1px solid rgba(15, 150, 156, 0.4)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                            <Server size={17} color="#58A6FF" />
                        </div>
                        <div>
                            <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600, letterSpacing: '-0.01em' }}>
                                Gateway Server Connection
                            </h3>
                            <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#8B949E' }}>
                                Connect to 24/7 backend via Cloudflare Tunnel or local port
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} style={{
                        background: 'none', border: 'none', color: '#8B949E',
                        cursor: 'pointer', padding: '6px', borderRadius: '6px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                        <X size={16} />
                    </button>
                </div>

                {/* Body */}
                <div style={{ padding: '20px' }}>
                    {/* URL Input */}
                    <div style={{ marginBottom: '14px' }}>
                        <label style={{ display: 'block', fontSize: '11px', fontFamily: MONO, color: '#8B949E', marginBottom: '6px', textTransform: 'uppercase' }}>
                            Backend Gateway URL
                        </label>
                        <input
                            type="text"
                            value={url}
                            onChange={e => setUrl(e.target.value)}
                            placeholder="https://...trycloudflare.com or http://localhost:3000"
                            style={{
                                width: '100%', boxSizing: 'border-box',
                                background: '#161B22', border: '1px solid #30363D',
                                borderRadius: '8px', padding: '10px 14px',
                                color: '#F0F6FC', fontFamily: MONO, fontSize: '12px',
                                outline: 'none'
                            }}
                        />
                    </div>

                    {/* Quick Presets */}
                    <div style={{ marginBottom: '18px' }}>
                        <span style={{ fontSize: '10px', fontFamily: MONO, color: '#8B949E', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
                            Fast Presets
                        </span>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            <button
                                type="button"
                                onClick={() => handlePreset(PUBLIC_FALLBACK_URL)}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '6px',
                                    padding: '6px 10px', borderRadius: '6px',
                                    background: '#21262D', border: '1px solid #30363D',
                                    color: '#58A6FF', fontSize: '11px', cursor: 'pointer',
                                    fontFamily: MONO
                                }}
                            >
                                <Globe size={13} /> Cloudflare Tunnel (Live)
                            </button>
                            <button
                                type="button"
                                onClick={() => handlePreset(DEFAULT_URL)}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '6px',
                                    padding: '6px 10px', borderRadius: '6px',
                                    background: '#21262D', border: '1px solid #30363D',
                                    color: '#C9D1D9', fontSize: '11px', cursor: 'pointer',
                                    fontFamily: MONO
                                }}
                            >
                                <Server size={13} /> Localhost (:3000)
                            </button>
                        </div>
                    </div>

                    {/* Test Status Banner */}
                    {testResult && (
                        <div style={{
                            padding: '10px 14px', borderRadius: '8px',
                            background: testResult.success ? 'rgba(46, 160, 67, 0.12)' : 'rgba(248, 81, 73, 0.12)',
                            border: `1px solid ${testResult.success ? '#2EA043' : '#F85149'}`,
                            display: 'flex', alignItems: 'center', gap: '10px',
                            marginBottom: '18px'
                        }}>
                            {testResult.success ? (
                                <CheckCircle2 size={16} color="#3FB950" />
                            ) : (
                                <AlertCircle size={16} color="#F85149" />
                            )}
                            <div style={{ flex: 1, fontFamily: MONO, fontSize: '11px', color: testResult.success ? '#3FB950' : '#FF7B72' }}>
                                {testResult.message}
                            </div>
                        </div>
                    )}

                    {/* Action buttons */}
                    <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '10px' }}>
                        <button
                            type="button"
                            onClick={() => handleTest()}
                            disabled={testing || !url.trim()}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '6px',
                                padding: '8px 14px', borderRadius: '6px',
                                background: '#21262D', border: '1px solid #30363D',
                                color: '#C9D1D9', fontSize: '12px', fontWeight: 500,
                                cursor: testing ? 'wait' : 'pointer'
                            }}
                        >
                            <RefreshCw size={13} className={testing ? 'is-spinning' : ''} />
                            {testing ? 'Pinging...' : 'Test Ping'}
                        </button>
                        <button
                            type="button"
                            onClick={handleSave}
                            style={{
                                padding: '8px 18px', borderRadius: '6px',
                                background: '#238636', border: '1px solid rgba(240, 246, 252, 0.1)',
                                color: '#FFFFFF', fontSize: '12px', fontWeight: 600,
                                cursor: 'pointer'
                            }}
                        >
                            Save & Connect
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
