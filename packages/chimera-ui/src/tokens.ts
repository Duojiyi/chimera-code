/**
 * Chimera 设计 token（与设计稿 design/ 的 `ch-*` 变量一一对应）。
 *
 * 三层模型（路线图 Phase 1）：
 * - Primitive：原始色值/尺寸/圆角/动效，组件禁止直接引用
 * - Semantic：UI 语义 → Primitive 映射（bg/text/border/signal）
 * - Component：组件层 token（spine/ribbon/ledger/composer）
 *
 * 设计语言：墨青画布 + 熔金意图（Amber Intent）× 青金执行（Viridian Execution）；
 * 奇美拉渐变（熔金 → 青金）仅用于品牌标、流式输出进度与上下文用量条。
 */

// ── Primitive：色板（与设计稿 ch-* 一一对应）───────────────────────────
const darkPalette = {
  bg: "#0C100F",
  surface1: "#111615",
  surface2: "#161C1A",
  surface3: "#1D2422",
  hairline: "#FFFFFF12",
  hairlineStrong: "#FFFFFF1F",
  text1: "#ECEFED",
  text2: "#9AA4A0",
  text3: "#5F6A66",
  amber: "#DEA54C",
  amberDim: "#DEA54C24",
  viridian: "#46C39A",
  viridianDim: "#46C39A22",
  danger: "#D96A5B",
  onAccent: "#221703",
} as const

const lightPalette = {
  bg: "#F4F6F4",
  surface1: "#FFFFFF",
  surface2: "#EFF3F0",
  surface3: "#E4EAE6",
  hairline: "#00000012",
  hairlineStrong: "#00000021",
  text1: "#1B211F",
  text2: "#5A655F",
  text3: "#8C968F",
  amber: "#9A681B",
  amberDim: "#9A681B1F",
  viridian: "#1E8E6A",
  viridianDim: "#1E8E6A1C",
  danger: "#BE4936",
  onAccent: "#FFFFFF",
} as const

export type PaletteKey = keyof typeof darkPalette

// ── Semantic：UI 语义 → Primitive 键映射 ───────────────────────────────
// 组件只引用语义名；主题切换时同一语义名解析到对应主题的 Primitive。
export const semantic = {
  bg: { canvas: "bg", shell: "surface1", panel: "surface2", inset: "surface3" },
  text: { primary: "text1", secondary: "text2", faint: "text3" },
  border: { hairline: "hairline", hairlineStrong: "hairlineStrong" },
  signal: {
    intent: "amber",
    intentDim: "amberDim",
    execute: "viridian",
    executeDim: "viridianDim",
    danger: "danger",
  },
} as const

export type SemanticToken = {
  [K in keyof typeof semantic]: {
    [S in keyof (typeof semantic)[K]]: string
  }
}

/** 解析语义 token 到指定主题的色值。 */
export function resolve(theme: ChimeraTheme, path: [string, string]): string {
  const [group, name] = path
  const entry = semantic[group as keyof typeof semantic] as Record<string, PaletteKey>
  const key = entry[name]
  return (theme === "dark" ? darkPalette : lightPalette)[key]
}

// ── Component：组件层 token（Phase 2/3 落地填充）───────────────────────
export const component = {
  spine: { itemActive: "execute" },
  strip: { statusOk: "execute" },
  ribbon: { usageLow: "execute", usageHigh: "intent" },
  ledger: { complete: "executeDim", active: "intent" },
  composer: { borderLive: "intent" },
} as const

// ── 尺寸/圆角/动效/字阶 ────────────────────────────────────────────────
export const space = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 7: 32, 8: 40 } as const
export const radius = { control: 6, panel: 10, surface: 12 } as const
export const motion = { fast: 150, base: 220, slow: 400 } as const
export const typeScale = { data: 11.5, body: 13.5, title: 16, display: 20 } as const

export const tokens = {
  dark: darkPalette,
  light: lightPalette,
  font: {
    ui: "Noto Sans SC",
    mono: "JetBrains Mono",
    display: "Geist Variable",
  },
  /** 奇美拉渐变线：工作中是火（熔金），落地即成青（青金）。 */
  strand: (theme: "dark" | "light") =>
    theme === "dark" ? (["#DEA54C", "#46C39A"] as const) : (["#9A681B", "#1E8E6A"] as const),
  semantic,
  component,
  space,
  radius,
  motion,
  typeScale,
} as const

export type ChimeraTheme = keyof Pick<typeof tokens, "dark" | "light">
