## Council + IDA Pro MCP Integration Guide (v2.0 — Stigmergic + Research-First)

This document explains how your **Council** agents work together with the **IDA Pro MCP** server and the merged **LIEF-based binary tools**, and how to drive them using natural-language prompts.

### Key architectural changes in v2.0
- **Stigmergic blackboard** (from Pentest-Swarm-AI): Agents self-activate via trigger predicates instead of sequential dispatch
- **Research-first protocol** (from agent-browser pattern): Knowledge-base agent researches latest CVEs/techniques before pipeline starts
- **MCP health gate**: Orchestrator blocks if IDA MCP is not connected and tells user how to fix it
- **Pheromone decay**: Findings fade over time; stale paths die naturally

---

### 1. Architecture overview

- **IDA Pro MCP plugin** (inside IDA):
  - Exposes IDA's APIs (analysis, disassembly, memory, debugging) over HTTP on `http://127.0.0.1:13337/mcp`.
- **ida-pro-mcp proxy server** (`ida_pro_mcp.server`):
  - Runs as an MCP server for OpenCode.
  - Forwards most JSON-RPC calls to the IDA HTTP server.
  - Registers extra **LIEF binary-analysis tools** in `binary_lief.py`.
  - Merges the LIEF tools into `tools/list`, so a single MCP id (`ida_pro_mcp`) exposes both IDA and LIEF tools.
- **OpenCode / Council agents**:
  - `opencode.json` defines MCP servers + **28 council agents** + **6 slash commands** (`/crash`, `/patch`, `/ctf`, `/malware`, `/zero-day`, `/uac-bypass`).
  - Council agents self-activate via stigmergic trigger predicates on `blackboard.json`.
  - `@knowledge-base` researches before any pipeline runs; `@pre-poc-research` gates all POC writing.

### Startup flow (MANDATORY)

```
User sends request (e.g., "find RCE in winword.exe")
    │
    ▼
┌─────────────────────────────────────────┐
│ STEP 0: IDA MCP HEALTH CHECK            │
│   mcp__ida-pro-mcp__list_funcs          │
│   ├── OK + binary loaded → continue     │
│   └── FAIL → BLOCK, tell user to fix    │
├─────────────────────────────────────────┤
│ STEP 1: RESEARCH-FIRST PROTOCOL         │
│   Delegate to @knowledge-base           │
│   → Searches CVE, GitHub, exploits,     │
│     MSRC, security blogs via webfetch    │
│   → Stores in knowledge-base/           │
│   → Returns 3-bullet summary            │
├─────────────────────────────────────────┤
│ STEP 2: BLACKBOARD INIT                 │
│   Write TARGET_REGISTERED with          │
│   research context + known CVEs         │
├─────────────────────────────────────────┤
│ STEP 3: STIGMERGIC BLACKBOARD LOOP      │
│   Poll → Activate triggered agents →    │
│   Collect → Decay → Repeat              │
│   Until CAMPAIGN_COMPLETE               │
└─────────────────────────────────────────┘
```

### 2. Stigmergic Blackboard Architecture (from Pentest-Swarm-AI)

- **IDA Pro MCP plugin** (inside IDA):
  - Exposes IDA’s APIs (analysis, disassembly, memory, debugging) over HTTP on `http://127.0.0.1:13337/mcp`.
- **ida-pro-mcp proxy server** (`ida_pro_mcp.server`):
  - Runs as an MCP server for OpenCode.
  - Forwards most JSON-RPC calls to the IDA HTTP server.
  - Registers extra **LIEF binary-analysis tools** in `binary_lief.py`.
  - Merges the LIEF tools into `tools/list`, so a single MCP id (`ida_pro_mcp`) exposes both IDA and LIEF tools.
- **OpenCode / Council agents**:
  - `opencode.json` defines an MCP server:
    - `"ida_pro_mcp": { "type": "local", "command": ["python","-m","ida_pro_mcp.server", ...], ... }`
  - Council agents (e.g. `council-orchestrator`, `security-analyst`) are allowed to call this MCP via:
    - `permission.mcp.ida_pro_mcp = "allow"`.

