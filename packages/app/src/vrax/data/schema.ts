// VRAX data layer — canonical type definitions for all runtime state.
// These types mirror the JSON structures written by the Python council/swarm process.

// ─── Binary Analysis (from binary-analysis.ts IPC) ────────────────────────

export interface BinarySection {
  name: string
  virtualAddress: string   // hex string: "0x00401000"
  virtualSize: number
  rawSize: number
  characteristics: string  // readable flags: "CODE | READ | EXEC"
  flags?: string[]         // optional split array
  entropy?: number
}

export interface ImportEntry {
  dll: string
  functions: string[]
}

export interface ExportEntry {
  name: string
  ordinal: number
  address: number
}

export interface BinaryInfo {
  name: string
  path: string
  size: number
  sizeFormatted: string
  architecture: string
  format: string
  subsystem: string
  machine: string
  timestamp: number | null
  timestampFormatted: string | null
  numberOfSections: number
  entryPoint: string
  imageBase: string
  md5: string
  sha256: string
  isDLL: boolean
  isConsole: boolean
  sections: BinarySection[]
  imports: ImportEntry[]
  exports: ExportEntry[]
}

export function parseBinaryInfo(raw: Record<string, unknown>): BinaryInfo {
  return {
    name: String(raw.name ?? ""),
    path: String(raw.path ?? ""),
    size: Number(raw.size ?? 0),
    sizeFormatted: String(raw.sizeFormatted ?? ""),
    architecture: String(raw.architecture ?? "Unknown"),
    format: String(raw.format ?? "Unknown"),
    subsystem: String(raw.subsystem ?? "Unknown"),
    machine: String(raw.machine ?? ""),
    timestamp: raw.timestamp != null ? Number(raw.timestamp) : null,
    timestampFormatted: raw.timestampFormatted != null ? String(raw.timestampFormatted) : null,
    numberOfSections: Number(raw.numberOfSections ?? 0),
    entryPoint: String(raw.entryPoint ?? "0x0"),
    imageBase: String(raw.imageBase ?? "0x0"),
    md5: String(raw.md5 ?? ""),
    sha256: String(raw.sha256 ?? ""),
    isDLL: Boolean(raw.isDLL),
    isConsole: Boolean(raw.isConsole),
    sections: Array.isArray(raw.sections) ? (raw.sections as BinarySection[]) : [],
    imports: Array.isArray(raw.imports) ? (raw.imports as ImportEntry[]) : [],
    exports: Array.isArray(raw.exports) ? (raw.exports as ExportEntry[]) : [],
  }
}

// ─── Council State (council_state.json) ───────────────────────────────────

export type PhaseStatus = "pending" | "running" | "passed" | "failed" | "skipped"

export interface CouncilPhase {
  name: string
  status: PhaseStatus
  agent?: string
  started_at?: number
  completed_at?: number
  duration_ms?: number
  summary?: string
  error?: string
  /** Original phase key from the agent's council_state.json (e.g. "1_mapping"). */
  key?: string
  /** Raw per-phase fields the agent writes (entry_points, crash_condition, …). */
  fields?: Record<string, unknown>
}

export interface ConsensusVote {
  agent: string
  verdict: string
  confidence: number
}

export interface ConsensusState {
  verdict: string
  confidence: number
  votes: ConsensusVote[]
}

export interface CouncilState {
  target: string
  mode: string
  iteration: number
  max_iterations: number
  phases: CouncilPhase[]
  agents_active: string[]
  agents_completed: string[]
  agents_failed: string[]
  consensus?: ConsensusState
  updated_at: number
}

// Maps the council swarm-router's phase keys to the sub-agent that owns them.
const PHASE_AGENT: Record<string, string> = {
  "1_mapping": "security-analyst",
  "2_vulnerability": "vuln-isolator",
  "3_harness": "harness-engineer",
  "4_verification": "qa-tester",
  "5_report": "report-generator",
}

