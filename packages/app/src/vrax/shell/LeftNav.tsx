import { For, Show } from "solid-js"
import { useVrax, type NavItem } from "@/vrax/context/vrax"
import { useMcpStatus, type McpServerStatus } from "@/vrax/hooks/useMcpStatus"

interface NavSection {
  label: string
  items: { id: NavItem; icon: string; label: string }[]
}

const NAV_SECTIONS: NavSection[] = [
  {
    label: "Workspace",
    items: [
      { id: "targets",   icon: "◎", label: "Targets" },
      { id: "campaigns", icon: "▦", label: "Campaigns" },
    ],
  },
  {
    label: "Analysis",
    items: [
      { id: "overview",  icon: "◈", label: "Overview" },
      { id: "sections",  icon: "≡", label: "Sections" },
      { id: "imports",   icon: "↓", label: "Imports" },
      { id: "exports",   icon: "↑", label: "Exports" },
    ],
  },
  {
    label: "Execution",
    items: [
      { id: "pipeline", icon: "⋯", label: "Pipeline" },
      { id: "swarm",    icon: "⬡", label: "Swarm" },
    ],
  },
  {
    label: "Intel",
    items: [
      { id: "evidence",   icon: "◉", label: "Evidence" },
      { id: "blackboard", icon: "▪", label: "Blackboard" },
    ],
  },
  {
    label: "Outputs",
    items: [
      { id: "reports", icon: "▤", label: "Reports" },
    ],
  },
]

const PRIORITY_COLORS: Record<string, string> = {
  PRI: "#EF4444",
  SEC: "#F97316",
  WEB: "#3B82F6",
}

function AvailabilityDot(props: { status: McpServerStatus["availability"] }) {
  const color = () => {
    if (props.status === "online") return "#22C55E"
    if (props.status === "offline") return "#EF4444"
    return "#F59E0B"
  }
  const pulse = () => props.status !== "offline"

  return (
    <span
      style={{
        "display": "inline-block",
        "width": "6px",
        "height": "6px",
        "border-radius": "50%",
        "background": color(),
        "flex-shrink": "0",
        "animation": pulse() ? "vrax-pulse-kf 1.6s ease-in-out infinite" : "none",
        "transition": "background 300ms",
      }}
    />
  )
}

function McpToggle(props: { enabled: boolean; onToggle: () => void }) {
  return (
    <div
      role="switch"
      aria-checked={props.enabled}
      onClick={(e) => { e.stopPropagation(); props.onToggle() }}
      style={{
        "width": "26px",
        "height": "14px",
        "border-radius": "7px",
        "background": props.enabled ? "#4F7CFF" : "rgba(255,255,255,0.12)",
        "position": "relative",
        "cursor": "pointer",
        "transition": "background 200ms ease",
        "flex-shrink": "0",
      }}
    >
      <div
        style={{
          "position": "absolute",
          "top": "2px",
          "left": props.enabled ? "14px" : "2px",
          "width": "10px",
          "height": "10px",
          "border-radius": "50%",
          "background": "#ffffff",
          "transition": "left 200ms ease",
          "box-shadow": "0 1px 3px rgba(0,0,0,0.4)",
        }}
      />
    </div>
  )
}