High-level flow in a Council run:

1. User talks to `@council-orchestrator`.
2. Orchestrator picks pipeline (`ctf` / `crash` / `patch` / `malware` / `zero-day` / `uac-bypass`) and delegates to subagents.
3. Subagents call **IDA MCP tools** (and now **LIEF tools**) through the same `ida_pro_mcp` MCP server.
4. Findings are written into `council_state.json` and summarized in final reports.

---

### 2. LIEF / binary tools exposed via `ida_pro_mcp`

All of these are implemented in `binary_lief.py` and registered on the same MCP server as IDA:

- **`get_binary_info(file_path)`**
  - Quick triage: format (PE/ELF/Mach-O), entry point, image base, section/import/export counts, NX & PIE, basic machine/subsystem info.
- **`get_binary_headers(file_path)`**
  - Full header dump:
    - PE: DOS + COFF + Optional headers (imagebase, entrypoint, DLL characteristics, etc.).
    - ELF: ELF header (class, endianness, ABI, entrypoint, PH/SH offsets, counts).
    - Mach-O: Mach header (CPU type, file type, flags).
- **`get_binary_sections(file_path, include_hashes=False, include_packer_heuristic=False)`**
  - Lists all sections:
    - Name, virtual address, size, entropy, flags/characteristics.
    - Optional: per-section `sha256` hash.
    - Optional: `packer_heuristic` and `high_entropy_executable_sections` list.
- **`get_binary_imports(file_path, limit=0)`**
  - PE: imports grouped by DLL, with name/hint/IAT address.
  - ELF/Mach-O: flat list of imported function names.
- **`get_binary_exports(file_path, limit=0)`**
  - PE: export table (name, ordinal, address, forwarded info).
  - ELF/Mach-O: flat list of exported function names.
- **`get_binary_libraries(file_path)`**
  - Dynamic library dependencies (DLLs / shared objects / dylibs).
- **`get_binary_security(file_path)`**
  - PE: ASLR, DEP/NX, SEH, CFG, AppContainer, signing status.
  - ELF: NX, PIE, RELRO, stack canary/FORTIFY_SOURCE heuristics.
  - Mach-O: PIE, NX, code signature flags, header flags, stack canary heuristic.
- **`get_binary_security_council(file_path)`**
  - Returns a `mitigations` object shaped like `phases.1_mapping.mitigations`:
    - `aslr`, `dep`, `cfg`, `stack_cookies` (plus `relro` for ELF).
- **`get_binary_strings(file_path, min_length=4, limit=0)`**
  - Extracts ASCII and UTF‑16 LE strings with offsets and encoding.
- **`get_binary_rich_header(file_path)`**
  - PE only: Rich header entries (compiler/tool IDs, counts, checksum).
- **`get_binary_resources(file_path)`**
  - PE only: resource directory tree (icons, version info, manifests, etc.).
- **`get_binary_tls(file_path)`**
  - PE: TLS callbacks and TLS directory addresses.
  - ELF/Mach-O: basic TLS presence information.
- **`get_binary_overlay(file_path)`**
  - Detects overlay data after the last section (offset and size).
- **`get_binary_delayed_imports(file_path, limit=0)`**
  - PE only: delayed-load import table (DLL + functions).
- **`get_binary_batch(file_paths: list[str])`**
  - Runs `get_binary_info` on multiple paths in one call.
- **`get_binary_report(file_path, include_section_hashes=False, include_packer_heuristic=False)`**
  - One-shot triage: `info + headers + sections + security` for a given binary.

> These tools are available in any Council agent that has `mcp.ida_pro_mcp: allow` permission. In prompts you refer to them as “MCP binary analysis tools” and let the agent call them as needed.

---

### 3. IDA Pro MCP capabilities (high level)

From the Council’s perspective, IDA MCP provides:

- **Function and callgraph APIs**: `lookup_funcs`, `list_funcs`, `callees`, `callgraph`, `basic_blocks`.
- **Data / memory / struct APIs**: `read_struct`, `search_structs`, `infer_types`, `get_bytes`.
- **Analysis helpers**: xref queries, string searches (`find_bytes`, regex search), type info, etc.
- **Patching helpers**: `patch_asm`, comment and rename APIs (`set_comments`, `rename`).
- **Debugging / stack / resources** via the `ida_mcp.api_*` modules.

