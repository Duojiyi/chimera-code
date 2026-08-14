import { expect, test } from "bun:test"
import { BRAND } from "@chimera/brand"
import { applyChimeraSystem, chimeraEngineeringRules, chimeraIdentity, rewriteUpstreamSystem } from "./prompt"

test("rewrites OpenCode identity, issues, and docs onto Chimera", () => {
  const text = [
    "You are opencode, an interactive CLI tool that helps users.",
    "You are OpenCode, the best coding agent on the planet.",
    "Your name is opencode",
    "- /help: Get help with using opencode",
    "https://github.com/anomalyco/opencode/issues",
    "https://github.com/anomalyco/opencode",
    "When the user directly asks about OpenCode, fetch OpenCode docs at https://opencode.ai/docs",
  ].join("\n")

  const out = rewriteUpstreamSystem(text)
  expect(out).toContain(`You are ${BRAND.name},`)
  expect(out).toContain(`Your name is ${BRAND.name}`)
  expect(out).toContain(`Get help with using ${BRAND.name}`)
  expect(out).toContain(BRAND.issues)
  expect(out).toContain(`https://github.com/${BRAND.github.owner}/${BRAND.github.repo}`)
  expect(out).toContain(BRAND.homepage)
  expect(out).not.toContain("anomalyco")
  expect(out).not.toContain("opencode.ai")
  expect(out).not.toMatch(/You are opencode/i)
  expect(out).toContain("a desktop coding agent")
})

test("neutralizes CLI four-line verbosity", () => {
  const out = rewriteUpstreamSystem(
    "IMPORTANT: Keep your responses short, since they will be displayed on a command line interface. You MUST answer concisely with fewer than 4 lines (not including tool use or code generation), unless user asks for detail.",
  )
  expect(out).toContain("desktop chat")
  expect(out).not.toContain("fewer than 4 lines")
})

test("appends identity and engineering rules once", () => {
  const first = applyChimeraSystem(["You are opencode, an interactive CLI tool."])
  expect(first.some((part) => part.includes(`You are ${BRAND.name},`))).toBe(true)
  expect(first).toContain(chimeraIdentity)
  expect(first).toContain(chimeraEngineeringRules)
  expect(first.join("\n")).toContain("【界面】")
  expect(first.join("\n")).toContain("office_inspect")

  const second = applyChimeraSystem(first)
  expect(second.filter((part) => part.includes("工程守则："))).toHaveLength(1)
})
