import { For, Show } from "solid-js"
import type { ConsensusState } from "@/vrax/data"

export function ConsensusBar(props: { consensus: ConsensusState | undefined }) {
  return (
    <div
      style={{
        "background": "#172030",
        "border": "1px solid #1E2A3A",
        "border-radius": "8px",
        "padding": "14px 16px",
      }}
    >
      <div style={{ "display": "flex", "align-items": "center", "justify-content": "space-between", "margin-bottom": "10px" }}>
        <div style={{ "font-size": "10px", "font-weight": "600", "color": "#4A5668", "letter-spacing": "0.08em", "text-transform": "uppercase" }}>
          CONSENSUS
        </div>
        <Show when={props.consensus}>
          <span style={{ "font-size": "13px", "font-weight": "700", "color": "#D1D9E3", "font-family": "JetBrains Mono, monospace" }}>
            {Math.round((props.consensus!.confidence ?? 0) * 100)}%
          </span>
        </Show>
      </div>

      <Show when={props.consensus}>
        {/* Progress bar */}
        <div style={{ "background": "#0D1117", "border-radius": "3px", "height": "6px", "margin-bottom": "10px", "overflow": "hidden" }}>
          <div style={{
            "background": "#4F7CFF",
            "height": "100%",
            "width": `${Math.round((props.consensus!.confidence ?? 0) * 100)}%`,
            "border-radius": "3px",
            "transition": "width 0.3s ease",
          }} />
        </div>

        {/* Verdict */}
        <div style={{ "font-size": "13px", "color": "#D1D9E3", "margin-bottom": "10px" }}>
          {props.consensus!.verdict}
        </div>

        {/* Votes */}
        <div style={{ "display": "flex", "flex-wrap": "wrap", "gap": "6px" }}>
          <For each={props.consensus!.votes}>
            {(vote) => (
              <span style={{
                "background": "rgba(79,124,255,0.12)",
                "border": "1px solid rgba(79,124,255,0.25)",
                "border-radius": "4px",
                "padding": "2px 8px",
                "font-size": "11px",
                "color": "#8892A0",
              }}>
                {vote.agent} <span style={{ "color": "#4F7CFF" }}>✓</span>
              </span>
            )}
          </For>
        </div>
      </Show>

      <Show when={!props.consensus}>
        <div style={{ "color": "#4A5668", "font-size": "12px" }}>Awaiting votes…</div>
      </Show>
    </div>
  )
}
