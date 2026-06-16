import { createSignal, onCleanup, onMount } from "solid-js"

export type McpAvailability = "online" | "offline" | "checking"

export interface McpServerStatus {
  key: string
  label: string
  port: number
  tools: string
  priority: "PRI" | "SEC" | "WEB"
  availability: McpAvailability
  enabled: boolean
}

const SERVERS: Omit<McpServerStatus, "availability" | "enabled">[] = [
  { key: "ghidra_mcp",    label: "ghidra_mcp",    port: 8081,  tools: "249",  priority: "PRI" },
  { key: "ida_pro_mcp",   label: "ida_pro_mcp",   port: 13337, tools: "32",   priority: "SEC" },
  { key: "binary_ninja",  label: "binary_ninja",  port: 9009,  tools: "60+",  priority: "SEC" },
  { key: "zap",           label: "zap",           port: 8282,  tools: "8",    priority: "WEB" },
]

async function checkPort(port: number): Promise<boolean> {
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 2000)
    await fetch(`http://127.0.0.1:${port}`, { signal: ctrl.signal, mode: "no-cors" })
    clearTimeout(timer)
    return true
  } catch {
    return false
  }
}

export function useMcpStatus() {
  const initial: McpServerStatus[] = SERVERS.map(s => ({
    ...s,
    availability: "checking",
    enabled: true,
  }))

  const [servers, setServers] = createSignal<McpServerStatus[]>(initial)

  async function poll() {
    const results = await Promise.all(
      SERVERS.map(async (s) => {
        const online = await checkPort(s.port)
        return { ...s, availability: (online ? "online" : "offline") as McpAvailability, enabled: true }
      })
    )
    setServers(results)
  }

  function toggle(key: string) {
    setServers(prev => prev.map(s => s.key === key ? { ...s, enabled: !s.enabled } : s))
  }

  let interval: ReturnType<typeof setInterval>

  onMount(() => {
    void poll()
    interval = setInterval(() => void poll(), 15_000)
  })

  onCleanup(() => clearInterval(interval))

  const onlineCount = () => servers().filter(s => s.availability === "online").length

  return { servers, toggle, onlineCount }
}
