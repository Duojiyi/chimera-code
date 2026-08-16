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
  { name: "Personal", key: "sk-aaa" },
  { name: "Work", key: "sk-bbb" },
  { name: "Temp", key: "sk-ccc" },
]

afterEach(() => {
  localStorage.removeItem("chimera-keys")
  localStorage.removeItem("chimera-account")
})

test("nextActiveKey keeps a non-active selection", () => {
  expect(nextActiveKey(keys, "sk-aaa", "sk-bbb")).toBe("sk-aaa")
})

test("nextActiveKey moves to the next remaining key", () => {
  expect(nextActiveKey(keys, "sk-aaa", "sk-aaa")).toBe("sk-bbb")
})

test("nextActiveKey clears when the last key is removed", () => {
  expect(nextActiveKey([keys[0]!], "sk-aaa", "sk-aaa")).toBe("")
})

test("ignores malformed persisted key state", () => {
  localStorage.setItem("chimera-keys", JSON.stringify({ keys: "not-an-array", active: 42 }))
  expect(readChimeraKeys()).toEqual({ keys: [], active: "" })

  localStorage.setItem(
    "chimera-keys",
    JSON.stringify({ keys: [{ name: "Valid", key: "sk-valid" }, { name: 3, key: null }], active: "missing" }),
  )
  expect(readChimeraKeys()).toEqual({ keys: [{ name: "Valid", key: "sk-valid" }], active: "" })
})

test("reacts to local Chimera credential changes", () => {
  localStorage.removeItem("chimera-keys")
  localStorage.removeItem("chimera-account")

  createRoot((dispose) => {
    const signedIn = createChimeraAuth()
    expect(signedIn()).toBe(false)

    writeChimeraKeys({ keys: [{ name: "Primary", key: "sk-test" }], active: "sk-test" })
    expect(signedIn()).toBe(true)

    writeChimeraKeys({ keys: [], active: "" })
    expect(signedIn()).toBe(false)
    dispose()
  })
})
