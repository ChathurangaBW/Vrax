# VRAX Implementation Plan v3.0
# Grounded in real OpenCode config at C:\Users\Sniffer\.opencode

**Date**: 2026-06-13  
**Status**: Authoritative — supersedes all prior plans  

---

## What Already Exists (DO NOT REBUILD)

This is the most important section. 60% of the infrastructure is live.

### MCP Servers — Live, connected

| Server | Priority | Port | Transport | Tool Count |
|--------|----------|------|-----------|-----------|
| `ghidra_mcp` | PRIMARY | 8081 | streamable-HTTP | 249 |
| `ida_pro_mcp` | SECONDARY | 13337 | stdio (Python bridge) | 32 |
| `binary_ninja_mcp` | SECONDARY | 9009 | SSE (Python bridge) | 60+ |
| `zap` | WEB | 8282 | HTTP | 8 |

Health check URLs:
- Ghidra: `http://127.0.0.1:8081/mcp`
- BN: `http://localhost:9009`
- ZAP: `http://localhost:8282`

Start command for Ghidra bridge:
```
python D:\ghidra-mcp\bridge_mcp_ghidra.py --transport streamable-http --mcp-host 127.0.0.1 --mcp-port 8081
```

### 29 Agent Definitions — In `opencode.json`, fully configured

**Primary orchestrator:**
- `council-orchestrator` — Routes all 6 pipeline modes, manages phase state, delegates to sub-agents

**Phase agents:**
- `security-analyst` — Phase 1: binary mapping, mitigations, attack surface, license logic
- `vuln-isolator` — Phase 2: crash isolation, bad chars, padding calc, RIP control proof
- `harness-engineer` — Phase 3: harness design + coordination (delegates to harness-generator)
- `harness-generator` — Phase 3: C code generation for MSYS64/MinGW with visible window + JSON telemetry
- `patcher` — Phase 3 (PATCH mode): GUI patcher + keygen from patch_points
- `qa-tester` — Phase 4: 3/3 run verification, pass^3 gate, evidence capture
- `telemetry-structurer` — Support: IDA debugger attach, crash JSON output

**Specialist agents:**
- `malware-analyst` — MALWARE mode: unpack, C2 extraction, IOC/YARA generation
- `zero-day-hunter` — Phase 2.5: novel vuln discovery, mandatory 3/3 POC gate
- `rop-chain-builder` — ROP gadget search, DEP bypass, stack pivot chains
- `fuzz-harness-generator` — WinAFL/libfuzzer harness generation
- `anti-anti-debug` — IsDebuggerPresent/PEB/rdtsc bypass (HIGH STAKES: needs approval)
- `c2-analyst` — C2 protocol mapping, encryption, beacon patterns
- `differential-analyst` — 1-day exploit: patched vs unpatched binary diff
- `interactive-debugger` — WinDbg/CDB/TTD time-travel debugging
- `memory-forensics` — Volatility3 post-exploit memory dump analysis
- `pre-poc-research` — Phase 2.7: mandatory internet research before POC code
- `cve-researcher` — NVD/Exploit-DB cross-reference, KNOWN/VARIANT/0-day classification
- `yara-ioc-generator` — 5-category YARA rules, STIX 2.1 bundles, OpenIOC
- `bounty-reporter` — HackerOne/MSRC/ZDI submission-ready reports + CVSS
- `report-generator` — CVSS v3.1 scoring, PDF-ready markdown reports
- `knowledge-base` — Pre-pipeline web research (GitHub, CVE, NVD, MSRC, blogs)
- `context-compactor` — Decompiler output to compact XML (~70% token reduction)
- `critic-brain` — 7-attack adversarial checklist, finds logical flaws
- `validation-authority` — 6-gate evidence framework evaluation
- `audit-brain` — Immutable audit record, chain of custody
- `council-test-runner` — Self-validation against known-vulnerable binaries

### Model Router — `agent_model_map.json`

When calling OpenCode API with `agent: "<name>"`, model is automatically selected:

| Complexity | Models |
|------------|--------|
| High (vuln reasoning) | qwen3.7-max, glm-5.1 |
| Medium (RE + code gen) | deepseek-v4-pro, qwen3.7-plus, minimax-m2.7 |
| Low (fast, high volume) | deepseek-v4-flash, mimo-v2.5 |
| Large context | minimax-m3 (1M ctx), kimi-k2.6 |

Key assignments:
- `council-orchestrator` → deepseek-v4-pro (routing, state management)
- `zero-day-hunter` → qwen3.7-max (highest intelligence tier)
- `critic-brain` → glm-5.1 (adversarial reasoning)
- `malware-analyst` → minimax-m3 (large context for C2 analysis)
- `report-generator` → kimi-k2.6 (large context report generation)
- `audit-brain` → deepseek-v4-flash (fast, high-volume)

