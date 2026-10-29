# Deep Library — Design (Piece 11)

Date: 2026-10-29
Status: decided by Claude under Adam's "run straight through" instruction; Adam can redirect at any time

## 1. Data source (ruling)

The roadmap asked for "a licensed data source". Offline and without a licence agreement, the species data is
taken from the **USDA Forest Products Laboratory *Wood Handbook* (FPL-GTR-282, 2021)** — a US government
work in the public domain — for density, Janka hardness, shrinkage (tangential/radial) and strength, plus
widely published facts (uses, workability, toxicity/allergen notes in our own words, with "see a doctor"
cautions). Prices are typical US retail ranges, marked as estimates, editable by the user. Each species page
cites the Handbook table it came from.

## 2. Contents (Master Shop → Library; kids get short summaries on their wood pages)

- **Species** (~60 common North American and imported woods): name, other names, density (lb/ft³ at 12%),
  Janka (lbf), shrinkage T/R %, workability notes, finishing notes, uses, toxicity/allergen warning, typical
  price per board foot, colour swatch. Search and filter (hardness, price, outdoor use, food-safe). The wood
  library gets a **species** picker so a wood (e.g. "Hardwood 4/4") can be set to Red oak; weight (3C) and
  rendering (8) use the species.
- **Wood movement calculator:** width × shrinkage coefficient × moisture change (e.g. 6% → 12%) for flat-sawn
  or quartersawn; result in inches. **Cross-grain warning** in the designer: a solid-wood part glued or
  rigidly joined (dado with glue, butt glued) cross-grain to another solid part wider than 3" gets a warning
  "Breadboard/cross-grain: Top will move ~3/16" across its width; use buttons or slots" linking to the page.
  Plywood/MDF parts are exempt.
- **Shelf sag calculator:** span, depth, thickness, material (E from the Handbook), load (lb/ft) with
  presets (books 20 lb/ft); deflection by the uniform-load beam formula, ends simply supported (dado
  conservative); result with a pass/fail at 1/32" per foot of span (the common "sagulator" limit). **Sag
  warning** on shelves in the designer (horizontal parts spanning between two supports > 24", using books
  load) linking to the calculator with that shelf's values.
- **Glues:** PVA (I, II, III), hide glue (hot and liquid), polyurethane, epoxy (5-min and slow), CA, contact
  cement: open time, clamp time, full cure, water resistance, gap filling, clean-up, best for.
- **Techniques, sharpening, adult safety** (kickback, dust, hearing, push sticks, blade guards), **lumber
  grades** (FAS, Select, #1 Common, #2 Common; softwood grades), **nominal vs actual sizes** table,
  **drill-press speeds** table (by bit type/diameter and material), **glossary** (~150 terms, linked from
  text across the app).

## 3. Testing

Unit: data integrity (every species has the required fields; Janka/density ranges); movement formula against
Handbook worked examples; sag formula against hand calculation; cross-grain and sag warning triggers on
small designs (and not on plywood); glossary links resolve. UI: search/filter, calculators. E2E: open a
species page; a 36" pine shelf shows the sag warning; the calculator opens with its values.
