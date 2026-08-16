import { BRAND } from "@chimera/brand"

export type ChimeraGatewayRequest = {
  path: string
  method?: string
  headers?: Record<string, string>
  body?: string
}

const allowedHeaders = new Set(["authorization", "content-type"])

export function resolveChimeraGatewayRequest(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return
  const value = input as Record<string, unknown>
  if (typeof value.path !== "string" || value.path.length > 2_048) return

  const base = new URL(BRAND.gatewayUrl)
  if (!URL.canParse(value.path, base)) return
  const url = new URL(value.path, base)
  if (url.origin !== base.origin) return

  const method = typeof value.method === "string" ? value.method.toUpperCase() : "GET"
  if (!allowsMethod(url.pathname, method)) return
  if (value.body !== undefined && typeof value.body !== "string") return
  if (typeof value.body === "string" && new TextEncoder().encode(value.body).byteLength > 65_536) return
  if (method === "GET" && value.body) return
  if (value.headers !== undefined && (!value.headers || typeof value.headers !== "object" || Array.isArray(value.headers)))
    return

  const entries = Object.entries((value.headers ?? {}) as Record<string, unknown>)
  if (
    entries.some(
      ([key, header]) =>
        !allowedHeaders.has(key.toLowerCase()) || typeof header !== "string" || header.length > 16_384,
    )
  )
    return
  const headers = Object.fromEntries(entries.map(([key, header]) => [key.toLowerCase(), header as string]))
  if (headers["content-type"] && headers["content-type"] !== "application/json") return
  if (headers.authorization && !/^Bearer \S+$/.test(headers.authorization)) return

  return { url, method, headers, body: value.body as string | undefined }
}

function allowsMethod(pathname: string, method: string) {
  if (pathname === "/api/chimera/device/code") return method === "POST"
  if (pathname === "/api/chimera/device/token") return method === "POST"
  if (pathname === "/api/token/") return method === "GET" || method === "POST"
  if (/^\/api\/token\/\d+\/key$/.test(pathname)) return method === "POST"
  if (pathname === "/api/user/self") return method === "GET"
  return false
}
