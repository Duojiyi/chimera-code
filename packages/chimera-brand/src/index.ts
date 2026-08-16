import packageJson from "../package.json" with { type: "json" }

// Chimera 品牌常量：所有品牌相关值的唯一来源。
export const BRAND = {
  name: "Chimera",
  nameLower: "chimera",
  appId: "io.chimera.desktop",
  scheme: "chimera",
  version: packageJson.version,
  gatewayUrl: "https://api.chimerahub.org/",
  homepage: "https://chimerahub.org",
  github: { owner: "Duojiyi", repo: "chimera-code" },
  issues: "https://github.com/Duojiyi/chimera-code/issues/new",
  releases: "https://github.com/Duojiyi/chimera-code/releases",
} as const

export type BrandChannel = "dev" | "beta" | "prod"

export function brandScheme(channel: BrandChannel) {
  if (channel === "prod") return BRAND.scheme
  return `${BRAND.scheme}-${channel}`
}

export const BRAND_SCHEMES = (["prod", "beta", "dev"] as const).map(brandScheme)

const homepageHost = new URL(BRAND.homepage).host
const configSchema = "https://opencode.ai/config.json"
const configSchemaPlaceholder = "\u0000CHIMERA_CONFIG_SCHEMA\u0000"

/**
 * 把用户可见文案里的上游品牌替换成 Chimera。
 * 在语言包加载时统一套用，避免改几十份上游 locale 文件（便于 rebase）。
 * 技术兼容标识（配置 Schema、真实 CLI 命令）必须保留上游名称。
 */
export function brandUserCopy(text: string): string
export function brandUserCopy(text: unknown): unknown
export function brandUserCopy(text: unknown) {
  if (typeof text !== "string") return text
  if (!/OpenCode|opencode\.ai|opencode\.json|Discord|opencode is not|opencode is installed/i.test(text)) return text
  return text
    .replaceAll(configSchema, configSchemaPlaceholder)
    .replaceAll("OpenCode Desktop", BRAND.name)
    .replaceAll("OpenCode Go", BRAND.name)
    .replaceAll("OpenCode Zen", BRAND.name)
    .replaceAll("opencode.ai/zen", homepageHost)
    .replaceAll("opencode.ai", homepageHost)
    .replaceAll("OpenCode", BRAND.name)
    .replaceAll("opencode.jsonc", "chimera.jsonc")
    .replaceAll("opencode.json", "chimera.json")
    .replaceAll("on Discord", "on GitHub")
    .replaceAll("Discord", "GitHub")
    .replaceAll("opencode is not installed", "the engine is not installed")
    .replaceAll("opencode is installed but could not run", "the engine is installed but could not run")
    .replaceAll(configSchemaPlaceholder, configSchema)
}

export function brandUserDict<T extends Record<string, string>>(dict: T) {
  return Object.fromEntries(Object.entries(dict).map(([key, value]) => [key, brandUserCopy(value)])) as T
}
