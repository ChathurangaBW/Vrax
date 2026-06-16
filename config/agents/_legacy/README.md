# DEPRECATED — DO NOT USE

**This file is the legacy v2.0 single-file council state schema. It is retained for historical reference only.**

As of the v2.0 → v3.0 refactor (2026-06-06), the Council uses a **file-based stigmergic state model**:

| New file (use this) | Purpose |
|---|---|
| `templates/blackboard.json` + `blackboard.schema.json` | Append-only findings registry |
| `templates/campaign_state.json` + `campaign_state.schema.json` | Agent cursors, budgets, cleanup queue, fallback policy |
| `templates/scope.json` + `scope.schema.json` | Allowed targets (enforced before every external call) |
| `templates/pheromones.yaml` | Per-finding-type half-life + decay curve (central config) |
| `council_blackboard_schema.json` | Master registry: finding types, trigger predicates, consensus protocol, pipeline router |

## How the new system initializes

```bash
python scripts/blackboard.py init \
  --workspace "D:/Cracked/<binary>" \
  --binary   "D:/Cracked/<binary>/<binary>.exe" \
  --mode     <crash|patch|ctf|malware|zero-day|uac-bypass> \
  --playbook "playbooks/<mode>.yaml" \
  --campaign-id "camp-$(date -u +%Y%m%d%H%M%S)"
```

This creates the per-campaign `blackboard.json` + `campaign_state.json` + `scope.json` and writes a `TARGET_REGISTERED` finding with pheromone=1.0.

## What replaced each old field

| Old (this file) | New location |
|---|---|
| `phases` | `campaign_state.json::agents_completed` + `phases_completed` arrays |
| `research` | `blackboard.json` findings of type `RESEARCH_COMPLETE` |
| `consensus.votes` | `blackboard.json` findings of type `VOTE_CAST` + `CONSENSUS_REACHED` |
| `approvals.pending_approval[]` | `campaign_state.json::approvals` |
| `artifacts[]` | `campaign_state.json::artifacts` |
| `errors[]` | `campaign_state.json::errors` |
| `exit_condition` | `campaign_state.json::exit` |
| `checkpoints[]` | `campaign_state.json::checkpoints` + workspace `checkpoints/` directory |

## How to migrate an old `council_state.json` to the new model

Not supported. The new model is structurally different (multi-file, append-only, pheromone-weighted). Start a fresh campaign by running `init` and re-running your agents.

## See also

- `prompts/agents/council-orchestrator.txt` — canonical orchestrator prompt
- `DEVELOPMENT.md` — architecture guide
- `AGENTS.md` — agent index
