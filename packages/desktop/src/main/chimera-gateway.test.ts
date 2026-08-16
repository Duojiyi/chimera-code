import { describe, expect, test } from "bun:test"
import { resolveChimeraGatewayRequest } from "./chimera-gateway"

describe("resolveChimeraGatewayRequest", () => {
  test("allows only the device authorization and token routes used by the desktop", () => {
    expect(resolveChimeraGatewayRequest({ path: "/api/chimera/device/code", method: "POST" })?.url.pathname).toBe(
      "/api/chimera/device/code",
    )
    expect(resolveChimeraGatewayRequest({ path: "/api/token/?p=1&page_size=100" })?.method).toBe("GET")
    expect(resolveChimeraGatewayRequest({ path: "/api/token/42/key", method: "POST" })?.url.pathname).toBe(
      "/api/token/42/key",
    )
    expect(resolveChimeraGatewayRequest({ path: "/api/user/self" })?.method).toBe("GET")
  })

  test("rejects arbitrary gateway paths, origins, and methods", () => {
    expect(resolveChimeraGatewayRequest({ path: "/api/admin/users" })).toBeUndefined()
    expect(resolveChimeraGatewayRequest({ path: "https://example.com/api/token/" })).toBeUndefined()
    expect(resolveChimeraGatewayRequest({ path: "/api/user/self", method: "DELETE" })).toBeUndefined()
    expect(resolveChimeraGatewayRequest({ path: "/api/token/not-a-number/key", method: "POST" })).toBeUndefined()
  })

  test("accepts only the headers required by the authorization flow", () => {
    expect(
      resolveChimeraGatewayRequest({
        path: "/api/user/self",
        headers: { Authorization: "Bearer access-token" },
      })?.headers,
    ).toEqual({ authorization: "Bearer access-token" })
    expect(
      resolveChimeraGatewayRequest({ path: "/api/user/self", headers: { cookie: "session=admin" } }),
    ).toBeUndefined()
    expect(
      resolveChimeraGatewayRequest({ path: "/api/user/self", headers: { authorization: "Basic secret" } }),
    ).toBeUndefined()
    expect(
      resolveChimeraGatewayRequest({
        path: "/api/user/self",
        headers: { authorization: `Bearer ${"x".repeat(16_384)}` },
      }),
    ).toBeUndefined()
  })

  test("rejects GET bodies and oversized request bodies", () => {
    expect(resolveChimeraGatewayRequest({ path: "/api/user/self", body: "{}" })).toBeUndefined()
    expect(
      resolveChimeraGatewayRequest({
        path: "/api/chimera/device/token",
        method: "POST",
        body: "x".repeat(65_537),
      }),
    ).toBeUndefined()
    expect(
      resolveChimeraGatewayRequest({
        path: "/api/chimera/device/token",
        method: "POST",
        body: "你".repeat(22_000),
      }),
    ).toBeUndefined()
  })
})
