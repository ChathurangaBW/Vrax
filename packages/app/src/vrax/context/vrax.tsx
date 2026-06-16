import { createContext, useContext, ParentProps } from "solid-js"
import { createStore } from "solid-js/store"

export type NavItem =
  | "targets" | "campaigns"
  | "overview" | "sections" | "imports" | "exports"
  | "pipeline" | "swarm"
  | "evidence" | "blackboard"
  | "reports" | "mcp-hub"

export interface ActiveSession {
  id: string
  dir: string
}

interface VraxStore {
  nav: NavItem
  selectedFindingId: string | null
  activeSession: ActiveSession | null
  /** A prompt requested by another view (e.g. Reports) for the Operator Console to dispatch. */
  pendingPrompt: string | null
}

interface VraxContextValue {
  readonly store: VraxStore
  setNav(item: NavItem): void
  setSelectedFindingId(id: string | null): void
  setActiveSession(session: ActiveSession | null): void
  /** Queue a prompt for the Operator Console to dispatch through the council agent. */
  requestDispatch(prompt: string): void
  /** Clear the queued prompt (called by the Operator Console once consumed). */
  clearPendingPrompt(): void
}

const VraxContext = createContext<VraxContextValue>()

export function useVrax(): VraxContextValue {
  const ctx = useContext(VraxContext)
  if (!ctx) throw new Error("useVrax must be used inside <VraxProvider>")
  return ctx
}

export function VraxProvider(props: ParentProps) {
  const [store, setStore] = createStore<VraxStore>({
    nav: "targets",
    selectedFindingId: null,
    activeSession: null,
    pendingPrompt: null,
  })

  const ctx: VraxContextValue = {
    get store() { return store },
    setNav(item) { setStore("nav", item) },
    setSelectedFindingId(id) { setStore("selectedFindingId", id) },
    setActiveSession(session) { setStore("activeSession", session) },
    requestDispatch(prompt) { setStore("pendingPrompt", prompt) },
    clearPendingPrompt() { setStore("pendingPrompt", null) },
  }

  return <VraxContext.Provider value={ctx}>{props.children}</VraxContext.Provider>
}
