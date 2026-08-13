import { afterAll, expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import os from "os"
import path from "path"
import { isPptMaster, pptMasterSkillDir, resolveSkillRoot } from "./ppt-master"
import { extraSkillDirs } from "./skills"

const tmp = await mkdtemp(path.join(os.tmpdir(), "chimera-ppt-master-"))
afterAll(() => rm(tmp, { recursive: true, force: true }))

test("isPptMaster requires official skill identity", async () => {
  const dir = path.join(tmp, "fake")
  await Bun.write(
    path.join(dir, "SKILL.md"),
    ["---", "name: ppt-master", "metadata:", '  official_repository: "https://github.com/hugohe3/ppt-master"', "---", ""].join(
      "\n",
    ),
  )
  expect(await isPptMaster(dir)).toBe(true)
  expect(await isPptMaster(tmp)).toBe(false)
})

test("pptMasterSkillDir honors CHIMERA_PPT_MASTER_DIR", async () => {
  const dir = path.join(tmp, "env-skill")
  await Bun.write(
    path.join(dir, "SKILL.md"),
    ["---", "name: ppt-master", "metadata:", '  official_repository: "https://github.com/hugohe3/ppt-master"', "---", ""].join(
      "\n",
    ),
  )
  const previous = process.env.CHIMERA_PPT_MASTER_DIR
  process.env.CHIMERA_PPT_MASTER_DIR = dir
  try {
    expect(await pptMasterSkillDir()).toBe(dir)
    expect(await extraSkillDirs()).toContain(dir)
  } finally {
    if (previous === undefined) delete process.env.CHIMERA_PPT_MASTER_DIR
    else process.env.CHIMERA_PPT_MASTER_DIR = previous
  }
})

test("resolveSkillRoot finds a nested official skill", async () => {
  const root = path.join(tmp, "repo")
  const nested = path.join(root, "skills", "ppt-master")
  await Bun.write(
    path.join(nested, "SKILL.md"),
    ["---", "name: ppt-master", "metadata:", '  official_repository: "https://github.com/hugohe3/ppt-master"', "---", ""].join(
      "\n",
    ),
  )
  expect(await resolveSkillRoot(root)).toBe(nested)
})

test("discovers a real ppt-master tree when one is installed", async () => {
  const previous = process.env.CHIMERA_PPT_MASTER_DIR
  delete process.env.CHIMERA_PPT_MASTER_DIR
  try {
    const ppt = await pptMasterSkillDir()
    if (!ppt) return
    const skill = await Bun.file(path.join(ppt, "SKILL.md")).text()
    expect(skill).toContain("name: ppt-master")
    expect(await Bun.file(path.join(ppt, "LICENSE")).exists()).toBe(true)
    expect(await Bun.file(path.join(ppt, "scripts/attribution_guard.py")).exists()).toBe(true)
  } finally {
    if (previous !== undefined) process.env.CHIMERA_PPT_MASTER_DIR = previous
  }
})
