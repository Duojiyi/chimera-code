import { BRAND } from "@chimera/brand"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { Icon as IconV2 } from "@opencode-ai/ui/v2/icon"
import { DialogBody, DialogHeader, DialogTitle, DialogV2 } from "@opencode-ai/ui/v2/dialog-v2"
import { TextInputV2 } from "@opencode-ai/ui/v2/text-input-v2"
import { Spinner } from "@opencode-ai/ui/spinner"
import { Show, createSignal, type Accessor, type Component } from "solid-js"
import { useServerSDK } from "@/context/server-sdk"
import { showToast } from "@/utils/toast"
import { registerChimeraKey } from "./chimera-keys"

// Chimera 连接中转站（设计稿 S5）：账号密码 / API 密钥 双方式。
// TODO(chimera): 文案待补 i18n 键。
export const ChimeraConnectDialog: Component<{ directory?: Accessor<string | undefined> }> = (props) => {
  const dialog = useDialog()
  const serverSDK = useServerSDK()
  const [tab, setTab] = createSignal<"account" | "key">("account")
  const [username, setUsername] = createSignal("")
  const [password, setPassword] = createSignal("")
  const [apiKey, setApiKey] = createSignal("")
  const [pending, setPending] = createSignal(false)
  const [error, setError] = createSignal<string>()

  const location = () => {
    const value = props.directory?.()
    return value ? { directory: value } : undefined
  }

  const finish = () => {
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
        <DialogTitle>连接 {BRAND.name} 中转站</DialogTitle>
      </DialogHeader>
      <DialogBody class="min-h-0 flex-none gap-0 overflow-y-auto px-5 pb-5">
        <form class="flex w-full flex-col gap-4" onSubmit={submit}>
          <div class="flex h-9 w-full items-center gap-2 rounded-[8px] border-[0.5px] border-v2-border-border-muted bg-v2-background-bg-layer-02 px-3">
            <IconV2 name="globe" size="small" class="shrink-0 text-v2-icon-icon-muted" />
            <span class="min-w-0 truncate font-mono text-[12px] text-v2-text-text-base">
              {BRAND.gatewayUrl.replace(/\/$/, "")}
            </span>
            <span class="ml-auto shrink-0 text-[11px] text-v2-text-text-faint">管理员预置</span>
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
                <TextInputV2
                  type="password"
                  placeholder="chm-..."
                  value={apiKey()}
                  onInput={(e) => setApiKey(e.currentTarget.value)}
                />
              </div>
            }
          >
            <div class="flex w-full flex-col gap-3">
              <div class="flex w-full flex-col gap-1.5">
                <label class="text-[12px] font-[530] text-v2-text-text-muted">账号</label>
                <TextInputV2
                  placeholder="中转站用户名"
                  value={username()}
                  onInput={(e) => setUsername(e.currentTarget.value)}
                />
              </div>
              <div class="flex w-full flex-col gap-1.5">
                <label class="text-[12px] font-[530] text-v2-text-text-muted">密码</label>
                <TextInputV2
                  type="password"
                  placeholder="••••••••"
                  value={password()}
                  onInput={(e) => setPassword(e.currentTarget.value)}
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
            <Show when={pending()}>
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
