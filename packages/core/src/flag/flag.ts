import { Config } from "effect"

// Backward compat: promote OPENCODE_* env vars to VRAX_* so users with existing
// shell configs don't need to update their environment after the rename.
for (const [key, value] of Object.entries(process.env)) {
  if (key.startsWith("OPENCODE_") && value !== undefined) {
    const newKey = "VRAX_" + key.slice("OPENCODE_".length)
    if (process.env[newKey] === undefined) {
      process.env[newKey] = value
    }
  }
}

export function truthy(key: string) {
  const value = process.env[key]?.toLowerCase()
  return value === "true" || value === "1"
}

const copy = process.env["VRAX_EXPERIMENTAL_DISABLE_COPY_ON_SELECT"]
const fff = process.env["VRAX_DISABLE_FFF"]

function enabledByExperimental(key: string) {
  return process.env[key] === undefined ? truthy("VRAX_EXPERIMENTAL") : truthy(key)
}

export const Flag = {
  OTEL_EXPORTER_OTLP_ENDPOINT: process.env["OTEL_EXPORTER_OTLP_ENDPOINT"],
  OTEL_EXPORTER_OTLP_HEADERS: process.env["OTEL_EXPORTER_OTLP_HEADERS"],

  VRAX_AUTO_HEAP_SNAPSHOT: truthy("VRAX_AUTO_HEAP_SNAPSHOT"),
  VRAX_GIT_BASH_PATH: process.env["VRAX_GIT_BASH_PATH"],
  VRAX_CONFIG: process.env["VRAX_CONFIG"],
  VRAX_CONFIG_CONTENT: process.env["VRAX_CONFIG_CONTENT"],
  VRAX_DISABLE_AUTOUPDATE: truthy("VRAX_DISABLE_AUTOUPDATE"),
  VRAX_ALWAYS_NOTIFY_UPDATE: truthy("VRAX_ALWAYS_NOTIFY_UPDATE"),
  VRAX_DISABLE_PRUNE: truthy("VRAX_DISABLE_PRUNE"),
  VRAX_DISABLE_TERMINAL_TITLE: truthy("VRAX_DISABLE_TERMINAL_TITLE"),
  VRAX_SHOW_TTFD: truthy("VRAX_SHOW_TTFD"),
  VRAX_DISABLE_AUTOCOMPACT: truthy("VRAX_DISABLE_AUTOCOMPACT"),
  VRAX_DISABLE_MODELS_FETCH: truthy("VRAX_DISABLE_MODELS_FETCH"),
  VRAX_DISABLE_MOUSE: truthy("VRAX_DISABLE_MOUSE"),
  VRAX_FAKE_VCS: process.env["VRAX_FAKE_VCS"],
  VRAX_SERVER_PASSWORD: process.env["VRAX_SERVER_PASSWORD"],
  VRAX_SERVER_USERNAME: process.env["VRAX_SERVER_USERNAME"],
  VRAX_DISABLE_FFF: fff === undefined ? process.platform === "win32" : truthy("VRAX_DISABLE_FFF"),

  // Experimental
  VRAX_EXPERIMENTAL_FILEWATCHER: Config.boolean("VRAX_EXPERIMENTAL_FILEWATCHER").pipe(
    Config.withDefault(false),
  ),
  VRAX_EXPERIMENTAL_DISABLE_FILEWATCHER: Config.boolean("VRAX_EXPERIMENTAL_DISABLE_FILEWATCHER").pipe(
    Config.withDefault(false),
  ),
  VRAX_EXPERIMENTAL_DISABLE_COPY_ON_SELECT:
    copy === undefined ? process.platform === "win32" : truthy("VRAX_EXPERIMENTAL_DISABLE_COPY_ON_SELECT"),
  VRAX_MODELS_URL: process.env["VRAX_MODELS_URL"],
  VRAX_MODELS_PATH: process.env["VRAX_MODELS_PATH"],
  VRAX_DB: process.env["VRAX_DB"],

  VRAX_WORKSPACE_ID: process.env["VRAX_WORKSPACE_ID"],
  VRAX_EXPERIMENTAL_WORKSPACES: enabledByExperimental("VRAX_EXPERIMENTAL_WORKSPACES"),

  // Evaluated at access time (not module load) because tests, the CLI, and
  // external tooling set these env vars at runtime.
  get VRAX_DISABLE_PROJECT_CONFIG() {
    return truthy("VRAX_DISABLE_PROJECT_CONFIG")
  },
  get VRAX_EXPERIMENTAL_REFERENCES() {
    return enabledByExperimental("VRAX_EXPERIMENTAL_REFERENCES")
  },
  get VRAX_TUI_CONFIG() {
    return process.env["VRAX_TUI_CONFIG"]
  },
  get VRAX_CONFIG_DIR() {
    return process.env["VRAX_CONFIG_DIR"]
  },
  get VRAX_PURE() {
    return truthy("VRAX_PURE")
  },
  get VRAX_PERMISSION() {
    return process.env["VRAX_PERMISSION"]
  },
  get VRAX_PLUGIN_META_FILE() {
    return process.env["VRAX_PLUGIN_META_FILE"]
  },
  get VRAX_CLIENT() {
    return process.env["VRAX_CLIENT"] ?? "cli"
  },
}
