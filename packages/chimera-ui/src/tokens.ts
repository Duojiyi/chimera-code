/**
 * Chimera 设计 token（与设计稿 design/ 的 `ch-*` 变量一一对应）。
 *
 * 设计语言：墨青画布 + 熔金主强调 + 青金完成色；
 * 奇美拉渐变（熔金 → 青金）仅用于品牌标、流式输出进度与上下文用量条。
 */
export const tokens = {
  dark: {
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
  },
  light: {
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
  },
  font: {
    ui: "Noto Sans SC",
    mono: "JetBrains Mono",
    display: "Space Grotesk",
  },
  /** 奇美拉渐变线：工作中是火（熔金），落地即成青（青金）。 */
  strand: (theme: "dark" | "light") =>
    theme === "dark" ? (["#DEA54C", "#46C39A"] as const) : (["#9A681B", "#1E8E6A"] as const),
} as const

export type ChimeraTheme = keyof Pick<typeof tokens, "dark" | "light">
