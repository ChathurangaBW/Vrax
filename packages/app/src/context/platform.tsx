import { createSimpleContext } from "@vrax/ui/context"
import type { AsyncStorage, SyncStorage } from "@solid-primitives/storage"
import type { Accessor } from "solid-js"
import type { DesktopMenuAction } from "../desktop-menu"
import { ServerConnection } from "./server"
import type { WslServersPlatform } from "../wsl/types"
import type { UpdaterPlatform } from "../updater"

type PickerPaths = string | string[] | null
type OpenDirectoryPickerOptions = { title?: string; multiple?: boolean }
type OpenAttachmentPickerOptions = {
  title?: string
  multiple?: boolean
  accept?: string[]
  extensions?: string[]
  defaultPath?: string
}
type SaveFilePickerOptions = { title?: string; defaultPath?: string }
type PlatformName = "web" | "desktop"
type DesktopOS = "macos" | "windows" | "linux"

export type FatalRendererErrorLog = {
  error: string
  url: string
  version?: string
  platform: PlatformName
  os?: DesktopOS
}

type PlatformBase = {
  /** App version */
  version?: string

  /** Open a URL in the default browser */
  openLink(url: string): void

  /** Open a local path in a local app (desktop only) */
  openPath?(path: string, app?: string): Promise<void>

  /** Restart the app  */
  restart(): Promise<void>

  /** Navigate back in history */
  back(): void

  /** Navigate forward in history */
  forward(): void

  /** Send a system notification (optional deep link) */
  notify(title: string, description?: string, href?: string): Promise<void>

  /** Open a native attachment picker and read selected files sequentially (desktop only) */
  openAttachmentPickerDialog?(
    opts: OpenAttachmentPickerOptions,
    onFile: (file: File) => Promise<unknown>,
  ): Promise<void>

  /** Open a native save file picker dialog (desktop only) */
  saveFilePickerDialog?(opts?: SaveFilePickerOptions): Promise<string | null>

  /** Storage mechanism, defaults to localStorage */
  storage?: (name?: string) => SyncStorage | AsyncStorage

  /** Application-global desktop updater */
  updater?: UpdaterPlatform

  /** Fetch override */
  fetch?: typeof fetch

  /** Get the configured default server URL (platform-specific) */
  getDefaultServer?(): Promise<ServerConnection.Key | null>

  /** Set the default server URL to use on app startup (platform-specific) */
  setDefaultServer?(url: ServerConnection.Key | null): Promise<void> | void

  /** Manage WSL sidecar servers (Electron on Windows only) */
  wslServers?: WslServersPlatform

  /** Get the preferred display backend (desktop only) */
  getDisplayBackend?(): Promise<DisplayBackend | null> | DisplayBackend | null

  /** Set the preferred display backend (desktop only) */
  setDisplayBackend?(backend: DisplayBackend): Promise<void>

  /** Parse markdown to HTML using native parser (desktop only, returns unprocessed code blocks) */
  parseMarkdown?(markdown: string): Promise<string>

  /** Webview zoom level (desktop only) */
  webviewZoom?: Accessor<number>

  /** Get whether native pinch/Ctrl-scroll zoom gestures are enabled (desktop only) */
  getPinchZoomEnabled?(): Promise<boolean> | boolean

  /** Allow native pinch/Ctrl-scroll zoom gestures (desktop only) */
  setPinchZoomEnabled?(enabled: boolean): Promise<void> | void

  /** Run a desktop-only menu action from the app chrome */
  runDesktopMenuAction?(action: DesktopMenuAction): Promise<void> | void

  /** Check if an editor app exists (desktop only) */
  checkAppExists?(appName: string): Promise<boolean>

  /** Read image from clipboard (desktop only) */
  readClipboardImage?(): Promise<File | null>

  /** Export collected diagnostic logs (desktop only) */
  exportDebugLogs?(): Promise<string>

  /** Record a fatal renderer error in platform logs (desktop only) */
  recordFatalRendererError?(error: FatalRendererErrorLog): Promise<void>

  /** Access VRAX campaign swarm workspaces under a user-chosen root (desktop only) */
  campaigns?: CampaignsPlatform

  /** Open a native file picker and return the selected file path (desktop only, VRAX) */
  openFilePathDialog?(opts?: { title?: string; extensions?: string[] }): Promise<string | null>

  /** Parse a binary file's PE/ELF headers and compute hashes (desktop only, VRAX) */
  analyzeBinary?(filePath: string): Promise<Record<string, unknown> | null>

  /** Copy a file from source to destination (desktop only, VRAX) */
  copyFile?(sourcePath: string, destPath: string): Promise<void>
}

export interface CampaignSummary {
  /** Folder name (display id) */
  name: string
  /** Absolute path to the campaign folder */
  path: string
  /** Which state files are present (council_state.json, blackboard.json, ...) */
  markers: string[]
  /** Newest mtime (ms) across state files */
  updatedAt: number
}

export interface CampaignsPlatform {
  /** Return (and create if needed) the default campaigns workspace root. */
  defaultRoot?(): Promise<string>
  /** Seed <workingDir>/config/tool_paths.json so the agent writes campaign state into the working dir. */
  seedConfig?(workingDir: string): Promise<boolean>
  /** List campaign folders directly under `root`. */
  scan(root: string): Promise<CampaignSummary[]>
  /** Read one allow-listed JSON state file from a campaign folder; null if absent. */
  readFile(root: string, campaign: string, file: string): Promise<string | null>
  /** Watch `root` for changes; `cb` fires (debounced) on any change. Returns an unsubscribe fn. */
  watch(root: string, cb: () => void): Promise<() => void>
  /** List binary files (exe/dll/sys/bin/elf) in an arbitrary folder path. */
  listFiles(folderPath: string): Promise<{ name: string; path: string; size: number; ext: string }[]>
}

export type Platform = PlatformBase &
  (
    | { platform: "web"; os?: never }
    | {
        platform: "desktop"
        os?: DesktopOS
        openDirectoryPickerDialog(opts?: OpenDirectoryPickerOptions): Promise<PickerPaths>
      }
  )

export type DisplayBackend = "auto" | "wayland"

export const { use: usePlatform, provider: PlatformProvider } = createSimpleContext({
  name: "Platform",
  init: (props: { value: Platform }) => {
    return props.value
  },
})
