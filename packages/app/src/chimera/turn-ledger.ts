/**
 * Turn View Model（Phase 3）：把会话消息投影为"回合"账本视图。
 * 纯投影——不改变会话执行语义、不写持久化数据；可无迁移回滚（路线图 Phase 3）。
 * 每个回合 = 一条用户消息及其后的助手/工具活动。
 *
 * 输入采用宽松结构（只依赖 id/role/parts），兼容 server-sync 的实际消息对象
 * 与测试 fixture，避免绑定 SDK 生成类型的字段漂移。
 */

export type TurnState = "active" | "completed" | "error"

export type TurnView = {
  /** 回合起始的用户消息 id（用于跳转）。 */
  id: string
  /** 用户意图摘要（首条文本 part，截断）。 */
  intent: string
  /** 本回合工具调用数。 */
  toolCount: number
  /** 是否有失败的工具调用。 */
  error: boolean
  /** 本回合助手消息数（含工具执行消息）。 */
  assistantCount: number
  /** 是否为最后一个回合（进行中态）。 */
  active: boolean
}

export type LedgerPart = {
  type?: string
  text?: string
  state?: { status?: string } | null
}

export type LedgerMessage = {
  id: string
  role: string
  parts?: LedgerPart[]
}

const INTENT_LIMIT = 120

function textOf(parts: LedgerPart[] | undefined): string {
  if (!parts) return ""
  const part = parts.find((item) => item.type === "text" && typeof item.text === "string" && item.text.trim())
  return part?.text?.trim() ?? ""
}

function summarize(text: string): string {
  const singleLine = text.replace(/\s+/g, " ")
  if (singleLine.length <= INTENT_LIMIT) return singleLine
  return `${singleLine.slice(0, INTENT_LIMIT)}…`
}

function toolActivity(parts: LedgerPart[] | undefined) {
  let toolCount = 0
  let error = false
  for (const part of parts ?? []) {
    if (part.type !== "tool") continue
    toolCount += 1
    if (part.state?.status === "error") error = true
  }
  return { toolCount, error }
}

/** 把消息流投影为回合列表（最后一个回合标记 active）。 */
export function projectTurns(messages: readonly LedgerMessage[]): TurnView[] {
  const turns: TurnView[] = []
  for (const message of messages) {
    if (message.role === "user") {
      turns.push({
        id: message.id,
        intent: summarize(textOf(message.parts)),
        toolCount: 0,
        error: false,
        assistantCount: 0,
        active: false,
      })
      continue
    }
    const turn = turns.at(-1)
    if (!turn) continue
    const activity = toolActivity(message.parts)
    turn.toolCount += activity.toolCount
    turn.error = turn.error || activity.error
    turn.assistantCount += 1
  }
  const last = turns.at(-1)
  if (last) last.active = true
  return turns
}
