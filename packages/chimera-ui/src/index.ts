import "@fontsource/noto-sans-sc/400.css"
import "@fontsource/noto-sans-sc/500.css"
import "@fontsource/noto-sans-sc/700.css"
import "@fontsource/jetbrains-mono/400.css"
import "@fontsource/jetbrains-mono/500.css"
import "@fontsource/space-grotesk/500.css"
import "@fontsource/space-grotesk/600.css"
import "./fonts.css"
import "./overrides.css"

import { tokens } from "./tokens"

export { tokens } from "./tokens"
export type { ChimeraTheme } from "./tokens"

/**
 * Chimera UI 挂载入口（副作用 import）。
 *
 * 当前骨架仅把设计 token 暴露为 CSS 自定义属性（`--chimera-*`），
 * 供后续的样式覆盖与自有界面（S5 连接网关、S6 密钥管理等）使用。
 * 按设计稿实现的组件将逐步在本包内落地，接入点保持这一行 import 不变。
 */
function mount() {
  if (typeof document === "undefined") return
  const root = document.documentElement
  for (const [theme, palette] of [
    ["dark", tokens.dark],
    ["light", tokens.light],
  ] as const) {
    for (const [key, value] of Object.entries(palette)) {
      root.style.setProperty(`--chimera-${theme}-${key}`, value)
    }
  }
}

mount()
