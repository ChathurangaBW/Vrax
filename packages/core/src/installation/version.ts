declare global {
  const VRAX_VERSION: string
  const VRAX_CHANNEL: string
}

export const InstallationVersion = typeof VRAX_VERSION === "string" ? VRAX_VERSION : "local"
export const InstallationChannel = typeof VRAX_CHANNEL === "string" ? VRAX_CHANNEL : "local"
export const InstallationLocal = InstallationChannel === "local"
