# Piece 5 — Shop drawings & printing (plan, as built)

Spec: docs/superpowers/specs/2026-10-29-shop-drawings-printing-design.md

## Modules (src/drawings/)
1. `lines.ts` — `viewLines(p, view, opts)`: each part's feature edges (open edges that are only T-junction seams in a flat face are dropped), split into visible and hidden runs by BVH ray tests toward the viewer every 1/4". Options: ids, exploded offsets, hidden on/off, `local` (part's own coordinates), `clip` (section: CSG cut, cut-face triangles returned in `cut` for shading), shared `solids`.
2. `sheet.ts` — SVG in inches: papers (Letter/Tabloid landscape), scales 1:1…1:16 with `fitScale`, title block, dimensions with architectural ticks (short dims put the text beside), `chain` (rounded positions so a chain adds up; ≥3 evenly spaced within 1/64" → "N × s = total (eq. sp.)", 32 mm system shown in mm), balloons, leaders, tables.
3. `views.ts` — sheets: front/top/right side in third-angle with overall sizes, section cutting-plane line A–A and a picture; exploded view with one balloon per part number + parts table; Section A–A (side, cut through the middle, cut faces shaded); part sheets (face + edge views in the part's coordinates, hole chains from the left end and bottom edge or a hole table when many, groove positions, overall sizes, notes column with cut size, grain, joint notes); cover sheet; `pictureSvg` for kids; `drawingSheets` numbers "n of N".
4. `tiles.ts` — full-size templates: part face at 1:1 on portrait letter pages (0.3" unprintable margin, 1/2" overlap), registration ⊕ marks in the overlaps, crop marks, dashed overlap edges, A1… page names, cover page with 1" and 5 cm test squares, instructions and page map.
5. `ui/DrawingsDialog.tsx` — Toolbar "Drawings" (kids: "Print my plan"). Tabs Views / Part sheets / Templates (shaped parts pre-picked) / Plan packet (cover, views, part sheets, cut list, shopping list, steps, templates). Paper, scale, hidden-line options. Kids mode: the kids' packet (big picture, pieces, steps with tick boxes). Rendered in a portal; printing shows only it, each page on its own named @page (sheet-letter, sheet-tabloid, portrait-letter, flow).
6. Electron `aa:savePdf` — save dialog + `printToPDF({ preferCSSPageSize, printBackground })`.

## Tests
- tests/drawings/lines.test.ts, sheets.test.ts, tiles.test.ts, ui.test.tsx (kids packet).
- tests/e2e/drawings.spec.ts: views, part sheets, a template, the plan packet; saves a PDF and checks it has landscape and portrait pages.
