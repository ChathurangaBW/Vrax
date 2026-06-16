# 10. STATE_MANAGEMENT_ARCHITECTURE.md

**Subject:** Where state lives, how it's owned, and how the UI avoids duplicate/shadow state.

---

## 0. Runtime Status

🟡/🔴 VRAX's *only* state store is `agents/council_state.json` (a single global file) + per-campaign `council_state.json` files scanned by `main.js:20-34`. This is the **deprecated** per-target snapshot model. The authoritative state model of the reference (Postgres `findings`/`evidence`/`agent_runs`/`audit_log`/`intelligence_records` + `blackboard.json` file blackboard + HP-TSA plan tree + Central Brain) is entirely absent. Worse, VRAX currently has **shadow state**: the renderer fabricates pheromone/severity (`app.js:111-135`) — values that exist in the UI but not in any store, exactly what the directive prohibits.

---

## 1. Current State (As-Built)

- **Store:** one JSON file (`main.js:5` `STATE_FILE`). Read on change via `fs.watch` (`main.js:36-46`).
- **Shape:** `council_state.json` — `session_id, target_binary, workspace_dir, pipeline_mode, current_phase:int, phases{...}`. Per-target snapshot; no event log; no findings table.
- **Ownership:** whoever edits the file (human or, in future, the orchestrator). No write API; the UI is read-only against it.
- **Shadow state:** renderer-derived severity/pheromone (`app.js`), MCP `3/3` (`index.html:90`), settings defaults (`index.html:307-322`).
- **No transactional integrity:** JSON file writes are not atomic relative to the UI read; no schema validation; no migration path.

---

## 2. Target Architecture (reference, rebranded)

### 2.1 Two-tier state: transactional (Postgres) + file (campaign workspace)

**Tier 1 — Postgres** (`db/migrations/001_initial_schema.sql`, with pgvector + pg_trgm): the transactional SoT.
- `campaigns`, `findings` (with `current_pheromone()` function + `active_findings` view), `finding_fingerprints`, `evidence` (immutable, append-only), `intelligence_sources`, `intelligence_records`, `finding_intel_links`, `agent_runs`, `audit_log` (range-partitioned monthly, immutable), `long_term_memories`, `technique_fingerprints`, `validation_queue`, `approval_requests`.
- `002_neo4j_schema.cypher`: graph layer (Campaign/Finding/Reference/ATTACKTechnique/ThreatActor/Evidence nodes + FTS) for cross-campaign reasoning.

**Tier 2 — File blackboard** (`campaigns/<id>/blackboard.json`, schema `council_blackboard_schema.json` v2.0): append-only event log per campaign, used by the `scripts/blackboard.py` stigmergic primitive and the `JsonFileBlackboard` overlay adapter. Atomic writes, filelock, SIGINT cleanup.

**Single source of truth rule:** the file blackboard and Postgres `findings` are reconcilable (file is the append-log; Postgres is the queryable projection). The UI reads Postgres (or a derived read-model); it never reads `council_state.json` for findings.

### 2.2 The blackboard as state spine

`Blackboard` (Python) is the write API: `write/get_active/get_triggered_agents/get_by_id/update_validation/boost_pheromone/eliminate/emit_campaign_complete`. All mutations go through it → Postgres + file append + audit_log. **No other component writes findings.**

### 2.3 HP-TSA plan tree as derived state

The plan tree (`HPTSAPlanner`) is **derived** from findings via `refresh(blackboard)` — it is *not* independent state. Node states are computed from `success_finding` existence/status/pheromone. So there's one store (findings) and the tree is a view over it. This kills a whole class of drift.

### 2.4 Read-model for the UI

A denormalized read-model (built from Postgres via the realtime event stream — see EVENT_SYSTEM/REALTIME docs) feeds the UI. This is what the renderer consumes instead of `council_state.json`. The read-model is **derived**, never authoritative — if the UI and Postgres disagree, Postgres wins.

### 2.5 Config as state

- `mcp_config.json` + `config/tool_paths.json` — MCP server config.
- `agent_model_map.json` (documentation) + `opencode.json` (runtime SoT) — agent/model config.
- `council_blackboard_schema.json` — trigger registry + finding templates.

---

## 3. UI Surface Mapping

| Surface | Current store | Required store |
|---|---|---|
| Blackboard | `council_state.json` phases | `findings` table (read-model) |
| Pipeline | `council_state.json` phases | HP-TSA tree (derived from findings) |
| Swarm | inferred | `agent_runs` table |
| Evidence | none | `evidence` table |
| MCP | hardcoded | `mcp_config.json` + discovery result |
| Overview/Sections/Imports/Exports | none | BinaryAnalysis-MCP report + `campaigns.metadata` |
| Reports | none | report artifacts + `ReportQualityGate` |
| Settings | unbound inputs | `mcp_config.json` + model map |
| Shadow (fabricated φ/sev) | `app.js` constants | eliminated — all derived from read-model |

---

## 4. Gap Analysis

| # | Capability | Status | Evidence | Build requirement |
|---|---|---|---|---|
| SM1 | Postgres schema | 🔴 | JSON file only | Port `001_initial_schema.sql` + pgvector/trgm |
| SM2 | File blackboard | 🔴 | `council_state.json` | Port `blackboard.json` append-log + `scripts/blackboard.py` |
| SM3 | Write API | 🔴 | none (UI read-only) | Port `Blackboard` write methods |
| SM4 | Read-model | 🔴 | renderer reads raw file | Build denormalized UI read-model |
| SM5 | Eliminate shadow state | 🔴 | `app.js:111-135` fabricated | All φ/sev from read-model |
| SM6 | Plan tree as derived state | 🔴 | independent `current_phase` | `HPTSAPlanner.refresh()` over findings |
| SM7 | Config stores | 🔴 | unbound | Add mcp/model/tool config files |
| SM8 | Atomic/locked writes | 🟡 | fs.watch only | filelock + atomic write + SIGINT cleanup |
| SM9 | Neo4j graph (optional) | 🔴 | none | Port `002_neo4j_schema.cypher` for cross-campaign |

---

## 5. Acceptance Criteria

1. No value shown in the UI is fabricated; every φ, severity, status, agent state, and MCP status is traceable to a Postgres row or config file.
2. The file blackboard and Postgres findings reconcile (file = append-log, Postgres = projection); a checksum/diff tool confirms zero divergence.
3. The HP-TSA plan tree is purely derived — deleting the tree and re-running `refresh()` reproduces it identically from findings.
4. Writes are atomic and locked; a crash mid-write leaves the file blackboard valid and Postgres transactional.
5. `council_state.json` is either removed or relegated to a non-authoritative legacy export; no UI surface depends on it.
