import { createMemo, createEffect, For, Show, createSignal, on } from "solid-js"
import { useServerSync } from "@/context/server-sync"
import { usePermission } from "@/context/permission"
import { useVrax } from "@/vrax/context/vrax"
import type { Message, Part, ToolPart, ToolState, PermissionRequest } from "@vrax/sdk/v2/client"

// ── Tool call card ─────────────────────────────────────────────────────────
function ToolCard(props: { part: ToolPart }) {
  const [open, setOpen] = createSignal(false)
  const state = (): ToolState => props.part.state
  const status = () => state().status

  const meta = () => {
    const s = status()
    if (s === "completed") return { color: "#4F7CFF", glyph: "✓", label: "" }
    if (s === "running") return { color: "#22C55E", glyph: "◉", label: "running…" }
    if (s === "error") return { color: "#EF4444", glyph: "✕", label: "error" }
    return { color: "rgba(255,255,255,0.3)", glyph: "○", label: "pending" }
  }

  const input = () => {
    const st = state()
    const inp = (st as { input?: Record<string, unknown> }).input
    if (!inp || Object.keys(inp).length === 0) return null
    try { return JSON.stringify(inp, null, 2) } catch { return String(inp) }
  }
  const output = () => {
    const st = state()
    if (st.status === "completed") return st.output
    if (st.status === "error") return st.error
    return null
  }
  const hasBody = () => !!(input() || output())

  return (
    <div
      style={{
        "background": "#172030",
        "border": status() === "running" ? "1px solid rgba(34,197,94,0.25)" : "1px solid rgba(255,255,255,0.07)",
        "border-radius": "6px",
        "overflow": "hidden",
      }}
    >
      <div
        onClick={() => hasBody() && setOpen(o => !o)}
        style={{
          "display": "flex",
          "align-items": "center",
          "gap": "7px",
          "padding": "6px 9px",
          "cursor": hasBody() ? "pointer" : "default",
        }}
      >
        <span
          style={{
            "color": meta().color,
            "font-size": "10px",
            "flex-shrink": "0",
            "animation": status() === "running" ? "vrax-pulse-kf 1.4s ease-in-out infinite" : "none",
          }}
        >
          {meta().glyph}
        </span>
        <span
          style={{
            "flex": "1",
            "min-width": "0",
            "color": "#D1D9E3",
            "font-family": "JetBrains Mono, monospace",
            "font-size": "10px",
            "overflow": "hidden",
            "text-overflow": "ellipsis",
            "white-space": "nowrap",
          }}
        >
          {props.part.tool}
        </span>
        <Show when={meta().label}>
          <span style={{ "font-size": "9px", "color": meta().color, "font-family": "JetBrains Mono, monospace", "flex-shrink": "0" }}>
            {meta().label}
          </span>
        </Show>
        <Show when={hasBody()}>
          <span style={{ "font-size": "9px", "color": "rgba(255,255,255,0.28)", "transform": open() ? "rotate(90deg)" : "none", "transition": "transform 150ms", "flex-shrink": "0" }}>▶</span>
        </Show>
      </div>
      <Show when={open() && hasBody()}>
        <div style={{ "border-top": "1px solid rgba(255,255,255,0.05)", "background": "#070A0D", "padding": "8px 10px", "max-height": "260px", "overflow": "auto" }}>
          <Show when={input()}>
            <div style={{ "font-size": "8px", "color": "rgba(255,255,255,0.25)", "text-transform": "uppercase", "letter-spacing": "0.06em", "margin-bottom": "3px" }}>Input</div>
            <pre style={{ "margin": "0 0 8px", "font-family": "JetBrains Mono, monospace", "font-size": "10px", "color": "#8892A0", "white-space": "pre-wrap", "word-break": "break-word" }}>{input()}</pre>
          </Show>
          <Show when={output()}>
            <div style={{ "font-size": "8px", "color": "rgba(255,255,255,0.25)", "text-transform": "uppercase", "letter-spacing": "0.06em", "margin-bottom": "3px" }}>Output</div>
            <pre style={{ "margin": "0", "font-family": "JetBrains Mono, monospace", "font-size": "10px", "color": status() === "error" ? "#EF4444" : "#A8B3C0", "white-space": "pre-wrap", "word-break": "break-word" }}>{output()}</pre>
          </Show>
        </div>
      </Show>
    </div>
  )
}

