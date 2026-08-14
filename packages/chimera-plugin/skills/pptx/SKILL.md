---
name: pptx
description: "Use this skill for quick .pptx inspect/read, or a simple title-and-bullets deck via office_write. For designed decks, reconstruction, template fill, beautify, or native-shape PPTX, load ppt-master instead."
---

# Presentations

## Quick path (no Python)

Prefer Chimera native tools for inspect/read and throwaway decks:

| Task | Tool |
|---|---|
| Slide count / titles | `office_inspect` |
| Extract slide text | `office_read` |
| Simple new deck | `office_write` |

`office_write` **overwrites** a new title + bullets deck. Path extension selects the format (`out.pptx`). It does not preserve a company template and will look generic.

## Designed decks

Load the **ppt-master** skill (MIT, bundled). It authors native shapes from SVG, can fill an existing `.pptx` template, and beautify a finished deck.

ppt-master scripts are Python. Run them through the bash tool from the skill directory printed when the skill loads:

- Windows: `python scripts/attribution_guard.py` (if `python3` is missing, use `python`)
- First conversion (`svg_to_pptx` and friends): `python -m pip install -r requirements.txt`

Chimera does not ship CPython. If `python` / `python3` is not on PATH, tell the user to install Python 3.10+ rather than inventing a Node rewrite of ppt-master.

## `office_write` payload

`slides` is a **JSON string**:

```
path: out.pptx
title: Q3 Review
slides: "[{\"title\":\"Agenda\",\"bullets\":[\"Results\",\"Risks\",\"Next steps\"]}]"
```

After writing, `office_inspect` and confirm slide count and titles.
