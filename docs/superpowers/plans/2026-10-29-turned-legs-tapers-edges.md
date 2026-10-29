# Turned Legs, Tapers & Edge Profiles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Square-to-round turned legs, tapered parts and router edge profiles on boards: in 3D, in the cut list, with printable turning and taper sheets.

**Architecture:** Pure model modules in `src/shaping/` (turning, taper, edges) operate on `Board` fields added by format v3. 3D geometry lives beside `BoardMesh` (`turnedGeometry.ts`, profile cutters). The drawing board from 7A edits turning profiles. UI is three new sections in `PropertiesPanel`, plus two printable sheets.

**Tech Stack:** TypeScript strict, React 18, zustand, three.js + three-bvh-csg, Vitest (jsdom), Playwright `_electron`.

**Spec:** `docs/superpowers/specs/2026-10-29-turned-legs-tapers-edges-design.md`

## Global Constraints

- Inches only; sizes stored on the 1/64" grid (`snap64`); shown with `formatInches`.
- Board local axes: x = width, y = length, z = thickness. The leg's **top end** is the length end higher in the world when the length axis is vertical, else the `start` (y = 0) end.
- Project format **3**; v2 files migrate unchanged (`MIGRATIONS[2]`).
- Plain-language messages exactly as the spec writes them.
- Kids (`kidsMode`): Edges section only, roundover/chamfer, 1/8" and 1/4"; Turning and Taper hidden.
- Everything tested; no network.

## Review Focus

1. A turned leg lying flat (not vertical): top end = `start`; the pommel is at y = 0. → Task 2 test `topEnd of a flat board is start`.
2. Turning a board, then changing its wood to a non-square stock: the turning becomes invalid. Show a warning, keep the data, display it square. → Task 2 test `turning on a no-longer-square blank warns`.
3. A taper on a board that also has end miters/bevels: both cuts still apply. → Task 4 test `taper and end miter both cut`.
4. Edge profile on an edge already removed by a rabbet/dado: still cut, no crash. → Task 6 test `profile cutter with a dado subtracts cleanly`.
5. Duplicate/mirror a turned leg: the copy shares the profile drawing (no duplicate sketch). Deleting the drawing makes both square. → Task 2 test `duplicate shares the profile`.

---

### Task 1: Format v3 and the new board fields

**Files:** Modify `src/model/types.ts`, `src/model/fileFormat.ts`, `src/model/woods.ts`; Create `src/shaping/types.ts`; Test `tests/shaping/fileFormat.test.ts`; update `tests/model/*` and `tests/sketch/fileFormat.test.ts` version pins.

**Interfaces — Produces** (`src/shaping/types.ts`):
- `type TurnStyle = 'taper'|'beadCove'|'vase'|'ballFoot'|'custom'`
- `type Turning = { sketchId: string; style: TurnStyle; top: number; bottom: number; shoulder: 'crisp'|'lambsTongue' }`
- `type Face = 'left'|'right'|'top'|'bottom'`
- `type Taper = { faces: Face[]; start: number; foot: number }`
- `type EdgeSide = 'left'|'right'|'start'|'end'|'outline'`
- `type EdgeProfile = { id: string; profile: 'roundover'|'chamfer'|'cove'|'ogee'; size: number; face: 'top'|'bottom'; sides: EdgeSide[] }`
- `Board.turning?`, `Board.taper?`, `Board.edges?`
- `FORMAT_VERSION = 3`

- [ ] Tests: `emptyProject().formatVersion === 3`; a v2 file migrates (fields absent); a round-trip with turning + taper + edges is equal; damaged values (taper.faces `['x']`, edges size `-1`, turning.top `'5'`) throw "isn't a valid A&A project"; a turning whose sketch is missing loads with `turning` dropped; a v4 file says "newer version".
- [ ] RED → implement → GREEN; fix old version pins; full suite and tsc → commit `feat(shaping): format v3 with turning, taper and edge fields`.

### Task 2: Turning model

**Files:** Create `src/shaping/turning.ts`; Modify `src/model/cutlist.ts` (note), `src/model/validate.ts` (warnings); Test `tests/shaping/turning.test.ts`.

**Interfaces:**
- Consumes: Task 1 types; 7A `Sketch`, `newSketch`, `addSketch`, `updateSketch`, `tessellateEntity`, `findLoops`.
- Produces:
  - `topEnd(b: Board): 'start'|'end'`
  - `isSquareBlank(b): boolean` (|w − t| ≤ 1/64)
  - `styleProfile(o: { style: Exclude<TurnStyle,'custom'>; length: number; blank: number; top: number; bottom: number; shoulder; maxD: number; minD: number }, id: string, name: string): Sketch` — x = distance from the top end, y = radius; open chain from (top, r) to (length − bottom, r); construction lines at y = 0 and y = blank/2.
  - `profileRadii(p: Project, b: Board): { x: number; r: number }[] | null` — tessellated (1/32 step), sorted by x, from the top; null when broken.
  - `turningProblem(p, b): string | null`
  - `stations(p, b): { at: number; diameter: number }[]` — profile points plus every 2", diameter to 1/32.
  - `turnBoard(p, boardId, opts): { project; sketchId } | OpError`, `unturnBoard(p, id): Project`, `TURN_NOTE(t): string`.