Council agents use these implicitly; you usually don’t need to call them manually unless you are writing a custom agent.

---

### 4. Council agents and their roles (with example prompts)

You normally talk only to **`@council-orchestrator`**. It delegates via OpenCode `Task` and manages state through `scripts/blackboard.py`.

#### Primary router

- **`@council-orchestrator`** — Blackboard scheduler (not sequential dispatcher)
  - MCP health gate → research-first → blackboard loop
  - Workspace: `D:\Cracked\<binary_name>\`
  - Never analyzes code directly

#### Slash commands

| Command | Pipeline | Playbook |
|---------|----------|----------|
| `/crash` | Known crash → harness | `playbooks/crash.yaml` |
| `/patch` | License bypass → patcher | `playbooks/patch.yaml` |
| `/ctf` | Crackme / flag | `playbooks/ctf.yaml` |
| `/malware` | Unpack / C2 / YARA | `playbooks/malware.yaml` |
| `/zero-day` | Novel vuln hunt → 3/3 POC | `playbooks/zero-day.yaml` |
| `/uac-bypass` | UAC elevation discovery | `playbooks/uac-bypass.yaml` |

**Typical orchestrator prompts**:

- **ZERO-DAY**: “Target `C:\path\to\app.exe` (loaded in IDA). Hunt novel vulnerabilities. `/zero-day`. 3/3 POC + compiled artifact required.”
- **PATCH**: “Target `C:\path\to\app.exe`. License bypass + C patcher/keygen (MSYS64). PATCH pipeline.”
- **CRASH**: “Target `C:\path\to\crashy.exe`. Reproduce crash, RIP control harness. CRASH pipeline.”
- **CTF**: “CTF `C:\crackmes\challenge.exe`. Flag or success patch. CTF pipeline.”

#### All registered agents (28)

| Agent | Role | Pipeline(s) |
|-------|------|-------------|
| `security-analyst` | Phase 1 mapping, mitigations | All |
| `knowledge-base` | Phase 0.5 research-first | All |
| `pre-poc-research` | Side-brain: internet PoC search | All |
| `cve-researcher` | CVE/NVD correlation | zero-day |
| `zero-day-hunter` | Novel vuln + 3/3 POC | zero-day |
| `vuln-isolator` | Known crash isolation | crash |
| `harness-engineer` / `harness-generator` | C harness | crash, zero-day |
| `fuzz-harness-generator` | Fuzz harness | crash |
| `rop-chain-builder` | ROP chains | crash, zero-day |
| `patcher` | GUI patcher + keygen | patch, ctf |
| `qa-tester` | pass^3 verification | All |
| `telemetry-structurer` | Crash telemetry JSON | crash, zero-day |
| `interactive-debugger` | Interactive debug | zero-day |
| `report-generator` / `bounty-reporter` | Reports / bounty | All |
| `malware-analyst` / `c2-analyst` / `yara-ioc-generator` | Malware analysis | malware |
| `anti-anti-debug` / `memory-forensics` | Evasion / forensics | malware |
| `differential-analyst` | Binary diff | zero-day |
| `uac-bypass-discovery` / `uac-poc-validator` | UAC bypass | uac-bypass |
| `context-compactor` / `council-test-runner` | Support / dev | All |

**V2 side-brains (planned):** `validation-brain`, `threat-intel-brain`, `compliance-brain`, `critic-brain` — see `docs/SIDE_BRAIN_ARCHITECTURE.md`.

#### zero-day-hunter vs vuln-isolator

| Agent | When | Focus |
|-------|------|-------|
| `@zero-day-hunter` | “0-day”, “novel”, `/zero-day` | Hunt **unknown** vulnerabilities |
| `@vuln-isolator` | “reproduce crash”, `/crash` | Isolate **known** crashes |

#### ZERO-DAY pipeline

```
Phase 0.5:  @knowledge-base       → RESEARCH_COMPLETE
Phase 1:    @security-analyst     → ATTACK_SURFACE_FOUND
Phase 2.7:  @pre-poc-research      → PRE_POC_RESEARCH_COMPLETE
Phase 2.5:  @zero-day-hunter       → POC_VALIDATED (3/3 + .exe SHA256)
Phase 3:    @harness-engineer     → HARNESS_COMPILED
Phase 4:    @qa-tester             → VERIFICATION_RESULT
Report:     @report-generator      → REPORT_GENERATED
```

---

### 5. Example MCP usage prompts (binary tools)

You can either let Council agents call these implicitly, or ask an agent (or direct MCP client) to use them explicitly.

- **Quick security triage for a PE**:
  - “Using `@mcp:ida_pro_mcp`, call `get_binary_report` on `C:\Windows\System32\notepad.exe` and summarize mitigations, imports, and any high-entropy executable sections. Include the `mitigations` object in council-state format.”
- **Strings + overlay check**:
  - “Use `get_binary_strings` (min_length=6, limit=50) and `get_binary_overlay` via `ida_pro_mcp` on `C:\path\to\target.exe`. Highlight URLs, crypto constants, and whether there is any appended overlay data.”
- **Delayed imports**:
  - “Call `get_binary_delayed_imports` on `C:\path\to\target.exe` and list delayed-load DLLs and functions that look like network or licensing checks.”

---

### 6. Operational notes

- **IDA online vs offline**:
  - If IDA is running and the plugin server is up on `http://127.0.0.1:13337`, `ida_pro_mcp` exposes both:
    - All IDA tools.
    - All LIEF `get_binary_*` tools.
  - If IDA is **not** running:
    - `ida_pro_mcp` still starts and at least exposes the LIEF tools (thanks to the `tools/list` fallback), so OpenCode/Council can still do static triage from disk.
