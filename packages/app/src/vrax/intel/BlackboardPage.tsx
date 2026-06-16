import { createSignal, For, Show } from "solid-js"
import { useCampaigns } from "@/vrax/data"
import { FindingCard, SEV_COLORS } from "./FindingCard"

type SevFilter = "ALL" | "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO" | "ARCHIVED"

const FILTER_CHIPS: SevFilter[] = ["ALL", "CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"]

const CHIP_COLOR: Record<SevFilter, string> = {
  ALL:      "#4F7CFF",
  CRITICAL: "#EF4444",
  HIGH:     "#F97316",
  MEDIUM:   "#F59E0B",
  LOW:      "#3B82F6",
  INFO:     "#22C55E",
  ARCHIVED: "#6B7A8E",
}

export function BlackboardPage() {
  const campaigns = useCampaigns()
  const [filter, setFilter] = createSignal<SevFilter>("ALL")
  const [selectedId, setSelectedId] = createSignal<string | null>(null)
  const [expandedId, setExpandedId] = createSignal<string | null>(null)

  const blackboard = () => campaigns.store.blackboard
  const allFindings = () => blackboard()?.findings ?? []

  const severityCount = (sev: SevFilter) =>
    sev === "ALL"
      ? allFindings().length
      : allFindings().filter(f => f.severity === sev).length

  const filtered = () => {
    const f = filter()
    if (f === "ALL") return allFindings()
    return allFindings().filter(fd => fd.severity === f)
  }

  const updatedAt = () => {
    const ts = blackboard()?.updated_at
    if (!ts) return null
    return new Date(ts).toISOString().replace("T", " ").slice(0, 19) + " UTC"
  }

  function toggleExpand(id: string, e: MouseEvent) {
    e.stopPropagation()
    setExpandedId(prev => prev === id ? null : id)
  }

  return (
    <div
      style={{
        "display": "flex",
        "flex-direction": "column",
        "height": "100%",
        "overflow": "hidden",
        "background": "#0D1117",
      }}
    >
      {/* Header */}
      <div
        style={{
          "padding": "16px 20px 0",
          "flex-shrink": "0",
          "border-bottom": "1px solid rgba(255,255,255,0.05)",
        }}
      >
        <div
          style={{
            "display": "flex",
            "align-items": "center",
            "justify-content": "space-between",
            "margin-bottom": "12px",
          }}
        >
          <div style={{ "display": "flex", "align-items": "baseline", "gap": "10px" }}>
            <span style={{ "font-size": "14px", "font-weight": "700", "color": "#D1D9E3" }}>
              Blackboard
            </span>
            <Show when={allFindings().length > 0}>
              <span
                style={{
                  "font-size": "11px",
                  "color": "rgba(255,255,255,0.25)",
                  "font-family": "JetBrains Mono, monospace",
                }}
              >
                {allFindings().length} finding{allFindings().length !== 1 ? "s" : ""}
              </span>
            </Show>
          </div>
          <Show when={updatedAt()}>
            <span
              style={{
                "font-size": "10px",
                "color": "#3A4A5A",
                "font-family": "JetBrains Mono, monospace",
              }}
            >
              {updatedAt()}
            </span>
          </Show>
        </div>

        {/* Filter chips */}
        <div style={{ "display": "flex", "gap": "6px", "padding-bottom": "12px", "flex-wrap": "wrap" }}>
          <For each={FILTER_CHIPS}>
            {(chip) => {
              const active = () => filter() === chip
              const count = severityCount(chip)
              const col = CHIP_COLOR[chip]
              return (
                <button
                  type="button"
                  onClick={() => setFilter(chip)}
                  style={{
                    "display": "flex",
                    "align-items": "center",
                    "gap": "5px",
                    "background": active() ? `${col}20` : "rgba(255,255,255,0.04)",
                    "border": active() ? `1px solid ${col}60` : "1px solid rgba(255,255,255,0.08)",
                    "border-radius": "5px",
                    "padding": "4px 9px",
                    "cursor": "pointer",
                    "color": active() ? col : "rgba(255,255,255,0.35)",
                    "font-size": "11px",
                    "font-weight": active() ? "600" : "400",
                    "transition": "all 120ms ease",
                    "letter-spacing": "0.03em",
                  }}
                >
                  {chip}
                  <Show when={chip !== "ALL" && count > 0}>
                    <span
                      style={{
                        "font-size": "9px",
                        "font-family": "JetBrains Mono, monospace",
                        "color": active() ? col : "rgba(255,255,255,0.2)",
                        "font-weight": "700",
                      }}
                    >
                      {count}
                    </span>
                  </Show>
                </button>
              )
            }}
          </For>
        </div>
      </div>

      {/* Content */}
      <div
        style={{
          "flex": "1",
          "overflow-y": "auto",
          "min-height": "0",
          "padding": "14px 20px 20px",
          "display": "flex",
          "flex-direction": "column",
          "gap": "8px",
          "scrollbar-width": "thin",
          "scrollbar-color": "rgba(255,255,255,0.08) transparent",
        }}
      >
        <Show
          when={blackboard()}
          fallback={
            <div
              style={{
                "display": "flex",
                "flex-direction": "column",
                "align-items": "center",
                "justify-content": "center",
                "height": "100%",
                "gap": "10px",
              }}
            >
              <span style={{ "font-size": "24px", "opacity": "0.15" }}>▪</span>
              <span style={{ "color": "rgba(255,255,255,0.18)", "font-size": "13px" }}>
                No blackboard data — start a campaign to populate findings
              </span>
            </div>
          }
        >
          <Show
            when={filtered().length > 0}
            fallback={
              <div style={{ "color": "rgba(255,255,255,0.18)", "font-size": "13px", "padding": "24px 0", "text-align": "center" }}>
                No {filter() === "ALL" ? "" : filter()} findings
              </div>
            }
          >
            <For each={filtered()}>
              {(finding) => (
                <FindingCard
                  finding={finding}
                  selected={selectedId() === finding.id}
                  expanded={expandedId() === finding.id}
                  onClick={() => setSelectedId(prev => prev === finding.id ? null : finding.id)}
                  onExpand={(e) => toggleExpand(finding.id, e)}
                />
              )}
            </For>
          </Show>
        </Show>
      </div>

      {/* Selected finding detail footer */}
      <Show when={allFindings().find(f => f.id === (selectedId() ?? ""))}>
        {(finding) => (
          <div
            style={{
              "border-top": "1px solid rgba(255,255,255,0.06)",
              "padding": "10px 20px",
              "flex-shrink": "0",
              "display": "flex",
              "align-items": "center",
              "gap": "8px",
              "background": "#0A0C10",
            }}
          >
            <span style={{ "color": "rgba(255,255,255,0.22)", "font-size": "11px", "flex": "1" }}>
              Selected: <span style={{ "color": "#D1D9E3", "font-family": "JetBrains Mono, monospace" }}>{finding().type}</span>
            </span>
            <button
              type="button"
              onClick={() => setSelectedId(null)}
              style={{
                "background": "transparent",
                "border": "1px solid rgba(255,255,255,0.12)",
                "border-radius": "4px",
                "padding": "3px 10px",
                "color": "rgba(255,255,255,0.4)",
                "font-size": "11px",
                "cursor": "pointer",
              }}
            >
              Clear
            </button>
          </div>
        )}
      </Show>
    </div>
  )
}
