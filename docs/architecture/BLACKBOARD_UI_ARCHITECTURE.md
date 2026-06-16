# 5. BLACKBOARD_UI_ARCHITECTURE.md

**Subject:** The blackboard as a first-class system — not a log, not a chat feed, but the system state. Every finding shows origin agent, confidence, evidence, dependencies, consumers, state, lifecycle. Every event traceable.

---

## 0. Runtime Status

🔴 **No blackboard in VRAX.** The "Blackboard" page (`page-blackboard`) is the **default view** and the most-developed renderer (`app.js:195-270`), but what it renders is not a blackboard. `collectFindings()` (`app.js:100-192`) mines findings out of the legacy phase fields (`2.5_zero_day_hunt.vulnerabilities`, `1_mapping.entry_points`, `2_vulnerability.crash_condition`, `uac_bypass_findings`) and **synthesizes** finding objects with fabricated pheromone (`sev_score = cvss_score/10` or fixed `0.85/0.92/0.95`). There is no `FindingType`, no decay, no validation lifecycle, no evidence, no producer/consumer graph, no fingerprint dedup. It is a derived summary view of a deprecated file, not a blackboard.

The reference `Blackboard` (`src/blackboard/blackboard.py`) is the real stigmergic substrate: 50-value `FindingType` enum, `Finding` dataclass with pheromone decay, Postgres-backed with a `current_pheromone()` SQL function, `AGENT_TRIGGERS` consumer registry, `finding_fingerprints` resurrection-prevention, and the `ValidationStatus` lifecycle machine. This is what the UI must visualize.

---

## 1. Current State (As-Built)

- **Source:** `collectFindings` reads legacy phases only. No `findings` table, no JSON blackboard.
- **Pheromone display:** `phi = sev_score.toFixed(2)` (`app.js:232`) — a static bar proportional to severity. No decay, no boost, no half-life, no floor.
- **Producer:** hardcoded per source (`agent: 'zero-day-hunter'` at `app.js:114`, etc.). No `produced_by` field from a run.
- **Consumers:** the card foot says nothing about consumers (the mock says "3 agents" but canonical UI dropped it).
- **Lifecycle:** a boolean `confirmed` (`app.js:116`). No DISCOVERED→RESEARCHING→AWAITING_EVIDENCE→PARTIALLY_VERIFIED→VERIFIED/INCONCLUSIVE/FALSE_POSITIVE/REJECTED machine.
- **Evidence:** none. The expanded card shows `notes` + a few raw fields (`app.js:234-243`). No `evidence` rows, no evidence-class, no run_number, no artifact_sha256.
- **Dedup:** none. The same logical finding could appear from two phase fields with no fingerprint join.
- **Timestamp:** `bb-ts` declared (`index.html:115`) but **never written**.

---

## 2. Target Architecture — the Blackboard model (reference, rebranded)

### 2.1 Finding data model

```
Finding {
  id: UUID,
  campaign_id: UUID,
  finding_type: FindingType,        # 50 values, grouped by phase
  status: ValidationStatus,         # DISCOVERED→RESEARCHING→AWAITING_EVIDENCE
                                    #   →PARTIALLY_VERIFIED→VERIFIED
                                    #   | INCONCLUSIVE | FALSE_POSITIVE | REJECTED
  target, sub_target,
  confidence: float [0..1],
  cvss_score, cvss_vector, cve_ids[], cwe_ids[], is_kev,
  # pheromone / decay
  pheromone_weight: float [0..2],
  half_life_secs: int (def 3600),
  decay_curve: 'exp' | 'linear',
  minimum_floor: float,
  # provenance
  produced_by: agent_name,
  assigned_to: agent_name | null,
  reasoning_trace: dict,
  fingerprint: sha256(campaign:type:target:sorted_metadata)[:32],
  metadata: dict,
  created_at, updated_at, boosted_at, boost_reason
}
```

### 2.2 Pheromone math (exact)

- **Config:** `FINDING_CONFIG[type] = {half_life, decay, initial_ph}`; default `{3600, 'exp', 0.7}`.
- **CVSS boost:** if `cvss_score >= 7.0`, `half_life_secs *= (1 + cvss/10)`.
- **KEV boost:** `minimum_floor = max(0, 0.5)`; `pheromone_weight = min(2.0, weight*1.5)`; `boost_reason='CISA_KEV'`.
- **Decay (DB-side, computed on read):** `current_pheromone(weight, half_life, curve, floor, created_at)`. `exp`: `floor + (weight-floor)*exp(-age/half_life)`; `linear`: clamp to floor.
- **Active:** a finding is "active" iff `current_pheromone >= min_pheromone` for some trigger (view default 0.1).
- **Boost cap:** `boost_pheromone` clamps at `LEAST(2.0, ...)`.
- **Resurrection block:** a write is rejected if a `finding_fingerprints` row exists with `final_status in (VERIFIED, ELIMINATED, FALSE_POSITIVE)`.

