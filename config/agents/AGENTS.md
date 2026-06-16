# Council Agent Swarm v2.0 — Workspace Instructions

## Overview

This workspace defines a **stigmergic, blackboard-scheduled agent swarm** for automated binary reverse engineering, vulnerability research, software patching, and UAC bypass discovery on Windows. Architecture ported from [Armur-Ai/Pentest-Swarm-AI](https://github.com/Armur-Ai/Pentest-Swarm-AI) (AGPL-3.0) and adapted for OpenCode's agentic runtime.

**`@council-orchestrator`** is the sole primary agent. It runs a **blackboard loop**, not a sequential pipeline. 21 specialist subagents self-activate via trigger predicates on a shared, append-only `blackboard.json` whose findings carry decaying pheromone weights.

## Architecture

```
                              USER
                               │
                  opencode run --agent council-orchestrator
                               │
                               ▼
              ┌────────────────────────────────────────┐
              │     STEP 0: Resume detection           │
              │     STEP 1: MCP health check           │
              │     STEP 2: Pipeline-mode selection    │
              │     STEP 3: Workspace init             │
              │     STEP 4: Research-first protocol    │ ◀── @knowledge-base
              │     STEP 5: BLACKBOARD LOOP            │     (MANDATORY,
              │     EXIT: 5 conditions (success/stall/ │      blocks all)
              │           abort/scope_violation/       │
              │           fatal_error)                 │
              └────────────────────┬───────────────────┘
                                   │
                                   ▼
   ┌───────────────────────────────────────────────────────────────┐
   │           SHARED BLACKBOARD (append-only, atomic)             │
   │  TARGET_REGISTERED · RESEARCH_COMPLETE · VULNERABILITY_*      │
   │  CRASH_ISOLATED · HARNESS_COMPILED · POC_VALIDATED            │
   │  CONSENSUS_REACHED · UAC_BYPASS_CANDIDATE · UAC_POC_VALIDATED │
   │  CAMPAIGN_COMPLETE · SCOPE_VIOLATION · AGENT_FAILURE          │
   │  (each finding has pheromone weight that decays)              │
   └────┬──────────┬──────────┬──────────┬──────────┬───────────────┘
        │          │          │          │          │
   triggers   triggers  triggers  triggers  triggers
        ▼          ▼          ▼          ▼          ▼
   @knowledge  @security  @vuln-    @harness- @patcher  ...
   -base       -analyst   isolator  engineer
        │          │          │          │          │
        └──────────┴──────────┴──────────┴──────────┘
                   bash + IDA MCP + tools
                   (OpenCode permission layer)
```

### Six Pipeline Modes (orchestrator routes to one)

| Mode | Trigger keywords | Playbook | Key agents |
|---|---|---|---|
| `ctf` | crackme, ctf, flag, challenge, puzzle | `playbooks/ctf.yaml` | security-analyst → patcher → qa-tester |
| `crash` | crash, exploit, vuln, harness, overflow, rop | `playbooks/crash.yaml` | security-analyst → vuln-isolator → harness-engineer → qa-tester |
| `patch` | patch, keygen, license, unlock, serial, register | `playbooks/patch.yaml` | security-analyst → patcher → qa-tester |
| `malware` | malware, unpack, c2, ioc, yara | `playbooks/malware.yaml` | malware-analyst → c2-analyst → yara-ioc-generator |
| `zero-day` | 0day, zero-day, novel, unknown | `playbooks/zero-day.yaml` | security-analyst → zero-day-hunter → **3/3 POC gate** → rop/harness → qa-tester |
| `uac-bypass` | uac, elevation, fodhelper, auto-elevate | `playbooks/uac-bypass.yaml` | uac-bypass-discovery (4×8 lanes) → uac-poc-validator (**3/3 elevation**) → bounty-reporter |

## File Conventions

| Pattern | Purpose |
|---|---|
| `opencode.json` | OpenCode agent registry, MCP servers, command bindings |
| `agents/council-orchestrator.md` | Reference card for the orchestrator |
| `agents/<agent-name>.md` | Subagent definitions (kebab-case) — informational, mirrors .txt |
| `prompts/agents/<name>.txt` | Canonical OpenCode prompt (loaded via `{file:...}` in `opencode.json`) |
| `templates/pheromones.yaml` | Per-finding-type half-life + decay curve (Pentest-Swarm primitive) |
| `templates/scope.json` + `scope.schema.json` | Allowed targets (Pentest-Swarm scope layer) |
| `templates/blackboard.json` + `blackboard.schema.json` | Append-only findings registry (Pentest-Swarm blackboard) |
| `templates/campaign_state.json` + `campaign_state.schema.json` | Agent cursors, budgets, cleanup queue (Pentest-Swarm campaign state) |
| `playbooks/<mode>.yaml` | Per-pipeline-mode agent activation policy |
| `council_blackboard_schema.json` | Master registry: 49 finding types, trigger predicates, consensus protocol, pipeline router |
| `council_state_template.json` | v2.0 per-session state (phases, consensus, checkpoints) |
| `scripts/blackboard.py` | CLI helper for read/write/decay/poll/checkpoint/cleanup/consensus |
| `scripts/ida_mcp_health.ps1` | IDA Pro MCP health check |
| `DEVELOPMENT.md` | Meta-guide for extending the system |

## Workspace per campaign

```
D:\Cracked\<binary_name>\
├── blackboard.json          # append-only findings (from templates/)
├── campaign_state.json      # orchestrator cursors + cleanup queue
├── scope.json               # allowed targets for this campaign
├── council_state.json       # phase status (from council_state_template.json)
├── checkpoints/             # LRU-capped snapshots for resume
│   └── blackboard.iterN.<ts>.json
├── reports/                 # final markdown reports
├── artifacts/               # compiled .exe deliverables
└── knowledge/               # research artifacts from @knowledge-base
```

## Blackboard Loop (the core)

```
loop:
  1. Read campaign_state.json + blackboard.json
  2. python scripts/blackboard.py decay --workspace <ws>      # apply pheromone decay
  3. python scripts/blackboard.py checkpoint --workspace <ws> # save snapshot
  4. For each agent A: poll --agent A
  5. Launch triggered agents in parallel (no shared output deps) or sequential
  6. Wait for all agents
  7. Agents write findings: write --type T --agent A --payload '{...}'
  8. Update agent_cursors, agents_completed/failed
  9. iteration += 1
  10. Check exit conditions → break if fired
```

## Five Exit Conditions

| Condition | Trigger | Action |
|---|---|---|
| **SUCCESS** | `CAMPAIGN_COMPLETE` pheromone ≥ 0.3 | delegate report + bounty, run cleanup |
| **STALL** | iteration ≥ 10 without completion | partial report, run cleanup |
| **ABORT** | 3+ agent failures OR budget exhausted | reverse-order cleanup, log |
| **SCOPE_VIOLATION** | target outside scope.json::in_scope | halt immediately, write finding, cleanup |
| **FATAL_ERROR** | IDA MCP unreachable >5 min OR session crash | save checkpoint, exit with diagnostic |

**On any exit:** `python scripts/blackboard.py run-cleanup --workspace <ws>` runs in LIFO order.

## Hard Rules

1. **Pure router** — orchestrator never analyzes code, writes C, or runs IDA tools itself.
2. **Never ask "should I proceed?"** — fully autonomous.
3. **All state via `scripts/blackboard.py`** — agents never read/write `blackboard.json` or `campaign_state.json` directly.
4. **Stale findings = corrupted model** — always run `decay` between poll cycles.
5. **Evidence over speculation** — every claim needs exact hex addresses, byte comparisons, and reproducible evidence.
6. **Native C deliverables** — all .exe artifacts (harness, patcher, keygen) compiled via MSYS64 MinGW. Python is debug-only.
7. **3/3 reproducibility** — pass^3 = 100% required for POC validation, UAC bypass validation, harness verification.

## Human-in-the-Loop Gates (HIGH-stakes only)

| Operation | Stakes | Required |
|---|---|---|
| Function enumeration, disassembly | LOW | No |
| Decompilation, xref analysis | MEDIUM | No |
| Binary patching | HIGH | **Yes** |
| 0-day report generation | HIGH | **Yes** |
| UAC bypass PoC validation | HIGH | **Yes** |
| Network-targeting exploit | HIGH | **Yes** |

For LOW/MEDIUM stakes, no approval needed — proceed autonomously.

## Agent Definition Format

```yaml
---
description: One-line purpose
mode: subagent
steps: 50                            # budget
tools:
  write: true
  edit: true
  bash: true
permission:
  mcp:
    ida_pro_mcp: allow
  task:
    "*": deny                       # leaf agent (no delegation)
  read: allow
  write: allow
  edit: allow
  bash: allow
---
```

Body sections: `## ON ENTRY` → `## YOUR JOB` → `## ON COMPLETION` → `## RULES`

## Build Commands (MSYS64)

```bash
# Standard harness
C:\msys64\ucrt64\bin\gcc.exe harness.c -o harness.exe

# With Windows API
C:\msys64\ucrt64\bin\gcc.exe harness.c -o harness.exe -lkernel32 -luser32 -lpsapi

# GUI patcher
windres patcher.rc -O coff -o patcher.res
C:\msys64\ucrt64\bin\g++.exe -mwindows -O2 -std=c++17 patcher.c patcher.res -o Patcher.exe -static -luser32 -lgdi32 -lshell32 -ladvapi32 -lcomctl32

# Keygen
C:\msys64\ucrt64\bin\gcc.exe keygen.c -o keygen.exe -mwindows -lgdi32
```

## Branding

- GUI patcher class name: `"SnifferPatcher"`
- Attribution: `"Developed By: Sniffer"`
- Workspace root: `D:\Cracked\<binary_name>\`

## Attribution

Stigmergic blackboard, pheromone decay, trigger predicates, cleanup registry, and consensus protocol ported from [Armur-Ai/Pentest-Swarm-AI](https://github.com/Armur-Ai/Pentest-Swarm-AI) (AGPL-3.0). Architecture pattern adaptation for OpenCode — not a Go source fork. AI execution via [OpenCode](https://opencode.ai).
