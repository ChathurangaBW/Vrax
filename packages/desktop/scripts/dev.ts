import { spawn } from "node:child_process"
import { existsSync } from "node:fs"
import { join } from "node:path"

// Dev launcher for the VRAX desktop app.
//
// Fixes two environment papercuts that otherwise break `electron-vite dev`:
//
//  1. ELECTRON_RUN_AS_NODE — if this is set in the shell, Electron boots as
//     plain Node.js and every `import { BrowserWindow } from "electron"` fails
//     with "does not provide an export named ...". We strip it for the child.
//
//  2. VRAX_CHANNEL — the version script runs `git branch --show-current`, which
//     throws when the project isn't a git repo. Defaulting the channel short-
//     circuits that path so a non-git checkout still launches.

const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE
if (!env.VRAX_CHANNEL) env.VRAX_CHANNEL = "dev"

const binDir = join(process.cwd(), "node_modules", ".bin")
const candidates =
  process.platform === "win32"
    ? ["electron-vite.cmd", "electron-vite.exe", "electron-vite"]
    : ["electron-vite"]
const cmd = candidates.map((c) => join(binDir, c)).find((p) => existsSync(p)) ?? "electron-vite"

const child = spawn(cmd, ["dev"], {
  stdio: "inherit",
  env,
  shell: process.platform === "win32",
})

child.on("exit", (code) => process.exit(code ?? 0))
child.on("error", (err) => {
  console.error("Failed to start electron-vite dev:", err)
  process.exit(1)
})
