import type { Hooks, PluginInput } from "@opencode-ai/plugin"
import { BRAND } from "@chimera/brand"

/** Chimera 网关 provider 的固定 ID，同时用于 auth 存储与 UI 展示。 */
export const PROVIDER_ID = BRAND.nameLower

const gateway = (path: string) => new URL(path, BRAND.gatewayUrl).toString()

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
          label: "企业令牌",
          prompts: [{ type: "text", key: "apiKey", message: "令牌", placeholder: "chm-..." }],
        },
      ],
    },

    "chat.headers": async (input, output) => {
      if (input.provider.info.id !== PROVIDER_ID) return
      output.headers["x-chimera-client"] = `${BRAND.nameLower}-desktop`
    },
  }
}
