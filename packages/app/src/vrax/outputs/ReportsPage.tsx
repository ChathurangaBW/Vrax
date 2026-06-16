import { For } from "solid-js"
import { useTarget } from "@/vrax/data"
import { useCampaigns } from "@/vrax/data"
import { useVrax } from "@/vrax/context/vrax"

interface ReportTemplate {
  id: string
  title: string
  description: string
  prompt: string
}

const TEMPLATES: ReportTemplate[] = [
  {
    id: "executive",
    title: "Executive Summary",
    description: "High-level findings, risk rating, and recommended actions.",
    prompt: "Generate an executive summary of this binary analysis. Include: overall risk rating, top 3 critical findings, and recommended immediate actions.",
  },
  {
    id: "technical",
    title: "Technical Report",
    description: "Full technical analysis with all findings, evidence chains, and IOCs.",
    prompt: "Generate a detailed technical reverse engineering report. Include: binary identity, all findings with evidence, behavioral analysis, IOCs, and MITRE ATT&CK mappings.",
  },
  {
    id: "yara",
    title: "YARA Rules",
    description: "Generate YARA detection rules from the analysis findings.",
    prompt: "Generate YARA rules based on the analysis findings. Include rules for: packing detection, C2 communication patterns, anti-debug techniques, and persistence mechanisms found.",
  },
  {
    id: "ioc",
    title: "IOC Export",
    description: "Export indicators of compromise in structured format.",
    prompt: "Extract and list all indicators of compromise (IOCs) from this analysis. Format as: IP addresses, domains, file paths, registry keys, mutexes, and hashes.",
  },
]

export function ReportsPage() {
  const target = useTarget()
  const campaigns = useCampaigns()
  const vrax = useVrax()

  const hasContext = () => !!(target.store.info || campaigns.store.root || vrax.store.activeSession)

  function dispatchReport(prompt: string) {
    // Route through the Operator Console's council dispatch (single owner).
    vrax.requestDispatch(prompt)
  }

  return (
    <div style={{ "padding": "24px", "overflow-y": "auto", "height": "100%", "box-sizing": "border-box" }}>
      <div style={{ "font-size": "16px", "font-weight": "700", "color": "#D1D9E3", "margin-bottom": "8px" }}>
        Reports
      </div>
      <div style={{ "font-size": "13px", "color": "#8892A0", "margin-bottom": "24px", "line-height": "1.6" }}>
        Generate AI-powered reports from the accumulated analysis findings.
        Each report opens a new AI session with a pre-built prompt.
      </div>

      <div style={{ "display": "grid", "grid-template-columns": "1fr 1fr", "gap": "12px" }}>
        <For each={TEMPLATES}>
          {(template) => (
            <div
              style={{
                "background": "#172030",
                "border": "1px solid #1E2A3A",
                "border-radius": "8px",
                "padding": "20px",
                "display": "flex",
                "flex-direction": "column",
                "gap": "10px",
              }}
            >
              <div style={{ "font-size": "14px", "font-weight": "700", "color": "#D1D9E3" }}>
                {template.title}
              </div>
              <div style={{ "font-size": "12px", "color": "#8892A0", "line-height": "1.5", "flex": "1" }}>
                {template.description}
              </div>
              <button
                type="button"
                disabled={!hasContext()}
                onClick={() => dispatchReport(template.prompt)}
                title={hasContext() ? "" : "Open a target or campaign first"}
                style={{
                  "background": hasContext() ? "#4F7CFF" : "rgba(255,255,255,0.06)",
                  "border": "none",
                  "border-radius": "6px",
                  "color": hasContext() ? "#fff" : "rgba(255,255,255,0.3)",
                  "font-size": "12px",
                  "font-weight": "600",
                  "padding": "8px 0",
                  "cursor": hasContext() ? "pointer" : "default",
                  "width": "100%",
                }}
              >
                Generate →
              </button>
            </div>
          )}
        </For>
      </div>
    </div>
  )
}
