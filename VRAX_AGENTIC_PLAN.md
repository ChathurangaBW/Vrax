# VRAX Agentic AI Framework — Implementation Plan
**Date:** 2026-06-13  
**Version:** 2.0 — Full Agentic Architecture  
**Inspired by:** Penligent autonomous pentest platform + PentAGI + state-of-art multi-agent RE research  

---

## 1. What We're Actually Building

VRAX is an **autonomous binary reverse-engineering swarm** — not a chat UI with file picker.

```
User drops a binary
      ↓
VRAX launches a COUNCIL of specialized AI agents
      ↓
Agents use IDA Pro / Ghidra / Binary Ninja via MCP in parallel
      ↓
Each agent deposits findings to a shared BLACKBOARD with pheromone weights
      ↓
A SYNTHESIS agent reads all findings, runs consensus voting
      ↓
Operator sees live streaming output, agent status, findings, consensus
      ↓
One-click report generation
```

The Operator Console is **not a chat box** — it is the mission control center for a running AI swarm.

---

## 2. System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│  VRAX UI (Solid.js / Electron)                                      │
│                                                                     │
│  ┌──────────┐  ┌───────────────────────────┐  ┌─────────────────┐  │
│  │ LeftNav  │  │   WorkspaceContent        │  │ OperatorConsole │  │
│  │          │  │   (live data displays)    │  │                 │  │
│  │ Pipeline │  │   Pipeline phases         │  │ Mission control │  │
│  │ Swarm    │  │   Agent status cards      │  │ Agent streams   │  │
│  │ Evidence │  │   Blackboard findings     │  │ HITL gates      │  │
│  │ Overview │  │   Consensus meter         │  │ Prompt dispatch │  │
│  └──────────┘  └───────────────────────────┘  └────────┬────────┘  │
└─────────────────────────────────────────────────────────┼──────────┘
                                                          │ IPC
┌─────────────────────────────────────────────────────────▼──────────┐
│  Electron Main Process                                              │
│                                                                     │
│  ┌─────────────────────┐    ┌──────────────────────────────────┐   │
│  │ Council Orchestrator │    │ campaigns.ts IPC handlers        │   │
│  │ (packages/council)   │    │ - watch folder                   │   │
│  │                      │    │ - read council_state.json        │   │
│  │ Phase runner         │    │ - read blackboard.json           │   │
│  │ Agent spawner        │    │ - write council_state.json  ◄──  │   │
│  │ Blackboard writer    │    │ - write blackboard.json     ◄──  │   │
│  │ Consensus engine     │    └──────────────────────────────────┘   │
│  └──────────┬───────────┘                                           │
└─────────────┼────────────────────────────────────────────────────── ┘
              │ HTTP POST /session + stream
┌─────────────▼────────────────────────────────────────────────────── ┐
│  OpenCode Sidecar (localhost:4747)                                   │
│                                                                     │
│  ┌─────────────────┐   ┌──────────────────┐   ┌────────────────┐   │
│  │ Session Manager  │   │ LLM Stream Loop  │   │ MCP Hub        │   │
│  │ (one per agent)  │   │ (tool call loop) │   │                │   │
│  │                  │   │                  │   │ ida-pro-mcp    │   │
│  │ RECON session    │   │ LLM generates    │   │ ghidra-mcp     │   │
│  │ STATIC session   │   │ tool call ──────►│   │ binary-ninja   │   │
│  │ DYNAMIC session  │   │ MCP executes     │   │ zap            │   │
│  │ SYNTH session    │   │ result ─────────►│   └────────────────┘   │
│  │ REPORT session   │   │ LLM continues    │                        │
│  └─────────────────┘   └──────────────────┘                        │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. Agent Roles

### 3.1 Phase Agents (run in the LLM session loop)

| Agent | Role | Primary MCP Tools | Blackboard Writes |
|---|---|---|---|
| **recon-agent** | Binary identity, format detection, initial triage | `ida-pro: list_funcs`, `ida-pro: imports`, `ghidra: decompile` | PACKED_SECTION, COMPILER_ARTIFACT, ENTRY_POINT_ANOMALY |
| **static-agent** | Deep static analysis — control flow, crypto, anti-debug | `ida-pro: disasm`, `ida-pro: xrefs_to`, `ida-pro: callgraph` | ANTI_DEBUG, CRYPTO_ROUTINE, OBFUSCATION, STRING_ARTIFACT |
| **dynamic-agent** | Behavioral fingerprinting via MCP hooks | `ida-pro: patch_asm`, `ghidra: decompile`, `zap: *` | NETWORK_CALLBACK, REGISTRY_PERSISTENCE, FILE_DROP |
| **malware-agent** | C2 extraction, IOC generation, YARA rules | All IDA tools, pattern search | C2_INDICATOR, YARA_RULE, IOC_ENTRY |
| **synthesis-agent** | Reads ALL blackboard findings, runs consensus vote | None — reads only | CONSENSUS_VERDICT |
| **report-agent** | Generates final structured report from blackboard | None — reads only | REPORT_ARTIFACT |

