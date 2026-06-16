import { For } from "solid-js"
import type { ActivityFeedEntry } from "@/vrax/data"

const SEV_COLORS: Record<string, string> = {
  CRITICAL: "#EF4444",
  HIGH: "#F97316",
  MEDIUM: "#F59E0B",
  LOW: "#3B82F6",
  INFO: "#22C55E",
}

function pheromoneBar(v: number): string {
  const blocks = Math.round(v * 4)
  return "█".repeat(blocks) + "░".repeat(4 - blocks)
}

function formatAge(ms: number): string {
  const m = Math.floor(ms / 60_000)
  if (m < 1) return "<1m"
  if (m < 60) return `${m}m`
  return `${Math.floor(m / 60)}h`
}

export function ActivityFeed(props: { entries: ActivityFeedEntry[] }) {
  const visible = () => props.entries.slice(0, 20)

  return (
    <div
      style={{
        "background": "#172030",
        "border": "1px solid #1E2A3A",
        "border-radius": "8px",
        "overflow": "hidden",
      }}
    >
      <div style={{ "font-size": "10px", "font-weight": "600", "color": "#4A5668", "letter-spacing": "0.08em", "text-transform": "uppercase", "padding": "10px 14px 8px" }}>
        ACTIVITY FEED
      </div>

      <div style={{ "max-height": "240px", "overflow-y": "auto" }}>
        <For each={visible()}>
          {(entry, i) => (
            <div style={{
              "display": "flex",
              "align-items": "center",
              "gap": "10px",
              "padding": "7px 14px",
              "border-top": i() > 0 ? "1px solid #1A2332" : "none",
            }}>
              <span style={{ "color": "#4A5668", "font-size": "11px", "font-family": "JetBrains Mono, monospace", "min-width": "28px" }}>
                {formatAge(entry.ageMs)}
              </span>
              <span style={{ "color": "#8892A0", "font-size": "11px", "font-family": "JetBrains Mono, monospace", "min-width": "80px" }}>
                {entry.agent}
              </span>
              <span style={{ "color": "#D1D9E3", "font-size": "12px", "flex": "1" }}>
                {entry.findingType}
              </span>
              <span style={{
                "color": SEV_COLORS[entry.severity] ?? "#8892A0",
                "font-family": "JetBrains Mono, monospace",
                "font-size": "12px",
              }}>
                {pheromoneBar(entry.pheromone)}
              </span>
            </div>
          )}
        </For>
      </div>
    </div>
  )
}
