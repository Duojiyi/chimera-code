import type { Plugin } from "vite"

const I18N_MODULE = /[\\/]i18n[\\/][^\\/]+\.tsx?$/

/**
 * 构建时品牌文案替换：仅作用于 i18n 字典模块，把展示用产品名
 * "OpenCode" 替换为 "Chimera"。不触碰 URL、配置键等小写 "opencode"
 * 标识符，保证功能语义不变；上游字典文件零修改，rebase 无冲突。
 */
export function chimeraBrand(): Plugin {
  return {
    name: "chimera:brand-strings",
    enforce: "pre",
    transform(code, id) {
      if (!I18N_MODULE.test(id)) return
      if (!code.includes("OpenCode")) return
      return { code: code.replaceAll("OpenCode", "Chimera"), map: null }
    },
  }
}
