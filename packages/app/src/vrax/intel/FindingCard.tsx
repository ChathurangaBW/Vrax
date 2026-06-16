import { Show } from "solid-js"
import type { BlackboardFinding } from "@/vrax/data"

export const SEV_COLORS: Record<string, string> = {
  CRITICAL: "#EF4444",
  HIGH:     "#F97316",
  MEDIUM:   "#F59E0B",
  LOW:      "#3B82F6",
  INFO:     "#22C55E",
}

const SEV_BG: Record<string, string> = {
  CRITICAL: "rgba(239,68,68,0.07)",
  HIGH:     "rgba(249,115,22,0.07)",
  MEDIUM:   "rgba(245,158,11,0.07)",
  LOW:      "rgba(59,130,246,0.07)",
  INFO:     "rgba(34,197,94,0.07)",
}

export function pheromoneBar(v: number): string {
  const blocks = Math.round(v * 4)
  return "█".repeat(blocks) + "░".repeat(4 - blocks)
}

function formatAge(ts: number): string {
  const m = Math.floor((Date.now() - ts) / 60_000)
  if (m < 1) return "<1m"
  if (m < 60) return `${m}m ago`
  return `${Math.floor(m / 60)}h ago`
}

export function FindingCard(props: {
  finding: BlackboardFinding
  selected: boolean
  expanded: boolean
  onClick: () => void
  onExpand: (e: MouseEvent) => void
}) {
  const f = () => props.finding
  const color = () => SEV_COLORS[f().severity] ?? "#8892A0"
  const bg = () => SEV_BG[f().severity] ?? "transparent"
  const confirmed = () => f().pheromone >= 0.70

  return (
    <div
      style={{
        "background": props.selected ? "#172030" : bg(),
        "border": props.selected
          ? "1px solid rgba(79,124,255,0.5)"
          : `1px solid ${color()}22`,
        "border-radius": "8px",
        "overflow": "hidden",
        "transition": "border-color 120ms, background 120ms",
      }}
    >
      {/* Severity accent line */}
      <div style={{ "height": "2px", "background": color(), "opacity": "0.6" }} />

      {/* Main card body */}
      <button
        type="button"
        onClick={props.onClick}
        style={{
          "display": "block",
          "width": "100%",
          "text-align": "left",
          "background": "transparent",
          "border": "none",
          "padding": "12px 14px 10px",
          "cursor": "pointer",
        }}
      >
        {/* Row 1: severity badge + type + CONFIRMED chip */}
        <div style={{ "display": "flex", "align-items": "center", "gap": "7px", "margin-bottom": "7px" }}>
          <span
            style={{
              "background": `${color()}28`,
              "border": `1px solid ${color()}55`,
              "border-radius": "4px",
              "padding": "1px 5px",
              "font-size": "9px",
              "font-weight": "700",
              "color": color(),
              "letter-spacing": "0.05em",
              "flex-shrink": "0",
            }}
          >
            {f().severity.slice(0, 4)}
          </span>
          <span
            style={{
              "font-size": "12px",
              "font-weight": "600",
              "color": "#D1D9E3",
              "flex": "1",
              "overflow": "hidden",
              "text-overflow": "ellipsis",
              "white-space": "nowrap",
              "font-family": "JetBrains Mono, monospace",
              "letter-spacing": "0.02em",
            }}
          >
            {f().type}
          </span>
          <Show when={confirmed()}>
            <span
              style={{
                "background": "rgba(79,124,255,0.15)",
                "border": "1px solid rgba(79,124,255,0.4)",
                "border-radius": "4px",
                "padding": "1px 6px",
                "font-size": "9px",
                "font-weight": "700",
                "color": "#4F7CFF",
                "letter-spacing": "0.05em",
                "flex-shrink": "0",
              }}
            >
              CONFIRMED
            </span>
          </Show>
        </div>

        {/* Row 2: description */}
        <div
          style={{
            "font-size": "12px",
            "color": "#8892A0",
            "line-height": "1.55",
            "margin-bottom": "10px",
            "overflow": "hidden",
            "display": "-webkit-box",
            "-webkit-line-clamp": props.expanded ? "unset" : "2",
            "-webkit-box-orient": "vertical",
          }}
        >
          {f().description}
        </div>

        {/* Row 3: pheromone + author + age */}
        <div style={{ "display": "flex", "align-items": "center", "gap": "8px" }}>
          <span
            style={{
              "font-family": "JetBrains Mono, monospace",
              "font-size": "10px",
              "color": color(),
              "letter-spacing": "0.02em",
              "opacity": "0.8",
            }}
          >
            {pheromoneBar(f().pheromone)} {f().pheromone.toFixed(2)}
          </span>
          <span style={{ "color": "#2E3A4A" }}>·</span>
          <span style={{ "font-size": "10px", "color": "#4A5668", "font-family": "JetBrains Mono, monospace" }}>
            {f().author}
          </span>
          <span style={{ "color": "#2E3A4A" }}>·</span>
          <span style={{ "font-size": "10px", "color": "#4A5668" }}>
            {formatAge(f().created_at)}
          </span>
        </div>
      </button>

      {/* Expand toggle */}
      <div
        style={{
          "display": "flex",
          "align-items": "center",
          "justify-content": "space-between",
          "padding": "0 14px 8px",
          "gap": "8px",
        }}
      >
        <div style={{ "display": "flex", "gap": "6px" }}>
          <Show when={f().triggered_agents?.length}>
            <span style={{ "font-size": "10px", "color": "#3A4A5A" }}>
              {f().triggered_agents!.length} agent{f().triggered_agents!.length > 1 ? "s" : ""}
            </span>
          </Show>
        </div>
        <button
          type="button"
          onClick={props.onExpand}
          style={{
            "background": "transparent",
            "border": "none",
            "cursor": "pointer",
            "color": "rgba(255,255,255,0.22)",
            "font-size": "10px",
            "padding": "2px 6px",
            "border-radius": "3px",
            "transition": "color 100ms, background 100ms",
            "display": "flex",
            "align-items": "center",
            "gap": "4px",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "rgba(255,255,255,0.6)"
            e.currentTarget.style.background = "rgba(255,255,255,0.06)"
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "rgba(255,255,255,0.22)"
            e.currentTarget.style.background = "transparent"
          }}
        >
          {props.expanded ? "▲ collapse" : "▼ expand"}
        </button>
      </div>

      {/* Expanded payload block */}
      <Show when={props.expanded}>
        <div
          style={{
            "border-top": "1px solid rgba(255,255,255,0.06)",
            "background": "#0A0C10",
            "padding": "12px 14px",
            "font-family": "JetBrains Mono, monospace",
            "font-size": "11px",
            "color": "#8892A0",
            "line-height": "1.7",
            "overflow-x": "auto",
            "white-space": "pre-wrap",
            "word-break": "break-all",
          }}
        >
          <Show when={f().triggered_agents?.length}>
            <div style={{ "margin-bottom": "8px" }}>
              <span style={{ "color": "#4A5668" }}>agents: </span>
              <span style={{ "color": "#6B7A8E" }}>{f().triggered_agents!.join(", ")}</span>
            </div>
          </Show>
          <Show
            when={Object.keys(f().payload ?? {}).length > 0}
            fallback={<span style={{ "color": "#2E3A4A" }}>{"// no payload attached"}</span>}
          >
            <div>
              <span style={{ "color": "#4A5668" }}>payload: </span>
              <span style={{ "color": "#6B7A8E" }}>
                {JSON.stringify(f().payload, null, 2)}
              </span>
            </div>
          </Show>
        </div>
      </Show>
    </div>
  )
}
