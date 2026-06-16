import { createMemo, createSignal, For, Show } from "solid-js"
import { useCampaigns } from "@/vrax/data"
import { useVrax } from "@/vrax/context/vrax"
import type { FindingSeverity, BlackboardFinding } from "@/vrax/data"
import { SeverityTabs } from "./SeverityTabs"
import { FindingCard } from "./FindingCard"
import { FindingDetail } from "./FindingDetail"

type Tab = FindingSeverity | "ALL"

export function EvidencePage() {
  const campaigns = useCampaigns()
  const vrax = useVrax()
  const [activeTab, setActiveTab] = createSignal<Tab>("ALL")

  const findings = createMemo(() =>
    (campaigns.store.blackboard?.findings ?? []).slice().sort((a, b) => b.pheromone - a.pheromone),
  )

  const counts = createMemo(() => {
    const result: Partial<Record<Tab, number>> = { ALL: findings().length }
    for (const f of findings()) {
      result[f.severity] = (result[f.severity] ?? 0) + 1
    }
    return result
  })

  const filtered = createMemo(() => {
    const tab = activeTab()
    if (tab === "ALL") return findings()
    return findings().filter((f) => f.severity === tab)
  })

  const selectedId = () => vrax.store.selectedFindingId
  const selectedFinding = createMemo<BlackboardFinding | null>(() =>
    findings().find((f) => f.id === selectedId()) ?? null,
  )

  return (
    <div style={{ "display": "flex", "flex-direction": "column", "height": "100%", "overflow": "hidden" }}>
      {/* Tab bar */}
      <div style={{ "padding": "12px 16px 0", "background": "#0D1117", "flex-shrink": "0" }}>
        <div style={{ "font-size": "16px", "font-weight": "700", "color": "#D1D9E3", "margin-bottom": "12px" }}>
          Evidence
        </div>
        <SeverityTabs active={activeTab()} counts={counts()} onChange={setActiveTab} />
      </div>

      {/* Main content: list + detail */}
      <div style={{ "flex": "1", "display": "flex", "min-height": "0", "overflow": "hidden" }}>
        {/* Finding list */}
        <div style={{ "flex": "1", "overflow-y": "auto", "padding": "12px 16px", "display": "flex", "flex-direction": "column", "gap": "8px" }}>
          <Show when={filtered().length === 0}>
            <div style={{ "color": "#4A5668", "font-size": "13px", "text-align": "center", "padding-top": "40px" }}>
              No findings yet. Open a campaign with blackboard data.
            </div>
          </Show>
          <For each={filtered()}>
            {(f) => (
              <FindingCard
                finding={f}
                selected={selectedId() === f.id}
                expanded={false}
                onClick={() => vrax.setSelectedFindingId(f.id)}
                onExpand={() => {}}
              />
            )}
          </For>
        </div>

        {/* Finding detail */}
        <div style={{ "width": "280px", "flex-shrink": "0" }}>
          <FindingDetail finding={selectedFinding()} />
        </div>
      </div>
    </div>
  )
}
