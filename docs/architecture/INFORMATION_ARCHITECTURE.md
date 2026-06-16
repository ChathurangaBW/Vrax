# 2. INFORMATION_ARCHITECTURE.md

**Subject:** The execution lifecycle that the entire VRAX UI must be organized around.

---

## 0. Runtime Status

🔴 **No execution lifecycle exists in VRAX today.** The canonical UI is a flat page-switcher (`navigate()`, `app.js:8-16`) over 13 pages with no notion of campaign progression. The only sequencing it models is the 6-card CRASH pipeline list (`app.js:283-290`), and even that is a static render of the legacy `council_state.json` phase statuses — nothing drives it forward. The directive's lifecycle (Target Selection → Registration → Workspace → MCP Discovery → … → Campaign Completion) is, in VRAX, not implemented at all.

The authoritative lifecycle is defined in the reference by three interlocking artifacts: `commands/<mode>.md` (the per-mode phase contract), `council_blackboard_schema.json` `pipeline_router` (the canonical phase→finding→agent wiring), and `src/overlay/` (the meta-orchestrator that actually runs it). This document specifies that lifecycle, rebranded as VRAX, as the spine the UI must be rebuilt around.

---

## 1. Current State (As-Built)

- **Navigation model:** `navigate(page)` (`app.js:8`) is the only IA primitive. It toggles `.active` on `.page`/`.ni` elements. There is no campaign context, no mode, no phase cursor.
- **Pages are siblings, not stages:** Targets, Campaigns, Overview, Sections, Imports, Exports, Pipeline, Swarm, Evidence, Blackboard, Reports sit in one flat sidebar (`index.html:69-85`). Nothing groups them by lifecycle stage, and nothing is gated by progress (e.g. you can open Reports when nothing has run).
- **The only lifecycle artifact:** the 6-entry `phases` array in `renderPipeline` (`app.js:283-290`) and the mirrored Operator Console phase list (`index.html:256-285`). Both are CRASH-only and hardcoded.
- **`council_state.json` fields that imply a lifecycle:** `session_id`, `target_binary`, `pipeline_mode`, `current_phase` (int), `phases.{1_mapping,2_vulnerability,2.5_zero_day_hunt,2.6_poc_validation,3_harness,3_patcher,4_verification,5_report,uac_bypass_findings}`. This is a **per-target snapshot**, not a campaign event log — it records *latest state*, not *how we got there*.

**Net:** the UI's information architecture is "a control panel with 13 buttons," not "a live representation of a running campaign."

---

## 2. Target Architecture — the VRAX Execution Lifecycle

The canonical lifecycle (from reference `pipeline_router` + `src/main.py` + `src/overlay/run_overlay.py`), rebranded. Each stage produces a **finding on the blackboard** that both (a) proves the stage ran and (b) authoritatively triggers the next stage. The UI must visualize this chain, not a flat page list.

