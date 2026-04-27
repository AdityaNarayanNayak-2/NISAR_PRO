import React, { useState, useEffect } from 'react';

// ============================================================================
// THEME & CORE UI COMPONENTS
// ============================================================================
const theme = {
    bg: '#0A0A0A',
    panel: '#111111',
    border: 'rgba(255,255,255,0.1)',
    textDef: 'rgba(255,255,255,0.85)',
    textMuted: 'rgba(255,255,255,0.55)',
    accent: '#00E5CC',
    codeBg: '#050505',
    font: '"DM Sans", -apple-system, sans-serif',
    mono: '"JetBrains Mono", monospace'
};

const Header = ({ title, desc }) => (
    <div style={{ marginBottom: '2.5rem' }}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 700, margin: '0 0 0.5rem 0', letterSpacing: '-0.02em', color: '#fff' }}>{title}</h1>
        {desc && <p style={{ fontSize: '1.1rem', color: theme.textMuted, margin: 0, lineHeight: 1.6 }}>{desc}</p>}
        <div style={{ height: '1px', background: theme.border, marginTop: '2rem' }} />
    </div>
);

const H2 = ({ children, id }) => (
    <h2 id={id} className="doc-h2" style={{ fontSize: '1.5rem', fontWeight: 600, color: '#fff', marginTop: '3rem', marginBottom: '1.25rem', paddingBottom: '0.5rem', borderBottom: `1px solid ${theme.border}`, letterSpacing: '-0.01em' }}>{children}</h2>
);

const H3 = ({ children, id }) => (
    <h3 id={id} className="doc-h3" style={{ fontSize: '1.15rem', fontWeight: 600, color: '#fff', marginTop: '2rem', marginBottom: '0.75rem' }}>{children}</h3>
);

const P = ({ children }) => (
    <p style={{ fontSize: '1rem', color: theme.textDef, lineHeight: 1.7, marginBottom: '1.25rem' }}>{children}</p>
);

const Alert = ({ type, title, children }) => {
    let colors = { bg: '#1c1c1c', border: '#444', icon: 'ℹ️' };
    if (type === 'warning') colors = { bg: 'rgba(245, 158, 11, 0.1)', border: '#f59e0b', icon: '⚠️' };
    if (type === 'note') colors = { bg: 'rgba(59, 130, 246, 0.1)', border: '#3b82f6', icon: '📝' };
    if (type === 'success') colors = { bg: 'rgba(16, 185, 129, 0.1)', border: '#10b981', icon: '✅' };

    return (
        <div style={{ background: colors.bg, borderLeft: `3px solid ${colors.border}`, padding: '1.25rem', borderRadius: '4px', margin: '1.5rem 0' }}>
            <strong style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', marginBottom: '0.5rem', fontSize: '0.95rem' }}>
                <span>{colors.icon}</span> {title}
            </strong>
            <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.95rem', lineHeight: 1.6 }}>{children}</div>
        </div>
    );
};

