import { BRAND } from "@chimera/brand"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { Mark } from "@opencode-ai/ui/logo"
import { Icon as IconV2 } from "@opencode-ai/ui/v2/icon"
import { DialogBody, DialogHeader, DialogTitle, DialogV2 } from "@opencode-ai/ui/v2/dialog-v2"
import { Spinner } from "@opencode-ai/ui/spinner"
import { Show, createSignal, onCleanup, type Accessor, type Component, type JSX } from "solid-js"
import { useLanguage } from "@/context/language"
import { usePlatform } from "@/context/platform"
import { useServerSDK } from "@/context/server-sdk"
import { useServerSync } from "@/context/server-sync"
import { showToast } from "@/utils/toast"
import { readChimeraKeys, registerChimeraKey, writeChimeraKeys } from "./chimera-keys"

// 图标前缀输入框（设计稿 S5 的表单行语法）
const FieldInput: Component<{
  icon: JSX.Element
  type?: string
  placeholder: string
  value: string
  onInput: (value: string) => void
  trailing?: JSX.Element
}> = (props) => (
  <div class="flex h-9 w-full items-center gap-2 rounded-[8px] border-[0.5px] border-v2-border-border-base bg-v2-background-bg-layer-01 px-3 transition-colors focus-within:border-[var(--chimera-accent)]">
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

// Chimera 连接中转站（设计稿 S5）：设备授权 / API 密钥 双方式。
// 设备授权（RFC 8628 最小实现，网关侧见 new-api docs/chimera-desktop-auth.md）：
// 桌面端只展示一次性设备码并轮询结果，账号密码与人机验证全程留在浏览器；
// 授权完成后用 access_token 拉取该账号全部令牌并逐个取回完整密钥，
// 全部登记进本地密钥管理器。

type GatewayFetch = (input: {
  path: string
  method?: string
  headers?: Record<string, string>
  body?: string
}) => Promise<{ status: number; body: string }>

const gatewayProxy = (): GatewayFetch | undefined =>
  (window as { api?: { chimeraGatewayFetch?: GatewayFetch } }).api?.chimeraGatewayFetch

type DeviceGrant = {
  device_code: string
  user_code: string
  verification_uri: string
  expires_in: number
  interval: number
}

/** 发起设备授权：返回设备码与浏览器确认地址。 */
async function requestDeviceGrant(gw: GatewayFetch): Promise<DeviceGrant> {
  const res = await gw({ path: "/api/chimera/device/code", method: "POST" })
  const data = JSON.parse(res.body) as { success?: boolean; data?: DeviceGrant }
  if (!data.success || !data.data?.device_code) throw new Error("device code failed")
  return data.data
}

/** 轮询设备授权结果；authorized 后返回 dashboard access_token。 */
async function pollDeviceToken(
  gw: GatewayFetch,
  grant: DeviceGrant,
  cancelled: () => boolean,
): Promise<string> {
  const deadline = Date.now() + grant.expires_in * 1000
  const interval = Math.max(2, grant.interval) * 1000
  while (Date.now() < deadline) {
    if (cancelled()) throw new Error("cancelled")
    await new Promise((resolve) => setTimeout(resolve, interval))
    if (cancelled()) throw new Error("cancelled")
    const res = await gw({
      path: "/api/chimera/device/token",
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ device_code: grant.device_code }),
    })
    const data = JSON.parse(res.body) as {
      success?: boolean
      data?: { status?: string; access_token?: string }
    }
    if (data.data?.status === "ok" && data.data.access_token) return data.data.access_token
    if (data.data?.status === "expired") throw new Error("expired")
  }
  throw new Error("expired")
}

/** 用 dashboard access_token 同步账号下全部密钥（启用的排前，首个为建议激活项）。
 *  账号下没有任何令牌时自动创建一个 "Chimera Desktop" 令牌，保证新账号开箱可用。 */