### 3.2 Orchestrator (not an LLM — TypeScript logic)

The **Council Orchestrator** is a TypeScript class in Electron Main that:
- Decides which phase agents run and in what order
- Creates OpenCode sessions via HTTP API
- Streams session output back to UI via IPC events
- Writes `council_state.json` phase transitions
- Writes `blackboard.json` when agents deposit findings
- Triggers HITL gates when confidence < threshold
- Runs consensus voting after synthesis phase

---

## 4. Blackboard Pattern (Stigmergy)

All agents communicate through the blackboard — they **never talk to each other directly**.

```
blackboard.json
{
  "target": "PolyMLP.exe",
  "iteration": 3,
  "findings": [
    {
      "id": "find-01J3KX...",
      "type": "ANTI_DEBUG",
      "severity": "HIGH",
      "description": "IsDebuggerPresent via PEB walk at 0x401A20",
      "pheromone": 0.87,        ← decays 5%/iteration if no agent reinforces
      "author": "static-agent",
      "payload": {
        "address": "0x401A20",
        "technique": "PEB_NtGlobalFlag",
        "confidence": 0.91
      },
      "triggered_agents": ["synthesis-agent"],
      "created_at": 1749823400000
    }
  ]
}
```

**Pheromone scoring:**
- Agent deposits finding: `pheromone = confidence_score` (0.0–1.0)
- Each iteration: `pheromone *= 0.95` (5% decay)
- Another agent confirms same finding: `pheromone = min(1.0, pheromone + 0.15)` (reinforcement)
- Findings with `pheromone < 0.1` are archived (evaporated)

This is the same stigmergy mechanism used in ant colony optimization — high-confidence findings stay prominent, noise fades away.

---

## 5. Council State Machine

```
council_state.json drives the UI pipeline view.

STATES: pending → running → passed | failed | skipped

┌─────────────────────────────────────────────────────────────┐
│  Phase Sequence (per mode)                                  │
│                                                             │
│  MALWARE mode:                                              │
│  [RECON] → [STATIC] → [MALWARE] → [SYNTHESIS] → [REPORT]   │
│                                                             │
│  CTF mode:                                                  │
│  [RECON] → [STATIC] → [SYNTHESIS] → [REPORT]               │
│                                                             │
│  CRASH mode:                                                │
│  [RECON] → [STATIC] → [DYNAMIC] → [SYNTHESIS] → [REPORT]   │
│                                                             │
│  ZERO-DAY mode:                                             │
│  [RECON] → [STATIC] → [DYNAMIC] ─→ [SYNTHESIS]             │
│                  ↑_______________|  (re-run until 3/3 gate) │
└─────────────────────────────────────────────────────────────┘

council_state.json
{
  "target": "PolyMLP.exe",
  "mode": "malware",
  "iteration": 2,
  "max_iterations": 5,
  "phases": [
    { "name": "RECON",     "status": "passed",  "agent": "recon-agent",   "duration_ms": 134000, "summary": "PE64, packed, entry at 0x401000" },
    { "name": "STATIC",    "status": "running",  "agent": "static-agent",  "started_at": 1749823400000 },
    { "name": "MALWARE",   "status": "pending" },
    { "name": "SYNTHESIS", "status": "pending" },
    { "name": "REPORT",    "status": "pending" }
  ],
  "agents_active": ["static-agent"],
  "agents_completed": ["recon-agent"],
  "agents_failed": [],
  "consensus": null,
  "updated_at": 1749823450000
}
```

---

## 6. Operator Console — Mission Control

The right panel is **not a chat interface**. It has three modes:

