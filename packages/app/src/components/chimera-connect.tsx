import { BRAND } from "@chimera/brand"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { Mark } from "@opencode-ai/ui/logo"
import { Icon as IconV2 } from "@opencode-ai/ui/v2/icon"
import { DialogBody, DialogHeader, DialogTitle, DialogV2 } from "@opencode-ai/ui/v2/dialog-v2"
import { Spinner } from "@opencode-ai/ui/spinner"
import { Show, createSignal, type Accessor, type Component, type JSX } from "solid-js"
import { useServerSDK } from "@/context/server-sdk"
import { useServerSync } from "@/context/server-sync"
import { showToast } from "@/utils/toast"
import { registerChimeraKey } from "./chimera-keys"

// 图标前缀输入框（设计稿 S5 的表单行语法）
const FieldInput: Component<{
  icon: JSX.Element
  type?: string
  placeholder: string
  value: string
  onInput: (value: string) => void
  trailing?: JSX.Element
}> = (props) => (
  <div class="flex h-9 w-full items-center gap-2 rounded-[8px] border-[0.5px] border-v2-border-border-base bg-v2-background-bg-layer-01 px-3 transition-colors focus-within:border-[var(--v2-state-fg-warning)]">
    <span class="shrink-0 text-v2-icon-icon-faint">{props.icon}</span>
    <input
      type={props.type ?? "text"}
      placeholder={props.placeholder}
      value={props.value}
      onInput={(e) => props.onInput(e.currentTarget.value)}
      autocomplete="off"
      spellcheck={false}
      class="h-full min-w-0 flex-1 bg-transparent font-mono text-[12.5px] text-v2-text-text-base outline-none placeholder:text-v2-text-text-faint"
    />
    {props.trailing}
  </div>
)

const icons = {
  user: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="size-3.5">
      <circle cx="12" cy="8" r="5" />
      <path d="M20 21a8 8 0 0 0-16 0" />
    </svg>
  ),
  lock: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="size-3.5">
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  ),
  key: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="size-3.5">
      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4" />
    </svg>
  ),
  eye: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="size-3.5">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  eyeOff: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="size-3.5">
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c6.5 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3.5 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
      <line x1="2" x2="22" y1="2" y2="22" />
    </svg>
  ),
  arrow: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" class="size-3.5">
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3" />
    </svg>
  ),
}

