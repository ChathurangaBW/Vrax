# VRAX Architecture — Index

**Generated:** 2026-06-16
**Project root:** `D:\vrax` (git branch `VRAX`)
**Scope:** Complete UI / runtime / dataflow / wiring / execution review.
**Method:** Every claim is grounded in one of three read-only sources of truth:

1. **The live VRAX Electron app** — `D:\vrax\electron\{main.js, preload.js, renderer/app.js, renderer/index.html}`. This is the canonical, tracked UI.
2. **The state file it consumes** — `D:\vrax\agents\council_state.json` (the template currently checked in) + `D:\vrax\campaigns\<name>\council_state.json` (per-campaign, scanned at runtime).
3. **The reference runtime** — `C:\Users\Sniffer\.opencode` ("Council V2"): a complete Python orchestrator that VRAX must be built to match, **rebranded as VRAX**. Its Python modules, Postgres schema, agent playbooks, and pipeline definitions are the source of truth for the *target* architecture. `opencode` (the agent-execution harness) is treated as an implementation dependency and rebranded; it is never a user-facing name.

There is also an **untracked redesign mock** at `D:\vrax\renderer\` (75 KB `index.html` + a trailing demo `<script>` that animates fake findings on a timer) and a copy at `D:\vrax-project\`. These represent the *visual* direction but are **not** wired to anything. They are referenced only for UI-surface mapping, never as evidence of runtime behavior.

---

## Corrected ground truth (this supersedes any earlier draft)

The first draft of this work wrongly described VRAX as a "static HTML mock." That was the result of auditing the wrong artifact (`D:\vrax\renderer/`, the untracked mock) instead of the canonical app. The **correct** picture, verified by reading the actual code:

**VRAX today is a real, live-updating viewer for `council_state.json` — not a static mock.**

| File | Lines | What it actually does |
|---|---|---|
| `electron/main.js` | 127 | Reads `agents\council_state.json`, **`fs.watch`-es it**, and pushes `state-update` IPC events to the renderer on every change. Scans `campaigns\<name>\council_state.json` for campaigns. Full IPC: `get-state`, `get-campaigns`, `load-state-file`, `open-file`, `open-folder`. |
| `electron/preload.js` | 16 | Exposes `window.vrax` with all IPC channels + live `onStateUpdate` / `onCampaignsUpdate` listeners. |
| `electron/renderer/app.js` | 559 | Reactive renderer. `collectFindings(state)` → `renderBlackboard/Pipeline/Swarm/Overview/OpcStatus/CamBar`. Pages render from **empty states**; there is zero hardcoded finding data. |
| `electron/renderer/index.html` | 328 | Page shells with `id`-ed mount points the JS populates. |
| `agents/council_state.json` | 109 (template) | The state the UI consumes. Currently all phases `pending` — so the UI shows empty states, which is *honest*, not fake. |

**So the real gap is narrower and more specific than "it's a mock":**

1. **Wrong source of truth.** The UI consumes the **legacy** per-target `council_state.json` schema. The reference's own audit docs mark `council_state.json` as `__DEPRECATED__` (as of 2026-06-14); the authoritative models are `blackboard.json` (file blackboard) + the Postgres `findings`/`evidence`/`agent_runs`/`audit_log` tables + the HP-TSA plan tree. VRAX renders none of the authoritative system.
2. **No producer.** Nothing inside `D:\vrax` *writes* `council_state.json` during analysis. The orchestrator, agents, MCP engine, validation/critic brains, and intelligence pollers all live in the **reference** tree, not in VRAX. VRAX has a view with no engine.
3. **Inert widgets.** MCP toggles, Settings inputs, Export Report, the operator prompt input, and the `Add to report` buttons are present but do nothing — they have no IPC handler.
4. **Simplified model.** The renderer derives pheromone/severity from `cvss_score/10` or fixed constants (e.g. `sev_score: 0.95` for exploit chains) rather than from the real `current_pheromone()` decay function and the validation gate's evidence scoring.

This is a solid foundation: the plumbing (Electron ↔ IPC ↔ reactive render) is real. What's missing is the runtime that produces authoritative state and the rewiring of the UI to read it.

---

## Deliverables

Each follows one template: `0. Runtime Status · 1. Current State (As-Built, file evidence) · 2. Target Architecture (reference, rebranded) · 3. UI Surface Mapping · 4. Gap Analysis (🟢/🟡/🔴) · 5. Acceptance Criteria`.

| # | Document | Status of subject |
|---|----------|-------------------|
| 1 | [UI_AUDIT.md](./UI_AUDIT.md) | 🟡/🟢 — live viewer, legacy state, inert widgets |
| 2 | [INFORMATION_ARCHITECTURE.md](./INFORMATION_ARCHITECTURE.md) | 🔴 execution lifecycle spine |
| 3 | [TARGET_SYSTEM_ARCHITECTURE.md](./TARGET_SYSTEM_ARCHITECTURE.md) | 🔴 authoritative target registry |
| 4 | [ORCHESTRATOR_VISIBILITY_ARCHITECTURE.md](./ORCHESTRATOR_VISIBILITY_ARCHITECTURE.md) | 🔴 meta-orchestrator + HP-TSA planner |
| 5 | [BLACKBOARD_UI_ARCHITECTURE.md](./BLACKBOARD_UI_ARCHITECTURE.md) | 🔴 pheromone blackboard as first-class state |
| 6 | [AGENT_RUNTIME_ARCHITECTURE.md](./AGENT_RUNTIME_ARCHITECTURE.md) | 🔴 ~20 agents + model tiers + runs |
| 7 | [MCP_RUNTIME_ARCHITECTURE.md](./MCP_RUNTIME_ARCHITECTURE.md) | 🔴 IDA/BN/Ghidra discovery + recovery |
| 8 | [SECOND_BRAIN_ARCHITECTURE.md](./SECOND_BRAIN_ARCHITECTURE.md) | 🔴 knowledge store + critic brain |
| 9 | [API_CONTRACTS.md](./API_CONTRACTS.md) | 🔴 one contract per UI surface |
| 10 | [STATE_MANAGEMENT_ARCHITECTURE.md](./STATE_MANAGEMENT_ARCHITECTURE.md) | 🔴 Postgres + JSON file blackboard |
| 11 | [EVENT_SYSTEM_ARCHITECTURE.md](./EVENT_SYSTEM_ARCHITECTURE.md) | 🔴 audit_log + poll + delegation |
| 12 | [REALTIME_UPDATE_ARCHITECTURE.md](./REALTIME_UPDATE_ARCHITECTURE.md) | 🟡→🔴 `fs.watch` today → must become event stream |
| 13 | [END_TO_END_PIPELINE_VALIDATION.md](./END_TO_END_PIPELINE_VALIDATION.md) | 🔴 trace per pipeline mode |
| 14 | [PRODUCTION_READINESS_REPORT.md](./PRODUCTION_READINESS_REPORT.md) | 🔴 synthesis + build roadmap |

**Legend:** 🟢 exists and wired · 🟡 present but inert / wrong source · 🔴 missing in VRAX (exists in reference; must be ported).

**Naming convention:** `council` → `vrax`; `opencode`/`claude` dispatchers → the **VRAX agent dispatcher**; side-brains keep their role, VRAX-branded. Opencode-ai remains only as an internal execution dependency.

**One-line summary:** VRAX today is a live viewer for a deprecated state file, with a real Electron/IPC/reactive-render pipeline but no engine behind it. These 14 documents specify the authoritative runtime (modeled on a working reference) that must produce the state the UI consumes, and the precise rewiring required to make the UI a true live representation of that runtime.