- Messages:
  - "Turning needs a square blank — like a 2x2 or a 1-3/4" × 1-3/4" glued-up blank."
  - "The turning is wider than the blank (max <blank>")"
  - "The profile must run from the pommel to the foot without gaps"

- [ ] Tests:
  - each style for a 1-3/4 × 29 blank, top 5, bottom 1: every radius ≤ 0.875 and > 0; the first x is 5 and the last x is 28
  - stations include 5 and 28 and are spaced ≤ 2"
  - turning a 1x4 is refused with the square message
  - maxD 2 on a 1-3/4 blank is refused with "max 1-3/4""
  - editing the profile to have a gap → `profileRadii` null, a validate warning "<name>'s turning profile must run from the pommel to the foot without gaps", and the cut list still lists the blank
  - cut list note `Turned — 5" pommel, 1" foot (see turning sheet)`
  - `topEnd` of a flat board is `start`; of a leg rotated upright with its end up, `end`
  - turning on a no-longer-square blank (changeWood) warns
  - duplicate shares the profile
- [ ] RED → GREEN → commit `feat(shaping): turned legs`.

### Task 3: Turned leg in 3D

**Files:** Create `src/ui/three/turnedGeometry.ts`; Modify `src/ui/three/BoardMesh.tsx`, `src/ui/three/Scene.tsx`, `src/kids/ui/ProjectViewer.tsx`; Test `tests/shaping/turned3d.test.ts`.

**Interfaces:**
- Produces: `turnedLeg(o: { blank: number; length: number; top: number; bottom: number; radii: {x:number;r:number}[]; fromStart: boolean }): THREE.BufferGeometry` — board-local coordinates (x ∈ [0, blank], y ∈ [0, length], z ∈ [0, blank]); pommel and foot boxes plus a LatheGeometry (48 segments) about the axis x = z = blank/2.
- `BoardMesh` prop `turned?: Parameters<typeof turnedLeg>[0] | null` (computed in Scene/ProjectViewer from `profileRadii`).

- [ ] Tests:
  - straight-taper style, 1-3/4 blank, top 5, no foot, maxD 1.5 → minD 0.75 over 24: the turned mesh volume is within 1% of the frustum + pommel box (signed tetrahedron sum)
  - bounding box = blank × length
  - `fromStart:false` puts the pommel at y = length
- [ ] RED → GREEN → commit `feat(shaping): turned legs in 3D`.

### Task 4: Tapers

**Files:** Create `src/shaping/taper.ts`; Modify `src/model/joints.ts` (`cutGeometry` adds taper plane cuts), `src/model/cutlist.ts`; Test `tests/shaping/taper.test.ts`.

