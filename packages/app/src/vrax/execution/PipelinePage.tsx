import { createMemo, Show } from "solid-js"
import { useCampaigns } from "@/vrax/data"
import { useVrax } from "@/vrax/context/vrax"
import { PhaseList } from "./PhaseList"
import { ActivePhaseDetail } from "./ActivePhaseDetail"
import { ConsensusBar } from "./ConsensusBar"

export function PipelinePage() {
  const campaigns = useCampaigns()
  const vrax = useVrax()

  const council = () => campaigns.store.council
  const activePhase = createMemo(() => council()?.phases.find((p) => p.status === "running"))
  const passedCount = createMemo(() => council()?.phases.filter((p) => p.status === "passed").length ?? 0)

  return (
    <div style={{ "padding": "24px", "overflow-y": "auto", "height": "100%", "box-sizing": "border-box", "display": "flex", "flex-direction": "column", "gap": "20px" }}>
      {/* Header */}
      <div style={{ "display": "flex", "align-items": "center", "justify-content": "space-between" }}>
        <div style={{ "font-size": "16px", "font-weight": "700", "color": "#D1D9E3" }}>
          Pipeline
          <Show when={council()}>
            <span style={{ "margin-left": "12px", "font-size": "12px", "color": "#8892A0", "font-weight": "400", "font-family": "JetBrains Mono, monospace" }}>
              {council()!.mode.toUpperCase()}
            </span>
          </Show>
        </div>
        <Show when={council()}>
          <div style={{
            "display": "flex",
            "align-items": "center",
            "gap": "6px",
            "background": "rgba(79,124,255,0.12)",
            "border": "1px solid rgba(79,124,255,0.25)",
            "border-radius": "6px",
            "padding": "4px 10px",
            "font-size": "12px",
            "color": "#4F7CFF",
          }}>
            <span style={{ "animation": activePhase() ? "pulse 2s infinite" : "none" }}>◎</span>
            Phase {passedCount() + (activePhase() ? 1 : 0)}/{council()!.phases.length}
          </div>
        </Show>
      </div>

      <Show when={council()}>
        {(c) => (
          <>
            <PhaseList phases={c().phases} activePhase={activePhase()} />
            <Show when={activePhase()}>
              <ActivePhaseDetail phase={activePhase()} />
            </Show>
            <ConsensusBar consensus={c().consensus} />
          </>
        )}
      </Show>

      <Show when={!council()}>
        <div
          style={{
            "background": "#172030",
            "border": "1px dashed #1E2A3A",
            "border-radius": "8px",
            "padding": "40px",
            "text-align": "center",
            "color": "#4A5668",
          }}
        >
          <div style={{ "font-size": "13px", "margin-bottom": "12px" }}>No pipeline data</div>
          <div style={{ "font-size": "11px", "line-height": "1.6", "margin-bottom": "20px" }}>
            Open a campaign workspace or start a scan to see pipeline state.
          </div>
          <button
            type="button"
            onClick={() => vrax.setNav("campaigns")}
            style={{
              "background": "#4F7CFF",
              "border": "none",
              "border-radius": "6px",
              "color": "#fff",
              "font-size": "12px",
              "font-weight": "600",
              "padding": "8px 16px",
              "cursor": "pointer",
            }}
          >
            Open Campaign Workspace
          </button>
        </div>
      </Show>
    </div>
  )
}
