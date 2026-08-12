import { BRAND } from "@chimera/brand"
import { Spinner } from "@opencode-ai/ui/spinner"
import { TextInputV2 } from "@opencode-ai/ui/v2/text-input-v2"
import { For, Show, createSignal, type Accessor, type Component } from "solid-js"
import { createStore } from "solid-js/store"
import { ChimeraAvatar } from "../chimera-avatar"
import { readChimeraKeys, writeChimeraKeys, type ChimeraKeyEntry } from "../chimera-keys"
import { useLanguage } from "@/context/language"
import { useServerSDK } from "@/context/server-sdk"
import { useServerSync } from "@/context/server-sync"
import { showToast } from "@/utils/toast"

// 设置 · 密钥（设计稿 S6）：账号卡 + 中转站多密钥表格。
// 前后端对齐：切换=服务端 auth 保存并刷新实例；退出登录=服务端 DELETE /auth。

const mask = (key: string) => {
  if (key.length <= 10) return "••••••"
  return `${key.slice(0, 8)}••••••${key.slice(-2)}`
}

const gatewayHost = (() => {
  try {
    return new URL(BRAND.gatewayUrl).host
  } catch {
    return BRAND.gatewayUrl
  }
})()

export const SettingsKeysV2: Component<{ directory?: Accessor<string | undefined> }> = (props) => {
  const language = useLanguage()
  const serverSDK = useServerSDK()
  const serverSync = useServerSync()
  const [store, setStore] = createStore(readChimeraKeys())
  const [account, setAccount] = createSignal(localStorage.getItem("chimera-account") ?? "")
  const [adding, setAdding] = createSignal(false)
  const [newName, setNewName] = createSignal("")
  const [newKey, setNewKey] = createSignal("")
  const [pending, setPending] = createSignal("")

  const location = () => {
    const value = props.directory?.()
    return value ? { directory: value } : undefined
  }

  const persist = () => writeChimeraKeys({ keys: [...store.keys], active: store.active })

  const activate = async (entry: ChimeraKeyEntry) => {
    if (pending()) return
    setPending(entry.key)
    try {
      await serverSDK().api.integration.connect.key({
        integrationID: BRAND.nameLower,
        key: entry.key,
        location: location(),
      })
      setStore("active", entry.key)
      persist()
      void serverSync().refreshProviders()
      showToast({ title: language.t("chimera.keys.switched", { name: entry.name }), variant: "default" })
    } catch {
      showToast({ title: language.t("chimera.keys.switchFailed"), variant: "default" })
    } finally {
      setPending("")
    }
  }

  const copy = async (entry: ChimeraKeyEntry) => {
    await navigator.clipboard.writeText(entry.key)
    showToast({ title: language.t("chimera.keys.copied"), variant: "default" })
  }

  const remove = (entry: ChimeraKeyEntry) => {
    setStore(
      "keys",
      store.keys.filter((item) => item.key !== entry.key),
    )
    persist()
  }

  const signOut = async () => {
    try {
      await fetch(`${serverSDK().url}/auth/${BRAND.nameLower}`, { method: "DELETE" })
    } catch {
      // 服务端不可达时仍清理本地状态
    }
    localStorage.removeItem("chimera-account")
    setAccount("")
    setStore({ keys: [], active: "" })
    persist()
    void serverSync().refreshProviders()
    showToast({ title: language.t("chimera.keys.signedOut"), variant: "default" })
  }

  const add = async (e: SubmitEvent) => {
    e.preventDefault()
    const key = newKey().trim()
    if (!key) return
    const entry: ChimeraKeyEntry = {
      name: newName().trim() || language.t("chimera.keys.defaultName", { index: `${store.keys.length + 1}` }),
      key,
    }
    if (!store.keys.some((item) => item.key === key)) setStore("keys", store.keys.length, entry)
    persist()
    setNewName("")
    setNewKey("")
    setAdding(false)
    await activate(entry)
  }

  return (
    <div class="flex w-full flex-col gap-4 px-9 pb-10 pt-8">
      <div class="flex items-start justify-between gap-4">
        <div class="flex flex-col gap-1">
          <h2 class="text-[16px] font-[600] leading-6 text-v2-text-text-base">{language.t("chimera.keys.title")}</h2>
          <p class="text-[12.5px] leading-5 text-v2-text-text-muted">{language.t("chimera.keys.description")}</p>
        </div>
        <button
          type="button"
          class="flex h-8 shrink-0 items-center gap-1 rounded-[7px] border-[0.5px] border-v2-border-border-base px-3 text-[12.5px] font-[530] text-v2-text-text-base transition-colors hover:bg-v2-overlay-simple-overlay-hover"
          onClick={() => setAdding((v) => !v)}
        >
          <span class="text-[14px] leading-none">+</span> {language.t("chimera.keys.add")}
        </button>
      </div>

      {/* 账号卡（设计稿 S6 顶部）：头像 + 用户名 + 登录状态 + 退出登录 */}
      <div class="flex w-full items-center gap-3 rounded-[10px] border-[0.5px] border-v2-border-border-muted bg-v2-background-bg-layer-01 px-4 py-3">
        <ChimeraAvatar size={30} />
        <div class="flex min-w-0 flex-1 flex-col gap-0.5">
          <span class="truncate font-mono text-[13px] font-[600] leading-4 text-v2-text-text-base">
            {account() || language.t("chimera.keys.connected")}
          </span>
          <span class="font-mono text-[11px] leading-4 text-v2-text-text-faint">
            {store.keys.length > 0 || account()
              ? language.t("chimera.keys.signedIn")
              : language.t("chimera.keys.notSignedIn")}
            {" · "}
            {gatewayHost}
          </span>
        </div>
        <Show when={account() || store.keys.length > 0}>
          <button
            type="button"
            class="flex h-7 shrink-0 items-center rounded-[7px] border-[0.5px] border-v2-border-border-base px-3 text-[12px] text-v2-text-text-muted transition-colors hover:bg-v2-overlay-simple-overlay-hover hover:text-v2-text-text-base"
            onClick={() => void signOut()}
          >
            {language.t("chimera.keys.signOut")}
          </button>
        </Show>
      </div>

      <Show when={adding()}>
        <form class="flex w-full items-end gap-2" onSubmit={add}>
          <div class="flex flex-1 flex-col gap-1.5">
            <label class="text-[12px] font-[530] text-v2-text-text-muted">{language.t("chimera.keys.header.name")}</label>
            <TextInputV2
              placeholder={language.t("chimera.keys.name.placeholder")}
              value={newName()}
              onInput={(e) => setNewName(e.currentTarget.value)}
            />
          </div>
          <div class="flex flex-[2] flex-col gap-1.5">
            <label class="text-[12px] font-[530] text-v2-text-text-muted">{language.t("chimera.keys.header.key")}</label>
            <TextInputV2
              type="password"
              placeholder={language.t("chimera.keys.key.placeholder")}
              value={newKey()}
              onInput={(e) => setNewKey(e.currentTarget.value)}
            />
          </div>
          <button
            type="submit"
            class="flex h-9 shrink-0 items-center rounded-[8px] px-4 text-[13px] font-[530] transition-[filter] hover:brightness-105"
            style={{ background: "var(--v2-state-fg-warning)", color: "var(--v2-background-bg-base)" }}
          >
            {language.t("chimera.keys.save")}
          </button>
        </form>
      </Show>

      {/* 密钥表（设计稿 S6）：名称 / 密钥 / 操作 */}
      <div class="flex w-full flex-col overflow-hidden rounded-[10px] border-[0.5px] border-v2-border-border-muted">
        <div class="flex h-8 w-full items-center gap-3 border-b-[0.5px] border-v2-border-border-muted px-4">
          <span class="w-[210px] font-mono text-[10.5px] tracking-[0.5px] text-v2-text-text-faint">
            {language.t("chimera.keys.header.name")}
          </span>
          <span class="w-[260px] font-mono text-[10.5px] tracking-[0.5px] text-v2-text-text-faint">
            {language.t("chimera.keys.header.key")}
          </span>
          <div class="flex-1" />
          <span class="font-mono text-[10.5px] tracking-[0.5px] text-v2-text-text-faint">
            {language.t("chimera.keys.header.actions")}
          </span>
        </div>
        <Show
          when={store.keys.length > 0}
          fallback={
            <div class="flex h-20 items-center justify-center text-[12.5px] text-v2-text-text-faint">
              {language.t("chimera.keys.empty")}
            </div>
          }
        >
          <For each={store.keys}>
            {(entry, index) => {
              const active = () => store.active === entry.key
              return (
                <div
                  class="group flex h-10 w-full items-center gap-3 px-4 transition-colors hover:bg-v2-overlay-simple-overlay-hover"
                  classList={{ "border-t-[0.5px] border-v2-border-border-muted": index() > 0 }}
                >
                  <span class="flex w-[210px] shrink-0 items-center gap-2 truncate">
                    <span class="truncate text-[13px] font-[560] text-v2-text-text-base">{entry.name}</span>
                    <Show when={active()}>
                      <span
                        class="shrink-0 rounded-[4px] px-1.5 py-[1px] font-mono text-[10px] font-[560]"
                        style={{
                          color: "var(--v2-state-fg-warning)",
                          background: "color-mix(in srgb, var(--v2-state-fg-warning) 15%, transparent)",
                        }}
                      >
                        {language.t("chimera.keys.current")}
                      </span>
                    </Show>
                  </span>
                  <span class="flex w-[260px] shrink-0 items-center gap-1.5">
                    <span class="truncate font-mono text-[11.5px] text-v2-text-text-muted">{mask(entry.key)}</span>
                    <button
                      type="button"
                      aria-label={language.t("chimera.keys.copy")}
                      title={language.t("chimera.keys.copy")}
                      class="flex size-5 shrink-0 items-center justify-center rounded-[4px] text-v2-icon-icon-faint transition-colors hover:bg-v2-overlay-simple-overlay-hover hover:text-v2-icon-icon-base"
                      onClick={() => void copy(entry)}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="size-3">
                        <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                        <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                      </svg>
                    </button>
                  </span>
                  <div class="flex-1" />
                  <div class="flex shrink-0 items-center gap-1.5">
                    <Show
                      when={active()}
                      fallback={
                        <>
                          <button
                            type="button"
                            aria-label={language.t("chimera.keys.deleteNamed", { name: entry.name })}
                            title={language.t("chimera.keys.delete")}
                            class="flex size-6 items-center justify-center rounded-[6px] text-v2-icon-icon-faint opacity-0 transition-all hover:text-v2-state-fg-danger group-hover:opacity-100"
                            onClick={() => remove(entry)}
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="size-3.5">
                              <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            class="flex h-6 items-center rounded-[6px] border-[0.5px] border-v2-border-border-base px-2.5 font-mono text-[11px] text-v2-text-text-base transition-colors hover:bg-v2-overlay-simple-overlay-hover"
                            disabled={!!pending()}
                            onClick={() => void activate(entry)}
                          >
                            <Show when={pending() === entry.key} fallback={language.t("chimera.keys.switch")}>
                              <Spinner class="size-3" />
                            </Show>
                          </button>
                        </>
                      }
                    >
                      <span
                        class="flex items-center gap-1.5 font-mono text-[11px] font-[560]"
                        style={{ color: "var(--v2-state-fg-warning)" }}
                      >
                        <span
                          class="inline-block size-1.5 rounded-full"
                          style={{ background: "linear-gradient(135deg, #DEA54C, #46C39A)" }}
                        />
                        {language.t("chimera.keys.inUse")}
                      </span>
                    </Show>
                  </div>
                </div>
              )
            }}
          </For>
        </Show>
      </div>

      <p class="font-mono text-[11px] leading-4 tracking-[0.2px] text-v2-text-text-faint">
        {language.t("chimera.keys.footnote")}
      </p>
    </div>
  )
}
