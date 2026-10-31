param(
    [string]$Repository = (Split-Path -Parent $PSScriptRoot),
    [switch]$AllowPendingEvidence
)

$ErrorActionPreference = 'Stop'
$package = Join-Path $Repository 'ingarss_2026'
$failures = [System.Collections.Generic.List[string]]::new()

function Require-File([string]$relative) {
    if (-not (Test-Path -LiteralPath (Join-Path $Repository $relative) -PathType Leaf)) {
        $failures.Add("missing file: $relative")
    }
}

@(
    'ingarss_2026/README.md',
    'ingarss_2026/TECHNICAL_NOTE.md',
    'ingarss_2026/presentation.html',
    'ingarss_2026/notebooks/NISAR_Bihar_Flood_Lifecycle.ipynb',
    'ingarss_2026/VALIDATION_WORKFLOW.md',
    'ingarss_2026/sar-bihar-ls-fused-aug31-sep12_flood.json'
) | ForEach-Object { Require-File $_ }

$notebook = Join-Path $package 'notebooks/NISAR_Bihar_Flood_Lifecycle.ipynb'
if (Test-Path -LiteralPath $notebook) {
    try {
        $nb = Get-Content -LiteralPath $notebook -Raw | ConvertFrom-Json
        if (-not $nb.cells -or $nb.cells.Count -lt 6) {
            $failures.Add('notebook has fewer than six cells')
        }
    } catch {
        $failures.Add("notebook JSON is invalid: $($_.Exception.Message)")
    }
}

$validation = Join-Path $package 'results/validation'
$provenance = Join-Path $package 'results/rhel_provenance_final.txt'
if (-not $AllowPendingEvidence) {
    if (-not (Test-Path -LiteralPath $provenance -PathType Leaf)) {
        $failures.Add('missing final RHEL provenance: ingarss_2026/results/rhel_provenance_final.txt')
    }
    $metrics = if (Test-Path -LiteralPath $validation) {
        @(Get-ChildItem -LiteralPath $validation -Filter '*_metrics.json' -File)
    } else { @() }
    if ($metrics.Count -lt 1) {
        $failures.Add('no independent validation metrics found in ingarss_2026/results/validation')
    }
}

if ($failures.Count -gt 0) {
    Write-Host 'InGARSS submission verification: BLOCKED' -ForegroundColor Red
    $failures | ForEach-Object { Write-Host "- $_" -ForegroundColor Yellow }
    exit 1
}

Write-Host 'InGARSS submission verification: PASS' -ForegroundColor Green
Write-Host "Package: $package"
