import { execFile } from "node:child_process"
import { existsSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"

import type { Configuration } from "electron-builder"

import { BRAND } from "@chimera/brand"

const execFileAsync = promisify(execFile)
const packageDir = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(packageDir, "../..")
const signScript = path.join(rootDir, "script", "sign-windows.ps1")
const pptMasterDir = path.join(rootDir, "packages/chimera-plugin/skills/ppt-master")

const metainfoFpm = (appId: string) =>
  `${path.join(packageDir, "resources", `${appId}.metainfo.xml`)}=/usr/share/metainfo/${appId}.metainfo.xml`

async function signWindows(configuration: { path: string }) {
  if (process.platform !== "win32") return
  if (process.env.GITHUB_ACTIONS !== "true") return

  await execFileAsync(
    "pwsh",
    ["-NoLogo", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", signScript, configuration.path],
    { cwd: rootDir },
  )
}

const channel = (() => {
  const raw = process.env.OPENCODE_CHANNEL
  if (raw === "dev" || raw === "beta" || raw === "prod") return raw
  return "dev"
})()

const appleNotarize = Boolean(
  process.env.APPLE_API_KEY && process.env.APPLE_API_KEY_ID && process.env.APPLE_API_ISSUER,
)

const APP_IDS = {
  dev: `${BRAND.appId}.dev`,
  beta: `${BRAND.appId}.beta`,
  prod: BRAND.appId,
} as const

const getBase = (appId: string): Configuration => ({
  artifactName: BRAND.nameLower + "-desktop-${os}-${arch}.${ext}",
  directories: {
    output: "dist",
    buildResources: "resources",
  },
  // Linux launchers are .desktop files, so this is the desktop file name,
  // not just the app id. For prod, app id "ai.opencode.desktop" becomes
  // "ai.opencode.desktop.desktop".
  // https://developer.gnome.org/documentation/guidelines/maintainer/integrating.html
  // https://www.electron.build/docs/linux/
  extraMetadata: {
    desktopName: `${appId}.desktop`,
  },
  files: ["out/**/*", "resources/**/*", "!resources/opencode-cli*"],
  extraResources: [
    ...(channel === "dev"
      ? [
          {
            from: "resources/",
            to: "",
            filter: ["opencode-cli*"],
          },
        ]
      : []),
    {
      from: "native/",
      to: "native/",
      filter: ["index.js", "index.d.ts", "build/Release/mac_window.node", "swift-build/**"],
    },
    ...(existsSync(path.join(pptMasterDir, "SKILL.md"))
      ? [
          {
            from: "../chimera-plugin/skills/ppt-master",
            to: "ppt-master",
          },
        ]
      : []),
  ],
  mac: {
    category: "public.app-category.developer-tools",
    icon: `resources/icons/icon.icns`,
    hardenedRuntime: true,
    gatekeeperAssess: false,
    entitlements: "resources/entitlements.plist",
    entitlementsInherit: "resources/entitlements.plist",
    notarize: appleNotarize,
    target: ["dmg", "zip"],
  },
  dmg: {
    sign: appleNotarize,
  },
  protocols: {
    name: BRAND.name,
    schemes: [BRAND.scheme],
  },
  win: {
    icon: `resources/icons/icon.ico`,
    signtoolOptions: {
      sign: signWindows,
    },
    target: ["nsis"],
    verifyUpdateCodeSignature: false,
  },
  nsis: {
    oneClick: true,
    perMachine: false,
    installerIcon: `resources/icons/icon.ico`,
    installerHeaderIcon: `resources/icons/icon.ico`,
  },
  linux: {
    icon: `resources/icons`,
    category: "Development",
    executableName: appId,
    desktop: {
      entry: {
        // Match the installed .desktop file and hicolor icon basename so
        // Linux shells can associate the running Electron window with its launcher.
        StartupWMClass: appId,
      },
    },
    target: ["AppImage", "deb", "rpm"],
  },
})

function getConfig() {
  const appId = APP_IDS[channel]
  const base = getBase(appId)

  switch (channel) {
    case "dev": {
      return {
        ...base,
        appId,
        productName: `${BRAND.name} Dev`,
        deb: { fpm: [metainfoFpm(appId)] },
        rpm: { packageName: `${BRAND.nameLower}-dev`, fpm: [metainfoFpm(appId)] },
      }
    }
    case "beta": {
      return {
        ...base,
        appId,
        productName: `${BRAND.name} Beta`,
        protocols: { name: `${BRAND.name} Beta`, schemes: [BRAND.scheme] },
        publish: {
          provider: "github",
          owner: BRAND.github.owner,
          repo: BRAND.github.repo,
          channel: "beta",
        },
        deb: { fpm: [metainfoFpm(appId)] },
        rpm: { packageName: `${BRAND.nameLower}-beta`, fpm: [metainfoFpm(appId)] },
      }
    }
    case "prod": {
      return {
        ...base,
        appId,
        productName: BRAND.name,
        protocols: { name: BRAND.name, schemes: [BRAND.scheme] },
        publish: {
          provider: "github",
          owner: BRAND.github.owner,
          repo: BRAND.github.repo,
          channel: "latest",
        },
        deb: { fpm: [metainfoFpm(appId)] },
        rpm: { packageName: BRAND.nameLower, fpm: [metainfoFpm(appId)] },
      }
    }
  }
}

export default getConfig()