### Mode 1: Idle (no council running)
```
┌─────────────────────────────────────────┐
│ OPERATOR                       ● idle   │
│─────────────────────────────────────────│
│ QUICK DISPATCH                          │
│  ✦ Analyze binary (malware)        ml   │
│  ✦ CTF crackme solve               cf   │
│  ✦ Find crash surface              cr   │
│  ✦ Zero-day hunt                   zd   │
│─────────────────────────────────────────│
│  Drop a binary in Targets               │
│  then pick a mode to launch             │
│  the agent council.                     │
│─────────────────────────────────────────│
│ ┌─────────────────────────────────────┐ │
│ │ Override prompt (optional)...       │ │
│ │                          [LAUNCH]   │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

### Mode 2: Council Running (live stream)
```
┌─────────────────────────────────────────┐
│ OPERATOR                   ● running    │
│─────────────────────────────────────────│
│ static-agent  STATIC phase              │
│─────────────────────────────────────────│
│ > Called ida-pro: disasm(0x401A20)      │
│   → 14 instructions, JMP chain          │
│                                         │
│ > Called ida-pro: xrefs_to(0x401A20)    │
│   → 3 callers found                     │
│                                         │
│ ✦ DEPOSITED: ANTI_DEBUG (HIGH, 0.87)   │
│   IsDebuggerPresent via PEB walk        │
│                                         │
│ > Called ida-pro: callgraph()           │
│   → building...  ▌                      │
│─────────────────────────────────────────│
│                          [ABORT]        │
└─────────────────────────────────────────┘
```

### Mode 3: HITL Gate (human approval needed)
```
┌─────────────────────────────────────────┐
│ OPERATOR              ⚠ GATE TRIGGERED  │
│─────────────────────────────────────────│
│ synthesis-agent requests:               │
│                                         │
│ "Confidence 0.61 — below threshold.     │
│  Run another DYNAMIC iteration?"        │
│                                         │
│ Findings so far: 8                      │
│ Consensus: 61%  ████████░░░░            │
│                                         │
│ [YES — RE-RUN DYNAMIC]  [NO — PROCEED]  │
└─────────────────────────────────────────┘
```

---

## 7. File & Package Structure

```
D:\vrax\
├── packages/
│   ├── council/                         ← NEW PACKAGE (the real work)
│   │   ├── src/
│   │   │   ├── orchestrator.ts          ← Main council class
│   │   │   ├── phases.ts                ← Phase runner per mode
│   │   │   ├── blackboard.ts            ← Blackboard read/write + pheromone
│   │   │   ├── consensus.ts             ← Voting algorithm
│   │   │   ├── session-client.ts        ← OpenCode HTTP client wrapper
│   │   │   ├── agents/
│   │   │   │   ├── recon.ts             ← recon-agent system prompt + tool list
│   │   │   │   ├── static.ts            ← static-agent
│   │   │   │   ├── dynamic.ts           ← dynamic-agent
│   │   │   │   ├── malware.ts           ← malware-agent
│   │   │   │   ├── synthesis.ts         ← synthesis-agent
│   │   │   │   └── report.ts            ← report-agent
│   │   │   ├── modes/
│   │   │   │   ├── malware.ts           ← phase sequence for malware mode
│   │   │   │   ├── ctf.ts               ← phase sequence for CTF mode
│   │   │   │   ├── crash.ts             ← phase sequence for crash mode
│   │   │   │   └── zero-day.ts          ← phase sequence with 3/3 gate
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── desktop/src/main/
│   │   ├── campaigns.ts                 ← ADD: write handlers for state files
│   │   └── council-ipc.ts               ← NEW: IPC bridge for council events
│   │
│   └── app/src/vrax/
│       ├── shell/
│       │   └── OperatorConsole.tsx      ← REBUILD: mission control (3 modes)
│       ├── execution/
│       │   ├── PipelinePage.tsx         ← REBUILD: live phase tracker
│       │   └── SwarmPage.tsx            ← REBUILD: live agent cards + activity feed
│       ├── intel/
│       │   ├── EvidencePage.tsx         ← REBUILD: live findings grid
│       │   └── BlackboardPage.tsx       ← raw blackboard viewer
│       └── data/
│           ├── schema.ts                ← already good
│           └── campaigns.tsx            ← already good (reactive store)
```

---

## 8. Phase Roadmap

---

### Phase A — Council Orchestrator Core
**Package:** `packages/council/`  
**What it does:** The brain. Runs agents sequentially, manages state, writes JSON files.

**Files to create:**

#### `packages/council/src/session-client.ts`
```typescript
// Thin wrapper around OpenCode HTTP API
export class SessionClient {
  constructor(private baseUrl: string, private password: string) {}

  async createSession(agentName: string, title: string): Promise<string>
  // Returns sessionID

