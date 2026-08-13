// Chimera 品牌常量：所有品牌相关值的唯一来源。
// 纯新增包，不与上游文件冲突；发布为无构建步骤的 ESM + 手写类型。
export const BRAND = {
  name: "Chimera",
  nameLower: "chimera",
  appId: "io.chimera.desktop",
  scheme: "chimera",
  // 品牌产品版本（状态栏、关于页展示），独立于上游 opencode 版本号
  version: "0.1.4",
  gatewayUrl: "https://api.chimerahub.org/",
  homepage: "https://chimerahub.org",
  github: { owner: "Duojiyi", repo: "chimera-code" },
  issues: "https://github.com/Duojiyi/chimera-code/issues/new",
  releases: "https://github.com/Duojiyi/chimera-code/releases",
}

const homepageHost = new URL(BRAND.homepage).host

/**
 * 把用户可见文案里的上游品牌替换成 Chimera。
 * 在语言包加载时统一套用，避免改几十份上游 locale 文件（便于 rebase）。
 */
export function brandUserCopy(text) {
  if (typeof text !== "string") return text
  if (
    !/OpenCode|opencode\.ai|opencode\.json|Discord|opencode is not|opencode is installed|'opencode' command/i.test(
      text,
    )
  )
    return text
  return text
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
    .replaceAll("'opencode' command", `'${BRAND.nameLower}' command`)
    .replaceAll("opencode is not installed", "the engine is not installed")
    .replaceAll("opencode is installed but could not run", "the engine is installed but could not run")
}

export function brandUserDict(dict) {
  const out = { ...dict }
  for (const key of Object.keys(out)) {
    const value = out[key]
    if (typeof value === "string") out[key] = brandUserCopy(value)
  }
  return out
}
