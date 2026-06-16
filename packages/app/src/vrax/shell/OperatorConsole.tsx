import { createSignal, createMemo, createEffect, For, Show } from "solid-js"
import { useVrax } from "@/vrax/context/vrax"
import { useTarget } from "@/vrax/data"
import { useCampaigns } from "@/vrax/data"
import type { CouncilPhase } from "@/vrax/data"
import { useServerSync } from "@/context/server-sync"
import { useServerSDK } from "@/context/server-sdk"
import { useModels } from "@/context/models"
import { usePlatform } from "@/context/platform"
import { Identifier } from "@/utils/id"
import type { Message } from "@vrax/sdk/v2/client"
import { SessionChat } from "./SessionChat"

// The core VRAX agent: a stigmergic blackboard orchestrator that runs the RE
// pipeline and writes council_state.json / blackboard.json into the workspace.
const COUNCIL_AGENT = "council-orchestrator"

function dirname(p: string): string {
  const sep = p.includes("\\") ? "\\" : "/"
  const parts = p.split(sep)
  parts.pop()
  return parts.join(sep) || sep
}

// ── Tool-invocation card driven by a council phase ─────────────────────────
function PhaseCard(props: { phase: CouncilPhase; index: number }) {
  const [open, setOpen] = createSignal(false)
  const status = () => props.phase.status

  const checkbox = () => {
    const s = status()
    if (s === "passed") return { bg: "#4F7CFF", border: "#4F7CFF", color: "#fff", glyph: "✓", pulse: false }
    if (s === "running") return { bg: "rgba(79,124,255,0.12)", border: "#4F7CFF", color: "#4F7CFF", glyph: "◉", pulse: true }
    if (s === "failed") return { bg: "rgba(239,68,68,0.12)", border: "#EF4444", color: "#EF4444", glyph: "✕", pulse: false }
    if (s === "skipped") return { bg: "transparent", border: "rgba(255,255,255,0.18)", color: "rgba(255,255,255,0.3)", glyph: "–", pulse: false }
    return { bg: "transparent", border: "rgba(255,255,255,0.18)", color: "transparent", glyph: "", pulse: false }
  }

  const timeLabel = () => {
    const s = status()
    if (s === "running") return "running…"
    if (s === "pending") return "queued"
    if (s === "skipped") return "skipped"
    if (props.phase.duration_ms != null) return `${(props.phase.duration_ms / 1000).toFixed(1)}s`
    return ""
  }
  const timeColor = () => {
    const s = status()
    if (s === "running") return "#4F7CFF"
    if (s === "pending" || s === "skipped") return "rgba(255,255,255,0.25)"
    return "rgba(255,255,255,0.28)"
  }

  const hasBody = () => !!(props.phase.summary || props.phase.error)

  return (
    <div
      style={{
        "background": "#172030",
        "border": status() === "running" ? "1px solid rgba(79,124,255,0.22)" : "1px solid rgba(255,255,255,0.06)",
        "border-radius": "6px",
        "overflow": "hidden",
        "transition": "border-color 120ms",
      }}
    >
      <div
        onClick={() => hasBody() && setOpen(o => !o)}
        style={{
          "display": "flex",
          "align-items": "flex-start",
          "gap": "8px",
          "padding": "7px 9px",
          "cursor": hasBody() ? "pointer" : "default",
        }}
      >
        <div
          style={{
            "width": "15px",
            "height": "15px",
            "border-radius": "3px",
            "border": `1.5px solid ${checkbox().border}`,
            "background": checkbox().bg,
            "color": checkbox().color,
            "flex-shrink": "0",
            "margin-top": "1px",
            "display": "flex",
            "align-items": "center",
            "justify-content": "center",
            "font-size": "8px",
            "animation": checkbox().pulse ? "vrax-pulse-kf 1.4s ease-in-out infinite" : "none",
          }}
        >
          {checkbox().glyph}
        </div>
        <div style={{ "flex": "1", "min-width": "0" }}>
          <span
            style={{
              "display": "block",
              "color": "#D1D9E3",
              "font-family": "JetBrains Mono, monospace",
              "font-size": "10px",
              "font-weight": "500",
              "margin-bottom": "1px",
              "overflow": "hidden",
              "text-overflow": "ellipsis",
              "white-space": "nowrap",
            }}
          >
            {props.phase.name.replace(/_/g, " ")}
          </span>
          <Show when={props.phase.agent}>
            <span style={{ "font-size": "9px", "color": "rgba(255,255,255,0.3)", "font-family": "JetBrains Mono, monospace" }}>
              {props.phase.agent}
            </span>
          </Show>
        </div>
        <div style={{ "display": "flex", "align-items": "center", "gap": "5px", "flex-shrink": "0" }}>
          <span style={{ "font-size": "9px", "color": timeColor(), "font-family": "JetBrains Mono, monospace" }}>
            {timeLabel()}
          </span>
          <Show when={hasBody()}>
            <span
              style={{
                "font-size": "9px",
                "color": "rgba(255,255,255,0.28)",
                "transition": "transform 180ms",
                "transform": open() ? "rotate(90deg)" : "none",
              }}
            >
              ▶
            </span>
          </Show>
        </div>
      </div>
      <Show when={open() && hasBody()}>
        <div style={{ "border-top": "1px solid rgba(255,255,255,0.05)", "background": "rgba(0,0,0,0.28)", "padding": "8px 10px" }}>
          <Show when={props.phase.summary}>
            <div style={{ "font-size": "10px", "color": "#8892A0", "line-height": "1.6" }}>{props.phase.summary}</div>
          </Show>
          <Show when={props.phase.error}>
            <div style={{ "font-size": "10px", "color": "#EF4444", "line-height": "1.6", "font-family": "JetBrains Mono, monospace" }}>
              {props.phase.error}
            </div>
          </Show>
        </div>
      </Show>
    </div>
  )
}

