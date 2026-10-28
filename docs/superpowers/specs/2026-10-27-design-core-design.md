# A&A Woodworking Studio — Piece 1: Design Core

**Date:** 2026-10-27
**Status:** Draft for Adam's review
**Owner:** Adam (A&A Woodworking)

## 1. Purpose

A Windows desktop program for Adam and his 8-year-old son, built as **two sides
on one shared engine**:

- **Kids' Workshop:** a skill path with badges, parent-controlled tool
  permissions, shop safety with quizzes, what each tool does, wood types, a very
  simple design system, basic joinery, simple projects that print step-by-step
  instructions with a cut sheet, read-aloud, and games (lathe turning first).
- **Master Shop:** a state-of-the-art CAD design system, cut optimization and
  shopping lists, shop drawings, doors/drawers/hardware, curves and edge
  profiles, realistic rendering, advanced projects, full joinery including a
  Japanese joint designer, and an in-depth library of species, wood movement,
  finishes, glues, techniques and calculators.

The feature list was checked against current woodworking software, cut
optimizers, learning apps and youth programs (two research passes, 2026-10-27);
see §2.1.

Adam has ~20 years of woodworking experience and is fluent in AutoCAD and 20-20,
so the Master Shop must be precise. The goal is "the best of the best."

**Release approach:** the program is built piece by piece but **not rolled out
until every piece below is 100% complete.** Each piece must still be finished,
tested and working before the next begins.

**This spec covers Piece 1, the shared Design Core** that both sides are built on.

This is a fresh design. The earlier Perplexity "Workbench 9A" is reference
material only; no code is reused.

### Success criteria for Piece 1

1. Starting from a template, Adam and his son can produce a box, bookshelf or
   birdhouse design in under 15 minutes.
