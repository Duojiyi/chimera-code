import type { Hooks, PluginInput } from "@opencode-ai/plugin"
import { BRAND } from "@chimera/brand"
import { officeTools } from "./office"
import { applyChimeraSystem } from "./prompt"
import { bundledSkillsDir, extraSkillDirs } from "./skills"

/** Chimera 网关 provider 的固定 ID，同时用于 auth 存储与 UI 展示。 */
export const PROVIDER_ID = BRAND.nameLower

const gateway = (path: string) => new URL(path, BRAND.gatewayUrl).toString()

type GatewayModels = Awaited<ReturnType<NonNullable<NonNullable<Hooks["provider"]>["models"]>>>

/** 由模型 ID 生成展示名："claude-opus-5" → "Claude Opus 5"。 */
function displayName(id: string) {
  return id
    .split("-")
    .map((part) => (/^\d/.test(part) ? part : part.charAt(0).toUpperCase() + part.slice(1)))
    .join(" ")
}

/** 官方模型目录（models.opencode.ai 镜像的 models.dev 数据）中的模型元数据（仅取本插件需要的字段）。 */
export type OfficialModel = {
  id?: string
  name?: string
  limit?: { context?: number; output?: number }
  cost?: { input?: number; output?: number; cache_read?: number; cache_write?: number }
  tool_call?: boolean
  reasoning?: boolean
  attachment?: boolean
  temperature?: boolean
  modalities?: { input?: string[]; output?: string[] }
  release_date?: string
  /** 思考强度选项（effort/budget/toggle），驱动上游生成模型 variants 与前端强度选择 */
  reasoning_options?: Array<Record<string, unknown>>
}

let officialCatalog: Map<string, OfficialModel> | undefined
let officialCatalogAt = 0

/**
 * 拉取官方模型目录（models.opencode.ai 镜像）并按模型 ID 展平索引（跨厂商）。
 * 网关模型 ID 与官方 ID 一致（如 claude-sonnet-4-6），据此自动识别
 * 上下文窗口等官方数据；目录缓存 10 分钟，失败时退回保守默认值。
 */
async function officialModels(): Promise<Map<string, OfficialModel>> {
  const now = Date.now()
  if (officialCatalog && now - officialCatalogAt < 10 * 60_000) return officialCatalog
  try {
    // 与 core ModelsDev 同一镜像：models.dev 在部分网络（如国内直连）不可达，opencode.ai 镜像可直连。
    const res = await fetch("https://models.opencode.ai/api.json", { signal: AbortSignal.timeout(10_000) })
    if (!res.ok) return officialCatalog ?? new Map()
    const data = (await res.json()) as Record<string, { models?: Record<string, OfficialModel> }>
    const map = new Map<string, OfficialModel>()
    // 一方厂商目录优先：第三方聚合渠道对同名模型常有改动过的上下文/价格
    //（如 sonnet-4-5 在部分渠道标 1M，官方为 200k），仅用于补缺。
    const firstParty = ["anthropic", "openai", "google", "deepseek", "xai", "mistral"]
    const rank = (key: string) => {
      const index = firstParty.indexOf(key)
      return index === -1 ? firstParty.length : index
    }
    const providers = Object.entries(data).sort(([a], [b]) => rank(a) - rank(b))
    for (const [providerID, provider] of providers) {
      for (const [id, model] of Object.entries(provider.models ?? {})) {
        const value = { id, ...model }
        if (!map.has(id)) map.set(id, value)
        const qualified = providerID + "/" + id
        if (!map.has(qualified)) map.set(qualified, value)
      }
    }
    officialCatalog = map
    officialCatalogAt = now
    return map
  } catch {
    return officialCatalog ?? new Map()
  }
}

/** 网关模型元数据：官方目录（models.opencode.ai）自动识别，缺失字段用保守默认；
 *  用户可在 chimera.json 的 provider.chimera.models.<id> 手动覆盖。 */
function modelIDCandidates(id: string) {
  const value = id.trim()
  const result = new Set([value, value.toLowerCase()])
  const slash = value.indexOf("/")
  if (slash >= 0) {
    const modelID = value.slice(slash + 1)
    result.add(modelID)
    result.add(modelID.toLowerCase())
  }
  return result
}

