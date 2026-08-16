import { expect, test } from "bun:test"
import type { Configuration } from "electron-builder"

import { BRAND, brandScheme } from "@chimera/brand"

const channels = [
  { channel: "dev", appId: `${BRAND.appId}.dev` },
  { channel: "beta", appId: `${BRAND.appId}.beta` },
  { channel: "prod", appId: BRAND.appId },
] as const

for (const channel of channels) {
  test(`uses one Linux desktop identity for ${channel.channel}`, async () => {
    const previous = process.env.OPENCODE_CHANNEL
    process.env.OPENCODE_CHANNEL = channel.channel

    const module = await import(`./electron-builder.config.ts?channel=${channel.channel}`)
    const config = module.default as Configuration

    if (previous === undefined) delete process.env.OPENCODE_CHANNEL
    else process.env.OPENCODE_CHANNEL = previous

    expect(config.appId).toBe(channel.appId)
    expect(config.extraMetadata?.desktopName).toBe(`${channel.appId}.desktop`)
    expect(config.linux?.executableName).toBe(channel.appId)
    expect(config.linux?.desktop?.entry?.StartupWMClass).toBe(channel.appId)
    expect(config.deb?.fpm).toContainEqual(expect.stringContaining(`/usr/share/metainfo/${channel.appId}.metainfo.xml`))
    expect(config.rpm?.fpm).toContainEqual(expect.stringContaining(`/usr/share/metainfo/${channel.appId}.metainfo.xml`))
    expect(config.protocols).toEqual({
      name: channel.channel === "prod" ? BRAND.name : `${BRAND.name} ${channel.channel === "dev" ? "Dev" : "Beta"}`,
      schemes: [brandScheme(channel.channel)],
    })
  })
}

test("skips Apple notarize without credentials", async () => {
  const previous = {
    channel: process.env.OPENCODE_CHANNEL,
    key: process.env.APPLE_API_KEY,
    keyId: process.env.APPLE_API_KEY_ID,
    issuer: process.env.APPLE_API_ISSUER,
  }
  process.env.OPENCODE_CHANNEL = "prod"
  delete process.env.APPLE_API_KEY
  delete process.env.APPLE_API_KEY_ID
  delete process.env.APPLE_API_ISSUER

  const module = await import("./electron-builder.config.ts?notarize=off")
  const config = module.default as Configuration

  if (previous.channel === undefined) delete process.env.OPENCODE_CHANNEL
  else process.env.OPENCODE_CHANNEL = previous.channel
  if (previous.key === undefined) delete process.env.APPLE_API_KEY
  else process.env.APPLE_API_KEY = previous.key
  if (previous.keyId === undefined) delete process.env.APPLE_API_KEY_ID
  else process.env.APPLE_API_KEY_ID = previous.keyId
  if (previous.issuer === undefined) delete process.env.APPLE_API_ISSUER
  else process.env.APPLE_API_ISSUER = previous.issuer

  expect(config.mac?.notarize).toBe(false)
  expect(config.dmg?.sign).toBe(false)
})

test("brands the protocol scheme and artifact name", async () => {
  const previous = process.env.OPENCODE_CHANNEL
  process.env.OPENCODE_CHANNEL = "prod"

  const module = await import("./electron-builder.config.ts?brand=prod")
  const config = module.default as Configuration

  if (previous === undefined) delete process.env.OPENCODE_CHANNEL
  else process.env.OPENCODE_CHANNEL = previous

  expect(config.productName).toBe(BRAND.name)
  expect(config.protocols).toEqual({ name: BRAND.name, schemes: [brandScheme("prod")] })
  expect(config.artifactName?.startsWith(`${BRAND.nameLower}-desktop-`)).toBe(true)
  expect(config.publish).toEqual({
    provider: "github",
    owner: BRAND.github.owner,
    repo: BRAND.github.repo,
    channel: "latest",
  })
})

test("bundles the CLI outside the dev app archive", async () => {
  const previous = process.env.OPENCODE_CHANNEL
  process.env.OPENCODE_CHANNEL = "dev"
  const module = await import("./electron-builder.config.ts?cli-resource")
  const config = module.default as Configuration
  if (previous === undefined) delete process.env.OPENCODE_CHANNEL
  else process.env.OPENCODE_CHANNEL = previous

  expect(config.files).toContain("!resources/opencode-cli*")
  expect(config.extraResources).toContainEqual({
    from: "resources/",
    to: "",
    filter: ["opencode-cli*"],
  })
})

for (const channel of ["beta", "prod"] as const) {
  test(`does not bundle the CLI in ${channel} builds`, async () => {
    const previous = process.env.OPENCODE_CHANNEL
    process.env.OPENCODE_CHANNEL = channel
    const module = await import(`./electron-builder.config.ts?no-cli-resource=${channel}`)
    const config = module.default as Configuration
    if (previous === undefined) delete process.env.OPENCODE_CHANNEL
    else process.env.OPENCODE_CHANNEL = previous

    expect(config.extraResources).not.toContainEqual({
      from: "resources/",
      to: "",
      filter: ["opencode-cli*"],
    })
  })
}
