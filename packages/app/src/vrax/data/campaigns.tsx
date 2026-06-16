import { createContext, useContext, createEffect, onCleanup, onMount, ParentProps } from "solid-js"
import { createStore, reconcile } from "solid-js/store"
import { usePlatform } from "@/context/platform"
import { useTarget } from "./target"
import { parseCouncilState, parseBlackboard } from "./schema"
import { deriveFindings } from "./derive"
import type { CouncilState, Blackboard } from "./schema"

/** Directory portion of a file path (cross-platform). */
function dirOf(p: string): string {
  const sep = p.includes("\\") ? "\\" : "/"
  const parts = p.split(sep)
  parts.pop()
  return parts.join(sep) || sep
}

// ─── Store shape ──────────────────────────────────────────────────────────

interface CampaignsStore {
  root: string | null
  campaign: string | null
  council: CouncilState | null
  blackboard: Blackboard | null
  loading: boolean
  error: string | null
}

// ─── Context ──────────────────────────────────────────────────────────────

interface CampaignsContextValue {
  readonly store: CampaignsStore
  setRoot(root: string | null): void
  setCampaign(campaign: string | null): void
  reload(): Promise<void>
}

const CampaignsContext = createContext<CampaignsContextValue>()

export function useCampaigns(): CampaignsContextValue {
  const ctx = useContext(CampaignsContext)
  if (!ctx) throw new Error("useCampaigns must be used inside <CampaignsProvider>")
  return ctx
}

// ─── Provider ─────────────────────────────────────────────────────────────

export function CampaignsProvider(props: ParentProps) {
  const platform = usePlatform()
  const target = useTarget()

  const [store, setStore] = createStore<CampaignsStore>({
    root: null,
    campaign: null,
    council: null,
    blackboard: null,
    loading: false,
    error: null,
  })

  async function readFiles() {
    const { root, campaign } = store
    if (!root || !campaign || !platform.campaigns) return

    try {
      const [councilJson, blackboardJson] = await Promise.all([
        platform.campaigns.readFile(root, campaign, "council_state.json"),
        platform.campaigns.readFile(root, campaign, "blackboard.json"),
      ])

      const council = councilJson ? parseCouncilState(councilJson) : null
      let blackboard = blackboardJson ? parseBlackboard(blackboardJson) : null

      // The swarm-router agent writes results into council_state.json phase
      // fields, not a separate pheromone blackboard. When no blackboard.json
      // exists (or it's empty), synthesize findings from the council so the
      // intel views reflect real pipeline output.
      if ((!blackboard || blackboard.findings.length === 0) && council) {
        const findings = deriveFindings(council)
        if (findings.length > 0) {
          blackboard = {
            target: council.target,
            iteration: council.iteration,
            findings,
            updated_at: council.updated_at,
          }
        }
      }

      setStore("council", reconcile(council))
      setStore("blackboard", reconcile(blackboard))
    } catch (err) {
      setStore("error", err instanceof Error ? err.message : String(err))
    }
  }

  // Auto-select the active campaign under the workspace root: the council swarm
  // writes council_state.json / blackboard.json into <root>/<target>/, so we
  // track the most-recently-updated campaign folder and surface it live.
  async function discover() {
    const root = store.root
    if (!root || !platform.campaigns?.scan) return
    let list
    try {
      list = await platform.campaigns.scan(root)
    } catch {
      return
    }
    if (!list || list.length === 0) {
      if (store.campaign !== null) setStore("campaign", null)
      return
    }
    // Most-recently-updated campaign (scan returns newest-first).
    const pick = list[0].name
    if (store.campaign !== pick) setStore("campaign", pick)
  }

  // Re-read state files whenever the selected campaign changes.
  createEffect(() => {
    const { root, campaign } = store
    if (!root || !campaign) {
      setStore("council", null)
      setStore("blackboard", null)
      return
    }
    void readFiles()
  })

  // Live updates: watch the workspace root recursively. On any change, re-scan
  // for the active campaign and re-read its state — this is what drives the
  // real-time pipeline / swarm / blackboard views while the agent runs.
  createEffect(() => {
    const { root } = store
    if (!root || !platform.campaigns) return

    let unwatch: (() => void) | undefined

    platform.campaigns
      .watch(root, () => {
        void discover()
        void readFiles()
      })
      .then((off) => {
        unwatch = off
      })
      .catch((err) => {
        setStore("error", err instanceof Error ? err.message : String(err))
      })

    // Initial scan as soon as the root is known.
    void discover()

    onCleanup(() => {
      unwatch?.()
    })
  })

  // Per-project workspace: the selected binary's own directory is the workspace
  // root. The agent writes <dir>/<binary>/{council_state,blackboard}.json there,
  // and discover() + the watcher surface it live. Takes priority over the default.
  createEffect(() => {
    const path = target.store.info?.path
    if (!path) return
    const dir = dirOf(path)
    if (store.root !== dir) {
      setStore("campaign", null)
      setStore("root", dir)
    }
  })

  // Fallback before a binary is selected: the app's own campaigns folder (under
  // the app root — never an external path), so general use still has a workspace.
  onMount(() => {
    if (store.root || target.store.info) return
    void platform.campaigns?.defaultRoot?.().then((root) => {
      if (root && !store.root && !target.store.info) setStore("root", root)
    })
  })

  const ctx: CampaignsContextValue = {
    get store() {
      return store
    },
    setRoot(root) {
      setStore("root", root)
      setStore("campaign", null)
    },
    setCampaign(campaign) {
      setStore("campaign", campaign)
    },
    reload: readFiles,
  }

  return <CampaignsContext.Provider value={ctx}>{props.children}</CampaignsContext.Provider>
}