/** Match gateway IDs against both exact and provider-qualified catalog IDs. */
export function findOfficialModel(catalog: Map<string, OfficialModel>, id: string) {
  for (const candidate of modelIDCandidates(id)) {
    const exact = catalog.get(candidate)
    if (exact) return exact
  }
  const candidates = modelIDCandidates(id)
  for (const [key, model] of catalog) {
    if (candidates.has(key.toLowerCase()) || (model.id && candidates.has(model.id.toLowerCase()))) return model
  }
  return undefined
}

function gatewayModel(id: string, official?: OfficialModel) {
  const modality = (values: string[] | undefined, key: string, fallback: boolean) =>
    values ? values.includes(key) : fallback
  return {
    id,
    providerID: PROVIDER_ID,
    name: official?.name ?? displayName(id),
    api: {
      id,
      npm: "@ai-sdk/openai-compatible",
      url: gateway("v1"),
    },
    status: "active",
    headers: {},
    options: {},
    cost: {
      input: official?.cost?.input ?? 0,
      output: official?.cost?.output ?? 0,
      cache: { read: official?.cost?.cache_read ?? 0, write: official?.cost?.cache_write ?? 0 },
    },
    limit: {
      context: official?.limit?.context ?? 200_000,
      output: official?.limit?.output ?? 8_192,
    },
    capabilities: {
      temperature: official?.temperature ?? true,
      // Prefer metadata returned by the gateway when the optional catalog is unavailable.
      reasoning: official?.reasoning ?? Boolean(official?.reasoning_options?.length),
      attachment: official?.attachment ?? false,
      toolcall: official?.tool_call ?? true,
      input: {
        text: true,
        audio: modality(official?.modalities?.input, "audio", false),
        image: modality(official?.modalities?.input, "image", true),
        video: modality(official?.modalities?.input, "video", false),
        pdf: modality(official?.modalities?.input, "pdf", false),
      },
      output: { text: true, audio: false, image: false, video: false, pdf: false },
      interleaved: false,
    },
    release_date: official?.release_date ?? "",
    // 思考强度变体：插件模型不经过上游 reasoningVariants 管道（provider.ts
    // 对 plugin models 原样入库），按网关元数据生成请求变体：
    // effort/toggle 使用 reasoning_effort，budget_tokens 使用 thinking.budget_tokens。
    variants: gatewayVariants(official),
  }
}

/**
 * Convert gateway capability metadata to OpenAI-compatible variants.
 * Effort/toggle options use reasoning_effort; token budgets use the gateway's
 * `thinking.budget_tokens` extension and remain provider-defined.
 */
export function gatewayVariants(official?: OfficialModel): Record<string, Record<string, unknown>> {
  const options = official?.reasoning_options ?? []
  const effort = options.find((option) => option.type === "effort")
  const values = effort?.values
  if (Array.isArray(values)) {
    return Object.fromEntries(
      values.flatMap((value) => {
        if (value === null) return [["none", { reasoningEffort: "none" }]]
        if (typeof value !== "string") return []
        return [[value, { reasoningEffort: value }]]
      }),
    )
  }
  const toggle = options.some((option) => option.type === "toggle")
  const budget = options.some((option) => option.type === "budget_tokens")
  if (budget) {
    const range = options.find((option) => option.type === "budget_tokens")
    const min = typeof range?.min === "number" && Number.isFinite(range.min) ? Math.max(1, Math.floor(range.min)) : 512
    const max = typeof range?.max === "number" && Number.isFinite(range.max) ? Math.max(min, Math.floor(range.max)) : min * 8
    const values = [...new Set([min, Math.round(Math.sqrt(min * max)), max])]
    return Object.fromEntries(
      values.map((tokens) => [
        `budget-${tokens}`,
        // `budget_tokens` is a token budget, not an effort enum. The
        // OpenAI-compatible SDK forwards unknown provider options verbatim,
        // so use the gateway's native extension instead of coercing a token
        // count into `reasoning_effort` (which would silently change the
        // request semantics on strict gateways).
        { thinking: { type: "enabled", budget_tokens: tokens } },
      ]),
    )
  }
  if (toggle) return { none: { reasoningEffort: "none" }, high: { reasoningEffort: "high" } }
  if (official?.reasoning) return { none: { reasoningEffort: "none" }, high: { reasoningEffort: "high" } }
  return {}
}

