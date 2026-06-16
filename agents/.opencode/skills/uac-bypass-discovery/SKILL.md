---
name: uac-bypass-discovery
description: Windows UAC bypass catalog and verification via IDA Pro MCP and PE analysis. Loads for UAC bypass, autoElevate, UACME sync, fodhelper, SilentCleanup, RAiLaunchAdminProcess, appinfo.dll, elevation without prompt, Administrator Protection. OpenCode agent uac-bypass-discovery must load this skill on every run.
compatibility: opencode
---

# UAC Bypass Discovery (OpenCode Skill)

> **IF USER INPUT IS "start", "go", "begin", or no specific target:**
> DO NOT list options. DO NOT read `.` or home directory. DO NOT ask questions.
> READ `C:\Users\Sniffer\.opencode\agents\uac_coverage_taxonomy.json` first.
> Pick the first entry NOT already in `loop_state.json → tried_techniques` as the target.
> Call `ida_pro_mcp` `imports` on that binary. Write `loop_state.json`. Start now.

## On load

1. **Auto-start check first:** if no target in user message → use Priority Table in agent Step 1, workspace is `D:\Cracked\uac-lab\`. No clarification needed.
2. Read `C:\Users\Sniffer\.opencode\agents\uac-bypass-playbook` (skip if missing — do not search)
3. Read `C:\Users\Sniffer\.opencode\agents\uac_coverage_taxonomy.json` (get attack_surfaces)
4. **Pipeline only:** IDA RE → write `uac_candidates.json` → delegate `@uac-poc-validator` → Phase 2 merges VALIDATED 3/3 only.
5. **DO NOT write 40-method catalog reports.** The moment IDA returns addresses, write `uac_candidates.json` and delegate.
6. Run **`py -3.14 C:\Users\Sniffer\.opencode\agents\uac_validate.py --workspace <dir> --mode bounty`** before done.

## Output format

**When IDA finds a candidate:** immediately write `uac_candidates.json` with IDA addresses and delegate to `@uac-poc-validator`. Do not buffer results into a report first.

**Only after `uac_poc_results.json` exists** with ≥1 VALIDATED: write `uac_bounty_report.md` citing IDA address + PoC evidence path per claim.

**Catalog mode** (user explicitly asks `--mode catalog`): populate `uac_master_list.json` with `HYPOTHESIS` / `VERIFIED_PATCHED` only — never `BOUNTY_VALIDATED` without PoC.

## Anchors

FodHelper registry | SilentCleanup task/env | APPINFO `RAiLaunchAdminProcess`

## IDA MCP

Use `ida_pro_mcp` tools per playbook. Priority: `appinfo.dll`, `consent.exe`, `fodhelper.exe`, `sdclt.exe`.

## Rules

- Never `VERIFIED_*` without `evidence_sources`
- No weaponized PoC source
- For deep-dive requests, write `coverage_audit.md` and classify every lane as `COVERED`, `ABSENT_WITH_PROOF`, or `BLOCKED_WITH_REASON`
- Address the user's uncovered areas explicitly when present: GUID meaning, COM object activation, CBS purpose, callback handlers, `PerformOCWithHandlerAndSourcesEx2`, toast/resource paths, globals, and initializer chains
## Detection patterns

Registry: ms-settings, mscfile, exefile handler hijacks; empty DelegateExecute.
Sysmon: E1 elevated parent lineage; E13 suspicious Classes keys.
COM: CoCreateInstance to elevated CLSIDs from medium IL.
