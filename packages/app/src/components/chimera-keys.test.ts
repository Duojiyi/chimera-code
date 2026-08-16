import { afterEach, expect, test } from "bun:test"
import { createRoot } from "solid-js"
import {
  createChimeraAuth,
  nextActiveKey,
  readChimeraKeys,
  writeChimeraKeys,
  type ChimeraKeyEntry,
} from "./chimera-keys"

const keys: ChimeraKeyEntry[] = [
  { id: "k1", name: "Personal", key: "sk-aaa" },
  { id: "k2", name: "Work", key: "sk-bbb" },
  { id: "k3", name: "Temp", key: "sk-ccc" },
]

afterEach(() => {
  localStorage.removeItem("chimera-keys")
  localStorage.removeItem("chimera-account")
})

test("nextActiveKey keeps a non-active selection", () => {
  expect(nextActiveKey(keys, "k1", "k2")).toBe("k1")
})

test("nextActiveKey moves to the next remaining key", () => {
  expect(nextActiveKey(keys, "k1", "k1")).toBe("k2")
})

test("nextActiveKey clears when the last key is removed", () => {
  expect(nextActiveKey([keys[0]!], "k1", "k1")).toBe("")
})

test("ignores malformed persisted key state", () => {
  localStorage.setItem("chimera-keys", JSON.stringify({ keys: "not-an-array", active: 42 }))
  expect(readChimeraKeys()).toEqual({ keys: [], active: "" })

  localStorage.setItem(
    "chimera-keys",
    JSON.stringify({ keys: [{ name: "Valid", key: "sk-valid" }, { name: 3, key: null }], active: "missing" }),
  )
  // 旧明文格式（无 id）视为无效数据：新格式只认元数据（id/name）
  expect(readChimeraKeys()).toEqual({ keys: [], active: "" })
})

test("reacts to local Chimera credential changes", () => {
  localStorage.removeItem("chimera-keys")
  localStorage.removeItem("chimera-account")

  createRoot((dispose) => {
    const signedIn = createChimeraAuth()
    expect(signedIn()).toBe(false)

    writeChimeraKeys({ keys: [{ id: "k1", name: "Primary", key: "sk-test" }], active: "k1" })
    expect(signedIn()).toBe(true)

    writeChimeraKeys({ keys: [], active: "" })
    expect(signedIn()).toBe(false)
    dispose()
  })
})