import { type JSX, createEffect } from "solid-js"
import { usePlatform } from "@/context/platform"
import { VraxProvider, useVrax } from "@/vrax/context/vrax"
import { TargetProvider } from "@/vrax/data"
import { CampaignsProvider } from "@/vrax/data"
import { TopBar } from "./TopBar"
import { LeftNav } from "./LeftNav"
import { OperatorConsole } from "./OperatorConsole"
import { Titlebar, type TitlebarUpdate } from "@/components/titlebar"
import { ToastRegion } from "@/utils/toast"

// Workspace
import { TargetsPage } from "@/vrax/workspace/TargetsPage"
import { CampaignBrowser } from "@/vrax/workspace/CampaignBrowser"

// Analysis
import { OverviewPage } from "@/vrax/analysis/OverviewPage"
import { SectionsPage } from "@/vrax/analysis/SectionsPage"
import { ImportsPage } from "@/vrax/analysis/ImportsPage"
import { ExportsPage } from "@/vrax/analysis/ExportsPage"

// Execution
import { PipelinePage } from "@/vrax/execution/PipelinePage"
import { SwarmPage } from "@/vrax/execution/SwarmPage"

// Intel
import { EvidencePage } from "@/vrax/intel/EvidencePage"
import { BlackboardPage } from "@/vrax/intel/BlackboardPage"

// Outputs + System
import { ReportsPage } from "@/vrax/outputs/ReportsPage"
import { MCPHubPage } from "@/vrax/system/MCPHubPage"

function WorkspaceContent() {
  const vrax = useVrax()

  return (
    <div style={{ "flex": "1", "min-width": "0", "overflow": "hidden", "display": "flex", "flex-direction": "column", "background": "#0D1117" }}>
      {(() => {
        switch (vrax.store.nav) {
          case "targets":    return <TargetsPage />
          case "campaigns":  return <div style={{ "padding": "24px", "overflow-y": "auto", "height": "100%", "box-sizing": "border-box" }}><CampaignBrowser /></div>
          case "overview":   return <OverviewPage />
          case "sections":   return <SectionsPage />
          case "imports":    return <ImportsPage />
          case "exports":    return <ExportsPage />
          case "pipeline":   return <PipelinePage />
          case "swarm":      return <SwarmPage />
          case "evidence":   return <EvidencePage />
          case "blackboard": return <BlackboardPage />
          case "reports":    return <ReportsPage />
          case "mcp-hub":    return <MCPHubPage />
          default:           return <TargetsPage />
        }
      })()}
    </div>
  )
}

function ShellInner(props: { children?: JSX.Element }) {
  const platform = usePlatform()
  const vrax = useVrax()

  // When the operator dispatches a session, surface the Blackboard so findings
  // populate live in the middle while the conversation streams on the right.
  let switchedForSession = false
  createEffect(() => {
    if (vrax.store.activeSession) {
      if (!switchedForSession && (vrax.store.nav === "targets" || vrax.store.nav === "campaigns")) {
        vrax.setNav("blackboard")
      }
      switchedForSession = true
    } else {
      switchedForSession = false
    }
  })

  const updateVersion = () => {
    const s = platform.updater?.state()
    if (s?.status !== "ready") return undefined
    return s.version
  }

  const titlebarUpdate: TitlebarUpdate = {
    version: updateVersion,
    installing: () => platform.updater?.state().status === "installing",
    install: () => void platform.updater?.install(),
  }

  return (
    <div
      style={{
        "display": "flex",
        "flex-direction": "column",
        "height": "100%",
        "width": "100%",
        "overflow": "hidden",
        "background": "#0A0C10",
      }}
    >
      <Titlebar update={titlebarUpdate} />

      {/* Top status bar */}
      <TopBar />

      {/* Three-column workbench */}
      <div style={{ "flex": "1", "display": "flex", "min-height": "0", "overflow": "hidden" }}>
        {/* Left nav: 192px */}
        <div style={{ "width": "192px", "flex-shrink": "0" }}>
          <LeftNav />
        </div>

        {/* Main workspace: always VRAX intel views */}
        <WorkspaceContent />

        {/* Right operator console: 340px — live chat + tool/control panel.
            The session is driven directly via the SDK (create + promptAsync);
            messages stream into the store via global sync and render in the
            custom VRAX chat — no OpenCode session UI is mounted. */}
        <div style={{ "width": "340px", "flex-shrink": "0", "display": "flex", "flex-direction": "column", "height": "100%", "min-height": "0" }}>
          <OperatorConsole />
        </div>
      </div>

      <ToastRegion v2={true} />
    </div>
  )
}

export function VraxShell(props: { children?: JSX.Element }) {
  return (
    <TargetProvider>
      <CampaignsProvider>
        <VraxProvider>
          <ShellInner>{props.children}</ShellInner>
        </VraxProvider>
      </CampaignsProvider>
    </TargetProvider>
  )
}
