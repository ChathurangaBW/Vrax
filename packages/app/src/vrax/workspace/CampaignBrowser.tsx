import { createResource, For, Show } from "solid-js"
import { usePlatform } from "@/context/platform"
import { useCampaigns } from "@/vrax/data"
import { useVrax } from "@/vrax/context/vrax"

export function CampaignBrowser() {
  const platform = usePlatform()
  const campaigns = useCampaigns()
  const vrax = useVrax()

  const [campaignList] = createResource(
    () => campaigns.store.root,
    async (root) => {
      if (!root || !platform.campaigns) return []
      return platform.campaigns.scan(root)
    },
  )

  function formatAge(ms: number): string {
    const diff = Date.now() - ms
    const mins = Math.floor(diff / 60_000)
    if (mins < 1) return "just now"
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    return `${Math.floor(hrs / 24)}d ago`
  }

  return (
    <div style={{ "display": "flex", "flex-direction": "column", "gap": "10px", "width": "100%" }}>
      {/* Header */}
      <div
        style={{
          "display": "flex",
          "align-items": "center",
          "justify-content": "space-between",
          "margin-bottom": "2px",
        }}
      >
        <span
          style={{
            "font-size": "11px",
            "color": "rgba(255,255,255,0.22)",
            "letter-spacing": "0.08em",
            "text-transform": "uppercase",
            "font-weight": "500",
          }}
        >
          Recent Campaigns
        </span>
        <Show when={campaigns.store.root}>
          <span
            style={{
              "font-size": "10px",
              "color": "rgba(255,255,255,0.18)",
              "font-family": "JetBrains Mono, monospace",
              "overflow": "hidden",
              "text-overflow": "ellipsis",
              "white-space": "nowrap",
              "max-width": "220px",
            }}
            title={campaigns.store.root ?? ""}
          >
            {campaigns.store.root}
          </span>
        </Show>
      </div>

      {/* Loading */}
      <Show when={campaignList.loading}>
        <div style={{ "color": "rgba(255,255,255,0.2)", "font-size": "12px", "padding": "8px 0" }}>
          Scanning…
        </div>
      </Show>

      {/* Empty state */}
      <Show when={!campaignList.loading && (campaignList()?.length ?? 0) === 0 && campaigns.store.root}>
        <div
          style={{
            "background": "#111722",
            "border": "1px dashed rgba(255,255,255,0.08)",
            "border-radius": "8px",
            "padding": "20px 16px",
            "text-align": "center",
          }}
        >
          <div style={{ "font-size": "22px", "opacity": "0.15", "margin-bottom": "10px" }}>▦</div>
          <div style={{ "color": "rgba(255,255,255,0.35)", "font-size": "13px", "font-weight": "500", "margin-bottom": "6px" }}>
            No campaigns yet
          </div>
          <div style={{ "color": "rgba(255,255,255,0.2)", "font-size": "11px", "line-height": "1.6" }}>
            Pick a binary on the left and run the pipeline —
            each run creates a campaign here automatically.
          </div>
        </div>
      </Show>

      {/* No root yet (auto-init in progress) */}
      <Show when={!campaigns.store.root && !campaignList.loading}>
        <div style={{ "color": "rgba(255,255,255,0.18)", "font-size": "12px" }}>
          Initializing workspace…
        </div>
      </Show>

      {/* Campaign list */}
      <For each={campaignList() ?? []}>
        {(c) => (
          <div
            style={{
              "background": "#111722",
              "border": "1px solid rgba(255,255,255,0.07)",
              "border-radius": "8px",
              "padding": "12px 14px",
              "display": "flex",
              "align-items": "center",
              "justify-content": "space-between",
              "gap": "12px",
              "transition": "border-color 120ms",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = "rgba(79,124,255,0.3)")}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)")}
          >
            <div style={{ "min-width": "0" }}>
              <div
                style={{
                  "font-size": "13px",
                  "font-weight": "600",
                  "color": "#D1D9E3",
                  "overflow": "hidden",
                  "text-overflow": "ellipsis",
                  "white-space": "nowrap",
                }}
              >
                {c.name}
              </div>
              <div style={{ "font-size": "10px", "color": "rgba(255,255,255,0.22)", "margin-top": "3px", "font-family": "JetBrains Mono, monospace" }}>
                {c.markers.join(" · ")} · {formatAge(c.updatedAt)}
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                campaigns.setCampaign(c.name)
                vrax.setNav("blackboard")
              }}
              style={{
                "background": "rgba(79,124,255,0.15)",
                "border": "1px solid rgba(79,124,255,0.35)",
                "border-radius": "6px",
                "color": "#4F7CFF",
                "font-size": "11px",
                "font-weight": "600",
                "padding": "5px 12px",
                "cursor": "pointer",
                "flex-shrink": "0",
                "transition": "background 120ms",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(79,124,255,0.25)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(79,124,255,0.15)")}
            >
              Open
            </button>
          </div>
        )}
      </For>
    </div>
  )
}
