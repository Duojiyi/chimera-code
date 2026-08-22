import { expect, test } from "bun:test"
import type { NormalizedProviderListResponse } from "@opencode-ai/session-ui/context"
import type { Provider } from "@opencode-ai/sdk/v2"
import { mergeProviderCatalog, resolveDefaultModel, selectProviderCatalog } from "./provider-catalog"

const catalog = (id: string, model = `${id}-model`): NormalizedProviderListResponse => {
  const provider = {
    id,
    name: id,
    source: "api",
    env: [],
    options: {},
    models: { [model]: { id: model } },
  } as unknown as Provider
  return {
    all: new Map<string, Provider>([[id, provider]]),
    connected: [id],
    default: { [id]: model },
  }
}

test("merges global and directory providers instead of replacing either source", () => {
  const result = mergeProviderCatalog(catalog("global"), catalog("directory"))

  expect([...result.all.keys()]).toEqual(["global", "directory"])
  expect(result.connected).toEqual(["global", "directory"])
  expect(result.default).toEqual({ global: "global-model", directory: "directory-model" })
})

test("directory metadata and models override global metadata without erasing global models", () => {
  const global = catalog("shared", "global-model")
  const directory = catalog("shared", "directory-model")
  directory.all.get("shared")!.name = "Project provider"
  directory.all.get("shared")!.models.extra = { id: "extra" } as never

  const result = mergeProviderCatalog(global, directory)
  const provider = result.all.get("shared")!

  expect(provider.name).toBe("Project provider")
  expect(Object.keys(provider.models)).toEqual(["global-model", "directory-model", "extra"])
  expect(result.default.shared).toBe("directory-model")
})

test("directory default model takes precedence when provided", () => {
  const global = { ...catalog("global"), defaultModel: { providerID: "global", modelID: "global-model" } }
  const directory = { ...catalog("directory"), defaultModel: { providerID: "directory", modelID: "directory-model" } }

  expect(mergeProviderCatalog(global, directory).defaultModel).toEqual({
    providerID: "directory",
    modelID: "directory-model",
  })
})

test("uses the ready catalog as a global overlay for a directory", () => {
  const global = catalog("global")
  const directory = catalog("directory")
  const result = selectProviderCatalog({
    directory: "/repo",
    catalog: { ready: true, providers: directory },
    global,
  })

  expect([...result.all.keys()]).toEqual(["global", "directory"])
})

test("falls back to global while a directory catalog is unresolved", () => {
  const global = catalog("global")
  expect(selectProviderCatalog({ global })).toBe(global)
  expect(
    selectProviderCatalog({
        directory: "/repo",
      catalog: { ready: false, providers: catalog("directory") },
      global,
    }),
  ).toBe(global)
})

test("uses the current server default model", () => {
  expect(resolveDefaultModel({ providerID: "openai", modelID: "gpt-5" }, "anthropic/claude")).toEqual({
    providerID: "openai",
    modelID: "gpt-5",
  })
})

test("does not use legacy config when the current server has no default", () => {
  expect(resolveDefaultModel(null, "anthropic/claude")).toBeUndefined()
})

test("uses config for legacy servers", () => {
  expect(resolveDefaultModel(undefined, "anthropic/claude")).toEqual({
    providerID: "anthropic",
    modelID: "claude",
  })
})
