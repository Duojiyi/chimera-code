import { expect, test } from "bun:test"
import { nextActiveKey, type ChimeraKeyEntry } from "./chimera-keys"

const keys: ChimeraKeyEntry[] = [
  { name: "Personal", key: "sk-aaa" },
  { name: "Work", key: "sk-bbb" },
  { name: "Temp", key: "sk-ccc" },
]

test("nextActiveKey keeps a non-active selection", () => {
  expect(nextActiveKey(keys, "sk-aaa", "sk-bbb")).toBe("sk-aaa")
})

test("nextActiveKey moves to the next remaining key", () => {
  expect(nextActiveKey(keys, "sk-aaa", "sk-aaa")).toBe("sk-bbb")
})

test("nextActiveKey clears when the last key is removed", () => {
  expect(nextActiveKey([keys[0]!], "sk-aaa", "sk-aaa")).toBe("")
})
