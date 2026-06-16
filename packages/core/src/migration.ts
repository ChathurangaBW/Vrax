import path from "path"
import fs from "fs/promises"
import { xdgData, xdgCache, xdgConfig, xdgState } from "xdg-basedir"

async function copyDir(src: string, dest: string): Promise<void> {
  await fs.mkdir(dest, { recursive: true })
  const entries = await fs.readdir(src, { withFileTypes: true })
  await Promise.all(
    entries.map(async (entry) => {
      const srcPath = path.join(src, entry.name)
      const destPath = path.join(dest, entry.name)
      if (entry.isDirectory()) {
        await copyDir(srcPath, destPath)
      } else {
        await fs.copyFile(srcPath, destPath)
      }
    }),
  )
}

async function copyDirIfMissing(src: string, dest: string): Promise<void> {
  const [srcExists, destExists] = await Promise.all([
    fs.access(src).then(() => true).catch(() => false),
    fs.access(dest).then(() => true).catch(() => false),
  ])
  if (!srcExists || destExists) return
  await copyDir(src, dest)
}

// Called during startup when the app directory name changes from "opencode" to "vrax".
// Copies existing opencode data/config directories into the new vrax locations so
// existing users keep their sessions, credentials, and configuration.
export async function migrateFromOpencode(): Promise<void> {
  await Promise.all([
    copyDirIfMissing(path.join(xdgData!, "opencode"), path.join(xdgData!, "vrax")),
    copyDirIfMissing(path.join(xdgCache!, "opencode"), path.join(xdgCache!, "vrax")),
    copyDirIfMissing(path.join(xdgConfig!, "opencode"), path.join(xdgConfig!, "vrax")),
    copyDirIfMissing(path.join(xdgState!, "opencode"), path.join(xdgState!, "vrax")),
  ])
}
