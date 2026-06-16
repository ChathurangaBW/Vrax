# Lab helper — capture mandatory integrity level evidence (UAC PoC validation)
param(
    [string]$OutDir = ".",
    [string]$Label = "sample"
)
$ts = Get-Date -Format "yyyyMMdd_HHmmss"
$dir = Join-Path $OutDir "evidence"
New-Item -ItemType Directory -Force -Path $dir | Out-Null
$out = Join-Path $dir "${Label}_${ts}_whoami.txt"
whoami /all | Out-File -FilePath $out -Encoding utf8
$groups = Get-Content $out -Raw
if ($groups -match "Mandatory Label\s+(.+)") {
    Write-Output "MandatoryLabel=$($Matches[1].Trim())"
}
Write-Output "Wrote $out"
