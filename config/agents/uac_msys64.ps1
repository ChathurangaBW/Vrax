# UAC lab — MSYS64 MinGW-w64 paths (council standard: C:\msys64)
# Dot-source: . C:\Users\Sniffer\.opencode\agents\uac_msys64.ps1

$script:UAC_MSYS64_ROOT = 'C:\msys64'
$script:UAC_MINGW_BIN   = Join-Path $UAC_MSYS64_ROOT 'mingw64\bin'
$script:UAC_GCC         = Join-Path $UAC_MINGW_BIN 'gcc.exe'
$script:UAC_GPP         = Join-Path $UAC_MINGW_BIN 'g++.exe'
$script:UAC_WINDRES     = Join-Path $UAC_MINGW_BIN 'windres.exe'
$script:UAC_AGENTS_ROOT = Split-Path -Parent $MyInvocation.MyCommand.Path
$script:UAC_LAB_CAPTURE = Join-Path $UAC_AGENTS_ROOT 'uac_lab_capture.ps1'
$script:UAC_MARKER_SRC  = Join-Path $UAC_AGENTS_ROOT 'templates\uac_lab_marker.c'

function Test-UacMsys64 {
    if (-not (Test-Path $UAC_GCC)) {
        Write-Error "MSYS64 gcc not found: $UAC_GCC - install MinGW-w64 via MSYS2"
        return $false
    }
    & $UAC_GCC --version | Select-Object -First 1
    return $true
}

function Build-UacLabMarker {
    param(
        [Parameter(Mandatory)]
        [string]$OutDir,
        [string]$Source = $UAC_MARKER_SRC
    )
    if (-not (Test-UacMsys64)) { return $null }
    New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
    $outExe = Join-Path $OutDir 'uac_lab_marker.exe'
    $srcCopy = Join-Path $OutDir 'uac_lab_marker.c'
    Copy-Item -Force $Source $srcCopy
    & $UAC_GCC $srcCopy -o $outExe -O2 -s -static
    if ($LASTEXITCODE -ne 0) { Write-Error "gcc failed"; return $null }
    Write-Output $outExe
}

function Invoke-UacLabCapture {
    param(
        [string]$OutDir,
        [string]$Label
    )
    & powershell -NoProfile -File $UAC_LAB_CAPTURE -OutDir $OutDir -Label $Label
}
