import { BRAND } from "@chimera/brand"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { DialogBody, DialogHeader, DialogTitle, DialogV2 } from "@opencode-ai/ui/v2/dialog-v2"
import { TextInputV2 } from "@opencode-ai/ui/v2/text-input-v2"
import { Spinner } from "@opencode-ai/ui/spinner"
import { For, Show, createSignal, type Accessor, type Component } from "solid-js"
import { createStore } from "solid-js/store"
import { useLanguage } from "@/context/language"
import { useServerSDK } from "@/context/server-sdk"
import { useServerSync } from "@/context/server-sync"
import { showToast } from "@/utils/toast"

// Chimera 密钥管理（设计稿 S6）：同一中转站保存多条密钥，一键切换当前密钥。
// 列表存于本地（chimera-keys），当前密钥经服务端 auth 保存生效。
// TODO(chimera): 文案待补 i18n 键；后续接中转站账号同步密钥列表。

export type ChimeraKeyEntry = { name: string; key: string }
type KeysState = { keys: ChimeraKeyEntry[]; active: string }

const STORAGE_KEY = "chimera-keys"

export function readChimeraKeys(): KeysState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { keys: [], active: "" }
    const parsed = JSON.parse(raw) as KeysState
    return { keys: parsed.keys ?? [], active: parsed.active ?? "" }
  } catch {
    return { keys: [], active: "" }
  }
}

export function writeChimeraKeys(state: KeysState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  window.dispatchEvent(new CustomEvent("chimera:keys-changed"))
}

/** 当前生效密钥的展示名（状态栏用） */
export function activeChimeraKeyName(): string | undefined {
  const state = readChimeraKeys()
  return state.keys.find((item) => item.key === state.active)?.name
}

export function hasChimeraAuth() {
  return readChimeraKeys().keys.length > 0 || !!localStorage.getItem("chimera-account")
}

export function registerChimeraKey(key: string, name?: string | ((index: number) => string)) {
  const state = readChimeraKeys()
  if (!state.keys.some((item) => item.key === key)) {
    const index = state.keys.length + 1
    const resolved = typeof name === "function" ? name(index) : name
    state.keys.push({ name: resolved ?? `Key ${index}`, key })
  }
  state.active = key
  writeChimeraKeys(state)
}

const mask = (key: string) => (key.length > 10 ? `${key.slice(0, 6)}…${key.slice(-4)}` : "••••••")

