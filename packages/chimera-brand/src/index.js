// Chimera 品牌常量：所有品牌相关值的唯一来源。
// 纯新增包，不与上游文件冲突；发布为无构建步骤的 ESM + 手写类型。
export const BRAND = {
  name: "Chimera",
  nameLower: "chimera",
  appId: "io.chimera.desktop",
  scheme: "chimera",
  // 品牌产品版本（状态栏、关于页展示），独立于上游 opencode 版本号
  version: "0.1.0",
  gatewayUrl: "https://api.chimerahub.org/",
  homepage: "https://chimerahub.org",
  github: { owner: "Duojiyi", repo: "chimera-code" },
}
