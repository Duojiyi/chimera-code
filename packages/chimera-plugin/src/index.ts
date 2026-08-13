import type { Hooks, PluginInput } from "@opencode-ai/plugin"
import { BRAND } from "@chimera/brand"

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

/** models.dev 官方目录中的模型元数据（仅取本插件需要的字段）。 */
type OfficialModel = {
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
 * 拉取 models.dev 官方目录并按模型 ID 展平索引（跨厂商）。
 * 网关模型 ID 与官方 ID 一致（如 claude-sonnet-4-6），据此自动识别
 * 上下文窗口等官方数据；目录缓存 10 分钟，失败时退回保守默认值。
 */
async function officialModels(): Promise<Map<string, OfficialModel>> {
  const now = Date.now()
  if (officialCatalog && now - officialCatalogAt < 10 * 60_000) return officialCatalog
  try {
    const res = await fetch("https://models.dev/api.json", { signal: AbortSignal.timeout(10_000) })
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
    for (const [, provider] of providers) {
      for (const [id, model] of Object.entries(provider.models ?? {})) {
        if (!map.has(id)) map.set(id, model)
      }
    }
    officialCatalog = map
    officialCatalogAt = now
    return map
  } catch {
    return officialCatalog ?? new Map()
  }
}

/** 网关模型元数据：官方目录（models.dev）自动识别，缺失字段用保守默认；
 *  用户可在 chimera.json 的 provider.chimera.models.<id> 手动覆盖。 */
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
      reasoning: official?.reasoning ?? false,
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
    // 对 plugin models 原样入库），按 openai-compatible 的 effort 映射
    // （{ reasoningEffort }，网关透传 reasoning_effort）在此直接生成。
    variants: gatewayVariants(official),
  }
}

/** 从官方 reasoning_options 生成 effort 变体（low/medium/high/xhigh/max）。 */
function gatewayVariants(official?: OfficialModel): Record<string, Record<string, unknown>> {
  const effort = official?.reasoning_options?.find((option) => option["type"] === "effort")
  const values = effort?.["values"]
  if (!Array.isArray(values)) return {}
  return Object.fromEntries(
    values
      .filter((value): value is string => typeof value === "string" && value !== "none")
      .map((value) => [value, { reasoningEffort: value }]),
  )
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

      // 内置常用 MCP（用户同名配置优先）：预置但不默认连接，避免未登录就出现「1 MCP」。
      config.mcp ??= {}
      config.mcp["context7"] ??= { type: "remote", url: "https://mcp.context7.com/mcp", enabled: false }
      config.mcp["deepwiki"] ??= { type: "remote", url: "https://mcp.deepwiki.com/mcp", enabled: false }

      // 权限默认自动放行（用户产品决策：企业内部工具免打断）；
      // doom_loop 保留询问作为失控保护。用户显式配置优先。
      config.permission ??= {
        edit: "allow",
        bash: "allow",
        webfetch: "allow",
        external_directory: "allow",
        doom_loop: "ask",
      }
    },

    // 模型列表由中转站下发（GET {gateway}/v1/models），登录/保存密钥后自动同步。
    provider: {
      id: PROVIDER_ID,
      async models(_provider, ctx) {
        const auth = ctx.auth
        if (!auth || auth.type !== "api" || !auth.key) return {}
        try {
          const res = await fetch(gateway("v1/models"), {
            headers: { authorization: `Bearer ${auth.key}` },
            signal: AbortSignal.timeout(10_000),
          })
          if (!res.ok) return {}
          const data = (await res.json()) as { data?: Array<{ id?: string }> }
          const official = await officialModels()
          const models: Record<string, unknown> = {}
          for (const item of data.data ?? []) {
            if (!item.id) continue
            models[item.id] = gatewayModel(item.id, official.get(item.id))
          }
          return models as GatewayModels
        } catch {
          return {}
        }
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

    // 身份注入：经由中转站的上游通道可能透传其他产品的系统身份，
    // 在系统提示末尾显式声明 Chimera 身份，保证自我认知一致。
    // 另附产品内置工程守则（精炼版，控制每轮 token 开销）。
    "experimental.chat.system.transform": async (_input, output) => {
      output.system.push(
        `You are ${BRAND.name}, an enterprise AI coding agent. When asked who you are, identify yourself as ${BRAND.name}. Do not claim to be any other product.`,
      )
      // 融合 Karpathy 四原则（forrestchang/andrej-karpathy-skills）与
      // Ponytail YAGNI 决策阶梯的精华，控制在 ~250 token。
      output.system.push(
        [
          "工程守则：",
          "【先想后写】不假设需求，有困惑直接问；关键取舍摆到明面说。",
          "【写码前自查】按序问：真的需要写吗（YAGNI）→ 代码库已有吗 → 标准库/平台原生能做吗 → 已装依赖能做吗 → 一行能解决吗；都不行才写最少必要代码，不做投机性设计。",
          "【外科手术式修改】只动任务必须动的代码；不顺手重构无关代码；遵循项目既有风格与架构，不引入未经讨论的新依赖。",
          "【以验证收尾】先定成功标准，改完用测试或检查证实达标再交付；不确定的事实（API、版本、路径）先查证，不编造。",
          "【永不偷懒的底线】信任边界的输入校验、防数据丢失的错误处理、安全、无障碍、用户明确提出的要求。",
          "【安全红线】绝不泄露密钥令牌等敏感信息；删除、覆盖、强推等破坏性操作先说明影响并确认。",
          "【语言】用用户使用的语言回复；注释与提交信息遵循仓库惯例。",
        ].join("\n"),
      )
    },
  }
}