const CodeTab = ({ tabs }) => {
    const [active, setActive] = useState(0);
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(tabs[active].code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div style={{ background: theme.codeBg, border: `1px solid ${theme.border}`, borderRadius: '6px', margin: '1.5rem 0', overflow: 'hidden' }}>
            <div style={{ display: 'flex', background: theme.panel, borderBottom: `1px solid ${theme.border}` }}>
                {tabs.map((t, idx) => (
                    <button
                        key={idx}
                        onClick={() => setActive(idx)}
                        style={{ background: active === idx ? theme.codeBg : 'transparent', border: 'none', color: active === idx ? theme.accent : theme.textMuted, borderBottom: active === idx ? `1px solid ${theme.accent}` : '1px solid transparent', padding: '10px 16px', fontFamily: theme.mono, fontSize: '0.8rem', cursor: 'pointer', transition: 'all 0.1s' }}>
                        {t.name}
                    </button>
                ))}
            </div>
            <div style={{ position: 'relative' }}>
                <button
                    onClick={handleCopy}
                    style={{ position: 'absolute', top: '12px', right: '12px', background: copied ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.08)', border: `1px solid ${copied ? '#10b981' : theme.border}`, color: copied ? '#10b981' : '#fff', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', cursor: 'pointer', transition: 'all 0.2s', fontFamily: theme.mono }}>
                    {copied ? 'Copied!' : 'Copy'}
                </button>
                <pre style={{ margin: 0, padding: '1.25rem', overflowX: 'auto', fontFamily: theme.mono, fontSize: '0.85rem', color: '#e2e8f0', lineHeight: 1.55 }}>
                    {tabs[active].code}
                </pre>
            </div>
        </div>
    );
};

const KaTeXBlock = ({ math }) => {
    const el = React.useRef();
    React.useEffect(() => {
        if (window.katex && el.current) {
            try {
                window.katex.render(math, el.current, { displayMode: true, throwOnError: false });
            } catch (e) { console.error("KaTeX parse error", e); }
        }
    }, [math]);
    return <div ref={el} style={{ margin: '2rem 0', textAlign: 'center', fontSize: '1.2rem' }} />;
};

const DocImage = ({ src, alt, caption }) => (
    <div style={{ margin: '2rem 0', borderRadius: '8px', overflow: 'hidden', border: `1px solid ${theme.border}` }}>
        <img
            src={src}
            alt={alt}
            style={{ width: '100%', height: '260px', objectFit: 'cover', display: 'block' }}
            onError={(e) => { e.target.style.display = 'none'; }}
        />
        <div style={{
            display: 'flex',
            height: '260px',
            background: theme.panel,
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            gap: '12px',
            padding: '2rem',
            textAlign: 'center'
        }}>
            <span style={{ fontSize: '2rem' }}>🖼️</span>
            <span style={{ color: theme.textMuted, fontSize: '0.9rem' }}>{alt}</span>
            <span style={{ color: theme.textMuted, fontSize: '0.8rem', fontFamily: theme.mono }}>Image: {caption}</span>
        </div>
    </div>
);

// ============================================================================
// CONTENT PAGES (DUMMY CONTENT FOR NOW)
// ============================================================================
// SECTION_1_START

// --- Reusable sub-components scoped to Getting Started ---
const StepNumber = ({ n }) => (
    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(0,229,204,0.15)', border: '1px solid rgba(0,229,204,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', fontWeight: 700, color: '#00E5CC', flexShrink: 0 }}>{n}</div>
);

const Step = ({ n, title, children }) => (
    <div style={{ display: 'flex', gap: '1.25rem', marginBottom: '2.5rem', alignItems: 'flex-start' }}>
        <StepNumber n={n} />
        <div style={{ flexGrow: 1 }}>
            <div style={{ fontSize: '1.05rem', fontWeight: 600, color: '#fff', marginBottom: '0.75rem' }}>{title}</div>
            {children}
        </div>
    </div>
);

const PrereqCard = ({ name, version, url, required }) => (
    <a href={url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
        <div style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', transition: 'border-color 0.15s, background 0.15s', cursor: 'pointer' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(0,229,204,0.4)'; e.currentTarget.style.background = 'rgba(0,229,204,0.04)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.background = '#111111'; }}>
            <div>
                <div style={{ fontWeight: 600, color: '#fff', fontSize: '0.95rem' }}>{name}</div>
                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem', fontFamily: '"JetBrains Mono", monospace', marginTop: '3px' }}>{version}</div>
            </div>
            <span style={{ fontSize: '0.75rem', padding: '3px 8px', borderRadius: '4px', background: required ? 'rgba(0,229,204,0.12)' : 'rgba(255,255,255,0.06)', color: required ? '#00E5CC' : 'rgba(255,255,255,0.4)', border: `1px solid ${required ? 'rgba(0,229,204,0.3)' : 'rgba(255,255,255,0.1)'}`, fontWeight: 500 }}>
                {required ? 'Required' : 'K8s only'}
            </span>
        </div>
    </a>
);

const EnvRow = ({ varName, defaultVal, desc }) => (
    <tr>
        <td style={{ padding: '10px 14px', fontFamily: '"JetBrains Mono", monospace', fontSize: '0.82rem', color: '#00E5CC', borderBottom: '1px solid rgba(255,255,255,0.07)', whiteSpace: 'nowrap' }}>{varName}</td>
        <td style={{ padding: '10px 14px', fontFamily: '"JetBrains Mono", monospace', fontSize: '0.82rem', color: 'rgba(255,255,255,0.5)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>{defaultVal}</td>
        <td style={{ padding: '10px 14px', fontSize: '0.87rem', color: 'rgba(255,255,255,0.75)', borderBottom: '1px solid rgba(255,255,255,0.07)', lineHeight: 1.5 }}>{desc}</td>
    </tr>
);

const PageQuickstart = () => (
    <div>
        <Header
            title="Quick Start"
            desc="Go from zero to a processed SAR image in under 10 minutes. This guide uses Local Mode — no Kubernetes required."
        />

        <Alert type="note" title="Two Modes Available">
            NISARPro runs in <strong>Local Mode</strong> (default — spawns <code>sar_processor</code> as a subprocess) or <strong>Kubernetes Mode</strong> (creates a <code>SarJob</code> CRD reconciled by the operator). This guide covers Local Mode. See the <em>Deployment Guide</em> for K8s.
        </Alert>

        <H2 id="prerequisites">Prerequisites</H2>
        <P>Install these tools before you begin. Click each card to visit the official install page.</P>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '10px', margin: '1.5rem 0 2.5rem' }}>
            <PrereqCard name="Rust + Cargo" version="≥ 1.70 (stable)" url="https://rustup.rs" required={true} />
            <PrereqCard name="Node.js" version="≥ 20 LTS" url="https://nodejs.org" required={true} />
            <PrereqCard name="Git" version="any" url="https://git-scm.com" required={true} />
            <PrereqCard name="HDF5 system library" version="libhdf5-dev" url="https://www.hdfgroup.org" required={true} />
            <PrereqCard name="Docker / Podman" version="latest" url="https://www.docker.com" required={false} />
            <PrereqCard name="kubectl + Kind" version="latest" url="https://kind.sigs.k8s.io" required={false} />
        </div>

        <Alert type="warning" title="Linux (Ubuntu/Debian) — HDF5 dependency">
            The Rust HDF5 crate links against the system libhdf5. Install it before running <code>cargo build</code>:
            <br /><br />
            <code style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '0.85rem' }}>sudo apt-get install -y libhdf5-dev pkg-config</code>
        </Alert>

        <H2 id="clone">Step-by-Step Setup</H2>

        <Step n="1" title="Clone the repository">
            <CodeTab tabs={[{ name: 'HTTPS', code: 'git clone https://github.com/example/sar_analyzer.git\ncd sar_analyzer' }, { name: 'SSH', code: 'git clone git@github.com:example/sar_analyzer.git\ncd sar_analyzer' }]} />
        </Step>

        <Step n="2" title="Build the SAR Processor binary">
            <P>This is the core Rust engine. The release build enables all CPU-level optimizations (<code>opt-level = 3</code>, LLVM vectorization).</P>
            <CodeTab tabs={[{ name: 'Build', code: 'cd sar_processor\ncargo build --release\n\n# Verify the binary was produced\nls -lh target/release/sar_processor' }, { name: 'Run smoke test', code: '# Generate a 1024×1024 synthetic chirp target\ncargo run --release -- --synthetic --output /tmp/test.png\n\n# Expected output:\n# [INFO] Generating 1024x1024 synthetic point target\n# [INFO] Range compression complete (1024 pulses)\n# [INFO] Azimuth compression complete\n# {"event":"georef","bbox":{"south":0,"north":0,"west":0,"east":0}}\n# [INFO] Saved to /tmp/test.png' }]} />
            <Alert type="success" title="First build takes ~2–4 minutes">
                Cargo downloads and compiles all dependencies (<code>ndarray</code>, <code>rustfft</code>, <code>rayon</code>, <code>hdf5</code>, <code>image</code>). Subsequent incremental builds take under 5 seconds.
            </Alert>
        </Step>

        <Step n="3" title="Start the API Gateway">
            <P>The gateway is an Axum HTTP server that exposes REST endpoints and SSE log streaming. It auto-detects the processor binary at <code>../sar_processor/target/release/sar_processor</code>.</P>
            <CodeTab tabs={[{ name: 'Run', code: 'cd ../sar-gateway\nRUST_LOG=info cargo run --release\n\n# Listening on:\n# 🚀 SAR Gateway listening on 0.0.0.0:3000' }, { name: '.env (optional)', code: '# sar-gateway/.env\nLOCAL_MODE=true          # true = subprocess, false = K8s CRD\nRUST_LOG=info            # log verbosity\nPORT=3000                # default port' }]} />
        </Step>

        <Step n="4" title="Start the Dashboard">
            <P>The React dashboard connects to the gateway at <code>http://localhost:3000</code> by default.</P>
            <CodeTab tabs={[{ name: 'Run', code: 'cd ../sar-dashboard-v3\nnpm install\nnpm run dev\n\n# Vite dev server:\n# ➜ Local:   http://localhost:5173/' }, { name: '.env.local', code: 'VITE_API_BASE=http://localhost:3000' }]} />
        </Step>

        <Step n="5" title="Process your first scene">
            <P>Open <strong>localhost:5173</strong>, navigate to the <strong>Processor</strong> tab, click <strong>Run Synthetic Test</strong>. The gateway spawns the processor, streams <code>stdout</code> live via SSE, and the result PNG appears on the map.</P>
        </Step>

        <H2 id="verify">Verify Everything Is Working</H2>
        <P>Use these curl commands to confirm the gateway is healthy before opening the dashboard:</P>
        <CodeTab tabs={[{ name: 'Health check', code: '# Should return HTTP 200 with a JSON job list\ncurl http://localhost:3000/jobs' }, { name: 'Trigger synthetic job', code: 'curl -X POST http://localhost:3000/jobs \\\n  -H "Content-Type: application/json" \\\n  -d \'{"is_synthetic": true, "pipeline": "rda"}\'\n\n# Returns:\n# {"id":"sar-a1b2c3d4","status":"queued"}' }, { name: 'Stream logs (SSE)', code: '# Replace JOB_ID with the id from above\ncurl -N http://localhost:3000/jobs/JOB_ID/logs\n\n# You will see live lines from sar_processor stdout:\n# [INFO] Range compression complete\n# [INFO] Azimuth compression complete\n# [SYSTEM] PROCESS_COMPLETED' }]} />
    </div>
);

const PageInstallation = () => (
    <div>
        <Header
            title="Installation Guide"
            desc="Detailed setup for all four platform components: sar_processor, sar-gateway, sar_operator_v2, and sar-dashboard-v3."
        />

        <Alert type="note" title="Repository structure">
            All four components live inside a single monorepo root (<code>sar_analyzer/</code>). Each is an independent Rust crate or Node project and can be built/deployed separately.
        </Alert>

        <div style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '1.25rem 1.5rem', marginBottom: '2rem', fontFamily: '"JetBrains Mono", monospace', fontSize: '0.82rem', color: 'rgba(255,255,255,0.75)', lineHeight: 1.8 }}>
            <div style={{ color: '#00E5CC', marginBottom: '8px', fontWeight: 700 }}>sar_analyzer/</div>
            <div>├── <span style={{ color: '#fff' }}>sar_processor/</span>      <span style={{ color: 'rgba(255,255,255,0.4)' }}># Rust — core radar math engine (CLI binary)</span></div>
            <div>├── <span style={{ color: '#fff' }}>sar-gateway/</span>         <span style={{ color: 'rgba(255,255,255,0.4)' }}># Rust — Axum HTTP + SSE + job orchestration</span></div>
            <div>├── <span style={{ color: '#fff' }}>sar_operator_v2/</span>     <span style={{ color: 'rgba(255,255,255,0.4)' }}># Rust — Kubernetes custom controller (kube-rs)</span></div>
            <div>└── <span style={{ color: '#fff' }}>sar-dashboard-v3/</span>    <span style={{ color: 'rgba(255,255,255,0.4)' }}># React 18 + Vite — web UI</span></div>
        </div>

        <H2 id="component-1">1 — sar_processor</H2>
        <P><strong>What it is:</strong> A self-contained Rust CLI binary. It reads NISAR HDF5 or Sentinel-1 SAFE data, runs the processing pipeline, and writes a georeferenced PNG. It has no network dependencies — the gateway spawns it as a child process.</P>

        <H3 id="proc-deps">System dependencies</H3>
        <CodeTab tabs={[{ name: 'Ubuntu / Debian', code: 'sudo apt-get install -y \\\n    libhdf5-dev \\\n    pkg-config \\\n    build-essential' }, { name: 'macOS (Homebrew)', code: 'brew install hdf5 pkg-config' }, { name: 'Fedora / RHEL', code: 'sudo dnf install -y hdf5-devel pkgconfig gcc' }]} />

        <H3 id="proc-build">Build</H3>
        <CodeTab tabs={[{ name: 'Release build', code: 'cd sar_processor\ncargo build --release\n\n# Binary path:\n# target/release/sar_processor' }, { name: 'Debug build (faster compile)', code: 'cargo build\n# target/debug/sar_processor' }, { name: 'Verify', code: './target/release/sar_processor --help\n\n# Usage: sar_processor [OPTIONS]\n# Options:\n#   --input <FILE>         Input HDF5 / SAFE path\n#   --output <FILE>        Output PNG [default: focused_sar.png]\n#   --synthetic            Generate synthetic 1024x1024 target\n#   --ship-detect          Enable CA-CFAR ship detection\n#   --insar-slave <FILE>   Secondary image for interferometry\n#   --no-rcmc              Disable RCMC (faster, lower quality)' }]} />

        <H3 id="proc-docker">Docker build</H3>
        <P>The included Dockerfile uses a multi-stage build — a full Rust builder image compiles the binary, then only the binary is copied to a lean <code>debian:bookworm-slim</code> runtime.</P>
        <CodeTab tabs={[{ name: 'Build image', code: 'cd sar_processor\ndocker build -t localhost/sar-processor:latest .' }, { name: 'Run container', code: 'docker run --rm \\\n    -v /your/data:/data \\\n    localhost/sar-processor:latest \\\n    --input /data/scene.h5 \\\n    --output /data/out.png' }]} />

        <H2 id="component-2">2 — sar-gateway</H2>
        <P><strong>What it is:</strong> An Axum 0.7 HTTP server. It manages job state in an in-memory <code>HashMap</code> (protected by <code>tokio::sync::RwLock</code>), spawns the processor as a subprocess in Local Mode, and streams <code>stdout</code>/<code>stderr</code> to dashboard clients via Server-Sent Events.</P>

        <H3 id="gw-env">Environment variables</H3>
        <div style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', overflow: 'hidden', margin: '1.25rem 0' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                    <tr style={{ background: 'rgba(255,255,255,0.04)' }}>
                        <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Variable</th>
                        <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Default</th>
                        <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Description</th>
                    </tr>
                </thead>
                <tbody>
                    <EnvRow varName="LOCAL_MODE" defaultVal="true" desc="true = spawn sar_processor subprocess. false = submit SarJob CRD to Kubernetes." />
                    <EnvRow varName="RUST_LOG" defaultVal="info" desc="Log level for env_logger. Accepts error | warn | info | debug | trace." />
                    <EnvRow varName="PORT" defaultVal="3000" desc="HTTP port the Axum server binds to." />
                    <EnvRow varName="RESULTS_DIR" defaultVal="./results" desc="Directory where output PNGs are served from /results/:file." />
                </tbody>
            </table>
        </div>

        <CodeTab tabs={[{ name: 'Run (local)', code: 'cd sar-gateway\nLOCAL_MODE=true RUST_LOG=info cargo run --release' }, { name: 'Run (K8s mode)', code: '# Requires a running cluster with sar_operator_v2 deployed\nLOCAL_MODE=false RUST_LOG=info cargo run --release' }]} />

        <Alert type="note" title="Binary auto-detection">
            In Local Mode, the gateway searches for the processor binary in this order: <code>../sar_processor/target/release/sar_processor</code> → <code>../sar_processor/target/debug/sar_processor</code> → <code>./sar_processor</code> → <code>$PATH</code>.
        </Alert>

        <H2 id="component-3">3 — sar_operator_v2 (Kubernetes only)</H2>
        <P><strong>What it is:</strong> A Kubernetes custom controller built with <code>kube-rs 0.88</code>. It watches for <code>SarJob</code> custom resources and reconciles them into native <code>batch/v1 Job</code> objects, scheduling pods that run the processor Docker image.</P>

        <Alert type="warning" title="Requires a running Kubernetes cluster">
            Use <a href="https://kind.sigs.k8s.io" target="_blank" rel="noopener noreferrer" style={{ color: '#00E5CC' }}>Kind</a> for local development: <code>kind create cluster --name nisar</code>
        </Alert>

        <CodeTab tabs={[{ name: 'Install CRD', code: '# Apply the custom resource definition\nkubectl apply -f sar_operator_v2/k8s_manifests/crd.yaml\n\n# Verify:\nkubectl get crd sarjobs.sar.example.com' }, { name: 'Run operator', code: 'cd sar_operator_v2\ncargo run --release\n\n# [INFO] sar-operator-v2 started, watching SarJobs...' }, { name: 'Submit a test SarJob', code: 'kubectl apply -f - <<EOF\napiVersion: sar.example.com/v1\nkind: SarJob\nmetadata:\n  name: test-job-001\nspec:\n  scene_id: "synthetic_test"\n  output_storage_path: "/tmp/results/test-001.png"\n  processing_pipeline: "InSAR"\n  analysis_purpose: "Maritime Surveillance"\nEOF\n\n# Watch the operator create a K8s Job:\nkubectl get sarjobs -w' }]} />

        <H2 id="component-4">4 — sar-dashboard-v3</H2>
        <P><strong>What it is:</strong> A React 18 + Vite 5 single-page app. It talks to the gateway via REST and SSE. The map overlay uses Leaflet.js with XYZ tile support.</P>

        <CodeTab tabs={[{ name: 'Install & run', code: 'cd sar-dashboard-v3\nnpm install          # install all dependencies\nnpm run dev          # Vite dev server → http://localhost:5173\nnpm run build        # production bundle → dist/' }, { name: '.env.local', code: '# sar-dashboard-v3/.env.local\nVITE_API_BASE=http://localhost:3000\n\n# For K8s-in-cloud deployments:\n# VITE_API_BASE=https://api.your-cluster.example.com' }, { name: 'Lint & type-check', code: 'npm run lint\nnpm run preview      # serves the production build locally' }]} />

        <H2 id="running-all">Running the Full Stack</H2>
        <P>Open three terminal windows and run these commands in parallel:</P>
        <CodeTab tabs={[{ name: 'Terminal 1 — Gateway', code: 'cd sar-gateway && RUST_LOG=info cargo run --release' }, { name: 'Terminal 2 — Dashboard', code: 'cd sar-dashboard-v3 && npm run dev' }, { name: 'Terminal 3 — (Optional) Operator', code: 'cd sar_operator_v2 && cargo run --release' }]} />

        <Alert type="success" title="Stack is up">
            Dashboard → <strong>localhost:5173</strong> | Gateway API → <strong>localhost:3000</strong> | SSE logs → <strong>localhost:3000/jobs/:id/logs</strong>
        </Alert>

        <H2 id="troubleshooting">Common Issues</H2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '1rem' }}>
            {[
                { problem: 'cargo build fails: "libhdf5 not found"', fix: 'Run: sudo apt-get install libhdf5-dev pkg-config' },
                { problem: 'Gateway fails with "SPAWN_FAILED"', fix: 'Ensure sar_processor is built first: cd sar_processor && cargo build --release' },
                { problem: 'Dashboard shows no map tiles', fix: 'Check VITE_API_BASE matches the gateway port. CORS is enabled for all origins by default.' },
                { problem: 'K8s operator exits immediately', fix: 'A valid kubeconfig must be present at ~/.kube/config or KUBECONFIG env var must be set.' },
            ].map((item, i) => (
                <div key={i} style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '1rem 1.25rem' }}>
                    <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '0.82rem', color: '#f59e0b', marginBottom: '6px' }}>⚠ {item.problem}</div>
                    <div style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.75)' }}>→ {item.fix}</div>
                </div>
            ))}
        </div>
    </div>
);

