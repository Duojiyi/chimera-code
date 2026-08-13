#!/usr/bin/env bun
import { $ } from "bun"

import { downloadCliToResources, resolveChannel } from "./utils"

const channel = resolveChannel()
await $`bun ./scripts/copy-icons.ts ${channel}`
await $`bun ./scripts/copy-metainfo.ts ${channel}`

const vendor = await $`bun run vendor:ppt-master`.cwd("../chimera-plugin").nothrow()
if (vendor.exitCode !== 0) {
  console.warn("ppt-master vendor skipped")
  if (process.env.CI) process.exit(1)
}

await $`cd ../opencode && bun script/build-node.ts`
if (channel === "dev") await downloadCliToResources()
