# Build UAC lab marker with C:\msys64 MinGW-w64 (run from technique poc_tests folder)
$ErrorActionPreference = 'Stop'
$here = $PSScriptRoot
. (Join-Path (Split-Path (Split-Path (Split-Path $here -Parent) -Parent) -Parent) 'uac_msys64.ps1')

if (-not (Test-UacMsys64)) { exit 1 }
$exe = Build-UacLabMarker -OutDir $here
if (-not $exe) { exit 1 }
Write-Host "[OK] Built: $exe" -ForegroundColor Green
