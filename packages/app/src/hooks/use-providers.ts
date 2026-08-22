import { BRAND } from "@chimera/brand"
import { useServerSync } from "@/context/server-sync"
import { decode64 } from "@/utils/base64"
import { useParams } from "@solidjs/router"
import { Iterable, pipe } from "effect"
import { type Accessor } from "solid-js"
import { selectProviderCatalog } from "./provider-catalog"

export const popularProviders = [
  // Chimera 中转站是品牌核心提供商，断开后仍应置顶展示（设计稿 S5 入口）
  BRAND.nameLower,
  "anthropic",
  "github-copilot",
  "openai",
  "google",
  "openrouter",
  "vercel",
]

export function isUpstreamZenProvider(id: string) {
  return id === "opencode" || id === "opencode-go"
}
const popularProviderSet = new Set(popularProviders)

export function useProviders(directory: Accessor<string | undefined>) {
  const serverSync = useServerSync()
  const params = useParams()
  const dir = () => (directory ? directory() : decode64(params.dir))
  const providers = () => {
    const value = dir()
    const projectStore = value ? serverSync().child(value)[0] : undefined
    const catalog = selectProviderCatalog({
      directory: value,
      catalog: projectStore && { ready: projectStore.provider_ready, providers: projectStore.provider },
      global: serverSync().data.provider,
    })
    const all = new Map([...catalog.all].filter(([id]) => !isUpstreamZenProvider(id)))
    return {
      ...catalog,
      all,
      // `connected` is a server-derived capability. Do not use locally saved
      // credentials as a proxy: a stale key must not hide/show providers or
      // models until the server has rebuilt its authenticated snapshot.
      connected: catalog.connected.filter((id) => !isUpstreamZenProvider(id)),
    }
  }

  return {
    all: () => providers().all,
    default: () => providers().default,
    defaultModel: () => providers().defaultModel,
    popular: () =>
      pipe(
        providers().all,
        Iterable.map(([, p]) => p),
        Iterable.filter((p) => popularProviderSet.has(p.id)),
        (v) => Array.from(v),
      ),
    connected: () => {
      const connected = new Set(providers().connected)
      return pipe(
        providers().all,
        Iterable.map(([, p]) => p),
        Iterable.filter((p) => connected.has(p.id)),
        (v) => Array.from(v),
      )
    },
    paid: () => {
      const connected = new Set(providers().connected)
      return [...Iterable.filter(providers().all, ([id]) => connected.has(id))]
    },
  }
}
