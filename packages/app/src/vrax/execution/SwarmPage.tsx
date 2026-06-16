import { createMemo, Show } from "solid-js"
import { For } from "solid-js"
import { useCampaigns, deriveAgents, deriveMetrics, deriveActivityFeed } from "@/vrax/data"
import { AgentCard } from "./AgentCard"
import { ActivityFeed } from "./ActivityFeed"
import { ConsensusBar } from "./ConsensusBar"
import { useVrax } from "@/vrax/context/vrax"

export function SwarmPage() {
  const campaigns = useCampaigns()
  const vrax = useVrax()

  const council = () => campaigns.store.council
  const blackboard = () => campaigns.store.blackboard

  const agents = createMemo(() => deriveAgents(council(), blackboard()))
  const metrics = createMemo(() => deriveMetrics(blackboard(), council()))
  const feed = createMemo(() => deriveActivityFeed(blackboard()))

  return (
    <div style={{ "padding": "24px", "overflow-y": "auto", "height": "100%", "box-sizing": "border-box", "display": "flex", "flex-direction": "column", "gap": "20px" }}>
      {/* Header */}
      <div style={{ "display": "flex", "align-items": "center", "justify-content": "space-between" }}>
        <div style={{ "font-size": "16px", "font-weight": "700", "color": "#D1D9E3" }}>
          Swarm
          <Show when={council()}>
            <span style={{ "margin-left": "12px", "font-size": "12px", "color": "#8892A0", "font-weight": "400", "font-family": "JetBrains Mono, monospace" }}>
              Iteration {council()!.iteration}/{council()!.max_iterations}
            </span>
          </Show>
        </div>
        {/* Metric badges */}
        <div style={{ "display": "flex", "gap": "8px", "font-size": "11px" }}>
          <span style={{ "background": "rgba(79,124,255,0.12)", "border": "1px solid rgba(79,124,255,0.25)", "border-radius": "4px", "padding": "3px 8px", "color": "#4F7CFF" }}>
            {metrics().activeAgents} active
          </span>
          <span style={{ "background": "rgba(34,197,94,0.10)", "border": "1px solid rgba(34,197,94,0.2)", "border-radius": "4px", "padding": "3px 8px", "color": "#22C55E" }}>
            {metrics().completedAgents} done
          </span>
        </div>
      </div>

      <Show when={agents().length === 0}>
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
          <div style={{ "font-size": "13px", "margin-bottom": "12px" }}>No swarm data</div>
          <button type="button" onClick={() => vrax.setNav("campaigns")}
            style={{ "background": "#4F7CFF", "border": "none", "border-radius": "6px", "color": "#fff", "font-size": "12px", "font-weight": "600", "padding": "8px 16px", "cursor": "pointer" }}>
            Open Campaign Workspace
          </button>
        </div>
      </Show>

      <Show when={agents().length > 0}>
        <div style={{ "display": "grid", "grid-template-columns": "1fr 1fr", "gap": "12px" }}>
          <For each={agents()}>
            {(agent) => <AgentCard agent={agent} />}
          </For>
        </div>

        <ConsensusBar consensus={council()?.consensus} />

        <ActivityFeed entries={feed()} />
      </Show>
    </div>
  )
}