### Schema Files — Ready to use

**`council_blackboard_schema.json`** — 49 finding types, each with pheromone half-life decay:
- `TARGET_REGISTERED`, `MITIGATION_MAPPED`, `ATTACK_SURFACE_FOUND`, `LICENSE_CHECK_FOUND`
- `VULNERABILITY_IDENTIFIED`, `CRASH_ISOLATED`, `RIP_CONTROL_PROVEN`, `PATCH_READY`
- `HARNESS_COMPILED`, `TELEMETRY_CAPTURED`, `VERIFICATION_RESULT`, `FLAG_EXTRACTED`
- `MALWARE_CLASSIFIED`, `C2_IDENTIFIED`, `IOC_GENERATED`, `YARA_RULE_GENERATED`
- `ZERO_DAY_CONFIRMED`, `UAC_BYPASS_FOUND`, `ROP_CHAIN_BUILT`, `REPORT_GENERATED`
- ...and 29 more

Half-life: `RIP_CONTROL_PROVEN` = 600s (linear decay, urgent), `MITIGATION_MAPPED` = 7200s (exponential)

**`council_state_template.json`** — Phase tracking schema:
```json
{
  "pipeline": { "mode": "", "status": "idle", "current_phase": 0 },
  "phases": {
    "0_check":       { "status": "pending", "result": { "mcp_reachable": false, "binary_loaded": false } },
    "1_mapping":     { "status": "pending", "result": { "mitigations": {}, "attack_surface": [] } },
    "2_vulnerability":{ "status": "pending", "result": { "confidence": 0.0, "rip_control": false } },
    "3_exploitation":{ "status": "pending", "result": { "harness_path": "", "harness_compiled": false } },
    "4_verification":{ "status": "pending", "result": { "pass_count": 0, "pass_hat_k": false } }
  },
  "consensus":  { "vuln_classification": { "confidence": 0.0 } },
  "approvals":  { "pending": [], "granted": [], "denied": [] },
  "artifacts":  { "reports": [], "harnesses": [], "patchers": [], "yara_rules": [], "iocs": [] }
}
```

### Pipeline Commands — `C:\Users\Sniffer\.opencode\commands\`

| File | Mode | Phase sequence |
|------|------|----------------|
| `crash.md` | CRASH | 1_mapping → 2_vulnerability → 3_harness → 4_verification |
| `patch.md` | PATCH | 1_mapping → 3_patcher+keygen → 4_verification |
| `ctf.md` | CTF | 1_mapping → 2_flag_extract OR 3_minimal_patch |
| `malware.md` | MALWARE | standalone malware-analyst → IOC + YARA |
| `zero-day.md` | ZERO-DAY | 1_mapping → 2.5_zero-day-hunter → pre-poc-research → 3_POC → 4_validation |
| `uac-bypass.md` | UAC-BYPASS | 1_mapping → 2_technique_discovery → 3_bypass_POC → 4_verification |

Gate thresholds (from `crash.md`):
- Phase 1→2: `confidence >= 0.6` AND `verdict != SAFE`
- Phase 2→3: `rip_control.proven == true` OR explicit downgrade explanation
- Phase 3→4: harness compiles with Wall -Wextra, zero warnings
- Phase 4 final: `pass^3 == 3/3` AND `overall_verdict == PASS`

### Infrastructure Paths

```
Campaign workspace root:   D:\vrax\campaigns
OpenCode HTTP server:      http://localhost:4747
OpenCode config root:      C:\Users\Sniffer\.opencode
GCC build chain:           C:\msys64\ucrt64\bin\gcc.exe
Knowledge base:            C:\Users\Sniffer\.opencode\knowledge-base
Central brain:             C:\Users\Sniffer\.opencode\.central_brain
```

---

## What Must Be Built From Scratch

### Package: `packages/council/`

The TypeScript `CouncilOrchestrator` that drives the full pipeline.
OpenCode currently uses AI text-delegation. VRAX replaces that with TypeScript-driven execution.

### Package: `packages/app/` (UI pages)

VRAX Electron UI that reads from council JSON files and renders mission control.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│  VRAX Electron App (packages/app)                               │
│                                                                 │
│  ┌──────────┐  ┌────────────────────────┐  ┌──────────────┐   │
│  │ LeftNav  │  │   WorkspaceContent     │  │  Operator    │   │
│  │          │  │  (Pipeline / Swarm /   │  │  Console     │   │
│  │          │  │   Blackboard / etc)    │  │  (3 modes)   │   │
│  └──────────┘  └────────────────────────┘  └──────────────┘   │
│                              │ IPC events                       │
└──────────────────────────────┼──────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────┐
│  Electron Main Process (packages/app/src/main/)                  │
│  CouncilBridge — spawns CouncilOrchestrator in worker thread     │
│  FileWatcher — watches council_state.json + blackboard.json      │
│  IPC handlers: launch-pipeline, abort-pipeline, hitl-decision    │
└──────────────────────────────┬───────────────────────────────────┘
                               │
