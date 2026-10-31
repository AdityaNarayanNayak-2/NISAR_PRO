param(
    [string]$OutputRoot = "$(Join-Path (Split-Path -Parent $PSScriptRoot) 'dist')"
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$packageRoot = Join-Path $repoRoot 'ingarss_2026'
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$stage = Join-Path $OutputRoot "ingarss_2026_phase1_$stamp"
$zip = "$stage.zip"

New-Item -ItemType Directory -Path $stage -Force | Out-Null

$topLevelFiles = @(
    'README.md',
    'TECHNICAL_NOTE.md',
    'PRESENTATION_OUTLINE.md',
    'presentation.html',
    'COLAB_GUIDE.md',
    'VALIDATION_WORKFLOW.md',
    'SUBMISSION_CHECKLIST.md',
    'EVIDENCE_AND_GAPS.md',
    'NISAR_Bihar_Flood_Lifecycle.ipynb',
    'sar-bihar-ls-fused-aug31-sep12_flood.json'
)

foreach ($name in $topLevelFiles) {
    $source = Join-Path $packageRoot $name
    if (Test-Path -LiteralPath $source) {
        Copy-Item -LiteralPath $source -Destination (Join-Path $stage $name) -Force
    } else {
        Write-Warning "Missing expected package file: $name"
    }
}

foreach ($directory in @('notebook_cells', 'scripts', 'results')) {
    $source = Join-Path $packageRoot $directory
    if (Test-Path -LiteralPath $source) {
        Copy-Item -LiteralPath $source -Destination (Join-Path $stage $directory) -Recurse -Force
    }
}

$manifest = Join-Path $stage 'PACKAGE_MANIFEST.txt'
@(
    "Created: $(Get-Date -Format o)",
    "Repository: $(git -C $repoRoot rev-parse --show-toplevel)",
    "Commit: $(git -C $repoRoot rev-parse HEAD)",
    "Included package: $packageRoot",
    "Source HDF5 granules are intentionally excluded; see COLAB_GUIDE.md and README.md."
) | Set-Content -LiteralPath $manifest -Encoding UTF8

Get-ChildItem -LiteralPath $stage -Recurse -File |
    Get-FileHash -Algorithm SHA256 |
    ForEach-Object { "$($_.Hash)  $($_.Path.Substring($stage.Length + 1))" } |
    Set-Content -LiteralPath (Join-Path $stage 'SHA256SUMS.txt') -Encoding UTF8

Compress-Archive -LiteralPath $stage -DestinationPath $zip -CompressionLevel Optimal -Force
Write-Output "Submission directory: $stage"
Write-Output "Submission archive:  $zip"
Get-FileHash -Algorithm SHA256 -LiteralPath $zip
