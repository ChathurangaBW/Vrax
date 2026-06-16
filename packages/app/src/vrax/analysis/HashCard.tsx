import { createSignal, Show } from "solid-js"
import type { BinaryInfo } from "@/vrax/data"

function HashRow(props: { label: string; value: string }) {
  const [copied, setCopied] = createSignal(false)

  function copy() {
    void navigator.clipboard.writeText(props.value).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <div style={{ "margin-bottom": "14px" }}>
      <div style={{ "font-size": "10px", "color": "#4A5668", "letter-spacing": "0.06em", "margin-bottom": "4px" }}>
        {props.label}
      </div>
      <div style={{ "display": "flex", "align-items": "center", "gap": "8px" }}>
        <span
          style={{
            "font-family": "JetBrains Mono, monospace",
            "font-size": "11px",
            "color": "#D1D9E3",
            "word-break": "break-all",
            "flex": "1",
            "line-height": "1.5",
          }}
        >
          {props.value}
        </span>
        <button
          type="button"
          onClick={copy}
          style={{
            "background": "transparent",
            "border": "1px solid #1E2A3A",
            "border-radius": "4px",
            "color": copied() ? "#22C55E" : "#4A5668",
            "font-size": "10px",
            "padding": "2px 6px",
            "cursor": "pointer",
            "flex-shrink": "0",
            "white-space": "nowrap",
          }}
        >
          {copied() ? "✓" : "copy"}
        </button>
      </div>
    </div>
  )
}

export function HashCard(props: { info: BinaryInfo }) {
  return (
    <div
      style={{
        "background": "#172030",
        "border": "1px solid #1E2A3A",
        "border-radius": "8px",
        "padding": "16px",
        "flex": "1",
        "min-width": "0",
      }}
    >
      <div style={{ "font-size": "10px", "font-weight": "600", "color": "#4A5668", "letter-spacing": "0.08em", "text-transform": "uppercase", "margin-bottom": "12px" }}>
        HASHES
      </div>

      <Show when={props.info.md5}>
        <HashRow label="MD5" value={props.info.md5} />
      </Show>
      <Show when={props.info.sha256}>
        <HashRow label="SHA256" value={props.info.sha256} />
      </Show>
    </div>
  )
}
