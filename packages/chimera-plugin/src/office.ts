import { mkdir } from "node:fs/promises"
import path from "path"
import { tool, type ToolResult } from "@opencode-ai/plugin"
import ExcelJS from "exceljs"
import mammoth from "mammoth"
import { Document, Packer, Paragraph, HeadingLevel } from "docx"
import PptxGenJS from "pptxgenjs"
import JSZip from "jszip"
import { PDFDocument } from "pdf-lib"
import { extractText, getDocumentProxy } from "unpdf"

const READ_ROWS_DEFAULT = 100
const READ_ROWS_MAX = 500
const officeCell = tool.schema.union([
  tool.schema.string(),
  tool.schema.number(),
  tool.schema.boolean(),
  tool.schema.null(),
])
const officeRows = tool.schema.array(tool.schema.array(officeCell))
const officeSheets = tool.schema.array(
  tool.schema.object({ name: tool.schema.string().optional(), rows: officeRows.optional() }),
)
const officeParagraphs = tool.schema.array(tool.schema.string())
const officeSlides = tool.schema.array(
  tool.schema.object({
    title: tool.schema.string().optional(),
    bullets: tool.schema.array(tool.schema.string()).optional(),
  }),
)

export const officeTools = {
  office_inspect: tool({
    description:
      "Inspect an office file without dumping its contents. Supports .xlsx, .xlsm, .csv, .tsv, .docx, .pptx, .pdf. Returns sheets/headers/dimensions for spreadsheets, paragraph/slide counts for documents, page count for PDFs.",
    args: {
      path: tool.schema.string().describe("Absolute path, or path relative to the project directory"),
    },
    execute: (args, ctx) => run(() => inspect(resolvePath(args.path, ctx.directory))),
  }),
  office_read: tool({
    description:
      "Read bounded content from an office file. Spreadsheets return rows as JSON (formulas kept as =...). Word/PowerPoint return extracted text. PDFs return per-page text (max_rows = max pages). Always inspect large files first.",
    args: {
      path: tool.schema.string().describe("Absolute path, or path relative to the project directory"),
      sheet: tool.schema.string().optional().describe("Spreadsheet sheet name. Defaults to the first sheet."),
      range: tool.schema
        .string()
        .optional()
        .describe("Optional A1 range such as A1:D20. Ignored for csv/tsv/docx/pptx/pdf."),
      max_rows: tool.schema
        .number()
        .optional()
        .describe(`Max spreadsheet rows or PDF pages to return (default ${READ_ROWS_DEFAULT}, max ${READ_ROWS_MAX})`),
    },
    execute: (args, ctx) =>
      run(() =>
        readFile({
          filepath: resolvePath(args.path, ctx.directory),
          sheet: args.sheet,
          range: args.range,
          maxRows: clampRows(args.max_rows),
        }),
      ),
  }),
  office_write: tool({
    description:
      "Create or overwrite xlsx, csv, tsv, docx, or pptx. The file extension selects the format. Overwrites the whole file; it does not edit an existing workbook in place. Strings starting with = are stored as spreadsheet formulas. Does not evaluate formulas.",
    args: {
      path: tool.schema.string().describe("Output path (absolute or project-relative). Extension selects the format."),
      format: tool.schema
        .enum(["xlsx", "csv", "tsv", "docx", "pptx"])
        .optional()
        .describe("Only needed when the path has no .xlsx/.csv/.tsv/.docx/.pptx extension."),
      sheets: tool.schema
        .string()
        .optional()
        .describe('xlsx: JSON string of [{ "name": string, "rows": (string|number|boolean|null)[][] }]. Pass a string, not a raw array.'),
      rows: tool.schema.string().optional().describe("csv/tsv: JSON string of a 2D array. Pass a string, not a raw array."),
      paragraphs: tool.schema.string().optional().describe("docx: JSON string of paragraph strings. Pass a string, not a raw array."),
      title: tool.schema.string().optional().describe("pptx: optional title-slide text"),
      slides: tool.schema
        .string()
        .optional()
        .describe('pptx: JSON string of [{ "title": string, "bullets"?: string[] }]. Pass a string, not a raw array.'),
    },
    execute: (args, ctx) =>
      run(async () => {
        const filepath = resolvePath(args.path, ctx.directory)
        await ctx.ask({
          permission: "edit",
          patterns: [path.basename(filepath)],
          always: ["*"],
          metadata: { filepath },
        })
        return writeFile(filepath, args)
      }),
  }),
}

export function resolvePath(input: string, directory: string) {
  if (path.isAbsolute(input)) return input
  return path.join(directory, input)
}

export function clampRows(value: number | undefined) {
  if (value == null || Number.isNaN(value)) return READ_ROWS_DEFAULT
  return Math.min(READ_ROWS_MAX, Math.max(1, Math.floor(value)))
}

