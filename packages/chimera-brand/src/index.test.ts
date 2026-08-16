import { expect, test } from "bun:test"
import packageJson from "../package.json" with { type: "json" }
import { BRAND, BRAND_SCHEMES, brandScheme, brandUserCopy, brandUserDict } from "./index"

test("uses the package version as the brand fallback version", () => {
  expect(BRAND.version).toBe(packageJson.version)
})

test("brands user-facing product names and config filenames", () => {
  expect(brandUserCopy("OpenCode reads opencode.jsonc")).toBe("Chimera reads chimera.jsonc")
  expect(brandUserDict({ title: "OpenCode Desktop" })).toEqual({ title: "Chimera" })
})

test("preserves technical compatibility identifiers", () => {
  expect(brandUserCopy("Use the 'opencode' command")).toBe("Use the 'opencode' command")
  expect(brandUserCopy("Schema: https://opencode.ai/config.json")).toBe("Schema: https://opencode.ai/config.json")
})

test("isolates desktop protocol schemes by release channel", () => {
  expect(brandScheme("prod")).toBe("chimera")
  expect(brandScheme("beta")).toBe("chimera-beta")
  expect(brandScheme("dev")).toBe("chimera-dev")
  expect(BRAND_SCHEMES).toEqual(["chimera", "chimera-beta", "chimera-dev"])
})
