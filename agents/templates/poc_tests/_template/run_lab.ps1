# UAC PoC lab runner — 3/3 mandatory-level capture (customize $TriggerScript per technique)
param(
    [string]$TechniqueId = 'REPLACE_TECHNIQUE_ID',
    [int]$Runs = 3
)
$ErrorActionPreference = 'Stop'
$here = $PSScriptRoot
$agentsRoot = Split-Path (Split-Path (Split-Path $here -Parent) -Parent) -Parent
. (Join-Path $agentsRoot 'uac_msys64.ps1')

$evidence = Join-Path $here 'evidence'
New-Item -ItemType Directory -Force -Path $evidence | Out-Null

# --- Build marker (C:\msys64 gcc) ---
if (-not (Test-Path (Join-Path $here 'uac_lab_marker.exe'))) {
    & (Join-Path $here 'build.ps1')
}

$marker = Join-Path $here 'uac_lab_marker.exe'
if (-not (Test-Path $marker)) { throw "Missing uac_lab_marker.exe — run build.ps1" }

# --- Per-technique trigger (EDIT) ---
# Example: invoke UACME Akagi, registry setup + broker, or technique-specific stub.
# Must launch $marker at HIGH mandatory level without consent UI.
function Invoke-TechniqueTrigger {
    param([string]$MarkerPath)
    # TODO: replace with technique-specific elevation trigger
    Write-Warning "Invoke-TechniqueTrigger not implemented — edit run_lab.ps1"
    & $MarkerPath
}

$results = @()
for ($i = 1; $i -le $Runs; $i++) {
    Write-Host "=== Run $i / $Runs ===" -ForegroundColor Cyan
    $before = Invoke-UacLabCapture -OutDir $evidence -Label "run${i}_before"
    Invoke-TechniqueTrigger -MarkerPath $marker
    Start-Sleep -Seconds 2
    $proof = Join-Path $env:TEMP 'uac_lab_proof.txt'
    if (Test-Path $proof) {
        Copy-Item -Force $proof (Join-Path $evidence "run${i}_uac_lab_proof.txt")
    }
    $after = Invoke-UacLabCapture -OutDir $evidence -Label "run${i}_after"
    $afterIl = 'Unknown'
    if ($after -match 'MandatoryLabel=(.+)') { $afterIl = $Matches[1] }
    $pass = ($afterIl -match 'High')
    $results += [pscustomobject]@{
        run = $i
        pass = $pass
        before = ($before | Out-String).Trim()
        after = ($after | Out-String).Trim()
        after_il = $afterIl
        evidence_before = "poc_tests/$TechniqueId/evidence/run${i}_before_*"
        evidence_after  = "poc_tests/$TechniqueId/evidence/run${i}_after_*"
    }
}

$passed = ($results | Where-Object { $_.pass }).Count
Write-Host "Result: $passed / $Runs" -ForegroundColor $(if ($passed -eq $Runs) { 'Green' } else { 'Red' })
$results | Format-Table -AutoSize
if ($passed -ne $Runs) { exit 1 }
exit 0
