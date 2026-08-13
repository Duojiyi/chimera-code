import { mkdir } from "node:fs/promises"
import os from "os"
import path from "path"
import { pptMasterSkillDir } from "./ppt-master"
import xlsx from "../skills/xlsx/SKILL.md" with { type: "text" }
import docx from "../skills/docx/SKILL.md" with { type: "text" }
import pptx from "../skills/pptx/SKILL.md" with { type: "text" }
import pdf from "../skills/pdf/SKILL.md" with { type: "text" }

const files = {
  xlsx,
  docx,
  pptx,
  pdf,
}

export async function bundledSkillsDir() {
  const packed = path.join(import.meta.dir, "../skills")
  if (await Bun.file(path.join(packed, "xlsx", "SKILL.md")).exists()) return packed

  const dest = path.join(configHome(), "chimera", "bundled-skills")
  await mkdir(dest, { recursive: true })
  for (const [name, content] of Object.entries(files)) {
    const dir = path.join(dest, name)
    await mkdir(dir, { recursive: true })
    await Bun.write(path.join(dir, "SKILL.md"), content)
  }
  return dest
}

export async function extraSkillDirs() {
  const bundled = await bundledSkillsDir()
  const ppt = await pptMasterSkillDir()
  if (!ppt) return []
  const relative = path.relative(bundled, ppt)
  if (relative && !relative.startsWith("..") && !path.isAbsolute(relative)) return []
  return [ppt]
}

function configHome() {
  if (process.env.XDG_CONFIG_HOME) return process.env.XDG_CONFIG_HOME
  if (process.env.APPDATA) return process.env.APPDATA
  return path.join(os.homedir(), ".config")
}