  async sendPrompt(sessionID: string, text: string): AsyncGenerator<StreamEvent>
  // Streams raw LLM + tool call events

  async abortSession(sessionID: string): Promise<void>
  async getMessages(sessionID: string): Promise<Message[]>
}

// StreamEvent union:
type StreamEvent =
  | { type: "text_delta"; content: string }
  | { type: "tool_call"; name: string; args: unknown }
  | { type: "tool_result"; name: string; result: unknown }
  | { type: "finding"; finding: BlackboardFinding }   // parsed from tool_result
  | { type: "done" }
  | { type: "error"; message: string }
```

#### `packages/council/src/blackboard.ts`
```typescript
export class BlackboardManager {
  constructor(private campaignDir: string) {}

  async read(): Promise<Blackboard>
  async deposit(finding: Omit<BlackboardFinding, "id" | "created_at" | "pheromone">): Promise<BlackboardFinding>
  async reinforce(findingId: string, delta: number): Promise<void>
  async decayAll(factor = 0.95): Promise<void>
  async archive(threshold = 0.1): Promise<void>       // Remove evaporated findings
}

// deposit() assigns:
// - unique ID (nanoid)
// - created_at: Date.now()
// - pheromone: finding.confidence or 0.75
// Then writes blackboard.json atomically
```

#### `packages/council/src/orchestrator.ts`
```typescript
export type CouncilMode = "malware" | "ctf" | "crash" | "patch" | "zero-day" | "uac-bypass"

export interface CouncilConfig {
  binaryPath: string
  campaignDir: string           // Where to write council_state.json + blackboard.json
  mode: CouncilMode
  maxIterations?: number        // Default 3
  confidenceGate?: number       // Default 0.70 — below this triggers HITL
  opencodeUrl?: string          // Default http://localhost:4747
}

export type CouncilEvent =
  | { type: "phase_start";   phase: string; agent: string }
  | { type: "phase_done";    phase: string; summary: string; duration: number }
  | { type: "phase_failed";  phase: string; error: string }
  | { type: "stream";        agent: string; event: StreamEvent }
  | { type: "finding";       finding: BlackboardFinding }
  | { type: "hitl_gate";     question: string; context: HitlContext }
  | { type: "consensus";     result: ConsensusState }
  | { type: "done";          report: string }
  | { type: "aborted" }

export class CouncilOrchestrator {
  constructor(config: CouncilConfig) {}

  // Emit events to caller (UI via IPC)
  on(event: "event", handler: (e: CouncilEvent) => void): this

  // Start the council run
  async run(): Promise<void>

  // Answer a HITL gate — unblocks the paused orchestrator
  answer(decision: "yes" | "no" | string): void

  // Abort the current run
  abort(): void
}
```

**Orchestrator run() algorithm:**
```
1. Write initial council_state.json (all phases "pending")
2. For each phase in mode's phase sequence:
   a. Write council_state.json: phase.status = "running"
   b. Emit phase_start event
   c. Create OpenCode session with agent's system prompt
   d. Send prompt: binary context + blackboard snapshot + agent instructions
   e. Stream events → emit stream events to UI
   f. Parse tool_result events → extract BlackboardFinding deposits
   g. Write each finding to blackboard.json via BlackboardManager
   h. Emit finding event
   i. When session done: emit phase_done
   j. Write council_state.json: phase.status = "passed"
   k. Decay pheromones: blackboard.decayAll()