┌──────────────────────────────▼────────────────────────────────────┐
│  packages/council/ — CouncilOrchestrator (TypeScript worker)      │
│                                                                    │
│  CouncilOrchestrator                                               │
│    ├── BlackboardManager   ─── blackboard.json in campaign dir     │
│    ├── CouncilStateManager ─── council_state.json in campaign dir  │
│    ├── SessionClient       ─── POST http://localhost:4747/session  │
│    ├── PhaseRunner         ─── one agent session per phase         │
│    ├── ConsensusEngine     ─── weighted pheromone vote             │
│    ├── HITLGate            ─── pause + emit when confidence < 0.70 │
│    └── DepositInterceptor  ─── intercepts deposit_finding calls    │
└──────────────────────────────┬────────────────────────────────────┘
                               │ HTTP
┌──────────────────────────────▼────────────────────────────────────┐
│  OpenCode HTTP Server — localhost:4747                             │
│  Sessions spawned per agent:                                       │
│  - POST /session  { agent: "security-analyst", ... }              │
│  - POST /session/:id/message { content: "..." }                    │
│  - POST /session/:id/abort                                         │
│  - SSE /session/:id/events (streaming tool calls + output)         │
│                                                                    │
│  MCP servers: ghidra_mcp (8081 PRIMARY), ida_pro_mcp (13337),      │
│  binary_ninja_mcp (9009), zap (8282)                               │
└────────────────────────────────────────────────────────────────────┘
```

---

## Build Phase A — `packages/council/` Core

These are standalone TypeScript classes. Build and test with no UI.

### A1: `src/session-client.ts`

Thin HTTP wrapper around the OpenCode API at `localhost:4747`.
When you pass `agent: "security-analyst"`, OpenCode auto-routes to the right model.

```typescript
export class SessionClient {
  async createSession(params: {
    agent: string           // e.g. "security-analyst" — model routed automatically
    workdir: string         // D:\vrax\campaigns\<campaignId>
    systemPromptAppend?: string   // injects deposit_finding tool description
  }): Promise<string>       // returns session ID

  async sendMessage(sessionId: string, content: string): Promise<void>

  // SSE stream: yields tool_call, message_delta, message_stop events
  async *streamEvents(sessionId: string): AsyncGenerator<CouncilEvent>

  async abortSession(sessionId: string): Promise<void>
}

type CouncilEvent =
  | { type: "tool_call"; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; toolCallId: string; content: string }
  | { type: "message_delta"; content: string }
  | { type: "message_stop"; reason: string }
  | { type: "error"; message: string }
```

### A2: `src/blackboard.ts`

Reads and writes `D:\vrax\campaigns\<campaignId>\blackboard.json`.
Implements the pheromone decay math from `council_blackboard_schema.json`.

```typescript
export class BlackboardManager {
  constructor(private campaignDir: string) {}

  deposit(finding: FindingEntry): void
  // finding.type must be one of 49 types in council_blackboard_schema.json
  // initial pheromone = 1.0, min_activation_threshold = 0.2
  // half-life decay per finding_type_definitions[type].half_life_seconds

  getActiveFindings(minPheromone?: number): FindingEntry[]
  getFindingsByType(type: FindingType): FindingEntry[]
  getSummary(): BlackboardSummary
  decay(): void   // call every 60s — exponential or linear per type's decay_curve

  consensusScore(): number  // weighted average of key finding pheromone values
}

interface FindingEntry {
  id: string
  type: FindingType     // one of 49 defined types
  pheromone: number     // 0.0 – 1.0
  created_at: string
  updated_at: string
  agent: string         // e.g. "security-analyst"
  data: Record<string, unknown>
  xrefs: string[]       // IDs of related findings
}
```

### A3: `src/council-state.ts`

Reads and writes `D:\vrax\campaigns\<campaignId>\council_state.json`.
Initialized from `C:\Users\Sniffer\.opencode\council_state_template.json`.

```typescript
export class CouncilStateManager {
  constructor(private campaignDir: string) {}

  init(params: { binary: BinaryInfo; mode: PipelineMode }): CouncilState
  setPhaseStatus(phase: PhaseId, status: PhaseStatus): void
  setPhaseResult(phase: PhaseId, result: Partial<PhaseResult>): void
  addApprovalRequest(op: ApprovalRequest): void
  resolveApproval(id: string, decision: "GRANTED" | "DENIED", justification: string): void
  addArtifact(type: ArtifactType, path: string): void
  addCheckpoint(phase: PhaseId, reason: string): void
  get(): CouncilState
  save(): void
}

