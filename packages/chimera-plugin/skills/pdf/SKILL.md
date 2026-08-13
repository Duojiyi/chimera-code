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

`office_write` does **not** create PDFs. For generation, merging, forms, or OCR, use a short Python (`pypdf`) or Node script only if those tools are already available.

## Rules

- Inspect before extracting a long PDF. `office_read` returns an array of page strings and sets `scanned: true` when every returned page is empty (typical of image-only scans).
- Do not dump a 100-page extract into the conversation. Read, then summarize, or write extracts to a file with the write tool.
- Scanned PDFs need OCR; say so instead of inventing content.
- Filling official forms is error-prone; prefer the user's original form file and a dedicated form library over recreating pages.

## Fallback

Merge/split/forms (only if `pypdf` imports):

```python
from pypdf import PdfReader
reader = PdfReader("document.pdf")
text = "\n".join(page.extract_text() or "" for page in reader.pages)
```

Only `pip install pypdf` if the import fails.