export function parseCsv(text: string, delimiter = ",") {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ""
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"'
          i++
          continue
        }
        quoted = false
        continue
      }
      cell += ch
      continue
    }
    if (ch === '"') {
      quoted = true
      continue
    }
    if (ch === delimiter) {
      row.push(cell)
      cell = ""
      continue
    }
    if (ch === "\n") {
      if (cell.endsWith("\r")) cell = cell.slice(0, -1)
      row.push(cell)
      rows.push(row)
      row = []
      cell = ""
      continue
    }
    cell += ch
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell)
    rows.push(row)
  }
  return rows
}

function kindOf(filepath: string) {
  const ext = path.extname(filepath).toLowerCase()
  if (ext === ".xlsx" || ext === ".xlsm") return "xlsx"
  if (ext === ".csv") return "csv"
  if (ext === ".tsv") return "tsv"
  if (ext === ".docx" || ext === ".dotx") return "docx"
  if (ext === ".pptx" || ext === ".potx") return "pptx"
  if (ext === ".pdf") return "pdf"
  return ext.replace(".", "") || "unknown"
}

function writeKind(filepath: string, format?: string) {
  const fromPath = kindOf(filepath)
  if (fromPath !== "unknown") return fromPath
  if (format === "xlsx" || format === "csv" || format === "tsv" || format === "docx" || format === "pptx") return format
  return "unknown"
}

async function inspect(filepath: string) {
  const file = Bun.file(filepath)
  if (!(await file.exists())) return fail(`File not found: ${filepath}`)
  const kind = kindOf(filepath)
  const bytes = file.size
  if (kind === "xlsx") return inspectXlsx(filepath, bytes)
  if (kind === "csv" || kind === "tsv") return inspectCsv(filepath, bytes, await file.text(), kind)
  if (kind === "docx") return inspectDocx(filepath, bytes)
  if (kind === "pptx") return inspectPptx(filepath, bytes)
  if (kind === "pdf") return inspectPdf(filepath, bytes)
  return fail(`Unsupported office type: ${kind || "unknown"} (${filepath})`)
}

async function inspectXlsx(filepath: string, bytes: number) {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(filepath)
  const sheets = workbook.worksheets.map((sheet) => {
    const header = rowValues(sheet, 1)
    return {
      name: sheet.name,
      rows: sheet.rowCount,
      columns: sheet.columnCount,
      header,
    }
  })
  return ok("Inspected spreadsheet", { path: filepath, kind: "xlsx", bytes, sheets })
}

async function inspectCsv(filepath: string, bytes: number, text: string, kind: "csv" | "tsv") {
  const delimiter = kind === "tsv" ? "\t" : ","
  const rows = parseCsv(text, delimiter)
  return ok(`Inspected ${kind}`, {
    path: filepath,
    kind,
    bytes,
    rows: rows.length,
    columns: rows[0]?.length ?? 0,
    header: rows[0] ?? [],
  })
}

async function inspectDocx(filepath: string, bytes: number) {
  const extracted = await mammoth.extractRawText({ path: filepath })
  const paragraphs = extracted.value.split(/\n+/).filter((line) => line.trim().length > 0)
  return ok("Inspected Word document", {
    path: filepath,
    kind: "docx",
    bytes,
    paragraphs: paragraphs.length,
    preview: paragraphs.slice(0, 3),
  })
}

async function inspectPptx(filepath: string, bytes: number) {
  const slides = await pptxSlides(filepath)
  return ok("Inspected presentation", {
    path: filepath,
    kind: "pptx",
    bytes,
    slides: slides.length,
    titles: slides.map((slide) => slide.title).filter((title) => title.length > 0),
  })
}

async function inspectPdf(filepath: string, bytes: number) {
  const doc = await PDFDocument.load(await Bun.file(filepath).arrayBuffer(), { ignoreEncryption: true })
  return ok("Inspected PDF", {
    path: filepath,
    kind: "pdf",
    bytes,
    pages: doc.getPageCount(),
    title: doc.getTitle() || undefined,
  })
}

async function readFile(input: { filepath: string; sheet?: string; range?: string; maxRows: number }) {
  const file = Bun.file(input.filepath)
  if (!(await file.exists())) return fail(`File not found: ${input.filepath}`)
  const kind = kindOf(input.filepath)
  if (kind === "xlsx") return readXlsx(input)
  if (kind === "csv" || kind === "tsv") return readCsv(await file.text(), input.maxRows, kind)
  if (kind === "docx") {
    const extracted = await mammoth.extractRawText({ path: input.filepath })
    return ok("Read Word document", { path: input.filepath, text: extracted.value.trim() })
  }
  if (kind === "pptx") {
    const slides = await pptxSlides(input.filepath)
    return ok("Read presentation", { path: input.filepath, slides })
  }
  if (kind === "pdf") return readPdf(input.filepath, input.maxRows)
  return fail(`Unsupported office type: ${kind}`)
}

