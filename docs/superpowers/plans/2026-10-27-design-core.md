# Piece 1: Design Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Windows desktop app (A&A Woodworking Studio) with a home screen offering Kids' Workshop (placeholder) and Master Shop, where Master Shop is a 3D board designer with templates, basic joints (including miters), angled end and edge cuts, a wood library, a cut list, and safe project files.

**Architecture:** A pure TypeScript project model (`src/model`) owns all data and rules and is unit-tested without UI. Templates (`src/templates`) generate boards and joints from parameters. React + react-three-fiber screens (`src/ui`) edit the model through a single store with undo history; an Electron shell (`electron/`) owns file I/O, safe saving and autosave.

**Tech Stack:** Electron, electron-vite, React 18, TypeScript (strict), Tailwind CSS 3, three, @react-three/fiber, @react-three/drei, three-bvh-csg, zustand, Vitest, Playwright (`_electron`), electron-builder (NSIS).

**Spec:** `docs/superpowers/specs/2026-10-27-design-core-design.md`

## Global Constraints

- Inches only. No metric anywhere (no toggle, no mm input).
- Display fractions to 1/32", reduced, tape-measure style: `11-3/4"`, `3/4"`, `6"`, `23/32"`.
- Internal values: inches as numbers, snapped to 1/64" on every write to the model (`snap64`).
- Input accepts `11 3/4`, `11-3/4`, `11.75`, `3/4`, `11'`, `1' 2-1/2"`, optional trailing `"`.
- Moves snap to a 1/16" grid when no face/edge/corner snap applies.
- Dado/rabbet depth ≤ 1/2 host thickness; width > 0; joint must lie within the host.
- Miter and bevel angles: −60° to +60° from square (0 = square). Lengths in the cut list are long point to long point.
- Undo history holds at least 100 steps.
- Autosave every 30 seconds to `<name>.aaw.autosave`; on save keep `<name>.aaw.bak`.
- Project files are JSON with extension `.aaw`, containing `formatVersion: 1`. Default folder: `Documents\A&A Woodworking`.
- Sheet goods are 48" × 96". Plywood actual thicknesses: 1/4" = 7/32", 1/2" = 15/32", 3/4" = 23/32".
- Board feet = T × W × L / 144 (inches). Sheet estimate = ceil(total part area ÷ 4608) per sheet good.
- App/product name: `A&A Woodworking Studio`. Installer: `A&A Woodworking Studio Setup.exe`.
- `src/model` and `src/templates` must not import React, three, or Electron.

## Review Focus

1. **Typed size of zero, blank, or larger than any stock:** zero/blank is rejected inline and the old value kept; oversize is accepted but shows the "exceeds stock" warning. Pinned in Task 2 (parse) and Task 7 (warning).
2. **Opening a file from a newer app version or a hand-edited/truncated file:** a plain error naming the backup, with no crash and no overwrite. Pinned in Task 9.
3. **Disk full or permission denied during save:** the last good `.aaw` stays intact. Pinned in Task 12 (inject a failing write).
4. **Changing a live template's parameters after manual edits:** the template regenerates only while live; after Unlock, edits stick and parameters are gone. Pinned in Task 8.
5. **Deleting a board that has joints:** its joints are removed too, with no dangling references in the cut list or warnings. Pinned in Task 10.

---

## File Structure

```
aa-woodworking-studio/
  package.json, electron.vite.config.ts, tsconfig*.json, tailwind.config.js,
  postcss.config.js, electron-builder.yml, vitest.config.ts, playwright.config.ts
  electron/
    main.ts            window, menu, IPC registration
    preload.ts         window.aa API (openProject, saveProject, saveAs, readAutosave, writeAutosave, exportCsv, print)
    fileStore.ts       safeSave, loadWithBackupInfo, autosave paths (pure Node fs, unit-tested)
  src/
    model/
      units.ts         snap64, parseInches, formatInches
      types.ts         Project, Board, Joint, Wood, Vec3, Cut, CutListRow, Warning
      ids.ts           newId(prefix)
      woods.ts         BUILTIN_WOODS, boardFeet, findWood
      joints.ts        validateJoint, cutGeometry, jointNotes
      contact.ts       contactBetween, jointOffers
      cutlist.ts       cutList, cutListCsv
      validate.ts      validate (warnings)
      ops.ts           pure edit operations (add/move/rotate/duplicate/mirror/align/delete/rename/addJoint/updateJoint)
      snap.ts          snapPosition
      fileFormat.ts    serialize, deserialize, migrate, ProjectFileError
      history.ts       History<T> (undo/redo, cap 100+)
    templates/
      index.ts         TEMPLATES registry, applyTemplate, unlock
      box.ts, bookshelf.ts, birdhouse.ts
    ui/
      store.ts         zustand store wrapping project + history + selection
      App.tsx, Home.tsx, KidsPlaceholder.tsx
      designer/ Designer.tsx, PartsList.tsx, PropertiesPanel.tsx, InchInput.tsx,
                Toolbar.tsx, TemplatePanel.tsx, JointPanel.tsx, CutListView.tsx, WarningsList.tsx
      three/    Scene.tsx, BoardMesh.tsx, MoveGizmo.tsx, MeasureTool.tsx, ViewControls.tsx
  tests/
    model/*.test.ts, templates/*.test.ts, electron/fileStore.test.ts
    e2e/designer.spec.ts
```

