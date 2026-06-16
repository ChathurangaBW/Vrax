import { watch, type FSWatcher } from "node:fs"
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises"
import { basename, join, normalize, resolve, sep } from "node:path"
import { homedir } from "node:os"
import { app, BrowserWindow, ipcMain } from "electron"
import type { IpcMainInvokeEvent } from "electron"

// VRAX campaign workspaces are plain folders written by the council swarm's
// blackboard.py / orchestrator. A folder is a "campaign" if it contains any of
// these state files. The root that holds these folders is chosen by the user —
// nothing here is hardcoded to D:\Cracked or any other path.
const CAMPAIGN_MARKERS = ["council_state.json", "blackboard.json", "campaign_state.json"] as const

// JSON files the renderer is allowed to read out of a campaign folder. Keeps the
// bridge from turning into an arbitrary file-read primitive.
const READABLE_FILES = new Set<string>([
  "council_state.json",
  "blackboard.json",
  "campaign_state.json",
  "scope.json",
])

export interface CampaignSummary {
  /** Folder name, used as the display id. */
  name: string
  /** Absolute path to the campaign folder. */
  path: string
  /** Which marker files are present. */
  markers: string[]
  /** Last modification time (ms) across marker files, for sort/"updated" display. */
  updatedAt: number
}

/**
 * Guard against path traversal: `child` must resolve to something inside `root`.
 * Returns the normalized absolute child path, or null if it escapes the root.
 */
function containedPath(root: string, child: string): string | null {
  const r = resolve(root)
  const c = resolve(root, child)
  if (c === r) return c
  const prefix = r.endsWith(sep) ? r : r + sep
  return c.startsWith(prefix) ? c : null
}

async function readMarkers(dir: string): Promise<{ markers: string[]; updatedAt: number }> {
  const markers: string[] = []
  let updatedAt = 0
  for (const marker of CAMPAIGN_MARKERS) {
    try {
      const s = await stat(join(dir, marker))
      if (s.isFile()) {
        markers.push(marker)
        updatedAt = Math.max(updatedAt, s.mtimeMs)
      }
    } catch {
      // marker absent — fine
    }
  }
  return { markers, updatedAt }
}

/** Scan a user-chosen root one level deep for campaign folders. */
async function scanCampaigns(root: string): Promise<CampaignSummary[]> {
  let entries: string[]
  try {
    entries = await readdir(root)
  } catch {
    return []
  }
  const out: CampaignSummary[] = []
  for (const entry of entries) {
    const dir = join(root, entry)
    let isDir = false
    try {
      isDir = (await stat(dir)).isDirectory()
    } catch {
      isDir = false
    }
    if (!isDir) continue
    const { markers, updatedAt } = await readMarkers(dir)
    if (markers.length === 0) continue
    out.push({ name: basename(dir), path: dir, markers, updatedAt })
  }
  out.sort((a, b) => b.updatedAt - a.updatedAt)
  return out
}

// One filesystem watcher per (sender, root). Debounced change events are pushed
// to the renderer so the swarm UI feels live without polling.
type WatchKey = string
const watchers = new Map<WatchKey, { watcher: FSWatcher; timer: NodeJS.Timeout | null }>()

function watchKey(senderId: number, root: string): WatchKey {
  return `${senderId}::${normalize(root)}`
}

function stopWatch(key: WatchKey) {
  const existing = watchers.get(key)
  if (!existing) return
  if (existing.timer) clearTimeout(existing.timer)
  try {
    existing.watcher.close()
  } catch {
    // already closed
  }
  watchers.delete(key)
}

export function registerCampaignHandlers() {
  // Return (and create if needed) the default campaigns root next to the app binary.
  ipcMain.handle("campaigns:default-root", async () => {
    // Dev: app.getAppPath() is <repo>/packages/desktop, so two levels up is the
    // monorepo root (D:\vrax). Packaged: campaigns sits next to the exe.
    const rootDir = app.isPackaged
      ? resolve(app.getPath("exe"), "..")
      : resolve(app.getAppPath(), "..", "..")   // <repo>/packages/desktop -> <repo>
    const defaultRoot = join(rootDir, "campaigns")
    try {
      await mkdir(defaultRoot, { recursive: true })
    } catch {
      // already exists or can't create — return the path anyway
    }
    return defaultRoot
  })

  // Seed <workingDir>/config/tool_paths.json so the council agent (which reads
  // config/tool_paths.json relative to its cwd) writes campaign state INTO the
  // selected project dir instead of its legacy hardcoded workspace. We copy the
  // base config (MCP/build paths) so tooling still resolves, then point
  // campaign_workspace_root at the working dir itself. Only ever writes inside
  // the working dir the user selected.
  ipcMain.handle("campaigns:seed-config", async (_event: IpcMainInvokeEvent, workingDir: string) => {
    if (typeof workingDir !== "string" || workingDir.length === 0) return false
    try {
      // Base config from the opencode home (read-only) for MCP/build tool paths.
      let base: Record<string, unknown> = {}
      try {
        const baseText = await readFile(join(homedir(), ".opencode", "config", "tool_paths.json"), "utf-8")
        base = JSON.parse(baseText) as Record<string, unknown>
      } catch {
        // no base config — seed a minimal one
      }
      base.campaign_workspace_root = workingDir
      const configDir = join(workingDir, "config")
      await mkdir(configDir, { recursive: true })
      await writeFile(join(configDir, "tool_paths.json"), JSON.stringify(base, null, 2) + "\n", "utf-8")
      return true
    } catch (err) {
      console.error("campaigns:seed-config failed", err)
      return false
    }
  })

  // List campaign folders under a chosen root.
  ipcMain.handle("campaigns:scan", async (_event: IpcMainInvokeEvent, root: string) => {
    if (typeof root !== "string" || root.length === 0) return []
    return scanCampaigns(root)
  })

  // Read one allowed JSON file from a campaign folder. `root` is the chosen
  // campaigns root; `campaign` is the folder name; `file` must be allow-listed.
  ipcMain.handle(
    "campaigns:read-file",
    async (_event: IpcMainInvokeEvent, root: string, campaign: string, file: string) => {
      if (typeof root !== "string" || typeof campaign !== "string" || typeof file !== "string") return null
      if (!READABLE_FILES.has(file)) return null
      const campaignDir = containedPath(root, campaign)
      if (!campaignDir) return null
      const target = containedPath(campaignDir, file)
      if (!target) return null
      try {
        const text = await readFile(target, "utf-8")
        return text
      } catch {
        return null
      }
    },
  )

  // Start watching a chosen root for changes (recursive). Emits "campaigns:changed".
  ipcMain.handle("campaigns:watch", (event: IpcMainInvokeEvent, root: string) => {
    if (typeof root !== "string" || root.length === 0) return false
    const senderId = event.sender.id
    const key = watchKey(senderId, root)
    stopWatch(key)
    let watcher: FSWatcher
    try {
      watcher = watch(root, { recursive: true }, () => {
        const state = watchers.get(key)
        if (!state) return
        if (state.timer) clearTimeout(state.timer)
        state.timer = setTimeout(() => {
          const win = BrowserWindow.fromWebContents(event.sender)
          if (win && !win.isDestroyed()) win.webContents.send("campaigns:changed", root)
        }, 250)
      })
    } catch {
      return false
    }
    watchers.set(key, { watcher, timer: null })
    event.sender.once("destroyed", () => stopWatch(key))
    return true
  })

  ipcMain.handle("campaigns:unwatch", (event: IpcMainInvokeEvent, root: string) => {
    if (typeof root !== "string") return
    stopWatch(watchKey(event.sender.id, root))
  })
}