async function readPdf(filepath: string, maxPages: number) {
  const bytes = new Uint8Array(await Bun.file(filepath).arrayBuffer())
  const pdf = await getDocumentProxy(bytes)
  const extracted = await extractText(pdf, { mergePages: false })
  const pages = (Array.isArray(extracted.text) ? extracted.text : [extracted.text]).map((text) => text.trim())
  const returned = pages.slice(0, maxPages)
  const nonempty = returned.filter((text) => text.length > 0).length
  return ok("Read PDF", {
    path: filepath,
    pages: extracted.totalPages,
    returned: returned.length,
    truncated: pages.length > returned.length,
    scanned: nonempty === 0 && extracted.totalPages > 0,
    text: returned,
  })
}

async function readXlsx(input: { filepath: string; sheet?: string; range?: string; maxRows: number }) {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(input.filepath)
  const sheet = input.sheet ? workbook.getWorksheet(input.sheet) : workbook.worksheets[0]
  if (!sheet) return fail(`Sheet not found: ${input.sheet ?? "(first)"}`)
  const bounds = input.range ? parseRange(input.range) : undefined
  const start = bounds?.startRow ?? 1
  const end = Math.min(sheet.rowCount, start + input.maxRows - 1, bounds?.endRow ?? Number.POSITIVE_INFINITY)
  const rows: string[][] = []
  for (let row = start; row <= end; row++) {
    const values = rowValues(sheet, row, bounds?.startCol, bounds?.endCol)
    rows.push(values)
  }
  return ok("Read spreadsheet", {
    path: input.filepath,
    sheet: sheet.name,
    rowCount: sheet.rowCount,
    returned: rows.length,
    truncated: end < (bounds?.endRow ?? sheet.rowCount),
    rows,
  })
}

function readCsv(text: string, maxRows: number, kind: "csv" | "tsv") {
  const all = parseCsv(text, kind === "tsv" ? "\t" : ",")
  const rows = all.slice(0, maxRows)
  return ok(`Read ${kind}`, {
    rowCount: all.length,
    returned: rows.length,
    truncated: all.length > rows.length,
    rows,
  })
}

async function writeFile(
  filepath: string,
  args: {
    format?: "xlsx" | "csv" | "tsv" | "docx" | "pptx"
    sheets?: unknown
    rows?: unknown
    paragraphs?: unknown
    title?: string
    slides?: unknown
  },
) {
  await mkdir(path.dirname(filepath), { recursive: true })
  if (path.extname(filepath).toLowerCase() === ".xlsm") {
    return fail("Cannot create .xlsm (macros/VBA). Write .xlsx instead.")
  }
  const kind = writeKind(filepath, args.format)
  if (kind === "xlsx") {
    const sheets = jsonArray(args.sheets, "sheets", officeSheets)
    if (sheets.length === 0) return fail('xlsx write requires sheets JSON, e.g. [{"name":"Sheet1","rows":[["A"]]}]')
    const workbook = new ExcelJS.Workbook()
    for (const [index, sheet] of sheets.entries()) {
      const ws = workbook.addWorksheet(sheet.name?.trim() || `Sheet${index + 1}`)
      for (const [r, row] of (sheet.rows ?? []).entries()) {
        for (const [c, value] of row.entries()) {
          ws.getCell(r + 1, c + 1).value = cellInput(value)
        }
      }
    }
    await workbook.xlsx.writeFile(filepath)
    return ok("Wrote spreadsheet", { path: filepath, sheets: sheets.length })
  }
  if (kind === "csv" || kind === "tsv") {
    const rows = jsonArray(args.rows, "rows", officeRows)
    const delimiter = kind === "tsv" ? "\t" : ","
    const text = rows.map((row) => row.map((value) => csvEscape(value, delimiter)).join(delimiter)).join("\n") + (rows.length ? "\n" : "")
    await Bun.write(filepath, text)
    return ok(`Wrote ${kind}`, { path: filepath, rows: rows.length })
  }
  if (kind === "docx") {
    const paragraphs = jsonArray(args.paragraphs, "paragraphs", officeParagraphs)
    if (paragraphs.length === 0) return fail("docx write requires paragraphs JSON array of strings")
    const children = paragraphs.map((text, index) => {
      if (index === 0 && paragraphs.length > 1) {
        return new Paragraph({ text, heading: HeadingLevel.HEADING_1 })
      }
      return new Paragraph({ text })
    })
    const buffer = await Packer.toBuffer(new Document({ sections: [{ children }] }))
    await Bun.write(filepath, buffer)
    return ok("Wrote Word document", { path: filepath, paragraphs: paragraphs.length })
  }
  if (kind === "pptx") {
    const slides = jsonArray(args.slides, "slides", officeSlides)
    if (!args.title && slides.length === 0) {
      return fail('pptx write requires title and/or slides JSON, e.g. [{"title":"Agenda","bullets":["One"]}]')
    }
    const deck = new PptxGenJS()
    if (args.title) {
      const titleSlide = deck.addSlide()
      titleSlide.addText(args.title, { x: 0.5, y: 2.2, w: 9, h: 1.2, fontSize: 32, bold: true })
    }
    for (const slide of slides) {
      const page = deck.addSlide()
      page.addText(slide.title || "Slide", { x: 0.5, y: 0.4, w: 9, h: 0.6, fontSize: 22, bold: true })
      if (slide.bullets?.length) {
        page.addText(
          slide.bullets.map((line) => ({ text: line, options: { bullet: true, breakLine: true } })),
          { x: 0.6, y: 1.2, w: 8.8, h: 4.5, fontSize: 16 },
        )
      }
    }
    await deck.writeFile({ fileName: filepath })
    return ok("Wrote presentation", { path: filepath, slides: slides.length + (args.title ? 1 : 0) })
  }
  return fail(`Cannot write this office type: ${kind}. Use xlsx, csv, tsv, docx, or pptx.`)
}