const PageFirstJob = () => (
    <div>
        <Header title="Your First SAR Job" desc="A complete walkthrough — from finding a scene on the NASA ASF map to viewing the focused radar image on your browser." />

        <Alert type="note" title="Stack must be running">
            Before starting, make sure the gateway is running on <code>localhost:3000</code> and the dashboard on <code>localhost:5173</code>. See the <strong>Quick Start</strong> guide.
        </Alert>

        <H2 id="search">Step 1 — Global Scene Search</H2>
        <P>Open <strong>localhost:5173</strong> and look at the left panel. You will see a Leaflet map of the world.</P>
        <ul style={{ color: theme.textDef, lineHeight: 2, paddingLeft: '1.5rem', marginBottom: '1.25rem' }}>
            <li>Pan the map over your target country (e.g., Japan, Algeria, California coast).</li>
            <li>Enter a date range in the date picker fields.</li>
            <li>Click <strong style={{ color: theme.accent }}>"QUERY NASA ASF"</strong>.</li>
        </ul>
        <P>The dashboard sends a request to <code>GET /search/nisar</code> on the gateway. The gateway calls the NASA Alaska Satellite Facility (ASF) Earthdata API and returns a list of genuine NISAR acquisitions that intersect your map bounding box.</P>
        <CodeTab tabs={[{ name: 'What happens internally', code: '// Gateway forwards to NASA ASF DAAC:\n// GET https://cmr.earthdata.nasa.gov/search/granules.json\n//   ?short_name=NISAR_L1_RSLC\n//   &bounding_box={west},{south},{east},{north}\n//   &temporal={start},{end}\n//\n// Returns scene cards with:\n//   scene_id, acquisition_date, footprint_polygon' }]} />

        <H2 id="select">Step 2 — Scene Selection</H2>
        <P>After the query, a list of dataset cards appears in the left panel.</P>
        <ul style={{ color: theme.textDef, lineHeight: 2, paddingLeft: '1.5rem', marginBottom: '1.25rem' }}>
            <li>Scroll through the cards. <strong>Hovering</strong> over a card draws a glowing footprint polygon on the map.</li>
            <li>Click a card to <strong style={{ color: theme.accent }}>Lock</strong> it as the active scene.</li>
        </ul>

        <H2 id="process">Step 3 — Initiate Hot Processing</H2>
        <P>With a scene locked, configure the processing pipeline in the right panel:</P>
        <ul style={{ color: theme.textDef, lineHeight: 2, paddingLeft: '1.5rem', marginBottom: '1.25rem' }}>
            <li>Select ML mapping models (e.g., <strong>Ship Detection</strong> via CA-CFAR).</li>
            <li>Choose the pipeline: <code>rda</code>, <code>insar</code>, or <code>cfar</code>.</li>
            <li>Click <strong style={{ color: theme.accent }}>&quot;Initiate Orbital Scan&quot;</strong>.</li>
        </ul>
        <CodeTab tabs={[{ name: 'POST /jobs', code: 'curl -X POST http://localhost:3000/jobs \\\n  -H "Content-Type: application/json" \\\n  -d \'{"input_file": "NISAR_L1_PR_RSLC_...", "pipeline": "rda"}\'\n\n// Response: {"id": "sar-a1b2c3d4", "status": "queued"}' }]} />
        <Alert type="note" title="Local Mode vs K8s Mode">
            In <strong>Local Mode</strong> (<code>LOCAL_MODE=true</code>), the gateway spawns <code>sar_processor</code> as a child process. In <strong>K8s Mode</strong>, it creates a <code>SarJob</code> CRD.
        </Alert>

        <H2 id="telemetry">Step 4 — Live Telemetry &amp; Render</H2>
        <P>The Terminal drawer slides up and streams raw logs via SSE:</P>
        <CodeTab tabs={[{ name: 'SSE log stream', code: '# curl -N http://localhost:3000/jobs/sar-a1b2c3d4/logs\n\n[INFO] Range-Doppler Algorithm: focusing 1024 pulses\n[INFO] RCMC sinc interpolation: 8-point Hamming kernel\n[INFO] Rayon XYZ web tiling: zoom levels 7-14\n{"event":"georef","bbox":{"south":35.1,"north":36.2,"west":139.4,"east":140.8}}\n[SYSTEM] PROCESS_COMPLETED' }]} />
        <P>Once complete, the dashboard overlays XYZ tiles on the Leaflet map at the exact geographic coordinates.</P>
        <Alert type="success" title="Result on map">The focused SAR image appears as a semi-transparent overlay. You can zoom, toggle, and compare against satellite imagery.</Alert>
    </div>
);
// SECTION_1_END