3. Run synthesis: read full blackboard → run consensus vote → write consensus
4. If consensus.confidence < gate → emit hitl_gate → await user decision
5. Run report agent → emit done
```

---

### Phase B — Agent System Prompts

Each agent gets a carefully engineered system prompt that tells it:
- Its role and what to look for
- How to use MCP tools (IDA Pro, Ghidra, etc.)
- **The blackboard deposit protocol** — a special tool call format the orchestrator parses

#### `packages/council/src/agents/recon.ts`
```typescript
export const RECON_AGENT = {
  name: "recon-agent",
  systemPrompt: `
You are RECON-AGENT, the first phase of the VRAX binary analysis council.

YOUR MISSION:
Perform initial triage of the target binary. Identify:
- File format, architecture, compiler, subsystem
- Entry point and initialization chain
- Import table — DLLs and suspicious API calls
- Section characteristics — entropy, size anomalies, packing indicators
- Strings of interest — URLs, IPs, registry paths, file paths
- Anti-analysis artifacts — timing checks, debugger detection stubs

TOOLS AVAILABLE:
Use IDA Pro MCP tools: list_funcs, imports, get_string, disasm, basic_blocks
Use Ghidra MCP for decompilation when IDA gives ambiguous results.

BLACKBOARD DEPOSITS:
When you find something significant, deposit it by calling the deposit_finding tool:
{
  "type": "PACKED_SECTION" | "ENTRY_POINT_ANOMALY" | "SUSPICIOUS_IMPORT" | "COMPILER_ARTIFACT" | "STRING_ARTIFACT" | "ANTI_DEBUG" | ...,
  "severity": "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO",
  "description": "one-line human summary",
  "confidence": 0.0-1.0,
  "payload": { ...type-specific fields... }
}

Focus on BREADTH not depth. Static-agent will do deep analysis.
Aim for 5-15 findings. Stop when you have good coverage.
`,
  tools: ["ida-pro-mcp", "ghidra-mcp"],
  maxTokens: 8192,
}
```

The **deposit_finding tool** is a synthetic tool injected by the orchestrator — it's not a real MCP tool. When the LLM calls it, the orchestrator intercepts the tool_call event and writes to the blackboard directly. The LLM gets back a mock `{"status": "deposited", "id": "find-..."}` result.

---

### Phase C — IPC Bridge (Electron Main)

#### `packages/desktop/src/main/council-ipc.ts`
```typescript
// Singleton orchestrator per Electron instance
let activeCouncil: CouncilOrchestrator | null = null

ipcMain.handle("council:launch", async (event, config: CouncilConfig) => {
  if (activeCouncil) throw new Error("Council already running")
  
  activeCouncil = new CouncilOrchestrator(config)
  
  activeCouncil.on("event", (e: CouncilEvent) => {
    // Forward all events to renderer via BrowserWindow.webContents.send
    event.sender.send("council:event", e)
  })
  
  activeCouncil.run().catch(err => {
    event.sender.send("council:event", { type: "error", message: err.message })
  }).finally(() => {
    activeCouncil = null
  })
  
  return { started: true }
})

ipcMain.handle("council:answer", async (_, decision: string) => {
  activeCouncil?.answer(decision)
})

ipcMain.handle("council:abort", async () => {
  activeCouncil?.abort()
})
```

Also add **write handlers** to `campaigns.ts`:
```typescript
ipcMain.handle("campaigns:write-state", async (_, root: string, campaign: string, state: CouncilState) => {
  // Atomically write council_state.json
  await fs.writeFile(path.join(root, campaign, "council_state.json"), JSON.stringify(state, null, 2))
})

ipcMain.handle("campaigns:write-blackboard", async (_, root: string, campaign: string, board: Blackboard) => {
  // Atomically write blackboard.json  
  await fs.writeFile(path.join(root, campaign, "blackboard.json"), JSON.stringify(board, null, 2))
})
```

---

### Phase D — Operator Console Rebuild (Mission Control)

**`packages/app/src/vrax/shell/OperatorConsole.tsx`** — complete rebuild

Three distinct states driven by a `councilStore`:

```typescript
type ConsoleMode = "idle" | "running" | "gate" | "done"

