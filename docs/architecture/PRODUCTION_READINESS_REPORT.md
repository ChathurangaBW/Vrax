# 14. PRODUCTION_READINESS_REPORT.md

**Subject:** Synthesis of all 13 architecture documents — what VRAX is today, what it must become, and the ordered build roadmap to get there.

---

## 0. Executive summary

VRAX today is a **live viewer for a deprecated state file with no engine behind it.** The Electron shell, the IPC transport, and the reactive renderer are real and working (`electron/main.js` fs.watch → `state-update` → `renderAll`). But the thing they watch — `agents/council_state.json` — is a per-target snapshot that the reference's own audit marks `__DEPRECATED`, and nothing inside VRAX produces it during analysis. So the UI is honest when idle (empty states) and decorative when "running" (5 inferred agents, fabricated pheromone, hardcoded MCP `3/3`). Every runtime subsystem the directive demands — orchestrator, blackboard, MCP engine, agents, validation/critic brains, intelligence, reports — is absent from VRAX and present in the reference (`C:\Users\Sniffer\.opencode`).

**The directive's goal — "a professional reverse-engineering command center whose interface is a live representation of the actual runtime" — is achievable**, because (a) the UI plumbing already exists and is reactive, and (b) a complete, working reference implementation exists to port from. The work is porting the reference runtime into VRAX (rebranded), building the API layer between it and the existing renderer, and rewiring the renderer off the legacy file onto the authoritative read-model.

---

## 1. Consolidated gap map (across all 13 docs)

Status counts: 🟢 exists & wired · 🟡 present but inert/wrong-source · 🔴 missing.

| Doc | 🟢 | 🟡 | 🔴 | Notable reds |
|---|---|---|---|---|
| 1 UI_AUDIT (16 caps) | 2 | 5 | 9 | authoritative state, real φ/decay, validation, evidence, MCP, reports, dispatch, approvals, settings |
| 2 INFORMATION_ARCHITECTURE (18) | 0 | 1 | 17 | entire lifecycle; lifecycle-as-IA |
| 3 TARGET_SYSTEM (8) | 0 | 1 | 7 | registration, workspace, dedup, metadata pages |
| 4 ORCHESTRATOR (12) | 0 | 0 | 12 | meta-orchestrator, HP-TSA tree, committee, triggers, gates, approvals, consensus |
| 5 BLACKBOARD (12) | 0 | 0 | 12 | findings store, FindingType, decay, lifecycle, producer/consumer, evidence, confidence, dedup |
| 6 AGENT_RUNTIME (10) | 0 | 0 | 10 | roster, runs, dispatch, models/fallback, resources, history, metrics |
| 7 MCP_RUNTIME (10) | 0 | 0 | 10 | discovery, registry, recovery, health, binary tracking, dual-validation, HIGH-stakes |
| 8 SECOND_BRAIN (10) | 0 | 0 | 10 | knowledge catalog, pollers, correlation, embeddings, validation/critic brains, Central Brain |
| 9 API_CONTRACTS (12 screens) | 0 | 1 | 11 | contracts for all screens except the legacy get-state path |
| 10 STATE_MANAGEMENT (9) | 0 | 2 | 7 | Postgres schema, file blackboard, write API, read-model, no shadow state |
| 11 EVENT_SYSTEM (8) | 0 | 0 | 8 | typed events, audit_log, stigmergy, delegation, trace IDs |
| 12 REALTIME (8) | 1 | 1 | 6 | typed channel, targeted updates, cursor/replay, resilience (IPC transport already 🟢) |
| 13 E2E PIPELINE (6 modes) | 0 | 0 | 6 | no mode runs end-to-end |
| **Totals** | **3** | **11** | **125** | |

**Read of the numbers:** of ~139 tracked capabilities, **3 are done, 11 are partial, 125 are missing.** The 3 greens are all plumbing (window controls, IPC transport, file-watch realtime primitive). The 11 yellows are the "honest shell" — the reactive renderer and the file path it reads. The 125 reds are the runtime.

---

## 2. What's genuinely good (keep these)

1. **Electron + IPC architecture** (`main.js`, `preload.js`) — sound, secure (contextIsolation, no nodeIntegration), correct IPC split. Extend, don't rewrite.
2. **Reactive renderer** (`app.js` `renderAll` + per-page render fns) — the right shape; add renderers for evidence/reports/sections/imports/exports and rewire data sources.
3. **Realtime primitive** (`fs.watch` → `state-update`) — working; upgrade trigger + payload per REALTIME doc.
4. **Empty-state honesty** — pages show "No active campaign" not fake data. This discipline must be preserved: never add hardcoded findings back.
5. **Visual density reference** (`D:\vrax\renderer/` mock) — adopt its richer cards/animations, fed by real data.

---

## 3. The central rebrand decision

The reference (`C:\Users\Sniffer\.opencode`, "Council V2") is a **Python + Postgres + opencode-harness** system. VRAX today is **Electron + JS + JSON file**. Porting means choosing a runtime location:

- **Option A (recommended): run the reference runtime as a sidecar.** Ship VRAX as Electron UI + a bundled Python runtime (the ported, rebranded `src/`) + Postgres (or SQLite via `effect-sqlite-node` already in the `D:\vrax` opencode fork). The UI talks to the runtime via the API layer (API_CONTRACTS) over local IPC/HTTP. This reuses ~90% of the reference code and is the fastest path to "live representation of the real system."
- **Option B: reimplement in TS/Effect** inside the `D:\vrax` opencode-fork monorepo (`@vrax/core` etc.). Higher fidelity to the opencode toolchain, but ~months of reimplementation of blackboard/overlay/MCP that already exist in Python.
- **Option C: hybrid** — port the deterministic cores (blackboard, MCP discovery/recovery, gates, brains) to TS, keep agent playbooks + dispatcher harness as-is. Middle ground.

