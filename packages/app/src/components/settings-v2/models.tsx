import { BRAND } from "@chimera/brand"
import { useFilteredList } from "@opencode-ai/ui/hooks"
import { Switch } from "@opencode-ai/ui/v2/switch-v2"
import { Icon as IconV2 } from "@opencode-ai/ui/v2/icon"
import { IconButtonV2 } from "@opencode-ai/ui/v2/icon-button-v2"
import { TextInputV2 } from "@opencode-ai/ui/v2/text-input-v2"
import { type Component, For, Show, createMemo } from "solid-js"
import { useLanguage } from "@/context/language"
import { useModels } from "@/context/models"
import "./settings-v2.css"

type ModelItem = ReturnType<ReturnType<typeof useModels>["list"]>[number]

// chimera: 设置·模型（设计稿 S3）——网关模型表：模型 / 协议 / 上下文 / 默认 / 状态。
// 前后端对齐：状态=可见性开关（本地持久化）；默认=置顶最近使用（composer 无会话选择时
// 的真实默认取值链）；协议/上下文来自 provider 与模型元数据。

function contextLabel(item: ModelItem) {
  const context = item.limit?.context
  if (!context) return "—"
  if (context >= 1_000_000) return `${(context / 1_000_000).toFixed(context % 1_000_000 ? 1 : 0)}m`
  return `${Math.round(context / 1000)}k`
}

// 协议列显示模型家族原生协议（设计稿 S3：claude→Anthropic）。网关模型按模型 ID
// 推断家族；推断不出时回落「OpenAI 兼容」（网关实际接入协议）。
// Anthropic/OpenAI/Google 为产品专名不译。
function protocolLabel(item: ModelItem, language: ReturnType<typeof useLanguage>) {
  if (item.provider.id === "anthropic") return "Anthropic"
  if (item.provider.id === "openai") return "OpenAI"
  if (item.provider.id === "chimera") {
    const id = item.id.toLowerCase()
    if (id.startsWith("claude")) return "Anthropic"
    if (id.startsWith("gpt") || /^o\d/.test(id)) return "OpenAI"
    if (id.startsWith("gemini")) return "Google"
    return language.t("chimera.models.protocol.openaiCompatible")
  }
  return item.provider.name
}

