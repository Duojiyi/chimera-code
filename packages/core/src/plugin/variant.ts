export * as VariantPlugin from "./variant"

import type { ModelV2Info } from "@opencode-ai/sdk/v2/types"
import { Effect } from "effect"
import { ModelsDev } from "../models-dev"
import { define } from "./internal"

export const Plugin = define({
  id: "variant",
  effect: Effect.fn(function* (ctx) {
    const modelsDev = yield* ModelsDev.Service
    const data = yield* modelsDev.get()
    yield* ctx.catalog.transform((catalog) => {
      for (const record of catalog.provider.list()) {
        for (const model of record.models.values()) {
          catalog.model.update(model.providerID, model.id, (draft) => {
            const generated = generate(draft, data)
            if (generated.length === 0) return

            const explicit = new Map(draft.variants.map((variant) => [variant.id, variant]))
            const generatedIDs = new Set(generated.map((variant) => variant.id))
            draft.variants = [
              ...generated.map((variant) => explicit.get(variant.id) ?? variant),
              ...draft.variants.filter((variant) => !generatedIDs.has(variant.id)),
            ]
          })
        }
      }
    })
  }),
})

export function generate(model: ModelV2Info, data: Record<string, ModelsDev.Provider> = {}): ModelV2Info["variants"] {
  if (model.api.type !== "aisdk" || model.api.package !== "@ai-sdk/openai-compatible") return []

  const reference = ModelsDev.findModel(data, [model.api.id, model.id])
  const effort = reference?.reasoning
    ? reference.reasoning_options?.find((option) => option.type === "effort")
    : undefined
  if (effort) {
    return effort.values.flatMap((value) => {
      const id = value === null ? "none" : value
      if (typeof id !== "string") return []
      return [
        {
          id,
          headers: {},
          body: { reasoning_effort: id },
        },
      ]
    })
  }

  const ids = `${model.id} ${model.api.id}`.toLowerCase()
  if (!["glm-5.2", "glm-5-2", "glm-5p2"].some((name) => ids.includes(name))) return []
  return ["high", "max"].map((id) => ({
    id,
    headers: {},
    body: { reasoning_effort: id },
  }))
}
