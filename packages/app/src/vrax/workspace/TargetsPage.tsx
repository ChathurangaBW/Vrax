import { createEffect } from "solid-js"
import { BinaryPicker } from "./BinaryPicker"
import { CampaignBrowser } from "./CampaignBrowser"
import { useTarget } from "@/vrax/data"
import { useVrax } from "@/vrax/context/vrax"

export function TargetsPage() {
  const target = useTarget()
  const vrax = useVrax()

  // Auto-navigate to overview once a target is set
  createEffect(() => {
    if (target.store.info) {
      vrax.setNav("overview")
    }
  })

  return (
    <div
      style={{
        "padding": "32px",
        "display": "flex",
        "gap": "32px",
        "align-items": "flex-start",
        "height": "100%",
        "box-sizing": "border-box",
        "overflow-y": "auto",
      }}
    >
      {/* Left: binary picker */}
      <div style={{ "flex": "1", "display": "flex", "justify-content": "center", "padding-top": "40px" }}>
        <BinaryPicker />
      </div>

      {/* Divider */}
      <div style={{ "width": "1px", "background": "#1E2A3A", "align-self": "stretch", "flex-shrink": "0" }} />

      {/* Right: campaign workspace browser */}
      <div style={{ "flex": "1", "padding-top": "40px" }}>
        <CampaignBrowser />
      </div>
    </div>
  )
}
