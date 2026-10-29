# Views & Checks (Piece 3C) — Plan

Spec: docs/superpowers/specs/2026-10-29-views-checks-design.md

1. Pure: src/checks/explode.ts (offsets, designBox), density.ts (species table), solids.ts (local solids, world volume/centroid, weigh with tipping hint, interferences by CSG intersection), annotations.ts (add/edit/remove dimensions and notes).
2. Model: Annotation type, Project.annotations, format 6 with migration and checks.
3. Store: explode, section, showDims, overallSize, checksOpen, placingNote, pendingNote; setView, finishNote; reset per project.
4. 3D: BoardMesh offset and clipping (back-face cap); Scene explode/section/notes placement/Keep measure; Annotations3D (dimensions, notes, overall size, centre-of-mass marker).
5. UI: ViewTools strip; Checks menu; ChecksPanel (Interference, Weight & balance, Dimensions & notes).
6. Tests: unit, jsdom UI, e2e (explode/section/weight/interference; keep a dimension and a note across save/reopen) and screenshots.