**Interfaces:**
- Produces:
  - `taperLength(b, t): number`
  - `removedPerFace(b, t): Record<Face, number>`
  - `taperAngle(b, t): number` (degrees)
  - `jigAt12(b, t): number`
  - `insideFaces(p, b): Face[]` (the two faces toward the design's centre)
  - `defaultStart(p, b): number`
  - `taperProblem(b, t): string | null`
  - `taperBoard(p, id, t): Project | OpError`, `untaperBoard`
  - `taperCuts(b): PlaneCut[]`, `TAPER_NOTE`
  - `cuttingOrder(t): string[]`
- Messages: "The foot can't be bigger than the leg", "The taper can't start below the foot", "The foot must be at least 1/4"", "A turned leg is shaped by its profile".

- [ ] Tests (hand-worked):
  - 1-1/2 leg → 7/8, start 6, length 29.5 (L = 23.5), faces left + top: removed 0.625 each, angle 1.52°, jig 0.319
  - all four faces: 0.3125 each
  - left + right: 0.3125 each
  - one face: 0.625
  - note text `Taper 2 faces: 1-1/2" → 7/8" over 23-1/2", starting 6" from the top`
  - foot > size refused; start ≥ length refused; turned leg refused
  - `taperCuts` planes pass through (size − removed) at the foot end
  - a taper and an end miter both cut
  - `insideFaces` for the front-left leg of a 4-leg table points toward the table centre
  - `defaultStart` = lowest joined apron + 1/2
- [ ] RED → GREEN → commit `feat(shaping): tapers`.

### Task 5: Edge profiles model

**Files:** Create `src/shaping/edges.ts`; Modify `src/model/cutlist.ts` (notes + grouping signature), `src/model/joints.ts` (`cutGeometry` adds `ProfileCut`); Test `tests/shaping/edges.test.ts`.

**Interfaces:**
- Produces:
  - `profileSection(profile, size): Pt[]` — the removed cross-section in edge coordinates (u across the face from the edge, v down from the face), closed polygon.
    - roundover: square minus quarter circle, area size² − π size²/4
    - chamfer: triangle, size²/2
    - cove: quarter circle, π size²/4
    - ogee: a cove of radius size/2 at the face, then a roundover of radius size/2 below
  - `edgeProblem(b, list): string | null` — "A <size> <type> is too big for this board"
  - `addEdgeProfile(p, id, e: Omit<EdgeProfile,'id'>): Project | OpError`, `removeEdgeProfile(p, id, edgeId)`
  - `edgeNotes(b): string[]` — e.g. `1/4" roundover — top edges (all 4)`, `1/4" chamfer — top: left, right`
  - `ProfileCut = { boardId; kind: 'profile'; face; side: EdgeSide; section: Pt[]; length: number }` added to `Cut`.
- Kids: `KID_PROFILES = ['roundover','chamfer']`, `KID_SIZES = [1/8, 1/4]`.

- [ ] Tests:
  - section areas within 1%
  - 1/2 roundover top + 3/8 bottom on a 3/4 board's same edge refused
  - 1/2 on a 3/4 board alone OK; 7/8 refused
  - notes text
  - two parts identical except edges are separate cut-list rows
  - a profile on a turned leg's side edges refused with "Profiles can't go on a turned section"
- [ ] RED → GREEN → commit `feat(shaping): edge profiles`.

### Task 6: Edge profiles in 3D

**Files:** Create `src/ui/three/profileCutter.ts`; Modify `src/ui/three/BoardMesh.tsx`, `src/ui/three/shapeGeometry.ts`; Test `tests/shaping/edges3d.test.ts`.

**Interfaces:**
- Produces: `profileBrush(cut: ProfileCut, board: Board): Brush` (section extruded along the edge, 0.01" past each end); `extrudeOutline(shape, thickness, profiles?: { face; section(depth): inset }[])` builds 8 stacked inset layers for an outline profile.

- [ ] Tests:
  - a 1/4 roundover on all top edges of a 10 × 20 × 3/4 board removes ≈ (2·10 + 2·20)·(size² − π size²/4) of volume (± 2%)
  - an outline roundover on a shaped part: its top face area shrinks by ≈ perimeter × size (± 5%)
  - the profile cutter with a dado subtracts cleanly
- [ ] RED → GREEN → commit `feat(shaping): edge profiles in 3D`.

### Task 7: Properties sections

**Files:** Create `src/shaping/ui/TurningSection.tsx`, `TaperSection.tsx`, `EdgesSection.tsx`; Modify `src/ui/designer/PropertiesPanel.tsx`, `src/sketch/ui/session.ts` (`editTurning(board)` opens the profile; on save, re-check the turning); Test `tests/shaping/sections.test.tsx`.

- [ ] Tests (jsdom):
  - Turn this leg on a 2x2 adds the turning
  - the style select changes the profile
  - Remove turning
  - Taper section: the end-view face buttons toggle; a bad foot shows the message and changes nothing
  - Edges: "All top edges" ticks four; kids mode lists only Roundover/Chamfer and 1/8, 1/4 and hides Turning/Taper
- [ ] RED → GREEN → commit `feat(shaping): turning, taper and edge controls`.

### Task 8: Turning and taper sheets

**Files:** Create `src/shaping/ui/TurningSheet.tsx`, `src/shaping/ui/TaperSheet.tsx`; reuse `FullSizePrint` page tiling for the profile; Test `tests/shaping/sheets.test.tsx`.

- [ ] Tests:
  - the turning sheet lists the stations with `formatInches` diameters, and shows the full-size profile pages with 1" check squares
  - the taper sheet lists each face's start, amount, angle "1.5°" and jig opening at 12" "5/16"" (0.319 to the nearest 1/64); shows the cutting order
- [ ] RED → GREEN → commit `feat(shaping): turning and taper sheets`.

### Task 9: End-to-end, review, installer, delivery

**Files:** Create `tests/e2e/shaping.spec.ts`.
- [ ] e2e:
  1. a 2x2 leg turned (vase) → turning sheet stations visible
  2. a 1-1/2 leg tapered on two inside faces → the cut list note + taper sheet
  3. roundover the top edges of a tabletop and of an arched apron (7A) → notes
  4. kids roundover in the Simple Designer
- [ ] Full unit + e2e + tsc; screenshot review; Opus final review; one fix pass; `npm run dist`; deliver to the Woodworking folder; report.