- **File size guard**:
  - Very large files (>512 MiB) are rejected by LIEF parsing to avoid stalls; the tools return a structured `error` message in that case.

### 7. Research-First Protocol (NEW in v2.0)

Before any pipeline runs, the orchestrator delegates to `@knowledge-base` to research the target and vulnerability class. This uses built-in `webfetch` to search:

| Source | What it finds |
|--------|--------------|
| **CVE/NVD** | Known vulnerabilities for the target application |
| **GitHub** | Public PoCs, exploit code, research repositories |
| **MSRC** | Microsoft security updates for Windows targets |
| **Exploit-DB** | Published exploits with code |
| **Security blogs** | Recent write-ups, conference talks, technique evolution |

Results are stored in `knowledge-base/`:
```
knowledge-base/
├── reports/2026/<target>_<vuln_class>_research.md
├── techniques/<vuln_class>_2026.md
├── targets/<target>.md
└── index.json
```

The orchestrator seeds the blackboard with research context (known CVEs, recommended analysis strategy) so every subsequent agent benefits from pre-researched intelligence.

### 8. MCP Health Gate (NEW in v2.0)

The orchestrator enforces a hard gate: before any work begins, it tests IDA MCP connectivity. If unreachable:

```
⛔ IDA Pro MCP NOT CONNECTED

The IDA Pro MCP server is not reachable or no binary is loaded.

To fix:
1. Open IDA Pro and load the target binary
2. Run the MCP server plugin
3. Verify the server is listening on http://127.0.0.1:13337
4. Run: pwsh -File scripts/ida_mcp_health.ps1

Then re-send your request.
```

The health check script (`scripts/ida_mcp_health.ps1`) tests 4 conditions:
1. HTTP connectivity to MCP server
2. Binary loaded in IDA (at least 1 function enumerated)
3. Core tools available (list_funcs, decompile, imports, get_bytes, etc.)
4. Binary security tools available (get_binary_security, get_binary_report, etc.)

This integration lets you treat **IDA Pro + LIEF** as one unified MCP surface (`ida_pro_mcp`), while your Council agents coordinate through a **stigmergic blackboard** with research-backed context. Web research via `webfetch` ensures every pipeline starts with the latest vulnerability intelligence.