type PipelineMode = "CRASH" | "PATCH" | "CTF" | "MALWARE" | "ZERO-DAY" | "UAC-BYPASS"
type PhaseId = "0_check" | "1_mapping" | "2_vulnerability" | "3_exploitation" | "4_verification"
type PhaseStatus = "pending" | "running" | "passed" | "failed" | "skipped"
```

### A4: `src/deposit-interceptor.ts`

Watches SSE event stream for `tool_call` events named `deposit_finding`.
The tool doesn't exist in OpenCode — it's injected via `systemPromptAppend`.
The orchestrator intercepts it and writes to the blackboard before the AI knows the "result".

```typescript
export class DepositInterceptor {
  constructor(
    private blackboard: BlackboardManager,
    private state: CouncilStateManager,
    private onDeposit: (finding: FindingEntry) => void
  ) {}

  // Returns true if the event was a deposit_finding call (intercepted)
  // Returns false if it's a regular OpenCode tool call (pass through)
  intercept(event: CouncilEvent): boolean
}

// Injected into every agent session via systemPromptAppend:
const DEPOSIT_TOOL_INJECTION = `
You have one additional tool: deposit_finding
Use it to register discoveries on the shared blackboard.
Parameters:
  type: one of [TARGET_REGISTERED, ATTACK_SURFACE_FOUND, VULNERABILITY_IDENTIFIED,
        CRASH_ISOLATED, RIP_CONTROL_PROVEN, PATCH_READY, HARNESS_COMPILED,
        VERIFICATION_RESULT, FLAG_EXTRACTED, MALWARE_CLASSIFIED, C2_IDENTIFIED,
        IOC_GENERATED, YARA_RULE_GENERATED, ZERO_DAY_CONFIRMED, UAC_BYPASS_FOUND,
        ROP_CHAIN_BUILT, MITIGATION_MAPPED, TELEMETRY_CAPTURED, REPORT_GENERATED]
  summary: string
  confidence: number (0.0 – 1.0)
  data: object (all relevant technical details)
  xrefs: string[] (IDs of related findings, may be empty)
`
```

### A5: `src/phase-runner.ts`

Executes one pipeline phase by spawning an OpenCode session with the right agent.
Drives it until `message_stop` or timeout. Feeds every event through DepositInterceptor.

```typescript
export class PhaseRunner {
  constructor(
    private client: SessionClient,
    private blackboard: BlackboardManager,
    private state: CouncilStateManager,
    private interceptor: DepositInterceptor,
    private onEvent: (evt: PhaseEvent) => void
  ) {}

  async run(config: PhaseConfig): Promise<PhaseResult>
}

interface PhaseConfig {
  phase: PhaseId
  agent: string       // OpenCode agent name e.g. "security-analyst"
  prompt: string      // Phase-specific prompt built from current state
  workdir: string     // D:\vrax\campaigns\<campaignId>
  timeoutMs?: number  // default 300_000 (5 min)
}

// Events forwarded to Electron IPC:
type PhaseEvent =
  | { type: "phase_started"; phase: PhaseId; agent: string }
  | { type: "output_delta"; phase: PhaseId; content: string }
  | { type: "finding_deposited"; finding: FindingEntry }
  | { type: "tool_called"; tool: string; input: unknown }
  | { type: "phase_completed"; phase: PhaseId; result: PhaseResult }
  | { type: "phase_failed"; phase: PhaseId; error: string }
  | { type: "hitl_gate"; reason: string; confidence: number }
```

### A6: `src/orchestrator.ts`

THE CORE PRODUCT. Determines phase sequence per mode, runs phases sequentially,
enforces gate thresholds, triggers HITL when confidence drops below 0.70.

```typescript
export class CouncilOrchestrator {
  constructor(
    private campaignDir: string,
    private onEvent: (evt: OrchestratorEvent) => void
  ) {}

  async launch(params: {
    binaryPath: string
    mode: PipelineMode
    campaignId: string
  }): Promise<void>

  async abort(): Promise<void>

  resolveHITL(decision: "YES" | "NO", note?: string): void
}

// Phase sequences per mode:
const PHASE_SEQUENCES: Record<PipelineMode, PhaseId[]> = {
  "CRASH":      ["0_check", "1_mapping", "2_vulnerability", "3_exploitation", "4_verification"],
  "PATCH":      ["0_check", "1_mapping", "3_exploitation", "4_verification"],
  "CTF":        ["0_check", "1_mapping", "2_vulnerability", "3_exploitation"],
  "MALWARE":    ["0_check", "1_mapping"],   // malware-analyst standalone from here
  "ZERO-DAY":   ["0_check", "1_mapping", "2_vulnerability", "3_exploitation", "4_verification"],
  "UAC-BYPASS": ["0_check", "1_mapping", "2_vulnerability", "3_exploitation", "4_verification"],
}

