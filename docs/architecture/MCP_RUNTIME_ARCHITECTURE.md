# 7. MCP_RUNTIME_ARCHITECTURE.md

**Subject:** Real MCP visibility — not a green dot. Connection status, capabilities, active requests, last response, latency, failure reason, retry state.

---

## 0. Runtime Status

🔴 **No MCP runtime in VRAX.** The sidebar MCP panel (`index.html:87-104`) is entirely hardcoded: three rows (ghidra/ida/binja), a fixed `3/3` count, `toggleMcp` (`app.js:25-32`) flips only CSS classes — no IPC, no discovery, no health. The Settings modal hardcodes `localhost:13337/13338/13339` (`index.html:307-311`) unbound to anything. There is zero real MCP activity; the green dots are paint.

The reference has a complete MCP subsystem: `MCPDiscoveryEngine` (deterministic 6-phase protocol, no LLM), `MCPToolRegistry` (24 logical ops → server tools, with HIGH-stakes marking), `MCPRecoveryEngine` (retry→reconnect→fallback→degraded cascade), health-check loop, and real wiring to IDA/Binary Ninja/Ghidra + the BinaryAnalysis-MCP LIEF server.

---

## 1. Current State (As-Built)

- **Panel:** 3 static rows, `3/3` header (`index.html:89-90`).
- **Toggle:** `toggleMcp` = CSS only (`app.js:25-32`).
- **Endpoints:** Settings inputs unbound (`index.html:307-311`).
- **Discovery/health/recovery:** none.
- **Config:** VRAX has no `mcp_config.json` / `config/tool_paths.json` equivalent.

---

## 2. Target Architecture

### 2.1 Discovery protocol (`src/mcp/discovery.py`)

