/**
 * Chimera Fusion Composer v1（Phase 4）：输入区上方的执行配方摘要条。
 * 展示 Agent · 模型 · 模式（渐进展开——默认极简，仅摘要；完整配方交互沿用
 * 输入区既有控件：模型胶囊 / 思考强度滑条 / 模式切换）。
 */
import { Show, createMemo } from "solid-js"
import { CapabilityTag } from "@chimera/ui/primitives"
import { useLanguage } from "@/context/language"
import { useLocal } from "@/context/local"

export function ChimeraFusionComposer() {
  const language = useLanguage()
  const local = useLocal()

  const modelLabel = createMemo(() => {
    const current = local.model.current()
    if (!current) return ""
    return `${current.provider.id}/${current.id}`
  })
  const agentLabel = () => local.agent.current()?.name ?? ""

  return (
    <Show when={modelLabel() || agentLabel()}>
      <div
        data-slot="chimera-fusion-composer"
        class="flex h-6 shrink-0 items-center gap-1.5 px-1"
        aria-label={language.t("chimera.composer.recipe")}
      >
        <Show when={agentLabel()}>
          <CapabilityTag label={agentLabel()} tone="intent" />
        </Show>
        <Show when={modelLabel()}>
          <CapabilityTag label={modelLabel()} tone="execute" />
        </Show>
      </div>
    </Show>
  )
}