function McpPanel() {
  const { servers, toggle, onlineCount } = useMcpStatus()

  return (
    <div
      style={{
        "border-top": "1px solid rgba(255,255,255,0.06)",
        "padding": "10px 0 8px",
        "flex-shrink": "0",
        "background": "#0A0C10",
      }}
    >
      {/* Panel header */}
      <div
        style={{
          "display": "flex",
          "align-items": "center",
          "justify-content": "space-between",
          "padding": "0 14px 7px",
        }}
      >
        <span
          style={{
            "font-size": "10px",
            "font-weight": "500",
            "letter-spacing": "0.06em",
            "color": "rgba(255,255,255,0.22)",
            "text-transform": "uppercase",
          }}
        >
          MCP Servers
        </span>
        <span
          style={{
            "font-size": "9px",
            "font-family": "JetBrains Mono, monospace",
            "color": onlineCount() > 0 ? "rgba(34,197,94,0.7)" : "rgba(255,255,255,0.18)",
            "transition": "color 300ms",
          }}
        >
          {onlineCount()}/{servers().length}
        </span>
      </div>

      {/* Server rows */}
      <For each={servers()}>
        {(s) => (
          <div
            style={{
              "display": "flex",
              "align-items": "center",
              "gap": "6px",
              "padding": "4px 14px",
              "transition": "background 100ms",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <AvailabilityDot status={s.availability} />

            <span
              style={{
                "flex": "1",
                "font-size": "11px",
                "color": s.enabled ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.22)",
                "font-family": "JetBrains Mono, monospace",
                "overflow": "hidden",
                "text-overflow": "ellipsis",
                "white-space": "nowrap",
                "min-width": "0",
                "transition": "color 200ms",
              }}
            >
              {s.label}
            </span>

            <span
              style={{
                "font-size": "8px",
                "font-weight": "700",
                "color": PRIORITY_COLORS[s.priority] ?? "#6B7A8E",
                "background": `${PRIORITY_COLORS[s.priority] ?? "#6B7A8E"}18`,
                "border-radius": "3px",
                "padding": "1px 4px",
                "letter-spacing": "0.04em",
                "flex-shrink": "0",
              }}
            >
              {s.priority}
            </span>

            <span
              style={{
                "font-size": "9px",
                "color": "rgba(255,255,255,0.2)",
                "font-family": "JetBrains Mono, monospace",
                "flex-shrink": "0",
              }}
            >
              {s.tools}
            </span>

            <McpToggle enabled={s.enabled} onToggle={() => toggle(s.key)} />
          </div>
        )}
      </For>
    </div>
  )
}

export function LeftNav() {
  const vrax = useVrax()

  return (
    <nav
      style={{
        "background": "#0A0C10",
        "border-right": "1px solid rgba(255,255,255,0.06)",
        "display": "flex",
        "flex-direction": "column",
        "overflow": "hidden",
        "flex-shrink": "0",
        "height": "100%",
        "box-sizing": "border-box",
      }}
    >
      {/* Scrollable nav sections */}
      <div
        style={{
          "flex": "1",
          "overflow-y": "auto",
          "overflow-x": "hidden",
          "padding": "12px 0 0",
          "min-height": "0",
          "scrollbar-width": "none",
        }}
      >
        <For each={NAV_SECTIONS}>
          {(section, si) => (
            <div style={{ "margin-top": si() === 0 ? "0" : "4px" }}>
              <div
                style={{
                  "padding": "10px 14px 3px",
                  "font-size": "10px",
                  "font-weight": "500",
                  "letter-spacing": "0.06em",
                  "color": "rgba(255,255,255,0.22)",
                  "text-transform": "uppercase",
                  "user-select": "none",
                }}
              >
                {section.label}
              </div>

              <For each={section.items}>
                {(item) => {
                  const active = () => vrax.store.nav === item.id
                  return (
                    <button
                      type="button"
                      onClick={() => vrax.setNav(item.id)}
                      style={{
                        "display": "flex",
                        "align-items": "center",
                        "gap": "7px",
                        "width": "100%",
                        "height": "28px",
                        "padding": "0 14px",
                        "background": active() ? "rgba(79,124,255,0.10)" : "transparent",
                        "border": "none",
                        "border-left": active() ? "2px solid #4F7CFF" : "2px solid transparent",
                        "cursor": "pointer",
                        "text-align": "left",
                        "color": active() ? "#D1D9E3" : "rgba(255,255,255,0.40)",
                        "font-size": "13px",
                        "font-weight": active() ? "500" : "400",
                        "transition": "background 120ms ease, color 120ms ease, border-color 120ms ease",
                        "box-sizing": "border-box",
                      }}
                      onMouseEnter={(e) => {
                        if (!active()) {
                          e.currentTarget.style.background = "rgba(255,255,255,0.04)"
                          e.currentTarget.style.color = "rgba(255,255,255,0.65)"
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!active()) {
                          e.currentTarget.style.background = "transparent"
                          e.currentTarget.style.color = "rgba(255,255,255,0.40)"
                        }
                      }}
                    >
                      <span
                        style={{
                          "font-size": "11px",
                          "width": "14px",
                          "text-align": "center",
                          "flex-shrink": "0",
                          "color": active() ? "#4F7CFF" : "rgba(255,255,255,0.28)",
                          "font-family": "system-ui",
                          "line-height": "1",
                        }}
                      >
                        {item.icon}
                      </span>
                      {item.label}
                    </button>
                  )
                }}
              </For>
            </div>
          )}
        </For>
      </div>

      {/* MCP status panel — pinned to bottom */}
      <McpPanel />
    </nav>
  )
}
