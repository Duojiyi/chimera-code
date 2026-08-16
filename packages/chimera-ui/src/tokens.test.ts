import { describe, expect, test } from "bun:test"
import { component, motion, radius, resolve, semantic, space, tokens, typeScale } from "./tokens"

const themes = ["dark", "light"] as const
const hex = /^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/

describe("tokens", () => {
  test("dark and light palettes have identical keys", () => {
    expect(Object.keys(tokens.dark).sort()).toEqual(Object.keys(tokens.light).sort())
  })

  test("all palette values are valid hex colors", () => {
    for (const theme of themes) {
      for (const [key, value] of Object.entries(tokens[theme])) {
        expect(hex.test(value), `${theme}.${key} = ${value}`).toBe(true)
      }
    }
  })

  test("semantic layer references only existing palette keys", () => {
    for (const theme of themes) {
      for (const [group, entries] of Object.entries(semantic)) {
        for (const [name, key] of Object.entries(entries)) {
          expect(key in tokens[theme], `${group}.${name} -> ${key}`).toBe(true)
          expect(hex.test(resolve(theme, [group, name])), `${group}.${name} resolves to hex`).toBe(true)
        }
      }
    }
  })

  test("component layer references valid semantic signal keys", () => {
    const signalKeys = new Set(Object.keys(semantic.signal))
    for (const group of Object.values(component)) {
      for (const ref of Object.values(group)) {
        expect(signalKeys.has(ref), `component ref ${ref}`).toBe(true)
      }
    }
  })

  test("space/radius/motion/typeScale are complete", () => {
    expect(Object.keys(space)).toHaveLength(8)
    expect(Object.keys(radius)).toHaveLength(3)
    expect(motion.fast).toBeLessThan(motion.base)
    expect(motion.base).toBeLessThan(motion.slow)
    expect(typeScale.body).toBeGreaterThan(typeScale.data)
  })

  test("text contrast meets WCAG AA in both themes", () => {
    for (const theme of themes) {
      const p = tokens[theme]
      const contrast = (a: string, b: string) => {
        const lum = (c: string) => {
          const [r, g, bl] = [1, 3, 5].map((i) => {
            const v = parseInt(c.slice(i, i + 2), 16) / 255
            return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
          })
          return 0.2126 * r + 0.7152 * g + 0.0722 * bl
        }
        const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x)
        return (l1 + 0.05) / (l2 + 0.05)
      }
      expect(contrast(p.text1, p.bg), `${theme} text1/bg`).toBeGreaterThanOrEqual(4.5)
      expect(contrast(p.text2, p.bg), `${theme} text2/bg`).toBeGreaterThanOrEqual(4.5)
    }
  })
})