2. The cut list for each template matches a hand calculation exactly
   (finished sizes, to 1/32").
3. A free-form design can be built entirely from boards with typed dimensions
   and snapping, the way Adam would in CAD.
4. Saved projects reopen identically, and a crash loses at most 30 seconds of work.

## 2. Overall roadmap (context)

| # | Piece | Scope | Side |
|---|---|---|---|
| **1** | **Design Core** (this spec) | Shared project model, wood library, templates, 3D view, board tools, joints (butt, dado, rabbet, pocket screw, **miter**), **bevel and angled cuts**, cut list, save/load, home screen with both sides, installer | Shared |
| 2 | Kids' Workshop v1 | Skill path modeled on 4-H Woodworking Wonders (4 levels) with badges and printable certificates; parent-controlled tool permissions by age/experience tier (beginner / intermediate / advanced, "adult does this" marks); safety lessons with quiz gates; safety-gear checklist; first aid basics; tools explained; wood types and "tree to board"; very simple designer; 3–5 projects with kid project sheets (difficulty stars, time estimate, tools, check-off boxes, finished-photo spot, time and cost tracking); read-aloud of all text | Kids |
| 3 | Master Shop CAD Pro | Linked copies and assemblies; groups; rules that survive Unlock (equal spacing, centered, fixed gap); on-model dimensions and annotations; section views; hide/isolate; reference image import and trace; Shop Mode (large-text step-by-step view for the bench) | Adult |
| 4 | Cut Optimizer & Buying | Sheet and board layouts; kerf and trim per material; grain lock and grain matching; rough lumber with defects marked; fewer fence changes; scrap/offcut reuse from inventory; shopping list (what to buy); printable part labels with part numbers and QR codes; full cost (wood, hardware, finish, edge banding) | Both |
| 5 | Shop Drawings & Printing | Dimensioned front/side/top, exploded views, sections, auto-dimensions, part numbers; full-size 1:1 templates tiled across letter pages; complete printable plan packets (kid and adult) | Both |
| 6 | Doors, Drawers & Hardware | Door generators (slab, Shaker, raised panel, glass), drawer boxes, face frames; hardware library (hinges, slides, pulls, screws, shelf pins) with hardware list; shelf-pin layout | Adult |
| 7 | Shapes & Edges | Curves, arches, tapers and non-rectangular parts; edge profiles (roundover, chamfer, cove, ogee); edge banding | Adult |
| 8 | Realistic Rendering | Species grain textures, finish color and sheen, lighting, image export | Both |
| 9 | Kids' Games | Lathe turning; tape-measure reading; spot-the-shop-hazard; match-the-wood; joint puzzle | Kids |
| 10 | Joinery Library & Joint Designer | Western joints (lap, dowel, biscuit, box, mortise and tenon, dovetail, more) and Japanese joinery; Tsugite-style joint designer with fit and weak-point feedback; Japanese tools and water-stone sharpening; kid and adult levels | Both |
| 11 | Deep Library | Species database (Janka, workability, toxicity/allergen warnings, uses, typical price) from a licensed data source; wood movement calculator and a design warning for cross-grain construction; shelf sag calculator and a sag warning on shelves; finishes (selector by properties, compatibility, dry times, food-safe, schedules, mixing); glues (open and clamp times); techniques; sharpening; adult safety (kickback, dust, hearing); lumber grades, nominal vs actual sizes; drill-press speeds; glossary | Adult (kid-level summaries) |
| 12 | Shop Tools | Calculators (board feet, fractions, even spacing, compound miter angles, drawer sizing, golden ratio, shellac, epoxy); shop journal (photos, notes, time, cost per project); inventory (lumber, tools, hardware, finishes, low-stock alerts; feeds the optimizer) | Both |
| 13 | Family & Sharing | Parent dashboard; multiple kid profiles; project packages to share between users; full backup and restore (projects, photos, journal) | Both |
| 14 | Smart Helpers (internet) | Photo wood identification; "describe a project" starter designs; hands-free voice "next step" in Shop Mode. These need online AI services; costs and privacy are decided in this piece's spec | Both |
| 15 | Projects & Templates | Expanded project and template libraries on both sides, ongoing until release | Both |

Each piece gets its own spec, plan and implementation cycle. Release happens
only after all pieces are complete. Explicitly not planned: metric units,
CNC/DXF export, business quotes/invoices, shop floor layout planner.

### 2.1 Design principles from the research

- **Kids' rewards are earned in the shop, not in the app.** Badges come from
  finished real projects (parent confirms) and passed safety quizzes. No streaks,
  no guilt notifications, no virtual shop or currency. (Kids 8–12 tend to game
  reward systems.)
- **The parent controls permissions.** Tool tiers follow the 4-H risk model;
  steps involving tools above the child's tier are marked "Adult does this".
- **Every design warning teaches.** Warnings (stock size, cross-grain movement,
  shelf sag, toxic species) link to the library page that explains them.

## 3. Out of scope for Piece 1

- Everything assigned to Pieces 2–15 in §2 (for example: cut optimization,
  shop drawings, linked copies, curves, doors/drawers, rendering, games,
  library content)
- Joints beyond butt, dado, rabbet, pocket screw and miter
- Metric units: **not planned at all** (inches only, per Adam)

## 4. Technology

- **Shell:** Electron (Windows), packaged with electron-builder as an NSIS
  installer: `A&A Woodworking Studio Setup.exe`, with a desktop shortcut.
- **UI:** React + TypeScript, Tailwind CSS.
- **3D:** Three.js via react-three-fiber; joint cut-outs rendered with CSG
  (three-bvh-csg).
- **Tests:** Vitest for the project model; Playwright (Electron mode) for UI flows.
- **Build requirement on Adam's laptop:** Node.js LTS (free).

## 5. Architecture

Three layers, each with one job and a narrow interface.

### 5.1 Project Model (`src/model/`) — no UI, no Electron

Pure TypeScript; the single source of truth that later pieces read.

- `Project`: `{ formatVersion, name, units: "in", boards: Board[], joints: Joint[], template?: TemplateState, woods: WoodRef[] }`
- `Board`: `{ id, name, woodId, thickness, width, length, position {x,y,z}, rotation {x,y,z} (degrees), grain: "length" | "width" }`
  — dimensions stored as inches (float), always snapped to 1/64" internally.
- `Board` also carries `endCuts` and `edgeCuts`: an angle per end/edge
  (`miter`: 0–60° across the face; `bevel`: 0–60° through the thickness),
  measured from square; 0 = square cut.
- `Joint`: `{ id, type: "butt" | "dado" | "rabbet" | "pocketScrew" | "miter", hostBoardId, partnerBoardId, params }`
  - miter params: `angle` (default 45°), `fastener` (glue, nails, splines),
    applied to the meeting ends of both boards
  - dado / rabbet params: `width`, `depth`, `offset` (from the reference edge)
  - pocket screw params: `count`, `spacing`, `screwLength`
- **Derived functions** (pure, tested):
  - `cutGeometry(project)`: the material removed from each board (for 3D and notes)
  - `finishedSizes(project)`: board sizes including joint allowances (for example, shelf length + 2 × dado depth)
  - `cutList(project)`: grouped rows plus totals
  - `validate(project)`: warnings (overlap, exceeds stock, impossible joint)

### 5.2 Templates (`src/templates/`)

Each template is a function `(params) => { boards, joints }`.

| Template | Parameters | Default joints |
|---|---|---|
| Box | outer W, D, H; wood; thickness; lid yes/no | Butt (option: rabbet corners) |
| Bookshelf | W, H, D; shelf count; wood; back yes/no | Dadoed shelves, rabbeted back |
| Birdhouse | floor W/D, height, roof overhang, entry-hole diameter | Butt + screws |

While a project is **live-template**, changing a parameter regenerates its boards
and joints. **Unlock** converts it to plain boards and joints permanently (with
undo available); after that, only free-form editing applies.

### 5.3 Screens (`src/ui/`) and Shell (`electron/`)

- **Home screen:** two large entries, **Kids' Workshop** and **Master Shop**.
  In Piece 1 the Kids' Workshop entry opens a "coming soon" placeholder; the
  Master Shop opens the designer below. Both sides use the same project model
  and files.
- **Designer layout:** parts list (left), 3D view (center), properties panel (right), toolbar (top).
- **Shell responsibilities:** open/save dialogs, file I/O, autosave timer,
  recovery prompt, and the window menu. The UI talks to the shell through a small
  preload API: `openProject`, `saveProject`, `saveAs`, `readAutosave`, `exportCsv`, `print`.

## 6. Features in detail

### 6.1 Measurements
- Inches only. Display as a tape measure reads, to 1/32", reduced fractions (`11-3/4"`).
- Input accepts `11 3/4`, `11-3/4`, `11.75`, `3/4`, `11'`, `1' 2-1/2"`.
- Invalid input (negative, zero where not allowed, non-numeric) is rejected
  inline with a reason; the previous value is kept.

### 6.2 Board tools
- Add board (wood + thickness from library; size typed or dragged)
- Move with snapping to faces, edges and corners of other boards, and to a 1/16"
  grid; typed exact offsets
- Rotate in 90° steps or by a typed angle
- Duplicate, Mirror (across X, Y or Z), Align (faces/edges of a selection)
- Measure: click two points and get the distance
- Views: orbit 3D, plus orthographic Front / Side / Top
- Multi-select, rename, delete
- Undo/redo for every change (command history, minimum 100 steps)

### 6.3 Joints
- Select two touching boards and the app offers only the joint types valid for
  their contact (for example, a dado needs one board's end against the other's face).
- Creating or editing a joint updates `cutGeometry` and `finishedSizes` for both boards.
- Validation: dado/rabbet depth ≤ 1/2 host thickness; width > 0; the joint must
  lie within the host board.
- **Miter:** offered when two board ends meet at a corner. Picking it sets both
  ends to the angle that closes the corner (45° for a 90° corner) and extends both
  boards to their long-point length.
- **Bevel and angled cuts:** any board end or edge can be cut at an angle from the
  properties panel (miter across the face, bevel through the thickness).
- The cut list shows length **long point to long point**, with the angle noted
  (for example `45° miter both ends`).

### 6.4 Wood library
- Built in, at actual sizes:
  - Dimensional lumber: 1x2, 1x3, 1x4, 1x6, 1x8, 1x10, 1x12 (3/4" thick); 2x2, 2x4, 2x6 (1-1/2" thick); 8', 10' and 12' lengths
  - Hardwood boards: 4/4 (3/4" S4S), 5/4 (1"), 8/4 (1-3/4")
  - Sheets 48" × 96": plywood 1/4" (7/32"), 1/2" (15/32"), 3/4" (23/32"); MDF 1/2", 3/4"
