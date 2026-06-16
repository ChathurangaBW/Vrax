# 1. UI_AUDIT.md

**Subject:** The canonical VRAX Electron UI.
**Audited artifacts (all in `D:\vrax`):**
- `electron/main.js` (127 lines) — main process, state file I/O, IPC, file watcher.
- `electron/preload.js` (16 lines) — `window.vrax` bridge.
- `electron/renderer/app.js` (559 lines) — reactive renderer.
- `electron/renderer/index.html` (328 lines) — page shells + mount points.
- `agents/council_state.json` (template, 109 fields) — the state the UI consumes.
- `campaigns/<name>/council_state.json` — per-campaign state (scanned; none present today beyond `config/`, `demo_exe/` which have no state file).
- `D:\vrax\renderer\` (untracked 75 KB mock) — referenced only as the *visual* redesign target; not wired.

---

## 0. Runtime Status

**🟡 Live viewer, correct plumbing, wrong source of truth, several inert widgets.**

VRAX is **not** a static mock. The main process reads `agents\council_state.json`, watches it with `fs.watch`, and pushes every change to the renderer (`main.js:36-46`, `main.js:42`). The renderer has a genuine reactive pipeline (`app.js:517-525` `renderAll`) that turns that state into Blackboard, Pipeline, Swarm, Overview, and Operator-Console views (`app.js:195-503`). Pages render from empty states when there is no data (`index.html:126-131`), so the UI is **honest** when idle — it shows "No active campaign," not fake findings.

The defects are precise:

1. **Deprecated state model.** The UI renders `council_state.json`, which the reference marks `__DEPRECATED__` (superseded by `blackboard.json` + Postgres `findings`/`evidence`/`agent_runs` + the HP-TSA plan tree). It therefore cannot represent pheromone decay, validation status, evidence, consensus, agent runs, or MCP state — none of which exist in this schema.
2. **No producer.** Nothing in `D:\vrax` mutates `council_state.json` during analysis. The orchestrator/agents/MCP live only in the reference tree. VRAX is a view with no engine; the file changes only when a human edits it.
3. **Inert controls.** MCP server toggles (`index.html:92-103`), all Settings inputs (`index.html:306-323`), `Export Report` (`index.html:54`), the operator prompt (`index.html:290-294`), and `Add to report` (`app.js:264`) have no IPC handler — clicking them changes only CSS classes.
4. **Fabricated derived values.** Severity/pheromone are derived from `cvss_score/10` or hardcoded constants (`app.js:111`, `app.js:123`, `app.js:135`, `app.js:170`), not from the real `current_pheromone()` decay or the validation gate's evidence scoring.

---

## 1. Current State (As-Built) — element by element

### 1.1 Navigation / chrome

| Element | Location | Wired? | Notes |
|---|---|---|---|
| Window controls (close/min/max) | `index.html:29-37`; `app.js:56-63` | 🟢 | Call `window.vrax.close/minimize/maximize` → IPC → `win.minimize()` etc. (`main.js:76-78`). Works. |
| Back/forward arrows | `index.html:34-37` | 🔴 | No `onclick`, no handler. Decorative. |
| Nav items: New Project, Settings, TTP Library, Toolbox, MCP Hub, User Guide | `index.html:43-48` | 🟡 | Only `New Project`→`navigate('targets')` and `Settings`→`openSettings()` are wired. The other four do nothing. |
| Status pill (mode · phase) | `index.html:50-53` | 🟢 | `id="opc-status-txt"` updated by `renderOpcStatus` (`app.js:478-503`). Reflects `current_phase`. |
| Export Report button | `index.html:54` | 🔴 | No handler. |
| Campaign bar path | `index.html:61` | 🟢 | `renderCamBar` (`app.js:506-514`) sets `campaigns / <target> / phase-N`. |

### 1.2 Sidebar (workspace nav)

| Item | Location | Wired? | Notes |
|---|---|---|---|
| Workspace: Targets, Campaigns | `index.html:71-72` | 🟢 | `navigate()` toggles `.active`. |
| Analysis: Overview, Sections, Imports, Exports | `index.html:74-77` | 🟡 | Navigation works; **Overview** is populated (`renderOverview`), but **Sections / Imports / Exports** are static empty states (`index.html:207-222`) with no render function — they have no data source even in the legacy schema. |
| Execution: Pipeline, Swarm | `index.html:79-80` | 🟢 | Both fully rendered (`renderPipeline`, `renderSwarm`). |
| Intel: Evidence, Blackboard | `index.html:82-83` | 🟡/🟢 | **Blackboard** is the default page and fully rendered. **Evidence** page exists (`index.html:135-140`) but `app.js` has **no `renderEvidence` function** — `evidence-list` is never populated. Evidence as a concept does not exist in `council_state.json`. |
| Outputs: Reports | `index.html:85` | 🔴 | Page shell only (`index.html:183-188`); no render function, no data. |

### 1.3 Sidebar — MCP Servers panel

| Element | Location | Wired? | Notes |
|---|---|---|---|
| Header `3/3` | `index.html:89-90` | 🔴 | Hardcoded `3/3`. Not derived from any discovery result. |
| Three rows (ghidra/ida/binja) with PRI/SEC badges + toggles | `index.html:92-103` | 🔴 | Entirely hardcoded. `toggleMcp` (`app.js:25-32`) only flips CSS classes — does not call any IPC. No MCP discovery engine exists in VRAX. |

### 1.4 Blackboard page (default)

| Element | Location | Wired? | Notes |
|---|---|---|---|
| Header sub (finding count) + timestamp | `index.html:114-115` | 🟢 | `renderBlackboard` sets count (`app.js:207`); timestamp `bb-ts` is declared in HTML but **never written** by JS — stale/empty. |
| Severity filter chips + counts | `index.html:118-123` | 🟢 | `filterBB` (`app.js:35-43`) filters cards by `.fc-<sev>`; counts computed from findings (`app.js:210-218`). Works against derived severity. |
| Finding cards | `bb-list` | 🟡 | Generated by `collectFindings` → `renderBlackboard` (`app.js:227-269`). **But** the findings are mined from legacy phase fields, not a real findings store, and pheromone = `cvss_score/10` or a fixed constant. |
| `Add to report` button | `app.js:264` | 🔴 | No handler. |

**Critical model gaps vs. the authoritative blackboard:** the legacy schema has no `finding_type` enum, no `pheromone_weight`/`half_life`/`decay_curve`, no `ValidationStatus` lifecycle, no `produced_by`/`consumed_by`, no evidence links, no consensus state, no `fingerprint` dedup. The UI cannot show any of these because the state file does not carry them. (See BLACKBOARD_UI_ARCHITECTURE.md §2.)

### 1.5 Pipeline page

| Element | Location | Wired? | Notes |
|---|---|---|---|
| Phase cards (6) | `pipeline-content` | 🟢 | `renderPipeline` (`app.js:273-325`) maps 6 legacy phase keys to cards with DONE/RUNNING/QUEUED badges from each phase's `status` field. |
| Phase model | `app.js:283-290` | 🟡 | Hardcodes 6 phases: `1_mapping, 2_vulnerability, 2.5_zero_day_hunt, 3_harness, 4_verification, 5_report`. This matches the **CRASH** path only. No UAC, no Phase 0 (MCP discovery), no 0.1 triage, no 0.5 research, no 2.6/2.7/3-patcher/4.5/4.6/5 sub-phases from the reference pipeline_router. |

### 1.6 Swarm page + Operator Console swarm rows

| Element | Location | Wired? | Notes |
|---|---|---|---|
| Swarm cards | `swarm-content` | 🟢 | `renderSwarm` (`app.js:328-383`) renders 5 agents (`app.js:333-339`): council-orchestrator, security-analyst, vuln-isolator, zero-day-hunter, harness-engineer. |
| Agent state | `app.js:350-361` | 🟡 | State is *inferred from phase status* (`status==='in_progress'`→running). Pheromone is fabricated: `isDone?0.78:isRun?0.72:0.00` (`app.js:358`). No real per-agent run record. |
| Operator Console swarm rows | `opc-swarm-rows` | 🟢 | Mirrored from same render (`app.js:364-382`). |
| Agent roster | `app.js:333-339` | 🔴 | Only 5 of ~20 reference agents shown. No malware-analyst, patcher, qa-tester, telemetry-structurer, cve-researcher, rop-chain-builder, validation-authority, critic-brain, audit-brain, etc. |

### 1.7 Operator Console (right rail)

| Element | Location | Wired? | Notes |
|---|---|---|---|
| Current Analysis (binary/phase/findings) | `index.html:238-240` | 🟢 | `renderOpcStatus` (`app.js:478-503`). |
| Phase Pipeline list (6 items) | `index.html:256-285` | 🔴 | **Static HTML.** Has `id="ph-cb-N"` / `ph-t-N` hooks but `app.js` never writes to them. The progress comes only from the *Pipeline page* render, not these rail items. |
| Prompt input + send | `index.html:290-294` | 🔴 | No submit handler. Cannot dispatch to any agent. |

### 1.8 Targets page

| Element | Location | Wired? | Notes |
|---|---|---|---|
| Load binary card → `browseFiles()` | `index.html:152` | 🟡 | `browseFiles` (`app.js:528-535`) opens the OS dialog via `window.vrax.openFile` and then **`alert()`s** the user to "manually update council_state.json." It does **not** register a target, create a workspace, or start analysis. |
| Scan folder card | `index.html:158` | 🔴 | Button has no handler. |
| Active campaign state | `targets-state` (`index.html:162`) | 🔴 | Declared but never written. |
| Recent targets | (mock only, `D:\vrax\renderer\`) | n/a | Not present in canonical UI. |

### 1.9 Overview page

| Element | Location | Wired? | Notes |
|---|---|---|---|
| 9 metric cards | `overview-content` | 🟢 | `renderOverview` (`app.js:451-475`) reads `target_binary`, `1_mapping.architecture`, `mitigations.{aslr,dep,cfg,stack_cookies}`, `current_phase`, `session_id`, `workspace_dir`. |
| Coverage | — | 🟡 | Shows only what `1_mapping` carries. No entry point/image base/SHA-256/entropy/compile time/linker/subsystem (the mock shows these; the canonical UI does not, because the legacy schema has no binary-metadata block). |

### 1.10 Sections / Imports / Exports pages

All three are static empty states (`index.html:207-222`) with **no render function and no data source**. The legacy `council_state.json` schema contains no section/import/export tables. These pages are pure placeholders. 🔴

### 1.11 Evidence page

Shell only (`index.html:135-140`). **No `renderEvidence` function exists in `app.js`.** Evidence as a first-class object (EXECUTION/INTEL/SCREENSHOT/NETWORK_CAPTURE/ASAN_OUTPUT/CRASH_DUMP/MEMORY_DUMP/POC_INPUT) exists only in the reference `evidence` table. 🔴

### 1.12 Reports page

Shell only (`index.html:183-188`). No render function, no report store. 🔴

### 1.13 Settings modal

| Group | Location | Wired? | Notes |
|---|---|---|---|
| MCP Endpoints (3 inputs) | `index.html:307-311` | 🔴 | Inputs not bound; nothing reads or persists them. |
| Model (orchestrator/worker) | `index.html:313-316` | 🔴 | Hardcoded placeholder values; no binding. |
| Analysis (decay/max-iters/consensus) | `index.html:318-322` | 🔴 | Hardcoded; no binding. |

---

## 2. Target Architecture (reference, rebranded)

The authoritative UI must be a projection of the **VRAX runtime**, whose target shape is the reference system (`C:\Users\Sniffer\.opencode`), rebranded. The UI must consume, not `council_state.json`, but the live runtime's data:

- **Blackboard** = Postgres `findings` (with `current_pheromone()` decay) + `finding_fingerprints` + `evidence` + `finding_intel_links`, exposed via a query API. (See BLACKBOARD_UI_ARCHITECTURE.md.)
- **Pipeline** = the HP-TSA plan tree (`PlanNode` states PENDING→FRONTIER→ACTIVE→SATISFIED|DEAD) per pipeline mode, not a fixed 6-card list. (See ORCHESTRATOR_VISIBILITY_ARCHITECTURE.md.)
- **Swarm** = `agent_runs` (status RUNNING/COMPLETE/FAILED/TIMEOUT/APPROVAL_PENDING/REJECTED, model, tokens, cost, findings_produced, trace_id). (See AGENT_RUNTIME_ARCHITECTURE.md.)
- **MCP panel** = `MCPDiscoveryEngine` result: `MCPServerResult{status, server_version, capabilities, tools, active_binary, binary_sha256, initialization_ms}` + `MCPRecoveryEngine` health/latency/retry state. (See MCP_RUNTIME_ARCHITECTURE.md.)
- **Evidence** = the `evidence` table (immutable, append-only, evidence-class A/B/C/D, run_number, artifact_sha256).
- **Overview/Sections/Imports/Exports** = the **BinaryAnalysis-MCP** one-shot `get_binary_report` (info+headers+sections+security), not the legacy `1_mapping` block.
- **Reports** = `report-generator`/`bounty-reporter` artifacts gated by `ReportQualityGate` (signed JSON envelope + PDF).
- **Operator Console** = the meta-orchestrator's `current_state_block()` (Current Vector / Hypothesis / Active Sub-Loop / Progress / Dead Paths) + HITL `approval_requests` + prompt dispatch into the VRAX agent dispatcher.

---

## 3. UI Surface Mapping (mock vs. canonical vs. required)

| Surface | Canonical `electron/renderer` (live) | Untracked `renderer/` mock (visual target) | What the runtime requires |
|---|---|---|---|
| Blackboard | derived from legacy phases, fake φ | 6 richly detailed cards w/ IDA decompile, xrefs, "3 agents" | real `findings` w/ decay, evidence, producers/consumers, lifecycle |
| Pipeline | 6 fixed CRASH cards | 4 CRASH cards, animated progress | HP-TSA plan tree per mode |
| Swarm | 5 agents, inferred state, fake φ | 5 agents w/ task lines | ~20 agents from `agent_runs`, real models/cost |
| MCP | 3 hardcoded rows, toggle = CSS | 3 rows w/ PRI/SEC | discovery result + health/recovery |
| Evidence | empty (no renderer) | 6 evidence cards | `evidence` table |
| Reports | empty (no renderer) | draft + 2 archived PDFs | signed report artifacts + quality gate |
| Overview | 9 cards from `1_mapping` | 12 cards incl. SHA-256/entropy/linker | BinaryAnalysis-MCP report |
| Sections/Imports/Exports | static empty | full tables | BinaryAnalysis-MCP tools |
| Operator Console | status ✓, prompt ✗, phase list static | animated feed + prompt | orchestrator state block + dispatch |

**Key reconciliation:** The untracked `renderer/` mock is the *better visual* (richer cards, real-looking IDA output, animated feed) but is a **movie** — its findings are hardcoded and its "live" motion is a timer-driven `<script>`. The canonical `electron/renderer` is plainer but **honest and wired**. The production UI should keep the canonical plumbing and adopt the mock's visual density — fed by real data.

---

## 4. Gap Analysis

| # | Capability | Status | Evidence | Build requirement |
|---|---|---|---|---|
| G1 | Live state propagation | 🟢 | `main.js:36-46` fs.watch → `state-update` | Keep; upgrade channel to event stream (REALTIME_UPDATE_ARCHITECTURE.md) |
| G2 | Reactive render | 🟢 | `app.js:517-525` | Keep; add renderers for evidence/reports/sections/imports/exports |
| G3 | Authoritative state source | 🔴 | consumes `council_state.json` (deprecated) | Port reference blackboard+Postgres; read `findings`/`agent_runs`/`audit_log` |
| G4 | Real pheromone/deacy | 🔴 | `app.js:111-135` fabricated | Compute via `current_pheromone(weight,half_life,curve,floor,created_at)` |
| G5 | Validation lifecycle UI | 🔴 | not in schema | Render `ValidationStatus` DISCOVERED→…→VERIFIED/REJECTED |
| G6 | Evidence page | 🔴 | no renderer, no data | Port `evidence` table + BinaryAnalysis-MCP |
| G7 | Full pipeline (all modes/phases) | 🟡 | CRASH 6 phases only | Render HP-TSA plan tree from `pipeline_router` |
| G8 | Full agent roster | 🟡 | 5 of ~20 agents | Read `agent_runs`; roster from `agent_model_map.json` |
| G9 | MCP discovery panel | 🔴 | hardcoded 3/3 | Port `MCPDiscoveryEngine`+`MCPRecoveryEngine`; render `MCPServerResult` |
| G10 | Target registration | 🟡 | `browseFiles` → alert | Port `resolve_target.py`+`TARGET_REGISTERED` write + workspace creation |
| G11 | Binary metadata pages | 🔴 | static empty | Call BinaryAnalysis-MCP `get_binary_report`/sections/imports/exports |
| G12 | Reports | 🔴 | no renderer | Port `report-generator` + `ReportQualityGate` + `ReportSigner` |
| G13 | Operator dispatch | 🔴 | prompt input no handler | Wire prompt → VRAX agent dispatcher (`build_prompt`+`delegation_plan.json`) |
| G14 | HITL approval gates | 🔴 | none | Render `approval_requests` (PATCH_BINARY/RUN_EXPLOIT/REPORT_0DAY/VALIDATE_UAC) |
| G15 | Settings persistence | 🔴 | inputs unbound | Bind to `mcp_config.json` + `agent_model_map.json` + `tool_paths.json` |
| G16 | Second-brain / intel UI | 🔴 | none | Render `intelligence_records`/`finding_intel_links` + knowledge-base (SECOND_BRAIN_ARCHITECTURE.md) |

---

## 5. Acceptance Criteria (how we prove each is real, not mocked)

A surface is "done" only when **all** hold:

1. **No hardcoded domain values.**grep the renderer for finding names, φ scores, agent tasks, MCP counts — there must be none; every value originates from an IPC call returning runtime data.
2. **Empty-state honesty.** With no campaign, the surface shows its empty state; with a real campaign, it reflects that campaign's actual `findings`/`agent_runs`/`MCPServerResult`.
3. **Live update.** Mutating the underlying state (a new finding written, an agent run finishing) updates the surface within one render tick without reload — via the realtime channel, not a manual refresh.
4. **Traceability.** Every displayed finding links to its `produced_by` agent run, its evidence rows, and its reasoning trace; clicking "Open in IDA" jumps to the real address in a connected IDA instance (not a fake button).
5. **Mode correctness.** Switching pipeline mode (CRASH/MALWARE/PATCH/CTF/ZERO_DAY/UAC-BYPASS) changes the visible phase sequence and agent roster to match that mode's `pipeline_router` definition.
6. **Validation gate enforced.** A finding shown as VERIFIED must have passed the 6-gate validation + (if ≥0.85) critic-brain approval; the report export is blocked unless `ReportQualityGate` passes.

Until these hold, the surface is 🟡 at best.

---

**Bottom line for this audit:** VRAX's UI plumbing is real and reactive, but it is wired to a deprecated state model and has no runtime producing that state. Eleven of sixteen capabilities (G3–G16) are red. The remaining 13 architecture documents specify exactly what must be built — modeled on the working reference — to turn this honest-but-empty viewer into a live representation of the real system.
