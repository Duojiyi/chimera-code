import { cp, mkdir, rm } from "node:fs/promises"
import os from "os"
import path from "path"
import pin from "../ppt-master.pin.json" with { type: "json" }

export const PPT_MASTER_TAG = pin.tag
export const PPT_MASTER_REPO = pin.repository
const SKILL_ZIP = `ppt-master-skill-${PPT_MASTER_TAG}.zip`

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
  try {
    await cp(source, dest, { recursive: true, filter: keepPptMasterPath })
  } finally {
    await rmStaging(source)
  }
  if (!(await isPptMaster(dest))) throw new Error(`copied ppt-master is missing SKILL.md at ${dest}`)
  console.log(`ppt-master vendored from ${source} -> ${dest}`)
  return dest
}

export async function resolveSkillRoot(root: string) {
  if (await isPptMaster(root)) return root
  const nested = [path.join(root, "ppt-master"), path.join(root, "skills", "ppt-master")]
  for (const dir of nested) {
    if (await isPptMaster(dir)) return dir
  }
  const glob = new Bun.Glob("**/SKILL.md")
  for await (const file of glob.scan({ cwd: root, onlyFiles: true })) {
    const dir = path.join(root, path.dirname(file))
    if (await isPptMaster(dir)) return dir
  }
}

async function findVendorSource(dest: string) {
  for (const dir of pptMasterCandidates()) {
    if (path.resolve(dir) === path.resolve(dest)) continue
    if (await isPptMaster(dir)) return dir
  }
  return downloadSkillZip(dest)
}

async function downloadSkillZip(dest: string) {
  const url = `${PPT_MASTER_REPO}/releases/download/${PPT_MASTER_TAG}/${SKILL_ZIP}`
  const staging = path.join(path.dirname(dest), `ppt-master.src-${process.pid}`)
  const zipPath = `${staging}.zip`
  console.log(`downloading ${url}`)
  if (!(await curlDownload(url, zipPath))) return
  const size = Bun.file(zipPath).size
  console.log(`downloaded ${SKILL_ZIP} (${size} bytes)`)
  if (size < 1_000_000) {
    console.error(`download too small: ${size} bytes`)
    await rm(zipPath, { force: true })
    return
  }
  await mkdir(staging, { recursive: true })
  const extract = Bun.spawnSync(["tar", "-xf", zipPath, "-C", staging], {
    stdout: "inherit",
    stderr: "inherit",
  })
  await rm(zipPath, { force: true })
  if (extract.exitCode !== 0) {
    await rm(staging, { recursive: true, force: true })
    return
  }
  const root = await resolveSkillRoot(staging)
  if (root) return root
  await rm(staging, { recursive: true, force: true })
}

async function curlDownload(url: string, zipPath: string) {
  const curl = process.platform === "win32" ? "curl.exe" : "curl"
  const proc = Bun.spawn(
    [
      curl,
      "-fL",
      "--retry",
      "5",
      "--retry-delay",
      "2",
      "--connect-timeout",
      "20",
      "--max-time",
      "180",
      "-#",
      "-o",
      zipPath,
      url,
    ],
    { stdout: "inherit", stderr: "inherit" },
  )
  const code = await proc.exited
  return code === 0 && (await Bun.file(zipPath).exists())
}

async function rmStaging(source: string) {
  const names = [path.basename(source), path.basename(path.dirname(source))]
  if (!names.some((name) => name.startsWith("ppt-master.src-"))) return
  const root = path.basename(source).startsWith("ppt-master.src-") ? source : path.dirname(source)
  await rm(root, { recursive: true, force: true })
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