---

### Task 1: Project scaffold

**Files:**
- Create: everything at the repo root listed above, plus `electron/main.ts`, `electron/preload.ts`, `src/ui/App.tsx` (renders "A&A Woodworking Studio"), `tests/model/sanity.test.ts`

**Interfaces:**
- Produces: scripts `npm run dev`, `npm run build`, `npm test` (vitest run), `npm run e2e` (playwright), `npm run dist` (electron-builder --win nsis)

- [ ] **Step 1:** Initialize git in `aa-woodworking-studio` (request delete permission for the Woodworking folder first; git needs to delete lock files). Add `.gitignore`: `node_modules/ out/ dist/ test-results/`.
- [ ] **Step 2:** `npm init -y`, then install the stack listed in the header (exact versions land in `package-lock.json`). Configure electron-vite with main `electron/main.ts`, preload `electron/preload.ts`, renderer root `src/ui`. TypeScript `strict: true`. Tailwind content globs `src/ui/**/*.tsx`.
- [ ] **Step 3:** Write `tests/model/sanity.test.ts`: `expect(1 + 1).toBe(2)`. Run `npm test`. Expected: 1 passed.
- [ ] **Step 4:** Run `npm run build`. Expected: exit 0, `out/` created.
- [ ] **Step 5:** Check whether Playwright Electron can launch here: `xvfb-run -a npx playwright --version` (install `xvfb` if missing and possible; if no display is possible, record that e2e runs on Adam's laptop and continue).
- [ ] **Step 6:** Commit `chore: scaffold electron + react + vitest`.

### Task 2: Inch units

**Files:** Create `src/model/units.ts`; Test `tests/model/units.test.ts`

**Interfaces:**
- Produces: `snap64(n: number): number`; `parseInches(text: string): { ok: true; value: number } | { ok: false; reason: string }`; `formatInches(n: number): string`

- [ ] **Step 1: Failing tests**
```ts
expect(formatInches(11.75)).toBe('11-3/4"'); expect(formatInches(0.75)).toBe('3/4"');
expect(formatInches(6)).toBe('6"'); expect(formatInches(0.71875)).toBe('23/32"');
expect(formatInches(9.78125)).toBe('9-25/32"'); expect(formatInches(29.0625)).toBe('29-1/16"');
expect(formatInches(36)).toBe('36"');            // never shown as feet
for (const t of ['11 3/4','11-3/4','11.75','11 3/4"']) expect(parseInches(t)).toEqual({ok:true,value:11.75});
expect(parseInches("11'")).toEqual({ok:true,value:132});
expect(parseInches(`1' 2-1/2"`)).toEqual({ok:true,value:14.5});
expect(parseInches('3/4')).toEqual({ok:true,value:0.75});
for (const t of ['', '   ', 'abc', '-3', '1/0', '0', '298mm']) expect(parseInches(t).ok).toBe(false);
expect(snap64(0.718)).toBe(46/64);
```
`'0'` is rejected because every size field must be > 0; offset fields that allow 0 use `parseInches(text, { allowZero: true })` (add the option and one test: `parseInches('0',{allowZero:true})` → `{ok:true,value:0}`).
- [ ] **Step 2:** Run `npx vitest run tests/model/units.test.ts`. Expected: FAIL (module missing).
- [ ] **Step 3:** Implement. `formatInches` rounds to the nearest 1/32 and reduces the fraction. Reasons are short user-facing text: `"Enter a size like 11-3/4"`, `"Size must be more than 0"`, `"Metric isn't supported — use inches"` for `mm`/`cm`.
- [ ] **Step 4:** Run tests. Expected: PASS.
- [ ] **Step 5:** Commit `feat(model): inch parsing and fraction display`.

### Task 3: Core types and woods

**Files:** Create `src/model/types.ts`, `src/model/ids.ts`, `src/model/woods.ts`; Test `tests/model/woods.test.ts`

**Interfaces:**
- Produces (types.ts):
  - `type Vec3 = { x: number; y: number; z: number }`
  - `type Wood = { id: string; name: string; kind: 'lumber' | 'hardwood' | 'sheet'; species: string; thickness: number; width: number; length: number; pricePerBoardFoot?: number; pricePerSheet?: number; builtIn: boolean }`
  - `type Hole = { diameter: number; u: number; v: number }` (u along width, v along length, from the board's origin corner)
  - `type EndCut = { miter: number; bevel: number }` (degrees; miter tilts across the face: positive means the short point is on the +x edge; bevel tilts through the thickness: positive means the short point is on the +z face)
  - `type Board = { id: string; name: string; woodId: string; thickness: number; width: number; length: number; position: Vec3; rotation: Vec3; grain: 'length' | 'width'; holes: Hole[]; endCuts: { start: EndCut; end: EndCut }; edgeBevels: { left: number; right: number } }` (local axes: x = width, y = length, z = thickness; position is the origin corner; `length` is the long-point length; `start` is the y = 0 end; `left` is the x = 0 edge)
  - `type JointType = 'butt' | 'dado' | 'rabbet' | 'pocketScrew' | 'miter'`
  - `type Joint = { id: string; type: JointType; hostBoardId: string; partnerBoardId: string; params: ButtParams | GrooveParams | PocketParams | MiterParams }`
  - `ButtParams = { fastener: 'glue' | 'screws' | 'nails'; count: number }`; `GrooveParams = { width: number; depth: number; offset: number; face: 'top' | 'bottom' }`; `PocketParams = { count: number; spacing: number; screwLength: number }`; `MiterParams = { angle: number; fastener: 'glue' | 'nails' | 'splines' }`
  - `type TemplateState = { templateId: string; params: Record<string, number | boolean | string> }`
  - `type Project = { formatVersion: 1; name: string; units: 'in'; boards: Board[]; joints: Joint[]; woods: Wood[]; template?: TemplateState }`
- Produces (woods.ts): `BUILTIN_WOODS: Wood[]`, `findWood(project, id): Wood | undefined`, `boardFeet(t, w, l): number`, `emptyProject(name: string): Project` (woods = copy of BUILTIN_WOODS)
- Produces (ids.ts): `newId(prefix: 'b' | 'j' | 'w'): string`

- [ ] **Step 1: Failing tests:** BUILTIN_WOODS contains exactly the spec §6.4 set with these ids and sizes: `1x2`…`1x12` (thickness 0.75; widths 1.5, 2.5, 3.5, 5.5, 7.25, 9.25, 11.25; length 144); `2x2` (1.5×1.5), `2x4` (1.5×3.5), `2x6` (1.5×5.5), all length 144; `hw-4-4` (0.75), `hw-5-4` (1.0), `hw-8-4` (1.75), each width 12 and length 144, species "Hardwood"; `ply-1-4` (0.21875), `ply-1-2` (0.46875), `ply-3-4` (0.71875), `mdf-1-2` (0.5), `mdf-3-4` (0.75), each 48×96, kind 'sheet'. `boardFeet(0.75, 5.5, 96)` equals 2.75. `emptyProject('X').woods` is a deep copy (mutating it does not change BUILTIN_WOODS).
- [ ] **Step 2:** Run, see FAIL.
- [ ] **Step 3:** Implement. Lumber lengths: store max stock length 144 (12'); the 8'/10'/12' choice is metadata `availableLengths: [96, 120, 144]` on lumber entries (add as an optional field on `Wood`).
- [ ] **Step 4:** Run, PASS.
- [ ] **Step 5:** Commit `feat(model): types and built-in wood library`.

### Task 4: Joint geometry and notes

**Files:** Create `src/model/joints.ts`; Test `tests/model/joints.test.ts`

**Interfaces:**
- Consumes: types, `formatInches`
- Produces: `validateJoint(project, joint): string | null` (reason or null); `type Cut = { boardId: string; kind: 'dado' | 'rabbet' | 'hole' | 'pocket'; min: Vec3; max: Vec3 } | { boardId: string; kind: 'hole'; center: Vec3; diameter: number; depth: number }` (board-local coordinates); `cutGeometry(project): Cut[]`; `jointNotes(project, boardId): string[]`

- [ ] **Step 1: Failing tests** with a host 0.75 × 10 × 36 board and a partner shelf:
  - dado `{width: 0.75, depth: 0.25, offset: 6, face:'top'}` → one Cut on the host, kind 'dado', spanning the full host width, `min.y = 6`, `max.y = 6.75`, `min.z = 0.5`, `max.z = 0.75`.
  - Host notes equal `['3/4" dado × 1/4" deep, 6" from end']`.
  - `validateJoint` returns a reason for depth 0.5 on a 0.75 host (> half), for width 0, and for offset 35.5 with width 0.75 (runs past the end); null for the valid dado.
  - Rabbet `{width: 0.21875, depth: 0.375, offset: 0}` → the cut sits at the host's edge; note `7/32" rabbet × 3/8" deep`.
  - A board with `holes:[{diameter:1.25,u:3.25,v:6}]` → a 'hole' Cut and the note `1-1/4" hole, 6" from end, centered` when `u` = width/2 (otherwise `… 3-1/4" from edge`).
  - Pocket screw `{count:2, spacing:4, screwLength:1.25}` → partner note `2 pocket screws (1-1/4"), 4" apart`.
  - Butt with screws count 2 → partner note `Butt joint: 2 screws`; with glue → `Butt joint: glue`.
  - A board with 45° miters on both ends → note `45° miter both ends`; only the start → `45° miter one end`; `edgeBevels.left = 15` → `15° bevel, left edge`; `endCuts.end.bevel = 30` → `30° bevel, one end`. (Equal signs on both ends give a parallelogram, opposite signs a trapezoid; the note is the same, and the 3D view shows the difference.)
  - Miter end cut geometry: a 0.75 × 2 × 14 board with a 45° start miter has a 'miter' Cut whose removed wedge leaves the short-point edge 2" shorter than the long-point edge (short point = long point − width × tan 45°).
  - Board validation rejects a miter/bevel of 61° and a miter whose short point would be ≤ 0 (for example, 60° on a 2"-wide, 3"-long board).
  - Extend the `Cut` union with `{ boardId; kind: 'miter' | 'bevel'; plane: { point: Vec3; normal: Vec3 } }` (the board-local cutting plane; material on the normal side is removed).
- [ ] **Step 2:** Run, FAIL.
- [ ] **Step 3:** Implement. Note format is exactly `{width} dado × {depth} deep, {offset} from end` (`rabbet` has no offset clause when offset is 0).
- [ ] **Step 4:** Run, PASS.
- [ ] **Step 5:** Commit `feat(model): joint cuts, validation, notes`.

### Task 5: Contact detection and joint offers

**Files:** Create `src/model/contact.ts`; Test `tests/model/contact.test.ts`

**Interfaces:**
- Produces: `type Contact = { kind: 'endToFace' | 'edgeToFace' | 'faceToFace' | 'cornerEnds'; host: string; partner: string; nearHostEnd: boolean; cornerAngle?: number }`; `contactBetween(project, aId, bId): Contact | null`; `jointOffers(c: Contact): JointType[]`

- [ ] **Step 1: Failing tests** (world boxes from position, size and rotation in 90° steps; touching means faces coplanar within 1/64" and overlapping in area):
  - Shelf end against a side's face → `endToFace`, host = side; offers `['butt','dado','pocketScrew']`.
  - The same with the shelf within the side's thickness of the side's end → `nearHostEnd: true`; offers add `'rabbet'`.
  - A back panel's edge against a side's face → `edgeToFace`; offers `['butt','dado','rabbet']`.
  - Two boards stacked face to face → `faceToFace`; offers `['butt']`.
  - Two boards meeting at a 90° corner where one board's end butts against the other's edge or face right at the other's end (a frame corner or a box corner) → `cornerEnds` with `cornerAngle: 90`; offers `['butt','miter']`. The same corner already mitered (both 45° ends touching) is also `cornerEnds`.
  - Boards 1/8" apart → `null`.
- [ ] **Step 2:** FAIL. **Step 3:** Implement using world-space AABBs (boards with non-90° rotation return `null`; documented limitation for Piece 1). **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat(model): contact detection and joint offers`.

### Task 6: Cut list and CSV

**Files:** Create `src/model/cutlist.ts`; Test `tests/model/cutlist.test.ts`

**Interfaces:**
- Consumes: `jointNotes`, `findWood`, `boardFeet`, `formatInches`
- Produces: `type CutListRow = { qty: number; part: string; thickness: number; width: number; length: number; woodName: string; grain: 'length' | 'width'; notes: string[] }`; `type CutListTotals = { boardFeetByWood: Record<string, number>; sheetsByWood: Record<string, number>; cost?: number }`; `cutList(project): { rows: CutListRow[]; totals: CutListTotals }`; `cutListCsv(project): string`

- [ ] **Step 1: Failing tests:**
  - Group key = wood + T + W + L + grain + notes. The part label is the distinct names joined with ` / ` in first-seen order (`'Top / Bottom / Shelf'`).
  - Rows are sorted by wood name, then thickness descending, then length descending.
  - Mitered or beveled parts include their angle notes, and their length is the long point: a frame rail 0.75 × 2 × 14 with 45° on both ends shows length `14"` and note `45° miter both ends`. Boards with different end cuts never group together.
  - `boardFeetByWood` only covers non-sheet woods; `sheetsByWood` = ceil(sum(W×L) / 4608) for sheet woods.
  - `cost` is present only when every used wood has a price (board feet × price, sheets × pricePerSheet).
  - CSV header is exactly `Qty,Part,Thickness,Width,Length,Wood,Grain,Notes`; sizes use `formatInches`; notes are joined with `; `; fields containing `,` or `"` are quoted and inner quotes doubled.
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** PASS. **Step 5:** Commit `feat(model): cut list, totals, CSV`.

### Task 7: Warnings

**Files:** Create `src/model/validate.ts`; Test `tests/model/validate.test.ts`

**Interfaces:**
- Produces: `type Warning = { kind: 'overlap' | 'exceedsStock' | 'badJoint'; boardIds: string[]; message: string }`; `validate(project): Warning[]`

- [ ] **Step 1: Failing tests:**
  - Two un-joined boards intersecting by more than 1/64" → `overlap` naming both boards. A pair that shares a joint is never flagged.
  - A board 0.75 × 6 × 150 of wood `1x6` → `exceedsStock` (length > 144). A 0.75 × 8.5 × 8.5 board of `1x6` → `exceedsStock` (width > 5.5). Width and length are not swapped to make a part fit.
  - A board whose thickness differs from its wood's thickness → `exceedsStock`, message `Thickness doesn't match <wood name>`.
  - A joint failing `validateJoint` → `badJoint` with that reason.
  - Message text names the board, for example `Roof is wider than 1x6 (5-1/2")`.
- [ ] **Step 2:** FAIL. **Step 3:** Implement (AABB overlap for 90° rotations; non-90° boards are skipped for overlap). **Step 4:** PASS. **Step 5:** Commit `feat(model): design warnings`.

### Task 8: Templates and Unlock

**Files:** Create `src/templates/{index,box,bookshelf,birdhouse}.ts`; Test `tests/templates/templates.test.ts`

**Interfaces:**
- Consumes: types, ops-free construction (templates build boards and joints directly)
- Produces: `type TemplateDef = { id: 'box' | 'bookshelf' | 'birdhouse'; name: string; params: ParamDef[]; build(params): { boards: Board[]; joints: Joint[] } }`; `ParamDef = { key: string; label: string; kind: 'inches' | 'count' | 'bool' | 'wood'; default: number | boolean | string; min?: number; max?: number }`; `TEMPLATES: TemplateDef[]`; `applyTemplate(project, id, params?): Project` (sets `project.template`, replaces boards/joints); `updateTemplateParams(project, patch): Project` (regenerates only if `project.template` is set); `unlock(project): Project` (removes `template`, keeps boards/joints)

- [ ] **Step 1: Failing hand-checked fixtures** (compare `cutList(...).rows` with exact values):
  - **Box**, defaults W 12, D 8, H 6, wood `hw-4-4`, joints butt/glue, lid false:
    `2 × Front / Back 3/4 × 6 × 12`; `2 × Side 3/4 × 6 × 6-1/2`; `1 × Bottom 3/4 × 6-1/2 × 10-1/2`. Lid true adds `1 × Lid 3/4 × 8 × 12`. Option `corners: 'rabbet'` → rabbets 3/4" wide × 3/8" deep on the front/back ends and sides become `3/4 × 6 × 7-1/4`.
  - **Bookshelf**, defaults W 30, H 36, D 10, shelves 3, wood `ply-3-4`, back true (`ply-1-4`): `2 × Side 23/32 × 10 × 36` with 5 dado notes each (top and bottom dados 3/4" from the ends, 3 shelves equally spaced between them; dado width 23/32, depth 1/4) and a `7/32" rabbet × 5/16" deep` note (5/16 keeps within half of 23/32); `5 × Top / Bottom / Shelf 23/32 × 9-25/32 × 29-1/16`; `1 × Back 7/32 × 29-3/16 × 36`. Totals: `ply-3-4` 1 sheet, `ply-1-4` 1 sheet.
  - **Birdhouse**, defaults floor 5 × 5, height 8, overhang 1, hole 1-1/4, wood `1x10`: `1 × Front 3/4 × 6-1/2 × 8` with note `1-1/4" hole, 6" from end, centered`; `1 × Back 3/4 × 6-1/2 × 8`; `2 × Side 3/4 × 5 × 8`; `1 × Floor 3/4 × 5 × 5`; `1 × Roof 3/4 × 8-1/2 × 8-1/2`; butt joints with 2 screws each.
  - `validate()` returns no warnings for all three defaults.
  - `updateTemplateParams(p, {W: 14})` on a live box changes Front/Back to 14 long. After `unlock`, `p.template` is undefined and moving a board then calling `updateTemplateParams` leaves the boards unchanged (returns the project as is).
  - Parameters outside `min`/`max` (box W min 2, max 96; shelves 0–12) are clamped and reported: `applyTemplate` returns the clamped params in `project.template.params`.
- [ ] **Step 2:** FAIL. **Step 3:** Implement. Boards are positioned in world space so `contactBetween` recognizes each joint (Task 5 must return the matching contact for every template joint; assert this in a test). **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat(templates): box, bookshelf, birdhouse with unlock`.

### Task 9: File format

**Files:** Create `src/model/fileFormat.ts`; Test `tests/model/fileFormat.test.ts`

**Interfaces:**
- Produces: `serialize(p: Project): string` (pretty JSON, 2 spaces); `deserialize(text: string): Project`; `class ProjectFileError extends Error { code: 'corrupt' | 'newerVersion' | 'invalid' }`; `migrate(raw: any, migrations?: Record<number, (raw:any)=>any>): any`

- [ ] **Step 1: Failing tests:** each template default round-trips (`deserialize(serialize(p))` deep-equals p); truncated JSON → `code 'corrupt'`; `formatVersion: 2` → `'newerVersion'` with message `This project was made with a newer version of A&A Woodworking Studio.`; a board missing `width` → `'invalid'` naming the board; `migrate` with an injected `{0: r => ({...r, formatVersion: 1, holes: []})}` upgrades a v0 object.
- [ ] **Step 2:** FAIL. **Step 3:** Implement with hand-written structural checks (no schema library). **Step 4:** PASS. **Step 5:** Commit `feat(model): .aaw file format with versioning`.

### Task 10: Edit operations and history

**Files:** Create `src/model/ops.ts`, `src/model/history.ts`, `src/model/snap.ts`; Test `tests/model/ops.test.ts`, `tests/model/history.test.ts`, `tests/model/snap.test.ts`

**Interfaces:**
- Produces (ops.ts; every op returns a new Project and never mutates; all sizes pass through `snap64`):
  `addBoard(p, init: Partial<Board> & { woodId: string }): { project: Project; id: string }` (defaults: thickness from the wood, width = min(wood width, 6), length 12, position at origin, grain 'length');
  `updateBoard(p, id, patch: Partial<Board>)`; `moveBoard(p, id, position: Vec3)`; `rotateBoard(p, id, axis: 'x'|'y'|'z', degrees: number)`;
  `duplicateBoards(p, ids): { project; ids: string[] }` (offset +1" on x, names suffixed ` (copy)`);
  `mirrorBoards(p, ids, axis)` (mirrors across the selection's center plane);
  `alignBoards(p, ids, axis, mode: 'min'|'center'|'max')`;
  `deleteBoards(p, ids)` (also removes joints referencing them); `renameBoard(p, id, name)`;
  `addJoint(p, type, hostId, partnerId, params?): { project; id: string }` (dado/rabbet extend the partner's length (endToFace) or width (edgeToFace) by `depth` and shift it into the groove; default dado/rabbet width = partner thickness, depth = 1/4"; returns an error result `{ error: string }` when `jointOffers` does not include the type);
  `updateJoint(p, id, params)` (applies the depth delta to the partner); `removeJoint(p, id)` (reverses the extension).
  Miter: `addJoint(p, 'miter', aId, bId, { angle?: number })` on a `cornerEnds` contact sets the meeting ends of both boards to `angle` (default = cornerAngle ÷ 2, i.e. 45° for 90°), extends the board that stopped at the corner by the other board's extent across the corner (its width for a flat frame, its thickness for a box corner) so both reach the outside corner, and records the original lengths in the joint so `removeJoint` restores them exactly.
  `setEndCut(p, id, end: 'start' | 'end', cut: Partial<EndCut>)` and `setEdgeBevel(p, id, edge: 'left' | 'right', degrees: number)` (reject |angle| > 60 with `{ error }`).
- Produces (history.ts): `class History<T> { constructor(initial: T, cap = 200); get current(): T; push(next: T): void; undo(): T; redo(): T; canUndo; canRedo }`
- Produces (snap.ts): `snapPosition(p, id, proposed: Vec3, opts: { tolerance: number; grid: number }): { position: Vec3; snaps: string[] }`. Per axis, snap a moving face to the nearest coplanar face of another board within `tolerance`; otherwise round to `grid` (1/16). Corner and edge snaps fall out of snapping two or three axes.

- [ ] **Step 1: Failing tests:**
  - `deleteBoards` on a dadoed shelf removes its joint, and `cutList`/`validate` show no reference to it.
  - Dado add then remove returns the partner length to the original exactly.
  - `updateJoint` depth 1/4 → 3/16 shortens the partner by 1/16.
  - `addJoint('dado')` on a face-to-face contact returns `{ error }`.
  - History: 150 pushes then 100 undos all succeed; redo after a new push is cleared.
  - `snapPosition` moves a board whose face is 0.1" from another's face onto it (tolerance 0.25) and reports `'face'`; with nothing nearby, 3.03 rounds to 3.0625 on the 1/16 grid.
  - Rotate 90° about z swaps the world footprint; `mirrorBoards` of two boards about x keeps their gap.
  - Picture frame: four 0.75 × 2 boards (rails 14", stiles 10" between them) fitted as a butt-jointed frame with the stiles between the rails (14 × 14 outside). Adding a miter at all four corners gives every board 45° on both ends, outside dimensions unchanged, and the cut list shows `4 × Rail / Stile 3/4 × 2 × 14` with `45° miter both ends`. Removing the four miters restores the original lengths.
  - `mirrorBoards` flips the sign of miter angles so mirrored parts stay correct.
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** PASS. **Step 5:** Commit `feat(model): edit operations, snapping, undo history`.

### Task 11: File store (Electron main, Node only)

**Files:** Create `electron/fileStore.ts`; Test `tests/electron/fileStore.test.ts` (uses a temp dir)

**Interfaces:**
- Produces: `safeSave(path: string, text: string, fs?: FsLike): Promise<void>`; `load(path): Promise<{ text: string; autosaveNewer: boolean; autosavePath: string; backupPath: string }>`; `autosavePath(path | null, docsDir): string` (untitled → `<docsDir>/A&A Woodworking/Untitled.aaw.autosave`); `defaultFolder(docsDir): string`

- [ ] **Step 1: Failing tests:**
  - safeSave writes `<p>.tmp`, renames the existing `<p>` to `<p>.bak`, then renames tmp to `<p>`; after two saves, `.bak` holds the first content.
  - An injected `fs.writeFile` that throws `ENOSPC` leaves the original `<p>` byte-identical and rejects with message `Couldn't save — disk full or no permission. Your last saved version is safe.`
  - `load` reports `autosaveNewer: true` when the autosave mtime is greater than the file's.
- [ ] **Step 2:** FAIL. **Step 3:** Implement with `fs/promises`. **Step 4:** PASS. **Step 5:** Commit `feat(shell): safe save, backup, autosave paths`.

### Task 12: Shell wiring (main + preload)

**Files:** Modify `electron/main.ts`, `electron/preload.ts`; Create `src/ui/aa-api.d.ts`

**Interfaces:**
- Produces `window.aa`: `openProject(): Promise<{ path: string; text: string; autosaveNewer: boolean; autosaveText?: string } | null>`, `saveProject(path: string, text: string): Promise<void>`, `saveAs(text: string, suggestedName: string): Promise<string | null>`, `writeAutosave(path: string | null, text: string): Promise<void>`, `exportCsv(text: string, suggestedName: string): Promise<string | null>`, `print(): Promise<void>`, `loadUserWoods(): Promise<Wood[]>`, `saveUserWoods(woods: Wood[]): Promise<void>` (stored as `woods.json` in Electron `userData`)
- Window title `A&A Woodworking Studio — <project name>`, plus `*` when unsaved. The close prompt on unsaved changes offers Save / Don't Save / Cancel.

- [ ] **Step 1:** Implement IPC handlers using `fileStore`, `dialog` (filter `{ name: 'A&A Project', extensions: ['aaw'] }`), and `app.getPath('documents')`; create the default folder on first run. `contextIsolation: true`, `nodeIntegration: false`.
- [ ] **Step 2:** Verify with `npm run build`. Expected: exit 0. (Behavior is covered by the Task 15 e2e tests.)
- [ ] **Step 3:** Commit `feat(shell): IPC file API, title, close prompt`.

### Task 13: Store, home screen, designer panels

**Files:** Create `src/ui/store.ts`, `src/ui/Home.tsx`, `src/ui/KidsPlaceholder.tsx`, `src/ui/designer/{Designer,PartsList,PropertiesPanel,InchInput,Toolbar,TemplatePanel,JointPanel,WarningsList,WoodLibraryDialog}.tsx`; Modify `src/ui/App.tsx`; Test `tests/ui/store.test.ts`, `tests/ui/InchInput.test.tsx` (vitest + jsdom + @testing-library/react)

**Interfaces:**
- Consumes: all model ops, templates, `History`, `validate`
- Produces (store): `useStudio` with state `{ screen: 'home'|'kids'|'master'; project: Project; selection: string[]; filePath: string | null; dirty: boolean; warnings: Warning[] }` and actions `apply(fn: (p: Project) => Project)` (pushes history, recomputes warnings, sets dirty), `undo()`, `redo()`, `select(ids)`, `newFromTemplate(id)`, `newBlank()`, `open()`, `save()`, `saveAs()`; an autosave interval of 30000 ms while `dirty`.

- [ ] **Step 1: Failing tests:** `apply` then `undo` restores the project and selection; dirty clears after save (mock `window.aa`). InchInput: typing `abc` + Enter shows `Enter a size like 11-3/4"` and calls no onChange; typing `11 3/4` + Enter calls onChange(11.75) and displays `11-3/4"`; Escape restores the old value.
- [ ] **Step 2:** FAIL. **Step 3:** Implement:
  - **Home:** two large buttons, "Kids' Workshop" and "Master Shop".
  - **KidsPlaceholder:** "Coming soon — the Kids' Workshop is being built." with a Back button.
  - **Designer:** PartsList (rename inline, multi-select with Ctrl/Shift), PropertiesPanel (wood dropdown, InchInput for T/W/L/X/Y/Z; thickness is locked to the wood's thickness; an "Ends & edges" section with miter/bevel angle boxes for each end and bevel boxes for each edge, plus 45° / 22-1/2° / square quick buttons), Toolbar (Add board, Duplicate, Mirror, Align, Rotate 90°, Delete, Undo, Redo, Measure, view buttons, Cut List), TemplatePanel (live parameters + Unlock with a confirm), JointPanel (shown when exactly two boards are selected; lists `jointOffers` and the params of an existing joint), WarningsList (click selects the boards).
  - **WoodLibraryDialog:** lists built-in and user woods. Add/edit/delete user stock (name, species, kind, T/W/L via InchInput, optional price per board foot or per sheet). Saved with `window.aa.saveUserWoods`; new projects get BUILTIN_WOODS + user woods; a project's woods list gains any user wood the moment a board uses it, so files stay self-contained. Test: adding a user wood `Walnut 4/4, 0.8125 × 7 × 72` makes it selectable and a board using it is copied into `project.woods`.
  - **Open errors:** a `ProjectFileError` shows its message plus `Your backup is at <backupPath>` when one exists.
  - Keyboard: Ctrl+Z, Ctrl+Y, Ctrl+S, Ctrl+D (duplicate), Delete.
- [ ] **Step 4:** PASS. **Step 5:** Commit `feat(ui): store, home, designer panels`.

### Task 14: 3D view

**Files:** Create `src/ui/three/{Scene,BoardMesh,MoveGizmo,MeasureTool,ViewControls}.tsx`

**Interfaces:**
- Consumes: store, `cutGeometry`, `snapPosition`
- Produces: `<Scene />` used by Designer.

- [ ] **Step 1:** Implement:
  - **BoardMesh:** box geometry with CSG subtraction of that board's cuts (three-bvh-csg); hole cuts are cylinders; miter and bevel cuts subtract a large box positioned on the removed side of the cut plane. Recompute geometry only when the board or its cuts change (memoize on a JSON key).
  - Wood colors by kind (lumber pine tone, hardwood darker, sheet layered edge). Selected boards get an outline; warning boards a red tint.
  - **MoveGizmo:** drei `TransformControls` in translate mode. On drag, call `snapPosition` with tolerance = 0.25" and grid = 1/16 and show snap labels; commit one history entry on mouse up.
  - **ViewControls:** Orbit 3D (perspective + OrbitControls), Front, Side and Top (orthographic, rotation disabled), and Zoom to fit.
  - **MeasureTool:** two clicks on board surfaces show a line and its `formatInches` distance; Escape clears it.
- [ ] **Step 2:** Manual check with `npm run dev`: the bookshelf template shows visible dados in the sides; dragging a board near another snaps flush; Top view is orthographic.
- [ ] **Step 3:** Commit `feat(ui): 3D scene with CSG cuts, snapping move, views, measure`.

### Task 15: Cut list screen, print/CSV, e2e

**Files:** Create `src/ui/designer/CutListView.tsx`, `tests/e2e/designer.spec.ts`

**Interfaces:**
- Consumes: `cutList`, `cutListCsv`, `window.aa.exportCsv`, `window.aa.print`

- [ ] **Step 1:** Implement CutListView: a table with the columns from Task 6, a totals block, Print (a print stylesheet hides the app chrome, landscape), and Save as CSV.
- [ ] **Step 2: E2E tests** (Playwright `_electron.launch`; the test sets `AA_DOCS_DIR` to a temp dir, which main.ts honors in place of `documents`):
  1. Home → Master Shop → Box template → set W to `14` → the Cut List shows `2 × Front / Back 3/4 × 6 × 14`.
  2. Bookshelf → select a Side and a Shelf → JointPanel lists Dado. Change the shelf dado depth to `3/16` → the shelf length in the cut list drops by 1/16.
  3. Save as `test.aaw` → close the window → relaunch → open → the cut list is identical.
  4. Make an edit, wait 31 s, kill the app process, relaunch, open → the recovery prompt appears → accepting it restores the edit.
  5. Kids' Workshop shows the coming-soon text, and Back returns Home.
  6. Blank project → add four 3/4 × 2 boards and snap them into a 14 × 14 butt-jointed frame (rails 14", stiles 10") → select two at a corner → JointPanel offers Miter → apply to all four corners → the cut list shows `4 × Rail / Stile 3/4 × 2 × 14` with `45° miter both ends`.
- [ ] **Step 3:** Run `xvfb-run -a npm run e2e` (or `npm run e2e` on Windows). Expected: 6 passed.
- [ ] **Step 4:** Commit `feat(ui): cut list view; e2e flows`.

### Task 16: Windows installer and handoff check

**Files:** Create `electron-builder.yml`, `build/icon.ico` (simple A&A monogram, 256 px), `Build-Installer.bat`, `README.md`

- [ ] **Step 1:** In `electron-builder.yml`, set `appId: com.aawoodworking.studio`, `productName: A&A Woodworking Studio`, `win.target: nsis`, `nsis.oneClick: false`, `nsis.createDesktopShortcut: always`, `fileAssociations: [{ ext: aaw, name: A&A Project }]`. When building on Linux without wine, set `win.signAndEditExecutable: false`.
- [ ] **Step 2:** Run `npm run dist`. Expected: `dist/A&A Woodworking Studio Setup <version>.exe` exists. `Build-Installer.bat` runs `npm ci && npm run dist` for building on Adam's laptop.
- [ ] **Step 3:** Run the full suite: `npm test` (all pass) and the e2e suite (6 pass).
- [ ] **Step 4: Manual walkthrough** before handoff: build each template at default and one changed size; build a free-form 3-board shelf with typed sizes and snapping, add two dados, check the cut list by hand; build a mitered picture frame and a board with a 15° beveled edge; save, reopen, print. Record the results in `docs/superpowers/plans/2026-10-27-design-core-walkthrough.md`.
- [ ] **Step 5:** README: how to install, where projects are saved, and how to rebuild. Commit `chore: windows installer and handoff docs`.
