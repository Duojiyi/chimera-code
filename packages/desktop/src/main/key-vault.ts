/**
 * Chimera 密钥保险库（Phase 4，安全阻断项）：秘密值仅存于 Main 进程。
 * - Renderer 只持有元数据（id/name/fingerprint）
 * - 秘密经 Electron safeStorage 加密后落盘 userData/vault/chimera-keys.json
 * - 切换/复制按 id 解密，短暂内存窗口后即清除
 * - 明文绝不进入日志、事件或缓存 key
 */
import { createHash, randomUUID } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"

export type VaultKeyMeta = {
  id: string
  name: string
  fingerprint: string
  createdAt: number
}

type VaultEntry = VaultKeyMeta & { secret: string }

export type VaultCrypto = {
  encrypt(secret: string): string
  decrypt(blob: string): string
}

export type VaultOptions = {
  dir: string
  crypto: VaultCrypto
  /** 是否可用（Linux 无 keyring 时 safeStorage 可能降级，调用方决定是否阻止写入）。 */
  available?: boolean
}

export const fingerprintOf = (secret: string) => createHash("sha256").update(secret).digest("hex").slice(0, 12)

export class KeyVault {
  private readonly file: string
  private readonly crypto: VaultCrypto
  readonly available: boolean
  private cache: VaultEntry[] | undefined

  constructor(options: VaultOptions) {
    this.file = join(options.dir, "chimera-keys.json")
    this.crypto = options.crypto
    this.available = options.available ?? true
  }

  private async load(): Promise<VaultEntry[]> {
    if (this.cache) return this.cache
    try {
      const raw = await readFile(this.file, "utf8")
      const parsed: unknown = JSON.parse(raw)
      const keys = Array.isArray(parsed)
        ? parsed.filter(
            (e): e is VaultEntry =>
              !!e && typeof e === "object" && typeof e.id === "string" && typeof e.secret === "string",
          )
        : []
      this.cache = keys
    } catch {
      this.cache = []
    }
    return this.cache
  }

  private async persist(entries: VaultEntry[]): Promise<void> {
    this.cache = entries
    await mkdir(dirname(this.file), { recursive: true, mode: 0o700 })
    await writeFile(this.file, JSON.stringify(entries, null, 2), { mode: 0o600 })
  }

  async list(): Promise<VaultKeyMeta[]> {
    const entries = await this.load()
    return entries.map(({ secret: _secret, ...meta }) => meta)
  }

  async create(name: string, secret: string): Promise<VaultKeyMeta> {
    const entries = await this.load()
    const meta: VaultKeyMeta = { id: randomUUID(), name, fingerprint: fingerprintOf(secret), createdAt: Date.now() }
    entries.push({ ...meta, secret: this.crypto.encrypt(secret) })
    await this.persist(entries)
    return meta
  }

  async rename(id: string, name: string): Promise<void> {
    const entries = await this.load()
    const entry = entries.find((item) => item.id === id)
    if (!entry) return
    entry.name = name
    await this.persist(entries)
  }

  async remove(id: string): Promise<void> {
    const entries = await this.load()
    const next = entries.filter((item) => item.id !== id)
    if (next.length === entries.length) return
    await this.persist(next)
  }

  /** 解密后返回秘密（调用方使用后立即丢弃引用，不落日志）。 */
  async getSecret(id: string): Promise<string | undefined> {
    const entries = await this.load()
    const entry = entries.find((item) => item.id === id)
    if (!entry) return undefined
    try {
      return this.crypto.decrypt(entry.secret)
    } catch {
      return undefined
    }
  }
}
