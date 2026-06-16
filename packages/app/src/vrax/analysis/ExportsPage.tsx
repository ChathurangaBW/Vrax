import { For, Show } from "solid-js"
import { useTarget } from "@/vrax/data"

export function ExportsPage() {
  const target = useTarget()
  const exports = () => target.store.info?.exports ?? []

  return (
    <div style={{ "padding": "24px", "overflow-y": "auto", "height": "100%", "box-sizing": "border-box" }}>
      <div style={{ "font-size": "16px", "font-weight": "700", "color": "#D1D9E3", "margin-bottom": "20px" }}>
        Exports
        <span style={{ "color": "#4A5668", "font-size": "12px", "font-weight": "400", "margin-left": "10px" }}>
          {exports().length} exported symbol{exports().length !== 1 ? "s" : ""}
        </span>
      </div>

      <Show when={exports().length > 0}>
        <div style={{ "background": "#172030", "border": "1px solid #1E2A3A", "border-radius": "8px", "overflow": "hidden" }}>
          <table style={{ "width": "100%", "border-collapse": "collapse" }}>
            <thead>
              <tr style={{ "background": "#0D1117" }}>
                <th style={{ "padding": "8px 12px", "text-align": "left", "font-size": "10px", "font-weight": "600", "color": "#4A5668", "letter-spacing": "0.06em", "border-bottom": "1px solid #1E2A3A" }}>Name</th>
                <th style={{ "padding": "8px 12px", "text-align": "left", "font-size": "10px", "font-weight": "600", "color": "#4A5668", "letter-spacing": "0.06em", "border-bottom": "1px solid #1E2A3A" }}>Ordinal</th>
                <th style={{ "padding": "8px 12px", "text-align": "left", "font-size": "10px", "font-weight": "600", "color": "#4A5668", "letter-spacing": "0.06em", "border-bottom": "1px solid #1E2A3A" }}>Address</th>
              </tr>
            </thead>
            <tbody>
              <For each={exports()}>
                {(exp, i) => (
                  <tr style={{ "background": i() % 2 === 0 ? "#111722" : "#172030" }}>
                    <td style={{ "padding": "6px 12px", "font-family": "JetBrains Mono, monospace", "font-size": "12px", "color": "#4F7CFF", "border-bottom": "1px solid #1A2332" }}>
                      {exp.name}
                    </td>
                    <td style={{ "padding": "6px 12px", "font-family": "JetBrains Mono, monospace", "font-size": "12px", "color": "#D1D9E3", "border-bottom": "1px solid #1A2332" }}>
                      {exp.ordinal}
                    </td>
                    <td style={{ "padding": "6px 12px", "font-family": "JetBrains Mono, monospace", "font-size": "12px", "color": "#8892A0", "border-bottom": "1px solid #1A2332" }}>
                      {exp.address > 0 ? `0x${exp.address.toString(16).toUpperCase().padStart(8, "0")}` : "—"}
                    </td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </div>
      </Show>

      <Show when={exports().length === 0}>
        <div
          style={{
            "background": "#172030",
            "border": "1px dashed #1E2A3A",
            "border-radius": "8px",
            "padding": "32px",
            "text-align": "center",
            "color": "#4A5668",
          }}
        >
          <div style={{ "font-size": "13px", "margin-bottom": "8px" }}>No exports found</div>
          <div style={{ "font-size": "11px" }}>
            This binary has no export table, or parsing is not yet implemented.
          </div>
        </div>
      </Show>
    </div>
  )
}
