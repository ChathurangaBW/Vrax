import { $ } from "bun"

// Default the channel so the version script doesn't fall back to
// `git branch --show-current` (which throws in a non-git checkout).
const channel = process.env.VRAX_CHANNEL ?? "dev"
process.env.VRAX_CHANNEL = channel

await $`bun ./scripts/copy-icons.ts ${channel}`

await $`cd ../opencode && bun script/build-node.ts`.env({ ...process.env, VRAX_CHANNEL: channel })
