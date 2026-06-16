# 9. API_CONTRACTS.md

**Subject:** One contract per UI surface. No screen exists without a backend contract. Each specifies endpoint, request, response, ownership, cache, refresh, error handling, recovery.

---

## 0. Runtime Status

🔴/🟡 VRAX today exposes exactly **five** IPC handles (`preload.js`): `openFile`, `openFolder`, `getState`, `getCampaigns`, `loadStateFile` + two push channels (`state-update`, `campaigns-update`). Of these, only `getState`/`getCampaigns`/`state-update`/`campaigns-update` feed the UI; `openFile` returns a path then `alert()`s; `loadStateFile` is a manual JSON loader. There is **no** contract for findings, evidence, agents, MCP, intel, reports, approvals, or dispatch. Most screens therefore have no backend.

The target API is a typed layer over the reference runtime (Postgres + file blackboard + discovery + brains + gates). Below, contracts are specified as Electron IPC channels (the desktop transport) — each maps 1:1 to a UI surface from UI_AUDIT. Ownership = the runtime module that satisfies it.

---

## Contract template

```
Channel: <name>            Surface: <UI page/widget>
Request:  { ... }          Response: { ... } | Error
Owner:    <runtime module> Cache: <policy>  Refresh: <policy>
Errors:   <codes>          Recovery: <behavior>
```

---

## 1. Setup / target

### 1.1 `target:register` — Targets page "Load binary"
- **Request:** `{ path: string, mode?: PipelineMode }`
- **Response:** `{ campaign_id: uuid, target: TargetRecord, finding_id: uuid(TARGET_REGISTERED), workspace_dir: string }`
- **Owner:** `resolve_target.py` + `council-orchestrator` Phase 0 + BinaryAnalysis-MCP `get_binary_report`.
- **Cache:** none (write op). **Refresh:** emits `runtime-event` FINDING_WRITTEN.
- **Errors:** `BINARY_TOO_LARGE` (>512MiB), `PARSE_FAILED`, `ALREADY_REGISTERED` (same sha256 → returns existing campaign_id), `MCP_BINARY_TOOLS_DOWN`.
- **Recovery:** on `MCP_BINARY_TOOLS_DOWN`, fall back to LIEF-only metadata; flag degraded.
- **Replaces:** `app.js:528` `browseFiles()` → alert().

### 1.2 `target:scanFolder` — Targets page "Scan folder"
- **Request:** `{ dir: string, mode?: PipelineMode }`
- **Response:** `{ queued: TargetRecord[] }`
- **Owner:** folder enumerator + 1.1 per binary.

---

## 2. Environment (binary facts)

