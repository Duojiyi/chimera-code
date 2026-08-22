import { expect, test } from "bun:test"
import type { Config } from "@opencode-ai/plugin"
import { ChimeraPlugin, findOfficialModel, gatewayVariants, PROVIDER_ID } from "./index"

async function apply(config: Config) {
  const hooks = await ChimeraPlugin(undefined as never)
  await hooks.config?.(config)
  return config
}

test("config hook injects Chimera defaults without duplicating skill paths", async () => {
  const config = await apply({
    provider: {
      custom: {
        name: "Custom",
        npm: "@ai-sdk/openai-compatible",
        options: {},
        models: {},
      },
    },
  })

  expect(config.provider?.[PROVIDER_ID]).toBeDefined()
  expect(config.enabled_providers).toEqual(["custom", PROVIDER_ID])
  expect(config.skills?.paths?.length).toBeGreaterThan(0)
  expect(new Set(config.skills?.paths ?? []).size).toBe(config.skills?.paths?.length ?? 0)
  expect(config.permission).toMatchObject({
    edit: "allow",
    bash: "allow",
    webfetch: "allow",
    external_directory: "allow",
    skill: "allow",
    doom_loop: "ask",
  })

  await apply(config)
  expect(new Set(config.skills?.paths ?? []).size).toBe(config.skills?.paths?.length ?? 0)
})

test("config hook fills individual permission defaults while preserving user rules", async () => {
  const config = await apply({ permission: { edit: "deny", doom_loop: "deny" } })

  expect(config.permission).toMatchObject({
    edit: "deny",
    bash: "allow",
    webfetch: "allow",
    external_directory: "allow",
    skill: "allow",
    doom_loop: "deny",
  })
})

test("config hook preserves a top-level permission policy", async () => {
  const config = await apply({ permission: "deny" })
  expect(config.permission).toBe("deny")
})

test("config hook preserves explicitly enabled providers", async () => {
  const config = await apply({ enabled_providers: ["custom"] })
  expect(config.enabled_providers).toEqual(["custom"])
})


test("gateway variants preserve provider-defined effort levels", () => {
  expect(gatewayVariants({ reasoning: true, reasoning_options: [{ type: "effort", values: ["low", "medium", "high"] }] })).toEqual({
    low: { reasoningEffort: "low" },
    medium: { reasoningEffort: "medium" },
    high: { reasoningEffort: "high" },
  })
})

test("gateway variants support toggle and budget metadata", () => {
  expect(gatewayVariants({ reasoning_options: [{ type: "toggle" }] })).toEqual({
    none: { reasoningEffort: "none" },
    high: { reasoningEffort: "high" },
  })
  expect(gatewayVariants({ reasoning_options: [{ type: "budget_tokens", min: 512, max: 4096 }] })).toHaveProperty("high")
})

test("official model lookup matches qualified gateway IDs", () => {
  const model = { id: "claude-sonnet-4-6", reasoning: true }
  const catalog = new Map([["anthropic/claude-sonnet-4-6", model]])
  expect(findOfficialModel(catalog, "proxy/claude-sonnet-4-6")).toBe(model)
})
