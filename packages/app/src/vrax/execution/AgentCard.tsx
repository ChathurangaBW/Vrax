import { createMemo, Show } from "solid-js"
import type { AgentStatus } from "@/vrax/data"

const STATUS_COLORS: Record<AgentStatus["status"], string> = {
  active: "#4F7CFF",
  completed: "#22C55E",
  failed: "#EF4444",
  pending: "#4A5668",
}

function formatAge(ms: number | undefined): string {
  if (!ms) return "—"
  const diff = Date.now() - ms
  const m = Math.floor(diff / 60_000)
  if (m < 1) return "just now"
  if (m < 60) return `${m}m ago`
  return `${Math.floor(m / 60)}h ago`
}

export function AgentCard(props: { agent: AgentStatus }) {
  const color = () => STATUS_COLORS[props.agent.status]

  return (
    <div
      style={{
        "background": "#172030",
        "border": `1px solid ${props.agent.status === "active" ? "rgba(79,124,255,0.3)" : "#1E2A3A"}`,
        "border-radius": "8px",
        "padding": "14px",
      }}
    >
      {/* Name + status */}
      <div style={{ "display": "flex", "align-items": "center", "justify-content": "space-between", "margin-bottom": "10px" }}>
        <span style={{ "font-size": "13px", "font-weight": "700", "color": "#D1D9E3", "font-family": "JetBrains Mono, monospace" }}>
          {props.agent.name}
        </span>
        <span style={{
          "background": `${color()}22`,
          "border": `1px solid ${color()}44`,
          "border-radius": "4px",
          "padding": "2px 8px",
          "font-size": "10px",
          "font-weight": "700",
          "color": color(),
          "letter-spacing": "0.06em",
        }}>
          {props.agent.status.toUpperCase()}
        </span>
      </div>

      {/* Findings + signal */}
      <div style={{ "display": "grid", "grid-template-columns": "1fr 1fr", "gap": "8px", "margin-bottom": "10px" }}>
        <div>
          <div style={{ "font-size": "10px", "color": "#4A5668", "margin-bottom": "2px" }}>Findings</div>
          <div style={{ "font-size": "16px", "font-weight": "700", "color": "#D1D9E3" }}>
            {props.agent.findingsCount}
          </div>
        </div>
        <div>
          <div style={{ "font-size": "10px", "color": "#4A5668", "margin-bottom": "2px" }}>Max Signal</div>
          <div style={{ "font-size": "16px", "font-weight": "700", "color": color(), "font-family": "JetBrains Mono, monospace" }}>
            {props.agent.maxSignal.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Pheromone bar */}
      <div style={{ "background": "#0D1117", "border-radius": "3px", "height": "4px", "margin-bottom": "8px", "overflow": "hidden" }}>
        <div style={{
          "background": color(),
          "height": "100%",
          "width": `${Math.round(props.agent.maxSignal * 100)}%`,
          "border-radius": "3px",
        }} />
      </div>

      {/* Last activity */}
      <div style={{ "font-size": "11px", "color": "#4A5668" }}>
        Last: {formatAge(props.agent.lastActivityAt)}
        <Show when={props.agent.durationMs}>
          <span style={{ "margin-left": "8px" }}>· {Math.round(props.agent.durationMs! / 1000)}s</span>
        </Show>
      </div>
    </div>
  )
}