### 2.1 `binary:report` — Overview page
- **Request:** `{ campaign_id: uuid }` (or `{ sha256 }`)
- **Response:** BinaryAnalysis-MCP `get_binary_report`: `{ info, headers, sections[], security{aslr,dep,cfg,canaries,relro,...} }`
- **Owner:** BinaryAnalysis-MCP. **Cache:** per-sha256, immutable (binary facts don't change). **Refresh:** never (re-register on hash change).
- **Errors:** `NOT_REGISTERED`, `BINARY_MISSING`.
- **Replaces:** `renderOverview` reading `1_mapping` (`app.js:451`).

### 2.2 `binary:sections` / `binary:imports` / `binary:exports` — those pages
- **Request:** `{ sha256 }`. **Response:** section/import/export tables from BinaryAnalysis-MCP tools. **Cache:** per-sha256 immutable.

---

## 3. MCP

### 3.1 `mcp:discovery` — MCP Hub page
- **Request:** `{ campaign_id: uuid }` (discovery is per-campaign)
- **Response:** `{ servers: MCPServerResult[] }` (status, server_version, capabilities, tools, active_binary, binary_sha256, initialization_ms)
- **Owner:** `MCPDiscoveryEngine`. **Cache:** none (live). **Refresh:** re-run on demand or on MCP_HEALTH_CHANGE.
- **Errors:** `NO_SERVERS_REACHABLE`. **Recovery:** DEGRADED→LIEF only.

### 3.2 `mcp:health` — MCP Hub live status
- **Response (push):** `{ server, status, latency_ms_p50, latency_ms_p95, last_error }`
- **Owner:** `MCPRecoveryEngine.health_check_loop`. **Refresh:** 30s tick + on change.

### 3.3 `mcp:toolCall` (streaming) — active requests
- **Request:** `{ agent_run_id, logical_op, args }` → **Response (push):** `{ started, result|error, latency, cascade_stage }`
- **Owner:** `MCPRecoveryEngine.call`. HIGH-stakes ops require approval (see 6.2).

### 3.4 `mcp:config.get/put` — Settings MCP endpoints
- **Owner:** `mcp_config.json` + `tool_paths.json`.

---

## 4. Execution (orchestrator + agents)

### 4.1 `pipeline:tree` — Pipeline page
- **Request:** `{ campaign_id }`. **Response:** `{ mode, nodes: PlanNode[], frontier: node_id[] }` (node: objective, hypothesis, success_finding, state, depends_on, attempts, kill_budget, dead_reason).
- **Owner:** `HPTSAPlanner` (derived from findings). **Cache:** none. **Refresh:** on every tick / NODE_* event.
- **Replaces:** `renderPipeline` fixed 6 cards (`app.js:273`).

### 4.2 `swarm:list` — Swarm page
- **Request:** `{ campaign_id }`. **Response:** `{ agents: AgentView[] }` (name, tier_model, status, current_task, trigger_source, last_run{tokens,cost,duration,error}).
- **Owner:** `agent_runs` + `agent_model_map.json` + `AGENT_TRIGGERS`. **Refresh:** on RUN_* / TRIGGER_FIRED events.
- **Replaces:** `renderSwarm` 5 inferred agents (`app.js:328`).

### 4.3 `agent:history` — agent run log
- **Request:** `{ campaign_id, agent_name }`. **Response:** `agent_runs[]`. **Owner:** `agent_runs` table.

### 4.4 `dispatch:prompt` — Operator Console prompt input
- **Request:** `{ campaign_id, prompt, agent?, mode_override? }`. **Response:** `{ delegation_id, assignment }`.
- **Owner:** `dispatcher.build_prompt` + `delegation_plan.json`.
- **Errors:** `NO_ACTIVE_CAMPAIGN`, `AGENT_NOT_IN_MODE`, `APPROVAL_REQUIRED`. **Recovery:** route to approval gate.
- **Replaces:** the inert prompt input (`index.html:290`).

### 4.5 `orchestrator:state` — Operator Console state vector
- **Response:** `current_state_block()` = `{ current_vector, hypothesis, active_sub_loop, progress_pct, dead_paths[] }`. **Owner:** `MetaOrchestrator`. **Refresh:** per tick.

---

## 5. Intel / blackboard

### 5.1 `blackboard:findings` — Blackboard page
- **Request:** `{ campaign_id, filter?: {type?, status?, producer?, kev?, active_only?}, cursor? }`.
- **Response:** `{ findings: FindingView[], next_cursor }` (FindingView = type, status, confidence, current_pheromone, produced_by, consumers[], evidence_count, cve_ids, is_kev, created_at, boosted_at).
- **Owner:** `Blackboard.get_active` + `current_pheromone()`. **Cache:** none. **Refresh:** on FINDING_* events; decay re-tick 5s.
- **Replaces:** `collectFindings` synthesis (`app.js:100`).

### 5.2 `blackboard:finding` — expanded card
- **Request:** `{ finding_id }`. **Response:** full Finding + `evidence[]` + `intel_links[]` + `reasoning_trace` + `produced_by_run`.
- **Owner:** `findings` + `evidence` + `finding_intel_links` + `agent_runs`.

### 5.3 `evidence:list` — Evidence page
- **Request:** `{ campaign_id, finding_id? }`. **Response:** `evidence[]` (class A/B/C/D, run_number, artifact_sha256, exit_code, crashed, asan_detected, artifact_url).
- **Owner:** `evidence` table. **Replaces:** the absent `renderEvidence`.

### 5.4 `intel:sources` / `intel:correlations` — Intel page
- **Owner:** `intelligence_sources` / `finding_intel_links`.

---

## 6. Assurance + outputs

### 6.1 `validation:result` — per-finding gate result
- **Response:** `{ gates_passed/6, evidence_score, status, critic_verdict, confidence_adjustment }`. **Owner:** `ValidationGate` + `CriticBrain`.

### 6.2 `approval:list` / `approval:decide` — HITL gates
- **Request decide:** `{ approval_id, decision: APPROVE|DENY, reason? }`. **Response:** `{ node_state }`. **Owner:** `approval_requests`.
- **Errors:** `EXPIRED` (1h TTL), `ALREADY_DECIDED`.

### 6.3 `report:generate` — Reports page / Export
- **Request:** `{ campaign_id, format: 'pdf'|'json' }`. **Response:** `{ artifact_path, sha256, signature, schema_version }`.
- **Owner:** `report-generator` + `ReportQualityGate` + `ReportSigner`.
- **Errors:** `GATE_BLOCKED` (lists blocking findings), `NOT_ALL_VERIFIED`. **Recovery:** surface the gate report; no partial export of unverified 0-days.
- **Replaces:** inert Export button (`index.html:54`).

### 6.4 `report:list` — Reports page
- **Response:** report artifacts (draft/final) with quality-gate status.

---

## 7. Realtime channels (push)

- `runtime-event` — typed events (EVENT_SYSTEM §2.1) with cursor; targeted widget patch.
- `state-snapshot` — full read-model on (re)connect/resync.
- (Legacy `state-update`/`campaigns-update` retired once read-model live.)

---

## 8. Cross-cutting contracts

### 8.1 Error envelope
`{ code: string, message: string, campaign_id?, trace_id?, retryable: bool }`. Every channel returns this on failure.

### 8.2 Cache/refresh matrix
| Surface | Cache | Refresh |
|---|---|---|
| Binary facts (report/sections/imports/exports) | per-sha256 immutable | re-register on hash change |
| Blackboard findings | none | FINDING_* events + 5s decay tick |
| Pipeline tree | none | per tick / NODE_* event |
| Swarm | none | RUN_* / TRIGGER_FIRED events |
| MCP discovery | none | on demand / MCP_HEALTH_CHANGE |
| MCP health | none | 30s tick |
| Intel sources | soft 60s | sync events |
| Reports | none | REPORT_GENERATED event |

### 8.3 Ownership map
| Domain | Owner module |
|---|---|
| target/binary facts | resolve_target + BinaryAnalysis-MCP |
| findings/blackboard | Blackboard (Postgres + file) |
| pipeline/tree | HPTSAPlanner |
| agents/runs | dispatcher + agent_runs |
| MCP | MCPDiscoveryEngine + MCPRecoveryEngine |
| validation/critic | ValidationBrain + CriticBrain |
| intel/knowledge | pollers + intel_store + knowledge-base |
| reports | report-generator + ReportQualityGate + ReportSigner |
| approvals | approval_requests |
| events/audit | audit_log + event stream |

---

## 9. Gap Analysis (screen → contract)

| Screen | Contract exists? | Status |
|---|---|---|
| Targets | 🟡 `openFile` only | need `target:register`/`scanFolder` |
| Overview/Sections/Imports/Exports | 🔴 none | need `binary:*` |
| Pipeline | 🔴 none | need `pipeline:tree` |
| Swarm | 🔴 none | need `swarm:list`/`agent:history` |
| Blackboard | 🔴 (synthesis) | need `blackboard:findings`/`finding` |
| Evidence | 🔴 none | need `evidence:list` |
| Reports | 🔴 none | need `report:list`/`generate` |
| MCP Hub | 🔴 none | need `mcp:discovery`/`health`/`toolCall` |
| Operator Console | 🔴 none | need `dispatch:prompt`/`orchestrator:state` |
| Approvals | 🔴 none | need `approval:list`/`decide` |
| Intel | 🔴 none | need `intel:*` |
| Settings | 🔴 unbound | need `mcp:config`/`model:map` |

---

## 10. Acceptance Criteria

1. Every screen in UI_AUDIT maps to ≥1 contract above; no screen lacks a backend.
2. Every contract has a named owner module, an error envelope, a cache policy, and a refresh trigger.
3. No contract returns fabricated data; each returns authoritative runtime state.
4. Report generation is gated: `report:generate` cannot succeed unless `ReportQualityGate` passes (every finding VERIFIED/FALSE_POSITIVE/REJECTED/INCONCLUSIVE).
5. HIGH-stakes operations route through `approval:decide` before execution.
