---
name: xlsx
description: "Use this skill whenever a spreadsheet is the main input or output — .xlsx, .xlsm, .csv, or .tsv. Trigger for creating, editing, cleaning, charting, converting, or analyzing tabular files, including casual mentions of an xlsx path. Do not use when the deliverable is a Word doc, PDF, HTML report, or a standalone Python pipeline."
---

# Spreadsheets

Prefer Chimera native tools. They run in-process (no Python, pandas, or LibreOffice):

| Task | Tool |
|---|---|
| Structure (sheets, headers, size) | `office_inspect` |
| Values from a sheet or range | `office_read` |
| Create/overwrite xlsx, csv, or tsv | `office_write` |

Load this skill before doing spreadsheet work so the constraints below stay in context.

## Rules

- Deliver a spreadsheet file, not a throwaway script, unless the user asked for a script.
- `office_write` **overwrites** the whole file. It cannot patch an existing workbook in place (no new columns on a live sheet, no preserved charts). For a true edit, read first, then write a replacement, or unzip/`exceljs` only for that step.
- Use Excel formulas in cells (`=SUM(B2:B9)`), not Python-computed totals, when the sheet must recalculate later.
- Do not dump an entire large workbook into the conversation. Inspect first, then read a bounded range (`max_rows`).
- When replacing a file, match its headers, sheet names, number formats, and formula style. Do not redesign it.
- CSV is comma-separated; TSV is tab-separated. Use xlsx when the user needs multiple sheets, formulas, or formatting.
- Never save a workbook that was opened in "values only" mode — that permanently replaces formulas with literals.
- Merged cells: write the top-left cell only.
- Recalculation: native tools store formulas but do not evaluate them. Tell the user to open the file in Excel or WPS to compute.
- `.xlsm` can be inspected/read; do not create a new `.xlsm` (macros). Write `.xlsx` instead.
- exceljs is already bundled in Chimera. Do not `npm install` it into the user's project.

## `office_write` payload

Path extension selects the format (`out.xlsx` / `out.csv` / `out.tsv`). There is no required `format` field.

- **xlsx:** `sheets` = `[{ "name": "Sheet1", "rows": [["A", "B"], [1, 2]] }]`
- **csv/tsv:** `rows` = `[["A", "B"], [1, 2]]`
- Strings starting with `=` become formulas.

## Fallback

If native tools cannot do a step (pivot tables, charts, macros, `.xlsm` VBA), write a short script **only for that step**. Check that Python/`openpyxl` exists before relying on it. Do not `pip install` unless the import failed.