// ── Reasoning (collapsed dim) ──────────────────────────────────────────────
function ReasoningBlock(props: { text: string }) {
  const [open, setOpen] = createSignal(false)
  return (
    <div style={{ "border-left": "2px solid rgba(255,255,255,0.08)", "padding-left": "8px" }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{ "background": "transparent", "border": "none", "padding": "0", "color": "rgba(255,255,255,0.3)", "font-size": "10px", "cursor": "pointer", "display": "flex", "align-items": "center", "gap": "4px", "font-style": "italic" }}
      >
        <span style={{ "transform": open() ? "rotate(90deg)" : "none", "transition": "transform 150ms", "font-size": "8px" }}>▶</span>
        reasoning
      </button>
      <Show when={open()}>
        <div style={{ "font-size": "10px", "color": "rgba(255,255,255,0.4)", "line-height": "1.6", "white-space": "pre-wrap", "margin-top": "4px", "font-style": "italic" }}>
          {props.text}
        </div>
      </Show>
    </div>
  )
}

// ── One message ────────────────────────────────────────────────────────────
function MessageRow(props: { message: Message; parts: Part[] }) {
  const isUser = () => props.message.role === "user"

  const userText = () =>
    props.parts
      .filter((p): p is Extract<Part, { type: "text" }> => p.type === "text")
      .map(p => p.text)
      .join("")
      .trim()

  return (
    <Show
      when={!isUser()}
      fallback={
        <Show when={userText()}>
          <div style={{ "display": "flex", "justify-content": "flex-end" }}>
            <div
              style={{
                "max-width": "85%",
                "background": "rgba(79,124,255,0.14)",
                "border": "1px solid rgba(79,124,255,0.28)",
                "border-radius": "8px 8px 2px 8px",
                "padding": "7px 10px",
                "color": "#D1D9E3",
                "font-size": "11.5px",
                "line-height": "1.5",
                "white-space": "pre-wrap",
                "word-break": "break-word",
              }}
            >
              {userText()}
            </div>
          </div>
        </Show>
      }
    >
      <div style={{ "display": "flex", "flex-direction": "column", "gap": "5px" }}>
        <For each={props.parts}>
          {(part) => {
            switch (part.type) {
              case "text":
                return part.text.trim() ? (
                  <div style={{ "color": "#C2CBD6", "font-size": "11.5px", "line-height": "1.6", "white-space": "pre-wrap", "word-break": "break-word" }}>
                    {part.text}
                  </div>
                ) : null
              case "reasoning":
                return part.text.trim() ? <ReasoningBlock text={part.text} /> : null
              case "tool":
                return <ToolCard part={part as ToolPart} />
              default:
                return null
            }
          }}
        </For>
      </div>
    </Show>
  )
}