// Agent per phase per mode:
const PHASE_AGENTS: Record<PipelineMode, Partial<Record<PhaseId, string>>> = {
  "CRASH": {
    "0_check":        "council-orchestrator",
    "1_mapping":      "security-analyst",
    "2_vulnerability":"vuln-isolator",
    "3_exploitation": "harness-engineer",
    "4_verification": "qa-tester",
  },
  "PATCH": {
    "0_check":        "council-orchestrator",
    "1_mapping":      "security-analyst",
    "3_exploitation": "patcher",
    "4_verification": "qa-tester",
  },
  // ...etc.
}

// Gate evaluators — each returns true if safe to advance:
const GATES: Record<string, (state: CouncilState, bb: BlackboardManager) => boolean> = {
  "1_mapping→2_vulnerability": (state) =>
    state.phases["2_vulnerability"].result.confidence >= 0.6 &&
    state.consensus.vuln_classification.final_verdict !== "SAFE",

  "2_vulnerability→3_exploitation": (state) =>
    state.phases["2_vulnerability"].result.rip_control === true,

  "3_exploitation→4_verification": (state) =>
    state.phases["3_exploitation"].result.harness_compiled === true,

  "4_verification→done": (state) =>
    state.phases["4_verification"].result.pass_hat_k === true,
}

const HITL_THRESHOLD = 0.70  // fire HITL gate if consensusScore() < this
```

### A7: `src/consensus.ts`

Weighted pheromone vote from active blackboard findings.

```typescript
export class ConsensusEngine {
  constructor(private blackboard: BlackboardManager) {}

  score(): number   // 0.0 – 1.0, weighted average with key-type multipliers

  vote(agents: string[]): ConsensusVote
}

// Pheromone weight multipliers for consensus scoring:
const WEIGHTS: Partial<Record<FindingType, number>> = {
  "RIP_CONTROL_PROVEN":    2.0,
  "VERIFICATION_RESULT":   2.0,
  "VULNERABILITY_IDENTIFIED": 1.5,
  "CRASH_ISOLATED":        1.5,
  "ZERO_DAY_CONFIRMED":    2.0,
  "FLAG_EXTRACTED":        2.0,
}

interface ConsensusVote {
  verdict: string
  confidence: number
  dissent: string[]      // agents with low-confidence findings
  evidence: FindingEntry[]
}
```

---

## Build Phase B — Electron IPC Bridge

### `packages/app/src/main/council-bridge.ts`

```typescript
import { ipcMain, BrowserWindow } from "electron"
import { Worker } from "worker_threads"

export function setupCouncilBridge(win: BrowserWindow) {
  let worker: Worker | null = null

  ipcMain.handle("council:launch", async (_, params: LaunchParams) => {
    const campaignId = buildCampaignId(params.binaryPath)
    const campaignDir = path.join("D:\\Cracked", campaignId)
    await fs.mkdir(campaignDir, { recursive: true })

    // Copy schema templates into campaign dir
    await fs.copyFile(BLACKBOARD_TEMPLATE, path.join(campaignDir, "blackboard.json"))
    await initCouncilState(campaignDir, params)

    worker = new Worker("./council-worker.js", { workerData: { campaignDir, ...params } })
    worker.on("message", (evt: OrchestratorEvent) => {
      win.webContents.send("council:event", evt)
    })
  })

  ipcMain.handle("council:abort", async () => {
    worker?.postMessage({ type: "abort" })
  })

  ipcMain.handle("council:hitl-decision", async (_, decision: HITLDecision) => {
    worker?.postMessage({ type: "hitl", ...decision })
  })
}
```

### `packages/app/src/vrax/hooks/useCouncil.ts`

```typescript
import { createStore } from "solid-js/store"
import { onMount, onCleanup } from "solid-js"

