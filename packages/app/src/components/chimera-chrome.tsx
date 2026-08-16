import { BRAND } from "@chimera/brand"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { useTheme } from "@opencode-ai/ui/theme/context"
import { TooltipV2 } from "@opencode-ai/ui/v2/tooltip-v2"
import { MenuV2 } from "@opencode-ai/ui/v2/menu-v2"
import { useLocation, useNavigate } from "@solidjs/router"
import { For, Show, createMemo, createSignal, onCleanup, type Component, type JSX } from "solid-js"
import { ChimeraAvatar } from "@/components/chimera-avatar"
import {
  hasChimeraAuth,
  readChimeraKeys,
  requestChimeraKeyPicker,
  switchChimeraKey,
  type ChimeraKeyEntry,
} from "@/components/chimera-keys"
import { useCommand } from "@/context/command"
import { useLanguage } from "@/context/language"
import { useLayout } from "@/context/layout"
import { usePlatform } from "@/context/platform"
import { useServerSDK } from "@/context/server-sdk"
import { useServerSync } from "@/context/server-sync"
import { useTabs } from "@/context/tabs"
import { useWorkspaceBranch, useSessionDiff, useWorkspaceDirectory } from "@/chimera/workspace"
import { showToast } from "@/utils/toast"

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
  sun: stroke(
    '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
  ),
  moon: stroke('<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>'),
}

