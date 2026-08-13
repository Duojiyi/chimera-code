import { afterAll, expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import os from "os"
import path from "path"
import { clampRows, officeTools, parseCsv, resolvePath } from "./office"

const tmp = await mkdtemp(path.join(os.tmpdir(), "chimera-office-"))
afterAll(() => rm(tmp, { recursive: true, force: true }))

const ctx = {
  directory: tmp,
  worktree: tmp,
  sessionID: "ses",
  messageID: "msg",
  agent: "build",
  abort: new AbortController().signal,
  metadata() {},
  async ask() {},
}

test("parseCsv handles quotes and commas", () => {
  expect(parseCsv('a,"b,c",d\n1,2,3\n')).toEqual([
    ["a", "b,c", "d"],
    ["1", "2", "3"],
  ])
})

test("resolvePath and clampRows", () => {
  expect(resolvePath("n.csv", tmp)).toBe(path.join(tmp, "n.csv"))
  expect(path.isAbsolute(resolvePath(path.join(tmp, "n.csv"), tmp))).toBe(true)
  expect(clampRows(undefined)).toBe(100)
  expect(clampRows(9999)).toBe(500)
  expect(clampRows(0)).toBe(1)
})

test("xlsx round-trip inspect/read/write", async () => {
  const file = path.join(tmp, "sales.xlsx")
  const written = await officeTools.office_write.execute(
    {
      path: file,
      sheets: JSON.stringify([
        {
          name: "Q1",
          rows: [
            ["Item", "Qty", "Total"],
            ["Pen", 3, "=B2*2"],
          ],
        },
      ]),
    },
    ctx,
  )
  expect(written.output).toContain("sales.xlsx")

  const inspected = await officeTools.office_inspect.execute({ path: file }, ctx)
  const inspectJson = JSON.parse(typeof inspected === "string" ? inspected : inspected.output)
  expect(inspectJson.sheets[0].name).toBe("Q1")
  expect(inspectJson.sheets[0].header).toEqual(["Item", "Qty", "Total"])

  const read = await officeTools.office_read.execute({ path: file, sheet: "Q1" }, ctx)
  const readJson = JSON.parse(typeof read === "string" ? read : read.output)
  expect(readJson.rows[0]).toEqual(["Item", "Qty", "Total"])
  expect(readJson.rows[1][2]).toBe("=B2*2")
})

test("csv write and read", async () => {
  const file = path.join(tmp, "table.csv")
  await officeTools.office_write.execute(
    { path: file, rows: JSON.stringify([["a", "b"], ["1", "2"]]) },
    ctx,
  )
  const read = await officeTools.office_read.execute({ path: file }, ctx)
  const json = JSON.parse(typeof read === "string" ? read : read.output)
  expect(json.rows).toEqual([
    ["a", "b"],
    ["1", "2"],
  ])
})

test("tsv keeps commas inside fields", async () => {
  const file = path.join(tmp, "table.tsv")
  await officeTools.office_write.execute(
    { path: file, rows: JSON.stringify([["a,b", "c"], ["1", "2"]]) },
    ctx,
  )
  const text = await Bun.file(file).text()
  expect(text).toContain("a,b\tc")
  const read = await officeTools.office_read.execute({ path: file }, ctx)
  const json = JSON.parse(typeof read === "string" ? read : read.output)
  expect(json.rows[0]).toEqual(["a,b", "c"])
})

test("rejects creating xlsm and empty pptx", async () => {
  const xlsm = await officeTools.office_write.execute(
    { path: path.join(tmp, "macro.xlsm"), sheets: JSON.stringify([{ name: "A", rows: [["1"]] }]) },
    ctx,
  )
  expect(xlsm.output).toContain(".xlsm")
  const pptx = await officeTools.office_write.execute({ path: path.join(tmp, "empty.pptx") }, ctx)
  expect(pptx.output).toContain("title and/or slides")
})

test("pdf inspect and read", async () => {
  const { PDFDocument, StandardFonts } = await import("pdf-lib")
  const doc = await PDFDocument.create()
  const page = doc.addPage([400, 200])
  const font = await doc.embedFont(StandardFonts.Helvetica)
  page.drawText("Hello Chimera", { x: 24, y: 100, size: 18, font })
  const file = path.join(tmp, "hello.pdf")
  await Bun.write(file, await doc.save())

  const inspected = await officeTools.office_inspect.execute({ path: file }, ctx)
  const inspectJson = JSON.parse(typeof inspected === "string" ? inspected : inspected.output)
  expect(inspectJson.kind).toBe("pdf")
  expect(inspectJson.pages).toBe(1)

  const read = await officeTools.office_read.execute({ path: file }, ctx)
  const readJson = JSON.parse(typeof read === "string" ? read : read.output)
  expect(readJson.pages).toBe(1)
  expect(readJson.scanned).toBe(false)
  expect(readJson.text.join(" ")).toContain("Hello Chimera")
})

test("docx write then inspect", async () => {
  const file = path.join(tmp, "note.docx")
  await officeTools.office_write.execute(
    { path: file, paragraphs: JSON.stringify(["Heading", "Body text"]) },
    ctx,
  )
  const inspected = await officeTools.office_inspect.execute({ path: file }, ctx)
  const json = JSON.parse(typeof inspected === "string" ? inspected : inspected.output)
  expect(json.kind).toBe("docx")
  expect(json.paragraphs).toBeGreaterThan(0)
})

test("pptx write then inspect", async () => {
  const file = path.join(tmp, "deck.pptx")
  await officeTools.office_write.execute(
    {
      path: file,
      title: "Review",
      slides: JSON.stringify([{ title: "Agenda", bullets: ["One", "Two"] }]),
    },
    ctx,
  )
  const inspected = await officeTools.office_inspect.execute({ path: file }, ctx)
  const json = JSON.parse(typeof inspected === "string" ? inspected : inspected.output)
  expect(json.kind).toBe("pptx")
  expect(json.slides).toBeGreaterThanOrEqual(2)
})