export function useCouncil() {
  const [store, setStore] = createStore<CouncilStore>({
    status: "idle",         // idle | running | hitl_gate | complete | aborted
    mode: null,
    currentPhase: null,
    currentAgent: null,
    outputBuffer: "",       // live streaming text from active phase
    blackboard: [],         // live deposited findings
    phaseHistory: [],       // completed phases with results
    confidence: 0,
    hitlPending: null,      // { reason, confidence } when gate fires
    artifacts: [],
  })

  onMount(() => {
    window.electron?.ipcRenderer.on("council:event", (_, evt: OrchestratorEvent) => {
      handleEvent(evt, setStore)
    })
  })

  function launch(params: { binaryPath: string; mode: PipelineMode }) {
    window.electron?.ipcRenderer.invoke("council:launch", params)
    setStore("status", "running")
    setStore("mode", params.mode)
  }

  function abort() {
    window.electron?.ipcRenderer.invoke("council:abort")
  }

  function resolveHITL(decision: "YES" | "NO", note?: string) {
    window.electron?.ipcRenderer.invoke("council:hitl-decision", { decision, note })
    setStore("hitlPending", null)
    setStore("status", decision === "YES" ? "running" : "aborted")
  }

  return { store, launch, abort, resolveHITL }
}
```

---

## Build Phase C — Operator Console Rebuild

**File**: `packages/app/src/vrax/shell/OperatorConsole.tsx`

Replace the current textarea+quick-actions with the 3-mode mission control UI.

### Mode 1 — IDLE
```
┌─────────────────────────────────┐
│ OPERATOR                ● idle  │
├─────────────────────────────────┤
│ PIPELINE MODE                   │
│                                 │
│ [CRASH] [CTF] [ZERO-DAY]       │
│ [PATCH] [MALWARE] [UAC-BYPASS] │
│                                 │
├─────────────────────────────────┤
│ Drop a binary on Targets,       │
│ select a mode, then LAUNCH.     │
│                                 │
│        [ LAUNCH COUNCIL ]       │
└─────────────────────────────────┘
```

### Mode 2 — RUNNING
```
┌─────────────────────────────────┐
│ OPERATOR            ◉ running   │
│ Phase 2/4 · vuln-isolator       │
├─────────────────────────────────┤
│ ████████████░░░░░░░ 67%         │
├─────────────────────────────────┤
│ live streaming output           │
│ > Analyzing crash at 0x401A3F   │
│ > Bad chars: \x00\x0a\x0d      │
│ > Padding: 524 bytes            │
│ > Testing EIP control...        │
├─────────────────────────────────┤
│ RECENT DEPOSITS                 │
│ ✦ CRASH_ISOLATED       φ=0.92  │
│ ✦ ATTACK_SURFACE_FOUND  φ=0.78 │
├─────────────────────────────────┤
│              [ ABORT ]          │
└─────────────────────────────────┘
```

### Mode 3 — HITL GATE
```
┌─────────────────────────────────┐
│ OPERATOR              ⚠ gate    │
├─────────────────────────────────┤
│ ┌─────────────────────────────┐ │
│ │  HUMAN APPROVAL REQUIRED    │ │
│ │                             │ │
│ │  Confidence: 0.61           │ │
│ │  Threshold:  0.70           │ │
│ │                             │ │
│ │  "RIP control unconfirmed.  │ │
│ │   Proceed to harness?"      │ │
│ │                             │ │
│ │  [ YES, CONTINUE ]          │ │
│ │  [ NO, ABORT ]              │ │
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
```

```typescript
export function OperatorConsole() {
  const council = useCouncil()
  const target = useTarget()

  return (
    <div style={{ /* 320px right panel styles */ }}>
      <ConsoleHeader status={council.store.status} phase={council.store.currentPhase} />
      <Switch>
        <Match when={council.store.status === "idle"}>
          <ModePicker
            disabled={!target.store.info}
            onLaunch={(mode) => council.launch({ binaryPath: target.store.info!.path, mode })}
          />
        </Match>
        <Match when={council.store.status === "running"}>
          <PhaseProgress
            store={council.store}
            onAbort={council.abort}
          />
        </Match>
        <Match when={council.store.status === "hitl_gate"}>
          <HITLCard
            gate={council.store.hitlPending!}
            onResolve={council.resolveHITL}
          />
        </Match>
        <Match when={council.store.status === "complete"}>
          <CompleteSummary artifacts={council.store.artifacts} />
        </Match>
      </Switch>
    </div>
  )
}
```

---

## Build Phase D — Live UI Pages

These pages read from the `useCouncil()` reactive store.
They display data the orchestrator wrote — they don't call OpenCode directly.

### D1 — PipelinePage (`packages/app/src/vrax/execution/PipelinePage.tsx`)

Phase DAG with live status. Source: `useCouncil().store.phaseHistory` + `council_state.json`.

```
BINARY: target.exe  (PE32+ x86  1.2 MB)

PIPELINE MODE: [ CRASH ▼ ]

  Phase 0  Check MCP health        ✓ PASSED
  Phase 1  Binary Mapping          ◉ RUNNING  security-analyst
  Phase 2  Vuln Isolation          ○ pending
  Phase 3  Harness Build           ○ pending
  Phase 4  Verification (3/3)      ○ pending

Gate thresholds:
  1→2  confidence ≥ 0.60 AND verdict ≠ SAFE
  2→3  rip_control.proven == true
  3→4  harness compiled, zero warnings
  4→✓  pass^3 == 3/3

