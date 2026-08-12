import { BRAND } from "@chimera/brand"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { TooltipV2 } from "@opencode-ai/ui/v2/tooltip-v2"
import { useLocation, useNavigate } from "@solidjs/router"
import { For, Show, createEffect, createMemo, createSignal, onCleanup, type Component, type JSX } from "solid-js"
import { ChimeraAvatar } from "@/components/chimera-avatar"
import { activeChimeraKeyName } from "@/components/chimera-keys"
import { useCommand } from "@/context/command"
import { useLayout } from "@/context/layout"
import { useModels } from "@/context/models"
import { usePlatform } from "@/context/platform"
import { useServerSync } from "@/context/server-sync"
import { useTabs } from "@/context/tabs"

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

  // 会话页内注册的上游命令；不在会话页时命令缺席，按钮自动灰置
  const hasCommand = (id: string) => command.options.some((option) => option.id === id)

  const top: Array<{
    id: string
    label: string
    onClick?: () => void
    active?: () => boolean
    command?: string
  }> = [
    { id: "chat", label: "会话", onClick: () => navigate("/"), active: onHome },
    { id: "files", label: "文件树", command: "fileTree.toggle" },
    { id: "git", label: "代码审查", command: "review.toggle" },
    { id: "terminal", label: "终端", command: "terminal.toggle" },
  ]

  const item = (entry: (typeof top)[number]) => {
    const disabled = () => (entry.command ? !hasCommand(entry.command) : false)
    const label = () => (disabled() ? `${entry.label}（会话内可用）` : entry.label)
    const onClick = () => {
      if (entry.command) {
        command.trigger(entry.command)
        return
      }
      entry.onClick?.()
    }
    return (
      <TooltipV2 placement="right" value={label()}>
        <button
          type="button"
          aria-label={entry.label}
          disabled={disabled()}
          class="flex size-8 items-center justify-center rounded-[6px] transition-colors"
          classList={{
            "text-v2-icon-icon-faint cursor-default": disabled(),
            "hover:bg-v2-overlay-simple-overlay-hover": !disabled(),
          }}
          style={
            entry.active?.()
              ? { background: "color-mix(in srgb, var(--v2-state-fg-warning) 14%, transparent)", color: "var(--v2-state-fg-warning)" }
              : { color: disabled() ? undefined : "var(--v2-icon-icon-muted)" }
          }
          onClick={onClick}
        >
          {ICONS[entry.id]}
        </button>
      </TooltipV2>
    )
  }

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
          class="flex items-center justify-center rounded-full transition-[filter] hover:brightness-110"
          onClick={openKeysPage}
        >
          <ChimeraAvatar size={26} />
        </button>
      </TooltipV2>
    </nav>
  )
}