function normalizePhaseStatus(raw: unknown): PhaseStatus {
  const v = String(raw ?? "").toLowerCase()
  if (["complete", "completed", "done", "pass", "passed", "success", "ok", "verified"].includes(v)) return "passed"
  if (["running", "in_progress", "active", "working", "started"].includes(v)) return "running"
  if (["fail", "failed", "error", "rejected"].includes(v)) return "failed"
  if (["skip", "skipped", "n/a", "na"].includes(v)) return "skipped"
  return "pending"
}

// The council agent writes a swarm-router council_state.json (phases keyed by
// "1_mapping", "2_vulnerability", … with rich per-phase fields). Adapt it to the
// view model the UI renders.
function adaptAgentCouncil(raw: Record<string, unknown>): CouncilState {
  const phasesObj = (raw.phases ?? {}) as Record<string, Record<string, unknown>>
  const keys = Object.keys(phasesObj)
    .filter((k) => /^\d+_/.test(k))
    .sort((a, b) => parseInt(a) - parseInt(b))

  const phases: CouncilPhase[] = keys.map((k) => {
    const p = phasesObj[k] ?? {}
    const notes = typeof p.notes === "string" && p.notes.trim() ? p.notes.trim() : undefined
    return {
      name: k.replace(/^\d+_/, "").replace(/_/g, " "),
      status: normalizePhaseStatus(p.status),
      agent: PHASE_AGENT[k],
      summary: notes,
      key: k,
      fields: p,
    }
  })

  const agentFor = (pred: (s: PhaseStatus) => boolean) =>
    phases.filter((p) => pred(p.status) && p.agent).map((p) => p.agent as string)

  return {
    target: String(raw.target_binary ?? raw.target ?? ""),
    mode: String(raw.pipeline_mode ?? raw.mode ?? ""),
    iteration: Number(raw.current_phase ?? 0),
    max_iterations: keys.length,
    phases,
    agents_active: agentFor((s) => s === "running"),
    agents_completed: agentFor((s) => s === "passed"),
    agents_failed: agentFor((s) => s === "failed"),
    updated_at: Date.now(),
  }
}

export function parseCouncilState(json: string): CouncilState | null {
  try {
    const raw = JSON.parse(json) as Record<string, unknown>
    if (!raw || typeof raw !== "object") return null
    // Agent-native schema: phases is an object keyed by "N_name".
    if (raw.phases && !Array.isArray(raw.phases)) return adaptAgentCouncil(raw)
    // Already in the app view-model shape.
    return raw as unknown as CouncilState
  } catch {
    return null
  }
}

// ─── Blackboard (blackboard.json) ─────────────────────────────────────────

export type FindingSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO"

export interface BlackboardFinding {
  id: string
  type: string
  severity: FindingSeverity
  description: string
  pheromone: number
  author: string
  payload: Record<string, unknown>
  triggered_agents: string[]
  created_at: number
}

export interface Blackboard {
  target: string
  iteration: number
  findings: BlackboardFinding[]
  updated_at: number
}

export function parseBlackboard(json: string): Blackboard | null {
  try {
    return JSON.parse(json) as Blackboard
  } catch {
    return null
  }
}

// ─── Derived types (produced by derive.ts, consumed by UI) ────────────────

export type AgentStatusKind = "active" | "completed" | "failed" | "pending"

export interface AgentStatus {
  name: string
  status: AgentStatusKind
  findingsCount: number
  maxSignal: number
  lastActivityAt?: number
  durationMs?: number
}

export interface ActivityFeedEntry {
  id: string
  agent: string
  findingType: string
  severity: FindingSeverity
  pheromone: number
  timestamp: number
  ageMs: number
}

export interface EvidenceNode {
  id: string
  finding: BlackboardFinding
}

export interface EvidenceEdge {
  from: string
  to: string
}

export interface EvidenceGraph {
  nodes: EvidenceNode[]
  edges: EvidenceEdge[]
}

export interface SwarmMetrics {
  totalFindings: number
  criticalCount: number
  highCount: number
  mediumCount: number
  lowCount: number
  infoCount: number
  activeAgents: number
  completedAgents: number
  failedAgents: number
  maxPheromone: number
  avgPheromone: number
}