```
USER selects binary (EXE/DLL/ELF/Mach-O)
   │
1. TARGET SELECTION ─────────────── app.js browseFiles() → vrax.openFile()  [🟡 partially: only picks path]
   ▼
2. TARGET REGISTRATION ──────────── TARGET_REGISTERED finding (Phase 0)     [🔴 missing]
   │   resolve_target.py → workspace dir, type, metadata, sha256, env
   ▼
3. WORKSPACE CREATION ───────────── campaigns/<id>/ + blackboard.json init  [🔴 missing]
   ▼
4. MCP DISCOVERY (Phase 0) ──────── MCPDiscoveryEngine 6-phase protocol     [🔴 missing]
   │   enumerate→reachable→initialize→tools/list→register→binary_discovery
   ▼
5. CONTEXT COLLECTION (0.5) ─────── knowledge-base RESEARCH_COMPLETE        [🔴 missing]
   │   (MANDATORY — blocks downstream; pre-poc-research side-brain)
   ▼
6. TRIAGE GATE (0.1) ─────────────── TRIAGE_DECISION (CVSS, bounty range)    [🔴 missing]
   ▼
7. PIPELINE SELECTION ───────────── pipeline_router resolves mode → tree    [🔴 missing]
   ▼
8. ORCHESTRATOR ACTIVATION ──────── MetaOrchestrator.run() tick loop        [🔴 missing]
   │   (HP-TSA planner refresh → committee assign → dispatch → repeat)
   ▼
9. AGENT EXECUTION ──────────────── agent_runs rows (per delegation)        [🔴 missing]
   │   dispatcher → opencode/claude run → delegation_plan.json
   ▼
10. BLACKBOARD EVOLUTION ────────── findings written, pheromone boost/decay [🔴 missing]
   │   AGENT_TRIGGERS fire next agents when φ crosses threshold
   ▼
11. VALIDATION ──────────────────── ValidationGate (6-gate) + SandboxRunner [🔴 missing]
   │   ValidationStatus DISCOVERED→…→VERIFIED; 3/3 PoC reproduction
   ▼
12. CONSENSUS ───────────────────── 67% supermajority, anti-anchoring vote  [🔴 missing]
   │   CONSENSUS_REACHED finding
   ▼
13. ARTIFACT GENERATION ─────────── harness/patcher/report-generator output  [🔴 missing]
   ▼
14. REPORTING ───────────────────── ReportQualityGate → signed report JSON  [🔴 missing]
   │   (blocked unless every finding VERIFIED/FALSE_POSITIVE/REJECTED)
   ▼
15. KNOWLEDGE STORAGE ───────────── brain-sync → Central Brain (sha256-keyed)[🔴 missing]
   │
16. CAMPAIGN COMPLETION ─────────── CAMPAIGN_COMPLETE finding, status=done  [🔴 missing]
```

### 2.1 The single source of truth for progression

**The blackboard is the lifecycle.** A stage is "done" iff its terminal finding exists at the required `ValidationStatus` and pheromone. The UI must **never** infer progress from a `current_phase` integer; it must read the plan tree's satisfied nodes (HP-TSA `PlanNode.state == SATISFIED`). This eliminates the entire class of "the UI says phase 3 but phase 2 never actually verified" drift that the legacy integer model invites.

### 2.2 Pipeline modes map to different trees, not different pages

All six modes (`commands/*.md`) share the **same lifecycle spine** but instantiate different HP-TSA plan trees with different terminal `success_finding` values:

| Mode | Root success_finding | Distinct stages |
|---|---|---|
| `CRASH` | `VERIFICATION_RESULT` (3/3) | mapping→vuln-isolation→harness→qa |
| `PATCH` | `VERIFICATION_RESULT` | mapping(license)→patcher→qa |
| `CTF` | `FLAG_EXTRACTED` | mapping→flag-extract OR patcher→qa |
| `MALWARE` | `YARA_RULES_GENERATED` | malware-analyst standalone |
| `ZERO_DAY` | `VERIFICATION_RESULT` | mapping→zd-hunt→2.6 PoC→exploit→qa |
| `UAC-BYPASS` | `UAC_BYPASS_VALIDATED` | discovery(4×8)→native C PoC→validator 3/3 |

**IA consequence:** the UI must re-derive its phase/agent/pipeline view from the **active mode's plan tree**, not a fixed 6-card list. Switching modes is not "open a different page" — it is "load a different plan tree."

---

## 3. UI Surface Mapping — reorganizing the flat sidebar

The directive says "Stop thinking about pages." The pragmatic translation: keep pages as *views*, but group them by lifecycle stage and gate them by progress. Proposed IA:

```
LIFECYCLE STAGE          UI VIEWS (current pages)                 GATING
─────────────────────────────────────────────────────────────────────────
① SETUP                  Targets (register), Campaigns (queue)    always available
② ENVIRONMENT            MCP Hub*, Overview, Sections, Imports,   available after TARGET_REGISTERED
                         Exports  [← BinaryAnalysis-MCP data]
③ EXECUTION              Pipeline (=HP-TSA tree), Swarm (=runs),  available after ORCHESTRATOR ACTIVATION
                         Blackboard (=findings)
④ ASSURANCE              Evidence, Consensus*, Critic*            available after first VERIFIED candidate
⑤ OUTPUTS                Reports, Knowledge (Central Brain)*      available after REPORT_GENERATED
─────────────────────────────────────────────────────────────────────────
* = new view required (currently absent or inert)
```

