import { Show } from "solid-js"
import type { BinaryInfo } from "@/vrax/data"

const ROW_STYLE = {
  "display": "flex",
  "align-items": "baseline",
  "gap": "8px",
  "padding": "4px 0",
  "border-bottom": "1px solid #1E2A3A",
}

const LABEL_STYLE = {
  "color": "#4A5668",
  "font-size": "11px",
  "min-width": "90px",
  "flex-shrink": "0",
}

const VALUE_STYLE = {
  "color": "#D1D9E3",
  "font-size": "13px",
}

const MONO_VALUE_STYLE = {
  ...VALUE_STYLE,
  "font-family": "JetBrains Mono, monospace",
  "font-size": "12px",
}

function Row(props: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={ROW_STYLE}>
      <span style={LABEL_STYLE}>{props.label}</span>
      <span style={props.mono ? MONO_VALUE_STYLE : VALUE_STYLE}>{props.value}</span>
    </div>
  )
}

export function IdentityCard(props: { info: BinaryInfo }) {
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
        IDENTITY
      </div>

      <Row label="Name" value={props.info.name} />
      <Row label="Format" value={props.info.format} />
      <Row label="Architecture" value={props.info.architecture} />
      <Row label="Subsystem" value={props.info.subsystem} />
      <Row label="Size" value={props.info.sizeFormatted} />
      <Show when={props.info.timestampFormatted}>
        <Row label="Compiled" value={props.info.timestampFormatted!} />
      </Show>
      <Row label="Entry Point" value={props.info.entryPoint} mono />
      <Row label="ImageBase" value={props.info.imageBase} mono />

      {/* Badges */}
      <div style={{ "display": "flex", "gap": "6px", "margin-top": "12px", "flex-wrap": "wrap" }}>
        <Show when={props.info.isDLL}>
          <span style={{ "background": "rgba(79,124,255,0.15)", "border": "1px solid rgba(79,124,255,0.3)", "border-radius": "4px", "padding": "2px 8px", "font-size": "11px", "color": "#4F7CFF" }}>
            DLL
          </span>
        </Show>
        <Show when={props.info.isConsole}>
          <span style={{ "background": "rgba(139,92,246,0.15)", "border": "1px solid rgba(139,92,246,0.3)", "border-radius": "4px", "padding": "2px 8px", "font-size": "11px", "color": "#8B5CF6" }}>
            CONSOLE
          </span>
        </Show>
        <Show when={!props.info.isDLL && !props.info.isConsole}>
          <span style={{ "background": "rgba(34,197,94,0.12)", "border": "1px solid rgba(34,197,94,0.25)", "border-radius": "4px", "padding": "2px 8px", "font-size": "11px", "color": "#22C55E" }}>
            GUI EXE
          </span>
        </Show>
      </div>
    </div>
  )
}
