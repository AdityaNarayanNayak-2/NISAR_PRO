# NISAR Pro - single-click local launcher (Windows)
# Starts the SAR Gateway (backend, :3000) and the Vite dashboard (frontend, :5173),
# waits until both respond, then opens the browser.
param([string]$NpmPath = '', [int]$WaitSeconds = 180)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$logDir = Join-Path $root 'logs'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

function Test-Port([int]$Port) {
    $conn = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object { $_.LocalPort -eq $Port }
    if ($conn) { return $true }
    $client = New-Object System.Net.Sockets.TcpClient
    try {
        $iar = $client.BeginConnect('localhost', $Port, $null, $null)
        if ($iar.AsyncWaitHandle.WaitOne(700)) { $client.EndConnect($iar); return $true }
    } catch { } finally { $client.Dispose() }
    return $false
}

function Find-Npm {
    if ($NpmPath -and (Test-Path $NpmPath)) { return $NpmPath }
    $c = Get-Command npm.cmd -ErrorAction SilentlyContinue
    if ($c) { return $c.Source }
    $c = Get-Command npm -ErrorAction SilentlyContinue
    if ($c) { return $c.Source }
    $candidates = @(
        'C:\Program Files\nodejs\npm.cmd',
        'C:\Program Files (x86)\nodejs\npm.cmd',
        "$env:LOCALAPPDATA\Programs\nodejs\npm.cmd",
        "$env:APPDATA\npm\npm.cmd",
        "$env:USERPROFILE\scoop\apps\nodejs\current\npm.cmd"
    )
    foreach ($cand in $candidates) {
        $res = Get-Item $cand -ErrorAction SilentlyContinue
        if ($res) { return $res.FullName }
    }
    $wg = Get-ChildItem "$env:LOCALAPPDATA\Microsoft\WinGet\Packages\*\*\npm.cmd" -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($wg) { return $wg.FullName }
    return $null
}

Write-Host "NISAR Pro local launcher - dashboard served by Rust gateway"
Write-Host "  app  -> http://localhost:3000   (SAR Gateway + dashboard)"
Write-Host "  api  -> http://localhost:3000/jobs/health-ping"
Write-Host ""

# --- Rust compute engine (build once if release binary missing) ---
$engine = Join-Path $root 'sar_science_processor\target\release\sar_science_processor.exe'
if (-not (Test-Path $engine)) {
    Write-Host '[setup] Building compute engine (first run)...'
    Push-Location (Join-Path $root 'sar_science_processor')
    & cargo build --release
    if ($LASTEXITCODE -ne 0) { Write-Host '[ERROR] Engine build failed.'; exit 1 }
    Pop-Location
}

$env:LOCAL_MODE = 'true'
$env:RUST_LOG   = 'info'

# --- Backend: SAR Gateway on :3000 ---
if (Test-Port 3000) {
    Write-Host '[api]  SAR Gateway already running on :3000 (skipping)'
} else {
    $cargo = (Get-Command cargo -ErrorAction SilentlyContinue).Source
    if (-not $cargo) {
        Write-Host '[ERROR] Rust (cargo) not found on PATH. Install from https://rustup.rs and re-run.'
        exit 1
    }
    Write-Host '[api]  Starting SAR Gateway on :3000 ...'
    Start-Process -FilePath $cargo -ArgumentList 'run' `
        -WorkingDirectory (Join-Path $root 'sar-gateway') `
        -RedirectStandardOutput (Join-Path $logDir 'gateway.log') `
        -RedirectStandardError  (Join-Path $logDir 'gateway.err.log') `
        -WindowStyle Hidden
}

# --- Frontend served by Rust gateway (preferred) or Vite dev server (fallback) ---
$distIndex = Join-Path $root 'sar-dashboard-v3\dist\index.html'
$rustServed = Test-Path $distIndex
if ($rustServed) {
    Write-Host '[web]  Dashboard served by Rust gateway (no Node needed)'
    $webPort = 3000
} else {
    Write-Host '[web]  Built dashboard not found - falling back to Vite'
    $webPort = 5173
    if (-not (Test-Port 5173)) {
        $npm = Find-Npm
        if ($npm) {
            Write-Host '[web]  Starting dashboard on :5173 ...'
            Start-Process -FilePath $npm -ArgumentList 'run','dev' `
                -WorkingDirectory (Join-Path $root 'sar-dashboard-v3') `
                -RedirectStandardOutput (Join-Path $logDir 'vite.log') `
                -RedirectStandardError  (Join-Path $logDir 'vite.err.log') `
                -WindowStyle Hidden
        } else {
            Write-Host '[web]  Node.js not found and no built dashboard - run npm run build once (or install Node LTS).'
            Write-Host ''
        }
    }
}

# --- Wait for services, then open the browser ---
Write-Host "[wait] Checking api:3000 + web:$webPort (up to $WaitSeconds sec)..."
$deadline = (Get-Date).AddSeconds($WaitSeconds)
$ok = $false
while ((Get-Date) -lt $deadline) {
    $apiUp = Test-Port 3000
    $webUp = Test-Port $webPort
    if ($apiUp -and $webUp) { $ok = $true; break }
    if (-not $apiUp) { Write-Host '  api :3000 ... waiting' }
    if (-not $webUp) { Write-Host "  web :$webPort ... waiting" }
    Start-Sleep -Seconds 3
}

if ($ok) {
    Write-Host '[ok]   Services are up. Opening dashboard...'
    Start-Process "http://localhost:$webPort/"
    Write-Host ''
    Write-Host 'The whole app runs on Rust (gateway + dashboard). To stop:'
    Write-Host "  netstat -ano | findstr ':3000'   ->  taskkill /PID <pid> /F"
    Write-Host "Logs: $logDir"
    exit 0
} else {
    Write-Host '[ERROR] Timed out waiting for services. Check logs:'
    Write-Host "  $logDir\gateway.log / gateway.err.log"
    Write-Host "  $logDir\vite.log / vite.err.log"
    exit 1
}