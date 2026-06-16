import { createContext, useContext, ParentProps } from "solid-js"
import { createStore } from "solid-js/store"
import { usePlatform } from "@/context/platform"
import { parseBinaryInfo } from "./schema"
import type { BinaryInfo } from "./schema"

// ─── Store shape ──────────────────────────────────────────────────────────

interface TargetStore {
  info: BinaryInfo | null
  loading: boolean
  error: string | null
}

// ─── Context ──────────────────────────────────────────────────────────────

interface TargetContextValue {
  readonly store: TargetStore
  /** Open the native file picker, analyze the chosen binary, and set it as the active target. */
  pickAndAnalyze(): Promise<string | null>
  /** Analyze a known file path and set it as the active target. */
  analyzeFile(filePath: string): Promise<void>
  /** Clear the active target. */
  clear(): void
}

const TargetContext = createContext<TargetContextValue>()

export function useTarget(): TargetContextValue {
  const ctx = useContext(TargetContext)
  if (!ctx) throw new Error("useTarget must be used inside <TargetProvider>")
  return ctx
}

// ─── Provider ─────────────────────────────────────────────────────────────

export function TargetProvider(props: ParentProps) {
  const platform = usePlatform()

  const [store, setStore] = createStore<TargetStore>({
    info: null,
    loading: false,
    error: null,
  })

  async function analyzeFile(filePath: string): Promise<void> {
    if (!platform.analyzeBinary) return

    setStore("loading", true)
    setStore("error", null)

    try {
      const raw = await platform.analyzeBinary(filePath)
      if (!raw) {
        setStore("error", "Binary analysis returned no data")
        return
      }
      setStore("info", parseBinaryInfo(raw))
    } catch (err) {
      setStore("error", err instanceof Error ? err.message : String(err))
    } finally {
      setStore("loading", false)
    }
  }

  async function pickAndAnalyze(): Promise<string | null> {
    if (!platform.openFilePathDialog) return null

    const filePath = await platform.openFilePathDialog({
      title: "Select Binary",
      extensions: ["exe", "dll", "sys", "so", "dylib", "bin", "elf", "out", "ko", "ocx", "drv", "scr"],
    })

    if (!filePath) return null

    await analyzeFile(filePath)
    return filePath
  }

  function clear() {
    setStore("info", null)
    setStore("error", null)
  }

  const ctx: TargetContextValue = {
    get store() {
      return store
    },
    pickAndAnalyze,
    analyzeFile,
    clear,
  }

  return <TargetContext.Provider value={ctx}>{props.children}</TargetContext.Provider>
}
