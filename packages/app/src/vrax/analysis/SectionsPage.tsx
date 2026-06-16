import { useTarget } from "@/vrax/data"
import { SectionsTable } from "./SectionsTable"

export function SectionsPage() {
  const target = useTarget()
  const info = () => target.store.info

  return (
    <div style={{ "padding": "24px", "overflow-y": "auto", "height": "100%", "box-sizing": "border-box" }}>
      <div style={{ "font-size": "16px", "font-weight": "700", "color": "#D1D9E3", "margin-bottom": "20px" }}>
        Sections
        <span style={{ "color": "#4A5668", "font-size": "12px", "font-weight": "400", "margin-left": "10px" }}>
          {info()?.numberOfSections ?? 0} sections
        </span>
      </div>
      <SectionsTable sections={info()?.sections ?? []} />
    </div>
  )
}
