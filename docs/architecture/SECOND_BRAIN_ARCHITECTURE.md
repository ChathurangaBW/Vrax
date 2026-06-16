# 8. SECOND_BRAIN_ARCHITECTURE.md

**Subject:** Proving the knowledge loop — Research Source → Knowledge Store → Retrieval → Agent Consumption → Pipeline Influence — and that knowledge was retrieved, influenced execution, was stored, and was reused.

---

## 0. Runtime Status

🔴 **No second-brain in VRAX.** There is no knowledge-base lookup, no intelligence ingest, no retrieval, no critic/validation brains. The UI has no Intel view at all (Evidence page is the closest, and it has no renderer — UI_AUDIT §1.11). Nothing in VRAX retrieves, stores, or reuses knowledge.

The reference has the full loop: a `knowledge-base/` catalog (references/reports/targets/techniques), NVD + CISA-KEV intelligence pollers → `intelligence_records`/`intelligence_sources` tables, `finding_intel_links` correlation, `intel_store.correlate()` consumed by agents, the **Central Brain** (`.central_brain/`, sha256-keyed patterns/exploit_templates/cve_database via `brain-sync`), the **ValidationBrain** (SB-02, evidence-scoring background service), and the **CriticBrain** (SB-06, adversarial anti-hallucination reviewer).

---

## 1. Current State (As-Built)

- **Intel/knowledge UI:** none. Evidence page shell only.
- **Pollers:** none.
- **Retrieval:** none. `collectFindings` reads only the local phase file.
- **Critic/validation:** none.
- **Provenance:** findings carry no intel links.

---

## 2. Target Architecture — the knowledge loop

```
① RESEARCH SOURCE
   ├─ knowledge-base/ catalog (references, reports, targets, techniques)  [deterministic, curated]
   ├─ intelligence pollers: NVD (2h, trust 0.97), CISA KEV (6h, trust 0.99)  [→ intelligence_records]
   └─ external: MSRC, ExploitDB, P0, MITRE ATT&CK, GitHub Advisories, PoC-in-GitHub
        │
        ▼
② KNOWLEDGE STORE
   ├─ intelligence_records (CVE/ADVISORY/TECHNIQUE/EXPLOIT/KEV/IOC; cvss, cwe, embedding vector(1536))
   ├─ intelligence_sources (tier 1–4, trust_score, last_sync, sync_status)
   ├─ long_term_memories (TECHNIQUE/PATTERN/TARGET_PROFILE/.../BYPASS_METHOD; embedding)
   └─ Central Brain (.central_brain/: patterns/, exploit_templates/, cve_database/; INDEX.json; sha256-keyed)
        │
        ▼  intel_store.correlate(finding)  →  match types: exact_cve / semantic / version_match / technology_match
③ RETRIEVAL
   ├─ agents call correlate() during analysis
   ├─ CriticBrain calls exists(cve_id) to refute nonexistent-CVE hallucinations
   └─ correlation hits → finding_intel_links rows
        │
        ▼
④ AGENT CONSUMPTION
   ├─ security-analyst uses technique summaries
   ├─ cve-researcher uses CVE records
   ├─ knowledge-base agent (Phase 0.5) produces RESEARCH_COMPLETE (MANDATORY, blocks downstream)
   └─ pre-poc-research side-brain (Phase 2.7, NON-NEGOTIABLE)
        │
        ▼
⑤ PIPELINE INFLUENCE
   ├─ KEV match → pheromone boost (weight*1.5, floor 0.5) → finding stays active longer
   ├─ technique match → influences zero-day-hunter hypotheses
   ├─ critic risk (LOW/MED/HIGH) → confidence adjustment (0/−0.15/−0.40) → blocks report if HIGH
   └─ brain-sync: VERIFIED findings → Central Brain → reused by future campaigns on same sha256
```

### 2.1 ValidationBrain (SB-02)

Background service polling `validation_queue` every 2s (max 3 concurrent). Priority weights: EXPLOIT_CHAIN 10, ROP_CHAIN_BUILT 8, VULNERABILITY_IDENTIFIED 5, … Six-step: execute gate → intel correlate → score confidence (exec dominates: 1.0→0.70+0.30·intel; partial→0.60·exec+0.40·intel; none→0.55·intel) → determine status (VERIFIED needs ≥0.70 + gate VERIFIED; <0.20→ELIMINATED) → **CriticBrain review** when conf≥0.7 OR (0.3–0.7 & EXPLOIT_CHAIN) → update finding.

