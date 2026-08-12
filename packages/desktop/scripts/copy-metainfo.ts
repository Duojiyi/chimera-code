import { BRAND } from "@chimera/brand"

import { resolveChannel } from "./utils"

const arg = process.argv[2]
const channel = arg === "dev" || arg === "beta" || arg === "prod" ? arg : resolveChannel()

const appId = channel === "prod" ? BRAND.appId : `${BRAND.appId}.${channel}`
const productName =
  channel === "prod" ? BRAND.name : `${BRAND.name} ${channel.charAt(0).toUpperCase() + channel.slice(1)}`
const summary = `AI coding agent for enterprise teams${channel !== "prod" ? ` (${channel})` : ""}`

const repoUrl = `https://github.com/${BRAND.github.owner}/${BRAND.github.repo}`

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<component type="desktop-application">
  <id>${appId}</id>

  <metadata_license>CC0-1.0</metadata_license>
  <project_license>MIT</project_license>

  <name>${productName}</name>
  <summary>${summary}</summary>

  <developer id="org.chimerahub">
    <name>${BRAND.name}</name>
  </developer>

  <description>
    <p>
      ${BRAND.name} is an AI coding agent for enterprise teams, powered by the Chimera gateway.
    </p>
  </description>

  <launchable type="desktop-id">${appId}.desktop</launchable>

  <content_rating type="oars-1.1" />

  <url type="bugtracker">${repoUrl}/issues</url>
  <url type="homepage">${BRAND.homepage}</url>
  <url type="vcs-browser">${repoUrl}</url>
</component>
`

await Bun.write(`resources/${appId}.metainfo.xml`, xml)
console.log(`Generated metainfo for ${channel} at resources/${appId}.metainfo.xml`)
