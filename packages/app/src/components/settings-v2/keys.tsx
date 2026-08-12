import { BRAND } from "@chimera/brand"
import { Spinner } from "@opencode-ai/ui/spinner"
import { TextInputV2 } from "@opencode-ai/ui/v2/text-input-v2"
import { For, Show, createSignal, type Accessor, type Component } from "solid-js"
import { createStore } from "solid-js/store"
import { readChimeraKeys, writeChimeraKeys, type ChimeraKeyEntry } from "../chimera-keys"
import { useServerSDK } from "@/context/server-sdk"
import { showToast } from "@/utils/toast"

// 设置 · 密钥（设计稿 S6）：中转站多密钥管理页。
// 前后端对齐：切换=服务端 auth 保存并刷新实例；用量列待网关统计接口，先展示占位。
// TODO(chimera): 文案待补 i18n 键。

const mask = (key: string) => (key.length > 10 ? `${key.slice(0, 6)}…${key.slice(-4)}` : "••••••")

export const SettingsKeysV2: Component<{ directory?: Accessor<string | undefined> }> = (props) => {
  const serverSDK = useServerSDK()
  const [store, setStore] = createStore(readChimeraKeys())
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
      showToast({ title: `已切换到 ${entry.name}`, variant: "default" })
    } catch {
      showToast({ title: "切换失败，请检查网关可用性", variant: "default" })
    } finally {
      setPending("")
    }
  }

  const copy = async (entry: ChimeraKeyEntry) => {
    await navigator.clipboard.writeText(entry.key)
    showToast({ title: "密钥已复制", variant: "default" })
  }

  const remove = (entry: ChimeraKeyEntry) => {
    setStore(
      "keys",
      store.keys.filter((item) => item.key !== entry.key),
    )
    persist()
  }

  const add = async (e: SubmitEvent) => {
    e.preventDefault()
    const key = newKey().trim()
    if (!key) return
    const entry: ChimeraKeyEntry = { name: newName().trim() || `密钥 ${store.keys.length + 1}`, key }
    if (!store.keys.some((item) => item.key === key)) setStore("keys", store.keys.length, entry)
    persist()
    setNewName("")
    setNewKey("")
    setAdding(false)
    await activate(entry)
  }

  return (
    <div class="flex w-full flex-col gap-5">
      <div class="flex items-start justify-between gap-4">
        <div class="flex flex-col gap-1.5">
          <h2 class="text-[16px] font-[600] leading-6 text-v2-text-text-base">密钥</h2>
          <p class="text-[12.5px] leading-5 text-v2-text-text-muted">中转站账号下的接入密钥，可随时切换</p>
        </div>
        <button
          type="button"
          class="flex h-8 shrink-0 items-center gap-1.5 rounded-[7px] border-[0.5px] border-v2-border-border-base px-3 text-[12.5px] text-v2-text-text-base hover:bg-v2-overlay-simple-overlay-hover"
          onClick={() => setAdding((v) => !v)}
        >
          + 添加密钥
        </button>
      </div>

      <Show when={adding()}>
        <form class="flex w-full items-end gap-2" onSubmit={add}>
          <div class="flex flex-1 flex-col gap-1.5">
            <label class="text-[12px] font-[530] text-v2-text-text-muted">名称</label>
            <TextInputV2 placeholder="如：个人密钥" value={newName()} onInput={(e) => setNewName(e.currentTarget.value)} />
          </div>
          <div class="flex flex-[2] flex-col gap-1.5">
            <label class="text-[12px] font-[530] text-v2-text-text-muted">密钥</label>
            <TextInputV2
              type="password"
              placeholder="sk-... / chm-..."
              value={newKey()}
              onInput={(e) => setNewKey(e.currentTarget.value)}
            />
          </div>
          <button
            type="submit"
            class="flex h-9 shrink-0 items-center rounded-[8px] px-4 text-[13px] font-[530] hover:brightness-105"
            style={{ background: "var(--v2-state-fg-warning)", color: "var(--v2-background-bg-base)" }}
          >
            保存并使用
          </button>
        </form>
      </Show>

      <div class="flex w-full flex-col overflow-hidden rounded-[10px] border-[0.5px] border-v2-border-border-muted">
        <div class="flex h-9 w-full items-center gap-3 border-b-[0.5px] border-v2-border-border-muted bg-v2-background-bg-layer-02 px-4">
          <span class="w-[160px] font-mono text-[10.5px] text-v2-text-text-faint">名称</span>
          <span class="w-[180px] font-mono text-[10.5px] text-v2-text-text-faint">密钥</span>
          <span class="w-[100px] font-mono text-[10.5px] text-v2-text-text-faint">本月用量</span>
          <div class="flex-1" />
          <span class="font-mono text-[10.5px] text-v2-text-text-faint">操作</span>
        </div>
        <Show
          when={store.keys.length > 0}
          fallback={
            <div class="flex h-16 items-center justify-center bg-v2-background-bg-layer-01 text-[12px] text-v2-text-text-faint">
              还没有登记密钥
            </div>
          }
        >
          <For each={store.keys}>
            {(entry, index) => (
              <div
                class="flex h-12 w-full items-center gap-3 bg-v2-background-bg-layer-01 px-4"
                classList={{
                  "border-t-[0.5px] border-v2-border-border-muted": index() > 0,
                  "bg-v2-background-bg-layer-02": store.active === entry.key,
                }}
              >
                <span class="flex w-[160px] items-center gap-2 truncate text-[13px] font-[530] text-v2-text-text-base">
                  {entry.name}
                  <Show when={store.active === entry.key}>
                    <span
                      class="rounded-[4px] px-1.5 py-0.5 text-[10px] font-[530]"
                      style={{
                        color: "var(--v2-state-fg-warning)",
                        background: "color-mix(in srgb, var(--v2-state-fg-warning) 14%, transparent)",
                      }}
                    >
                      当前
                    </span>
                  </Show>
                </span>
                <button
                  type="button"
                  class="w-[180px] truncate text-left font-mono text-[11.5px] text-v2-text-text-muted hover:text-v2-text-text-base"
                  title="点击复制"
                  onClick={() => void copy(entry)}
                >
                  {mask(entry.key)}
                </button>
                <span class="w-[100px] font-mono text-[11.5px] text-v2-text-text-faint" title="用量统计待网关接口">
                  —
                </span>
                <div class="flex-1" />
                <Show
                  when={store.active === entry.key}
                  fallback={
                    <div class="flex items-center gap-1.5">
                      <button
                        type="button"
                        class="flex h-6 items-center rounded-[6px] border-[0.5px] border-v2-border-border-base px-2.5 text-[11.5px] text-v2-text-text-base hover:bg-v2-overlay-simple-overlay-hover"
                        disabled={!!pending()}
                        onClick={() => void activate(entry)}
                      >
                        <Show when={pending() === entry.key} fallback="切换">
                          <Spinner class="size-3.5" />
                        </Show>
                      </button>
                      <button
                        type="button"
                        class="flex h-6 items-center rounded-[6px] px-2 text-[11.5px] text-v2-text-text-faint hover:text-v2-state-fg-danger"
                        onClick={() => remove(entry)}
                      >
                        删除
                      </button>
                    </div>
                  }
                >
                  <span class="flex items-center gap-1.5 text-[11px] font-[530]" style={{ color: "var(--v2-state-fg-warning)" }}>
                    <span
                      class="inline-block size-1.5 rounded-full"
                      style={{ background: "linear-gradient(135deg, #DEA54C, #46C39A)" }}
                    />
                    使用中
                  </span>
                </Show>
              </div>
            )}
          </For>
        </Show>
      </div>

      <p class="text-[11.5px] leading-4 text-v2-text-text-faint">
        同一中转站可保存多条密钥 · 任意界面 Ctrl+Shift+K 快速切换 · 用量按密钥独立统计（待网关接口）
      </p>
    </div>
  )
}
