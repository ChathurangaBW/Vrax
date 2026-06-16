# 4. ORCHESTRATOR_VISIBILITY_ARCHITECTURE.md

**Subject:** Making the orchestrator — the core product — fully observable. Current phase, current owner, active/queued/blocked agents, trigger & waiting conditions, blackboard/consensus activity, pipeline progression, state transitions.

---

## 0. Runtime Status

🔴 **No orchestrator exists in VRAX.** The UI's closest analog is the static 6-card Pipeline list (`app.js:283-290`) and the static Operator Console phase rail (`index.html:256-285`). Neither reflects a real loop: `current_phase` is an integer a human sets; cards flip based on each phase's `status` string; nothing queues, blocks, waits, or triggers anything. The concept "what is happening / why / who / what next" cannot be answered because there is no engine.

The reference orchestrator is the **overlay** layer (`src/overlay/`): `HPTSAPlanner` (the backward-decomposed plan tree) + `Committee` (role→agent routing) + `MetaOrchestrator` (the tick loop) + gates (`triage_gate`, `validation_gate`) + `dispatcher` (the seam to the agent harness). This document specifies that, rebranded, as the thing the UI must expose.

---

## 1. Current State (As-Built)

- **Pipeline view:** `renderPipeline` (`app.js:273-325`) renders 6 hardcoded CRASH phases with DONE/RUNNING/QUEUED derived from `phases[k].status`. No mode awareness, no sub-phases, no dependencies, no frontier.
- **Swarm view:** `renderSwarm` (`app.js:328-383`) renders 5 agents whose running/done state is *inferred from their phase's status* (`app.js:354-357`) — there is no real task assignment or queue.
- **Operator Console rail:** `index.html:256-285` is static HTML with `ph-cb-N`/`ph-t-N` IDs that **JS never writes to**. Decorative.
- **"Why/what-next":** absent. There is no concept of a trigger condition, a waiting condition, a blocked dependency, or a dead path.

---

## 2. Target Architecture

### 2.1 The orchestrator (reference `src/overlay/`)

```
MetaOrchestrator.run()  ← the loop driver
  └─ tick():
       1. planner.refresh(blackboard)     # sync plan tree to truth
       2. if converged → return
       3. frontier = planner.frontier()    # FRONTIER+ACTIVE non-terminal nodes
       4. for node in frontier:
            assignment = committee.assign(node)   # role→agent, objective, hypothesis
            if assignment.requires_approval:
                if not approval_gate(node): planner.kill(node); continue
            planner.mark_attempt(node)
            dispatcher(assignment)         # → delegation_plan.json → agent run
```

Key types (rebranded):
- **`PlanNode`**: `{objective, hypothesis, success_finding, role, children, depends_on[], min_pheromone=0.3, min_status=VERIFIED, kill_budget=3, state, attempts, dead_reason, evidence_id}`.
- **`NodeState`**: `PENDING → FRONTIER → ACTIVE → SATISFIED | DEAD`.
- **`Assignment`**: `{node_id, role, agent, objective, hypothesis, target_finding, requires_approval, attempt}`.
- **`TickResult`**: `{tick, delegated[], snapshot, converged, blocked}`.
- **`current_state_block()`**: the mandatory human-readable vector — **Current Vector / Hypothesis / Active Sub-Loop / Progress / Dead Paths** — which the Operator Console must render verbatim.

### 2.2 The HP-TSA plan tree (per mode)

From `WIN_CONDITIONS` in `hptsa_planner.py`: five backward-decomposed trees (CRASH/PATCH/CTF/ZERO_DAY/MALWARE; UAC-BYPASS is its own 3-stage contract). The **root is a proof artifact**, not a task. A node is SATISFIED when its `success_finding` exists at `min_status` & pheromone ≥ `min_pheromone`; DEAD cascades to dependents (monotone, loop-free). Special: `VULNERABILITY_IDENTIFIED` needs `chain_depth_verified && callgraph_depth>=4`.

**This plan tree — not the 6-card list — is what the Pipeline view must render.** Each visible phase = a node; its state (PENDING/FRONTIER/ACTIVE/SATISFIED/DEAD) comes from `planner.refresh()`, not a status string.

### 2.3 Trigger conditions (the stigmergic mechanism)

Agents don't get a queue from the orchestrator — they get **triggered by blackboard findings**. `AGENT_TRIGGERS` (in `blackboard.py`) maps each agent → `list[TriggerPredicate{finding_type, min_pheromone, extra_conditions}]`. `Blackboard.get_triggered_agents()` evaluates predicates against `get_active()` findings (those above their decayed pheromone floor), excluding findings already `assigned_to` that agent.

