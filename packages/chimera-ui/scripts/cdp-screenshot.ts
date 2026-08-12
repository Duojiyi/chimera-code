/** CDP Page.captureScreenshot：直接取 renderer 合成输出，绕开 DWM/屏幕采集。 */
const out = process.argv[2] ?? "cdp-shot.png"

type Target = { type: string; url: string; webSocketDebuggerUrl: string }
const targets = (await fetch("http://127.0.0.1:9222/json").then((r) => r.json())) as Target[]
const page = targets.find((t) => t.type === "page" && !t.url.startsWith("devtools://"))
if (!page) {
  console.error("no page target")
  process.exit(1)
}

const ws = new WebSocket(page.webSocketDebuggerUrl)
let seq = 0
const pending = new Map<number, (value: { result?: { data?: string } }) => void>()
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
  return new Promise<{ result?: { data?: string } }>((resolve) => pending.set(id, resolve))
}
await new Promise((resolve) => (ws.onopen = resolve))
const shot = await send("Page.captureScreenshot", { format: "png" })
if (!shot.result?.data) {
  console.error("no screenshot data")
  process.exit(1)
}
await Bun.write(out, Buffer.from(shot.result.data, "base64"))
console.log(`saved ${out}`)
ws.close()