### 2.3 Producer / consumer graph

- **Producer** (`FINDING_PRODUCER`): each `FindingType` is produced by exactly one agent (e.g. `VULNERABILITY_IDENTIFIED`→`zero-day-hunter`, `CRASH_ISOLATED`→`vuln-isolator`, `RAW_GHIDRA_OUTPUT`→`ghidra-analyst`).
- **Consumer** (`AGENT_TRIGGERS`): each agent → list of `TriggerPredicate{finding_type, min_pheromone, extra_conditions}`. `Blackboard.get_triggered_agents()` = consumers whose predicate is satisfied by an active, unassigned finding.
- **The UI must render this graph per finding**: who produced it, which agents are triggered by it (consumers), and whether each is already assigned.

### 2.4 Confidence model (evidence-weighted)

Evidence weights: A=25/item (cap 50), B=15 (cap 30), C=8 (cap 16), D=2 (cap 4). Modifiers: independent_validation_present +8 / absent −15; critic_sustained +5 / rejected −30; attack-landed −4 (cap −20). Caps: any_gate_failed=35, pure_inference_max=10. Report-gate allow threshold=90; severity-aware (CRITICAL≥75, HIGH≥85, MEDIUM/LOW/INFO≥90). **The displayed confidence is this computed value, not a guess.**

---

## 3. UI Surface Mapping — the Blackboard page as first-class state

| Widget | Current | Required |
|---|---|---|
| Finding card header | name + CONFIRMED/UNCONFIRMED | `FindingType` + `ValidationStatus` lifecycle badge + confidence |
| Pheromone bar | static `sev_score` | live `current_pheromone()`; tooltip = weight/half_life/curve/floor/age |
| Producer | hardcoded agent | `produced_by` (link to its `agent_runs` row + reasoning_trace) |
| Consumers | (dropped) | list of triggered agents (from `get_triggered_agents`) + assignment state |
| Evidence (expand) | notes + raw fields | `evidence` rows: class A/B/C/D, run_number, artifact_sha256, exit_code, crashed, asan_detected |
| Dependencies | none | links to parent/child findings (what this depends on, what depends on it) |
| CVE/KEV/CVSS | cvss only | cve_ids[], cwe_ids[], is_kev badge, cvss_vector, `finding_intel_links` |
| Timestamp | unwritten | created_at, updated_at, boosted_at+reason |
| Filter chips | by severity | by FindingType group, ValidationStatus, producer, KEV, decayed-vs-active |
| Decay control | none | toggle "show decayed"; manual refresh tick to re-evaluate |

---

## 4. Gap Analysis

| # | Capability | Status | Evidence | Build requirement |
|---|---|---|---|---|
| B1 | Real findings store | 🔴 | `collectFindings` synthesizes | Port `Blackboard` + `findings` table |
| B2 | FindingType model | 🔴 | free-text names | Port 50-value enum |
| B3 | Pheromone decay | 🔴 | static `sev_score` | Port `current_pheromone()`; compute on read |
| B4 | Boost (CVSS/KEV) | 🔴 | none | Port boost logic + cap 2.0 |
| B5 | Validation lifecycle | 🔴 | boolean confirmed | Port `ValidationStatus` machine |
| B6 | Producer/consumer graph | 🔴 | hardcoded producer | Port `FINDING_PRODUCER` + `AGENT_TRIGGERS` |
| B7 | Evidence rows | 🔴 | none | Port `evidence` table + render |
| B8 | Confidence model | 🔴 | cvss/10 | Port evidence-weighted confidence + caps |
| B9 | Fingerprint dedup | 🔴 | none | Port `finding_fingerprints` + resurrection block |
| B10 | Intel links | 🔴 | none | Port `finding_intel_links` (exact/semantic/version) |
| B11 | Timestamps | 🔴 | `bb-ts` unwritten | created/updated/boosted + reason |
| B12 | Traceability (to run) | 🔴 | none | Link finding → `agent_runs` + `reasoning_trace` |

---

## 5. Acceptance Criteria

1. Every finding card shows producer, current decayed pheromone (recomputed on view), confidence (evidence-weighted), and ValidationStatus — all from the `findings` table, none synthesized.
2. Expanding a finding lists its evidence rows with class/run/sha256, and its triggered consumers with assignment state.
3. Pheromone visibly decays over time (exp curve to floor); a KEV boost raises floor+weight and is labeled with reason; boosting caps at 2.0.
4. A rejected/eliminated finding cannot be resurrected — re-writing the same fingerprint is blocked and the UI shows the terminal status.
5. Filtering by ValidationStatus and by active-vs-decayed works, and the decayed set is hidden by default (only findings above their trigger floor show).
6. Clicking a producer opens its `agent_runs` row (model, tokens, cost, trace_id); clicking an evidence row opens its artifact (crash dump, ASAN output, PoC input).
