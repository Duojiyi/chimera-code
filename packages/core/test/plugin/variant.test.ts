import { describe, expect } from "bun:test"
import { Catalog } from "@opencode-ai/core/catalog"
import { AppNodeBuilder } from "@opencode-ai/core/effect/app-node-builder"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { Location } from "@opencode-ai/core/location"
import { ModelV2 } from "@opencode-ai/core/model"
import { ModelsDev } from "@opencode-ai/core/models-dev"
import { VariantPlugin } from "@opencode-ai/core/plugin/variant"
import { ProviderV2 } from "@opencode-ai/core/provider"
import { AbsolutePath } from "@opencode-ai/core/schema"
import { Effect, Layer } from "effect"
import { location } from "../fixture/location"
import { testEffect } from "../lib/effect"
import { catalogHost, host } from "./host"

const locationLayer = Layer.succeed(
  Location.Service,
  Location.Service.of(location({ directory: AbsolutePath.make(import.meta.dir) })),
)
const it = testEffect(AppNodeBuilder.build(Catalog.node, [[Location.node, locationLayer]]))

const apply = (catalog: Catalog.Interface, data: Record<string, ModelsDev.Provider> = {}) =>
  VariantPlugin.Plugin.effect(host({ catalog: catalogHost(catalog) })).pipe(
    Effect.provideService(
      ModelsDev.Service,
      ModelsDev.Service.of({
        get: () => Effect.succeed(data),
        refresh: () => Effect.void,
      }),
    ),
  )

describe("VariantPlugin", () => {
  it.effect("adds GLM 5.2 variants after catalog sources", () =>
    Effect.gen(function* () {
      const service = yield* Catalog.Service
      yield* service.transform((catalog) => {
        catalog.provider.update(ProviderV2.ID.opencode, (provider) => {
          provider.api = { type: "aisdk", package: "@ai-sdk/openai-compatible" }
        })
        catalog.model.update(ProviderV2.ID.opencode, ModelV2.ID.make("glm-5.2"), (model) => {
          model.api = {
            id: ModelV2.ID.make("glm-5.2"),
            type: "aisdk",
            package: "@ai-sdk/openai-compatible",
          }
        })
      })
      yield* apply(service)

      expect((yield* service.model.get(ProviderV2.ID.opencode, ModelV2.ID.make("glm-5.2")))?.variants).toEqual([
        expect.objectContaining({ id: "high", body: { reasoning_effort: "high" } }),
        expect.objectContaining({ id: "max", body: { reasoning_effort: "max" } }),
      ])
    }),
  )

  it.effect("adds OpenAI-compatible effort variants from models.dev metadata", () =>
    Effect.gen(function* () {
      const service = yield* Catalog.Service
      const providerID = ProviderV2.ID.make("custom-provider")
      yield* service.transform((catalog) => {
        catalog.provider.update(providerID, (provider) => {
          provider.api = { type: "aisdk", package: "@ai-sdk/openai-compatible" }
        })
        catalog.model.update(providerID, ModelV2.ID.make("gpt-5.4"), (model) => {
          model.api = {
            id: ModelV2.ID.make("gpt-5.4"),
            type: "aisdk",
            package: "@ai-sdk/openai-compatible",
          }
        })
      })
      yield* apply(service, {
        openai: {
          id: "openai",
          name: "OpenAI",
          env: [],
          models: {
            "gpt-5.4": {
              id: "gpt-5.4",
              name: "GPT-5.4",
              release_date: "2026-01-01",
              attachment: false,
              reasoning: true,
              temperature: true,
              tool_call: true,
              reasoning_options: [{ type: "effort", values: [null, "low", "medium", "high", "xhigh"] }],
              limit: { context: 1_050_000, output: 128_000 },
            },
          },
        },
      })

      expect((yield* service.model.get(providerID, ModelV2.ID.make("gpt-5.4")))?.variants).toEqual([
        expect.objectContaining({ id: "none", body: { reasoning_effort: "none" } }),
        expect.objectContaining({ id: "low", body: { reasoning_effort: "low" } }),
        expect.objectContaining({ id: "medium", body: { reasoning_effort: "medium" } }),
        expect.objectContaining({ id: "high", body: { reasoning_effort: "high" } }),
        expect.objectContaining({ id: "xhigh", body: { reasoning_effort: "xhigh" } }),
      ])
    }),
  )

  it.effect("keeps explicit variants over generated defaults", () =>
    Effect.gen(function* () {
      const service = yield* Catalog.Service
      yield* service.transform((catalog) => {
        catalog.model.update(ProviderV2.ID.opencode, ModelV2.ID.make("glm-5.2"), (model) => {
          model.api = {
            id: ModelV2.ID.make("glm-5.2"),
            type: "aisdk",
            package: "@ai-sdk/openai-compatible",
          }
          model.variants = [{ id: ModelV2.VariantID.make("high"), headers: { custom: "true" }, body: {} }]
        })
      })
      yield* apply(service)

      expect((yield* service.model.get(ProviderV2.ID.opencode, ModelV2.ID.make("glm-5.2")))?.variants).toEqual([
        expect.objectContaining({ id: "high", headers: { custom: "true" } }),
        expect.objectContaining({ id: "max", body: { reasoning_effort: "max" } }),
      ])
    }),
  )
})
