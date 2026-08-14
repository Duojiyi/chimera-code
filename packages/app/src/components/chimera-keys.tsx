import { BRAND } from "@chimera/brand"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { DialogBody, DialogFooter, DialogHeader, DialogTitle, DialogTitleGroup, DialogV2 } from "@opencode-ai/ui/v2/dialog-v2"
import { TextInputV2 } from "@opencode-ai/ui/v2/text-input-v2"
import { ButtonV2 } from "@opencode-ai/ui/v2/button-v2"
import { Icon } from "@opencode-ai/ui/v2/icon"
import { IconButtonV2 } from "@opencode-ai/ui/v2/icon-button-v2"
import { MenuV2 } from "@opencode-ai/ui/v2/menu-v2"
import { Spinner } from "@opencode-ai/ui/spinner"
import { For, Show, createEffect, createSignal, onCleanup, type Accessor, type Component } from "solid-js"
import { createStore } from "solid-js/store"
import { useLanguage } from "@/context/language"
import { useServerSDK, type ServerSDK } from "@/context/server-sdk"
import { useServerSync } from "@/context/server-sync"
import { showToast } from "@/utils/toast"

// Chimera 密钥管理（设计稿 S6）：同一中转站保存多条密钥，一键切换当前密钥。
// 列表存于本地（chimera-keys），当前密钥经服务端 auth 保存生效。

export type ChimeraKeyEntry = { name: string; key: string }
type KeysState = { keys: ChimeraKeyEntry[]; active: string }

const STORAGE_KEY = "chimera-keys"

const iconBtn =
  "flex size-6 shrink-0 items-center justify-center rounded-[6px] text-v2-icon-icon-faint transition-colors hover:bg-v2-overlay-simple-overlay-hover hover:text-v2-icon-icon-base"

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

export function requestChimeraKeyPicker() {
  window.dispatchEvent(new CustomEvent("chimera:keys-picker"))
}

