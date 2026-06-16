# 13. END_TO_END_PIPELINE_VALIDATION.md

**Subject:** Trace every pipeline from target selection to final report, through every UI interaction, API, orchestrator action, agent activation, blackboard update, artifact creation, and campaign completion.

---

## 0. Runtime Status

🔴 **No pipeline can be traced in VRAX today** because no pipeline runs. The only "pipeline" is the 6-card CRASH render (`app.js:283-290`) over a hand-edited file. The directive's six modes — CTF, CRASH, PATCH, MALWARE, ZERO-DAY, UAC-BYPASS — exist in VRAX only as a Settings string and mock badges; none has a runnable contract.

The reference defines all six in `commands/*.md` + `council_blackboard_schema.json` `pipeline_router`, and proves the chain mechanically with `scripts/smoke_test_swarm.py` (simulates each agent's `produces[]` contract, polls the next, exit 0 = chain sound). Below, each mode is traced end-to-end as the *target*, with the UI touchpoint, API, and finding at every hop.

---

## Canonical trace template (shared by all modes)

```
[UI] Targets → target:register
   → TARGET_REGISTERED (φ0.9)  [Blackboard gains root finding; HP-TSA root node SATISFIED-able]
[UI] MCP Hub → mcp:discovery (Phase 0)
   → MCP_READY per server; council-orchestrator confirms binary loaded
[UI] Blackboard → knowledge-base RESEARCH_COMPLETE (Phase 0.5, MANDATORY gate)
   → blocks downstream until present
[UI] (triage, if applicable) → TRIAGE_DECISION
[UI] Pipeline → pipeline:tree shows mode-specific tree; orchestrator ticks
   → per node: committee.assign → dispatch → agent run → produces finding
   → FINDING_WRITTEN events update Blackboard + Pipeline + Swarm live
[UI] Evidence/Validation → validation:result; 3/3 PoC; CriticBrain review
[UI] (consensus, if applicable) → CONSENSUS_REACHED (67%)
[UI] Reports → report:generate gated by ReportQualityGate
   → CAMPAIGN_COMPLETE
[UI] Knowledge → brain-sync to Central Brain (sha256)
```

---

## 1. CRASH

**Root:** `VERIFICATION_RESULT` (3/3 reproduction).

| Hop | Agent (model) | Produces (FindingType) | UI/API |
|---|---|---|---|
| 0 | council-orchestrator (max) | TARGET_REGISTERED | target:register |
| 0 | MCPDiscovery | MCP_READY | mcp:discovery |
| 0.5 | knowledge-base (plus) | RESEARCH_COMPLETE | blackboard gate |
| 1 | security-analyst (pro) | ATTACK_SURFACE_FOUND, MITIGATION_MAPPED | pipeline node SATISFIED |
| 2 | vuln-isolator (pro) | CRASH_ISOLATED, VULNERABILITY_IDENTIFIED | blackboard; trigger zero-day-hunter |
| 2.7 | pre-poc-research (plus) | PRE_POC_RESEARCH_COMPLETE | NON-NEGOTIABLE side-brain |
| 3 | harness-engineer→harness-generator (pro) | HARNESS_COMPILED | artifact; qa re-entry on FAIL |
| 4 | qa-tester (pro) + telemetry-structurer (flash) | VERIFICATION_RESULT (3/3) | sandbox; validation gate |
| 4.5 | validation-authority (max) + critic-brain (max) + audit-brain | VALIDATION_COMPLETE, CRITIC_APPROVED, AUDIT_COMPLETE | assurance |
| 5 | report-generator (plus) | REPORT_GENERATED (gate ALLOW) | report:generate |

**UI trace:** Targets(register) → MCP Hub(3/3 ready) → Blackboard(growing) → Pipeline(tree advancing) → Swarm(agents lighting) → Evidence(3/3 crash) → Reports(signed PDF).

---

## 2. PATCH

**Root:** `VERIFICATION_RESULT`. Distinct: Phase 1 does **license analysis** (validation_algo, registry/network gating, self-integrity checks, patch_points addr+before/after bytes); Phase 3 is patcher (borderless GUI patcher + optional keygen), not harness. Gate P1→3: `patch_points` non-empty && algo documented. Backup + restore + readback required.

| Distinct hops | Agent | Produces |
|---|---|---|
| 1 | security-analyst | LICENSE_CHECK_FOUND, patch_points[], validation_algo |
| 3 | patcher (pro) | PATCH_READY (HIGH-stakes → approval) |
| 4 | qa-tester | VERIFICATION_RESULT (features unlocked + keygen accepted) |

---

## 3. CTF

**Root:** `FLAG_EXTRACTED` (or `VERIFICATION_RESULT`). Min-viable: single jump-flip/NOP patch. security-analyst extracts flag/VM-obfuscation + inline patch bytes; if flag not directly extractable → patcher (min patch) → qa (Success message).

---

## 4. MALWARE

**Root:** `YARA_RULES_GENERATED`. Standalone `malware-analyst` (qwen3.7-plus), **not** in the phased pipeline. Static-only, **anti-anchoring** (strongest benign reason required). Deliverables: unpacked payload, C2 map, config extractor, YARA rules → `malware_analysis.json`.

---

## 5. ZERO-DAY

**Root:** `VERIFICATION_RESULT`. Distinct: Phase 2.5 zero-day-hunter (qwen3.7-max) novel hunting (UAF, heap, type confusion, ROP) → **Phase 2.6 mandatory 3/3 POC** (`poc_successful` gate) → Phase 3 exploit (rop-chain-builder). Gate 2.5→2.6: every vuln has POC script; 2.6→3: `poc_successful≥1`. **No theoretical vulns.** HIGH-stakes → bounty-reporter + MSRC severity + bounty range.

---

## 6. UAC-BYPASS

**Root:** `UAC_BYPASS_VALIDATED`. Three-stage contract (not HP-TSA tree):
- **UAC-1 discovery** (uac-bypass-discovery, qwen3.7-plus): UACME methods 43–82 + 3 anchors (FodHelper, SilentCleanup, APPINFO RPC); 4 IDA rounds × 8 lanes; ≥25 tool calls; writes `ida_evidence.json`/`uac_candidates.json`; compiles native C PoC; task-delegates to uac-poc-validator.
- **UAC-2** native C PoC compile (gcc).
- **UAC-3** uac-poc-validator (pro): lab VM IL Medium→High proof, 3/3 repro, IDA cross-check → `uac_poc_results.json`.
- Gates: ≥25 tool calls + 8 lanes covered; gcc compile + .exe exists; `success_rate:"3/3"`. Loops VALIDATED or EXHAUSTED.

---

## Cross-mode validation: every hop must be observable

For **each** hop above, the following must hold (this is the directive's "trace through every UI interaction/API/orchestrator action/agent/blackboard/artifact"):

1. **UI interaction** — an operator can see the hop happen live (Blackboard gains the finding; Pipeline node flips; Swarm agent lights; Evidence row appears).
2. **API** — the data behind that view came from a contract in API_CONTRACTS (`blackboard:findings`, `pipeline:tree`, `swarm:list`, `evidence:list`).
3. **Orchestrator action** — the hop was caused by a `MetaOrchestrator.tick()` (committee assign + dispatch), recorded as a NODE_* audit event.
4. **Agent activation** — an `agent_runs` row exists with model/tokens/cost/trace_id; trigger source recorded.
5. **Blackboard update** — a `findings` row with producer, pheromone, validation status; TRIGGER_FIRED to consumers.
6. **Artifact creation** — harness/patcher/report outputs are real files with sha256; evidence rows reference them.
7. **Completion** — `CAMPAIGN_COMPLETE` finding; `campaigns.status=COMPLETE`; brain-sync to Central Brain.

---

## Gap Analysis (per mode)

| Mode | Runnable today? | Missing to trace end-to-end |
|---|---|---|
| CRASH | 🔴 | orchestrator, agents, MCP, blackboard, validation, reports |
| PATCH | 🔴 | + license analysis, patcher, backup/restore, PATCH_READY approval |
| CTF | 🔴 | + flag extraction, min-patch, Success assertion |
| MALWARE | 🔴 | + standalone malware-analyst, anti-anchoring, YARA |
| ZERO-DAY | 🔴 | + zd-hunt, 2.6 3/3 POC gate, rop-chain, bounty-reporter, MSRC |
| UAC-BYPASS | 🔴 | + discovery(4×8), native C PoC, validator, IL proof |

**All six** additionally need: target registration, MCP discovery, knowledge-base gate, validation gate, critic brain, report quality gate — i.e., the entire runtime from docs 2–8.

---

## Acceptance Criteria

1. For each of the six modes, a binary can be loaded and the campaign reaches its root `success_finding` — verified by an automated smoke test equivalent to `scripts/smoke_test_swarm.py` (exit 0 = chain sound).
2. Every hop in each mode is observable live in the UI (Blackboard + Pipeline + Swarm + Evidence update in sequence).
3. Each mode's gates are enforced (e.g. ZERO-DAY cannot reach report with a theoretical-only vuln; UAC needs `success_rate:"3/3"`; PATCH needs backup+restore+readback).
4. A completed campaign produces a signed report whose `ReportQualityGate` passed, and brain-syncs verified findings to the Central Brain keyed by sha256.
5. The six modes are mode-aware in the UI: switching mode restructures Pipeline/Swarm to that mode's tree/roster (INFORMATION_ARCHITECTURE §2.2).
