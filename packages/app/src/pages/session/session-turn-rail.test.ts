import { expect, test } from "bun:test"
import {
  pickCurrentTurnId,
  turnRailDashWidth,
  turnRailIndexAt,
  turnRailPitch,
  turnRailStackOffset,
} from "./session-turn-rail"

const marks = [
  { id: "a", top: 0, bottom: 80 },
  { id: "b", top: 120, bottom: 200 },
  { id: "c", top: 240, bottom: 400 },
]

test("pickCurrentTurnId hits the turn covering the read line", () => {
  expect(pickCurrentTurnId(marks, 0, 300, 150)).toBe("b")
})

test("pickCurrentTurnId falls back to the nearest visible turn", () => {
  expect(pickCurrentTurnId(marks, 100, 220, 90)).toBe("b")
})

test("pickCurrentTurnId uses the last turn above the line when none are in view", () => {
  expect(pickCurrentTurnId(marks, 500, 600, 520)).toBe("c")
})

test("turnRailPitch stays tight when there is extra room", () => {
  expect(turnRailPitch(8, 400)).toBe(8)
})

test("turnRailPitch only compresses when the stack would overflow", () => {
  expect(turnRailPitch(100, 400)).toBe(4)
})

test("turnRailStackOffset centers a short stack in the gutter", () => {
  expect(turnRailStackOffset(8, 400)).toBe(168)
})

test("turnRailStackOffset collapses when the stack fills the gutter", () => {
  expect(turnRailStackOffset(100, 400)).toBe(0)
})

test("turnRailIndexAt uses packed pitch instead of stretching across the pane", () => {
  expect(turnRailIndexAt(0, 0, 8, 8)).toBe(0)
  expect(turnRailIndexAt(12, 0, 8, 8)).toBe(1)
  expect(turnRailIndexAt(63, 0, 8, 8)).toBe(7)
})

test("turnRailDashWidth peaks on the hovered turn and falls off to the sides", () => {
  expect(turnRailDashWidth({ hovering: true, distance: 0 })).toBe(36)
  expect(turnRailDashWidth({ hovering: true, distance: 1 })).toBe(22)
  expect(turnRailDashWidth({ hovering: true, distance: 2 })).toBe(14)
  expect(turnRailDashWidth({ hovering: true, distance: 3 })).toBe(11)
  expect(turnRailDashWidth({ hovering: true, distance: 6 })).toBe(10)
})

test("turnRailDashWidth keeps idle ticks the same length", () => {
  expect(turnRailDashWidth({ hovering: false })).toBe(10)
})
