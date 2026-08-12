import { BRAND } from "@chimera/brand"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { Mark } from "@opencode-ai/ui/logo"
import { Icon as IconV2 } from "@opencode-ai/ui/v2/icon"
import { DialogBody, DialogHeader, DialogTitle, DialogV2 } from "@opencode-ai/ui/v2/dialog-v2"
import { Spinner } from "@opencode-ai/ui/spinner"
import { Show, createSignal, type Accessor, type Component, type JSX } from "solid-js"
import { useLanguage } from "@/context/language"
import { useServerSDK } from "@/context/server-sdk"
import { useServerSync } from "@/context/server-sync"
import { showToast } from "@/utils/toast"
import { registerChimeraKey, writeChimeraKeys } from "./chimera-keys"

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
// 账号密码：桌面端经主进程代理直连中转站（new-api）——登录换 access_token，
// 拉取该账号全部令牌并逐个取回完整密钥，全部登记进本地密钥管理器；
// 无代理环境（纯浏览器）回退服务端 authorize 链路（仅保存单个密钥）。

type GatewayFetch = (input: {
  path: string
  method?: string
  headers?: Record<string, string>
  body?: string
}) => Promise<{ status: number; body: string }>

const gatewayProxy = (): GatewayFetch | undefined =>
  (window as { api?: { chimeraGatewayFetch?: GatewayFetch } }).api?.chimeraGatewayFetch