Deterministic, no-LLM, 6 phases: **(1)** enumerate servers, **(2)** `_validate_reachable` (HTTP GET; 200/400/404/405 = alive, 405=POST-only JSON-RPC), **(3)** `_initialize` (JSON-RPC `initialize`, client `council-v2/2.0.0`, caps `roots.listChanged`+`sampling`), **(4)** `_list_tools` (`tools/list`), **(5)** dynamic registration confirmed, **(6)** `_discover_binary` (call each server's `binary_discovery_tool` to find the loaded binary). All servers probed in parallel (`asyncio.gather`). Constants: `MCP_PROTOCOL_VERSION="2024-11-05"`, `HTTP_TIMEOUT_S=5.0`, `MAX_RETRIES=3`, `RETRY_DELAYS_S=[0,2,5]`.

### 2.2 Server model (`registry.py`)

```
MCPServerResult {
  name, status: MCPStatus,   # UNKNOWN/REACHABLE/INITIALIZED/TOOLS_LISTED/MCP_READY/DEGRADED/CONFIRMED_DOWN/INIT_ERROR
  server_version, capabilities,
  tools: [MCPTool{qualified_name='mcp__<server>__<tool>', ...}],
  active_binary, binary_sha256, initialization_ms
}
MCPToolRegistry.resolve(logical_op, prefer_server) → ResolvedTool
CAPABILITY_MAP: 24 logical ops → ida/binja/ghidra tool names + stakes(LOW/MEDIUM/HIGH)
primary_server preference: IDA → Binary Ninja → Ghidra
HIGH-stakes ops: patch_bytes, patch_asm
can_dual_validate: IDA+BN both ready
```

Known servers (`KNOWN_SERVERS`): `ida-pro-mcp` (`list_funcs`, key `idb_path`), `binary-ninja-mcp` (`list_binaries`, key `filename`, port 9009), `ghidra-mcp` (`get_current_program`, key `program_path`, port 13338). Plus the **BinaryAnalysis-MCP** LIEF server (`server.py`, stdio) for deterministic PE/ELF/Mach-O triage.

### 2.3 Recovery (`src/mcp/recovery.py`)

`MCPRecoveryEngine.call()` **never raises** — returns `RecoveryResult`. Cascade: **RETRY** (`MAX_TOOL_RETRIES=2`, exp backoff `2**attempt`) → **RECONNECT** (`RECONNECT_RETRIES=3`, 3s sleep) → **FALLBACK** (`_get_alternate_server`: ida↔binja, ghidra→ida) → **DEGRADED** (LIEF static only). Error classifier → TIMEOUT/CONNECTION_RESET/TOOL_NOT_FOUND/OTHER. `health_check_loop` pings every `HEALTH_CHECK_INTERVAL_S=30` (3s timeout). Audit events: `MCP_DISCOVERY`, `MCP_FALLBACK`, `MCP_HEALTH_CHANGE` → `audit_log`.

### 2.4 Transports (`config/tool_paths.json`)

IDA = `stdio` (port 13337), Binary Ninja = `sse` (9009), Ghidra = `streamable-http` (8081). `mcp_config.json` configures `ida-pro-mcp` (spawned `python.exe server.py` against IDA RPC `127.0.0.1:13337`) + remote `zap` (`http://localhost:8282/sse`, bearer).

---

## 3. UI Surface Mapping — from green dot to operational state

| Widget | Current | Required |
|---|---|---|
| MCP Hub page | 🔴 absent | First-class page: per-server card with full operational state |
| Server card status | green dot | `MCPStatus` 8-state badge + server_version + capabilities |
| Connection | hardcoded | transport (stdio/sse/http), endpoint, reachable result, init_ms |
| Active binary | none | `active_binary` + `binary_sha256` per server (am I analyzing the right binary?) |
| Tools | none | tool list (`mcp__<server>__<tool>`), grouped by logical op, HIGH-stakes flagged |
| Active requests | none | in-flight tool calls (which agent, which op, started_at) |
| Last response | none | last tool call: op, result/error, latency |
| Latency | none | p50/p95 from health-check loop |
| Failure reason | none | error class (TIMEOUT/CONNECTION_RESET/TOOL_NOT_FOUND) + last error |
| Retry/fallback state | none | current cascade stage, fallback server if degraded |
| Settings binding | unbound | bind endpoints to `mcp_config.json`; bind to `tool_paths.json` |

---

## 4. Gap Analysis

| # | Capability | Status | Evidence | Build requirement |
|---|---|---|---|---|
| M1 | Discovery engine | 🔴 | hardcoded 3/3 | Port `MCPDiscoveryEngine` 6-phase |
| M2 | Server model UI | 🔴 | green dots | Port `MCPServerResult`; render 8-state |
| M3 | Tool registry | 🔴 | none | Port `MCPToolRegistry` + `CAPABILITY_MAP` |
| M4 | Recovery cascade | 🔴 | none | Port `MCPRecoveryEngine` retry→reconnect→fallback→degraded |
| M5 | Health loop | 🔴 | none | Port 30s ping loop; show latency |
| M6 | Active binary tracking | 🔴 | none | Port `_discover_binary`; show per-server binary+sha256 |
| M7 | Dual validation | 🔴 | none | Port `can_dual_validate`; show IDA+BN agreement |
| M8 | HIGH-stakes guard | 🔴 | none | Flag patch_bytes/patch_asm; route to approval |
| M9 | Config files | 🔴 | none | Add `mcp_config.json` + `tool_paths.json` to VRAX |
| M10 | Live request stream | 🔴 | none | Stream in-flight tool calls (agent→op→result) |

---

## 5. Acceptance Criteria

1. The MCP Hub shows each server's true `MCPStatus` (not a green dot); a down server shows `CONFIRMED_DOWN`/`INIT_ERROR` with the classified reason and last error.
2. Each server shows the binary it currently has loaded (`active_binary` + sha256); if it differs from the registered target sha256, the UI flags the mismatch.
3. A tool call that fails visibly shows the recovery cascade progressing (RETRY→RECONNECT→FALLBACK) and, on degrade, names the fallback server and the LIEF-only scope.
4. Latency (p50/p95) and last-response are visible per server; in-flight requests stream in real time.
5. HIGH-stakes operations (`patch_bytes`, `patch_asm`) cannot execute without an approval request, and the registry shows which ops are HIGH-stakes.
6. Settings endpoints are bound to the real `mcp_config.json`; changing an endpoint re-runs discovery.