- User stock: add your own with name, species, exact thickness, width and
  length, and an optional price per board foot or per sheet.
- The library is stored in the app's settings and copied into each project file,
  so projects stay self-contained.

### 6.5 Cut list
- Identical parts grouped (same wood, finished T × W × L and grain): "2 × Side".
- Columns: Qty, Part, T × W × L (finished), Wood, Grain, Joint notes.
- Joint notes are generated, for example: `3/8" dado × 1/4" deep, 6" from bottom edge`.
- Totals: board feet per solid wood; estimated sheet count per sheet good (simple
  area ÷ sheet area, rounded up; true layout is Piece 3); optional cost.
- Output: on-screen table, Print, Save as CSV.

### 6.6 Warnings
Shown as a badge on the affected part and in a warnings list:
- Boards overlapping (beyond joint cuts)
- Part larger than any available stock of its wood
- Impossible joint (fails §6.3 validation)

## 7. Files, saving and errors

- Project file: `.aaw` (JSON), default folder `Documents\A&A Woodworking`.
- `formatVersion` in every file; loader migrates older versions step by step.
- On save: write to a temp file, keep the previous file as `<name>.aaw.bak`,
  then swap. A failed save never destroys the last good file.
- Autosave every 30 seconds to `<name>.aaw.autosave`; on open, offer recovery if
  the autosave is newer.
- An unreadable or corrupt file shows a plain message naming the backup; the app
  does not crash.

## 8. Testing

- **Model unit tests (Vitest):** fraction parse/format, each joint's
  finished-size math, cut-list grouping, notes and totals, each template at
  default and edge parameters, validation rules, and save/load round trips including migration.
- **Hand-checked fixtures:** the cut list for each default template is compared
  with a hand-calculated expected table.
- **UI flows (Playwright + Electron):** make a box from the template, change its
  size, add a dado shelf, check the cut list, save, close and reopen, and
  recover from autosave.
- **Done means:** all tests pass, the installer builds, and a manual walk-through
  of the three templates plus one free-form design is completed before handoff.

## 9. Project location

`Woodworking\aa-woodworking-studio\` on Adam's laptop:
`electron/`, `src/model/`, `src/templates/`, `src/ui/`, `tests/`, `docs/`.