export const ChimeraStatusBar: Component = () => {
  const platform = usePlatform()
  const layout = useLayout()
  const tabs = useTabs()
  const serverSync = useServerSync()

  const gatewayHost = createMemo(() => {
    try {
      return new URL(BRAND.gatewayUrl).host
    } catch {
      return BRAND.gatewayUrl
    }
  })

  // 当前路由对应的工作目录（与 DialogSettings 同款推导）
  const directory = createMemo(() => {
    const route = layout.route()
    if (route.type === "dir-new-sesssion") return route.dir
    if (route.type === "draft") {
      const draft = tabs.store.find((item) => item.type === "draft" && item.draftID === route.draftID)
      return draft?.type === "draft" ? draft.directory : undefined
    }
    if (route.type === "session") return serverSync().session.get(route.sessionId)?.directory
    return undefined
  })

  const branch = createMemo(() => {
    const dir = directory()
    if (!dir) return undefined
    return serverSync().child(dir)[0].vcs?.branch
  })

  // 会话消息在 session 服务 store（serverSync().session.data.message），
  // 目录 child store 的 message 是另一份按需数据，这里不用。
  const sessionMessages = createMemo(() => {
    const route = layout.route()
    if (route.type !== "session") return []
    return serverSync().session.data.message?.[route.sessionId] ?? []
  })

  // 当前会话累计费用（assistant 消息 cost 合计，设计稿 S1 状态栏"今日 ¥"的诚实近似）
  const sessionCost = createMemo(() =>
    sessionMessages().reduce(
      (sum, item) => sum + (item.role === "assistant" ? ((item as { cost?: number }).cost ?? 0) : 0),
      0,
    ),
  )

  // 上下文占用（设计稿 S1 渐变用量条）：最近一次请求 tokens ÷ 模型上下文窗口
  const models = useModels()
  const context = createMemo(() => {
    const messages = sessionMessages()
    for (let i = messages.length - 1; i >= 0; i--) {
      const item = messages[i] as {
        role: string
        providerID?: string
        modelID?: string
        tokens?: { input: number; output: number; reasoning: number; cache?: { read: number; write: number } }
      }
      if (item.role !== "assistant" || !item.tokens) continue
      const used = item.tokens.input + item.tokens.output + item.tokens.reasoning + (item.tokens.cache?.read ?? 0)
      if (used <= 0) continue
      const limit =
        item.providerID && item.modelID
          ? models.find({ providerID: item.providerID, modelID: item.modelID })?.limit?.context
          : undefined
      if (!limit) return undefined
      return { used, limit, pct: Math.min(100, Math.round((used / limit) * 100)) }
    }
    return undefined
  })

  const compact = (n: number) => (n >= 1000 ? `${Math.round(n / 1000)}k` : `${n}`)

  // 当前密钥名：chimera-keys 写入时广播事件，这里保持同步
  const [keyName, setKeyName] = createSignal(activeChimeraKeyName())
  const onKeysChanged = () => setKeyName(activeChimeraKeyName())
  window.addEventListener("chimera:keys-changed", onKeysChanged)
  onCleanup(() => window.removeEventListener("chimera:keys-changed", onKeysChanged))

  return (
    <footer
      data-component="chimera-statusbar"
      class="flex h-[24px] shrink-0 items-center justify-between border-t-[0.5px] border-v2-border-border-muted px-3"
    >
      <div class="flex items-center gap-3">
        <Show when={branch()} fallback={<span class="font-mono text-[10.5px] text-v2-text-text-faint">{BRAND.name}</span>}>
          <span class="flex items-center gap-1 font-mono text-[10.5px] text-v2-text-text-muted">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="size-3">
              <line x1="6" x2="6" y1="3" y2="15" />
              <circle cx="18" cy="6" r="3" />
              <circle cx="6" cy="18" r="3" />
              <path d="M18 9a9 9 0 0 1-9 9" />
            </svg>
            {branch()}
          </span>
        </Show>
      </div>
      <div class="flex items-center gap-3">
        <Show when={keyName()}>
          <span class="font-mono text-[10.5px] text-v2-text-text-faint" title="当前密钥（Ctrl+Shift+K 切换）">
            密钥 {keyName()}
          </span>
        </Show>
        <Show when={sessionCost() > 0}>
          <span class="font-mono text-[10.5px] text-v2-text-text-faint" title="当前会话累计费用">
            会话 ${sessionCost() < 0.01 ? sessionCost().toFixed(4) : sessionCost().toFixed(2)}
          </span>
        </Show>
        <Show when={context()}>
          {(ctx) => (
            <span
              class="flex items-center gap-1.5 font-mono text-[10.5px] text-v2-text-text-faint"
              title={`上下文 ${compact(ctx().used)} / ${compact(ctx().limit)} tokens`}
            >
              上下文
              <span class="relative inline-block h-[3px] w-[44px] overflow-hidden rounded-full bg-v2-background-bg-layer-03">
                <span
                  class="absolute inset-y-0 left-0 rounded-full"
                  style={{
                    width: `${Math.max(2, ctx().pct)}%`,
                    background: "linear-gradient(90deg, #DEA54C, #46C39A)",
                  }}
                />
              </span>
              {ctx().pct}%
            </span>
          )}
        </Show>
        <span class="flex items-center gap-1.5 font-mono text-[10.5px] text-v2-text-text-faint" title="网关连接">
          <span class="inline-block size-1.5 rounded-full" style={{ background: "var(--v2-state-fg-success)" }} />
          {gatewayHost()}
        </span>
        <span class="font-mono text-[10.5px] text-v2-text-text-faint">v{platform.version}</span>
      </div>
    </footer>
  )
}
