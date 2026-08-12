import { BRAND } from "@chimera/brand"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { TooltipV2 } from "@opencode-ai/ui/v2/tooltip-v2"
import { useLocation, useNavigate } from "@solidjs/router"
import { For, Show, createMemo, type Component, type JSX } from "solid-js"
import { useCommand } from "@/context/command"

// Chimera 应用骨架（设计稿 S1）：左侧图标栏 + 底部状态栏。
// 纯新增组件，仅在 layout 挂载一行；图标为内嵌 SVG，避免依赖上游图标清单。
// TODO(chimera): 文案待补 i18n 键；状态栏的分支/费用/延迟等实时数据待接。

const stroke = (d: string) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-[17px]">
    {/* eslint-disable-next-line solid/no-innerhtml */}
    <g innerHTML={d} />
  </svg>
)

const ICONS: Record<string, JSX.Element> = {
  chat: stroke('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>'),
  files: stroke(
    '<path d="M20 7h-3a2 2 0 0 1-2-2V2"/><path d="M9 18a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h7l5 5v9a2 2 0 0 1-2 2Z"/><path d="M3 7.6v12.8A1.6 1.6 0 0 0 4.6 22h9.8"/>',
  ),
  git: stroke('<line x1="6" x2="6" y1="3" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/>'),
  terminal: stroke('<path d="m7 11 2-2-2-2"/><path d="M11 13h4"/><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>'),
  settings: stroke(
    '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
  ),
}

export const ChimeraRail: Component = () => {
  const dialog = useDialog()
  const navigate = useNavigate()
  const location = useLocation()

  const onHome = createMemo(() => location.pathname === "/" || location.pathname === "")

  const openSettings = () => {
    void import("./settings-v2").then((x) => {
      void dialog.show(() => <x.DialogSettings />)
    })
  }

  const openKeys = () => {
    void import("./chimera-keys").then((x) => {
      void dialog.show(() => <x.ChimeraKeysDialog />)
    })
  }

  const openKeysPage = () => {
    void import("./settings-v2").then((x) => {
      void dialog.show(() => <x.DialogSettings defaultValue="keys" />)
    })
  }

  // ⌘⇧K / Ctrl+Shift+K：任意界面快速切换密钥（设计稿 S6）
  const command = useCommand()
  command.register(() => [
    {
      id: "chimera.keys.switch",
      title: "切换密钥",
      description: "在中转站的多条密钥间切换",
      keybind: "ctrl+shift+k,meta+shift+k",
      onSelect: openKeys,
    },
  ])

  const top: Array<{ id: string; label: string; onClick?: () => void; active?: () => boolean; disabled?: boolean }> = [
    { id: "chat", label: "会话", onClick: () => navigate("/"), active: onHome },
    { id: "files", label: "文件（会话内可用）", disabled: true },
    { id: "git", label: "源代码管理（会话内可用）", disabled: true },
    { id: "terminal", label: "终端（会话内可用）", disabled: true },
  ]

  const item = (entry: (typeof top)[number]) => (
    <TooltipV2 placement="right" value={entry.label}>
      <button
        type="button"
        aria-label={entry.label}
        disabled={entry.disabled}
        class="flex size-8 items-center justify-center rounded-[6px] transition-colors"
        classList={{
          "text-v2-icon-icon-faint cursor-default": !!entry.disabled,
          "hover:bg-v2-overlay-simple-overlay-hover": !entry.disabled,
        }}
        style={
          entry.active?.()
            ? { background: "color-mix(in srgb, var(--v2-state-fg-warning) 14%, transparent)", color: "var(--v2-state-fg-warning)" }
            : { color: entry.disabled ? undefined : "var(--v2-icon-icon-muted)" }
        }
        onClick={entry.onClick}
      >
        {ICONS[entry.id]}
      </button>
    </TooltipV2>
  )

  return (
    <nav
      data-component="chimera-rail"
      class="flex w-[46px] shrink-0 flex-col items-center gap-1.5 border-r-[0.5px] border-v2-border-border-muted py-2.5"
      aria-label={`${BRAND.name} 导航`}
    >
      <For each={top}>{item}</For>
      <div class="flex-1" />
      {item({ id: "settings", label: "设置", onClick: openSettings })}
      <TooltipV2 placement="right" value="账户与密钥">
        <button
          type="button"
          aria-label="账户与密钥"
          class="flex size-[26px] items-center justify-center rounded-full text-[11px] font-bold hover:brightness-105"
          style={{ background: "linear-gradient(135deg, #DEA54C, #46C39A)", color: "#10231D" }}
          onClick={openKeysPage}
        >
          多
        </button>
      </TooltipV2>
    </nav>
  )
}

export const ChimeraStatusBar: Component = () => {
  const gatewayHost = createMemo(() => {
    try {
      return new URL(BRAND.gatewayUrl).host
    } catch {
      return BRAND.gatewayUrl
    }
  })

  return (
    <footer
      data-component="chimera-statusbar"
      class="flex h-[24px] shrink-0 items-center justify-between border-t-[0.5px] border-v2-border-border-muted px-3"
    >
      <div class="flex items-center gap-2">
        <span class="font-mono text-[10.5px] text-v2-text-text-faint">{BRAND.name} v0.1.0</span>
      </div>
      <div class="flex items-center gap-3">
        <span class="flex items-center gap-1.5 font-mono text-[10.5px] text-v2-text-text-faint">
          <Show when={true}>
            <span class="inline-block size-1.5 rounded-full" style={{ background: "var(--v2-state-fg-success)" }} />
          </Show>
          {gatewayHost()}
        </span>
      </div>
    </footer>
  )
}