async function fetchAllKeys(gw: GatewayFetch, accessToken: string) {
  const bearer = { authorization: `Bearer ${accessToken}` }
  const listTokens = async () => {
    const list = await gw({ path: "/api/token/?p=1&page_size=100", headers: bearer })
    const listData = JSON.parse(list.body) as {
      success?: boolean
      data?:
        | { items?: Array<{ id: number; name?: string; status?: number }> }
        | Array<{ id: number; name?: string; status?: number }>
    }
    if (!listData.success) throw new Error("token list failed")
    return Array.isArray(listData.data) ? listData.data : (listData.data?.items ?? [])
  }

  let items = await listTokens()
  if (!items.length) {
    await gw({
      path: "/api/token/",
      method: "POST",
      headers: { ...bearer, "content-type": "application/json" },
      body: JSON.stringify({ name: "Chimera Desktop", unlimited_quota: true, expired_time: -1 }),
    })
    items = await listTokens()
  }

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
  keys.sort((a, b) => Number(b.enabled) - Number(a.enabled))
  return keys
}

/** 当前登录账号名（账号卡展示用），取不到不阻塞流程。 */
async function fetchAccountName(gw: GatewayFetch, accessToken: string): Promise<string | undefined> {
  try {
    const res = await gw({ path: "/api/user/self", headers: { authorization: `Bearer ${accessToken}` } })
    const data = JSON.parse(res.body) as { success?: boolean; data?: { username?: string } }
    return data.success ? data.data?.username : undefined
  } catch {
    return undefined
  }
}

