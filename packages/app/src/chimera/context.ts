/**
 * Context Ribbon 数据适配（app/src/chimera/context.ts）：
 * 把 useModels 的模型目录投影为 getSessionContext 需要的 Provider 结构。
 */
import { createMemo, type Accessor } from "solid-js"
import { getSessionContext } from "@/components/session/session-context-metrics"
import { useModels } from "@/context/models"
import type { Message } from "@opencode-ai/sdk/v2"

export type SessionContext = ReturnType<typeof getSessionContext>

export function useSessionContext(messages: Accessor<readonly Message[]>): Accessor<SessionContext> {
  const models = useModels()
  const providers = createMemo(() => {
    const byProvider = new Map<string, { id: string; models: Record<string, { limit: { context: number } }> }>()
    for (const model of models.list()) {
      const p = byProvider.get(model.provider.id) ?? { id: model.provider.id, models: {} }
      const context = model.limit?.context ?? 0
      if (context > 0) p.models[model.id] = { limit: { context } }
      byProvider.set(model.provider.id, p)
    }
    return [...byProvider.values()]
  })
  return createMemo(() => getSessionContext(messages() as Message[], providers()))
}
