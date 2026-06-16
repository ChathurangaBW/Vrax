import { createMemo, createSignal, onCleanup, onMount, Show } from "solid-js"
import type { CouncilPhase } from "@/vrax/data"

export function ActivePhaseDetail(props: { phase: CouncilPhase | undefined }) {
  const [now, setNow] = createSignal(Date.now())

  let interval: ReturnType<typeof setInterval> | undefined
  onMount(() => { interval = setInterval(() => setNow(Date.now()), 1000) })
  onCleanup(() => { if (interval) clearInterval(interval) })

  const runningFor = createMemo(() => {
    const phase = props.phase
    if (!phase?.started_at) return null
    const ms = now() - phase.started_at
    const s = Math.floor(ms / 1000)
    const m = Math.floor(s / 60)
    if (m > 0) return `${m}m ${s % 60}s`
    return `${s}s`
  })

  return (
    <Show when={props.phase}>
      {(phase) => (
        <div
          style={{
            "background": "#172030",
            "border": "1px solid rgba(79,124,255,0.3)",
            "border-radius": "8px",
            "padding": "16px",
          }}
        >
          <div style={{ "font-size": "10px", "font-weight": "600", "color": "#4A5668", "letter-spacing": "0.08em", "text-transform": "uppercase", "margin-bottom": "12px" }}>
            ACTIVE PHASE: {phase().name}
          </div>

          <div style={{ "display": "grid", "grid-template-columns": "1fr 1fr", "gap": "8px 16px" }}>
            <div>
              <div style={{ "font-size": "10px", "color": "#4A5668", "margin-bottom": "2px" }}>Agent</div>
              <div style={{ "font-size": "13px", "color": "#D1D9E3", "font-family": "JetBrains Mono, monospace" }}>
                {phase().agent ?? "—"}
              </div>
            </div>

            <div>
              <div style={{ "font-size": "10px", "color": "#4A5668", "margin-bottom": "2px" }}>Running</div>
              <div style={{ "font-size": "13px", "color": "#4F7CFF", "font-family": "JetBrains Mono, monospace" }}>
                {runningFor() ?? "—"}
              </div>
            </div>

            <Show when={phase().started_at}>
              <div>
                <div style={{ "font-size": "10px", "color": "#4A5668", "margin-bottom": "2px" }}>Started</div>
                <div style={{ "font-size": "12px", "color": "#8892A0", "font-family": "JetBrains Mono, monospace" }}>
                  {new Date(phase().started_at!).toISOString().replace("T", " ").slice(0, 19)}
                </div>
              </div>
            </Show>
          </div>

          <Show when={phase().summary}>
            <div style={{ "margin-top": "12px", "font-size": "12px", "color": "#8892A0", "line-height": "1.6", "border-top": "1px solid #1E2A3A", "padding-top": "10px" }}>
              {phase().summary}
            </div>
          </Show>
        </div>
      )}
    </Show>
  )
}
