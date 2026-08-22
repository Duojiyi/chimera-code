#!/usr/bin/env bun

import { $ } from "bun"
import path from "path"

const dir = process.env.LATEST_YML_DIR!
if (!dir) throw new Error("LATEST_YML_DIR is required")

const repo = process.env.GH_REPO
if (!repo) throw new Error("GH_REPO is required")

const version = process.env.OPENCODE_VERSION
if (!version) throw new Error("OPENCODE_VERSION is required")

type FileEntry = {
  url: string
  sha512: string
  size: number
  blockMapSize?: number
}

type LatestYml = {
  version: string
  files: FileEntry[]
  releaseDate: string
}

function parse(content: string): LatestYml {
  const lines = content.split("\n")
  let version = ""
  let releaseDate = ""
  const files: FileEntry[] = []
  let current: Partial<FileEntry> | undefined

  const flush = () => {
    if (current?.url && current.sha512 && Number.isFinite(current.size) && current.size > 0) {
      files.push(current as FileEntry)
    }
    current = undefined
  }

  for (const line of lines) {
    const indented = line.startsWith("    ") || line.startsWith("  -")
    if (line.startsWith("version:")) version = line.slice("version:".length).trim()
    else if (line.startsWith("releaseDate:"))
      releaseDate = line.slice("releaseDate:".length).trim().replace(/^'|'$/g, "")
    else if (line.trim().startsWith("- url:")) {
      flush()
      current = { url: line.trim().slice("- url:".length).trim() }
    } else if (indented && current && line.trim().startsWith("sha512:"))
      current.sha512 = line.trim().slice("sha512:".length).trim()
    else if (indented && current && line.trim().startsWith("size:"))
      current.size = Number(line.trim().slice("size:".length).trim())
    else if (indented && current && line.trim().startsWith("blockMapSize:"))
      current.blockMapSize = Number(line.trim().slice("blockMapSize:".length).trim())
    else if (!indented && current) flush()
  }
  flush()

  return { version, files, releaseDate }
}

function serialize(data: LatestYml) {
  const lines = [`version: ${data.version}`, "files:"]
  for (const file of data.files) {
    lines.push(`  - url: ${file.url}`)
    lines.push(`    sha512: ${file.sha512}`)
    lines.push(`    size: ${file.size}`)
    if (file.blockMapSize) lines.push(`    blockMapSize: ${file.blockMapSize}`)
  }
  lines.push(`releaseDate: '${data.releaseDate}'`)
  return lines.join("\n") + "\n"
}

async function read(subdir: string, filename: string): Promise<LatestYml | undefined> {
  const file = Bun.file(path.join(dir, subdir, filename))
  if (!(await file.exists())) return undefined
  return parse(await file.text())
}

function validate(label: string, data: LatestYml | undefined): LatestYml {
  if (!data) throw new Error(`Missing updater metadata: ${label}`)
  if (data.version !== version) {
    throw new Error(`${label} has version ${data.version || "<empty>"}; expected ${version}`)
  }
  if (!data.releaseDate) throw new Error(`${label} is missing releaseDate`)
  if (data.files.length === 0) throw new Error(`${label} has no update files`)
  for (const [index, file] of data.files.entries()) {
    if (!file.url || !file.sha512 || !Number.isFinite(file.size) || file.size <= 0) {
      throw new Error(`${label} has an invalid file entry at index ${index}`)
    }
  }
  return data
}

const output: Record<string, string> = {}

// Windows: merge arm64 + x64 into single file
const winX64 = validate(
  "latest-yml-x86_64-pc-windows-msvc/latest.yml",
  await read("latest-yml-x86_64-pc-windows-msvc", "latest.yml"),
)
const winArm64Raw = await read("latest-yml-aarch64-pc-windows-msvc", "latest.yml")
const winArm64 = winArm64Raw ? validate("latest-yml-aarch64-pc-windows-msvc/latest.yml", winArm64Raw) : undefined
{
  const base = winArm64 ?? winX64
  output["latest.yml"] = serialize({
    version: base.version,
    files: [...(winArm64?.files ?? []), ...(winX64?.files ?? [])],
    releaseDate: base.releaseDate,
  })
}

// Linux x64: pass through
const linuxX64 = validate(
  "latest-yml-x86_64-unknown-linux-gnu/latest-linux.yml",
  await read("latest-yml-x86_64-unknown-linux-gnu", "latest-linux.yml"),
)
output["latest-linux.yml"] = serialize(linuxX64)

// Linux arm64: pass through
const linuxArm64 = validate(
  "latest-yml-aarch64-unknown-linux-gnu/latest-linux-arm64.yml",
  await read("latest-yml-aarch64-unknown-linux-gnu", "latest-linux-arm64.yml"),
)
output["latest-linux-arm64.yml"] = serialize(linuxArm64)

// macOS: merge arm64 + x64 into single file
const macX64 = validate(
  "latest-yml-x86_64-apple-darwin/latest-mac.yml",
  await read("latest-yml-x86_64-apple-darwin", "latest-mac.yml"),
)
const macArm64 = validate(
  "latest-yml-aarch64-apple-darwin/latest-mac.yml",
  await read("latest-yml-aarch64-apple-darwin", "latest-mac.yml"),
)
{
  const base = macArm64 ?? macX64
  output["latest-mac.yml"] = serialize({
    version: base.version,
    files: [...(macArm64?.files ?? []), ...(macX64?.files ?? [])],
    releaseDate: base.releaseDate,
  })
}

const expectedFiles = ["latest-linux-arm64.yml", "latest-linux.yml", "latest-mac.yml", "latest.yml"]
if (Object.keys(output).sort().join(",") !== expectedFiles.sort().join(",")) {
  throw new Error(`Unexpected updater metadata set: ${Object.keys(output).join(", ")}`)
}

// Upload to release
const tag = `v${version}`
const tmp = process.env.RUNNER_TEMP ?? "/tmp"

for (const [filename, content] of Object.entries(output)) {
  const filepath = path.join(tmp, filename)
  await Bun.write(filepath, content)
  await $`gh release upload ${tag} ${filepath} --repo ${repo}`
  console.log(`uploaded ${filename}`)
}

console.log("finalized latest yml files")
