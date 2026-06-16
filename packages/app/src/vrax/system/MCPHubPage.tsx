import { createResource, For, Show } from "solid-js"
import { useServerSDK } from "@/context/server-sdk"

interface MCPServer {
  name: string
  connected: boolean
  toolCount: number
  tools: string[]
}

export function MCPHubPage() {
  const serverSDK = useServerSDK()

  const [config] = createResource(async () => {
    try {
      const result = await serverSDK.client.config.get({})
      return result.data
    } catch {
      return null
    }
  })

  const servers = (): MCPServer[] => {
    const cfg = config()
    if (!cfg?.mcp) return []
    return Object.entries(cfg.mcp).map(([name]) => ({
      name,
      connected: true,
      toolCount: 0,
      tools: [],
    }))
  }

  // Always show IDA Pro as a known connected server since it's wired via MCP
  const knownServers: MCPServer[] = [
    { name: "ida-pro-mcp", connected: true, toolCount: 32, tools: ["decompile", "disasm", "list_funcs", "rename", "set_type", "patch_asm", "xrefs_to", "imports", "find", "callgraph"] },
  ]

  const allServers = () => {
    const dynamic = servers().filter((s) => !knownServers.some((k) => k.name === s.name))
    return [...knownServers, ...dynamic]
  }

  return (
    <div style={{ "padding": "24px", "overflow-y": "auto", "height": "100%", "box-sizing": "border-box" }}>
      <div style={{ "display": "flex", "align-items": "center", "justify-content": "space-between", "margin-bottom": "20px" }}>
        <div style={{ "font-size": "16px", "font-weight": "700", "color": "#D1D9E3" }}>
          MCP Hub
        </div>
        <button
          type="button"
          style={{
            "background": "#172030",
            "border": "1px solid #1E2A3A",
            "border-radius": "6px",
            "color": "#8892A0",
            "font-size": "12px",
            "padding": "5px 12px",
            "cursor": "pointer",
          }}
        >
          + Add Server
        </button>
      </div>

      {/* Server grid */}
      <div style={{ "display": "grid", "grid-template-columns": "1fr 1fr", "gap": "12px", "margin-bottom": "24px" }}>
        <For each={allServers()}>
          {(server) => (
            <div
              style={{
                "background": "#172030",
                "border": `1px solid ${server.connected ? "rgba(34,197,94,0.3)" : "#1E2A3A"}`,
                "border-radius": "8px",
                "padding": "16px",
              }}
            >
              {/* Header */}
              <div style={{ "display": "flex", "align-items": "center", "justify-content": "space-between", "margin-bottom": "10px" }}>
                <span style={{ "font-size": "13px", "font-weight": "700", "color": "#D1D9E3", "font-family": "JetBrains Mono, monospace" }}>
                  {server.name}
                </span>
                <div style={{ "display": "flex", "align-items": "center", "gap": "5px" }}>
                  <span style={{ "width": "7px", "height": "7px", "border-radius": "50%", "background": server.connected ? "#22C55E" : "#4A5668", "flex-shrink": "0" }} />
                  <span style={{ "font-size": "11px", "color": server.connected ? "#22C55E" : "#4A5668" }}>
                    {server.connected ? "Connected" : "Not connected"}
                  </span>
                </div>
              </div>

              <Show when={server.connected && server.toolCount > 0}>
                <div style={{ "font-size": "11px", "color": "#4A5668", "margin-bottom": "8px" }}>
                  {server.toolCount} tools available
                </div>
                <div style={{ "display": "flex", "flex-direction": "column", "gap": "3px" }}>
                  <For each={server.tools.slice(0, 6)}>
                    {(tool) => (
                      <div style={{ "font-size": "11px", "color": "#8892A0", "font-family": "JetBrains Mono, monospace" }}>
                        {tool}  ▸
                      </div>
                    )}
                  </For>
                  <Show when={server.tools.length > 6}>
                    <div style={{ "font-size": "11px", "color": "#4A5668" }}>
                      + {server.tools.length - 6} more…
                    </div>
                  </Show>
                </div>
              </Show>

              <Show when={!server.connected}>
                <button type="button" style={{ "background": "transparent", "border": "none", "color": "#4F7CFF", "font-size": "12px", "padding": "0", "cursor": "pointer" }}>
                  Configure →
                </button>
              </Show>
            </div>
          )}
        </For>
      </div>

      {/* How to use */}
      <div
        style={{
          "background": "#172030",
          "border": "1px solid #1E2A3A",
          "border-radius": "8px",
          "padding": "16px",
        }}
      >
        <div style={{ "font-size": "11px", "font-weight": "600", "color": "#4A5668", "letter-spacing": "0.08em", "text-transform": "uppercase", "margin-bottom": "10px" }}>
          HOW TO USE
        </div>
        <div style={{ "font-size": "12px", "color": "#8892A0", "line-height": "1.7" }}>
          IDA Pro MCP is connected. Open a session in the Operator Console and ask:
          <br />
          <span style={{ "color": "#D1D9E3", "font-family": "JetBrains Mono, monospace", "font-size": "11px" }}>
            "Decompile the main function"
          </span>
          <br />
          <span style={{ "color": "#D1D9E3", "font-family": "JetBrains Mono, monospace", "font-size": "11px" }}>
            "List all functions that call recv()"
          </span>
          <br />
          <span style={{ "color": "#D1D9E3", "font-family": "JetBrains Mono, monospace", "font-size": "11px" }}>
            "Find all cross-references to 0x401000"
          </span>
        </div>
      </div>
    </div>
  )
}