The directive ("any opencode reference rebrand as VRAX") plus the existence of a working Python reference strongly favor **Option A** for v1, with selective TS ports (Option C) where performance or type-safety matters.

---

## 4. Build roadmap (ordered by dependency)

**Phase 0 — Foundation (unblocks everything)**
1. Stand up Postgres (or SQLite); port `001_initial_schema.sql` (findings, evidence, agent_runs, audit_log, intelligence_*, validation_queue, approval_requests) [SM1].
2. Port `Blackboard` (write API + `current_pheromone()` + fingerprints) [B1–B4, B9, SM3].
3. Port `scripts/blackboard.py` file blackboard + `blackboard.json` append-log [SM2].
4. Build the UI read-model + typed event channel [SM4, E1, R3].
5. Rewire renderer off `council_state.json` onto the read-model; **eliminate fabricated φ/sev** [SM5].

**Phase 1 — Target + Environment**
6. Port `resolve_target.py` + BinaryAnalysis-MCP; implement `target:register` [T1–T8; 2.1–2.2 API].
7. Wire Overview/Sections/Imports/Exports to `binary:*` [G11].

**Phase 2 — MCP**
8. Port `MCPDiscoveryEngine` + `MCPRecoveryEngine` + registry; MCP Hub page [M1–M10; 3.x API].

**Phase 3 — Orchestrator + Agents**
9. Port `HPTSAPlanner` + `Committee` + `MetaOrchestrator` + dispatcher [O1–O4, O12; A3].
10. Port `AGENT_TRIGGERS`; Swarm view with real roster + runs [A1–A2, A4–A6, O5–O6].
11. Pipeline view = HP-TSA tree [O3].

**Phase 4 — Assurance + Intel**
12. Port `ValidationBrain` + `CriticBrain` + `ValidationGate` + `TriageGate` [S5–S6, O8–O9, 6.1 API].
13. Port NVD/CISA-KEV pollers + `intel_store` + knowledge-base + Central Brain [S1–S4, S7–S9].
14. Evidence page + Intel page [B7, S10].

**Phase 5 — Outputs + HITL**
15. Port `report-generator` + `ReportQualityGate` + `ReportSigner` [G12; 6.3 API].
16. Port `approval_requests` + HITL UI [O10, G14; 6.2 API].
17. Port consensus vote [O11].

**Phase 6 — Pipelines + Validation**
18. Port `commands/*.md` + `pipeline_router`; mode-aware trees [L7, L18].
19. End-to-end smoke test per mode (CRASH first) [13 E2E].
20. Port remaining modes: PATCH, CTF, MALWARE, ZERO-DAY, UAC-BYPASS.

**Phase 7 — Hardening**
21. Observability (Prometheus metrics in UI) [A9].
22. Realtime resilience (cursor/replay, stale indicator, backpressure) [R5–R7].
23. Settings persistence (mcp/model config binding) [G15].
24. Remove/retire `council_state.json`; delete legacy shadow state [SM5].

---

## 5. Definition of Done (production-ready)

VRAX is production-ready when **all** hold:

1. **No fabricated data.** Grep the renderer: zero hardcoded findings, φ scores, agent tasks, or MCP counts. Every value is from a contract returning runtime state. (UI_AUDIT AC1.)
2. **Live lifecycle.** From binary selection to `CAMPAIGN_COMPLETE`, every transition is caused by a blackboard finding and visible live — no manual state edits. (INFORMATION_ARCHITECTURE AC1.)
3. **All six pipelines traceable end-to-end** with an automated smoke test per mode (exit 0 = chain sound). (E2E AC1.)
4. **Every screen has a backend contract** with owner, errors, cache, refresh. (API_CONTRACTS AC1–2.)
5. **Assurance enforced.** A VERIFIED finding passed the 6-gate validation + critic review; reports are gated; HIGH-stakes ops require approval. (BLACKBOARD/SECOND_BRAIN/API ACs.)
6. **Realtime, resilient.** Updates are typed/targeted, cursor-replayable, with a stale indicator and backpressure. (REALTIME AC1–4.)
7. **Single source of truth.** Postgres (+ file blackboard) authoritative; HP-TSA tree derived; read-model feeds UI; `council_state.json` retired. (STATE_MANAGEMENT AC1–5.)

---

## 6. Risk register

| Risk | Mitigation |
|---|---|
| Porting Python→sidecar adds operational complexity (Python env, Postgres) on Windows | Option A with bundled Python + SQLite fallback (`effect-sqlite-node` exists in fork) |
| opencode-harness dependency (agent execution) couples VRAX to an external tool | Keep dispatcher seam abstracted; claude/opencode swappable (reference already does this) |
| Scope is large (125 reds) | Phase 0 first; CRASH-only vertical slice end-to-end before breadth |
| MCP servers (IDA/BN/Ghidra) require licensed tools running locally | MCP discovery degrades gracefully to LIEF (BinaryAnalysis-MCP); UI shows DEGRADED honestly |
| Hallucinated findings if critic/validation skipped | Make validation+critic NON-NEGOTIABLE in the report gate; never allow bypass in production |

---

## 7. Bottom line

VRAX's UI is a competent, honest shell over an empty room. The room's contents — orchestrator, blackboard, agents, MCP, brains, intel, reports — are fully specified in the reference and in documents 2–13 of this set. The work is porting (Option A: sidecar the reference runtime, rebranded), building the API layer, and rewiring the existing reactive renderer onto the authoritative read-model. There is no need to redesign the UI on aesthetics; the directive is satisfied by making the UI a live projection of the real runtime these documents specify.