export const ChimeraKeysDialog: Component<{ directory?: Accessor<string | undefined> }> = (props) => {
  const dialog = useDialog()
  const language = useLanguage()
  const serverSDK = useServerSDK()
  const serverSync = useServerSync()
  const [store, setStore] = createStore(readChimeraKeys())
  const [adding, setAdding] = createSignal(false)
  const [newName, setNewName] = createSignal("")
  const [newKey, setNewKey] = createSignal("")
  const [pending, setPending] = createSignal("")
  const [error, setError] = createSignal<string>()

  const location = () => {
    const value = props.directory?.()
    return value ? { directory: value } : undefined
  }

  const persist = () => writeChimeraKeys({ keys: [...store.keys], active: store.active })

  const activate = async (entry: ChimeraKeyEntry) => {
    if (pending()) return
    setError(undefined)
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
      setError(language.t("chimera.keys.switchFailed"))
    } finally {
      setPending("")
    }
  }

  const add = async (e: SubmitEvent) => {
    e.preventDefault()
    const key = newKey().trim()
    if (!key) {
      setError(language.t("chimera.keys.enterKey"))
      return
    }
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

  const remove = (entry: ChimeraKeyEntry) => {
    setStore(
      "keys",
      store.keys.filter((item) => item.key !== entry.key),
    )
    persist()
  }

  return (
    <DialogV2
      fit
      containerClass="!h-auto max-h-[calc(100vh_-_16px)] !w-[min(calc(100vw_-_16px),480px)]"
      class="[font-family:var(--v2-font-family-sans)] [&_[data-slot=dialog-header]]:!px-5 [&_[data-slot=dialog-header-title]]:!text-[15px]"
    >
      <DialogHeader closeLabel={language.t("common.close")}>
        <DialogTitle>
          {BRAND.name} {language.t("chimera.keys.title")}
        </DialogTitle>
      </DialogHeader>
      <DialogBody class="min-h-0 flex-none gap-0 overflow-y-auto px-5 pb-5">
        <div class="flex w-full flex-col gap-3">
          <p class="text-[12px] leading-4 text-v2-text-text-faint">{language.t("chimera.keys.footnote")}</p>

          <Show
            when={store.keys.length > 0}
            fallback={
              <div class="flex h-16 items-center justify-center rounded-[8px] border-[0.5px] border-dashed border-v2-border-border-muted text-[12px] text-v2-text-text-faint">
                {language.t("chimera.keys.empty")}
              </div>
            }
          >
            <div class="flex w-full flex-col overflow-hidden rounded-[8px] border-[0.5px] border-v2-border-border-muted">
              <For each={store.keys}>
                {(entry, index) => (
                  <div
                    class="flex h-11 w-full items-center gap-3 bg-v2-background-bg-layer-01 px-3"
                    classList={{ "border-t-[0.5px] border-v2-border-border-muted": index() > 0 }}
                  >
                    <span class="min-w-0 truncate text-[13px] font-[530] text-v2-text-text-base">{entry.name}</span>
                    <span class="font-mono text-[11px] text-v2-text-text-muted">{mask(entry.key)}</span>
                    <div class="flex-1" />
                    <Show
                      when={store.active === entry.key}
                      fallback={
                        <>
                          <button
                            type="button"
                            class="flex h-6 items-center rounded-[6px] border-[0.5px] border-v2-border-border-base px-2.5 text-[11.5px] text-v2-text-text-base hover:bg-v2-overlay-simple-overlay-hover"
                            disabled={!!pending()}
                            onClick={() => void activate(entry)}
                          >
                            <Show when={pending() === entry.key} fallback={language.t("chimera.keys.switch")}>
                              <Spinner class="size-3.5" />
                            </Show>
                          </button>
                          <button
                            type="button"
                            aria-label={language.t("chimera.keys.deleteNamed", { name: entry.name })}
                            class="flex h-6 items-center rounded-[6px] px-2 text-[11.5px] text-v2-text-text-faint hover:text-v2-state-fg-danger"
                            onClick={() => remove(entry)}
                          >
                            {language.t("chimera.keys.delete")}
                          </button>
                        </>
                      }
                    >
                      <span class="flex items-center gap-1.5 text-[11px] font-[530]" style={{ color: "var(--chimera-accent)" }}>
                        <span
                          class="inline-block size-1.5 rounded-full"
                          style={{ background: "linear-gradient(135deg, #DEA54C, #46C39A)" }}
                        />
                        {language.t("chimera.keys.inUse")}
                      </span>
                    </Show>
                  </div>
                )}
              </For>
            </div>
          </Show>

          <Show when={error()}>
            <p class="text-[12px] leading-4 text-v2-state-fg-danger">{error()}</p>
          </Show>

          <Show
            when={adding()}
            fallback={
              <button
                type="button"
                class="flex h-9 w-full items-center justify-center rounded-[8px] border-[0.5px] border-dashed border-v2-border-border-base text-[13px] text-v2-text-text-muted hover:text-v2-text-text-base"
                onClick={() => setAdding(true)}
              >
                + {language.t("chimera.keys.add")}
              </button>
            }
          >
            <form class="flex w-full flex-col gap-2" onSubmit={add}>
              <TextInputV2
                placeholder={language.t("chimera.keys.name.placeholder")}
                value={newName()}
                onInput={(e) => setNewName(e.currentTarget.value)}
              />
              <TextInputV2
                type="password"
                placeholder={language.t("chimera.keys.key.placeholder")}
                value={newKey()}
                onInput={(e) => setNewKey(e.currentTarget.value)}
              />
              <button
                type="submit"
                class="flex h-9 w-full items-center justify-center rounded-[8px] text-[13px] font-[530] hover:brightness-105"
                style={{ background: "var(--chimera-accent)", color: "var(--v2-background-bg-base)" }}
              >
                {language.t("chimera.keys.save")}
              </button>
            </form>
          </Show>
        </div>
      </DialogBody>
    </DialogV2>
  )
}
