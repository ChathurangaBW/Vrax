# 11. EVENT_SYSTEM_ARCHITECTURE.md

**Subject:** How state changes propagate — the events that drive the UI, the audit trail, and the inter-component signaling (stigmergy + delegation).

---

## 0. Runtime Status

🟡 VRAX has exactly **one** event mechanism: `fs.watch` on `council_state.json` → `state-update` IPC push (`main.js:36-46`). That is whole-file replacement, not events: any edit sends the entire state blob. There is no event typing, no audit log, no per-finding/per-run granularity, no inter-agent signaling. The reference has a rich event model: the `audit_log` (immutable, partitioned, OpenTelemetry-traced), the stigmergic blackboard (events = finding writes that trigger consumers), delegation handoffs (`delegation_plan.json`), MCP audit events, and a metrics stream.

---

## 1. Current State (As-Built)

- **Mechanism:** `fs.watch` → 150ms debounce → `win.webContents.send('state-update', fullState)` (`main.js:39-44`).
- **Channels:** `state-update`, `campaigns-update` (`preload.js:13-14`).
- **Granularity:** whole file. No "finding X written", no "agent Y run started".
- **Audit:** none.
- **Traceability:** none (no trace_id/span_id).
- **Inter-agent:** none (no stigmergy, no delegation).

---

## 2. Target Architecture

### 2.1 Event taxonomy (reference, rebranded)

| Event class | Source | Examples | Sink |
|---|---|---|---|
| **Blackboard** (stigmergic) | `Blackboard.write/boost/update_validation` | FINDING_WRITTEN, FINDING_BOOSTED, VALIDATION_CHANGED, TRIGGER_FIRED, CONSENSUS_REQUESTED/REACHED | `findings` + `audit_log`; triggers consumers |
| **Agent** | dispatcher + `agent_runs` | RUN_STARTED, RUN_COMPLETE, RUN_FAILED, RUN_TIMEOUT, APPROVAL_REQUESTED, APPROVAL_RESOLVED | `agent_runs` + `audit_log`; Prometheus |
| **MCP** | discovery/recovery | MCP_DISCOVERY, MCP_FALLBACK, MCP_HEALTH_CHANGE, TOOL_CALLED, TOOL_FAILED | `audit_log` + metrics |
| **Pipeline** | meta-orchestrator | TICK, NODE_ACTIVATED, NODE_SATISFIED, NODE_DEAD, CAMPAIGN_COMPLETE | plan tree + `audit_log` |
| **Intel** | pollers + correlate | INTEL_SYNCED, INTEL_CORRELATED, KEV_BOOST_APPLIED | `intelligence_*` + `audit_log` |
| **Quality** | gates | TRIAGE_DECISION, VALIDATION_GATE_RESULT, CRITIC_REVIEW, REPORT_GATE_BLOCKED/ALLOWED | `audit_log` |
| **Budget** | checkpoint | COST_RECORDED, BUDGET_EXCEEDED (rc=2) | events.jsonl + `audit_log` |

### 2.2 The `audit_log` (immutable, partitioned)

`audit_log(campaign_id, event_type, event_data::jsonb, trace_id, span_id, created_at)` — range-partitioned monthly, immutability trigger, OpenTelemetry trace_id/span_id. This is the authoritative event history; the UI's "what happened and why" is a query over it.

### 2.3 Stigmergy as the inter-agent event bus

Agents **do not message each other**. Coordination is entirely via blackboard writes: agent A writes a finding → `AGENT_TRIGGERS` evaluates → agent B's predicate matches → B is triggered. This is the event system for agent coordination; the UI must show trigger firings as events (the "3 agents" consumer list on a finding = the agents whose predicates matched).

### 2.4 Delegation handoff

`dispatcher` writes `delegation_plan.json` (the opencode-native handoff). The orchestrator's `task` tool reads it. This is an event-like handoff but file-based. The UI should show pending delegations as queued work.

### 2.5 UI event stream

The renderer subscribes to a typed event stream (not whole-file blobs). Each event carries enough to update exactly the affected widget (a FINDING_WRITTEN updates one Blackboard card; a RUN_STARTED updates one Swarm row). This is the bridge to REALTIME_UPDATE_ARCHITECTURE.

---

## 3. UI Surface Mapping

| Surface | Current | Required |
|---|---|---|
| Update mechanism | whole-file blob | typed events → targeted widget updates |
| Event log/timeline | none | audit_log timeline (filterable by class/agent/finding) |
| Trigger firings | none | show FINDING→TRIGGER_FIRED→agent events |
| Delegations | none | show pending delegation_plan.json handoffs |
| Trace IDs | none | every run/findings links to trace_id → full trace |

---

## 4. Gap Analysis

| # | Capability | Status | Evidence | Build requirement |
|---|---|---|---|---|
| E1 | Typed event stream | 🔴 | whole-file blob | Define event taxonomy; emit per-change |
| E2 | audit_log | 🔴 | none | Port immutable partitioned audit_log |
| E3 | Stigmergic trigger events | 🔴 | none | Port AGENT_TRIGGERS → TRIGGER_FIRED events |
| E4 | Delegation handoff | 🔴 | none | Port dispatcher → delegation_plan.json |
| E5 | Trace IDs | 🔴 | none | OpenTelemetry trace_id/span_id on runs+events |
| E6 | Event timeline UI | 🔴 | none | audit_log timeline view |
| E7 | Targeted widget updates | 🔴 | re-render all | Event → affected widget only |
| E8 | MCP audit events | 🔴 | none | Port MCP_DISCOVERY/FALLBACK/HEALTH_CHANGE |

---

## 5. Acceptance Criteria

1. Every state change emits a typed event to the audit_log with trace_id; the UI updates only the affected widget, not the whole view.
2. An agent run's full lifecycle (RUN_STARTED→…→RUN_COMPLETE/FAILED) is reconstructable from the audit_log with no gaps.
3. Trigger firings are visible: a finding write that satisfies a predicate shows the TRIGGER_FIRED event and the agent it would activate.
4. The event timeline is filterable by class (blackboard/agent/mcp/pipeline/intel/quality) and joins to the affected finding/run/node.
5. A budget-exceeded event (COST_RECORDED accrual crossing `max_cost_usd`) stops the loop and surfaces in the UI (checkpoint rc=2 path).