/**
 * Chimera 系统插件（随客户端内置，先于用户插件加载）。
 *
 * 职责：
 * 1. `config`  — 注入 Chimera 网关 provider（OpenAI 兼容协议，模型由网关统一下发）。
 * 2. `auth`    — 中转站账号密码登录（登录后同步该账号下全部密钥）或直接粘贴令牌。
 * 3. `chat.headers` — 为发往网关的请求附加客户端标识；多密钥切换时在此注入当前密钥。
 *
 * 多密钥管理（设计稿 S6）：密钥列表与"当前密钥"由后续的密钥存储模块维护，
 * 本骨架仅保留接入点。
 */
export async function ChimeraPlugin(_input: PluginInput): Promise<Hooks> {
  return {
    config: async (config) => {
      config.provider ??= {}
      config.provider[PROVIDER_ID] ??= {
        npm: "@ai-sdk/openai-compatible",
        name: BRAND.name,
        options: {
          baseURL: gateway("v1"),
        },
        models: {},
      }
      // 品牌定制：预置供应商只有中转站一个；用户在配置中自定义的 provider
      // 会一并放行（此时 config.provider 已含用户配置）。显式配置优先。
      config.enabled_providers ??= Object.keys(config.provider)

      const skillsDir = await bundledSkillsDir()
      config.skills ??= {}
      config.skills.paths ??= []
      if (!config.skills.paths.includes(skillsDir)) config.skills.paths.push(skillsDir)
      for (const dir of await extraSkillDirs()) {
        if (!config.skills.paths.includes(dir)) config.skills.paths.push(dir)
      }

      // 内置常用 MCP（用户同名配置优先）：预置但不默认连接，避免未登录就出现「1 MCP」。
      config.mcp ??= {}
      config.mcp["context7"] ??= { type: "remote", url: "https://mcp.context7.com/mcp", enabled: false }
      config.mcp["deepwiki"] ??= { type: "remote", url: "https://mcp.deepwiki.com/mcp", enabled: false }

      // 权限默认自动放行（用户产品决策：企业内部工具免打断）；
      // doom_loop 保留询问作为失控保护。用户显式配置优先。
      if (typeof config.permission !== "string") {
        config.permission = {
          edit: "allow",
          bash: "allow",
          webfetch: "allow",
          external_directory: "allow",
          skill: "allow",
          doom_loop: "ask",
          ...config.permission,
        }
      }
    },

    tool: officeTools,

    // 模型列表由中转站下发（GET {gateway}/v1/models），登录/保存密钥后自动同步。
    provider: {
      id: PROVIDER_ID,
      async models(_provider, ctx) {
        const auth = ctx.auth
        if (!auth || auth.type !== "api" || !auth.key) return {}

        // A discovery failure is not the same as a provider with zero models.
        // Propagate it so the server keeps the error observable and does not
        // silently delete the provider from the model list during a transient
        // network outage or after a key switch.
        const res = await fetch(gateway("v1/models"), {
          headers: { authorization: `Bearer ${auth.key}` },
          signal: AbortSignal.timeout(10_000),
        })
        if (!res.ok) {
          throw new Error(`Chimera model discovery failed (${res.status} ${res.statusText})`)
        }

        const data = (await res.json()) as { data?: Array<OfficialModel> }
        if (!Array.isArray(data.data)) throw new Error("Chimera model discovery returned an invalid payload")
        const official = await officialModels()
        const models: Record<string, unknown> = {}
        for (const item of data.data) {
          if (!item.id) continue
          const catalog = findOfficialModel(official, item.id)
          const metadata = catalog ? { ...catalog, ...item } : item
          models[item.id] = gatewayModel(item.id, metadata)
        }
        return models as GatewayModels
      },
    },

    // 账号登录经设备授权流在桌面端完成（凭据只在浏览器，见
    // new-api docs/chimera-desktop-auth.md）；插件侧仅保留 API 密钥方式。
    auth: {
      provider: PROVIDER_ID,
      methods: [
        {
          type: "api",
          label: "API 密钥",
          prompts: [{ type: "text", key: "apiKey", message: "API 密钥", placeholder: "sk-..." }],
        },
      ],
    },

    "chat.headers": async (input, output) => {
      if (input?.provider?.info?.id !== PROVIDER_ID) return
      output.headers["x-chimera-client"] = `${BRAND.nameLower}-desktop`
    },

    // 覆盖上游 OpenCode 身份/CLI 文风，再附产品工程守则（幂等，控制每轮 token）。
    "experimental.chat.system.transform": async (_input, output) => {
      const next = applyChimeraSystem(output.system)
      output.system.length = 0
      output.system.push(...next)
    },
  }
}
