import { BRAND } from "@chimera/brand"
import { TextInputV2 } from "@opencode-ai/ui/v2/text-input-v2"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { For, Show, createSignal, onCleanup, type Accessor, type Component } from "solid-js"
import { createStore } from "solid-js/store"
import { ChimeraAvatar } from "../chimera-avatar"
import {
  ChimeraKeyRow,
  nextActiveKey,
  readChimeraKeys,
  registerChimeraKey,
  showChimeraKeyDeleteConfirm,
  switchChimeraKey,
  writeChimeraKeys,
  type ChimeraKeyEntry,
} from "../chimera-keys"
import { useLanguage } from "@/context/language"
import { useServerSDK } from "@/context/server-sdk"
import { useServerSync } from "@/context/server-sync"
import { showToast } from "@/utils/toast"

// 设置 · 密钥（设计稿 S6）：账号卡 + 中转站多密钥表格。
// 前后端对齐：切换=服务端 auth 保存并刷新实例；退出登录=服务端 DELETE /auth。

const gatewayHost = (() => {
  try {
    return new URL(BRAND.gatewayUrl).host
  } catch {
    return BRAND.gatewayUrl
  }
})()

export const SettingsKeysV2: Component<{ directory?: Accessor<string | undefined> }> = (props) => {
  const language = useLanguage()
  const dialog = useDialog()
  const serverSDK = useServerSDK()
  const serverSync = useServerSync()
  const [store, setStore] = createStore(readChimeraKeys())
  const [account, setAccount] = createSignal(localStorage.getItem("chimera-account") ?? "")
  const [adding, setAdding] = createSignal(false)
  const [newName, setNewName] = createSignal("")
  const [newKey, setNewKey] = createSignal("")
  const [pending, setPending] = createSignal("")

  const refresh = () => {
    const next = readChimeraKeys()
    setStore("keys", next.keys)
    setStore("active", next.active)
    setAccount(localStorage.getItem("chimera-account") ?? "")
  }
  window.addEventListener("chimera:keys-changed", refresh)
  onCleanup(() => window.removeEventListener("chimera:keys-changed", refresh))

  const signedIn = () => !!account() || store.keys.length > 0

  const openConnect = (tab: "device" | "key") => {
    void import("../chimera-connect").then((x) => {
      void dialog.show(() => <x.ChimeraConnectDialog directory={props.directory} initialTab={tab} />)
    })
  }

  const persist = () => writeChimeraKeys({ keys: [...store.keys], active: store.active })

  const activate = async (entry: ChimeraKeyEntry, opts?: { quiet?: boolean }) => {
    if (pending()) return false
    setPending(entry.id)
    try {
      await switchChimeraKey({
        entry,
        sdk: serverSDK(),
        directory: props.directory?.(),
      })
      setStore("active", entry.id)
      void serverSync().refreshProviders()
      if (!opts?.quiet) showToast({ title: language.t("chimera.keys.switched", { name: entry.name }), variant: "default" })
      return true
    } catch {
      showToast({ title: language.t("chimera.keys.switchFailed"), variant: "default" })
      return false
    } finally {
      setPending("")
    }
  }

  const copy = async (entry: ChimeraKeyEntry) => {
    if (typeof window !== "undefined" && window.api?.keyVault) {
      await window.api.keyVault.copySecret(entry.id)
    } else {
      await navigator.clipboard.writeText(entry.id)
    }
    showToast({ title: language.t("chimera.keys.copied"), variant: "default" })
  }

  const rename = (entry: ChimeraKeyEntry, name: string) => {
    const trimmed = name.trim()
    if (!trimmed || trimmed === entry.name) return
    const index = store.keys.findIndex((item) => item.id === entry.id)
    if (index < 0) return
    setStore("keys", index, "name", trimmed)
    persist()
    if (typeof window !== "undefined" && window.api?.keyVault) void window.api.keyVault.rename(entry.id, trimmed)
    showToast({ title: language.t("chimera.keys.renamed", { name: trimmed }), variant: "default" })
  }

  const remove = async (entry: ChimeraKeyEntry) => {
    const nextKey = nextActiveKey(store.keys, store.active, entry.id)
    const next = store.keys.find((item) => item.id === nextKey)
    if (store.active === entry.id && next) {
      const ok = await activate(next, { quiet: true })
      if (!ok) return
    }
    if (store.active === entry.id && !next) {
      try {
        await fetch(`${serverSDK().url}/auth/${BRAND.nameLower}`, { method: "DELETE" })
      } catch {
        // 服务端不可达时仍清理本地状态
      }
      setStore("active", "")
      void serverSync().refreshProviders()
    }
    setStore(
      "keys",
      store.keys.filter((item) => item.id !== entry.id),
    )
    persist()
    if (typeof window !== "undefined" && window.api?.keyVault) void window.api.keyVault.remove(entry.id)
    showToast({ title: language.t("chimera.keys.deleted"), variant: "default" })
  }

  const confirmRemove = (entry: ChimeraKeyEntry) => {
    const nextKey = nextActiveKey(store.keys, store.active, entry.id)
    showChimeraKeyDeleteConfirm({
      dialog,
      language,
      entry,
      last: store.keys.length === 1,
      inUse: store.active === entry.id,
      nextName: store.keys.find((item) => item.id === nextKey)?.name,
      onConfirm: () => void remove(entry),
    })
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
    const before = readChimeraKeys()
    await registerChimeraKey(
      key,
      newName().trim() || language.t("chimera.keys.defaultName", { index: `${before.keys.length + 1}` }),
    )
    const after = readChimeraKeys()
    setStore("keys", after.keys)
    setStore("active", after.active)
    setNewName("")
    setNewKey("")
    setAdding(false)
    const entry = after.keys.find((item) => item.id === after.active)
    if (entry) void activate(entry)
  }

  return (
    <div class="flex w-full flex-col gap-4 px-9 pb-10 pt-8">
      <div class="flex items-start justify-between gap-4">
        <div class="flex flex-col gap-1">
          <h2 class="text-[16px] font-[600] leading-6 text-v2-text-text-base">{language.t("chimera.keys.title")}</h2>
          <p class="text-[12.5px] leading-5 text-v2-text-text-muted">{language.t("chimera.keys.description")}</p>
        </div>
        <Show when={signedIn()}>
          <button
            type="button"
            class="flex h-8 shrink-0 items-center gap-1 rounded-[7px] border-[0.5px] border-v2-border-border-base px-3 text-[12.5px] font-[530] text-v2-text-text-base transition-colors hover:bg-v2-overlay-simple-overlay-hover"
            onClick={() => setAdding((v) => !v)}
          >
            <span class="text-[14px] leading-none">+</span> {language.t("chimera.keys.add")}
          </button>
        </Show>
      </div>

      {/* 账号卡（设计稿 S6 顶部）：头像 + 用户名 + 登录状态 + 退出登录 */}
      <div class="flex w-full items-center gap-3 rounded-[10px] border-[0.5px] border-v2-border-border-muted bg-v2-background-bg-layer-01 px-4 py-3">
        <ChimeraAvatar size={30} />
        <div class="flex min-w-0 flex-1 flex-col gap-0.5">
          <span class="truncate font-mono text-[13px] font-[600] leading-4 text-v2-text-text-base">
            {account() || (signedIn() ? language.t("chimera.keys.connected") : language.t("chimera.keys.disconnected"))}
          </span>
          <span class="font-mono text-[11px] leading-4 text-v2-text-text-faint">
            {signedIn() ? language.t("chimera.keys.signedIn") : language.t("chimera.keys.notSignedIn")}
            {" · "}
            {gatewayHost}
          </span>
        </div>
        <Show when={signedIn()}>
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
            style={{ background: "var(--chimera-accent)", color: "var(--v2-background-bg-base)" }}
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
            <div class="flex flex-col items-center justify-center gap-3 px-4 py-6">
              <p class="text-center text-[12.5px] leading-5 text-v2-text-text-faint">
                {signedIn() ? language.t("chimera.keys.empty") : language.t("chimera.keys.chooseMethod")}
              </p>
              <Show when={!signedIn()}>
                <div class="flex flex-wrap items-center justify-center gap-2">
                  <button
                    type="button"
                    class="flex h-8 items-center rounded-[7px] px-3 text-[12.5px] font-[530] transition-[filter] hover:brightness-105"
                    style={{ background: "var(--chimera-accent)", color: "var(--v2-background-bg-base)" }}
                    onClick={() => openConnect("device")}
                  >
                    {language.t("chimera.connect.tab.device")}
                  </button>
                  <button
                    type="button"
                    class="flex h-8 items-center rounded-[7px] border-[0.5px] border-v2-border-border-base px-3 text-[12.5px] font-[530] text-v2-text-text-base transition-colors hover:bg-v2-overlay-simple-overlay-hover"
                    onClick={() => openConnect("key")}
                  >
                    {language.t("chimera.connect.tab.key")}
                  </button>
                </div>
              </Show>
            </div>
          }
        >
          <For each={store.keys}>
            {(entry, index) => (
              <ChimeraKeyRow
                entry={entry}
                active={store.active === entry.id}
                pending={pending() === entry.id}
                bordered={index() > 0}
                onActivate={() => void activate(entry)}
                onRename={(name) => rename(entry, name)}
                onCopy={() => void copy(entry)}
                onDelete={() => confirmRemove(entry)}
              />
            )}
          </For>
        </Show>
      </div>

      <p class="font-mono text-[11px] leading-4 tracking-[0.2px] text-v2-text-text-faint">
        {language.t("chimera.keys.footnote")}
      </p>
    </div>
  )
}