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

/** 网关模型的保守默认元数据；后续可由网关下发的扩展字段精化。 */
function gatewayModel(id: string) {
  return {
    id,
    providerID: PROVIDER_ID,
    name: displayName(id),
    api: {
      id,
      npm: "@ai-sdk/openai-compatible",
      url: gateway("v1"),
    },
    status: "active",
    headers: {},
    options: {},
    cost: { input: 0, output: 0, cache: { read: 0, write: 0 } },
    limit: { context: 200_000, output: 8_192 },
    capabilities: {
      temperature: true,
      reasoning: false,
      attachment: false,
      toolcall: true,
      input: { text: true, audio: false, image: true, video: false, pdf: false },
      output: { text: true, audio: false, image: false, video: false, pdf: false },
      interleaved: false,
    },
    release_date: "",
    variants: {},
  }
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
          const models: Record<string, unknown> = {}
          for (const item of data.data ?? []) {
            if (!item.id) continue
            models[item.id] = gatewayModel(item.id)
          }
          return models as GatewayModels
        } catch {
          return {}
        }
      },
    },

    auth: {
      provider: PROVIDER_ID,
      methods: [
        {
          type: "api",
          label: "中转站账号密码",
          prompts: [
            { type: "text", key: "username", message: "账号", placeholder: "中转站用户名" },
            { type: "text", key: "password", message: "密码" },
          ],
          async authorize(inputs) {
            const username = inputs?.["username"]?.trim()
            const password = inputs?.["password"]
            if (!username || !password) return { type: "failed" }

            // TODO(chimera): 对接中转站登录接口，换取该账号下的全部密钥并落盘。
            // 预期流程：POST {gateway}/auth/login → { keys: [{ name, key, usage }] }
            // → 保存密钥列表 → 返回默认密钥。接口就绪前先以失败处理，避免误导。
            try {
              const res = await fetch(gateway("auth/login"), {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ username, password }),
              })
              if (!res.ok) return { type: "failed" }
              const data = (await res.json()) as { key?: string }
              if (!data.key) return { type: "failed" }
              return { type: "success", key: data.key, metadata: { username } }
            } catch {
              return { type: "failed" }
            }
          },
        },
        {
          type: "api",
          label: "API 密钥",
          prompts: [{ type: "text", key: "apiKey", message: "API 密钥", placeholder: "chm-..." }],
        },
      ],
    },

    "chat.headers": async (input, output) => {
      if (input?.provider?.info?.id !== PROVIDER_ID) return
      output.headers["x-chimera-client"] = `${BRAND.nameLower}-desktop`
    },

    // 身份注入：经由中转站的上游通道可能透传其他产品的系统身份，
    // 在系统提示末尾显式声明 Chimera 身份，保证自我认知一致。
    "experimental.chat.system.transform": async (_input, output) => {
      output.system.push(
        `You are ${BRAND.name}, an enterprise AI coding agent. When asked who you are, identify yourself as ${BRAND.name}. Do not claim to be any other product.`,
      )
    },
  }
}