export const ChimeraRail: Component = () => {
  const dialog = useDialog()
  const navigate = useNavigate()
  const location = useLocation()
  const language = useLanguage()
  const theme = useTheme()

  const onHome = createMemo(() => location.pathname === "/" || location.pathname === "")

  const openSettings = () => {
    void import("./settings-v2").then((x) => {
      void dialog.show(() => <x.DialogSettings />)
    })
  }

  const openConnect = () => {
    void import("./chimera-connect").then((x) => {
      void dialog.show(() => <x.ChimeraConnectDialog />)
    })
  }

  const openKeysPage = () => {
    if (!hasChimeraAuth()) {
      openConnect()
      return
    }
    void import("./settings-v2").then((x) => {
      void dialog.show(() => <x.DialogSettings defaultValue="keys" />)
    })
  }

  // ⌘⇧K / Ctrl+Shift+K：任意界面打开密钥快速切换菜单
  const command = useCommand()
  command.register(() => [
    {
      id: "chimera.keys.switch",
      title: language.t("chimera.command.switchKey.title"),
      description: language.t("chimera.command.switchKey.description"),
      keybind: "ctrl+shift+k,meta+shift+k",
      onSelect: () => {
        if (!hasChimeraAuth()) {
          openConnect()
          return
        }
        if (readChimeraKeys().keys.length === 0) {
          openKeysPage()
          return
        }
        requestChimeraKeyPicker()
      },
    },
  ])

  // 会话页内注册的上游命令；不在会话页时命令缺席，按钮自动灰置
  const hasCommand = (id: string) => command.options.some((option) => option.id === id)

  const top: Array<{
    id: string
    label: () => string
    onClick?: () => void
    active?: () => boolean
    command?: string
  }> = [
    { id: "chat", label: () => language.t("chimera.nav.sessions"), onClick: () => navigate("/"), active: onHome },
    { id: "files", label: () => language.t("chimera.nav.fileTree"), command: "fileTree.toggle" },
    { id: "git", label: () => language.t("chimera.nav.review"), command: "review.toggle" },
    { id: "terminal", label: () => language.t("chimera.nav.terminal"), command: "terminal.toggle" },
  ]

  const item = (entry: (typeof top)[number]) => {
    const disabled = () => (entry.command ? !hasCommand(entry.command) : false)
    const label = () =>
      disabled() ? language.t("chimera.nav.sessionOnly", { label: entry.label() }) : entry.label()
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
          aria-label={entry.label()}
          disabled={disabled()}
          class="flex size-8 items-center justify-center rounded-[6px] transition-colors"
          classList={{
            "text-v2-icon-icon-faint cursor-default": disabled(),
            "hover:bg-v2-overlay-simple-overlay-hover": !disabled(),
          }}
          style={
            entry.active?.()
              ? { background: "color-mix(in srgb, var(--chimera-accent) 14%, transparent)", color: "var(--chimera-accent)" }
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
      aria-label={language.t("chimera.nav.label", { name: BRAND.name })}
    >
      <For each={top}>{item}</For>
      <div class="flex-1" />
      {/* 深浅色快速切换（点击在 light/dark 间轮换） */}
      <TooltipV2 placement="right" value={language.t("chimera.nav.theme")}>
        <button
          type="button"
          aria-label={language.t("chimera.nav.theme")}
          class="flex size-8 items-center justify-center rounded-[6px] transition-colors hover:bg-v2-overlay-simple-overlay-hover"
          style={{ color: "var(--v2-icon-icon-muted)" }}
          onClick={() => theme.setColorScheme(theme.mode() === "dark" ? "light" : "dark")}
        >
          <Show when={theme.mode() === "dark"} fallback={ICONS.moon}>
            {ICONS.sun}
          </Show>
        </button>
      </TooltipV2>
      {item({ id: "settings", label: () => language.t("chimera.nav.settings"), onClick: openSettings })}
      <TooltipV2 placement="right" value={language.t("chimera.nav.account")}>
        <button
          type="button"
          aria-label={language.t("chimera.nav.account")}
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
  const dialog = useDialog()
  const serverSDK = useServerSDK()
  const serverSync = useServerSync()
  const language = useLanguage()

  const gatewayHost = createMemo(() => {
    try {
      return new URL(BRAND.gatewayUrl).host
    } catch {
      return BRAND.gatewayUrl
    }
  })

  // 网关延迟探测（设计稿 S1 状态栏「● 网关 42ms」）：60s 一次轻量状态请求测 RTT
  const [latency, setLatency] = createSignal<number | undefined>(undefined)
  const probeGateway = async () => {
    const started = performance.now()
    try {
      await fetch(new URL("/api/status", BRAND.gatewayUrl), { method: "GET", mode: "no-cors", cache: "no-store" })
      setLatency(Math.max(1, Math.round(performance.now() - started)))
    } catch {
      setLatency(undefined)
    }
  }
  void probeGateway()
  const probeTimer = setInterval(() => void probeGateway(), 60_000)
  onCleanup(() => clearInterval(probeTimer))

  // Phase 2：工作区状态统一走 app/src/chimera adapter（路线图 App Adapters 层）。
  const directory = useWorkspaceDirectory()
  const branch = useWorkspaceBranch(directory)
  const sessionDiff = useSessionDiff()

  // 工作区显示名（Workspace Strip）：目录 basename（无工作区时为空）。
  const workspaceName = createMemo(() => {
    const dir = directory()
    if (!dir) return undefined
    const normalized = dir.replace(/[\\/]+$/, "")
    const base = normalized.split(/[\\/]/).pop()
    return base || normalized
  })

  const [keysState, setKeysState] = createSignal(readChimeraKeys())
  const [pickerOpen, setPickerOpen] = createSignal(false)
  const [pending, setPending] = createSignal("")
  const keyName = () => keysState().keys.find((item) => item.id === keysState().active)?.name
  const onKeysChanged = () => setKeysState(readChimeraKeys())
  const onKeysPicker = () => {
    if (readChimeraKeys().keys.length === 0) return
    setPickerOpen(true)
  }
  window.addEventListener("chimera:keys-changed", onKeysChanged)
  window.addEventListener("chimera:keys-picker", onKeysPicker)
  onCleanup(() => {
    window.removeEventListener("chimera:keys-changed", onKeysChanged)
    window.removeEventListener("chimera:keys-picker", onKeysPicker)
  })

  const activate = async (entry: ChimeraKeyEntry) => {
    if (pending() || entry.id === keysState().active) return
    setPending(entry.id)
    try {
      await switchChimeraKey({
        entry,
        sdk: serverSDK(),
        directory: directory(),
      })
      void serverSync().refreshProviders()
      showToast({ title: language.t("chimera.keys.switched", { name: entry.name }), variant: "default" })
    } catch {
      showToast({ title: language.t("chimera.keys.switchFailed"), variant: "default" })
    } finally {
      setPending("")
    }
  }

  const openKeysPage = () => {
    void import("./settings-v2").then((x) => {
      void dialog.show(() => <x.DialogSettings defaultValue="keys" />)
    })
  }

  return (
    <footer
      data-component="chimera-statusbar"
      class="flex h-[24px] shrink-0 items-center justify-between border-t-[0.5px] border-v2-border-border-muted px-3"
    >
      <div class="flex items-center gap-3">
        <Show when={workspaceName()}>
          {(name) => (
            <span class="flex items-center gap-1 font-mono text-[10.5px] text-v2-text-text-muted" title={directory()}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="size-3">
                <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              </svg>
              <span class="max-w-[180px] truncate">{name()}</span>
            </span>
          )}
        </Show>
        <Show when={branch()} fallback={<Show when={!workspaceName()}><span class="font-mono text-[10.5px] text-v2-text-text-faint">{BRAND.name}</span></Show>}>
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
        <Show when={sessionDiff()}>
          {(diff) => (
            <span class="flex items-center gap-1.5 font-mono text-[10.5px]" title={language.t("chimera.status.changes.tooltip")}>
              <span style={{ color: "var(--v2-state-fg-success)" }}>+{diff().additions}</span>
              <span style={{ color: "var(--v2-state-fg-danger)" }}>-{diff().deletions}</span>
              <span class="text-v2-text-text-faint">
                {language.t("chimera.status.changes", { count: `${diff().files}` })}
              </span>
            </span>
          )}
        </Show>
      </div>
      <div class="flex items-center gap-3">
        <Show when={keysState().keys.length > 0}>
          <div class="flex items-center gap-1.5">
            <span class="font-mono text-[10.5px] text-v2-text-text-muted">{language.t("chimera.status.key.label")}</span>
            <MenuV2 gutter={6} modal={false} placement="top-end" open={pickerOpen()} onOpenChange={setPickerOpen}>
              <MenuV2.Trigger
                class="inline-flex h-5 max-w-[160px] cursor-pointer appearance-none items-center gap-1 rounded-[4px] border border-v2-border-border-strong bg-v2-background-bg-layer-01 px-1.5 font-mono text-[10.5px] text-v2-text-text-base hover:bg-v2-overlay-simple-overlay-hover focus-visible:outline-none data-[expanded]:bg-v2-overlay-simple-overlay-hover"
                aria-label={language.t("chimera.status.key.tooltip")}
                title={language.t("chimera.status.key.tooltip")}
              >
                <span class="truncate">{keyName() ?? language.t("chimera.keys.disconnected")}</span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="size-2.5 shrink-0 text-v2-icon-icon-muted" aria-hidden="true">
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </MenuV2.Trigger>
              <MenuV2.Portal>
                <MenuV2.Content>
                  <MenuV2.Group>
                    <MenuV2.GroupLabel>{language.t("chimera.command.switchKey.title")}</MenuV2.GroupLabel>
                    <MenuV2.RadioGroup value={keysState().active}>
                      <For each={keysState().keys}>
                        {(entry) => (
                          <MenuV2.RadioItem
                            value={entry.id}
                            disabled={pending() !== "" && pending() !== entry.id}
                            onSelect={() => void activate(entry)}
                          >
                            {entry.name}
                          </MenuV2.RadioItem>
                        )}
                      </For>
                    </MenuV2.RadioGroup>
                  </MenuV2.Group>
                  <MenuV2.Separator />
                  <MenuV2.Item onSelect={openKeysPage}>{language.t("chimera.status.key.manage")}</MenuV2.Item>
                </MenuV2.Content>
              </MenuV2.Portal>
            </MenuV2>
          </div>
        </Show>
        {/* 上下文用量改由会话右上角上游指示器承载（含 Token/成本详情），
            状态栏不再重复展示 */}
        {/* 设计稿 S1：● 网关 42ms（悬浮显示完整域名与上游版本） */}
        <span
          class="flex items-center gap-1.5 font-mono text-[10.5px] text-v2-text-text-faint"
          title={`${gatewayHost()} · ${language.t("chimera.status.gateway.tooltip")}`}
        >
          <span
            class="inline-block size-1.5 rounded-full"
            style={{ background: latency() ? "var(--v2-state-fg-success)" : "var(--v2-state-fg-danger)" }}
          />
          <Show when={latency()} fallback={gatewayHost()}>
            {language.t("chimera.status.gateway.latency", { ms: `${latency()}` })}
          </Show>
        </span>
        <span class="font-mono text-[10.5px] text-v2-text-text-faint" title={platform.version}>
          v{platform.version ?? BRAND.version}
        </span>
      </div>
    </footer>
  )
}
