import { createSignal, For, Show } from "solid-js"
import { useTarget } from "@/vrax/data"
import type { ImportEntry } from "@/vrax/data"

function ImportRow(props: { entry: ImportEntry }) {
  const [expanded, setExpanded] = createSignal(false)

  return (
    <div
      style={{
        "background": "#172030",
        "border": "1px solid #1E2A3A",
        "border-radius": "6px",
        "margin-bottom": "6px",
        "overflow": "hidden",
      }}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        style={{
          "display": "flex",
          "align-items": "center",
          "justify-content": "space-between",
          "width": "100%",
          "padding": "10px 14px",
          "background": "transparent",
          "border": "none",
          "cursor": "pointer",
          "text-align": "left",
        }}
      >
        <span style={{ "font-family": "JetBrains Mono, monospace", "font-size": "13px", "color": "#4F7CFF", "font-weight": "600" }}>
          {props.entry.dll}
        </span>
        <span style={{ "font-size": "11px", "color": "#4A5668" }}>
          {props.entry.functions.length} function{props.entry.functions.length !== 1 ? "s" : ""} {expanded() ? "▲" : "▼"}
        </span>
      </button>

      <Show when={expanded()}>
        <div style={{ "border-top": "1px solid #1E2A3A", "padding": "8px 14px" }}>
          <div style={{ "display": "flex", "flex-wrap": "wrap", "gap": "4px" }}>
            <For each={props.entry.functions}>
              {(fn) => (
                <span style={{ "background": "#0D1117", "border": "1px solid #1E2A3A", "border-radius": "4px", "padding": "2px 8px", "font-family": "JetBrains Mono, monospace", "font-size": "11px", "color": "#D1D9E3" }}>
                  {fn}
                </span>
              )}
            </For>
          </div>
        </div>
      </Show>
    </div>
  )
}

export function ImportsPage() {
  const target = useTarget()
  const imports = () => target.store.info?.imports ?? []
  const totalFunctions = () => imports().reduce((n, e) => n + e.functions.length, 0)

  return (
    <div style={{ "padding": "24px", "overflow-y": "auto", "height": "100%", "box-sizing": "border-box" }}>
      <div style={{ "font-size": "16px", "font-weight": "700", "color": "#D1D9E3", "margin-bottom": "6px" }}>
        Imports
      </div>

      <Show when={imports().length > 0}>
        <div style={{ "font-size": "12px", "color": "#8892A0", "margin-bottom": "20px" }}>
          {imports().length} DLL{imports().length !== 1 ? "s" : ""} · {totalFunctions()} functions
        </div>

        <For each={imports()}>
          {(entry) => <ImportRow entry={entry} />}
        </For>
      </Show>

      <Show when={imports().length === 0}>
        <div
          style={{
            "background": "#172030",
            "border": "1px dashed #1E2A3A",
            "border-radius": "8px",
            "padding": "32px",
            "text-align": "center",
            "color": "#4A5668",
            "margin-top": "16px",
          }}
        >
          <div style={{ "font-size": "13px", "margin-bottom": "8px" }}>Import table not yet parsed</div>
          <div style={{ "font-size": "11px", "line-height": "1.6" }}>
            The PE import directory parser is pending implementation (Phase 7).
            <br />
            Use IDA Pro via the Operator Console to query imports.
          </div>
        </div>
      </Show>
    </div>
  )
}