- The **Operator Console** (right rail) becomes the persistent lifecycle cursor: it always shows the *current* stage, the current HP-TSA frontier node, the active agent, and the next trigger condition. It is the spine made visible.
- **Campaign bar** (`renderCamBar`, `app.js:506`) becomes the breadcrumb `campaigns / <target> / <mode> / stage-N / <node>`.
- Pages do not disappear, but their empty states now say *why* they're empty ("awaiting TARGET_REGISTERED", "awaiting MCP discovery"), making the lifecycle legible.

---

## 4. Gap Analysis

| # | Lifecycle stage | Status | Evidence | Build requirement |
|---|---|---|---|---|
| L1 | Target selection | 🟡 | `app.js:528` picks path only | Add registration: write TARGET_REGISTERED, create workspace |
| L2 | Target registration | 🔴 | no `resolve_target` port | Port `resolve_target.py`; compute sha256/type/metadata |
| L3 | Workspace creation | 🔴 | `main.js` reads one global file | Per-campaign dir + `blackboard.json` init |
| L4 | MCP discovery | 🔴 | hardcoded 3/3 panel | Port `MCPDiscoveryEngine`; surface in MCP Hub |
| L5 | Context/research | 🔴 | no knowledge-base lookup | Port knowledge-base `RESEARCH_COMPLETE` gate |
| L6 | Triage gate | 🔴 | none | Port `TriageGate` → `TRIAGE_DECISION` finding |
| L7 | Pipeline selection | 🔴 | hardcoded CRASH list | Port `pipeline_router`; instantiate per-mode plan tree |
| L8 | Orchestrator loop | 🔴 | none | Port `MetaOrchestrator.tick()` loop |
| L9 | Agent execution | 🔴 | inferred swarm state | Port dispatcher + `agent_runs` table |
| L10 | Blackboard evolution | 🔴 | legacy phase snapshot | Port `Blackboard` + `current_pheromone()` |
| L11 | Validation | 🔴 | none | Port `ValidationGate` + `SandboxRunner` |
| L12 | Consensus | 🔴 | none | Port consensus vote (67% supermajority) |
| L13 | Artifact generation | 🔴 | none | Port harness/patcher/report-generator |
| L14 | Reporting | 🔴 | inert Export button | Port `ReportQualityGate` + `ReportSigner` |
| L15 | Knowledge storage | 🔴 | none | Port `brain-sync` → Central Brain |
| L16 | Campaign completion | 🔴 | none | Emit `CAMPAIGN_COMPLETE`, set status |
| L17 | Lifecycle-as-IA (grouped/gated views) | 🔴 | flat sidebar | Reorganize sidebar by stage; gate by findings |
| L18 | Mode-aware plan tree view | 🔴 | fixed CRASH cards | Render HP-TSA tree from active mode |

---

## 5. Acceptance Criteria

1. From binary selection to `CAMPAIGN_COMPLETE`, every stage transition is caused by a blackboard finding write — observable as a new row in the Blackboard view and a node flip in the Pipeline (HP-TSA) view, with no manual state edits.
2. The Operator Console always displays the current lifecycle stage, current frontier node, and the exact trigger condition being awaited.
3. Switching pipeline mode restructures the Pipeline and Swarm views to match that mode's plan tree and agent roster — verified for all six modes.
4. No view shows data for a stage that has not produced its terminal finding (e.g. Reports is empty/gated until `REPORT_GENERATED`).
5. Killing the orchestrator mid-run leaves the UI in a coherent state: the Pipeline shows the last SATISFIED node, the Blackboard shows findings with their true validation status, and resumption re-enters at the correct frontier (not at `current_phase` integer).
