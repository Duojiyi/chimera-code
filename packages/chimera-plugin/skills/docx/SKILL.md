---
name: docx
description: "Use this skill to create, read, or edit Word documents (.docx, .dotx). Trigger for reports, memos, letters, templates, tracked changes, comments, or any request whose deliverable is a Word file. Do not use for PDF, spreadsheets, or Google Docs."
---

# Word documents

Prefer Chimera native tools:

| Task | Tool |
|---|---|
| Confirm it is a Word file | `office_inspect` |
| Extract plain text | `office_read` |
| Create a new .docx from paragraphs | `office_write` |

Load this skill before Word work.

## Rules

- Deliver a `.docx` file when that is what the user asked for.
- `office_write` **overwrites** a new document from a paragraph list. The first paragraph becomes a heading when there are two or more paragraphs. It does not create real numbered lists, headers, comments, or tracked changes, and it does not round-trip a complex existing layout.
- Path extension selects the format (`out.docx`). Do not pass a `format` field.
- To edit a complex existing .docx, unpack it (`unzip` / `Expand-Archive`), change `word/document.xml`, and zip it back. Preserve `[Content_Types].xml` and `_rels`.
- Never put literal `\n` inside a single paragraph; use separate paragraphs.
- Page size: default to the user's locale if known; otherwise A4 is acceptable unless they asked for US Letter.
- After writing, `office_read` the output and check that headings and body survived.
- The `docx` npm package is already bundled. Do not `npm install` it into the user's project.

## `office_write` payload

`sheets`, `rows`, `paragraphs`, and `slides` are **JSON strings** (the tool schema is string). Do not pass a raw array.

```
path: out.docx
paragraphs: "[\"Title\", \"Body paragraph\"]"
```

## Fallback

If native create/read is not enough (images, TOC, comments), use the bundled `docx` package for **new** files, or XML edit for **existing** files.