export async function switchChimeraKey(input: { entry: ChimeraKeyEntry; sdk: ServerSDK; directory?: string }) {
  await input.sdk.api.integration.connect.key({
    integrationID: BRAND.nameLower,
    key: input.entry.key,
    location: input.directory ? { directory: input.directory } : undefined,
  })
  const state = readChimeraKeys()
  writeChimeraKeys({ keys: state.keys, active: input.entry.key })
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

/** If the removed key is active, fall through to the next remaining key (or empty). */
export function nextActiveKey(keys: ChimeraKeyEntry[], active: string, removing: string) {
  if (active !== removing) return active
  return keys.find((item) => item.key !== removing)?.key ?? ""
}

export function showChimeraKeyDeleteConfirm(input: {
  dialog: ReturnType<typeof useDialog>
  language: ReturnType<typeof useLanguage>
  entry: ChimeraKeyEntry
  last: boolean
  inUse: boolean
  nextName?: string
  onConfirm: () => void
}) {
  const description = () => {
    if (input.last) return input.language.t("chimera.keys.deleteConfirmLast", { name: input.entry.name })
    if (input.inUse) {
      return input.language.t("chimera.keys.deleteConfirmActive", {
        name: input.entry.name,
        next: input.nextName ?? "",
      })
    }
    return input.language.t("chimera.keys.deleteConfirm", { name: input.entry.name })
  }

  void input.dialog.show(() => (
    <DialogV2 fit>
      <DialogHeader hideClose>
        <DialogTitleGroup title={input.language.t("chimera.keys.deleteTitle")} description={description()} />
      </DialogHeader>
      <DialogFooter>
        <ButtonV2 variant="ghost" onClick={() => input.dialog.close()}>
          {input.language.t("common.cancel")}
        </ButtonV2>
        <ButtonV2
          variant="danger"
          onClick={() => {
            input.dialog.close()
            input.onConfirm()
          }}
        >
          {input.language.t("chimera.keys.delete")}
        </ButtonV2>
      </DialogFooter>
    </DialogV2>
  ))
}

const mask = (key: string) => {
  if (key.length <= 10) return "••••••"
  return `${key.slice(0, 8)}••••••${key.slice(-2)}`
}

function KeyMenuItems(props: {
  active: boolean
  pending: boolean
  onSwitch: () => void
  onRename: () => void
  onCopy: () => void
  onDelete: () => void
}) {
  const language = useLanguage()
  return (
    <>
      <MenuV2.Item disabled={props.active || props.pending} onSelect={props.onSwitch}>
        {language.t("chimera.keys.switch")}
      </MenuV2.Item>
      <MenuV2.Item onSelect={props.onRename}>{language.t("chimera.keys.rename")}</MenuV2.Item>
      <MenuV2.Item onSelect={props.onCopy}>{language.t("chimera.keys.copy")}</MenuV2.Item>
      <MenuV2.Separator />
      <MenuV2.Item onSelect={props.onDelete}>{language.t("chimera.keys.delete")}</MenuV2.Item>
    </>
  )
}

export const ChimeraKeyRow: Component<{
  entry: ChimeraKeyEntry
  active: boolean
  pending: boolean
  bordered?: boolean
  compact?: boolean
  onActivate: () => void
  onRename: (name: string) => void
  onCopy: () => void
  onDelete: () => void
}> = (props) => {
  const language = useLanguage()
  const [editing, setEditing] = createSignal(false)
  const [draft, setDraft] = createSignal("")
  const [menuOpen, setMenuOpen] = createSignal(false)
  let input: HTMLInputElement | undefined

  const startRename = () => {
    setDraft(props.entry.name)
    setEditing(true)
  }

  const commitRename = () => {
    if (!editing()) return
    setEditing(false)
    props.onRename(draft())
  }

  createEffect(() => {
    if (!editing()) return
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (input?.contains(target)) return
      commitRename()
    }
    document.addEventListener("pointerdown", onPointerDown, true)
    onCleanup(() => document.removeEventListener("pointerdown", onPointerDown, true))
  })

  return (
    <div
      class="group flex w-full cursor-default items-center gap-3 transition-colors hover:bg-v2-overlay-simple-overlay-hover"
      classList={{
        "h-10 px-4": !props.compact,
        "h-11 bg-v2-background-bg-layer-01 px-3": props.compact,
        "border-t-[0.5px] border-v2-border-border-muted": props.bordered,
        "bg-v2-overlay-simple-overlay-hover": menuOpen(),
      }}
      onContextMenu={(event) => {
        event.preventDefault()
        event.stopPropagation()
        setMenuOpen(true)
      }}
    >
      <span
        class="flex min-w-0 items-center gap-2"
        classList={{ "w-[210px] shrink-0": !props.compact }}
        onDblClick={(event) => {
          event.preventDefault()
          startRename()
        }}
      >
        <Show
          when={!editing()}
          fallback={
            <input
              ref={(el) => {
                input = el
                el.focus()
                el.select()
              }}
              class="h-7 w-full min-w-0 rounded-[6px] border-[0.5px] border-v2-border-border-base bg-v2-background-bg-base px-2 text-[13px] text-v2-text-text-base outline-none"
              value={draft()}
              aria-label={language.t("chimera.keys.renameNamed", { name: props.entry.name })}
              onClick={(event) => event.stopPropagation()}
              onPointerDown={(event) => event.stopPropagation()}
              onInput={(event) => setDraft(event.currentTarget.value)}
              onBlur={commitRename}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault()
                  commitRename()
                  return
                }
                if (event.key !== "Escape") return
                event.preventDefault()
                setEditing(false)
              }}
            />
          }
        >
          <span class="truncate text-[13px] font-[560] text-v2-text-text-base">{props.entry.name}</span>
          <Show when={props.active && !props.compact}>
            <span
              class="shrink-0 rounded-[4px] px-1.5 py-[1px] font-mono text-[10px] font-[560]"
              style={{
                color: "var(--chimera-accent)",
                background: "color-mix(in srgb, var(--chimera-accent) 15%, transparent)",
              }}
            >
              {language.t("chimera.keys.current")}
            </span>
          </Show>
        </Show>
      </span>
      <span class="flex min-w-0 items-center gap-1.5" classList={{ "w-[260px] shrink-0": !props.compact }}>
        <span class="truncate font-mono text-[11.5px] text-v2-text-text-muted">{mask(props.entry.key)}</span>
        <button
          type="button"
          aria-label={language.t("chimera.keys.copy")}
          title={language.t("chimera.keys.copy")}
          class={iconBtn}
          onClick={(event) => {
            event.stopPropagation()
            void props.onCopy()
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="size-3">
            <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
            <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
          </svg>
        </button>
      </span>
      <div class="flex-1" />
      <div class="flex shrink-0 items-center gap-1.5">
        <Show when={!editing()}>
          <button
            type="button"
            aria-label={language.t("chimera.keys.renameNamed", { name: props.entry.name })}
            title={language.t("chimera.keys.rename")}
            class={iconBtn}
            onClick={(event) => {
              event.stopPropagation()
              startRename()
            }}
          >
            <Icon name="edit" size="small" />
          </button>
        </Show>
        <button
          type="button"
          aria-label={language.t("chimera.keys.deleteNamed", { name: props.entry.name })}
          title={language.t("chimera.keys.delete")}
          class={`${iconBtn} hover:text-v2-state-fg-danger`}
          onClick={(event) => {
            event.stopPropagation()
            props.onDelete()
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="size-3.5">
            <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
          </svg>
        </button>
        <Show
          when={props.active}
          fallback={
            <button
              type="button"
              class="flex h-6 items-center rounded-[6px] border-[0.5px] border-v2-border-border-base px-2.5 font-mono text-[11px] text-v2-text-text-base transition-colors hover:bg-v2-overlay-simple-overlay-hover"
              disabled={props.pending}
              onClick={(event) => {
                event.stopPropagation()
                void props.onActivate()
              }}
            >
              <Show when={props.pending} fallback={language.t("chimera.keys.switch")}>
                <Spinner class="size-3" />
              </Show>
            </button>
          }
        >
          <span class="flex items-center gap-1.5 font-mono text-[11px] font-[560]" style={{ color: "var(--chimera-accent)" }}>
            <span
              class="inline-block size-1.5 rounded-full"
              style={{ background: "linear-gradient(135deg, #DEA54C, #46C39A)" }}
            />
            {language.t("chimera.keys.inUse")}
          </span>
        </Show>
        <MenuV2 gutter={6} modal={false} placement="bottom-end" open={menuOpen()} onOpenChange={setMenuOpen}>
          <MenuV2.Trigger
            as={IconButtonV2}
            variant="ghost-muted"
            size="small"
            icon={<Icon name="outline-dots" />}
            aria-label={language.t("chimera.keys.actions")}
            title={language.t("chimera.keys.actions")}
            onClick={(event: MouseEvent) => event.stopPropagation()}
            onPointerDown={(event: PointerEvent) => event.stopPropagation()}
          />
          <MenuV2.Portal>
            <MenuV2.Content>
              <KeyMenuItems
                active={props.active}
                pending={props.pending}
                onSwitch={() => void props.onActivate()}
                onRename={startRename}
                onCopy={() => void props.onCopy()}
                onDelete={props.onDelete}
              />
            </MenuV2.Content>
          </MenuV2.Portal>
        </MenuV2>
      </div>
    </div>
  )
}

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

  const persist = () => writeChimeraKeys({ keys: [...store.keys], active: store.active })

  const activate = async (entry: ChimeraKeyEntry, opts?: { quiet?: boolean }) => {
    if (pending()) return false
    setError(undefined)
    setPending(entry.key)
    try {
      await switchChimeraKey({
        entry,
        sdk: serverSDK(),
        directory: props.directory?.(),
      })
      setStore("active", entry.key)
      void serverSync().refreshProviders()
      if (!opts?.quiet) showToast({ title: language.t("chimera.keys.switched", { name: entry.name }), variant: "default" })
      return true
    } catch {
      setError(language.t("chimera.keys.switchFailed"))
      return false
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

  const rename = (entry: ChimeraKeyEntry, name: string) => {
    const trimmed = name.trim()
    if (!trimmed || trimmed === entry.name) return
    const index = store.keys.findIndex((item) => item.key === entry.key)
    if (index < 0) return
    setStore("keys", index, "name", trimmed)
    persist()
    showToast({ title: language.t("chimera.keys.renamed", { name: trimmed }), variant: "default" })
  }

  const copy = async (entry: ChimeraKeyEntry) => {
    await navigator.clipboard.writeText(entry.key)
    showToast({ title: language.t("chimera.keys.copied"), variant: "default" })
  }

  const remove = async (entry: ChimeraKeyEntry) => {
    const nextKey = nextActiveKey(store.keys, store.active, entry.key)
    const next = store.keys.find((item) => item.key === nextKey)
    if (store.active === entry.key && next) {
      const ok = await activate(next, { quiet: true })
      if (!ok) return
    }
    if (store.active === entry.key && !next) {
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
      store.keys.filter((item) => item.key !== entry.key),
    )
    persist()
    showToast({ title: language.t("chimera.keys.deleted"), variant: "default" })
  }

  const confirmRemove = (entry: ChimeraKeyEntry) => {
    const nextKey = nextActiveKey(store.keys, store.active, entry.key)
    showChimeraKeyDeleteConfirm({
      dialog,
      language,
      entry,
      last: store.keys.length === 1,
      inUse: store.active === entry.key,
      nextName: store.keys.find((item) => item.key === nextKey)?.name,
      onConfirm: () => void remove(entry),
    })
  }

  return (
    <DialogV2
      fit
      containerClass="!h-auto max-h-[calc(100vh_-_16px)] !w-[min(calc(100vw_-_16px),560px)]"
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
                  <ChimeraKeyRow
                    entry={entry}
                    active={store.active === entry.key}
                    pending={pending() === entry.key}
                    bordered={index() > 0}
                    compact
                    onActivate={() => void activate(entry)}
                    onRename={(name) => rename(entry, name)}
                    onCopy={() => void copy(entry)}
                    onDelete={() => confirmRemove(entry)}
                  />
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
