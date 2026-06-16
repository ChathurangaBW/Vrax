# Council Agent System — Future Development Guide

## Architecture Overview

```
User → @council-orchestrator (primary, router)
         │
         ├── "patch/keygen/license" keywords → PATCH PIPELINE
         │     Phase 1 → @security-analyst (license analysis)
         │     Phase 3 → @patcher (GUI patcher / keygen)    [NEW]
         │     Phase 4 → @qa-tester (verify unlocked) ← loops on FAIL
         │
         └── "crash/exploit/vuln" keywords → CRASH PIPELINE
               Phase 1 → @security-analyst (architecture mapping)
               Phase 2 → @vuln-isolator (vulnerability isolation)
               Phase 3 → @harness-engineer → @harness-generator (leaf)
               Phase 4 → @qa-tester (verify crash) ← loops on FAIL

Standalone: @malware-analyst (invoked directly by user)
```

## Key Files

| File | Purpose |
|---|---|
| `vrax.json` | Task permissions — controls who can delegate to whom |
| `council_state.json` | Shared state template — copied into workspace per session |
| `council_playbook.md` | Methodology reference — IDA MCP, MSYS64, evidence standards |
| `agents/*.md` | Individual agent prompts |

## How to Add a New Agent

1. **Create** `agents/<name>.md` with this template:
```yaml
---
description: One-line description of what this agent does
mode: subagent
model: claude/sonnet-3-ultra-free
temperature: 0.1
tools:
  write: true
  edit: true
  bash: true
permission:
  task:
    "*": deny           # leaf agent (no delegation)
    # "other-agent": allow  # uncomment if it needs to delegate
---
```

2. **Add the prompt body** — keep it under 50 lines. Structure:
   - `## ON ENTRY` — what to read from `council_state.json`
   - `## YOUR SINGLE JOB` — one focused responsibility
   - `## ON COMPLETION` — what to write to `council_state.json`
   - `## RULES` — 3-5 hard constraints

3. **Register in `vrax.json`** under `agent` (example name `security-analyst`):
```json
"security-analyst": {
  "permission": {
    "task": {
      "*": "deny"
    }
  }
}
```

4. **Wire into the pipeline** — update `council-orchestrator.md` to add a new Phase step, or keep standalone.

5. **Update `council_state.json`** if the new agent writes new state fields.

## How to Add a New Phase

1. Add a new phase block to `council_state.json`:
```json
"6_new_phase": {
  "status": "pending",
  "your_field": "",
  "notes": ""
}
```

2. Add the delegation step to `council-orchestrator.md` in the `## PIPELINE` section.

3. If the new phase agent needs to delegate, update `vrax.json` task permissions.

## Swarm Design Rules (Don't Break These)

| Rule | Why |
|---|---|
| Only `council-orchestrator` is `mode: primary` | Prevents agents competing for the user's attention |
| Each agent does exactly ONE job | LLMs lose focus with large prompts |
| Agents read/write `council_state.json` | Chat context is lost between sub-sessions |
| Methodology lives in `council_playbook.md` | Eliminates prompt duplication across agents |
| `permission.task` scopes delegation | Prevents circular handoffs |
| Agents return to caller, never hand off sideways | Orchestrator manages all routing |

## Potential Future Enhancements

### 1. Parallel Phase Execution
Currently the pipeline is strictly sequential. VRAX may support async subagent delegation in future — when it does, Phase 1 (mapping) and Phase 2 (vulnerability) could run in parallel since they're both IDA-based.

### 2. Multi-Target Batching
Extend `council_state.json` to hold an array of targets. The orchestrator would loop the entire pipeline per target.

### 3. Report History & Diffing
Add a `reports/` directory convention. Each run produces a timestamped `mitigation_eval_YYYYMMDD.md`. Future runs diff against previous to show regression/progression.

### 4. Agent Health Monitoring
Add a `## HEALTH CHECK` protocol to `council-orchestrator.md`:
- Before delegating, ping the agent with a trivial task
- If it fails (provider error), immediately fall back to using the exploit-developer as a universal backup

### 5. Custom Playbooks per Target Class
Fork `council_playbook.md` into target-specific playbooks:
- `playbook_pdf_readers.md` — PDF parsing, JavaScript engine, font rendering
- `playbook_browsers.md` — V8/SpiderMonkey, DOM, WebGL
- `playbook_office.md` — OLE, VBA, macro engine

### 6. Persistent State Across Sessions
Currently `council_state.json` is per-session. Consider adding a `council_history.db` (SQLite) that tracks:
- All past analyses with target hashes
- Known offsets per binary version
- Success/failure rates per verification loop iteration

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---|---|---|
| Agent loop stalls | Sub-agent asking "should I proceed?" | Remove any "wait for permission" language from its prompt |
| Agent does wrong phase's work | Prompt too long or mentions other agents | Shorten prompt, remove references to other agents |
| Circular delegation | Task permissions too permissive | Check `vrax.json` — leaf agents should have `"*": "deny"` |
| State not shared between agents | Agent not reading `council_state.json` | Add `## ON ENTRY: Read council_state.json` to its prompt |
| Provider error breaks loop | Model unavailable | Orchestrator's fallback protocol should redirect to `harness-engineer` |