[ LAUNCH PIPELINE ]
```

### D2 — SwarmPage (`packages/app/src/vrax/execution/SwarmPage.tsx`)

All 29 agents with status. Source: `useCouncil().store`.

```
SWARM — 29 agents

ACTIVE (1)                     IDLE (28)
┌──────────────────────┐       ○ vuln-isolator        pending
│ ◉ security-analyst   │       ○ harness-engineer     pending
│   deepseek-v4-pro    │       ○ malware-analyst      idle
│   Phase 1 · 1m 12s   │       ○ zero-day-hunter      idle
│   "Analyzing PE..."  │       ...
└──────────────────────┘
```

### D3 — BlackboardPage (`packages/app/src/vrax/intel/BlackboardPage.tsx`)

Live findings with pheromone bars. Source: `useCouncil().store.blackboard`.

Pheromone bar: `Math.round(pheromone * 8)` filled blocks of `█`, rest `░`
Color: `#4F7CFF` when >0.70 · `#F59E0B` when >0.40 · `rgba(255,255,255,0.2)` else

```
BLACKBOARD — 4 active findings                [ Filter ▼ ]

TYPE                  AGENT             φ WEIGHT  DECAY
──────────────────────────────────────────────────────────
RIP_CONTROL_PROVEN    vuln-isolator     ████████  0.94   linear/600s
CRASH_ISOLATED        vuln-isolator     ███████░  0.87   exp/3600s
ATTACK_SURFACE_FOUND  security-analyst  █████░░░  0.62   exp/3600s
MITIGATION_MAPPED     security-analyst  ████░░░░  0.51   exp/7200s

[Click any row to expand data payload]
```

### D4 — EvidencePage (`packages/app/src/vrax/intel/EvidencePage.tsx`)

Detailed finding view. Finding type badge, pheromone score, agent attribution,
raw data JSON, cross-reference links to related findings.

### D5 — ReportsPage (`packages/app/src/vrax/outputs/ReportsPage.tsx`)

Artifacts from `council_state.json -> artifacts`.

```
ARTIFACTS — target_exe_2026-06-13_142230

Reports (1)
  report.md                      [ Open ] [ Export PDF ]

Harnesses (1)
  crash_harness.exe              [ Run ] [ View Source ]

YARA Rules (2)
  malware.yar                    [ View ] [ Copy ]
  network.yar                    [ View ] [ Copy ]

IOCs (1)
  stix_bundle.json               [ Export ]
```

### D6 — MCPHubPage (`packages/app/src/vrax/system/MCPHubPage.tsx`)

Health status of all 4 MCP servers. Polled every 15s from main process.

```
MCP SERVERS

ghidra_mcp    (PRIMARY)    ● ONLINE   :8081    249 tools
  Last call: list_functions  0.3s ago

ida_pro_mcp   (SECONDARY)  ● ONLINE   :13337   32 tools
  Last call: decompile  12s ago

binary_ninja  (SECONDARY)  ○ OFFLINE  :9009    —
  BN must be open with MCP plugin started (bottom-left button)

zap           (WEB)        ● ONLINE   :8282    8 tools
  Ready for web target scanning
```

---

## Campaign Directory Structure

Each pipeline run creates a timestamped directory:

```
D:\vrax\campaigns\
  target_exe_2026-06-13_142230\
    council_state.json      phase tracking (init from template)
    blackboard.json         findings with pheromone scores
    target.exe              binary under analysis
    crash_harness.c         Phase 3 output
    crash_harness.exe       compiled and tested
    telemetry.json          crash register dump (telemetry-structurer)
    report.md               final CVSS report
    yara\
      malware.yar
      network.yar
    iocs\
      stix_bundle.json
      openIOC.xml
```

`CouncilOrchestrator.launch()` creates this structure.
`BlackboardManager` and `CouncilStateManager` write into it.
Electron file watcher monitors it and forwards changes to renderer via IPC.

---

## Build Order Summary

