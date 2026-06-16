import { For } from "solid-js"
import type { CouncilPhase } from "@/vrax/data"

const STATUS_ICON: Record<string, string> = {
  passed: "✓",
  running: "◎",
  failed: "✗",
  pending: "○",
  skipped: "—",
}

const STATUS_COLOR: Record<string, string> = {
  passed: "#22C55E",
  running: "#4F7CFF",
  failed: "#EF4444",
  pending: "#4A5668",
  skipped: "#4A5668",
}

function formatDuration(ms: number | undefined): string {
  if (!ms) return ""
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  if (m > 0) return `${m}m ${s % 60}s`
  return `${s}s`
}

export function PhaseList(props: { phases: CouncilPhase[]; activePhase?: CouncilPhase }) {
  return (
    <div style={{ "display": "flex", "flex-direction": "column", "gap": "4px" }}>
      <For each={props.phases}>
        {(phase) => {
          const isActive = () => phase.status === "running"
          const color = () => STATUS_COLOR[phase.status] ?? "#4A5668"
          const icon = () => STATUS_ICON[phase.status] ?? "○"

          return (
            <div
              style={{
                "display": "flex",
                "align-items": "center",
                "gap": "12px",
                "padding": "10px 14px",
                "border-radius": "6px",
                "background": isActive() ? "rgba(79,124,255,0.08)" : "transparent",
                "border": isActive() ? "1px solid rgba(79,124,255,0.2)" : "1px solid transparent",
                "transition": "background 0.2s",
              }}
            >
              {/* Status icon */}
              <span style={{
                "font-size": "16px",
                "color": color(),
                "width": "20px",
                "text-align": "center",
                "flex-shrink": "0",
                "animation": isActive() ? "pulse 2s infinite" : "none",
              }}>
                {icon()}
              </span>

              {/* Phase name */}
              <span style={{
                "font-size": "13px",
                "font-weight": "600",
                "color": phase.status === "pending" ? "#4A5668" : "#D1D9E3",
                "flex": "1",
                "text-transform": "uppercase",
                "letter-spacing": "0.04em",
              }}>
                {phase.name}
              </span>

              {/* Agent */}
              <span style={{ "font-size": "11px", "color": "#8892A0", "font-family": "JetBrains Mono, monospace" }}>
                {phase.agent ?? "—"}
              </span>

              {/* Duration */}
              <span style={{ "font-size": "11px", "color": "#4A5668", "font-family": "JetBrains Mono, monospace", "min-width": "50px", "text-align": "right" }}>
                {phase.status === "running" ? "running…" : formatDuration(phase.duration_ms)}
              </span>

              {/* Pass/fail badge */}
              <span style={{
                "font-size": "10px",
                "font-weight": "600",
                "color": color(),
                "min-width": "36px",
                "text-align": "right",
              }}>
                {phase.status === "passed" ? "PASS" : phase.status === "failed" ? "FAIL" : ""}
              </span>
            </div>
          )
        }}
      </For>
    </div>
  )
}
