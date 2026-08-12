import type { Plugin } from "vite"

const I18N_MODULE = /[\\/]i18n[\\/][^\\/]+\.tsx?$/

/**
 * 品牌文案精确替换表：设计稿指定的措辞覆盖（S1 输入框 placeholder 等）。
 * 键为上游字典原值，值为 Chimera 文案；仅整串精确匹配，避免波及其他键。
 */
const COPY_OVERRIDES: [string, string][] = [
  [
    "随便问点什么， {{slash}} 可查看命令， {{at}} 可添加上下文...",
    "输入指令，{{at}} 引用文件，{{slash}} 调用命令…",
  ],
  [
    "Ask anything, {{slash}} for commands, {{at}} for context...",
    "Type an instruction, {{at}} to reference files, {{slash}} for commands…",
  ],
  ["搜索文件、命令和会话", "搜索命令、文件、会话…"],
  ["Search files, commands, and sessions", "Search commands, files, and sessions…"],
]

/**
 * 构建时品牌文案替换：仅作用于 i18n 字典模块，把展示用产品名
 * "OpenCode" 替换为 "Chimera"，并应用设计稿措辞覆盖表。不触碰 URL、
 * 配置键等小写 "opencode" 标识符，保证功能语义不变；上游字典文件
 * 零修改，rebase 无冲突。
 */
export function chimeraBrand(): Plugin {
  return {
    name: "chimera:brand-strings",
    enforce: "pre",
    transform(code, id) {
      if (!I18N_MODULE.test(id)) return
      const replaced = COPY_OVERRIDES.reduce(
        (acc, [from, to]) => (acc.includes(from) ? acc.replaceAll(from, to) : acc),
        code,
      )
      if (!replaced.includes("OpenCode") && replaced === code) return
      return { code: replaced.replaceAll("OpenCode", "Chimera"), map: null }
    },
  }
}
