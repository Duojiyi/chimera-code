import { Mark } from "@opencode-ai/ui/logo"
import type { Component } from "solid-js"

// 奇美拉头像：熔金→青金渐变圆 + 深色神兽标（设计稿 S1/S6 左下角与账号卡）
export const ChimeraAvatar: Component<{ size?: number; class?: string }> = (props) => {
  const size = () => props.size ?? 26
  return (
    <span
      class={`flex shrink-0 items-center justify-center rounded-full ${props.class ?? ""}`}
      style={{
        width: `${size()}px`,
        height: `${size()}px`,
        background: "linear-gradient(135deg, #DEA54C, #46C39A)",
        "--icon-strong-base": "#10231D",
        "--icon-base": "#10231D",
      }}
      aria-hidden="true"
    >
      <Mark class={size() <= 18 ? "size-[72%]" : "size-[62%]"} />
    </span>
  )
}
