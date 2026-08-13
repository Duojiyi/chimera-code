import { expect, test } from "bun:test"
import path from "path"
import { bundledSkillsDir } from "./skills"

test("ships xlsx docx pptx pdf skills that match native tools", async () => {
  const dir = await bundledSkillsDir()
  for (const name of ["xlsx", "docx", "pptx", "pdf"]) {
    const skill = await Bun.file(path.join(dir, name, "SKILL.md")).text()
    expect(skill).toContain(`name: ${name}`)
    expect(skill).toContain("office_inspect")
    expect(skill).not.toContain('"format":')
  }
  const pdf = await Bun.file(path.join(dir, "pdf", "SKILL.md")).text()
  expect(pdf).toContain("office_read")
  expect(pdf).toContain("scanned")
  const pptx = await Bun.file(path.join(dir, "pptx", "SKILL.md")).text()
  expect(pptx).toContain("ppt-master")
})
