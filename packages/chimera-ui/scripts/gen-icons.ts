/**
 * 从图标母版生成桌面端全套图标资产（覆盖 packages/desktop/icons 的三个渠道）。
 * 策略：遍历渠道目录中已存在的 PNG，按其原始尺寸用母版重新渲染覆盖；
 * icon.ico / icon.icns 用 png2icons 从母版生成。
 * 用法：bun scripts/gen-icons.ts <master.png>
 */
import { Jimp } from "jimp"
import * as png2icons from "png2icons"
import { readdir, stat } from "node:fs/promises"
import { join } from "node:path"

const master = process.argv[2]
if (!master) {
  console.error("用法：bun scripts/gen-icons.ts <master.png>")
  process.exit(1)
}

const iconsRoot = join(import.meta.dir, "../../desktop/icons")
const channels = ["dev", "beta", "prod"]

const masterImage = await Jimp.read(master)
const masterBuffer = await Bun.file(master).arrayBuffer()
const input = Buffer.from(masterBuffer)

async function* walk(dir: string): AsyncGenerator<string> {
  for (const entry of await readdir(dir)) {
    const full = join(dir, entry)
    const info = await stat(full)
    if (info.isDirectory()) yield* walk(full)
    else yield full
  }
}

let pngCount = 0
for (const channel of channels) {
  const dir = join(iconsRoot, channel)
  if (!(await stat(dir).catch(() => undefined))) continue

  for await (const file of walk(dir)) {
    if (file.endsWith(".png")) {
      const existing = await Jimp.read(file)
      const resized = masterImage.clone().resize({ w: existing.width, h: existing.height })
      await resized.write(file as `${string}.png`)
      pngCount++
      continue
    }
    if (file.endsWith("icon.ico")) {
      const ico = png2icons.createICO(input, png2icons.BICUBIC, 0, true)
      if (ico) await Bun.write(file, ico)
      console.log(`ICO: ${file}`)
      continue
    }
    if (file.endsWith("icon.icns")) {
      const icns = png2icons.createICNS(input, png2icons.BICUBIC, 0)
      if (icns) await Bun.write(file, icns)
      console.log(`ICNS: ${file}`)
    }
  }
}

console.log(`完成：${pngCount} 个 PNG + ico/icns 已按渠道覆盖`)
