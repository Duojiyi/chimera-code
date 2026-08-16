import { describe, expect, test } from "bun:test"
import { projectTurns, type LedgerMessage } from "./turn-ledger"

const user = (id: string, text: string): LedgerMessage => ({
  id,
  role: "user",
  parts: [{ type: "text", text }],
})

const assistant = (parts: Array<{ type: string; tool?: string; state?: { status: string }; text?: string }>): LedgerMessage => ({
  id: "a-" + Math.random().toString(36).slice(2),
  role: "assistant",
  parts,
})

describe("projectTurns", () => {
  test("creates one turn per user message with intent summary", () => {
    const turns = projectTurns([user("u1", "修复登录超时问题"), user("u2", "检查缓存配置")])
    expect(turns).toHaveLength(2)
    expect(turns[0]!.intent).toBe("修复登录超时问题")
    expect(turns[0]!.id).toBe("u1")
  })

  test("aggregates tool activity into the owning turn", () => {
    const turns = projectTurns([
      user("u1", "改配置"),
      assistant([{ type: "tool", tool: "edit", state: { status: "completed" } }, { type: "tool", tool: "bash", state: { status: "error" } }]),
      assistant([{ type: "text", text: "完成" }]),
      user("u2", "验证"),
    ])
    expect(turns).toHaveLength(2)
    expect(turns[0]!.toolCount).toBe(2)
    expect(turns[0]!.error).toBe(true)
    expect(turns[0]!.assistantCount).toBe(2)
  })

  test("marks only the last turn active", () => {
    const turns = projectTurns([user("u1", "一"), assistant([{ type: "text", text: "ok" }]), user("u2", "二")])
    expect(turns[0]!.active).toBe(false)
    expect(turns[1]!.active).toBe(true)
  })

  test("summarizes long intents with ellipsis", () => {
    const long = "x".repeat(300)
    const turns = projectTurns([user("u1", long)])
    expect(turns[0]!.intent.length).toBeLessThanOrEqual(121)
    expect(turns[0]!.intent.endsWith("…")).toBe(true)
  })

  test("ignores assistant messages before any user message", () => {
    const turns = projectTurns([assistant([{ type: "text", text: "孤立" }]), user("u1", "开始")])
    expect(turns).toHaveLength(1)
    expect(turns[0]!.intent).toBe("开始")
  })
})
