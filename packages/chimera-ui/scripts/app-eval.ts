/**
 * 在运行中的 Chimera 桌面应用里执行一段 JS（CDP Runtime.evaluate）。
 * 用法：bun scripts/app-eval.ts "document.title"
 */
const expression = process.argv[2]
if (!expression) {
  console.error("用法：bun scripts/app-eval.ts <JS 表达式>")
  process.exit(1)
}

type Target = { type: string; url: string; title: string; webSocketDebuggerUrl: string }

const targets = (await fetch("http://127.0.0.1:9222/json").then((r) => r.json())) as Target[]
const page = targets.find((t) => t.type === "page" && !t.url.startsWith("devtools://"))
if (!page) {
  console.error("未找到应用页面")
  process.exit(1)
}

const ws = new WebSocket(page.webSocketDebuggerUrl)
let seq = 0
const pending = new Map<number, (value: any) => void>()

ws.onmessage = (event) => {
  const msg = JSON.parse(String(event.data))
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)!(msg)
    pending.delete(msg.id)
  }
}

function send(method: string, params: Record<string, unknown> = {}) {
  const id = ++seq
  ws.send(JSON.stringify({ id, method, params }))
  return new Promise<any>((resolve) => pending.set(id, resolve))
}

await new Promise((resolve) => (ws.onopen = resolve))
const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true })
console.log(JSON.stringify(result.result?.result ?? result.error, null, 2))
ws.close()
