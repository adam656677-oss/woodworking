# Shop Drawings & Printing — Design (Piece 5)

Date: 2026-10-29
Status: decided by Claude under Adam's "run straight through" instruction; Adam can redirect at any time

## 1. Purpose

Print what you need at the bench: dimensioned views of the whole piece and each part, an exploded view
with part numbers, sections, full-size templates, and one plan packet that has it all (a kids' version too).

## 2. Drawings (Drawings window, from the toolbar "Drawings")

- **Views:** front, side, top (orthographic, hidden lines dashed), an isometric, an exploded isometric with
  balloons (part numbers matching the cut list), and sections (any of the 3C section planes). Drawn as vector
  line work from the part solids (edges of the finished shapes, silhouette and feature edges, hidden-line
  removal by depth testing against the solids).
- **Auto-dimensions:** overall W/D/H on the main views; for each part view: length, width, thickness, hole
  and groove positions (from the nearest reference edge), angles on mitred/bevelled ends; chain dimensions
  for shelf spacing (equal-spacing rules shown as "4 eq. sp."). Fractions to 1/32" (rounded with ≈ when not
  exact). Kept 3C dimensions and notes appear too.
- **Part sheets:** one per unique part (grouped like the cut list) with its three views, all features, the
  quantity, wood, grain arrow, edge banding and part number.
- **Title block:** project name, sheet title, scale (picked to fit: 1:1, 1:2, 1:4, 1:8, 1:12, 1:16), date,
  "A&A Woodworking Studio", page n of m.
- Paper: Letter (default) or Tabloid/Ledger, portrait/landscape automatic per sheet.

## 3. Full-size templates (1:1)

- For shaped parts, turnings (profile), tapers (the taper line on the face) and any part chosen: the outline
  at true size **tiled across letter pages** with 1/2" overlap, crop marks, page labels (A1, A2, B1…), an
  assembly map on the first page, and a **1" and 5 cm test square** on every page to check the printer
  didn't scale. The kids' "print my shape full size" uses the same.

## 4. Plan packet (Print ▾ → Plan packet)

- Cover (name, 3D picture, overall size, difficulty and time if a plan exists), materials and tools,
  shopping list (Piece 4), cut list with part numbers, sheet/board layouts (Piece 4), drawings (front/side/top,
  exploded), part sheets, step-by-step build guide (My Plans steps or Shop Mode's generated steps),
  finishing schedule (Piece 12, when present), hardware list, notes. Each section can be ticked on/off.
- **Kids' packet:** big type, the kid project sheet layout (difficulty stars, time, tools with "Adult does
  this", check boxes, finished-photo spot, time and cost tracking), simplified drawings (overall size and
  each part's size only), the cut list and full-size templates.
- Output: printed through the system print dialog, or **Save as PDF** (Electron printToPDF) — vector.

## 5. Testing

Unit: projection and hidden-line maths on boxes; dimension placement and values for template designs;
scale choice; tiling (page count, overlap, labels) for a known outline; packet section selection. Visual: PDF
rendering of a bookshelf packet compared by screenshots (page images) in review. E2E: open Drawings, switch
views, save a packet PDF (file exists, page count), print tiles of a shaped part.
