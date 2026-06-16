import { createHash } from "node:crypto"
import { readFile, stat } from "node:fs/promises"
import { basename } from "node:path"

const MACHINE_TYPES: Record<number, string> = {
  0x014c: "x86 (32-bit)",
  0x8664: "x64 (64-bit)",
  0x01c4: "ARM (32-bit)",
  0xaa64: "ARM64",
  0x0200: "IA-64 (Itanium)",
  0x01c0: "ARM little endian",
}

const SUBSYSTEMS: Record<number, string> = {
  1: "Native",
  2: "Windows GUI",
  3: "Windows Console",
  5: "OS/2 Console",
  7: "POSIX Console",
  9: "Windows CE GUI",
  10: "EFI Application",
  14: "Xbox",
  16: "Windows Boot App",
}

export interface BinaryInfo {
  name: string
  path: string
  size: number
  sizeFormatted: string
  architecture: string
  format: string
  subsystem: string
  machine: string
  timestamp: number
  timestampFormatted: string
  numberOfSections: number
  entryPoint: string
  imageBase: string
  md5: string
  sha256: string
  isDLL: boolean
  isConsole: boolean
  sections: Array<{
    name: string
    virtualAddress: string
    virtualSize: number
    rawSize: number
    characteristics: string
    entropy?: number
  }>
  imports: Array<{ dll: string; functions: string[] }>
  exports: Array<{ name: string; ordinal: number; address: number }>
  error?: string
}