async function pptxSlides(filepath: string) {
  const zip = await JSZip.loadAsync(await Bun.file(filepath).arrayBuffer())
  const names = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
    .toSorted((a, b) => slideIndex(a) - slideIndex(b))
  const slides: { title: string; text: string }[] = []
  for (const name of names) {
    const xml = await zip.files[name].async("string")
    const texts = [...xml.matchAll(/<a:t[^>]*>([^<]*)<\/a:t>/g)].map((match) => decodeXml(match[1])).filter(Boolean)
    slides.push({ title: texts[0] ?? "", text: texts.join("\n") })
  }
  return slides
}

function slideIndex(name: string) {
  const match = name.match(/slide(\d+)\.xml$/i)
  return match ? Number(match[1]) : 0
}

function rowValues(sheet: ExcelJS.Worksheet, rowNumber: number, startCol?: number, endCol?: number) {
  const row = sheet.getRow(rowNumber)
  const last = endCol ?? Math.max(sheet.columnCount, row.cellCount, 1)
  const first = startCol ?? 1
  const values: string[] = []
  for (let col = first; col <= last; col++) {
    values.push(cellText(row.getCell(col).value))
  }
  return values
}

function cellText(value: ExcelJS.CellValue): string {
  if (value == null) return ""
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value)
  if (value instanceof Date) return value.toISOString()
  if (typeof value === "object" && "richText" in value) {
    return value.richText.map((part) => part.text).join("")
  }
  if (typeof value === "object" && "text" in value && typeof value.text === "string") return value.text
  if (typeof value === "object" && "formula" in value) {
    const formula = value.formula
    if (typeof formula === "string") return `=${formula}`
  }
  if (typeof value === "object" && "result" in value) return cellText(value.result)
  return String(value)
}

function cellInput(value: unknown): ExcelJS.CellValue {
  if (value == null) return null
  if (typeof value === "number" || typeof value === "boolean") return value
  if (typeof value === "string" && value.startsWith("=") && value.length > 1) {
    return { formula: value.slice(1) }
  }
  return String(value)
}

function parseRange(range: string) {
  const match = range.trim().toUpperCase().match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/)
  if (!match) return
  return {
    startCol: colNumber(match[1]),
    startRow: Number(match[2]),
    endCol: colNumber(match[3]),
    endRow: Number(match[4]),
  }
}

function colNumber(letters: string) {
  let n = 0
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64)
  return n
}

function jsonArray<T>(
  raw: unknown,
  name: string,
  schema: { safeParse(input: unknown): { success: true; data: T[] } | { success: false } },
) {
  if (raw == null || raw === "") return []
  const parsed: unknown = typeof raw === "string" ? JSON.parse(raw) : raw
  const result = schema.safeParse(parsed)
  if (!result.success) throw new Error(`${name} must be a valid JSON array`)
  return result.data
}

function csvEscape(value: unknown, delimiter = ",") {
  const text = value == null ? "" : String(value)
  if (text.includes('"') || text.includes("\n") || text.includes("\r") || text.includes(delimiter)) {
    return `"${text.replaceAll('"', '""')}"`
  }
  return text
}

function decodeXml(value: string) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
}

async function run(work: () => Promise<ToolResult>): Promise<ToolResult> {
  return work().catch((error) => fail(error instanceof Error ? error.message : String(error)))
}

function ok(title: string, payload: unknown): ToolResult {
  return { title, output: JSON.stringify(payload, null, 2) }
}

function fail(message: string): ToolResult {
  return { title: "Office tool error", output: message }
}
