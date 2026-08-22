import type { NormalizedProviderListResponse } from "@opencode-ai/session-ui/context"
import type { Provider } from "@opencode-ai/sdk/v2"

type DirectoryCatalog = {
  ready: boolean
  providers: NormalizedProviderListResponse
}

type ProviderCatalogInput = {
  directory?: string
  catalog?: DirectoryCatalog
  global: NormalizedProviderListResponse
}

/**
 * Combine the process-wide catalog with a directory catalog without making
 * either source exclusive. A project can add provider configuration while
 * still inheriting globally configured providers (and vice versa).
 *
 * Directory data is the more specific source: its provider metadata/models,
 * defaults, and connection state win/extend global data for the same provider.
 */
export function mergeProviderCatalog(
  globalCatalog: NormalizedProviderListResponse,
  directoryCatalog?: NormalizedProviderListResponse,
): NormalizedProviderListResponse {
  if (!directoryCatalog) return globalCatalog

  const all = new Map<string, Provider>(globalCatalog.all)
  for (const [id, directoryProvider] of directoryCatalog.all) {
    const globalProvider = all.get(id)
    if (!globalProvider) {
      all.set(id, directoryProvider)
      continue
    }

    all.set(id, {
      ...globalProvider,
      ...directoryProvider,
      // Merge model maps so a project-specific model augments, rather than
      // accidentally erases, a globally configured model.
      models: { ...globalProvider.models, ...directoryProvider.models },
    })
  }

  const connected = [...new Set([...globalCatalog.connected, ...directoryCatalog.connected])]
  const defaultModels = { ...globalCatalog.default, ...directoryCatalog.default }
  const defaultModel = directoryCatalog.defaultModel !== undefined ? directoryCatalog.defaultModel : globalCatalog.defaultModel

  return {
    all,
    connected,
    default: defaultModels,
    ...(defaultModel !== undefined ? { defaultModel } : {}),
  }
}

export function selectProviderCatalog(input: ProviderCatalogInput) {
  // A directory catalog is an overlay, not a replacement. While it is still
  // loading, keep the global catalog visible to avoid a transient empty list.
  if (input.directory && input.catalog?.ready) return mergeProviderCatalog(input.global, input.catalog.providers)
  return input.global
}

export function resolveDefaultModel(
  current: NormalizedProviderListResponse["defaultModel"],
  legacy: string | undefined,
) {
  if (current !== undefined) return current ?? undefined
  if (!legacy) return undefined
  const [providerID, modelID] = legacy.split("/")
  return { providerID, modelID }
}
