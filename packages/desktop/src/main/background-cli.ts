import { execFile } from "node:child_process"
import { existsSync } from "node:fs"
import { chmod, copyFile, mkdir, rename, rm } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"
import { app } from "electron"

import { BRAND } from "@chimera/brand"

const execFileAsync = promisify(execFile)
const root = dirname(fileURLToPath(import.meta.url))
const stateHome = process.env.XDG_STATE_HOME
const desktopStateNames = [`${BRAND.appId}.dev`, `${BRAND.appId}.beta`, BRAND.appId]

type Logger = {
  log(message: string, meta?: Record<string, unknown>): void
  error(message: string, meta?: Record<string, unknown>): void
}

export async function startBackgroundCli(logger: Logger, shellStateHome?: string) {
  const bundled = app.isPackaged
    ? join(process.resourcesPath, executableName())
    : join(root, "../../resources", executableName())
  logger.log("v2 CLI executable resolved", { bundled, packaged: app.isPackaged })
  const version = await run(bundled, ["--version"], logger)
  const binary = app.isPackaged ? await installCli(bundled, version, logger) : bundled

  const candidates = [
    ...new Set([stateHome, shellStateHome, ...desktopStateNames.map((name) => join(app.getPath("appData"), name))]),
  ].filter((candidate) => candidate === undefined || existsSync(candidate))
  const discovered = await Promise.all(
    candidates.map(async (candidate) => ({
      stateHome: candidate,
      url: serviceUrl(await run(binary, ["service", "status"], logger, { stateHome: candidate })),
    })),
  )
  const found = discovered.find((candidate) => candidate.url !== undefined)
  logger.log("v2 CLI background instance checked", {
    detected: Boolean(found),
    ...endpoint(found?.url),
  })

  const daemonStateHome = found?.stateHome ?? stateHome
  const url = await run(binary, ["service", "start"], logger, { stateHome: daemonStateHome })
  const password = await run(binary, ["service", "get", "password"], logger, {
    redact: true,
    stateHome: daemonStateHome,
  })
  logger.log("v2 CLI background service ready", {
    existing: Boolean(found),
    username: "opencode",
    ...endpoint(url),
  })
  return {
    url,
    username: "opencode",
    password,
  }
}

async function installCli(source: string, version: string, logger: Logger) {
  const directory = join(app.getPath("userData"), "cli", version.replace(/[^a-zA-Z0-9._-]/g, "-"))
  const destination = join(directory, executableName())
  if (existsSync(destination)) {
    logger.log("v2 CLI staged executable reused", { path: destination, version })
    return destination
  }

  const temp = destination + `.${process.pid}.tmp`
  await mkdir(directory, { recursive: true })
  await copyFile(source, temp)
  if (process.platform !== "win32") await chmod(temp, 0o755)
  await rename(temp, destination).catch(async (error) => {
    await rm(temp, { force: true })
    throw error
  })
  logger.log("v2 CLI executable staged", { source, path: destination, version })
  return destination
}

async function run(
  binary: string,
  args: string[],
  logger: Logger,
  options: { redact?: boolean; stateHome?: string } = {},
) {
  logger.log("v2 CLI command started", { binary, args })
  const env = { ...process.env }
  // Chimera: CLI sidecar 目前是上游预编译二进制（内部目录叶子仍为 opencode），
  // 通过 XDG 环境变量把它的 data/config/cache 全部圈进 Chimera 自有目录，
  // 避免读写本机已安装 opencode 的全局数据。
  const xdgBase = join(app.getPath("appData"), BRAND.nameLower, "cli-xdg")
  env.XDG_DATA_HOME = join(xdgBase, "data")
  env.XDG_CONFIG_HOME = join(xdgBase, "config")
  env.XDG_CACHE_HOME = join(xdgBase, "cache")
  env.XDG_STATE_HOME = options.stateHome ?? join(xdgBase, "state")
  return execFileAsync(binary, args, { env, windowsHide: true }).then(
    (result) => {
      const stdout = result.stdout.trim()
      const stderr = result.stderr.trim()
      logger.log("v2 CLI command completed", { args, stdout: options.redact ? "[redacted]" : stdout, stderr })
      return stdout
    },
    (error: unknown) => {
      const output = error as { stdout?: string; stderr?: string }
      logger.error("v2 CLI command failed", {
        args,
        error: error instanceof Error ? error.message : String(error),
        stdout: options.redact && output.stdout ? "[redacted]" : (output.stdout?.trim() ?? ""),
        stderr: output.stderr?.trim() ?? "",
      })
      throw error
    },
  )
}

function serviceUrl(status: string) {
  if (URL.canParse(status)) return status
  if (!status.startsWith("running ")) return
  const url = status.slice("running ".length).trim()
  return URL.canParse(url) ? url : undefined
}

function endpoint(url: string | undefined) {
  if (!url || !URL.canParse(url)) return {}
  const parsed = new URL(url)
  return { url, hostname: parsed.hostname, port: parsed.port }
}

function executableName() {
  return process.platform === "win32" ? "opencode-cli.exe" : "opencode-cli"
}
