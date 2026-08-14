---
name: pdf
description: "Use this skill for PDF files: extract text, inspect page count, merge/split, or create a simple PDF. Trigger on any .pdf path or a request whose deliverable is a PDF. Do not use for Word or spreadsheets unless converting to PDF."
---

# PDFs

Prefer Chimera native tools for inspection and text extraction:

| Task | Tool |
|---|---|
| Page count / size | `office_inspect` |
| Extract text (per page) | `office_read` (`max_rows` = max pages) |

`office_write` does **not** create PDFs. Chimera already bundles `pdf-lib` (write/merge/split) and `unpdf` (text extract). For generation, merging, or forms, write a short **Node/bun** script that imports those packages — do not `npm install` them into the user's project. Use Python `pypdf` only if Node is unavailable.

## Rules

- Inspect before extracting a long PDF. `office_read` returns an array of page strings and sets `scanned: true` when every returned page is empty (typical of image-only scans).
- Do not dump a 100-page extract into the conversation. Read, then summarize, or write extracts to a file with the write tool.
- Scanned PDFs need OCR; say so instead of inventing content.
- Filling official forms is error-prone; prefer the user's original form file and a dedicated form library over recreating pages.

## Fallback

Simple new PDF with the bundled `pdf-lib` (do not `npm install`):

```js
import { PDFDocument, StandardFonts } from "pdf-lib"
const doc = await PDFDocument.create()
const page = doc.addPage()
const font = await doc.embedFont(StandardFonts.Helvetica)
page.drawText("Hello", { x: 48, y: 720, size: 18, font })
await Bun.write("out.pdf", await doc.save())
```

OCR is not bundled. Scanned pages stay empty until the user provides an OCR tool.
