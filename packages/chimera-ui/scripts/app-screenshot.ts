/**
 * 连接运行中的 Chimera 桌面应用（dev 模式 CDP 端口 9222）截取当前界面。
 * 用法：bun scripts/app-screenshot.ts [输出路径.png]
 */
const out = process.argv[2] ?? "app-screenshot.png"

type Target = { type: string; url: string; title: string; webSocketDebuggerUrl: string }

const targets = (await fetch("http://127.0.0.1:9222/json").then((r) => r.json())) as Target[]
const page = targets.find((t) => t.type === "page" && !t.url.startsWith("devtools://"))
if (!page) {
  console.error("未找到应用页面。当前 targets:", targets.map((t) => `${t.type}:${t.url}`).join(", "))
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
const result = await send("Page.captureScreenshot", { format: "png" })
if (!result.result?.data) {
  console.error("截图失败:", JSON.stringify(result.error ?? result))
  process.exit(1)
}
await Bun.write(out, Buffer.from(result.result.data, "base64"))
console.log(`已保存: ${out}（页面: ${page.title}）`)
ws.close()