export function OperatorConsole() {
  const vrax = useVrax()
  const target = useTarget()
  const campaigns = useCampaigns()
  const platform = usePlatform()
  const serverSync = useServerSync()
  const serverSDK = useServerSDK()
  const models = useModels()
  const [prompt, setPrompt] = createSignal("")
  const [error, setError] = createSignal<string | null>(null)
  const [focused, setFocused] = createSignal(false)
  const [busy, setBusy] = createSignal(false)

  const inSession = () => !!vrax.store.activeSession
  const hasContext = () => !!(target.store.info || campaigns.store.root)

  // Active session messages (to derive agent/model for follow-up dispatch)
  const sessionMessages = createMemo<Message[]>(() => {
    const active = vrax.store.activeSession
    if (!active) return []
    const store = serverSync.child(active.dir, { bootstrap: false })[0]
    return (store.message[active.id] ?? []).filter((m): m is Message => !!m?.id)
  })

  const council = () => campaigns.store.council
  const phases = () => council()?.phases ?? []
  const runningPhase = () => phases().find(p => p.status === "running")
  const upcomingPhases = () => phases().filter(p => p.status === "pending")
  const passedCount = () => phases().filter(p => p.status === "passed").length
  const totalCount = () => phases().length
  const consensus = () => council()?.consensus
  const councilRunning = () => phases().some(p => p.status === "running" || p.status === "pending")

  const statusText = () => {
    if (councilRunning()) return `running · ${passedCount()}/${totalCount()}`
    if (inSession()) return "session"
    if (consensus()) return `consensus ${(consensus()!.confidence * 100).toFixed(0)}%`
    if (hasContext()) return "ready"
    return "idle"
  }

  // Current Analysis bullets — derive from running phase + consensus
  const analysisBullets = (): string[] => {
    const out: string[] = []
    const rp = runningPhase()
    if (rp?.summary) out.push(rp.summary)
    const c = consensus()
    if (c) {
      out.push(`Consensus verdict: ${c.verdict} (φ=${c.confidence.toFixed(2)})`)
      if (c.votes.length > 0) out.push(`${c.votes.length} agent vote${c.votes.length !== 1 ? "s" : ""} recorded`)
    }
    const bb = campaigns.store.blackboard
    if (bb && bb.findings.length > 0 && out.length < 3) {
      const crit = bb.findings.filter(f => f.severity === "CRITICAL").length
      if (crit > 0) out.push(`${crit} CRITICAL finding${crit !== 1 ? "s" : ""} on the blackboard`)
    }
    return out
  }

  function getDirectory(): string | null {
    const info = target.store.info
    if (info?.path) return dirname(info.path)
    const root = campaigns.store.root
    if (root) return root
    return null
  }

  type ModelRef = { providerID: string; modelID: string }

  // Resolve a model to send with. Priority: active conversation's model →
  // config default → live directory-scoped provider list (authoritative).
  async function resolveModel(dir: string): Promise<ModelRef | undefined> {
    // Reuse the model from the active conversation if present.
    const last = [...sessionMessages()].reverse().find(m => "model" in m && m.model)
    if (last && "model" in last && last.model) {
      return { providerID: last.model.providerID, modelID: last.model.modelID }
    }

    // The user's last-used model (across all sessions) — known to work for them.
    const recent = models.recent.list()[0]
    if (recent?.providerID && recent?.modelID) {
      return { providerID: recent.providerID, modelID: recent.modelID }
    }

    const cfg = serverSync.data.config?.model
    if (cfg && cfg.includes("/")) {
      const idx = cfg.indexOf("/")
      return { providerID: cfg.slice(0, idx), modelID: cfg.slice(idx + 1) }
    }

    // Authoritative: ask the server which providers are connected for this dir.
    // Skip non-chat models (image/video/audio/embedding) — their provider
    // "default" is often a media model that can't answer a text prompt.
    const NON_CHAT = /image|video|tts|voice|whisper|audio|speech|imagine|embed|rerank|moderation|diffusion|flux|sora|dall|stable-/i
    try {
      const resp = await serverSDK.client.provider.list({ directory: dir })
      const data = resp.data
      if (data) {
        const order = (data.connected?.length ? data.connected : (data.all ?? []).map(p => p.id)) ?? []
        // First pass: a non-media model from each connected provider.
        for (const pid of order) {
          const def = data.default?.[pid]
          if (def && !NON_CHAT.test(def)) return { providerID: pid, modelID: def }
          const p = data.all?.find(x => x.id === pid)
          const chat = p ? Object.keys(p.models ?? {}).find(id => !NON_CHAT.test(id)) : undefined
          if (chat) return { providerID: pid, modelID: chat }
        }
        // Last resort: any default at all.
        for (const pid of order) {
          const def = data.default?.[pid]
          if (def) return { providerID: pid, modelID: def }
        }
      }
    } catch {
      // ignore — fall through to undefined (server may still have a default)
    }
    return undefined
  }

  async function dispatch(text: string) {
    const p = text.trim()
    if (!p || busy()) return

    const active = vrax.store.activeSession
    const dir = active?.dir || getDirectory()
    if (!dir) {
      setError("Open a target or campaign first.")
      setTimeout(() => setError(null), 3000)
      return
    }

    setError(null)
    setPrompt("")
    setBusy(true)

    try {
      // Resolve a model if we can; otherwise let the server use its default.
      const model = await resolveModel(dir)

      // Point the council agent at this working dir so it writes campaign state
      // here (where the app reads), instead of its legacy hardcoded workspace.
      await platform.campaigns?.seedConfig?.(dir)

      let sessionID = active?.id

      // Create a new session for the first dispatch.
      if (!sessionID) {
        // Warm the child store so streamed events land somewhere we read.
        serverSync.child(dir, { bootstrap: true })
        const created = await serverSDK.client.session.create({
          directory: dir,
          title: p.length > 60 ? p.slice(0, 57) + "…" : p,
          agent: COUNCIL_AGENT,
        })
        sessionID = created.data?.id
        if (!sessionID) throw new Error("Failed to create session")
        vrax.setActiveSession({ id: sessionID, dir })
      }

      // Route to the council orchestrator — the core VRAX agent that actually
      // runs the pipeline and writes council_state.json / blackboard.json.
      await serverSDK.client.session.promptAsync({
        sessionID,
        directory: dir,
        agent: COUNCIL_AGENT,
        ...(model ? { model } : {}),
        messageID: Identifier.ascending("message"),
        parts: [{ id: Identifier.ascending("part"), type: "text", text: p }],
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send")
      setTimeout(() => setError(null), 6000)
    } finally {
      setBusy(false)
    }
  }

  function submit() { void dispatch(prompt()) }

  // Consume prompts queued by other views (e.g. Reports "Generate").
  createEffect(() => {
    const queued = vrax.store.pendingPrompt
    if (!queued) return
    vrax.clearPendingPrompt()
    void dispatch(queued)
  })

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      submit()
    }
  }

  const hitlRequired = () => consensus() !== undefined && consensus()!.confidence < 0.70

  return (
    <div
      style={{
        "background": "#111722",
        "border-left": "1px solid rgba(255,255,255,0.06)",
        "display": "flex",
        "flex-direction": "column",
        "flex-shrink": "0",
        "overflow": "hidden",
        "height": "100%",
        "box-sizing": "border-box",
      }}
    >
      {/* Header */}
      <div
        style={{
          "padding": "0 14px",
          "height": "38px",
          "border-bottom": "1px solid rgba(255,255,255,0.06)",
          "display": "flex",
          "align-items": "center",
          "justify-content": "space-between",
          "flex-shrink": "0",
        }}
      >
        <span
          style={{
            "font-size": "10px",
            "font-weight": "600",
            "letter-spacing": "0.08em",
            "color": "rgba(255,255,255,0.3)",
            "text-transform": "uppercase",
          }}
        >
          Operator Console
        </span>
        <div style={{ "display": "flex", "align-items": "center", "gap": "5px" }}>
          <span
            style={{
              "width": "5px",
              "height": "5px",
              "border-radius": "50%",
              "background": councilRunning() ? "#4F7CFF" : hasContext() ? "rgba(79,124,255,0.6)" : "rgba(255,255,255,0.18)",
              "flex-shrink": "0",
              "animation": councilRunning() ? "vrax-pulse-kf 1.4s ease-in-out infinite" : "none",
            }}
          />
          <span style={{ "font-size": "10px", "color": "rgba(255,255,255,0.32)" }}>
            {statusText()}
          </span>
        </div>
      </div>

      {/* HITL gate */}
      <Show when={hitlRequired()}>
        <div style={{ "padding": "9px 14px", "border-bottom": "1px solid rgba(255,255,255,0.06)", "background": "rgba(245,158,11,0.06)", "flex-shrink": "0" }}>
          <div style={{ "font-size": "11px", "color": "#F59E0B", "font-weight": "600", "margin-bottom": "3px" }}>
            ⚠ HITL Gate — Approval Required
          </div>
          <div style={{ "font-size": "10px", "color": "rgba(245,158,11,0.7)", "margin-bottom": "7px" }}>
            Consensus {(consensus()!.confidence * 100).toFixed(0)}% below 70% threshold
          </div>
          <div style={{ "display": "flex", "gap": "6px" }}>
            <button type="button" style={{ "background": "rgba(34,197,94,0.15)", "border": "1px solid rgba(34,197,94,0.35)", "border-radius": "4px", "padding": "3px 12px", "color": "#22C55E", "font-size": "10px", "font-weight": "600", "cursor": "pointer" }}>Approve</button>
            <button type="button" style={{ "background": "rgba(239,68,68,0.12)", "border": "1px solid rgba(239,68,68,0.3)", "border-radius": "4px", "padding": "3px 12px", "color": "#EF4444", "font-size": "10px", "font-weight": "600", "cursor": "pointer" }}>Abort</button>
          </div>
        </div>
      </Show>

      {/* Current Analysis */}
      <Show when={!inSession() && analysisBullets().length > 0}>
        <div style={{ "padding": "9px 14px 7px", "border-bottom": "1px solid rgba(255,255,255,0.06)", "flex-shrink": "0" }}>
          <div style={{ "font-size": "9px", "font-weight": "600", "letter-spacing": "0.10em", "text-transform": "uppercase", "color": "rgba(255,255,255,0.22)", "margin-bottom": "5px" }}>
            ◉ Current Analysis
          </div>
          <For each={analysisBullets()}>
            {(b) => (
              <div style={{ "font-size": "10.5px", "color": "rgba(255,255,255,0.55)", "line-height": "1.5", "padding-left": "11px", "position": "relative", "margin-bottom": "3px" }}>
                <span style={{ "position": "absolute", "left": "1px", "color": "#4F7CFF" }}>·</span>
                {b}
              </div>
            )}
          </For>
        </div>
      </Show>

      {/* Next Actions */}
      <Show when={!inSession() && upcomingPhases().length > 0}>
        <div style={{ "padding": "9px 14px 7px", "border-bottom": "1px solid rgba(255,255,255,0.06)", "flex-shrink": "0" }}>
          <div style={{ "font-size": "9px", "font-weight": "600", "letter-spacing": "0.10em", "text-transform": "uppercase", "color": "rgba(255,255,255,0.22)", "margin-bottom": "5px" }}>
            ⚡ Next Actions
          </div>
          <For each={upcomingPhases().slice(0, 3)}>
            {(p) => (
              <div style={{ "font-size": "10.5px", "color": "rgba(255,255,255,0.55)", "line-height": "1.5", "padding-left": "12px", "position": "relative", "margin-bottom": "3px" }}>
                <span style={{ "position": "absolute", "left": "0", "color": "#F59E0B", "font-size": "9px", "top": "2px" }}>→</span>
                {p.name.replace(/_/g, " ")}
              </div>
            )}
          </For>
        </div>
      </Show>

      {/* Conversation (when in session) OR Phase pipeline (when idle) */}
      <Show
        when={inSession()}
        fallback={
          <>
            <div style={{ "padding": "7px 14px 3px", "font-size": "9px", "font-weight": "600", "letter-spacing": "0.10em", "text-transform": "uppercase", "color": "rgba(255,255,255,0.22)", "flex-shrink": "0" }}>
              ⚙ Phase Pipeline
            </div>
            <div
              style={{
                "flex": "1",
                "overflow-y": "auto",
                "min-height": "0",
                "padding": "2px 8px 6px",
                "display": "flex",
                "flex-direction": "column",
                "gap": "4px",
                "scrollbar-width": "thin",
                "scrollbar-color": "rgba(255,255,255,0.06) transparent",
              }}
            >
              <Show
                when={phases().length > 0}
                fallback={
                  <div style={{ "padding": "16px 6px", "color": "rgba(255,255,255,0.18)", "font-size": "11px", "line-height": "1.6" }}>
                    <Show
                      when={hasContext()}
                      fallback="Open a target or campaign, then dispatch a prompt to start the council."
                    >
                      No active pipeline. Dispatch a prompt below to launch the autonomous swarm.
                    </Show>
                  </div>
                }
              >
                <For each={phases()}>
                  {(phase, i) => <PhaseCard phase={phase} index={i()} />}
                </For>
              </Show>
            </div>
          </>
        }
      >
        <SessionChat />
      </Show>

      {/* Error */}
      <Show when={error()}>
        <div style={{ "padding": "6px 14px", "background": "rgba(239,68,68,0.08)", "border-top": "1px solid rgba(239,68,68,0.15)", "color": "#EF4444", "font-size": "11px", "flex-shrink": "0" }}>
          {error()}
        </div>
      </Show>

      {/* Bottom: dispatch input */}
      <div style={{ "border-top": "1px solid rgba(255,255,255,0.06)", "padding": "8px 10px", "flex-shrink": "0" }}>
        <div
          style={{
            "background": "#172030",
            "border": focused() ? "1px solid rgba(79,124,255,0.45)" : "1px solid rgba(255,255,255,0.08)",
            "border-radius": "6px",
            "overflow": "hidden",
            "transition": "border-color 150ms ease",
          }}
        >
          <textarea
            value={prompt()}
            onInput={(e) => setPrompt(e.currentTarget.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="Enter prompt or override…"
            rows={2}
            style={{
              "width": "100%",
              "background": "transparent",
              "border": "none",
              "color": "#D1D9E3",
              "font-size": "11px",
              "line-height": "1.5",
              "padding": "8px 10px 4px",
              "resize": "none",
              "box-sizing": "border-box",
              "font-family": "inherit",
              "outline": "none",
              "display": "block",
            }}
          />
          <div style={{ "display": "flex", "align-items": "center", "justify-content": "space-between", "padding": "2px 7px 5px" }}>
            <span style={{ "font-size": "9.5px", "color": "rgba(255,255,255,0.22)" }}>Ctrl+Enter to dispatch</span>
            <button
              type="button"
              onClick={submit}
              style={{
                "width": "26px",
                "height": "26px",
                "background": prompt().trim() ? "#4F7CFF" : "rgba(255,255,255,0.07)",
                "border": "none",
                "border-radius": "5px",
                "color": prompt().trim() ? "#fff" : "rgba(255,255,255,0.25)",
                "font-size": "13px",
                "cursor": prompt().trim() ? "pointer" : "default",
                "transition": "background 150ms ease, color 150ms ease",
                "display": "flex",
                "align-items": "center",
                "justify-content": "center",
              }}
            >
              ↑
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
