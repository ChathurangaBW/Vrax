# Quick IDA Pro MCP health check (OpenCode council / uac-bypass-discovery)
$ErrorActionPreference = "Continue"
$py = "C:\Users\Sniffer\AppData\Local\Python\pythoncore-3.14-64\python.exe"
$idaUrl = "http://127.0.0.1:13337/mcp"

Write-Host "=== IDA MCP Health ===" -ForegroundColor Cyan

# 1. Python + ida_pro_mcp package
if (-not (Test-Path $py)) {
    Write-Host "[FAIL] Python 3.14 not found: $py" -ForegroundColor Red
    exit 1
}
& $py -c "import ida_pro_mcp.server" 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "[FAIL] ida_pro_mcp not installed. Run:" -ForegroundColor Red
    Write-Host "  py -3.14 -m pip install -e C:\Users\Sniffer\.gemini\antigravity\scratch\ida_pro_mcp"
    exit 1
}
Write-Host "[OK] Python + ida_pro_mcp import" -ForegroundColor Green

# 2. IDA HTTP plugin (Edit -> Plugins -> MCP in IDA)
$tcp = Test-NetConnection 127.0.0.1 -Port 13337 -WarningAction SilentlyContinue
if (-not $tcp.TcpTestSucceeded) {
    Write-Host "[FAIL] Nothing listening on 127.0.0.1:13337" -ForegroundColor Red
    Write-Host "  In IDA Pro: Edit -> Plugins -> MCP (Ctrl+Alt+M)" -ForegroundColor Yellow
    exit 1
}
Write-Host "[OK] Port 13337 open" -ForegroundColor Green

try {
    $body = '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
    $r = Invoke-WebRequest -Uri $idaUrl -Method POST -Body $body -ContentType "application/json" -TimeoutSec 10 -UseBasicParsing
    Write-Host "[OK] IDA MCP HTTP $($r.StatusCode) (tools/list)" -ForegroundColor Green
} catch {
    Write-Host "[FAIL] IDA MCP HTTP: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host "`nRestart OpenCode after opencode.json changes." -ForegroundColor Cyan
exit 0