**UI consequence:** "queued agents" = agents with a currently-satisfied trigger predicate but no active run; "active" = agents with an open `agent_runs` row; "blocked" = nodes whose dependencies are unsatisfied or DEAD; "waiting" = nodes whose `success_finding` hasn't reached `min_status`. The Swarm view must distinguish these four states, not collapse them to running/done/queued.

### 2.4 Gates (HITL + quality)

- **`TriageGate`** (Phase 0.1): CVSS-3.1 computation → `TriageDecision` SKIP/LOW/MED/HIGH_VALUE + MSRC severity + bounty range → `TRIAGE_DECISION` finding (φ 0.9). Skip rules: DoS-only, cvss<4, AV:P.
- **`ValidationGate`**: 6-gate Zero-Trust evidence check; EvidenceClass A/B/C/D; gates==6+independent→VERIFIED.
- **Approval gate**: HIGH-stakes findings (`PATCH_READY`, `EXPLOIT_CHAIN`, `ROP_CHAIN_BUILT`) and operations (`PATCH_BINARY`, `RUN_EXPLOIT`, `REPORT_0DAY`, `VALIDATE_UAC`) require a human `approval_requests` row (expires 1h).

**UI consequence:** HITL approval requests are first-class — they must pause the loop and surface a decision UI in the Operator Console.

---

## 3. UI Surface Mapping

| Surface | Current | Required (orchestrator view) |
|---|---|---|
| Pipeline view | 6 flat CRASH cards | HP-TSA tree: nodes with state, dependencies, success_finding, attempts/kill_budget, dead_reason |
| Swarm view | 5 agents, inferred | All ~20 agents with real state: queued(trigger-satisfied)/active(run)/blocked(dep DEAD)/waiting |
| Operator Console rail | static HTML | `current_state_block()`: Current Vector, Hypothesis, Active Sub-Loop, Progress %, Dead Paths list |
| Next-actions / triggers | none | List of currently-satisfied trigger predicates and the agents they would fire |
| HITL approvals | none | `approval_requests` panel: operation, stakes, evidence, approve/deny, expiry |
| Consensus activity | none | Active vote: eligible agents, votes submitted (blind), threshold 67%, dissent |

---

## 4. Gap Analysis

| # | Capability | Status | Evidence | Build requirement |
|---|---|---|---|---|
| O1 | Meta-orchestrator loop | 🔴 | none | Port `MetaOrchestrator.tick()/run()` |
| O2 | HP-TSA plan tree | 🔴 | 6 flat cards | Port `HPTSAPlanner` + `WIN_CONDITIONS` per mode |
| O3 | Plan tree UI | 🔴 | `renderPipeline` flat | New tree renderer: node state, deps, dead paths |
| O4 | Committee routing | 🔴 | inferred agent | Port `Committee.resolve_agent/assign` |
| O5 | Trigger predicate evaluation | 🔴 | none | Port `AGENT_TRIGGERS` + `get_triggered_agents` |
| O6 | Swarm 4-state model | 🔴 | 3-state inferred | queued/active/blocked/waiting from triggers+runs+deps |
| O7 | `current_state_block()` | 🔴 | static rail | Port + render the 5-field state vector |
| O8 | Triage gate | 🔴 | none | Port `TriageGate` → TRIAGE_DECISION |
| O9 | Validation gate | 🔴 | none | Port `ValidationGate` (6-gate, evidence-class) |
| O10 | HITL approval flow | 🔴 | none | Port `approval_requests`; decision UI |
| O11 | Consensus vote UI | 🔴 | none | Port vote (67% supermajority, anti-anchoring) |
| O12 | Dispatcher seam | 🔴 | none | Port `dispatcher` → `delegation_plan.json` |

---

## 5. Acceptance Criteria

1. The Pipeline view renders the active mode's HP-TSA tree; every node shows its true `NodeState` after `planner.refresh()`, and a DEAD node visibly cascades to its dependents.
2. The Swarm view distinguishes queued/active/blocked/waiting agents from real trigger evaluation + open runs + dependency state — not from a phase status string.
3. The Operator Console displays the live `current_state_block()` (Current Vector, Hypothesis, Active Sub-Loop, Progress, Dead Paths), updating each tick.
4. A HIGH-stakes operation pauses the loop and raises an approval request that the operator must act on; denial marks the node DEAD and the tree updates.
5. "What happens next?" is always answerable: the UI shows the frontier nodes and the exact trigger predicates (finding_type @ min_pheromone) that would fire next.
