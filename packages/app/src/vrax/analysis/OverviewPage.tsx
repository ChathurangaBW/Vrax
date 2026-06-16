import { createEffect } from "solid-js"
import { IdentityCard } from "./IdentityCard"
import { HashCard } from "./HashCard"
import { SectionsTable } from "./SectionsTable"
import { useTarget } from "@/vrax/data"
import { useVrax } from "@/vrax/context/vrax"

export function OverviewPage() {
  const target = useTarget()
  const vrax = useVrax()

  createEffect(() => {
    if (!target.store.info && !target.store.loading) {
      vrax.setNav("targets")
    }
  })

  const info = () => target.store.info
  if (!info()) return null

  return (
    <div
      style={{
        "padding": "24px",
        "display": "flex",
        "flex-direction": "column",
        "gap": "20px",
        "overflow-y": "auto",
        "height": "100%",
        "box-sizing": "border-box",
      }}
    >
      {/* Header */}
      <div style={{ "font-size": "18px", "font-weight": "700", "color": "#D1D9E3" }}>
        {info()!.name}
        <span style={{ "color": "#4A5668", "font-size": "13px", "font-weight": "400", "margin-left": "12px" }}>
          {info()!.format}
        </span>
      </div>

      {/* Identity + Hash side by side */}
      <div style={{ "display": "flex", "gap": "16px", "flex-wrap": "wrap" }}>
        <IdentityCard info={info()!} />
        <HashCard info={info()!} />
      </div>

      {/* Sections table */}
      <SectionsTable sections={info()!.sections} />
    </div>
  )
}
