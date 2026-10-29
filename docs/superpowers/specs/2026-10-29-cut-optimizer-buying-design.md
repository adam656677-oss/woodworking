# Cut Optimizer & Buying — Design (Piece 4, with edge banding)

Date: 2026-10-29
Status: decided by Claude under Adam's "run straight through" instruction; Adam can redirect at any time

## 1. Purpose

Turn the cut list into what to buy and how to cut it: sheet layouts and board layouts with kerf, trim and grain;
fewer fence changes; use offcuts already in the shop; a shopping list with full cost; printable part labels.
Edge banding (deferred from 7B) lands here because it is bought and costed like stock.

## 2. Settings (per material, saved with the project; defaults in brackets)

- Kerf [1/8"], edge trim per side [sheets 1/4", lumber 0, hardwood 1/2"], end trim per board [lumber 1/2",
  hardwood 1"], extra length allowance per part [0].
- Grain lock: parts with grain (all lumber/hardwood parts; sheet parts with `grain` set — ply has grain, MDF
  doesn't) keep their length along the stock's length. Grain matching: parts in a group may be asked to
  come from the same sheet/board ("Cut from one sheet" on a group).

## 3. Layouts (Cut List window → Layout tab)

### 3.1 Sheets (guillotine, panel-saw style)
- Parts (with kerf) are packed on sheets with a **guillotine strip** method: rip strips across the sheet
  width, crosscut parts from strips. Strips are formed from parts of the same width first (one fence setting
  per strip width — "fewer fence changes"), then the rest by first-fit decreasing height with best-fit
  strip choice. Several orderings are tried and the layout with fewest sheets, then least waste, then fewest
  distinct rip widths wins.
- Shown as drawings: each sheet with parts labelled (part number, name, size), offcuts hatched with their
  sizes, cut order numbered (1. rip at 23-3/4", 2. …). Sheet count, yield %.

### 3.2 Boards (dimensional lumber and hardwood)
- **Dimensional lumber** (1x4…): parts as wide as the stock are crosscut; narrower parts are ripped from
  stock (one rip per part width, strips planned like sheets in 1D). Lengths bought from the available lengths
  (8', 10', 12') choosing the mix that leaves least waste (first-fit decreasing then improvement).
- **Hardwood (rough)**: bought by the board foot. Plan with **random-width boards** of a chosen typical
  width (6") and length (8') as an estimate, or with **your actual boards** from the stock list (below),
  including marked **defects** (knots, checks, sapwood: a length range on a board, avoided by the layout).

### 3.3 Offcuts & stock on hand
- A shop stock list (shared across projects, kept in the app's data folder): sheets, offcuts and boards with
  size, material, and defects. "Use my offcuts first" places parts on them before new stock; the layout marks
  which stock pieces get used; **Mark as used** removes or shrinks them after cutting. (Piece 13's inventory
  will take this list over.)

## 4. Edge banding

- Per part (sheet goods): choose banded edges (left/right/start/end) and the banding (built-in: 3/4"
  birch/oak/maple/white PVC 0.5 mm and wood 1/32"). Thickness ≥ 1/32" reduces the part's cut size on banded
  edges ("cut size" column in the cut list; finished size stays). Shown in 3D as a thin coloured edge.
- Cut list notes "Band front edge (birch)"; linear feet per banding + 10% in the shopping list.

## 5. Shopping list (Cut List window → Buy tab; printable)

- Sheets by material (count, price each, total); lumber by size and length (count, price each); hardwood board
  feet by species/thickness (+ waste factor 20%, editable); edge banding linear feet; hardware (Piece 6);
  finishes (Piece 12, when added). Prices from the wood library (`pricePerSheet`, `pricePerBoardFoot`, new
  `pricePerPiece` by length for lumber) and hardware items; missing prices shown as "—" and left out of the
  total with a note.
- Total cost with a breakdown (wood, hardware, finish, banding) and an optional "+ tax %".

## 6. Labels

- Part numbers P1…Pn in cut-list order (stable while the cut list doesn't change).
- **Print labels**: Avery 5160 (30 per sheet, 2-5/8" × 1") or 5163 (10 per sheet, 4" × 2"): project name,
  part number and name, finished size, wood, grain arrow, edge banding marks, and a **QR code** encoding
  `AAWS|<project name>|P7|Shelf|23-3/4 x 9-1/4 x 3/4`. QR generated offline (built-in encoder).

## 7. Testing

Unit: guillotine packing (fits, kerf, trim, grain lock, fewer-fence-change ordering; known small cases with
known optimal sheet counts); 1D lumber (rip + crosscut, length choice); defects avoided; offcut use; banding
cut-size maths; shopping list totals; QR encoder against reference vectors; label page geometry. E2E:
bookshelf → Layout shows 2 sheets of 3/4 ply with numbered cuts; Buy tab total; print labels to PDF.