export async function analyzeBinary(filePath: string): Promise<BinaryInfo> {
  const s = await stat(filePath)
  const size = s.size
  const sizeFormatted =
    size > 1024 * 1024
      ? `${(size / 1024 / 1024).toFixed(2)} MB`
      : `${(size / 1024).toFixed(1)} KB`

  const bufSize = Math.min(size, 65536)
  const buf = Buffer.alloc(bufSize)
  const { open, read, close } = await import("node:fs/promises").then((m) => ({
    open: m.open,
    read: async (fd: import("node:fs/promises").FileHandle, b: Buffer) => fd.read(b, 0, b.length, 0),
    close: (fd: import("node:fs/promises").FileHandle) => fd.close(),
  }))

  const fd = await open(filePath, "r")
  try {
    await fd.read(buf, 0, bufSize, 0)
  } finally {
    await fd.close()
  }

  // Compute hashes on full file
  const fullBuf = await readFile(filePath)
  const md5 = createHash("md5").update(fullBuf).digest("hex").toUpperCase()
  const sha256 = createHash("sha256").update(fullBuf).digest("hex").toUpperCase()

  const base: Partial<BinaryInfo> = {
    name: basename(filePath),
    path: filePath,
    size,
    sizeFormatted,
    md5,
    sha256,
    format: "Unknown",
    architecture: "Unknown",
    subsystem: "Unknown",
    machine: "Unknown",
    timestamp: 0,
    timestampFormatted: "—",
    numberOfSections: 0,
    entryPoint: "—",
    imageBase: "—",
    isDLL: false,
    isConsole: false,
    sections: [],
    imports: [],
    exports: [],
  }

  // Check MZ header
  if (buf.length < 2 || buf[0] !== 0x4d || buf[1] !== 0x5a) {
    return { ...base, format: "ELF/Unknown binary", architecture: detectNonPE(buf) } as BinaryInfo
  }

  base.format = "PE (Windows)"

  // PE offset at 0x3C
  if (buf.length < 0x40) return base as BinaryInfo
  const peOffset = buf.readUInt32LE(0x3c)
  if (peOffset + 24 > buf.length) return base as BinaryInfo

  // PE signature
  if (buf.readUInt32LE(peOffset) !== 0x00004550) return base as BinaryInfo

  const machineId = buf.readUInt16LE(peOffset + 4)
  const numSections = buf.readUInt16LE(peOffset + 6)
  const timestamp = buf.readUInt32LE(peOffset + 8)
  const characteristics = buf.readUInt16LE(peOffset + 22)

  const machineStr = MACHINE_TYPES[machineId] ?? `0x${machineId.toString(16).toUpperCase()}`
  base.machine = machineStr
  base.architecture = machineStr
  base.numberOfSections = numSections
  base.timestamp = timestamp * 1000
  base.timestampFormatted = timestamp > 0 ? new Date(timestamp * 1000).toUTCString() : "—"
  base.isDLL = !!(characteristics & 0x2000)
  base.format = base.isDLL ? "PE DLL" : "PE EXE"

  // Optional header
  const optHeaderOffset = peOffset + 24
  if (optHeaderOffset + 2 > buf.length) return base as BinaryInfo
  const magic = buf.readUInt16LE(optHeaderOffset)
  const is64 = magic === 0x020b

  if (optHeaderOffset + (is64 ? 112 : 96) <= buf.length) {
    const entryPoint = buf.readUInt32LE(optHeaderOffset + 16)
    base.entryPoint = `0x${entryPoint.toString(16).toUpperCase().padStart(8, "0")}`

    const imageBase = is64
      ? buf.readBigUInt64LE(optHeaderOffset + 24)
      : BigInt(buf.readUInt32LE(optHeaderOffset + 28))
    base.imageBase = `0x${imageBase.toString(16).toUpperCase()}`

    const subsystem = buf.readUInt16LE(optHeaderOffset + (is64 ? 68 : 68))
    base.subsystem = SUBSYSTEMS[subsystem] ?? `Unknown (${subsystem})`
    base.isConsole = subsystem === 3
  }

  // Sections
  const sectionTableOffset = optHeaderOffset + buf.readUInt16LE(peOffset + 20)
  const secs: BinaryInfo["sections"] = []
  interface RawSec { va: number; vSize: number; rawOffset: number }
  const rawSecs: RawSec[] = []

  for (let i = 0; i < Math.min(numSections, 32); i++) {
    const off = sectionTableOffset + i * 40
    if (off + 40 > buf.length) break
    const nameBytes = buf.subarray(off, off + 8)
    let secName = ""
    for (let j = 0; j < 8; j++) {
      if (nameBytes[j] === 0) break
      secName += String.fromCharCode(nameBytes[j])
    }
    const virtualSize = buf.readUInt32LE(off + 8)
    const virtualAddress = buf.readUInt32LE(off + 12)
    const rawSize = buf.readUInt32LE(off + 16)
    const rawOffset = buf.readUInt32LE(off + 20)
    const charFlags = buf.readUInt32LE(off + 36)
    const flags: string[] = []
    if (charFlags & 0x20) flags.push("CODE")
    if (charFlags & 0x40) flags.push("IDATA")
    if (charFlags & 0x80) flags.push("UDATA")
    if (charFlags & 0x20000000) flags.push("EXEC")
    if (charFlags & 0x40000000) flags.push("READ")
    if (charFlags & 0x80000000) flags.push("WRITE")
    secs.push({
      name: secName || "(unnamed)",
      virtualAddress: `0x${virtualAddress.toString(16).toUpperCase().padStart(8, "0")}`,
      virtualSize,
      rawSize,
      characteristics: flags.join(" | ") || `0x${charFlags.toString(16).toUpperCase()}`,
    })
    if (virtualAddress > 0 && rawOffset > 0) rawSecs.push({ va: virtualAddress, vSize: virtualSize, rawOffset })
  }
  base.sections = secs

  // RVA → file offset helper using section table
  const rvaToOffset = (rva: number): number => {
    for (const s of rawSecs) {
      if (rva >= s.va && rva < s.va + Math.max(s.vSize, 0x1000)) {
        return rva - s.va + s.rawOffset
      }
    }
    return 0
  }

  const readNullStr = (b: Buffer, offset: number, maxLen = 256): string => {
    let end = offset
    while (end < b.length && b[end] !== 0 && end - offset < maxLen) end++
    return b.subarray(offset, end).toString("ascii")
  }

  // DataDirectory starts after the optional header fields
  // PE32: optHeader+96, PE32+: optHeader+112
  const ddBase = optHeaderOffset + (is64 ? 112 : 96)

  // ── Import table ─────────────────────────────────────────────────────────
  if (ddBase + 16 <= fullBuf.length) {
    const importRVA = fullBuf.readUInt32LE(ddBase + 8)
    if (importRVA > 0) {
      const importFileOff = rvaToOffset(importRVA)
      if (importFileOff > 0) {
        const imports: BinaryInfo["imports"] = []
        let descOff = importFileOff
        while (descOff + 20 <= fullBuf.length) {
          const origFirstThunk = fullBuf.readUInt32LE(descOff)
          const nameRVA = fullBuf.readUInt32LE(descOff + 12)
          const firstThunk = fullBuf.readUInt32LE(descOff + 16)
          if (origFirstThunk === 0 && nameRVA === 0 && firstThunk === 0) break

          const nameOff = rvaToOffset(nameRVA)
          const dllName = nameOff > 0 ? readNullStr(fullBuf, nameOff) : ""

          const functions: string[] = []
          const thunkRVA = origFirstThunk || firstThunk
          if (thunkRVA > 0) {
            const thunkOff = rvaToOffset(thunkRVA)
            if (thunkOff > 0) {
              const entrySize = is64 ? 8 : 4
              let t = thunkOff
              while (t + entrySize <= fullBuf.length && functions.length < 2000) {
                const val = is64 ? Number(fullBuf.readBigUInt64LE(t)) : fullBuf.readUInt32LE(t)
                if (val === 0) break
                const ordinalBit = is64
                  ? (BigInt(val) & BigInt("0x8000000000000000")) !== BigInt(0)
                  : (val & 0x80000000) !== 0
                if (!ordinalBit) {
                  const fnRVA = is64
                    ? Number(BigInt(val) & BigInt("0x7FFFFFFFFFFFFFFF"))
                    : val & 0x7fffffff
                  const fnOff = rvaToOffset(fnRVA)
                  if (fnOff + 2 <= fullBuf.length) {
                    const fnName = readNullStr(fullBuf, fnOff + 2)
                    if (fnName) functions.push(fnName)
                  }
                } else {
                  functions.push(`#${val & 0xffff}`)
                }
                t += entrySize
              }
            }
          }

          if (dllName) imports.push({ dll: dllName, functions })
          descOff += 20
        }
        base.imports = imports
      }
    }
  }

  // ── Export table ─────────────────────────────────────────────────────────
  if (ddBase + 8 <= fullBuf.length) {
    const exportRVA = fullBuf.readUInt32LE(ddBase)
    if (exportRVA > 0) {
      const exportFileOff = rvaToOffset(exportRVA)
      if (exportFileOff > 0 && exportFileOff + 40 <= fullBuf.length) {
        const ordBase = fullBuf.readUInt32LE(exportFileOff + 20)
        const numNames = fullBuf.readUInt32LE(exportFileOff + 28)
        const funcsRVA = fullBuf.readUInt32LE(exportFileOff + 32)
        const namesRVA = fullBuf.readUInt32LE(exportFileOff + 36)
        const ordinalsRVA = fullBuf.readUInt32LE(exportFileOff + 40)

        const namesOff = rvaToOffset(namesRVA)
        const ordsOff = rvaToOffset(ordinalsRVA)
        const funcsOff = rvaToOffset(funcsRVA)

        const exports: BinaryInfo["exports"] = []
        for (let i = 0; i < Math.min(numNames, 2000); i++) {
          const nameEntryOff = namesOff + i * 4
          if (nameEntryOff + 4 > fullBuf.length) break
          const nameRVA2 = fullBuf.readUInt32LE(nameEntryOff)
          const nameOff2 = rvaToOffset(nameRVA2)
          const fnName = nameOff2 > 0 ? readNullStr(fullBuf, nameOff2) : ""

          let ordinal = i + ordBase
          let address = 0
          if (ordsOff > 0 && ordsOff + i * 2 + 2 <= fullBuf.length) {
            const nameOrd = fullBuf.readUInt16LE(ordsOff + i * 2)
            ordinal = nameOrd + ordBase
            if (funcsOff > 0 && funcsOff + nameOrd * 4 + 4 <= fullBuf.length) {
              address = fullBuf.readUInt32LE(funcsOff + nameOrd * 4)
            }
          }

          if (fnName) exports.push({ name: fnName, ordinal, address })
        }
        base.exports = exports
      }
    }
  }

  return base as BinaryInfo
}

function detectNonPE(buf: Buffer): string {
  if (buf.length >= 4 && buf[0] === 0x7f && buf[1] === 0x45 && buf[2] === 0x4c && buf[3] === 0x46)
    return "ELF"
  if (buf.length >= 4 && buf[0] === 0xce && buf[1] === 0xfa && buf[2] === 0xed && buf[3] === 0xfe)
    return "Mach-O (32-bit)"
  if (buf.length >= 4 && buf[0] === 0xcf && buf[1] === 0xfa && buf[2] === 0xed && buf[3] === 0xfe)
    return "Mach-O (64-bit)"
  return "Unknown binary"
}
