import { describe, expect, test } from "bun:test"
import { fingerprintOf, KeyVault, type VaultCrypto } from "./key-vault"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

const fakeCrypto: VaultCrypto = {
  encrypt: (s: string) => "enc:" + Buffer.from(s, "utf8").toString("base64"),
  decrypt: (b: string) => Buffer.from(b.replace("enc:", ""), "base64").toString("utf8"),
}

const makeVault = async () => {
  const dir = await mkdtemp(join(tmpdir(), "chimera-vault-"))
  const vault = new KeyVault({ dir, crypto: fakeCrypto })
  return { vault, dir }
}

describe("KeyVault", () => {
  test("fingerprint is a stable short sha256 prefix", () => {
    expect(fingerprintOf("sk-abc")).toBe(fingerprintOf("sk-abc"))
    expect(fingerprintOf("sk-abc")).not.toBe(fingerprintOf("sk-abd"))
    expect(fingerprintOf("sk-abc")).toHaveLength(12)
  })

  test("create/list round-trips metadata without exposing the secret", async () => {
    const { vault } = await makeVault()
    const meta = await vault.create("Primary", "sk-super-secret")
    const list = await vault.list()
    expect(list).toHaveLength(1)
    expect(list[0]!.id).toBe(meta.id)
    expect(list[0]!.name).toBe("Primary")
    expect(JSON.stringify(list)).not.toContain("sk-super-secret")
  })

  test("getSecret decrypts the stored secret", async () => {
    const { vault } = await makeVault()
    const meta = await vault.create("Primary", "sk-super-secret")
    expect(await vault.getSecret(meta.id)).toBe("sk-super-secret")
    expect(await vault.getSecret("missing")).toBeUndefined()
  })

  test("rename and remove mutate the vault", async () => {
    const { vault } = await makeVault()
    const a = await vault.create("A", "sk-a")
    const b = await vault.create("B", "sk-b")
    await vault.rename(a.id, "A2")
    await vault.remove(b.id)
    const list = await vault.list()
    expect(list).toHaveLength(1)
    expect(list[0]!.name).toBe("A2")
  })

  test("persists across instances and ignores corrupt files", async () => {
    const dir = await mkdtemp(join(tmpdir(), "chimera-vault-"))
    const v1 = new KeyVault({ dir, crypto: fakeCrypto })
    const meta = await v1.create("Persisted", "sk-persist")
    const v2 = new KeyVault({ dir, crypto: fakeCrypto })
    expect(await v2.getSecret(meta.id)).toBe("sk-persist")
    // 损坏文件
    await rm(join(dir, "chimera-keys.json"), { force: true })
    const v3 = new KeyVault({ dir, crypto: fakeCrypto })
    expect(await v3.list()).toEqual([])
  })
})