```
Week 1 — Core classes (standalone, testable with no UI)
  A1  session-client.ts          HTTP wrapper for localhost:4747
  A2  blackboard.ts              Pheromone-weighted finding store + decay
  A3  council-state.ts           Phase tracking manager (CRUD on JSON)
  A4  deposit-interceptor.ts     Synthetic tool interceptor
  A5  phase-runner.ts            Single-agent session driver

Week 2 — Orchestration
  A6  orchestrator.ts            Full pipeline sequencer + gate logic
  A7  consensus.ts               Weighted pheromone vote

Week 3 — Electron bridge
  B1  council-bridge.ts          IPC from worker thread → renderer
  B2  council-worker.ts          Worker thread entry point
  B3  useCouncil.ts              Solid.js reactive store

Week 4 — Operator Console rebuild
  C   OperatorConsole.tsx        3-mode mission control (replaces current)

Week 5 — Live UI pages
  D1  PipelinePage.tsx           Phase DAG with live status + launch button
  D2  SwarmPage.tsx              29-agent status cards
  D3  BlackboardPage.tsx         Pheromone findings table
  D4  EvidencePage.tsx           Finding detail view
  D5  ReportsPage.tsx            Artifact browser
  D6  MCPHubPage.tsx             MCP server health panel

Week 6 — Integration test
      Run full CRASH pipeline on a real binary from D:\vrax\campaigns
      Verify blackboard writes on each deposit_finding interception
      Verify phase gate evaluations and HITL gate fires at confidence < 0.70
      Verify UI reflects live state throughout all 4 phases
      Verify 3/3 qa-tester verification
```

---

## Reuse vs Build Matrix

| Component | Source | Action |
|-----------|--------|--------|
| 4 MCP servers | `opencode.json` [mcp] | **REUSE AS-IS** — already connected |
| 29 agent definitions | `opencode.json` [agent] | **REUSE AS-IS** — pass agent name to session API |
| Agent system prompts | `prompts/agents/*.txt` | **REUSE AS-IS** — OpenCode loads them automatically |
| Multi-model router | `agent_model_map.json` | **REUSE AS-IS** — OpenCode routes automatically by agent name |
| Blackboard schema (49 types) | `council_blackboard_schema.json` | **REUSE** — implement decay math in BlackboardManager |
| Council state schema | `council_state_template.json` | **REUSE** — copy template per campaign dir |
| Pipeline commands (gate thresholds) | `commands/*.md` | **REUSE** — gate logic hardcoded from these docs |
| OpenCode HTTP server | `localhost:4747` | **REUSE AS-IS** — call its API |
| Campaign workspace | `D:\vrax\campaigns` | **REUSE** — standard path, create subdirs per run |
| GCC build chain | `C:\msys64\ucrt64\bin\gcc.exe` | **REUSE AS-IS** — qa-tester calls it during verification |
| SessionClient | — | **BUILD** from scratch |
| BlackboardManager | — | **BUILD** — implement schema + decay math |
| CouncilStateManager | — | **BUILD** — implement schema CRUD |
| DepositInterceptor | — | **BUILD** — new concept, intercepts synthetic tool |
| PhaseRunner | — | **BUILD** from scratch |
| CouncilOrchestrator | — | **BUILD** — this is the product |
| ConsensusEngine | — | **BUILD** |
| council-bridge.ts (Electron IPC) | — | **BUILD** |
| council-worker.ts | — | **BUILD** |
| useCouncil() hook | — | **BUILD** |
| OperatorConsole.tsx (3 modes) | existing file | **REBUILD** — replace current textarea |
| PipelinePage.tsx | stub exists | **BUILD** real implementation |
| SwarmPage.tsx | stub exists | **BUILD** real implementation |
| BlackboardPage.tsx | stub exists | **BUILD** real implementation |
| EvidencePage.tsx | stub exists | **BUILD** real implementation |
| ReportsPage.tsx | stub exists | **BUILD** real implementation |
| MCPHubPage.tsx | stub exists | **BUILD** real implementation |

---

## Key Invariants — Never Break These

1. **OpenCode drives the AI** — CouncilOrchestrator spawns sessions with real agent definitions.
   Never craft prompts that try to make one AI act as another AI.

2. **TypeScript drives the pipeline** — Phase sequencing, gate evaluation, HITL decisions are
   TypeScript code. The AI does analysis; TypeScript decides what happens next.

3. **Blackboard is ground truth** — All inter-phase state lives in `blackboard.json`.
   Phases don't read each other's output; they read the blackboard.

4. **Pheromone decay is mandatory** — `BlackboardManager.decay()` runs every 60s.
   Findings below `min_activation_threshold: 0.2` become inactive.

5. **deposit_finding is synthetic** — OpenCode has no such tool. The orchestrator injects
   the tool description via `systemPromptAppend` and intercepts the `tool_call` event.
   The AI believes it called a tool; the orchestrator answered by writing to the blackboard.

6. **HITL fires at 0.70** — When `ConsensusEngine.score() < 0.70` at any gate,
   the pipeline pauses, emits `hitl_gate`, and waits for `resolveHITL()`. No auto-skip.

7. **3/3 verification** — `qa-tester` must run each harness 3 times and get 3/3 PASS.
   Anything less = Phase 4 failure → retry Phase 3 up to `max_iterations`.

8. **One campaign dir per run** — Every `orchestrator.launch()` creates a new timestamped
   dir under `D:\vrax\campaigns\`. Never overwrite a previous campaign.