interface ConsoleStore {
  mode: ConsoleMode
  activeAgent: string | null
  streamLines: StreamLine[]      // Rolling last-50 events
  gateQuestion: string | null
  gateContext: HitlContext | null
}
```

**Idle mode:** Mode picker buttons (MALWARE / CTF / CRASH / ZERO-DAY / PATCH) + optional prompt override + LAUNCH button

**Running mode:** Active agent label + scrolling stream of tool calls + finding deposits + phase transitions + ABORT button

**Gate mode:** HITL question card + YES/NO buttons (unblocks orchestrator)

**Done mode:** Council summary — total findings, consensus verdict, confidence bar + "Open Report" button

---

### Phase E — Pipeline Page Rebuild (Live Phase Tracker)

**`packages/app/src/vrax/execution/PipelinePage.tsx`**

Reads from `campaigns.store.council` (reactive, file-watched).

```
┌─────────────────────────────────────────────────────────────────────┐
│ PIPELINE              Mode: MALWARE          ◎ Running              │
│─────────────────────────────────────────────────────────────────────│
│  ✓  RECON      recon-agent    2m 14s   PASS   Entry: 0x401000      │
│  ◎  STATIC     static-agent   running… 4m 02s                       │
│  ○  MALWARE    —              pending                               │
│  ○  SYNTHESIS  —              pending                               │
│  ○  REPORT     —              pending                               │
│─────────────────────────────────────────────────────────────────────│
│ ACTIVE PHASE: STATIC                                                │
│ Agent: static-agent                                                 │
│ Started: 14:22:03  Running: 4m 02s                                  │
│ Summary: Analyzing anti-debug routines in .text section...          │
│─────────────────────────────────────────────────────────────────────│
│ CONSENSUS                                            67% ██████░░░  │
│ recon-agent ✓   static-agent …   malware-agent ○                   │
│ Classification: Likely packed dropper with C2 beacon               │
└─────────────────────────────────────────────────────────────────────┘
```

---

### Phase F — Swarm Page Rebuild (Agent Status)

**`packages/app/src/vrax/execution/SwarmPage.tsx`**

Reads from `campaigns.store.council` + `campaigns.store.blackboard`.
Calls `deriveAgents()`, `deriveActivityFeed()`, `deriveMetrics()`.

```
┌─────────────────────────────────────────────────────────────────────┐
│ SWARM                    Iteration 2/5    3 active   2 done         │
│─────────────────────────────────────────────────────────────────────│
│ ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │
│ │ ◎ recon-agent│  │ ◎ static-agent│ │○ malware-agent│               │
│ │ ACTIVE       │  │ ACTIVE       │  │ PENDING      │               │
│ │ Findings: 4  │  │ Findings: 6  │  │              │               │
│ │ Signal: 0.87 │  │ Signal: 0.78 │  │ Waiting for  │               │
│ │ Last: 2m ago │  │ Last: 30s ago│  │ STATIC phase │               │
│ └──────────────┘  └──────────────┘  └──────────────┘               │
│─────────────────────────────────────────────────────────────────────│
│ ACTIVITY FEED                                                        │
│ 30s  static-agent   ✦ ANTI_DEBUG           ████  0.87  HIGH         │
│ 2m   recon-agent    ✦ PACKED_SECTION        ███░  0.71  HIGH         │
│ 3m   recon-agent    ✦ SUSPICIOUS_IMPORT     ██░░  0.62  MEDIUM       │
│ 5m   recon-agent    ✦ COMPILER_ARTIFACT     █░░░  0.41  INFO         │
└─────────────────────────────────────────────────────────────────────┘
```

---

### Phase G — Evidence Page Rebuild (Live Blackboard Grid)

**`packages/app/src/vrax/intel/EvidencePage.tsx`**

Reads from `campaigns.store.blackboard`. Live-updates every time `blackboard.json` changes.

```
┌─────────────────────────────────────────────────────────────────────┐
│ EVIDENCE                              [🔍 Search findings…]   14    │
│─────────────────────────────────────────────────────────────────────│
│ ALL   CRITICAL 3   HIGH 4   MEDIUM 5   LOW 2   INFO 0              │
│─────────────────────────────────────────────────────────────────────│
│ ┌───────────────────────────────────────────────────────────────┐   │
│ │ NETWORK_CALLBACK                           ████  0.92  CRIT   │   │
│ │ C2 beacon to 185.220.x.x:4444, 30s interval   static-agent 2m│   │
│ └───────────────────────────────────────────────────────────────┘   │
│ ┌───────────────────────────────────────────────────────────────┐   │
│ │ ANTI_DEBUG                                 ███░  0.87  HIGH   │   │
│ │ IsDebuggerPresent + NtQueryInformationProcess   static-agent 4m│  │
│ └───────────────────────────────────────────────────────────────┘   │
│                                                                     │
│ ─────── FINDING DETAIL (click any row) ──────────────────────────   │
│ NETWORK_CALLBACK · severity: CRITICAL · pheromone: 0.92            │
│ Author: static-agent · Triggered: synthesis-agent                  │
│ Payload: { address: "185.220.100.1", port: 4444, ... }             │
│                           [Investigate →]   [Generate YARA →]      │
└─────────────────────────────────────────────────────────────────────┘
```

---

### Phase H — Mode Selector & Launch Flow

**`packages/app/src/vrax/workspace/TargetsPage.tsx`** — add mode selector

After binary is loaded, show mode picker instead of auto-navigating to overview:

```
┌─────────────────────────────────────────────────────────────────────┐
│  PolyMLP.exe loaded — PE64 · x64 · 53 KB                           │
│─────────────────────────────────────────────────────────────────────│
│  SELECT ANALYSIS MODE                                               │
│                                                                     │
│  [MALWARE]    [CTF]    [CRASH]    [ZERO-DAY]    [PATCH]            │
│                                                                     │
│  MALWARE: Unpack · extract C2 · generate YARA/IOCs                 │
│─────────────────────────────────────────────────────────────────────│
│  [LAUNCH COUNCIL]                    or  [MANUAL — go to Overview] │
└─────────────────────────────────────────────────────────────────────┘
```

Clicking LAUNCH COUNCIL:
1. Creates campaign folder: `<binary_dir>/<binary_name>_<timestamp>/`
2. Writes initial `council_state.json`
3. Calls `window.electron.invoke("council:launch", config)`
4. Navigates LeftNav to Pipeline
5. OperatorConsole switches to "running" mode

---

### Phase I — Reports Page

**`packages/app/src/vrax/outputs/ReportsPage.tsx`**

When council is done, report-agent has deposited a `REPORT_ARTIFACT` finding.
This page renders it:

```
┌─────────────────────────────────────────────────────────────────────┐
│ REPORT                    PolyMLP.exe · Malware Analysis            │
│─────────────────────────────────────────────────────────────────────│
│ EXECUTIVE SUMMARY                                                   │
│ PolyMLP.exe is a packed dropper with C2 beacon capabilities...      │
│                                                                     │
│ CRITICAL FINDINGS (3)                                               │
│ ■ NETWORK_CALLBACK — C2 to 185.220.x.x:4444                        │
│ ■ ANTI_DEBUG — PEB walk technique                                   │
│ ■ REGISTRY_PERSISTENCE — HKLM Run key                              │
│                                                                     │
│ YARA RULE                                                           │
│ rule PolyMLP_C2 { ... }                                             │
│─────────────────────────────────────────────────────────────────────│
│  [Export PDF]   [Export YARA]   [Export IOCs]   [Copy Markdown]     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 9. Consensus Algorithm

