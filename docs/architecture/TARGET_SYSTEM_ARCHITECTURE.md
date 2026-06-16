# 3. TARGET_SYSTEM_ARCHITECTURE.md

**Subject:** Authoritative target registration — making the selected binary a first-class, single-source-of-truth object available to every pipeline.

---

## 0. Runtime Status

🔴 **No target system.** "Target selection" in VRAX is `browseFiles()` (`app.js:528-535`): it opens an OS dialog, gets a path, and **`alert()`s** the user to "manually update `council_state.json`'s `target_binary`." There is no registration, no workspace, no metadata extraction, no SHA-256, no type identification, no environment population, no persistence. The `target_binary` string is the entire target object. Every consumer reads the same one field; there is no authoritative registry and therefore nothing to deduplicate.

The reference implements this properly: `scripts/resolve_target.py` + the `council-orchestrator` Phase-0 contract + the BinaryAnalysis-MCP `binary_discovery_tool` together turn a path into a registered, metadata-rich target that emits a `TARGET_REGISTERED` finding — the bootstrap that activates every other agent.

---

## 1. Current State (As-Built)

- **Selection:** `electron/main.js:80-91` `open-file` IPC returns a path string only.
- **No registration:** `browseFiles()` does not write anywhere. `target_binary` in `agents/council_state.json` is `"ms-teams.exe"` — a static template value, not a registered target.
- **No metadata:** `council_state.json` carries `target_binary` and `workspace_dir` only. No sha256, no format, no arch, no entry point, no mitigations-derived-from-binary. (`1_mapping.mitigations` exists but is meant to be *filled by* security-analyst, not by registration.)
- **No workspace model:** `main.js` reads a single global `STATE_FILE` (`main.js:5`). `campaigns/` is scanned for per-dir `council_state.json` (`main.js:20-34`), but no process ever *creates* those dirs.
- **Duplicate risk:** nothing prevents the same binary (or the same SHA-256) being "loaded" twice as unrelated campaigns; nothing links campaigns by target identity.

---

## 2. Target Architecture

### 2.1 Registration flow (reference, rebranded)

```
vrax.openFile() → path
   │
   ▼  resolve_target.py
TARGET RECORD {
  path, filename, sha256, format (PE/ELF/Mach-O), arch (x86/x64/...),
  image_base, entry_point, subsystem, file_size, compile_time,
  linker_version, section_count, import_count, export_count,
  entropy, overlay_present, packed_heuristic,
  workspace_dir = campaigns/<sha256[:12]>/,
  registered_at, campaign_id (uuid4)
}
   │
   ▼  Blackboard.write(TARGET_REGISTERED, metadata=<TARGET RECORD>, pheromone=0.9)
TARGET_REGISTERED finding  ←── the single bootstrap finding
   │   (every AGENT_TRIGGERS predicate that keys off TARGET_REGISTERED now fires)
   ▼
campaigns/<id>/ created; blackboard.json + campaign_state.json seeded
```

`TARGET_REGISTERED` is the **root** of the HP-TSA plan tree's dependency chain — every Phase-1 node depends on it. It is produced exactly once per campaign, by `council-orchestrator` Phase 0 (see `FINDING_PRODUCER` map).

### 2.2 Single source of truth

- The `campaigns` table row (`id, name, pipeline_mode, target, scope_definition, status, mcp_*_connected, metadata`) is the canonical target-of-record.
- The `TARGET_REGISTERED` finding's `metadata` block is the immutable snapshot of the binary at registration time (sha256-keyed, so re-loading the same binary is detectable).
- The Central Brain indexes verified findings by **binary sha256** — so target identity (not filename) is the join key across campaigns and knowledge.
- **Every panel consuming target data derives from this one record.** No `target_binary` string copies scattered through the UI.

### 2.3 Metadata source: BinaryAnalysis-MCP, not the orchestrator

The reference `BinaryAnalysis-MCP` server (`server.py`, tools `get_binary_info/headers/sections/security/imports/exports/report`) is the deterministic, LLM-free metadata provider (LIEF-backed, PE/ELF/Mach-O). Registration should call `get_binary_report` (one-shot full triage) to populate the target record's metadata block — this is also exactly what the UI's **Overview/Sections/Imports/Exports** pages must call (UI_AUDIT G11). This decouples binary facts from agent reasoning.

---

## 3. UI Surface Mapping

| Surface | Current | Required |
|---|---|---|
| Targets page → "Load binary" | 🟡 `browseFiles()` → alert | Full registration: after pick, show resolving state → create campaign → emit TARGET_REGISTERED → navigate to MCP Hub |
| Targets page → "Scan folder" | 🔴 no handler | Batch: enumerate PE/ELF in dir, queue N targets |
| Overview page | 9 cards from `1_mapping` | 12+ cards from the `TARGET_REGISTERED` metadata (sha256, entropy, linker, subsystem, image base) |
| Sections/Imports/Exports | 🔴 static empty | Tables from BinaryAnalysis-MCP tools, keyed by sha256 |
| Campaign bar | `target_binary` string | `<filename> · <sha256[:12]> · <format> <arch>` |
| "Recent targets" | (mock only) | List distinct sha256 targets from `campaigns` table (deduped by hash) |

---

## 4. Gap Analysis

| # | Capability | Status | Evidence | Build requirement |
|---|---|---|---|---|
| T1 | Path → metadata resolution | 🔴 | `app.js:528` returns path | Port `resolve_target.py` + BinaryAnalysis-MCP `get_binary_report` |
| T2 | Workspace creation | 🔴 | one global STATE_FILE | `campaigns/<id>/` per registration; seed files |
| T3 | TARGET_REGISTERED emit | 🔴 | none | Port Blackboard write; make it the bootstrap finding |
| T4 | Authoritative registry | 🔴 | `target_binary` string | `campaigns` table as SoT; hash-keyed identity |
| T5 | Dedup by sha256 | 🔴 | none | Index campaigns by sha256; warn on re-load |
| T6 | Batch folder scan | 🔴 | handler missing | Enumerate dir, queue targets |
| T7 | UI metadata pages | 🔴 | static empty | Wire Overview/Sections/Imports/Exports to BinaryAnalysis-MCP |
| T8 | Resolving state UX | 🔴 | alert() | Show resolving → registered transitions live |

---

## 5. Acceptance Criteria

1. Selecting a binary produces a `campaigns` row + a `campaigns/<id>/` workspace + a `TARGET_REGISTERED` finding whose metadata matches an independent LIEF parse — no manual edit.
2. The same binary selected twice yields the same sha256 and is surfaced as the same target (deduped), not two unrelated campaigns.
3. Overview/Sections/Imports/Exports render from the registered target's BinaryAnalysis-MCP report and update if the registered binary is re-registered (hash change).
4. Every downstream panel (Blackboard, Pipeline, Swarm, Reports) can resolve the active target from one query (campaign row), with no scattered `target_binary` copies.
5. Registration is idempotent and observable: the Operator Console shows "resolving → registered" and the Blackboard gains exactly one `TARGET_REGISTERED` finding.
