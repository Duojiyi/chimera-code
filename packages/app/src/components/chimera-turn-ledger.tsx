/**
 * Chimera Turn Ledger（Phase 3 v1）：会话顶部的连续回合轨迹。
 * 数据来自 Turn View Model（纯投影）；点击跳转到对应用户消息。
 * 状态语义：进行中 = signal.intent（熔金）、完成 = signal.execute（青金）、错误 = signal.danger。
 */
import { For, Show } from "solid-js"
import { SignalBadge } from "@chimera/ui/primitives"
import { useLanguage } from "@/context/language"
import type { TurnView } from "@/chimera/turn-ledger"

export function ChimeraTurnLedger(props: { turns: TurnView[]; onJump: (id: string) => void }) {
  const language = useLanguage()
  return (
    <Show when={props.turns.length > 0}>
      <div
        data-slot="chimera-turn-ledger"
        class="flex h-7 shrink-0 items-center gap-1 overflow-x-auto border-b-[0.5px] border-v2-border-border-muted px-3"
        aria-label={language.t("chimera.turnLedger.label")}
      >
        <For each={props.turns}>
          {(turn, index) => (
            <button
              type="button"
              class="flex h-[22px] shrink-0 cursor-pointer items-center gap-1.5 rounded-[6px] px-2 text-[11px] transition-colors hover:bg-v2-overlay-simple-overlay-hover"
              classList={{
                "border border-v2-border-border-strong": turn.active,
              }}
              style={
                turn.active
                  ? { background: "color-mix(in srgb, var(--chimera-signal-intent) 12%, transparent)" }
                  : undefined
              }
              aria-label={language.t("chimera.turnLedger.turn", { n: `${index() + 1}`, intent: turn.intent })}
              title={turn.intent}
              onClick={() => props.onJump(turn.id)}
            >
              <SignalBadge
                tone={turn.active ? "intent" : turn.error ? "danger" : "execute"}
                label={""}
              />
              <span class="max-w-[180px] truncate text-v2-text-text-base">{turn.intent}</span>
              <Show when={turn.toolCount > 0}>
                <span class="font-mono text-[10px] text-v2-text-text-faint">{turn.toolCount} tools</span>
              </Show>
            </button>
          )}
        </For>
      </div>
    </Show>
  )
}
