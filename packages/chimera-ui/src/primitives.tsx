/**
 * Chimera 基础视觉原语（Phase 1）。
 *
 * 规则：
 * - 纯展示组件，只接收 props / 回调，不读取 app context
 * - 颜色一律走 Semantic CSS 变量（--chimera-*），禁止直接写 Hex
 * - 字体走 tokens.font（display 为 Geist Variable）
 */
import { splitProps, type JSX } from "solid-js"

/** 语义表面容器：panel / inset / shell。 */
export function FieldSurface(props: {
  variant?: "panel" | "inset" | "shell"
  class?: string
  children?: JSX.Element
}) {
  const [local, rest] = splitProps(props, ["variant", "class", "children"])
  const bg = () =>
    local.variant === "inset"
      ? "var(--chimera-surface3)"
      : local.variant === "shell"
        ? "var(--chimera-surface1)"
        : "var(--chimera-surface2)"
  return (
    <div
      {...rest}
      class={local.class}
      style={{ background: bg(), "border-radius": "var(--chimera-radius-panel, 10px)", border: "0.5px solid var(--chimera-hairline)" }}
    >
      {local.children}
    </div>
  )
}

/** 状态徽标：signal.intent（进行中/注意）/ signal.execute（完成/连接）/ signal.danger。 */
export function SignalBadge(props: {
  tone: "intent" | "execute" | "danger"
  label: string
  class?: string
}) {
  const color = () =>
    props.tone === "intent"
      ? "var(--chimera-signal-intent)"
      : props.tone === "danger"
        ? "var(--chimera-signal-danger)"
        : "var(--chimera-signal-execute)"
  return (
    <span
      class={props.class}
      style={{
        display: "inline-flex",
        "align-items": "center",
        gap: "4px",
        "font-family": "var(--font-family-mono)",
        "font-size": "10.5px",
        color: color(),
        background: `color-mix(in srgb, ${color()} 15%, transparent)`,
        "border-radius": "4px",
        padding: "1px 6px",
      }}
    >
      <span style={{ width: "5px", height: "5px", "border-radius": "50%", background: color() }} />
      {props.label}
    </span>
  )
}

/** 发丝线分隔（0.5px，语义 hairline）。 */
export function HairlineDivider(props: { strong?: boolean; class?: string }) {
  return (
    <div
      class={props.class}
      style={{
        height: "0.5px",
        background: props.strong ? "var(--chimera-hairlineStrong)" : "var(--chimera-hairline)",
      }}
    />
  )
}

/** 能力标签（mono 数据样式，如 "200k ctx" / "reasoning"）。 */
export function CapabilityTag(props: { label: string; tone?: "intent" | "execute" | "neutral"; class?: string }) {
  const color = () =>
    props.tone === "intent"
      ? "var(--chimera-signal-intent)"
      : props.tone === "execute"
        ? "var(--chimera-signal-execute)"
        : "var(--chimera-text-secondary)"
  return (
    <span
      class={props.class}
      style={{
        "font-family": "var(--font-family-mono)",
        "font-size": "10.5px",
        color: color(),
        border: "0.5px solid var(--chimera-hairlineStrong)",
        "border-radius": "4px",
        padding: "0 5px",
        "line-height": "16px",
        "white-space": "nowrap",
      }}
    >
      {props.label}
    </span>
  )
}

/** 容量/用量条：usageLow（execute）→ usageHigh（intent 告警）。 */
export function FieldMeter(props: {
  /** 0..1 */
  ratio: number
  label?: string
  class?: string
}) {
  const clamped = () => Math.max(0, Math.min(1, props.ratio))
  const color = () =>
    clamped() > 0.85 ? "var(--chimera-signal-intent)" : "var(--chimera-signal-execute)"
  return (
    <div class={props.class} style={{ display: "flex", "align-items": "center", gap: "6px" }}>
      <div
        style={{
          flex: 1,
          height: "3px",
          "border-radius": "2px",
          background: "var(--chimera-hairline)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${clamped() * 100}%`,
            height: "100%",
            background: color(),
            transition: "width 220ms ease",
          }}
        />
      </div>
      <Show label={props.label} ratio={clamped()} />
    </div>
  )
}

function Show(props: { label?: string; ratio: number }) {
  if (!props.label) return null
  return (
    <span style={{ "font-family": "var(--font-family-mono)", "font-size": "10.5px", color: "var(--chimera-text-secondary)" }}>
      {props.label}
    </span>
  )
}

/** 品牌标：奇美拉渐变线（熔金 → 青金），仅用于品牌层级。 */
export function ChimeraMark(props: { size?: number; class?: string; title?: string }) {
  const size = props.size ?? 16
  return (
    <span
      class={props.class}
      title={props.title}
      style={{
        display: "inline-block",
        width: `${size}px`,
        height: `${size}px`,
        "border-radius": `${size * 0.24}px`,
        background:
          "linear-gradient(135deg, var(--chimera-strand-from, #dea54c) 0%, var(--chimera-strand-to, #46c39a) 100%)",
        position: "relative",
      }}
    >
      {/* 简洁的奇美拉剪影：以对角渐变 + 内嵌高光模拟 */}
      <span
        style={{
          position: "absolute",
          inset: "20%",
          "border-radius": "50%",
          background: "var(--chimera-bg, #0c100f)",
          opacity: 0.92,
        }}
      />
    </span>
  )
}