After all phase agents complete, synthesis-agent reads the full blackboard and produces votes.

```typescript
// packages/council/src/consensus.ts

export function runConsensus(findings: BlackboardFinding[]): ConsensusState {
  // Group findings by type
  const byType = groupBy(findings, f => f.type)
  
  // Each agent that contributed a finding is a "voter"
  const voters = [...new Set(findings.map(f => f.author))]
  
  // Build verdict from highest-pheromone findings
  const topFindings = findings
    .filter(f => f.pheromone > 0.5)
    .sort((a, b) => b.pheromone - a.pheromone)
    .slice(0, 5)
  
  // Confidence = weighted average of top findings' pheromones
  const confidence = topFindings.reduce((sum, f) => sum + f.pheromone, 0) / topFindings.length
  
  // Verdict = classification from top finding types
  const verdict = classifyFromFindings(topFindings)
  
  // Per-agent votes
  const votes: ConsensusVote[] = voters.map(agent => {
    const agentFindings = findings.filter(f => f.author === agent)
    const agentConfidence = agentFindings.reduce((sum, f) => sum + f.pheromone, 0) / agentFindings.length
    return { agent, verdict: classifyFromFindings(agentFindings), confidence: agentConfidence }
  })
  
  return { verdict, confidence, votes }
}
```

**HITL gate:** If `confidence < config.confidenceGate` (default 0.70), orchestrator pauses and emits a `hitl_gate` event. Operator sees the gate in Operator Console and clicks YES/NO.

---

## 10. Finding Types (Full Taxonomy)

These are the 49 types defined in `schema.ts`. Agents are trained to deposit these specifically:

```
PACKING / OBFUSCATION:
  PACKED_SECTION, OBFUSCATION, CUSTOM_PACKER, UPX_PACKED, VM_PROTECTED

ANTI-ANALYSIS:
  ANTI_DEBUG, ANTI_VM, ANTI_SANDBOX, TIMING_CHECK, ENVIRONMENT_CHECK

NETWORK:
  NETWORK_CALLBACK, C2_INDICATOR, BEACON_INTERVAL, DNS_LOOKUP, RAW_SOCKET

PERSISTENCE:
  REGISTRY_PERSISTENCE, SCHEDULED_TASK, SERVICE_INSTALL, BOOTKIT

FILE SYSTEM:
  FILE_DROP, FILE_DELETION, TEMP_WRITE, SHADOW_COPY_DELETE

CRYPTO:
  CRYPTO_ROUTINE, XOR_KEY, RC4_STREAM, AES_BLOCK, CUSTOM_CIPHER

CODE QUALITY:
  ENTRY_POINT_ANOMALY, COMPILER_ARTIFACT, STRING_ARTIFACT, SUSPICIOUS_IMPORT

EXPLOIT:
  BUFFER_OVERFLOW, USE_AFTER_FREE, FORMAT_STRING, HEAP_SPRAY, ROP_CHAIN

INTEL:
  YARA_RULE, IOC_ENTRY, REPORT_ARTIFACT, CONSENSUS_VERDICT
```