// Chimera 连接中转站（设计稿 S5）：账号密码 / API 密钥 双方式。
// TODO(chimera): 文案待补 i18n 键。
export const ChimeraConnectDialog: Component<{ directory?: Accessor<string | undefined> }> = (props) => {
  const dialog = useDialog()
  const serverSDK = useServerSDK()
  const serverSync = useServerSync()
  const [tab, setTab] = createSignal<"account" | "key">("account")
  const [username, setUsername] = createSignal("")
  const [password, setPassword] = createSignal("")
  const [apiKey, setApiKey] = createSignal("")
  const [pending, setPending] = createSignal(false)
  const [error, setError] = createSignal<string>()
  const [showPassword, setShowPassword] = createSignal(false)

  const location = () => {
    const value = props.directory?.()
    return value ? { directory: value } : undefined
  }

  const finish = () => {
    // 立即刷新 providers 缓存，让新同步的模型即时可选（V1 服务端无对应推送事件）
    void serverSync().refreshProviders()
    showToast({ title: `已连接 ${BRAND.name} 中转站`, variant: "default" })
    dialog.close()
  }

  const submit = async (e: SubmitEvent) => {
    e.preventDefault()
    if (pending()) return
    setError(undefined)
    setPending(true)
    try {
      if (tab() === "account") {
        if (!username().trim() || !password()) {
          setError("请输入账号和密码")
          return
        }
        // 方式索引 0 = 中转站账号密码（见 @chimera/plugin auth.methods 顺序）
        await serverSDK().api.integration.oauth.connect({
          integrationID: "chimera",
          methodID: "0",
          inputs: { username: username().trim(), password: password() },
          location: location(),
        })
        // 账号名持久化，供设置·密钥页账号卡展示
        localStorage.setItem("chimera-account", username().trim())
        finish()
        return
      }
      if (!apiKey().trim()) {
        setError("请输入 API 密钥")
        return
      }
      await serverSDK().api.integration.connect.key({
        integrationID: "chimera",
        key: apiKey().trim(),
        location: location(),
      })
      registerChimeraKey(apiKey().trim())
      finish()
    } catch {
      setError(tab() === "account" ? "登录失败，请检查账号密码或网关可用性" : "保存失败，请检查密钥")
    } finally {
      setPending(false)
    }
  }

  const tabClass = (active: boolean) =>
    `flex h-7 flex-1 items-center justify-center rounded-[6px] text-[13px] transition-colors ${
      active
        ? "bg-v2-background-bg-base font-[530] text-v2-text-text-base shadow-[var(--v2-elevation-raised)]"
        : "text-v2-text-text-muted hover:text-v2-text-text-base"
    }`

  return (
    <DialogV2
      fit
      containerClass="!h-auto max-h-[calc(100vh_-_16px)] !w-[min(calc(100vw_-_16px),440px)]"
      class="[font-family:var(--v2-font-family-sans)] [&_[data-slot=dialog-header]]:!px-5 [&_[data-slot=dialog-header-title]]:!text-[15px]"
    >
      <DialogHeader closeLabel="关闭">
        <DialogTitle>
          <span class="sr-only">连接 {BRAND.name}</span>
        </DialogTitle>
      </DialogHeader>
      <DialogBody class="min-h-0 flex-none gap-0 overflow-y-auto px-5 pb-5">
        {/* 品牌头（设计稿 S5）：方标 + 欢迎语 */}
        <div class="flex flex-col items-center gap-2.5 pb-5 pt-1">
          <span
            class="flex size-10 items-center justify-center rounded-[10px]"
            style={{
              background: "linear-gradient(135deg, #DEA54C, #46C39A)",
              "--icon-strong-base": "#10231D",
              "--icon-base": "#10231D",
            }}
          >
            <Mark class="size-6" />
          </span>
          <h2 class="text-[17px] font-[600] leading-6 text-v2-text-text-base">欢迎使用 {BRAND.name}</h2>
          <p class="text-[12px] leading-4 text-v2-text-text-muted">连接企业网关后开始使用</p>
        </div>
        <form class="flex w-full flex-col gap-4" onSubmit={submit}>
          <div class="flex w-full flex-col gap-1.5">
            <label class="text-[12px] font-[530] text-v2-text-text-muted">网关地址</label>
            <div class="flex h-9 w-full items-center gap-2 rounded-[8px] border-[0.5px] border-v2-border-border-muted bg-v2-background-bg-layer-02 px-3">
              <IconV2 name="globe" size="small" class="shrink-0 text-v2-icon-icon-muted" />
              <span class="min-w-0 truncate font-mono text-[12px] text-v2-text-text-base">
                {BRAND.gatewayUrl.replace(/\/$/, "")}
              </span>
              <span
                class="ml-auto flex shrink-0 items-center gap-1 rounded-[4px] px-1.5 py-0.5 font-mono text-[10px]"
                style={{
                  color: "var(--v2-state-fg-success)",
                  background: "color-mix(in srgb, var(--v2-state-fg-success) 12%, transparent)",
                }}
              >
                {icons.lock}
                管理员预置
              </span>
            </div>
          </div>

          <div class="flex w-full gap-1 rounded-[8px] bg-v2-background-bg-layer-02 p-1">
            <button type="button" class={tabClass(tab() === "account")} onClick={() => setTab("account")}>
              账号密码
            </button>
            <button type="button" class={tabClass(tab() === "key")} onClick={() => setTab("key")}>
              API 密钥
            </button>
          </div>

          <Show
            when={tab() === "account"}
            fallback={
              <div class="flex w-full flex-col gap-1.5">
                <label class="text-[12px] font-[530] text-v2-text-text-muted">API 密钥</label>
                <FieldInput
                  icon={icons.key}
                  type={showPassword() ? "text" : "password"}
                  placeholder="chm-... / sk-..."
                  value={apiKey()}
                  onInput={setApiKey}
                  trailing={
                    <button
                      type="button"
                      aria-label={showPassword() ? "隐藏密钥" : "显示密钥"}
                      class="shrink-0 text-v2-icon-icon-faint hover:text-v2-icon-icon-base"
                      onClick={() => setShowPassword((v) => !v)}
                    >
                      {showPassword() ? icons.eyeOff : icons.eye}
                    </button>
                  }
                />
              </div>
            }
          >
            <div class="flex w-full flex-col gap-3">
              <div class="flex w-full flex-col gap-1.5">
                <label class="text-[12px] font-[530] text-v2-text-text-muted">账号</label>
                <FieldInput icon={icons.user} placeholder="中转站用户名" value={username()} onInput={setUsername} />
              </div>
              <div class="flex w-full flex-col gap-1.5">
                <label class="text-[12px] font-[530] text-v2-text-text-muted">密码</label>
                <FieldInput
                  icon={icons.lock}
                  type={showPassword() ? "text" : "password"}
                  placeholder="••••••••"
                  value={password()}
                  onInput={setPassword}
                  trailing={
                    <button
                      type="button"
                      aria-label={showPassword() ? "隐藏密码" : "显示密码"}
                      class="shrink-0 text-v2-icon-icon-faint hover:text-v2-icon-icon-base"
                      onClick={() => setShowPassword((v) => !v)}
                    >
                      {showPassword() ? icons.eyeOff : icons.eye}
                    </button>
                  }
                />
              </div>
            </div>
          </Show>

          <Show when={error()}>
            <p class="text-[12px] leading-5 text-v2-state-fg-danger">{error()}</p>
          </Show>

          <button
            type="submit"
            disabled={pending()}
            class="flex h-9 w-full items-center justify-center gap-2 rounded-[8px] text-[13px] font-[530] transition-[filter] hover:brightness-105 disabled:opacity-60"
            style={{ background: "var(--v2-state-fg-warning)", color: "var(--v2-background-bg-base)" }}
          >
            <Show when={pending()} fallback={icons.arrow}>
              <Spinner class="size-4" />
            </Show>
            {tab() === "account" ? "登录并同步密钥" : "保存密钥"}
          </button>

          <p class="text-center text-[11px] leading-4 text-v2-text-text-faint">
            账号与密钥由中转站统一管理 · 登录后自动同步该账号下全部密钥
          </p>
        </form>
      </DialogBody>
    </DialogV2>
  )
}
