import { For, Show } from "solid-js"
import type { BlackboardFinding } from "@/vrax/data"
import { useVrax } from "@/vrax/context/vrax"

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

export function FindingDetail(props: { finding: BlackboardFinding | null }) {
  const vrax = useVrax()

  return (
    <div
      style={{
        "background": "#111722",
        "border-left": "1px solid #1E2A3A",
        "display": "flex",
        "flex-direction": "column",
        "overflow-y": "auto",
        "padding": "16px",
      }}
    >
      <Show
        when={props.finding}
        fallback={
          <div style={{ "color": "#4A5668", "font-size": "12px", "text-align": "center", "padding-top": "40px" }}>
            Select a finding to see details.
          </div>
        }
      >
        {(f) => {
          const color = () => SEV_COLORS[f().severity] ?? "#8892A0"

          return (
            <>
              {/* Header */}
              <div style={{ "margin-bottom": "14px" }}>
                <div style={{ "font-size": "15px", "font-weight": "700", "color": "#D1D9E3", "margin-bottom": "6px" }}>
                  {f().type}
                </div>
                <div style={{ "display": "flex", "align-items": "center", "gap": "8px" }}>
                  <span style={{ "background": `${color()}22`, "border": `1px solid ${color()}44`, "border-radius": "4px", "padding": "2px 8px", "font-size": "11px", "font-weight": "700", "color": color() }}>
                    {f().severity}
                  </span>
                  <span style={{ "font-family": "JetBrains Mono, monospace", "font-size": "12px", "color": color() }}>
                    {pheromoneBar(f().pheromone)} {f().pheromone.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Description */}
              <div style={{ "font-size": "12px", "color": "#8892A0", "line-height": "1.6", "margin-bottom": "14px", "border-top": "1px solid #1E2A3A", "padding-top": "12px" }}>
                {f().description}
              </div>

              {/* Author */}
              <div style={{ "margin-bottom": "14px" }}>
                <div style={{ "font-size": "10px", "color": "#4A5668", "margin-bottom": "4px" }}>AGENT</div>
                <div style={{ "font-size": "12px", "color": "#D1D9E3", "font-family": "JetBrains Mono, monospace" }}>
                  {f().author}
                </div>
              </div>

              {/* Payload */}
              <div style={{ "margin-bottom": "14px" }}>
                <div style={{ "font-size": "10px", "color": "#4A5668", "margin-bottom": "6px" }}>PAYLOAD</div>
                <div style={{ "display": "flex", "flex-direction": "column", "gap": "4px" }}>
                  <For each={Object.entries(f().payload)}>
                    {([k, v]) => (
                      <div style={{ "display": "flex", "gap": "8px", "font-size": "11px" }}>
                        <span style={{ "color": "#4A5668", "font-family": "JetBrains Mono, monospace", "min-width": "80px", "flex-shrink": "0" }}>{k}</span>
                        <span style={{ "color": "#D1D9E3", "font-family": "JetBrains Mono, monospace", "word-break": "break-all" }}>
                          {typeof v === "object" ? JSON.stringify(v) : String(v)}
                        </span>
                      </div>
                    )}
                  </For>
                </div>
              </div>

              {/* Triggered agents */}
              <Show when={f().triggered_agents.length > 0}>
                <div style={{ "margin-bottom": "16px" }}>
                  <div style={{ "font-size": "10px", "color": "#4A5668", "margin-bottom": "6px" }}>TRIGGERED</div>
                  <div style={{ "display": "flex", "flex-direction": "column", "gap": "4px" }}>
                    <For each={f().triggered_agents}>
                      {(agent) => (
                        <div style={{ "font-size": "12px", "color": "#8892A0", "font-family": "JetBrains Mono, monospace" }}>
                          → {agent}
                        </div>
                      )}
                    </For>
                  </div>
                </div>
              </Show>

              {/* Investigate button */}
              <button
                type="button"
                onClick={() => vrax.setNav("evidence")}
                style={{
                  "background": "rgba(79,124,255,0.12)",
                  "border": "1px solid rgba(79,124,255,0.3)",
                  "border-radius": "6px",
                  "color": "#4F7CFF",
                  "font-size": "12px",
                  "font-weight": "600",
                  "padding": "8px 0",
                  "cursor": "pointer",
                  "width": "100%",
                  "margin-top": "auto",
                }}
              >
                Investigate →
              </button>
            </>
          )
        }}
      </Show>
    </div>
  )
}