---

## 11. Deposit Finding Tool (Synthetic MCP Tool)

The orchestrator injects this tool into every agent session:

```typescript
// Injected as part of the system prompt + tool registry override
const DEPOSIT_TOOL = {
  name: "deposit_finding",
  description: "Deposit a security finding to the shared blackboard. Call this whenever you discover something significant.",
  inputSchema: {
    type: "object",
    required: ["type", "severity", "description", "confidence", "payload"],
    properties: {
      type: { type: "string", description: "Finding type from taxonomy" },
      severity: { type: "string", enum: ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"] },
      description: { type: "string", description: "One-line human-readable summary" },
      confidence: { type: "number", minimum: 0, maximum: 1 },
      payload: { type: "object", description: "Type-specific structured data" }
    }
  }
}

// When the LLM calls deposit_finding, the orchestrator:
// 1. Intercepts the tool_call event before it reaches OpenCode
// 2. Calls blackboard.deposit(args)
// 3. Returns { status: "deposited", id: finding.id } as tool result
// 4. Emits { type: "finding", finding } event to UI
```

---

## 12. Campaign Folder Convention

```
D:\cracked\
  PolyMLP_20260613_142200\            ← campaign folder (auto-created)
    council_state.json                 ← orchestrator writes
    blackboard.json                    ← orchestrator writes
    scope.json                         ← { target: "PolyMLP.exe", mode: "malware" }
    sessions\                          ← OpenCode session logs (optional)
      recon-session-01J...jsonl
      static-session-01J...jsonl
    reports\
      final-report.md                  ← report-agent writes
      yara-rules.yar
      iocs.json
```

---

## 13. Build Order

| Phase | Package | Key Files | Depends on |
|---|---|---|---|
| **A** | `packages/council` | `orchestrator.ts`, `blackboard.ts`, `session-client.ts` | Nothing — pure TypeScript |
| **B** | `packages/council/agents` | `recon.ts`, `static.ts`, `malware.ts`, `synthesis.ts`, `report.ts` | Phase A |
| **C** | `packages/desktop` | `council-ipc.ts`, `campaigns.ts` write handlers | Phase A |
| **D** | `packages/app/vrax/shell` | `OperatorConsole.tsx` rebuild | Phase C (IPC events) |
| **E** | `packages/app/vrax/execution` | `PipelinePage.tsx` rebuild | Schema (already done) |
| **F** | `packages/app/vrax/execution` | `SwarmPage.tsx` rebuild | Schema, derive functions |
| **G** | `packages/app/vrax/intel` | `EvidencePage.tsx` rebuild | Schema, blackboard data |
| **H** | `packages/app/vrax/workspace` | `TargetsPage.tsx` — mode selector + launch | Phases C + D |
| **I** | `packages/app/vrax/outputs` | `ReportsPage.tsx` — markdown renderer | Phase G (REPORT_ARTIFACT) |

**Start with Phase A.** The council orchestrator is the whole product. Everything else is just displaying what it produces.

---

## 14. Design Tokens (unchanged from v1)

```css
--bg-chrome:    #0A0C10;
--bg-workspace: #0D1117;
--bg-panel:     #111722;
--bg-card:      #172030;
--accent:       #4F7CFF;
--success:      #22C55E;
--warning:      #F59E0B;
--danger:       #EF4444;
--text-primary: #D1D9E3;
--text-dim:     #8892A0;
--font-mono:    'JetBrains Mono', monospace;
```

---

## 15. What Makes This Different from a Chat UI

| Chat UI | VRAX Council |
|---|---|
| One session, one thread | N parallel sessions, one per agent |
| User drives every step | Council runs autonomously |
| No shared state between sessions | Shared blackboard — agents build on each other |
| No consensus | Pheromone-weighted consensus voting |
| Human types prompts | Agents deposit structured findings |
| Session output = text | Blackboard = structured intelligence |
| No pipeline | Sequential phases with gate conditions |
| No HITL gate | Pauses for human when confidence too low |

The Operator Console is the **control room for an autonomous AI swarm**, not a chat box.
