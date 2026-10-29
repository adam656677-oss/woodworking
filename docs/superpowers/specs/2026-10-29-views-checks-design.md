# Views & Checks — Design (Piece 3C)

Date: 2026-10-29
Status: decided by Claude under Adam's "run straight through" instruction; Adam can redirect at any time
Builds on: 1, 7A/7B, 3A, 3B

## 1. Purpose

See inside and around a design and catch mistakes before cutting: pull it apart (exploded view), slice it
(section view), find parts that run into each other (interference), know what it weighs and where it
balances, and leave dimensions and notes on the model.

**Success:** a bookshelf explodes so every shelf and dado shows; a section through the middle shows the
dados; a shelf moved 1/8" into a side is listed as an interference with its volume; the bookshelf shows
its weight (lb) and a centre-of-mass marker; a kept dimension from the top to the floor stays on the
model and in the saved file.

## 2. Exploded view (View menu → Explode, slider 0–100%)

- Display only; the design doesn't change, the cut list and checks don't move.
- Each top-level group moves out from the design's centre as a unit; parts inside a group (and loose
  parts) move out from their group's centre (or the design's). At 100% each offset equals the distance
  from the centre, so parts clear each other in most furniture.
- Selecting and the move arrows are off while exploded (a note says why); the explode amount is kept per
  project while the app is open.

## 3. Section view (View → Section, axis X/Y/Z, position slider, flip)

- A cutting plane through the 3D view; the cut faces show solid (a cap colour), so dados and joints read
  clearly. Display only. Typing a position is allowed (inches from the design's low side).

## 4. Interference check (Checks → Interference)

- Exact for every part: shaped parts, turned legs, tapers, joint cuts, holes and profiles. Pairs whose
  boxes overlap are intersected as solids; any pair sharing more than 0.0005 cu in is listed with its
  volume ("Shelf and Side run into each other — 0.42 cu in"); a joint's intended fit (a shelf in its dado)
  doesn't count because the groove is cut out of the host.
- On demand (a button), not on every edit; results clear when the design changes. Clicking a result
  selects both parts.

## 5. Weight & centre of mass (Checks → Weight)

- Volume from each part's finished solid; density from its wood's species (lb/ft³, air-dry at 12% moisture):
  Pine 28, Poplar 29, Red oak 44, White oak 47, Oak 45, Hard maple 44, Maple 40, Cherry 35, Walnut 38,
  Cedar 23, Ash 41, Birch 43, Hickory 50, Mahogany 34, Douglas fir 33, Fir 30, Spruce 27, Basswood 26,
  Teak 41, Hardwood 42, Plywood 34, MDF 47; others 35 (marked "estimated"). The Deep Library (Piece 11)
  will replace this table with its species data.
- Shows total weight, each part's weight, and a centre-of-mass marker in 3D (with its X/Y/Z). A tipping hint:
  "Centre of mass is high — 70% of the height; anchor tall pieces to the wall" when the centre of mass is
  above 60% of the height and the design is more than twice as tall as it is deep.

## 6. Dimensions and notes on the model

- `Project.annotations?: Annotation[]` (project format 6):
  - `{ id, kind: 'dimension', a: Vec3, b: Vec3 }` — a kept measurement; drawn as a line with its length.
  - `{ id, kind: 'note', at: Vec3, text }` — a note pinned at a point.
- Measure → after picking two points, **Keep** saves it as a dimension. **Add note** then click the model to
  pin a note (text asked in a small box). The Notes list (Checks → Notes & dimensions) lists, renames and
  deletes them; **Show dimensions** toggles them in 3D. Each change is one undo step.
- **Overall size** toggle: the design's (or the selected group's) width × depth × height drawn on its box.
- Points are stored in world inches; they don't follow parts that move (a stale dimension still shows its
  stored length — ruling: simple and predictable; Piece 5 shop drawings auto-dimension parts).

## 7. Testing

Unit: explode offsets (groups as units, 0% = none); section plane maths; interference volumes (overlap,
touching only, dado fit, rotated and turned parts); weights and centre of mass against hand values;
annotations add/rename/delete, file round-trip, v5 → v6. UI: menus and panels. E2E: bookshelf explode
and section screenshots; a moved shelf found by the interference check; weight panel; keep a dimension,
save, reopen.
