import "@fontsource/noto-sans-sc/400.css"
import "@fontsource/noto-sans-sc/500.css"
import "@fontsource/noto-sans-sc/700.css"
import "@fontsource/jetbrains-mono/400.css"
import "@fontsource/jetbrains-mono/500.css"
import "@fontsource/jetbrains-mono/700.css"
import "@fontsource-variable/geist"
import "./fonts.css"
import "./overrides.css"

import { resolve, tokens } from "./tokens"

export { component, motion, radius, resolve, semantic, space, tokens, typeScale } from "./tokens"
export type { ChimeraTheme, PaletteKey } from "./tokens"

/**
 * Chimera UI 挂载入口（副作用 import）。
 *
 * 三层 token：Primitive 色板（--chimera-{theme}-{key}）+ Semantic 语义变量
 * （--chimera-{group}-{name}，按当前主题解析到色板）。组件层 token 随
 * Phase 2/3 组件落地时引用 Semantic，不直接写 Hex。
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
  // Semantic 语义变量：按当前主题（data-color-scheme，默认 dark）解析到色板。
  const active = (document.documentElement.getAttribute("data-color-scheme") ?? "dark") as "dark" | "light"
  for (const [group, entries] of Object.entries(tokens.semantic)) {
    for (const name of Object.keys(entries)) {
      root.style.setProperty(`--chimera-${group}-${name}`, resolve(active, [group, name]))
    }
  }
  // 监听主题切换，保持语义变量同步。
  const observer = new MutationObserver(() => {
    const theme = (document.documentElement.getAttribute("data-color-scheme") ?? "dark") as "dark" | "light"
    for (const [group, entries] of Object.entries(tokens.semantic)) {
      for (const name of Object.keys(entries)) {
        root.style.setProperty(`--chimera-${group}-${name}`, resolve(theme, [group, name]))
      }
    }
  })
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-color-scheme"] })
}

mount()
