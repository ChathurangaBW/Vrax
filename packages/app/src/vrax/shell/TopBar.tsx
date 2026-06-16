import { For, Show } from "solid-js"
import { useTarget } from "@/vrax/data"
import { useCampaigns } from "@/vrax/data"
import { useVrax, type NavItem } from "@/vrax/context/vrax"

interface TopNavItem {
  label: string
  nav?: NavItem
  action?: () => void
}

const SEV_CHIP_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  CRITICAL: { bg: "rgba(239,68,68,0.12)",  text: "#EF4444", border: "rgba(239,68,68,0.3)" },
  HIGH:     { bg: "rgba(249,115,22,0.12)", text: "#F97316", border: "rgba(249,115,22,0.3)" },
  MEDIUM:   { bg: "rgba(245,158,11,0.12)", text: "#F59E0B", border: "rgba(245,158,11,0.3)" },
  LOW:      { bg: "rgba(59,130,246,0.12)", text: "#3B82F6", border: "rgba(59,130,246,0.3)" },
}

export function TopBar() {
  const target = useTarget()
  const campaigns = useCampaigns()
  const vrax = useVrax()

  const navItems = (): TopNavItem[] => [
    { label: "New Project",  nav: "targets" },
    { label: "Settings",     action: () => {} },
    { label: "TTP Library",  action: () => {} },
    { label: "Toolbox",      action: () => {} },
    { label: "MCP Hub",      nav: "mcp-hub" },
    { label: "User Guide",   action: () => {} },
  ]

  const severityCounts = () => {
    const findings = campaigns.store.blackboard?.findings ?? []
    const counts: Record<string, number> = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 }
    for (const f of findings) {
      if (f.severity in counts) counts[f.severity]++
    }
    return counts
  }

  const phaseLabel = () => {
    const council = campaigns.store.council
    if (!council) return null
    const passed = council.phases.filter(p => p.status === "passed").length
    const total = council.phases.length
    return `${council.mode.toUpperCase()} · ${passed}/${total}`
  }

  const phaseRunning = () =>
    !!campaigns.store.council?.phases.find(p => p.status === "running")

  function handleNavItem(item: TopNavItem) {
    if (item.nav) vrax.setNav(item.nav)
    else if (item.action) item.action()
  }

  const hasTarget = () => !!(target.store.info || campaigns.store.root)

  return (
    <div style={{ "flex-shrink": "0" }}>
      {/* Row 1: Nav bar */}
      <div
        style={{
          "background": "#0A0C10",
          "border-bottom": "1px solid rgba(255,255,255,0.06)",
          "display": "flex",
          "align-items": "center",
          "padding": "0 14px",
          "height": "44px",
          "user-select": "none",
          "gap": "0",
        }}
      >
        {/* Brand */}
        <div
          style={{
            "display": "flex",
            "align-items": "center",
            "gap": "6px",
            "padding-right": "16px",
            "border-right": "1px solid rgba(255,255,255,0.07)",
            "margin-right": "8px",
            "flex-shrink": "0",
          }}
        >
          <span style={{ "color": "#4F7CFF", "font-size": "14px", "line-height": "1" }}>▲</span>
          <span
            style={{
              "color": "#D1D9E3",
              "font-weight": "700",
              "font-size": "13px",
              "letter-spacing": "0.08em",
            }}
          >
            VRAX
          </span>
        </div>

        {/* Nav menu items */}
        <div
          style={{
            "display": "flex",
            "align-items": "center",
            "gap": "2px",
            "flex": "1",
          }}
        >
          <For each={navItems()}>
            {(item) => {
              const active = () => item.nav ? vrax.store.nav === item.nav : false
              return (
                <button
                  type="button"
                  onClick={() => handleNavItem(item)}
                  style={{
                    "background": active() ? "rgba(79,124,255,0.12)" : "transparent",
                    "border": "none",
                    "border-radius": "5px",
                    "padding": "5px 10px",
                    "color": active() ? "#4F7CFF" : "rgba(255,255,255,0.42)",
                    "font-size": "12px",
                    "font-weight": active() ? "600" : "400",
                    "cursor": "pointer",
                    "transition": "background 120ms ease, color 120ms ease",
                    "white-space": "nowrap",
                    "letter-spacing": "0.01em",
                  }}
                  onMouseEnter={(e) => {
                    if (!active()) {
                      e.currentTarget.style.background = "rgba(255,255,255,0.05)"
                      e.currentTarget.style.color = "rgba(255,255,255,0.75)"
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!active()) {
                      e.currentTarget.style.background = "transparent"
                      e.currentTarget.style.color = "rgba(255,255,255,0.42)"
                    }
                  }}
                >
                  {item.label}
                </button>
              )
            }}
          </For>
        </div>

        {/* Phase indicator */}
        <Show when={phaseLabel()}>
          <div
            style={{
              "display": "flex",
              "align-items": "center",
              "gap": "6px",
              "padding": "0 12px",
              "border-right": "1px solid rgba(255,255,255,0.06)",
              "margin-right": "10px",
              "flex-shrink": "0",
            }}
          >
            <Show when={phaseRunning()}>
              <span
                style={{
                  "width": "6px",
                  "height": "6px",
                  "border-radius": "50%",
                  "background": "#22C55E",
                  "animation": "vrax-pulse-kf 1.6s ease-in-out infinite",
                  "flex-shrink": "0",
                }}
              />
            </Show>
            <span
              style={{
                "color": "rgba(255,255,255,0.38)",
                "font-size": "11px",
                "font-family": "JetBrains Mono, monospace",
                "letter-spacing": "0.04em",
              }}
            >
              {phaseLabel()}
            </span>
          </div>
        </Show>

        {/* Export Report button */}
        <button
          type="button"
          onClick={() => vrax.setNav("reports")}
          style={{
            "background": "rgba(79,124,255,0.15)",
            "border": "1px solid rgba(79,124,255,0.35)",
            "border-radius": "5px",
            "padding": "5px 13px",
            "color": "#4F7CFF",
            "font-size": "12px",
            "font-weight": "600",
            "cursor": "pointer",
            "transition": "background 120ms ease, border-color 120ms ease",
            "flex-shrink": "0",
            "letter-spacing": "0.02em",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(79,124,255,0.25)"
            e.currentTarget.style.borderColor = "rgba(79,124,255,0.55)"
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "rgba(79,124,255,0.15)"
            e.currentTarget.style.borderColor = "rgba(79,124,255,0.35)"
          }}
        >
          Export Report
        </button>
      </div>

      {/* Row 2: Target / campaign bar */}
      <div
        style={{
          "background": "#080A0E",
          "border-bottom": "1px solid rgba(255,255,255,0.05)",
          "display": "flex",
          "align-items": "center",
          "padding": "0 14px",
          "height": "32px",
          "gap": "8px",
          "user-select": "none",
          "overflow": "hidden",
        }}
      >
        <Show
          when={hasTarget()}
          fallback={
            <span style={{ "color": "rgba(255,255,255,0.16)", "font-size": "11px" }}>
              No target loaded — go to Targets to open a binary
            </span>
          }
        >
          <Show
            when={target.store.info}
            fallback={
              <Show when={campaigns.store.root}>
                {(root) => {
                  const parts = root().replace(/\\/g, "/").split("/")
                  const folder = parts[parts.length - 1] || root()
                  return (
                    <>
                      <span
                        style={{
                          "background": "rgba(34,197,94,0.10)",
                          "color": "#22C55E",
                          "border": "1px solid rgba(34,197,94,0.25)",
                          "font-size": "9px",
                          "font-weight": "700",
                          "letter-spacing": "0.07em",
                          "padding": "1px 5px",
                          "border-radius": "3px",
                          "flex-shrink": "0",
                        }}
                      >
                        CAMPAIGN
                      </span>
                      <span
                        style={{
                          "color": "rgba(255,255,255,0.45)",
                          "font-family": "JetBrains Mono, monospace",
                          "font-size": "11px",
                          "overflow": "hidden",
                          "text-overflow": "ellipsis",
                          "white-space": "nowrap",
                        }}
                      >
                        {folder}
                      </span>
                    </>
                  )
                }}
              </Show>
            }
          >
            {(info) => (
              <>
                {/* Binary name */}
                <span
                  style={{
                    "color": "#D1D9E3",
                    "font-weight": "600",
                    "font-size": "12px",
                    "white-space": "nowrap",
                    "overflow": "hidden",
                    "text-overflow": "ellipsis",
                    "max-width": "220px",
                    "flex-shrink": "0",
                  }}
                >
                  {info().name}
                </span>

                {/* Metadata pills */}
                <span style={{ "color": "rgba(255,255,255,0.15)", "font-size": "10px", "flex-shrink": "0" }}>·</span>
                <span
                  style={{
                    "color": "rgba(255,255,255,0.32)",
                    "font-family": "JetBrains Mono, monospace",
                    "font-size": "10px",
                    "flex-shrink": "0",
                  }}
                >
                  {info().format}
                </span>
                <span style={{ "color": "rgba(255,255,255,0.15)", "font-size": "10px", "flex-shrink": "0" }}>·</span>
                <span
                  style={{
                    "color": "rgba(255,255,255,0.32)",
                    "font-family": "JetBrains Mono, monospace",
                    "font-size": "10px",
                    "flex-shrink": "0",
                  }}
                >
                  {info().architecture}
                </span>
                <span style={{ "color": "rgba(255,255,255,0.15)", "font-size": "10px", "flex-shrink": "0" }}>·</span>
                <span
                  style={{
                    "color": "rgba(255,255,255,0.32)",
                    "font-family": "JetBrains Mono, monospace",
                    "font-size": "10px",
                    "flex-shrink": "0",
                  }}
                >
                  {info().sizeFormatted}
                </span>
                <Show when={info().sha256}>
                  <span style={{ "color": "rgba(255,255,255,0.15)", "font-size": "10px", "flex-shrink": "0" }}>·</span>
                  <span
                    style={{
                      "color": "rgba(255,255,255,0.18)",
                      "font-family": "JetBrains Mono, monospace",
                      "font-size": "10px",
                      "flex-shrink": "0",
                    }}
                  >
                    {info().sha256.slice(0, 12)}…
                  </span>
                </Show>

                {/* Severity chips from blackboard */}
                <div style={{ "flex": "1" }} />
                <For each={Object.entries(SEV_CHIP_COLORS)}>
                  {([sev, style]) => {
                    const count = () => severityCounts()[sev] ?? 0
                    return (
                      <Show when={count() > 0}>
                        <span
                          style={{
                            "background": style.bg,
                            "border": `1px solid ${style.border}`,
                            "border-radius": "4px",
                            "padding": "1px 6px",
                            "font-size": "10px",
                            "font-weight": "700",
                            "color": style.text,
                            "letter-spacing": "0.03em",
                            "flex-shrink": "0",
                            "font-family": "JetBrains Mono, monospace",
                          }}
                        >
                          {count()} {sev.slice(0, 4)}
                        </span>
                      </Show>
                    )
                  }}
                </For>
              </>
            )}
          </Show>
        </Show>
      </div>
    </div>
  )
}
