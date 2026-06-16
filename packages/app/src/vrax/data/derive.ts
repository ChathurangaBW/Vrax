import type {
  ActivityFeedEntry,
  AgentStatus,
  Blackboard,
  BlackboardFinding,
  CouncilState,
  CouncilPhase,
  EvidenceGraph,
  FindingSeverity,
  SwarmMetrics,
} from "./schema"

// ─── deriveFindings ────────────────────────────────────────────────────────
// The council swarm-router writes its results into the rich per-phase fields of
// council_state.json (entry_points, crash_condition, mitigations, …) rather than
// a separate pheromone blackboard. This turns those populated fields into the
// finding model the intel views (Blackboard / Evidence / Swarm) consume, so they
// reflect real pipeline output. Empty fields produce no findings.

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "")
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
const nonEmpty = (v: unknown): boolean => {
  if (Array.isArray(v)) return v.length > 0
  if (typeof v === "string") return v.trim().length > 0
  if (typeof v === "number") return v !== 0
  if (v && typeof v === "object") return Object.keys(v).length > 0
  return false
}

function phasePheromone(status: CouncilPhase["status"]): number {
  if (status === "passed") return 0.92
  if (status === "running") return 0.6
  if (status === "failed") return 0.4
  return 0.3
}

export function deriveFindings(council: CouncilState | null): BlackboardFinding[] {
  if (!council) return []
  const out: BlackboardFinding[] = []
  const at = council.updated_at || Date.now()

  const push = (
    id: string,
    type: string,
    severity: FindingSeverity,
    description: string,
    phase: CouncilPhase,
    payload: Record<string, unknown>,
    triggered: string[] = [],
  ) => {
    if (!description) return
    out.push({
      id,
      type,
      severity,
      description,
      pheromone: phasePheromone(phase.status),
      author: phase.agent ?? "council",
      payload,
      triggered_agents: triggered,
      created_at: phase.completed_at ?? phase.started_at ?? at,
    })
  }

  for (const phase of council.phases) {
    const f = phase.fields ?? {}
    const key = phase.key ?? phase.name

    if (key === "1_mapping") {
      const entry = arr(f.entry_points)
      if (entry.length) push("map-attack-surface", "ATTACK_SURFACE_FOUND", "HIGH",
        `${entry.length} attack-surface entry point${entry.length !== 1 ? "s" : ""}: ${entry.map(String).join(", ")}`,
        phase, { entry_points: entry }, ["vuln-isolator"])

      const patch = arr(f.patch_points)
      if (patch.length) push("map-patch-points", "PATCH_POINT", "HIGH",
        `${patch.length} patch point${patch.length !== 1 ? "s" : ""} located: ${patch.map(String).join(", ")}`,
        phase, { patch_points: patch }, ["patcher"])

      const lic = arr(f.license_checks)
      if (lic.length) push("map-license", "LICENSE_CHECK", "MEDIUM",
        `${lic.length} license/registration check${lic.length !== 1 ? "s" : ""} found`,
        phase, { license_checks: lic })

      const mit = f.mitigations
      if (mit && typeof mit === "object" && nonEmpty(mit)) {
        const m = mit as Record<string, unknown>
        const present = Object.entries(m).filter(([, v]) => v === true).map(([k]) => k.toUpperCase())
        const absent = Object.entries(m).filter(([, v]) => v === false).map(([k]) => k.toUpperCase())
        const desc = `Mitigations — present: ${present.join(", ") || "none"}; absent: ${absent.join(", ") || "none"}`
        push("map-mitigations", "MITIGATION_MAPPED", absent.includes("STACK_COOKIES") ? "HIGH" : "INFO",
          desc, phase, { mitigations: m })
      }

      const algo = str(f.validation_algo) || str(f.crypto_type)
      if (algo) push("map-crypto", "CRYPTO_IDENTIFIED", "MEDIUM",
        `Validation/crypto identified: ${algo}`, phase, { validation_algo: str(f.validation_algo), crypto_type: str(f.crypto_type) }, ["patcher"])

      const flag = str(f.extracted_flag)
      if (flag) push("map-flag", "FLAG_EXTRACTED", "CRITICAL",
        `Flag / password extracted: ${flag}`, phase, { extracted_flag: flag })

      const sic = arr(f.self_integrity_checks)
      if (sic.length) push("map-integrity", "SELF_INTEGRITY", "MEDIUM",
        `${sic.length} self-integrity check${sic.length !== 1 ? "s" : ""} detected`, phase, { self_integrity_checks: sic })
    }

    if (key === "2_vulnerability") {
      const crash = str(f.crash_condition)
      if (crash) {
        const bad = arr(f.bad_chars)
        const pad = typeof f.padding_length === "number" ? f.padding_length : undefined
        const extra = [pad ? `padding ${pad}` : "", bad.length ? `bad chars ${bad.map(String).join(" ")}` : ""].filter(Boolean).join(" · ")
        push("vuln-crash", "VULNERABILITY_IDENTIFIED", "CRITICAL",
          `${crash}${extra ? ` (${extra})` : ""}`, phase,
          { crash_condition: crash, offsets: f.offsets ?? {}, bad_chars: bad, padding_length: pad }, ["harness-engineer"])
      }
    }

    if (key === "3_harness") {
      const exe = str(f.compiled_exe)
      if (exe) push("harness-built", "HARNESS_BUILT", "INFO",
        `QA harness compiled: ${exe}`, phase, { compiled_exe: exe, compilation_cmd: str(f.compilation_cmd) }, ["qa-tester"])
    }

    if (key === "4_verification") {
      const verdict = str(f.verdict)
      if (verdict) {
        const passed = /pass|success|confirm|ok/i.test(verdict)
        push("verify-verdict", "VERIFICATION", passed ? "HIGH" : "MEDIUM",
          `Verification: ${verdict}${str(f.rip_actual) ? ` (RIP ${str(f.rip_actual)})` : ""}`, phase,
          { verdict, rip_expected: str(f.rip_expected), rip_actual: str(f.rip_actual), exception_code: str(f.exception_code) })
      }
    }
  }

  return out
}

