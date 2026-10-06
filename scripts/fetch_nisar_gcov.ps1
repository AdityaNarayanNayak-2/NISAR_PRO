param(
  [string[]]$Scene,
  [string]$Preset = 'assam-peak',
  [string]$OutDir = 'D:\nisar\nisar_pro\Download\gcov',
  [switch]$ProbeOnly,
  [switch]$Companions,
  [long]$MinBytes = 500MB
)

$ErrorActionPreference = 'Stop'
$Collection = 'NISAR_L2_GCOV_PROVISIONAL_V1'
$Base = "https://nisar.asf.earthdatacloud.nasa.gov/NISAR/$Collection"
$EnvFile = 'D:\nisar\nisar_pro\sar-gateway\.env'

$Presets = @{
  'assam-peak'  = @(
    'NISAR_L2_PR_GCOV_025_062_D_075_2005_QPDH_A_20260712T121710_20260712T121745_P05023_N_F_J_001',
    'NISAR_L2_PR_GCOV_028_062_D_075_4005_DHDH_A_20260817T121708_20260817T121743_P05023_N_F_J_001'
  )
  'assam-3date' = @(
    'NISAR_L2_PR_GCOV_025_062_D_075_2005_QPDH_A_20260712T121710_20260712T121745_P05023_N_F_J_001',
    'NISAR_L2_PR_GCOV_026_062_D_075_4005_DHDH_A_20260724T121709_20260724T121744_P05023_N_F_J_001',
    'NISAR_L2_PR_GCOV_028_062_D_075_4005_DHDH_A_20260817T121708_20260817T121743_P05023_N_F_J_001'
  )
  'assam-asc'   = @(
    'NISAR_L2_PR_GCOV_025_040_A_015_4005_DHDH_A_20260710T230529_20260710T230603_P05023_N_F_J_001',
    'NISAR_L2_PR_GCOV_028_040_A_015_4005_DHDH_A_20260815T230527_20260815T230601_P05023_N_F_J_001'
  )
  'assam-active'   = @(
    'NISAR_L2_PR_GCOV_028_062_D_075_4005_DHDH_A_20260817T121708_20260817T121743_P05023_N_F_J_001'
  )
  'assam-baseline' = @(
    'NISAR_L2_PR_GCOV_025_062_D_075_2005_QPDH_A_20260712T121710_20260712T121745_P05023_N_F_J_001'
  )
  'assam-look'     = @(
    'NISAR_L2_PR_GCOV_025_062_D_075_2005_QPDH_A_20260712T121710_20260712T121745_P05023_N_F_J_001',
    'NISAR_L2_PR_GCOV_026_062_D_075_4005_DHDH_A_20260724T121709_20260724T121744_P05023_N_F_J_001',
    'NISAR_L2_PR_GCOV_028_062_D_075_4005_DHDH_A_20260817T121708_20260817T121743_P05023_N_F_J_001',
    'NISAR_L2_PR_GCOV_029_062_D_075_2005_QPDH_A_20260829T121708_20260829T121743_P05023_N_F_J_001'
  )
}

if (-not $Scene) {
  if (-not $Presets.ContainsKey($Preset)) {
    Write-Output "Unknown preset '$Preset'. Known: $($Presets.Keys -join ', ')"
    exit 2
  }
  $Scene = $Presets[$Preset]
}

function Import-GatewayEnv {
  if (-not (Test-Path $EnvFile)) { return }
  foreach ($line in Get-Content $EnvFile) {
    if ($line -match '^\s*#' -or $line -notmatch '=') { continue }
    $k, $v = $line -split '=', 2
    $k = $k.Trim(); $v = $v.Trim().Trim('"').Trim("'")
    if ($k -and -not [Environment]::GetEnvironmentVariable($k)) {
      [Environment]::SetEnvironmentVariable($k, $v)
    }
  }
}

function Get-AuthArgs {
  Import-GatewayEnv
  $token = $env:EARTHDATA_TOKEN
  if (-not $token) { $token = $env:ASF_TOKEN }
  if ($token) { return @{ Mode = 'token'; Args = @('-H', "Authorization: Bearer $token") } }

  $u = $env:EARTHDATA_USERNAME; if (-not $u) { $u = $env:ASF_USERNAME }
  $p = $env:EARTHDATA_PASSWORD; if (-not $p) { $p = $env:ASF_PASSWORD }
  if ($u -and $p) { return @{ Mode = 'basic'; Args = @('-u', "${u}:${p}") } }

  foreach ($n in @("$env:USERPROFILE\_netrc", "$env:USERPROFILE\.netrc")) {
    if (Test-Path $n) { return @{ Mode = 'netrc'; Args = @('--netrc') } }
  }
  return $null
}