/** new-api 登录并同步账号下全部密钥；返回同步的密钥列表（首个为建议激活项）。 */
async function syncKeysViaGateway(gw: GatewayFetch, username: string, password: string) {
  const login = await gw({
    path: "/api/user/login",
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username, password }),
  })
  const loginData = JSON.parse(login.body) as {
    success?: boolean
    message?: string
    data?: { access_token?: string }
  }
  if (!loginData.success || !loginData.data?.access_token) {
    if (loginData.message?.toLowerCase().includes("turnstile")) throw new Error("turnstile")
    throw new Error(loginData.message || `login failed (${login.status})`)
  }
  const bearer = { authorization: `Bearer ${loginData.data.access_token}` }

  const list = await gw({ path: "/api/token/?p=1&page_size=100", headers: bearer })
  const listData = JSON.parse(list.body) as {
    success?: boolean
    data?: { items?: Array<{ id: number; name?: string; status?: number }> } | Array<{ id: number; name?: string; status?: number }>
  }
  if (!listData.success) throw new Error("token list failed")
  const items = Array.isArray(listData.data) ? listData.data : (listData.data?.items ?? [])

  const keys: Array<{ name: string; key: string; enabled: boolean }> = []
  for (const item of items) {
    const res = await gw({ path: `/api/token/${item.id}/key`, method: "POST", headers: bearer })
    const data = JSON.parse(res.body) as { success?: boolean; data?: { key?: string } }
    const raw = data.data?.key
    if (!data.success || !raw) continue
    keys.push({
      name: item.name?.trim() || `Token ${item.id}`,
      key: raw.startsWith("sk-") ? raw : `sk-${raw}`,
      enabled: item.status === 1,
    })
  }
  // 启用的排前面，首个即建议激活项
  keys.sort((a, b) => Number(b.enabled) - Number(a.enabled))
  return keys
}
export const ChimeraConnectDialog: Component<{ directory?: Accessor<string | undefined> }> = (props) => {
  const dialog = useDialog()
  const language = useLanguage()
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
    showToast({ title: language.t("chimera.connect.success", { name: BRAND.name }), variant: "default" })
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
          setError(language.t("chimera.connect.error.credentials"))
          return
        }
        const gw = gatewayProxy()
        if (gw) {
          // 桌面端：直连中转站同步该账号全部密钥
          const keys = await syncKeysViaGateway(gw, username().trim(), password())
          if (!keys.length) throw new Error("no keys")
          writeChimeraKeys({
            keys: keys.map((item) => ({ name: item.name, key: item.key })),
            active: keys[0].key,
          })
          await serverSDK().api.integration.connect.key({
            integrationID: "chimera",
            key: keys[0].key,
            location: location(),
          })
        } else {
          // 浏览器等无代理环境：回退服务端 authorize（方式索引 0 = 账号密码）
          await serverSDK().api.integration.oauth.connect({
            integrationID: "chimera",
            methodID: "0",
            inputs: { username: username().trim(), password: password() },
            location: location(),
          })
        }
        // 账号名持久化，供设置·密钥页账号卡展示
        localStorage.setItem("chimera-account", username().trim())
        finish()
        return
      }
      if (!apiKey().trim()) {
        setError(language.t("chimera.connect.error.key"))
        return
      }
      await serverSDK().api.integration.connect.key({
        integrationID: "chimera",
        key: apiKey().trim(),
        location: location(),
      })
      registerChimeraKey(apiKey().trim(), (index) =>
        language.t("chimera.keys.defaultName", { index: `${index}` }),
      )
      finish()
    } catch (error) {
      if (error instanceof Error && error.message === "turnstile") {
        setError(language.t("chimera.connect.error.turnstile"))
        return
      }
      setError(
        tab() === "account" ? language.t("chimera.connect.error.signIn") : language.t("chimera.connect.error.save"),
      )
    } finally {
      setPending(false)
    }
  }

  const tabClass = (active: boolean) =>
    `flex h-7 flex-1 items-center justify-center rounded-[6px] text-[13px] transition-colors ${
      active
        ? "bg-v2-background-bg-inverse font-[560] text-v2-text-text-inverse shadow-[var(--v2-elevation-raised)]"
        : "text-v2-text-text-muted hover:text-v2-text-text-base"
    }`

  return (
    <DialogV2
      fit
      containerClass="!h-auto max-h-[calc(100vh_-_16px)] !w-[min(calc(100vw_-_16px),440px)]"
      class="[font-family:var(--v2-font-family-sans)] [&_[data-slot=dialog-header]]:!px-5 [&_[data-slot=dialog-header-title]]:!text-[15px]"
    >
      <DialogHeader closeLabel={language.t("common.close")}>
        <DialogTitle>
          <span class="sr-only">{language.t("chimera.connect.title", { name: BRAND.name })}</span>
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
          <h2 class="text-[17px] font-[600] leading-6 text-v2-text-text-base">
            {language.t("chimera.connect.welcome", { name: BRAND.name })}
          </h2>
          <p class="text-[12px] leading-4 text-v2-text-text-muted">{language.t("chimera.connect.subtitle")}</p>
        </div>
        <form class="flex w-full flex-col gap-4" onSubmit={submit}>
          <div class="flex w-full flex-col gap-1.5">
            <label class="text-[12px] font-[530] text-v2-text-text-muted">{language.t("chimera.connect.gateway")}</label>
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
                {language.t("chimera.connect.managed")}
              </span>
            </div>
          </div>

          <div class="flex w-full gap-1 rounded-[8px] bg-v2-background-bg-layer-02 p-1">
            <button type="button" class={tabClass(tab() === "account")} onClick={() => setTab("account")}>
              {language.t("chimera.connect.tab.account")}
            </button>
            <button type="button" class={tabClass(tab() === "key")} onClick={() => setTab("key")}>
              {language.t("chimera.connect.tab.key")}
            </button>
          </div>

          <Show
            when={tab() === "account"}
            fallback={
              <div class="flex w-full flex-col gap-1.5">
                <label class="text-[12px] font-[530] text-v2-text-text-muted">
                  {language.t("chimera.connect.tab.key")}
                </label>
                <FieldInput
                  icon={icons.key}
                  type={showPassword() ? "text" : "password"}
                  placeholder={language.t("chimera.keys.key.placeholder")}
                  value={apiKey()}
                  onInput={setApiKey}
                  trailing={
                    <button
                      type="button"
                      aria-label={
                        showPassword() ? language.t("chimera.connect.hideSecret") : language.t("chimera.connect.showSecret")
                      }
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
                <label class="text-[12px] font-[530] text-v2-text-text-muted">
                  {language.t("chimera.connect.username")}
                </label>
                <FieldInput
                  icon={icons.user}
                  placeholder={language.t("chimera.connect.username.placeholder")}
                  value={username()}
                  onInput={setUsername}
                />
              </div>
              <div class="flex w-full flex-col gap-1.5">
                <label class="text-[12px] font-[530] text-v2-text-text-muted">
                  {language.t("chimera.connect.password")}
                </label>
                <FieldInput
                  icon={icons.lock}
                  type={showPassword() ? "text" : "password"}
                  placeholder="••••••••"
                  value={password()}
                  onInput={setPassword}
                  trailing={
                    <button
                      type="button"
                      aria-label={
                        showPassword() ? language.t("chimera.connect.hideSecret") : language.t("chimera.connect.showSecret")
                      }
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
            {tab() === "account" ? language.t("chimera.connect.signIn") : language.t("chimera.connect.saveKey")}
          </button>

          <p class="text-center text-[11px] leading-4 text-v2-text-text-faint">
            {language.t("chimera.connect.footnote")}
          </p>
        </form>
      </DialogBody>
    </DialogV2>
  )
}