// SECTION_2_START
const PageOverview = () => (
    <div>
        <Header title="Platform Overview" desc="NISARPro is an enterprise-grade distributed SAR processing platform for the NASA-ISRO NISAR mission — from raw Earthdata discovery to georeferenced browser map overlays." />

        <H2 id="what-it-does">What It Does</H2>
        <P>NISARPro provides a complete geospatial intelligence workflow: discovering raw NASA Earthdata, triggering on-demand processing (locally or via Kubernetes), and generating deep-zoom XYZ optical slippy maps rendered in the browser.</P>

        <H2 id="four-pillars">The Four Components</H2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '12px', margin: '1.5rem 0' }}>
            {[
                { name: 'sar_processor', lang: 'Rust', role: 'CLI binary — HDF5 ingest, RDA focusing, RCMC, Frost speckle, XYZ tiles', color: '#f97316' },
                { name: 'sar-gateway', lang: 'Rust / Axum', role: 'HTTP bridge — REST API, SSE log streaming, job lifecycle management', color: '#3b82f6' },
                { name: 'sar_operator_v2', lang: 'Rust / kube-rs', role: 'K8s controller — reconciles SarJob CRDs into scheduled batch pods', color: '#8b5cf6' },
                { name: 'sar-dashboard-v3', lang: 'React + Leaflet', role: 'Mission control UI — map search, scene locking, live telemetry terminal', color: '#00E5CC' },
            ].map(p => (
                <div key={p.name} style={{ background: theme.panel, border: `1px solid ${theme.border}`, borderRadius: '8px', padding: '1.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                        <code style={{ fontFamily: theme.mono, fontSize: '0.88rem', color: p.color, fontWeight: 700 }}>{p.name}</code>
                        <span style={{ fontSize: '0.72rem', background: 'rgba(255,255,255,0.06)', padding: '2px 8px', borderRadius: '4px', color: theme.textMuted }}>{p.lang}</span>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.875rem', color: theme.textMuted, lineHeight: 1.5 }}>{p.role}</p>
                </div>
            ))}
        </div>

        <H2 id="data-flow">End-to-End Data Flow</H2>
        <div style={{ background: theme.panel, border: `1px solid ${theme.border}`, borderRadius: '8px', padding: '1.5rem', fontFamily: theme.mono, fontSize: '0.82rem', lineHeight: 2.2, color: 'rgba(255,255,255,0.75)' }}>
            <div><span style={{ color: theme.accent }}>1</span> Browser → <code>GET /search/nisar</code> → Gateway queries <strong style={{ color: '#fff' }}>NASA ASF Earthdata</strong></div>
            <div><span style={{ color: theme.accent }}>2</span> User locks a scene → clicks "Initiate Orbital Scan"</div>
            <div><span style={{ color: theme.accent }}>3</span> Browser → <code>POST /jobs</code> → Gateway creates job entry</div>
            <div><span style={{ color: theme.accent }}>4a</span> <strong style={{ color: '#fff' }}>Local Mode:</strong> Gateway spawns <code>sar_processor</code> subprocess</div>
            <div><span style={{ color: theme.accent }}>4b</span> <strong style={{ color: '#fff' }}>K8s Mode:</strong> Gateway creates <code>SarJob</code> CRD → Operator schedules Pod</div>
            <div><span style={{ color: theme.accent }}>5</span> Processor streams logs → Gateway broadcasts via SSE</div>
            <div><span style={{ color: theme.accent }}>6</span> Browser receives <code style={{ color: '#f97316' }}>{'{"event":"georef","bbox":{...}}'}</code> event</div>
            <div><span style={{ color: theme.accent }}>7</span> Dashboard overlays XYZ tiles at geographic coordinates on Leaflet map</div>
        </div>

        <H2 id="tech-choices">Technology Choices</H2>
        <div style={{ background: theme.panel, border: `1px solid ${theme.border}`, borderRadius: '8px', overflow: 'hidden', margin: '1.25rem 0' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                    <tr style={{ background: 'rgba(255,255,255,0.04)' }}>
                        <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: '0.78rem', color: theme.textMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: `1px solid ${theme.border}` }}>Choice</th>
                        <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: '0.78rem', color: theme.textMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: `1px solid ${theme.border}` }}>Why</th>
                    </tr>
                </thead>
                <tbody>
                    {[
                        ['Rust + ndarray', 'Zero-cost abstractions for in-place operations on 7GB complex matrices. No GC pauses during FFT.'],
                        ['rayon par_bridge()', 'Parallelises range-line processing across all CPU cores with zero code change.'],
                        ['Axum SSE', 'Streams processor stdout to N browser clients without polling. Low latency, no WebSocket overhead.'],
                        ['kube-rs CRD', 'Native Kubernetes operator pattern — SarJobs are first-class cluster resources with finalizer cleanup.'],
                        ['Leaflet + XYZ tiles', 'Browser can stream deep-zoom tiles at zoom 7–14 without loading the full 1GB PNG.'],
                    ].map(([choice, why], i) => (
                        <tr key={i} style={{ borderBottom: `1px solid rgba(255,255,255,0.05)` }}>
                            <td style={{ padding: '10px 14px', fontFamily: theme.mono, fontSize: '0.82rem', color: theme.accent, whiteSpace: 'nowrap' }}>{choice}</td>
                            <td style={{ padding: '10px 14px', fontSize: '0.875rem', color: 'rgba(255,255,255,0.7)', lineHeight: 1.5 }}>{why}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    </div>
);

const PageProcessorDeepDive = () => (
    <div>
        <Header title="SAR Processor Internals" desc="How the Rust engine turns raw microwave echoes into images." />
        <H2 id="pipeline">The Pipeline</H2>
        <P>The processor uses the Range-Doppler Algorithm (RDA). See <code>src/main.rs</code>.</P>
        <CodeTab tabs={[{ name: 'main.rs', code: 'let mut proc = SARProcessor::new(\n    p.center_frequency,\n    p.sample_rate,\n    p.pulse_duration,\n    p.range_bandwidth,\n    p.prf,\n);\n\nlet focused = proc.process_rda(&raw_data);' }]} />
        <Alert type="note" title="Zero-Copy Processing">We use `ndarray::ArrayView` wherever possible to avoid cloning 16,000x16,000 complex matrices.</Alert>
    </div>
);

const PageGatewayJobs = () => (
    <div>
        <Header title="Gateway & Job System" desc="How the Axum gateway orchestrates jobs and streams live logs to the browser." />

        <H2 id="routes">API Routes</H2>
        <div style={{ background: theme.panel, border: `1px solid ${theme.border}`, borderRadius: '8px', overflow: 'hidden', margin: '1.25rem 0' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr style={{ background: 'rgba(255,255,255,0.04)' }}>
                    <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: '0.78rem', color: theme.textMuted, fontWeight: 600, textTransform: 'uppercase', borderBottom: `1px solid ${theme.border}` }}>Method</th>
                    <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: '0.78rem', color: theme.textMuted, fontWeight: 600, textTransform: 'uppercase', borderBottom: `1px solid ${theme.border}` }}>Path</th>
                    <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: '0.78rem', color: theme.textMuted, fontWeight: 600, textTransform: 'uppercase', borderBottom: `1px solid ${theme.border}` }}>Description</th>
                </tr></thead>
                <tbody>
                    {[['GET','/search','Query ESA Copernicus catalog'],['GET','/search/nisar','Query NASA ASF Earthdata for NISAR scenes'],['POST','/jobs','Spawn a new processing job'],['GET','/jobs/:id','Get job status + output path'],['GET','/jobs/:id/logs','SSE stream of processor stdout/stderr'],['GET','/results/*','Serve output PNG files']].map(([m,p,d],i)=>(
                        <tr key={i} style={{ borderBottom: `1px solid rgba(255,255,255,0.05)` }}>
                            <td style={{ padding: '10px 14px', fontFamily: theme.mono, fontSize: '0.82rem', color: theme.accent }}>{m}</td>
                            <td style={{ padding: '10px 14px', fontFamily: theme.mono, fontSize: '0.82rem', color: '#fff' }}>{p}</td>
                            <td style={{ padding: '10px 14px', fontSize: '0.87rem', color: theme.textMuted }}>{d}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>

        <H2 id="lifecycle">Job Lifecycle</H2>
        <div style={{ background: theme.panel, border: `1px solid ${theme.border}`, borderRadius: '8px', padding: '1.25rem', fontFamily: theme.mono, fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            {['Queued','→','Running','→','Completed','/ Failed'].map((s,i)=>(
                <span key={i} style={{ color: s.startsWith('→')||s.startsWith('/') ? theme.textMuted : s==='Completed' ? '#10b981' : s==='Failed' ? '#f87171' : theme.accent, fontWeight: s.startsWith('→')||s.startsWith('/') ? 400 : 600 }}>{s}</span>
            ))}
        </div>
        <P>Each job is stored as an <code>Arc{'<'}RwLock{'<'}JobMetadata{'>'}{'>'}</code> in a shared <code>HashMap</code>. The <code>broadcast::Sender{'<'}String{'>'}</code> inside each job fans out SSE lines to all connected browser clients.</P>

        <H2 id="sse">SSE Event Format</H2>
        <P>Every line written to <code>stdout</code> or <code>stderr</code> by the processor is broadcast. Special lines are parsed:</P>
        <CodeTab tabs={[{ name: 'Event types', code: '# Plain log lines (forwarded verbatim):\n[INFO] Range compression complete\n\n# Georef event (parsed, bbox extracted):\n{"event":"georef","bbox":{"south":35.1,"north":36.2}}\n\n# System signals:\n[SYSTEM] LOCAL_MODE: Spawning sar_processor (job=sar-a1b2c3)\n[SYSTEM] PROCESS_COMPLETED\n[SYSTEM] PROCESS_FAILED: exit code 101' }]} />

        <H2 id="local-vs-k8s">Local Mode vs Kubernetes Mode</H2>
        <P>Controlled by the <code>LOCAL_MODE</code> env var (defaults to <code>true</code>):</P>
        <CodeTab tabs={[{ name: 'Local Mode', code: 'LOCAL_MODE=true  # (default)\n# Gateway spawns sar_processor as a child process\n# Binary search order:\n#   ../sar_processor/target/release/sar_processor\n#   ../sar_processor/target/debug/sar_processor\n#   ./sar_processor\n#   sar_processor (from $PATH)' }, { name: 'K8s Mode', code: 'LOCAL_MODE=false\n# Gateway creates a SarJob custom resource:\n# kubectl get sarjobs\n# NAME           PHASE        MESSAGE\n# sar-a1b2c3    Processing   K8s Job sar-proc-a1b2c3 created.' }]} />
    </div>
);

const PageOperator = () => (
    <div>
        <Header title="Kubernetes Operator" desc="The kube-rs custom controller that reconciles SarJob CRDs into scheduled Pods." />

        <H2 id="crd">SarJob Custom Resource</H2>
        <P>The operator extends Kubernetes with a <code>SarJob</code> resource. Submit one to trigger distributed processing:</P>
        <CodeTab tabs={[{ name: 'SarJob YAML', code: 'apiVersion: sar.example.com/v1\nkind: SarJob\nmetadata:\n  name: nisar-japan-001\nspec:\n  scene_id: "NISAR_L1_PR_RSLC_010_165_D_..."\n  output_storage_path: "/tmp/results/japan-001.png"\n  processing_pipeline: "InSAR"\n  ml_models:\n    - "ShipDetection"' }, { name: 'Rust struct', code: '#[derive(CustomResource, Serialize, Deserialize, Clone, Debug, JsonSchema)]\n#[kube(group="sar.example.com", version="v1", kind="SarJob", namespaced)]\npub struct SarJobSpec {\n    pub scene_id: String,\n    pub output_storage_path: String,\n    pub processing_pipeline: Option<String>,\n    pub ml_models: Option<Vec<String>>,\n}' }]} />

        <H2 id="reconcile">Reconciliation Loop</H2>
        <P>The controller in <code>controller.rs</code> watches for <code>SarJob</code> events and transitions phases:</P>
        <CodeTab tabs={[{ name: 'Phase transitions', code: '// Pending → Processing: create batch/v1 Job\nmatch current_status.phase.as_str() {\n    "Pending" | "" => {\n        jobs_api.create(&PostParams::default(), &manifest).await?;\n        // Pod uses image: localhost/sar-processor:latest\n    }\n    "Processing" => { /* Poll until done */ }\n    "Completed" | "Failed" => Action::await_change(),\n}' }]} />

        <H2 id="deploy-operator">Deploying the Operator</H2>
        <CodeTab tabs={[{ name: 'Setup', code: '# 1. Create a local cluster\nkind create cluster --name sar-cluster\n\n# 2. Install the CRD\nkubectl apply -k k8s_manifests/\n\n# 3. Load the processor image\ndocker build -t localhost/sar-processor:latest ./sar_processor\nkind load docker-image localhost/sar-processor:latest --name sar-cluster\n\n# 4. Run the operator\ncd sar_operator_v2\nRUST_LOG=info cargo run --release\n\n# Watch SarJobs:\nkubectl get sarjobs -w' }]} />
    </div>
);
// SECTION_2_END

// SECTION_3_START
const PageRDA = () => (
    <div>
        <Header title="Range-Doppler Algorithm" desc="The core mathematical engine of the SAR processor." />
        <H2 id="range-comp">Range Compression</H2>
        <P>Uses overlap-save zero-padding to prevent circular convolution artifacts.</P>
        <KaTeXBlock math="H(f) = \text{conj}(\mathcal{F}\{h(t)\})" />
        <CodeTab tabs={[{ name: 'rda.rs', code: 'let fft_len = (n_rg + chirp_len - 1).next_power_of_two();\nlet mut h_freq = vec![Complex32::new(0.0, 0.0); fft_len];\n// ... compute conjugate FFT ...\nfft_proc.forward(&mut line);\nfor j in 0..fft_len { line[j] *= h_freq[j]; }\nfft_proc.inverse(&mut line);' }]} />
        <H2 id="az-comp">Azimuth Compression</H2>
        <P>Includes a Range-Dependent FM Rate for matched filtering.</P>
        <KaTeXBlock math="K_a = \frac{2v^2}{\lambda R_0}" />
        <CodeTab tabs={[{ name: 'rda.rs', code: 'let ka = 2.0 * velocity.powi(2) / (wavelength * slant_range);\nlet phase = std::f32::consts::PI * f_dop.powi(2) / ka;\ndop_line[dop_idx] *= Complex32::from_polar(1.0, phase);' }]} />
    </div>
);

const PageRCMC = () => (
    <div>
        <Header title="RCMC Engine" desc="Range Cell Migration Correction via Sinc Interpolation." />
        <H2 id="trajectory">Range Migration Trajectory</H2>
        <P>Compensates for the target walking across range cells.</P>
        <KaTeXBlock math="\Delta R(f_\eta) \approx R_0 \frac{(\lambda f_\eta)^2}{8v^2}" />
        <H2 id="sinc">Sinc Interpolation</H2>
        <P>We use an 8-point Hamming-windowed kernel to shift the complex signal by fractional pixels.</P>
        <CodeTab tabs={[{ name: 'rcmc.rs', code: 'let migration_meters = range_migration(doppler_freq, wavelength, velocity, slant_range);\nlet migration_samples = migration_meters / range_spacing;\nlet shifted_column = sinc_interpolate_shift(&range_column, -migration_samples);' }]} />
    </div>
);

const PageInSAR = () => (
    <div>
        <Header title="InSAR & Coherence" desc="Interferometric processing for infrastructure health." />
        <H2 id="ifgram">Interferogram Generation</H2>
        <P>Phase difference is calculated via complex conjugate multiplication of master and slave images.</P>
        <KaTeXBlock math="\phi = \text{arg}(M \cdot S^*)" />
        <CodeTab tabs={[{ name: 'insar.rs', code: 'Zip::from(&mut ifgram).and(master).and(slave).for_each(|out, &m, &s| {\n    *out = m * s.conj();\n});' }]} />
        <H2 id="ps-insar">Persistent Scatterers</H2>
        <P>We filter for coherence {">"} 0.85 and compute mm-level Line-of-Sight displacement.</P>
    </div>
);

const PagePolSAR = () => (
    <div>
        <Header title="PolSAR Decomposition" desc="Pauli basis mapping for quad-pol and dual-pol data." />
        <H2 id="pauli">Pauli Basis</H2>
        <P>Maps physical scattering mechanisms to RGB colors.</P>
        <ul>
            <li><strong>Red</strong>: Double-bounce |HH - VV| (urban)</li>
            <li><strong>Green</strong>: Volume |HV| (vegetation)</li>
            <li><strong>Blue</strong>: Surface |HH + VV| (water)</li>
        </ul>
        <CodeTab tabs={[{ name: 'polsar.rs', code: 'db_row[c] = (hh_val - vv_val).norm() * sqrt2_inv;\nvol_row[c] = hv_val.norm() * 2.0_f32.sqrt();\nsurf_row[c] = (hh_val + vv_val).norm() * sqrt2_inv;' }]} />
    </div>
);

const PageCFAR = () => (
    <div>
        <Header title="Ship Detection (CFAR)" desc="Constant False Alarm Rate with Integral Image Acceleration." />
        <H2 id="sat">Summed Area Table</H2>
        <P>O(1) rectangular sums prevent O(N^2) complexity blowup.</P>
        <CodeTab tabs={[{ name: 'ship_detection.rs', code: 'fn rect_sum(sat: &Array2<f64>, r0: usize, c0: usize, r1: usize, c1: usize) -> f64 {\n    sat[[r1 + 1, c1 + 1]] - sat[[r0, c1 + 1]] - sat[[r1 + 1, c0]] + sat[[r0, c0]]\n}' }]} />
        <H2 id="alpha">Alpha Threshold</H2>
        <P>Probability of false alarm is set to 1e-6.</P>
        <KaTeXBlock math="\alpha = N \cdot (P_{fa}^{-1/N} - 1)" />
    </div>
);
// SECTION_3_END

// SECTION_4_START
const PageNisarParser = () => (
    <div>
        <Header title="NISAR HDF5 Parser" desc="How the processor reads NASA HDF5 files across all four NISAR product types." />
        <H2 id="products">Supported Product Types</H2>
        <div style={{ background: theme.panel, border: `1px solid ${theme.border}`, borderRadius: '8px', overflow: 'hidden', margin: '1.25rem 0' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr style={{ background: 'rgba(255,255,255,0.04)' }}>
                    {['Product','Level','Size','Use case'].map(h => <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: '0.78rem', color: theme.textMuted, fontWeight: 600, textTransform: 'uppercase', borderBottom: `1px solid ${theme.border}` }}>{h}</th>)}
                </tr></thead>
                <tbody>
                    {[['RSLC','L1','~7.8 GB','Full RDA pipeline input'],['GSLC','L1','~3 GB','Geocoded SLC (pre-focused)'],['GCOV','L2','~1.1 GB','Polarimetric covariance (smaller, faster)'],['GUNW','L2','~200 MB','Interferometric displacement map']].map(([p,l,s,u],i)=>(
                        <tr key={i} style={{ borderBottom: `1px solid rgba(255,255,255,0.05)` }}>
                            <td style={{ padding: '10px 14px', fontFamily: theme.mono, fontSize: '0.82rem', color: theme.accent }}>{p}</td>
                            <td style={{ padding: '10px 14px', fontSize: '0.82rem', color: '#fff' }}>{l}</td>
                            <td style={{ padding: '10px 14px', fontFamily: theme.mono, fontSize: '0.82rem', color: theme.textMuted }}>{s}</td>
                            <td style={{ padding: '10px 14px', fontSize: '0.87rem', color: theme.textMuted }}>{u}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
        <H2 id="compound">Compound Datatype Parsing</H2>
        <P>NISAR stores complex SLC data as a compound HDF5 type: two consecutive <code>float32</code> values per pixel (real, imaginary). We read raw bytes directly — no C HDF5 library needed for the pixel data itself.</P>
        <CodeTab tabs={[{ name: 'nisar_parser.rs', code: '// Each complex pixel = 8 bytes: [re f32][im f32]\nlet re = f32::from_le_bytes([chunk[0], chunk[1], chunk[2], chunk[3]]);\nlet im = f32::from_le_bytes([chunk[4], chunk[5], chunk[6], chunk[7]]);\nComplex32::new(re, im)' }]} />
        <H2 id="autodetect">Auto-Detection Logic</H2>
        <P><code>parse_nisar_auto()</code> reads the filename to pick the correct parser branch:</P>
        <CodeTab tabs={[{ name: 'parse_nisar_auto()', code: '// Filename pattern matching:\nif path.contains("RSLC") { parse_rslc(file) }\nelse if path.contains("GSLC") { parse_gslc(file) }\nelse if path.contains("GCOV") { parse_gcov(file) }\nelse if path.contains("GUNW") { parse_gunw(file) }' }]} />
        <H2 id="wkt">Georeferencing (WKT → BBox)</H2>
        <P>The HDF5 metadata contains a WKT polygon string. We extract the bounding box and emit it as the <code>georef</code> SSE event.</P>
    </div>
);

const PageSafeParser = () => (
    <div>
        <Header title="Sentinel-1 SAFE Parser" desc="Reading ESA Copernicus Sentinel-1 SLC data from the SAFE directory format." />
        <H2 id="structure">SAFE Directory Structure</H2>
        <div style={{ background: theme.panel, border: `1px solid ${theme.border}`, borderRadius: '8px', padding: '1.25rem', fontFamily: theme.mono, fontSize: '0.82rem', lineHeight: 1.9, color: 'rgba(255,255,255,0.75)' }}>
            <div style={{ color: theme.accent, marginBottom: '6px' }}>S1A_IW_SLC__1SDV_20240115T....SAFE/</div>
            <div>├── <span style={{ color: '#fff' }}>manifest.safe</span>  <span style={{ color: 'rgba(255,255,255,0.4)' }}># XML: product metadata, orbit, timing</span></div>
            <div>├── <span style={{ color: '#fff' }}>measurement/</span>    <span style={{ color: 'rgba(255,255,255,0.4)' }}># Complex SLC TIFF files (one per swath/pol)</span></div>
            <div>│   ├── s1a-iw1-slc-vv-....tiff</div>
            <div>│   └── s1a-iw1-slc-vh-....tiff</div>
            <div>└── <span style={{ color: '#fff' }}>annotation/</span>     <span style={{ color: 'rgba(255,255,255,0.4)' }}># XML: calibration, noise, burst geometry</span></div>
        </div>
        <H2 id="tiff">I/Q Extraction from TIFF</H2>
        <P>Sentinel-1 stores complex data as interleaved int16 pairs (I then Q per pixel). We detect the layout (interleaved vs 2-band) and convert to <code>Complex32</code>:</P>
        <CodeTab tabs={[{ name: 'safe_parser.rs', code: '// Interleaved: [I0][Q0][I1][Q1]...\ndata.chunks(2)\n    .map(|chunk| (chunk[0], chunk.get(1).copied().unwrap_or(0)))\n    .collect();\n\n// Convert to ndarray:\nlet complex_vec: Vec<Complex32> = iq_data.iter()\n    .map(|(i, q)| Complex32::new(*i as f32, *q as f32))\n    .collect();' }]} />
    </div>
);

const PageImagePipeline = () => (
    <div>
        <Header title="Image Processing Pipeline" desc="Every stage from raw complex data to browser-ready XYZ map tiles." />
        <H2 id="pipeline-stages">Processing Stages</H2>
        <div style={{ background: theme.panel, border: `1px solid ${theme.border}`, borderRadius: '8px', padding: '1.5rem', fontFamily: theme.mono, fontSize: '0.82rem', lineHeight: 2.5 }}>
            {['Complex Array (16k×16k)','→  Magnitude  ( |I + jQ| )','→  Multilook  (range × azimuth averaging)','→  Lee Sigma filter  (7×7 window, statistical)','→  Frost filter  (5×5, edge-preserving)','→  Log scale  ( 10·log₁₀(x + ε) )','→  Percentile stretch  (p2 → p98 → [0,255])','→  CLAHE  (8×8 tiles, clip=3.0)','→  PNG export','→  XYZ tile generation  (zoom 7–14)'].map((s,i)=>(
                <div key={i} style={{ color: i===0 ? '#fff' : i===9 ? theme.accent : 'rgba(255,255,255,0.75)' }}>{s}</div>
            ))}
        </div>
        <H2 id="speckle">Speckle Filtering</H2>
        <P>SAR images suffer from multiplicative noise called <em>speckle</em>. We apply two passes: <strong>Lee Sigma</strong> (statistical filter, preserves radiometry) followed by <strong>Frost</strong> (exponential damping kernel, preserves edges).</P>
        <CodeTab tabs={[{ name: 'io.rs', code: 'let lee = lee_filter(&intensity, 7);      // 7x7 window\nlet frost = frost_filter(&lee, 5, 2.0);  // 5x5, damping=2.0\nlet clahe_px = clahe(&pixels, 8, 8, 3.0); // 8x8 tiles, clip 3.0\ngenerate_xyz_tiles(clahe_px, output_dir, max_zoom);' }]} />
        <H2 id="tiles">XYZ Tile Generation</H2>
        <P>The output PNG is sliced into a Web Mercator XYZ tile pyramid so the browser can load only the visible zoom region rather than the full 1 GB image. Tiles follow the standard <code>z/x/y.png</code> naming used by Leaflet and OpenLayers.</P>
    </div>
);

const PageDataDownload = () => (
    <div>
        <Header title="Data Download Guide" desc="Fetching real NISAR beta data from NASA Earthdata and Sentinel-1 from ESA Copernicus." />
        <H2 id="earthdata">NASA Earthdata Account</H2>
        <P>Register at <a href="https://urs.earthdata.nasa.gov" target="_blank" rel="noopener noreferrer" style={{ color: theme.accent }}>urs.earthdata.nasa.gov</a> (free). After registration, approve the <strong>Alaska Satellite Facility</strong> DAAC application in your profile to unlock NISAR download access.</P>
        <H2 id="netrc">.netrc Configuration</H2>
        <CodeTab tabs={[{ name: '~/.netrc', code: 'machine urs.earthdata.nasa.gov\n    login YOUR_USERNAME\n    password YOUR_PASSWORD' }, { name: 'Permissions', code: 'chmod 600 ~/.netrc  # required' }]} />
        <H2 id="download-script">Using download_nisar.sh</H2>
        <P>The script downloads two products — the smaller GCOV (1.1 GB) by default:</P>
        <CodeTab tabs={[{ name: 'Run', code: 'cd sar_processor\nbash download_nisar.sh\n\n# Downloads to ~/Desktop/nisar_data/\n# NISAR_L2_PR_GCOV_...h5  (1.1 GB)  -- for quick testing\n# NISAR_L1_PR_RSLC_...h5  (7.8 GB)  -- for full RDA pipeline' }]} />
        <Alert type="note" title="Use GCOV for quick testing">The L2 GCOV file is already geocoded. Feed it with <code>--input</code> and you will get a map-ready output in seconds.</Alert>
    </div>
);
// SECTION_4_END

// SECTION_5_START
const PageCLI = () => (
    <div>
        <Header title="CLI Reference" desc="Complete flag reference for the sar_processor binary." />
        <H2 id="flags">Flags</H2>
        <div style={{ background: theme.panel, border: `1px solid ${theme.border}`, borderRadius: '8px', overflow: 'hidden', margin: '1.25rem 0' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr style={{ background: 'rgba(255,255,255,0.04)' }}>
                    {['Flag','Type','Default','Description'].map(h=><th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: '0.78rem', color: theme.textMuted, fontWeight: 600, textTransform: 'uppercase', borderBottom: `1px solid ${theme.border}` }}>{h}</th>)}
                </tr></thead>
                <tbody>
                    {[
                        ['--input <FILE>','path','—','NISAR HDF5 or Sentinel-1 SAFE path'],
                        ['--output <FILE>','path','focused_sar.png','Output PNG file path'],
                        ['--synthetic','flag','false','Generate 1024×1024 point target (no input needed)'],
                        ['--ship-detect','flag','false','Run CA-CFAR and emit GeoJSON detections'],
                        ['--insar-slave <FILE>','path','—','Secondary image for interferogram computation'],
                        ['--no-rcmc','flag','false','Skip RCMC (faster, lower focus quality)'],
                        ['--pol <POL>','string','HH','Polarisation channel to process (HH/VV/HV/VH)'],
                    ].map(([f,t,d,desc],i)=>(
                        <tr key={i} style={{ borderBottom: `1px solid rgba(255,255,255,0.05)` }}>
                            <td style={{ padding: '10px 14px', fontFamily: theme.mono, fontSize: '0.8rem', color: theme.accent, whiteSpace: 'nowrap' }}>{f}</td>
                            <td style={{ padding: '10px 14px', fontFamily: theme.mono, fontSize: '0.78rem', color: theme.textMuted }}>{t}</td>
                            <td style={{ padding: '10px 14px', fontFamily: theme.mono, fontSize: '0.78rem', color: theme.textMuted }}>{d}</td>
                            <td style={{ padding: '10px 14px', fontSize: '0.87rem', color: 'rgba(255,255,255,0.75)' }}>{desc}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
        <H2 id="examples">Examples</H2>
        <CodeTab tabs={[
            { name: 'Synthetic test', code: 'cargo run --release -- --synthetic --output /tmp/test.png' },
            { name: 'NISAR GCOV', code: 'cargo run --release -- \\\n  --input ~/data/NISAR_L2_PR_GCOV_...h5 \\\n  --pol HH \\\n  --output ~/data/gcov_out.png' },
            { name: 'Ship detection', code: 'cargo run --release -- \\\n  --input ~/data/scene.h5 \\\n  --ship-detect \\\n  --output ~/data/ships.png' },
            { name: 'InSAR', code: 'cargo run --release -- \\\n  --input ~/data/master.h5 \\\n  --insar-slave ~/data/slave.h5 \\\n  --output ~/data/interferogram.png' },
        ]} />
    </div>
);

const PageAPI = () => (
    <div>
        <Header title="API Reference" desc="Full REST and SSE specification for the sar-gateway." />
        <H2 id="post-jobs">POST /jobs</H2>
        <P>Start a new processing job. Returns a job ID immediately; processing happens asynchronously.</P>
        <CodeTab tabs={[{ name: 'Request', code: 'POST http://localhost:3000/jobs\nContent-Type: application/json\n\n{\n  "input_file": "NISAR_L1_PR_RSLC_010_165_D_...h5",\n  "pipeline": "rda",\n  "is_synthetic": false\n}' }, { name: 'Response', code: '{\n  "id": "sar-a1b2c3d4",\n  "status": "queued"\n}' }]} />
        <H2 id="get-job">GET /jobs/:id</H2>
        <CodeTab tabs={[{ name: 'Response', code: '{\n  "id": "sar-a1b2c3d4",\n  "status": "completed",\n  "output_path": "/results/sar-a1b2c3d4.png",\n  "bbox": {\n    "south": 35.1, "north": 36.2,\n    "west": 139.4, "east": 140.8\n  }\n}' }]} />
        <H2 id="get-logs">GET /jobs/:id/logs (SSE)</H2>
        <P>Server-Sent Events stream. Connect with <code>EventSource</code> or <code>curl -N</code>.</P>
        <CodeTab tabs={[{ name: 'curl', code: 'curl -N http://localhost:3000/jobs/sar-a1b2c3d4/logs' }, { name: 'JS EventSource', code: 'const es = new EventSource(`http://localhost:3000/jobs/${jobId}/logs`);\nes.onmessage = e => console.log(e.data);' }]} />
    </div>
);

const PageTesting = () => (
    <div>
        <Header title="Testing Guide" desc="Running unit tests and integration smoke tests for the full stack." />
        <H2 id="unit">Unit Tests (sar_processor)</H2>
        <CodeTab tabs={[{ name: 'Run all tests', code: 'cd sar_processor\ncargo test\n\n# Tests include:\n# test rcmc::tests::test_sinc_identity_shift     ... ok\n# test rcmc::tests::test_hamming_kernel_norm     ... ok\n# test safe_parser::tests::test_parse_product_id ... ok' }]} />
        <H2 id="integration">Integration Smoke Test</H2>
        <P>Run the full gateway + processor stack, then verify via curl:</P>
        <CodeTab tabs={[{ name: 'Smoke test sequence', code: '# Terminal 1\ncd sar-gateway && LOCAL_MODE=true cargo run --release\n\n# Terminal 2 -- submit synthetic job\nJOB=$(curl -s -X POST http://localhost:3000/jobs \\\n  -H "Content-Type: application/json" \\\n  -d \'{"is_synthetic":true}\' | jq -r .id)\n\necho "Job ID: $JOB"\n\n# Stream logs until done\ncurl -N http://localhost:3000/jobs/$JOB/logs\n\n# Check result\ncurl http://localhost:3000/jobs/$JOB | jq' }]} />
    </div>
);

const PageDeployment = () => (
    <div>
        <Header title="Deployment Guide" desc="From local builds to a running Kind cluster with the full distributed stack." />
        <H2 id="docker">Build Docker Images</H2>
        <CodeTab tabs={[{ name: 'sar_processor', code: 'cd sar_processor\ndocker build -t localhost/sar-processor:latest .\n\n# Multi-stage build:\n# Stage 1 (builder): rust:1.80 -- compiles release binary\n# Stage 2 (runtime): debian:bookworm-slim -- ~50MB final image' }, { name: 'sar-gateway', code: 'cd sar-gateway\ndocker build -t localhost/sar-gateway:latest .' }]} />
        <H2 id="kind">Kind Cluster Setup</H2>
        <CodeTab tabs={[{ name: 'Full setup', code: '# Create cluster\nkind create cluster --name sar-cluster\n\n# Load images\nkind load docker-image localhost/sar-processor:latest --name sar-cluster\n\n# Apply CRD + operator RBAC\nkubectl apply -k k8s_manifests/\n\n# Run operator\ncd sar_operator_v2 && RUST_LOG=info cargo run --release\n\n# Run gateway in K8s mode\ncd sar-gateway && LOCAL_MODE=false RUST_LOG=info cargo run --release' }]} />
        <Alert type="note" title="NASA credentials for K8s mode">Set <code>NASA_USERNAME</code> and <code>NASA_PASSWORD</code> env vars on the gateway to enable the <code>/search/nisar</code> endpoint.</Alert>
    </div>
);
// SECTION_5_END

// SECTION_6_START
const PageCloudDeploy = () => (
    <div>
        <Header title="Cloud Frontend Deployment" desc="Deploy the NISARPro dashboard for free on Vercel or Netlify. Users run the backend on their own machines." />

        <H2 id="architecture">How It Works</H2>
        <P>The NISARPro dashboard is a static React app. It does not process SAR data itself. All processing happens on your local <code>sar-gateway</code> and <code>sar_processor</code> binaries. This means you can host the dashboard on any free static hosting provider and share the link with anyone.</P>
        <div style={{ background: theme.panel, border: `1px solid ${theme.border}`, borderRadius: '8px', padding: '1.5rem', fontFamily: theme.mono, fontSize: '0.82rem', lineHeight: 2.2, color: 'rgba(255,255,255,0.75)', margin: '1.5rem 0' }}>
            <div><span style={{ color: theme.accent }}>Cloud</span> &nbsp; Vercel / Netlify / GitHub Pages (free)</div>
            <div>&nbsp;&nbsp;&nbsp;&nbsp;└── sar-dashboard-v3 (static React bundle)</div>
            <div>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;↓ API calls over HTTP</div>
            <div><span style={{ color: theme.accent }}>Local</span> &nbsp; User's machine</div>
            <div>&nbsp;&nbsp;&nbsp;&nbsp;├── sar-gateway (localhost:3000)</div>
            <div>&nbsp;&nbsp;&nbsp;&nbsp;└── sar_processor (Rust binary)</div>
        </div>
        <Alert type="note" title="Browsers allow HTTPS → localhost">Modern browsers have a special carve-out in the mixed-content specification. An HTTPS page is allowed to fetch from <code>http://localhost</code>. No tunnels, proxies, or WASM needed.</Alert>

        <H2 id="deploy-vercel">Deploy to Vercel (Recommended)</H2>
        <CodeTab tabs={[{ name: 'Steps', code: '# 1. Push your code to GitHub\ngit push origin main\n\n# 2. Go to vercel.com -> New Project\n# 3. Import your GitHub repo\n# 4. Set build settings:\n#    Framework: Vite\n#    Root Directory: sar-dashboard-v3\n#    Build Command: npm run build\n#    Output Directory: dist\n\n# 5. Deploy! Your URL will be:\n#    https://your-project.vercel.app' }]} />
        <P>A <code>vercel.json</code> is already included in the project root. It has an SPA rewrite rule so all React Router paths (<code>/docs</code>, <code>/app</code>, etc.) resolve correctly.</P>

        <H2 id="deploy-netlify">Deploy to Netlify (Alternative)</H2>
        <CodeTab tabs={[{ name: 'Steps', code: '# 1. Go to netlify.com -> Add new site\n# 2. Connect your GitHub repo\n# 3. Set build settings:\n#    Base directory: sar-dashboard-v3\n#    Build command: npm run build\n#    Publish directory: sar-dashboard-v3/dist\n\n# 4. Add _redirects file for SPA:\necho "/*    /index.html    200" > public/_redirects' }]} />

        <H2 id="connection-flow">User Connection Flow</H2>
        <P>When someone opens your deployed dashboard and goes to <code>/app</code>, they see a <strong>Connection Setup</strong> screen. This guides them through:</P>
        <ul style={{ color: theme.textDef, lineHeight: 2, paddingLeft: '1.5rem', marginBottom: '1.25rem' }}>
            <li>Cloning and building the Rust backend on their machine</li>
            <li>Starting the gateway at <code>localhost:3000</code></li>
            <li>Clicking <strong style={{ color: theme.accent }}>Connect</strong> to verify the backend is reachable</li>
        </ul>
        <P>The gateway URL is stored in <code>localStorage</code>, so users only need to configure it once per browser.</P>

        <H2 id="cors">CORS Configuration</H2>
        <P>The gateway already allows all origins via <code>CorsLayer::new().allow_origin(Any)</code> in <code>main.rs</code>. No additional configuration is needed. If you want to restrict it to your deployed domain:</P>
        <CodeTab tabs={[{ name: 'main.rs', code: '// Current (allow all):\n.layer(CorsLayer::new().allow_origin(Any).allow_methods(Any).allow_headers(Any))\n\n// Restricted (your domain only):\nuse tower_http::cors::AllowOrigin;\n.layer(CorsLayer::new()\n    .allow_origin(AllowOrigin::list([\n        "https://nisarpro.vercel.app".parse().unwrap(),\n        "http://localhost:5173".parse().unwrap(),\n    ]))\n    .allow_methods(Any)\n    .allow_headers(Any))' }]} />

        <H2 id="share">Sharing With Others</H2>
        <P>Share your deployed URL with scientists. They need to:</P>
        <ul style={{ color: theme.textDef, lineHeight: 2, paddingLeft: '1.5rem', marginBottom: '1.25rem' }}>
            <li>Install <strong>Rust</strong> and <strong>libhdf5-dev</strong></li>
            <li>Clone the repo and build the processor + gateway</li>
            <li>Run <code>LOCAL_MODE=true cargo run --release</code> in the gateway folder</li>
            <li>Open your URL and click Connect</li>
        </ul>
        <Alert type="success" title="No data leaves the machine">All SAR data stays on the user's local disk. The cloud dashboard only sends API commands. No raw imagery is uploaded anywhere.</Alert>
    </div>
);

const PageNisarData = () => (
    <div>
        <Header title="Downloading NISAR Data" desc="Step-by-step guide to downloading real NASA NISAR HDF5 files to your local machine." />

        <Alert type="warning" title="ASF Catalog Search">The NASA ASF Catalog search in the dashboard requires a working <code>sar-gateway</code> backend and a valid Earthdata account. For reliable access, use the manual download method below.</Alert>

        <H2 id="earthdata-account">Step 1 — Create an Earthdata Account</H2>
        <P>Go to <a href="https://urs.earthdata.nasa.gov" target="_blank" rel="noopener noreferrer" style={{ color: theme.accent }}>urs.earthdata.nasa.gov</a> and register for a free account. After registration:</P>
        <ul style={{ color: theme.textDef, lineHeight: 2, paddingLeft: '1.5rem', marginBottom: '1.25rem' }}>
            <li>Log in to your Earthdata profile</li>
            <li>Go to <strong>Applications → Authorized Apps</strong></li>
            <li>Search for and approve <strong>Alaska Satellite Facility</strong></li>
        </ul>
        <P>This approval is required for downloading NISAR data from the ASF DAAC archive.</P>

        <H2 id="netrc-setup">Step 2 — Configure .netrc</H2>
        <P>The download tools use <code>~/.netrc</code> for authentication. Create it:</P>
        <CodeTab tabs={[{ name: 'Create .netrc', code: 'echo "machine urs.earthdata.nasa.gov" > ~/.netrc\necho "    login YOUR_USERNAME" >> ~/.netrc\necho "    password YOUR_PASSWORD" >> ~/.netrc\nchmod 600 ~/.netrc' }, { name: 'Verify', code: 'cat ~/.netrc\n# Should show:\n# machine urs.earthdata.nasa.gov\n#     login your_username\n#     password your_password\n\n# Permissions must be 600:\nls -la ~/.netrc\n# -rw------- 1 user user 95 Jan 20 12:00 .netrc' }]} />

        <H2 id="download-script">Step 3 — Use the Download Script</H2>
        <P>The project includes a ready-to-use download script at <code>sar_processor/download_nisar.sh</code>:</P>
        <CodeTab tabs={[{ name: 'Run', code: 'cd sar_processor\nbash download_nisar.sh\n\n# The script will:\n# 1. Check your .netrc credentials\n# 2. Download L2 GCOV (~1.1 GB) -- best for quick testing\n# 3. Optionally download L1 RSLC (~7.8 GB) -- for full RDA pipeline\n\n# Files are saved to: ~/Desktop/nisar_data/' }]} />

        <H2 id="manual-download">Alternative: Manual Download from ASF Vertex</H2>
        <P>If the script does not work or you want to browse all available products:</P>
        <ul style={{ color: theme.textDef, lineHeight: 2, paddingLeft: '1.5rem', marginBottom: '1.25rem' }}>
            <li>Go to <a href="https://search.asf.alaska.edu" target="_blank" rel="noopener noreferrer" style={{ color: theme.accent }}>search.asf.alaska.edu</a> (ASF Vertex)</li>
            <li>In the search bar, type <strong>NISAR</strong> and select the NISAR dataset</li>
            <li>Draw a bounding box on the map over your area of interest</li>
            <li>Set the date range and click Search</li>
            <li>Click on a result and choose <strong>Download</strong></li>
        </ul>

        <H2 id="product-types">Product Types Explained</H2>
        <div style={{ background: theme.panel, border: `1px solid ${theme.border}`, borderRadius: '8px', overflow: 'hidden', margin: '1.25rem 0' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr style={{ background: 'rgba(255,255,255,0.04)' }}>
                    {['Product','Size','Processing Required','Best For'].map(h => <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: '0.78rem', color: theme.textMuted, fontWeight: 600, textTransform: 'uppercase', borderBottom: `1px solid ${theme.border}` }}>{h}</th>)}
                </tr></thead>
                <tbody>
                    {[['GCOV (L2)','~1.1 GB','None (already geocoded)','Quick testing, PolSAR'],['GSLC (L1)','~3 GB','Minimal','Geocoded analysis'],['RSLC (L1)','~7.8 GB','Full RDA pipeline','Raw SAR processing'],['GUNW (L2)','~200 MB','None','InSAR displacement']].map(([p,s,r,b],i)=>(
                        <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                            <td style={{ padding: '10px 14px', fontFamily: theme.mono, fontSize: '0.82rem', color: theme.accent }}>{p}</td>
                            <td style={{ padding: '10px 14px', fontFamily: theme.mono, fontSize: '0.82rem', color: theme.textMuted }}>{s}</td>
                            <td style={{ padding: '10px 14px', fontSize: '0.87rem', color: '#fff' }}>{r}</td>
                            <td style={{ padding: '10px 14px', fontSize: '0.87rem', color: theme.textMuted }}>{b}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>

        <H2 id="file-placement">Step 4 — Where to Put Files</H2>
        <P>Place downloaded files anywhere on your machine. You will reference the full path when starting a job:</P>
        <CodeTab tabs={[{ name: 'Recommended layout', code: '~/Desktop/nisar_data/\n  ├── NISAR_L2_PR_GCOV_...h5    # Quick test (1.1 GB)\n  ├── NISAR_L1_PR_RSLC_...h5    # Full pipeline (7.8 GB)\n  └── NISAR_L2_PR_GUNW_...h5    # InSAR (200 MB)' }, { name: 'Process a file', code: '# Quick test with GCOV (no full RDA needed):\ncd sar_processor\ncargo run --release -- \\\n  --input ~/Desktop/nisar_data/NISAR_L2_PR_GCOV_*.h5 \\\n  --output ~/Desktop/gcov_result.png\n\n# Full RDA pipeline with RSLC:\ncargo run --release -- \\\n  --input ~/Desktop/nisar_data/NISAR_L1_PR_RSLC_*.h5 \\\n  --output ~/Desktop/rslc_result.png' }]} />

        <H2 id="dashboard-local">Step 5 — Use in Dashboard</H2>
        <P>In the NISARPro dashboard (<code>/app</code>), select <strong>Local File</strong> mode and paste the full path to your downloaded file:</P>
        <CodeTab tabs={[{ name: 'Example path', code: '/home/yourname/Desktop/nisar_data/NISAR_L2_PR_GCOV_010_165_D_100_2005_DHDH_M_20260120T155930_20260120T155950_X05010_N_P_J_001.h5' }]} />
        <P>The dashboard sends this path to the gateway, which passes it to <code>sar_processor</code>. The file never leaves your machine.</P>

        <Alert type="success" title="Start with GCOV">The L2 GCOV file is already geocoded and focused. It produces a map-ready image in seconds without running the full RDA pipeline. Perfect for verifying your setup works before downloading larger files.</Alert>
    </div>
);
// SECTION_6_END

// ============================================================================
// MAIN DOCS PAGE COMPONENT
// ============================================================================

export default function DocsPage() {
    const [activePage, setActivePage] = useState('quickstart');
    const [toc, setToc] = useState([]);

    const navStructure = [
        {
            title: "Getting Started",
            items: [
                { id: 'quickstart', label: 'Quick Start', component: PageQuickstart },
                { id: 'installation', label: 'Installation Guide', component: PageInstallation },
                { id: 'first_job', label: 'Your First SAR Job', component: PageFirstJob },
            ]
        },
        {
            title: "Architecture",
            items: [
                { id: 'overview', label: 'Platform Overview', component: PageOverview },
                { id: 'processor', label: 'SAR Processor Deep Dive', component: PageProcessorDeepDive },
                { id: 'gateway', label: 'Gateway & Job System', component: PageGatewayJobs },
                { id: 'operator', label: 'Kubernetes Operator', component: PageOperator },
            ]
        },
        {
            title: "Algorithms",
            items: [
                { id: 'rda', label: 'Range-Doppler Algorithm', component: PageRDA },
                { id: 'rcmc', label: 'RCMC Engine', component: PageRCMC },
                { id: 'insar', label: 'InSAR & Coherence', component: PageInSAR },
                { id: 'polsar', label: 'PolSAR Decomposition', component: PagePolSAR },
                { id: 'cfar', label: 'Ship Detection (CFAR)', component: PageCFAR },
            ]
        },
        {
            title: "Data & I/O",
            items: [
                { id: 'nisar', label: 'NISAR HDF5 Parser', component: PageNisarParser },
                { id: 'safe', label: 'Sentinel-1 SAFE Parser', component: PageSafeParser },
                { id: 'pipeline', label: 'Image Processing Pipeline', component: PageImagePipeline },
                { id: 'download', label: 'Data Download Guide', component: PageDataDownload },
            ]
        },
        {
            title: "Operations & Reference",
            items: [
                { id: 'cli', label: 'CLI Reference', component: PageCLI },
                { id: 'api', label: 'API Reference', component: PageAPI },
                { id: 'testing', label: 'Testing Guide', component: PageTesting },
                { id: 'deploy', label: 'Deployment Guide', component: PageDeployment },
                { id: 'cloud', label: 'Cloud Deployment', component: PageCloudDeploy },
            ]
        },
        {
            title: "Data Guides",
            items: [
                { id: 'nisar_data', label: 'Downloading NISAR Data', component: PageNisarData },
            ]
        }
    ];

    useEffect(() => {
        const updateToc = () => {
            const h2s = document.querySelectorAll('.doc-h2');
            const items = Array.from(h2s).map(el => ({
                id: el.id,
                text: el.innerText
            }));
            setToc(items);
        };
        setTimeout(updateToc, 50);

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        document.querySelectorAll('.toc-link').forEach(l => l.style.color = theme.textMuted);
                        const activeLink = document.querySelector(`.toc-link[href="#${entry.target.id}"]`);
                        if (activeLink) activeLink.style.color = theme.accent;
                    }
                });
            },
            { rootMargin: '-20% 0px -80% 0px' }
        );

        setTimeout(() => {
            document.querySelectorAll('.doc-h2').forEach(el => observer.observe(el));
        }, 100);

        return () => observer.disconnect();
    }, [activePage]);

    let ActiveComponent = PageQuickstart;
    for (const section of navStructure) {
        const found = section.items.find(item => item.id === activePage);
        if (found) ActiveComponent = found.component;
    }

    return (
        <div style={{ minHeight: '100vh', background: theme.bg, color: theme.textDef, fontFamily: theme.font, display: 'flex' }}>
            {/* Left Sidebar */}
            <nav style={{ width: '280px', flexShrink: 0, background: theme.panel, borderRight: `1px solid ${theme.border}`, height: '100vh', position: 'sticky', top: 0, overflowY: 'auto', padding: '1.5rem' }}>
                {/* Back link */}
                <a href="/" style={{ display: 'flex', alignItems: 'center', gap: '6px', color: theme.textMuted, textDecoration: 'none', fontSize: '0.8rem', marginBottom: '1.5rem', transition: 'color 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.color = theme.accent}
                    onMouseLeave={e => e.currentTarget.style.color = theme.textMuted}>
                    ← NISARPro
                </a>
                <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#fff', marginBottom: '2rem', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '8px', paddingBottom: '1rem', borderBottom: `1px solid ${theme.border}` }}>
                    <span style={{ color: theme.accent }}>//</span> Documentation
                </div>

                {navStructure.map((section, sidx) => (
                    <div key={sidx} style={{ marginBottom: '2rem' }}>
                        <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: theme.textMuted, fontWeight: 600, marginBottom: '0.75rem', paddingLeft: '8px' }}>
                            {section.title}
                        </div>
                        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                            {section.items.map(item => (
                                <li key={item.id} style={{ marginBottom: '4px' }}>
                                    <button
                                        onClick={() => { setActivePage(item.id); window.scrollTo(0, 0); }}
                                        style={{ width: '100%', textAlign: 'left', background: activePage === item.id ? 'rgba(0, 229, 204, 0.1)' : 'transparent', border: 'none', color: activePage === item.id ? theme.accent : theme.textDef, padding: '8px 12px', borderRadius: '6px', fontSize: '0.9rem', fontWeight: activePage === item.id ? 600 : 400, cursor: 'pointer', transition: 'all 0.15s' }}>
                                        {item.label}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}
            </nav>

            {/* Main Content */}
            <main style={{ flexGrow: 1, minWidth: 0, display: 'flex', justifyContent: 'center' }}>
                <div style={{ width: '100%', maxWidth: '860px', padding: '3rem 3rem 6rem' }}>
                    <ActiveComponent />
                </div>
            </main>

            {/* Right TOC */}
            <aside style={{ width: '220px', flexShrink: 0, height: '100vh', position: 'sticky', top: 0, padding: '3rem 1.5rem 2rem 0', overflowY: 'auto' }}>
                {toc.length > 0 && (
                    <>
                        <div style={{ fontSize: '0.72rem', fontWeight: 600, color: theme.textMuted, marginBottom: '1rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                            On this page
                        </div>
                        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                            {toc.map(item => (
                                <li key={item.id} style={{ marginBottom: '0.6rem' }}>
                                    <a href={`#${item.id}`} className="toc-link"
                                        style={{ color: theme.textMuted, textDecoration: 'none', fontSize: '0.82rem', transition: 'color 0.15s', display: 'block', lineHeight: 1.4 }}>
                                        {item.text}
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </>
                )}
            </aside>
        </div>
    );
}