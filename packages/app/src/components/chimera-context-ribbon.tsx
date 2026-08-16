/**
 * Chimera Context Ribbon（Phase 3 v1）：常驻极简上下文条。
 * 显示当前模型与最近一次请求的 Token 用量/容量（设计稿 Context Field 的收敛形态）。
 * 数据来自上游 getSessionContext（纯派生）；容量未知时不显示进度条。
 */
import { Show } from "solid-js"
import { FieldMeter } from "@chimera/ui/primitives"
import { useLanguage } from "@/context/language"
import type { SessionContext } from "@/chimera/context"

const fmt = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(0)}k` : `${n}`)

export function ChimeraContextRibbon(props: { context: SessionContext | undefined }) {
  const language = useLanguage()
  const visible = () => !!props.context && props.context.total > 0
  return (
    <Show when={visible()}>
      <div
        data-slot="chimera-context-ribbon"
        class="flex h-7 shrink-0 items-center gap-2 border-b-[0.5px] border-v2-border-border-muted px-3"
        title={language.t("chimera.contextRibbon.tooltip")}
      >
        <span class="font-mono text-[10.5px] text-v2-text-text-muted">{props.context!.modelLabel}</span>
        <span class="font-mono text-[10.5px] text-v2-text-text-faint">
          {fmt(props.context!.input)} / {props.context!.limit ? fmt(props.context!.limit) : "?"}
        </span>
        <Show when={props.context!.usage !== null && props.context!.limit}>
          <FieldMeter ratio={Math.min(1, (props.context!.input || 0) / props.context!.limit!)} class="w-24" />
        </Show>
      </div>
    </Show>
  )
}
