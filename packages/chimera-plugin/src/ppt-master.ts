import { cp, mkdir, rm } from "node:fs/promises"
import os from "os"
import path from "path"
import pin from "../ppt-master.pin.json" with { type: "json" }

export const PPT_MASTER_TAG = pin.tag
export const PPT_MASTER_REPO = pin.repository

const SKIP_DIR = new Set([".git", "__pycache__", "ai-image-comparison"])

export async function isPptMaster(dir: string) {
  const skill = Bun.file(path.join(dir, "SKILL.md"))
  if (!(await skill.exists())) return false
  const text = await skill.text()
  return text.includes("name: ppt-master") && text.includes("official_repository")
}

export function pptMasterCandidates() {
  const home = os.homedir()
  const env = process.env.CHIMERA_PPT_MASTER_DIR
  return [
    env,
    path.join(import.meta.dir, "../skills/ppt-master"),
    path.join(configHome(), "chimera", "bundled-skills", "ppt-master"),
    path.join(home, ".codex", "skills", "ppt-master"),
    path.join(home, ".agents", "skills", "ppt-master"),
  ].filter((dir): dir is string => Boolean(dir))
}

export async function pptMasterSkillDir() {
  for (const dir of pptMasterCandidates()) {
    if (await isPptMaster(dir)) return dir
  }
}

export async function vendorPptMaster(dest: string, opts?: { force?: boolean }) {
  if (!opts?.force && (await isPptMaster(dest))) {
    console.log(`ppt-master already vendored at ${dest}`)
    return dest
  }

  const source = await findVendorSource(dest)
  if (!source) {
    throw new Error(
      `ppt-master ${PPT_MASTER_TAG} not found. Clone ${PPT_MASTER_REPO} or install the skill locally, then retry.`,
    )
  }

  await mkdir(path.dirname(dest), { recursive: true })
  if (path.resolve(source) === path.resolve(dest)) return dest
  const cloned = path.basename(source).startsWith("ppt-master.src-")
  try {
    await cp(source, dest, { recursive: true, filter: keepPptMasterPath })
  } finally {
    if (cloned) await rm(source, { recursive: true, force: true })
  }
  if (!(await isPptMaster(dest))) throw new Error(`copied ppt-master is missing SKILL.md at ${dest}`)
  console.log(`ppt-master vendored from ${source} -> ${dest}`)
  return dest
}

async function findVendorSource(dest: string) {
  for (const dir of pptMasterCandidates()) {
    if (path.resolve(dir) === path.resolve(dest)) continue
    if (await isPptMaster(dir)) return dir
  }
  return cloneRelease(dest)
}

async function cloneRelease(dest: string) {
  const staging = path.join(path.dirname(dest), `ppt-master.src-${process.pid}`)
  const clone = Bun.spawnSync(
    ["git", "clone", "--depth", "1", "--branch", PPT_MASTER_TAG, `${PPT_MASTER_REPO}.git`, staging],
    { stdout: "inherit", stderr: "inherit" },
  )
  if (clone.exitCode !== 0) {
    await rm(staging, { recursive: true, force: true })
    return
  }
  if (await isPptMaster(staging)) return staging
  await rm(staging, { recursive: true, force: true })
}

function keepPptMasterPath(source: string) {
  const parts = source.replaceAll("\\", "/").split("/")
  return !parts.some((part) => SKIP_DIR.has(part))
}

function configHome() {
  if (process.env.XDG_CONFIG_HOME) return process.env.XDG_CONFIG_HOME
  if (process.env.APPDATA) return process.env.APPDATA
  return path.join(os.homedir(), ".config")
}
