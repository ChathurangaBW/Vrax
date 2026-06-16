import { For, Show } from "solid-js"
import type { BinarySection } from "@/vrax/data"

const TH = {
  "padding": "6px 10px",
  "font-size": "10px",
  "font-weight": "600",
  "letter-spacing": "0.06em",
  "color": "#4A5668",
  "text-align": "left" as const,
  "white-space": "nowrap" as const,
  "border-bottom": "1px solid #1E2A3A",
}

const TD = {
  "padding": "6px 10px",
  "font-size": "12px",
  "font-family": "JetBrains Mono, monospace",
  "color": "#D1D9E3",
  "border-bottom": "1px solid #1A2332",
  "white-space": "nowrap" as const,
}

const TD_FLAGS = {
  ...TD,
  "font-family": "inherit",
  "color": "#8892A0",
  "font-size": "11px",
}

export function SectionsTable(props: { sections: BinarySection[] }) {
  return (
    <div
      style={{
        "background": "#172030",
        "border": "1px solid #1E2A3A",
        "border-radius": "8px",
        "overflow": "hidden",
      }}
    >
      <div style={{ "font-size": "10px", "font-weight": "600", "color": "#4A5668", "letter-spacing": "0.08em", "text-transform": "uppercase", "padding": "12px 14px 8px" }}>
        SECTIONS
      </div>

      <Show when={props.sections.length === 0}>
        <div style={{ "padding": "16px 14px", "color": "#4A5668", "font-size": "13px" }}>
          No sections data.
        </div>
      </Show>

      <Show when={props.sections.length > 0}>
        <div style={{ "overflow-x": "auto" }}>
          <table style={{ "width": "100%", "border-collapse": "collapse" }}>
            <thead>
              <tr style={{ "background": "#0D1117" }}>
                <th style={TH}>Name</th>
                <th style={TH}>VirtAddr</th>
                <th style={TH}>VirtSize</th>
                <th style={TH}>RawSize</th>
                <th style={TH}>Flags</th>
              </tr>
            </thead>
            <tbody>
              <For each={props.sections}>
                {(sec, i) => (
                  <tr style={{ "background": i() % 2 === 0 ? "#111722" : "#172030" }}>
                    <td style={{ ...TD, "color": "#4F7CFF", "font-weight": "600" }}>{sec.name}</td>
                    <td style={TD}>{sec.virtualAddress}</td>
                    <td style={TD}>{sec.virtualSize.toLocaleString()}</td>
                    <td style={TD}>{sec.rawSize.toLocaleString()}</td>
                    <td style={TD_FLAGS}>{sec.characteristics}</td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </div>
      </Show>
    </div>
  )
}