export const ChimeraConnectDialog: Component<{
  directory?: Accessor<string | undefined>
  initialTab?: "device" | "key"
}> = (props) => {
  const dialog = useDialog()
  const language = useLanguage()
  const platform = usePlatform()
  const serverSDK = useServerSDK()
  const serverSync = useServerSync()
  const [tab, setTab] = createSignal<"device" | "key">(props.initialTab ?? "device")
  const [apiKey, setApiKey] = createSignal("")
  const [pending, setPending] = createSignal(false)
  const [error, setError] = createSignal<string>()
  const [showPassword, setShowPassword] = createSignal(false)
  // 设备授权状态机：idle → waiting（展示设备码 + 轮询）→ syncing（拉取密钥）
  const [device, setDevice] = createSignal<
    { phase: "idle" } | { phase: "waiting"; grant: DeviceGrant } | { phase: "syncing" }
  >({ phase: "idle" })
  const cancel = { requested: false }
  onCleanup(() => {
    cancel.requested = true
  })

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

  /** 保存同步到的密钥并将首个设为当前（服务端 auth 生效）。 */
  const adoptKeys = async (keys: Awaited<ReturnType<typeof fetchAllKeys>>) => {
    if (!keys.length) throw new Error("no keys")
    for (const item of keys) {
      await registerChimeraKey(item.key, item.name)
    }
    const state = readChimeraKeys()
    const first = state.keys[0]
    if (!first) throw new Error("no keys")
    const secret = first.key || (window.api?.keyVault ? await window.api.keyVault.secret(first.id) : undefined)
    await serverSDK().api.integration.connect.key({
      integrationID: BRAND.nameLower,
      key: secret ?? first.key,
      location: location(),
    })
  }

  const startDeviceFlow = async () => {
    if (pending()) return
    setError(undefined)
    const gw = gatewayProxy()
    if (!gw) {
      setError(language.t("chimera.connect.device.desktopOnly"))
      return
    }
    setPending(true)
    cancel.requested = false
    try {
      const grant = await requestDeviceGrant(gw)
      setDevice({ phase: "waiting", grant })
      platform.openExternal(grant.verification_uri)
      const accessToken = await pollDeviceToken(gw, grant, () => cancel.requested)
      setDevice({ phase: "syncing" })
      const keys = await fetchAllKeys(gw, accessToken)
      await adoptKeys(keys)
      const account = await fetchAccountName(gw, accessToken)
      if (account) localStorage.setItem("chimera-account", account)
      finish()
    } catch (err) {
      setDevice({ phase: "idle" })
      if (err instanceof Error && err.message === "cancelled") return
      if (err instanceof Error && err.message === "expired") {
        setError(language.t("chimera.connect.device.expired"))
        return
      }
      setError(language.t("chimera.connect.device.failed"))
    } finally {
      setPending(false)
    }
  }

  const cancelDeviceFlow = () => {
    cancel.requested = true
    setDevice({ phase: "idle" })
    setPending(false)
  }

  const submit = async (e: SubmitEvent) => {
    e.preventDefault()
    if (pending()) return
    if (tab() === "device") {
      await startDeviceFlow()
      return
    }
    setError(undefined)
    setPending(true)
    try {
      if (!apiKey().trim()) {
        setError(language.t("chimera.connect.error.key"))
        return
      }
      await serverSDK().api.integration.connect.key({
        integrationID: BRAND.nameLower,
        key: apiKey().trim(),
        location: location(),
      })
      await registerChimeraKey(apiKey().trim(), (index) =>
        language.t("chimera.keys.defaultName", { index: `${index}` }),
      )
      finish()
    } catch {
      setError(language.t("chimera.connect.error.save"))
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
          {/* 设计稿 S5：深底金标 app 图标风格 */}
          <span
            class="flex size-10 items-center justify-center rounded-[10px] border-[0.5px] border-v2-border-border-base"
            style={{
              background: "var(--v2-background-bg-layer-02)",
              "--icon-strong-base": "var(--chimera-accent)",
              "--icon-base": "var(--chimera-accent)",
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
            <button type="button" class={tabClass(tab() === "device")} onClick={() => setTab("device")}>
              {language.t("chimera.connect.tab.device")}
            </button>
            <button type="button" class={tabClass(tab() === "key")} onClick={() => setTab("key")}>
              {language.t("chimera.connect.tab.key")}
            </button>
          </div>

          <Show
            when={tab() === "device"}
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
            {/* 设备授权（设计稿 S5 变体）：说明 → 设备码 + 浏览器确认 → 自动完成 */}
            <Show
              when={device().phase === "idle"}
              fallback={
                <div class="flex w-full flex-col items-center gap-3 py-1">
                  <Show when={device()} keyed>
                    {(state) =>
                      state.phase === "waiting" ? (
                        <>
                          <span class="font-mono text-[10.5px] tracking-[1px] text-v2-text-text-faint">
                            {language.t("chimera.connect.device.codeLabel")}
                          </span>
                          <div
                            class="w-full rounded-[10px] border border-dashed px-4 py-3 text-center font-mono text-[22px] font-[600] tracking-[4px]"
                            style={{
                              color: "var(--chimera-accent)",
                              "border-color": "color-mix(in srgb, var(--chimera-accent) 45%, transparent)",
                            }}
                          >
                            {state.grant.user_code}
                          </div>
                          <p class="flex items-center gap-2 text-center text-[12px] leading-4 text-v2-text-text-muted">
                            <Spinner class="size-3.5 shrink-0" />
                            {language.t("chimera.connect.device.waiting")}
                          </p>
                          <div class="flex items-center gap-3">
                            <button
                              type="button"
                              class="text-[11.5px] text-v2-text-text-faint underline-offset-2 hover:text-v2-text-text-base hover:underline"
                              onClick={() => platform.openExternal(state.grant.verification_uri)}
                            >
                              {language.t("chimera.connect.device.openManually")}
                            </button>
                            <button
                              type="button"
                              class="text-[11.5px] text-v2-text-text-faint underline-offset-2 hover:text-v2-state-fg-danger hover:underline"
                              onClick={cancelDeviceFlow}
                            >
                              {language.t("chimera.connect.device.cancel")}
                            </button>
                          </div>
                        </>
                      ) : (
                        <p class="flex items-center gap-2 py-4 text-[12.5px] text-v2-text-text-muted">
                          <Spinner class="size-4 shrink-0" />
                          {language.t("chimera.connect.device.syncing")}
                        </p>
                      )
                    }
                  </Show>
                </div>
              }
            >
              <p class="text-[12.5px] leading-5 text-v2-text-text-muted">
                {language.t("chimera.connect.device.intro")}
              </p>
            </Show>
          </Show>

          <Show when={error()}>
            <p class="text-[12px] leading-5 text-v2-state-fg-danger">{error()}</p>
          </Show>

          <Show when={tab() === "key" || device().phase === "idle"}>
            <button
              type="submit"
              disabled={pending()}
              class="flex h-9 w-full items-center justify-center gap-2 rounded-[8px] text-[13px] font-[530] transition-[filter] hover:brightness-105 disabled:opacity-60"
              style={{ background: "var(--chimera-accent)", color: "var(--v2-background-bg-base)" }}
            >
              <Show when={pending()} fallback={icons.arrow}>
                <Spinner class="size-4" />
              </Show>
              {tab() === "device"
                ? language.t("chimera.connect.device.start")
                : language.t("chimera.connect.saveKey")}
            </button>
          </Show>

          <p class="text-center text-[11px] leading-4 text-v2-text-text-faint">
            {language.t("chimera.connect.footnote")}
          </p>
        </form>
      </DialogBody>
    </DialogV2>
  )
}
