# Drawing Board & Shaped Parts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A 2D drawing board (precise CAD mode with dimensions and constraints; freehand mode for kids) whose closed outlines become shaped boards, printable full size and exportable as DXF/SVG.

**Architecture:** Pure sketch model and geometry in `src/sketch/` (types, loops, tessellation, smoothing, tiling, DXF/SVG). The planegcs WASM solver is wrapped in `src/sketch/solver.ts`. Boards gain an optional `outline`; the cut list, validation and 3D mesh read it. The drawing board UI lives in `src/sketch/ui/` with its own zustand store, and hands results to the studio store.

**Tech Stack:** TypeScript strict, React 18, zustand, three (ExtrudeGeometry, three-bvh-csg), `@salusoft89/planegcs` 1.3.0 (WASM), Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-28-drawing-board-shaped-parts-design.md`

## Global Constraints

- Inches only; stored to 1/64" (`snap64`), shown to 1/32" (`formatInches`). Freehand Size rounds to 1/8".
- Project file format version 2 with `sketches: Sketch[]`; v1 files migrate by adding `sketches: []`.
- Solver: planegcs, each solve limited (max iterations set so a solve stays under 250 ms on the test fixture); failure or conflict keeps the last good geometry.
- Colours: blue = free (dof > 0), black = fully constrained (dof = 0), red = conflicting constraint ids.
- Freehand: RDP tolerance 1/16"; line/arc fit tolerance 1/32"; closes when ends are within 1/4".
- Full-size print: 1 in = 96 CSS px, letter portrait, 0.5" margins, printable 7.5" × 10", 0.5" overlap, pages A1/B1/A2…, 1" check square on every page.
- DXF R12 ASCII, `$INSUNITS` 1, layers OUTLINE / CUTOUTS / TEXT, splines as POLYLINE every 1/16"; SVG in `in` with true arcs.
- Shaped board cut-list note: `Shaped — cut to pattern (print full size)`.

## Review Focus

1. A sketch with no closed loop (or only open lines) must not become a part and must say where the gap is — Task 2.
2. Editing a dimension to a value that makes the sketch impossible must leave the drawing as it was and show the conflict, never hang — Task 3.
3. A v1 project file must open and re-save without losing anything — Task 1.
4. A freehand stroke that is a single click (one point) or two points must not crash smoothing — Task 4.
5. A shaped board joined with a dado must still cut the dado in 3D and keep the Shaped note in the cut list — Task 5.

---

### Task 1: Sketch model and file format v2
**Files:** Create `src/sketch/types.ts`; Modify `src/model/types.ts` (`Board.outline?`, `Project.sketches?`), `src/model/fileFormat.ts` (version 2, migration 1→2, sketch/outline checks), `src/model/woods.ts` (`emptyProject` adds `sketches: []`); Test `tests/sketch/fileFormat.test.ts`.
**Produces:** `Sketch`, `SketchPoint`, `SketchEntity` (`line|arc|circle|spline|text`), `SketchConstraint` (`kind`: `horizontal|vertical|perpendicular|parallel|equal|tangent|concentric|coincident|fixed|symmetric|distance|hdistance|vdistance|radius|diameter|angle`, `refs: string[]`, `value?`), `Outline = { sketchId: string; outer: string[]; holes: string[][]; circles: string[] }`, `newSketch(name, mode)`.
- [ ] Tests: v1 file → loads with `sketches: []`, `formatVersion: 2`; a v2 file with a sketch and a board outline round-trips; a damaged sketch (point with NaN, entity referencing a missing point, outline referencing a missing entity) → `ProjectFileError('invalid')`.
- [ ] RED → implement → GREEN → commit `feat(sketch): sketch model and file format v2`.

### Task 2: Geometry — loops, tessellation, area, bounds
**Files:** Create `src/sketch/geometry.ts`; Test `tests/sketch/geometry.test.ts`.
**Produces:** `tessellate(sk, entityId, step=1/32): Pt[]`; `findLoops(sk): { closed: string[][]; gaps: Pt[] }` (chains entities by shared/coincident endpoints within 1/64"); `loopPolygon(sk, loop): Pt[]`; `selfCrossing(poly): Pt | null`; `polygonArea(poly)`; `bounds(polys): {minX,minY,maxX,maxY}`; `outlineFromSketch(sk): { outline: Outline; outer: Pt[]; holes: Pt[][] } | { error: string; at?: Pt }` (largest closed loop is outer; loops inside it are holes; circles inside are `circles`; messages per spec §6).
- [ ] Tests: rectangle-with-arch fixture (30 × 4, 2" rise): one closed loop, area = 30·2 + segment area (± 0.5%), bounds 30 × 4; an open L-shape → error "This outline has a gap — close it to make a part" with `at` at the open end; a bow-tie → "The outline crosses itself here." with `at` ≈ (0,0); a rectangle with an inner rectangle and an inner circle → 1 hole + 1 circle.
- [ ] RED → GREEN → commit `feat(sketch): loops, tessellation, area and bounds`.

### Task 3: Solver wrapper
**Files:** Create `src/sketch/solver.ts`; Test `tests/sketch/solver.test.ts`.
**Produces:** `initSolver(locate?: () => string): Promise<void>`; `solveSketch(sk): { sketch: Sketch; status: 'ok' | 'conflict' | 'failed'; dof: number; conflicting: string[] }` (maps points/entities/constraints to planegcs primitives; ids preserved; on conflict/failure returns the input geometry unchanged).
- [ ] Tests: rough rectangle + horizontal/vertical + two distances + fixed corner → exact 10 × 4, `dof` 0; remove one distance → `dof` 1 and status ok; contradictory distances (10 and 12 on the same edge) → status `conflict`, conflicting includes both ids, points unchanged; a circle with `diameter` 3 → r 1.5; tangent line–arc pair solves; the solve of the fixture takes < 250 ms.
- [ ] RED → GREEN → commit `feat(sketch): constraint solving with planegcs`.

### Task 4: Freehand smoothing and shape presets
**Files:** Create `src/sketch/freehand.ts`; Test `tests/sketch/freehand.test.ts`.
**Produces:** `smoothStroke(pts: Pt[], into: Sketch): Sketch` (RDP 1/16 → runs fit to lines/arcs within 1/32 → rest as spline; closes within 1/4"); `presetShape(kind: 'circle'|'heart'|'star'|'letters', size: number, text?: string): Sketch`; `scaleSketchTo(sk, width): Sketch` (rounded to 1/8").
- [ ] Tests: a wobbly 10" horizontal stroke (±0.02) → one line ≈ 10" long; a wobbly circle (r 3, ±0.02, 60 pts) → arcs/circle with all tessellated points within 1/16" of r 3; a closed heart stroke → `outlineFromSketch` succeeds; one point → sketch unchanged; two points → one line; `presetShape('heart', 6)` width 6; `scaleSketchTo(x, 5.3)` → width 5.25.
- [ ] RED → GREEN → commit `feat(sketch): freehand smoothing and shape presets`.

### Task 5: Shaped boards in the engine
**Files:** Modify `src/model/ops.ts` (`shapeBoard(p, boardId | null, sketchId, woodId?)`, `unshapeBoard`), `src/model/cutlist.ts` (note), `src/model/validate.ts` (joint outside outline warning), `src/ui/three/BoardMesh.tsx` (extrude outline polygon with holes; existing cuts still subtracted); Test `tests/sketch/shapedBoard.test.ts`.
**Produces:** `shapeBoard(p, null, sketchId, woodId)` adds a new board sized to the outline bounds (thickness from wood, placed at origin flat); with a board id it applies the outline to that board (keeps position, sets width/length to bounds); `outlinePolygons(project, board): { outer: Pt[]; holes: Pt[][] } | null` (board-local, shifted so bounds start at 0,0).
- [ ] Tests: arch apron from a 1x6 → cut list row 3/4 × 4 × 30 with note `Shaped — cut to pattern (print full size)`; a shaped board with a dado still lists the dado note and the Shaped note; `outlinePolygons` area within 1% of `polygonArea`; editing the sketch (rise 3") and re-shaping updates width/length; a dado partner whose contact falls in the arch cut-away → warning "The shape of Apron doesn't reach where it joins Leg"; unshape → rectangle again.
- [ ] RED → GREEN → commit `feat(sketch): shaped boards`.

### Task 6: Full-size print tiling, DXF and SVG
**Files:** Create `src/sketch/tiling.ts`, `src/sketch/dxf.ts`, `src/sketch/svg.ts`; Test `tests/sketch/output.test.ts`.
**Produces:** `tilePages(bounds, { page: {w:7.5,h:10}, overlap: 0.5 }): { id: string; col: number; row: number; x: number; y: number }[]`; `toDxf(sk | outline polys): string`; `toSvg(sk): string`.
- [ ] Tests: 30 × 14 → 5 columns × 2 rows? (computed: cols = ceil((30-0.5)/(7.5-0.5)) …) asserted exactly with ids A1…; DXF contains `$INSUNITS`, `70\n1` in header, `LINE`/`ARC` entities with the fixture's coordinates, layer `OUTLINE`; SVG has `width="30in"`, `viewBox="0 0 30 4"`, an `A` arc command.
- [ ] RED → GREEN → commit `feat(sketch): full-size tiling, DXF and SVG`.

### Task 7: Drawing board (precise mode)
**Files:** Create `src/sketch/drawStore.ts`, `src/sketch/ui/DrawingBoard.tsx`, `src/sketch/ui/Canvas.tsx`, `src/sketch/ui/ToolBar.tsx`, `src/sketch/ui/ConstraintBar.tsx`, `src/sketch/snap.ts`, `src/sketch/modify.ts`; Modify `src/ui/store.ts` (Screen `'draw'`), `src/ui/App.tsx`, `src/ui/designer/Toolbar.tsx` (Draw a shape / Edit shape); Test `tests/sketch/drawStore.test.ts`, `tests/sketch/modify.test.ts`.
**Produces:** `draw` store: `{ sketch, history, tool, selection, solve: {status,dof,conflicting}, message }`; actions `addPoint/addLine/addRect/addArc3/addArcCenter/addCircle/addSpline/addText`, `addConstraint(kind, refs, value?)`, `setDimension(id, value)`, `remove(ids)`, `undo/redo`, `snapTo(pt)`; `modify.ts`: `fillet(sk, cornerPointId, r)`, `chamfer(sk, cornerPointId, d)`, `trim(sk, entityId, at)`, `extend(sk, lineId, toEntityId)`, `offset(sk, entityIds, d)`, `mirror(sk, entityIds, axisLineId)`. Snaps: endpoint, midpoint, center, intersection, tangent (circle/arc from a point), grid.
- [ ] Tests: drawing a rect then two dimensions and fixing a corner → dof 0; editing a dimension resizes; a conflicting dimension → status conflict, sketch unchanged, message names it; fillet r 1 on a rectangle corner → two shortened lines + tangent arc; offset a closed rectangle 0.5 outward → 11 × 5; trim a line crossing another at the click side; mirror across a construction line; snaps return endpoint before grid.
- [ ] RED → GREEN → commit `feat(sketch): precise drawing board`.

### Task 8: Freehand mode, using a drawing, kids' tile
**Files:** Create `src/sketch/ui/Freehand.tsx`, `src/sketch/ui/UseDrawing.tsx` (Cut a board / Print full size / Export), `src/sketch/ui/FullSizePrint.tsx`; Modify `src/kids/ui/KidsHome.tsx` (Draw It!), electron main/preload (`exportShape(kind, text, name)` save dialog); Test `tests/sketch/useDrawing.test.tsx`.
- [ ] Tests: Cut a board disabled with the gap message for an open sketch; enabled for a closed one and adds a shaped board to the studio project; Print full size renders the tile pages with a 96 px check square each; Export calls `exportShape('dxf', …)`; freehand Size 5.3 → 5-1/4".
- [ ] RED → GREEN → commit `feat(sketch): freehand, cut to shape, full-size print, export`.

### Task 9: End-to-end, review, installer, delivery
**Files:** Create `tests/e2e/drawing.spec.ts`.
- [ ] e2e: arched apron drawn with tools + dimensions → cut from 1x6 → cut list 30 × 4 with Shaped note; Print full size page count and check-square size; DXF/SVG export files contain expected sizes; kids freehand heart (mouse drag) → cut from 1x8 → print.
- [ ] Full unit + e2e + typecheck; screenshot review of the drawing board; final reviewer; one fix pass; `npm run dist`; deliver.
