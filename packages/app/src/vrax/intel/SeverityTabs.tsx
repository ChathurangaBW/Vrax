import { For } from "solid-js"
import type { FindingSeverity } from "@/vrax/data"

type Tab = FindingSeverity | "ALL"

const TABS: Tab[] = ["ALL", "CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"]

const TAB_COLORS: Record<Tab, string> = {
  ALL: "#8892A0",
  CRITICAL: "#EF4444",
  HIGH: "#F97316",
  MEDIUM: "#F59E0B",
  LOW: "#3B82F6",
  INFO: "#22C55E",
}

export function SeverityTabs(props: {
  active: Tab
  counts: Partial<Record<Tab, number>>
  onChange: (tab: Tab) => void
}) {
  return (
    <div style={{ "display": "flex", "gap": "2px", "border-bottom": "1px solid #1E2A3A", "padding": "0 0 0 0" }}>
      <For each={TABS}>
        {(tab) => {
          const isActive = () => props.active === tab
          const color = TAB_COLORS[tab]
          const count = () => props.counts[tab] ?? 0

          return (
            <button
              type="button"
              onClick={() => props.onChange(tab)}
              style={{
                "background": "transparent",
                "border": "none",
                "border-bottom": isActive() ? `2px solid ${color}` : "2px solid transparent",
                "padding": "8px 10px",
                "cursor": "pointer",
                "display": "flex",
                "align-items": "center",
                "gap": "5px",
                "font-size": "12px",
                "font-weight": isActive() ? "600" : "400",
                "color": isActive() ? color : "#4A5668",
                "white-space": "nowrap",
                "transition": "color 0.1s, border-color 0.1s",
              }}
            >
              {tab}
              {count() > 0 && (
                <span style={{
                  "background": `${color}22`,
                  "border": `1px solid ${color}44`,
                  "border-radius": "10px",
                  "padding": "0 5px",
                  "font-size": "10px",
                  "font-weight": "700",
                  "color": color,
                }}>
                  {count()}
                </span>
              )}
            </button>
          )
        }}
      </For>
    </div>
  )
}