### 2.2 CriticBrain (SB-06) — adversarial, anti-anchoring

Must form its own opinion **before** reading the agent's conclusion. 5 steps: (1) independent analysis (sees only raw evidence), (2) divergence analysis (GROUNDED/INFERRED/**FABRICATED** per claim), (3) hallucination pattern check (cvss_inflation δ>1.5, version_mismatch, wrong_technology, nonexistent_cve, confidence_without_evidence, fabricated_exploit_step), (4) risk class LOW/MED/HIGH (conf adjustments 0/−0.15/−0.40), (5) mandatory `STRONGEST_ARGUMENT_AGAINST`. `approved` only if LOW. Persisted to `audit_log` event `CRITIC_REVIEW`.

---

## 3. UI Surface Mapping — proving the loop

| Widget | Current | Required (proves the loop) |
|---|---|---|
| Intel/Knowledge page | 🔴 absent | New page: intelligence sources (tier, trust, last_sync, record_count, sync_status) |
| Finding intel links | none | Per finding: correlated CVEs/advisories/techniques with match type (exact/semantic/version) |
| KEV influence | none | KEV badge + the applied pheromone boost (weight*1.5, floor 0.5) with reason |
| Critic review | none | Per high-confidence finding: CriticBrain verdict (LOW/MED/HIGH), divergence (GROUNDED/INFERRED/FABRICATED), strongest argument against, confidence adjustment |
| Central Brain reuse | none | "Reused from prior campaign on same sha256" badge; pattern/exploit_template lineage |
| Knowledge-base gate | none | Show Phase 0.5 RESEARCH_COMPLETE as a mandatory gate (blocks pipeline until present) |

**The directive's "prove knowledge was retrieved/influenced/stored/reused" maps to:** (a) every finding shows its `finding_intel_links` [retrieved]; (b) KEV/technique matches show the pheromone/confidence effect [influenced]; (c) VERIFIED findings flow to Central Brain via brain-sync [stored]; (d) future campaigns on the same sha256 show reuse lineage [reused].

---

## 4. Gap Analysis

| # | Capability | Status | Evidence | Build requirement |
|---|---|---|---|---|
| S1 | Knowledge catalog | 🔴 | none | Port `knowledge-base/` catalog + index.json |
| S2 | Intel pollers | 🔴 | none | Port NVD + CISA-KEV schedulers → `intelligence_records` |
| S3 | Correlation/retrieval | 🔴 | none | Port `intel_store.correlate()` + `finding_intel_links` |
| S4 | Embeddings | 🔴 | none | Port pgvector(1536) embeddings for semantic match |
| S5 | Validation brain | 🔴 | none | Port `ValidationBrain` (SB-02) queue worker |
| S6 | Critic brain | 🔴 | none | Port `CriticBrain` (SB-06) anti-anchoring review |
| S7 | Central Brain + brain-sync | 🔴 | none | Port `.central_brain/` + sha256-keyed brain-sync |
| S8 | Long-term memories | 🔴 | none | Port `long_term_memories` table |
| S9 | Phase 0.5 research gate | 🔴 | none | Enforce RESEARCH_COMPLETE blocks downstream |
| S10 | Intel UI | 🔴 | no page | New Intel/Knowledge view proving the loop |

---

## 5. Acceptance Criteria

1. Every finding lists its correlated intel (CVE/advisory/technique) with match type, pulled from `finding_intel_links` — retrieval is visible.
2. A KEV match visibly boosts the finding's pheromone (×1.5, floor 0.5) with reason `CISA_KEV` — influence is visible.
3. High-confidence findings show a CriticBrain verdict (LOW/MED/HIGH), divergence classification, and the applied confidence adjustment; a HIGH risk blocks reporting — assurance is visible.
4. VERIFIED findings appear in the Central Brain under their sha256; a new campaign on the same binary shows "reused" lineage — storage & reuse are visible.
5. The Phase 0.5 `RESEARCH_COMPLETE` gate is enforced: downstream agents cannot trigger until knowledge-base research has deposited the finding.
6. The Intel view shows each source's tier, trust_score, last_sync, and record_count — the knowledge supply chain is auditable.