// ── Permission request prompt ──────────────────────────────────────────────
function PermissionPrompt(props: { request: PermissionRequest; dir: string }) {
  const permission = usePermission()
  const [responding, setResponding] = createSignal(false)

  function decide(response: "once" | "always" | "reject") {
    setResponding(true)
    permission.respond({
      sessionID: props.request.sessionID,
      permissionID: props.request.id,
      response,
      directory: props.dir,
    })
  }

  return (
    <div
      style={{
        "background": "rgba(245,158,11,0.06)",
        "border": "1px solid rgba(245,158,11,0.3)",
        "border-radius": "8px",
        "padding": "10px 12px",
        "display": "flex",
        "flex-direction": "column",
        "gap": "8px",
      }}
    >
      <div style={{ "display": "flex", "align-items": "center", "gap": "6px" }}>
        <span style={{ "color": "#F59E0B", "font-size": "12px" }}>⚠</span>
        <span style={{ "color": "#F59E0B", "font-size": "11px", "font-weight": "600", "letter-spacing": "0.02em" }}>
          Permission required
        </span>
      </div>
      <div style={{ "color": "#D1D9E3", "font-size": "11.5px", "font-family": "JetBrains Mono, monospace", "word-break": "break-word" }}>
        {props.request.permission}
      </div>
      <Show when={props.request.patterns.length > 0}>
        <div style={{ "display": "flex", "flex-direction": "column", "gap": "2px" }}>
          <For each={props.request.patterns}>
            {(p) => (
              <code style={{ "font-size": "10px", "color": "rgba(255,255,255,0.45)", "font-family": "JetBrains Mono, monospace", "word-break": "break-all" }}>
                {p}
              </code>
            )}
          </For>
        </div>
      </Show>
      <div style={{ "display": "flex", "gap": "6px", "flex-wrap": "wrap" }}>
        <button
          type="button"
          disabled={responding()}
          onClick={() => decide("once")}
          style={{ "flex": "1", "min-width": "70px", "background": "#4F7CFF", "border": "none", "border-radius": "5px", "padding": "5px 8px", "color": "#fff", "font-size": "11px", "font-weight": "600", "cursor": responding() ? "default" : "pointer", "opacity": responding() ? "0.5" : "1" }}
        >
          Allow once
        </button>
        <button
          type="button"
          disabled={responding()}
          onClick={() => decide("always")}
          style={{ "background": "rgba(255,255,255,0.06)", "border": "1px solid rgba(255,255,255,0.12)", "border-radius": "5px", "padding": "5px 8px", "color": "rgba(255,255,255,0.7)", "font-size": "11px", "font-weight": "500", "cursor": responding() ? "default" : "pointer", "opacity": responding() ? "0.5" : "1" }}
        >
          Always
        </button>
        <button
          type="button"
          disabled={responding()}
          onClick={() => decide("reject")}
          style={{ "background": "rgba(239,68,68,0.1)", "border": "1px solid rgba(239,68,68,0.3)", "border-radius": "5px", "padding": "5px 8px", "color": "#EF4444", "font-size": "11px", "font-weight": "500", "cursor": responding() ? "default" : "pointer", "opacity": responding() ? "0.5" : "1" }}
        >
          Deny
        </button>
      </div>
    </div>
  )
}

export function SessionChat() {
  const serverSync = useServerSync()
  const vrax = useVrax()

  const directory = createMemo(() => vrax.store.activeSession?.dir ?? null)
  const sessionID = () => vrax.store.activeSession?.id ?? null

  const childStore = createMemo(() => {
    const dir = directory()
    if (!dir) return null
    return serverSync.child(dir, { bootstrap: true })[0]
  })

  const pendingPermissions = createMemo<PermissionRequest[]>(() => {
    const id = sessionID()
    const store = childStore()
    if (!id || !store) return []
    return (store.permission?.[id] ?? []).filter((p): p is PermissionRequest => !!p?.id)
  })

  const messages = createMemo<Message[]>(() => {
    const id = sessionID()
    const store = childStore()
    if (!id || !store) return []
    return (store.message[id] ?? []).filter((m): m is Message => !!m?.id)
  })

  const partsFor = (messageID: string): Part[] => {
    const store = childStore()
    if (!store) return []
    return (store.part[messageID] ?? []).filter((p): p is Part => !!p?.id)
  }

  let scroller: HTMLDivElement | undefined
  const totalParts = createMemo(() => messages().reduce((n, m) => n + partsFor(m.id).length, 0))
  createEffect(
    on([() => messages().length, totalParts, () => pendingPermissions().length], () => {
      requestAnimationFrame(() => {
        if (scroller) scroller.scrollTop = scroller.scrollHeight
      })
    }),
  )

  return (
    <div
      ref={scroller}
      style={{
        "flex": "1",
        "min-height": "0",
        "overflow-y": "auto",
        "padding": "12px 12px 16px",
        "display": "flex",
        "flex-direction": "column",
        "gap": "12px",
        "scrollbar-width": "thin",
        "scrollbar-color": "rgba(255,255,255,0.08) transparent",
      }}
    >
      <Show
        when={messages().length > 0}
        fallback={
          <div style={{ "color": "rgba(255,255,255,0.22)", "font-size": "11px", "padding": "12px 4px", "line-height": "1.6" }}>
            Session starting… the agent's messages will stream here.
          </div>
        }
      >
        <For each={messages()}>
          {(m) => <MessageRow message={m} parts={partsFor(m.id)} />}
        </For>
      </Show>

      {/* Pending permission requests — actionable, always visible at the tail */}
      <For each={pendingPermissions()}>
        {(req) => <PermissionPrompt request={req} dir={directory() ?? ""} />}
      </For>
    </div>
  )
}
