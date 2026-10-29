# Named Sizes, Formulas & Layout Rules Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Named sizes, formulas in any size box, four layout rules (spacing, center, gap, count), joints that follow, and templates that unlock into formulas.

**Architecture:** A pure formula language (`src/formulas/expr.ts`) and a recalculation engine (`src/formulas/recalc.ts`). The engine works in a fixed order: sizes → board/joint formula fields → count rules → placement rules → re-seat grooves. It returns a new project plus errors. The studio store runs it inside every `apply`. Templates gain an `unlockForm` that emits sizes, formulas and rules. UI: a Sizes tab, a formula-aware size box, and a rule dialog.

**Tech Stack:** TypeScript strict, React 18, zustand, Vitest (jsdom), Playwright `_electron`.

**Spec:** `docs/superpowers/specs/2026-10-29-sizes-formulas-rules-design.md`

## Global Constraints

- Inches only; every computed size or position is snapped to 1/64" (`snap64`).
- Project format **4**; `MIGRATIONS[3]` is identity + version bump.
- Messages exactly as the spec writes them (unknown size, can't read near, depend on each other, works out to, dividing by zero, rules disagree, used by, replace the formula, placed by a rule).
- Formula fields are paths into a board:
  - board: `width`, `length`, `x`, `y`, `z`
  - turning: `turning.top`, `turning.bottom`, `turning.maxD`, `turning.minD`
  - taper: `taper.start`, `taper.foot`
  - holes: `holes.<n>.u|v|diameter`
  - edge profiles: `edges.<n>.size`
  - joints: `width`, `depth`, `offset`
- `x/y/z` mean the board's world-box minimum.
- Kids' Simple Designer: no Sizes tab, no formula editing.
- Recalculation must return the **same object** when a project has no sizes, formulas or rules (existing identity checks rely on it).

## Review Focus

1. A formula referring to a part that is renamed or deleted → error on that box, last value kept, no crash. → Task 3 test `renamed part breaks the formula plainly`.
2. A count rule whose `first` part is deleted → the rule goes with it (one undo step). → Task 4 test `deleting the first part removes its count rule`.
3. A live (locked) template with formulas typed into it → refused as today (LIVE_TEMPLATE), not half-applied. → Task 6 test `live template refuses formulas`.
4. A rule moving a rotated part (e.g. an upright shelf) → uses its world box. → Task 4 test `spacing works on rotated parts`.
5. Undo after a size change restores every dependent part exactly. → Task 6 test `undo restores dependents`.

---

### Task 1: Formula language

**Files:** Create `src/formulas/expr.ts`; Test `tests/formulas/expr.test.ts`.

**Produces:**
- `type Expr` (AST)
- `parseFormula(text: string): { ok: true; expr: Expr } | { ok: false; error: string }` — text without the leading `=`
- `evalFormula(e: Expr, lookup: (name: string) => number | undefined): { ok: true; value: number } | { ok: false; error: string }`
- `namesIn(e: Expr): string[]` (lower-cased)
- `isFormulaText(s): boolean` (starts with `=`)
- `FUNCTIONS = ['min','max','round','floor','ceil','abs','round8','round16']`

- [ ] Tests:
  - `11-3/4` → 11.75; `11 3/4` → 11.75
  - `1' 2"` → 14; `12"` → 12
  - `3/4*2` → 1.5; `H - 2*T` with H 36, T 0.75 → 34.5
  - `-(2+3)` → −5; `max(W/3, 6)` → max
  - `round8(1.3)` → 1.25; `floor(13/4)` → 3
  - `Side#2.Length` and `Wood.ply_3_4.T` parse as names
  - `Hight + 1` → "Unknown size 'Hight'"
  - `H * (2` → `Can't read this formula near '(2'`
  - `1/0` → "Dividing by zero"
  - names are case-insensitive
  - `namesIn('H - 2*t')` → `['h','t']`
- [ ] RED → GREEN → commit `feat(formulas): formula language`.

### Task 2: Model fields and format v4

**Files:** Modify `src/model/types.ts`, `src/shaping/types.ts` (none — edge formulas use the board path `edges.<n>.size`), `src/model/fileFormat.ts`, `src/model/woods.ts`; Create `src/formulas/types.ts`; Test `tests/formulas/fileFormat.test.ts`; update old version pins.

**Produces** (`src/formulas/types.ts`):
- `type SizeDef = { name: string; expr: string }`
- `type Axis3 = 'x'|'y'|'z'`
- `type Rule =`
  - `{ id; kind: 'spacing'; axis; from; to; parts: string[] }`
  - `| { id; kind: 'center'; axes: Axis3[]; part; on }`
  - `| { id; kind: 'gap'; axis; part; to; side: 'min'|'max'; gap: number; gapExpr?: string }`
  - `| { id; kind: 'count'; expr: string; first: string; copies: string[]; axis; from; to }`
- Model fields: `Project.sizes?`, `Project.rules?`, `Board.formulas?: Record<string,string>`, `Joint.formulas?: Record<string,string>`.
- **File checks:** structural only (strings, known kinds). Ids and names are not checked: broken references are a recalculation error, not a refused file (spec §6).

- [ ] Tests:
  - v3 → v4 opens
  - round-trip with sizes, board and joint formulas, and all four rule kinds
  - a rule with an unknown kind, or a formula that isn't a string, gives "isn't a valid A&A project"
  - a rule pointing at a missing board still opens
- [ ] RED → GREEN; fix version pins → commit `feat(formulas): format v4 with sizes, formulas and rules`.

### Task 3: Recalculation of sizes and formula fields

**Files:** Create `src/formulas/recalc.ts`, `src/formulas/ops.ts`; Test `tests/formulas/recalc.test.ts`, `tests/formulas/ops.test.ts`.

**Produces:**
- `recalc(p: Project): { project: Project; errors: FormulaError[] }` with `FormulaError = { key: string; message: string; boardIds: string[] }`.
  - Keys: `size:<lowername>`, `board:<id>:<path>`, `joint:<id>:<path>`, `rule:<id>`.
  - Steps 1–2 here: build the graph of nodes (sizes; board fields with formulas; built-ins `<Part>.Width/Length/Thickness/X/Y/Z`, `Wood.<id>.T/W`); topologically order; report loops as "These sizes depend on each other: A → B → A"; evaluate; write values (sizes via `snap64`, positions by shifting `position` so the world-box min equals the value).
  - Tasks 4–5 extend this same function.
- `partNames(p): Map<string, string>` (lower-case name, with `#n` for duplicates → board id)
- **Ops** (`ops.ts`), all pure: `setSize(p, name, expr)`, `renameSize(p, old, new)` (rewrites formulas textually by name token), `deleteSize(p, name): Project | OpError` ("H is used by: Side (Length), …"), `setBoardFormula(p, id, path, expr | null)`, `setJointFormula(p, id, path, expr | null)`, `formulaUsers(p, name): string[]`.

- [ ] Tests:
  - sizes depending on sizes
  - a board width formula `=W/2` follows W
  - an `x` formula positions the world min (rotated board)
  - `Side#2.Length` resolves to the second Side
  - a loop is reported and the value kept
  - "Width works out to -2" — it must be more than 0" (negative x allowed)
  - rename `H` → `Height` rewrites `H - 2*T` to `Height - 2*T` but not `Hx`
  - deleting a size in use is refused with the users listed
  - renamed part breaks the formula plainly
  - no formulas → same object
  - a turning.top formula and an edges.0.size formula apply
- [ ] RED → GREEN → commit `feat(formulas): sizes and formula fields recalculate`.

### Task 4: Layout rules

**Files:** Create `src/formulas/rules.ts`; Modify `src/formulas/recalc.ts` (steps 3–4), `src/model/ops.ts` (`deleteBoards` also removes rules naming a deleted board, and copies from count rules); Test `tests/formulas/rules.test.ts`.

**Produces:**
- `applyRules(p, rules, lookup): { project; errors }`
- `addRule(p, r: Omit<Rule,'id'>): Project | OpError`, `removeRule(p, id)`
- `ruleLabel(p, r): string` (e.g. `Equal spacing (Shelf ×3)`, `Centered (Pull on Drawer front)`, `Gap 2" (Pull)`, `Count =Shelves (Shelf)`)
- `controlledBy(p, boardId, axis): Rule | null`
- Count copies are made by duplicating `first` (new ids), copying its joints to `from`/`to`-side hosts, then spacing them. Removing copies removes their joints. Count result: `round`, clamped to [1, 100]. Error "Count works out to 0 — it must be at least 1" when below 1.
- Conflicts: a second rule placing the same part on the same axis is skipped with "These rules disagree: <label> and <label> — remove one".

- [ ] Tests:
  - spacing three parts of thickness 3/4, 3/4 and 1-1/2 between faces 0 and 30 → equal clear gaps
  - centered on x and z
  - gap 1/8 on the max side; flush (0) on the min side; `gapExpr` follows a size
  - count 3 → 5 adds two copies with dados to both sides; 5 → 2 removes three and their joints
  - a conflicting second rule is skipped and warned
  - deleting the first part removes its count rule
  - spacing works on rotated parts
- [ ] RED → GREEN → commit `feat(formulas): layout rules`.

### Task 5: Joints follow

**Files:** Create `src/formulas/reseat.ts`; Modify `src/formulas/recalc.ts` (step 5); Test `tests/formulas/reseat.test.ts`.

**Produces:**
- `reseatGrooves(p): Project` — for each dado/rabbet without an `offset` (or `width`) formula, re-derive offset/width from the partner's box in host coordinates, exactly as `addGroove` does (rabbets to the nearer edge).
  - Depth, face and `along` are kept.
  - Runs only when sizes, formulas or rules exist.
- Joint formula fields apply before re-seating and are respected.

- [ ] Tests:
  - a shelf moved up 4" by a spacing rule takes both dados (offset +4)
  - a rabbet for a back panel follows the back when D changes
  - a joint with an `offset` formula keeps it
  - a joint that no longer meets keeps its params and validate warns as before
- [ ] RED → GREEN → commit `feat(formulas): joints follow their parts`.

### Task 6: Store integration and template unlock

**Files:** Modify `src/ui/store.ts` (run `recalc` in `apply` after the LIVE_TEMPLATE check, and on load; `formulaErrors` in state; warnings include formula errors), `src/templates/index.ts` (`unlock` uses `unlockForm`), `src/templates/{box,bookshelf,birdhouse}.ts` (`unlockForm(params, woods): { sizes, formulas: Record<boardIndex, Record<path,string>>, rules: Omit<Rule,'id'>[] by board index }`); Test `tests/formulas/unlock.test.ts`, `tests/formulas/store.test.ts`.

- Sizes per template:
  - Box: `W, D, H, T (=Wood.<id>.T), Rab (=floor(T*32)/64)`
  - Bookshelf: `W, H, D, Shelves, T, TB, DadoDepth (=min(1/4, floor(T*32)/64)), BackRabbet (=min(5/16, floor(T*32)/64)), Inset (=3/4)`
  - Birdhouse: `FloorW, FloorD, Height, Overhang, Hole, T`
- Bookshelf with Shelves ≥ 1: a count rule `=Shelves` on the first Shelf, between Bottom and Top along z.

- [ ] Tests:
  - for each template at defaults and at two other settings: `unlock` gives the same boards (sizes, world boxes) and the same cut list as the live template, within 1/64"
  - after unlock, changing W/H/D (and Shelves for Bookshelf) gives the same cut list as a fresh live template with those settings
  - store: `apply(setSize…)` recalculates
  - a formula error lands in `formulaErrors` and `warnings`
  - undo restores dependents
  - live template refuses formulas
- [ ] RED → GREEN → commit `feat(formulas): store recalculates; templates unlock into formulas`.

### Task 7: UI — Sizes tab, formula boxes, rules

**Files:**
- Create `src/formulas/ui/SizesTab.tsx`, `src/formulas/ui/FormulaInput.tsx`, `src/formulas/ui/RuleDialog.tsx`
- Modify:
  - `src/ui/designer/PartsList.tsx` (Parts | Sizes tabs, hidden for kids)
  - `src/ui/designer/PropertiesPanel.tsx` (width/length/X/Y/Z use `FormulaInput`; "Rules on this part"; "Add a rule")
  - `src/ui/designer/JointPanel.tsx` (groove width/depth/offset)
  - `src/shaping/ui/*Section.tsx` (their size boxes)
  - `src/ui/three/MoveGizmo.tsx` (confirm before moving a rule/formula-controlled part)
- Test `tests/formulas/ui.test.tsx`.

**Produces:** `FormulaInput({ label, value, formula, error, onValue(n), onFormula(expr|null), allowZero, disabled })`:
- shows the value with *ƒ* when a formula is set; on focus shows `=formula`
- Enter: `=…` sets the formula; a plain value when a formula exists asks "Replace the formula =… with …?" (Replace / Keep formula)
- the error is shown under the box

- [ ] Tests:
  - Sizes tab add/edit/rename/delete (refusal message shown)
  - typing `=W/2` sets the formula and shows ƒ
  - typing 30 over it asks and replaces
  - a bad formula shows its message
  - Add a rule dialog creates each kind
  - "Rules on this part" lists and removes
  - kids mode hides the Sizes tab and shows plain boxes
- [ ] RED → GREEN → commit `feat(formulas): sizes tab, formula boxes and rules UI`.

### Task 8: End-to-end, review, installer, delivery

**Files:** Create `tests/e2e/formulas.spec.ts`.
- [ ] e2e:
  1. Bookshelf → Unlock → Sizes tab H 36 → 48 → the Side cut-list row is 48", the shelves are re-spaced (the Properties Z of the middle shelf changed), the cut list is otherwise as a live 48" bookshelf
  2. `=W/2` in a part's width follows W; typing a number asks
  3. a slat count rule `=floor(W/4)` adds slats when W grows
  4. a bad formula's message
- [ ] Full unit + e2e + tsc; screenshot review; Opus final review; one fix pass; `npm run dist`; deliver; report.
