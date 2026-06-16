# 6. AGENT_RUNTIME_ARCHITECTURE.md

**Subject:** Full visibility into the agent ecosystem — status, current/assigned task, trigger source, execution history, runtime health, model info, resource usage, failure/fallback reason. Every execution observable.

---

## 0. Runtime Status

🔴 **No agent runtime in VRAX.** `renderSwarm` (`app.js:328-383`) renders a **fixed 5-agent roster** (`app.js:333-339`: council-orchestrator, security-analyst, vuln-isolator, zero-day-hunter, harness-engineer) whose state is *inferred from the phase status string* and whose pheromone is fabricated (`isDone?0.78:isRun?0.72:0.00`, `app.js:358`). There are no `agent_runs`, no models, no tokens/cost, no failure reasons, no execution history, no trigger source. Of the reference's ~20 agents, 15 are invisible.

The reference has a complete agent layer: ~20 playbooks (`agents/*.md`), a tiered model map (`agent_model_map.json`: qwen3.7-max / deepseek-v4-pro / qwen3.7-plus / deepseek-v4-flash), the `agent_runs` Postgres table, the dispatcher seam (`overlay/dispatcher.py`), and Prometheus metrics (`observability/metrics.py`). This is the target.

---

## 1. Current State (As-Built)

- **Roster:** 5 hardcoded agents. No malware-analyst, patcher, qa-tester, telemetry-structurer, harness-generator, cve-researcher, rop-chain-builder, differential-analyst, validation-authority, critic-brain, audit-brain, pre-poc-research, knowledge-base, report-generator, bounty-reporter, yara-ioc-generator, c2-analyst, remediation-coordinator, ghidra-analyst, sandbox-runner, context-compactor.
- **State:** 3 values (idle/run/done) inferred from phase status (`app.js:354-357`).
- **Pheromone:** fabricated constants.
- **Model info:** none. (Settings modal hardcodes `claude-opus-4-8`/`claude-sonnet-4-6`, `index.html:314-315`, unbound.)
- **Resource usage:** none. No token/cost/duration.
- **Failure/fallback:** none.
- **Trigger source:** none — the UI can't say *why* an agent ran.
- **Execution history:** none — no per-agent run log.

---

## 2. Target Architecture

### 2.1 Agent roster & tiers (reference `agent_model_map.json`, rebranded)

| Tier | Model | Agents |
|---|---|---|
| Max intel | qwen3.7-max | council-orchestrator, zero-day-hunter, validation-authority, critic-brain, audit-brain, triage-gate, council-test-runner |
| Precise low-level/code | deepseek-v4-pro | security-analyst, vuln-isolator, harness-engineer, harness-generator, patcher, qa-tester, differential-analyst, fuzz-harness-generator, memory-forensics, interactive-debugger, rop-chain-builder, anti-anti-debug, uac-poc-validator, sandbox-runner, ghidra-analyst |
| Large-context research/report | qwen3.7-plus | malware-analyst, knowledge-base, report-generator, bounty-reporter, yara-ioc-generator, cve-researcher, c2-analyst, pre-poc-research, uac-bypass-discovery, remediation-coordinator |
| Fast structural | deepseek-v4-flash | telemetry-structurer, context-compactor |

Each entry has a 4-model `fallback_chain` ending in `opencode/big-pickle` (default fallback). v2 mandates `provider/model` ids (v1 bare names never resolved).

### 2.2 The run record (`agent_runs` table)

```
agent_runs {
  id, campaign_id, agent_name, model, pipeline_phase,
  status: RUNNING | COMPLETE | FAILED | TIMEOUT | APPROVAL_PENDING | REJECTED,
  tokens_in, tokens_out, tokens_cached, cost_usd,
  findings_produced: int, trace_id,
  started_at, ended_at, error: text
}
```

### 2.3 Dispatch seam (reference `overlay/dispatcher.py`)

`build_prompt(assignment)` embeds objective + hypothesis + deliverable + the mandatory `blackboard_write.py append` rule, then invokes the agent harness (opencode `--agent <agent> --format json --dir <campaign_dir>` or claude equivalent). Both write `delegation_plan.json`. The dispatcher is the only place an agent is launched; the UI must never launch agents directly.

### 2.4 Trigger source

An agent run starts because a `TriggerPredicate` fired (BLACKBOARD_UI_ARCHITECTURE §2.3) OR the committee assigned an HP-TSA frontier node to it (ORCHESTRATOR_VISIBILITY §2.1). The run record should link to its cause: the node_id and/or the triggering finding.

### 2.5 Observability (`observability/metrics.py`)

Prometheus, `council_`-prefixed (rebrand to `vrax_`): `agent_runs_total`, `agent_duration_seconds` (buckets 1–1800s), `agent_errors_total`, `active_agents`, `tokens_input/output/cached_total`, `api_cost_usd_total`. The Swarm view should surface these per agent.

---

## 3. UI Surface Mapping

| Widget | Current | Required |
|---|---|---|
| Swarm roster | 5 fixed | All ~20 agents (roster from `agent_model_map.json`), grouped by tier |
| Agent state | 3 inferred | `agent_runs.status`: RUNNING/COMPLETE/FAILED/TIMEOUT/APPROVAL_PENDING/REJECTED |
| Pheromone | fabricated | their current active-finding pheromone (from triggers), or n/a |
| Task | inferred | current/assigned objective+hypothesis (from Assignment) |
| Trigger source | none | link to triggering finding or assigned node |
| Model | none | tier model + fallback chain (fallback reason if degraded) |
| Resources | none | tokens in/out/cached, cost_usd, duration |
| Health | none | error rate, last error, avg duration (from metrics) |
| History | none | per-agent run log (click → list of `agent_runs`) |
| Console swarm rows | mirrored | same richness in the Operator Console rail |

---

## 4. Gap Analysis

| # | Capability | Status | Evidence | Build requirement |
|---|---|---|---|---|
| A1 | Full roster | 🔴 | 5 hardcoded | Read `agent_model_map.json`; render all tiers |
| A2 | Run records | 🔴 | inferred state | Port `agent_runs` table; write on dispatch |
| A3 | Dispatch seam | 🔴 | none | Port `dispatcher` + `delegation_plan.json` |
| A4 | Trigger source | 🔴 | none | Link run → trigger predicate / HP-TSA node |
| A5 | Model + fallback | 🔴 | unbound settings | Port model map + fallback chains; show degrade reason |
| A6 | Resource usage | 🔴 | none | Capture tokens/cost/duration; surface |
| A7 | Failure/fallback reason | 🔴 | none | Port error classification + fallback events |
| A8 | Execution history | 🔴 | none | Per-agent run log view |
| A9 | Metrics | 🔴 | none | Port Prometheus metrics; surface in UI |
| A10 | Mode-aware roster | 🔴 | fixed | Filter roster by active pipeline_mode |

---

## 5. Acceptance Criteria

1. The Swarm view lists every agent in the active mode's roster, each with its real `agent_runs.status` (not inferred), current task, trigger source, and model tier.
2. Clicking an agent opens its run history: each `agent_runs` row with model, tokens, cost, duration, findings_produced, error.
3. A failed run shows its error and, if it fell back to a different model, the fallback reason and chain used.
4. Resource totals (tokens, cost) are live and match the Prometheus `api_cost_usd_total` / token counters.
5. An agent's trigger source is traceable: clicking it opens the triggering finding (stigmergic) or the HP-TSA node (committee) that caused the run.
6. Roster visibility changes with pipeline mode — e.g. MALWARE mode foregrounds malware-analyst; ZERO_DAY foregrounds zero-day-hunter + the 2.6 PoC gate.
