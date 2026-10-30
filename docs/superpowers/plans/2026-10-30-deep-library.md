# Piece 11 — Deep Library (plan, as built)

Spec: docs/superpowers/specs/2026-10-29-deep-library-design.md

- `src/library/species.ts` — 60 species (49 North American from the Wood Handbook FPL-GTR-282 ch. 4–5; 11 imported with typical published figures): density, Janka, shrinkage T/R, MOE, Handbook movement coefficients where listed, colour, working/finishing/uses notes, health cautions, price ranges (estimates), outdoor and food flags; `findSpecies` by name or other name; sheet-goods stiffness.
- `calc.ts` — movement (width × coefficient × moisture change, capped at fibre saturation; coefficients estimated from shrinkage ÷ 26.5 when the Handbook table isn't on file), sag (5wL⁴/384EI, simply supported), load presets, limit 0.02" per foot of span (the common "sagulator" rule — the spec said 1/32"; 0.02" is the standard figure), stiffness of a design wood.
- `advice.ts` — designer warnings: cross-grain (both parts solid wood, rigid joint, one part's width axis along the other's length, overlap > 3", seasonal movement 6→12% ≥ 3/16"); sag (horizontal part > 24" joined to two upright supports, books 20 lb/ft). Each carries a link to the calculator with its values. Hidden in kids mode.
- `reference.ts`, `glossary.ts` — glues (11), techniques/sharpening/safety articles, hardwood and softwood grades, nominal sizes, drill-press speeds, 148 glossary terms.
- Weight (3C) now uses the species density; the wood library gets a species list for new stock and a species picker on the built-in woods.
- UI: Library screen (toolbar "Library"): Species (search, hardness/price/outdoor/food filters, page with source note), Wood movement, Shelf sag, Glues, Techniques & safety, Grades & sizes, Drill speeds, Glossary. Warnings get "Shelf sag calculator →" / "Wood movement →".
- Kids: summary cards on oak, pine and poplar pages; new cedar, maple and walnut pages.
- Tests: tests/library/library.test.ts, ui.test.tsx; tests/e2e/library.spec.ts.