$authInfo = Get-AuthArgs
if (-not $authInfo) {
  Write-Output 'ERROR: no Earthdata credentials found.'
  Write-Output "Add EARTHDATA_USERNAME and EARTHDATA_PASSWORD to $EnvFile"
  Write-Output 'or EARTHDATA_TOKEN, or create %USERPROFILE%\_netrc with:'
  Write-Output '  machine urs.earthdata.nasa.gov login <user> password <pass>'
  exit 3
}
$auth = $authInfo.Args

if ($authInfo.Mode -ne 'token') {
  $urs = & curl.exe -sS -u "$($env:EARTHDATA_USERNAME):$($env:EARTHDATA_PASSWORD)" -o NUL -w '%{http_code}' 'https://urs.earthdata.nasa.gov/api/users'
  if ($urs -ne '200') {
    Write-Output "ERROR: NASA URS rejected these credentials (HTTP $urs)."
    Write-Output 'Earthdata Login no longer accepts HTTP Basic auth for programmatic use,'
    Write-Output 'so a username/password pair cannot download granules even when it works in a browser.'
    Write-Output 'Use an Application Token instead:'
    Write-Output '  1. Log in at https://urs.earthdata.nasa.gov in a browser'
    Write-Output '  2. Profile -> Application Tokens -> Generate Token'
    Write-Output "  3. Put EARTHDATA_TOKEN=<token> in $EnvFile"
    exit 4
  }
  Write-Output 'URS credential check: OK'
} else {
  Write-Output 'Using EDL token auth (validated by the per-granule data-host probe below)'
}

if (-not $ProbeOnly) { New-Item -ItemType Directory -Force -Path $OutDir | Out-Null }

$failed = @()

if ($Companions) {
  $companionFiles = @('_LATLON.png', '_NATIVE_A_HHHH.png', '_NATIVE.kml', '_QA_SUMMARY.csv', '.h5.iso.xml')
  New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
  foreach ($s in $Scene) {
    foreach ($c in $companionFiles) {
      $name = "${s}$c"
      $cdest = Join-Path $OutDir $name
      if ((Test-Path $cdest) -and ((Get-Item $cdest).Length -gt 0)) { continue }
      $curlStatus = & curl.exe -sS -L --fail -o $cdest @auth "$Base/$s/$name"
      if ($LASTEXITCODE -eq 0) {
        Write-Output ("  companion {0}  ({1:N0} KB)" -f $name, ((Get-Item $cdest).Length / 1KB))
      } else {
        Write-Output ("  companion MISSING  {0}" -f $name)
        if (Test-Path $cdest) { Remove-Item $cdest -Force }
      }
    }
  }
  Write-Output ''
}
foreach ($s in $Scene) {
  $url = "$Base/$s/$s.h5"
  $dest = Join-Path $OutDir "$s.h5"

  if ((Test-Path $dest) -and ((Get-Item $dest).Length -ge $MinBytes)) {
    Write-Output ("SKIP  {0}  ({1:N2} GB already on disk)" -f $s, ((Get-Item $dest).Length / 1GB))
    continue
  }

  $code = (& curl.exe -sSL -o NUL -r 0-1023 -w '%{http_code}' @auth $url)
  if ($code -notin @('200', '206')) {
    Write-Output ("AUTH/HTTP FAIL  {0}  -> {1}" -f $s, $code)
    if ($code -eq '401') {
      Write-Output '  Earthdata login required. See the token steps above.'
    }
    $failed += $s
    continue
  }

  $expected = (& curl.exe -sSI @auth $url | Select-String -Pattern '^\s*[Cc]ontent-[Ll]ength:\s*(\d+)' | Select-Object -First 1)
  if ($expected) { $expLen = [long]$expected.Matches[0].Groups[1].Value } else { $expLen = 0 }

  if ($ProbeOnly) {
    $size = if ($expLen) { "{0:N2} GB" -f ($expLen / 1GB) } else { 'unknown' }
    Write-Output ("PROBE OK  {0}  -> auth works, size {1}" -f $s, $size)
    continue
  }

  Write-Output ("DOWNLOAD  {0}  ({1})" -f $s, $(if ($expLen) { "{0:N2} GB" -f ($expLen / 1GB) } else { 'size unknown' }))
  & curl.exe -L -C - --retry 3 --retry-delay 5 --fail --progress-bar -o $dest @auth $url
  if ($LASTEXITCODE -ne 0) { $failed += $s; continue }

  $len = (Get-Item $dest).Length
  if ($len -lt $MinBytes) {
    Write-Output ("TRUNCATED  {0}  ({1:N0} bytes)" -f $s, $len)
    $failed += $s
  } else {
    Write-Output ("DONE  {0}  {1:N2} GB" -f $s, ($len / 1GB))
  }
}

if ($failed.Count) {
  Write-Output ''
  Write-Output "Failed: $($failed.Count) of $($Scene.Count)"
  $failed | ForEach-Object { Write-Output "  $_" }
  exit 1
}
Write-Output ''
Write-Output "All $($Scene.Count) granule(s) ready in $OutDir"