// ─── deriveAgents ──────────────────────────────────────────────────────────
// Merges council active/completed/failed lists with blackboard authorship data
// to produce a unified per-agent status for the Swarm view.

export function deriveAgents(council: CouncilState | null, blackboard: Blackboard | null): AgentStatus[] {
  const findings = blackboard?.findings ?? []

  const byAgent = new Map<string, BlackboardFinding[]>()
  for (const f of findings) {
    const list = byAgent.get(f.author) ?? []
    list.push(f)
    byAgent.set(f.author, list)
  }

  const allAgents = new Set<string>([
    ...(council?.agents_active ?? []),
    ...(council?.agents_completed ?? []),
    ...(council?.agents_failed ?? []),
    ...byAgent.keys(),
  ])

  const active = new Set(council?.agents_active ?? [])
  const completed = new Set(council?.agents_completed ?? [])
  const failed = new Set(council?.agents_failed ?? [])

  const result: AgentStatus[] = []
  for (const name of allAgents) {
    const agentFindings = byAgent.get(name) ?? []
    const maxSignal = agentFindings.reduce((m, f) => Math.max(m, f.pheromone), 0)
    const lastActivityAt =
      agentFindings.length > 0 ? Math.max(...agentFindings.map((f) => f.created_at)) : undefined

    let status: AgentStatus["status"] = "pending"
    if (active.has(name)) status = "active"
    else if (completed.has(name)) status = "completed"
    else if (failed.has(name)) status = "failed"

    const phase = council?.phases.find((p) => p.agent === name)
    const durationMs = phase?.duration_ms

    result.push({ name, status, findingsCount: agentFindings.length, maxSignal, lastActivityAt, durationMs })
  }

  return result.sort((a, b) => {
    const order: Record<AgentStatus["status"], number> = { active: 0, completed: 1, failed: 2, pending: 3 }
    return order[a.status] - order[b.status]
  })
}

// ─── deriveMetrics ─────────────────────────────────────────────────────────
// Aggregate counts for the top status bar and swarm summary panel.

export function deriveMetrics(blackboard: Blackboard | null, council: CouncilState | null): SwarmMetrics {
  const findings = blackboard?.findings ?? []

  let criticalCount = 0
  let highCount = 0
  let mediumCount = 0
  let lowCount = 0
  let infoCount = 0
  let pheromoneSum = 0
  let maxPheromone = 0

  for (const f of findings) {
    if (f.severity === "CRITICAL") criticalCount++
    else if (f.severity === "HIGH") highCount++
    else if (f.severity === "MEDIUM") mediumCount++
    else if (f.severity === "LOW") lowCount++
    else infoCount++

    pheromoneSum += f.pheromone
    if (f.pheromone > maxPheromone) maxPheromone = f.pheromone
  }

  return {
    totalFindings: findings.length,
    criticalCount,
    highCount,
    mediumCount,
    lowCount,
    infoCount,
    activeAgents: council?.agents_active.length ?? 0,
    completedAgents: council?.agents_completed.length ?? 0,
    failedAgents: council?.agents_failed.length ?? 0,
    maxPheromone,
    avgPheromone: findings.length > 0 ? pheromoneSum / findings.length : 0,
  }
}

// ─── deriveEvidenceGraph ───────────────────────────────────────────────────
// Builds a directed causality graph from triggered_agents chains in the blackboard.
// Each finding is a node; an edge from A→B means finding A triggered agent B
// which later deposited finding B.

export function deriveEvidenceGraph(blackboard: Blackboard | null): EvidenceGraph {
  const findings = blackboard?.findings ?? []
  if (findings.length === 0) return { nodes: [], edges: [] }

  const nodes = findings.map((f) => ({ id: f.id, finding: f }))

  // Index findings by author for triggered_agents lookup
  const byAuthor = new Map<string, BlackboardFinding[]>()
  for (const f of findings) {
    const list = byAuthor.get(f.author) ?? []
    list.push(f)
    byAuthor.set(f.author, list)
  }

  const edges: { from: string; to: string }[] = []
  for (const f of findings) {
    for (const triggeredAgent of f.triggered_agents) {
      const triggered = byAuthor.get(triggeredAgent)
      if (!triggered) continue
      // Connect this finding to the earliest finding deposited by the triggered agent
      // after this finding was created
      const later = triggered.filter((t) => t.created_at > f.created_at)
      for (const target of later) {
        edges.push({ from: f.id, to: target.id })
      }
    }
  }

  return { nodes, edges }
}

// ─── deriveActivityFeed ────────────────────────────────────────────────────
// Returns findings sorted newest-first as a flat activity feed, with ageMs
// computed relative to now so the UI can render "2m ago" labels reactively.

export function deriveActivityFeed(blackboard: Blackboard | null, now = Date.now()): ActivityFeedEntry[] {
  const findings = blackboard?.findings ?? []

  return findings
    .slice()
    .sort((a, b) => b.created_at - a.created_at)
    .map((f) => ({
      id: f.id,
      agent: f.author,
      findingType: f.type,
      severity: f.severity as FindingSeverity,
      pheromone: f.pheromone,
      timestamp: f.created_at,
      ageMs: now - f.created_at,
    }))
}
