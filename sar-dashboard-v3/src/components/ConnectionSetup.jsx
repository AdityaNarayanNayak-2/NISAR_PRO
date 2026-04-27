import { useState, useEffect } from 'react';
import { getGatewayUrl, setGatewayUrl, api } from '../config/api';

export default function ConnectionSetup({ onConnected }) {
    const [url, setUrl] = useState(getGatewayUrl());
    const [status, setStatus] = useState('idle'); // idle | checking | connected | failed
    const [error, setError] = useState('');

    // Auto-check on mount
    useEffect(() => {
        checkConnection(getGatewayUrl());
    }, []);

    async function checkConnection(targetUrl) {
        setStatus('checking');
        setError('');
        const cleanUrl = targetUrl.replace(/\/+$/, '');
        try {
            const res = await fetch(`${cleanUrl}/jobs`, { signal: AbortSignal.timeout(3000) });
            if (res.ok || res.status === 200) {
                setGatewayUrl(cleanUrl);
                setStatus('connected');
                setTimeout(() => onConnected(), 600);
            } else {
                throw new Error(`HTTP ${res.status}`);
            }
        } catch (err) {
            try {
                await fetch(`${cleanUrl}/`, { signal: AbortSignal.timeout(3000) });
                setGatewayUrl(cleanUrl);
                setStatus('connected');
                setTimeout(() => onConnected(), 600);
            } catch {
                setStatus('failed');
                setError(err.message === 'The operation was aborted due to timeout' ? 'Connection timed out' : 'Cannot reach gateway');
            }
        }
    }

    if (status === 'connected') {
        return (
            <div style={styles.container}>
                <div style={styles.card}>
                    <div style={{ ...styles.statusDot, background: '#10b981' }} />
                    <h2 style={styles.title}>Connected</h2>
                    <p style={styles.sub}>Gateway is running at <code style={styles.code}>{url}</code></p>
                </div>
            </div>
        );
    }

    return (
        <div style={styles.container}>
            <div style={styles.card}>
                <div style={styles.logo}><span style={{ color: '#00E5CC' }}>//</span> NISARPro</div>
                <h2 style={styles.title}>Connect to Your Local Backend</h2>
                <p style={styles.sub}>
                    The NISARPro dashboard runs in your browser, but needs a local gateway for SAR processing.
                    Start the gateway on your machine, then connect here.
                </p>

                <div style={styles.stepsBox}>
                    <div style={styles.step}>
                        <span style={styles.stepNum}>1</span>
                        <div>
                            <strong style={{ color: '#fff' }}>Clone & build</strong>
                            <pre style={styles.pre}>git clone https://github.com/example/sar_analyzer.git{'\n'}cd sar_analyzer/sar_processor{'\n'}cargo build --release</pre>
                        </div>
                    </div>
                    <div style={styles.step}>
                        <span style={styles.stepNum}>2</span>
                        <div>
                            <strong style={{ color: '#fff' }}>Start the gateway</strong>
                            <pre style={styles.pre}>cd sar-gateway{'\n'}LOCAL_MODE=true RUST_LOG=info cargo run --release</pre>
                        </div>
                    </div>
                    <div style={styles.step}>
                        <span style={styles.stepNum}>3</span>
                        <div>
                            <strong style={{ color: '#fff' }}>Connect below</strong>
                            <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)' }}>Default port is 3000. Change it if you configured a different one.</p>
                        </div>
                    </div>
                </div>

                <div style={styles.inputRow}>
                    <input
                        type="text"
                        value={url}
                        onChange={e => setUrl(e.target.value)}
                        placeholder="http://localhost:3000"
                        style={styles.input}
                        onKeyDown={e => e.key === 'Enter' && checkConnection(url)}
                    />
                    <button
                        onClick={() => checkConnection(url)}
                        disabled={status === 'checking'}
                        style={{ ...styles.btn, opacity: status === 'checking' ? 0.6 : 1 }}
                    >
                        {status === 'checking' ? 'Connecting...' : 'Connect'}
                    </button>
                </div>

                {status === 'failed' && (
                    <div style={styles.error}>
                        <strong>Connection failed:</strong> {error}.
                        <span style={{ display: 'block', marginTop: '6px', opacity: 0.7 }}>
                            Make sure the gateway is running and the URL is correct.
                        </span>
                    </div>
                )}

                <p style={{ ...styles.sub, marginTop: '2rem', fontSize: '0.78rem' }}>
                    All processing happens on <strong>your machine</strong>. No data leaves your computer.
                    <br />The dashboard is just a UI layer — it cannot process SAR data by itself.
                </p>
            </div>
        </div>
    );
}

const styles = {
    container: {
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0A0F1E',
        fontFamily: "'Space Grotesk', sans-serif",
        padding: '2rem',
    },
    card: {
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '16px',
        padding: '3rem',
        maxWidth: '560px',
        width: '100%',
        textAlign: 'center',
    },
    logo: {
        fontSize: '1.5rem',
        fontWeight: 700,
        color: '#fff',
        marginBottom: '1.5rem',
        letterSpacing: '-0.02em',
    },
    title: {
        color: '#fff',
        fontSize: '1.3rem',
        fontWeight: 600,
        margin: '0 0 0.75rem',
    },
    sub: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: '0.9rem',
        lineHeight: 1.6,
        margin: 0,
    },
    stepsBox: {
        textAlign: 'left',
        margin: '2rem 0',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
    },
    step: {
        display: 'flex',
        gap: '12px',
        alignItems: 'flex-start',
        color: 'rgba(255,255,255,0.6)',
        fontSize: '0.88rem',
    },
    stepNum: {
        background: 'rgba(0,229,204,0.15)',
        color: '#00E5CC',
        width: '28px',
        height: '28px',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '0.8rem',
        fontWeight: 700,
        flexShrink: 0,
    },
    pre: {
        background: 'rgba(0,0,0,0.4)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '6px',
        padding: '8px 12px',
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: '0.78rem',
        color: 'rgba(255,255,255,0.7)',
        margin: '8px 0 0',
        whiteSpace: 'pre-wrap',
        overflowX: 'auto',
    },
    inputRow: {
        display: 'flex',
        gap: '8px',
        margin: '0 auto',
        maxWidth: '440px',
    },
    input: {
        flex: 1,
        background: 'rgba(0,0,0,0.4)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '8px',
        padding: '10px 14px',
        color: '#fff',
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: '0.88rem',
        outline: 'none',
    },
    btn: {
        background: '#00E5CC',
        color: '#0A0F1E',
        border: 'none',
        borderRadius: '8px',
        padding: '10px 20px',
        fontWeight: 700,
        fontSize: '0.88rem',
        cursor: 'pointer',
        fontFamily: "'Space Grotesk', sans-serif",
        whiteSpace: 'nowrap',
    },
    error: {
        background: 'rgba(248,113,113,0.1)',
        border: '1px solid rgba(248,113,113,0.2)',
        borderRadius: '8px',
        padding: '12px 16px',
        marginTop: '1rem',
        color: '#f87171',
        fontSize: '0.85rem',
        textAlign: 'left',
    },
    statusDot: {
        width: '12px',
        height: '12px',
        borderRadius: '50%',
        margin: '0 auto 1rem',
        boxShadow: '0 0 12px rgba(16,185,129,0.5)',
    },
    code: {
        background: 'rgba(0,0,0,0.3)',
        padding: '2px 8px',
        borderRadius: '4px',
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: '0.85rem',
        color: '#00E5CC',
    },
};
