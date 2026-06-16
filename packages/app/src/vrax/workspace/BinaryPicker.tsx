import { Show } from "solid-js"
import { useTarget } from "@/vrax/data"

export function BinaryPicker() {
  const target = useTarget()

  async function pick() {
    await target.pickAndAnalyze()
  }

  return (
    <div
      style={{
        "background": "#172030",
        "border": "1px solid #1E2A3A",
        "border-radius": "10px",
        "padding": "32px",
        "display": "flex",
        "flex-direction": "column",
        "align-items": "center",
        "gap": "20px",
        "text-align": "center",
        "max-width": "400px",
        "width": "100%",
      }}
    >
      <div style={{ "font-size": "32px", "opacity": "0.4" }}>⬡</div>

      <div>
        <div style={{ "font-size": "14px", "font-weight": "600", "color": "#D1D9E3", "margin-bottom": "8px" }}>
          SELECT A TARGET
        </div>
        <div style={{ "font-size": "13px", "color": "#8892A0", "line-height": "1.6" }}>
          Pick any binary to begin analysis.
          <br />
          No workspace required.
        </div>
      </div>

      <Show when={target.store.error}>
        <div
          style={{
            "background": "rgba(239,68,68,0.1)",
            "border": "1px solid rgba(239,68,68,0.3)",
            "border-radius": "6px",
            "padding": "8px 12px",
            "color": "#EF4444",
            "font-size": "12px",
            "width": "100%",
            "box-sizing": "border-box",
          }}
        >
          {target.store.error}
        </div>
      </Show>

      <button
        type="button"
        onClick={pick}
        disabled={target.store.loading}
        style={{
          "background": target.store.loading ? "#2A3A50" : "#4F7CFF",
          "border": "none",
          "border-radius": "8px",
          "color": "#fff",
          "font-size": "13px",
          "font-weight": "600",
          "padding": "10px 24px",
          "cursor": target.store.loading ? "not-allowed" : "pointer",
          "width": "100%",
          "transition": "background 0.15s",
        }}
      >
        {target.store.loading ? "Analyzing…" : "+ Browse Binary…"}
      </button>
    </div>
  )
}