export const SettingsModelsV2: Component = () => {
  const language = useLanguage()
  const models = useModels()

  const list = useFilteredList<ModelItem>({
    items: (_filter) => models.list(),
    key: (x) => `${x.provider.id}:${x.id}`,
    filterKeys: ["provider.name", "name", "id"],
    sortBy: (a, b) => a.id.localeCompare(b.id),
  })

  const defaultKey = createMemo(() => {
    const recent = models.recent.list()[0]
    return recent ? `${recent.providerID}:${recent.modelID}` : undefined
  })

  return (
    <div class="flex w-full flex-col px-9 pb-10 pt-8">
      <div class="flex w-full items-start justify-between gap-4">
        <div class="flex min-w-0 flex-1 flex-col gap-1">
          <h2 class="text-[16px] font-[600] leading-6 text-v2-text-text-base">{language.t("settings.models.title")}</h2>
          <p class="text-[12.5px] leading-5 text-v2-text-text-muted">
            {language.t("chimera.models.description", { name: BRAND.name })}
          </p>
        </div>
        <div class="settings-v2-tab-search shrink-0" style={{ width: "220px" }}>
          <TextInputV2
            type="search"
            appearance="base"
            value={list.filter()}
            onInput={(event) => list.onInput(event.currentTarget.value)}
            placeholder={language.t("dialog.model.search.placeholder")}
            spellcheck={false}
            autocorrect="off"
            autocomplete="off"
            autocapitalize="off"
            aria-label={language.t("dialog.model.search.placeholder")}
          />
          <Show when={list.filter()}>
            <IconButtonV2
              type="button"
              variant="ghost-muted"
              size="small"
              class="settings-v2-tab-search-clear"
              icon={<IconV2 name="close" size="large" class="text-v2-icon-icon-muted" />}
              onClick={() => list.clear()}
            />
          </Show>
        </div>
      </div>

      <div class="mt-4 flex w-full flex-col overflow-hidden rounded-[10px] border-[0.5px] border-v2-border-border-muted">
        <div class="flex h-8 w-full items-center gap-3 border-b-[0.5px] border-v2-border-border-muted px-4">
          <span class="flex-1 font-mono text-[10.5px] tracking-[0.5px] text-v2-text-text-faint">
            {language.t("chimera.models.header.model")}
          </span>
          <span class="w-[110px] font-mono text-[10.5px] tracking-[0.5px] text-v2-text-text-faint">
            {language.t("chimera.models.header.protocol")}
          </span>
          <span class="w-[70px] font-mono text-[10.5px] tracking-[0.5px] text-v2-text-text-faint">
            {language.t("chimera.models.header.context")}
          </span>
          <span class="w-[52px] font-mono text-[10.5px] tracking-[0.5px] text-v2-text-text-faint">
            {language.t("chimera.models.header.default")}
          </span>
          <span class="w-[44px] text-right font-mono text-[10.5px] tracking-[0.5px] text-v2-text-text-faint">
            {language.t("chimera.models.header.status")}
          </span>
        </div>
        <Show
          when={!list.grouped.loading}
          fallback={
            <div class="flex h-16 items-center justify-center text-[12px] text-v2-text-text-faint">
              {language.t("common.loading")}
              {language.t("common.loading.ellipsis")}
            </div>
          }
        >
          <Show
            when={list.flat().length > 0}
            fallback={
              <div class="flex h-16 items-center justify-center gap-1 text-[12px] text-v2-text-text-faint">
                <span>{language.t("dialog.model.empty")}</span>
                <Show when={list.filter()}>
                  <span>&quot;{list.filter()}&quot;</span>
                </Show>
              </div>
            }
          >
            <For each={list.flat()}>
              {(item, index) => {
                const key = { providerID: item.provider.id, modelID: item.id }
                const visible = () => models.visible(key)
                const isDefault = () => defaultKey() === `${item.provider.id}:${item.id}`
                return (
                  <div
                    class="flex h-10 w-full items-center gap-3 px-4 transition-[opacity,background-color] hover:bg-v2-overlay-simple-overlay-hover"
                    classList={{
                      "border-t-[0.5px] border-v2-border-border-muted": index() > 0,
                      "opacity-45": !visible(),
                    }}
                  >
                    <span class="flex min-w-0 flex-1 items-center gap-2.5">
                      <span
                        class="inline-block size-1.5 shrink-0 rounded-full"
                        style={{
                          background: visible() ? "var(--v2-state-fg-success)" : "var(--v2-icon-icon-faint)",
                        }}
                      />
                      <span class="truncate font-mono text-[12.5px] font-[530] text-v2-text-text-base" title={item.name}>
                        {item.id}
                      </span>
                    </span>
                    <span class="w-[110px] shrink-0">
                      <span class="inline-flex h-[18px] items-center rounded-[4px] border-[0.5px] border-v2-border-border-base px-1.5 font-mono text-[10px] text-v2-text-text-muted">
                        {protocolLabel(item, language)}
                      </span>
                    </span>
                    <span class="w-[70px] shrink-0 font-mono text-[11.5px] text-v2-text-text-muted">
                      {contextLabel(item)}
                    </span>
                    <span class="flex w-[52px] shrink-0 items-center">
                      <button
                        type="button"
                        role="radio"
                        aria-checked={isDefault()}
                        aria-label={language.t("chimera.models.setDefault", { id: item.id })}
                        title={
                          isDefault()
                            ? language.t("chimera.models.currentDefault")
                            : language.t("chimera.models.setDefaultHint")
                        }
                        class="flex size-[18px] items-center justify-center rounded-full border-[1.5px] transition-colors"
                        style={{
                          "border-color": isDefault() ? "var(--v2-state-fg-warning)" : "var(--v2-border-border-base)",
                          color: "var(--v2-state-fg-warning)",
                        }}
                        disabled={!visible()}
                        onClick={() => models.recent.push(key)}
                      >
                        <Show when={isDefault()}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" class="size-2.5">
                            <path d="M20 6 9 17l-5-5" />
                          </svg>
                        </Show>
                      </button>
                    </span>
                    <span class="flex w-[44px] shrink-0 justify-end">
                      <Switch checked={visible()} onChange={(checked) => models.setVisibility(key, checked)} hideLabel>
                        {item.id}
                      </Switch>
                    </span>
                  </div>
                )
              }}
            </For>
          </Show>
        </Show>
      </div>

      <p class="mt-3 font-mono text-[11px] leading-4 tracking-[0.2px] text-v2-text-text-faint">
        {language.t("chimera.models.footnote")}
      </p>
    </div>
  )
}
